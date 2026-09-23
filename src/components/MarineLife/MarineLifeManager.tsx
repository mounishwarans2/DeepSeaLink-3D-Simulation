import type { FC } from 'react';
import { Crab } from './Crab';
import { DolphinPod } from './DolphinPod';
import { FishSchool } from './FishSchool';
import { Jellyfish } from './Jellyfish';
import { Shark } from './Shark';
import { Whale } from './Whale';

// ─────────────────────────────────────────────────────────────────────────────
// MARINE LIFE MANAGER — professional scientific digital twin fauna layer
//
// All animals use LatheGeometry bodies + flat fin geometries (NOT capsules/cylinders).
//
// Species:
//   FishSchool  — 50 fish in 5 schools, 3 InstancedMesh (body+dorsal+tail)
//   DolphinPod  — 2 pods × 3 dolphins, Group meshes w/ horizontal flukes
//   Shark       — 3 sharks, Group meshes w/ large dorsal + asymmetric tail
//   Whale       — 2 humpback whales, Group meshes (scale 55 = very large)
//   Jellyfish   — 12 translucent jellyfish w/ pulsing bells + tentacles
//   Crab        — 12 crabs on seabed, InstancedMesh w/ body + legs + claws
//
// Performance:
//   Fish:       3 draw calls for 50 fish
//   Jellyfish:  2 draw calls for 12 bells + 72 tentacles
//   Crabs:      4 draw calls for 12 crabs (body + 2 leg fans + claws)
//   Sharks:     ~5 meshes × 3 = 15 draw calls
//   Dolphins:   ~5 meshes × 6 = 30 draw calls
//   Whales:     ~5 meshes × 2 = 10 draw calls
//   Total:      ≈ 64 draw calls for all marine life
//
// The `visible` prop hides/shows all fauna without unmounting (preserves state).
// ─────────────────────────────────────────────────────────────────────────────

export interface MarineLifeManagerProps {
  visible?: boolean;
}

export const MarineLifeManager: FC<MarineLifeManagerProps> = ({ visible = true }) => {
  return (
    <group visible={visible}>

      {/* ── FISH SCHOOLS ─────────────────────────────────────────────────── */}
      {/* 50 fish across 5 schools, different depths and colours */}
      {/* Internally managed — just one mount */}
      <FishSchool />

      {/* ── DOLPHINS ─────────────────────────────────────────────────────── */}
      {/* Pod 1 — west channel, upper water */}
      <DolphinPod startX={-500} startY={55} startZ={-300} phase={0.0} />
      {/* Pod 2 — east side */}
      <DolphinPod startX={ 600} startY={65} startZ={ 480} phase={2.2} />

      {/* ── SHARKS ───────────────────────────────────────────────────────── */}
      {/* 3 sharks — mid to deep water */}
      <Shark />

      {/* ── WHALES ───────────────────────────────────────────────────────── */}
      {/* 2 large humpback whales — deep water, far from nodes */}
      <Whale />

      {/* ── JELLYFISH ────────────────────────────────────────────────────── */}
      {/* 12 translucent jellyfish — upper/mid water, scattered */}
      <Jellyfish />

      {/* ── CRABS ────────────────────────────────────────────────────────── */}
      {/* 12 crabs crawling on seabed, Y snapped to seabedAtXZ() */}
      <Crab />

    </group>
  );
};
