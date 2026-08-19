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
 * 좌표를 소수 4자리로 옮겨 적은 값 그대로는 |anchor| 가 7 에서 최대 3.2e-5
 * 벗어난다(반올림 오차 — 예: move 의 z 는 소수 3자리로 적혀 있어 오차가 가장
 * 크다). "어떤 역할도 더 가깝지 않다"는 소수점 9자리까지 정확해야 하는
 * 보증이라, 방향은 이 숫자들 그대로 두고 길이만 ANCHOR_RADIUS 로 다시 맞춘다.
 */
function toAnchorRadius(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]);
  const k = ANCHOR_RADIUS / l;
  return [v[0] * k, v[1] * k, v[2] * k];
}

/**
 * Role 앵커 solved 좌표의 정규화 전 원본. **자릿수 그대로 옮겨 적은 값이다** —
 * ROLE_ANCHORS 는 toAnchorRadius 를 거치므로 무엇을 넣어도 길이가 정확히 7이
 * 되어, 자릿수 오타를 잡으려면 이 원본을 직접 재야 한다(layout.test.ts).
 */
export const ROLE_ANCHOR_LITERALS: Record<RelationRole, Vec3> = {
  move: [-1.7653, 6.2975, -2.495],
  beside: [1.2101, 4.8569, 4.8935],
  refine: [2.6854, -2.4885, -5.9662],
  fill: [0.8922, -4.3054, 5.4468],
  express: [-2.5795, -4.6397, -4.5628],
};

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
 */
export const ROLE_ANCHORS: Record<
  RelationRole,
  { readonly anchor: Vec3; readonly phase: number }
> = {
  move: { anchor: toAnchorRadius(ROLE_ANCHOR_LITERALS.move), phase: 0.9992 }, //    화면 (132, 195) 깊이 27.69
  beside: { anchor: toAnchorRadius(ROLE_ANCHOR_LITERALS.beside), phase: 1.3657 }, //   화면 (238, 258) 깊이 20.86
  refine: { anchor: toAnchorRadius(ROLE_ANCHOR_LITERALS.refine), phase: 2.5787 }, // 화면 (258, 432) 깊이 33.16
  fill: { anchor: toAnchorRadius(ROLE_ANCHOR_LITERALS.fill), phase: 4.4157 }, //    화면 (222, 618) 깊이 22.52
  express: { anchor: toAnchorRadius(ROLE_ANCHOR_LITERALS.express), phase: 5.7509 }, // 화면 (118, 498) 깊이 32.32
};

/** 소구역 삼각형에서 각 상태가 차지하는 꼭짓점. */
const STATE_INDEX: Record<Feature, number> = { none: 0, yukhap: 1, chung: 2 };

/**
 * 상태별로 나에게서 떨어진 거리. 세 껍질이 ANCHOR_RADIUS 를 가운데 두고
 * 같은 간격으로 벌어진다(3등분).
 *
 * **이건 브리프 §2.2 를 의도적으로 뒤집은 것이다.** 그 조항은 "기본/六合/沖을
 * 나와의 거리로 구분하지 않는다 — 가까움=좋음, 멂=나쁨 같은 오해를 만들 수
 * 있기 때문"이라고 못박았고, subAnchor 가 회전만 쓰도록 만든 것도 그래서
 * 궁합이 거리를 바꾸는 코드를 아예 쓸 수 없게 하려던 것이었다. 사용자가 그
 * 위험을 듣고 六合 가까이 / 기본 중간 / 沖 멀리를 직접 골랐다. 되돌릴 때
 * 필요한 것은 이 표 하나를 지우고 subAnchor 의 scaleTo 를 빼는 것뿐이다.
 *
 * 간격 2.5 다. 1.5 → 2 → 2.5 로 두 번 벌렸다. 1.5 로 시작했지만 세 밴드 사이의 빈 구간이 0.44/0.50 밖에 안 돼
 * 화면에서 경계가 흐릿했다 — 밴드를 넓히는 주범은 간격이 아니라 사람의
 * 퍼짐이었다(SPREAD). 간격을 2 로 벌리고 퍼짐을 함께 좁혀 빈 구간을
 * 1.8 이상으로 만들었고, 접선/반경 분리 뒤에는 2.5 까지 벌려도 겹침이
 * 버텨서 밴드 사이 빈 구간이 2.31/2.09 가 됐다. 3.0 부터 확산 halo 의 겹침
 * 중앙값이 2 → 1 로 떨어져 구역이 흩어진다 — 거기가 상한이다.
 */
export const STATE_RADIUS: Record<Feature, number> = {
  yukhap: ANCHOR_RADIUS - 2.5,
  none: ANCHOR_RADIUS,
  chung: ANCHOR_RADIUS + 2.5,
};

/**
 * 소구역 안에서 사람이 흩어지는 **접선 방향** 반지름.
 *
 * 반경 방향으로는 RADIAL_JITTER 만큼만 흔들린다 — 이 둘을 나눈 덕에 밴드를
 * 얇게 유지하면서도 사람끼리는 넉넉히 벌릴 수 있다.
 *
 * 기본은 느슨한 무리, 六合·沖 은 또렷한 자리다. 六合 이 8%, 沖 이 8% 라
 * 그 두 칸은 대개 한 명이거나 비어 있다 — 반경을 크게 주면 한 명이 흩어진
 * 무리의 낙오자로 보인다. 六合 과 沖 은 언제나 같은 값이어야 한다.
 */
export const SPREAD: Record<Feature, number> = { none: 1.35, yukhap: 0.5, chung: 0.5 };

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
 * 방향은 **회전만으로** 정한다. 그래서 세 소구역의 방향이 정삼각형을 이루는 것은 오차
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
  const spun = rotate(tilted, dir, phase + (STATE_INDEX[feature] * 2 * Math.PI) / 3);
  // 방향은 회전이 정하고, 길이만 상태별 껍질로 다시 맞춘다. 세 소구역의
  // **방향**은 여전히 정삼각형이라(회전이 각도를 보존한다) 어느 시점에서도
  // 셋 중 둘까지만 겹친다 — 달라진 것은 원점으로부터의 거리뿐이다.
  const k = STATE_RADIUS[feature] / Math.hypot(spun[0], spun[1], spun[2]);
  return [spun[0] * k, spun[1] * k, spun[2] * k];
}

const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** 껍질 두께. 접선 퍼짐과 달리 이 값만 밴드를 두껍게 만든다. */
export const RADIAL_JITTER = 0.2;

/**
 * 같은 소구역 안에서 사람과 사람이 화면에서 겹치지 않기 위한 최소 3D 간격.
 *
 * 3D 간격만으로는 이 문제를 놓친다 — 이 상수가 없던 때는 21명 3D 최소 간격
 * (0.2579)은 통과했지만, 두 사람이 화면에서 5.09px 로 붙어 그 깊이(≈20.9)의
 * 코어 반경(0.075 → 3.13px)을 두 배 넘게 삼켰다. 이름표가 겹쳐 누가 누군지 읽을
 * 수 없었다 — 앵커에서 이미 겪은 "3D 로는 떨어져 있어도 화면에서는 겹친다"
 * 함정이 한 단계 아래에서도 그대로 벌어진 것이다.
 *
 * ⚠️ 이것은 **목표**이지 보장이 아니다. placeSubRegion 은 MAX_ATTEMPTS 를 다
 * 써도 못 찾으면 마지막 후보를 그대로 쓴다. 六合·沖 은 SPREAD 가 0.5 라 원판
 * 지름이 1.0 이고, 그 칸에 두 명 이상이 들어오면 1.0 은 애초에 닿을 수 없는
 * 목표다 — 그 두 칸은 8% 씩이라 대개 한 명이거나 비어 있다는 전제 위에 있다.
 */
const MIN_SEPARATION = 1.0;

/**
 * 재시도 상한. 한 후보가 앞서 놓인 사람들과 MIN_SEPARATION 만큼 떨어지지 않으면
 * 시드를 바꿔 다시 뽑는데, 그것을 몇 번까지 하느냐다.
 *
 * 이 값이 재귀 깊이였던 적이 있으나 그 코드는 없다 — placeSubRegion 은 이제
 * 순회다(§1.2). 그래서 400 은 지수 비용이 아니라 선형 비용이다: 15개 소구역에
 * 각각 50명(지도 한도 전체가 한 칸에 몰린 최악)을 놓아도 180ms 로 끝난다.
 *
 * mock 20명 시절에 붙어 있던 "가장 붐빈 칸이 4명" 이라는 전제는 "누구나 추가"
 * 가 깨뜨렸다. 한 칸이 MAX_MAP_PEOPLE(50) 전부를 받을 수 있다고 보고 잡은 값이다.
 */
const MAX_ATTEMPTS = 400;

/** 재시도마다 시드를 벌리는 간격. 1회차(attempt 0)는 원래 시드를 그대로 써서
 * 재시도가 필요 없는 칸(대개 1명뿐인 六合·沖)의 좌표를 예전과 똑같이 지킨다. */
const RETRY_STRIDE = 991;

function sampleCandidate(
  role: RelationRole,
  feature: Feature,
  indexInSubRegion: number,
  attempt: number,
): Vec3 {
  const center = subAnchor(role, feature);
  const spread = SPREAD[feature];
  const base = (ROLE_INDEX[role] * 97 + STATE_INDEX[feature] * 31 + indexInSubRegion) * 7;
  const s = attempt === 0 ? base : base + attempt * RETRY_STRIDE;

  // 접평면 원판 + 얇은 반경 지터.
  //
  // 예전에는 구 안 균등 분포였다. 그러면 퍼짐이 반경 방향으로도 그대로 실려
  // 껍질이 ±spread 만큼 두꺼워진다 — 기본 퍼짐 1.15 일 때 밴드 두께가 1.5 를
  // 넘어 세 껍질의 경계가 화면에서 흐려졌다. 퍼짐을 줄여 밴드를 좁히면 이번엔
  // 사람끼리 화면에서 8px 까지 붙는다(실제로 그렇게 깨졌다).
  //
  // 둘은 사실 다른 축이다. 사람을 벌리는 데 필요한 건 **접선 방향** 거리이고,
  // 밴드를 좁히는 데 필요한 건 **반경 방향** 폭이다. 그래서 나눈다 — 접평면
  // 안에서는 spread 만큼 넉넉히 흩고, 반경으로는 RADIAL_JITTER 만큼만 흔든다.
  const dirOut = normalize(center);
  const ref: Vec3 = Math.abs(dirOut[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const t1 = normalize(cross(dirOut, ref));
  const t2 = cross(dirOut, t1); // 이미 단위벡터다(수직인 두 단위벡터의 외적)

  // 원판 안 균등 분포. sqrt 없이 반지름을 균등하게 뽑으면 중심에 몰린다.
  const theta = hash01(s + 2) * Math.PI * 2;
  const r = spread * Math.sqrt(hash01(s + 3));
  const radial = (hash01(s + 1) * 2 - 1) * RADIAL_JITTER;

  return [
    center[0] + t1[0] * r * Math.cos(theta) + t2[0] * r * Math.sin(theta) + dirOut[0] * radial,
    center[1] + t1[1] * r * Math.cos(theta) + t2[1] * r * Math.sin(theta) + dirOut[1] * radial,
    center[2] + t1[2] * r * Math.cos(theta) + t2[2] * r * Math.sin(theta) + dirOut[2] * radial,
  ];
}

/**
 * 한 소구역(role × feature)에 count 명을 배치한다.
 *
 * 앞서 놓은 사람들과 MIN_SEPARATION 이상 떨어지지 않으면 시드를 바꿔 다시 뽑는다.
 * MAX_ATTEMPTS 를 다 써도 못 찾으면 마지막 후보를 그대로 쓴다 — 이 함수는 항상 끝나야 한다.
 *
 * 예전에는 positionFor 가 "앞선 사람들" 을 자기 자신을 다시 불러 구했다. 순수
 * 함수라 상태 없이 계산된다는 것이 근거였고, 가장 붐빈 칸이 4명인 mock 에서는
 * 실제로 문제가 없었다. 하지만 그 재귀는 T(n) ≈ 2^n 이라 한 소구역 20명에서
 * 4.7초가 걸린다(설계 문서 §1.2 의 실측표). 지도에 누구나 추가할 수 있게 되면서
 * 그 전제가 깨졌으므로, 같은 샘플링 순서를 유지한 채 순회로 편다.
 */
export function placeSubRegion(
  role: RelationRole,
  feature: Feature,
  count: number,
): Vec3[] {
  const placed: Vec3[] = [];

  for (let i = 0; i < count; i++) {
    const farEnough = (p: Vec3) => placed.every((o) => dist3(p, o) >= MIN_SEPARATION);

    let candidate = sampleCandidate(role, feature, i, 0);
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !farEnough(candidate); attempt++) {
      candidate = sampleCandidate(role, feature, i, attempt);
    }
    placed.push(candidate);
  }

  return placed;
}

/**
 * 사람 한 명의 좌표.
 *
 * indexInSubRegion 은 **(role, feature) 쌍 안에서** 0부터 센다. Role 안 전체
 * 순번으로 세면 한 사람이 빠졌을 때 같은 소구역의 다른 사람들이 전부 자리를 옮긴다.
 *
 * 여러 명을 놓을 때는 이걸 반복해 부르지 말고 placeSubRegion 을 한 번 불러라 —
 * 이 함수는 index+1 명을 매번 처음부터 다시 배치한다.
 */
export function positionFor(
  role: RelationRole,
  feature: Feature,
  indexInSubRegion: number,
): Vec3 {
  return placeSubRegion(role, feature, indexInSubRegion + 1)[indexInSubRegion];
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
  // 칸별로 몇 명인지 먼저 세고, 칸마다 placeSubRegion 을 딱 한 번 부른다.
  // 사람마다 positionFor 를 부르면 같은 칸을 인원수만큼 다시 배치하게 된다.
  const order = new Map<string, string[]>();
  for (const person of people) {
    const key = `${person.role}/${person.feature}`;
    const ids = order.get(key);
    if (ids) ids.push(person.id);
    else order.set(key, [person.id]);
  }

  const out = new Map<string, Vec3>();
  for (const [key, ids] of order) {
    const [role, feature] = key.split("/") as [RelationRole, Feature];
    const points = placeSubRegion(role, feature, ids.length);
    ids.forEach((id, i) => out.set(id, points[i]));
  }

  return out;
}
