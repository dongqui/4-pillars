"use client";

import { useMemo, useRef } from "react";
import { extend, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_CENTERS, REFINE_SHARDS } from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { FIELD_FADE_RADIUS } from "./geometry";
import { ShardMaterial } from "./shaders/materials";

// 렌더하는 쪽에서 등록한다 — materials.ts 안에 두면 이 import 가 타입 위치에서만
// 쓰여 트랜스파일 단계에서 삭제되고 extend 가 실행되지 않는다(materials.ts 주석).
extend({ ShardMaterial });

// 매 렌더 new THREE.Color(...) 를 JSX 안에서 만들면 참조가 매번 바뀌어 R3F 가
// 매번 다시 적용한다. 모듈 스코프에서 한 번만 만든다(다섯 Field 공통 패턴).
const SHARD_COLOR = new THREE.Color(FIELD_TINT.refine);

export function RefineShards({ dimmed }: { dimmed: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<Array<InstanceType<typeof ShardMaterial> | null>>([]);
  const center = FIELD_CENTERS.refine;

  // 카메라→중심 거리 계산용. center 는 모듈 상수라 참조가 안 바뀌므로 이
  // 벡터는 실질적으로 한 번만 만들어진다(다른 Field 들과 동일).
  const centerVec = useMemo(
    () => new THREE.Vector3(center[0], center[1], center[2]),
    [center],
  );

  // 격자다. 랜덤 배치로는 '정돈됨'이 읽히지 않는다 — 3×3×3 에서 중심을 뺀 26개.
  // 배열은 _lib/layout.ts 의 REFINE_SHARDS 하나에서만 나온다:
  // positionFor("refine") 이 사람을 조각 틈에 놓으려면 조각이 어디 있는지
  // 알아야 하고, layout.test.ts 도 같은 배열로 그것을 증명한다.

  useFrame((state, delta) => {
    if (group.current) {
      group.current.children.forEach((c, i) => {
        c.rotation.y += delta * REFINE_SHARDS[i].spin;
        c.rotation.x += delta * REFINE_SHARDS[i].spin * 0.4;
      });
    }
    const target = dimmed ? 0.2 : 0.72;
    const camDist = state.camera.position.distanceTo(centerVec);
    // 26개가 각자 재료 인스턴스를 갖는다. 하나만 잡으면 나머지 25개는
    // 영원히 안 흐려진다 — 배열로 전부 잡아 돌린다(다른 Field 와 같은 패턴).
    for (const m of mats.current) {
      if (!m) continue;
      m.uniforms.uTime.value = state.clock.elapsedTime;
      m.uniforms.uCamDist.value = camDist;
      m.uniforms.uOpacity.value +=
        (target - m.uniforms.uOpacity.value) * Math.min(1, delta * 5);
    }
  });

  return (
    <group ref={group} position={center as unknown as [number, number, number]}>
      {REFINE_SHARDS.map((s, i) => (
        <mesh
          key={i}
          position={s.pos as unknown as [number, number, number]}
          scale={s.scale}
        >
          <octahedronGeometry args={[1, 0]} />
          <shardMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            uColor={SHARD_COLOR}
            uOpacity={0.72}
            uRadius={FIELD_FADE_RADIUS.refine}
            transparent
            depthWrite={false}
            blending={THREE.NormalBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
