import { describe, expect, it } from "vitest";
import { flowYearAt, flowYearOf } from "./year";

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

describe("flowYearOf", () => {
  it("연도를 주면 그 해 입춘부터 다음 해 입춘까지를 돌려준다", () => {
    const p = flowYearOf(2027);
    expect(p.year).toBe(2027);
    // 입춘은 2월 3~5일 사이에 든다
    expect(p.start.getUTCMonth()).toBe(1);
    expect(p.end.getUTCFullYear()).toBe(2028);
    expect(p.end.getUTCMonth()).toBe(1);
  });

  it("flowYearAt 이 고른 해를 flowYearOf 에 넣으면 같은 경계가 나온다", () => {
    // 두 함수가 같은 절기 계산을 쓰는지 — 갈리면 확인 화면과 리포트가 다른
    // 기간을 표시한다
    const at = flowYearAt(new Date("2026-06-15T00:00:00Z"));
    const of = flowYearOf(at.year);
    expect(of.start.getTime()).toBe(at.start.getTime());
    expect(of.end.getTime()).toBe(at.end.getTime());
  });

  it("1월 20일은 아직 앞 해다 — flowYearOf 로 그 해를 되짚을 수 있다", () => {
    const at = flowYearAt(new Date("2026-01-20T00:00:00Z"));
    expect(at.year).toBe(2025);
    expect(flowYearOf(2025).end.getTime()).toBe(at.end.getTime());
  });
});
