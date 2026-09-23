import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';
import { clamp } from './marineLifeSimulation';

// ─────────────────────────────────────────────────────────────────────────────
// EXACTLY 2 LARGE BLUE WHALES — Fully independent movement
//
// Each whale is a Group with 4 meshes:
//   1. Body           (LatheGeometry, massive elongated blue-gray)
//   2. Left pec fin   (long swept flat triangle — humpback-characteristic)
//   3. Right pec fin  (mirror)
//   4. Fluke          (large HORIZONTAL forked tail)
//
// Scale = [80, 60, 80] → body ~160 world units long
// Whale 1 and Whale 2 have completely independent wander states:
//   - different start positions (far apart)
//   - different initial headings
//   - different movement speeds
//   - different animation phases
//   - different depth
//
// Soft boundary steering used (no teleporting).
// ─────────────────────────────────────────────────────────────────────────────

// ── Geometry ──────────────────────────────────────────────────────────────────
function makeWhaleBodyGeo(): THREE.BufferGeometry {
  // Blue whale profile: massive rounded head, gradual taper, long body
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.00, -1.00), // rostrum tip (relatively narrow for a blue whale)
    new THREE.Vector2(0.08, -0.92), // narrow snout
    new THREE.Vector2(0.22, -0.80), // lower jaw
    new THREE.Vector2(0.42, -0.60), // head broadening
    new THREE.Vector2(0.60, -0.35), // shoulder
    new THREE.Vector2(0.70, -0.05), // widest / pectoral level
    new THREE.Vector2(0.68,  0.18), // chest
    new THREE.Vector2(0.58,  0.40), // mid body
    new THREE.Vector2(0.44,  0.58), // posterior body
    new THREE.Vector2(0.28,  0.75), // peduncle taper
    new THREE.Vector2(0.12,  0.88), // narrow peduncle
    new THREE.Vector2(0.00,  0.96), // tail junction
  ];
  const geo = new THREE.LatheGeometry(pts, 10); // 10-sided for smooth look
  geo.rotateX(-Math.PI / 2); // nose at +Z
  // Slight lateral compression (blue whale is slightly flattened)
  geo.applyMatrix4(new THREE.Matrix4().makeScale(0.68, 1, 1));
  return geo;
}

function makePecFinGeo(side: 1 | -1): THREE.BufferGeometry {
  // Blue whale pectoral flippers: swept back, narrow at root, broader at tip
  const x = side;
  const v = new Float32Array([
    // Main triangle (root → outer tip → rear tip)
    x * 0.42,  0.02,  0.15,  // root at body (pectoral attachment point)
    x * 1.50, -0.20,  0.05,  // outer-front tip (long swept fin)
    x * 1.20, -0.18, -0.45,  // outer-rear tip
    // Connecting triangle (fills the fin area)
    x * 0.42,  0.02,  0.15,
    x * 1.20, -0.18, -0.45,
    x * 0.52,  0.00, -0.35,  // inner rear (near body)
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
  geo.computeVertexNormals();
  return geo;
}

function makeFlukeGeo(): THREE.BufferGeometry {
  // Large HORIZONTAL fluke — blue whale has very wide tail
  const v = new Float32Array([
    // Left lobe (extends in -X)
     0.00,  0.00, -0.95,  // center notch
    -1.10, -0.04, -1.40,  // left tip
    -0.05,  0.00, -1.08,  // inner left
    // Right lobe (extends in +X)
     0.00,  0.00, -0.95,  // center notch
     1.10, -0.04, -1.40,  // right tip
     0.05,  0.00, -1.08,  // inner right
    // Close the notch gap (small center triangle)
    -0.05,  0.00, -1.08,
     0.05,  0.00, -1.08,
     0.00,  0.00, -0.95,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
  geo.computeVertexNormals();
  return geo;
}

function makeSmallDorsalGeo(): THREE.BufferGeometry {
  // Blue whale has a tiny dorsal fin (much smaller than great white or humpback)
  const v = new Float32Array([
    0, 0.70,  0.00,  // front base
    0, 0.70, -0.25,  // rear base
    0, 0.90, -0.12,  // small apex
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
  geo.computeVertexNormals();
  return geo;
}

// ── Soft boundary wander (no teleporting) ─────────────────────────────────────
const X_MIN = -1600; const X_MAX = 1600;
const Z_MIN = -2400; const Z_MAX = 3000;
const MARGIN = 400;

interface WhaleState {
  cx: number; cy: number; cz: number;
  yaw: number;
  wanderAngle: number;
  speed: number; prefY: number; phase: number;
}

function stepWhale(w: WhaleState, dt: number, t: number): void {
  // Very slow gentle wandering
  w.wanderAngle += Math.sin(t * 0.08 + w.phase) * 0.12 * dt;

  // Soft boundary steering
  const steer = (targetDir: number, strength: number) => {
    let d = targetDir - w.yaw;
    while (d >  Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    w.wanderAngle += d * strength * dt;
  };
  if (w.cx < X_MIN + MARGIN) steer( Math.PI * 0.5, (X_MIN + MARGIN - w.cx) / MARGIN * 1.0);
  if (w.cx > X_MAX - MARGIN) steer(-Math.PI * 0.5, (w.cx - X_MAX + MARGIN) / MARGIN * 1.0);
  if (w.cz < Z_MIN + MARGIN) steer(0,              (Z_MIN + MARGIN - w.cz) / MARGIN * 1.0);
  if (w.cz > Z_MAX - MARGIN) steer(Math.PI,        (w.cz - Z_MAX + MARGIN) / MARGIN * 1.0);

  // Smooth heading
  let dYaw = w.wanderAngle - w.yaw;
  while (dYaw >  Math.PI) dYaw -= 2 * Math.PI;
  while (dYaw < -Math.PI) dYaw += 2 * Math.PI;
  w.yaw += dYaw * clamp(dt * 0.55, 0, 0.12); // very slow turn

  // Move (slow)
  w.cx += Math.sin(w.yaw) * w.speed * dt;
  w.cz += Math.cos(w.yaw) * w.speed * dt;

  // Gentle depth oscillation
  const targetY = w.prefY + Math.sin(t * 0.14 + w.phase) * 18;
  w.cy += (targetY - w.cy) * clamp(0.18 * dt, 0, 1);
}

// ── Whale definitions — EXACTLY 2, FULLY INDEPENDENT ──────────────────────────
const WHALE_DEFS = [
  // Whale 1: west side, deeper, moving generally east
  { cx: -1100, cy: -310, cz:  -500, yaw: 1.1,  speed: 5.2, phase: 0.0 },
  // Whale 2: east side, slightly shallower, moving generally west-north
  { cx:  1050, cy: -270, cz:   900, yaw: 3.8,  speed: 4.6, phase: 2.3 },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
export const Whale: FC = () => {
  const bodyGeo    = useMemo(makeWhaleBodyGeo,    []);
  const leftPec    = useMemo(() => makePecFinGeo(1),  []);
  const rightPec   = useMemo(() => makePecFinGeo(-1), []);
  const flukeGeo   = useMemo(makeFlukeGeo,         []);
  const dorsalGeo  = useMemo(makeSmallDorsalGeo,   []);

  // Dark blue-gray upper body — BLUE WHALE
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2c4560', roughness: 0.62, metalness: 0.08,
  }), []);
  // Lighter underside (ventral region — blue whales have yellowish-white belly)
  const bellyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#d4c898', roughness: 0.68, metalness: 0.04,
  }), []);
  const finMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#243850', roughness: 0.60, metalness: 0.06, side: THREE.DoubleSide,
  }), []);

  const groupRefs = useRef<(THREE.Group | null)[]>([null, null]);
  const flukeRefs = useRef<(THREE.Mesh  | null)[]>([null, null]);

  // INDEPENDENT wander states
  const whales = useRef<WhaleState[]>(
    WHALE_DEFS.map((d) => ({
      cx: d.cx, cy: d.cy, cz: d.cz,
      yaw: d.yaw,
      wanderAngle: d.yaw + (Math.random() - 0.5) * 0.3,
      speed: d.speed, prefY: d.cy, phase: d.phase,
    })),
  );

  useFrame((state, delta) => {
    const t  = state.clock.getElapsedTime();
    const dt = clamp(delta, 0, 0.033);

    for (let i = 0; i < 2; i++) {
      const w = whales.current[i];
      const g = groupRefs.current[i];
      if (!g) continue;

      // Move whale center independently
      stepWhale(w, dt, t);

      g.position.set(w.cx, w.cy, w.cz);
      g.rotation.y = w.yaw;
      // Very subtle body pitch (slow dive/rise motion)
      g.rotation.x = Math.sin(t * 0.18 + w.phase) * 0.04;

      // Slow fluke oscillation (up/down — horizontal fluke)
      const fluke = flukeRefs.current[i];
      if (fluke) {
        fluke.rotation.x = Math.sin(t * 0.65 + w.phase) * 0.28;
      }
    }
  });

  return (
    <group>
      {WHALE_DEFS.map((_, i) => (
        <group
          key={i}
          ref={(el) => { groupRefs.current[i] = el; }}
          scale={[80, 60, 80]}  // ≈ 160 world units long — clearly dominant
        >
          {/* Main blue-gray body */}
          <mesh geometry={bodyGeo} material={bodyMat} />

          {/* Lighter yellowish-white ventral belly overlay */}
          <mesh
            geometry={bodyGeo}
            material={bellyMat}
            scale={[0.96, 0.94, 0.96]}
            position={[0, -0.16, 0]}
          />

          {/* Small blue whale dorsal fin */}
          <mesh geometry={dorsalGeo} material={finMat} />

          {/* Long pectoral flippers */}
          <mesh geometry={leftPec}  material={finMat} />
          <mesh geometry={rightPec} material={finMat} />

          {/* Large horizontal fluke (animated) */}
          <mesh
            ref={(el) => { flukeRefs.current[i] = el; }}
            geometry={flukeGeo}
            material={finMat}
          />
        </group>
      ))}
    </group>
  );
};
