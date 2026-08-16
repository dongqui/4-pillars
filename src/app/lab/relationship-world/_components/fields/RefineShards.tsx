"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  FIELD_CENTERS,
  FIELD_EXTENT,
  REFINE_GRID_STEP,
  REFINE_Y_COMPRESSION,
  hash01,
} from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { ShardMaterial } from "./shaders/materials";

// 매 렌더 new THREE.Color(...) 를 JSX 안에서 만들면 참조가 매번 바뀌어 R3F 가
// 매번 다시 적용한다(FillVolume.tsx 의 흠). 모듈 스코프에서 한 번만 만든다
// (BesideLayers.tsx / ExpressRays.tsx / MoveRibbons.tsx 와 동일 패턴).
const SHARD_COLOR = new THREE.Color(FIELD_TINT.refine);

export function RefineShards({ dimmed }: { dimmed: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<Array<InstanceType<typeof ShardMaterial> | null>>([]);
  const center = FIELD_CENTERS.refine;
  const extent = FIELD_EXTENT.refine;

  // 카메라→중심 거리 계산용. center 는 모듈 상수라 참조가 안 바뀌므로 이
  // 벡터는 실질적으로 한 번만 만들어진다(다른 Field 들과 동일).
  const centerVec = useMemo(
    () => new THREE.Vector3(center[0], center[1], center[2]),
    [center],
  );

  // 격자다. 랜덤 배치로는 '정돈됨'이 읽히지 않는다 — 3×3×3 에서 중심을 뺀
  // 26개. 지터는 격자 간격(step)의 8% 이내로만 준다(j = step*0.08).
  const shards = useMemo(() => {
    const step = extent * REFINE_GRID_STEP;
    const out: { pos: [number, number, number]; scale: number; spin: number }[] = [];
    let n = 0;
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;
          const j = extent * 0.068;
          out.push({
            pos: [
              x * step + (hash01(n * 3 + 1) - 0.5) * j,
              y * step * REFINE_Y_COMPRESSION + (hash01(n * 3 + 2) - 0.5) * j,
              z * step + (hash01(n * 3 + 3) - 0.5) * j,
            ],
            scale: extent * (0.13 + hash01(n + 17) * 0.1),
            spin: 0.05 + hash01(n + 41) * 0.09,
          });
          n++;
        }
      }
    }
    return out;
  }, [extent]);

  // 페이드 반지름 유도(카메라가 격자 안으로 들어왔을 때의 오버드로우를 막기
  // 위함 — ShardMaterial 의 uRadius 주석 참고). 다른 Field 의 반지름을 그대로
  // 베끼면 안 된다: 이 지오메트리는 격자 간격(step)·모서리 셀 위치·지터·조각
  // 스케일로 결정되는, 이 Field 만의 크기다.
  //
  // 가장 먼 격자점은 코너(|x|=|y|=|z|=1)다. 지터 전:
  //   (step, step*0.8, step) = extent*(0.85, 0.68, 0.85)
  // 지터의 절반 진폭(= (hash01-0.5)*j 의 최댓값)은 축마다 extent*0.068/2 =
  // extent*0.034 이므로, 바깥쪽으로 밀리는 최악의 경우:
  //   extent*(0.884, 0.714, 0.884)
  // 중심에서의 거리 = extent*sqrt(0.884^2+0.714^2+0.884^2) = extent*1.4397
  //
  // 여기에 조각 자신의 반경을 더한다. octahedronGeometry(1,0) 의 꼭짓점은
  // 로컬 원점에서 거리 1 이고, scale 은 최대 extent*(0.13+0.1)=extent*0.23 이다.
  // 지터 방향과 꼭짓점 방향이 같다고 보는(느슨한 상한) 최악의 경우를 더하면:
  //   extent*(1.4397+0.23) = extent*1.6697
  // extent=1.4 → 1.4*1.6697 = 2.3376 이 가장 먼 조각의 바깥쪽 끝이다.
  //
  // uRadius*0.65 >= 2.3376 이 되려면 uRadius >= 3.596 이 필요하다. 여유를 두어
  // extent*2.8(=3.92, 0.65배 = 2.548)로 잡는다 — 필요값 대비 약 9% 여유.
  const fadeRadius = extent * 2.8;

  useFrame((state, delta) => {
    if (group.current) {
      group.current.children.forEach((c, i) => {
        c.rotation.y += delta * shards[i].spin;
        c.rotation.x += delta * shards[i].spin * 0.4;
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
      {shards.map((s, i) => (
        <mesh key={i} position={s.pos} scale={s.scale}>
          <octahedronGeometry args={[1, 0]} />
          <shardMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            uColor={SHARD_COLOR}
            uOpacity={0.72}
            uRadius={fadeRadius}
            transparent
            depthWrite={false}
            blending={THREE.NormalBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
