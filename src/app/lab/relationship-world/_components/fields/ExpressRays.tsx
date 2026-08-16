"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_CENTERS, FIELD_EXTENT, hash01 } from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { RayMaterial } from "./shaders/materials";

const RAY_COUNT = 9;

// 매 렌더 new THREE.Color(...) 를 JSX 안에서 만들면 참조가 매번 바뀌어 R3F 가
// 매번 다시 적용한다(FillVolume.tsx 의 흠). 모듈 스코프에서 한 번만 만든다
// (BesideLayers.tsx 와 동일 패턴).
const RAY_COLOR = new THREE.Color(FIELD_TINT.express);

export function ExpressRays({ dimmed }: { dimmed: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<Array<InstanceType<typeof RayMaterial> | null>>([]);
  const center = FIELD_CENTERS.express;
  const extent = FIELD_EXTENT.express;

  // 카메라→중심 거리 계산용. center 는 모듈 상수라 참조가 안 바뀌므로 이
  // 벡터는 실질적으로 한 번만 만들어진다(FillVolume/BesideLayers 와 동일).
  const centerVec = useMemo(
    () => new THREE.Vector3(center[0], center[1], center[2]),
    [center],
  );

  // 방향은 시드로 고정한다. 렌더마다 광선이 흔들리면 안 된다.
  const rays = useMemo(
    () =>
      Array.from({ length: RAY_COUNT }, (_, i) => {
        const u = hash01(i * 3 + 11) * 2 - 1;
        const theta = hash01(i * 3 + 12) * Math.PI * 2;
        const len = extent * (1.5 + hash01(i * 3 + 13) * 1.3);
        const dir = new THREE.Vector3(
          Math.sqrt(1 - u * u) * Math.cos(theta),
          u,
          Math.sqrt(1 - u * u) * Math.sin(theta),
        );
        // 판의 +Y 가 dir 을 향하게 회전시킨다.
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir,
        );
        return { len, quat, phase: hash01(i + 71) * 6.28 };
      }),
    [extent],
  );

  // 가장 긴 광선은 extent*(1.5+1.3) = extent*2.8 까지 뻗는다. 그 광선의 판
  // (폭 extent*0.42, 즉 반폭 extent*0.21)의 가장 먼 모서리는 대각선으로
  // 조금 더 나간다: sqrt((extent*2.8)^2 + (extent*0.21)^2) ≈ extent*2.808
  // (extent=2.0 → 5.616). 페이드 시작 지점(RADIUS*0.65)이 이 값 이상이어야
  // 카메라가 광선 다발 안으로 들어왔을 때 지오메트리 전체가 투명 구간에
  // 들어간다 — RADIUS >= 5.616/0.65 ≈ 8.64 가 필요하므로, 여유를 두어
  // extent*4.5(=9.0)로 잡는다(0.65*9.0=5.85 ≥ 5.616).
  const fadeRadius = extent * 4.5;

  useFrame((state, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.02;
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
    <group ref={group} position={center as unknown as [number, number, number]}>
      {rays.map((r, i) => (
        // 바깥쪽 group 이 방향을 잡고, 안쪽 group 이 판을 길이의 절반만큼 밀어
        // 판의 아래 끝이 코어에 오게 한다. 지오메트리를 직접 translate 하지
        // 않으므로 광선마다 별도 지오메트리를 만들 필요도, 버릴 필요도 없다.
        <group key={i} quaternion={r.quat}>
          <group position={[0, r.len / 2, 0]}>
            <mesh>
              <planeGeometry args={[extent * 0.42, r.len]} />
              <rayMaterial
                ref={(m) => {
                  mats.current[i] = m;
                }}
                uColor={RAY_COLOR}
                uOpacity={0.5}
                uPhase={r.phase}
                uRadius={fadeRadius}
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
