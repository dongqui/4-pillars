"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_CENTERS, FIELD_EXTENT } from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { MistMaterial } from "./shaders/materials";

const SHELLS = [1.0, 1.34, 1.72];

export function FillVolume({ dimmed }: { dimmed: boolean }) {
  const group = useRef<THREE.Group>(null);
  const mats = useRef<Array<InstanceType<typeof MistMaterial> | null>>([]);
  const center = FIELD_CENTERS.fill;
  const extent = FIELD_EXTENT.fill;
  // 카메라→중심 거리 계산용. center 는 모듈 상수라 참조가 안 바뀌므로
  // 이 벡터는 실질적으로 한 번만 만들어진다(매 프레임 new 하지 않는다).
  const centerVec = useMemo(
    () => new THREE.Vector3(center[0], center[1], center[2]),
    [center],
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (group.current) {
      // 아주 느린 호흡. 인지되면 안 되고 살아 있다는 느낌만 남긴다.
      group.current.scale.setScalar(1 + Math.sin(t * 0.32) * 0.025);
    }
    const target = dimmed ? 0.14 : 0.5;
    // C 모드는 pan + minDistance 10.4 라 카메라가 볼륨 중심(fill 은 원점에서
    // 5.9) 안쪽까지 들어올 수 있다. 셸 반지름 대비 카메라 거리를 매 프레임
    // 갱신해 마테리얼의 smoothstep 페이드에 넘긴다(오버드로우 방지, materials.ts 참고).
    const camDist = state.camera.position.distanceTo(centerVec);
    for (const m of mats.current) {
      if (!m) continue;
      m.uniforms.uTime.value = t;
      m.uniforms.uCamDist.value = camDist;
      m.uniforms.uOpacity.value +=
        (target - m.uniforms.uOpacity.value) * Math.min(1, delta * 5);
    }
  });

  return (
    <group ref={group} position={center as unknown as [number, number, number]}>
      {SHELLS.map((s, i) => (
        <mesh key={s}>
          <icosahedronGeometry args={[extent * s, 3]} />
          <mistMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            uColor={new THREE.Color(FIELD_TINT.fill)}
            uOpacity={0.5}
            uShellRadius={extent * s}
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
