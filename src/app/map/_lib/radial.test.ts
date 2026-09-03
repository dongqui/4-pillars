import { describe, expect, it } from "vitest";
import { ROLE_ORDER, type Feature } from "../_data/roles";
import {
  allocateSlots,
  sectorAngle,
  MIN_SLOT,
  SECTOR_SPAN,
  SECTOR_USED,
} from "./radial";

const FEATURES: Feature[] = ["yukhap", "none", "chung"];

describe("섹터", () => {
  it("다섯 구역이 12시부터 시계방향으로 72°씩 선다", () => {
    ROLE_ORDER.forEach((role, i) => {
      expect(sectorAngle(role)).toBeCloseTo(SECTOR_SPAN * i, 9);
    });
    expect(SECTOR_SPAN).toBeCloseTo((2 * Math.PI) / 5, 9);
  });

  it("한 구역이 쓰는 각도는 72°보다 작다 — 남는 각도가 구역 사이 여백이다", () => {
    expect(SECTOR_USED).toBeLessThan(SECTOR_SPAN);
  });
});

describe("슬롯 배분", () => {
  it("빈 칸에는 슬롯을 주지 않는다", () => {
    const slots = allocateSlots({ yukhap: 0, none: 3, chung: 0 });
    expect(slots.yukhap).toBeNull();
    expect(slots.chung).toBeNull();
    expect(slots.none).not.toBeNull();
  });

  it("사람이 아무도 없으면 셋 다 없다", () => {
    const slots = allocateSlots({ yukhap: 0, none: 0, chung: 0 });
    expect(FEATURES.every((f) => slots[f] === null)).toBe(true);
  });

  it("사람이 많은 칸이 더 넓다", () => {
    const slots = allocateSlots({ yukhap: 1, none: 20, chung: 1 });
    expect(slots.none!.half).toBeGreaterThan(slots.yukhap!.half);
  });

  /**
   * 칸 수(1개/2개/3개)와 무관하게 항상 성립해야 하는 세 불변식.
   *
   * 六合·沖 은 지지 조합상 한 칸이 통째로 비는 경우가 흔하다 — 기본만 찬
   * 구역, 기본+沖 만 찬 구역이 3칸 다 찬 구역보다 오히려 더 자주 나온다.
   * 그런데도 기존 테스트는 3칸이 다 찬 분포(`{2,5,3}`, `{1,20,1}`)만 돌았다
   * — allocateSlots 자체는 칸 수로 분기하지 않으니 실은 안전하지만, 1칸·2칸
   * 짜리가 어딘가 깨져도 못 잡는 구멍이었다. 세 불변식을 헬퍼로 뽑아 분포별로
   * 돌리면 그 구멍이 막히고, 케이스를 늘려도 assert 가 셋 중 하나씩 어긋나는
   * 사고(복붙하다 한 줄 빠뜨리는 것)가 안 생긴다.
   *
   *  1. 차 있는 칸은 최소 쓸 수 있는 폭(MIN_SLOT)을 보장받는다.
   *  2. 모든 슬롯은 구역이 쓰는 각도(±SECTOR_USED/2) 안에 있다.
   *  3. 슬롯끼리 겹치지 않고, 그 순서가 항상 六合 → 기본 → 沖 이다.
   */
  function assertSlotInvariants(counts: Record<Feature, number>) {
    const slots = allocateSlots(counts);
    const live = FEATURES.map((f) => slots[f]!).filter(Boolean);

    for (const s of live) {
      expect(s.half * 2).toBeGreaterThanOrEqual(MIN_SLOT - 2 * 1e-9);
      expect(s.center - s.half).toBeGreaterThanOrEqual(-SECTOR_USED / 2 - 1e-9);
      expect(s.center + s.half).toBeLessThanOrEqual(SECTOR_USED / 2 + 1e-9);
    }
    for (let i = 1; i < live.length; i += 1) {
      expect(live[i].center - live[i].half).toBeGreaterThan(
        live[i - 1].center + live[i - 1].half,
      );
    }
  }

  const DISTRIBUTIONS: Array<[string, Record<Feature, number>]> = [
    ["3칸 다 참 — 고르게", { yukhap: 2, none: 5, chung: 3 }],
    ["3칸 다 참 — 기본 쪽으로 쏠림", { yukhap: 1, none: 20, chung: 1 }],
    ["1칸만 참 — 기본만", { yukhap: 0, none: 5, chung: 0 }],
    ["2칸만 참 — 기본 + 沖", { yukhap: 0, none: 5, chung: 2 }],
    ["2칸만 참 — 六合 + 기본", { yukhap: 3, none: 5, chung: 0 }],
  ];

  it.each(DISTRIBUTIONS)("%s: 불변식을 지킨다", (_label, counts) => {
    assertSlotInvariants(counts);
  });
});

import {
  buildLayout,
  placePeople,
  LAYER_HEIGHT,
  MAX_FLAT_ROWS,
  RING_START,
  ROW_PITCH,
  SELF_POSITION,
  type CellCounts,
  type Placeable,
} from "./radial";
import { ROLE_ORDER as ROLES, type RelationRole } from "../_data/roles";

/** 칸별 인원표를 만든다. 안 적은 칸은 0 이다. */
function counts(spec: Partial<Record<string, number>>): CellCounts {
  const out = {} as CellCounts;
  for (const role of ROLES) {
    out[role] = { none: 0, yukhap: 0, chung: 0 };
    for (const f of FEATURES) out[role][f] = spec[`${role}/${f}`] ?? 0;
  }
  return out;
}

/** 인원표를 사람 배열로 편다. id 는 `${role}/${feature}#${i}`. */
function peopleOf(c: CellCounts): Placeable[] {
  const out: Placeable[] = [];
  for (const role of ROLES)
    for (const f of FEATURES)
      for (let i = 0; i < c[role][f]; i += 1)
        out.push({ id: `${role}/${f}#${i}`, role, feature: f });
  return out;
}

/** 시드 스크립트가 넣은 25명과 같은 분포. */
const SEEDED = counts({
  "fill/none": 3, "fill/yukhap": 1, "fill/chung": 1,
  "beside/none": 4, "beside/yukhap": 1, "beside/chung": 1,
  "express/none": 3, "express/yukhap": 1, "express/chung": 1,
  "move/none": 3, "move/yukhap": 1, "move/chung": 1,
  "refine/none": 2, "refine/yukhap": 1, "refine/chung": 1,
});

/** 한도 50명. 六合·沖 은 지지 12개 중 하나씩이라 실제로도 드물다. */
const FULL = counts({
  "fill/none": 9, "fill/yukhap": 1, "fill/chung": 1,
  "beside/none": 9, "beside/yukhap": 1, "beside/chung": 1,
  "express/none": 8, "express/yukhap": 1, "express/chung": 1,
  "move/none": 7, "move/yukhap": 1, "move/chung": 1,
  "refine/none": 7, "refine/yukhap": 1, "refine/chung": 1,
});

/** 한 칸에 몰린 최악. 배치가 무너지는지 보는 것이지 실제 분포는 아니다. */
const LOPSIDED = counts({ "beside/none": 40, "fill/none": 10 });

/** 아무도 없는 지도. LOPSIDED 와 함께 outerRadius 의 바닥/누수를 잡는다. */
const EMPTY = counts({});

const CASES: [string, CellCounts][] = [
  ["시드 25명", SEEDED],
  ["한도 50명", FULL],
  ["한쪽에 몰린 50명", LOPSIDED],
];

describe("링과 격자", () => {
  it.each(CASES)("%s — 인원이 그대로 배치된다", (_name, c) => {
    const people = peopleOf(c);
    const placed = placePeople(people);
    expect(placed.size).toBe(people.length);
    expect(new Set(placed.keys())).toEqual(new Set(people.map((p) => p.id)));
  });

  it.each(CASES)("%s — 링 순서가 六合 < 기본 < 沖 이다", (_name, c) => {
    const layout = buildLayout(c);
    for (const role of ROLES) {
      const cell = layout.cells[role];
      const mid = (f: Feature) => {
        const l = cell[f];
        if (!l) return null;
        return l.radii.reduce((a, b) => a + b, 0) / l.radii.length;
      };
      const [y, n, ch] = [mid("yukhap"), mid("none"), mid("chung")];
      if (y !== null && n !== null) expect(y).toBeLessThan(n);
      if (n !== null && ch !== null) expect(n).toBeLessThan(ch);
    }
  });

  it.each(CASES)("%s — 누구도 자기 칸의 상자 밖으로 나가지 않는다", (_name, c) => {
    const layout = buildLayout(c);
    const placed = placePeople(peopleOf(c));
    for (const [id, p] of placed) {
      const [role, rest] = id.split("/") as [RelationRole, string];
      const feature = rest.split("#")[0] as Feature;
      const cell = layout.cells[role][feature]!;
      const r = Math.hypot(p[0], p[1]);
      // 각도: 12시 기준 시계방향
      const a = Math.atan2(p[0], p[1]);
      const rel = normalize(a - sectorAngle(role));
      expect(Math.abs(rel - cell.slot.center)).toBeLessThanOrEqual(cell.slot.half + 1e-9);
      expect(r).toBeGreaterThanOrEqual(Math.min(...cell.radii) - 1e-9);
      expect(r).toBeLessThanOrEqual(Math.max(...cell.radii) + 1e-9);
      expect(p[2]).toBeCloseTo(Math.round(p[2] / LAYER_HEIGHT) * LAYER_HEIGHT, 9);
      expect(p[2]).toBeGreaterThanOrEqual(0);
    }
  });

  it("같은 명단이면 같은 좌표다", () => {
    const people = peopleOf(SEEDED);
    const a = placePeople(people);
    const b = placePeople(people);
    for (const [id, p] of a) expect(b.get(id)).toEqual(p);
  });

  it("다섯 구역은 원점에서 등거리다 — 어떤 역할도 더 가깝지 않다", () => {
    const layout = buildLayout(counts(
      Object.fromEntries(ROLES.map((r) => [`${r}/none`, 3])),
    ));
    const radii = ROLES.map((r) => layout.cells[r].none!.radii[0]);
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 9);
  });

  it("나는 원점이다", () => {
    expect(SELF_POSITION).toEqual([0, 0, 0]);
  });
});

/**
 * 링 중 하나(혹은 전부)가 통째로 비었을 때 outerRadius 와 링 시작점이
 * 어떻게 움직여야 하는지를 잠근다.
 *
 * buildLayout 은 각 feature 를 순서대로 훑으며 ringStart 를 다음 링에
 * 넘긴다 — 그런데 다섯 구역 모두에 그 feature 가 없으면 "링 자체가 없는"
 * 것이라, 넘길 두께가 없다. 이걸 놓치면 빈 링도 RING_GAP 만큼 다음 링을
 * 밖으로 밀어내고, 그 유령 여백이 outerRadius 에 쌓인다 — 카메라가 그
 * 여백까지 화면에 끌어안느라 정작 있는 사람들이 작아진다.
 */
describe("빈 링과 outerRadius", () => {
  /** 실제로 배치된 사람들 중 가장 바깥 반지름. layout.outerRadius 와 별개 경로로 구해 비교한다. */
  function maxPlacedRadius(c: CellCounts): number | null {
    const layout = buildLayout(c);
    let max: number | null = null;
    for (const role of ROLES) {
      for (const f of FEATURES) {
        const cell = layout.cells[role][f];
        if (!cell) continue;
        // 층이 있으면 마지막 줄이 다음 층의 첫 줄(가장 안쪽 반지름)일 수 있다 —
        // radii 배열의 마지막 원소가 아니라 실제 최댓값을 써야 한다. buildLayout
        // 이 thickest 를 구할 때 겪는 것과 같은 함정이다.
        const furthest = Math.max(...cell.radii);
        max = max === null ? furthest : Math.max(max, furthest);
      }
    }
    return max;
  }

  it.each(CASES)("%s — outerRadius 는 실제로 놓인 사람의 최대 반지름과 정확히 같다", (_name, c) => {
    const layout = buildLayout(c);
    const max = maxPlacedRadius(c);
    expect(max).not.toBeNull();
    expect(layout.outerRadius).toBe(max);
  });

  it("아무도 없으면 outerRadius 는 RING_START 다 — 중심 오브가 끝나는 자리가 바닥값이다", () => {
    const layout = buildLayout(EMPTY);
    expect(layout.outerRadius).toBe(RING_START);
    expect(maxPlacedRadius(EMPTY)).toBeNull();
    expect(placePeople(peopleOf(EMPTY)).size).toBe(0);
  });

  it("맨 앞 링(六合)이 다섯 구역 모두 비면 기본 링은 밀려나지 않고 RING_START 에서 시작한다", () => {
    // LOPSIDED 는 六合·沖 이 다섯 구역 모두 비어 있고 기본만 찼다.
    const layout = buildLayout(LOPSIDED);
    let checked = 0;
    for (const role of ROLES) {
      const cell = layout.cells[role].none;
      if (!cell) continue;
      expect(cell.radii[0]).toBe(RING_START);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("가운데 기본 링이 다섯 구역 모두 비어도 六合 < 沖 순서는 유지된다", () => {
    const c = counts({ "fill/yukhap": 2, "fill/chung": 2 });
    const layout = buildLayout(c);
    const y = layout.cells.fill.yukhap!;
    const ch = layout.cells.fill.chung!;
    expect(Math.max(...y.radii)).toBeLessThan(Math.min(...ch.radii));
  });
});

describe("넘치는 줄은 위로", () => {
  it.each([["시드 25명", SEEDED], ["한도 50명", FULL]] as [string, CellCounts][])(
    "%s — 층이 하나도 생기지 않는다",
    (_name, c) => {
      for (const p of placePeople(peopleOf(c)).values()) expect(p[2]).toBe(0);
    },
  );

  it("한 칸에 몰리면 층이 생긴다", () => {
    const zs = [...placePeople(peopleOf(LOPSIDED)).values()].map((p) => p[2]);
    expect(Math.max(...zs)).toBeGreaterThan(0);
  });

  it("층은 0 부터 빠짐없이 이어지고 높이는 LAYER_HEIGHT 의 배수다", () => {
    const zs = [...placePeople(peopleOf(LOPSIDED)).values()].map((p) => p[2]);
    const layers = [...new Set(zs.map((z) => Math.round(z / LAYER_HEIGHT)))].sort(
      (a, b) => a - b,
    );
    layers.forEach((l, i) => expect(l).toBe(i));
    for (const z of zs) expect(z).toBeCloseTo(Math.round(z / LAYER_HEIGHT) * LAYER_HEIGHT, 9);
  });

  it("한 층이 쓰는 평면 줄 수는 MAX_FLAT_ROWS 를 넘지 않는다", () => {
    const layout = buildLayout(LOPSIDED);
    for (const role of ROLES)
      for (const f of FEATURES) {
        const cell = layout.cells[role][f];
        if (!cell) continue;
        const perLayer = new Map<number, number>();
        for (const l of cell.layerOf) perLayer.set(l, (perLayer.get(l) ?? 0) + 1);
        for (const rows of perLayer.values()) expect(rows).toBeLessThanOrEqual(MAX_FLAT_ROWS);
      }
  });

  it("층이 아무리 쌓여도 반지름은 상한을 넘지 않는다", () => {
    // LOPSIDED 는 기본 링에만 사람이 있다 — 링 하나가 쓸 수 있는 최대 두께가 곧 상한이다.
    expect(buildLayout(LOPSIDED).outerRadius).toBeLessThanOrEqual(
      RING_START + (MAX_FLAT_ROWS - 1) * ROW_PITCH + 1e-9,
    );
  });
});

/** −π..π 로 접는다. */
function normalize(a: number): number {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x < -Math.PI) x += 2 * Math.PI;
  return x;
}

import { badgeAnchor, screenScale, BADGE_PX, NODE_PX, SELF_PX, type Vec3 } from "./radial";

/**
 * 실측 화면 두 벌. 데스크톱은 400px 사이드 패널을 뺀 지도 영역이다.
 *
 * 모바일은 375×420 이다. 한때 375×284 였다 — 사람 목록 판이
 * max-h-[58vh](뷰포트의 58%)를 먼저 가져가고 지도는 그 나머지였는데, 375×812
 * 폰에서 헤더(57px, h-14+테두리)를 뺀 755px 중 목록이 470.96px 를 가져가면
 * 지도에는 284.05px 만 남았다(실측: 25명·50명 둘 다 이 상한을 채운다). 그
 * 284px 에서는 다섯 레이아웃 상수를 아무리 조합해도 아래 NO_OVERLAP_PX·
 * COMFORT_NODE_PX 를 못 채웠다 — 그래서 이 파일에 5건의 "정직한 빨간불"이
 * 있었다(radial.ts 의 RING_START 주석 참고).
 *
 * MapShell.tsx 를 고쳐 순서를 뒤집었다: 지도가 먼저 최소 420px 를 갖고,
 * 목록이 남는 만큼(헤더까지 뺀 나머지)을 갖는다. 420 은 375px 폭에서 그
 * 이상 높이를 줘도 screenScale 이 더는 늘지 않는 값이다(폭이 먼저 막힌다 —
 * 실측: 375×420 과 375×700 이 같은 배율). getBoundingClientRect 로 실제
 * MapShell 을 재도 지도 영역이 정확히 420px 다(사람 목록이 기본 펼쳐진 상태,
 * 25명·50명 둘 다 동일). 이 420px 아래서 다섯 상수를 다시 맞추자(같은
 * RING_START 주석) 5건 모두 초록으로 돌아왔다 — 한도 50명의 점-점 간격만은
 * 18.72px 까지만 좁혀져(284px 시절의 4.3px 부족보다는 훨씬 낫지만 여전히
 * 빠듯하다) 다섯 상수 재조정만으로는 문턱을 못 채웠는데, 그 문턱
 * (NO_OVERLAP_PX) 자체가 낡은 유도값이었다는 것이 드러나 함께 바로잡혔다
 * (아래 NODE_THRESHOLD 주석 참고).
 */
const VIEWPORTS: [string, number, number][] = [
  ["데스크톱 700x500", 700, 500],
  ["모바일 375x420", 375, 420],
];

/**
 * 점은 사각형이 아니라 원이다(PersonMarker.tsx 가 그리는 지름 NODE_PX.width
 * =15px 원, 측정값 — radial.ts 참고). 그래서 점-점 간격은 아래 테스트처럼
 * 중심 거리(Math.hypot) 하나로 정확히 잴 수 있다 — 반지름 7.5px 두 원은
 * 중심 거리가 정확히 15px(지름)일 때 닿고, 그 이상이면 각도와 무관하게
 * 절대 겹치지 않는다. (배지는 원이 아니라 가로로 긴 알약이라 아래 BADGE_BOX
 * 처럼 사각형 박스 겹침으로 재야 한다 — 두 모양을 같은 식으로 재면 안 되는
 * 이유가 서로 다르니, 나중에 정리랍시고 하나로 합치지 말 것.)
 *
 * 15(두 원이 닿는 거리) + 2px(눈에 보이는 틈) = 17. 예전엔 NODE_PX 가
 * 17×17(테두리를 더한 추정값)이던 시절 "17(닿는 거리)+2px"로 유도된 값이
 * 19 였는데, NODE_PX 가 15×15(실측값)로 정정된 뒤에도 19 는 "15+4"로
 * 다시 짜맞춰져 그대로 남아 있었다 — 겹침의 실제 기준이 아니라 옛 숫자
 * 19 를 지키려는 사후 조정이었다. 15+2=17 로 다시 유도한다: 이 값이 바뀐
 * 것은 NODE_PX 측정이 바뀌었기 때문이지, 아래 테스트가 빨간불이어서 문턱을
 * 낮춘 것이 아니다 — 실제로 이 정정으로 375×420·한도 50명(FULL)의 18.72px
 * 가 문턱을 채운다(radial.ts 의 RING_START 주석, .superpowers 의
 * final-fix-report.md 참고).
 */
const NO_OVERLAP_PX = 17;

/** 흔한 지도에 보장하는 여유. 겹침의 경계가 아니라 읽기 편한 거리다. */
const COMFORT_NODE_PX = 22;

/**
 * 중심 "나" 오브와 가장 안쪽 점 사이에 남아야 하는 눈에 보이는 틈.
 * NO_OVERLAP_PX 가 점-점 겹침에 "닿는 거리 + 눈에 보이는 틈"을 요구하는
 * 것과 같은 구조다 — 다만 오브가 점보다 훨씬 커서(SELF_PX=52 vs
 * NODE_PX=15) 그 틈을 4px 로 따로 잡았다(NO_OVERLAP_PX 의 2px 와 값 자체는
 * 다르다). 오브 반지름 + 점 반지름만으로는 부족하고, 그 위에 눈으로 알아볼
 * 만큼의 틈이 더 있어야 한다.
 */
const SELF_CLEARANCE_PX = 4;

/**
 * 문턱이 둘인 이유.
 *
 * 흔한 지도(시드 25명)는 편안한 거리(COMFORT_NODE_PX=22px)를 보장하고, 한도까지
 * 채운 지도·한쪽에 몰린 지도는 **적어도 겹치지 않는다**(NO_OVERLAP_PX=17px —
 * 점은 원이라 이 값 자체가 "두 원이 닿는 거리 + 눈에 보이는 틈"이다, 위
 * NO_OVERLAP_PX 주석 참고). 뒤쪽은 약해진 약속이지만 여전히 진짜 약속이다 —
 * 그리고 그런 지도는 카메라를 당겨서 본다.
 *
 * 데스크톱은 세 경우 다 27px 이상이라 이 구분이 필요 없다.
 *
 * 한때(모바일 375×284) 이 문턱 셋(시드 25명·한도 50명·한쪽에 몰린 50명) 다
 * 다섯 상수로는 못 채웠다 — 한도 50명이 14.7px, 시드 25명이 17.8px, 한쪽에
 * 몰린 50명이 17.0px 까지만 좁혀졌고, 아래 두 테스트("같은 층의 점끼리...",
 * "배지가 점과도...")가 정직하게 빨간불이었다. MapShell.tsx 를 고쳐 모바일
 * 지도 영역이 420px 를 보장받은 뒤(위 VIEWPORTS 주석) 다섯 상수(RING_START·
 * RING_GAP·ROW_PITCH·MIN_GAP·BADGE_MARGIN, radial.ts 참고)를 그 높이에
 * 맞춰 다시 최적화하자 시드 25명(22.41px)·한쪽에 몰린 50명(21.09px)·배지
 * 겹침 두 건은 전부 초록으로 돌아왔다.
 *
 * 한도 50명(FULL)만은 375×420 에서 가장 가까운 점 쌍이 18.72px 까지만
 * 좁혀진다 — 다섯 상수를 폭넓게(좌표 하강 + 무작위 재시작, 이 값 하나만을
 * 목적함수로 삼아 최대화해도) 다시 훑어도 18.7~18.9px 부근에서 멈춘다,
 * 375px 폭에서 50명을 이 배치로 담는 것 자체의 구조적 상한으로 보인다
 * (radial.ts 의 RING_START 주석도 같은 결론). 그 당시의 NO_OVERLAP_PX=19px
 * 에는 0.28px 모자랐다. 하지만 그 19px 는 NODE_PX 가 17×17 이던 시절의 낡은
 * 유도값을 "15+4"로 짜맞춰 그대로 이어온 것이었다(위 NO_OVERLAP_PX 주석) —
 * NODE_PX=15 로 정정된 값을 그대로 밀어 15+2=17 로 다시 유도하면 18.72px 는
 * 이 문턱을 채운다. 문턱을 *낮춘* 것이 아니라, 이미 정정된 NODE_PX 를 여기
 * 값에도 뒤늦게 반영한 것이다 — 배치를 더 조인 것은 없다.
 */
const NODE_THRESHOLD: Record<string, number> = {
  "시드 25명": COMFORT_NODE_PX,
  "한도 50명": NO_OVERLAP_PX,
  "한쪽에 몰린 50명": NO_OVERLAP_PX,
};

/**
 * 배지가 낀 겹침(배지-배지, 배지-점)은 원이 아니라 사각형으로 잰다. 배지는
 * 가로로 긴 알약이고, 상대가 점이든 배지든 중심점 거리 하나로 재면 가로로는
 * 턱없이 모자라고 세로로는 과하다 — 실제로 그렇게 쟀다가 통과할 수 없는
 * 문턱을 만들었다. (점-점 겹침은 다르다 — 점은 원이라 중심 거리 하나로
 * 정확히 재도 된다, 위 NO_OVERLAP_PX 주석 참고. 여기 NODE_BOX 는 점이
 * 배지·뷰포트 경계와 만날 때만 쓰는 사각형 근사다.)
 *
 * radial.ts 가 내보내는 BADGE_PX/NODE_PX 를 그대로 쓴다 — 여기서 값을 따로
 * 적으면 screenScale 이 실제로 맞추는 상자 크기와 테스트가 재는 상자 크기가
 * 몰래 어긋날 수 있다(이 파일이 잡으려는 바로 그 종류의 거짓 통과).
 *
 * 폭 52 는 **추정이 아니라 고정값**이다. RegionLabels.tsx 가 배지에
 * w-[52px] 를 박아 그리므로 이 상자와 화면이 정의상 같다 — 글자 수로 폭을
 * 어림하면 그 어림이 틀렸을 때 테스트만 초록이 된다(실제로 56 으로 어림했다가
 * 진짜 배지가 73px 인 것을 뒤늦게 쟀다).
 *
 * 52 인 이유는 물리적 상한이다: 15칸이 다 찬 지도에서 이웃 배지 중심 사이의
 * 화면 거리가 모바일 375×420 에서 **55.42px** 밖에 안 된다
 * (측정 — radial.ts 의 BADGE_PX 주석 참고). 배지 15개가 원 둘레를 나눠 갖는
 * 구조라 상수로는 크게 못 늘린다 — 반지름을 키우면 배율이 그만큼 줄어
 * 제자리다. 그래서 배지가 그 안에 들어가야 하고, 별명을 3자 이내로 줄인
 * 것도 그래서다(DISPLAY_TITLES).
 * **RegionLabels.tsx 가 그리는 배지가 이 상자와 같아야 한다.**
 */
const BADGE_BOX = { w: BADGE_PX.width, h: BADGE_PX.height };
const NODE_BOX = { w: NODE_PX.width, h: NODE_PX.height };

function overlaps(
  a: Vec3,
  aBox: { w: number; h: number },
  b: Vec3,
  bBox: { w: number; h: number },
  scale: number,
): boolean {
  return (
    Math.abs((a[0] - b[0]) * scale) < (aBox.w + bBox.w) / 2 &&
    Math.abs((a[1] - b[1]) * scale) < (aBox.h + bBox.h) / 2
  );
}

describe("화면에서 겹치지 않는다", () => {
  for (const [vpName, w, h] of VIEWPORTS) {
    for (const [caseName, c] of CASES) {
      const threshold = NODE_THRESHOLD[caseName];
      it(`${vpName} · ${caseName} — 같은 층의 점끼리 ${threshold}px 이상 떨어진다`, () => {
        const layout = buildLayout(c);
        const scale = screenScale(w, h, layout);
        const pts = [...placePeople(peopleOf(c)).values()];
        let worst = Infinity;
        let comparablePairs = 0;
        for (let i = 0; i < pts.length; i += 1)
          for (let j = i + 1; j < pts.length; j += 1) {
            // 층이 다르면 높이로 갈린다 — 기본 시점에서 겹쳐 보이는 것이 설계다.
            if (Math.abs(pts[i][2] - pts[j][2]) > 1e-9) continue;
            comparablePairs += 1;
            worst = Math.min(
              worst,
              Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) * scale,
            );
          }
        // 같은 층 쌍이 하나도 없으면 worst 가 Infinity 로 남아 아래 assert 가
        // 공허하게 통과한다 — 그 함정을 여기서 막는다.
        expect(comparablePairs).toBeGreaterThan(0);
        expect(worst).toBeGreaterThanOrEqual(threshold);
      });

      it(`${vpName} · ${caseName} — 배지가 점과도, 다른 배지와도 겹치지 않는다`, () => {
        const layout = buildLayout(c);
        const scale = screenScale(w, h, layout);
        const badges: Vec3[] = [];
        for (const role of ROLES)
          for (const f of FEATURES) {
            const b = badgeAnchor(layout, role, f);
            if (b) badges.push(b);
          }

        for (let i = 0; i < badges.length; i += 1)
          for (let j = i + 1; j < badges.length; j += 1)
            expect(overlaps(badges[i], BADGE_BOX, badges[j], BADGE_BOX, scale)).toBe(false);

        for (const b of badges)
          for (const p of placePeople(peopleOf(c)).values())
            expect(overlaps(b, BADGE_BOX, p, NODE_BOX, scale)).toBe(false);
      });

      it(`${vpName} · ${caseName} — 가장 안쪽 점이 "나" 오브에서 눈에 보이는 만큼 떨어진다`, () => {
        // SelfCore.tsx 는 SELF_PX(52px, 반지름 26px) 원을 중심에 그린다. 가장
        // 안쪽 점(항상 RING_START 반지름에 있다 — 六合 링이 비어도 기본 링이
        // 그 자리에서 시작한다)이 오브에 가려지지 않으려면 화면 거리가
        // 오브 반지름 + 점 자신의 반지름(NODE_PX 를 원으로 근사)을 넘어야
        // 하고, 거기에 눈으로 보이는 틈이 더 있어야 "닿을 듯 말 듯"이 아니라
        // 분명히 떨어져 보인다. SELF_CLEARANCE_PX 는 그 틈이다.
        const layout = buildLayout(c);
        const scale = screenScale(w, h, layout);
        const pts = [...placePeople(peopleOf(c)).values()];
        const innermost = Math.min(...pts.map((p) => Math.hypot(p[0], p[1]))) * scale;
        const margin = innermost - SELF_PX / 2 - NODE_PX.width / 2;
        expect(margin).toBeGreaterThanOrEqual(SELF_CLEARANCE_PX);
      });
    }
  }

  /**
   * 이전 버전은 `extent * screenScale(...) * 2 <= min(w,h)` 를 쟀다 —
   * screenScale 이 `min(w,h)/(2*extent)` 로 정의되니 좌변은 항상 정확히
   * min(w,h) 다. 무엇을 하든 통과하는 항등식이었고, 그래서 점 반지름만 맞춘
   * 배율에서 배지 상자가 화면 밖으로 나가는 걸 아무것도 못 잡았다. 대신 배지
   * 상자와 점 상자의 네 변이 전부 뷰포트 안에 있는지 좌표로 직접 잰다.
   */
  for (const [vpName, w, h] of VIEWPORTS) {
    for (const [caseName, c] of CASES) {
      it(`${vpName} · ${caseName} — 배지·점 상자가 뷰포트 밖으로 안 나간다`, () => {
        const layout = buildLayout(c);
        const scale = screenScale(w, h, layout);

        function assertInside(pos: Vec3, box: { w: number; h: number }, label: string) {
          const x = pos[0] * scale;
          const y = pos[1] * scale;
          const left = x - box.w / 2;
          const right = x + box.w / 2;
          const top = y - box.h / 2;
          const bottom = y + box.h / 2;
          expect(left, `${label} 왼쪽 변이 뷰포트 밖`).toBeGreaterThanOrEqual(-w / 2 - 1e-9);
          expect(right, `${label} 오른쪽 변이 뷰포트 밖`).toBeLessThanOrEqual(w / 2 + 1e-9);
          expect(top, `${label} 위 변이 뷰포트 밖`).toBeGreaterThanOrEqual(-h / 2 - 1e-9);
          expect(bottom, `${label} 아래 변이 뷰포트 밖`).toBeLessThanOrEqual(h / 2 + 1e-9);
        }

        for (const role of ROLES)
          for (const f of FEATURES) {
            const b = badgeAnchor(layout, role, f);
            if (b) assertInside(b, BADGE_BOX, `배지 ${role}/${f}`);
          }

        for (const [id, p] of placePeople(peopleOf(c)))
          assertInside(p, NODE_BOX, `점 ${id}`);
      });
    }
  }

  it("빈 칸에는 배지 자리가 없다", () => {
    const layout = buildLayout(counts({ "fill/none": 2 }));
    expect(badgeAnchor(layout, "fill", "none")).not.toBeNull();
    expect(badgeAnchor(layout, "fill", "chung")).toBeNull();
    expect(badgeAnchor(layout, "beside", "none")).toBeNull();
  });

  it("배지는 자기 칸 사람들보다 바깥이고 바닥 층에 있다", () => {
    const layout = buildLayout(SEEDED);
    for (const role of ROLES)
      for (const f of FEATURES) {
        const b = badgeAnchor(layout, role, f);
        const cell = layout.cells[role][f];
        if (!b || !cell) continue;
        expect(Math.hypot(b[0], b[1])).toBeGreaterThan(Math.max(...cell.radii));
        expect(b[2]).toBe(0);
      }
  });
});
