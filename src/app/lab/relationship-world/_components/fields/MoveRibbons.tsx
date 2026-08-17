"use client";

import { useEffect, useMemo, useRef } from "react";
import { extend, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_CENTERS, MOVE_TUBE_RADIUS } from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { FIELD_FADE_RADIUS, MOVE_CURVES } from "./geometry";
import { RibbonMaterial } from "./shaders/materials";

// 렌더하는 쪽에서 등록한다 — materials.ts 안에 두면 이 import 가 타입 위치에서만
// 쓰여 트랜스파일 단계에서 삭제되고 extend 가 실행되지 않는다(materials.ts 주석).
extend({ RibbonMaterial });

// 매 렌더 new THREE.Color(...) 를 JSX 안에서 만들면 참조가 매번 바뀌어 R3F 가
// 매번 다시 적용한다. 모듈 스코프에서 한 번만 만든다(다섯 Field 공통 패턴).
const RIBBON_COLOR = new THREE.Color(FIELD_TINT.move);

export function MoveRibbons({ dimmed }: { dimmed: boolean }) {
  const mats = useRef<Array<InstanceType<typeof RibbonMaterial> | null>>([]);
  const center = FIELD_CENTERS.move;

  // 카메라→중심 거리 계산용. center 는 모듈 상수라 참조가 안 바뀌므로 이
  // 벡터는 실질적으로 한 번만 만들어진다(FillVolume/BesideLayers 와 동일).
  const centerVec = useMemo(
    () => new THREE.Vector3(center[0], center[1], center[2]),
    [center],
  );

  // 곡선은 geometry.ts 가 _lib/layout.ts 의 MOVE_RIBBONS 제어점으로 만든다 —
  // positionFor("move") 와 FieldAccents 가 같은 곡선을 봐야 하기 때문이다.
  const geometries = useMemo(
    () =>
      MOVE_CURVES.map(
        (curve) => new THREE.TubeGeometry(curve, 64, MOVE_TUBE_RADIUS, 8, false),
      ),
    [],
  );

  useEffect(() => {
    return () => geometries.forEach((g) => g.dispose());
  }, [geometries]);

  useFrame((state, delta) => {
    const target = dimmed ? 0.16 : 0.55;
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
      {geometries.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <ribbonMaterial
            ref={(m) => {
              mats.current[i] = m;
            }}
            uColor={RIBBON_COLOR}
            uOpacity={0.55}
            uPhase={i * 0.4}
            uRadius={FIELD_FADE_RADIUS.move}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}
