import { describe, it, expect } from "vitest";
import { FEATURE_COST, FEATURE_IDS } from "./features";

describe("FEATURE_COST", () => {
  it("모든 서비스에 단가가 있다 — 빠진 서비스는 조용한 무료 열람이 된다", () => {
    for (const id of FEATURE_IDS) {
      expect(FEATURE_COST[id]).toBeGreaterThan(0);
    }
  });

  it("지금은 전부 1장 균일이다", () => {
    expect(FEATURE_COST.full_report).toBe(1);
    expect(FEATURE_COST.compatibility).toBe(1);
    expect(FEATURE_COST.consultation).toBe(1);
  });
});
