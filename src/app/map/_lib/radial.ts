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
 *
 * 0.218 → 0.475 로 다시 올렸다. 이전 0.218 은 "오브는 26px 정도만 있으면
 * 된다"고 적었는데, 그 26px 는 오브의 반지름이지 실제로 필요한 여유가
 * 아니었다 — 점 자신의 반지름(NODE_PX/2)과 눈에 보이는 틈까지 더해야
 * 오브가 안쪽 점을 가리지 않는다(아래 SELF_PX·radial.test.ts 의 "나 오브와
 * 점 사이" 테스트 참고).
 *
 * 0.475 → 0.583 으로 다시 올렸다(MapShell.tsx 를 함께 고친 다음 재측정).
 * 0.475 는 모바일 지도 영역이 284px 밖에 없던 시절 값이다 — 사람 목록 판이
 * 화면의 58%(max-h-[58vh])를 먼저 가져가고 지도가 나머지를 받는 구조라,
 * 375×812 폰에서 지도가 실제로 받는 높이는 284px 였다. 그 높이에서는
 * 배율이 극히 작아(screenScale 이 높이로 막힌다) 다섯 상수를 아무리 조합해도
 * NO_OVERLAP_PX·COMFORT_NODE_PX 를 못 채웠다(radial.test.ts 의 옛 실패 5건).
 * MapShell.tsx 를 고쳐 지도가 최소 420px 를 보장받게 되자(그 아래 사이드
 * 패널 주석 참고 — 375px 폭에서는 420px 부터 배율이 폭으로 막혀 더 늘려도
 * 소용없다) 병목이 "높이 부족"에서 "폭 부족(배지가 3/9시 방향에서 가로로
 * 걸린다)"으로 바뀌었다. 이 새 병목 아래에서 다섯 상수를 다시 훑으면(좌표
 * 하강 + 무작위 재시작, 375×420·700×500 양쪽에서 self-clearance·배지 겹침·
 * 뷰포트 밖 나감을 전부 확인) 0.583 은 여섯 케이스 전부에서
 * SELF_CLEARANCE_PX·배지 겹침 0 을 지키면서 점-점 간격을 가장 넓게 남기는
 * 값이다.
 *
 * 375×420·한도 50명(FULL)의 가장 가까운 점 쌍은 18.72px 다 — 284px 시절의
 * 14.71px 과 비교하면 크게 늘었지만, 375px 라는 폭 자체가 남은 병목이다:
 * 모바일 높이를 더 올려도(700까지 실측) 배율이 그대로다(아래 RING_GAP 주석
 * 참고), 즉 폭이 다 찼다. 다섯 상수를 넓게(좌표 하강 + 수백 회 무작위
 * 재시작, FULL 의 375×420 점-점 간격만을 목적함수로 삼아도) 흔들어도
 * 18.7~18.9px 부근에서 멈췄다 — 이 폭에서 50명을 담는 이 배치 자체의
 * 구조적 상한으로 보인다. radial.test.ts 의 NO_OVERLAP_PX(점 지름 15px +
 * 눈에 보이는 틈 2px = 17px, 점이 원이라 중심 거리 하나로 정확히 재는 값)를
 * 18.72px 는 채운다 — 이 상한과 문턱 사이에 남은 여유는 1.72px 뿐이라, 다섯
 * 상수를 더 조이는 방향의 변경은 이 여유부터 갉아먹는다는 뜻이다.
 */
export const RING_START = 0.583;

/**
 * 링과 링 사이 빈 구간. 여기가 좁으면 이웃 링의 점끼리 붙는다.
 *
 * 0.157 → 0.205 로 다시 올렸다 — RING_START 주석에 적은 대로 모바일 지도
 * 영역이 284px 에서 420px 로 늘어나며 다섯 상수를 다시 훑은 결과다(375×420·
 * 700×500 양쪽 검증). 375×420 에서 이 높이를 더 올려도(700까지 실측) 배율이
 * 그대로다 — 폭(375px)이 이미 배율을 막고 있어, 이 값이 더 커져도 화면상
 * 간격이 늘지 않는다(RING_START 주석의 ⚠️ 참고).
 */
export const RING_GAP = 0.205;

/**
 * 한 칸 안에서 줄과 줄 사이 간격.
 *
 * 0.163 → 0.245 로 다시 올렸다 — 같은 재측정(위 RING_START·RING_GAP 주석
 * 참고). MAX_FLAT_ROWS=3 인 채로도 시드 25명·한도 50명 다 층 없이 끝난다
 * (가장 붐비는 칸은 한도 50명의 fill/none, n=9, perRow=[2,3,4] — 아래
 * MAX_FLAT_ROWS 주석 참고).
 */
export const ROW_PITCH = 0.245;

/**
 * 같은 줄에서 사람과 사람 사이 최소 간격. 열 수를 정하는 것이 이 값이다.
 *
 * 0.163 → 0.216 으로 다시 올렸다 — 같은 재측정. 열 수가 준 만큼 줄이 늘 수
 * 있는데, 위 ROW_PITCH·아래 MAX_FLAT_ROWS 주석대로 실제 분포(시드 25명·
 * 한도 50명)는 여전히 3줄 안에서 끝난다.
 */
export const MIN_GAP = 0.216;

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
 * 모바일 지도 영역이 284px → 420px 로 늘어나며(RING_START 주석 참고)
 * RING_START·RING_GAP·ROW_PITCH·MIN_GAP 을 다시 훑었지만, 재측정
 * (buildLayout 출력을 직접 셌다) 결과 3은 그대로 맞는 값이다: 시드 25명에서
 * 가장 붐비는 칸은 beside/none n=4 로 2줄(perRow=[2,2]). 한도 50명에서
 * 가장 붐비는 칸은 fill/none n=9, perRow=[2,3,4] — 정확히 3줄이 필요하다.
 * MAX_FLAT_ROWS=2 면 이 칸의 마지막 4명이 층 1 로 밀려나 "현실적인 분포는
 * 층이 없어야 한다"는 요구를 어긴다. (LOPSIDED 의 beside/none=40 은 이
 * 값과 무관하게 여러 층으로 쌓인다 — 의도된 예외.)
 */
export const MAX_FLAT_ROWS = 3;

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

/**
 * 배지의 실제 렌더 크기(px). screenScale 이 이 상자가 화면 밖으로 안 나가는
 * 배율을 계산하는 데 쓴다. **RegionLabels.tsx 가 그리는 배지 마크업이 이 값과
 * 같아야 한다** — 여기서 좁히고 거기서 안 좁히면 이 파일의 계산은 거짓이 된다.
 *
 * 폭 52 는 **추정이 아니라 고정값**이다. RegionLabels.tsx 가 배지에
 * w-[52px] 를 박아 그리므로 이 상자와 화면이 정의상 같다 — 글자 수로 폭을
 * 어림하면 그 어림이 틀렸을 때 테스트만 초록이 된다(실제로 56 으로 어림했다가
 * 진짜 배지가 73px 인 것을 뒤늦게 쟀다).
 *
 * 높이 15 는 **측정값**이다 — 이전 값 22 는 "패딩 2px×2 + 글자 9px + 테두리"를
 * 눈대중으로 더한 추정이었지 실제 DOM 을 잰 것이 아니었다. 실제 배지
 * (RegionLabels.tsx 의 마크업)를 getBoundingClientRect 로 재면 15px 다 — 폭과
 * 달리 높이는 못 박은 값이 없어 padding·line-height·border 가 실제로 얼마를
 * 차지하는지는 재기 전까진 몰랐다. 22 는 실제보다 큰 쪽으로 틀렸으니 그동안
 * 겹침 불변식을 어기진 않았지만(더 넓게 잡아 더 엄격하게 막았을 뿐), "이 값과
 * 화면이 같아야 한다"는 위 주석의 약속 자체는 거짓이었다.
 *
 * 52 인 이유는 물리적 상한이다: 15칸이 다 찬 지도에서 이웃 배지 중심 사이의
 * 화면 거리가 모바일 375×420 에서 **55.42px** 밖에 안 된다(측정 — MapShell.tsx
 * 를 고쳐 지도 영역이 420px 를 보장받은 뒤 다시 쟀다. 284px 시절엔 46.13px
 * 였다). 배지 15개가 원 둘레를 나눠 갖는 구조라 상수로는 크게 못 늘린다 —
 * 반지름을 키우면 배율이 그만큼 줄어 제자리다. 그래서 배지가 그 안에
 * 들어가야 하고, 별명을 3자 이내로 줄인 것도 그래서다(DISPLAY_TITLES).
 */
export const BADGE_PX = { width: 52, height: 15 } as const;

/**
 * 점의 실제 렌더 크기(px). PersonMarker.tsx 의 마크업(지름 15px 원 + 2px
 * 흰 테두리)을 getBoundingClientRect 로 직접 재면 15×15 다 — border-2 가
 * box-sizing: border-box(Tailwind preflight) 아래서 바깥으로 더해지지 않고
 * 안으로 파고들기 때문이다. 예전 17×17 은 "지름 + 테두리를 더한" 추정값이지
 * 측정값이 아니었다.
 */
export const NODE_PX = { width: 15, height: 15 } as const;

/**
 * 중심 "나" 오브의 실제 렌더 지름(px). **SelfCore.tsx 는 이 값과 정확히 같은
 * 크기로 그려야 한다** — BADGE_PX·NODE_PX 와 같은 계약이다. SelfCore.tsx 의
 * h-[52px] w-[52px] 원과 같은 값(52)이고, 이 반지름(26px) 이 RING_START 가
 * 안쪽 점을 가리지 않기 위해 넘어야 하는 문턱의 절반이다(radial.test.ts 의
 * "나 오브와 점 사이" 테스트 참고).
 */
export const SELF_PX = 52;

/**
 * 사람이 놓인 가장 바깥에서 배지 원까지의 거리.
 *
 * 0.375 → **0.396** 으로 다시 올렸다. 지난 값 0.375 는 모바일 지도 영역이
 * 284px 로 극히 좁던 시절, 반지름 예산을 어떻게 나눠도 점-점 간격
 * (NO_OVERLAP_PX·COMFORT_NODE_PX)과 fill 구역(12시) 배지 세 개의 가로 간격을
 * 동시에 못 채우던 상태에서 그나마 배지-점 겹침만은 0으로 지킨 값이었다.
 *
 * MapShell.tsx 를 고쳐 지도 영역이 420px 를 보장받자(사이드 패널 주석 참고)
 * 다섯 상수를 그 새 바닥 위에서 다시 훑었다(좌표 하강 + 무작위 재시작
 * 수백 회, 375×420·700×500 양쪽에서 여섯 케이스 전부 검증 — RING_START
 * 주석에 적은 대로 이 값이 이제 순수 배지-배지·배지-점 겹침 회피에
 * 붙는다). 0.396 은 두 겹침이 여섯 케이스 전부 0(실측)이면서, RING_START·
 * RING_GAP·ROW_PITCH·MIN_GAP 이 점-점 간격에 남길 수 있는 예산이 가장 큰
 * 값이다. 沖 배지(늘 n=1이라 자기 칸의 유일한 사람과 각도가 같아 거리가 이
 * 값 하나뿐이다)도 안전하게 떨어져 있다.
 */
export const BADGE_MARGIN = 0.396;

/**
 * 배지가 설 자리. 사람이 없는 칸은 null 이다.
 *
 * **모든 배지가 지도 바깥 같은 원 위에 선다.** 각도는 그 칸의 슬롯이라 배지는
 * 여전히 자기 칸을 가리키지만, 반지름은 칸마다 다르지 않다.
 *
 * 칸마다 "자기 줄 바로 바깥" 에 두는 편이 더 가까워 보이고 실제로 그렇게 짰다가
 * 되돌렸다. 그것은 성립하지 않는다 — 六合 링은 가장 안쪽이라 그 배지를 바깥으로
 * 밀면 기본 링의 영역 한가운데에 떨어지고, 두 슬롯은 SLOT_MARGIN(1°) 만 두고
 * 붙어 있어 기본 칸 가장자리의 사람과 겹친다(실측: 모바일 375px · 한도 50명에서
 * 6.6px 침범). 어떤 상수를 만져도 안 풀린다 — 간격을 벌리는 모든 조정이
 * layoutExtent 를 같이 키워 배율로 상쇄되기 때문이다.
 *
 * 바깥 원은 그 충돌을 구조적으로 없앤다: 사람은 전부 outerRadius 안쪽이고 배지는
 * 전부 그 바깥이라, 배지와 점이 겹칠 방법 자체가 없다. 남는 것은 배지끼리인데
 * 그것은 각도로 갈린다.
 */
export function badgeAnchor(
  layout: MapLayout,
  role: RelationRole,
  feature: Feature,
): Vec3 | null {
  const cell = layout.cells[role][feature];
  if (!cell) return null;
  return at(layout.outerRadius + BADGE_MARGIN, sectorAngle(role) + cell.slot.center);
}

/** 배지까지 포함한 지도의 반지름. 카메라가 이 값을 화면에 맞춘다. */
export function layoutExtent(layout: MapLayout): number {
  return layout.outerRadius + BADGE_MARGIN;
}

/**
 * 월드 1 단위당 화면 픽셀. 기본 시점 직교 카메라의 zoom 이 곧 이 값이다.
 *
 * 점 반지름만 맞추면 배지가 잘린다 — 배지는 월드가 아니라 화면에서 크기가
 * 고정된 상자라, 원반의 동/서/남/북 끝에 선 배지는 상자의 절반이 밖으로
 * 나간다(실측: 모바일에서 최대 27.9px). 그래서 상자의 귀가 전부 화면 안에
 * 들어오는 배율 중 가장 작은 것을 고른다 — 뷰포트에서 상자 절반을 미리
 * 빼는 일률적인 여백이 아니라, 배지마다 실제 각도에서 필요한 배율을 각각
 * 계산해 그 최솟값을 쓴다(일률적 여백보다 항상 같거나 더 큰 배율이 나온다).
 */
export function screenScale(width: number, height: number, layout: MapLayout): number {
  const fit = (half: number, halfBox: number, offset: number) =>
    offset === 0 ? Infinity : (half - halfBox) / Math.abs(offset);

  let scale = Math.min(width, height) / (2 * layoutExtent(layout));
  scale = Math.min(
    scale,
    fit(width / 2, NODE_PX.width / 2, layout.outerRadius),
    fit(height / 2, NODE_PX.height / 2, layout.outerRadius),
  );
  for (const role of ROLE_ORDER)
    for (const feature of FEATURE_ORDER) {
      const b = badgeAnchor(layout, role, feature);
      if (!b) continue;
      scale = Math.min(
        scale,
        fit(width / 2, BADGE_PX.width / 2, b[0]),
        fit(height / 2, BADGE_PX.height / 2, b[1]),
      );
    }
  return scale;
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
