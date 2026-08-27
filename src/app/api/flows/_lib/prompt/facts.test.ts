import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { flowMonths } from "../pivots";
import { buildFlowContext, flowFacts } from "./facts";

const BIRTH = {
  year: 1993, month: 4, day: 12, hour: 9, minute: 20,
  gender: "male", calendar: "solar",
} as const;

function ctxOf(year = 2027) {
  const a = analyze(BIRTH);
  return buildFlowContext(a, year, flowMonths(a, year));
}

describe("buildFlowContext", () => {
  it("12개 달의 사실을 낸다", () => {
    expect(ctxOf().months).toHaveLength(12);
  });

  it("pivotMonths 는 months 의 pivot 플래그와 일치한다", () => {
    const ctx = ctxOf();
    expect(ctx.pivotMonths).toEqual(ctx.months.filter((m) => m.pivot).map((m) => m.index));
  });

  it("첫 달의 vsPrev 는 null 이다", () => {
    expect(ctxOf().months[0].vsPrev).toBeNull();
  });

  it("대운 위치는 초반·중반·후반 중 하나다", () => {
    expect(["초반", "중반", "후반"]).toContain(ctxOf().year.daeunPhase);
  });
});

describe("flowFacts", () => {
  it("신강약을 넘긴다 — 숫자 필터가 이 줄을 날리고 있었다", () => {
    // LLM 이 신강/신약을 모른 채 쓰면 02·03 이 전부 일반론이 된다
    expect(flowFacts(ctxOf())).toMatch(/신강|중화|신약/);
  });

  it("오행 분포와 십성 분포를 라벨로 넘긴다", () => {
    const text = flowFacts(ctxOf());
    expect(text).toContain("오행 분포:");
    expect(text).toContain("두드러지는 힘:");
  });

  it("연도와 달력 월 숫자를 넘기지 않는다", () => {
    // 프롬프트에 연도가 남으면 "시점을 지어내지 마라" 는 규칙보다 그 숫자가 이긴다
    const text = flowFacts(ctxOf());
    expect(text).not.toMatch(/\d{4}년/);
    expect(text).not.toMatch(/\d+월/);
  });

  it("달을 순번으로 가리킨다", () => {
    expect(flowFacts(ctxOf())).toContain("[1번째 달]");
    expect(flowFacts(ctxOf())).toContain("[12번째 달]");
  });

  it("변곡점인 달을 표시한다", () => {
    const ctx = ctxOf();
    const text = flowFacts(ctx);
    if (ctx.pivotMonths.length > 0) expect(text).toContain("변곡점: 예");
  });

  it("대운이 바뀌는 해면 전환을 별도 사실로 남긴다", () => {
    // 초·중·말 하나로 뭉개면 그 해의 가장 큰 배경 변화가 사실에서 사라진다
    const a = analyze(BIRTH);
    const years = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031];
    const withSwitch = years
      .map((y) => buildFlowContext(a, y, flowMonths(a, y)))
      .find((c) => c.year.daeunSwitch !== null);
    if (withSwitch) expect(flowFacts(withSwitch)).toContain("배경 전환:");
  });
});
