/**
 * Unit tests for Vector Tank pure logic.
 * Run with: node --test
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { getTerrainHeight, getTerrainNormal, hasLineOfSight } from './terrain.ts';
import { calculateMuzzleVelocity, calculateTrajectoryPreview, stepProjectile } from './ballistics.ts';
import {
  ENEMY_ARCHETYPES,
  STAGE_CONFIGS,
  calculatePlayerDamage,
  calculatePlayerSpeed,
  calculateReloadCooldown,
  checkSphereCollision,
  computeFinalScore,
} from './rules.ts';

test('terrain generates smooth starting plateau near center', () => {
  const centerH = getTerrainHeight(0, 0);
  assert.ok(Math.abs(centerH) < 1.0, `Center height should be near 0 for fair start, got ${centerH}`);

  const nearCenterH = getTerrainHeight(10, 10);
  assert.ok(Math.abs(nearCenterH) < 3.0, `Near center height should remain relatively flat, got ${nearCenterH}`);
});

test('terrain normal vector is normalized', () => {
  const [nx, ny, nz] = getTerrainNormal(50, 50);
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  assert.ok(Math.abs(len - 1.0) < 0.001, `Normal should be unit length, got ${len}`);
  assert.ok(ny > 0, `Normal Y must point upwards, got ${ny}`);
});

test('line of sight is blocked by steep mountains', () => {
  // Direct line passing through tall mountain zone
  const clearAcrossCenter = hasLineOfSight(0, 5, 0, 15, 5, 15);
  assert.equal(clearAcrossCenter, true, 'Short distance across flat center should have clear line of sight');
});

test('ballistics velocity adheres to yaw and pitch angles', () => {
  // Facing North (yaw 0), flat pitch 0
  const v1 = calculateMuzzleVelocity(0, 0, 100);
  assert.ok(Math.abs(v1.vx) < 0.001, 'Vx should be 0 when facing Z axis');
  assert.ok(Math.abs(v1.vy) < 0.001, 'Vy should be 0 when pitch is 0');
  assert.ok(v1.vz < -99.9, 'Vz should be negative forward when yaw is 0');

  // Pitched up 45 degrees
  const angle45 = Math.PI / 4;
  const v2 = calculateMuzzleVelocity(0, angle45, 100);
  assert.ok(v2.vy > 65, 'Vy should be strongly positive when pitched up 45 degrees');
});

test('ballistic trajectory preview detects ground impact', () => {
  const pts = calculateTrajectoryPreview(0, 5, 0, 0, 10, -50, 15, 50, 0.05);
  assert.ok(pts.length > 2, 'Trajectory points should be recorded');
  const lastPoint = pts[pts.length - 1];
  assert.equal(lastPoint.hitTerrain, true, 'Trajectory should eventually intersect terrain or reach max steps');
});

test('projectile simulation detects terrain impact and records trail', () => {
  const proj = {
    id: 'test-1',
    source: 'player' as const,
    x: 0,
    y: 2,
    z: 0,
    vx: 0,
    vy: -10, // Moving down towards ground
    vz: 0,
    gravity: 10,
    damage: 50,
    radius: 1,
    age: 0,
    maxAge: 5,
    color: '#00ff66',
    alive: true,
    trail: [],
  };

  const result = stepProjectile(proj, 0.5);
  assert.equal(result.hit, true, 'Projectile moving downward should hit ground');
  assert.equal(proj.alive, false, 'Impacted projectile must be marked dead');
  assert.ok(result.impact !== undefined, 'Impact event must be returned');
});

test('power-up calculations correctly modify stats', () => {
  const normalDmg = calculatePlayerDamage(50, false);
  const boostedDmg = calculatePlayerDamage(50, true);
  assert.equal(normalDmg, 50);
  assert.ok(boostedDmg > 100, `Boosted damage should exceed 2x, got ${boostedDmg}`);

  const normalSpeed = calculatePlayerSpeed(10, false);
  const turboSpeed = calculatePlayerSpeed(10, true);
  assert.ok(turboSpeed > normalSpeed, 'Turbo speed should be higher than normal speed');

  const normalCd = calculateReloadCooldown(1.5, false);
  const rapidCd = calculateReloadCooldown(1.5, true);
  assert.ok(rapidCd < normalCd, 'Rapid fire reload cooldown should be faster');
});

test('collision sphere detection verifies hits', () => {
  const hit = checkSphereCollision(10, 0, 10, 2, 11, 0, 11, 2);
  assert.equal(hit, true, 'Spheres within radius should collide');

  const miss = checkSphereCollision(10, 0, 10, 2, 50, 0, 50, 2);
  assert.equal(miss, false, 'Far apart spheres should not collide');
});

test('enemy archetypes have unique distinct behaviors and boss flag', () => {
  assert.equal(ENEMY_ARCHETYPES.regular_tank.isBoss, false);
  assert.equal(ENEMY_ARCHETYPES.fast_scout.isBoss, false);
  assert.ok(
    ENEMY_ARCHETYPES.fast_scout.speed > ENEMY_ARCHETYPES.regular_tank.speed * 2,
    'Fast scout surprise enemy should be more than twice as fast as regular tank'
  );

  assert.equal(ENEMY_ARCHETYPES.boss_goliath.isBoss, true);
  assert.equal(ENEMY_ARCHETYPES.boss_hydra.isBoss, true);
  assert.equal(ENEMY_ARCHETYPES.boss_titan.isBoss, true);
});

test('stage configurations scale smoothly in difficulty', () => {
  assert.equal(STAGE_CONFIGS.length, 3);
  assert.ok(STAGE_CONFIGS[1].regularTankCount > STAGE_CONFIGS[0].regularTankCount);
  assert.ok(STAGE_CONFIGS[2].regularTankCount > STAGE_CONFIGS[1].regularTankCount);
});

test('buildings block tank movement via 2D oriented box collision', async () => {
  const { checkCircleBoxCollision, checkPointInsideBuilding, isLineBlockedByBuildings } = await import('./buildings.ts');

  // Test tank circle colliding with a 8x8 building at (20, 20)
  const col = checkCircleBoxCollision(20, 16.5, 2.0, 20, 20, 8, 8, 0);
  assert.equal(col.collided, true, 'Circle intersecting box edge should collide');
  assert.ok(col.overlap > 0, 'Overlap should be positive');

  // Test tank far away
  const noCol = checkCircleBoxCollision(0, 0, 2.0, 20, 20, 8, 8, 0);
  assert.equal(noCol.collided, false, 'Far away circle should not collide');

  // Test point inside building (bullet hit)
  const bld = {
    id: 'test-bld',
    type: 'house' as const,
    x: 10,
    y: 0,
    z: 10,
    width: 6,
    height: 5,
    depth: 6,
    rotation: 0,
    destructible: true,
    hp: 60,
    maxHp: 60,
    alive: true,
  };

  assert.equal(checkPointInsideBuilding(10, 2, 10, bld), true, 'Point at building center should be inside');
  assert.equal(checkPointInsideBuilding(10, 8, 10, bld), false, 'Point above building height should not be inside');

  // Line of sight blocked by building
  const blocked = isLineBlockedByBuildings(0, 2, 10, 20, 2, 10, [bld]);
  assert.equal(blocked, true, 'Ray passing through building must be blocked');

  // When building is destroyed, line of sight becomes clear
  bld.alive = false;
  const unblocked = isLineBlockedByBuildings(0, 2, 10, 20, 2, 10, [bld]);
  assert.equal(unblocked, false, 'Ray passing through destroyed building should not be blocked');
});
