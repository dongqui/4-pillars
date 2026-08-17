"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  BESIDE_LAYERS,
  BESIDE_PLANE_ASPECT,
  BESIDE_PLANE_SPAN,
  BESIDE_TILT,
  FIELD_CENTERS,
  FIELD_EXTENT,
} from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { FIELD_FADE_RADIUS } from "./geometry";
import { LayerMaterial } from "./shaders/materials";

// LAYERS 와 기울기 값은 _lib/layout.ts 에 있다(BESIDE_LAYERS, BESIDE_TILT) —
// positionFor 가 사람을 이 평면 위에 앉히려면 같은 값을 봐야 하기 때문에,
// 여기서 따로 정의하지 않고 그 쪽을 import 한다.

// 모든 층이 같은 틴트를 쓴다. JSX 안에서 매 렌더 `new THREE.Color(...)` 를
// 새로 만들면 참조가 매번 바뀌어 R3F 가 매번 다시 적용한다 — 모듈 스코프로
// 한 번만 만든다(FillVolume.tsx 의 흠을 여기서는 반복하지 않는다).
const BESIDE_COLOR = new THREE.Color(FIELD_TINT.beside);

export function BesideLayers({ dimmed }: { dimmed: boolean }) {
  const mats = useRef<Array<InstanceType<typeof LayerMaterial> | null>>([]);
  const center = FIELD_CENTERS.beside;
  const extent = FIELD_EXTENT.beside;
  const size = BESIDE_PLANE_SPAN;
  // 카메라→중심 거리 계산용. center 는 모듈 상수라 참조가 안 바뀌므로
  // 이 벡터는 실질적으로 한 번만 만들어진다(매 프레임 new 하지 않는다).
  const centerVec = useMemo(
    () => new THREE.Vector3(center[0], center[1], center[2]),
    [center],
  );

  useFrame((state, delta) => {
    const target = dimmed ? 0.12 : 0.42;
    const camDist = state.camera.position.distanceTo(centerVec);
    for (const m of mats.current) {
      if (!m) continue;
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uCamDist.value = camDist;
      m.uniforms.uOpacity.value +=
        (target - m.uniforms.uOpacity.value) * Math.min(1, delta * 5);
    }
  });

  return (
    // 살짝 기울여 둔다. 정확히 수평이면 카메라가 지면 근처로 올 때 사라진다.
    <group
      position={center as unknown as [number, number, number]}
      rotation={[0, 0, BESIDE_TILT]}
    >
      {BESIDE_LAYERS.map((y, i) => (
        <mesh key={y} position={[0, y * extent, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[size, size * BESIDE_PLANE_ASPECT]} />
          <layerMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            uColor={BESIDE_COLOR}
            uOpacity={0.42}
            uPhase={i * 0.27}
            uRadius={FIELD_FADE_RADIUS.beside}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.NormalBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
