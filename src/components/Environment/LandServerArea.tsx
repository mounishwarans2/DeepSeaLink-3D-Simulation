import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// LAND SERVER AREA — Coastal data center receiving data from floating main node
//
// Positioned at X > 8000 (positive X edge of the 16km ocean)
// Contains: land terrain, server buildings, satellite dishes, indicator lights
// ─────────────────────────────────────────────────────────────────────────────

const LAND_X_START = 8200;   // Where land begins (ocean edge)
const LAND_X_END   = 12000;  // How far the land extends
const LAND_Z_SPAN  = 6000;   // Land width in Z
const LAND_Y       = -380;   // Land surface elevation (near seabed level)

// ── SERVER BUILDING ───────────────────────────────────────────────────────────
const ServerBuilding: FC<{
  position: [number, number, number];
  width?: number;
  depth?: number;
  height?: number;
}> = ({ position, width = 120, depth = 80, height = 60 }) => {
  const ledRef = useRef<THREE.InstancedMesh>(null);
  const applied = useRef(false);

  const ledMatrices = useMemo(() => {
    const dummy = new THREE.Object3D();
    const mats: THREE.Matrix4[] = [];
    const rows = 4, cols = 8;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dummy.position.set(
          position[0] - width * 0.38 + (c / (cols - 1)) * width * 0.76,
          position[1] + height * 0.2 + (r / (rows - 1)) * height * 0.55,
          position[2] + depth * 0.51,
        );
        dummy.scale.setScalar(1.8);
        dummy.updateMatrix();
        mats.push(dummy.matrix.clone());
      }
    }
    return mats;
  }, [position, width, depth, height]);

  useFrame(() => {
    if (applied.current || !ledRef.current) return;
    ledMatrices.forEach((mat, i) => ledRef.current!.setMatrixAt(i, mat));
    ledRef.current.instanceMatrix.needsUpdate = true;
    applied.current = true;
  });

  return (
    <group>
      {/* Main building body */}
      <mesh position={position}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#5a6070" roughness={0.72} metalness={0.28} />
      </mesh>

      {/* Roof panel */}
      <mesh position={[position[0], position[1] + height * 0.51, position[2]]}>
        <boxGeometry args={[width + 4, 3, depth + 4]} />
        <meshStandardMaterial color="#404855" roughness={0.65} metalness={0.35} />
      </mesh>

      {/* Window strip (dark glass panel on front facade) */}
      <mesh position={[position[0], position[1] + height * 0.1, position[2] + depth * 0.502]}>
        <boxGeometry args={[width * 0.8, height * 0.55, 1]} />
        <meshStandardMaterial color="#1a2840" roughness={0.05} metalness={0.4} transparent opacity={0.75} />
      </mesh>

      {/* Server rack ventilation stripes */}
      {[-0.25, 0, 0.25].map((offset, i) => (
        <mesh key={i} position={[position[0] + offset * width * 0.6, position[1] - height * 0.1, position[2] + depth * 0.502]}>
          <boxGeometry args={[width * 0.15, height * 0.65, 0.8]} />
          <meshStandardMaterial color="#2a3048" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}

      {/* Green indicator LEDs on front face */}
      <instancedMesh ref={ledRef} args={[undefined, undefined, ledMatrices.length]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color="#00ff88"
          emissive="#00ff88"
          emissiveIntensity={1.2}
          roughness={0.1}
          metalness={0.0}
        />
      </instancedMesh>

      {/* Side cooling units */}
      {[-1, 1].map((side, i) => (
        <mesh key={i} position={[position[0] + side * (width * 0.51 + 12), position[1] - height * 0.2, position[2]]}>
          <boxGeometry args={[24, height * 0.6, depth * 0.7]} />
          <meshStandardMaterial color="#4a5060" roughness={0.7} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
};

// ── SATELLITE DISH ────────────────────────────────────────────────────────────
const SatelliteDish: FC<{ position: [number, number, number]; rotation?: number }> = ({
  position,
  rotation = 0,
}) => (
  <group position={position} rotation={[0, rotation, 0]}>
    {/* Dish mount pole */}
    <mesh position={[0, 12, 0]}>
      <cylinderGeometry args={[1.5, 2, 24, 10]} />
      <meshStandardMaterial color="#606878" roughness={0.5} metalness={0.7} />
    </mesh>

    {/* Parabolic dish — open cone approximation */}
    <mesh position={[0, 26, 5]} rotation={[-0.65, 0, 0]}>
      <cylinderGeometry args={[14, 1.5, 6, 24, 1, true]} />
      <meshStandardMaterial
        color="#8090a0"
        roughness={0.3}
        metalness={0.82}
        side={THREE.DoubleSide}
      />
    </mesh>

    {/* Dish backing struts */}
    {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a, i) => (
      <mesh key={i} position={[Math.cos(a) * 5, 25, Math.sin(a) * 5 + 3]} rotation={[-0.65, a, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 12, 6]} />
        <meshStandardMaterial color="#505a68" roughness={0.5} metalness={0.7} />
      </mesh>
    ))}

    {/* Feed horn at focus */}
    <mesh position={[0, 26, 12]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[1, 2, 6, 12]} />
      <meshStandardMaterial color="#3a4050" roughness={0.4} metalness={0.8} />
    </mesh>
  </group>
);

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export const LandServerArea: FC = () => {
  const landY = LAND_Y;
  const cx    = (LAND_X_START + LAND_X_END) / 2;

  // Pulsing green glow on dishes
  const dishGlowRef = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    if (!dishGlowRef.current) return;
    const t = state.clock.getElapsedTime();
    dishGlowRef.current.intensity = 0.8 + Math.sin(t * 1.5) * 0.4;
  });

  return (
    <group>
      {/* ── LAND TERRAIN ────────────────────────────────────────────────── */}
      {/* Main land platform */}
      <mesh
        position={[cx, landY - 20, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[LAND_X_END - LAND_X_START, LAND_Z_SPAN, 8, 8]} />
        <meshStandardMaterial color="#8a7050" roughness={0.9} metalness={0.02} />
      </mesh>

      {/* Raised land block (gives it thickness / cliff face) */}
      <mesh position={[cx, landY - 60, 0]}>
        <boxGeometry args={[LAND_X_END - LAND_X_START, 80, LAND_Z_SPAN]} />
        <meshStandardMaterial color="#7a6040" roughness={0.92} metalness={0.01} />
      </mesh>

      {/* Shoreline rock edge */}
      <mesh position={[LAND_X_START + 80, landY - 30, 0]}>
        <boxGeometry args={[160, 60, LAND_Z_SPAN + 200]} />
        <meshStandardMaterial color="#5a5048" roughness={0.88} metalness={0.05} />
      </mesh>

      {/* ── SERVER BUILDINGS ────────────────────────────────────────────── */}
      <ServerBuilding
        position={[LAND_X_START + 400, landY + 30, -1200]}
        width={180} depth={100} height={60}
      />
      <ServerBuilding
        position={[LAND_X_START + 650, landY + 30, 0]}
        width={220} depth={120} height={75}
      />
      <ServerBuilding
        position={[LAND_X_START + 400, landY + 30, 1200]}
        width={180} depth={100} height={60}
      />
      {/* Small auxiliary building */}
      <ServerBuilding
        position={[LAND_X_START + 950, landY + 30, -600]}
        width={100} depth={80} height={45}
      />

      {/* ── SATELLITE DISHES ────────────────────────────────────────────── */}
      {/* Main receiving dish — angled toward the ocean */}
      <SatelliteDish
        position={[LAND_X_START + 550, landY, -300]}
        rotation={Math.PI * 1.15}
      />
      <SatelliteDish
        position={[LAND_X_START + 550, landY, 300]}
        rotation={Math.PI * 1.05}
      />
      <SatelliteDish
        position={[LAND_X_START + 280, landY, 0]}
        rotation={Math.PI}
      />

      {/* ── LIGHTING ────────────────────────────────────────────────────── */}
      {/* Warm floodlight over the server complex */}
      <pointLight
        position={[LAND_X_START + 600, landY + 120, 0]}
        intensity={1.8}
        distance={1200}
        color="#ffeedd"
        decay={1.5}
      />
      {/* Pulsing green data-receive glow */}
      <pointLight
        ref={dishGlowRef}
        position={[LAND_X_START + 300, landY + 60, 0]}
        intensity={1.2}
        distance={600}
        color="#00ff88"
        decay={2}
      />

      {/* ── CONNECTING ROAD ─────────────────────────────────────────────── */}
      <mesh position={[cx, landY - 15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[LAND_X_END - LAND_X_START - 100, 40]} />
        <meshStandardMaterial color="#404040" roughness={0.95} metalness={0.0} />
      </mesh>
    </group>
  );
};
