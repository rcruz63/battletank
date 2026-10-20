/**
 * Procedural heightmap and terrain geometry math.
 * Pure logic decoupled from Three.js rendering for deterministic unit testing.
 */

export interface TerrainConfig {
  size: number;
  segments: number;
  hillScale: number;
  mountainScale: number;
  seed?: number;
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  size: 600,
  segments: 80,
  hillScale: 9.0,
  mountainScale: 28.0,
};

let activeTerrainSeed = 1980;

export function setTerrainSeed(seed: number) {
  activeTerrainSeed = seed;
}

export function getTerrainSeed(): number {
  return activeTerrainSeed;
}

function getHarmonicParams(seed: number) {
  if (seed === 1980) {
    return {
      f1x: 0.02,
      f1z: 0.02,
      off1: 0,
      f2x: 0.045,
      f2z: 0.038,
      off2x: 1.2,
      off2z: -0.7,
      f3: 0.015,
      hillMult: 1.0,
      m1x: 0.012,
      m1z: 0.015,
    };
  }

  const s = Math.abs(seed);
  const p1 = ((s * 9301 + 49297) % 233280) / 233280;
  const p2 = (((s + 11) * 9301 + 49297) % 233280) / 233280;
  const p3 = (((s + 37) * 9301 + 49297) % 233280) / 233280;
  const p4 = (((s + 71) * 9301 + 49297) % 233280) / 233280;
  const p5 = (((s + 109) * 9301 + 49297) % 233280) / 233280;

  return {
    f1x: 0.016 + p1 * 0.01,
    f1z: 0.016 + p2 * 0.01,
    off1: p1 * Math.PI * 2,
    f2x: 0.035 + p3 * 0.02,
    f2z: 0.03 + p4 * 0.02,
    off2x: p3 * Math.PI * 2,
    off2z: p4 * Math.PI * 2,
    f3: 0.012 + p5 * 0.008,
    hillMult: 0.85 + p2 * 0.45,
    m1x: 0.01 + p3 * 0.008,
    m1z: 0.012 + p4 * 0.008,
  };
}

/**
 * Returns height Y at world position (x, z).
 * Includes smooth valleys near origin for fair combat starting zone,
 * surrounded by rolling hills and distant mountainous peaks.
 */
export function getTerrainHeight(x: number, z: number, config: TerrainConfig = DEFAULT_TERRAIN_CONFIG): number {
  const seed = config.seed ?? activeTerrainSeed;
  const params = getHarmonicParams(seed);
  const distFromCenter = Math.sqrt(x * x + z * z);

  // Flat combat arena zone around spawn (radius 30) to allow immediate battle readiness
  const centerFlatten = Math.min(1, Math.max(0, (distFromCenter - 30) / 45));

  // Primary rolling terrain harmonics driven by seed
  const h1 = Math.sin(x * params.f1x + params.off1) * Math.cos(z * params.f1z + params.off1) * (config.hillScale * params.hillMult);
  const h2 = Math.sin(x * params.f2x + params.off2x) * Math.cos(z * params.f2z + params.off2z) * (config.hillScale * params.hillMult * 0.5);
  const h3 = Math.cos((x + z) * params.f3) * (config.hillScale * params.hillMult * 0.35);

  // Distant mountain ranges that rise towards the perimeter
  const mountainRamp = Math.max(0, (distFromCenter - 140) / 130);
  const m1 = (Math.sin(x * params.m1x) * Math.sin(z * params.m1z) + 0.5) * config.mountainScale * mountainRamp;

  return (h1 + h2 + h3) * centerFlatten + m1;
}

/**
 * Calculates surface normal [nx, ny, nz] at (x, z) using finite differences.
 */
export function getTerrainNormal(x: number, z: number, step = 1.0): [number, number, number] {
  const hL = getTerrainHeight(x - step, z);
  const hR = getTerrainHeight(x + step, z);
  const hD = getTerrainHeight(x, z - step);
  const hU = getTerrainHeight(x, z + step);

  const dx = (hR - hL) / (2 * step);
  const dz = (hU - hD) / (2 * step);

  // Vector [-dx, 1, -dz] normalized
  const len = Math.sqrt(dx * dx + 1 + dz * dz);
  return [-dx / len, 1 / len, -dz / len];
}

/**
 * Checks line of sight between two 3D positions through terrain.
 * Returns true if clear, false if obstructed by hills.
 */
export function hasLineOfSight(
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toY: number,
  toZ: number,
  samples = 20
): boolean {
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    const px = fromX + (toX - fromX) * t;
    const py = fromY + (toY - fromY) * t;
    const pz = fromZ + (toZ - fromZ) * t;

    const terrainY = getTerrainHeight(px, pz);
    if (py < terrainY + 0.2) {
      return false; // Terrain occludes line of sight
    }
  }
  return true;
}
