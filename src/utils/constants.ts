import type { AcousticLink, HardwareNode, OceanConfig } from '../types';

export const DEFAULT_OCEAN_CONFIG: OceanConfig = {
  depth: 10900,
  fogColor: '#001a2e',
  fogDensity: 0.00015,
  waterColorDeep: '#000d1a',
  waterColorShallow: '#005577',
  causticsEnabled: true,
  sunlightIntensity: 2.0,
};

// ── WORLD SCALE ───────────────────────────────────────────────────────────────
// 1 world unit ≈ 10 meters real depth
// Surface:          Y = +120   (≈ sea surface)
// Mid-water:        Y =   0  to -100
// Deep water:       Y = -100  to -300
// Abyssal plain:    Y = -400  (≈ 4,000 m)
// Mariana Trench:   Y = -1090 (≈ Challenger Deep 10,900 m)
// ─────────────────────────────────────────────────────────────────────────────

export const SEABED_PARAMS = {
  width:          16000,
  depth:          16000,
  segments:       320,
  baseDepth:      -400,   // abyssal plain in world coords
  elevationScale: 140.0,  // large geological variation
};

export const WATER_SURFACE_PARAMS = {
  width:  18000,
  depth:  18000,
  height: 125,   // sea surface
};

// ── HARDWARE NODES ────────────────────────────────────────────────────────────
// Distributed realistically through 10,900 m water column
// X/Z positions spread for visual clarity — Y depths match simulation data
export const HARDWARE_NODES: HardwareNode[] = [

  // ─ 1. SUBSEA MASTER GATEWAY — Abyssal Plain (≈4,000 m depth) ────────────
  {
    id: 'gw-01',
    name: 'Subsea Master Gateway Hub (GW-01)',
    type: 'gateway',
    position: [0, -400, 0],
    rotation: [0, 0.25, 0],
    status: 'transmitting',
    depth: 4000,
    batteryLevel: 99,
    frequencyKhz: 24.0,
  },

  // ─ 2. WORKCLASS ROV — Abyssal Plain (≈3,900 m) ─────────────────────────
  {
    id: 'rov-01',
    name: 'Oceanus Workclass ROV-01',
    type: 'rov',
    position: [90, -394, 60],
    rotation: [0.04, -0.65, 0],
    status: 'active',
    depth: 3940,
    batteryLevel: 94,
  },

  // ─ 3. AUVs — Mid-Water Survey (≈1,000 m and ≈500 m) ────────────────────
  {
    id: 'auv-01',
    name: 'Explorer AUV-01 (Deep Mid-Water Survey)',
    type: 'auv',
    position: [-380, -100, 440],
    rotation: [0, 0.55, 0],
    status: 'transmitting',
    depth: 1000,
    batteryLevel: 86,
    frequencyKhz: 18.0,
  },
  {
    id: 'auv-02',
    name: 'Surveyor AUV-02 (Upper Water Transect)',
    type: 'auv',
    position: [640, -48, -560],
    rotation: [0, -0.85, 0],
    status: 'receiving',
    depth: 480,
    batteryLevel: 78,
    frequencyKhz: 22.0,
  },

  // ─ 4. SURFACE TELEMETRY SPAR BUOY ──────────────────────────────────────
  {
    id: 'buoy-01',
    name: 'Surface Telemetry Spar Buoy (STB-01)',
    type: 'buoy',
    position: [-680, 120, -460],
    status: 'active',
    depth: 0,
    batteryLevel: 100,
    frequencyKhz: 32.0,
  },

  // ─ 5. ACOUSTIC RELAYS — Multiple Depth Tiers ───────────────────────────
  {
    id: 'relay-01',
    name: 'Acoustic Relay Alpha (RL-01)',
    type: 'relay',
    position: [-580, -28, -480],
    status: 'transmitting',
    depth: 280,
    batteryLevel: 92,
    frequencyKhz: 24.0,
  },
  {
    id: 'relay-02',
    name: 'Acoustic Relay Bravo (RL-02)',
    type: 'relay',
    position: [660, -160, -380],
    status: 'receiving',
    depth: 1600,
    batteryLevel: 95,
    frequencyKhz: 24.0,
  },
  {
    id: 'relay-03',
    name: 'Acoustic Relay Charlie (RL-03)',
    type: 'relay',
    position: [-460, -260, 560],
    status: 'active',
    depth: 2600,
    batteryLevel: 84,
    frequencyKhz: 24.0,
  },
  {
    id: 'relay-04',
    name: 'Acoustic Relay Delta (RL-04)',
    type: 'relay',
    position: [560, -340, 660],
    status: 'standby',
    depth: 3400,
    batteryLevel: 91,
    frequencyKhz: 24.0,
  },

  // ─ 6. CTD ROSETTE — Deep Benthic (≈4,100 m) ────────────────────────────
  {
    id: 'pkg-01',
    name: 'Deep Benthic CTD Rosette (PKG-01)',
    type: 'sensor_package',
    position: [-260, -408, -300],
    rotation: [0, 0.35, 0],
    status: 'active',
    depth: 4080,
    batteryLevel: 96,
  },

  // ─ 7. BENTHIC SENSOR ARRAY — Abyssal Plain ─────────────────────────────
  { id: 'sn-01', name: 'Benthic Lander 01',     type: 'sensor', variant: 1, position: [ -200, -398,  200], status: 'transmitting', depth: 3980, batteryLevel: 88, frequencyKhz: 12.5 },
  { id: 'sn-02', name: 'Acoustic Frame 02',      type: 'sensor', variant: 2, position: [  300, -396,  280], status: 'receiving',    depth: 3960, batteryLevel: 75, frequencyKhz: 12.5 },
  { id: 'sn-03', name: 'ADCP Benthic Node 03',   type: 'sensor', variant: 3, position: [ -420, -399, -240], status: 'active',       depth: 3990, batteryLevel: 92, frequencyKhz: 12.5 },
  { id: 'sn-04', name: 'Benthic Lander 04',      type: 'sensor', variant: 1, position: [  460, -397, -360], status: 'transmitting', depth: 3970, batteryLevel: 81, frequencyKhz: 12.5 },
  { id: 'sn-05', name: 'Acoustic Frame 05',      type: 'sensor', variant: 2, position: [ -680, -401, -620], status: 'receiving',    depth: 4010, batteryLevel: 94, frequencyKhz: 12.5 },
  { id: 'sn-06', name: 'ADCP Benthic Node 06',   type: 'sensor', variant: 3, position: [  840, -400, -580], status: 'active',       depth: 4000, batteryLevel: 83, frequencyKhz: 12.5 },
  { id: 'sn-07', name: 'Benthic Lander 07',      type: 'sensor', variant: 1, position: [ -920, -402,  340], status: 'transmitting', depth: 4020, batteryLevel: 69, frequencyKhz: 12.5 },
  { id: 'sn-08', name: 'Acoustic Frame 08',      type: 'sensor', variant: 2, position: [  980, -401,  520], status: 'receiving',    depth: 4010, batteryLevel: 90, frequencyKhz: 12.5 },

  // ─ 8. ABYSSAL NODES — Deeper Plain/Slope ───────────────────────────────
  { id: 'sn-09', name: 'ADCP Benthic Node 09',        type: 'sensor', variant: 3, position: [ -500, -480,  820], status: 'active',       depth: 4800, batteryLevel: 87, frequencyKhz: 12.5 },
  { id: 'sn-10', name: 'Benthic Lander 10 [OFFLINE]', type: 'sensor', variant: 1, position: [  580, -510,  880], status: 'offline',      depth: 5100, batteryLevel: 0,  frequencyKhz: 12.5 },
  { id: 'sn-11', name: 'Abyssal Node 11',              type: 'sensor', variant: 2, position: [-1200, -560,-1020], status: 'active',       depth: 5600, batteryLevel: 82, frequencyKhz: 12.5 },
  { id: 'sn-12', name: 'Abyssal Node 12',              type: 'sensor', variant: 3, position: [ 1200, -590,-1080], status: 'transmitting', depth: 5900, batteryLevel: 77, frequencyKhz: 12.5 },

  // ─ 9. MARIANA TRENCH SENSORS — Challenger Deep Zone ────────────────────
  { id: 'sn-13', name: 'Trench Lander 13',        type: 'sensor', variant: 1, position: [ -100, -950,-1400], status: 'active',    depth: 9500,  batteryLevel: 91, frequencyKhz: 12.5 },
  { id: 'sn-14', name: 'Challenger Deep Node 14', type: 'sensor', variant: 2, position: [  160,-1040,-1560], status: 'receiving', depth: 10400, batteryLevel: 86, frequencyKhz: 12.5 },
  { id: 'sn-15', name: 'Challenger Deep Node 15', type: 'sensor', variant: 3, position: [  -60,-1060,-1480], status: 'standby',  depth: 10600, batteryLevel: 98, frequencyKhz: 12.5 },
];

// ── MESH TOPOLOGY NETWORK ─────────────────────────────────────────────────────
// Sub-nodes: half-floating mid-water aggregation points (~1,200m depth)
// Main node: surface-floating gateway that transmits to land server
// ─────────────────────────────────────────────────────────────────────────────
export const SUB_NODES: [number, number, number][] = [
  [ -280, -120,  200],   // Sub-node A — NW quadrant
  [  300, -120, -250],   // Sub-node B — NE quadrant
  [ -260, -120, -300],   // Sub-node C — SW quadrant
  [  320, -120,  280],   // Sub-node D — SE quadrant
];

// Main floating node at ocean surface — relays to land server
export const MAIN_FLOATING_NODE_POS: [number, number, number] = [0, 95, 0];

// Land server anchor point (base of the receiving dish on land)
export const LAND_SERVER_POS: [number, number, number] = [8400, -350, 0];

export const ACTIVE_ACOUSTIC_LINKS: AcousticLink[] = [
  { id: 'link-01', sourceId: 'sn-01',    targetId: 'gw-01',    frequencyKhz: 12.5, active: true, snrDb: 22.4 },
  { id: 'link-02', sourceId: 'sn-04',    targetId: 'gw-01',    frequencyKhz: 12.5, active: true, snrDb: 19.8 },
  { id: 'link-03', sourceId: 'auv-01',   targetId: 'relay-01', frequencyKhz: 18.0, active: true, snrDb: 26.1 },
  { id: 'link-04', sourceId: 'relay-01', targetId: 'gw-01',    frequencyKhz: 24.0, active: true, snrDb: 28.5 },
  { id: 'link-05', sourceId: 'sn-12',    targetId: 'relay-02', frequencyKhz: 12.5, active: true, snrDb: 16.2 },
  { id: 'link-06', sourceId: 'relay-02', targetId: 'auv-02',   frequencyKhz: 24.0, active: true, snrDb: 21.0 },
  { id: 'link-07', sourceId: 'sn-07',    targetId: 'relay-03', frequencyKhz: 12.5, active: true, snrDb: 18.5 },
  { id: 'link-08', sourceId: 'relay-03', targetId: 'gw-01',    frequencyKhz: 24.0, active: true, snrDb: 25.0 },
];
