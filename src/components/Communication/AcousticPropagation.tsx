import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';
import type { HardwareNode } from '../../types';
import { ACTIVE_ACOUSTIC_LINKS, HARDWARE_NODES } from '../../utils/constants';

// ─────────────────────────────────────────────────────────────────────────────
// ACOUSTIC PROPAGATION — Event-based, one transmission every 10 seconds
//
// Simulation model:
//   - All acoustic links remain visible as subtle static guide lines
//   - Every EVENT_INTERVAL seconds, ONE link becomes the active transmission
//   - The active link shows a prominent acoustic wavefront pulse traveling
//     from source to target over PULSE_DURATION seconds
//   - After the pulse reaches the target, it fades; system waits for next event
//   - Links cycle through in order: link-01, link-02, … link-08, repeat
//
// This models a realistic TDMA (time-division multiple access) underwater
// acoustic network where nodes take turns transmitting.
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_INTERVAL  = 10.0;   // seconds between transmissions
const PULSE_DURATION  = 6.5;    // seconds for pulse to travel source→target
const WAVE_COUNT      = 5;      // wavefront arc rings per transmission

// ── PASSIVE LINK LINE ────────────────────────────────────────────────────────
// Always-visible faint line showing the acoustic path exists.
const LinkLine: FC<{
  sourcePos: [number, number, number];
  targetPos: [number, number, number];
  color: string;
  isActive: boolean;
}> = ({ sourcePos, targetPos, color, isActive }) => {
  const posArray = useMemo(
    () => new Float32Array([...sourcePos, ...targetPos]),
    [sourcePos, targetPos]
  );
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[posArray, 3]} />
      </bufferGeometry>
      {/* Active link is brighter; inactive links are very faint */}
      <lineBasicMaterial
        color={color}
        transparent
        opacity={isActive ? 0.35 : 0.06}
      />
    </line>
  );
};

// ── ACOUSTIC PULSE ───────────────────────────────────────────────────────────
// Wavefront arcs traveling from source to target during an active transmission.
const AcousticPulse: FC<{
  sourcePos: [number, number, number];
  targetPos: [number, number, number];
  color: string;
  progress: number;   // 0→1 over PULSE_DURATION
  visible: boolean;
}> = ({ sourcePos, targetPos, color, progress, visible }) => {
  const waveGroupRef = useRef<THREE.Group>(null);

  const [start, end, orientation] = useMemo(() => {
    const s   = new THREE.Vector3(...sourcePos);
    const e   = new THREE.Vector3(...targetPos);
    const dir = new THREE.Vector3().subVectors(e, s).normalize();
    const q   = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    return [s, e, q];
  }, [sourcePos, targetPos]);

  useFrame(() => {
    if (!waveGroupRef.current || !visible) return;

    waveGroupRef.current.children.forEach((child, i) => {
      // Stagger each ring along the path
      const ringOffset = (i / WAVE_COUNT) * 0.22;
      const ringProgress = ((progress + ringOffset) % 1.0);

      if (ringProgress > 0.98) {
        (child as THREE.Mesh).visible = false;
        return;
      }
      (child as THREE.Mesh).visible = true;

      // Position along the link
      child.position.lerpVectors(start, end, ringProgress);
      child.quaternion.copy(orientation);

      // Expand as it propagates
      const arcScale = 1.0 + ringProgress * 4.0;
      child.scale.set(arcScale, arcScale, 1.0);

      // Natural sine-bell attenuation
      const fade = Math.sin(ringProgress * Math.PI);
      const mat  = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity = fade * 0.65;
    });
  });

  if (!visible) return null;

  return (
    <group ref={waveGroupRef}>
      {Array.from({ length: WAVE_COUNT }, (_, idx) => (
        <mesh key={idx}>
          <ringGeometry args={[6, 8, 28, 1, 0, Math.PI * 0.72]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export const AcousticPropagation: FC = () => {
  const nodeMap = useMemo(() => {
    const map = new Map<string, HardwareNode>();
    HARDWARE_NODES.forEach((n) => map.set(n.id, n));
    return map;
  }, []);

  // Build the link list with resolved positions
  const links = useMemo(() => {
    return ACTIVE_ACOUSTIC_LINKS.map((link) => {
      const source = nodeMap.get(link.sourceId);
      const target = nodeMap.get(link.targetId);
      if (!source || !target) return null;

      let color = '#2090c8';  // deep blue — default
      if (link.frequencyKhz >= 24) color = '#20a858';   // green — high-rate
      else if (link.frequencyKhz >= 18) color = '#c08820'; // amber — AUV telemetry

      return { link, source, target, color };
    }).filter(Boolean);
  }, [nodeMap]);

  // Event state — which link is active and how far the pulse has traveled
  const activeLinkIdx  = useRef(0);
  const lastEventTime  = useRef(-1);       // -1 = not yet started
  const pulseProgress  = useRef(0);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();

    // Initialise on first frame
    if (lastEventTime.current < 0) {
      lastEventTime.current = t;
    }

    const elapsed = t - lastEventTime.current;

    if (elapsed >= EVENT_INTERVAL) {
      // Advance to next link
      activeLinkIdx.current = (activeLinkIdx.current + 1) % links.length;
      lastEventTime.current = t;
      pulseProgress.current = 0;
    } else {
      // Update pulse progress for current active link
      pulseProgress.current = Math.min(1.0, elapsed / PULSE_DURATION);
    }
  });

  if (links.length === 0) return null;

  return (
    <group>
      {links.map((item, idx) => {
        if (!item) return null;
        const { source, target, color } = item;
        const isActive = idx === activeLinkIdx.current;

        return (
          <group key={item.link.id}>
            {/* Always-visible faint static link line */}
            <LinkLine
              sourcePos={source.position}
              targetPos={target.position}
              color={color}
              isActive={isActive}
            />

            {/* Active pulse — only rendered for the currently transmitting link */}
            {isActive && (
              <AcousticPulse
                sourcePos={source.position}
                targetPos={target.position}
                color={color}
                progress={pulseProgress.current}
                visible={true}
              />
            )}
          </group>
        );
      })}
    </group>
  );
};
