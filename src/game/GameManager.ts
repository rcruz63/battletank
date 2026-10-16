/**
 * Core 3D Vector Arcade Simulation and Scene Controller.
 * Manages Three.js scene, player tank kinematics, independent turret aim,
 * ballistic projectiles, AI enemy behaviors, boss abilities, and particles.
 */

import * as THREE from 'three';
import { getTerrainHeight, getTerrainNormal, hasLineOfSight } from './terrain.ts';
import {
  BallisticProjectile,
  CANNON_MUZZLE_VELOCITY,
  GRAVITY_DEFAULT,
  calculateMuzzleVelocity,
  stepProjectile,
} from './ballistics.ts';
import {
  ENEMY_ARCHETYPES,
  EnemyType,
  PowerUpItem,
  STAGE_CONFIGS,
  StageDefinition,
  calculatePlayerDamage,
  calculatePlayerSpeed,
  calculateReloadCooldown,
  checkSphereCollision,
} from './rules.ts';
import {
  VECTOR_COLORS,
  createFirstPersonCannonRig,
  createGoliathBossModel,
  createHydraBossModel,
  createPowerUpModel,
  createTitanBossModel,
  createVectorTankModel,
  createFastScoutModel,
  createVectorHouseModel,
  createVectorBunkerModel,
  createVectorTowerModel,
  createEnemy3DHealthBar,
  updateEnemy3DHealthBar,
  Enemy3DHealthBar,
} from './vectorModels.ts';
import {
  VectorBuilding,
  generateStageBuildings,
  checkCircleBoxCollision,
  checkPointInsideBuilding,
  isLineBlockedByBuildings,
} from './buildings.ts';
import { createVectorTerrain } from './vectorTerrain.ts';
import { sound } from './audio.ts';

export interface EnemyEntity {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  z: number;
  yaw: number;
  turretYaw: number;
  hp: number;
  maxHp: number;
  speed: number;
  alive: boolean;
  shootCooldownTimer: number;
  healthBar?: Enemy3DHealthBar;
  model: {
    group: THREE.Group;
    turretGroup?: THREE.Group;
    barrelMesh?: THREE.Group;
    ringGroup?: THREE.Group;
    mortarPipes?: THREE.Group;
    shardsGroup?: THREE.Group;
  };
  strafeDir?: number;
  behaviorTimer?: number;
}

export interface ImpactRing {
  mesh: THREE.Line;
  x: number;
  y: number;
  z: number;
  radius: number;
  maxRadius: number;
  opacity: number;
}

export interface VectorSpark {
  line: THREE.Line;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  maxAge: number;
}

export interface TargetedEnemyInfo {
  id: string;
  name: string;
  type: EnemyType;
  distance: number;
  hp: number;
  maxHp: number;
  screenX: number; // 0..100% of screen width
  screenY: number; // 0..100% of screen height
  inView: boolean;
  isBoss: boolean;
}

export interface GameCallbacks {
  onScoreUpdate: (score: number) => void;
  onHpUpdate: (hp: number, maxHp: number) => void;
  onReloadUpdate: (progress: number) => void;
  onStateUpdate: (playerX: number, playerZ: number, chassisYaw: number, turretYaw: number, turretPitch: number) => void;
  onRadarUpdate: (entities: Array<{ x: number; z: number; type: 'enemy' | 'scout' | 'boss' | 'powerup' | 'building'; alive: boolean }>) => void;
  onActivePowerUpsUpdate: (powerUps: Array<{ type: string; remainingTime: number; totalDuration: number }>) => void;
  onBossUpdate: (active: boolean, name?: string, hp?: number, maxHp?: number) => void;
  onTargetedEnemyUpdate: (target: TargetedEnemyInfo | null) => void;
  onHitConfirmed: () => void;
  onVictory: (stageNumber: number, isLastStage: boolean) => void;
  onGameOver: () => void;
  onControlModeUpdate?: (mode: 'solidary' | 'conic' | 'free') => void;
}

export class GameManager {
  private container: HTMLDivElement;
  private callbacks: GameCallbacks;

  // Control steering mode
  public controlMode: 'solidary' | 'conic' | 'free' = 'solidary';

  // Three.js Core
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private animFrameId: number = 0;
  private clock: THREE.Clock;

  // Player State
  public playerX = 0;
  public playerY = 0;
  public playerZ = 0;
  public chassisYaw = 0; // Chassis heading in radians
  public turretYaw = 0; // Independent turret heading in radians
  public turretPitch = 0.05; // Elevation angle in radians (-0.15 to +0.65)
  public playerHp = 200;
  public playerMaxHp = 200;
  public reloadTimer = 0;
  public baseReloadCooldown = 1.35; // Seconds per shot
  public score = 0;
  public playerGraceTimer = 4.0; // Seconds of initial grace protection on stage start

  // Active Power-up Timers
  public powerUpTimers: Record<string, { remaining: number; total: number }> = {};

  // Controls State
  private keysPressed = new Set<string>();
  public isPointerLocked = false;
  private cameraShake = 0;
  private barrelRecoil = 0;

  // First person rig
  private firstPersonRig!: {
    group: THREE.Group;
    barrelGroup: THREE.Group;
    cockpitFrame: THREE.Group;
  };

  // Stage & Entities
  public currentStageIndex = 0;
  private enemies: EnemyEntity[] = [];
  private powerUps: Array<PowerUpItem & { mesh: THREE.Group }> = [];
  private buildings: Array<VectorBuilding & { mesh: THREE.Group }> = [];
  private projectiles: BallisticProjectile[] = [];
  private projectileMeshes: Map<string, THREE.Line> = new Map();
  private impactRings: ImpactRing[] = [];
  private sparkParticles: VectorSpark[] = [];

  // Projectile trail geometry reuse
  private trailLineMaterialPlayer: THREE.LineBasicMaterial;
  private trailLineMaterialEnemy: THREE.LineBasicMaterial;

  private isRunning = false;
  private isPaused = false;
  private bossEntity: EnemyEntity | null = null;

  constructor(container: HTMLDivElement, callbacks: GameCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(VECTOR_COLORS.horizonFog);
    this.scene.fog = new THREE.FogExp2(VECTOR_COLORS.horizonFog, 0.0042);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      800
    );

    // 2. Renderer
    const isHeadless = navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent);
    this.renderer = new THREE.WebGLRenderer({ antialias: !isHeadless, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(isHeadless ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    // 3. Materials
    this.trailLineMaterialPlayer = new THREE.LineBasicMaterial({
      color: VECTOR_COLORS.tracerPlayer,
      linewidth: 2,
    });
    this.trailLineMaterialEnemy = new THREE.LineBasicMaterial({
      color: VECTOR_COLORS.tracerEnemy,
      linewidth: 2,
    });

    // 4. Terrain & Horizon
    const { terrainGroup } = createVectorTerrain();
    this.scene.add(terrainGroup);

    // 5. First-person Cockpit & Cannon Rig
    this.firstPersonRig = createFirstPersonCannonRig();
    this.scene.add(this.firstPersonRig.group);

    // 6. Bind inputs
    this.bindInputs();
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);

    // 7. Initial Player Positioning
    this.resetPlayerPosition();
  }

  private resetPlayerPosition() {
    this.playerX = 0;
    this.playerZ = 0;
    this.chassisYaw = 0;
    this.turretYaw = 0;
    this.turretPitch = 0.05;
    this.playerY = getTerrainHeight(0, 0) + 1.85; // Tank eye level
    this.playerHp = this.playerMaxHp;
    this.playerGraceTimer = 4.0;
    this.reloadTimer = 0;
    this.powerUpTimers = {};
  }

  public startStage(stageIdx = 0) {
    this.currentStageIndex = stageIdx;
    const stage = STAGE_CONFIGS[this.currentStageIndex] || STAGE_CONFIGS[0];

    // Clear previous entities
    this.clearAllEntities();
    this.resetPlayerPosition();

    // Spawn regular enemy tanks
    for (let i = 0; i < stage.regularTankCount; i++) {
      const angle = (i / stage.regularTankCount) * Math.PI * 2 + 0.3;
      const dist = 60 + Math.random() * 45;
      const ex = Math.cos(angle) * dist;
      const ez = Math.sin(angle) * dist;
      this.spawnEnemy('regular_tank', ex, ez);
    }

    // Spawn surprise fast scout (distinct spawn alert)
    for (let i = 0; i < stage.fastScoutCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 85 + Math.random() * 35;
      const sx = Math.cos(angle) * dist;
      const sz = Math.sin(angle) * dist;
      this.spawnEnemy('fast_scout', sx, sz);
    }

    // Spawn Stage Boss
    const bossAngle = Math.PI * 0.75;
    const bossDist = 110;
    const bx = Math.cos(bossAngle) * bossDist;
    const bz = Math.sin(bossAngle) * bossDist;
    this.spawnEnemy(stage.bossType, bx, bz);

    // Spawn Power-ups on hilltops
    const powerTypes: Array<'DAMAGE_BOOST' | 'TURBO_SPEED' | 'ENERGY_SHIELD' | 'RAPID_FIRE'> = [
      'DAMAGE_BOOST',
      'TURBO_SPEED',
      'ENERGY_SHIELD',
      'RAPID_FIRE',
    ];

    for (let i = 0; i < stage.powerUpCount; i++) {
      const pAngle = (i / stage.powerUpCount) * Math.PI * 2 + 0.8;
      const pDist = 35 + Math.random() * 45;
      const px = Math.cos(pAngle) * pDist;
      const pz = Math.sin(pAngle) * pDist;
      const py = getTerrainHeight(px, pz) + 1.6;
      const type = powerTypes[i % powerTypes.length];
      this.spawnPowerUp(type, px, py, pz);
    }

    // Spawn Stage Obstacle Buildings (Houses, Bunkers, Observation Towers)
    const stageBuildings = generateStageBuildings(stage.stageNumber);
    for (const b of stageBuildings) {
      let mesh: THREE.Group;
      if (b.type === 'house') {
        mesh = createVectorHouseModel(b.width, b.height, b.depth, b.destructible);
      } else if (b.type === 'bunker') {
        mesh = createVectorBunkerModel(b.width, b.height, b.depth);
      } else {
        mesh = createVectorTowerModel(b.width, b.height, b.depth);
      }
      mesh.position.set(b.x, b.y, b.z);
      mesh.rotation.y = b.rotation;
      this.scene.add(mesh);
      this.buildings.push({ ...b, mesh });
    }

    this.isRunning = true;
    this.isPaused = false;
    sound.startEngine();

    // Notify React of initial state
    this.notifyHud();
  }

  private clearAllEntities() {
    // Remove buildings
    this.buildings.forEach((b) => {
      this.scene.remove(b.mesh);
    });
    this.buildings = [];

    // Remove enemy models
    this.enemies.forEach((e) => {
      this.scene.remove(e.model.group);
    });
    this.enemies = [];
    this.bossEntity = null;

    // Remove powerup models
    this.powerUps.forEach((p) => {
      this.scene.remove(p.mesh);
    });
    this.powerUps = [];

    // Remove projectiles
    this.projectiles = [];
    this.projectileMeshes.forEach((mesh) => {
      this.scene.remove(mesh);
    });
    this.projectileMeshes.clear();

    // Remove impact rings
    this.impactRings.forEach((r) => this.scene.remove(r.mesh));
    this.impactRings = [];

    // Remove spark lines
    this.sparkParticles.forEach((s) => this.scene.remove(s.line));
    this.sparkParticles = [];
  }

  private spawnEnemy(type: EnemyType, x: number, z: number) {
    const config = ENEMY_ARCHETYPES[type];
    const y = getTerrainHeight(x, z);

    let modelObj: EnemyEntity['model'];

    if (type === 'regular_tank') {
      const res = createVectorTankModel();
      modelObj = {
        group: res.group,
        turretGroup: res.turretGroup,
        barrelMesh: res.barrelMesh,
      };
    } else if (type === 'fast_scout') {
      const res = createFastScoutModel();
      modelObj = {
        group: res.group,
        ringGroup: res.ringGroup,
      };
      sound.playScoutAlert();
    } else if (type === 'boss_goliath') {
      const res = createGoliathBossModel();
      modelObj = {
        group: res.group,
        turretGroup: res.turretGroup,
        barrelMesh: res.barrels,
      };
      sound.playBossTelegraph();
    } else if (type === 'boss_hydra') {
      const res = createHydraBossModel();
      modelObj = {
        group: res.group,
        turretGroup: res.turretGroup,
        mortarPipes: res.mortarPipes,
      };
      sound.playBossTelegraph();
    } else {
      // Titan Boss
      const res = createTitanBossModel();
      modelObj = {
        group: res.group,
        ringGroup: res.coreGroup,
        shardsGroup: res.shardsGroup,
      };
      sound.playBossTelegraph();
    }

    // Floating 3D vector health bar over enemy
    const hb = createEnemy3DHealthBar(config.isBoss ? 5.2 : 3.0);
    hb.group.position.set(0, config.isBoss ? 4.6 : (type === 'fast_scout' ? 2.5 : 3.0), 0);
    modelObj.group.add(hb.group);

    modelObj.group.position.set(x, y, z);
    this.scene.add(modelObj.group);

    const enemy: EnemyEntity = {
      id: `enemy-${Date.now()}-${Math.random()}`,
      type,
      x,
      y,
      z,
      yaw: Math.atan2(this.playerX - x, this.playerZ - z),
      turretYaw: 0,
      hp: config.maxHp,
      maxHp: config.maxHp,
      speed: config.speed,
      alive: true,
      shootCooldownTimer: 4.5 + Math.random() * 4.0,
      healthBar: hb,
      model: modelObj,
      strafeDir: Math.random() > 0.5 ? 1 : -1,
      behaviorTimer: 0,
    };

    if (config.isBoss) {
      this.bossEntity = enemy;
    }

    this.enemies.push(enemy);
  }

  private spawnPowerUp(type: 'DAMAGE_BOOST' | 'TURBO_SPEED' | 'ENERGY_SHIELD' | 'RAPID_FIRE', x: number, y: number, z: number) {
    const mesh = createPowerUpModel(type);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);

    this.powerUps.push({
      id: `pu-${Date.now()}-${Math.random()}`,
      type,
      x,
      y,
      z,
      radius: 2.2,
      duration: 14.0,
      collected: false,
      mesh,
    });
  }

  public firePlayerCannon() {
    if (!this.isRunning || this.isPaused || this.reloadTimer > 0) return;

    const hasRapid = (this.powerUpTimers['RAPID_FIRE']?.remaining || 0) > 0;
    const hasDamage = (this.powerUpTimers['DAMAGE_BOOST']?.remaining || 0) > 0;

    // Reset reload cooldown
    this.reloadTimer = calculateReloadCooldown(this.baseReloadCooldown, hasRapid);

    // Barrel recoil kick
    this.barrelRecoil = 0.38;
    this.cameraShake = Math.max(this.cameraShake, 0.25);

    // Muzzle position in world coordinates (from camera orientation)
    const muzzleVel = calculateMuzzleVelocity(this.turretYaw, this.turretPitch, CANNON_MUZZLE_VELOCITY);

    // Spawn projectile just ahead of gun muzzle
    const startX = this.playerX - Math.sin(this.turretYaw) * Math.cos(this.turretPitch) * 2.8;
    const startY = this.playerY - 0.28 + Math.sin(this.turretPitch) * 2.8;
    const startZ = this.playerZ - Math.cos(this.turretYaw) * Math.cos(this.turretPitch) * 2.8;

    const damage = calculatePlayerDamage(45, hasDamage);

    const proj: BallisticProjectile = {
      id: `proj-${Date.now()}-${Math.random()}`,
      source: 'player',
      x: startX,
      y: startY,
      z: startZ,
      vx: muzzleVel.vx,
      vy: muzzleVel.vy,
      vz: muzzleVel.vz,
      gravity: GRAVITY_DEFAULT,
      damage,
      radius: 1.2,
      age: 0,
      maxAge: 4.5,
      color: hasDamage ? '#ff4444' : '#00ff66',
      alive: true,
      trail: [{ x: startX, y: startY, z: startZ }],
    };

    this.projectiles.push(proj);
    sound.playPlayerFire(hasDamage);
  }

  private enemyFire(enemy: EnemyEntity) {
    const config = ENEMY_ARCHETYPES[enemy.type];
    const dx = this.playerX - enemy.x;
    const dy = this.playerY - enemy.y;
    const dz = this.playerZ - enemy.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 180) return;

    // Ballistic angle estimation: compensate for gravity drop
    const timeToHit = dist / (CANNON_MUZZLE_VELOCITY * 0.75);
    const elevatedVy = (dy + 0.5 * GRAVITY_DEFAULT * timeToHit * timeToHit) / timeToHit;

    const angle = Math.atan2(dx, dz);
    const speedH = dist / timeToHit;

    const vx = Math.sin(angle) * speedH;
    const vz = Math.cos(angle) * speedH;
    const vy = elevatedVy;

    const proj: BallisticProjectile = {
      id: `proj-e-${Date.now()}-${Math.random()}`,
      source: enemy.type.startsWith('boss') ? 'boss' : 'enemy',
      x: enemy.x,
      y: enemy.y + 1.8,
      z: enemy.z,
      vx,
      vy,
      vz,
      gravity: GRAVITY_DEFAULT,
      damage: config.damage,
      radius: 1.2,
      age: 0,
      maxAge: 5.0,
      color: '#ff3344',
      alive: true,
      trail: [{ x: enemy.x, y: enemy.y + 1.8, z: enemy.z }],
    };

    this.projectiles.push(proj);
    sound.playEnemyFire(config.isBoss);

    // If Hydra Boss: launch additional high cluster mortars!
    if (enemy.type === 'boss_hydra') {
      for (let i = 0; i < 2; i++) {
        const spreadX = (Math.random() - 0.5) * 14;
        const spreadZ = (Math.random() - 0.5) * 14;
        const mProj: BallisticProjectile = {
          id: `proj-hydra-${Date.now()}-${i}`,
          source: 'boss',
          x: enemy.x,
          y: enemy.y + 2.5,
          z: enemy.z,
          vx: vx + (spreadX / timeToHit),
          vy: vy + 8 + Math.random() * 5, // High mortar arc
          vz: vz + (spreadZ / timeToHit),
          gravity: GRAVITY_DEFAULT * 1.1,
          damage: config.damage * 0.7,
          radius: 1.5,
          age: 0,
          maxAge: 6.0,
          color: '#ffaa00',
          alive: true,
          trail: [{ x: enemy.x, y: enemy.y + 2.5, z: enemy.z }],
        };
        this.projectiles.push(mProj);
      }
    }
  }

  private spawnImpactEffect(x: number, y: number, z: number, color = VECTOR_COLORS.playerGreen, heavy = false) {
    // 1. Expanding Vector Shockwave Ring (helps player see exactly where bullet hits!)
    const ringGeo = new THREE.BufferGeometry();
    const ringPts: number[] = [];
    const segs = 20;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      ringPts.push(Math.cos(a), 0.05, Math.sin(a));
    }
    ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(ringPts, 3));
    const ringLine = new THREE.Line(
      ringGeo,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    ringLine.position.set(x, y, z);
    this.scene.add(ringLine);

    this.impactRings.push({
      mesh: ringLine,
      x,
      y,
      z,
      radius: 0.5,
      maxRadius: heavy ? 9.0 : 4.5,
      opacity: 1.0,
    });

    // 2. Flying Vector Spark Shards
    const sparkCount = heavy ? 16 : 8;
    for (let i = 0; i < sparkCount; i++) {
      const sparkGeo = new THREE.BufferGeometry();
      sparkGeo.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([0, 0, 0, 0, 0.4, 0], 3)
      );
      const sparkLine = new THREE.Line(
        sparkGeo,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 })
      );
      sparkLine.position.set(x, y + 0.1, z);
      this.scene.add(sparkLine);

      const angle = Math.random() * Math.PI * 2;
      const speed = (heavy ? 12 : 7) * (0.5 + Math.random() * 0.5);
      this.sparkParticles.push({
        line: sparkLine,
        x,
        y: y + 0.1,
        z,
        vx: Math.cos(angle) * speed,
        vy: 4 + Math.random() * (heavy ? 10 : 6),
        vz: Math.sin(angle) * speed,
        age: 0,
        maxAge: 0.4 + Math.random() * 0.35,
      });
    }
  }

  public update(dt: number) {
    if (!this.isRunning || this.isPaused) return;

    // Clamp dt for stable simulation
    const clampedDt = Math.min(dt, 0.05);

    // Update active power-up timers
    const activeKeys = Object.keys(this.powerUpTimers);
    for (const key of activeKeys) {
      this.powerUpTimers[key].remaining -= clampedDt;
      if (this.powerUpTimers[key].remaining <= 0) {
        delete this.powerUpTimers[key];
      }
    }

    // Decrement reload cooldown
    if (this.reloadTimer > 0) {
      this.reloadTimer = Math.max(0, this.reloadTimer - clampedDt);
    }

    // Decrement player start grace timer
    if (this.playerGraceTimer > 0) {
      this.playerGraceTimer = Math.max(0, this.playerGraceTimer - clampedDt);
    }

    // 1. Player Chassis Kinematics (WASD)
    this.updatePlayerMovement(clampedDt);

    // 2. Update First-Person Camera & Cockpit Rig
    this.updateCameraAndRig(clampedDt);

    // 3. Update Ballistic Projectiles
    this.updateProjectiles(clampedDt);

    // 4. Update Enemies
    this.updateEnemies(clampedDt);

    // 5. Update Power-ups
    this.updatePowerUps(clampedDt);

    // 6. Update Visual Particles and Rings
    this.updateEffects(clampedDt);

    // 7. Check Stage Objectives / Win Condition
    this.checkStageProgress();

    // 8. Render scene
    this.renderer.render(this.scene, this.camera);
  }

  private updatePlayerMovement(dt: number) {
    const hasTurbo = (this.powerUpTimers['TURBO_SPEED']?.remaining || 0) > 0;
    const baseSpeed = 16.0;
    const speed = calculatePlayerSpeed(baseSpeed, hasTurbo);
    const turnSpeed = hasTurbo ? 2.4 : 1.8;

    let throttle = 0; // +1 forward, -1 reverse
    let turn = 0;     // +1 left, -1 right

    if (this.keysPressed.has('KeyW') || this.keysPressed.has('ArrowUp')) throttle += 1;
    if (this.keysPressed.has('KeyS') || this.keysPressed.has('ArrowDown')) throttle -= 1;
    if (this.keysPressed.has('KeyA') || this.keysPressed.has('ArrowLeft')) turn += 1;
    if (this.keysPressed.has('KeyD') || this.keysPressed.has('ArrowRight')) turn -= 1;

    if (this.controlMode === 'solidary') {
      // 1. SOLIDARY MODE (Classic Battlezone direct drive - RECOMMENDED):
      // Chassis and view/aim are 100% solidary.
      // A / D steer view and chassis together.
      if (turn !== 0) {
        this.turretYaw += turn * turnSpeed * dt;
      }
      this.chassisYaw = this.turretYaw;

      // W ALWAYS drives forward towards the crosshair in the center of the screen!
      // S ALWAYS reverses in reverse.
      if (throttle !== 0) {
        const forwardX = -Math.sin(this.turretYaw);
        const forwardZ = -Math.cos(this.turretYaw);

        this.playerX += forwardX * throttle * speed * dt;
        this.playerZ += forwardZ * throttle * speed * dt;
      }
    } else if (this.controlMode === 'conic') {
      // 2. CONIC GIMBALS MODE (User suggestion: chassis turns with A/D, turret has conic range ±35°):
      if (turn !== 0) {
        this.chassisYaw += turn * turnSpeed * dt;
        this.turretYaw += turn * turnSpeed * dt;
      }

      // Constrain turret angle within a ±35° cone relative to chassisYaw
      let diff = this.turretYaw - this.chassisYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const maxCone = (35 * Math.PI) / 180;
      if (diff > maxCone) {
        // Drag chassis along when mouse exceeds cone
        this.chassisYaw = this.turretYaw - maxCone;
      } else if (diff < -maxCone) {
        this.chassisYaw = this.turretYaw + maxCone;
      }

      // W moves along chassis heading
      if (throttle !== 0) {
        const forwardX = -Math.sin(this.chassisYaw);
        const forwardZ = -Math.cos(this.chassisYaw);

        this.playerX += forwardX * throttle * speed * dt;
        this.playerZ += forwardZ * throttle * speed * dt;
      }
    } else {
      // 3. FREE 360° TURRET MODE:
      if (turn !== 0) {
        this.chassisYaw += turn * turnSpeed * dt;
      }
      if (throttle !== 0) {
        const forwardX = -Math.sin(this.chassisYaw);
        const forwardZ = -Math.cos(this.chassisYaw);

        this.playerX += forwardX * throttle * speed * dt;
        this.playerZ += forwardZ * throttle * speed * dt;
      }
    }

    if (throttle !== 0) {
      // Keep inside boundary
      const maxDist = 260;
      const currentDist = Math.sqrt(this.playerX * this.playerX + this.playerZ * this.playerZ);
      if (currentDist > maxDist) {
        this.playerX = (this.playerX / currentDist) * maxDist;
        this.playerZ = (this.playerZ / currentDist) * maxDist;
      }
    }

    // Check collision with obstacle buildings (houses, bunkers, towers)
    for (const b of this.buildings) {
      if (!b.alive) continue;
      const col = checkCircleBoxCollision(
        this.playerX,
        this.playerZ,
        2.4, // Tank chassis collision radius
        b.x,
        b.z,
        b.width,
        b.depth,
        b.rotation
      );
      if (col.collided) {
        this.playerX += col.normalX * col.overlap;
        this.playerZ += col.normalZ * col.overlap;
      }
    }

    // Ground height & eye level
    const terrainY = getTerrainHeight(this.playerX, this.playerZ);
    this.playerY = terrainY + 1.85;

    // Engine audio pitch sync
    sound.updateEnginePitch(throttle);
  }

  private updateCameraAndRig(dt: number) {
    // Camera shake decay
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 1.8);
    }
    const shakeX = (Math.random() - 0.5) * this.cameraShake * 0.15;
    const shakeY = (Math.random() - 0.5) * this.cameraShake * 0.15;

    // Terrain normal alignment for chassis pitch/roll
    const normal = getTerrainNormal(this.playerX, this.playerZ);

    // Position camera at cockpit eye-point
    this.camera.position.set(this.playerX + shakeX, this.playerY + shakeY, this.playerZ);

    // Compute camera rotation from Turret Yaw and Pitch
    // Turret rotates 360° independently from chassis!
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.turretYaw;
    this.camera.rotation.x = this.turretPitch;
    this.camera.rotation.z = -normal[0] * 0.15; // Subtle tilt from slope

    // First person cannon rig tracks camera position and orientation
    this.firstPersonRig.group.position.copy(this.camera.position);
    this.firstPersonRig.group.quaternion.copy(this.camera.quaternion);

    // Barrel recoil recovery
    if (this.barrelRecoil > 0) {
      this.barrelRecoil = Math.max(0, this.barrelRecoil - dt * 2.2);
    }
    // Shift barrel along its local Z axis on recoil
    this.firstPersonRig.barrelGroup.position.z = this.barrelRecoil;
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const result = stepProjectile(proj, dt);

      // Check collision with enemies (if source is player)
      if (proj.alive && proj.source === 'player') {
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          const hit = checkSphereCollision(
            proj.x,
            proj.y,
            proj.z,
            proj.radius,
            enemy.x,
            enemy.y + 1.2,
            enemy.z,
            ENEMY_ARCHETYPES[enemy.type].size * 0.5
          );

          if (hit) {
            proj.alive = false;
            enemy.hp -= proj.damage;
            sound.playExplosion(enemy.hp <= 0);
            this.spawnImpactEffect(proj.x, proj.y, proj.z, VECTOR_COLORS.playerGreen, true);
            this.callbacks.onHitConfirmed();

            if (enemy.hp <= 0) {
              enemy.alive = false;
              this.scene.remove(enemy.model.group);
              const scoreVal = ENEMY_ARCHETYPES[enemy.type].scoreValue;
              this.score += scoreVal;
              this.callbacks.onScoreUpdate(this.score);
            }
            break;
          }
        }
      }

      // Check collision with player (if source is enemy or boss)
      if (proj.alive && (proj.source === 'enemy' || proj.source === 'boss')) {
        const hitPlayer = checkSphereCollision(
          proj.x,
          proj.y,
          proj.z,
          proj.radius,
          this.playerX,
          this.playerY - 0.5,
          this.playerZ,
          2.2
        );

        if (hitPlayer) {
          proj.alive = false;
          if (this.playerGraceTimer > 0) {
            // Deflected by calibration forcefield
            this.spawnImpactEffect(proj.x, proj.y, proj.z, VECTOR_COLORS.powerupShield, false);
            continue;
          }
          const hasShield = (this.powerUpTimers['ENERGY_SHIELD']?.remaining || 0) > 0;
          const dmg = hasShield ? proj.damage * 0.25 : proj.damage;
          this.playerHp = Math.max(0, this.playerHp - dmg);
          this.cameraShake = 0.55;
          sound.playExplosion(true);
          this.spawnImpactEffect(proj.x, proj.y, proj.z, VECTOR_COLORS.tracerEnemy, true);

          if (this.playerHp <= 0) {
            this.handlePlayerDefeat();
            return;
          }
        }
      }

      // Check collision with obstacle buildings (houses, bunkers, towers)
      if (proj.alive) {
        for (const b of this.buildings) {
          if (!b.alive) continue;
          const hitBuilding = checkPointInsideBuilding(proj.x, proj.y, proj.z, b, 0.4);
          if (hitBuilding) {
            proj.alive = false;
            sound.playTerrainHit();
            this.spawnImpactEffect(proj.x, proj.y, proj.z, VECTOR_COLORS.terrainWire, false);

            if (b.destructible) {
              b.hp -= proj.damage;
              if (b.hp <= 0) {
                b.alive = false;
                this.scene.remove(b.mesh);
                sound.playExplosion(true);
                this.spawnImpactEffect(b.x, b.y + b.height * 0.5, b.z, 0x00ff88, true);

                if (proj.source === 'player') {
                  this.score += 200;
                  this.callbacks.onScoreUpdate(this.score);
                }
              }
            }
            break;
          }
        }
      }

      // Handle ground impact
      if (result.hit && result.impact) {
        sound.playTerrainHit();
        this.spawnImpactEffect(result.impact.x, result.impact.y, result.impact.z, proj.source === 'player' ? VECTOR_COLORS.playerGreen : VECTOR_COLORS.enemyOrange, false);
      }

      // Update visible 3D line tracer mesh
      let lineMesh = this.projectileMeshes.get(proj.id);
      if (!lineMesh) {
        const lineGeo = new THREE.BufferGeometry();
        const pts = new Float32Array(30); // 10 points * 3
        lineGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
        lineMesh = new THREE.Line(
          lineGeo,
          proj.source === 'player' ? this.trailLineMaterialPlayer : this.trailLineMaterialEnemy
        );
        this.scene.add(lineMesh);
        this.projectileMeshes.set(proj.id, lineMesh);
      }

      if (proj.alive && proj.trail.length > 1) {
        const posAttr = lineMesh.geometry.attributes.position;
        const count = Math.min(proj.trail.length, 10);
        for (let t = 0; t < count; t++) {
          const pt = proj.trail[t];
          posAttr.setXYZ(t, pt.x, pt.y, pt.z);
        }
        lineMesh.geometry.setDrawRange(0, count);
        posAttr.needsUpdate = true;
      }

      // Clean up dead projectiles
      if (!proj.alive) {
        if (lineMesh) {
          this.scene.remove(lineMesh);
          this.projectileMeshes.delete(proj.id);
        }
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateEnemies(dt: number) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      const dx = this.playerX - enemy.x;
      const dz = this.playerZ - enemy.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const angleToPlayer = Math.atan2(dx, dz);

      // Line of sight check through hilly terrain and obstacle buildings
      const canSeePlayer =
        hasLineOfSight(
          enemy.x,
          enemy.y + 1.5,
          enemy.z,
          this.playerX,
          this.playerY,
          this.playerZ,
          15
        ) &&
        !isLineBlockedByBuildings(
          enemy.x,
          enemy.y + 1.5,
          enemy.z,
          this.playerX,
          this.playerY,
          this.playerZ,
          this.buildings,
          12
        );

      // Archetype specific movement & behaviors:
      if (enemy.type === 'regular_tank') {
        // Patrol & engage: Close in if > 45m, flank if closer
        const desiredDist = 50;
        enemy.yaw = THREE.MathUtils.damp(enemy.yaw, angleToPlayer, 2.5, dt);

        if (dist > desiredDist) {
          // Advance forward
          enemy.x += Math.sin(enemy.yaw) * enemy.speed * dt;
          enemy.z += Math.cos(enemy.yaw) * enemy.speed * dt;
        } else if (dist < 28) {
          // Back up slightly
          enemy.x -= Math.sin(enemy.yaw) * (enemy.speed * 0.6) * dt;
          enemy.z -= Math.cos(enemy.yaw) * (enemy.speed * 0.6) * dt;
        }

        // Aim turret at player
        enemy.turretYaw = THREE.MathUtils.damp(enemy.turretYaw, angleToPlayer, 3.5, dt);
        if (enemy.model.turretGroup) {
          enemy.model.turretGroup.rotation.y = enemy.turretYaw - enemy.yaw;
        }

      } else if (enemy.type === 'fast_scout') {
        // Agile surprise enemy: High-speed orbital strafing runs!
        enemy.behaviorTimer = (enemy.behaviorTimer || 0) + dt;
        if (enemy.behaviorTimer > 3.0) {
          enemy.strafeDir = Math.random() > 0.5 ? 1 : -1;
          enemy.behaviorTimer = 0;
        }

        // Tangential orbital velocity + swoop
        const strafeAngle = angleToPlayer + (Math.PI / 2) * (enemy.strafeDir || 1);
        enemy.yaw = THREE.MathUtils.damp(enemy.yaw, strafeAngle, 4.0, dt);
        enemy.x += Math.sin(strafeAngle) * enemy.speed * dt;
        enemy.z += Math.cos(strafeAngle) * enemy.speed * dt;

        // Spin saucer ring
        if (enemy.model.ringGroup) {
          enemy.model.ringGroup.rotation.y += dt * 8.0;
        }

      } else if (enemy.type.startsWith('boss')) {
        // Boss AI: Steady advance with imposing presence
        enemy.yaw = THREE.MathUtils.damp(enemy.yaw, angleToPlayer, 1.2, dt);
        if (dist > 35) {
          enemy.x += Math.sin(enemy.yaw) * enemy.speed * dt;
          enemy.z += Math.cos(enemy.yaw) * enemy.speed * dt;
        }

        // Turret aim
        enemy.turretYaw = THREE.MathUtils.damp(enemy.turretYaw, angleToPlayer, 2.0, dt);
        if (enemy.model.turretGroup) {
          enemy.model.turretGroup.rotation.y = enemy.turretYaw - enemy.yaw;
        }

        // Titan shield rotation
        if (enemy.model.shardsGroup) {
          enemy.model.shardsGroup.rotation.y += dt * 1.5;
        }
      }

      // Check collision against obstacle buildings (houses, bunkers)
      for (const b of this.buildings) {
        if (!b.alive) continue;
        const col = checkCircleBoxCollision(
          enemy.x,
          enemy.z,
          2.6,
          b.x,
          b.z,
          b.width,
          b.depth,
          b.rotation
        );
        if (col.collided) {
          enemy.x += col.normalX * col.overlap;
          enemy.z += col.normalZ * col.overlap;
        }
      }

      // Height on terrain
      enemy.y = getTerrainHeight(enemy.x, enemy.z);
      enemy.model.group.position.set(enemy.x, enemy.y, enemy.z);
      enemy.model.group.rotation.y = enemy.yaw;

      // Update 3D floating health bar facing camera
      if (enemy.healthBar) {
        updateEnemy3DHealthBar(enemy.healthBar, enemy.hp, enemy.maxHp, this.camera.position);
      }

      // Shooting logic
      enemy.shootCooldownTimer -= dt;
      if (enemy.shootCooldownTimer <= 0 && canSeePlayer && dist < 170) {
        this.enemyFire(enemy);
        enemy.shootCooldownTimer = ENEMY_ARCHETYPES[enemy.type].shootCooldown * (0.8 + Math.random() * 0.4);
      }
    }
  }

  private updatePowerUps(dt: number) {
    for (const pu of this.powerUps) {
      if (pu.collected) continue;

      // Spin and bob animation
      pu.mesh.rotation.y += dt * 2.0;
      pu.mesh.rotation.x += dt * 1.0;
      pu.mesh.position.y = pu.y + Math.sin(Date.now() * 0.003) * 0.35;

      // Check player collection
      const collected = checkSphereCollision(
        this.playerX,
        this.playerY,
        this.playerZ,
        2.0,
        pu.x,
        pu.y,
        pu.z,
        pu.radius
      );

      if (collected) {
        pu.collected = true;
        this.scene.remove(pu.mesh);
        sound.playPowerUp();

        if (pu.type === 'ENERGY_SHIELD') {
          this.playerHp = Math.min(this.playerMaxHp, this.playerHp + 50);
        }

        this.powerUpTimers[pu.type] = {
          remaining: pu.duration,
          total: pu.duration,
        };

        this.score += 350;
        this.callbacks.onScoreUpdate(this.score);
      }
    }
  }

  private updateEffects(dt: number) {
    // 1. Impact Shockwave Rings
    for (let i = this.impactRings.length - 1; i >= 0; i--) {
      const ring = this.impactRings[i];
      ring.radius += dt * 12;
      ring.opacity = Math.max(0, 1 - ring.radius / ring.maxRadius);

      ring.mesh.scale.set(ring.radius, 1, ring.radius);
      (ring.mesh.material as THREE.LineBasicMaterial).opacity = ring.opacity;

      if (ring.radius >= ring.maxRadius) {
        this.scene.remove(ring.mesh);
        this.impactRings.splice(i, 1);
      }
    }

    // 2. Flying Vector Sparks
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const s = this.sparkParticles[i];
      s.age += dt;
      if (s.age >= s.maxAge) {
        this.scene.remove(s.line);
        this.sparkParticles.splice(i, 1);
        continue;
      }

      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.vy -= GRAVITY_DEFAULT * 0.7 * dt;

      s.line.position.set(s.x, s.y, s.z);
      const opacity = 1 - s.age / s.maxAge;
      (s.line.material as THREE.LineBasicMaterial).opacity = opacity;
    }
  }

  private checkStageProgress() {
    // If all enemies (including boss) are eliminated: STAGE CLEAR!
    const activeEnemies = this.enemies.filter((e) => e.alive);
    if (activeEnemies.length === 0 && this.isRunning) {
      this.isRunning = false;
      sound.playVictory();
      const isLastStage = this.currentStageIndex >= STAGE_CONFIGS.length - 1;
      this.callbacks.onVictory(this.currentStageIndex + 1, isLastStage);
    }
  }

  private handlePlayerDefeat() {
    this.isRunning = false;
    sound.stopAll();
    if (document.exitPointerLock) {
      try {
        document.exitPointerLock();
      } catch {}
    }
    sound.playDefeat();
    this.callbacks.onGameOver();
  }

  public notifyHud() {
    // Throttled HUD update for React
    this.callbacks.onHpUpdate(this.playerHp, this.playerMaxHp);

    const hasRapid = (this.powerUpTimers['RAPID_FIRE']?.remaining || 0) > 0;
    const maxCd = calculateReloadCooldown(this.baseReloadCooldown, hasRapid);
    const reloadProgress = 1 - Math.min(1, this.reloadTimer / maxCd);
    this.callbacks.onReloadUpdate(reloadProgress);

    this.callbacks.onStateUpdate(
      this.playerX,
      this.playerZ,
      this.chassisYaw,
      this.turretYaw,
      this.turretPitch
    );

    // Radar entities
    const radarData: Array<{ x: number; z: number; type: 'enemy' | 'scout' | 'boss' | 'powerup' | 'building'; alive: boolean }> = this.enemies
      .filter((e) => e.alive)
      .map((e) => ({
        x: e.x,
        z: e.z,
        type: (e.type === 'fast_scout' ? 'scout' : e.type.startsWith('boss') ? 'boss' : 'enemy') as 'enemy' | 'scout' | 'boss',
        alive: e.alive,
      }));

    this.powerUps
      .filter((p) => !p.collected)
      .forEach((p) => {
        radarData.push({ x: p.x, z: p.z, type: 'powerup', alive: true });
      });

    this.buildings
      .filter((b) => b.alive)
      .forEach((b) => {
        radarData.push({ x: b.x, z: b.z, type: 'building', alive: true });
      });

    this.callbacks.onRadarUpdate(radarData);

    // Active power-ups list
    const activeList = Object.entries(this.powerUpTimers).map(([type, data]) => ({
      type,
      remainingTime: data.remaining,
      totalDuration: data.total,
    }));
    this.callbacks.onActivePowerUpsUpdate(activeList);

    // Boss status
    if (this.bossEntity && this.bossEntity.alive) {
      const config = ENEMY_ARCHETYPES[this.bossEntity.type];
      this.callbacks.onBossUpdate(true, config.name, this.bossEntity.hp, config.maxHp);
    } else {
      this.callbacks.onBossUpdate(false);
    }

    // Compute targeted enemy closest to reticle in screen space
    let bestTarget: TargetedEnemyInfo | null = null;
    let minCenterDist = 0.65; // Aiming cone
    const tempVec = new THREE.Vector3();

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const dx = enemy.x - this.playerX;
      const dz = enemy.z - this.playerZ;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 190) continue;

      // Project 3D enemy position to normalized device coordinates
      tempVec.set(enemy.x, enemy.y + 1.2, enemy.z);
      tempVec.project(this.camera);

      // Check if in front of camera
      if (tempVec.z > -1 && tempVec.z < 1) {
        const screenX = (tempVec.x * 0.5 + 0.5) * 100;
        const screenY = (-tempVec.y * 0.5 + 0.5) * 100;
        const distFromCenter = Math.hypot(tempVec.x, tempVec.y);

        if (distFromCenter < minCenterDist) {
          minCenterDist = distFromCenter;
          const config = ENEMY_ARCHETYPES[enemy.type];
          bestTarget = {
            id: enemy.id,
            name: config.name,
            type: enemy.type,
            distance: dist,
            hp: Math.max(0, enemy.hp),
            maxHp: config.maxHp,
            screenX,
            screenY,
            inView: screenX >= 3 && screenX <= 97 && screenY >= 3 && screenY <= 97,
            isBoss: config.isBoss,
          };
        }
      }
    }

    this.callbacks.onTargetedEnemyUpdate(bestTarget);
  }

  private bindInputs() {
    window.addEventListener('keydown', (e) => {
      this.keysPressed.add(e.code);

      if (e.code === 'Space') {
        e.preventDefault();
        this.firePlayerCannon();
      } else if (e.code === 'KeyM') {
        sound.toggleMute();
        this.callbacks.onScoreUpdate(this.score);
      } else if (e.code === 'KeyC') {
        this.toggleControlMode();
      } else if (e.code === 'KeyX') {
        this.recenterTurret();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysPressed.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keysPressed.clear();
      sound.playTurretWhine(false);
    });

    // Mouse aiming with pointer lock
    this.container.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        if (!this.isPointerLocked) {
          this.requestPointerLock();
        } else {
          this.firePlayerCannon();
        }
      } else if (e.button === 1 || e.button === 2) {
        // Middle click or Right click re-centers turret to chassis
        e.preventDefault();
        this.recenterTurret();
      }
    });

    this.container.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.container;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked || !this.isRunning || this.isPaused) return;

      const sensitivity = 0.0022;
      const dx = e.movementX;
      const dy = e.movementY;

      if (this.controlMode === 'solidary') {
        // Direct steering: mouse horizontal movement rotates the tank directly!
        this.turretYaw -= dx * sensitivity;
        this.chassisYaw = this.turretYaw;
      } else if (this.controlMode === 'conic') {
        this.turretYaw -= dx * sensitivity;
        let diff = this.turretYaw - this.chassisYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxCone = (35 * Math.PI) / 180;
        if (diff > maxCone) {
          this.chassisYaw = this.turretYaw - maxCone;
        } else if (diff < -maxCone) {
          this.chassisYaw = this.turretYaw + maxCone;
        }
      } else {
        // Free 360 turret
        this.turretYaw -= dx * sensitivity;
      }

      // Gun elevation (pitch) is clamped from -10° to +36°
      this.turretPitch = Math.max(-0.16, Math.min(0.62, this.turretPitch - dy * sensitivity));

      sound.playTurretWhine(Math.abs(dx) > 1.0);
    });
  }

  public setControlMode(mode: 'solidary' | 'conic' | 'free') {
    this.controlMode = mode;
    if (mode === 'solidary') {
      this.chassisYaw = this.turretYaw;
    }
    this.callbacks.onControlModeUpdate?.(mode);
  }

  public toggleControlMode(): 'solidary' | 'conic' | 'free' {
    const nextMode =
      this.controlMode === 'solidary' ? 'conic' : this.controlMode === 'conic' ? 'free' : 'solidary';
    this.setControlMode(nextMode);
    return nextMode;
  }

  public recenterTurret() {
    this.turretYaw = this.chassisYaw;
  }

  public requestPointerLock() {
    try {
      this.container.requestPointerLock();
    } catch {
      // Fallback
    }
  }

  public pause() {
    this.isPaused = true;
    sound.stopEngine();
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  public resume() {
    this.isPaused = false;
    sound.startEngine();
    this.requestPointerLock();
  }

  private handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public startLoop() {
    let hudTimer = 0;
    const isHeadless = typeof navigator !== 'undefined' && (navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent));
    const targetInterval = isHeadless ? 1000 / 20 : 0;
    let lastTime = performance.now();

    const loop = (time: number) => {
      this.animFrameId = requestAnimationFrame(loop);
      if (isHeadless && time - lastTime < targetInterval) {
        return;
      }
      lastTime = time;
      const dt = this.clock.getDelta();

      this.update(dt);

      // Throttled HUD update (every 0.08s ~ 12Hz) to keep 60fps WebGL silky smooth
      hudTimer += dt;
      if (hudTimer >= 0.08) {
        hudTimer = 0;
        this.notifyHud();
      }
    };

    loop(performance.now());
  }

  public destroy() {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.handleResize);
    sound.stopAll();
    this.clearAllEntities();
    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
