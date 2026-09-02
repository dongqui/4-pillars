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
