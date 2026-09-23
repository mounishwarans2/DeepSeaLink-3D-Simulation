import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';
import { SeabedShader } from '../../shaders/seabedShader';
import { SEABED_PARAMS } from '../../utils/constants';
import { unifiedTerrainHeight } from '../Environment/CoastalTerrain';

// ─────────────────────────────────────────────────────────────────────────────
// SEABED — deep-ocean abyssal terrain with Mariana Trench
//
// PERFORMANCE FIXES:
// - Rock instance matrices computed ONCE in useMemo (not every frame)
// - instanceMatrix.needsUpdate = true called ONCE on mount via useEffect
// - Shader caustics only run uTime update (cheap uniform write)
// - Seabed plane segments reduced slightly for better GPU throughput
// ─────────────────────────────────────────────────────────────────────────────

// Colorful pebble palette — vivid ocean-floor gem stones
const STONE_COLORS = [
  '#e05050', // coral red
  '#e07030', // amber orange
  '#d4b800', // golden yellow
  '#38b86e', // sea green
  '#2a9fd6', // ocean blue
  '#7b52d4', // purple
  '#d44fa0', // magenta pink
  '#48cfc0', // teal
  '#a3e060', // lime
  '#f07878', // salmon
  '#5088e0', // cobalt
  '#c06030', // terracotta
  '#80d0a0', // mint
  '#e0c050', // gold
  '#9060d0', // violet
  '#f0a030', // saffron
];

export const Seabed: FC = () => {
  const { gl } = useThree();
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const boulderMeshRef = useRef<THREE.InstancedMesh>(null);
  const pebbleMeshRef  = useRef<THREE.InstancedMesh>(null);
  const matricesApplied = useRef(false);

  // One instanced mesh per color group for colorful stones
  const colorMeshRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  const shaderData = useMemo(() => ({
    uniforms: THREE.UniformsUtils.clone(SeabedShader.uniforms),
    vertexShader: SeabedShader.vertexShader,
    fragmentShader: SeabedShader.fragmentShader,
  }), []);

  // ── BOULDER DATA — computed ONCE ─────────────────────────────────────────
  const BOULDER_COUNT = 280;
  const { boulderMatrices } = useMemo(() => {
    const dummy    = new THREE.Object3D();
    const matrices = new Array<THREE.Matrix4>(BOULDER_COUNT);

    for (let i = 0; i < BOULDER_COUNT; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const radius = 30 + Math.random() * 3200;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const baseW = 4.0 + Math.random() * 16.0;
      const baseH = 1.5 + Math.random() *  8.0;
      const baseD = 3.5 + Math.random() * 14.0;

      // Use ACTUAL terrain height so rocks sit on slopes/trenches correctly
      const terrainY = unifiedTerrainHeight(x, z);
      const halfH = (baseH * 1.8) * 0.5;
      // Clamp to seabed range only — rocks only on seabed, not on land
      const seabedY = Math.min(terrainY, SEABED_PARAMS.baseDepth + 50);
      const y = seabedY + halfH * 0.35;

      dummy.position.set(x, y, z);
      dummy.rotation.set(
        (Math.random() - 0.5) * 0.4,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.3,
      );
      dummy.scale.set(baseW, baseH, baseD);
      dummy.updateMatrix();
      matrices[i] = dummy.matrix.clone();
    }
    return { boulderMatrices: matrices };
  }, []);

  // ── PEBBLE DATA — computed ONCE ──────────────────────────────────────────
  const PEBBLE_COUNT = 600;
  const { pebbleMatrices } = useMemo(() => {
    const dummy    = new THREE.Object3D();
    const matrices = new Array<THREE.Matrix4>(PEBBLE_COUNT);

    for (let i = 0; i < PEBBLE_COUNT; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const radius = 20 + Math.random() * 2800;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const s = 0.8 + Math.random() * 4.0;
      const scaleX = s * (0.7 + Math.random() * 0.6);
      const scaleY = s * (0.25 + Math.random() * 0.35); // flat, hug the floor
      const scaleZ = s * (0.7 + Math.random() * 0.6);

      // Use ACTUAL terrain height — sit on trench edges and slopes
      const terrainY = unifiedTerrainHeight(x, z);
      const seabedY  = Math.min(terrainY, SEABED_PARAMS.baseDepth + 50);
      const halfH    = scaleY * 0.5;
      const y = seabedY + halfH * 0.5;

      dummy.position.set(x, y, z);
      dummy.rotation.set(
        Math.random() * 0.2,   // nearly flat
        Math.random() * Math.PI,
        Math.random() * 0.2,
      );
      dummy.scale.set(scaleX, scaleY, scaleZ);
      dummy.updateMatrix();
      matrices[i] = dummy.matrix.clone();
    }
    return { pebbleMatrices: matrices };
  }, []);

  // ── COLORFUL SMALL STONES — 1200 total, spread across entire seabed ──────
  const STONES_PER_COLOR = 75; // 16 colors × 75 = 1200 total
  const colorStoneMatrices = useMemo(() => {
    return STONE_COLORS.map(() => {
      const dummy    = new THREE.Object3D();
      const matrices = new Array<THREE.Matrix4>(STONES_PER_COLOR);

      for (let i = 0; i < STONES_PER_COLOR; i++) {
        const angle  = Math.random() * Math.PI * 2;
        // Wide spread — entire seabed radius up to 7000 units
        const radius = 10 + Math.random() * 6500;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const s = 0.4 + Math.random() * 2.2; // small, decorative
        const scaleY = s * (0.18 + Math.random() * 0.22); // very flat pebble

        // Exactly on the floor surface — using actual terrain height
        const terrainY = unifiedTerrainHeight(x, z);
        const seabedY  = Math.min(terrainY, SEABED_PARAMS.baseDepth + 50);
        const y = seabedY + scaleY * 0.5;

        dummy.position.set(x, y, z);
        dummy.rotation.set(
          Math.random() * 0.15,
          Math.random() * Math.PI * 2,
          Math.random() * 0.15,
        );
        dummy.scale.set(
          s * (0.6 + Math.random() * 0.8),
          scaleY,
          s * (0.6 + Math.random() * 0.8),
        );
        dummy.updateMatrix();
        matrices[i] = dummy.matrix.clone();
      }
      return matrices;
    });
  }, []);

  // ── APPLY INSTANCE MATRICES ONCE ON MOUNT ───────────────────────────────
  useEffect(() => {
    if (matricesApplied.current) return;

    if (boulderMeshRef.current) {
      boulderMatrices.forEach((mat, i) => {
        boulderMeshRef.current!.setMatrixAt(i, mat);
      });
      boulderMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    if (pebbleMeshRef.current) {
      pebbleMatrices.forEach((mat, i) => {
        pebbleMeshRef.current!.setMatrixAt(i, mat);
      });
      pebbleMeshRef.current.instanceMatrix.needsUpdate = true;
    }

    colorStoneMatrices.forEach((mats, ci) => {
      const mesh = colorMeshRefs.current[ci];
      if (!mesh) return;
      mats.forEach((mat, i) => mesh.setMatrixAt(i, mat));
      mesh.instanceMatrix.needsUpdate = true;
    });

    matricesApplied.current = true;
  }, [boulderMatrices, pebbleMatrices, colorStoneMatrices]);

  // ── FRAME — only update shader time uniform (cheap) ─────────────────────
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  // Ensure pixel ratio is capped at 1.5 for performance
  useEffect(() => {
    gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  }, [gl]);

  return (
    <group>
      {/* ── SEABED TERRAIN PLANE — hidden (CoastalTerrain now owns terrain) ── */}
      {/* The mesh must NOT be rendered — it z-fights with CoastalTerrain.
          We keep it invisible rather than removing, to preserve the shader
          uTime update in useFrame above. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, SEABED_PARAMS.baseDepth, 0]}
        visible={false}
        frustumCulled={false}
      >
        <planeGeometry
          args={[
            SEABED_PARAMS.width,
            SEABED_PARAMS.depth,
            4,   // 4 segs only — not rendered, just keeps material alive
            4,
          ]}
        />
        <shaderMaterial
          ref={materialRef}
          args={[shaderData]}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* ── LARGE BOULDERS — natural grey #66727A, clearly visible on light seabed */}
      {/* frustumCulled=false: prevents rocks disappearing during camera rotation */}
      <instancedMesh
        ref={boulderMeshRef}
        args={[undefined, undefined, BOULDER_COUNT]}
        frustumCulled={false}
      >
        <icosahedronGeometry args={[1.8, 1]} />
        <meshStandardMaterial
          color="#66727A"
          roughness={0.88}
          metalness={0.04}
        />
      </instancedMesh>

      {/* ── MEDIUM PEBBLES — slightly lighter #7A8690, good contrast against seabed */}
      <instancedMesh
        ref={pebbleMeshRef}
        args={[undefined, undefined, PEBBLE_COUNT]}
        frustumCulled={false}
      >
        <dodecahedronGeometry args={[1.0, 0]} />
        <meshStandardMaterial
          color="#7A8690"
          roughness={0.85}
          metalness={0.04}
        />
      </instancedMesh>

      {/* ── COLORFUL SMALL STONES — frustumCulled=false prevents pop-in ────── */}
      {STONE_COLORS.map((color, ci) => (
        <instancedMesh
          key={color}
          ref={(el) => { colorMeshRefs.current[ci] = el; }}
          args={[undefined, undefined, STONES_PER_COLOR]}
          frustumCulled={false}
        >
          <dodecahedronGeometry args={[1.0, 0]} />
          <meshStandardMaterial
            color={color}
            roughness={0.55}
            metalness={0.12}
            emissive={color}
            emissiveIntensity={0.10}
          />
        </instancedMesh>
      ))}
    </group>
  );
};
