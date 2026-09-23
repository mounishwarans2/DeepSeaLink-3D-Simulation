import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// DEEP-OCEAN BENTHIC LIFE — visually colourful but scientifically toned
//
// Real deep-sea benthic life is NOT all black:
// - Glass sponges: white/cream/pale blue
// - Xenophyophores: yellowish-tan
// - Holothurians (sea cucumbers): dark red/orange
// - Stalked crinoids: pale yellow/orange
// - Deep-sea corals: white/orange/red/purple
// - Tube worms: pale pink/red tips with white tubes
// - Sediment surface: pale brown/tan/gray (light from bioluminescence)
//
// For ROV appearance: use muted-but-VISIBLE colours so objects retain
// their identity at depth under the overhead lighting.
//
// All geometry is InstancedMesh (3 draw calls) for performance.
// ─────────────────────────────────────────────────────────────────────────────

const SEABED_Y = -400;  // Abyssal plain base

// Colour palettes — each organism group has multiple visible colours
// spread across instances using modulo selection
const SPONGE_COLORS   = ['#c8d8e0', '#b0c4d0', '#a0b8c8', '#d8e8f0', '#90aabb'];  // pale blue-white
const MOUND_COLORS    = ['#8a7050', '#9a8060', '#706040', '#7a6848', '#5a5038'];   // tan/sand sediment
const WORM_COLORS     = ['#c86040', '#d07050', '#b85030', '#c05848', '#a84838'];   // dark red/orange

// ── STALKED SPONGES / GLASS SPONGES ──────────────────────────────────────────
const StalkedSponges: FC<{ count: number }> = ({ count }) => {
  const meshRef  = useRef<THREE.InstancedMesh>(null);
  const applyRef = useRef(false);

  const { matrices, colors } = useMemo(() => {
    const dummy   = new THREE.Object3D();
    const mats: THREE.Matrix4[]  = [];
    const cols: THREE.Color[]    = [];

    for (let i = 0; i < count; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * 600;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = SEABED_Y + Math.random() * 8;
      const h = 1.5 + Math.random() * 4.0;
      const w = 0.15 + Math.random() * 0.35;

      dummy.position.set(x, y + h * 0.5, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.15, Math.random() * Math.PI, 0);
      dummy.scale.set(w, h, w);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
      cols.push(new THREE.Color(SPONGE_COLORS[i % SPONGE_COLORS.length]));
    }
    return { matrices: mats, colors: cols };
  }, [count]);

  useFrame(() => {
    if (applyRef.current || !meshRef.current) return;
    matrices.forEach((mat, i) => {
      meshRef.current!.setMatrixAt(i, mat);
      meshRef.current!.setColorAt(i, colors[i]);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    applyRef.current = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <cylinderGeometry args={[1, 0.6, 1, 7]} />
      {/* roughness 0.6 — slightly shiny so glass-sponge silica sheen is visible */}
      <meshStandardMaterial roughness={0.6} metalness={0.05} />
    </instancedMesh>
  );
};

// ── SEDIMENT MOUNDS / XENOPHYOPHORES ─────────────────────────────────────────
const SedimentMounds: FC<{ count: number }> = ({ count }) => {
  const meshRef  = useRef<THREE.InstancedMesh>(null);
  const applyRef = useRef(false);

  const { matrices, colors } = useMemo(() => {
    const dummy = new THREE.Object3D();
    const mats: THREE.Matrix4[] = [];
    const cols: THREE.Color[]   = [];

    for (let i = 0; i < count; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const radius = 10 + Math.random() * 800;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = SEABED_Y + Math.random() * 3;
      const s = 0.4 + Math.random() * 2.0;

      dummy.position.set(x, y + s * 0.3, z);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.scale.set(s, s * (0.2 + Math.random() * 0.4), s);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
      cols.push(new THREE.Color(MOUND_COLORS[i % MOUND_COLORS.length]));
    }
    return { matrices: mats, colors: cols };
  }, [count]);

  useFrame(() => {
    if (applyRef.current || !meshRef.current) return;
    matrices.forEach((mat, i) => {
      meshRef.current!.setMatrixAt(i, mat);
      meshRef.current!.setColorAt(i, colors[i]);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    applyRef.current = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <icosahedronGeometry args={[1.0, 0]} />
      <meshStandardMaterial roughness={0.95} metalness={0.01} />
    </instancedMesh>
  );
};

// ── TUBE WORMS / HOLOTHURIANS — animated ──────────────────────────────────────
const BenthicWorms: FC<{ count: number }> = ({ count }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy   = useMemo(() => new THREE.Object3D(), []);

  const { bladeData, colors } = useMemo(() => {
    const data = new Float32Array(count * 6);
    const cols: THREE.Color[] = [];

    for (let i = 0; i < count; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const radius = 15 + Math.random() * 400;
      data[i * 6]     = Math.cos(angle) * radius;
      data[i * 6 + 1] = SEABED_Y + Math.random() * 2;
      data[i * 6 + 2] = Math.sin(angle) * radius;
      data[i * 6 + 3] = Math.random() * Math.PI;
      data[i * 6 + 4] = 1.5 + Math.random() * 4.0;
      data[i * 6 + 5] = Math.random() * Math.PI * 2;
      cols.push(new THREE.Color(WORM_COLORS[i % WORM_COLORS.length]));
    }
    return { bladeData: data, colors: cols };
  }, [count]);

  const colorsSet = useRef(false);
  const frameSkip = useRef(0);

  useFrame((state) => {
    if (!meshRef.current) return;

    // Set per-instance colours once
    if (!colorsSet.current) {
      colors.forEach((c, i) => meshRef.current!.setColorAt(i, c));
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
      colorsSet.current = true;
    }

    // Sway every 3rd frame
    frameSkip.current = (frameSkip.current + 1) % 3;
    if (frameSkip.current !== 0) return;

    const t = state.clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const bx = bladeData[i * 6], by = bladeData[i * 6 + 1], bz = bladeData[i * 6 + 2];
      const ry = bladeData[i * 6 + 3], sy = bladeData[i * 6 + 4], ph = bladeData[i * 6 + 5];
      const sway = Math.sin(t * 0.6 + ph) * 0.06;
      dummy.position.set(bx, by + sy * 0.5, bz);
      dummy.rotation.set(sway, ry, sway * 0.4);
      dummy.scale.set(0.18, sy, 0.18);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <planeGeometry args={[0.5, 1.0, 1, 3]} />
      <meshStandardMaterial roughness={0.75} side={THREE.DoubleSide} />
    </instancedMesh>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export const CoralReef: FC = () => (
  <group>
    <StalkedSponges count={80} />
    <SedimentMounds count={120} />
    <BenthicWorms   count={150} />
  </group>
);
