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
