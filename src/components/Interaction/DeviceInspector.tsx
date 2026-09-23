import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import type { HardwareNode } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// SEEDED NOISE HELPERS
// Deterministic per-node baseline values + slow time variation
// ─────────────────────────────────────────────────────────────────────────────
function hash(s: string, offset = 0): number {
  let h = offset * 2654435761;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return (((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0) / 0xffffffff;
}

/** Slowly oscillating value: base ± range at period `periodSec`. */
function slow(
  nodeId: string,
  seed: number,
  base: number,
  range: number,
  periodSec: number,
  t: number,
): number {
  const phase = hash(nodeId, seed) * Math.PI * 2;
  return base + Math.sin(t / periodSec * Math.PI * 2 + phase) * range;
}

// ─────────────────────────────────────────────────────────────────────────────
// TELEMETRY TYPES — one per device category
// ─────────────────────────────────────────────────────────────────────────────
interface Row { label: string; value: string; unit?: string }

interface TelemetryState {
  shortId:     string;
  typeFull:    string;
  operation:   string;
  rows:        Row[];
  battery:     number;
  status:      string;
  lastTxSec:   number;   // seconds since last transmission
  txActive:    boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// TELEMETRY GENERATOR — called at ~1 Hz, returns a fresh snapshot
// ─────────────────────────────────────────────────────────────────────────────
function buildTelemetry(node: HardwareNode, t: number, batteryDrain: number): TelemetryState {
  const id   = node.id;
  const bat  = Math.max(0, (node.batteryLevel ?? 95) - batteryDrain);
  const txActive = node.status === 'transmitting' || node.status === 'active' || node.status === 'receiving';
  const lastTx   = slow(id, 77, 1.8, 1.4, 15, t);

  // ── GATEWAY ──────────────────────────────────────────────────────────────
  if (node.type === 'gateway') {
    const connNodes = 7 + Math.round(slow(id, 1, 0, 1.2, 60, t));
    const pktRx  = 14820 + Math.round(slow(id, 2,   0, 600, 80, t));
    const pktTx  = 12430 + Math.round(slow(id, 3,   0, 500, 80, t));
    const sigQ   = slow(id, 4, 82, 8, 45, t);
    const netLoad= slow(id, 5, 38, 12, 30, t);
    return {
      shortId: 'GW-01', typeFull: 'Subsea Acoustic Gateway Hub',
      operation: 'Managing acoustic network routing and multi-node relay',
      rows: [
        { label: 'Connected Nodes',  value: String(connNodes) },
        { label: 'Packets Received', value: pktRx.toLocaleString() },
        { label: 'Packets Transmitted', value: pktTx.toLocaleString() },
        { label: 'Signal Quality',   value: sigQ.toFixed(1),  unit: 'dB' },
        { label: 'Network Load',     value: netLoad.toFixed(0), unit: '%' },
        { label: 'Depth',            value: node.depth.toFixed(0), unit: 'm' },
        { label: 'Frequency',        value: (node.frequencyKhz ?? 24).toFixed(1), unit: 'kHz' },
      ],
      battery: bat, status: node.status, lastTxSec: lastTx, txActive,
    };
  }

  // ── ROV ──────────────────────────────────────────────────────────────────
  if (node.type === 'rov') {
    const heading  = slow(id, 10, 215, 25, 120, t);
    const altAGL   = slow(id, 11, 1.2, 0.6, 18, t);
    const thruster = slow(id, 12, 42,  12, 25, t);
    return {
      shortId: 'ROV-01', typeFull: 'Workclass Remotely Operated Vehicle',
      operation: 'Seafloor inspection, sampling and gateway maintenance',
      rows: [
        { label: 'Depth',            value: node.depth.toFixed(0),  unit: 'm' },
        { label: 'Altitude AGL',     value: altAGL.toFixed(1),       unit: 'm' },
        { label: 'Heading',          value: heading.toFixed(0),      unit: '°' },
        { label: 'Thruster Power',   value: thruster.toFixed(0),     unit: '%' },
        { label: 'Tether Status',    value: 'NOMINAL' },
        { label: 'Manipulator',      value: 'STOWED' },
        { label: 'Visibility',       value: slow(id,13,6,2,40,t).toFixed(0), unit: 'm' },
      ],
      battery: bat, status: node.status, lastTxSec: lastTx, txActive,
    };
  }

  // ── AUV ──────────────────────────────────────────────────────────────────
  if (node.type === 'auv') {
    const shortId  = id === 'auv-01' ? 'AUV-01' : 'AUV-02';
    const vel      = slow(id, 20, 1.45, 0.35, 40, t);
    const heading  = slow(id, 21, 160,  60,   120, t);
    const msnProg  = Math.min(100, slow(id, 22, 52, 15, 600, t));
    return {
      shortId, typeFull: 'Autonomous Underwater Vehicle',
      operation: 'Water column survey transect — oceanographic data collection',
      rows: [
        { label: 'Depth',            value: node.depth.toFixed(0),   unit: 'm' },
        { label: 'Velocity',         value: vel.toFixed(2),           unit: 'm/s' },
        { label: 'Heading',          value: ((heading % 360 + 360) % 360).toFixed(0), unit: '°' },
        { label: 'Mission Progress', value: msnProg.toFixed(0),       unit: '%' },
        { label: 'Frequency',        value: (node.frequencyKhz ?? 18).toFixed(1), unit: 'kHz' },
        { label: 'Water Temp',       value: slow(id,23,4.1,0.4,200,t).toFixed(1), unit: '°C' },
        { label: 'Mission Status',   value: 'ACTIVE SURVEY' },
      ],
      battery: bat, status: node.status, lastTxSec: lastTx, txActive,
    };
  }

  // ── BUOY ─────────────────────────────────────────────────────────────────
  if (node.type === 'buoy') {
    const swell  = slow(id, 30, 0.8, 0.5, 35, t);
    const wind   = slow(id, 31, 12,  5,   50, t);
    return {
      shortId: 'STB-01', typeFull: 'Surface Telemetry Spar Buoy',
      operation: 'Surface telemetry relay — GPS reference and Iridium uplink',
      rows: [
        { label: 'GPS Lock',         value: '3D FIXED — 8 sats' },
        { label: 'Iridium Link',     value: 'ACTIVE' },
        { label: 'Surface Swell',    value: swell.toFixed(2), unit: 'm' },
        { label: 'Wind Speed',       value: wind.toFixed(0),  unit: 'kn' },
        { label: 'Air Temperature',  value: slow(id,32,21,2,180,t).toFixed(1), unit: '°C' },
        { label: 'Frequency',        value: (node.frequencyKhz ?? 32).toFixed(1), unit: 'kHz' },
        { label: 'Uplink Rate',      value: '9.6', unit: 'kbps' },
      ],
      battery: bat, status: node.status, lastTxSec: lastTx, txActive,
    };
  }

  // ── RELAY ─────────────────────────────────────────────────────────────────
  if (node.type === 'relay') {
    const suffix   = id.replace('relay-', '');
    const letters  = ['Alpha','Bravo','Charlie','Delta'];
    const idx      = parseInt(suffix, 10) - 1;
    const shortId  = `RL-0${suffix}`;
    const sigStr   = slow(id, 40, -68, 6, 35, t);
    const fwd      = 4200 + Math.round(slow(id, 41, 0, 400, 80, t));
    return {
      shortId, typeFull: `Subsurface Acoustic Relay — ${letters[idx] ?? suffix}`,
      operation: 'Forwarding acoustic data packets between node tiers',
      rows: [
        { label: 'Relay Depth',      value: node.depth.toFixed(0),  unit: 'm' },
        { label: 'Signal Strength',  value: sigStr.toFixed(1),       unit: 'dB' },
        { label: 'Packets Forwarded',value: fwd.toLocaleString() },
        { label: 'Frequency',        value: (node.frequencyKhz ?? 24).toFixed(1), unit: 'kHz' },
        { label: 'Link Margin',      value: slow(id,42,18,4,50,t).toFixed(1), unit: 'dB' },
        { label: 'Error Rate',       value: slow(id,43,0.4,0.2,40,t).toFixed(2), unit: '%' },
        { label: 'Link Status',      value: 'OPERATIONAL' },
      ],
      battery: bat, status: node.status, lastTxSec: lastTx, txActive,
    };
  }

  // ── SENSOR PACKAGE (CTD ROSETTE) ──────────────────────────────────────────
  if (node.type === 'sensor_package') {
    const temp     = slow(id, 50, 2.1, 0.2, 300, t);
    const sal      = slow(id, 51, 34.72, 0.05, 400, t);
    const pres     = slow(id, 52, node.depth * 0.1013, 0.8, 200, t);
    const dens     = slow(id, 53, 1027.6, 0.08, 350, t);
    return {
      shortId: 'CTD-01', typeFull: 'Deep Benthic CTD Rosette Profiler',
      operation: 'Measuring ocean water properties — temperature, salinity, depth',
      rows: [
        { label: 'Temperature',      value: temp.toFixed(3), unit: '°C' },
        { label: 'Salinity',         value: sal.toFixed(3),  unit: 'PSU' },
        { label: 'Depth',            value: node.depth.toFixed(0), unit: 'm' },
        { label: 'Pressure',         value: pres.toFixed(1), unit: 'dbar' },
        { label: 'Water Density',    value: dens.toFixed(3), unit: 'kg/m³' },
        { label: 'Sound Speed',      value: slow(id,54,1475,4,250,t).toFixed(1), unit: 'm/s' },
        { label: 'Sample Bottles',   value: '12 / 24 used' },
      ],
      battery: bat, status: node.status, lastTxSec: lastTx, txActive,
    };
  }

  // ── SENSOR VARIANTS ───────────────────────────────────────────────────────
  const variant = (node as HardwareNode & { variant?: number }).variant ?? 1;
  const numSuffix = id.replace('sn-', '').padStart(2, '0');

  // variant 1 — Benthic Hydrophone Lander
  if (variant === 1) {
    const noise  = slow(id, 60, 82, 6, 30, t);
    const sig    = slow(id, 61, -58, 4, 12, t);
    const freq   = slow(id, 62, 18.5, 2, 20, t);
    const press  = slow(id, 63, node.depth * 0.1013, 0.3, 180, t);
    return {
      shortId: `SN-${numSuffix}`, typeFull: 'Benthic Hydrophone Lander',
      operation: 'Monitoring seafloor acoustic environment and pressure',
      rows: [
        { label: 'Ambient Noise',    value: noise.toFixed(1), unit: 'dB re 1µPa' },
        { label: 'Received Signal',  value: sig.toFixed(1),   unit: 'dBV' },
        { label: 'Dominant Freq',    value: freq.toFixed(2),  unit: 'kHz' },
        { label: 'Seafloor Pressure',value: press.toFixed(2), unit: 'dbar' },
        { label: 'Bottom Temp',      value: slow(id,64,1.8,0.1,400,t).toFixed(2), unit: '°C' },
        { label: 'Depth',            value: node.depth.toFixed(0), unit: 'm' },
        { label: 'Frequency',        value: (node.frequencyKhz ?? 12.5).toFixed(1), unit: 'kHz' },
      ],
      battery: bat, status: node.status, lastTxSec: lastTx, txActive,
    };
  }

  // variant 2 — Acoustic Frame / Modem
  if (variant === 2) {
    const snr    = slow(id, 70, 21, 4, 20, t);
    const rate   = slow(id, 71, 4800, 400, 25, t);
    const pktLoss= Math.max(0, slow(id, 72, 0.8, 0.5, 30, t));
    return {
      shortId: `SN-${numSuffix}`, typeFull: 'Subsea Acoustic Modem',
      operation: 'Digital acoustic data transmission at 12.5 kHz',
      rows: [
        { label: 'TX Frequency',     value: (node.frequencyKhz ?? 12.5).toFixed(1), unit: 'kHz' },
        { label: 'Data Rate',        value: rate.toFixed(0),  unit: 'bps' },
        { label: 'SNR',              value: snr.toFixed(1),   unit: 'dB' },
        { label: 'Packet Loss',      value: pktLoss.toFixed(2),unit: '%' },
        { label: 'Tx Power',         value: slow(id,73,170,5,60,t).toFixed(0), unit: 'dB re 1µPa' },
        { label: 'Depth',            value: node.depth.toFixed(0), unit: 'm' },
        { label: 'Link Status',      value: node.status === 'offline' ? 'OFFLINE' : 'OPERATIONAL' },
      ],
      battery: bat, status: node.status, lastTxSec: lastTx, txActive,
    };
  }

  // variant 3 — ADCP Benthic Node
  const numId = parseInt(id.replace('sn-', ''), 10);
  const adcpId = `ADCP-${numSuffix}`;
  const velM   = slow(id, 80, 0.34, 0.18, 55, t);
  const velDir = slow(id, 81, 200 + numId * 17, 35, 90, t);
  const ret    = slow(id, 82, -72, 5, 18, t);
  return {
    shortId: adcpId, typeFull: 'Acoustic Doppler Current Profiler',
    operation: 'Measuring current velocity and direction across water column',
    rows: [
      { label: 'Current Velocity',   value: Math.abs(velM).toFixed(3),  unit: 'm/s' },
      { label: 'Current Direction',  value: ((velDir % 360 + 360) % 360).toFixed(0), unit: '°' },
      { label: 'Depth',              value: node.depth.toFixed(0),  unit: 'm' },
      { label: 'Acoustic Return',    value: ret.toFixed(1),          unit: 'dB' },
      { label: 'Frequency',          value: (node.frequencyKhz ?? 12.5).toFixed(1), unit: 'kHz' },
      { label: 'Temperature',        value: slow(id,83,1.9,0.1,350,t).toFixed(2), unit: '°C' },
      { label: 'Profiling Range',    value: slow(id,84,28,4,90,t).toFixed(0), unit: 'm' },
    ],
    battery: bat, status: node.status, lastTxSec: lastTx, txActive,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  root: {
    position:        'absolute',
    top:             '80px',
    right:           '20px',
    width:           '288px',
    zIndex:          300,
    fontFamily:      "'JetBrains Mono', 'Roboto Mono', 'Courier New', monospace",
    userSelect:      'none',
    pointerEvents:   'auto',
  },
  panel: {
    background:          'rgba(3, 16, 30, 0.90)',
    backdropFilter:      'blur(16px)',
    WebkitBackdropFilter:'blur(16px)',
    border:              '1px solid rgba(30, 140, 200, 0.28)',
    borderRadius:        '10px',
    overflow:            'hidden',
    boxShadow:           '0 8px 40px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)',
  },
  header: {
    padding:         '14px 16px 10px',
    borderBottom:    '1px solid rgba(30,140,200,0.18)',
  },
  headerTop: {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'space-between',
    marginBottom:    '3px',
  },
  shortId: {
    fontSize:        '15px',
    fontWeight:      700,
    letterSpacing:   '0.12em',
    color:           '#e2f4ff',
  },
  statusBadge: {
    display:         'flex',
    alignItems:      'center',
    gap:             '5px',
    fontSize:        '9px',
    fontWeight:      700,
    letterSpacing:   '0.14em',
    padding:         '2px 8px',
    borderRadius:    '4px',
    border:          '1px solid rgba(0,220,150,0.35)',
    background:      'rgba(0,220,150,0.10)',
    color:           '#00dc96',
  },
  statusBadgeOffline: {
    border:          '1px solid rgba(255,80,80,0.35)',
    background:      'rgba(255,80,80,0.10)',
    color:           '#ff6060',
  },
  statusDot: {
    width:           '5px',
    height:          '5px',
    borderRadius:    '50%',
    background:      '#00dc96',
    boxShadow:       '0 0 5px #00dc96',
    animation:       'pulse 1.6s ease-in-out infinite',
  },
  statusDotOffline: {
    background:      '#ff6060',
    boxShadow:       '0 0 5px #ff6060',
    animation:       'none',
  },
  typeLine: {
    fontSize:        '9.5px',
    color:           'rgba(140,200,240,0.75)',
    letterSpacing:   '0.06em',
    marginTop:       '2px',
  },
  opLine: {
    fontSize:        '8.5px',
    color:           'rgba(160,210,240,0.55)',
    letterSpacing:   '0.04em',
    marginTop:       '6px',
    lineHeight:      1.4,
    textTransform:   'uppercase' as const,
  },
  liveBar: {
    display:         'flex',
    alignItems:      'center',
    gap:             '6px',
    padding:         '6px 16px',
    background:      'rgba(0,180,255,0.06)',
    borderBottom:    '1px solid rgba(30,140,200,0.12)',
  },
  liveDot: {
    width:           '6px',
    height:          '6px',
    borderRadius:    '50%',
    background:      '#00b4ff',
    boxShadow:       '0 0 6px #00b4ff',
    animation:       'pulse 1.2s ease-in-out infinite',
    flexShrink:      0,
  },
  liveLabel: {
    fontSize:        '8px',
    fontWeight:      700,
    letterSpacing:   '0.18em',
    color:           '#00b4ff',
  },
  lastTx: {
    fontSize:        '8px',
    color:           'rgba(140,190,220,0.55)',
    marginLeft:      'auto',
  },
  rowsBlock: {
    padding:         '10px 0',
  },
  row: {
    display:         'flex',
    justifyContent:  'space-between',
    alignItems:      'center',
    padding:         '4px 16px',
  },
  rowLabel: {
    fontSize:        '9px',
    color:           'rgba(160,210,240,0.65)',
    letterSpacing:   '0.05em',
    textTransform:   'uppercase' as const,
    flex:            1,
  },
  rowValue: {
    fontSize:        '10.5px',
    fontWeight:      700,
    color:           '#cce8ff',
    letterSpacing:   '0.04em',
    textAlign:       'right' as const,
  },
  rowUnit: {
    fontSize:        '8px',
    color:           'rgba(140,190,230,0.55)',
    marginLeft:      '3px',
    minWidth:        '28px',
    textAlign:       'left' as const,
  },
  divider: {
    borderTop:       '1px solid rgba(30,140,200,0.12)',
    margin:          '4px 0',
  },
  batRow: {
    display:         'flex',
    alignItems:      'center',
    padding:         '6px 16px 10px',
    gap:             '10px',
    borderTop:       '1px solid rgba(30,140,200,0.12)',
  },
  batLabel: {
    fontSize:        '8.5px',
    color:           'rgba(160,210,240,0.55)',
    letterSpacing:   '0.06em',
    textTransform:   'uppercase' as const,
    minWidth:        '54px',
  },
  batBar: {
    flex:            1,
    height:          '4px',
    borderRadius:    '2px',
    background:      'rgba(255,255,255,0.08)',
    overflow:        'hidden',
  },
  batFill: {
    height:          '100%',
    borderRadius:    '2px',
    transition:      'width 1.2s ease',
  },
  batPct: {
    fontSize:        '9px',
    fontWeight:      700,
    color:           '#a0d4f0',
    minWidth:        '30px',
    textAlign:       'right' as const,
  },
  closeBtn: {
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    width:           '22px',
    height:          '22px',
    borderRadius:    '5px',
    border:          '1px solid rgba(80,140,180,0.25)',
    background:      'rgba(10,30,50,0.5)',
    cursor:          'pointer',
    color:           'rgba(160,200,230,0.6)',
    fontSize:        '12px',
    lineHeight:      1,
    flexShrink:      0,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DEVICE INSPECTOR PANEL
// ─────────────────────────────────────────────────────────────────────────────
export interface DeviceInspectorProps {
  node: HardwareNode | null;
  onClose: () => void;
}

export const DeviceInspector: FC<DeviceInspectorProps> = ({ node, onClose }) => {
  // Elapsed-time reference (seconds since app start)
  const startRef = useRef(Date.now());
  const [telemetry, setTelemetry] = useState<TelemetryState | null>(null);
  const batteryDrainRef = useRef(0);

  // Rebuild telemetry at ~1 Hz
  useEffect(() => {
    if (!node) { setTelemetry(null); batteryDrainRef.current = 0; return; }

    // Initial render immediately
    const t0 = (Date.now() - startRef.current) / 1000;
    setTelemetry(buildTelemetry(node, t0, batteryDrainRef.current));

    const id = setInterval(() => {
      batteryDrainRef.current += 0.0003; // ~1% per hour
      const t = (Date.now() - startRef.current) / 1000;
      setTelemetry(buildTelemetry(node, t, batteryDrainRef.current));
    }, 1100);

    return () => clearInterval(id);
  }, [node]);

  // ESC to close
  useEffect(() => {
    if (!node) return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Escape' && !e.ctrlKey && !e.metaKey) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [node, onClose]);

  if (!node || !telemetry) return null;

  const isOffline = telemetry.status === 'offline';
  const batColor  = telemetry.battery > 50 ? '#22d48a'
                  : telemetry.battery > 20 ? '#f5a623' : '#ff5555';

  return (
    <div style={S.root}>
      <div style={S.panel}>
        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <div style={S.header}>
          <div style={S.headerTop}>
            <span style={S.shortId}>{telemetry.shortId}</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                ...S.statusBadge,
                ...(isOffline ? S.statusBadgeOffline : {}),
              }}>
                <span style={{ ...S.statusDot, ...(isOffline ? S.statusDotOffline : {}) }} />
                {telemetry.status.toUpperCase()}
              </div>
              <button style={S.closeBtn} onClick={onClose} title="Close (ESC)">
                ×
              </button>
            </div>
          </div>

          <div style={S.typeLine}>{telemetry.typeFull}</div>
          <div style={S.opLine}>{telemetry.operation}</div>
        </div>

        {/* ── LIVE INDICATOR ─────────────────────────────────────────── */}
        {!isOffline && (
          <div style={S.liveBar}>
            <span style={S.liveDot} />
            <span style={S.liveLabel}>LIVE TELEMETRY</span>
            <span style={S.lastTx}>
              TX: {telemetry.lastTxSec.toFixed(1)} s ago
            </span>
          </div>
        )}

        {/* ── DATA ROWS ──────────────────────────────────────────────── */}
        <div style={S.rowsBlock}>
          {telemetry.rows.map((row, i) => (
            <div key={i} style={S.row}>
              <span style={S.rowLabel}>{row.label}</span>
              <span style={S.rowValue}>{row.value}</span>
              {row.unit && <span style={S.rowUnit}>{row.unit}</span>}
            </div>
          ))}
        </div>

        {/* ── BATTERY ────────────────────────────────────────────────── */}
        {telemetry.battery > 0 && (
          <div style={S.batRow}>
            <span style={S.batLabel}>Battery</span>
            <div style={S.batBar}>
              <div style={{
                ...S.batFill,
                width: `${telemetry.battery.toFixed(0)}%`,
                background: batColor,
              }} />
            </div>
            <span style={{ ...S.batPct, color: batColor }}>
              {telemetry.battery.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
