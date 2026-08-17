"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "../_lib/layout";

// 코어는 opaque 패스에 있어야 한다. `transparent: true` 는 three.js 를
// world-origin 거리 하나로 정렬하는 transparent 큐로 옮기는데, Field 의
// 모든 shell 도 transparent+depthWrite:false 라 같은 큐에서 겹친다. 사람은
// Field 중심에서 벗어난 위치에 흩어지므로(positionFor), 카메라-사람 거리가
// 카메라-Field중심 거리보다 가까운 경우가 흔하다 — 그러면 Field 가 "더 멀다"고
// 정렬돼 먼저 그려지고, depthWrite 가 없으니 나중에 그려지는 코어가 뒤에서도
// 뚫고 나온다. `transparent` 를 빼면 코어는 항상 먼저 그려지는 opaque 패스로
// 가고, 그 뒤에 그려지는 모든 transparent Field 레이어가 코어를 대상으로
// 실제 픽셀 단위 depth test 를 받는다 — 양방향 가림이 그제서야 성립한다.
// opaque 라 opacity 는 더 이상 효과가 없다. selected/dimmed 상태는 대신
// color 를 lerp 해서 표현한다(밝을수록 선택, 어두울수록 dim).
const CORE_NORMAL = new THREE.Color("#e2e8f0");
const CORE_DIMMED = new THREE.Color("#334155");
const CORE_SELECTED = new THREE.Color("#dbeafe");

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
    const k = Math.min(1, delta * 6);
    const coreTarget = selected ? CORE_SELECTED : dimmed ? CORE_DIMMED : CORE_NORMAL;
    const ring = selected ? 0.5 : dimmed ? 0.06 : 0.2;
    if (coreMat.current) {
      coreMat.current.color.lerp(coreTarget, k);
    }
    if (haloMat.current) {
      haloMat.current.opacity += (ring - haloMat.current.opacity) * k;
    }
  });

  return (
    <group position={position as unknown as [number, number, number]}>
      <mesh>
        <sphereGeometry args={[0.075, 12, 12]} />
        <meshBasicMaterial ref={coreMat} color={CORE_NORMAL} />
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
