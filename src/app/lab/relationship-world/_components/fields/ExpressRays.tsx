"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EXPRESS_RAYS, EXPRESS_RAY_WIDTH, FIELD_CENTERS } from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { FIELD_FADE_RADIUS } from "./geometry";
import { RayMaterial } from "./shaders/materials";

// 매 렌더 new THREE.Color(...) 를 JSX 안에서 만들면 참조가 매번 바뀌어 R3F 가
// 매번 다시 적용한다. 모듈 스코프에서 한 번만 만든다(다섯 Field 공통 패턴).
const RAY_COLOR = new THREE.Color(FIELD_TINT.express);

// 방향·길이·위상은 _lib/layout.ts 의 EXPRESS_RAYS 하나에서만 나온다 —
// positionFor("express") 가 사람을 이 방향 위에 놓으려면 같은 값을 봐야 한다.
// 판의 +Y 가 dir 을 향하게 하는 회전만 여기서 만든다(three 가 필요하므로).
const RAY_QUATERNIONS = EXPRESS_RAYS.map((r) =>
  new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(r.dir[0], r.dir[1], r.dir[2]),
  ),
);

export function ExpressRays({ dimmed }: { dimmed: boolean }) {
  const mats = useRef<Array<InstanceType<typeof RayMaterial> | null>>([]);
  const center = FIELD_CENTERS.express;

  // 카메라→중심 거리 계산용. center 는 모듈 상수라 참조가 안 바뀌므로 이
  // 벡터는 실질적으로 한 번만 만들어진다(FillVolume/BesideLayers 와 동일).
  const centerVec = useMemo(
    () => new THREE.Vector3(center[0], center[1], center[2]),
    [center],
  );

  useFrame((state, delta) => {
    // 다발 전체를 돌리지 않는다. 사람은 월드 좌표에 고정돼 같이 돌지 않으므로,
    // 회전을 두면 positionFor 가 광선 방향에 정확히 맞춰 놓아도 몇 초 만에
    // 어긋나 버린다 — "사람이 그 공간에 속해 보인다"가 시간이 지나면 깨진다.
    // 살아 있다는 느낌은 셰이더의 uTime 펄스(RAY_FRAGMENT)가 이미 낸다.
    const target = dimmed ? 0.14 : 0.5;
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
    <group position={center as unknown as [number, number, number]}>
      {EXPRESS_RAYS.map((r, i) => (
        // 바깥쪽 group 이 방향을 잡고, 안쪽 group 이 판을 길이의 절반만큼 밀어
        // 판의 아래 끝이 코어에 오게 한다. 지오메트리를 직접 translate 하지
        // 않으므로 광선마다 별도 지오메트리를 만들 필요도, 버릴 필요도 없다.
        <group key={i} quaternion={RAY_QUATERNIONS[i]}>
          <group position={[0, r.len / 2, 0]}>
            <mesh>
              <planeGeometry args={[EXPRESS_RAY_WIDTH, r.len]} />
              <rayMaterial
                ref={(m) => {
                  mats.current[i] = m;
                }}
                uColor={RAY_COLOR}
                uOpacity={0.5}
                uPhase={r.phase}
                uRadius={FIELD_FADE_RADIUS.express}
                transparent
                depthWrite={false}
                side={THREE.DoubleSide}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
