/**
 * Procedural Vector Arcade Terrain and Horizon Environment.
 * Battlezone wireframe aesthetic with undulating hills, contour rings, and vector horizon.
 */

import * as THREE from 'three';
import { getTerrainHeight, DEFAULT_TERRAIN_CONFIG } from './terrain.ts';
import { VECTOR_COLORS } from './vectorModels.ts';

export function createVectorTerrain(): {
  terrainGroup: THREE.Group;
  updateVisibleZone: (centerX: number, centerZ: number) => void;
} {
  const terrainGroup = new THREE.Group();

  const size = DEFAULT_TERRAIN_CONFIG.size; // 600 units
  const segments = DEFAULT_TERRAIN_CONFIG.segments; // 80x80 grid lines

  // 1. Primary Wireframe Ground Grid
  const planeGeo = new THREE.PlaneGeometry(size, size, segments, segments);
  planeGeo.rotateX(-Math.PI / 2);

  const posAttr = planeGeo.attributes.position;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const z = posAttr.getZ(i);
    const y = getTerrainHeight(x, z);
    posAttr.setY(i, y);
  }
  planeGeo.computeVertexNormals();

  const wireGeo = new THREE.WireframeGeometry(planeGeo);
  const wireMat = new THREE.LineBasicMaterial({
    color: VECTOR_COLORS.terrainWire,
    transparent: true,
    opacity: 0.85,
    depthTest: true,
  });
  const wireMesh = new THREE.LineSegments(wireGeo, wireMat);
  terrainGroup.add(wireMesh);

  // 2. Tactical Vector Grid Crosses at major coordinate intervals (every 25m)
  const crossGeo = new THREE.BufferGeometry();
  const crossVerts: number[] = [];
  const spacing = 30;
  const extent = size * 0.45;

  for (let x = -extent; x <= extent; x += spacing) {
    for (let z = -extent; z <= extent; z += spacing) {
      const y = getTerrainHeight(x, z) + 0.15;
      const s = 1.2;
      // X line
      crossVerts.push(x - s, y, z, x + s, y, z);
      // Z line
      crossVerts.push(x, y, z - s, x, y, z + s);
    }
  }

  crossGeo.setAttribute('position', new THREE.Float32BufferAttribute(crossVerts, 3));
  const crossMat = new THREE.LineBasicMaterial({
    color: 0x00aa33,
    transparent: true,
    opacity: 0.7,
  });
  const crossMarkers = new THREE.LineSegments(crossGeo, crossMat);
  terrainGroup.add(crossMarkers);

  // 3. Horizon Vector Backdrop: Distant polygonal vector mountains / volcano ridge
  const horizonRidgeGroup = new THREE.Group();
  const ridgeRadius = size * 0.48;
  const ridgePoints: number[] = [];
  const segmentsHorizon = 48;

  for (let i = 0; i < segmentsHorizon; i++) {
    const angle1 = (i / segmentsHorizon) * Math.PI * 2;
    const angle2 = ((i + 1) / segmentsHorizon) * Math.PI * 2;

    const x1 = Math.cos(angle1) * ridgeRadius;
    const z1 = Math.sin(angle1) * ridgeRadius;
    const h1 = getTerrainHeight(x1, z1) + 12 + Math.sin(i * 1.5) * 8;

    const x2 = Math.cos(angle2) * ridgeRadius;
    const z2 = Math.sin(angle2) * ridgeRadius;
    const h2 = getTerrainHeight(x2, z2) + 12 + Math.sin((i + 1) * 1.5) * 8;

    // Peak lines
    ridgePoints.push(x1, 0, z1, x1, h1, z1);
    ridgePoints.push(x1, h1, z1, x2, h2, z2);
  }

  const ridgeGeo = new THREE.BufferGeometry();
  ridgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(ridgePoints, 3));
  const ridgeLine = new THREE.LineSegments(
    ridgeGeo,
    new THREE.LineBasicMaterial({ color: 0x004418, transparent: true, opacity: 0.5 })
  );
  horizonRidgeGroup.add(ridgeLine);
  terrainGroup.add(horizonRidgeGroup);

  // 4. Retro Vector Celestial Sun / Moon on horizon
  const sunRadius = 26;
  const sunGeo = new THREE.BufferGeometry();
  const sunVerts: number[] = [];
  const sunSlices = 16;
  const sunAngle = -Math.PI * 0.25;
  const sunDist = size * 0.46;
  const sunX = Math.cos(sunAngle) * sunDist;
  const sunZ = Math.sin(sunAngle) * sunDist;
  const sunY = 55;

  for (let i = 0; i < sunSlices; i++) {
    const a1 = (i / sunSlices) * Math.PI * 2;
    const a2 = ((i + 1) / sunSlices) * Math.PI * 2;
    sunVerts.push(
      sunX + Math.cos(a1) * sunRadius,
      sunY + Math.sin(a1) * sunRadius,
      sunZ,
      sunX + Math.cos(a2) * sunRadius,
      sunY + Math.sin(a2) * sunRadius,
      sunZ
    );
  }
  // Internal sun lines
  for (let i = -3; i <= 3; i++) {
    const yOff = (i / 4) * sunRadius * 0.8;
    const span = Math.sqrt(Math.max(0, sunRadius * sunRadius - yOff * yOff));
    sunVerts.push(sunX - span, sunY + yOff, sunZ, sunX + span, sunY + yOff, sunZ);
  }

  sunGeo.setAttribute('position', new THREE.Float32BufferAttribute(sunVerts, 3));
  const sunLine = new THREE.LineSegments(
    sunGeo,
    new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.85 })
  );
  terrainGroup.add(sunLine);

  return {
    terrainGroup,
    updateVisibleZone: (_centerX: number, _centerZ: number) => {
      // Dynamic updates if needed
    },
  };
}
