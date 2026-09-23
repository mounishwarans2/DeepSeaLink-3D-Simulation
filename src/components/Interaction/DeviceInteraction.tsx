import { useRef, useCallback, useState } from 'react';
import type { FC } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { HardwareNode } from '../../types';
import { HARDWARE_NODES } from '../../utils/constants';

// ─────────────────────────────────────────────────────────────────────────────
// HIT-SPHERE RADII — tuned to visual device size
// ─────────────────────────────────────────────────────────────────────────────
const HIT_RADIUS: Record<string, number> = {
  gateway:        22,
  rov:            16,
  auv:            14,
  buoy:           14,
  relay:          10,
  sensor_package: 12,
  sensor:         12,
};

function getRadius(node: HardwareNode): number {
  return HIT_RADIUS[node.type] ?? 6;
}

// ─────────────────────────────────────────────────────────────────────────────
// HIGHLIGHT RING — subtle torus shown on hover / selection
// ─────────────────────────────────────────────────────────────────────────────
const HighlightRing: FC<{
  position: [number, number, number];
  radius: number;
  selected: boolean;
}> = ({ position, radius, selected }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    const t = state.clock.getElapsedTime();
    if (selected) {
      // Pulse opacity and very subtle scale when selected
      mat.opacity = 0.55 + Math.sin(t * 2.8) * 0.18;
      meshRef.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.025);
    } else {
      mat.opacity = 0.32;
      meshRef.current.scale.setScalar(1);
    }
  });

  return (
    <mesh ref={meshRef} position={position} rotation={[Math.PI / 2, 0, 0]}>
      {/* thin torus ring — tube thickness is ~4% of ring radius */}
      <torusGeometry args={[radius * 1.4, radius * 0.045, 8, 40]} />
      <meshBasicMaterial
        color={selected ? '#20c8ff' : '#7ed4ee'}
        transparent
        opacity={0.35}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC PROPS
// ─────────────────────────────────────────────────────────────────────────────
export interface DeviceInteractionProps {
  selectedNodeId: string | null;
  hoveredNodeId:  string | null;
  onSelect: (node: HardwareNode | null) => void;
  onHover:  (nodeId: string | null) => void;
}

// Label fully visible up to 300 units, fades out by 900
const DIST_FULL  = 300;
const DIST_FADE  = 900;

// Vertical offset per device type so label sits above the model
const LABEL_OFFSET: Record<string, number> = {
  gateway:        30,
  rov:            22,
  auv:            18,
  buoy:           38,
  relay:          18,
  sensor_package: 20,
  sensor:         22,
};

// ─────────────────────────────────────────────────────────────────────────────
// ALWAYS-VISIBLE NAME LABEL — fades with distance, glows when selected
// ─────────────────────────────────────────────────────────────────────────────
const DeviceNameLabel: FC<{
  node: HardwareNode;
  selected: boolean;
}> = ({ node, selected }) => {
  const { camera } = useThree();
  const opacityRef  = useRef(1);
  const [opacity, setOpacity] = useState(1);
  const [visible, setVisible] = useState(true);
  const frameSkip = useRef(0);

  const offset = LABEL_OFFSET[node.type] ?? 18;
  const pos: [number, number, number] = [
    node.position[0],
    node.position[1] + offset,
    node.position[2],
  ];

  useFrame(() => {
    // Only recalculate every 4th frame to save CPU
    frameSkip.current = (frameSkip.current + 1) % 4;
    if (frameSkip.current !== 0) return;

    const dx = camera.position.x - node.position[0];
    const dy = camera.position.y - node.position[1];
    const dz = camera.position.z - node.position[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist >= DIST_FADE) {
      if (visible) setVisible(false);
      return;
    }
    if (!visible) setVisible(true);

    const raw = dist <= DIST_FULL
      ? 1.0
      : 1.0 - (dist - DIST_FULL) / (DIST_FADE - DIST_FULL);
    const clamped = Math.max(0, Math.min(1, raw));
    if (Math.abs(clamped - opacityRef.current) > 0.02) {
      opacityRef.current = clamped;
      setOpacity(clamped);
    }
  });

  if (!visible) return null;

  return (
    <Html
      position={pos}
      center
      distanceFactor={80}
      zIndexRange={[50, 0]}
      style={{ pointerEvents: 'none' }}
    >
      <div style={{
        opacity,
        pointerEvents: 'none',
        userSelect: 'none',
        background: selected
          ? 'rgba(0, 20, 50, 0.92)'
          : 'rgba(0, 10, 28, 0.75)',
        border: selected
          ? '1.5px solid rgba(32, 200, 255, 0.85)'
          : '1px solid rgba(32, 160, 220, 0.4)',
        borderRadius: '7px',
        padding: selected ? '6px 14px' : '4px 10px',
        color: selected ? '#e8f8ff' : 'rgba(200, 235, 255, 0.9)',
        fontFamily: "'Roboto Mono', 'Courier New', monospace",
        fontSize: selected ? '11px' : '9px',
        fontWeight: selected ? 700 : 500,
        whiteSpace: 'nowrap',
        boxShadow: selected
          ? '0 0 18px rgba(32,200,255,0.5), 0 2px 8px rgba(0,0,0,0.8)'
          : '0 1px 6px rgba(0,0,0,0.7)',
        letterSpacing: '0.04em',
        textShadow: '0 1px 4px rgba(0,0,0,0.99)',
        transform: selected ? 'scale(1.05)' : 'scale(1)',
        transition: 'all 0.25s ease',
      }}>
        {selected ? '📡 ' : ''}{node.name}
      </div>
    </Html>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE DEVICE — invisible hit sphere + highlight ring + always-visible label
// ─────────────────────────────────────────────────────────────────────────────
const DeviceHit: FC<{
  node: HardwareNode;
  selected: boolean;
  hovered: boolean;
  onSelect: (node: HardwareNode | null) => void;
  onHover: (id: string | null) => void;
}> = ({ node, selected, hovered, onSelect, onHover }) => {
  const r = getRadius(node);
  const pos = node.position as [number, number, number];

  const handleEnter = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(node.id);
    document.body.style.cursor = 'pointer';
  }, [node.id, onHover]);

  const handleLeave = useCallback(() => {
    onHover(null);
    document.body.style.cursor = '';
  }, [onHover]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(selected ? null : node);
  }, [node, selected, onSelect]);

  return (
    <group>
      {/* Invisible sphere for pointer hit-testing */}
      <mesh
        position={pos}
        onPointerEnter={handleEnter}
        onPointerLeave={handleLeave}
        onClick={handleClick}
        renderOrder={-1}
      >
        <sphereGeometry args={[r, 8, 6]} />
        <meshBasicMaterial visible={false} side={THREE.FrontSide} />
      </mesh>

      {/* Visible highlight ring when hovered or selected */}
      {(hovered || selected) && (
        <HighlightRing position={pos} radius={r} selected={selected} />
      )}

      {/* Always-visible name label — glows brighter on selection */}
      <DeviceNameLabel node={node} selected={selected} />
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — renders one DeviceHit per hardware node, inside <Canvas>
// ─────────────────────────────────────────────────────────────────────────────
export const DeviceInteraction: FC<DeviceInteractionProps> = ({
  selectedNodeId, hoveredNodeId, onSelect, onHover,
}) => (
  <group name="device-interaction">
    {HARDWARE_NODES.map((node) => (
      <DeviceHit
        key={node.id}
        node={node}
        selected={selectedNodeId === node.id}
        hovered={hoveredNodeId  === node.id}
        onSelect={onSelect}
        onHover={onHover}
      />
    ))}
  </group>
);
