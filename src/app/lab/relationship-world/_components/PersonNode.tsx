"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { paletteFor } from "../_data/saju-colors";
import type { Vec3 } from "../_lib/layout";
import {
  CORE_RADIUS,
  DIFFUSE_HALO_RADIUS,
  HALO_ALPHA,
  HALO_TEXTURE_SIZE,
  NEAR_HALO_RADIUS,
  radialFalloff,
} from "../_lib/node-visual";

/**
 * 21명이 공유하는 halo 텍스처 한 장. 모듈 스코프에서 딱 한 번 만든다.
 *
 * DataTexture 는 데이터 홀더일 뿐이라 렌더러가 업로드하기 전까지 DOM 을
 * 건드리지 않는다 — SSR 프리렌더에서 이 모듈이 평가돼도 안전하다.
 */
const HALO_TEXTURE = (() => {
  const texture = new THREE.DataTexture(
    radialFalloff(HALO_TEXTURE_SIZE),
    HALO_TEXTURE_SIZE,
    HALO_TEXTURE_SIZE,
  );
  texture.needsUpdate = true;
  return texture;
})();

export function PersonNode({
  position,
  pillarKey,
  selected,
  dimmed,
  coreScale = 1,
}: {
  position: Vec3;
  pillarKey: string;
  selected: boolean;
  dimmed: boolean;
  coreScale?: number;
}) {
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const nearMat = useRef<THREE.SpriteMaterial>(null);
  const diffuseMat = useRef<THREE.SpriteMaterial>(null);

  // pillarKey 는 사람마다 고정이라 사실상 한 번만 계산된다. THREE.Color 로 미리
  // 바꿔두는 이유는 useFrame 안에서 lerp 대상이 필요하기 때문이다.
  const palette = useMemo(() => {
    const p = paletteFor(pillarKey);
    return {
      glow: new THREE.Color(p.glow),
      core: new THREE.Color(p.core),
      coreSelected: new THREE.Color(p.coreSelected),
      coreDimmed: new THREE.Color(p.coreDimmed),
    };
  }, [pillarKey]);

  useFrame((_, delta) => {
    const k = Math.min(1, delta * 6);

    // 코어는 opaque 라 opacity 로 상태를 표현할 수 없다. 색을 lerp 한다.
    const target = selected
      ? palette.coreSelected
      : dimmed
        ? palette.coreDimmed
        : palette.core;
    if (coreMat.current) coreMat.current.color.lerp(target, k);

    const state = selected ? "selected" : dimmed ? "dimmed" : "base";
    if (nearMat.current) {
      nearMat.current.opacity +=
        (HALO_ALPHA.near[state] - nearMat.current.opacity) * k;
    }
    if (diffuseMat.current) {
      diffuseMat.current.opacity +=
        (HALO_ALPHA.diffuse[state] - diffuseMat.current.opacity) * k;
    }
  });

  return (
    <group position={position as unknown as [number, number, number]}>
      {/*
        코어만 opaque 다. transparent 로 두면 three 의 transparent 큐로 가는데,
        그 큐는 픽셀이 아니라 오브젝트 원점 거리로 정렬된다 — 앞뒤 가림이
        오브젝트 단위로 뭉개진다. opaque 패스에 남겨야 깊이 버퍼를 채우고,
        뒤따르는 모든 halo 가 이 코어를 상대로 진짜 depth test 를 받는다.
        "카메라를 돌리면 앞뒤가 실제로 느껴져야 한다"는 요구가 여기서만 선다.
      */}
      <mesh>
        <sphereGeometry args={[CORE_RADIUS * coreScale, 12, 12]} />
        <meshBasicMaterial ref={coreMat} color={palette.core} />
      </mesh>

      {/* sprite 는 three 가 알아서 카메라를 향하게 한다. scale 은 지름이다. */}
      <sprite scale={[NEAR_HALO_RADIUS * 2, NEAR_HALO_RADIUS * 2, 1]}>
        <spriteMaterial
          ref={nearMat}
          map={HALO_TEXTURE}
          color={palette.glow}
          transparent
          opacity={HALO_ALPHA.near.base}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      {/* 이웃과 겹쳐서 Field 를 만드는 층. 혼자 있을 땐 거의 안 보인다. */}
      <sprite scale={[DIFFUSE_HALO_RADIUS * 2, DIFFUSE_HALO_RADIUS * 2, 1]}>
        <spriteMaterial
          ref={diffuseMat}
          map={HALO_TEXTURE}
          color={palette.glow}
          transparent
          opacity={HALO_ALPHA.diffuse.base}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}
