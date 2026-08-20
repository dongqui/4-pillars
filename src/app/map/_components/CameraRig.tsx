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
  FOCUS_BIAS,
  FOCUS_DISTANCE,
  FRAME_LIFT,
} from "../_lib/camera";
import { SELF_POSITION, type Vec3 } from "../_lib/layout";

// FOCUS_DISTANCE·FOCUS_BIAS·FRAME_LIFT 의 근거와 실측치는 camera.ts 에 있다 —
// 세 상수 모두 three 없이 계산되는 순수 값이라 거기 두고, layout.test.ts 가
// focus view 프레이밍(person offscreen 0/20)을 직접 잠근다.
// 타깃/거리 오차가 이보다 작아지면 보간을 끈다.
const SETTLE_EPSILON = 0.01;

export function CameraRig({ focusOn }: { focusOn: Vec3 | null }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const limits = CAMERA_LIMITS;

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
    // 마운트할 때 한 번, 기본 뷰로 스냅한다.
    //
    // 예전에는 A/B/C 모드 전환과 "처음 위치로" 버튼도 이 이펙트를 다시 돌렸다.
    // 모드 토글이 사라지면서 남은 트리거는 마운트뿐이다.
    camera.position.set(...DEFAULT_CAMERA_POSITION);
    controls.current?.target.set(...DEFAULT_TARGET);
    controls.current?.update();
    // 래치를 건다. 선택이 없으면 desiredTarget 이 기본 타깃이고 위에서 이미
    // 스냅했으므로 첫 프레임에 오차 0 으로 곧장 꺼진다 — 그 뒤로는 사용자의
    // 회전·줌을 매 프레임 되돌리지 않는다.
    animating.current = true;
  }, [camera]);

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
