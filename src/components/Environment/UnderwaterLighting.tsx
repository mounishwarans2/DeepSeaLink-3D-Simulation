import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// DEPTH-AWARE UNDERWATER LIGHTING  v2
//
// Goal: Everything visible at all depths. No black seabed. No pure white.
//
// Key fix: ambient color was #1a4060 (very dark). PBR formula:
//   finalPixel = albedo × lightColor × intensity
//   dark lightColor = dark output even at high intensity.
// New ambient color: #a8c8dc (light blue-grey) → materials show true albedo.
//
// Depth curve:
//   Surface   Y > 100:    intensity 1.4 (sunlit, slightly blue-white)
//   Shallow   Y 0–100:    1.3
//   Mid       Y -100–0:   1.2
//   Deep      Y -400:     1.0
//   Abyss     Y -700:     0.85
//   Trench    Y < -900:   0.70 (dark but still readable)
// ─────────────────────────────────────────────────────────────────────────────

export const UnderwaterLighting: FC = () => {
  const { camera } = useThree();
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef    = useRef<THREE.HemisphereLight>(null);
  const sunRef     = useRef<THREE.DirectionalLight>(null);
  const fillRef    = useRef<THREE.DirectionalLight>(null);
  const frameSkip  = useRef(0);

  useFrame(() => {
    frameSkip.current = (frameSkip.current + 1) % 6;
    if (frameSkip.current !== 0) return;

    const y = camera.position.y;

    // Ambient intensity — never below 0.70 so nothing goes black
    let ambient: number;
    if      (y >= 100)  ambient = 1.4;
    else if (y >= 0)    ambient = THREE.MathUtils.lerp(1.3, 1.4, (y) / 100);
    else if (y >= -100) ambient = THREE.MathUtils.lerp(1.2, 1.3, (-y) / 100);
    else if (y >= -400) ambient = THREE.MathUtils.lerp(1.0, 1.2, (-100 - y) / 300);
    else if (y >= -700) ambient = THREE.MathUtils.lerp(0.85, 1.0, (-400 - y) / 300);
    else if (y >= -950) ambient = THREE.MathUtils.lerp(0.70, 0.85, (-700 - y) / 250);
    else                ambient = 0.70;

    if (ambientRef.current) ambientRef.current.intensity = ambient;
    if (hemiRef.current)    hemiRef.current.intensity    = ambient * 0.60;

    // Sun fades with depth — gone below 200m
    if (sunRef.current) {
      sunRef.current.intensity = Math.max(0.0, Math.min(1.0, (y + 100) / 150));
    }

    // Bottom fill — steady
    if (fillRef.current) {
      fillRef.current.intensity = Math.max(0.30, ambient * 0.28);
    }
  });

  return (
    <>
      {/* Ambient: light blue-grey #a8c8dc — bright enough to show true material color */}
      <ambientLight
        ref={ambientRef}
        color="#a8c8dc"
        intensity={1.4}
      />

      {/* Hemisphere: sky #3878a0 (medium ocean blue) → ground #182838 (dark navy seabed) */}
      <hemisphereLight
        ref={hemiRef}
        args={['#3878a0', '#182838', 0.80]}
      />

      {/* Directional sun — cool blue-white, surface only */}
      <directionalLight
        ref={sunRef}
        position={[400, 2000, 300]}
        color="#c0dff0"
        intensity={1.0}
        castShadow={false}
      />

      {/* Upward fill — lights seabed bottom faces */}
      <directionalLight
        ref={fillRef}
        position={[0, -2000, 0]}
        color="#203850"
        intensity={0.4}
      />
    </>
  );
};
