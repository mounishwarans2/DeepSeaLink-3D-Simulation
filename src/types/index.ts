export type HardwareType =
  | 'sensor'
  | 'relay'
  | 'gateway'
  | 'auv'
  | 'rov'
  | 'buoy'
  | 'sensor_package';

export type NodeStatus = 'active' | 'standby' | 'transmitting' | 'receiving' | 'offline';

export interface HardwareNode {
  id: string;
  name: string;
  type: HardwareType;
  position: [number, number, number];
  rotation?: [number, number, number];
  status: NodeStatus;
  depth: number;
  variant?: number;
  batteryLevel?: number;
  frequencyKhz?: number;
}

export interface AcousticLink {
  id: string;
  sourceId: string;
  targetId: string;
  frequencyKhz: number;
  active: boolean;
  snrDb: number;
}

export interface OceanConfig {
  depth: number;
  fogColor: string;
  fogDensity: number;
  waterColorDeep: string;
  waterColorShallow: string;
  causticsEnabled: boolean;
  sunlightIntensity: number;
}

export interface CameraTelemetry {
  position: [number, number, number];
  target: [number, number, number];
  distance: number;
}

export interface SystemStatus {
  milestone: number;
  milestoneTitle: string;
  statusText: string;
  nodeCount: number;
}
