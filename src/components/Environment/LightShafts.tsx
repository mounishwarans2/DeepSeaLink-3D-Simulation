import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';
import { LightShaftShader } from '../../shaders/lightShaftShader';

// ─────────────────────────────────────────────────────────────────────────────
// VOLUMETRIC LIGHT SHAFTS — sunlight filtering through ocean surface
//
// Positioned at surface (Y=+120) pointing downward.
// Shafts extend ~800 world units downward (~8000m reach in theory),
// but visibility is limited by fog and depth-based attenuation.
// Only really visible in upper 200–300 world units (2000–3000m).
// ─────────────────────────────────────────────────────────────────────────────

export const LightShafts: FC = () => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const shaderData = useMemo(() => ({
    uniforms: THREE.UniformsUtils.clone(LightShaftShader.uniforms),
    vertexShader:   LightShaftShader.vertexShader,
    fragmentShader: LightShaftShader.fragmentShader,
  }), []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  // Wider, taller shafts appropriate for deep-ocean scale
  const shafts = [
    { x:   0, z:   0, ry: 0.0,            tiltX:  0.04, tiltZ:  0.04 },
    { x:  60, z: -40, ry: Math.PI * 0.30, tiltX:  0.06, tiltZ: -0.04 },
    { x: -70, z:  30, ry: Math.PI * 0.65, tiltX: -0.05, tiltZ:  0.05 },
    { x:  30, z:  80, ry: Math.PI * 1.05, tiltX:  0.04, tiltZ:  0.07 },
    { x: -35, z: -80, ry: Math.PI * 1.45, tiltX: -0.04, tiltZ: -0.05 },
  ];

  return (
    // Position at ocean surface level
    <group position={[0, 118, 0]}>
      {shafts.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, 0, s.z]}
          rotation={[s.tiltX, s.ry, s.tiltZ]}
        >
          {/* Width=140, Height=600 — tall enough to reach mid-water */}
          <planeGeometry args={[140, 600]} />
          <shaderMaterial
            ref={i === 0 ? materialRef : undefined}
            args={[shaderData]}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
};
