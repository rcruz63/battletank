/**
 * Procedural Vector Obstacle Buildings (Houses, Bunkers, Towers).
 * Pure logic testable with node:test.
 */

import { getTerrainHeight } from './terrain.ts';

export type BuildingType = 'house' | 'bunker' | 'tower';

export interface VectorBuilding {
  id: string;
  type: BuildingType;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  rotation: number;
  destructible: boolean;
  hp: number;
  maxHp: number;
  alive: boolean;
}

/**
 * Checks if a 2D circle at (px, pz) with radius collides with an oriented 2D bounding box.
 */
export function checkCircleBoxCollision(
  px: number,
  pz: number,
  radius: number,
  bx: number,
  bz: number,
  bw: number,
  bd: number,
  rotation: number = 0
): { collided: boolean; normalX: number; normalZ: number; overlap: number } {
  // Transform circle point into box local coordinate system
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const dx = px - bx;
  const dz = pz - bz;

  const localX = cos * dx - sin * dz;
  const localZ = sin * dx + cos * dz;

  const halfW = bw / 2;
  const halfD = bd / 2;

  // Closest point on box
  const closestX = Math.max(-halfW, Math.min(halfW, localX));
  const closestZ = Math.max(-halfD, Math.min(halfD, localZ));

  const diffX = localX - closestX;
  const diffZ = localZ - closestZ;
  const distSq = diffX * diffX + diffZ * diffZ;

  if (distSq <= radius * radius) {
    const dist = Math.sqrt(distSq);
    const overlap = radius - dist;

    // Local normal
    let normLocX = diffX === 0 && diffZ === 0 ? 1 : diffX / (dist || 1);
    let normLocZ = diffX === 0 && diffZ === 0 ? 0 : diffZ / (dist || 1);

    // Rotate normal back to world space
    const cosWorld = Math.cos(rotation);
    const sinWorld = Math.sin(rotation);
    const worldNormX = cosWorld * normLocX - sinWorld * normLocZ;
    const worldNormZ = sinWorld * normLocX + cosWorld * normLocZ;

    return { collided: true, normalX: worldNormX, normalZ: worldNormZ, overlap: overlap || 0.1 };
  }

  return { collided: false, normalX: 0, normalZ: 0, overlap: 0 };
}

/**
 * Checks if a 3D point (or projectile segment) hits a 3D building box.
 */
export function checkPointInsideBuilding(
  px: number,
  py: number,
  pz: number,
  building: VectorBuilding,
  margin = 0.4
): boolean {
  if (!building.alive) return false;

  // Height check
  if (py < building.y || py > building.y + building.height + margin) {
    return false;
  }

  const cos = Math.cos(-building.rotation);
  const sin = Math.sin(-building.rotation);
  const dx = px - building.x;
  const dz = pz - building.z;

  const localX = cos * dx - sin * dz;
  const localZ = sin * dx + cos * dz;

  const halfW = building.width / 2 + margin;
  const halfD = building.depth / 2 + margin;

  return Math.abs(localX) <= halfW && Math.abs(localZ) <= halfD;
}

/**
 * Checks line of sight between two positions, checking if any alive building obstructs the ray.
 */
export function isLineBlockedByBuildings(
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toY: number,
  toZ: number,
  buildings: VectorBuilding[],
  steps = 15
): boolean {
  for (const b of buildings) {
    if (!b.alive) continue;
    // Bounding circle quick reject
    const maxDim = Math.max(b.width, b.depth) * 0.8;
    const distFrom = Math.hypot(fromX - b.x, fromZ - b.z);
    const distTo = Math.hypot(toX - b.x, toZ - b.z);
    const totalDist = Math.hypot(toX - fromX, toZ - fromZ);

    if (distFrom + distTo > totalDist + maxDim * 2) {
      continue; // Ray is nowhere near this building
    }

    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const px = fromX + (toX - fromX) * t;
      const py = fromY + (toY - fromY) * t;
      const pz = fromZ + (toZ - fromZ) * t;

      if (checkPointInsideBuilding(px, py, pz, b, 0.2)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Generates an interesting tactical layout of houses, bunkers, and towers
 * scattered across the arena in tactical clusters.
 */
export function generateStageBuildings(stageNumber: number): VectorBuilding[] {
  const buildings: VectorBuilding[] = [];

  // Cluster 1: Abandoned Village / Outpost at North-East (+X, -Z)
  const village1 = [
    { type: 'house' as const, ox: 25, oz: -35, w: 7, d: 9, h: 5.5, rot: 0.2, dest: true, hp: 60 },
    { type: 'house' as const, ox: 40, oz: -30, w: 8, d: 8, h: 6.0, rot: -0.3, dest: true, hp: 60 },
    { type: 'house' as const, ox: 32, oz: -48, w: 9, d: 7, h: 5.2, rot: 0.1, dest: true, hp: 60 },
    { type: 'bunker' as const, ox: 50, oz: -50, w: 10, d: 10, h: 4.5, rot: 0.78, dest: false, hp: 999 }, // Solid indestructible bunker
    { type: 'tower' as const, ox: 20, oz: -55, w: 4, d: 4, h: 11.0, rot: 0, dest: true, hp: 80 },
  ];

  // Cluster 2: Mountain Pass Checkpoint at South-West (-X, +Z)
  const village2 = [
    { type: 'house' as const, ox: -35, oz: 30, w: 8, d: 8, h: 5.8, rot: 0.4, dest: true, hp: 60 },
    { type: 'house' as const, ox: -48, oz: 38, w: 9, d: 7, h: 5.4, rot: -0.2, dest: true, hp: 60 },
    { type: 'bunker' as const, ox: -30, oz: 48, w: 12, d: 9, h: 4.8, rot: 0.5, dest: false, hp: 999 },
    { type: 'tower' as const, ox: -52, oz: 24, w: 4, d: 4, h: 10.5, rot: 0.1, dest: true, hp: 80 },
  ];

  // Cluster 3: Forward Defense Line at North-West (-X, -Z)
  const village3 = [
    { type: 'bunker' as const, ox: -40, oz: -40, w: 11, d: 11, h: 5.0, rot: 0.8, dest: false, hp: 999 },
    { type: 'house' as const, ox: -28, oz: -52, w: 8, d: 9, h: 5.5, rot: 0.35, dest: true, hp: 60 },
    { type: 'house' as const, ox: -52, oz: -30, w: 7, d: 8, h: 5.2, rot: -0.15, dest: true, hp: 60 },
  ];

  // Cluster 4: Central Valley Ruins (tactical cover near starting zone)
  const centralRuins = [
    { type: 'house' as const, ox: 18, oz: 22, w: 7, d: 7, h: 4.8, rot: 0.5, dest: true, hp: 50 },
    { type: 'house' as const, ox: -20, oz: -18, w: 8, d: 7, h: 5.0, rot: -0.4, dest: true, hp: 50 },
    { type: 'bunker' as const, ox: 22, oz: -15, w: 9, d: 8, h: 4.2, rot: 0.2, dest: false, hp: 999 },
  ];

  const allDefs = [...village1, ...village2, ...village3, ...centralRuins];

  // Add more buildings for Stage 2 & 3
  if (stageNumber >= 2) {
    allDefs.push(
      { type: 'house', ox: 65, oz: 15, w: 9, d: 9, h: 6.0, rot: 0.3, dest: true, hp: 70 },
      { type: 'tower', ox: 75, oz: 25, w: 4.5, d: 4.5, h: 12.0, rot: 0, dest: true, hp: 80 },
      { type: 'bunker', ox: -65, oz: -60, w: 12, d: 10, h: 5.2, rot: -0.5, dest: false, hp: 999 }
    );
  }

  if (stageNumber >= 3) {
    allDefs.push(
      { type: 'bunker', ox: 0, oz: 65, w: 14, d: 10, h: 5.5, rot: 0, dest: false, hp: 999 },
      { type: 'house', ox: -15, oz: 70, w: 8, d: 8, h: 5.6, rot: 0.4, dest: true, hp: 80 },
      { type: 'house', ox: 15, oz: 70, w: 8, d: 8, h: 5.6, rot: -0.4, dest: true, hp: 80 }
    );
  }

  allDefs.forEach((def, idx) => {
    const y = getTerrainHeight(def.ox, def.oz);
    buildings.push({
      id: `bld-${stageNumber}-${idx}`,
      type: def.type,
      x: def.ox,
      y,
      z: def.oz,
      width: def.w,
      height: def.h,
      depth: def.d,
      rotation: def.rot,
      destructible: def.dest,
      hp: def.hp,
      maxHp: def.hp,
      alive: true,
    });
  });

  return buildings;
}
