import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';
import { seabedAtXZ } from '../Environment/CoastalTerrain';
import { clamp } from './marineLifeSimulation';

// ─────────────────────────────────────────────────────────────────────────────
// CRABS — 12 crabs crawling on the seabed
//
// Each crab = recognizable flat body + 4 "leg fan" meshes + front claws
// Viewed from the oblique overhead camera, the crab silhouette is visible.
//
// InstancedMesh breakdown (all 12 crabs):
//   body  (flat oval cylinder)            — 1 InstancedMesh
//   left legs  (4 thin boxes in fan)      — 1 InstancedMesh (fan geometry)
//   right legs (mirror)                   — 1 InstancedMesh
//   front claws (2 elongated boxes)       — 1 InstancedMesh
// = 4 draw calls for 12 crabs
// ─────────────────────────────────────────────────────────────────────────────

// ── Build crab-specific geometries ────────────────────────────────────────────

function makeCrabBodyGeo(): THREE.BufferGeometry {
  // Flat oval shell — wider than tall, slightly trapezoidal top-view
  const geo = new THREE.CylinderGeometry(0.55, 0.48, 0.22, 10);
  // Widen slightly in X for the crab's wider-than-deep shape
  geo.applyMatrix4(new THREE.Matrix4().makeScale(1.5, 1, 1));
  return geo;
}

function makeLegFanGeo(): THREE.BufferGeometry {
  // 4 thin elongated boxes fanned out (representing a crab's 4-leg side)
  // Each "arm" is a thin box at different angles, merged into one geometry
  const arms: THREE.BufferGeometry[] = [];
  const lmat = new THREE.Matrix4();
  for (let i = 0; i < 4; i++) {
    const angle = ((-0.6 + i * 0.4)) * 1; // spans roughly -0.6 to +0.6 rad
    const box = new THREE.BoxGeometry(0.08, 0.06, 0.70);
    // Pivot at one end (leg root at body), rotate around Y
    box.translate(0, 0, 0.35); // shift so pivot is at z=0
    lmat.makeRotationY(angle);
    box.applyMatrix4(lmat);
    arms.push(box);
  }
  // Merge the 4 arm boxes
  const merged = mergeGeo(arms);
  arms.forEach((g) => g.dispose());
  return merged;
}

function makeClawGeo(): THREE.BufferGeometry {
  // Two larger elongated boxes pointing forward
  const arms: THREE.BufferGeometry[] = [];
  const lmat = new THREE.Matrix4();
  const sides = [-0.4, 0.4] as const;
  for (const ang of sides) {
    const box = new THREE.BoxGeometry(0.12, 0.10, 0.55);
    box.translate(0, 0, 0.30);
    lmat.makeRotationY(ang);
    box.applyMatrix4(lmat);
    arms.push(box);
  }
  const merged = mergeGeo(arms);
  arms.forEach((g) => g.dispose());
  return merged;
}

// Simple geometry merge (copies position buffer data)
function mergeGeo(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  geos.forEach((g) => {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    totalVerts += pos.count;
  });
  const positions = new Float32Array(totalVerts * 3);
  let offset = 0;
  geos.forEach((g) => {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    positions.set(arr, offset);
    offset += arr.length;
  });
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  result.computeVertexNormals();
  return result;
}

// ── Crab state ─────────────────────────────────────────────────────────────────
interface CrabState {
  x: number; z: number; y: number;
  heading: number; speed: number;
  timer: number; moving: boolean;
}

const SPAWN_XZ: [number, number][] = [
  [-200, -500], [ 300, -600], [-500, -400], [ 450, -350],
  [-650, -700], [ 750, -800], [-320, -950], [ 500, -900],
  [-900, -550], [ 700, -450], [-150,-1100], [ 250,-1200],
];
const CRAB_COUNT = SPAWN_XZ.length; // 12

function makeCrab([spx, spz]: [number, number]): CrabState {
  return {
    x: spx, z: spz,
    y: seabedAtXZ(spx, spz) + 3,
    heading: Math.random() * Math.PI * 2,
    speed: 0, timer: Math.random() * 4,
    moving: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
export const Crab: FC = () => {
  const bodyGeo  = useMemo(makeCrabBodyGeo, []);
  const leftGeo  = useMemo(makeLegFanGeo, []);
  const rightGeo = useMemo(() => {
    const g = makeLegFanGeo();
    g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
    return g;
  }, []);
  const clawGeo  = useMemo(makeClawGeo, []);

  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a3a1c', roughness: 0.85 }), []);
  const legMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8c4020', roughness: 0.85 }), []);
  const clawMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9a4818', roughness: 0.80 }), []);

  const bodyRef  = useRef<THREE.InstancedMesh>(null);
  const leftRef  = useRef<THREE.InstancedMesh>(null);
  const rightRef = useRef<THREE.InstancedMesh>(null);
  const clawRef  = useRef<THREE.InstancedMesh>(null);
  const dummy    = useMemo(() => new THREE.Object3D(), []);

  const crabs = useRef<CrabState[]>(SPAWN_XZ.map(makeCrab));

  useFrame((_, delta) => {
    const br = bodyRef.current;
    const lr = leftRef.current;
    const rr = rightRef.current;
    const cr = clawRef.current;
    if (!br || !lr || !rr || !cr) return;
    const dt = clamp(delta, 0, 0.05);

    for (let i = 0; i < CRAB_COUNT; i++) {
      const c = crabs.current[i];
      c.timer -= dt;

      if (c.timer <= 0) {
        c.moving = !c.moving;
        if (c.moving) {
          c.heading += (Math.random() - 0.5) * Math.PI * 0.9;
          c.speed = 4 + Math.random() * 6;
          c.timer = 3 + Math.random() * 7;
        } else {
          c.speed = 0;
          c.timer = 2 + Math.random() * 4;
        }
      }

      if (c.moving) {
        c.x = Math.max(-1000, Math.min(1000, c.x + Math.sin(c.heading) * c.speed * dt));
        c.z = Math.max(-1000, Math.min(1000, c.z + Math.cos(c.heading) * c.speed * dt));
        c.y = seabedAtXZ(c.x, c.z) + 3;
      }

      const SCALE = 16; // visible from camera distance

      // Body (flat oval shell)
      dummy.position.set(c.x, c.y, c.z);
      dummy.rotation.set(0, c.heading, 0);
      dummy.scale.set(SCALE, SCALE, SCALE);
      dummy.updateMatrix();
      br.setMatrixAt(i, dummy.matrix);

      // Left legs (fan spreading to the left side)
      dummy.position.set(c.x - Math.cos(c.heading) * SCALE * 0.20, c.y, c.z + Math.sin(c.heading) * SCALE * 0.20);
      dummy.rotation.set(0, c.heading + Math.PI * 0.5, 0); // perpendicular to body
      dummy.scale.set(SCALE, SCALE * 0.5, SCALE);
      dummy.updateMatrix();
      lr.setMatrixAt(i, dummy.matrix);

      // Right legs (mirror side)
      dummy.position.set(c.x + Math.cos(c.heading) * SCALE * 0.20, c.y, c.z - Math.sin(c.heading) * SCALE * 0.20);
      dummy.rotation.set(0, c.heading - Math.PI * 0.5, 0);
      dummy.scale.set(SCALE, SCALE * 0.5, SCALE);
      dummy.updateMatrix();
      rr.setMatrixAt(i, dummy.matrix);

      // Front claws (larger fan pointing forward)
      const sinH = Math.sin(c.heading); const cosH = Math.cos(c.heading);
      dummy.position.set(
        c.x + sinH * SCALE * 0.55,
        c.y + SCALE * 0.04,
        c.z + cosH * SCALE * 0.55,
      );
      dummy.rotation.set(0, c.heading, 0);
      dummy.scale.set(SCALE * 1.4, SCALE * 0.8, SCALE * 1.1);
      dummy.updateMatrix();
      cr.setMatrixAt(i, dummy.matrix);
    }

    br.instanceMatrix.needsUpdate = true;
    lr.instanceMatrix.needsUpdate = true;
    rr.instanceMatrix.needsUpdate = true;
    cr.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodyRef}  args={[bodyGeo,  bodyMat, CRAB_COUNT]} frustumCulled={false} />
      <instancedMesh ref={leftRef}  args={[leftGeo,  legMat,  CRAB_COUNT]} frustumCulled={false} />
      <instancedMesh ref={rightRef} args={[rightGeo, legMat,  CRAB_COUNT]} frustumCulled={false} />
      <instancedMesh ref={clawRef}  args={[clawGeo,  clawMat, CRAB_COUNT]} frustumCulled={false} />
    </group>
  );
};
