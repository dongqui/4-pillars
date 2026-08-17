/**
 * 나와 각 사람을 잇는 기본 연결선.
 *
 * 선택했을 때 뜨는 RelationThread 와는 다른 것이다. 저쪽은 "지금 고른 한 사람과
 * 나 사이에 일어나는 일"(六合·沖)이고, 이쪽은 "이 사람들이 전부 나의 관계다"라는
 * 구조다. 그래서 셋을 반드시 지킨다:
 *
 *  - 색은 role 을 읽되 feature 는 읽지 않는다. role 은 "어느 구역 사람인가"라는
 *    구조지만, feature 를 읽는 순간 선이 관계의 좋고 나쁨을 말하기 시작한다.
 *    connectionColors 의 시그니처가 feature 를 받지 못하게 되어 있다.
 *  - 알파는 전원 동일하다. 진하기가 달라지면 그것도 강약이다.
 *  - 직선이다. RelationThread 는 휘어 있다("직선이면 그래프의 엣지로 읽힌다").
 *    기본 연결선은 반대로 구조여야 하므로 직선이 맞고, 덕분에 선택된 곡선과
 *    한눈에 구분된다.
 *  - 훨씬 옅다. 선택된 가닥(0.55)보다 4배 가까이 옅어서, 20개가 동시에 떠 있어도
 *    선택한 하나가 여전히 가장 밝다.
 *
 * three 를 import 하지 않는다 — 좌표 계산만 순수 함수로 두고 실제 LineSegments
 * 조립은 ConnectionLines.tsx 가 한다. 그래야 규칙이 node 환경 테스트로 잠긴다.
 */

import { roleColor } from "../_data/role-colors";
import type { RelationRole } from "../_data/roles";
import { SELF_POSITION, type Vec3 } from "./layout";

/**
 * 선 하나의 불투명도.
 *
 * 20개가 원점으로 모이므로 중심 몇 px 안에서는 전부 포개진다. 그 구간은 나의
 * 코어(opaque, 진입 화면 지름 19.5px)가 덮는다. 그 바깥에서는 반지름 10px 지점의
 * 선 간격이 이미 약 3px 라 서로 쌓이지 않는다 — 최악으로 2~3겹이 겹쳐도
 * 1-(1-0.14)^3 = 0.36 으로 선택된 가닥(0.55)보다 옅다.
 */
export const CONNECTION_OPACITY = 0.14;

/**
 * 나 쪽 끝에서 선 색을 죽이는 비율.
 *
 * 20개 선이 원점 한 점으로 모이므로, 양 끝을 같은 채도로 칠하면 중심이
 * 스무 가지 색으로 탁해진다. 사람 쪽에서 자기 Role 색이 살고 나 쪽으로
 * 갈수록 어두워지면 다섯 갈래가 뻗어 나가는 구조가 그대로 읽힌다.
 *
 * **모든 역할에 같은 비율로 건다.** 역할마다 다르면 그 순간 어떤 관계가
 * 더 진하게 이어져 있다는 뜻이 된다.
 */
export const CONNECTION_SELF_DIM = 0.25;

/**
 * LineSegments 의 정점 색. 사람 한 명당 두 정점(나 쪽, 사람 쪽).
 *
 * feature 를 인자로 받지 않는다 — 받을 수 있게 두면 언젠가 六合 선을 밝게
 * 하고 싶어진다. 그러면 선이 관계의 좋고 나쁨을 말하기 시작한다.
 */
export function connectionColors(roles: readonly RelationRole[]): Float32Array {
  const out = new Float32Array(roles.length * 6);

  roles.forEach((role, i) => {
    const hex = roleColor(role);
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    out[i * 6] = r * CONNECTION_SELF_DIM;
    out[i * 6 + 1] = g * CONNECTION_SELF_DIM;
    out[i * 6 + 2] = b * CONNECTION_SELF_DIM;
    out[i * 6 + 3] = r;
    out[i * 6 + 4] = g;
    out[i * 6 + 5] = b;
  });

  return out;
}

/**
 * 나 → 사람 선분들을 LineSegments 용 평면 배열로 만든다.
 * 사람 한 명당 정확히 두 정점(시작=나, 끝=그 사람)이다.
 */
export function connectionSegments(targets: readonly Vec3[]): Float32Array {
  const out = new Float32Array(targets.length * 6);

  for (let i = 0; i < targets.length; i++) {
    out.set(SELF_POSITION, i * 6);
    out.set(targets[i], i * 6 + 3);
  }

  return out;
}
