import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE BUOY — professional ocean monitoring / acoustic relay buoy
//
// Floats at sea surface Y=125.
// Animation: sinusoidal vertical bob + subtle pitch + roll.
// ─────────────────────────────────────────────────────────────────────────────

// ── OFFSHORE COMMUNICATION RELAY BUOY ────────────────────────────────────────
// Positioned offshore near the Data Collection Center (X=+7000, Z=200).
// Acts as acoustic-to-RF relay: underwater nodes → acoustic → buoy → data center.
// East coast at Z=1500 is at X≈5200; buoy at X=4200 is ~1000 units offshore.
const BUOY_X =  4200;
const BUOY_Z =  1500;
const SEA_Y  =   125;

export const SurfaceBuoy: FC = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const bob   = Math.sin(t*0.55+0.3)*2.5 + Math.sin(t*0.82+1.1)*1.0;
    const pitch = Math.sin(t*0.42+0.6)*0.055;
    const roll  = Math.cos(t*0.35+1.2)*0.045;
    groupRef.current.position.y = SEA_Y + bob;
    groupRef.current.rotation.x = pitch;
    groupRef.current.rotation.z = roll;
  });

  return (
    <group ref={groupRef} position={[BUOY_X, SEA_Y, BUOY_Z]}>
      {/* Main hull */}
      <mesh>
        <sphereGeometry args={[8, 16, 12]} />
        <meshStandardMaterial color="#e06010" roughness={0.65} metalness={0.15}
          emissive="#802000" emissiveIntensity={0.08} />
      </mesh>
      {/* Waterline collar */}
      <mesh rotation={[Math.PI/2, 0, 0]}>
        <torusGeometry args={[9, 1.5, 8, 24]} />
        <meshStandardMaterial color="#ffcc00" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* Mast */}
      <mesh position={[0, 12, 0]}>
        <cylinderGeometry args={[0.8, 1.0, 18, 8]} />
        <meshStandardMaterial color="#c0c8d0" roughness={0.4} metalness={0.75} />
      </mesh>
      {/* Instrument box */}
      <mesh position={[0, 22, 0]}>
        <boxGeometry args={[3.5, 3, 3.5]} />
        <meshStandardMaterial color="#708090" roughness={0.35} metalness={0.6} />
      </mesh>
      {/* Antenna */}
      <mesh position={[0, 26.5, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 8, 6]} />
        <meshStandardMaterial color="#d0d8e0" roughness={0.3} metalness={0.85} />
      </mesh>
      {/* Beacon light */}
      <mesh position={[0, 31, 0]}>
        <sphereGeometry args={[0.8, 6, 6]} />
        <meshStandardMaterial color="#ff3300" emissive="#ff2200"
          emissiveIntensity={0.8} roughness={0.2} metalness={0.1} />
      </mesh>
      {/* Mooring chain segments going underwater */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[0, -12 - i*12, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 10, 5]} />
          <meshStandardMaterial color="#506070" roughness={0.8} metalness={0.5} />
        </mesh>
      ))}
      {/* Subtle local glow */}
      <pointLight color="#ff8040" intensity={0.4} distance={120} decay={2} position={[0, 5, 0]} />
    </group>
  );
};
