import { describe, expect, it } from "vitest";
import { flowYearAt } from "./year";

describe("flowYearAt", () => {
  it("입춘 전이면 전년도다 — 달력 연도가 아니라 명리 연도다", () => {
    expect(flowYearAt(new Date("2026-01-20T00:00:00Z")).year).toBe(2025);
  });

  it("입춘 뒤면 그해다", () => {
    expect(flowYearAt(new Date("2026-06-01T00:00:00Z")).year).toBe(2026);
  });

  it("12월 말도 그해다 — 다음 입춘이 아직 안 왔다", () => {
    expect(flowYearAt(new Date("2026-12-31T23:00:00Z")).year).toBe(2026);
  });

  it("UTC 연도와 KST 연도가 갈리는 순간에도 같은 답을 낸다", () => {
    // 2025-12-31T20:00Z = 2026-01-01 05:00 KST. 둘 다 입춘 전이라 2025 다.
    expect(flowYearAt(new Date("2025-12-31T20:00:00Z")).year).toBe(2025);
    expect(flowYearAt(new Date("2026-01-01T00:00:00Z")).year).toBe(2025);
  });

  it("경계는 닫힌-열린 구간이다 — start 는 포함, end 는 제외", () => {
    const p = flowYearAt(new Date("2026-06-01T00:00:00Z"));
    expect(flowYearAt(p.start).year).toBe(2026);
    expect(flowYearAt(p.end).year).toBe(2027);
  });

  it("한 해의 end 는 다음 해의 start 다 — 틈이 없다", () => {
    const a = flowYearAt(new Date("2026-06-01T00:00:00Z"));
    const b = flowYearAt(new Date("2027-06-01T00:00:00Z"));
    expect(a.end.getTime()).toBe(b.start.getTime());
  });
});
