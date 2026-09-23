import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// DEPTH-AWARE FOG
//
// Above water (Y > 125): sky-blue background, light atmospheric haze —
//   so the user can see the sand-coloured land clearly from above.
//
// Underwater (Y < 125): deep ocean gradient, blue fog.
//
// CRITICAL FIX: previous version set scene.background = dark blue even
//   when camera was above water. This made the land invisible — dark blue
//   behind bright sand = land appeared as a thin stripe against dark sky.
// ─────────────────────────────────────────────────────────────────────────────

const _col = new THREE.Color();

const UNDERWATER_COLORS = [
  { y:  125, bg: '#1a7ab0', fog: '#1a6898' },  // water surface
  { y:   40, bg: '#005888', fog: '#004870' },
  { y:    0, bg: '#004e78', fog: '#003c60' },
  { y: -100, bg: '#003860', fog: '#002c50' },
  { y: -330, bg: '#002848', fog: '#001e38' },
  { y: -700, bg: '#001830', fog: '#001020' },
  { y: -900, bg: '#001020', fog: '#000c18' },
];

function lerpUnderwaterColor(y: number, field: 'bg' | 'fog'): THREE.Color {
  const colors = UNDERWATER_COLORS;
  if (y >= colors[0].y) return _col.set(colors[0][field]);
  if (y <= colors[colors.length - 1].y) return _col.set(colors[colors.length - 1][field]);
  for (let i = 0; i < colors.length - 1; i++) {
    const a = colors[i], b = colors[i + 1];
    if (y <= a.y && y >= b.y) {
      const t = (a.y - y) / (a.y - b.y);
      _col.set(a[field]).lerp(new THREE.Color(b[field]), t);
      return _col;
    }
  }
  return _col.set(colors[colors.length - 1][field]);
}

export const UnderwaterFog: FC = () => {
  const { scene, camera } = useThree();
  const fogRef    = useRef<THREE.FogExp2 | null>(null);
  const frameSkip = useRef(0);

  useEffect(() => {
    // Start with sky background since camera now starts above water
    const fog = new THREE.FogExp2('#7ab8e0', 0.000018);
    scene.fog = fog;
    fogRef.current = fog;
    scene.background = new THREE.Color('#6ab0dc');
    return () => { scene.fog = null; };
  }, [scene]);

  useFrame(() => {
    frameSkip.current = (frameSkip.current + 1) % 4;
    if (frameSkip.current !== 0) return;

    const y = camera.position.y;
    const SEA_Y = 125;
    const isAboveWater = y > SEA_Y;

    let density: number;
    let bgColor: THREE.Color;
    let fogColor: THREE.Color;

    if (isAboveWater) {
      // ── ABOVE WATER — sky and atmospheric haze ──────────────────────
      // Density 0.000040 hides terrain edges at 28000+ units (67% fog there)
      // while keeping coast at 5000 units clearly visible (18% fog there).
      density = 0.000040;

      // Sky gradient: higher camera → lighter sky
      const skyT = Math.min(1, (y - SEA_Y) / 1200);
      const skyLow  = new THREE.Color('#4a9acc');  // low horizon — medium blue
      const skyHigh = new THREE.Color('#87b8e0');  // high altitude — lighter
      bgColor  = skyLow.clone().lerp(skyHigh, skyT);
      fogColor = new THREE.Color('#a0c8e8');        // light atmospheric haze
    } else {
      // ── UNDERWATER — deep ocean gradient ───────────────────────────
      if      (y >= -300) density = THREE.MathUtils.lerp(0.000030, 0.000045, (SEA_Y - y) / (SEA_Y + 300));
      else if (y >= -700) density = THREE.MathUtils.lerp(0.000045, 0.000070, (-300 - y) / 400);
      else                density = Math.min(0.000100, THREE.MathUtils.lerp(0.000070, 0.000100, (-700 - y) / 300));

      bgColor  = lerpUnderwaterColor(y, 'bg');
      fogColor = lerpUnderwaterColor(y, 'fog');
    }

    if (fogRef.current) {
      fogRef.current.color.lerp(fogColor, 0.10);
      fogRef.current.density = density;
    }
    if (scene.background instanceof THREE.Color) {
      (scene.background as THREE.Color).lerp(bgColor, 0.10);
    }
  });

  return null;
};
