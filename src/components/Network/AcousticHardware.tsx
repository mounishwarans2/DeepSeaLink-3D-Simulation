import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

import type { FC } from 'react';
import * as THREE from 'three';
import { seabedAtXZ } from '../Environment/CoastalTerrain';
import type { HardwareNode, NodeStatus } from '../../types';
import { HARDWARE_NODES } from '../../utils/constants';


// ─────────────────────────────────────────────────────────────────────────────
// SHARED MATERIAL PALETTE — realistic engineering colors, no neon
// ─────────────────────────────────────────────────────────────────────────────
const MAT = {
  hull:        { color: '#5a6a7a', roughness: 0.48, metalness: 0.72 },  // Dark anodized — visible slate
  titanium:    { color: '#626878', roughness: 0.26, metalness: 0.88 },  // Titanium — visible
  composite:   { color: '#484858', roughness: 0.68, metalness: 0.18 },  // Carbon composite — readable
  safetyOrange:{ color: '#d87020', roughness: 0.55, metalness: 0.08 },  // Safety orange — bright
  safetyYellow:{ color: '#c8a020', roughness: 0.60, metalness: 0.08 },  // Buoyancy yellow — bright
  foam:        { color: '#dbb848', roughness: 0.80, metalness: 0.00 },  // Syntactic foam — bright
  steelDark:   { color: '#505a68', roughness: 0.46, metalness: 0.84 },  // Dark steel — readable
  cableBlack:  { color: '#383c45', roughness: 0.85, metalness: 0.18 },  // Umbilical — readable
  transducer:  { color: '#2a3850', roughness: 0.36, metalness: 0.52 },  // Transducer — dark blue visible
  whiteCompo:  { color: '#d8dde0', roughness: 0.55, metalness: 0.10 },  // White housing — bright
  endcap:      { color: '#4a5060', roughness: 0.30, metalness: 0.80 },  // End cap — readable
  thruster:    { color: '#404050', roughness: 0.40, metalness: 0.72 },  // Thruster — readable
  glass:       { color: '#6090c0', roughness: 0.05, metalness: 0.10, transparent: true, opacity: 0.55 },
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS LED — small coloured indicator (keeps pulsing for active states)
// ─────────────────────────────────────────────────────────────────────────────
const StatusLED: FC<{ status: NodeStatus; position: [number, number, number] }> = ({
  status,
  position,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    if (status === 'transmitting') {
      mat.emissiveIntensity = 0.8 + Math.sin(t * 9) * 0.8;
    } else if (status === 'receiving') {
      mat.emissiveIntensity = 0.6 + Math.sin(t * 6) * 0.6;
    }
  });

  const led = {
    transmitting: { col: '#00ccff', emi: '#00ccff', int: 1.2 },
    receiving:    { col: '#00e87a', emi: '#00e87a', int: 0.9 },
    active:       { col: '#00bbff', emi: '#0088cc', int: 0.5 },
    standby:      { col: '#ffaa00', emi: '#cc8800', int: 0.4 },
    offline:      { col: '#cc2222', emi: '#aa1111', int: 0.2 },
  }[status] ?? { col: '#0088cc', emi: '#0055aa', int: 0.5 };

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.065, 10, 10]} />
      <meshStandardMaterial
        color={led.col}
        emissive={led.emi}
        emissiveIntensity={led.int}
        roughness={0.1}
        metalness={0.0}
      />
    </mesh>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LIGHT BEAM CONE — translucent headlight volume
// ─────────────────────────────────────────────────────────────────────────────
const LightBeam: FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  length?: number;
  radius?: number;
}> = ({ position, rotation = [0, 0, 0], length = 14, radius = 3.5 }) => (
  <mesh position={position} rotation={rotation}>
    <coneGeometry args={[radius, length, 20, 1, true]} />
    <meshBasicMaterial
      color="#b0ddff"
      transparent
      opacity={0.10}
      depthWrite={false}
      side={THREE.DoubleSide}
      blending={THREE.AdditiveBlending}
    />
  </mesh>
);

// ─────────────────────────────────────────────────────────────────────────────
// PROPELLER BLADE ASSEMBLY
// ─────────────────────────────────────────────────────────────────────────────
const PropellerAssembly: FC<{ blades?: number; radius?: number }> = ({
  blades = 5,
  radius = 0.55,
}) => {
  const bladeAngle = (Math.PI * 2) / blades;
  return (
    <group>
      {/* Hub */}
      <mesh>
        <cylinderGeometry args={[0.12, 0.12, 0.14, 16]} />
        <meshStandardMaterial {...MAT.titanium} />
      </mesh>
      {/* Blades */}
      {Array.from({ length: blades }).map((_, i) => (
        <mesh
          key={i}
          position={[
            Math.cos(bladeAngle * i) * (radius * 0.5),
            0,
            Math.sin(bladeAngle * i) * (radius * 0.5),
          ]}
          rotation={[Math.PI * 0.15, bladeAngle * i, Math.PI * 0.05]}
        >
          <boxGeometry args={[radius * 0.42, 0.025, radius * 0.16]} />
          <meshStandardMaterial {...MAT.titanium} />
        </mesh>
      ))}
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// THRUSTER DUCT — compact vectored thruster used on ROV/gateway
// ─────────────────────────────────────────────────────────────────────────────
const ThrusterDuct: FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
}> = ({ position, rotation = [0, 0, 0] }) => (
  <group position={position} rotation={rotation}>
    {/* Outer duct ring */}
    <mesh>
      <torusGeometry args={[0.32, 0.065, 10, 22]} />
      <meshStandardMaterial {...MAT.thruster} />
    </mesh>
    {/* Stator vanes × 3 */}
    {[0, 1, 2].map((i) => (
      <mesh key={i} rotation={[0, (Math.PI * 2 * i) / 3, 0]}>
        <boxGeometry args={[0.65, 0.022, 0.06]} />
        <meshStandardMaterial {...MAT.steelDark} />
      </mesh>
    ))}
    {/* Propeller blades × 3 */}
    {[0, 1, 2].map((i) => (
      <mesh
        key={`b${i}`}
        position={[Math.cos((Math.PI * 2 * i) / 3) * 0.18, 0, Math.sin((Math.PI * 2 * i) / 3) * 0.18]}
        rotation={[Math.PI * 0.15, (Math.PI * 2 * i) / 3, 0]}
      >
        <boxGeometry args={[0.28, 0.018, 0.09]} />
        <meshStandardMaterial {...MAT.titanium} />
      </mesh>
    ))}
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// CABLE GLAND — realistic umbilical connector port
// ─────────────────────────────────────────────────────────────────────────────
const CableGland: FC<{ position: [number, number, number]; rotation?: [number, number, number] }> = ({
  position,
  rotation = [0, 0, 0],
}) => (
  <group position={position} rotation={rotation}>
    <mesh>
      <cylinderGeometry args={[0.08, 0.10, 0.18, 10]} />
      <meshStandardMaterial {...MAT.steelDark} />
    </mesh>
    <mesh position={[0, -0.14, 0]}>
      <cylinderGeometry args={[0.05, 0.05, 0.28, 8]} />
      <meshStandardMaterial {...MAT.cableBlack} />
    </mesh>
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// HYDROPHONE TRANSDUCER HEAD — cylindrical acoustic sensing element
// ─────────────────────────────────────────────────────────────────────────────
const HydrophoneHead: FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  radius?: number;
}> = ({ position, rotation = [0, 0, 0], radius = 0.22 }) => (
  <group position={position} rotation={rotation}>
    {/* Stalk */}
    <mesh>
      <cylinderGeometry args={[radius * 0.45, radius * 0.45, 0.45, 16]} />
      <meshStandardMaterial {...MAT.hull} />
    </mesh>
    {/* Transducer dome */}
    <mesh position={[0, 0.32, 0]}>
      <sphereGeometry args={[radius, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
      <meshStandardMaterial {...MAT.transducer} />
    </mesh>
    {/* Ceramic ring */}
    <mesh position={[0, 0.22, 0]}>
      <torusGeometry args={[radius * 0.72, 0.028, 8, 18]} />
      <meshStandardMaterial color="#5a4a3a" roughness={0.9} metalness={0.1} />
    </mesh>
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// PRESSURE HOUSING — standard cylindrical hull section used across all devices
// ─────────────────────────────────────────────────────────────────────────────
const PressureHousing: FC<{
  radius: number;
  length: number;
  color?: string;
  roughness?: number;
  metalness?: number;
}> = ({ radius, length, color = MAT.hull.color, roughness = MAT.hull.roughness, metalness = MAT.hull.metalness }) => (
  <group>
    {/* Main tube */}
    <mesh>
      <cylinderGeometry args={[radius, radius, length, 24]} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
    {/* Fore end cap */}
    <mesh position={[0, length * 0.5, 0]}>
      <cylinderGeometry args={[radius * 0.98, radius * 0.98, radius * 0.28, 24]} />
      <meshStandardMaterial {...MAT.endcap} />
    </mesh>
    {/* Aft end cap */}
    <mesh position={[0, -length * 0.5, 0]}>
      <cylinderGeometry args={[radius * 0.98, radius * 0.98, radius * 0.28, 24]} />
      <meshStandardMaterial {...MAT.endcap} />
    </mesh>
    {/* Circumferential O-ring grooves × 2 */}
    {[-length * 0.28, length * 0.28].map((y, i) => (
      <mesh key={i} position={[0, y, 0]}>
        <torusGeometry args={[radius + 0.012, 0.022, 8, 24]} />
        <meshStandardMaterial color="#222222" roughness={0.95} metalness={0.3} />
      </mesh>
    ))}
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// SEABED TRIPOD FRAME — mounting base for seabed-resting sensors
// ─────────────────────────────────────────────────────────────────────────────
const TripodFrame: FC<{ spread?: number; height?: number }> = ({ spread = 1.6, height = 0.8 }) => {
  const angles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  return (
    <group>
      {angles.map((angle, i) => {
        const fx = Math.cos(angle) * spread;
        const fz = Math.sin(angle) * spread;
        return (
          <group key={i}>
            {/* Leg */}
            <mesh
              position={[fx * 0.5, -height * 0.5, fz * 0.5]}
              rotation={[
                Math.atan2(Math.sqrt(fx * fx + fz * fz), height),
                -angle,
                0,
              ]}
            >
              <cylinderGeometry args={[0.05, 0.07, Math.sqrt(fx * fx + height * height + fz * fz), 8]} />
              <meshStandardMaterial {...MAT.steelDark} />
            </mesh>
            {/* Foot pad */}
            <mesh position={[fx, -height, fz]}>
              <cylinderGeometry args={[0.22, 0.28, 0.06, 10]} />
              <meshStandardMaterial {...MAT.composite} />
            </mesh>
          </group>
        );
      })}
      {/* Central collar ring */}
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[spread * 0.45, 0.05, 8, 18]} />
        <meshStandardMaterial {...MAT.steelDark} />
      </mesh>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. AUV MODEL — torpedo-style autonomous underwater vehicle
//    Modelled after real REMUS/Bluefin-class AUVs
// ─────────────────────────────────────────────────────────────────────────────
const AuvModel: FC<{ node: HardwareNode }> = ({ node }) => {
  const groupRef = useRef<THREE.Group>(null);
  const propRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    const isAuv1 = node.id === 'auv-01';
    const travelSpan = isAuv1 ? 40 : 55;

    groupRef.current.position.x = node.position[0] + Math.sin(t * 0.20) * travelSpan;
    groupRef.current.position.y = node.position[1] + Math.sin(t * 0.55) * 0.8;
    groupRef.current.position.z = node.position[2] + Math.cos(t * 0.16) * 20;
    groupRef.current.rotation.y = (node.rotation?.[1] ?? 0) + Math.cos(t * 0.20) * 0.12;
    groupRef.current.rotation.z = Math.sin(t * 0.38) * 0.03;

    // Spin propeller
    if (propRef.current) {
      propRef.current.rotation.y += 0.12;
    }
  });

  // Hull length 5.5m, diameter 0.53m  (REMUS 600-like proportions)
  const R = 0.53;   // hull radius

  return (
    <group ref={groupRef} scale={[18, 18, 18]} position={node.position} rotation={node.rotation ?? [0, 0, 0]}>

      {/* ── MAIN PRESSURE HULL ─────────────────────────────────────────── */}
      {/* Forward sensor section — white composite */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 1.4]}>
        <cylinderGeometry args={[R * 0.88, R, 1.1, 24]} />
        <meshStandardMaterial {...MAT.whiteCompo} />
      </mesh>

      {/* Central electronics hull — dark anodized aluminum */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.3]}>
        <cylinderGeometry args={[R, R, 2.6, 24]} />
        <meshStandardMaterial {...MAT.hull} />
      </mesh>

      {/* Safety orange band at mid-hull */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.28]}>
        <cylinderGeometry args={[R + 0.01, R + 0.01, 0.26, 24]} />
        <meshStandardMaterial {...MAT.safetyOrange} />
      </mesh>

      {/* Aft propulsion hull — dark */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -1.95]}>
        <cylinderGeometry args={[R * 0.92, R, 1.4, 24]} />
        <meshStandardMaterial {...MAT.hull} />
      </mesh>

      {/* Nose ogive (acoustic/sonar dome) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2.15]}>
        <coneGeometry args={[R * 0.88, 1.0, 24]} />
        <meshStandardMaterial color="#c8cfd8" roughness={0.25} metalness={0.10} />
      </mesh>

      {/* Fore end cap ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 1.95]}>
        <torusGeometry args={[R * 0.86, 0.048, 8, 24]} />
        <meshStandardMaterial {...MAT.endcap} />
      </mesh>

      {/* ── TAIL FAIRING & PROPULSION ──────────────────────────────────── */}
      {/* Tail cone */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -2.8]}>
        <coneGeometry args={[R * 0.75, 0.75, 24]} />
        <meshStandardMaterial {...MAT.hull} />
      </mesh>

      {/* Propulsor shroud ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -3.1]}>
        <torusGeometry args={[R * 0.52, 0.07, 10, 22]} />
        <meshStandardMaterial {...MAT.steelDark} />
      </mesh>

      {/* Propeller */}
      <group ref={propRef} position={[0, 0, -3.1]} rotation={[Math.PI / 2, 0, 0]}>
        <PropellerAssembly blades={5} radius={R * 0.92} />
      </group>

      {/* ── CONTROL SURFACES ───────────────────────────────────────────── */}
      {/* Cruciform X-fins at tail — 4 fins */}
      {[0, 1, 2, 3].map((i) => {
        const angle = (Math.PI / 2) * i + Math.PI / 4;
        return (
          <mesh
            key={i}
            position={[Math.cos(angle) * (R + 0.28), Math.sin(angle) * (R + 0.28), -2.5]}
            rotation={[0, 0, angle]}
          >
            <boxGeometry args={[0.58, 0.025, 0.48]} />
            <meshStandardMaterial {...MAT.hull} />
          </mesh>
        );
      })}

      {/* Mid-body horizontal dive planes */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (R + 0.22), 0, 0.9]}>
          <boxGeometry args={[0.44, 0.022, 0.32]} />
          <meshStandardMaterial {...MAT.hull} />
        </mesh>
      ))}

      {/* ── DORSAL SENSOR SPINE ────────────────────────────────────────── */}
      {/* GPS/Acoustic modem antenna mast */}
      <mesh position={[0, R + 0.12, 0.4]}>
        <cylinderGeometry args={[0.055, 0.06, 0.32, 12]} />
        <meshStandardMaterial {...MAT.composite} />
      </mesh>
      {/* Modem transducer cap */}
      <mesh position={[0, R + 0.35, 0.4]}>
        <sphereGeometry args={[0.10, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
        <meshStandardMaterial {...MAT.transducer} />
      </mesh>

      {/* DVL (Doppler Velocity Log) on keel */}
      <mesh position={[0, -R - 0.05, 0.1]}>
        <boxGeometry args={[0.22, 0.12, 0.26]} />
        <meshStandardMaterial {...MAT.composite} />
      </mesh>

      {/* Forward lights × 2 */}
      {[-0.18, 0.18].map((x, i) => (
        <mesh key={i} position={[x, R * 0.3, 2.0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.06, 10]} />
          <meshStandardMaterial color="#e0f0ff" emissive="#88bbff" emissiveIntensity={1.8} roughness={0.05} />
        </mesh>
      ))}
      <LightBeam position={[0, R * 0.3, 10.5]} rotation={[-Math.PI / 2, 0, 0]} length={16} radius={3.8} />

      {/* Status LED on dorsal mast */}
      <StatusLED status={node.status} position={[0, R + 0.55, 0.4]} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. ROV MODEL — open-frame inspection/workclass ROV
//    Modelled after VideoRay Defender / Schilling UHD class
// ─────────────────────────────────────────────────────────────────────────────
const RovModel: FC<{ node: HardwareNode }> = ({ node }) => {
  const rovRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!rovRef.current) return;
    const t = state.clock.getElapsedTime();
    rovRef.current.position.y = node.position[1] + Math.sin(t * 0.85) * 0.25;
    rovRef.current.position.x = node.position[0] + Math.sin(t * 0.38) * 1.0;
  });

  // Frame dimensions: 2.6W × 1.5H × 2.8L
  const FW = 1.3; // half-width
  const FH = 0.75; // half-height
  const FL = 1.4; // half-length

  // frameTube: draw a cylinder between two 3D points using quaternion rotation
  const frameTube = (
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number
  ) => {
    const start = new THREE.Vector3(ax, ay, az);
    const end   = new THREE.Vector3(bx, by, bz);
    const dir   = new THREE.Vector3().subVectors(end, start);
    const len   = dir.length();
    const mid   = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    // Cylinder default axis is Y — rotate Y axis to align with dir
    const quat  = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const euler = new THREE.Euler().setFromQuaternion(quat);
    return (
      <mesh position={[mid.x, mid.y, mid.z]} rotation={[euler.x, euler.y, euler.z]}>
        <cylinderGeometry args={[0.038, 0.038, len, 8]} />
        <meshStandardMaterial {...MAT.titanium} />
      </mesh>
    );
  };

  return (
    <group ref={rovRef} scale={[16.5, 16.5, 16.5]} position={node.position} rotation={node.rotation ?? [0, 0, 0]}>

      {/* ── OPEN FRAME ─────────────────────────────────────────────────── */}
      {/* 12-edge rectangular frame */}
      {/* Bottom rails */}
      {frameTube(-FW, -FH,  FL,  FW, -FH,  FL)}
      {frameTube(-FW, -FH, -FL,  FW, -FH, -FL)}
      {frameTube(-FW, -FH, -FL, -FW, -FH,  FL)}
      {frameTube( FW, -FH, -FL,  FW, -FH,  FL)}
      {/* Top rails */}
      {frameTube(-FW,  FH,  FL,  FW,  FH,  FL)}
      {frameTube(-FW,  FH, -FL,  FW,  FH, -FL)}
      {frameTube(-FW,  FH, -FL, -FW,  FH,  FL)}
      {frameTube( FW,  FH, -FL,  FW,  FH,  FL)}
      {/* Vertical posts × 4 */}
      {frameTube(-FW, -FH,  FL, -FW,  FH,  FL)}
      {frameTube( FW, -FH,  FL,  FW,  FH,  FL)}
      {frameTube(-FW, -FH, -FL, -FW,  FH, -FL)}
      {frameTube( FW, -FH, -FL,  FW,  FH, -FL)}
      {/* Mid cross-braces */}
      {frameTube(-FW, 0, 0,  FW, 0, 0)}
      {frameTube(0, -FH, 0, 0, FH, 0)}

      {/* ── SYNTACTIC BUOYANCY FOAM BLOCK ──────────────────────────────── */}
      <mesh position={[0, FH + 0.22, 0]}>
        <boxGeometry args={[FW * 1.7, 0.44, FL * 1.6]} />
        <meshStandardMaterial {...MAT.foam} />
      </mesh>

      {/* ── ELECTRONICS PRESSURE HOUSINGS × 2 ─────────────────────────── */}
      <group position={[0, 0, 0]}>
        {/* Main electronics canister — horizontal */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <PressureHousing radius={0.28} length={1.9} color={MAT.hull.color} />
        </mesh>
        {/* Battery pod */}
        <mesh position={[0, -FH + 0.28, -FL * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
          <PressureHousing radius={0.22} length={1.2} color={MAT.composite.color} roughness={0.75} metalness={0.2} />
        </mesh>
      </group>

      {/* ── THRUSTERS ─────────────────────────────────────────────────── */}
      {/* 4 horizontal vector thrusters */}
      <ThrusterDuct position={[-FW + 0.05, 0.1, FL - 0.2]} rotation={[0, Math.PI * 0.25, Math.PI / 2]} />
      <ThrusterDuct position={[ FW - 0.05, 0.1, FL - 0.2]} rotation={[0, -Math.PI * 0.25, Math.PI / 2]} />
      <ThrusterDuct position={[-FW + 0.05, 0.1, -FL + 0.2]} rotation={[0, -Math.PI * 0.25, Math.PI / 2]} />
      <ThrusterDuct position={[ FW - 0.05, 0.1, -FL + 0.2]} rotation={[0, Math.PI * 0.25, Math.PI / 2]} />
      {/* 2 vertical thrusters */}
      <ThrusterDuct position={[-FW * 0.5, FH - 0.08, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <ThrusterDuct position={[ FW * 0.5, FH - 0.08, 0]} rotation={[Math.PI / 2, 0, 0]} />

      {/* ── CAMERA & SENSOR HEAD ───────────────────────────────────────── */}
      <group position={[0, 0.1, FL + 0.08]}>
        {/* Pan-tilt housing */}
        <mesh>
          <boxGeometry args={[0.42, 0.34, 0.30]} />
          <meshStandardMaterial {...MAT.composite} />
        </mesh>
        {/* Camera glass port */}
        <mesh position={[0, 0, 0.17]}>
          <cylinderGeometry args={[0.11, 0.11, 0.045, 16]} />
          <meshStandardMaterial {...MAT.glass} transparent opacity={0.55} />
        </mesh>
        {/* LED ring */}
        <mesh position={[0, 0, 0.16]}>
          <torusGeometry args={[0.14, 0.022, 8, 18]} />
          <meshStandardMaterial color="#f0f8ff" emissive="#aaddff" emissiveIntensity={1.5} />
        </mesh>
        <LightBeam position={[0, 0, 9]} rotation={[-Math.PI / 2, 0, 0]} length={14} radius={3.2} />
        {/* Sonar head */}
        <mesh position={[0, 0.32, 0]}>
          <cylinderGeometry args={[0.10, 0.12, 0.22, 14]} />
          <meshStandardMaterial {...MAT.transducer} />
        </mesh>
      </group>

      {/* ── MANIPULATOR ARM ────────────────────────────────────────────── */}
      <group position={[FW * 0.45, -FH + 0.2, FL * 0.75]}>
        {/* Upper arm */}
        <mesh position={[0, 0, 0.38]} rotation={[0.55, 0, 0]}>
          <boxGeometry args={[0.12, 0.10, 0.78]} />
          <meshStandardMaterial {...MAT.steelDark} />
        </mesh>
        {/* Forearm */}
        <mesh position={[0, -0.22, 0.80]} rotation={[-0.45, 0, 0]}>
          <boxGeometry args={[0.09, 0.08, 0.62]} />
          <meshStandardMaterial {...MAT.hull} />
        </mesh>
        {/* Gripper jaw × 2 */}
        {[-0.06, 0.06].map((dx, i) => (
          <mesh key={i} position={[dx, -0.38, 1.12]} rotation={[0, 0, dx > 0 ? 0.3 : -0.3]}>
            <boxGeometry args={[0.04, 0.06, 0.22]} />
            <meshStandardMaterial {...MAT.titanium} />
          </mesh>
        ))}
      </group>

      {/* ── TETHER ENTRY POINT ─────────────────────────────────────────── */}
      <CableGland position={[0, FH + 0.1, -FL + 0.2]} rotation={[Math.PI, 0, 0]} />

      {/* ── ACOUSTIC MODEM ─────────────────────────────────────────────── */}
      <HydrophoneHead position={[0, FH + 0.72, -FL * 0.3]} radius={0.18} />

      {/* Status LED */}
      <StatusLED status={node.status} position={[0, FH + 0.6, FL]} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. BENTHIC SENSOR NODE — seabed-mounted acoustic monitoring station
//    Variant 1: Tripod lander with hydrophone array
// ─────────────────────────────────────────────────────────────────────────────
const SensorNodeV1: FC<{ node: HardwareNode }> = ({ node }) => (
  <group scale={[20, 20, 20]} position={node.position}>
    {/* Tripod mounting frame */}
    <TripodFrame spread={1.8} height={0.85} />

    {/* Main pressure housing — vertical */}
    <group position={[0, 0.85, 0]}>
      <PressureHousing radius={0.22} length={1.65} color={MAT.hull.color} />
    </group>

    {/* Safety band stripe */}
    <mesh position={[0, 0.95, 0]}>
      <cylinderGeometry args={[0.235, 0.235, 0.22, 20]} />
      <meshStandardMaterial {...MAT.safetyOrange} />
    </mesh>

    {/* Hydrophone array — 3 transducers at top */}
    {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
      <group
        key={i}
        position={[Math.cos(angle) * 0.28, 1.95, Math.sin(angle) * 0.28]}
        rotation={[0, -angle, 0]}
      >
        <mesh>
          <cylinderGeometry args={[0.055, 0.055, 0.40, 12]} />
          <meshStandardMaterial {...MAT.composite} />
        </mesh>
        <mesh position={[0, 0.28, 0]}>
          <sphereGeometry args={[0.075, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
          <meshStandardMaterial {...MAT.transducer} />
        </mesh>
      </group>
    ))}

    {/* Top omni hydrophone */}
    <HydrophoneHead position={[0, 2.05, 0]} radius={0.16} />

    {/* Cable gland on side */}
    <CableGland position={[0.23, 0.85, 0]} rotation={[0, 0, -Math.PI / 2]} />

    {/* Status LED */}
    <StatusLED status={node.status} position={[0, 2.58, 0]} />
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// 3B. SUBSEA ACOUSTIC FRAME NODE (Variant 2) — frame-mounted modem
// ─────────────────────────────────────────────────────────────────────────────
const SensorNodeV2: FC<{ node: HardwareNode }> = ({ node }) => (
  <group scale={[20, 20, 20]} position={node.position}>
    {/* Rectangular seabed baseplate */}
    <mesh position={[0, 0.05, 0]}>
      <boxGeometry args={[2.1, 0.10, 2.1]} />
      <meshStandardMaterial {...MAT.composite} />
    </mesh>

    {/* 4 corner posts */}
    {[[-0.75, 0.75], [0.75, 0.75], [-0.75, -0.75], [0.75, -0.75]].map(([px, pz], i) => (
      <mesh key={i} position={[px, 0.65, pz]}>
        <cylinderGeometry args={[0.055, 0.055, 1.2, 8]} />
        <meshStandardMaterial {...MAT.titanium} />
      </mesh>
    ))}

    {/* Cross-brace */}
    <mesh position={[0, 0.5, 0]} rotation={[0, Math.PI / 4, 0]}>
      <boxGeometry args={[2.0, 0.045, 0.06]} />
      <meshStandardMaterial {...MAT.steelDark} />
    </mesh>
    <mesh position={[0, 0.5, 0]} rotation={[0, -Math.PI / 4, 0]}>
      <boxGeometry args={[2.0, 0.045, 0.06]} />
      <meshStandardMaterial {...MAT.steelDark} />
    </mesh>

    {/* Central acoustic modem housing */}
    <group position={[0, 1.1, 0]}>
      <PressureHousing radius={0.26} length={1.1} color={MAT.hull.color} />
    </group>

    {/* Upward-facing ADCP-style transducer head */}
    <mesh position={[0, 1.82, 0]}>
      <cylinderGeometry args={[0.24, 0.20, 0.28, 18]} />
      <meshStandardMaterial {...MAT.transducer} />
    </mesh>
    {/* 4 angled ADCP beams */}
    {[0, 1, 2, 3].map((i) => {
      const a = (Math.PI / 2) * i;
      return (
        <mesh
          key={i}
          position={[Math.cos(a) * 0.16, 1.92, Math.sin(a) * 0.16]}
          rotation={[0.38 * (i % 2 === 0 ? 1 : -1), a, 0]}
        >
          <cylinderGeometry args={[0.038, 0.038, 0.18, 8]} />
          <meshStandardMaterial {...MAT.transducer} />
        </mesh>
      );
    })}

    {/* Side cable gland */}
    <CableGland position={[0.27, 1.1, 0]} rotation={[0, 0, -Math.PI / 2]} />

    {/* Status LED */}
    <StatusLED status={node.status} position={[0, 2.25, 0]} />
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// 3C. ADCP BENTHIC NODE (Variant 3) — current profiler on anchor frame
// ─────────────────────────────────────────────────────────────────────────────
const SensorNodeV3: FC<{ node: HardwareNode }> = ({ node }) => (
  <group scale={[20, 20, 20]} position={node.position}>
    {/* Heavy anchor weight ring */}
    <mesh position={[0, 0.12, 0]}>
      <cylinderGeometry args={[1.05, 1.30, 0.22, 8]} />
      <meshStandardMaterial {...MAT.composite} />
    </mesh>

    {/* Recovery sphere (yellow buoyancy) */}
    <mesh position={[0.68, 0.5, 0]}>
      <sphereGeometry args={[0.28, 14, 14]} />
      <meshStandardMaterial {...MAT.safetyYellow} />
    </mesh>

    {/* ADCP instrument cylinder */}
    <group position={[0, 0.85, 0]}>
      <PressureHousing radius={0.30} length={1.22} color={MAT.hull.color} />
    </group>

    {/* ADCP top face with 4-beam transducers */}
    <mesh position={[0, 1.62, 0]}>
      <cylinderGeometry args={[0.28, 0.26, 0.18, 16]} />
      <meshStandardMaterial {...MAT.transducer} />
    </mesh>
    {[0, 1, 2, 3].map((i) => {
      const angle = (Math.PI / 2) * i + Math.PI / 4;
      return (
        <mesh
          key={i}
          position={[Math.cos(angle) * 0.18, 1.72, Math.sin(angle) * 0.18]}
          rotation={[0.4 * (i % 2 === 0 ? 1 : -1), angle, 0]}
        >
          <cylinderGeometry args={[0.048, 0.048, 0.16, 10]} />
          <meshStandardMaterial {...MAT.transducer} />
        </mesh>
      );
    })}

    {/* Mooring riser tube upward */}
    <mesh position={[0, 2.2, 0]}>
      <cylinderGeometry args={[0.055, 0.055, 0.65, 10]} />
      <meshStandardMaterial {...MAT.steelDark} />
    </mesh>

    <StatusLED status={node.status} position={[0, 2.62, 0]} />
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// SensorNodeMesh router — selects variant
// ─────────────────────────────────────────────────────────────────────────────
const SensorNodeMesh: FC<{ node: HardwareNode }> = ({ node }) => {
  if (node.variant === 2) return <SensorNodeV2 node={node} />;
  if (node.variant === 3) return <SensorNodeV3 node={node} />;
  return <SensorNodeV1 node={node} />;
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. MOORED ACOUSTIC RELAY BUOY — subsurface oceanographic mooring
// ─────────────────────────────────────────────────────────────────────────────
const RelayNodeMesh: FC<{ node: HardwareNode }> = ({ node }) => {
  const buoyRef = useRef<THREE.Group>(null);
  const anchorY = -400;  // Abyssal plain in new world scale
  const tetherLen = node.position[1] - anchorY;

  useFrame((state) => {
    if (!buoyRef.current) return;
    const t = state.clock.getElapsedTime();
    buoyRef.current.position.x = node.position[0] + Math.sin(t * 1.05) * 0.3;
    buoyRef.current.position.z = node.position[2] + Math.cos(t * 0.88) * 0.3;
  });

  return (
    <group>
      {/* ── ANCHOR CLUMP WEIGHT ─────────────────────────────────────────── */}
      <mesh position={[node.position[0], anchorY + 0.25, node.position[2]]}>
        <boxGeometry args={[1.8, 0.42, 1.8]} />
        <meshStandardMaterial {...MAT.composite} />
      </mesh>
      {/* Chain links × 4 near anchor */}
      {[0.5, 1.1, 1.7, 2.3].map((dy, i) => (
        <mesh key={i} position={[node.position[0], anchorY + dy, node.position[2]]} rotation={[0, i * 0.5, 0]}>
          <torusGeometry args={[0.09, 0.032, 7, 12]} />
          <meshStandardMaterial {...MAT.steelDark} />
        </mesh>
      ))}

      {/* ── MOORING WIRE ────────────────────────────────────────────────── */}
      <mesh position={[node.position[0], anchorY + tetherLen * 0.5, node.position[2]]}>
        <cylinderGeometry args={[0.020, 0.020, tetherLen - 2, 6]} />
        <meshStandardMaterial {...MAT.cableBlack} />
      </mesh>

      {/* ── FLOAT BODY ──────────────────────────────────────────────────── */}
      <group ref={buoyRef} scale={[18, 18, 18]} position={node.position}>
        {/* Main glass sphere float — oceanographic yellow */}
        <mesh>
          <sphereGeometry args={[0.82, 22, 22]} />
          <meshStandardMaterial {...MAT.safetyYellow} />
        </mesh>
        {/* Equatorial stainless harness band */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.84, 0.055, 8, 24]} />
          <meshStandardMaterial {...MAT.titanium} />
        </mesh>
        {/* Retaining D-ring at top */}
        <mesh position={[0, 0.88, 0]}>
          <torusGeometry args={[0.16, 0.038, 8, 12]} />
          <meshStandardMaterial {...MAT.titanium} />
        </mesh>

        {/* Acoustic modem transducer stalk */}
        <mesh position={[0, 1.12, 0]}>
          <cylinderGeometry args={[0.07, 0.08, 0.50, 14]} />
          <meshStandardMaterial {...MAT.composite} />
        </mesh>
        <mesh position={[0, 1.48, 0]}>
          <sphereGeometry args={[0.14, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.8]} />
          <meshStandardMaterial {...MAT.transducer} />
        </mesh>

        {/* Downward transducer */}
        <mesh position={[0, -1.02, 0]} rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[0.10, 0.12, 0.24, 14]} />
          <meshStandardMaterial {...MAT.transducer} />
        </mesh>

        {/* Status LED */}
        <StatusLED status={node.status} position={[0, 1.72, 0]} />
      </group>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. SURFACE TELEMETRY SPAR BUOY — oceanographic surface platform
// ─────────────────────────────────────────────────────────────────────────────
const SurfaceBuoyMesh: FC<{ node: HardwareNode }> = ({ node }) => {
  const buoyGroup = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!buoyGroup.current) return;
    const t = state.clock.getElapsedTime();
    buoyGroup.current.position.y = node.position[1] + Math.sin(t * 1.35) * 0.55;
    buoyGroup.current.rotation.z = Math.sin(t * 1.15) * 0.06;
    buoyGroup.current.rotation.x = Math.cos(t * 0.9) * 0.04;
  });

  return (
    <group ref={buoyGroup} scale={[15, 15, 15]} position={node.position}>
      {/* ── TOROIDAL HULL ────────────────────────────────────────────────── */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.55, 0.52, 14, 28]} />
        <meshStandardMaterial {...MAT.safetyOrange} />
      </mesh>

      {/* Stainless deck grating */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.55, 1.55, 0.12, 24]} />
        <meshStandardMaterial {...MAT.titanium} />
      </mesh>

      {/* ── MAST ASSEMBLY ────────────────────────────────────────────────── */}
      {/* Main spar mast */}
      <mesh position={[0, 2.5, 0]}>
        <cylinderGeometry args={[0.095, 0.12, 4.0, 14]} />
        <meshStandardMaterial {...MAT.steelDark} />
      </mesh>

      {/* Solar panel array */}
      <mesh position={[0.65, 3.6, 0]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[1.0, 0.06, 0.6]} />
        <meshStandardMaterial color="#1a2a5a" roughness={0.3} metalness={0.6} />
      </mesh>
      <mesh position={[-0.65, 3.6, 0]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[1.0, 0.06, 0.6]} />
        <meshStandardMaterial color="#1a2a5a" roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Iridium/GPS antenna dome */}
      <mesh position={[0, 4.62, 0]}>
        <sphereGeometry args={[0.18, 14, 14]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* VHF antenna whip */}
      <mesh position={[0, 5.4, 0]}>
        <cylinderGeometry args={[0.018, 0.010, 1.55, 8]} />
        <meshStandardMaterial {...MAT.titanium} />
      </mesh>

      {/* ── UNDERWATER ACOUSTIC MODEM (keel-side) ──────────────────────── */}
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.55, 16]} />
        <meshStandardMaterial {...MAT.composite} />
      </mesh>
      <mesh position={[0, -1.9, 0]}>
        <sphereGeometry args={[0.18, 14, 14, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.7]} />
        <meshStandardMaterial {...MAT.transducer} />
      </mesh>

      {/* Keel weight */}
      <mesh position={[0, -2.8, 0]}>
        <cylinderGeometry args={[0.20, 0.28, 0.70, 14]} />
        <meshStandardMaterial {...MAT.composite} />
      </mesh>

      {/* ── MOORING TETHER ───────────────────────────────────────────────── */}
      {/* Thin cable extending downward to seabed anchor (~1800m real) */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, -3.2, 0,  0, -55, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#505860" transparent opacity={0.6} />
      </line>

      {/* Mooring swivel at bottom of tether */}
      <mesh position={[0, -55, 0]}>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshStandardMaterial {...MAT.steelDark} />
      </mesh>

      {/* Status LED */}
      <StatusLED status={node.status} position={[0, 4.88, 0]} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. SUBSEA MASTER GATEWAY STATION — large deep-ocean communication hub
// ─────────────────────────────────────────────────────────────────────────────
const GatewayNodeMesh: FC<{ node: HardwareNode }> = ({ node }) => (
  <group scale={[16.5, 16.5, 16.5]} position={node.position} rotation={node.rotation ?? [0, 0, 0]}>

    {/* ── SEABED FOUNDATION SKID ─────────────────────────────────────── */}
    <mesh position={[0, 0.10, 0]}>
      <boxGeometry args={[5.5, 0.18, 4.2]} />
      <meshStandardMaterial {...MAT.composite} />
    </mesh>
    {/* Corner footpads × 4 */}
    {[[-2.3, -1.6], [2.3, -1.6], [-2.3, 1.6], [2.3, 1.6]].map(([px, pz], i) => (
      <mesh key={i} position={[px, 0.06, pz]}>
        <cylinderGeometry args={[0.36, 0.48, 0.10, 10]} />
        <meshStandardMaterial {...MAT.composite} />
      </mesh>
    ))}

    {/* ── MAIN ELECTRONICS VAULT ─────────────────────────────────────── */}
    {/* Primary electronics pressure housing (horizontal, large) */}
    <mesh position={[0, 0.88, 0]} rotation={[0, 0, Math.PI / 2]}>
      <PressureHousing radius={0.52} length={4.2} color={MAT.hull.color} />
    </mesh>

    {/* Secondary battery/power housing */}
    <mesh position={[0, 0.88, -1.4]} rotation={[0, 0, Math.PI / 2]}>
      <PressureHousing radius={0.38} length={3.0} color={MAT.composite.color} roughness={0.75} metalness={0.2} />
    </mesh>

    {/* Safety orange identification band */}
    <mesh position={[0, 0.88, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.535, 0.535, 0.35, 24]} />
      <meshStandardMaterial {...MAT.safetyOrange} />
    </mesh>

    {/* ── ACOUSTIC TRANSDUCER TOWER ──────────────────────────────────── */}
    {/* Vertical mast */}
    <mesh position={[-1.2, 2.8, 0]}>
      <cylinderGeometry args={[0.095, 0.10, 3.0, 16]} />
      <meshStandardMaterial {...MAT.steelDark} />
    </mesh>

    {/* Parabolic acoustic dish */}
    <mesh position={[-1.2, 4.5, 0.6]} rotation={[0.35, -0.5, 0]}>
      <cylinderGeometry args={[0.90, 0.10, 0.45, 24, 1, true]} />
      <meshStandardMaterial
        color="#4a4f5c"
        roughness={0.25}
        metalness={0.95}
        side={THREE.DoubleSide}
      />
    </mesh>
    {/* Dish backing brace */}
    <mesh position={[-1.2, 4.3, 0.4]} rotation={[0.35, -0.5, 0]}>
      <cylinderGeometry args={[0.75, 0.08, 0.12, 14, 1, true]} />
      <meshStandardMaterial {...MAT.titanium} />
    </mesh>

    {/* ── OMNI HYDROPHONE ARRAY ──────────────────────────────────────── */}
    {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
      <group key={i} position={[Math.cos(angle) * 0.5, 2.1, Math.sin(angle) * 0.5]}>
        <mesh>
          <cylinderGeometry args={[0.065, 0.065, 0.85, 12]} />
          <meshStandardMaterial {...MAT.composite} />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <sphereGeometry args={[0.10, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
          <meshStandardMaterial {...MAT.transducer} />
        </mesh>
      </group>
    ))}

    {/* ── STRUCTURAL FRAME ───────────────────────────────────────────── */}
    {/* Vertical corner columns */}
    {[[-2.0, -1.5], [2.0, -1.5], [-2.0, 1.5], [2.0, 1.5]].map(([px, pz], i) => (
      <mesh key={i} position={[px, 1.0, pz]}>
        <cylinderGeometry args={[0.07, 0.07, 2.2, 10]} />
        <meshStandardMaterial {...MAT.titanium} />
      </mesh>
    ))}
    {/* Top brace rails */}
    <mesh position={[0, 2.15, -1.5]}>
      <boxGeometry args={[4.2, 0.06, 0.06]} />
      <meshStandardMaterial {...MAT.titanium} />
    </mesh>
    <mesh position={[0, 2.15, 1.5]}>
      <boxGeometry args={[4.2, 0.06, 0.06]} />
      <meshStandardMaterial {...MAT.titanium} />
    </mesh>

    {/* ── UMBILICAL CONNECTIONS ──────────────────────────────────────── */}
    <CableGland position={[2.2, 0.55, 0]} rotation={[0, 0, -Math.PI / 2]} />
    <CableGland position={[2.2, 0.55, 0.5]} rotation={[0, 0, -Math.PI / 2]} />
    <CableGland position={[2.2, 0.55, -0.5]} rotation={[0, 0, -Math.PI / 2]} />

    {/* ── STATUS INDICATORS ──────────────────────────────────────────── */}
    {/* LED strip on housing */}
    {[-1.2, -0.4, 0.4, 1.2].map((x, i) => (
      <StatusLED key={i} status={node.status} position={[x, 1.48, 0]} />
    ))}
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. CTD SENSOR PACKAGE — Deep ocean CTD rosette profiler
// ─────────────────────────────────────────────────────────────────────────────
const SensorPackageMesh: FC<{ node: HardwareNode }> = ({ node }) => (
  <group scale={[18, 18, 18]} position={node.position} rotation={node.rotation ?? [0, 0, 0]}>
    {/* Carry frame baseplate */}
    <mesh position={[0, 0.12, 0]}>
      <cylinderGeometry args={[1.15, 1.15, 0.22, 14]} />
      <meshStandardMaterial {...MAT.composite} />
    </mesh>

    {/* Central CTD pressure housing (vertical) */}
    <group position={[0, 1.15, 0]}>
      <PressureHousing radius={0.28} length={1.65} color={MAT.hull.color} />
    </group>

    {/* Rosette sample bottles × 6 (iconic CTD look) */}
    {Array.from({ length: 6 }).map((_, i) => {
      const a = (Math.PI * 2 * i) / 6;
      return (
        <mesh key={i} position={[Math.cos(a) * 0.72, 1.15, Math.sin(a) * 0.72]}>
          <cylinderGeometry args={[0.095, 0.095, 1.42, 12, 1, true]} />
          <meshStandardMaterial color="#d8dde0" roughness={0.55} metalness={0.10} side={THREE.DoubleSide} />
        </mesh>
      );
    })}

    {/* Top frame ring */}
    <mesh position={[0, 2.1, 0]}>
      <torusGeometry args={[0.75, 0.055, 8, 20]} />
      <meshStandardMaterial {...MAT.titanium} />
    </mesh>

    {/* CTD sensor probes at bottom */}
    {[-0.18, 0.18].map((x, i) => (
      <mesh key={i} position={[x, 0.15, 0.0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.45, 8]} />
        <meshStandardMaterial {...MAT.composite} />
      </mesh>
    ))}

    {/* Altimeter probe */}
    <mesh position={[0, 0.15, -0.22]}>
      <cylinderGeometry args={[0.030, 0.030, 0.38, 8]} />
      <meshStandardMaterial {...MAT.transducer} />
    </mesh>

    {/* Lifting bail */}
    <mesh position={[0, 2.28, 0]}>
      <torusGeometry args={[0.22, 0.042, 8, 12]} />
      <meshStandardMaterial {...MAT.titanium} />
    </mesh>

    <StatusLED status={node.status} position={[0, 2.42, 0]} />
  </group>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — dispatches correct model per node type
// Seabed-mounted devices are snapped to the actual seabed height at their XZ.
// Free-moving vehicles (AUV, ROV, buoy) keep their original Y.
// ─────────────────────────────────────────────────────────────────────────────
const SEABED_TYPES = new Set(['sensor', 'sensor_package', 'gateway', 'relay']);

export const AcousticHardware: FC = () => (
  <group>
    {HARDWARE_NODES.map((node) => {
      // Snap seabed-mounted devices to actual seabed surface
      const displayNode: HardwareNode = SEABED_TYPES.has(node.type) ? {
        ...node,
        position: [
          node.position[0],
          seabedAtXZ(node.position[0], node.position[2]) + 10,
          node.position[2],
        ] as [number, number, number],
      } : node;

      if (displayNode.type === 'auv')            return <AuvModel          key={node.id} node={displayNode} />;
      if (displayNode.type === 'rov')            return <RovModel          key={node.id} node={displayNode} />;
      if (displayNode.type === 'sensor')         return <SensorNodeMesh    key={node.id} node={displayNode} />;
      if (displayNode.type === 'relay')          return <RelayNodeMesh     key={node.id} node={displayNode} />;
      if (displayNode.type === 'buoy')           return <SurfaceBuoyMesh   key={node.id} node={displayNode} />;
      if (displayNode.type === 'sensor_package') return <SensorPackageMesh key={node.id} node={displayNode} />;
      if (displayNode.type === 'gateway')        return <GatewayNodeMesh   key={node.id} node={displayNode} />;
      return null;
    })}
  </group>
);

