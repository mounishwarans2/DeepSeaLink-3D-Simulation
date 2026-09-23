import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// SEABED PLANTS — Realistic marine flora with attractive colours
//
// Includes:
//   1. Seaweed       — tall swaying ribbons in deep-green and bright-green
//   2. Coral         — branching structures in orange and green
//   3. Sea Shells    — spiral-like forms in pearlescent white/cream
//   4. Pearls        — glowing spheres resting on shells / seabed
// ─────────────────────────────────────────────────────────────────────────────

const SEABED_Y = -400;

// ── 1. SEAWEED ───────────────────────────────────────────────────────────────
const SEAWEED_COLORS = [
  '#0a7a2a', '#1aaa3a', '#2dc84e', '#0f6022',
  '#3dd860', '#18a040', '#52e870', '#0d5020',
];

const Seaweed: FC<{ count: number }> = ({ count }) => {
  const meshRef  = useRef<THREE.InstancedMesh>(null);
  const dummy    = useMemo(() => new THREE.Object3D(), []);

  const bladeData = useMemo(() => {
    const data = new Float32Array(count * 7);
    for (let i = 0; i < count; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const radius = 30 + Math.random() * 1800;
      data[i * 7]     = Math.cos(angle) * radius;
      data[i * 7 + 1] = SEABED_Y + Math.random() * 2;
      data[i * 7 + 2] = Math.sin(angle) * radius;
      data[i * 7 + 3] = Math.random() * Math.PI * 2;
      data[i * 7 + 4] = 6 + Math.random() * 18;
      data[i * 7 + 5] = Math.random() * Math.PI * 2;
      data[i * 7 + 6] = Math.floor(Math.random() * SEAWEED_COLORS.length);
    }
    return data;
  }, [count]);

  const colorObjs = useMemo(() => SEAWEED_COLORS.map((c) => new THREE.Color(c)), []);
  const colorsSet = useRef(false);
  const frameSkip = useRef(0);

  useFrame((state) => {
    if (!meshRef.current) return;
    if (!colorsSet.current) {
      for (let i = 0; i < count; i++) {
        meshRef.current.setColorAt(i, colorObjs[bladeData[i * 7 + 6]]);
      }
      if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
      colorsSet.current = true;
    }
    frameSkip.current = (frameSkip.current + 1) % 2;
    if (frameSkip.current !== 0) return;
    const t = state.clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const bx = bladeData[i * 7], by = bladeData[i * 7 + 1], bz = bladeData[i * 7 + 2];
      const ry = bladeData[i * 7 + 3], h = bladeData[i * 7 + 4], ph = bladeData[i * 7 + 5];
      const sway = Math.sin(t * 0.5 + ph) * 0.12;
      const swayZ = Math.cos(t * 0.38 + ph) * 0.06;
      dummy.position.set(bx, by + h * 0.5, bz);
      dummy.rotation.set(sway, ry, swayZ);
      dummy.scale.set(0.22, h, 0.14);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled>
      <cylinderGeometry args={[0.08, 0.45, 1, 5]} />
      <meshStandardMaterial roughness={0.6} metalness={0.05} side={THREE.DoubleSide} transparent opacity={0.92} />
    </instancedMesh>
  );
};

// ── 2. CORAL ─────────────────────────────────────────────────────────────────
const CORAL_COLORS = [
  '#ff6a20', '#ff8c3a', '#e85010', '#ff7030',
  '#20b050', '#38c860', '#1a9040', '#50d870',
  '#ff4060', '#d04090', '#8020d0', '#e04020',
];

const Coral: FC<{ count: number }> = ({ count }) => {
  const trunkRef  = useRef<THREE.InstancedMesh>(null);
  const branchRef = useRef<THREE.InstancedMesh>(null);
  const totalBranches = count * 4;

  const { trunkData, branchData } = useMemo(() => {
    const trunk  = new Float32Array(count * 5);
    const branch = new Float32Array(totalBranches * 6);
    for (let i = 0; i < count; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const radius = 15 + Math.random() * 1600;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const h = 3 + Math.random() * 9;
      trunk[i * 5]     = x;
      trunk[i * 5 + 1] = SEABED_Y + h * 0.5;
      trunk[i * 5 + 2] = z;
      trunk[i * 5 + 3] = Math.random() * Math.PI * 2;
      trunk[i * 5 + 4] = h;
      for (let b = 0; b < 4; b++) {
        const ba  = (Math.PI * 2 * b) / 4 + Math.random() * 0.6;
        const br  = 0.5 + Math.random() * 0.4;
        const bh  = h * (0.35 + Math.random() * 0.45);
        const bLen = h * (0.3 + Math.random() * 0.3);
        const bi = (i * 4 + b) * 6;
        branch[bi]     = x + Math.cos(ba) * br;
        branch[bi + 1] = SEABED_Y + bh;
        branch[bi + 2] = z + Math.sin(ba) * br;
        branch[bi + 3] = (Math.random() - 0.5) * 0.8;
        branch[bi + 4] = ba;
        branch[bi + 5] = bLen;
      }
    }
    return { trunkData: trunk, branchData: branch };
  }, [count, totalBranches]);

  const { trunkColors, branchColors } = useMemo(() => {
    const tc: THREE.Color[] = [];
    const bc: THREE.Color[] = [];
    for (let i = 0; i < count; i++) {
      const c = new THREE.Color(CORAL_COLORS[i % CORAL_COLORS.length]);
      tc.push(c);
      for (let b = 0; b < 4; b++) bc.push(c.clone().multiplyScalar(0.9 + Math.random() * 0.2));
    }
    return { trunkColors: tc, branchColors: bc };
  }, [count]);

  const applied = useRef(false);
  useFrame(() => {
    if (applied.current) return;
    const d = new THREE.Object3D();
    if (trunkRef.current) {
      for (let i = 0; i < count; i++) {
        const x = trunkData[i * 5], y = trunkData[i * 5 + 1], z = trunkData[i * 5 + 2];
        const ry = trunkData[i * 5 + 3], h = trunkData[i * 5 + 4];
        d.position.set(x, y, z);
        d.rotation.set(0, ry, 0);
        d.scale.set(0.22, h, 0.22);
        d.updateMatrix();
        trunkRef.current.setMatrixAt(i, d.matrix);
        trunkRef.current.setColorAt(i, trunkColors[i]);
      }
      trunkRef.current.instanceMatrix.needsUpdate = true;
      if (trunkRef.current.instanceColor) trunkRef.current.instanceColor.needsUpdate = true;
    }
    if (branchRef.current) {
      for (let i = 0; i < totalBranches; i++) {
        const x = branchData[i * 6], y = branchData[i * 6 + 1], z = branchData[i * 6 + 2];
        const rx = branchData[i * 6 + 3], rz = branchData[i * 6 + 4], len = branchData[i * 6 + 5];
        d.position.set(x, y, z);
        d.rotation.set(rx, 0, rz);
        d.scale.set(0.12, len, 0.12);
        d.updateMatrix();
        branchRef.current.setMatrixAt(i, d.matrix);
        branchRef.current.setColorAt(i, branchColors[i]);
      }
      branchRef.current.instanceMatrix.needsUpdate = true;
      if (branchRef.current.instanceColor) branchRef.current.instanceColor.needsUpdate = true;
    }
    applied.current = true;
  });

  return (
    <>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, count]} frustumCulled>
        <cylinderGeometry args={[0.3, 0.5, 1, 7]} />
        <meshStandardMaterial roughness={0.65} metalness={0.08} emissiveIntensity={0.12} />
      </instancedMesh>
      <instancedMesh ref={branchRef} args={[undefined, undefined, totalBranches]} frustumCulled>
        <cylinderGeometry args={[0.15, 0.25, 1, 6]} />
        <meshStandardMaterial roughness={0.60} metalness={0.08} emissiveIntensity={0.15} />
      </instancedMesh>
    </>
  );
};

// ── 3. SEA SHELLS ─────────────────────────────────────────────────────────────
const SHELL_COLORS = ['#f0e8d0', '#e8d8c0', '#fff8f0', '#f8eed8', '#fdf0e0'];

const SeaShells: FC<{ count: number }> = ({ count }) => {
  const shellRef = useRef<THREE.InstancedMesh>(null);
  const rimRef   = useRef<THREE.InstancedMesh>(null);
  const applied  = useRef(false);

  const { shellMats, rimMats, colors } = useMemo(() => {
    const dummy = new THREE.Object3D();
    const sm: THREE.Matrix4[] = [];
    const rm: THREE.Matrix4[] = [];
    const cs: THREE.Color[]   = [];
    for (let i = 0; i < count; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * 2000;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = SEABED_Y + 0.5;
      const s = 0.8 + Math.random() * 2.5;
      dummy.position.set(x, y + s * 0.2, z);
      dummy.rotation.set(Math.random() * 0.3, Math.random() * Math.PI * 2, Math.random() * 0.2);
      dummy.scale.set(s, s * 0.35, s * 0.7);
      dummy.updateMatrix();
      sm.push(dummy.matrix.clone());
      dummy.position.set(x, y + s * 0.18, z);
      dummy.rotation.set(Math.PI / 2 + Math.random() * 0.3, Math.random() * Math.PI, 0);
      dummy.scale.set(s * 0.6, s * 0.6, s * 0.6);
      dummy.updateMatrix();
      rm.push(dummy.matrix.clone());
      cs.push(new THREE.Color(SHELL_COLORS[i % SHELL_COLORS.length]));
    }
    return { shellMats: sm, rimMats: rm, colors: cs };
  }, [count]);

  useFrame(() => {
    if (applied.current) return;
    if (shellRef.current) {
      shellMats.forEach((mat, i) => { shellRef.current!.setMatrixAt(i, mat); shellRef.current!.setColorAt(i, colors[i]); });
      shellRef.current.instanceMatrix.needsUpdate = true;
      if (shellRef.current.instanceColor) shellRef.current.instanceColor.needsUpdate = true;
    }
    if (rimRef.current) {
      rimMats.forEach((mat, i) => { rimRef.current!.setMatrixAt(i, mat); rimRef.current!.setColorAt(i, colors[i]); });
      rimRef.current.instanceMatrix.needsUpdate = true;
      if (rimRef.current.instanceColor) rimRef.current.instanceColor.needsUpdate = true;
    }
    applied.current = true;
  });

  return (
    <>
      <instancedMesh ref={shellRef} args={[undefined, undefined, count]} frustumCulled>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial roughness={0.18} metalness={0.42} envMapIntensity={1.2} />
      </instancedMesh>
      <instancedMesh ref={rimRef} args={[undefined, undefined, count]} frustumCulled>
        <torusGeometry args={[1.0, 0.18, 8, 18]} />
        <meshStandardMaterial roughness={0.15} metalness={0.45} />
      </instancedMesh>
    </>
  );
};

// ── 4. PEARLS ─────────────────────────────────────────────────────────────────
const Pearls: FC<{ count: number }> = ({ count }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const applied = useRef(false);
  const { matrices } = useMemo(() => {
    const dummy = new THREE.Object3D();
    const mats: THREE.Matrix4[] = [];
    for (let i = 0; i < count; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const radius = 25 + Math.random() * 2000;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const s = 0.25 + Math.random() * 0.8;
      dummy.position.set(x, SEABED_Y + s * 0.5, z);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
    }
    return { matrices: mats };
  }, [count]);

  useFrame(() => {
    if (applied.current || !meshRef.current) return;
    matrices.forEach((mat, i) => meshRef.current!.setMatrixAt(i, mat));
    meshRef.current.instanceMatrix.needsUpdate = true;
    applied.current = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial
        color="#f8f4e8"
        roughness={0.08}
        metalness={0.82}
        emissive="#ffe8c8"
        emissiveIntensity={0.18}
      />
    </instancedMesh>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
export const SeabedPlants: FC = () => (
  <group>
    <Seaweed   count={400} />
    <Coral     count={220} />
    <SeaShells count={180} />
    <Pearls    count={250} />
  </group>
);
