/**
 * Game rules, stage progression, enemy archetypes, power-ups, and scoring.
 * Pure logic testable with node:test.
 */

export type PowerUpType = 'DAMAGE_BOOST' | 'TURBO_SPEED' | 'ENERGY_SHIELD' | 'RAPID_FIRE';

export interface PowerUpItem {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  z: number;
  radius: number;
  duration: number; // Duration of effect when collected
  collected: boolean;
}

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
  regularTankCount: number;
  fastScoutCount: number;
  bossType: EnemyType;
  powerUpCount: number;
}

export const STAGE_CONFIGS: StageDefinition[] = [
  {
    stageNumber: 1,
    name: 'PHASE 1: VALLEY OF WIRE',
    subtitle: 'Clear hostile tanks & eliminate Goliath',
    regularTankCount: 3,
    fastScoutCount: 1, // Exceptionally fast surprise enemy
    bossType: 'boss_goliath',
    powerUpCount: 3,
  },
  {
    stageNumber: 2,
    name: 'PHASE 2: RIDGE SIEGE',
    subtitle: 'Repel high-mobility flankers & defeat Hydra',
    regularTankCount: 5,
    fastScoutCount: 2,
    bossType: 'boss_hydra',
    powerUpCount: 4,
  },
  {
    stageNumber: 3,
    name: 'PHASE 3: APEX TITAN CITADEL',
    subtitle: 'Overcome enemy onslaught & destroy Titan Overlord',
    regularTankCount: 7,
    fastScoutCount: 3,
    bossType: 'boss_titan',
    powerUpCount: 5,
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
