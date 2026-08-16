"use client";

import { useEffect, useMemo, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  CAMERA_LIMITS,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_TARGET,
  type CameraMode,
} from "../_lib/camera";
import { SELF_POSITION, type Vec3 } from "../_lib/layout";

// 기본 뷰(41.20)와 같은 3.077 배로 밀었다. 진입 → 포커스의 줌 비율(1.575 배)이
// 예전 13.39 → 8.5 와 같아서, 선택했을 때 "얼마나 다가가는가"의 체감이 유지된다.
const FOCUS_DISTANCE = 26.2;
// 0 = 나, 1 = 상대. 거리가 밀리면서 375px 세로 화면의 가시 반폭이 1.83 → 5.64 로
// 넓어져, 예전만큼 상대 쪽으로 치우칠 필요가 없어졌다. 0.70 이면 20명 전원이
// 프레임 안(최대 |ndc.x| 0.44)이고 '나'도 20/20 남아 관계 실이 끝까지 읽힌다.
const FOCUS_BIAS = 0.7;
// 타깃을 아래로 내리면 피사체가 화면 위쪽에 잡힌다 — 40vh 시트에 가리지 않게.
// 가시 높이도 같은 비율로 넓어졌으므로 화면상 같은 위치를 만들려면 이 값도 커져야
// 한다. 6.0 에서 상단 1/3 안착이 A 18/20, B·C 20/20 (기존 9 / 11 / 11).
const FRAME_LIFT = 6.0;
// 타깃/거리 오차가 이보다 작아지면 보간을 끈다.
const SETTLE_EPSILON = 0.01;

export function CameraRig({
  mode,
  resetSignal,
  focusOn,
}: {
  mode: CameraMode;
  resetSignal: number;
  focusOn: Vec3 | null;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const limits = CAMERA_LIMITS[mode];

  const desiredTarget = useMemo(() => {
    if (!focusOn) return new THREE.Vector3(...DEFAULT_TARGET);
    const self = new THREE.Vector3(...SELF_POSITION);
    const mid = self.clone().lerp(new THREE.Vector3(...focusOn), FOCUS_BIAS);
    return mid.setY(mid.y - FRAME_LIFT);
  }, [focusOn]);

  // 선택/해제 '순간'에만 켜지는 일회성 전환 플래그.
  // 상시 스프링으로 돌리면 OrbitControls 의 pan 이 target 을 옮기는 바로 그 자유도를
  // 매 프레임 되돌려버려서 C 모드의 pan 이 영원히 제자리로 튕긴다.
  const prevFocus = useRef<Vec3 | null>(null);
  const animating = useRef(false);

  useEffect(() => {
    // resetSignal 이나 mode 가 바뀔 때마다 기본 뷰로 돌린다. 첫 마운트에도 한 번 돈다.
    camera.position.set(...DEFAULT_CAMERA_POSITION);
    controls.current?.target.set(...DEFAULT_TARGET);
    controls.current?.update();
    // 래치를 여기서 다시 건다. focusOn 은 useMemo 로 얼린 Map 에서 나오는
    // 참조라 모드를 바꿔도 그대로여서, 아래 useFrame 의 참조 비교만으로는
    // 다시 켜지지 않는다 — 그러면 선택된 사람을 둔 채 A→B 로 바꿨을 때
    // 카메라가 기본 뷰에 버려지고 시트만 그 사람을 계속 보여준다.
    // 이 스파이크의 목적이 "같은 사람으로 A/B/C 를 비교"하는 것이라 치명적이다.
    // 선택이 없으면 desiredTarget 이 기본 타깃이고 위에서 이미 스냅했으므로
    // 첫 프레임에 오차 0 으로 곧장 꺼진다 → C 모드의 pan 은 그대로 살아남는다.
    // 단순 리렌더에는 이 이펙트가 돌지 않으므로 래치도 다시 걸리지 않는다.
    animating.current = true;
  }, [resetSignal, mode, camera]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;

    if (prevFocus.current !== focusOn) {
      prevFocus.current = focusOn;
      animating.current = true;
    }
    // 전환이 끝났으면 카메라에서 손을 뗀다. 사용자의 pan/zoom 이 그대로 남는다.
    if (!animating.current) return;

    const k = Math.min(1, delta * 2.6);

    // 보던 각도는 그대로 두고 타깃과 거리만 옮긴다.
    // 아래 세 줄의 순서는 기능적으로 중요하다(load-bearing):
    //   1) dir 을 매 프레임 '현재' position−target 에서 다시 뽑고,
    //   2) desiredPos 를 c.target.lerp() 이 target 을 움직이기 '전에' 확정한 뒤,
    //   3) position 과 target 을 '같은' k 로 보간한다.
    // 그러면 새 offset 이 [(1−k)D + k·distance]·dir 로 옛 offset 과 정확히 같은 직선 위에
    // 남는다 → polar/azimuth 가 불변이고 거리는 두 합법값의 볼록결합이라,
    // 뒤이어 도는 OrbitControls.update() 의 재클램프가 항상 no-op 이다.
    // 하나라도 어기면 update() 가 매 프레임 되받아쳐 카메라가 떨거나 목표에 못 닿는다.
    const dir = camera.position.clone().sub(c.target).normalize();
    const distance = focusOn
      ? THREE.MathUtils.clamp(FOCUS_DISTANCE, limits.minDistance, limits.maxDistance)
      : camera.position.distanceTo(c.target);

    const desiredPos = desiredTarget.clone().add(dir.multiplyScalar(distance));

    const targetError = c.target.distanceTo(desiredTarget);
    const distanceError = Math.abs(camera.position.distanceTo(c.target) - distance);

    if (targetError > SETTLE_EPSILON || distanceError > SETTLE_EPSILON) {
      c.target.lerp(desiredTarget, k);
      camera.position.lerp(desiredPos, k);
      c.update();
    } else {
      animating.current = false;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      enablePan={limits.enablePan}
      minPolarAngle={limits.minPolar}
      maxPolarAngle={limits.maxPolar}
      minAzimuthAngle={limits.minAzimuth}
      maxAzimuthAngle={limits.maxAzimuth}
      minDistance={limits.minDistance}
      maxDistance={limits.maxDistance}
    />
  );
}
