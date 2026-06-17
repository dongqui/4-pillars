import { describe, expect, it } from "vitest";
import { buildChart } from "./chart.js";
import { distributeElements } from "./elements.js";

describe("distributeElements", () => {
  it("경오·신사·경진·계미 → 금3 화2 토2 수1 목0", () => {
    const chart = buildChart({ year: 1990, month: 5, day: 15, hour: 14, minute: 30, gender: "male" });
    const d = distributeElements(chart);
    expect(d.total).toBe(8);
    expect(d.counts).toEqual({ 목: 0, 화: 2, 토: 2, 금: 3, 수: 1 });
    expect(d.percentages.금).toBe(37.5);
    expect(d.percentages.화).toBe(25);
    expect(d.percentages.목).toBe(0);
  });

  it("시주가 없으면 6자만 집계", () => {
    const chart = buildChart({ year: 1990, month: 5, day: 15, gender: "male" });
    const d = distributeElements(chart);
    expect(d.total).toBe(6);
    const sum = Object.values(d.counts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(6);
  });
});
