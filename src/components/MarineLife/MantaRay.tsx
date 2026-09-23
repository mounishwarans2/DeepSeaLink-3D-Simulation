import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { FC } from 'react';
import * as THREE from 'three';

export const MantaRay: FC = () => {
  const rayGroupRef  = useRef<THREE.Group>(null);
  const leftWingRef  = useRef<THREE.Mesh>(null);
  const rightWingRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!rayGroupRef.current) return;
    const time = state.clock.getElapsedTime();

    // Gentle circular path — mesopelagic zone (Y=-60 ≈ 600m depth in new scale)
    const angle  = time * 0.08;
    const radius = 600;
    rayGroupRef.current.position.x = Math.cos(angle) * radius;
    rayGroupRef.current.position.z = Math.sin(angle) * radius + 400;
    rayGroupRef.current.position.y = -70 + Math.sin(time * 0.35) * 8;

    rayGroupRef.current.rotation.y = -angle + Math.PI / 2;
    rayGroupRef.current.rotation.z = Math.sin(time * 0.8) * 0.08;

    const wingFlap = Math.sin(time * 1.5) * 0.25;
    if (leftWingRef.current)  leftWingRef.current.rotation.z  =  wingFlap;
    if (rightWingRef.current) rightWingRef.current.rotation.z = -wingFlap;
  });

  return (
    <group ref={rayGroupRef} position={[0, -70, 400]} scale={[18.0, 18.0, 18.0]}>
      {/* Central flattened manta body */}
      <mesh>
        <coneGeometry args={[1.2, 3.5, 8]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.2} />
      </mesh>

      {/* Left wing */}
      <mesh ref={leftWingRef} position={[-1.8, 0, 0]}>
        <planeGeometry args={[3.2, 2.8, 8, 8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Right wing */}
      <mesh ref={rightWingRef} position={[1.8, 0, 0]}>
        <planeGeometry args={[3.2, 2.8, 8, 8]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Tail */}
      <mesh position={[0, 0, -2.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.08, 3.2, 8]} />
        <meshStandardMaterial color="#090d16" roughness={0.6} />
      </mesh>
    </group>
  );
};
