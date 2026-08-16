"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RelationRole } from "../../_data/roles";
import { FIELD_CENTERS, FIELD_EXTENT, hash01 } from "../../_lib/layout";
import { FIELD_TINT } from "./tint";

const ACCENT_COUNT = 140;

export function FieldAccents({ role, dimmed }: { role: RelationRole; dimmed: boolean }) {
  const mat = useRef<THREE.PointsMaterial>(null);
  const center = FIELD_CENTERS[role];
  const extent = FIELD_EXTENT[role];

  const positions = useMemo(() => {
    const arr = new Float32Array(ACCENT_COUNT * 3);
    const seed = role.length * 137;
    for (let i = 0; i < ACCENT_COUNT; i++) {
      const s = seed + i * 3;
      const u = hash01(s + 1) * 2 - 1;
      const theta = hash01(s + 2) * Math.PI * 2;
      // 껍질 근처(0.82~1.15)에만. 안을 채우면 다시 성운이 된다.
      const r = extent * (0.82 + hash01(s + 3) * 0.33);
      const flat = Math.sqrt(1 - u * u);
      arr[i * 3] = r * flat * Math.cos(theta);
      arr[i * 3 + 1] = r * u * 0.8;
      arr[i * 3 + 2] = r * flat * Math.sin(theta);
    }
    return arr;
  }, [role, extent]);

  useFrame((_, delta) => {
    if (!mat.current) return;
    const target = dimmed ? 0.08 : 0.34;
    mat.current.opacity += (target - mat.current.opacity) * Math.min(1, delta * 5);
  });

  return (
    <points position={center as unknown as [number, number, number]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={mat}
        size={0.09}
        color={FIELD_TINT[role]}
        transparent
        opacity={0.34}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
