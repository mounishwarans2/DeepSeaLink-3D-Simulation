import { Anchor, Compass, Radio, Thermometer, Waves, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { HARDWARE_NODES } from '../../utils/constants';

export const MilestoneOverlay: FC = () => {
  const [seconds, setSeconds] = useState(5077); // Starts at 01:24:37
  const [packetsSent, setPacketsSent] = useState(12548);
  const [packetsReceived, setPacketsReceived] = useState(12376);
  const [dataRate, setDataRate] = useState(2.48);
  const [packetLoss, setPacketLoss] = useState(0.68);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
      setPacketsSent((prev) => prev + Math.floor(1 + Math.random() * 3));
      setPacketsReceived((prev) => prev + Math.floor(1 + Math.random() * 3));
      setDataRate(+(2.42 + Math.random() * 0.14).toFixed(2));
      setPacketLoss(+(0.62 + Math.random() * 0.12).toFixed(2));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const nodeCycleTimer = setInterval(() => {
      setSelectedNodeIndex((prev) => (prev + 1) % HARDWARE_NODES.length);
    }, 4500);

    return () => clearInterval(nodeCycleTimer);
  }, []);

  const currentNode = HARDWARE_NODES[selectedNodeIndex];

  // Format seconds to HH:MM:SS
  const formatTime = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  return (
    <div className="hud-container">
      {/* Top Header Bar */}
      <header className="hud-header">
        <div className="hud-title-section">
          <div className="hud-badge">
            <span className="badge-dot"></span>
            REAL-TIME SIMULATION
          </div>
          <h1>DEEP OCEAN ACOUSTIC COMMUNICATION DIGITAL TWIN</h1>
          <p className="hud-subtitle">Subsea Autonomous Array & Physical Wave Propagation Platform</p>
        </div>

        <div className="hud-top-telemetry">
          <div className="top-telemetry-item">
            <span className="telemetry-label">SIMULATION TIME</span>
            <span className="telemetry-val">{formatTime(seconds)}</span>
          </div>
          <div className="top-telemetry-item">
            <span className="telemetry-label">DEPTH</span>
            <span className="telemetry-val">{currentNode.depth.toFixed(1)} m</span>
          </div>
          <div className="top-telemetry-item">
            <span className="telemetry-label">ENVIRONMENT</span>
            <span className="telemetry-val good">● GOOD</span>
          </div>
        </div>
      </header>

      {/* Left Panel: Network Overview & Signal Strength */}
      <aside className="hud-left-panel">
        <div className="telemetry-card">
          <div className="card-header">
            <Radio size={14} />
            <span>NETWORK OVERVIEW</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Total Nodes</span>
            <span className="metric-value highlight">25 Devices</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Active Links</span>
            <span className="metric-value">8 Channels</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Data Rate</span>
            <span className="metric-value highlight">{dataRate} kbps</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Packets Sent</span>
            <span className="metric-value">{packetsSent.toLocaleString()}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Packets Received</span>
            <span className="metric-value">{packetsReceived.toLocaleString()}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Packet Loss</span>
            <span className="metric-value" style={{ color: '#4ade80' }}>
              {packetLoss} %
            </span>
          </div>
        </div>

        <div className="telemetry-card">
          <div className="card-header">
            <Zap size={14} />
            <span>SIGNAL STRENGTH</span>
          </div>
          <div className="signal-gradient-bar">
            <div className="gradient-segment strong">Strong</div>
            <div className="gradient-segment good">Good</div>
            <div className="gradient-segment medium">Medium</div>
            <div className="gradient-segment weak">Weak</div>
          </div>
        </div>
      </aside>

      {/* Right Panel: Selected Node Details & Environment Telemetry */}
      <aside className="hud-right-panel">
        <div className="telemetry-card">
          <div className="card-header">
            <Anchor size={14} />
            <span>SELECTED NODE DETAILS</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Target Node</span>
            <span className="metric-value highlight">{currentNode.name}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Node Type</span>
            <span className="metric-value" style={{ textTransform: 'capitalize' }}>
              {currentNode.type.replace('_', ' ')}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Operating State</span>
            <span
              className="metric-value"
              style={{
                color:
                  currentNode.status === 'transmitting'
                    ? '#38bdf8'
                    : currentNode.status === 'receiving'
                      ? '#22c55e'
                      : currentNode.status === 'active'
                        ? '#60a5fa'
                        : currentNode.status === 'standby'
                          ? '#f59e0b'
                          : '#ef4444',
              }}
            >
              ● {currentNode.status.toUpperCase()}
            </span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Battery Level</span>
            <span className="metric-value">{currentNode.batteryLevel} %</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Signal Strength</span>
            <span className="metric-value">
              {currentNode.status === 'offline' ? 'N/A' : `-${Math.floor(58 + Math.random() * 18)} dBm`}
            </span>
          </div>
        </div>

        <div className="telemetry-card">
          <div className="card-header">
            <Thermometer size={14} />
            <span>OCEAN HYDROGRAPHY</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Water Temp.</span>
            <span className="metric-value">4.2 °C</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Salinity</span>
            <span className="metric-value">34.7 PSU</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Sound Speed</span>
            <span className="metric-value highlight">1,482 m/s</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Pressure</span>
            <span className="metric-value">49.3 bar</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Visibility</span>
            <span className="metric-value">62 m Horizon</span>
          </div>
        </div>
      </aside>

      {/* Bottom Bar: Layer Toggles & Camera Hints */}
      <footer className="hud-footer">
        <div className="hud-controls-hint">
          <Compass size={14} />
          <span>CINEMATIC DIGITAL TWIN: Left Drag = Orbit | Right Drag = Pan | Scroll = Zoom</span>
        </div>

        <div className="hud-layer-toggles">
          <span className="layer-chip active">Nodes (25)</span>
          <span className="layer-chip active">Acoustic Waves</span>
          <span className="layer-chip active">AUVs / ROV</span>
          <span className="layer-chip active">Marine Life</span>
        </div>

        <div className="hud-live-tag">
          <Waves size={14} className="pulse-icon" />
          <span>PHYSICAL ACOUSTIC PROPAGATION ACTIVE</span>
        </div>
      </footer>
    </div>
  );
};
