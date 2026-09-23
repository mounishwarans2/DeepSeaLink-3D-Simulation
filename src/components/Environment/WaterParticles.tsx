import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// WATER PARTICLES — suspended sediment / marine snow / deep-sea particles
//
// PERFORMANCE:
// - Only update every 2nd frame (halves CPU cost)
// - Particle spread spans full water column (Y = -1100 to +130)
//
// VISUAL:
// - Near surface: pale green-white plankton/marine snow
// - At depth: very sparse, dark, barely visible
// ─────────────────────────────────────────────────────────────────────────────

export const WaterParticles: FC<{ count?: number }> = ({ count = 1200 }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const frameSkip = useRef(0);

  const [positions, speeds, driftX, driftZ] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    const dX  = new Float32Array(count);
    const dZ  = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Wide XZ spread across the abyssal plain
      pos[i * 3]     = (Math.random() - 0.5) * 4000;
      // Y: from deep trench up to near-surface, weighted toward mid-water
      pos[i * 3 + 1] = Math.random() * 1300 - 1100;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4000;

      // Marine snow falls very slowly
      spd[i] = 0.006 + Math.random() * 0.012;
      dX[i]  = (Math.random() - 0.5) * 0.003;
      dZ[i]  = (Math.random() - 0.5) * 0.003;
    }

    return [pos, spd, dX, dZ];
  }, [count]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    // Skip every other frame — halves CPU particle update cost
    frameSkip.current = (frameSkip.current + 1) % 2;
    if (frameSkip.current !== 0) return;

    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    // Compensate for double-delta (we skip every other frame)
    const dt = delta * 2;

    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] -= speeds[i] * dt * 6;
      arr[i * 3]     += driftX[i] * dt * 8;
      arr[i * 3 + 2] += driftZ[i] * dt * 8;

      // Recycle at seabed / trench bottom — reappear near surface
      if (arr[i * 3 + 1] < -1120) {
        arr[i * 3 + 1] = 125;
        arr[i * 3]     = (Math.random() - 0.5) * 4000;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 4000;
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.8}
        color="#b0c8c0"
        transparent
        opacity={0.38}
        sizeAttenuation
        blending={THREE.NormalBlending}
        depthWrite={false}
      />
    </points>
  );
};
