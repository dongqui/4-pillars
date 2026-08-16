"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FIELD_CENTERS, FIELD_EXTENT, hash01 } from "../../_lib/layout";
import { FIELD_TINT } from "./tint";
import { RibbonMaterial } from "./shaders/materials";

const RIBBON_COUNT = 3;

// 매 렌더 new THREE.Color(...) 를 JSX 안에서 만들면 참조가 매번 바뀌어 R3F 가
// 매번 다시 적용한다(FillVolume.tsx 의 흠). 모듈 스코프에서 한 번만 만든다
// (BesideLayers.tsx / ExpressRays.tsx 와 동일 패턴).
const RIBBON_COLOR = new THREE.Color(FIELD_TINT.move);

export function MoveRibbons({ dimmed }: { dimmed: boolean }) {
  const mats = useRef<Array<InstanceType<typeof RibbonMaterial> | null>>([]);
  const center = FIELD_CENTERS.move;
  const extent = FIELD_EXTENT.move;

  // 카메라→중심 거리 계산용. center 는 모듈 상수라 참조가 안 바뀌므로 이
  // 벡터는 실질적으로 한 번만 만들어진다(FillVolume/BesideLayers 와 동일).
  const centerVec = useMemo(
    () => new THREE.Vector3(center[0], center[1], center[2]),
    [center],
  );

  const geometries = useMemo(
    () =>
      Array.from({ length: RIBBON_COUNT }, (_, i) => {
        const pts = Array.from({ length: 6 }, (_, k) => {
          const s = i * 40 + k * 5;
          const t = k / 5;
          return new THREE.Vector3(
            (hash01(s + 1) * 2 - 1) * extent * 1.5,
            (t - 0.5) * extent * 2.2 + (hash01(s + 2) - 0.5) * extent * 0.5,
            (hash01(s + 3) * 2 - 1) * extent * 1.5,
          );
        });
        const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.6);
        return new THREE.TubeGeometry(curve, 64, extent * 0.055, 8, false);
      }),
    [extent],
  );

  useEffect(() => {
    return () => geometries.forEach((g) => g.dispose());
  }, [geometries]);

  // 페이드 반지름 유도(카메라가 리본 다발 안으로 들어왔을 때의 오버드로우를
  // 막기 위함, 다른 Field 들과 같은 이유 — RibbonMaterial 의 uRadius 주석 참고).
  // 다른 Field 의 반지름을 그대로 베끼면 안 된다: 이 지오메트리는 제어점이
  // 아니라 CatmullRomCurve3(tension 0.6) 로 만든 스플라인이라, 이론상 제어점
  // 박스 밖으로 나갈(overshoot) 수 있다.
  //
  // 제어점 박스: x,z 는 ±extent*1.5, y 는 (t-0.5)*extent*2.2 의 최대 ±extent*1.1
  // 에 지터 (hash-0.5)*extent*0.5 의 최대 ±extent*0.25 를 더해 ±extent*1.35.
  // 원점(=Field 중심, group 이 이미 center 로 옮겨 놓았다)에서 가장 먼 제어점의
  // 대각선 상한은 extent*sqrt(1.5^2+1.35^2+1.5^2) = extent*2.514(extent=1.7 →
  // 4.27) 이지만, 이건 세 축이 동시에 극값을 찍는 최악의 경우를 가정한 느슨한
  // 상한이라 실제보다 크게 잡는다.
  //
  // 대신 스플라인 자체(제어점 6개짜리 3가닥)를 2000점씩 샘플링해 원점으로부터의
  // 실제 최대 거리를 재 확인했다(현재 시드 조합 기준, 고정 seed 라 렌더마다
  // 동일): 최댓값은 3가닥 모두 첫 제어점(t=0, 즉 스플라인의 끝점)에서 나오고
  // extent 배율로 정확히 2.014*extent(=3.423, extent=1.7) 다 — Catmull-Rom
  // 은 항상 제어점을 정확히 지나가므로 끝점에서는 overshoot 이 있을 수 없고,
  // 이번 시드에서는 중간 구간도 그 끝점 거리를 넘지 않았다. 여기에 튜브
  // 반지름 extent*0.055(=0.0935) 를 더하면 실제 최대 반경(true max extent)은
  // 3.423 + 0.0935 = 3.517 이다.
  //
  // uRadius*0.65 >= 3.517 이 되려면 uRadius >= 5.41 이 필요하다. 여유를 두어
  // extent*3.5(=5.95, 0.65배 = 3.87)로 잡는다 — 필요값 대비 약 10% 여유.
  const fadeRadius = extent * 3.5;

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
            uRadius={fadeRadius}
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
