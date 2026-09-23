import * as THREE from 'three';

// Natural warm-white sunlight shaft — filtered through ocean surface
// Like real underwater sunbeam photography: soft, wide, slightly warm
export const LightShaftShader = {
  uniforms: {
    uTime:  { value: 0 },
    uColor: { value: new THREE.Color('#d8f4ff') },  // Pale warm-white, not cyan neon
    uAlpha: { value: 0.13 },                         // Very subtle — not sci-fi beams
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3  uColor;
    uniform float uAlpha;

    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
      // Fade at top and bottom of the shaft plane (entering/exiting water)
      float vertFade = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
      // Soft edges horizontally — like natural caustic-edge blurring
      float horzFade = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);

      // Very slow ripple to simulate shaft wobble as surface moves
      float ripple1 = sin(vUv.x * 8.0  + uTime * 0.45) * 0.5 + 0.5;
      float ripple2 = cos(vUv.y * 5.0  + uTime * 0.28) * 0.5 + 0.5;
      float intensity = ripple1 * ripple2 * vertFade * horzFade;

      // Center of shaft slightly brighter than edges
      float centerBoost = 1.0 - abs(vUv.x - 0.5) * 2.0;
      intensity *= (0.7 + 0.3 * centerBoost);

      vec3 color = uColor * (0.7 + 0.3 * intensity);
      float alpha = uAlpha * intensity;

      gl_FragColor = vec4(color, alpha);
    }
  `,
};
