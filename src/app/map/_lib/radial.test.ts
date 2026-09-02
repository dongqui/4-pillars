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

  it("차 있는 칸은 최소 폭을 보장받는다", () => {
    const slots = allocateSlots({ yukhap: 1, none: 20, chung: 1 });
    for (const f of FEATURES) {
      const slot = slots[f]!;
      expect(slot.half * 2).toBeGreaterThanOrEqual(MIN_SLOT - 2 * 1e-9);
    }
  });

  it("사람이 많은 칸이 더 넓다", () => {
    const slots = allocateSlots({ yukhap: 1, none: 20, chung: 1 });
    expect(slots.none!.half).toBeGreaterThan(slots.yukhap!.half);
  });

  it("각도 순서는 언제나 六合 → 기본 → 沖 이다", () => {
    const slots = allocateSlots({ yukhap: 2, none: 5, chung: 3 });
    expect(slots.yukhap!.center).toBeLessThan(slots.none!.center);
    expect(slots.none!.center).toBeLessThan(slots.chung!.center);
  });

  it("슬롯이 서로 안 겹치고 구역 폭 안에 있다", () => {
    const slots = allocateSlots({ yukhap: 2, none: 5, chung: 3 });
    const live = FEATURES.map((f) => slots[f]!).filter(Boolean);
    for (const s of live) {
      expect(s.center - s.half).toBeGreaterThanOrEqual(-SECTOR_USED / 2 - 1e-9);
      expect(s.center + s.half).toBeLessThanOrEqual(SECTOR_USED / 2 + 1e-9);
    }
    for (let i = 1; i < live.length; i += 1) {
      expect(live[i].center - live[i].half).toBeGreaterThan(
        live[i - 1].center + live[i - 1].half,
      );
    }
  });
});
