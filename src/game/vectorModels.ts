/**
 * Procedural 3D Vector Arcade models built with Three.js.
 * Battlezone-inspired wireframe geometry with 3-12 parts per entity.
 */

import * as THREE from 'three';

// Vector Neon Palette
export const VECTOR_COLORS = {
  playerGreen: 0x00ff66,
  playerGun: 0x33ff88,
  cockpitBezel: 0x00cc44,
  enemyOrange: 0xff3344,
  enemyTurret: 0xff5566,
  scoutCyan: 0x00f5ff,
  bossGold: 0xffaa00,
  bossCrimson: 0xff0055,
  terrainWire: 0x006622,
  horizonFog: 0x020804,
  powerupDamage: 0xff3333,
  powerupSpeed: 0x00ffff,
  powerupShield: 0x3388ff,
  powerupRapid: 0xffff00,
  tracerPlayer: 0x55ffaa,
  tracerEnemy: 0xff4433,
};

/**
 * Creates a wireframe LineSegments object from any Three.js geometry.
 */
export function createWireframeObject(
  geometry: THREE.BufferGeometry,
  color: number,
  linewidth = 1
): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(geometry, 24);
  const material = new THREE.LineBasicMaterial({
    color,
    linewidth,
    transparent: true,
    opacity: 0.9,
    depthTest: true,
  });
  return new THREE.LineSegments(edges, material);
}

/**
 * Builds the Player's visible 3D First-Person Cannon Rig & Cockpit struts.
 * Mounted directly to the camera/turret coordinate frame so it pitches and swivels with aim!
 */
export function createFirstPersonCannonRig(): {
  group: THREE.Group;
  barrelGroup: THREE.Group;
  cockpitFrame: THREE.Group;
} {
  const group = new THREE.Group();

  // Subtle Battlezone periscope corner brackets (minimal, zero occlusion)
  const cockpitFrame = new THREE.Group();
  const bezelColor = VECTOR_COLORS.cockpitBezel;

  // Minimal corner tick marks at the outer edges of the periscope visor
  const tickGeo = new THREE.BufferGeometry();
  const tickVerts = new Float32Array([
    // Top-left bracket
    -1.45, 0.85, -1.0, -1.25, 0.85, -1.0,
    -1.45, 0.85, -1.0, -1.45, 0.65, -1.0,
    // Top-right bracket
    1.45, 0.85, -1.0, 1.25, 0.85, -1.0,
    1.45, 0.85, -1.0, 1.45, 0.65, -1.0,
    // Bottom-left bracket
    -1.45, -0.85, -1.0, -1.25, -0.85, -1.0,
    -1.45, -0.85, -1.0, -1.45, -0.65, -1.0,
    // Bottom-right bracket
    1.45, -0.85, -1.0, 1.25, -0.85, -1.0,
    1.45, -0.85, -1.0, 1.45, -0.65, -1.0,
  ]);
  tickGeo.setAttribute('position', new THREE.BufferAttribute(tickVerts, 3));
  const tickLines = new THREE.LineSegments(
    tickGeo,
    new THREE.LineBasicMaterial({ color: bezelColor, transparent: true, opacity: 0.5 })
  );
  cockpitFrame.add(tickLines);
  group.add(cockpitFrame);

  // Empty barrel group (clean open viewport without the obstructing 3D cannon)
  const barrelGroup = new THREE.Group();
  group.add(barrelGroup);

  return { group, barrelGroup, cockpitFrame };
}

/**
 * Procedural Vector House (Gable roof, rectangular walls, door frame).
 * Includes dark tinted semi-opaque walls to occlude background hills/enemies
 * while preserving the luminous retro vector wireframe edge aesthetic!
 */
export function createVectorHouseModel(w: number, h: number, d: number, destructible: boolean): THREE.Group {
  const group = new THREE.Group();
  const color = destructible ? 0x00ff88 : 0x00cc55;

  const halfW = w / 2;
  const halfD = d / 2;
  const wallH = h * 0.65;
  const roofPeakH = h;

  // 1. Semi-opaque solid wall & roof mesh (blocks line-of-sight & occludes objects behind)
  const wallTriangles: number[] = [
    // Front wall (-Z)
    -halfW, 0, -halfD,   halfW, 0, -halfD,   halfW, wallH, -halfD,
    -halfW, 0, -halfD,   halfW, wallH, -halfD,  -halfW, wallH, -halfD,

    // Back wall (+Z)
    halfW, 0, halfD,   -halfW, 0, halfD,   -halfW, wallH, halfD,
    halfW, 0, halfD,   -halfW, wallH, halfD,   halfW, wallH, halfD,

    // Left wall (-X)
    -halfW, 0, halfD,   -halfW, 0, -halfD,   -halfW, wallH, -halfD,
    -halfW, 0, halfD,   -halfW, wallH, -halfD,  -halfW, wallH, halfD,

    // Right wall (+X)
    halfW, 0, -halfD,    halfW, 0, halfD,    halfW, wallH, halfD,
    halfW, 0, -halfD,    halfW, wallH, halfD,   halfW, wallH, -halfD,

    // Front gable triangle (-Z)
    -halfW, wallH, -halfD,  halfW, wallH, -halfD,  0, roofPeakH, -halfD,

    // Back gable triangle (+Z)
    halfW, wallH, halfD,   -halfW, wallH, halfD,  0, roofPeakH, halfD,

    // Left roof slope
    -halfW, wallH, -halfD,  0, roofPeakH, -halfD,  0, roofPeakH, halfD,
    -halfW, wallH, -halfD,  0, roofPeakH, halfD,  -halfW, wallH, halfD,

    // Right roof slope
    0, roofPeakH, -halfD,   halfW, wallH, -halfD,  halfW, wallH, halfD,
    0, roofPeakH, -halfD,   halfW, wallH, halfD,   0, roofPeakH, halfD,
  ];

  const meshGeo = new THREE.BufferGeometry();
  meshGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallTriangles, 3));
  meshGeo.computeVertexNormals();

  // Dark tinted semi-opaque phosphor wall material (opacity ~0.74)
  const wallMat = new THREE.MeshBasicMaterial({
    color: 0x011a0c, // Deep dark phosphor green / tinted glass
    transparent: true,
    opacity: 0.74,
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  const solidMesh = new THREE.Mesh(meshGeo, wallMat);
  group.add(solidMesh);

  // 2. Glowing Vector Wireframe Edges
  const linesVerts: number[] = [
    // Base footprint rectangle
    -halfW, 0, -halfD,  halfW, 0, -halfD,
     halfW, 0, -halfD,  halfW, 0,  halfD,
     halfW, 0,  halfD, -halfW, 0,  halfD,
    -halfW, 0,  halfD, -halfW, 0, -halfD,

    // Vertical wall corner posts
    -halfW, 0, -halfD, -halfW, wallH, -halfD,
     halfW, 0, -halfD,  halfW, wallH, -halfD,
     halfW, 0,  halfD,  halfW, wallH,  halfD,
    -halfW, 0,  halfD, -halfW, wallH,  halfD,

    // Eaves rectangle (top of walls)
    -halfW, wallH, -halfD,  halfW, wallH, -halfD,
     halfW, wallH, -halfD,  halfW, wallH,  halfD,
     halfW, wallH,  halfD, -halfW, wallH,  halfD,
    -halfW, wallH,  halfD, -halfW, wallH, -halfD,

    // Front gable triangle
    -halfW, wallH, -halfD, 0, roofPeakH, -halfD,
     halfW, wallH, -halfD, 0, roofPeakH, -halfD,

    // Rear gable triangle
    -halfW, wallH, halfD, 0, roofPeakH, halfD,
     halfW, wallH, halfD, 0, roofPeakH, halfD,

    // Top Roof Ridge Line
    0, roofPeakH, -halfD, 0, roofPeakH, halfD,

    // Door Frame lines
    -halfW * 0.25, 0, -halfD, -halfW * 0.25, wallH * 0.6, -halfD,
     halfW * 0.25, 0, -halfD,  halfW * 0.25, wallH * 0.6, -halfD,
    -halfW * 0.25, wallH * 0.6, -halfD, halfW * 0.25, wallH * 0.6, -halfD,
  ];

  // If destructible, add structural diagonal brace lines
  if (destructible) {
    linesVerts.push(
      -halfW, 0, halfD, halfW, wallH, halfD,
      -halfW, wallH, halfD, halfW, 0, halfD
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(linesVerts, 3));
  const wire = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: true })
  );
  group.add(wire);

  return group;
}

/**
 * Procedural Vector Bunker (Heavy reinforced military bunker).
 * Features semi-opaque armored concrete walls with glowing embrasures.
 */
export function createVectorBunkerModel(w: number, h: number, d: number): THREE.Group {
  const group = new THREE.Group();
  const color = 0x00bb55;

  const halfW = w / 2;
  const halfD = d / 2;
  const topInsetW = halfW * 0.75;
  const topInsetD = halfD * 0.75;

  // 1. Solid semi-opaque bunker walls & roof
  const bunkerTriangles: number[] = [
    // Front sloped wall (-Z)
    -halfW, 0, -halfD,  halfW, 0, -halfD,  topInsetW, h, -topInsetD,
    -halfW, 0, -halfD,  topInsetW, h, -topInsetD, -topInsetW, h, -topInsetD,

    // Back sloped wall (+Z)
    halfW, 0, halfD,  -halfW, 0, halfD,  -topInsetW, h, topInsetD,
    halfW, 0, halfD,  -topInsetW, h, topInsetD,  topInsetW, h, topInsetD,

    // Left sloped wall (-X)
    -halfW, 0, halfD,  -halfW, 0, -halfD,  -topInsetW, h, -topInsetD,
    -halfW, 0, halfD,  -topInsetW, h, -topInsetD, -topInsetW, h, topInsetD,

    // Right sloped wall (+X)
    halfW, 0, -halfD,  halfW, 0, halfD,  topInsetW, h, topInsetD,
    halfW, 0, -halfD,  topInsetW, h, topInsetD,  topInsetW, h, -topInsetD,

    // Top flat roof
    -topInsetW, h, -topInsetD,  topInsetW, h, -topInsetD,  topInsetW, h, topInsetD,
    -topInsetW, h, -topInsetD,  topInsetW, h, topInsetD,  -topInsetW, h, topInsetD,
  ];

  const bunkerMeshGeo = new THREE.BufferGeometry();
  bunkerMeshGeo.setAttribute('position', new THREE.Float32BufferAttribute(bunkerTriangles, 3));
  bunkerMeshGeo.computeVertexNormals();

  const bunkerWallMat = new THREE.MeshBasicMaterial({
    color: 0x021910, // Dark armored bunker slate-green
    transparent: true,
    opacity: 0.82, // Heavy reinforced opacity
    side: THREE.DoubleSide,
    depthWrite: true,
  });
  const bunkerSolid = new THREE.Mesh(bunkerMeshGeo, bunkerWallMat);
  group.add(bunkerSolid);

  // 2. Wireframe structural frame & firing slit
  const verts: number[] = [
    // Bottom wide rectangle
    -halfW, 0, -halfD,  halfW, 0, -halfD,
     halfW, 0, -halfD,  halfW, 0,  halfD,
     halfW, 0,  halfD, -halfW, 0,  halfD,
    -halfW, 0,  halfD, -halfW, 0, -halfD,

    // Sloped corner posts
    -halfW, 0, -halfD, -topInsetW, h, -topInsetD,
     halfW, 0, -halfD,  topInsetW, h, -topInsetD,
     halfW, 0,  halfD,  topInsetW, h,  topInsetD,
    -halfW, 0,  halfD, -topInsetW, h,  topInsetD,

    // Top roof rectangle
    -topInsetW, h, -topInsetD,  topInsetW, h, -topInsetD,
     topInsetW, h, -topInsetD,  topInsetW, h,  topInsetD,
     topInsetW, h,  topInsetD, -topInsetW, h,  topInsetD,
    -topInsetW, h,  topInsetD, -topInsetW, h, -topInsetD,

    // Gun embrasure / vision slit in front
    -halfW * 0.5, h * 0.45, -halfD * 0.9, halfW * 0.5, h * 0.45, -halfD * 0.9,
    -halfW * 0.5, h * 0.65, -halfD * 0.9, halfW * 0.5, h * 0.65, -halfD * 0.9,
    -halfW * 0.5, h * 0.45, -halfD * 0.9, -halfW * 0.5, h * 0.65, -halfD * 0.9,
     halfW * 0.5, h * 0.45, -halfD * 0.9,  halfW * 0.5, h * 0.65, -halfD * 0.9,
  ];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const wire = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: true })
  );
  group.add(wire);

  return group;
}

/**
 * Procedural Vector Observation Tower.
 * Solid semi-opaque observation deck and cabin with wireframe pylon framework.
 */
export function createVectorTowerModel(w: number, h: number, d: number): THREE.Group {
  const group = new THREE.Group();
  const color = 0x00ff77;

  const halfW = w / 2;
  const halfD = d / 2;
  const platH = h * 0.85;

  // 1. Semi-opaque platform deck and observation cabin
  const deckMat = new THREE.MeshBasicMaterial({
    color: 0x011b0e,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: true,
  });

  const deckGeo = new THREE.BoxGeometry(w * 1.25, 0.35, d * 1.25);
  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  deckMesh.position.set(0, platH, 0);
  group.add(deckMesh);

  // Observation cabin
  const cabGeo = new THREE.BoxGeometry(w * 0.85, h - platH, d * 0.85);
  const cabMesh = new THREE.Mesh(cabGeo, deckMat);
  cabMesh.position.set(0, platH + (h - platH) * 0.5, 0);
  group.add(cabMesh);

  // 2. Wireframe truss framework
  const verts: number[] = [
    // 4 Corner tower pylons
    -halfW * 1.5, 0, -halfD * 1.5, -halfW, platH, -halfD,
     halfW * 1.5, 0, -halfD * 1.5,  halfW, platH, -halfD,
     halfW * 1.5, 0,  halfD * 1.5,  halfW, platH,  halfD,
    -halfW * 1.5, 0,  halfD * 1.5, -halfW, platH,  halfD,

    // Mid-level horizontal cross braces
    -halfW * 1.25, platH * 0.5, -halfD * 1.25,  halfW * 1.25, platH * 0.5, -halfD * 1.25,
     halfW * 1.25, platH * 0.5, -halfD * 1.25,  halfW * 1.25, platH * 0.5,  halfD * 1.25,
     halfW * 1.25, platH * 0.5,  halfD * 1.25, -halfW * 1.25, platH * 0.5,  halfD * 1.25,
    -halfW * 1.25, platH * 0.5,  halfD * 1.25, -halfW * 1.25, platH * 0.5, -halfD * 1.25,

    // Platform deck frame
    -halfW * 1.2, platH, -halfD * 1.2,  halfW * 1.2, platH, -halfD * 1.2,
     halfW * 1.2, platH, -halfD * 1.2,  halfW * 1.2, platH,  halfD * 1.2,
     halfW * 1.2, platH,  halfD * 1.2, -halfW * 1.2, platH,  halfD * 1.2,
    -halfW * 1.2, platH,  halfD * 1.2, -halfW * 1.2, platH, -halfD * 1.2,

    // Top railing
    -halfW * 1.2, h, -halfD * 1.2,  halfW * 1.2, h, -halfD * 1.2,
     halfW * 1.2, h, -halfD * 1.2,  halfW * 1.2, h,  halfD * 1.2,
     halfW * 1.2, h,  halfD * 1.2, -halfW * 1.2, h,  halfD * 1.2,
    -halfW * 1.2, h,  halfD * 1.2, -halfW * 1.2, h, -halfD * 1.2,

    // Railing posts
    -halfW * 1.2, platH, -halfD * 1.2, -halfW * 1.2, h, -halfD * 1.2,
     halfW * 1.2, platH, -halfD * 1.2,  halfW * 1.2, h, -halfD * 1.2,
     halfW * 1.2, platH,  halfD * 1.2,  halfW * 1.2, h,  halfD * 1.2,
    -halfW * 1.2, platH,  halfD * 1.2, -halfW * 1.2, h,  halfD * 1.2,
  ];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  const wire = new THREE.LineSegments(
    geo,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: true })
  );
  group.add(wire);

  return group;
}

/**
 * Procedural Multi-part Vector Tank (Enemies).
 * 3-12 parts: Hull, Left/Right Tracks, Fenders, Turret, Gun Barrel, Muzzle, Antenna.
 */
export function createVectorTankModel(color = VECTOR_COLORS.enemyOrange): {
  group: THREE.Group;
  turretGroup: THREE.Group;
  barrelMesh: THREE.Group;
} {
  const group = new THREE.Group();

  // 1. Lower Chassis / Hull
  const hullGeo = new THREE.BoxGeometry(2.4, 0.8, 3.8);
  const hull = createWireframeObject(hullGeo, color);
  hull.position.y = 0.7;
  group.add(hull);

  // 2. Glacis plate (sloped front armor)
  const glacisGeo = new THREE.BufferGeometry();
  const glacisVerts = new Float32Array([
    -1.2, 0.3, -1.9,  1.2, 0.3, -1.9,
    1.2, 0.3, -1.9,   1.2, 1.1, -1.2,
    1.2, 1.1, -1.2,  -1.2, 1.1, -1.2,
    -1.2, 1.1, -1.2, -1.2, 0.3, -1.9,
  ]);
  glacisGeo.setAttribute('position', new THREE.BufferAttribute(glacisVerts, 3));
  const glacis = new THREE.LineSegments(glacisGeo, new THREE.LineBasicMaterial({ color }));
  group.add(glacis);

  // 3 & 4. Left & Right Track assemblies
  const trackGeo = new THREE.BoxGeometry(0.5, 0.7, 4.2);
  const leftTrack = createWireframeObject(trackGeo, color);
  leftTrack.position.set(-1.45, 0.5, 0);
  group.add(leftTrack);

  const rightTrack = createWireframeObject(trackGeo, color);
  rightTrack.position.set(1.45, 0.5, 0);
  group.add(rightTrack);

  // 5. Track Wheels lines (4 wheels per side)
  for (let i = -1.4; i <= 1.4; i += 0.9) {
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.52, 6);
    wheelGeo.rotateZ(Math.PI / 2);
    const wL = createWireframeObject(wheelGeo, color);
    wL.position.set(-1.45, 0.45, i);
    group.add(wL);

    const wR = createWireframeObject(wheelGeo, color);
    wR.position.set(1.45, 0.45, i);
    group.add(wR);
  }

  // Turret sub-assembly (rotates independently)
  const turretGroup = new THREE.Group();
  turretGroup.position.set(0, 1.3, -0.2);

  // 6. Turret Cupola / faceted dome
  const turretGeo = new THREE.BoxGeometry(1.6, 0.7, 2.0);
  const turret = createWireframeObject(turretGeo, VECTOR_COLORS.enemyTurret);
  turretGroup.add(turret);

  // 7. Commander hatch
  const hatchGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.15, 6);
  const hatch = createWireframeObject(hatchGeo, VECTOR_COLORS.enemyTurret);
  hatch.position.set(0.35, 0.42, 0.2);
  turretGroup.add(hatch);

  // 8. Radio Antenna wire
  const antGeo = new THREE.BufferGeometry();
  antGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([0.45, 0.45, 0.6, 0.65, 1.8, 0.8]), 3)
  );
  const antenna = new THREE.Line(antGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
  turretGroup.add(antenna);

  // 9. Gun Barrel sub-assembly
  const barrelMesh = new THREE.Group();
  barrelMesh.position.set(0, 0.05, -1.0);

  const gunTubeGeo = new THREE.CylinderGeometry(0.1, 0.12, 2.6, 8);
  gunTubeGeo.rotateX(Math.PI / 2);
  const gunTube = createWireframeObject(gunTubeGeo, VECTOR_COLORS.enemyTurret);
  gunTube.position.set(0, 0, -1.3);
  barrelMesh.add(gunTube);

  const muzzleGeo = new THREE.BoxGeometry(0.24, 0.2, 0.35);
  const muzzle = createWireframeObject(muzzleGeo, VECTOR_COLORS.enemyTurret);
  muzzle.position.set(0, 0, -2.6);
  barrelMesh.add(muzzle);

  turretGroup.add(barrelMesh);
  group.add(turretGroup);

  return { group, turretGroup, barrelMesh };
}

/**
 * Procedural Fast Surprise Enemy (V-99 Swift Saucer / Skimmer).
 * Rapid, agile aerial skimmer with vector wings and spinning ring.
 */
export function createFastScoutModel(): {
  group: THREE.Group;
  ringGroup: THREE.Group;
} {
  const group = new THREE.Group();
  const color = VECTOR_COLORS.scoutCyan;

  // 1. Central Aerodynamic Cockpit Pod
  const podGeo = new THREE.OctahedronGeometry(1.2, 1);
  podGeo.scale(1.4, 0.5, 1.8);
  const pod = createWireframeObject(podGeo, color);
  group.add(pod);

  // 2. Swept Delta Vector Wing Struts
  const wingGeo = new THREE.BufferGeometry();
  const wingVerts = new Float32Array([
    // Left wing
    0, 0, 1.0,  -2.6, 0, 0.2,
    -2.6, 0, 0.2,  -1.2, 0.2, -1.2,
    -1.2, 0.2, -1.2,  0, 0, 1.0,
    // Right wing
    0, 0, 1.0,   2.6, 0, 0.2,
    2.6, 0, 0.2,   1.2, 0.2, -1.2,
    1.2, 0.2, -1.2,  0, 0, 1.0,
  ]);
  wingGeo.setAttribute('position', new THREE.BufferAttribute(wingVerts, 3));
  const wings = new THREE.LineSegments(wingGeo, new THREE.LineBasicMaterial({ color, linewidth: 2 }));
  group.add(wings);

  // 3. Rotating energy ring
  const ringGroup = new THREE.Group();
  const ringGeo = new THREE.TorusGeometry(1.6, 0.08, 6, 16);
  ringGeo.rotateX(Math.PI / 2);
  const ring = createWireframeObject(ringGeo, 0xffffff);
  ringGroup.add(ring);
  group.add(ringGroup);

  // 4. Dual Plasma Cannon Emitters on wing tips
  const tipGeo = new THREE.ConeGeometry(0.12, 0.4, 4);
  tipGeo.rotateX(-Math.PI / 2);
  const tipL = createWireframeObject(tipGeo, 0xffff00);
  tipL.position.set(-2.5, 0, -0.1);
  group.add(tipL);

  const tipR = createWireframeObject(tipGeo, 0xffff00);
  tipR.position.set(2.5, 0, -0.1);
  group.add(tipR);

  // 5. Ventral Sensor Array
  const sensorGeo = new THREE.TetrahedronGeometry(0.4);
  const sensor = createWireframeObject(sensorGeo, color);
  sensor.position.set(0, -0.4, 0.3);
  group.add(sensor);

  return { group, ringGroup };
}

/**
 * Boss 1: Goliath Heavy Vector Juggernaut.
 * Huge dual-cannon super tank with frontal ram-shield and shockwave emitter.
 */
export function createGoliathBossModel(): {
  group: THREE.Group;
  turretGroup: THREE.Group;
  barrels: THREE.Group;
} {
  const group = new THREE.Group();
  const gold = VECTOR_COLORS.bossGold;

  // 1. Massive wide super-chassis
  const hullGeo = new THREE.BoxGeometry(4.8, 1.4, 6.2);
  const hull = createWireframeObject(hullGeo, gold);
  hull.position.y = 1.2;
  group.add(hull);

  // 2. Heavy Armored Track Pods (4 separate track units)
  const trackGeo = new THREE.BoxGeometry(0.85, 1.1, 3.2);
  const trackFL = createWireframeObject(trackGeo, gold);
  trackFL.position.set(-2.8, 0.8, -1.8);
  group.add(trackFL);

  const trackFR = createWireframeObject(trackGeo, gold);
  trackFR.position.set(2.8, 0.8, -1.8);
  group.add(trackFR);

  const trackBL = createWireframeObject(trackGeo, gold);
  trackBL.position.set(-2.8, 0.8, 1.8);
  group.add(trackBL);

  const trackBR = createWireframeObject(trackGeo, gold);
  trackBR.position.set(2.8, 0.8, 1.8);
  group.add(trackBR);

  // 3. Frontal Ram Wedge (Heavy bulldozer prow)
  const prowGeo = new THREE.BoxGeometry(4.6, 0.9, 1.2);
  const prow = createWireframeObject(prowGeo, gold);
  prow.position.set(0, 0.9, -3.4);
  group.add(prow);

  // 4. Rotating Super-Turret
  const turretGroup = new THREE.Group();
  turretGroup.position.set(0, 2.1, 0);

  const turretGeo = new THREE.BoxGeometry(3.2, 1.1, 3.6);
  const turret = createWireframeObject(turretGeo, VECTOR_COLORS.bossCrimson);
  turretGroup.add(turret);

  // 5. Twin Heavy Cannons
  const barrels = new THREE.Group();
  barrels.position.set(0, 0.1, -1.8);

  const b1Geo = new THREE.CylinderGeometry(0.18, 0.22, 4.5, 8);
  b1Geo.rotateX(Math.PI / 2);
  const b1 = createWireframeObject(b1Geo, VECTOR_COLORS.bossCrimson);
  b1.position.set(-0.7, 0, -2.2);
  barrels.add(b1);

  const b2 = createWireframeObject(b1Geo, VECTOR_COLORS.bossCrimson);
  b2.position.set(0.7, 0, -2.2);
  barrels.add(b2);

  // Muzzle Brakes
  const mbGeo = new THREE.BoxGeometry(0.45, 0.38, 0.6);
  const mb1 = createWireframeObject(mbGeo, gold);
  mb1.position.set(-0.7, 0, -4.4);
  barrels.add(mb1);

  const mb2 = createWireframeObject(mbGeo, gold);
  mb2.position.set(0.7, 0, -4.4);
  barrels.add(mb2);

  turretGroup.add(barrels);

  // 6. Rear Radar Dish
  const radarGeo = new THREE.CylinderGeometry(0.7, 0.1, 0.3, 8);
  radarGeo.rotateX(Math.PI / 3);
  const radar = createWireframeObject(radarGeo, gold);
  radar.position.set(0, 1.0, 1.3);
  turretGroup.add(radar);

  group.add(turretGroup);

  return { group, turretGroup, barrels };
}

/**
 * Boss 2: Hydra Mortar Behemoth.
 * Hexagonal multi-launch rocket/mortar fortress.
 */
export function createHydraBossModel(): {
  group: THREE.Group;
  turretGroup: THREE.Group;
  mortarPipes: THREE.Group;
} {
  const group = new THREE.Group();
  const crimson = VECTOR_COLORS.bossCrimson;

  // 1. Hexagonal heavy armored chassis
  const hullGeo = new THREE.CylinderGeometry(3.6, 4.0, 1.6, 6);
  const hull = createWireframeObject(hullGeo, crimson);
  hull.position.y = 1.3;
  group.add(hull);

  // 2. Surrounding caterpillar track pods
  for (let a = 0; a < 6; a++) {
    const angle = (a * Math.PI) / 3;
    const podGeo = new THREE.BoxGeometry(1.2, 0.9, 1.6);
    const pod = createWireframeObject(podGeo, VECTOR_COLORS.bossGold);
    pod.position.set(Math.cos(angle) * 3.8, 0.8, Math.sin(angle) * 3.8);
    pod.rotation.y = angle;
    group.add(pod);
  }

  // 3. Central Mortar Battery Turret
  const turretGroup = new THREE.Group();
  turretGroup.position.set(0, 2.3, 0);

  const battGeo = new THREE.BoxGeometry(2.8, 1.0, 2.8);
  const batt = createWireframeObject(battGeo, crimson);
  turretGroup.add(batt);

  // 4. 4 High-Angle Mortar Tubes
  const mortarPipes = new THREE.Group();
  mortarPipes.position.set(0, 0.5, 0);

  const offsets = [
    [-0.6, -0.6],
    [0.6, -0.6],
    [-0.6, 0.6],
    [0.6, 0.6],
  ];

  offsets.forEach(([ox, oz]) => {
    const tubeGeo = new THREE.CylinderGeometry(0.2, 0.22, 2.4, 8);
    // Angled upward for ballistic mortar volleys
    tubeGeo.rotateX(Math.PI / 3);
    const tube = createWireframeObject(tubeGeo, VECTOR_COLORS.bossGold);
    tube.position.set(ox, 0.7, oz - 0.5);
    mortarPipes.add(tube);
  });

  turretGroup.add(mortarPipes);
  group.add(turretGroup);

  return { group, turretGroup, mortarPipes };
}

/**
 * Boss 3: Titan Apex Overlord.
 * Floating vector pyramid with orbiting shield shards and center core.
 */
export function createTitanBossModel(): {
  group: THREE.Group;
  coreGroup: THREE.Group;
  shardsGroup: THREE.Group;
} {
  const group = new THREE.Group();
  const magenta = 0xff00bb;
  const cyan = 0x00ffff;

  // 1. Inverted Pyramidal Central Fortress Core
  const coreGroup = new THREE.Group();
  coreGroup.position.y = 3.8;

  const pyrGeo = new THREE.ConeGeometry(3.4, 4.2, 4);
  pyrGeo.rotateX(Math.PI); // Inverted pyramid
  const pyr = createWireframeObject(pyrGeo, magenta);
  coreGroup.add(pyr);

  // Inner power octahedron
  const innerGeo = new THREE.OctahedronGeometry(1.4);
  const inner = createWireframeObject(innerGeo, 0xffffff);
  coreGroup.add(inner);

  group.add(coreGroup);

  // 2. Orbiting Vector Shield Shards
  const shardsGroup = new THREE.Group();
  shardsGroup.position.y = 3.8;

  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI * 2) / 8;
    const shardGeo = new THREE.BoxGeometry(0.4, 1.8, 1.2);
    const shard = createWireframeObject(shardGeo, cyan);
    shard.position.set(Math.cos(angle) * 5.4, 0, Math.sin(angle) * 5.4);
    shard.rotation.y = angle;
    shardsGroup.add(shard);
  }

  group.add(shardsGroup);

  return { group, coreGroup, shardsGroup };
}

/**
 * Procedural Floating Power-up Polyhedron.
 */
export function createPowerUpModel(type: string): THREE.Group {
  const group = new THREE.Group();

  let color = VECTOR_COLORS.powerupDamage;
  if (type === 'TURBO_SPEED') color = VECTOR_COLORS.powerupSpeed;
  if (type === 'ENERGY_SHIELD') color = VECTOR_COLORS.powerupShield;
  if (type === 'RAPID_FIRE') color = VECTOR_COLORS.powerupRapid;

  // Outer Icosahedron
  const outerGeo = new THREE.IcosahedronGeometry(0.9, 0);
  const outer = createWireframeObject(outerGeo, color);
  group.add(outer);

  // Inner pulsating core
  const innerGeo = new THREE.OctahedronGeometry(0.45, 0);
  const inner = createWireframeObject(innerGeo, 0xffffff);
  group.add(inner);

  // Vertical light beacon pole lines
  const poleGeo = new THREE.BufferGeometry();
  poleGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array([0, -2, 0, 0, 8, 0]), 3)
  );
  const pole = new THREE.Line(poleGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }));
  group.add(pole);

  return group;
}

export interface Enemy3DHealthBar {
  group: THREE.Group;
  barLine: THREE.Line;
  bgFrame: THREE.LineSegments;
  totalWidth: number;
}

/**
 * Creates a floating 3D vector wireframe health bar over enemies.
 */
export function createEnemy3DHealthBar(width = 3.2): Enemy3DHealthBar {
  const group = new THREE.Group();
  const halfW = width / 2;
  const h = 0.32;

  // Frame bracket [   ]
  const frameVerts = new Float32Array([
    -halfW, -h / 2, 0,  halfW, -h / 2, 0,
     halfW, -h / 2, 0,  halfW,  h / 2, 0,
     halfW,  h / 2, 0, -halfW,  h / 2, 0,
    -halfW,  h / 2, 0, -halfW, -h / 2, 0,
    // Center divider tick
    0, -h / 2, 0, 0, h / 2, 0,
  ]);
  const frameGeo = new THREE.BufferGeometry();
  frameGeo.setAttribute('position', new THREE.BufferAttribute(frameVerts, 3));
  const bgFrame = new THREE.LineSegments(
    frameGeo,
    new THREE.LineBasicMaterial({ color: 0x441122, transparent: true, opacity: 0.85 })
  );
  group.add(bgFrame);

  // Dynamic HP line
  const barGeo = new THREE.BufferGeometry();
  const barVerts = new Float32Array([
    -halfW + 0.08, 0, 0.01,
     halfW - 0.08, 0, 0.01,
  ]);
  barGeo.setAttribute('position', new THREE.BufferAttribute(barVerts, 3));
  const barLine = new THREE.Line(
    barGeo,
    new THREE.LineBasicMaterial({ color: 0xff3344, linewidth: 2, transparent: true, opacity: 0.95 })
  );
  group.add(barLine);

  return { group, barLine, bgFrame, totalWidth: width - 0.16 };
}

/**
 * Updates floating 3D health bar length, color, and billboard orientation.
 */
export function updateEnemy3DHealthBar(
  barObj: Enemy3DHealthBar,
  currentHp: number,
  maxHp: number,
  cameraPosition: THREE.Vector3
) {
  // Billboard towards camera
  barObj.group.lookAt(cameraPosition.x, barObj.group.position.y, cameraPosition.z);

  const ratio = Math.max(0, Math.min(1, currentHp / (maxHp || 1)));
  const halfW = barObj.totalWidth / 2;
  const leftX = -halfW;
  const rightX = leftX + barObj.totalWidth * ratio;

  const posAttr = barObj.barLine.geometry.attributes.position as THREE.BufferAttribute;
  const arr = posAttr.array as Float32Array;
  arr[0] = leftX;
  arr[1] = 0;
  arr[2] = 0.01;
  arr[3] = Math.max(leftX, rightX);
  arr[4] = 0;
  arr[5] = 0.01;
  posAttr.needsUpdate = true;

  // Color gradient according to health
  const mat = barObj.barLine.material as THREE.LineBasicMaterial;
  if (ratio > 0.55) {
    mat.color.setHex(0x00ff66);
  } else if (ratio > 0.25) {
    mat.color.setHex(0xffaa00);
  } else {
    mat.color.setHex(0xff2244);
  }
}
