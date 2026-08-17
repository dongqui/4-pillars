"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { nodeColor } from "../_data/role-colors";
import type { Feature, RelationRole } from "../_data/roles";
import type { Vec3 } from "../_lib/layout";
import {
  CORE_RADIUS,
  DIFFUSE_HALO_RADIUS,
  HALO_TEXTURE_SIZE,
  STATE_VISUAL,
  radialFalloff,
} from "../_lib/node-visual";

/**
 * 21명이 공유하는 halo 텍스처 한 장. 모듈 스코프에서 딱 한 번 만든다.
 * DataTexture 는 렌더러가 업로드하기 전까지 DOM 을 건드리지 않아 SSR 에서 안전하다.
 */
const HALO_TEXTURE = (() => {
  const texture = new THREE.DataTexture(
    radialFalloff(HALO_TEXTURE_SIZE),
    HALO_TEXTURE_SIZE,
    HALO_TEXTURE_SIZE,
  );
  texture.needsUpdate = true;
  // DataTexture 는 일반 Texture 와 달리 min/magFilter 기본값이 둘 다
  // NearestFilter 다. 그대로 두면 가까이서 동심 사각 계단이 보이고,
  // 멀어지면 밉맵 없는 점 샘플링이라 카메라를 돌릴 때마다 밝기가 튄다.
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return texture;
})();

/** 선택·dim 이 알파에 거는 배율. 세 상태 모두에 같은 비율로 걸어 균형을 깨지 않는다. */
const ALPHA_SCALE = { selected: 1.5, base: 1, dimmed: 0.22 } as const;

export function PersonNode({
  position,
  role,
  feature,
  selected,
  dimmed,
  nodeScale = 1,
}: {
  position: Vec3;
  role: RelationRole;
  feature: Feature;
  selected: boolean;
  dimmed: boolean;
  /** 코어와 근접 halo 에 함께 걸린다. 확산 halo 는 모두가 같은 크기다. */
  nodeScale?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const nearSprite = useRef<THREE.Sprite>(null);
  const diffuseSprite = useRef<THREE.Sprite>(null);
  const nearMat = useRef<THREE.SpriteMaterial>(null);
  const diffuseMat = useRef<THREE.SpriteMaterial>(null);

  const visual = STATE_VISUAL[feature];
  const color = useMemo(() => new THREE.Color(nodeColor(role, feature)), [role, feature]);

  const nearDiameter = visual.nearRadius * 2 * nodeScale;
  const diffuseDiameter = DIFFUSE_HALO_RADIUS * 2;

  useFrame((state, delta) => {
    const k = Math.min(1, delta * 6);
    const scale = selected ? ALPHA_SCALE.selected : dimmed ? ALPHA_SCALE.dimmed : ALPHA_SCALE.base;

    if (nearMat.current) {
      const target = Math.min(1, visual.nearAlpha * scale);
      nearMat.current.opacity += (target - nearMat.current.opacity) * k;
    }
    if (diffuseMat.current) {
      const target = Math.min(1, visual.diffuseAlpha * scale);
      diffuseMat.current.opacity += (target - diffuseMat.current.opacity) * k;
    }

    // 六合: 느린 호흡. 두 halo 를 **같은 배율로** 늘린다 — stateLight 의 시간
    // 평균 보정이 전체 T 에 걸린 값이라, 한쪽만 늘리면 광량 불변식이 깨진다.
    if (visual.breatheAmplitude > 0) {
      const s =
        1 +
        visual.breatheAmplitude *
          Math.sin((state.clock.elapsedTime * 2 * Math.PI) / visual.breathePeriod);
      nearSprite.current?.scale.set(nearDiameter * s, nearDiameter * s, 1);
      diffuseSprite.current?.scale.set(diffuseDiameter * s, diffuseDiameter * s, 1);
    }

    // 沖: 미세한 떨림. 진폭은 작게 — 크면 고장으로 보인다.
    if (visual.tremorAmplitude > 0 && group.current) {
      const t = state.clock.elapsedTime * visual.tremorHz * 2 * Math.PI;
      const a = visual.tremorAmplitude;
      group.current.position.set(
        position[0] + Math.sin(t) * a,
        position[1] + Math.sin(t * 1.7) * a * 0.6,
        position[2] + Math.cos(t * 1.3) * a,
      );
    }
  });

  return (
    <group ref={group} position={position as unknown as [number, number, number]}>
      {/*
        코어만 opaque 다. transparent 로 두면 three 의 transparent 큐로 가는데,
        그 큐는 픽셀이 아니라 오브젝트 원점 거리로 정렬된다 — 앞뒤 가림이
        오브젝트 단위로 뭉개진다. opaque 패스에 남겨야 깊이 버퍼를 채우고,
        뒤따르는 모든 halo 가 이 코어를 상대로 진짜 depth test 를 받는다.
      */}
      <mesh>
        <sphereGeometry args={[CORE_RADIUS * nodeScale, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>

      <sprite ref={nearSprite} scale={[nearDiameter, nearDiameter, 1]}>
        <spriteMaterial
          ref={nearMat}
          map={HALO_TEXTURE}
          color={color}
          transparent
          opacity={visual.nearAlpha}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      {/* 이웃과 겹쳐서 구역의 색 기운을 만드는 층. 혼자 있을 땐 거의 안 보인다. */}
      <sprite ref={diffuseSprite} scale={[diffuseDiameter, diffuseDiameter, 1]}>
        <spriteMaterial
          ref={diffuseMat}
          map={HALO_TEXTURE}
          color={color}
          transparent
          opacity={visual.diffuseAlpha}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}
