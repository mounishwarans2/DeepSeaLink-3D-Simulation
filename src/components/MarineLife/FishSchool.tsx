import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';
import { clamp } from './marineLifeSimulation';

// ─────────────────────────────────────────────────────────────────────────────
// FISH SCHOOL — FIXED IMPLEMENTATION
//
// ROOT CAUSES OF PREVIOUS GLITCHING:
//   1. wrapBounds() teleported school center → ALL fish snapped instantly
//   2. fishYaw = schoolYaw + orbitAngle → school turn = all fish rotate together
//   3. No per-fish velocity → center position jump = all fish teleport
//
// THIS IMPLEMENTATION:
//   • Each fish has INDEPENDENT position + velocity (spring physics)
//   • Fish yaw tracks own velocity direction via smooth angular interpolation
//   • School center uses soft-boundary steering (NO teleporting at all)
//   • 8 schools × 10 fish = 80 fish distributed across ENTIRE ocean
//
// GEOMETRY: LatheGeometry body + flat fin BufferGeometry (3 InstancedMesh)
// ─────────────────────────────────────────────────────────────────────────────

// ── Geometry builders ─────────────────────────────────────────────────────────
function makeFishBodyGeo(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.00, -1.00),
    new THREE.Vector2(0.09, -0.88),
    new THREE.Vector2(0.24, -0.65),
    new THREE.Vector2(0.38, -0.28),
    new THREE.Vector2(0.42,  0.08),
    new THREE.Vector2(0.36,  0.38),
    new THREE.Vector2(0.24,  0.62),
    new THREE.Vector2(0.12,  0.78),
    new THREE.Vector2(0.00,  0.90),
  ];
  const geo = new THREE.LatheGeometry(pts, 8);
  geo.rotateX(-Math.PI / 2); // nose → +Z
  geo.applyMatrix4(new THREE.Matrix4().makeScale(0.60, 1, 1));
  return geo;
}
function makeDorsalGeo(): THREE.BufferGeometry {
  const v = new Float32Array([
    0,  0.42,  0.15,
    0,  0.42, -0.28,
    0,  0.82, -0.06,
  ]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}
function makeTailGeo(): THREE.BufferGeometry {
  const v = new Float32Array([
    -0.18,  0.06, -0.88,
     0.18,  0.06, -0.88,
     0.00,  0.44, -1.28,
    -0.16, -0.03, -0.88,
     0.16, -0.03, -0.88,
     0.00, -0.36, -1.18,
  ]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

// ── School configuration — spread across ENTIRE ocean ────────────────────────
// Camera: [0,1200,-8000] → ocean spans X≈-1500..+1500, Z≈-2000..+3000
interface SchoolCfg {
  cx: number; cy: number; cz: number;
  speed: number; color: string; wanderRate: number;
}
const SCHOOL_CFG: SchoolCfg[] = [
  { cx: -650, cy: -55,  cz: -1200, speed: 22, color: '#c86418', wanderRate: 0.50 },
  { cx:  720, cy: -60,  cz:  -900, speed: 18, color: '#1e6888', wanderRate: 0.55 },
  { cx: -850, cy: -90,  cz:     0, speed: 20, color: '#3a7840', wanderRate: 0.45 },
  { cx:  820, cy: -95,  cz:   280, speed: 16, color: '#806030', wanderRate: 0.50 },
  { cx:    0, cy: -115, cz:  -500, speed: 14, color: '#286068', wanderRate: 0.40 },
  { cx: -420, cy: -80,  cz:   900, speed: 21, color: '#704025', wanderRate: 0.55 },
  { cx:  380, cy: -85,  cz:  1100, speed: 17, color: '#305848', wanderRate: 0.45 },
  { cx:    0, cy: -195, cz: -1600, speed: 12, color: '#1e3850', wanderRate: 0.35 },
];
const FISH_PER_SCHOOL = 10;
const TOTAL_FISH = SCHOOL_CFG.length * FISH_PER_SCHOOL; // 80

// ── Per-fish independent state ────────────────────────────────────────────────
interface FishState {
  si: number;           // school index
  x:  number; y: number; z: number;   // world position
  vx: number; vy: number; vz: number; // velocity
  yaw:         number;  // current facing (smoothly tracked from velocity)
  phase:       number;  // individual animation phase
  scl:         number;  // scale variation
  orbitAngle:  number;  // angle in school formation
  orbitR:      number;  // distance from school center
  oy:          number;  // Y offset within school
}

// ── Per-school wander state ───────────────────────────────────────────────────
interface SchoolState {
  cx: number; cy: number; cz: number;
  yaw:         number;
  wanderAngle: number;
  speed:       number;
  prefY:       number;
  phase:       number;
}

// Ocean soft-boundary constants (no teleporting)
const X_MIN = -1600; const X_MAX = 1600;
const Z_MIN = -2200; const Z_MAX = 2800;
const MARGIN = 280;

function stepSchoolCenter(s: SchoolState, dt: number, t: number, wanderRate: number): void {
  // Slowly rotate wander angle
  s.wanderAngle += Math.sin(t * 0.11 + s.phase) * wanderRate * dt;

  // Soft boundary steering — push heading away from walls (NO teleport)
  const steer = (dir: number, strength: number) => {
    let d = dir - s.yaw;
    while (d >  Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    s.wanderAngle += d * strength * dt;
  };
  const sinH = Math.sin(s.yaw); const cosH = Math.cos(s.yaw);
  // Check each wall and steer away
  if (s.cx < X_MIN + MARGIN) steer( Math.PI / 2, (X_MIN + MARGIN - s.cx) / MARGIN * 1.2);
  if (s.cx > X_MAX - MARGIN) steer(-Math.PI / 2, (s.cx - X_MAX + MARGIN) / MARGIN * 1.2);
  if (s.cz < Z_MIN + MARGIN) steer(0,             (Z_MIN + MARGIN - s.cz) / MARGIN * 1.2);
  if (s.cz > Z_MAX - MARGIN) steer(Math.PI,       (s.cz - Z_MAX + MARGIN) / MARGIN * 1.2);

  // Smooth heading follows wander angle
  let dYaw = s.wanderAngle - s.yaw;
  while (dYaw >  Math.PI) dYaw -= 2 * Math.PI;
  while (dYaw < -Math.PI) dYaw += 2 * Math.PI;
  s.yaw += dYaw * clamp(dt * 1.0, 0, 0.30); // max 0.30 rad/frame

  // Move school center
  s.cx += sinH * s.speed * dt;
  s.cz += cosH * s.speed * dt;

  // Gentle Y oscillation (school drifts up/down slowly)
  const tY = s.prefY + Math.sin(t * 0.18 + s.phase) * 8;
  s.cy += (tY - s.cy) * clamp(0.25 * dt, 0, 1);
}

function stepFish(f: FishState, schools: SchoolState[], dt: number, t: number): void {
  const s  = schools[f.si];
  f.orbitAngle += dt * 0.055;

  // Orbit target in world space (rotated by school heading)
  const cosH = Math.cos(s.yaw); const sinH = Math.sin(s.yaw);
  const lx   = Math.cos(f.orbitAngle) * f.orbitR;
  const lz   = Math.sin(f.orbitAngle) * f.orbitR;
  const targetX = s.cx + cosH * lx - sinH * lz;
  const targetZ = s.cz + sinH * lx + cosH * lz;
  const targetY = s.cy + f.oy + Math.sin(t * 0.75 + f.phase) * 4;

  // Spring force toward orbit target
  const spring = 3.2;
  f.vx += (targetX - f.x) * spring * dt;
  f.vy += (targetY - f.y) * spring * dt;
  f.vz += (targetZ - f.z) * spring * dt;

  // Damping
  const damp = Math.max(0, 1 - 2.2 * dt);
  f.vx *= damp; f.vy *= damp; f.vz *= damp;

  // Integrate
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  f.z += f.vz * dt;

  // Depth clamping: stay below surface (Y<105) and above deep floor (prefY - 60)
  f.y = clamp(f.y, Math.max(s.prefY - 60, -1300), 105);

  // Smooth yaw from velocity — the key fix: each fish tracks ITS OWN velocity
  const speed2D = Math.sqrt(f.vx * f.vx + f.vz * f.vz);
  if (speed2D > 0.8) {
    const targetYaw = Math.atan2(f.vx, f.vz);
    let diff = targetYaw - f.yaw;
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    // Clamp max angular velocity: smoothly follows, no snapping
    f.yaw += clamp(diff, -Math.PI * 0.5 * dt, Math.PI * 0.5 * dt) * Math.min(1, 5 * dt);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export const FishSchool: FC = () => {
  const bodyGeo   = useMemo(makeFishBodyGeo, []);
  const dorsalGeo = useMemo(makeDorsalGeo,   []);
  const tailGeo   = useMemo(makeTailGeo,     []);

  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.08 }), []);
  const finMat  = useMemo(() => new THREE.MeshStandardMaterial({
    roughness: 0.55, metalness: 0.08, side: THREE.DoubleSide,
  }), []);

  const bodyRef   = useRef<THREE.InstancedMesh>(null);
  const dorsalRef = useRef<THREE.InstancedMesh>(null);
  const tailRef   = useRef<THREE.InstancedMesh>(null);
  const dummy     = useMemo(() => new THREE.Object3D(), []);

  // School center states
  const schools = useRef<SchoolState[]>(
    SCHOOL_CFG.map((c, i) => ({
      cx: c.cx, cy: c.cy, cz: c.cz,
      yaw:         Math.random() * Math.PI * 2,
      wanderAngle: Math.random() * Math.PI * 2,
      speed:       c.speed,
      prefY:       c.cy,
      phase:       i * 0.7,
    })),
  );

  // Individual fish states — each fish independently positioned near its school
  const fishStates = useRef<FishState[]>(
    SCHOOL_CFG.flatMap((cfg, si) =>
      Array.from({ length: FISH_PER_SCHOOL }, (_, fi) => {
        const angle   = (fi / FISH_PER_SCHOOL) * Math.PI * 2;
        const orbitR  = 100 + Math.random() * 120;
        const initX   = cfg.cx + Math.cos(angle) * orbitR;
        const initZ   = cfg.cz + Math.sin(angle) * orbitR;
        return {
          si,
          x: initX, y: cfg.cy + (Math.random() - 0.5) * 20, z: initZ,
          vx: 0, vy: 0, vz: 0,
          yaw:        Math.random() * Math.PI * 2,
          phase:      Math.random() * Math.PI * 2,
          scl:        10 + Math.random() * 5,
          orbitAngle: angle + (Math.random() - 0.5) * 0.6,
          orbitR,
          oy:         (Math.random() - 0.5) * 22,
        } as FishState;
      }),
    ),
  );

  const colorsSet = useRef(false);

  useFrame((state, delta) => {
    const br = bodyRef.current;
    const dr = dorsalRef.current;
    const tr = tailRef.current;
    if (!br || !dr || !tr) return;

    // Set per-instance colors once
    if (!colorsSet.current) {
      const col = new THREE.Color();
      fishStates.current.forEach((f, i) => {
        col.set(SCHOOL_CFG[f.si].color);
        br.setColorAt(i, col);
        dr.setColorAt(i, col);
        tr.setColorAt(i, col);
      });
      if (br.instanceColor) br.instanceColor.needsUpdate = true;
      if (dr.instanceColor) dr.instanceColor.needsUpdate = true;
      if (tr.instanceColor) tr.instanceColor.needsUpdate = true;
      colorsSet.current = true;
    }

    const t  = state.clock.getElapsedTime();
    const dt = clamp(delta, 0, 0.033); // cap at ~30fps to avoid large dt spikes

    // Step each school center (with soft boundary steering)
    schools.current.forEach((s, si) => stepSchoolCenter(s, dt, t, SCHOOL_CFG[si].wanderRate));

    // Step each fish independently
    fishStates.current.forEach((f, fi) => {
      stepFish(f, schools.current, dt, t);

      // Tail wag animation: body roll
      const roll = Math.sin(t * 2.8 + f.phase) * 0.06;

      dummy.position.set(f.x, f.y, f.z);
      dummy.rotation.set(0, f.yaw, roll);
      dummy.scale.setScalar(f.scl);
      dummy.updateMatrix();

      br.setMatrixAt(fi, dummy.matrix);
      dr.setMatrixAt(fi, dummy.matrix);
      tr.setMatrixAt(fi, dummy.matrix);
    });

    br.instanceMatrix.needsUpdate = true;
    dr.instanceMatrix.needsUpdate = true;
    tr.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={bodyRef}   args={[bodyGeo,   bodyMat, TOTAL_FISH]} frustumCulled={false} />
      <instancedMesh ref={dorsalRef} args={[dorsalGeo, finMat,  TOTAL_FISH]} frustumCulled={false} />
      <instancedMesh ref={tailRef}   args={[tailGeo,   finMat,  TOTAL_FISH]} frustumCulled={false} />
    </group>
  );
};
