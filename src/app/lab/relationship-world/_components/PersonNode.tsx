"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "../_lib/layout";

/**
 * 작은 발광 구 + 아주 얇은 후광. 사람의 3D 상 앵커다.
 * 코어는 depthWrite 를 켜 둔 채로 두어 Field 지오메트리에 가려져야 한다 —
 * 그래야 카메라를 돌렸을 때 앞뒤 깊이가 실제로 읽힌다. 후광만 additive 로
 * depthWrite 를 끈다.
 */
export function PersonNode({
  position,
  selected,
  dimmed,
}: {
  position: Vec3;
  selected: boolean;
  dimmed: boolean;
}) {
  const halo = useRef<THREE.Mesh>(null);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const haloMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (halo.current) halo.current.scale.setScalar(1 + Math.sin(t * 1.4) * 0.06);
    const core = selected ? 1 : dimmed ? 0.25 : 0.8;
    const ring = selected ? 0.5 : dimmed ? 0.06 : 0.2;
    if (coreMat.current) {
      coreMat.current.opacity += (core - coreMat.current.opacity) * Math.min(1, delta * 6);
    }
    if (haloMat.current) {
      haloMat.current.opacity += (ring - haloMat.current.opacity) * Math.min(1, delta * 6);
    }
  });

  return (
    <group position={position as unknown as [number, number, number]}>
      <mesh>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshBasicMaterial
          ref={coreMat}
          color={selected ? "#dbeafe" : "#e2e8f0"}
          transparent
          opacity={0.8}
        />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.17, 12, 12]} />
        <meshBasicMaterial
          ref={haloMat}
          color={selected ? "#93c5fd" : "#cbd5e1"}
          transparent
          opacity={0.2}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
