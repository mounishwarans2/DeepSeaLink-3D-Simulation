import { useState } from 'react';

export interface UnderwaterControlsState {
  causticsEnabled: boolean;
  particlesEnabled: boolean;
  lightShaftsEnabled: boolean;
  fogDensity: number;
}

export function useUnderwaterControls() {
  const [controls, setControls] = useState<UnderwaterControlsState>({
    causticsEnabled: true,
    particlesEnabled: true,
    lightShaftsEnabled: true,
    fogDensity: 0.018,
  });

  const toggleCaustics = () =>
    setControls((prev) => ({ ...prev, causticsEnabled: !prev.causticsEnabled }));

  const toggleParticles = () =>
    setControls((prev) => ({ ...prev, particlesEnabled: !prev.particlesEnabled }));

  const toggleLightShafts = () =>
    setControls((prev) => ({ ...prev, lightShaftsEnabled: !prev.lightShaftsEnabled }));

  const setFogDensity = (density: number) =>
    setControls((prev) => ({ ...prev, fogDensity: density }));

  return {
    controls,
    toggleCaustics,
    toggleParticles,
    toggleLightShafts,
    setFogDensity,
  };
}
