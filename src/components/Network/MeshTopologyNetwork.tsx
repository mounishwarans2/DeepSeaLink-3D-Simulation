import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';
import {
  HARDWARE_NODES,
  LAND_SERVER_POS,
  MAIN_FLOATING_NODE_POS,
  SUB_NODES,
} from '../../utils/constants';

// ─────────────────────────────────────────────────────────────────────────────
// MESH TOPOLOGY NETWORK — Full sensor-to-land-server data routing
//
// Architecture:
//   Bottom nodes (seabed sensors SN-01..SN-15)
//     ↕ mesh topology lines (faint, shows all-to-all connectivity)
//     ↓ each sensor connects to nearest sub-node
//   Sub-nodes (half-floating at ~-120 Y)
//     ↓ connect up to main floating surface node
//   Main floating node (surface, Y=95)
//     ↓ transmit to land server (bright white beam)
//
// Active data path: ONE route lights up bright white at a time,
//   cycling through source sensors every 8 seconds.
// ─────────────────────────────────────────────────────────────────────────────

const BOTTOM_NODES = HARDWARE_NODES.filter(
  (n) => n.type === 'sensor' || n.type === 'sensor_package',
);

// Find which sub-node each bottom node is closest to
function nearestSubNode(pos: [number, number, number]): number {
  let best = 0;
  let bestDist = Infinity;
  SUB_NODES.forEach((sn, i) => {
    const dx = pos[0] - sn[0], dz = pos[2] - sn[2];
    const d = dx * dx + dz * dz;
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best;
}

// Build a Float32Array of line segment endpoints
function buildLineBuffer(pairs: [[number,number,number],[number,number,number]][]): Float32Array {
  const arr = new Float32Array(pairs.length * 6);
  pairs.forEach(([a, b], i) => {
    arr[i * 6]     = a[0]; arr[i * 6 + 1] = a[1]; arr[i * 6 + 2] = a[2];
    arr[i * 6 + 3] = b[0]; arr[i * 6 + 4] = b[1]; arr[i * 6 + 5] = b[2];
  });
  return arr;
}

// ── STATIC LINE SET ───────────────────────────────────────────────────────────
// Renders a set of line segments from a pre-built Float32Array
const StaticLines: FC<{
  segments: Float32Array;
  color: string;
  opacity: number;
  linewidth?: number;
}> = ({ segments, color, opacity }) => {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const applied = useRef(false);

  useFrame(() => {
    if (applied.current || !geomRef.current) return;
    geomRef.current.setAttribute('position', new THREE.BufferAttribute(segments, 3));
    applied.current = true;
  });

  return (
    <lineSegments>
      <bufferGeometry ref={geomRef} />
      <lineBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </lineSegments>
  );
};

// ── FLOATING SURFACE BUOY (MAIN NODE) ────────────────────────────────────────
// A visible surface-floating device that receives from sub-nodes and
// transmits to land. Resembles an oceanographic spar buoy.
const MainFloatingNode: FC = () => {
  const buoyRef  = useRef<THREE.Group>(null);
  const glowRef  = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!buoyRef.current) return;
    const t = state.clock.getElapsedTime();
    // Gentle bobbing on the surface
    buoyRef.current.position.y = MAIN_FLOATING_NODE_POS[1] + Math.sin(t * 0.4) * 2.5;
    buoyRef.current.rotation.z = Math.sin(t * 0.25) * 0.04;
    buoyRef.current.rotation.x = Math.cos(t * 0.3) * 0.03;
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + Math.sin(t * 2.0) * 0.2;
    }
  });

  const [x, , z] = MAIN_FLOATING_NODE_POS;

  return (
    <group ref={buoyRef} position={[x, MAIN_FLOATING_NODE_POS[1], z]}>
      {/* Spar hull — long vertical cylinder */}
      <mesh position={[0, -20, 0]}>
        <cylinderGeometry args={[2.5, 2.8, 40, 16]} />
        <meshStandardMaterial color="#d87020" roughness={0.5} metalness={0.3} />
      </mesh>

      {/* Waterline buoyancy collar */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[5.5, 5.5, 5, 20]} />
        <meshStandardMaterial color="#f0a000" roughness={0.4} metalness={0.35} />
      </mesh>

      {/* Equipment deck */}
      <mesh position={[0, 3.5, 0]}>
        <cylinderGeometry args={[4.8, 4.8, 2, 20]} />
        <meshStandardMaterial color="#5a6678" roughness={0.45} metalness={0.6} />
      </mesh>

      {/* Antenna mast */}
      <mesh position={[0, 14, 0]}>
        <cylinderGeometry args={[0.3, 0.4, 20, 10]} />
        <meshStandardMaterial color="#808898" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Radar dome on top */}
      <mesh position={[0, 25, 0]}>
        <sphereGeometry args={[2.2, 14, 14, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color="#e8eef5" roughness={0.2} metalness={0.1} transparent opacity={0.85} />
      </mesh>

      {/* Solar panels */}
      {[-1, 1].map((side, i) => (
        <mesh key={i} position={[side * 7, 5, 0]} rotation={[0, 0, side * 0.2]}>
          <boxGeometry args={[8, 0.4, 4]} />
          <meshStandardMaterial color="#1a3080" roughness={0.3} metalness={0.5} />
        </mesh>
      ))}

      {/* Active transmission glow ring */}
      <mesh ref={glowRef} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6.5, 9, 28]} />
        <meshBasicMaterial color="#00ccff" transparent opacity={0.4} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      {/* Navigation strobe light */}
      <pointLight position={[0, 26, 0]} intensity={2.5} distance={300} color="#ff3300" decay={2} />
    </group>
  );
};

// ── SUB-NODE FLOATERS ─────────────────────────────────────────────────────────
const SubNodeFloater: FC<{ position: [number, number, number]; index: number }> = ({ position, index }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = position[1] + Math.sin(t * 0.5 + index * 1.3) * 3;
  });

  const colors = ['#2090e8', '#20d080', '#e0a020', '#d04090'];
  const col = colors[index % colors.length];

  return (
    <group ref={ref} position={position}>
      {/* Central housing */}
      <mesh>
        <sphereGeometry args={[4, 14, 14]} />
        <meshStandardMaterial color="#4a6080" roughness={0.4} metalness={0.7} />
      </mesh>
      {/* Colored band */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[4.2, 0.8, 10, 22]} />
        <meshStandardMaterial color={col} roughness={0.5} metalness={0.3} emissive={col} emissiveIntensity={0.4} />
      </mesh>
      {/* Acoustic transducer probes */}
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 5, 0, Math.sin(a) * 5]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 3, 8]} />
          <meshStandardMaterial color="#303848" roughness={0.4} metalness={0.8} />
        </mesh>
      ))}
      <pointLight intensity={0.8} distance={80} color={col} decay={2} />
    </group>
  );
};

// ── ANIMATED DATA PULSE ───────────────────────────────────────────────────────
// A glowing dot traveling along a path (array of waypoints)
const DataPulse: FC<{
  path: THREE.Vector3[];
  color: string;
  speed?: number;
  offset?: number;
}> = ({ path, color, speed = 1.0, offset = 0 }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  // Precompute cumulative arc lengths for even-speed travel
  const { arcLengths, totalLength } = useMemo(() => {
    const lengths = [0];
    for (let i = 1; i < path.length; i++) {
      lengths.push(lengths[i - 1] + path[i].distanceTo(path[i - 1]));
    }
    return { arcLengths: lengths, totalLength: lengths[lengths.length - 1] };
  }, [path]);

  useFrame((state) => {
    if (!meshRef.current || !glowRef.current) return;
    const t = (state.clock.getElapsedTime() * speed + offset) % totalLength;

    // Find segment
    let seg = 0;
    for (let i = 1; i < arcLengths.length; i++) {
      if (arcLengths[i] >= t) { seg = i - 1; break; }
    }
    const segLen = arcLengths[seg + 1] - arcLengths[seg];
    const frac   = segLen > 0 ? (t - arcLengths[seg]) / segLen : 0;
    const pos    = new THREE.Vector3().lerpVectors(path[seg], path[seg + 1] ?? path[seg], frac);

    meshRef.current.position.copy(pos);
    glowRef.current.position.copy(pos);

    const pulse = Math.sin(state.clock.getElapsedTime() * 6) * 0.5 + 0.5;
    (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + pulse * 0.4;
  });

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[3, 10, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Glow halo */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[8, 10, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export const MeshTopologyNetwork: FC = () => {
  const activeSourceIdx = useRef(0);
  const lastSwitch      = useRef(-1);
  const CYCLE_INTERVAL  = 8; // seconds per active route

  // ── PRECOMPUTE ALL LINE SEGMENTS ─────────────────────────────────────────

  // 1. Mesh lines between all bottom sensors (full mesh topology web)
  const meshSegments = useMemo(() => {
    const pairs: [[number,number,number],[number,number,number]][] = [];
    for (let i = 0; i < BOTTOM_NODES.length; i++) {
      for (let j = i + 1; j < BOTTOM_NODES.length; j++) {
        const a = BOTTOM_NODES[i].position;
        const b = BOTTOM_NODES[j].position;
        const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        // Only draw lines to relatively nearby nodes (< 800 units) for readability
        if (dist < 800) {
          pairs.push([a, b]);
        }
      }
    }
    return buildLineBuffer(pairs);
  }, []);

  // 2. Bottom node → nearest sub-node lines
  const sensorToSubSegments = useMemo(() => {
    const pairs: [[number,number,number],[number,number,number]][] = [];
    BOTTOM_NODES.forEach((node) => {
      const snIdx = nearestSubNode(node.position);
      pairs.push([node.position, SUB_NODES[snIdx]]);
    });
    return buildLineBuffer(pairs);
  }, []);

  // 3. Sub-node → main floating node lines
  const subToMainSegments = useMemo(() => {
    const pairs: [[number,number,number],[number,number,number]][] = SUB_NODES.map(
      (sn) => [sn, MAIN_FLOATING_NODE_POS],
    );
    return buildLineBuffer(pairs);
  }, []);

  // 4. Main node → land server (thicker bright beam)
  const mainToLandSegment = useMemo(
    () => buildLineBuffer([[MAIN_FLOATING_NODE_POS, LAND_SERVER_POS]]),
    [],
  );

  // ── ACTIVE DATA PATHS (bright white routes) ───────────────────────────────
  // Build paths for each bottom node → its sub-node → main node → land server
  const allPaths = useMemo(() =>
    BOTTOM_NODES.map((node) => {
      const snIdx = nearestSubNode(node.position);
      return [
        new THREE.Vector3(...node.position),
        new THREE.Vector3(...SUB_NODES[snIdx]),
        new THREE.Vector3(...MAIN_FLOATING_NODE_POS),
        new THREE.Vector3(...LAND_SERVER_POS),
      ];
    }),
  []);

  // Track which source is active each cycle
  const activeIdx = useRef(0);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (lastSwitch.current < 0) lastSwitch.current = t;
    if (t - lastSwitch.current >= CYCLE_INTERVAL) {
      activeIdx.current = (activeIdx.current + 1) % BOTTOM_NODES.length;
      lastSwitch.current = t;
      activeSourceIdx.current = activeIdx.current;
    }
  });

  // Speed: path total length / CYCLE_INTERVAL so pulse completes in one cycle
  const pathSpeeds = useMemo(() =>
    allPaths.map((path) => {
      let total = 0;
      for (let i = 1; i < path.length; i++) total += path[i].distanceTo(path[i - 1]);
      return total / (CYCLE_INTERVAL * 0.85);
    }),
  [allPaths]);

  // Active path bright segments
  const activePaths = useMemo(() =>
    allPaths.map((path) => {
      const pairs: [[number,number,number],[number,number,number]][] = [];
      for (let i = 0; i + 1 < path.length; i++) {
        pairs.push([
          [path[i].x,   path[i].y,   path[i].z],
          [path[i+1].x, path[i+1].y, path[i+1].z],
        ]);
      }
      return buildLineBuffer(pairs);
    }),
  [allPaths]);

  // We need to re-render when activeIdx changes — use a state proxy via frame counter
  const frameCount = useRef(0);
  useFrame(() => { frameCount.current++; });

  return (
    <group>
      {/* ── STATIC TOPOLOGY LINES ──────────────────────────────────────── */}
      {/* Mesh web between all bottom sensors */}
      <StaticLines
        segments={meshSegments}
        color="#4488cc"
        opacity={0.07}
      />

      {/* Sensor → sub-node connectors */}
      <StaticLines
        segments={sensorToSubSegments}
        color="#44aadd"
        opacity={0.14}
      />

      {/* Sub-node → main floating node */}
      <StaticLines
        segments={subToMainSegments}
        color="#66ccff"
        opacity={0.22}
      />

      {/* Main node → land server backbone */}
      <StaticLines
        segments={mainToLandSegment}
        color="#aaddff"
        opacity={0.30}
      />

      {/* ── ACTIVE DATA PATH (bright white + glow) ─────────────────────── */}
      {/* Bright white path highlight for the active route */}
      {allPaths.map((_, i) => {
        const isActive = i === activeIdx.current;
        if (!isActive) return null;
        return (
          <StaticLines
            key={i}
            segments={activePaths[i]}
            color="#ffffff"
            opacity={0.85}
          />
        );
      })}

      {/* Animated pulse dot on the active route */}
      {allPaths.map((path, i) => {
        const isActive = i === activeIdx.current;
        if (!isActive) return null;
        return (
          <DataPulse
            key={i}
            path={path}
            color="#ffffff"
            speed={pathSpeeds[i]}
            offset={0}
          />
        );
      })}

      {/* ── FLOATING DEVICES ─────────────────────────────────────────────── */}
      {/* Sub-nodes */}
      {SUB_NODES.map((pos, i) => (
        <SubNodeFloater key={i} position={pos} index={i} />
      ))}

      {/* Main surface gateway node */}
      <MainFloatingNode />
    </group>
  );
};
