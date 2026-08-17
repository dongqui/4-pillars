import { describe, it, expect } from "vitest";
import { FEATURE_COST, FEATURE_IDS, pairKey } from "./features";

describe("FEATURE_COST", () => {
  it("모든 서비스에 단가가 있다 — 빠진 서비스는 조용한 무료 열람이 된다", () => {
    for (const id of FEATURE_IDS) {
      expect(FEATURE_COST[id]).toBeGreaterThan(0);
    }
  });

  it("지금은 전부 1장 균일이다", () => {
    expect(FEATURE_COST.full_report).toBe(1);
    expect(FEATURE_COST.compatibility).toBe(1);
  });
});

describe("pairKey", () => {
  it("순서를 뒤집어도 같은 키다 — 다르면 같은 궁합에 두 번 차감된다", () => {
    expect(pairKey("12", "34")).toBe(pairKey("34", "12"));
  });

  it("숫자 크기로 정렬한다 — 문자열 정렬이면 '10' < '9' 라 같은 쌍이 갈린다", () => {
    expect(pairKey("9", "10")).toBe("9:10");
    expect(pairKey("10", "9")).toBe("9:10");
  });

  it("같은 id 두 개도 안정적으로 접는다", () => {
    expect(pairKey("7", "7")).toBe("7:7");
  });
});
