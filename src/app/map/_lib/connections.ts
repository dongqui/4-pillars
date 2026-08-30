/**
 * 나와 각 사람을 잇는 기본 연결선.
 *
 * 예전에는 사람을 고르면 그 사람에게 **새 곡선**(RelationThread)이 따로 떴다.
 * 六合 은 입자가 흐르고 沖 은 두 가닥이 떨리는, 연결선과는 다른 마크였다.
 * 그것을 지우고 **원래 있던 이 선을 강조**하는 쪽으로 바꿨다 — 고른 순간 없던
 * 선이 생기면 "이 관계만 특별한 통로가 있다"로 읽히지만, 있던 선이 밝아지면
 * "그 중 이것을 보고 있다"로 읽힌다. 구조는 그대로 두고 초점만 옮기는 것이다.
 *
 * 그래서 넷을 반드시 지킨다:
 *
 *  - 색은 role 을 읽되 feature 는 읽지 않는다. role 은 "어느 구역 사람인가"라는
 *    구조지만, feature 를 읽는 순간 선이 관계의 좋고 나쁨을 말하기 시작한다.
 *    connectionColors 의 시그니처가 feature 를 받지 못하게 되어 있다.
 *  - 알파는 **선택되지 않은 사람들끼리는** 전원 동일하다. 그들 사이에서
 *    진하기가 갈리면 그것이 곧 관계의 강약이 된다. 선택된 하나만 밝아지는 것은
 *    관계의 등급이 아니라 "지금 무엇을 보고 있는가"라 다른 축이다 — PersonNode
 *    가 이미 선택·dim 으로 하는 일과 같다.
 *  - 직선이다. 지워진 RelationThread 는 휘어 있었다("직선이면 그래프의 엣지로
 *    읽힌다"). 이 선은 반대로 구조여야 하므로 직선이 맞다.
 *  - 아무도 고르지 않았을 때가 기준선이고(CONNECTION_OPACITY), 하나를 고르면
 *    그 선만 CONNECTION_SELECTED_OPACITY 로 오르고 나머지는 함께 내려간다.
 *
 * three 를 import 하지 않는다 — 좌표 계산만 순수 함수로 두고 실제 LineSegments
 * 조립은 ConnectionLines.tsx 가 한다. 그래야 규칙이 node 환경 테스트로 잠긴다.
 *
 * **sRGB→linear 변환을 지우지 말 것.** three 0.185 는 `ColorManagement.enabled
 * === true` 라 `BufferAttribute` 의 정점 색은 linear-sRGB 작업 공간으로
 * 읽힌다 — `THREE.Color(hex)` 를 쓰는 PersonNode 와 달리 자동 변환이 없다.
 * 이 파일이 hex 를 그대로 /255 만 해서 넣으면(과거에 그랬다) 선이 파스텔로
 * 뜨고 노드와 색이 어긋난다. connectionColors 의 srgbToLinear 호출은 그
 * 어긋남을 막는 코드라 "단순화"라며 걷어내면 회귀다.
 */

import { MAP_BACKGROUND, roleColor } from "../_data/role-colors";
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
 * 한 사람을 골랐을 때, **고른 그 선**의 불투명도.
 *
 * 0.55 는 임의의 값이 아니라 지워진 RelationThread 의 THREAD_OPACITY 그대로다.
 * 화면에서 "지금 보고 있는 관계"가 갖던 무게를 그 곡선에서 이 선으로 그대로
 * 옮긴다 — 마크가 바뀌었을 뿐 세기는 이어진다.
 */
export const CONNECTION_SELECTED_OPACITY = 0.55;

/**
 * 한 사람을 골랐을 때, **나머지 선들**의 불투명도. 기준선의 정확히 절반이다.
 *
 * 0 으로 지우지 않는 이유: 나머지 선이 사라지면 다섯 갈래 구역이라는 구조도
 * 함께 사라져, 고른 사람이 '어느 구역의' 누구인지 읽을 근거가 없어진다.
 * 남되 물러난다. 강조된 선과의 비는 0.55 / 0.07 ≈ 7.9 배다.
 */
export const CONNECTION_DIMMED_OPACITY = 0.07;

/**
 * 나 쪽 끝에 남는 **그 사람 색의 비율**. 나머지(0.75)는 배경색이다.
 *
 * 20개 선이 원점 한 점으로 모이므로, 양 끝을 같은 채도로 칠하면 중심이
 * 스무 가지 색으로 탁해진다. 사람 쪽에서 자기 Role 색이 살고 나 쪽으로
 * 갈수록 배경에 잠기면 다섯 갈래가 뻗어 나가는 구조가 그대로 읽힌다.
 *
 * 다크 시절에는 검정 곱(× 0.25)이었다. 라이트 배경에서 검정 곱은 중심을
 * 오히려 진하게 만들므로, 같은 의도를 **배경으로의 lerp** 로 옮겼다.
 *
 * **모든 역할에 같은 비율로 건다.** 역할마다 다르면 그 순간 어떤 관계가
 * 더 진하게 이어져 있다는 뜻이 된다.
 *
 * 이 lerp 는 sRGB→linear 변환 **이후의** linear 값끼리 섞는다 — 섞기는 빛의
 * 물리량 연산이라 linear 공간에서 해야 한다. sRGB 값끼리 먼저 섞으면 실제
 * 표시 밝기가 의도보다 밝아진다(감마 곡선). 순서를 바꾸지 말 것.
 */
export const CONNECTION_SELF_DIM = 0.25;

/** sRGB [0,1] → linear-sRGB [0,1]. three 의 ColorManagement 가 쓰는 것과 같은
 * 표준 조각별(piecewise) 전달 함수다. three 를 import 하지 않고 직접 재현한다. */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * LineSegments 의 정점 색. 사람 한 명당 두 정점(나 쪽, 사람 쪽).
 *
 * feature 를 인자로 받지 않는다 — 받을 수 있게 두면 언젠가 六合 선을 밝게
 * 하고 싶어진다. 그러면 선이 관계의 좋고 나쁨을 말하기 시작한다.
 *
 * roleColor 는 sRGB hex 를 준다. three 0.185 는 ColorManagement.enabled 라
 * BufferAttribute 의 정점 색을 linear-sRGB 작업 공간으로 읽으므로, 여기서
 * sRGB→linear 로 변환한 뒤에 넣어야 LineBasicMaterial 이 그리는 색이
 * THREE.Color(hex) 를 쓰는 PersonNode 의 색과 실제로 일치한다.
 */
export function connectionColors(roles: readonly RelationRole[]): Float32Array {
  const out = new Float32Array(roles.length * 6);

  // 배경의 linear 값. 모든 선의 나 쪽 끝이 이쪽으로 물러난다.
  const bg = [1, 3, 5].map((i) =>
    srgbToLinear(parseInt(MAP_BACKGROUND.slice(i, i + 2), 16) / 255),
  ) as [number, number, number];

  roles.forEach((role, i) => {
    const hex = roleColor(role);
    const r = srgbToLinear(parseInt(hex.slice(1, 3), 16) / 255);
    const g = srgbToLinear(parseInt(hex.slice(3, 5), 16) / 255);
    const b = srgbToLinear(parseInt(hex.slice(5, 7), 16) / 255);

    out[i * 6] = bg[0] + (r - bg[0]) * CONNECTION_SELF_DIM;
    out[i * 6 + 1] = bg[1] + (g - bg[1]) * CONNECTION_SELF_DIM;
    out[i * 6 + 2] = bg[2] + (b - bg[2]) * CONNECTION_SELF_DIM;
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
