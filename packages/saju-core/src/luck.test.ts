import { describe, expect, it } from "vitest";
import { buildChart } from "./chart.js";
import { computeDaeun } from "./luck.js";

describe("computeDaeun (1990-05-15 14:30, 년간 경=양)", () => {
  it("남자 → 양남 순행, 월주 신사에서 +1씩 (임오…)", () => {
    const chart = buildChart({ year: 1990, month: 5, day: 15, hour: 14, minute: 30, gender: "male" });
    const d = computeDaeun(chart, { count: 4 });
    expect(d.direction).toBe("순행");
    expect(d.daeunSu).toBe(7);
    expect(d.basisTerm).toBe("망종");
    expect(d.periods.map((p) => p.pillar)).toEqual(["임오", "계미", "갑신", "을유"]);
    expect(d.periods[0].startAge).toBe(7);
    expect(d.periods[1].startAge).toBe(17);
  });

  it("여자 → 양녀 역행, 월주 신사에서 -1씩 (경진…)", () => {
    const chart = buildChart({ year: 1990, month: 5, day: 15, hour: 14, minute: 30, gender: "female" });
    const d = computeDaeun(chart, { count: 4 });
    expect(d.direction).toBe("역행");
    expect(d.daeunSu).toBe(3);
    expect(d.basisTerm).toBe("입하");
    expect(d.periods.map((p) => p.pillar)).toEqual(["경진", "기묘", "무인", "정축"]);
  });

  it("기본 대운 개수는 9", () => {
    const chart = buildChart({ year: 1990, month: 5, day: 15, hour: 14, gender: "male" });
    expect(computeDaeun(chart).periods).toHaveLength(9);
  });
});
