import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// WATER SURFACE v4 — Camera-following infinite ocean
//
// The plane FOLLOWS the camera horizontally every frame so the ocean boundary
// is always 40,000 units away — far beyond the fog horizon — making the ocean
// appear effectively infinite. No visible rectangular water edge.
//
// Plane: 80,000 × 80,000 at Y=125 (sea level)
// Segments: 80×80 (1000-unit spacing — fine for a distant surface)
// Waves computed in world-space so they are consistent regardless of
// camera position (no wave-sliding artefact as camera moves).
//
// Edge fade: only in the outermost 4% of UV (the edge is always beyond
// the fog horizon, so this is purely a safety fade).
// ─────────────────────────────────────────────────────────────────────────────

const WATER_VERT = /* glsl */`
  uniform float uTime;
  uniform vec2  uCamXZ;   // camera world XZ — for world-space wave coordinates

  varying vec2 vUv2;

  void main(){
    vUv2 = uv;
    vec3 pos = position;

    // World-space XZ: mesh centre follows camera, so world = local + camera
    float wx = pos.x + uCamXZ.x;
    float wz = pos.z + uCamXZ.y;

    // Four overlapping wave layers (world-space coords → consistent waves)
    float wave =
      sin(wx * 0.040 + uTime * 1.10) * 1.8 +
      cos(wz * 0.050 + uTime * 0.90) * 1.4 +
      sin(wx * 0.030 + wz * 0.030 + uTime * 0.70) * 0.8 +
      cos(wx * 0.060 + uTime * 1.30) * 0.5;

    pos.y += wave;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(pos, 1.0);
  }
`;

const WATER_FRAG = /* glsl */`
  varying vec2 vUv2;

  void main(){
    // Fade only in the outermost 4% of UV — edge is beyond fog horizon
    vec2 c = vUv2 - 0.5;
    float edgeDist = max(abs(c.x), abs(c.y));
    float edgeFade = 1.0 - smoothstep(0.46, 0.50, edgeDist);

    // Uniform shallow tropical ocean colour — same as near-land water
    // Slight brightness variation for visual interest (not a dark/light split)
    float shimmer = 1.0 - length(c) * 0.4;
    vec3 shallowBlue = vec3(0.13, 0.48, 0.72);
    vec3 waterCol    = shallowBlue * clamp(shimmer, 0.85, 1.0);

    gl_FragColor = vec4(waterCol, 0.80 * edgeFade);
  }
`;

export const WaterSurface: FC = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.ShaderMaterial>(null);

  const shaderData = useMemo(() => ({
    uniforms: {
      uTime:  { value: 0 },
      uCamXZ: { value: new THREE.Vector2(0, 0) },
    },
    vertexShader:   WATER_VERT,
    fragmentShader: WATER_FRAG,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  }), []);

  useFrame((state) => {
    const t  = state.clock.getElapsedTime();
    const cx = state.camera.position.x;
    const cz = state.camera.position.z;

    if (matRef.current) {
      matRef.current.uniforms.uTime.value = t;
      matRef.current.uniforms.uCamXZ.value.set(cx, cz);
    }

    // Follow camera XZ — ocean always centred on player, edge never visible
    if (meshRef.current) {
      meshRef.current.position.x = cx;
      meshRef.current.position.z = cz;
    }
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 125, 0]}
      frustumCulled={false}
    >
      {/*
        80,000 × 80,000 — ocean extends 40 km from camera in every direction.
        Far clipping plane is 35,000 — the edge is never visible.
        80 segments → 1,000-unit spacing: efficient, smooth at distance.
      */}
      <planeGeometry args={[80000, 80000, 80, 80]} />
      <shaderMaterial ref={matRef} args={[shaderData]} />
    </mesh>
  );
};
