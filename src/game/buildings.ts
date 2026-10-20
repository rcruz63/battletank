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
export function generateStageBuildings(stageNumber: number, seed?: number): VectorBuilding[] {
  const buildings: VectorBuilding[] = [];

  let allDefs: Array<{
    type: BuildingType;
    ox: number;
    oz: number;
    w: number;
    d: number;
    h: number;
    rot: number;
    dest: boolean;
    hp: number;
  }> = [];

  if (seed && seed !== 1980) {
    // Fully procedural tactical layout derived from seed
    let s = Math.abs(seed * 7919 + stageNumber * 997) % 2147483647;
    if (s <= 0) s += 2147483646;
    const rand = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };

    const numClusters = 4 + (stageNumber >= 2 ? 1 : 0) + (stageNumber >= 3 ? 1 : 0);
    const usedAngles: number[] = [];

    for (let c = 0; c < numClusters; c++) {
      const baseAngle = (c / numClusters) * Math.PI * 2 + (rand() - 0.5) * 0.5;
      const baseDist = 30 + rand() * 45;
      const cx = Math.cos(baseAngle) * baseDist;
      const cz = Math.sin(baseAngle) * baseDist;

      // Select cluster archetypes: Outpost, Hamlet, Checkpoint, or Ruins
      const clusterType = c % 4;

      if (clusterType === 0) {
        // Military Outpost: Bunker + Tower + 2 Houses
        allDefs.push(
          { type: 'bunker', ox: cx, oz: cz, w: 10 + rand() * 3, d: 9 + rand() * 3, h: 4.8, rot: rand() * Math.PI, dest: false, hp: 999 },
          { type: 'tower', ox: cx - 12 - rand() * 5, oz: cz + 8, w: 4.5, d: 4.5, h: 11.5, rot: 0, dest: true, hp: 80 },
          { type: 'house', ox: cx + 10 + rand() * 4, oz: cz - 8, w: 8, d: 8, h: 5.5, rot: rand() * 0.8, dest: true, hp: 60 },
          { type: 'house', ox: cx + 2, oz: cz + 14, w: 7, d: 9, h: 5.2, rot: rand() * 0.8, dest: true, hp: 60 }
        );
      } else if (clusterType === 1) {
        // Village / Hamlet: 3-4 destructible houses with tactical streets
        allDefs.push(
          { type: 'house', ox: cx - 8, oz: cz - 6, w: 8, d: 8, h: 5.8, rot: 0.3 + rand() * 0.4, dest: true, hp: 60 },
          { type: 'house', ox: cx + 9, oz: cz - 4, w: 8, d: 7, h: 5.4, rot: -0.2 + rand() * 0.4, dest: true, hp: 60 },
          { type: 'house', ox: cx - 3, oz: cz + 10, w: 9, d: 8, h: 5.5, rot: rand() * 0.6, dest: true, hp: 60 }
        );
        if (rand() > 0.4) {
          allDefs.push({ type: 'house', ox: cx + 12, oz: cz + 8, w: 7, d: 8, h: 5.0, rot: -0.5, dest: true, hp: 50 });
        }
      } else if (clusterType === 2) {
        // Mountain Pass Checkpoint: Heavy Bunker + Tower
        allDefs.push(
          { type: 'bunker', ox: cx, oz: cz, w: 11 + rand() * 2, d: 10 + rand() * 2, h: 5.0, rot: rand() * Math.PI, dest: false, hp: 999 },
          { type: 'tower', ox: cx + (rand() > 0.5 ? 12 : -12), oz: cz + (rand() > 0.5 ? 8 : -8), w: 4.2, d: 4.2, h: 11.0, rot: 0, dest: true, hp: 80 }
        );
      } else {
        // Tactical Valley Ruins near mid-range: cover for combat
        allDefs.push(
          { type: 'house', ox: cx, oz: cz, w: 7 + rand() * 2, d: 7 + rand() * 2, h: 5.0, rot: rand() * 0.8, dest: true, hp: 50 },
          { type: 'bunker', ox: cx + 12, oz: cz - 4, w: 9, d: 8, h: 4.4, rot: rand() * 0.6, dest: false, hp: 999 }
        );
      }
    }
  } else {
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

    allDefs = [...village1, ...village2, ...village3, ...centralRuins];

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
  }

  allDefs.forEach((def, idx) => {
    // Sample terrain at center and 4 corners to guarantee foundation never floats above lowest ground point
    const halfW = def.w / 2;
    const halfD = def.d / 2;
    const cos = Math.cos(def.rot);
    const sin = Math.sin(def.rot);

    // Rotated corner offsets
    const c1x = def.ox + (-halfW * cos - -halfD * sin);
    const c1z = def.oz + (-halfW * sin + -halfD * cos);
    const c2x = def.ox + (halfW * cos - -halfD * sin);
    const c2z = def.oz + (halfW * sin + -halfD * cos);
    const c3x = def.ox + (-halfW * cos - halfD * sin);
    const c3z = def.oz + (-halfW * sin + halfD * cos);
    const c4x = def.ox + (halfW * cos - halfD * sin);
    const c4z = def.oz + (halfW * sin + halfD * cos);

    const yCenter = getTerrainHeight(def.ox, def.oz);
    const y1 = getTerrainHeight(c1x, c1z);
    const y2 = getTerrainHeight(c2x, c2z);
    const y3 = getTerrainHeight(c3x, c3z);
    const y4 = getTerrainHeight(c4x, c4z);

    // Place building at the lowest corner so its base is completely grounded across all sides
    const y = Math.min(yCenter, y1, y2, y3, y4);

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
