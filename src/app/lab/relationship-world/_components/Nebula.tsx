"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RelationRole } from "../_data/roles";
import { NEBULA_CENTERS, NEBULA_SPREAD, hash01 } from "../_lib/layout";

// 색은 의미를 갖지 않는다. 오행색을 임의로 만들지 않기 위해 좁은 한색
// 계열 안에서만 미세하게 변주하고, 구분은 밀도·크기·퍼짐이 맡는다.
export const NEBULA_STYLE: Record<
  RelationRole,
  { count: number; size: number; opacity: number; tint: string; drift: number }
> = {
  fill: { count: 1400, size: 0.26, opacity: 0.5, tint: "#bfdbfe", drift: 0.03 },
  beside: { count: 1100, size: 0.3, opacity: 0.42, tint: "#cbd5e1", drift: -0.026 },
  express: { count: 900, size: 0.22, opacity: 0.52, tint: "#a5b4c8", drift: 0.038 },
  move: { count: 700, size: 0.34, opacity: 0.38, tint: "#94a3b8", drift: -0.033 },
  refine: { count: 520, size: 0.19, opacity: 0.58, tint: "#b6c6dc", drift: 0.045 },
};

export function Nebula({ role, dimmed }: { role: RelationRole; dimmed: boolean }) {
  const style = NEBULA_STYLE[role];
  const center = NEBULA_CENTERS[role];
  const spread = NEBULA_SPREAD[role];
  const ref = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(style.count * 3);
    for (let i = 0; i < style.count; i++) {
      const s = i * 3 + style.count;
      const u = hash01(s + 1) * 2 - 1;
      const theta = hash01(s + 2) * Math.PI * 2;
      // 세제곱근을 쓰면 부피에 고르게 차고, 가운데가 뭉치지 않는다.
      const r = spread * 1.55 * Math.cbrt(hash01(s + 3));
      const flat = Math.sqrt(1 - u * u);
      arr[i * 3] = r * flat * Math.cos(theta);
      arr[i * 3 + 1] = r * u * 0.8;
      arr[i * 3 + 2] = r * flat * Math.sin(theta);
    }
    return arr;
  }, [style.count, spread]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * style.drift;
    if (material.current) {
      const target = dimmed ? style.opacity * 0.25 : style.opacity;
      material.current.opacity += (target - material.current.opacity) * Math.min(1, delta * 5);
    }
  });

  return (
    <points ref={ref} position={center as unknown as [number, number, number]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        size={style.size}
        color={style.tint}
        transparent
        opacity={style.opacity}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
