"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { hash01 } from "../_lib/layout";

function useSpherePositions(count: number, radius: number, seed: number) {
  return useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const s = seed + i * 3;
      const u = hash01(s + 1) * 2 - 1;
      const theta = hash01(s + 2) * Math.PI * 2;
      const r = radius * (0.55 + hash01(s + 3) * 0.45);
      const flat = Math.sqrt(1 - u * u);
      arr[i * 3] = r * flat * Math.cos(theta);
      arr[i * 3 + 1] = r * u;
      arr[i * 3 + 2] = r * flat * Math.sin(theta);
    }
    return arr;
  }, [count, radius, seed]);
}

function DustLayer({
  count,
  radius,
  size,
  opacity,
  drift,
  seed,
}: {
  count: number;
  radius: number;
  size: number;
  opacity: number;
  drift: number;
  seed: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const positions = useSpherePositions(count, radius, seed);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * drift;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        color="#cbd5e1"
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function Starfield() {
  return (
    <group>
      {/* 멀수록 작고 흐리고 느리다 */}
      <DustLayer count={900} radius={46} size={0.14} opacity={0.35} drift={0.004} seed={101} />
      <DustLayer count={420} radius={26} size={0.2} opacity={0.5} drift={0.011} seed={523} />
      <DustLayer count={160} radius={15} size={0.28} opacity={0.65} drift={0.022} seed={947} />

      {/* 황도면. 의식되지 않되 위/아래는 느껴지는 수준으로만. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.5, 11, 96]} />
        <meshBasicMaterial
          color="#334155"
          transparent
          opacity={0.07}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
