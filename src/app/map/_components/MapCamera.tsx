"use client";

import { useEffect } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { screenScale, type MapLayout } from "../_lib/radial";

/** 기울임 상한. 완전히 옆에서 보면 원반이 선이 되어 아무것도 안 읽힌다. */
const MAX_TILT = (70 * Math.PI) / 180;

/** 기본 배율 대비 줌 한계. 조밀한 칸을 파고들 수 있을 만큼은 열되, 길은 잃지 않게. */
const ZOOM_RANGE = { min: 0.7, max: 5 };

/**
 * 지도를 화면에 맞추고, 사용자가 돌리고 당길 수 있게 한다.
 *
 * 직교 카메라를 쓰는 이유: 배치가 평면이라 원근이 할 일이 없고, 직교면
 * "화면에 꽉 차게" 가 zoom 한 값 계산으로 끝난다. 그 덕에 기본 시점에서
 * 월드 거리와 화면 픽셀이 상수배로 묶여, radial.test.ts 가 브라우저 없이
 * 화면 겹침을 잴 수 있다.
 *
 * screenScale 이 layout 을 통째로 받는 것은 점의 반지름만으로는 맞출 수 없기
 * 때문이다 — 배지는 월드가 아니라 화면에서 크기가 고정이라, 반지름만 맞추면
 * 원반 가장자리의 배지가 잘린다(실측: 모바일 27.9px, 데스크톱 11px).
 *
 * 회전을 여는 이유는 하나다: 한 칸에 사람이 몰리면 평면만으로는 간격을 지킬
 * 수 없어 넘치는 줄을 위로 쌓는데(radial.ts 의 MAX_FLAT_ROWS), 그 층은
 * 기울여야만 갈라진다. 팬은 열지 않는다 — 중심이 "나" 라는 것이 이 화면의
 * 전부이고, 팬은 그 중심을 잃게 한다.
 *
 * 크기가 바뀌면 배율을 다시 맞춘다. 사용자가 손으로 준 줌은 그때 초기화되는데,
 * 창 크기가 바뀐 뒤에도 옛 배율을 지키면 지도가 잘리거나 한쪽에 몰리는 편이
 * 더 나쁘다.
 */
export function MapCamera({ layout }: { layout: MapLayout }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  // screenScale 은 props/state 에서 결정론적으로 나오는 순수 계산이라, 상태로
  // 들고 effect 에서 채우기보다 렌더마다 직접 구하는 편이 맞다 — 그래야 첫
  // 렌더부터 OrbitControls 의 min/maxZoom 이 실제 배율을 반영한다.
  const base = screenScale(size.width, size.height, layout);

  // three 의 카메라는 React 가 소유하지 않는 가변 객체다 — R3F 의 표준
  // 패턴대로 effect 안에서 직접 zoom 을 맞춘다. react-hooks/immutability 는
  // useThree 가 준 값을 건드리는 이 R3F 관용구를 모르므로 블록째 끈다.
  /* eslint-disable react-hooks/immutability */
  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    camera.zoom = base;
    camera.updateProjectionMatrix();
  }, [camera, base]);
  /* eslint-enable react-hooks/immutability */

  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      target={[0, 0, 0]}
      minPolarAngle={0}
      maxPolarAngle={MAX_TILT}
      minZoom={base * ZOOM_RANGE.min}
      maxZoom={base * ZOOM_RANGE.max}
    />
  );
}
