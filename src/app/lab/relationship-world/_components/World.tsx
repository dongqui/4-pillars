"use client";

import { Canvas } from "@react-three/fiber";

export function World() {
  return (
    <Canvas camera={{ position: [0, 3.2, 13], fov: 50 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 8]} intensity={1.2} />
      <mesh>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#60a5fa" />
      </mesh>
    </Canvas>
  );
}
