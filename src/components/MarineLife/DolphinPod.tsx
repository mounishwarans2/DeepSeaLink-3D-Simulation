import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';
import { clamp } from './marineLifeSimulation';

// ─────────────────────────────────────────────────────────────────────────────
// DOLPHIN POD — 2 pods × 3 dolphins each = 6 dolphins
// Upper water (Y ≈ +40 to +80, just below surface)
//
// Key visual identifier: HORIZONTAL FLUKE (not vertical fish tail)
// Body has distinct narrow beak/rostrum
// Smooth independent pod movement, no glitching
// ─────────────────────────────────────────────────────────────────────────────

function makeDolphinBodyGeo(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.00, -1.00), // beak tip
    new THREE.Vector2(0.05, -0.90),
    new THREE.Vector2(0.07, -0.80), // beak base
    new THREE.Vector2(0.20, -0.65),
    new THREE.Vector2(0.38, -0.38),
    new THREE.Vector2(0.48, -0.08),
    new THREE.Vector2(0.48,  0.12),
    new THREE.Vector2(0.42,  0.36),
    new THREE.Vector2(0.30,  0.58),
    new THREE.Vector2(0.16,  0.76),
    new THREE.Vector2(0.04,  0.88),
    new THREE.Vector2(0.00,  0.95),
  ];
  const geo = new THREE.LatheGeometry(pts, 8);
  geo.rotateX(-Math.PI / 2);
  geo.applyMatrix4(new THREE.Matrix4().makeScale(0.72, 1, 1));
  return geo;
}
function makeDorsalGeo(): THREE.BufferGeometry {
  const v = new Float32Array([0,0.48,0.10, 0,0.48,-0.22, 0,0.94,-0.04]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals(); return g;
}
function makePecGeo(side: 1|-1): THREE.BufferGeometry {
  const x = side;
  const v = new Float32Array([x*0.28,0,0.08, x*0.75,-0.18,-0.05, x*0.55,-0.14,-0.35]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals(); return g;
}
function makeFlukeGeo(): THREE.BufferGeometry {
  // HORIZONTAL fluke — left lobe + right lobe + center notch
  const v = new Float32Array([
    -0.05, 0, -0.90,  -0.65,-0.05,-1.32,  -0.05, 0,-1.02,
     0.05, 0, -0.90,   0.65,-0.05,-1.32,   0.05, 0,-1.02,
  ]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals(); return g;
}

// ── Pod wander state (smooth, no teleport) ────────────────────────────────────
const X_MIN = -1500; const X_MAX = 1500;
const Z_MIN = -2000; const Z_MAX = 2700;
const MARGIN = 280;

interface PodState {
  cx: number; cy: number; cz: number;
  yaw: number; wanderAngle: number;
  speed: number; prefY: number; phase: number;
}
function stepPod(s: PodState, dt: number, t: number): void {
  s.wanderAngle += Math.sin(t * 0.15 + s.phase) * 0.50 * dt;
  const steer = (dir: number, str: number) => {
    let d = dir - s.yaw; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI;
    s.wanderAngle += d * str * dt;
  };
  if (s.cx < X_MIN + MARGIN) steer( Math.PI*.5, (X_MIN+MARGIN-s.cx)/MARGIN);
  if (s.cx > X_MAX - MARGIN) steer(-Math.PI*.5, (s.cx-X_MAX+MARGIN)/MARGIN);
  if (s.cz < Z_MIN + MARGIN) steer(0,           (Z_MIN+MARGIN-s.cz)/MARGIN);
  if (s.cz > Z_MAX - MARGIN) steer(Math.PI,     (s.cz-Z_MAX+MARGIN)/MARGIN);
  let dYaw = s.wanderAngle - s.yaw;
  while (dYaw > Math.PI) dYaw -= 2*Math.PI; while (dYaw < -Math.PI) dYaw += 2*Math.PI;
  s.yaw += dYaw * clamp(dt * 1.0, 0, 0.25);
  s.cx += Math.sin(s.yaw) * s.speed * dt;
  s.cz += Math.cos(s.yaw) * s.speed * dt;
  const tY = s.prefY + Math.sin(t * 0.55 + s.phase) * 6;
  s.cy += (tY - s.cy) * clamp(0.5 * dt, 0, 1);
}

const PODS = [
  { cx: -500, cy: 55, cz: -300, yaw: 0.5, speed: 24, phase: 0.0 },
  { cx:  600, cy: 65, cz:  480, yaw: 3.8, speed: 22, phase: 2.2 },
];
const FORMATION: [number, number, number][] = [[0,0,0], [-9,-3,-14], [9,2,-18]];
const POD_COUNT = PODS.length;
const DOLPH_PER_POD = FORMATION.length;

export interface DolphinPodProps {
  startX?: number; startY?: number; startZ?: number; phase?: number;
}

export const DolphinPod: FC<DolphinPodProps> = () => {
  const bodyGeo  = useMemo(makeDolphinBodyGeo, []);
  const dorsGeo  = useMemo(makeDorsalGeo, []);
  const leftPec  = useMemo(() => makePecGeo(1),  []);
  const rightPec = useMemo(() => makePecGeo(-1), []);
  const flukeGeo = useMemo(makeFlukeGeo, []);

  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#607888', roughness: 0.40, metalness: 0.15 }), []);
  const finMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#506878', roughness: 0.45, metalness: 0.10, side: THREE.DoubleSide }), []);

  const podStates = useRef<PodState[]>(
    PODS.map((d) => ({
      cx: d.cx, cy: d.cy, cz: d.cz,
      yaw: d.yaw, wanderAngle: d.yaw, speed: d.speed, prefY: d.cy, phase: d.phase,
    })),
  );

  type RefArr = (THREE.Group | null)[];
  type MeshArr = (THREE.Mesh | null)[];
  // groupRefs[podIdx][dolphinIdx] → flatten to 1D for simplicity
  const groupRefs = useRef<RefArr>(Array(POD_COUNT * DOLPH_PER_POD).fill(null));
  const flukeRefs = useRef<MeshArr>(Array(POD_COUNT * DOLPH_PER_POD).fill(null));

  useFrame((state, delta) => {
    const t  = state.clock.getElapsedTime();
    const dt = clamp(delta, 0, 0.033);

    for (let pi = 0; pi < POD_COUNT; pi++) {
      const pod = podStates.current[pi];
      stepPod(pod, dt, t);

      const cosH = Math.cos(pod.yaw);
      const sinH = Math.sin(pod.yaw);

      for (let di = 0; di < DOLPH_PER_POD; di++) {
        const idx = pi * DOLPH_PER_POD + di;
        const g   = groupRefs.current[idx];
        if (!g) continue;

        const [fx, fy, fz] = FORMATION[di];
        const wx = pod.cx + cosH * fx - sinH * fz;
        const wz = pod.cz + sinH * fx + cosH * fz;
        const wy = pod.cy + fy + Math.sin(t * 0.6 + pod.phase + di * 0.8) * 5;

        g.position.set(wx, wy, wz);
        g.rotation.y = pod.yaw;
        g.rotation.x = Math.sin(t * 1.5 + pod.phase + di * 0.5) * 0.10;

        const fluke = flukeRefs.current[idx];
        if (fluke) fluke.rotation.x = Math.sin(t * 2.0 + pod.phase + di * 0.5) * 0.28;
      }
    }
  });

  return (
    <group>
      {PODS.flatMap((_, pi) =>
        FORMATION.map((__, di) => {
          const idx = pi * DOLPH_PER_POD + di;
          return (
            <group key={idx} ref={(el) => { groupRefs.current[idx] = el; }} scale={[20, 20, 20]}>
              <mesh geometry={bodyGeo}  material={bodyMat} />
              <mesh geometry={dorsGeo}  material={finMat} />
              <mesh geometry={leftPec}  material={finMat} />
              <mesh geometry={rightPec} material={finMat} />
              <mesh ref={(el) => { flukeRefs.current[idx] = el; }} geometry={flukeGeo} material={finMat} />
            </group>
          );
        }),
      )}
    </group>
  );
};
