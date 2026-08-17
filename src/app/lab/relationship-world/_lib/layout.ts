import type { Feature, RelationRole } from "../_data/roles";

export type Vec3 = readonly [number, number, number];

export const SELF_POSITION: Vec3 = [0, 0, 0];

/** 시드 기반 0..1. Math.random 을 쓰면 렌더마다 월드가 흔들린다. */
function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 11.7) * 43758.5453;
  return x - Math.floor(x);
}

/** 5개 Role 구역이 나로부터 떨어진 거리. 다섯 다 같다. */
export const ANCHOR_RADIUS = 7;

/**
 * 소구역을 앵커 방향에서 기울이는 각도(rad).
 *
 * 12° 인 근거는 실측한 교환비다 — 8° 는 소구역이 화면에서 32px 로 뭉치고,
 * 15° 이상이면 역할 그룹이 서로 섞여 최근접 이웃이 같은 역할인 사람이
 * 18/20 에서 14/20 으로 떨어진다. 12° 가 소구역 48px 과 응집 18/20 을
 * 동시에 지키는 지점이다.
 */
const SUB_TILT = (12 * Math.PI) / 180;

/**
 * Role 앵커와 소구역 삼각형의 방향.
 *
 * 좌표는 **화면 배치에서 역산했다.** 375×812 진입 화면에서 원점 깊이의 가시
 * 범위는 가로 ±5.77 / 세로 ±12.49 월드 단위라 가로 여유가 세로의 절반도 안
 * 된다. 이 제약 아래 무작위 탐색은 앵커끼리 19px 까지 붙는 해를 냈다. 그래서
 * 목표 화면 좌표를 지정하고, 그 화면점을 지나는 시선과 구면 |p| = 7 의 교점을
 * 풀었다(근/원 교점 선택으로 깊이를 벌린다).
 *
 * 결과: 앵커 간 화면 최소거리 123px, 깊이 20.86~33.16, 5개 전부 진입 화면 안.
 * 인원이 많은 Role 에 넓은 자리를 줬다(인성 6 · 비겁 5 · 식상 4 · 재성 3 · 관성 2).
 *
 * phase 는 소구역 셋의 화면 간격이 최대가 되도록 역할마다 따로 골랐다.
 * **앵커를 옮기면 phase 도 다시 풀어야 한다** — 그냥 두면 세 소구역이 화면에서
 * 한 점으로 뭉칠 수 있다.
 *
 * 좌표를 소수 4자리로 옮겨 적은 값 그대로는 |anchor| 가 7 에서 최대 3e-5
 * 벗어난다(반올림 오차 — 예: move 의 z 는 소수 3자리로 적혀 있어 오차가 가장
 * 크다). "어떤 역할도 더 가깝지 않다"는 소수점 9자리까지 정확해야 하는
 * 보증이라, 방향은 이 숫자들 그대로 두고 길이만 ANCHOR_RADIUS 로 다시 맞춘다.
 */
function toAnchorRadius(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]);
  const k = ANCHOR_RADIUS / l;
  return [v[0] * k, v[1] * k, v[2] * k];
}

export const ROLE_ANCHORS: Record<
  RelationRole,
  { readonly anchor: Vec3; readonly phase: number }
> = {
  move: { anchor: toAnchorRadius([-1.7653, 6.2975, -2.495]), phase: 0.4451 }, //    화면 (132, 195) 깊이 27.69
  beside: { anchor: toAnchorRadius([1.2101, 4.8569, 4.8935]), phase: 2.6878 }, //   화면 (238, 258) 깊이 20.86
  refine: { anchor: toAnchorRadius([2.6854, -2.4885, -5.9662]), phase: 3.8921 }, // 화면 (258, 432) 깊이 33.16
  fill: { anchor: toAnchorRadius([0.8922, -4.3054, 5.4468]), phase: 1.2479 }, //    화면 (222, 618) 깊이 22.52
  express: { anchor: toAnchorRadius([-2.5795, -4.6397, -4.5628]), phase: 1.946 }, // 화면 (118, 498) 깊이 32.32
};

/** 소구역 삼각형에서 각 상태가 차지하는 꼭짓점. */
const STATE_INDEX: Record<Feature, number> = { none: 0, yukhap: 1, chung: 2 };

/**
 * 소구역 안에서 사람이 흩어지는 반경.
 *
 * 기본은 느슨한 무리, 六合·沖 은 또렷한 자리다. 六合 이 8%, 沖 이 8% 라
 * 그 두 칸은 대개 한 명이거나 비어 있다 — 반경을 크게 주면 한 명이 흩어진
 * 무리의 낙오자로 보인다. 六合 과 沖 은 언제나 같은 값이어야 한다.
 */
export const SPREAD: Record<Feature, number> = { none: 1.15, yukhap: 0.5, chung: 0.5 };

/** seed 를 만들 때 쓰는 역할 순번. 값 자체에 의미는 없지만 바꾸면 배치가 통째로 달라진다. */
const ROLE_INDEX: Record<RelationRole, number> = {
  move: 0,
  beside: 1,
  refine: 2,
  fill: 3,
  express: 4,
};

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** 로드리게스 회전. **길이를 보존한다** — 이 설계 전체가 그 성질 위에 서 있다. */
function rotate(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const k = normalize(axis);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const kv = cross(k, v);
  const kd = dot(k, v);
  return [
    v[0] * c + kv[0] * s + k[0] * kd * (1 - c),
    v[1] * c + kv[1] * s + k[1] * kd * (1 - c),
    v[2] * c + kv[2] * s + k[2] * kd * (1 - c),
  ];
}

/**
 * 소구역 중심. 앵커 방향을 SUB_TILT 만큼 기울인 뒤 앵커 축으로 120° 씩 돌린
 * 정삼각형의 한 꼭짓점이다.
 *
 * **회전만 쓴다.** 그래서 |subAnchor| == ANCHOR_RADIUS 가 부동소수점 오차
 * 범위에서 성립하고, 궁합은 방향에만 영향을 주고 거리에는 영향을 줄 수 없다.
 * 스케일이나 평행이동을 섞으면 그 보증이 즉시 깨진다.
 *
 * ±각도로 두 방향만 벌리지 않는 이유: 그러면 세 점이 한 대원 위에 놓여,
 * 그 평면을 따라 보는 시점에서 셋이 한 줄로 겹친다. 정삼각형이면 어느
 * 시점에서도 최대 둘까지만 겹친다.
 */
export function subAnchor(role: RelationRole, feature: Feature): Vec3 {
  const { anchor, phase } = ROLE_ANCHORS[role];
  const dir = normalize(anchor);
  // dir 과 나란한 축을 고르면 외적이 0 이 된다. move 의 dir[1] 은 0.8996 으로
  // 이 문턱 바로 아래다 — 앵커를 옮길 때 layout.test.ts 의 외적 크기 테스트를
  // 반드시 통과시켜야 한다.
  const ref: Vec3 = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const tilted = rotate(anchor, normalize(cross(dir, ref)), SUB_TILT);
  return rotate(tilted, dir, phase + (STATE_INDEX[feature] * 2 * Math.PI) / 3);
}

/**
 * 사람 한 명의 좌표.
 *
 * indexInSubRegion 은 **(role, feature) 쌍 안에서** 0부터 센다. Role 안 전체
 * 순번으로 세면 한 사람이 빠졌을 때 같은 소구역의 다른 사람들이 전부 자리를 옮긴다.
 */
export function positionFor(
  role: RelationRole,
  feature: Feature,
  indexInSubRegion: number,
): Vec3 {
  const center = subAnchor(role, feature);
  const spread = SPREAD[feature];
  const s = (ROLE_INDEX[role] * 97 + STATE_INDEX[feature] * 31 + indexInSubRegion) * 7;

  // 구 내부 균등 분포. cbrt 없이 반지름을 균등하게 뽑으면 중심에 몰린다.
  const u = hash01(s + 1) * 2 - 1;
  const theta = hash01(s + 2) * Math.PI * 2;
  const r = spread * Math.cbrt(hash01(s + 3));
  const flat = Math.sqrt(1 - u * u);

  return [
    center[0] + r * flat * Math.cos(theta),
    center[1] + r * u,
    center[2] + r * flat * Math.sin(theta),
  ];
}

/**
 * placePeople 이 볼 수 있는 전부.
 *
 * 예전에는 feature 가 여기 없었다 — 배치가 궁합을 읽는 것 자체를 타입이
 * 막았다. 소구역이 feature 로 갈리는 지금은 그 방어가 불가능하다. 대신
 * subAnchor 가 회전만 쓰므로 궁합이 거리를 바꿀 수 없고, layout.test.ts 의
 * 등거리 테스트가 그것을 지킨다. 타입 방어보다 약하다는 것을 알고 하는 교환이다.
 */
export type Placeable = {
  readonly id: string;
  readonly role: RelationRole;
  readonly feature: Feature;
};

export function placePeople(people: readonly Placeable[]): Map<string, Vec3> {
  const seen = new Map<string, number>();
  const out = new Map<string, Vec3>();

  for (const person of people) {
    const key = `${person.role}/${person.feature}`;
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    out.set(person.id, positionFor(person.role, person.feature, index));
  }

  return out;
}
