/**
 * Game rules, stage progression, enemy archetypes, power-ups, and scoring.
 * Pure logic testable with node:test.
 */

export type PowerUpType = 'DAMAGE_BOOST' | 'TURBO_SPEED' | 'ENERGY_SHIELD' | 'RAPID_FIRE' | 'REPAIR_KIT';

export interface PowerUpItem {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  z: number;
  radius: number;
  duration: number; // Duration of effect when collected (or 0 for instant instant heal)
  collected: boolean;
}

export interface RepairStationConfig {
  radius: number;
  healPerSecond: number;
}

export const REPAIR_STATION_CONFIG: RepairStationConfig = {
  radius: 7.0,
  healPerSecond: 35,
};

export type EnemyType = 'regular_tank' | 'fast_scout' | 'boss_goliath' | 'boss_hydra' | 'boss_titan';

export interface EnemyConfig {
  type: EnemyType;
  name: string;
  maxHp: number;
  speed: number;
  turnSpeed: number;
  shootCooldown: number;
  damage: number;
  scoreValue: number;
  size: number;
  isBoss: boolean;
}

export const ENEMY_ARCHETYPES: Record<EnemyType, EnemyConfig> = {
  regular_tank: {
    type: 'regular_tank',
    name: 'MK-IV Vector Tank',
    maxHp: 80,
    speed: 9.0,
    turnSpeed: 1.5,
    shootCooldown: 2.8,
    damage: 20,
    scoreValue: 250,
    size: 3.2,
    isBoss: false,
  },
  fast_scout: {
    type: 'fast_scout',
    name: 'V-99 Swift Saucer',
    maxHp: 45,
    speed: 21.0, // High agility surprise enemy
    turnSpeed: 3.2,
    shootCooldown: 1.6,
    damage: 15,
    scoreValue: 600,
    size: 2.4,
    isBoss: false,
  },
  boss_goliath: {
    type: 'boss_goliath',
    name: 'GOLIATH HEAVY JUGGERNAUT',
    maxHp: 550,
    speed: 6.5,
    turnSpeed: 0.9,
    shootCooldown: 2.2,
    damage: 35,
    scoreValue: 3000,
    size: 6.5,
    isBoss: true,
  },
  boss_hydra: {
    type: 'boss_hydra',
    name: 'HYDRA MORTAR BEHEMOTH',
    maxHp: 850,
    speed: 7.0,
    turnSpeed: 1.0,
    shootCooldown: 1.8,
    damage: 40,
    scoreValue: 5000,
    size: 7.0,
    isBoss: true,
  },
  boss_titan: {
    type: 'boss_titan',
    name: 'TITAN APEX OVERLORD',
    maxHp: 1300,
    speed: 7.5,
    turnSpeed: 1.2,
    shootCooldown: 1.5,
    damage: 50,
    scoreValue: 8000,
    size: 8.0,
    isBoss: true,
  },
};

export interface StageDefinition {
  stageNumber: number;
  name: string;
  subtitle: string;
  regularTankCount: number; // Initial tanks spawned
  reinforcementCount: number; // Reinforcement tanks spawned during the battle
  fastScoutCount: number;
  bossType: EnemyType | null;
  powerUpCount: number;
  enemyCooldownMult?: number; // Slower enemy fire in early sectors
}

export const STAGE_CONFIGS: StageDefinition[] = [
  {
    stageNumber: 1,
    name: 'FASE 1: VALLE DE MALLA',
    subtitle: 'Patrulla inicial: neutraliza los 2 tanques hostiles',
    regularTankCount: 2, // Exactly 2 enemies as requested by user
    reinforcementCount: 1, // 1 reinforcement tank after first kill
    fastScoutCount: 0, // No surprise fast scouts in phase 1
    bossType: null, // No mega-boss in phase 1!
    powerUpCount: 3,
    enemyCooldownMult: 1.5, // 50% more time between enemy shots
  },
  {
    stageNumber: 2,
    name: 'FASE 2: ASALTO A LA COLINA',
    subtitle: 'Derriba los tanques blindados y elimina al Coloso Goliath',
    regularTankCount: 3,
    reinforcementCount: 1,
    fastScoutCount: 1, // First surprise fast scout appears
    bossType: 'boss_goliath',
    powerUpCount: 4,
    enemyCooldownMult: 1.15,
  },
  {
    stageNumber: 3,
    name: 'FASE 3: BATERÍA MORTAL',
    subtitle: 'Sobrevive al bombardeo y neutraliza al Hydra Behemoth',
    regularTankCount: 5,
    reinforcementCount: 2,
    fastScoutCount: 2,
    bossType: 'boss_hydra',
    powerUpCount: 4,
    enemyCooldownMult: 1.0,
  },
  {
    stageNumber: 4,
    name: 'FASE 4: CIUDADELA TITÁN',
    subtitle: 'Asalto final contra el Titan Apex Overlord',
    regularTankCount: 7,
    reinforcementCount: 2,
    fastScoutCount: 3,
    bossType: 'boss_titan',
    powerUpCount: 5,
    enemyCooldownMult: 0.9,
  },
];

/**
 * Calculates damage dealt factoring in player power-up modifiers.
 */
export function calculatePlayerDamage(baseDamage: number, hasDoubleDamage: boolean): number {
  return hasDoubleDamage ? baseDamage * 2.2 : baseDamage;
}

/**
 * Calculates player speed factoring in turbo power-up.
 */
export function calculatePlayerSpeed(baseSpeed: number, hasTurbo: boolean): number {
  return hasTurbo ? baseSpeed * 1.75 : baseSpeed;
}

/**
 * Calculates reload cooldown factoring in rapid-fire power-up.
 */
export function calculateReloadCooldown(baseCooldown: number, hasRapidFire: boolean): number {
  return hasRapidFire ? baseCooldown * 0.45 : baseCooldown;
}

/**
 * Checks distance between 2D or 3D positions for spherical collision.
 */
export function checkSphereCollision(
  x1: number,
  y1: number,
  z1: number,
  r1: number,
  x2: number,
  y2: number,
  z2: number,
  r2: number
): boolean {
  const dx = x1 - x2;
  const dy = y1 - y2;
  const dz = z1 - z2;
  const distSq = dx * dx + dy * dy + dz * dz;
  const radSum = r1 + r2;
  return distSq <= radSum * radSum;
}

/**
 * Computes score with accuracy and combo bonuses.
 */
export function computeFinalScore(baseScore: number, stage: number, remainingHpRatio: number): number {
  const hpBonus = Math.round(remainingHpRatio * 1000);
  const stageMultiplier = 1 + (stage - 1) * 0.5;
  return Math.round((baseScore + hpBonus) * stageMultiplier);
}
