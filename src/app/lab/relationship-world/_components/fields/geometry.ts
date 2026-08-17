import * as THREE from "three";
import type { RelationRole } from "../../_data/roles";
import {
  BESIDE_LAYERS,
  BESIDE_PLANE_ASPECT,
  BESIDE_PLANE_SPAN,
  EXPRESS_RAYS,
  EXPRESS_RAY_WIDTH,
  FIELD_EXTENT,
  FILL_SHELLS,
  MOVE_RIBBONS,
  MOVE_TUBE_RADIUS,
  REFINE_SHARDS,
} from "../../_lib/layout";

// ---------------------------------------------------------------------------
// _lib/layout.ts 의 순수 숫자에서 three 가 필요한 파생값을 만든다.
// layout.ts 는 vitest 가 environment:"node" 로 돌리므로 three 를 못 들인다 —
// 그래서 곡선과 페이드 반지름만 여기로 나와 있다. 값의 출처는 여전히 layout.ts
// 하나뿐이고, 이 파일은 그것을 계산만 한다.

/** MoveRibbons.tsx 의 리본 곡선. FieldAccents 도 같은 곡선을 따라 점을 뿌린다. */
export const MOVE_CURVES: readonly THREE.CatmullRomCurve3[] = MOVE_RIBBONS.map(
  (pts) =>
    new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
      false,
      "catmullrom",
      0.6,
    ),
);

/** FieldAccents 가 move 곡선 주위로 흩는 폭. 페이드 반지름에 포함된다. */
export const MOVE_ACCENT_SPREAD = FIELD_EXTENT.move * 0.13;

function moveMaxRadius(): number {
  let max = 0;
  for (const curve of MOVE_CURVES) {
    for (let i = 0; i <= 400; i++) {
      max = Math.max(max, curve.getPoint(i / 400).length());
    }
  }
  return max;
}

/**
 * Field 중심에서 그 Field 의 **실제** 지오메트리(본체 + 악센트)까지의 최대 거리.
 *
 * 셰이더의 근접 페이드는 [0.65R, 1.15R] 구간에서 켜진다. 그러므로 R 은 반드시
 * 진짜 바운딩 반지름이어야 한다. 예전에는 네 Field 가 "0.65R 이 지오메트리
 * 끝보다 커야 한다"는 조건만 맞춰 R 을 1.8~2.0 배로 부풀려 넘겼는데, 그러면
 * "완전히 보이는" 거리가 실제 반지름의 1.8~2.0 배로 밀려난다 — C 모드에서 핀치
 * 한 번(minDistance 10.4)이면 beside 0.000 / move 0.001 / refine 0.009 로 본체가
 * 통째로 사라지고, 페이드가 없던 악센트 점 140개만 남아 이 브랜치가 없애려던
 * 흰 파티클 구름이 그대로 돌아왔다. R 을 진짜 반지름으로 되돌리면 같은 지점에서
 * 0.68 / 0.99 / 1.00 이 되고, 카메라가 정말 지오메트리 안으로 들어갔을 때만 0 이
 * 된다 — 원래 의도했던 오버드로우 방어는 그대로 산다.
 */
export const FIELD_FADE_RADIUS: Record<RelationRole, number> = {
  // 동심 셸의 바깥 셸. FillVolume 은 셸마다 자기 반지름을 따로 넘기므로 이
  // 값은 악센트용이다.
  fill: FIELD_EXTENT.fill * Math.max(...FILL_SHELLS),
  // 판의 사각 모서리 + 층의 최대 높이. group 의 Z축 기울기는 회전이라
  // 중심에서의 거리를 바꾸지 않는다.
  beside: Math.hypot(
    BESIDE_PLANE_SPAN / 2,
    Math.max(...BESIDE_LAYERS.map(Math.abs)) * FIELD_EXTENT.beside,
    (BESIDE_PLANE_SPAN * BESIDE_PLANE_ASPECT) / 2,
  ),
  // 가장 긴 광선의 판 바깥쪽 모서리.
  express: Math.max(
    ...EXPRESS_RAYS.map((r) => Math.hypot(r.len, EXPRESS_RAY_WIDTH / 2)),
  ),
  // 곡선 실측 최대 반경 + 튜브/악센트 중 두꺼운 쪽.
  move: moveMaxRadius() + Math.max(MOVE_TUBE_RADIUS, MOVE_ACCENT_SPREAD),
  // 가장 바깥 조각의 바깥쪽 끝. (악센트 없음 — FieldAccents.tsx 참고)
  refine: REFINE_SHARDS.reduce(
    (m, s) => Math.max(m, Math.hypot(s.pos[0], s.pos[1], s.pos[2]) + s.scale),
    0,
  ),
};
