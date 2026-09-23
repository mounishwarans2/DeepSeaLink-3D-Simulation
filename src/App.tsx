import { Canvas } from '@react-three/fiber';
import { useState, useCallback } from 'react';
import type { FC } from 'react';
import { DepthDisplay } from './components/Camera/CameraHUD';
import { FreeCameraController } from './components/Camera/FreeCameraController';
import { DeviceInteraction } from './components/Interaction/DeviceInteraction';
import { DeviceInspector } from './components/Interaction/DeviceInspector';
import { OceanEnvironment } from './components/Ocean/OceanEnvironment';
import type { HardwareNode } from './types';

export const App: FC = () => {
  const [selectedNode,       setSelectedNode]       = useState<HardwareNode | null>(null);
  const [hoveredNodeId,      setHoveredNodeId]      = useState<string | null>(null);
  const [marineLifeVisible,  setMarineLifeVisible]  = useState(true);

  const handleSelect  = useCallback((node: HardwareNode | null) => setSelectedNode(node),  []);
  const handleHover   = useCallback((id: string | null)          => setHoveredNodeId(id),   []);
  const handleClose   = useCallback(() => setSelectedNode(null), []);

  const handleCanvasClick = useCallback(() => {
    if (!hoveredNodeId) setSelectedNode(null);
  }, [hoveredNodeId]);

  const toggleMarineLife = useCallback(() => setMarineLifeVisible((v) => !v), []);

  return (
    <main style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* ── 3D Underwater Digital Twin Canvas ───────────────────────────── */}
      <Canvas
        camera={{ position: [0, 1200, -8000], fov: 65, near: 0.5, far: 35000 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: 4,
          toneMappingExposure: 1.1,
        }}
        dpr={Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5)}
        onClick={handleCanvasClick}
      >
        <FreeCameraController />
        <DepthDisplay />
        <OceanEnvironment marineLifeVisible={marineLifeVisible} />
        <DeviceInteraction
          selectedNodeId={selectedNode?.id ?? null}
          hoveredNodeId={hoveredNodeId}
          onSelect={handleSelect}
          onHover={handleHover}
        />
      </Canvas>

      {/* ── HTML Overlays ─────────────────────────────────────────────────── */}
      <DeviceInspector node={selectedNode} onClose={handleClose} />

      {/* Marine Life toggle — bottom-centre layer chip */}
      <div
        style={{
          position: 'absolute',
          bottom: '1.25rem',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '0.5rem',
          pointerEvents: 'auto',
          zIndex: 20,
        }}
      >
        <button
          onClick={toggleMarineLife}
          className={`layer-chip${marineLifeVisible ? ' active' : ''}`}
          style={{ cursor: 'pointer', border: 'none', userSelect: 'none' }}
          title="Toggle marine life visibility"
        >
          🐟 Marine Life {marineLifeVisible ? '●' : '○'}
        </button>
      </div>
    </main>
  );
};

export default App;
