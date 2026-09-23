import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';
import { clamp } from './marineLifeSimulation';

// ─────────────────────────────────────────────────────────────────────────────
// SHARKS — 3 recognizable low-poly sharks
//
// Body: LatheGeometry (torpedo, 8 sides)
// Dorsal: large flat triangle
// Pectoral fins: swept flat triangles
// Tail: asymmetric (upper lobe >> lower lobe)
//
// All use SMOOTH yaw + soft boundary steering (no teleporting)
// ─────────────────────────────────────────────────────────────────────────────

function makeSharkBodyGeo(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.00, -1.00),
    new THREE.Vector2(0.06, -0.92),
    new THREE.Vector2(0.18, -0.78),
    new THREE.Vector2(0.36, -0.52),
    new THREE.Vector2(0.54, -0.14),
    new THREE.Vector2(0.56,  0.10),
    new THREE.Vector2(0.48,  0.38),
    new THREE.Vector2(0.36,  0.58),
    new THREE.Vector2(0.22,  0.76),
    new THREE.Vector2(0.10,  0.88),
    new THREE.Vector2(0.00,  0.98),
  ];
  const geo = new THREE.LatheGeometry(pts, 8);
  geo.rotateX(-Math.PI / 2);
  geo.applyMatrix4(new THREE.Matrix4().makeScale(0.58, 1, 1));
  return geo;
}
function makeSharkDorsalGeo(): THREE.BufferGeometry {
  const v = new Float32Array([
    0,  0.56,  0.28,
    0,  0.56, -0.40,
    0,  1.28, -0.12,
  ]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}
function makeSharkPecGeo(side: 1 | -1): THREE.BufferGeometry {
  const x = side;
  const v = new Float32Array([
    x * 0.34,  0.00,  0.12,
    x * 1.00, -0.22, -0.08,
    x * 0.72, -0.18, -0.50,
  ]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}
function makeSharkTailGeo(): THREE.BufferGeometry {
  const v = new Float32Array([
    -0.12,  0.08, -0.95,   0.12,  0.08, -0.95,   0.00,  0.60, -1.55,
    -0.10, -0.02, -0.95,   0.10, -0.02, -0.95,   0.00, -0.32, -1.28,
  ]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

const X_MIN = -1600; const X_MAX = 1600;
const Z_MIN = -2200; const Z_MAX = 2800;
const MARGIN = 320;

interface SharkState {
  cx: number; cy: number; cz: number;
  yaw: number; wanderAngle: number;
  speed: number; prefY: number; phase: number;
}

function stepSharkState(s: SharkState, dt: number, t: number): void {
  s.wanderAngle += Math.sin(t * 0.10 + s.phase) * 0.22 * dt;

  const steer = (dir: number, str: number) => {
    let d = dir - s.yaw;
    while (d >  Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    s.wanderAngle += d * str * dt;
  };
  if (s.cx < X_MIN + MARGIN) steer( Math.PI * 0.5, (X_MIN + MARGIN - s.cx) / MARGIN);
  if (s.cx > X_MAX - MARGIN) steer(-Math.PI * 0.5, (s.cx - X_MAX + MARGIN) / MARGIN);
  if (s.cz < Z_MIN + MARGIN) steer(0,              (Z_MIN + MARGIN - s.cz) / MARGIN);
  if (s.cz > Z_MAX - MARGIN) steer(Math.PI,        (s.cz - Z_MAX + MARGIN) / MARGIN);

  let dYaw = s.wanderAngle - s.yaw;
  while (dYaw >  Math.PI) dYaw -= 2 * Math.PI;
  while (dYaw < -Math.PI) dYaw += 2 * Math.PI;
  s.yaw += dYaw * clamp(dt * 0.8, 0, 0.18);

  s.cx += Math.sin(s.yaw) * s.speed * dt;
  s.cz += Math.cos(s.yaw) * s.speed * dt;
  const tY = s.prefY + Math.sin(t * 0.20 + s.phase) * 12;
  s.cy += (tY - s.cy) * clamp(0.3 * dt, 0, 1);
}

const COUNT = 3;
const STARTS = [
  { cx: -750, cy: -145, cz: -950, yaw: 0.8,  speed: 10, phase: 0.0 },
  { cx:  820, cy: -200, cz:  650, yaw: 3.4,  speed: 9,  phase: 1.5 },
  { cx: -200, cy: -250, cz: 1100, yaw: 2.1,  speed: 11, phase: 3.0 },
];

export const Shark: FC = () => {
  const bodyGeo   = useMemo(makeSharkBodyGeo,    []);
  const dorsalGeo = useMemo(makeSharkDorsalGeo,  []);
  const leftPec   = useMemo(() => makeSharkPecGeo(1),  []);
  const rightPec  = useMemo(() => makeSharkPecGeo(-1), []);
  const tailGeo   = useMemo(makeSharkTailGeo,    []);

  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5a6872', roughness: 0.50, metalness: 0.12 }), []);
  const finMat  = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a5862', roughness: 0.55, metalness: 0.10, side: THREE.DoubleSide }), []);

  const groupRefs = useRef<(THREE.Group | null)[]>(Array(COUNT).fill(null));
  const tailRefs  = useRef<(THREE.Mesh  | null)[]>(Array(COUNT).fill(null));
  const states    = useRef<SharkState[]>(STARTS.map((d) => ({
    cx: d.cx, cy: d.cy, cz: d.cz,
    yaw: d.yaw, wanderAngle: d.yaw + (Math.random() - 0.5) * 0.4,
    speed: d.speed, prefY: d.cy, phase: d.phase,
  })));

  useFrame((state, delta) => {
    const t  = state.clock.getElapsedTime();
    const dt = clamp(delta, 0, 0.033);
    for (let i = 0; i < COUNT; i++) {
      const s = states.current[i];
      const g = groupRefs.current[i];
      if (!g) continue;
      stepSharkState(s, dt, t);
      g.position.set(s.cx, s.cy, s.cz);
      g.rotation.y  = s.yaw;
      g.rotation.z  = Math.sin(t * 0.85 + s.phase) * 0.05;
      const tail = tailRefs.current[i];
      if (tail) tail.rotation.y = Math.sin(t * 1.5 + s.phase) * 0.18;
    }
  });

  return (
    <group>
      {STARTS.map((_, i) => (
        <group key={i} ref={(el) => { groupRefs.current[i] = el; }} scale={[28, 28, 28]}>
          <mesh geometry={bodyGeo}   material={bodyMat} />
          <mesh geometry={dorsalGeo} material={finMat} />
          <mesh geometry={leftPec}   material={finMat} />
          <mesh geometry={rightPec}  material={finMat} />
          <mesh ref={(el) => { tailRefs.current[i] = el; }} geometry={tailGeo} material={finMat} />
        </group>
      ))}
    </group>
  );
};
