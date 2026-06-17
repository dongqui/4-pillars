import { describe, expect, it } from "vitest";
import { buildChart } from "./chart.js";
import { levelFromRatio, scoreStrength } from "./strength.js";

describe("levelFromRatio", () => {
  it("임계값 기준 신강/중화/신약", () => {
    expect(levelFromRatio(0.6)).toBe("신강");
    expect(levelFromRatio(0.55)).toBe("신강");
    expect(levelFromRatio(0.5)).toBe("중화");
    expect(levelFromRatio(0.45)).toBe("신약");
    expect(levelFromRatio(0.3)).toBe("신약");
  });
});

describe("scoreStrength (경오·신사·경진·계미)", () => {
  it("가중 세력 점수와 비율", () => {
    const chart = buildChart({ year: 1990, month: 5, day: 15, hour: 14, minute: 30, gender: "male" });
    const s = scoreStrength(chart);
    expect(s.groupScores).toEqual({ 비겁: 2, 식상: 1, 재성: 0, 관성: 4.5, 인성: 3.5 });
    expect(s.supportive).toBe(5.5);
    expect(s.draining).toBe(5.5);
    expect(s.ratio).toBeCloseTo(0.5, 5);
    expect(s.level).toBe("중화");
  });
});
