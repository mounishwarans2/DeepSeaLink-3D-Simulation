import { OrbitControls } from '@react-three/drei';
import type { FC } from 'react';

interface CameraControllerProps {
  enableDamping?: boolean;
}

export const CameraController: FC<CameraControllerProps> = ({ enableDamping = true }) => {
  return (
    <OrbitControls
      makeDefault
      enableDamping={enableDamping}
      dampingFactor={0.05}
      minDistance={8}
      maxDistance={1200}
      maxPolarAngle={Math.PI * 0.92}
      minPolarAngle={0.04}
      target={[0, -50, 0]}
    />
  );
};
