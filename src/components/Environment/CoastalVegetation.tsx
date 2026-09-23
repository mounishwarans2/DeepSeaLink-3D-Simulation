import { useEffect, useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';
import { coastlineMask, unifiedTerrainHeight } from './CoastalTerrain';

// ─────────────────────────────────────────────────────────────────────────────
// COASTAL VEGETATION — sparse trees and bushes on land areas
//
// Placed ONLY on confirmed land territory (mask > 0.45, Y > 155).
// NOT a forest — sparse coverage suitable for a scientific coastal simulation.
//
// Three placement zones (mirrors the three land sides):
//   West land:  X [-13500, -6800],  Z [-8000, 8500]
//   East land:  X [ 6800,  13500],  Z [-8000, 8500]
//   North land: X [-5800,   5800],  Z [ 8200, 14500]
//
// Vegetation types:
//   Tall trees   — ConeGeometry, 3 shades of dark green, height 30–65 units
//   Round bushes — SphereGeometry, medium greens, radius 8–18 units
//   Small shrubs — OctahedronGeometry, muted greens, tiny clusters
// ─────────────────────────────────────────────────────────────────────────────

const TREE_COUNT  = 340;
const BUSH_COUNT  = 240;
const SHRUB_COUNT = 190;

// Land placement zones — U-shape coast: land on NORTH + EAST + WEST
// mask_min check in sampleLandPoint() automatically filters ocean-side samples.
const ZONES = [
  { xMin: -6000, xMax:  6000, zMin:  5500, zMax: 13000 },  // North land (beyond north coast)
  { xMin:  4500, xMax: 13000, zMin: -3500, zMax:  5000 },  // East arm land strip
  { xMin:-13000, xMax: -4500, zMin: -3500, zMax:  5000 },  // West arm land strip
  { xMin: -8000, xMax:  8000, zMin:  7000, zMax: 13000 },  // Far north interior
];

// Sample a random point in land zones; return [x, y, z] or null if not on land
function sampleLandPoint(mask_min: number, y_min: number, y_max: number): [number, number, number] | null {
  const zone = ZONES[Math.floor(Math.random() * ZONES.length)];
  const x = zone.xMin + Math.random() * (zone.xMax - zone.xMin);
  const z = zone.zMin + Math.random() * (zone.zMax - zone.zMin);
  const mask = coastlineMask(x, z);
  if (mask < mask_min) return null;
  const y = unifiedTerrainHeight(x, z);
  if (y < y_min || y > y_max) return null;
  return [x, y, z];
}

// ─────────────────────────────────────────────────────────────────────────────
// TALL TREES — ConeGeometry (conifer silhouette)
// ─────────────────────────────────────────────────────────────────────────────
const TreeLayer: FC<{ count: number }> = ({ count }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const applied = useRef(false);

  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D();
    const mats: THREE.Matrix4[] = [];
    let attempts = 0;
    while (mats.length < count && attempts < count * 10) {
      attempts++;
      // Trees prefer moderate elevation: 360 – 820 (above beach, below rocky peaks)
      const pt = sampleLandPoint(0.48, 400, 740);
      if (!pt) continue;
      const [x, y, z] = pt;
      const h = 28 + Math.random() * 40;  // tree height 28–68 world units
      const r =  5 + Math.random() * 7;   // cone radius  5–12 world units
      // Position cone base at terrain surface: center at y + h/2, base at y
      dummy.position.set(x, y + h * 0.5, z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.scale.set(r, h, r);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
    return mats;
  }, [count]);

  useEffect(() => {
    if (applied.current || !meshRef.current) return;
    matrices.forEach((m, i) => meshRef.current!.setMatrixAt(i, m));
    meshRef.current.instanceMatrix.needsUpdate = true;
    applied.current = true;
  }, [matrices]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      {/* 6-sided cone — readable at distance without being too smooth */}
      <coneGeometry args={[1, 1, 6]} />
      <meshStandardMaterial
        color="#2A5018"
        roughness={0.92}
        metalness={0.0}
      />
    </instancedMesh>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ROUND BUSHES — SphereGeometry (low coastal scrub / broadleaf shrubs)
// ─────────────────────────────────────────────────────────────────────────────
const BushLayer: FC<{ count: number }> = ({ count }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const applied = useRef(false);

  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D();
    const mats: THREE.Matrix4[] = [];
    let attempts = 0;
    while (mats.length < count && attempts < count * 10) {
      attempts++;
      // Bushes prefer coastal/lower land: 330 – 680
      const pt = sampleLandPoint(0.40, 360, 680);
      if (!pt) continue;
      const [x, y, z] = pt;
      const ry = 7 + Math.random() * 11;  // vertical radius 7–18
      const rx = ry * (0.9 + Math.random() * 0.6); // slightly irregular
      const rz = ry * (0.9 + Math.random() * 0.5);
      // Place bottom of sphere at terrain surface
      dummy.position.set(x, y + ry, z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.scale.set(rx, ry, rz);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
    return mats;
  }, [count]);

  useEffect(() => {
    if (applied.current || !meshRef.current) return;
    matrices.forEach((m, i) => meshRef.current!.setMatrixAt(i, m));
    meshRef.current.instanceMatrix.needsUpdate = true;
    applied.current = true;
  }, [matrices]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 6, 5]} />
      <meshStandardMaterial
        color="#3E6E22"
        roughness={0.90}
        metalness={0.0}
      />
    </instancedMesh>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SMALL SHRUBS — OctahedronGeometry (rocky/scrubby inland transition)
// ─────────────────────────────────────────────────────────────────────────────
const ShrubLayer: FC<{ count: number }> = ({ count }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const applied = useRef(false);

  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D();
    const mats: THREE.Matrix4[] = [];
    let attempts = 0;
    while (mats.length < count && attempts < count * 10) {
      attempts++;
      // Shrubs grow anywhere on land: 330 – 900
      const pt = sampleLandPoint(0.38, 360, 760);
      if (!pt) continue;
      const [x, y, z] = pt;
      const s  = 4 + Math.random() * 9;   // size 4–13
      const sy = s * (0.55 + Math.random() * 0.35);
      dummy.position.set(x, y + sy * 0.5, z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.scale.set(s * (0.8 + Math.random() * 0.4), sy, s * (0.8 + Math.random() * 0.4));
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
    return mats;
  }, [count]);

  useEffect(() => {
    if (applied.current || !meshRef.current) return;
    matrices.forEach((m, i) => meshRef.current!.setMatrixAt(i, m));
    meshRef.current.instanceMatrix.needsUpdate = true;
    applied.current = true;
  }, [matrices]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      frustumCulled={false}
    >
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#506030"
        roughness={0.94}
        metalness={0.0}
      />
    </instancedMesh>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export const CoastalVegetation: FC = () => (
  <group name="coastal-vegetation">
    <TreeLayer  count={TREE_COUNT}  />
    <BushLayer  count={BUSH_COUNT}  />
    <ShrubLayer count={SHRUB_COUNT} />
  </group>
);
