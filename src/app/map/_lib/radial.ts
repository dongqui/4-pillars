/**
 * 관계 지도의 평면 배치.
 *
 * 좌표를 정하는 것은 전부 여기다. three 를 import 하지 않는다 — 이 라우트의
 * 테스트는 node 환경이라, 화면에서 겹치는지를 재려면 계산이 브라우저 밖에
 * 있어야 한다. 직전 설계(구면 앵커 + 재시도 샘플링)가 "3D 로는 떨어져 있어도
 * 화면에서는 겹친다"는 함정을 두 층에서 겪은 것이 이 규칙의 이유다.
 *
 * 각도는 12시가 0, 시계방향이 + 다. 좌표 변환은 아래 at() 하나뿐이고 이 파일
 * 밖에서 다시 정의하지 않는다.
 */
import { ROLE_ORDER, type Feature, type RelationRole } from "../_data/roles";

const deg = (d: number) => (d * Math.PI) / 180;

/** 구역 하나가 차지하는 각도. 다섯이 원을 채운다. */
export const SECTOR_SPAN = (2 * Math.PI) / 5;

/**
 * 그중 실제로 사람을 놓는 각도. 남는 16° 가 구역 사이 여백이다 —
 * 이 여백이 없으면 다섯 색이 경계에서 섞여 "어느 구역인가"가 흐려진다.
 */
export const SECTOR_USED = deg(56);

/**
 * 사람이 있는 칸이 보장받는 최소 **쓸 수 있는** 각도 폭. 한 명뿐인 칸도 자기
 * 자리를 갖는다.
 *
 * 배분되는 폭이 아니라 여백을 뺀 뒤의 폭이다 — 배치가 실제로 쓰는 값이
 * slot.half 이므로 하한도 거기 걸어야 뜻이 하나로 남는다. 그래서 배분할 때는
 * 칸마다 MIN_SLOT + 2·SLOT_MARGIN 을 먼저 떼어 둔다(세 칸이 다 차도 30° 라
 * SECTOR_USED 56° 안이다).
 */
export const MIN_SLOT = deg(8);

/** 슬롯 양끝에서 떼는 여백. 이웃 슬롯의 끝 사람과 붙지 않게 한다. */
export const SLOT_MARGIN = deg(1);

/** 한 칸이 소유하는 각도 구간. center 는 12시 기준 절대 각도가 아니라 구역 안 상대각이다. */
export type Slot = { readonly center: number; readonly half: number };

export type CellCounts = Record<RelationRole, Record<Feature, number>>;

/** 각도 순서. 사람이 가장 많은 기본이 구역 한가운데 오고 드문 둘이 양옆에 선다. */
const FEATURE_ORDER: readonly Feature[] = ["yukhap", "none", "chung"];

/** 구역 중심각. ROLE_ORDER 순서 그대로 12시부터 시계방향이다. */
export function sectorAngle(role: RelationRole): number {
  return SECTOR_SPAN * ROLE_ORDER.indexOf(role);
}

/**
 * 한 구역의 56° 를 세 칸에 나눈다.
 *
 * 사람이 있는 칸에 MIN_SLOT 을 먼저 주고, 남은 각도를 인원수 비례로 더한다.
 * 빈 칸은 0 이다 — 아무도 없는 칸이 자리를 차지하면 있는 칸이 그만큼 좁아진다.
 */
export function allocateSlots(
  counts: Record<Feature, number>,
): Record<Feature, Slot | null> {
  const live = FEATURE_ORDER.filter((f) => counts[f] > 0);
  const out = { yukhap: null, none: null, chung: null } as Record<Feature, Slot | null>;
  if (live.length === 0) return out;

  const total = live.reduce((sum, f) => sum + counts[f], 0);
  // 여백은 폭에서 깎이는 것이 아니라 미리 떼어 두는 것이다 — 그래야 남은
  // 폭(slot.half × 2)이 MIN_SLOT 아래로 내려가지 않는다.
  const floor = MIN_SLOT + 2 * SLOT_MARGIN;
  const extra = SECTOR_USED - floor * live.length;

  let cursor = -SECTOR_USED / 2;
  for (const f of FEATURE_ORDER) {
    if (counts[f] === 0) continue;
    const width = floor + extra * (counts[f] / total);
    out[f] = { center: cursor + width / 2, half: Math.max(0, width / 2 - SLOT_MARGIN) };
    cursor += width;
  }
  return out;
}

export type Vec3 = readonly [number, number, number];

/** 지도의 중심. 관계가 없으므로 슬롯도 링도 없다. */
export const SELF_POSITION: Vec3 = [0, 0, 0];

/** 각도·높이 → 좌표. 12시가 0, 시계방향이 +. 이 변환은 이 파일에만 있다. */
function at(r: number, a: number, z = 0): Vec3 {
  return [r * Math.sin(a), r * Math.cos(a), z];
}

/**
 * 가장 안쪽 링이 시작하는 반지름. 이 안쪽은 중심 "나" 오브의 자리다.
 * 단위는 임의다 — 화면에 맞추는 것은 카메라의 일이고(screenScale), 그래서
 * 사람이 늘어 지도가 커져도 이 파일은 아무것도 몰라도 된다.
 */
export const RING_START = 0.38;

/** 링과 링 사이 빈 구간. 여기가 좁으면 이웃 링의 점끼리 붙는다. */
export const RING_GAP = 0.1;

/** 한 칸 안에서 줄과 줄 사이 간격. */
export const ROW_PITCH = 0.13;

/** 같은 줄에서 사람과 사람 사이 최소 간격. 열 수를 정하는 것이 이 값이다. */
export const MIN_GAP = 0.17;

/**
 * 한 칸이 평면에서 쓸 수 있는 최대 줄 수. 그보다 더 필요하면 바깥이 아니라 위로 간다.
 *
 * 상한이 없으면 배치가 성립하지 않는다. 줄이 밖으로 늘어나면 지도 반지름이
 * 커지고, 카메라가 그 반지름을 화면에 맞추느라 배율이 같은 비율로 줄어 간격을
 * 벌리려는 시도가 상쇄된다 — 상수 5개를 5,040 조합으로 훑어도 모바일 375px 에서
 * 한 칸 40명은 19.7px 에서 멈췄다(이론 상한 ~20.4px). 층은 반지름을 늘리지
 * 않으므로 그 상쇄를 끊는다.
 *
 * 값은 **측정으로** 정한다: 현실적인 분포(시드 25명·한도 50명)에 층이 하나도
 * 생기지 않는 가장 작은 값이어야 한다. 층은 예외지 상시 동작이 아니다.
 *
 * 측정(buildLayout 출력을 직접 셌다): 시드 25명에서 가장 붐비는 칸은
 * fill/none 등 n=3 으로 2줄이면 끝난다. 한도 50명에서 가장 붐비는 칸은
 * fill/none·beside/none 으로 각 n=9, perRow=[2,2,3,2] — 정확히 4줄이
 * 필요하다. MAX_FLAT_ROWS=3 이면 이 9명 칸의 마지막 2명이 층 1 로 밀려나
 * "현실적인 분포는 층이 없어야 한다"는 요구를 어긴다. 4 는 두 픽스처 모두
 * 층 없이 통과하는 가장 작은 값이라 이걸로 고정했다. (반대로 LOPSIDED 의
 * beside/none=40 은 11줄이 필요해 4에서도 층 0/1/2 세 층으로 쌓인다 — 이건
 * 의도된 예외다.)
 */
export const MAX_FLAT_ROWS = 4;

/**
 * 층과 층 사이 높이.
 *
 * 기본 시점(바로 위에서 직교)에서는 투영에 영향이 없다 — 겹쳐 보이는 것이
 * "여기 사람이 겹칠 만큼 많다"는 신호고, 카메라를 기울이는 순간 갈라진다.
 * 겹침을 깊이로 말하는 것이 이 값의 일이다.
 */
export const LAYER_HEIGHT = 0.22;

export type CellLayout = {
  readonly slot: Slot;
  /** 줄별 반지름. 층이 여럿이면 같은 반지름이 층마다 다시 나온다. */
  readonly radii: readonly number[];
  /** 줄별 인원 */
  readonly perRow: readonly number[];
  /** 줄별 층 번호 (0 = 바닥) */
  readonly layerOf: readonly number[];
};

export type MapLayout = {
  readonly cells: Record<RelationRole, Record<Feature, CellLayout | null>>;
  /**
   * 사람이 실제로 놓인 가장 바깥 반지름. 카메라와 배지가 쓴다.
   *
   * 아무도 없는 링은 이 값에 반영되지 않는다 — 六合·沖 이 통째로 비어도
   * RING_GAP 만큼의 "유령 여백"이 여기 얹히면, 그 여백을 기준으로 줌을 잡는
   * Task 3 의 카메라가 사람 없는 구간까지 화면에 끌어안느라 정작 있는
   * 사람들을 더 작게 그린다. 아무도 없으면 RING_START — 중심 "나" 오브가
   * 끝나는 자리 — 를 바닥값으로 쓴다.
   */
  readonly outerRadius: number;
};

/** 한 줄에 몇 명까지 들어가는가. 호 길이를 최소 간격으로 나눈 값이다. */
function colsAt(radius: number, half: number): number {
  const arc = 2 * half * radius;
  return Math.max(1, Math.floor(arc / MIN_GAP) + 1);
}

/**
 * n 명을 줄로 나눈다. 안쪽 줄부터 채우고, 평면 줄이 MAX_FLAT_ROWS 를 넘으면
 * 바깥이 아니라 위로 — 다음 층의 첫 줄(다시 startRadius)로 돌아간다.
 */
function rowsFor(n: number, startRadius: number, half: number) {
  const radii: number[] = [];
  const perRow: number[] = [];
  const layerOf: number[] = [];
  let left = n;
  let row = 0;
  let layer = 0;
  while (left > 0) {
    // 평면 줄을 다 쓰면 바깥이 아니라 위로 간다 — 반지름은 여기서 멈춘다.
    if (row === MAX_FLAT_ROWS) {
      row = 0;
      layer += 1;
    }
    const radius = startRadius + row * ROW_PITCH;
    const take = Math.min(colsAt(radius, half), left);
    radii.push(radius);
    perRow.push(take);
    layerOf.push(layer);
    left -= take;
    row += 1;
  }
  return { radii, perRow, layerOf };
}

/**
 * 지도 전체의 자리를 정한다.
 *
 * 링은 안에서 바깥으로 한 번에 흐른다: 六合 링이 필요한 줄 수만큼 두께를
 * 차지하고, 그 바깥에 기본 링이, 다시 그 바깥에 沖 링이 선다. 링의 두께는
 * 그 링에서 가장 붐비는 구역이 정한다 — 다섯 구역이 같은 원을 공유해야
 * "안쪽이 六合" 이라는 규칙이 화면에서 읽히기 때문이다.
 *
 * 반복도 수렴도 없다. 각 링의 시작 반지름이 그 링을 계산하기 전에 이미
 * 정해져 있어서, 줄 수를 구하는 데 필요한 호 길이를 그 자리에서 알 수 있다.
 */
export function buildLayout(counts: CellCounts): MapLayout {
  const cells = {} as Record<RelationRole, Record<Feature, CellLayout | null>>;
  const slots = {} as Record<RelationRole, Record<Feature, Slot | null>>;
  for (const role of ROLE_ORDER) slots[role] = allocateSlots(counts[role]);
  for (const role of ROLE_ORDER) cells[role] = { none: null, yukhap: null, chung: null };

  let ringStart = RING_START;
  // 아무도 없을 때의 바닥값 — 위 MapLayout.outerRadius 주석 참고.
  let outerRadius = RING_START;

  for (const feature of FEATURE_ORDER) {
    let thickest = ringStart;
    let ringEmpty = true;
    for (const role of ROLE_ORDER) {
      const n = counts[role][feature];
      const slot = slots[role][feature];
      if (n === 0 || !slot) continue;
      const { radii, perRow, layerOf } = rowsFor(n, ringStart, slot.half);
      cells[role][feature] = { slot, radii, perRow, layerOf };
      // 층이 있으면 마지막 줄이 다음 층의 첫 줄(가장 안쪽 반지름)일 수 있다 —
      // radii[radii.length - 1] 이 아니라 실제 최댓값을 써야 한다.
      thickest = Math.max(thickest, ...radii);
      ringEmpty = false;
    }
    // 다섯 구역 모두에 이 feature 가 없으면 이 링 자체가 없는 것이다 —
    // thickest/ringStart 를 밀지 않고 다음 feature 가 이 자리를 그대로 쓰게
    // 둔다. 그렇지 않으면 六合이 통째로 빈 지도에서도 기본 링이 RING_GAP 만큼
    // 밖으로 밀려나고, 그 빈 여백이 outerRadius 에 새어 들어간다.
    if (ringEmpty) continue;
    outerRadius = Math.max(outerRadius, thickest);
    ringStart = thickest + RING_GAP;
  }

  return { cells, outerRadius };
}

export type Placeable = {
  readonly id: string;
  readonly role: RelationRole;
  readonly feature: Feature;
};

/**
 * 사람 → 좌표.
 *
 * 한 줄 안에서는 그 칸의 열 간격(호 길이 ÷ (열 수 − 1))을 그대로 쓰고,
 * 슬롯 중심을 기준으로 좌우 대칭이 되게 놓는다. 줄마다 인원이 달라도 같은
 * 간격을 쓰므로 격자가 어긋나 보이지 않고, 인원이 열 수보다 적으면 자연히
 * 가운데로 모인다.
 */
export function placePeople(people: readonly Placeable[]): Map<string, Vec3> {
  const counts = {} as CellCounts;
  for (const role of ROLE_ORDER) counts[role] = { none: 0, yukhap: 0, chung: 0 };
  for (const p of people) counts[p.role][p.feature] += 1;

  const layout = buildLayout(counts);
  const queue = new Map<string, string[]>();
  for (const p of people) {
    const key = `${p.role}/${p.feature}`;
    const ids = queue.get(key);
    if (ids) ids.push(p.id);
    else queue.set(key, [p.id]);
  }

  const out = new Map<string, Vec3>();
  for (const [key, ids] of queue) {
    const [role, feature] = key.split("/") as [RelationRole, Feature];
    const cell = layout.cells[role][feature]!;
    const base = sectorAngle(role) + cell.slot.center;

    let cursor = 0;
    cell.radii.forEach((radius, row) => {
      const inRow = cell.perRow[row];
      const z = cell.layerOf[row] * LAYER_HEIGHT;
      const cols = colsAt(radius, cell.slot.half);
      // 열 간격은 슬롯 폭을 (열 수 − 1)로 나눈 각도다. 한 열뿐이면 간격이 없다.
      const step = cols > 1 ? (2 * cell.slot.half) / (cols - 1) : 0;
      for (let i = 0; i < inRow; i += 1) {
        const offset = (i - (inRow - 1) / 2) * step;
        out.set(ids[cursor], at(radius, base + offset, z));
        cursor += 1;
      }
    });
  }

  return out;
}
