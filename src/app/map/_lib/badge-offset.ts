/**
 * 구역 배지를 화면에서 밀어내는 오프셋.
 *
 * 배지를 3D 로만 밀면 그 방향이 화면 어디로 갈지는 시점이 정한다 — 반경
 * 방향이 시선과 나란해지는 각도에서는 화면에서 거의 안 움직여 사람 명패와
 * 겹친다. 그래서 **화면공간에서** 나로부터 배지 쪽으로 민다.
 *
 * three 를 import 하지 않는다. 투영된 좌표만 받아 순수 산수를 하므로 node
 * 환경에서 실제 배치를 대상으로 겹침을 셀 수 있다 — 이 계산이 useFrame 안에
 * 있으면 브라우저 없이는 아무도 검증하지 못한다.
 */

export type ScreenPoint = { readonly x: number; readonly y: number };

/**
 * 나로부터 배지 쪽으로 미는 거리(px).
 *
 * 34/24 는 실측 최적점이다(badge-offset.test.ts). 더 밀면 명패와의 겹침은
 * 줄지만 배지가 화면 밖으로 나간다 — 76 에서 2개, 90 에서 4개다.
 */
export const BADGE_PUSH_PX = 34;

/**
 * 위로 밀릴 때도 명패와 갈리도록 더하는 아래 방향 성분(px).
 * 사람 명패는 노드에서 위로 32px 떠 있다(PersonMarker 의 LABEL_LIFT_PX).
 */
export const BADGE_DOWN_BIAS_PX = 24;

/**
 * 배지 중심에 적용할 화면 오프셋.
 * self 와 anchor 가 화면에서 같은 점이면 방향이 없으므로 아래로만 민다.
 */
export function badgeOffset(self: ScreenPoint, anchor: ScreenPoint): ScreenPoint {
  let dx = anchor.x - self.x;
  let dy = anchor.y - self.y;
  const len = Math.hypot(dx, dy);

  if (len < 1e-6) {
    dx = 0;
    dy = 1;
  } else {
    dx /= len;
    dy /= len;
  }

  return { x: dx * BADGE_PUSH_PX, y: dy * BADGE_PUSH_PX + BADGE_DOWN_BIAS_PX };
}
