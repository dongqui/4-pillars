"use client";

import { useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SELF } from "../_data/mock-people";
import { SELF_POSITION } from "../_lib/layout";

export function SelfCore() {
  const shell = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!shell.current) return;
    // 아주 느린 맥동. 눈에 띄면 안 되고, 살아 있다는 느낌만 남긴다.
    const t = state.clock.elapsedTime;
    const s = 1 + Math.sin(t * 0.7) * 0.04;
    shell.current.scale.setScalar(s);
  });

  return (
    <group position={SELF_POSITION as unknown as [number, number, number]}>
      <mesh>
        <icosahedronGeometry args={[0.34, 3]} />
        <meshStandardMaterial
          color="#93c5fd"
          emissive="#2563eb"
          emissiveIntensity={2.4}
          roughness={0.35}
        />
      </mesh>

      <mesh ref={shell}>
        <icosahedronGeometry args={[0.62, 2]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.14} depthWrite={false} />
      </mesh>

      <mesh>
        <icosahedronGeometry args={[1.05, 2]} />
        <meshBasicMaterial color="#2563eb" transparent opacity={0.06} depthWrite={false} />
      </mesh>

      <pointLight color="#60a5fa" intensity={9} distance={9} decay={2} />

      {/* 어느 것이 나인지 모르면 관계 지도가 아니다. 이름은 DOM 으로. */}
      <Html center position={[0, -1.05, 0]} zIndexRange={[10, 0]}>
        <span className="text-[12px] font-semibold tracking-[0.14em] text-blue-200/80 select-none">
          {SELF.name}
        </span>
      </Html>
    </group>
  );
}
