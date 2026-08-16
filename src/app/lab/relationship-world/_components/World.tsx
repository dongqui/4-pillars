"use client";

import { Canvas } from "@react-three/fiber";
import { Starfield } from "./Starfield";
import { SelfCore } from "./SelfCore";

export function World() {
  return (
    <Canvas
      camera={{ position: [0, 3.2, 13], fov: 50 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#0F172A"]} />
      <fog attach="fog" args={["#0F172A", 18, 52]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 8, 6]} intensity={0.5} />

      <Starfield />
      <SelfCore />
    </Canvas>
  );
}
