import { useMemo } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE RELAY LINK — straight communication line from buoy to data center
//
// Renders a straight tube (2 endpoints only, no curves/bends) from the
// surface relay buoy to the Data Collection Center.
//
// Buoy:         [4200, 130, 1500]
// Data Center:  [7000, 820, 200]
//
// TubeGeometry with 2 points = a perfectly straight cylinder.
// ─────────────────────────────────────────────────────────────────────────────

const BUOY_POS    = new THREE.Vector3(4200, 130, 1500);
const DCENTER_POS = new THREE.Vector3(7000, 820,  200);

export const SurfaceRelayLink: FC = () => {
  const cableMesh = useMemo(() => {
    // LineCurve3 → perfectly straight, no interpolation artefacts
    const curve = new THREE.LineCurve3(BUOY_POS, DCENTER_POS);

    const tubeGeo = new THREE.TubeGeometry(
      curve,
      2,     // only 2 segments needed for a straight line
      5,     // radius (world units) — thin but visible cable
      8,     // radial segments
      false  // not closed
    );

    const mat = new THREE.MeshStandardMaterial({
      color: '#1a2840',    // dark navy — professional marine cable
      roughness: 0.70,
      metalness: 0.40,
      transparent: true,
      opacity: 0.90,
    });

    return new THREE.Mesh(tubeGeo, mat);
  }, []);

  return <primitive object={cableMesh} />;
};
