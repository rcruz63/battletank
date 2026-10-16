/**
 * Ballistic projectile trajectory and collision physics.
 * Realistic gravity arc, visible tracer, and impact detection.
 */

import { getTerrainHeight } from './terrain.ts';

export interface BallisticProjectile {
  id: string;
  source: 'player' | 'enemy' | 'boss';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  damage: number;
  radius: number;
  age: number;
  maxAge: number;
  color: string;
  alive: boolean;
  trail: Array<{ x: number; y: number; z: number }>;
}

export interface ImpactEvent {
  x: number;
  y: number;
  z: number;
  type: 'terrain' | 'tank' | 'shield';
  damage: number;
  radius: number;
  source: 'player' | 'enemy' | 'boss';
}

export const GRAVITY_DEFAULT = 16.5; // Realistic arcade gravity for arched artillery shots
export const CANNON_MUZZLE_VELOCITY = 68.0; // Fast yet visibly arching shell speed

/**
 * Calculates initial 3D velocity vector given turret yaw (azimuth) and gun pitch (elevation).
 * Yaw 0 = facing negative Z (Three.js standard).
 * Pitch > 0 = elevating barrel upwards into sky.
 */
export function calculateMuzzleVelocity(
  yaw: number,
  pitch: number,
  speed: number = CANNON_MUZZLE_VELOCITY
): { vx: number; vy: number; vz: number } {
  // yaw: horizontal angle in radians
  // pitch: elevation angle in radians (positive = pointing up)
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);

  const vx = -Math.sin(yaw) * cosPitch * speed;
  const vy = sinPitch * speed;
  const vz = -Math.cos(yaw) * cosPitch * speed;

  return { vx, vy, vz };
}

/**
 * Computes predicted ballistic trajectory points for aim aids or trajectory tracer.
 */
export function calculateTrajectoryPreview(
  startX: number,
  startY: number,
  startZ: number,
  vx: number,
  vy: number,
  vz: number,
  gravity = GRAVITY_DEFAULT,
  maxSteps = 40,
  dt = 0.04
): Array<{ x: number; y: number; z: number; hitTerrain: boolean }> {
  const points: Array<{ x: number; y: number; z: number; hitTerrain: boolean }> = [];
  let cx = startX;
  let cy = startY;
  let cz = startZ;
  let cvy = vy;

  points.push({ x: cx, y: cy, z: cz, hitTerrain: false });

  for (let i = 0; i < maxSteps; i++) {
    cx += vx * dt;
    cy += cvy * dt;
    cz += vz * dt;
    cvy -= gravity * dt;

    const terrainH = getTerrainHeight(cx, cz);
    if (cy <= terrainH) {
      points.push({ x: cx, y: terrainH, z: cz, hitTerrain: true });
      break;
    }

    points.push({ x: cx, y: cy, z: cz, hitTerrain: false });
  }

  return points;
}

/**
 * Step projectile forward by dt and check terrain impact.
 */
export function stepProjectile(
  proj: BallisticProjectile,
  dt: number
): { hit: boolean; impact?: ImpactEvent } {
  if (!proj.alive) return { hit: false };

  proj.age += dt;
  if (proj.age > proj.maxAge) {
    proj.alive = false;
    return { hit: false };
  }

  // Record trail point
  if (proj.trail.length > 8) {
    proj.trail.shift();
  }
  proj.trail.push({ x: proj.x, y: proj.y, z: proj.z });

  // Physics step
  proj.x += proj.vx * dt;
  proj.y += proj.vy * dt;
  proj.z += proj.vz * dt;
  proj.vy -= proj.gravity * dt;

  // Collision with ground terrain
  const groundY = getTerrainHeight(proj.x, proj.z);
  if (proj.y <= groundY) {
    proj.alive = false;
    return {
      hit: true,
      impact: {
        x: proj.x,
        y: groundY,
        z: proj.z,
        type: 'terrain',
        damage: proj.damage,
        radius: 4.5,
        source: proj.source,
      },
    };
  }

  return { hit: false };
}
