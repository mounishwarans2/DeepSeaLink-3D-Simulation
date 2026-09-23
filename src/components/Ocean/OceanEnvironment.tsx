import type { FC } from 'react';

export interface OceanEnvironmentProps {
  marineLifeVisible?: boolean;
}
import { AcousticPropagation } from '../Communication/AcousticPropagation';
import { CoastalTerrain } from '../Environment/CoastalTerrain';
import { CoastalVegetation } from '../Environment/CoastalVegetation';
import { LandDataReceiver } from '../Environment/LandDataReceiver';
import { LightShafts } from '../Environment/LightShafts';
import { SurfaceBuoy } from '../Environment/SurfaceBuoy';
import { SurfaceRelayLink } from '../Environment/SurfaceRelayLink';
import { UnderwaterFog } from '../Environment/UnderwaterFog';
import { UnderwaterLighting } from '../Environment/UnderwaterLighting';
import { WaterParticles } from '../Environment/WaterParticles';
import { MarineLifeManager } from '../MarineLife/MarineLifeManager';
import { AcousticHardware } from '../Network/AcousticHardware';
import { MeshTopologyNetwork } from '../Network/MeshTopologyNetwork';
import { CoralReef } from './CoralReef';
import { SeaGrass } from './SeaGrass';
import { Seabed } from './Seabed';
import { SeabedPlants } from './SeabedPlants';
import { WaterSurface } from './WaterSurface';

// ─────────────────────────────────────────────────────────────────────────────
// OCEAN ENVIRONMENT — Scene root component
//
// Terrain architecture:
//   CoastalTerrain — single continuous shader mesh covering:
//     • Elevated land (west, north, south with organic curved coastline)
//     • Sandy beach transition zone
//     • Shallow water approach
//     • Continental shelf + slope
//     • Abyssal plain (≈ -400)
//     • Mariana Trench (≈ -1090)
//
//   Seabed — existing instanced boulders / pebbles / rock decorations
//     (its terrain plane is rendered BELOW CoastalTerrain with polygon offset
//     to prevent z-fighting; only the decoration meshes are visible)
//
//   WaterSurface — animated transparent blue plane at Y=125 (sea level)
// ─────────────────────────────────────────────────────────────────────────────

export const OceanEnvironment: FC<OceanEnvironmentProps> = ({ marineLifeVisible = true }) => {
  return (
    <group>
      {/* ── ATMOSPHERE & LIGHTING ─────────────────────────────────────── */}
      <UnderwaterLighting />
      <UnderwaterFog />

      {/* ── CONTINUOUS TERRAIN — land + coastline + seabed in one mesh ── */}
      <CoastalTerrain />

      {/* ── LAND VEGETATION — sparse trees, bushes, shrubs on three land sides ── */}
      {/*
        Placed using coastlineMask() + unifiedTerrainHeight().
        Only appears on confirmed land (mask > 0.4, Y > 155).
        Sparse enough for a scientific coastal research atmosphere.
      */}
      <CoastalVegetation />

      {/* ── WATER SURFACE ─────────────────────────────────────────────── */}
      <WaterSurface />

      {/* ── SURFACE MONITORING BUOY ───────────────────────────────────── */}
      {/* Floats at sea level Y=125 with realistic bob animation */}
      <SurfaceBuoy />

      {/* ── RELAY COMMUNICATION LINKS ─────────────────────────────────── */}
      {/* Acoustic path: GW-01 → buoy  |  RF link: buoy → data center    */}
      <SurfaceRelayLink />

      {/* ── SEABED DECORATIONS ────────────────────────────────────────── */}
      {/*
        Seabed instanced meshes (boulders, coloured pebbles, rocks).
        The Seabed terrain plane is present but sits at the same vertices
        as CoastalTerrain — it will be occluded since CoastalTerrain uses
        FrontSide rendering and is drawn first. Decoration meshes float
        slightly above seabed Y so they remain visible.
      */}
      <Seabed />
      <CoralReef />
      <SeaGrass count={300} />
      <SeabedPlants />

      {/* ── ACOUSTIC NETWORK ──────────────────────────────────────────── */}
      <AcousticHardware />
      <MeshTopologyNetwork />
      <AcousticPropagation />

      {/* ── LAND DATA RECEIVER CENTER ─────────────────────────────────── */}
      {/*
        Small realistic facility on elevated west coast land.
        Positioned at X=-7000, Z=200 (confirmed land territory).
        Dishes face east toward the ocean to receive signals from
        the surface floating buoy gateway.
      */}
      <LandDataReceiver />

      {/* ── MARINE FAUNA & EFFECTS ────────────────────────────────────── */}
      <MarineLifeManager visible={marineLifeVisible} />
      <LightShafts />
      <WaterParticles count={1200} />
    </group>
  );
};
