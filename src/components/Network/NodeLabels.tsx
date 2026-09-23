import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { FC } from 'react';
import type { HardwareNode } from '../../types';
import { HARDWARE_NODES } from '../../utils/constants';

// ─────────────────────────────────────────────────────────────────────────────
// NODE LABEL METADATA
// ─────────────────────────────────────────────────────────────────────────────
interface LabelMeta { shortId: string; measurement: string; }

function getNodeMeta(node: HardwareNode): LabelMeta {
  const id = node.id.toUpperCase();

  const overrides: Record<string, LabelMeta> = {
    'GW-01':    { shortId: 'GW-01',    measurement: 'Acoustic Network Gateway' },
    'ROV-01':   { shortId: 'ROV-01',   measurement: 'Seafloor Inspection' },
    'AUV-01':   { shortId: 'AUV-01',   measurement: 'Water Column Survey' },
    'AUV-02':   { shortId: 'AUV-02',   measurement: 'Water Column Survey' },
    'BUOY-01':  { shortId: 'STB-01',   measurement: 'Surface Telemetry · GPS' },
    'RELAY-01': { shortId: 'RL-01',    measurement: 'Acoustic Relay · 24 kHz' },
    'RELAY-02': { shortId: 'RL-02',    measurement: 'Acoustic Relay · 24 kHz' },
    'RELAY-03': { shortId: 'RL-03',    measurement: 'Acoustic Relay · 24 kHz' },
    'RELAY-04': { shortId: 'RL-04',    measurement: 'Acoustic Relay · 24 kHz' },
    'PKG-01':   { shortId: 'CTD-01',   measurement: 'Temperature · Salinity · Depth' },
    'SN-01':    { shortId: 'SN-01',    measurement: 'Hydrophone · Acoustic Pressure' },
    'SN-02':    { shortId: 'SN-02',    measurement: 'Acoustic Modem · 12.5 kHz' },
    'SN-03':    { shortId: 'ADCP-03',  measurement: 'Current Velocity · Direction' },
    'SN-04':    { shortId: 'SN-04',    measurement: 'Hydrophone · Acoustic Pressure' },
    'SN-05':    { shortId: 'SN-05',    measurement: 'Acoustic Modem · 12.5 kHz' },
    'SN-06':    { shortId: 'ADCP-06',  measurement: 'Current Velocity · Direction' },
    'SN-07':    { shortId: 'SN-07',    measurement: 'Seafloor Pressure · Seismics' },
    'SN-08':    { shortId: 'SN-08',    measurement: 'Acoustic Modem · 12.5 kHz' },
    'SN-09':    { shortId: 'ADCP-09',  measurement: 'Current Velocity · Turbidity' },
    'SN-10':    { shortId: 'SN-10',    measurement: 'Seabed Conditions [OFFLINE]' },
    'SN-11':    { shortId: 'SN-11',    measurement: 'Abyssal Pressure · Sound Speed' },
    'SN-12':    { shortId: 'SN-12',    measurement: 'Abyssal Acoustics · 12.5 kHz' },
    'SN-13':    { shortId: 'SN-13',    measurement: 'Trench Lander · Hadal Zone' },
    'SN-14':    { shortId: 'SN-14',    measurement: 'Challenger Deep · 10.4 km' },
    'SN-15':    { shortId: 'SN-15',    measurement: 'Challenger Deep · 10.6 km' },
  };

  if (overrides[id]) return overrides[id];

  switch (node.type) {
    case 'gateway':        return { shortId: id, measurement: 'Acoustic Network Gateway' };
    case 'rov':            return { shortId: id, measurement: 'Seafloor Inspection' };
    case 'auv':            return { shortId: id, measurement: 'Water Column Survey' };
    case 'buoy':           return { shortId: id, measurement: 'Surface Telemetry' };
    case 'relay':          return { shortId: id, measurement: 'Acoustic Relay' };
    case 'sensor_package': return { shortId: id, measurement: 'Temperature · Salinity · Depth' };
    case 'sensor': {
      const v = (node as HardwareNode & { variant?: number }).variant;
      if (v === 2) return { shortId: id, measurement: 'Acoustic Modem' };
      if (v === 3) return { shortId: id, measurement: 'Current Velocity · Direction' };
      return { shortId: id, measurement: 'Hydrophone · Acoustic Pressure' };
    }
    default: return { shortId: id, measurement: 'Subsea Sensor' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LABEL VERTICAL OFFSET — keep label close to device
// Scaled to new world proportions (devices are larger in the new scale)
// ─────────────────────────────────────────────────────────────────────────────
function labelOffset(node: HardwareNode): number {
  switch (node.type) {
    case 'gateway':        return 28;
    case 'rov':            return 18;
    case 'auv':            return 14;
    case 'buoy':           return 32;
    case 'relay':          return 16;
    case 'sensor_package': return 18;
    case 'sensor':         return 20;
    default:               return 15;
  }
}

// Labels fully visible up to 180 units, fade to invisible at 600
const DIST_FULL_OPACITY = 180;
const DIST_FADE_OUT     = 600;

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE NODE LABEL — compact scientific annotation
// ─────────────────────────────────────────────────────────────────────────────
const NodeLabel: FC<{ node: HardwareNode }> = ({ node }) => {
  const { camera } = useThree();
  const opacityRef = useRef(1);
  const [opacity, setOpacity]   = useState(1);
  const [visible, setVisible]   = useState(true);
  const frameSkip = useRef(0);

  const meta   = getNodeMeta(node);
  const offset = labelOffset(node);
  const pos: [number, number, number] = [
    node.position[0],
    node.position[1] + offset,
    node.position[2],
  ];

  useFrame(() => {
    frameSkip.current = (frameSkip.current + 1) % 4;
    if (frameSkip.current !== 0) return;

    const dx = camera.position.x - node.position[0];
    const dy = camera.position.y - node.position[1];
    const dz = camera.position.z - node.position[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist >= DIST_FADE_OUT) {
      if (visible) setVisible(false);
      return;
    }
    if (!visible) setVisible(true);

    const raw = dist <= DIST_FULL_OPACITY
      ? 1.0
      : 1.0 - (dist - DIST_FULL_OPACITY) / (DIST_FADE_OUT - DIST_FULL_OPACITY);

    const clamped = Math.max(0, Math.min(1, raw));
    if (Math.abs(clamped - opacityRef.current) > 0.015) {
      opacityRef.current = clamped;
      setOpacity(clamped);
    }
  });

  if (!visible) return null;

  const isOffline = node.status === 'offline';

  return (
    <Html
      position={pos}
      center
      distanceFactor={28}    // Much smaller — reduced from 55
      occlude="blending"
      zIndexRange={[10, 50]}
    >
      <div style={{
        opacity,
        transition:    'opacity 0.4s ease',
        pointerEvents: 'none',
        userSelect:    'none',
        textAlign:     'center',
        lineHeight:    1.2,
      }}>
        {/* Device ID — tiny, scientific */}
        <div style={{
          fontFamily:    "'Roboto Mono', 'Courier New', monospace",
          fontSize:      '4.5px',
          fontWeight:    700,
          letterSpacing: '0.08em',
          color:         isOffline ? '#ff7070' : '#dff4ff',
          textShadow:    '0 1px 4px rgba(0,0,0,0.99), 0 0 2px rgba(0,0,0,1)',
          whiteSpace:    'nowrap',
        }}>
          {meta.shortId}
        </div>
        {/* Measurement line — minimal */}
        <div style={{
          fontFamily:    "'Roboto Mono', 'Courier New', monospace",
          fontSize:      '3.5px',
          fontWeight:    400,
          letterSpacing: '0.04em',
          color:         isOffline ? 'rgba(255,140,140,0.65)' : 'rgba(160,220,255,0.68)',
          textShadow:    '0 1px 3px rgba(0,0,0,0.99)',
          whiteSpace:    'nowrap',
          marginTop:     '0.5px',
        }}>
          {meta.measurement}
        </div>
      </div>
    </Html>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export const NodeLabels: FC = () => (
  <>
    {HARDWARE_NODES.map((node) => (
      <NodeLabel key={node.id} node={node} />
    ))}
  </>
);
