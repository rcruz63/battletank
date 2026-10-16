/**
 * Procedural heightmap and terrain geometry math.
 * Pure logic decoupled from Three.js rendering for deterministic unit testing.
 */

export interface TerrainConfig {
  size: number;
  segments: number;
  hillScale: number;
  mountainScale: number;
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  size: 600,
  segments: 80,
  hillScale: 9.0,
  mountainScale: 28.0,
};

/**
 * Returns height Y at world position (x, z).
 * Includes smooth valleys near origin for fair combat starting zone,
 * surrounded by rolling hills and distant mountainous peaks.
 */
export function getTerrainHeight(x: number, z: number, config: TerrainConfig = DEFAULT_TERRAIN_CONFIG): number {
  const distFromCenter = Math.sqrt(x * x + z * z);

  // Flat combat arena zone around spawn (radius 35) to allow immediate battle readiness
  const centerFlatten = Math.min(1, Math.max(0, (distFromCenter - 30) / 45));

  // Primary rolling terrain harmonics
  const h1 = Math.sin(x * 0.02) * Math.cos(z * 0.02) * config.hillScale;
  const h2 = Math.sin(x * 0.045 + 1.2) * Math.cos(z * 0.038 - 0.7) * (config.hillScale * 0.5);
  const h3 = Math.cos((x + z) * 0.015) * (config.hillScale * 0.35);

  // Distant mountain ranges that rise towards the perimeter
  const mountainRamp = Math.max(0, (distFromCenter - 140) / 130);
  const m1 = (Math.sin(x * 0.012) * Math.sin(z * 0.015) + 0.5) * config.mountainScale * mountainRamp;

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
