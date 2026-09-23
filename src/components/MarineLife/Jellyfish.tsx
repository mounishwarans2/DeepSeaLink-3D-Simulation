import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';
import { clamp } from './marineLifeSimulation';

// ─────────────────────────────────────────────────────────────────────────────
// JELLYFISH — 12 translucent jellyfish drifting at different depths
//
// Each jellyfish = bell (LatheGeometry dome) + 6 tentacles (thin cylinders)
// Bell pulses by squishing Y scale. Tentacles trail below.
//
// InstancedMesh for bells (1 draw call)
// InstancedMesh for tentacles (1 draw call, 12 × 6 = 72 instances)
// ─────────────────────────────────────────────────────────────────────────────

function makeJellybellGeo(): THREE.BufferGeometry {
  // Dome profile: LatheGeometry rotated around Y
  // Top of dome at y=+0.8, opens at bottom (y=-0.2), flared rim
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.00,  0.80), // top center
    new THREE.Vector2(0.20,  0.75), // near top
    new THREE.Vector2(0.45,  0.55), // upper dome
    new THREE.Vector2(0.68,  0.25), // mid dome
    new THREE.Vector2(0.80, -0.02), // widest (equator)
    new THREE.Vector2(0.76, -0.18), // underside flare
    new THREE.Vector2(0.55, -0.28), // rim
    new THREE.Vector2(0.35, -0.30), // inner bell edge
    new THREE.Vector2(0.00, -0.28), // center opening
  ];
  const geo = new THREE.LatheGeometry(pts, 10);
  return geo; // stays in Y-up orientation (bell top = +Y)
}

function makeTentacleGeo(): THREE.BufferGeometry {
  // Single thin cylinder (long, narrow)
  return new THREE.CylinderGeometry(0.018, 0.006, 1.0, 4, 1);
}

// ── Spawn positions ────────────────────────────────────────────────────────────
const COUNT = 12;
const TENTACLE_PER = 6;
const TOTAL_TENT = COUNT * TENTACLE_PER;

interface JellyState {
  x: number; y: number; z: number;
  driftX: number; driftZ: number;
  phase: number; scale: number;
  tentPhases: number[];
}

// Seed deterministic spawn positions across ocean
function seedJellyfish(): JellyState[] {
  return [
    { x: -280, y:  -30, z: -350, driftX:  1.2, driftZ:  0.8, phase: 0.0, scale: 18, tentPhases: Array.from({length: TENTACLE_PER}, (_, i) => i * 0.5) },
    { x:  350, y:  -45, z:  280, driftX: -0.8, driftZ:  1.0, phase: 0.7, scale: 22, tentPhases: Array.from({length: TENTACLE_PER}, (_, i) => i * 0.5 + 0.3) },
    { x: -550, y:  -65, z: -600, driftX:  0.6, driftZ: -1.2, phase: 1.4, scale: 16, tentPhases: Array.from({length: TENTACLE_PER}, (_, i) => i * 0.5 + 0.7) },
    { x:  480, y:  -80, z:  550, driftX: -1.0, driftZ: -0.6, phase: 2.1, scale: 20, tentPhases: Array.from({length: TENTACLE_PER}, (_, i) => i * 0.5 + 1.0) },
    { x: -120, y: -120, z: -820, driftX:  1.4, driftZ:  0.4, phase: 2.8, scale: 14, tentPhases: Array.from({length: TENTACLE_PER}, (_, i) => i * 0.5 + 1.4) },
    { x:  700, y: -140, z: -200, driftX: -0.5, driftZ:  1.3, phase: 3.5, scale: 24, tentPhases: Array.from({length: TENTACLE_PER}, (_, i) => i * 0.5 + 1.8) },
    { x: -400, y:  -35, z:  700, driftX:  0.9, driftZ: -0.7, phase: 0.4, scale: 19, tentPhases: Array.from({length: TENTACLE_PER}, (_, i) => i * 0.5 + 2.1) },
    { x:  200, y:  -55, z: -450, driftX: -1.1, driftZ:  0.5, phase: 1.1, scale: 21, tentPhases: Array.from({length: TENTACLE_PER}, (_, i) => i * 0.5 + 2.5) },
    { x: -700, y: -100, z:  350, driftX:  0.7, driftZ: -1.0, phase: 1.8, scale: 17, tentPhases: Array.from({length: TENTACLE_PER}, (_, i) => i * 0.5 + 2.9) },
    { x:  550, y:  -75, z: -700, driftX: -0.9, driftZ:  0.8, phase: 2.5, scale: 23, tentPhases: Array.from({length: TENTACLE_PER}, (_, i) => i * 0.5 + 3.2) },
    { x: -200, y:  -48, z:  920, driftX:  1.1, driftZ: -0.5, phase: 3.2, scale: 15, tentPhases: Array.from({length: TENTACLE_PER}, (_, i) => i * 0.5 + 3.6) },
    { x:  350, y: -155, z: -950, driftX: -0.6, driftZ: -1.1, phase: 3.9, scale: 20, tentPhases: Array.from({length: TENTACLE_PER}, (_, i) => i * 0.5 + 4.0) },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
export const Jellyfish: FC = () => {
  const bellGeo    = useMemo(makeJellybellGeo, []);
  const tentacleGeo = useMemo(makeTentacleGeo, []);

  const bellMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: '#6688cc',
    emissive: '#223366',
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.55,
    shininess: 80,
    side: THREE.DoubleSide,
  }), []);

  const tentMat = useMemo(() => new THREE.MeshPhongMaterial({
    color: '#8899dd',
    emissive: '#334477',
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.45,
  }), []);

  const bellRef = useRef<THREE.InstancedMesh>(null);
  const tentRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);

  const jellies = useRef<JellyState[]>(seedJellyfish());

  useFrame((state, delta) => {
    const br = bellRef.current;
    const tr = tentRef.current;
    if (!br || !tr) return;

    const t  = state.clock.getElapsedTime();
    const dt = clamp(delta, 0, 0.05);

    for (let i = 0; i < COUNT; i++) {
      const j = jellies.current[i];

      // Slow horizontal drift
      j.x += j.driftX * dt;
      j.z += j.driftZ * dt;

      // Wrap bounds
      if (j.x >  1200) { j.x = -1200; }
      if (j.x < -1200) { j.x =  1200; }
      if (j.z >  1200) { j.z = -1200; }
      if (j.z < -1200) { j.z =  1200; }

      // Gentle vertical bob
      const bob    = Math.sin(t * 0.40 + j.phase) * 8;
      // Bell pulsing (Y scale squishes and expands)
      const pulse  = 0.8 + Math.abs(Math.sin(t * 1.2 + j.phase)) * 0.4;
      const bellY  = j.y + bob;

      // Bell matrix
      dummy.position.set(j.x, bellY, j.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(j.scale, j.scale * pulse, j.scale);
      dummy.updateMatrix();
      br.setMatrixAt(i, dummy.matrix);

      // Tentacles hang below bell rim
      const rimRadius = j.scale * 0.80;
      const tentLen   = j.scale * 2.2;
      const tentY     = bellY - j.scale * 0.28 - tentLen * 0.5;

      for (let k = 0; k < TENTACLE_PER; k++) {
        const angle = (k / TENTACLE_PER) * Math.PI * 2;
        const tx    = j.x + Math.cos(angle) * rimRadius;
        const tz    = j.z + Math.sin(angle) * rimRadius;
        const ty    = tentY + Math.sin(t * 1.6 + j.tentPhases[k]) * j.scale * 0.15;
        const tilt  = Math.sin(t * 0.8  + j.tentPhases[k]) * 0.12;

        dummy.position.set(tx, ty, tz);
        dummy.rotation.set(tilt, 0, 0);
        dummy.scale.set(j.scale * 0.6, tentLen, j.scale * 0.6);
        dummy.updateMatrix();
        tr.setMatrixAt(i * TENTACLE_PER + k, dummy.matrix);
      }
    }

    br.instanceMatrix.needsUpdate = true;
    tr.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bellRef} args={[bellGeo,     bellMat, COUNT]}      frustumCulled={false} />
      <instancedMesh ref={tentRef} args={[tentacleGeo, tentMat, TOTAL_TENT]} frustumCulled={false} />
    </group>
  );
};
