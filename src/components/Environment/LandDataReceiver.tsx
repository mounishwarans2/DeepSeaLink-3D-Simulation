import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// LAND DATA RECEIVER CENTER
//
// A small, realistic coastal research/engineering facility positioned on the
// elevated land terrain west of the ocean (negative X side, land territory).
//
// World position chosen on confirmed land area:
//   X ≈ -7200 (well inside land mask, west coast)
//   Z ≈ 0     (mid-coast, facing the ocean)
//   Y: terrain height at that point ≈ 280-320 (above sea level 125)
//
// Architecture chain:
//   Underwater sensor → sub-node → gateway → surface float buoy
//     → radio/acoustic link → Land Data Receiver Center
// ─────────────────────────────────────────────────────────────────────────────

// Position on confirmed elevated land (east coast, facing west toward ocean)
// Matches hand-drawn reference: Data Collection Center on the RIGHT / east side
// At X=+7000: distance from ocean center [0,-300] = 7018 >> coast max ~2800 → mask=1.0, terrain Y≈760
const CENTER_X = +7000;   // East land — faces west toward open ocean
const CENTER_Z =   200;
const CENTER_Y =   810;   // Terrain at X=+7000,Z=200 peaks at Y≈760; building base 50 above

// ── PARABOLIC DISH ────────────────────────────────────────────────────────────
const ParabolicDish: FC<{
  pos: [number, number, number];
  yaw?: number;
  pitch?: number;
  size?: number;
}> = ({ pos, yaw = 0, pitch = -0.5, size = 1 }) => (
  <group position={pos} rotation={[0, yaw, 0]}>
    {/* Mount pole */}
    <mesh position={[0, 8 * size, 0]}>
      <cylinderGeometry args={[1.2 * size, 1.5 * size, 16 * size, 10]} />
      <meshStandardMaterial color="#707888" roughness={0.5} metalness={0.75} />
    </mesh>
    {/* Dish bowl (open cone = parabola approx) */}
    <mesh position={[0, 18 * size, 4 * size]} rotation={[pitch, 0, 0]}>
      <cylinderGeometry args={[11 * size, 1 * size, 5 * size, 20, 1, true]} />
      <meshStandardMaterial
        color="#a0b0c0" roughness={0.25} metalness={0.88}
        side={THREE.DoubleSide}
      />
    </mesh>
    {/* Dish backing — solid disc */}
    <mesh position={[0, 17.5 * size, 1.5 * size]} rotation={[pitch, 0, 0]}>
      <circleGeometry args={[10.5 * size, 20]} />
      <meshStandardMaterial color="#8898a8" roughness={0.4} metalness={0.7} />
    </mesh>
    {/* Feed horn */}
    <mesh position={[0, 18 * size, 10 * size]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.8 * size, 1.5 * size, 5 * size, 10]} />
      <meshStandardMaterial color="#3a4050" roughness={0.45} metalness={0.85} />
    </mesh>
    {/* Struts */}
    {[0, Math.PI * 0.5, Math.PI, Math.PI * 1.5].map((a, i) => (
      <mesh key={i}
        position={[Math.cos(a) * 4 * size, 18 * size, Math.sin(a) * 4 * size + 3 * size]}
        rotation={[pitch, a, 0]}
      >
        <cylinderGeometry args={[0.3 * size, 0.3 * size, 9 * size, 6]} />
        <meshStandardMaterial color="#606878" roughness={0.5} metalness={0.7} />
      </mesh>
    ))}
  </group>
);

// ── ANTENNA TOWER ─────────────────────────────────────────────────────────────
const AntennaTower: FC<{ pos: [number, number, number] }> = ({ pos }) => (
  <group position={pos}>
    {/* Main mast — 2.75× original height */}
    <mesh position={[0, 82, 0]}>
      <cylinderGeometry args={[1.6, 3.2, 165, 8]} />
      <meshStandardMaterial color="#8090a0" roughness={0.4} metalness={0.8} />
    </mesh>
    {/* Cross bars at 40, 80, 120 */}
    {[40, 80, 120].map((hy, i) => (
      <mesh key={i} position={[0, hy, 0]} rotation={[0, i * Math.PI / 3, Math.PI / 2]}>
        <cylinderGeometry args={[0.8, 0.8, 44, 6]} />
        <meshStandardMaterial color="#707888" roughness={0.4} metalness={0.8} />
      </mesh>
    ))}
    {/* Red aviation warning light — proportionally larger */}
    <mesh position={[0, 170, 0]}>
      <sphereGeometry args={[4, 10, 10]} />
      <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={1.8} roughness={0.1} />
    </mesh>
  </group>
);

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export const LandDataReceiver: FC = () => {
  const glowRef  = useRef<THREE.PointLight>(null);
  const blinkRef = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (glowRef.current)  glowRef.current.intensity  = 0.7 + Math.sin(t * 1.2) * 0.35;
    if (blinkRef.current) blinkRef.current.intensity = Math.sin(t * 4) > 0 ? 3.0 : 0.0;
  });

  const X = CENTER_X, Y = CENTER_Y, Z = CENTER_Z;
  // Scale factor ≈2.75× — makes the facility clearly visible from camera altitude.

  return (
    <group>
      {/* ── TERRAIN PLATFORM ────────────────────────────────────────────── */}
      <mesh position={[X, Y - 14, Z]}>
        <cylinderGeometry args={[500, 540, 28, 16]} />
        <meshStandardMaterial color="#5a4a30" roughness={0.92} metalness={0.02} />
      </mesh>

      {/* ── MAIN OPERATIONS BUILDING — 2.75× original ───────────────────── */}
      <mesh position={[X, Y + 52, Z]}>
        <boxGeometry args={[220, 100, 165]} />
        <meshStandardMaterial color="#4a5868" roughness={0.60} metalness={0.35} />
      </mesh>
      {/* Roof */}
      <mesh position={[X, Y + 104, Z]}>
        <boxGeometry args={[226, 14, 170]} />
        <meshStandardMaterial color="#3a4555" roughness={0.65} metalness={0.40} />
      </mesh>
      {/* Front glass facade (faces ocean = -X direction) */}
      <mesh position={[X - 112, Y + 52, Z]}>
        <boxGeometry args={[4, 80, 140]} />
        <meshStandardMaterial color="#1a3060" roughness={0.05} metalness={0.3} transparent opacity={0.70} />
      </mesh>
      {/* White identification stripe */}
      <mesh position={[X, Y + 100, Z]}>
        <boxGeometry args={[224, 10, 168]} />
        <meshStandardMaterial color="#c8d0d8" roughness={0.5} metalness={0.2} />
      </mesh>

      {/* ── SECONDARY EQUIPMENT BUILDING ─────────────────────────────────── */}
      <mesh position={[X + 210, Y + 32, Z - 100]}>
        <boxGeometry args={[110, 60, 96]} />
        <meshStandardMaterial color="#525e6a" roughness={0.70} metalness={0.30} />
      </mesh>
      <mesh position={[X + 210, Y + 64, Z - 100]}>
        <boxGeometry args={[114, 10, 100]} />
        <meshStandardMaterial color="#3e4a55" roughness={0.70} metalness={0.40} />
      </mesh>

      {/* ── RECEIVER DISHES ─────────────────────────────────────────────── */}
      {/* Primary large dish */}
      <ParabolicDish
        pos={[X + 210, Y, Z + 80]}
        yaw={Math.PI * 0.5}
        pitch={-0.4}
        size={3.8}
      />
      {/* Secondary dish */}
      <ParabolicDish
        pos={[X + 210, Y, Z - 130]}
        yaw={Math.PI * 0.5}
        pitch={-0.35}
        size={2.75}
      />
      {/* Uplink dish */}
      <ParabolicDish
        pos={[X - 160, Y + 10, Z + 160]}
        yaw={Math.PI * 0.35}
        pitch={-0.6}
        size={1.8}
      />

      {/* ── ANTENNA TOWERS (two, for visual impact) ──────────────────────── */}
      <AntennaTower pos={[X + 300, Y, Z + 60]} />
      <AntennaTower pos={[X + 300, Y, Z - 60]} />

      {/* ── PERIMETER FENCE POSTS ────────────────────────────────────────── */}
      {Array.from({ length: 24 }, (_, i) => {
        const a  = (i / 24) * Math.PI * 2;
        const r  = 480;
        return (
          <mesh key={i} position={[X + Math.cos(a) * r, Y + 8, Z + Math.sin(a) * r]}>
            <cylinderGeometry args={[2, 2, 18, 6]} />
            <meshStandardMaterial color="#606070" roughness={0.6} metalness={0.5} />
          </mesh>
        );
      })}

      {/* ── ACCESS ROAD ──────────────────────────────────────────────────── */}
      <mesh position={[X - 600, Y - 4, Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[600, 40]} />
        <meshStandardMaterial color="#5a4a38" roughness={0.95} metalness={0.0} />
      </mesh>

      {/* ── LIGHTING ─────────────────────────────────────────────────────── */}
      <pointLight
        ref={glowRef}
        position={[X, Y + 160, Z]}
        intensity={4.0} distance={1200} color="#ffe8cc" decay={1.5}
      />
      {/* Tower blink lights */}
      <pointLight
        ref={blinkRef}
        position={[X + 300, Y + 170, Z + 60]}
        intensity={5} distance={300} color="#ff2200" decay={2}
      />
      {/* Dish signal glow (faces ocean) */}
      <pointLight
        position={[X - 200, Y + 55, Z]}
        intensity={2.0} distance={600} color="#00aaff" decay={1.8}
      />
    </group>
  );
};
