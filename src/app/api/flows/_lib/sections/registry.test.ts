import { describe, expect, it } from "vitest";
import { FLOW_SECTIONS, FLOW_SECTION_KEYS } from "./index";
import { parseFlowSectionContent } from "./derive";

const CTX = { pivotMonths: [3, 7, 10] as const };

describe("FLOW_SECTIONS", () => {
  it("9개 섹션을 기획서 순서대로 갖는다", () => {
    expect(FLOW_SECTION_KEYS).toEqual([
      "overview", "rising", "straining", "work",
      "relating", "money", "months", "pivots", "closing",
    ]);
  });

  it("예시가 자기 스키마를 통과한다", () => {
    // 예시가 스키마를 어기면 LLM 이 어긴 모양을 그대로 따라 한다
    for (const key of FLOW_SECTION_KEYS) {
      const parsed = JSON.parse(FLOW_SECTIONS[key].example);
      expect(parseFlowSectionContent(key, parsed, CTX), key).not.toBeNull();
    }
  });

  it("예시가 연도·월 숫자를 쓰지 않는다", () => {
    // 규칙보다 예시가 이긴다 — 예시에 "3월" 이 있으면 본문에도 나온다
    for (const key of FLOW_SECTION_KEYS) {
      expect(FLOW_SECTIONS[key].example, key).not.toMatch(/\d+월|\d{4}년/);
    }
  });
});

describe("months 스키마", () => {
  const twelve = (extra: Partial<Record<string, unknown>> = {}) => ({
    lead: "한 해가 이렇게 흘러가요.",
    months: Array.from({ length: 12 }, (_, i) => ({
      monthIndex: i + 1, title: `t${i}`, body: `b${i}`,
    })),
    ...extra,
  });

  it("12개가 정확히 다 있으면 통과한다", () => {
    expect(parseFlowSectionContent("months", twelve(), CTX)).not.toBeNull();
  });

  it("11개면 거부한다", () => {
    const c = twelve();
    c.months.pop();
    expect(parseFlowSectionContent("months", c, CTX)).toBeNull();
  });

  it("한 칸이 두 번이면 거부한다 — 개수만 맞고 한 달이 비는 경우", () => {
    const c = twelve();
    c.months[5].monthIndex = 1;
    expect(parseFlowSectionContent("months", c, CTX)).toBeNull();
  });

  it("13월은 거부한다", () => {
    const c = twelve();
    c.months[0].monthIndex = 13;
    expect(parseFlowSectionContent("months", c, CTX)).toBeNull();
  });
});

describe("pivots 스키마", () => {
  const of = (indices: number[]) => ({
    lead: "흐름이 크게 달라지는 시기예요.",
    pivots: indices.map((i) => ({ monthIndex: i, title: `t${i}`, body: `b${i}` })),
  });

  it("계산된 달과 정확히 일치하면 통과한다", () => {
    expect(parseFlowSectionContent("pivots", of([3, 7, 10]), CTX)).not.toBeNull();
  });

  it("계산되지 않은 달은 거부한다", () => {
    expect(parseFlowSectionContent("pivots", of([3, 5, 10]), CTX)).toBeNull();
  });

  it("개수가 모자라면 거부한다", () => {
    expect(parseFlowSectionContent("pivots", of([3, 7]), CTX)).toBeNull();
  });

  it("변곡점이 없는 해는 빈 배열만 받는다", () => {
    const empty = { pivotMonths: [] as const };
    expect(parseFlowSectionContent("pivots", of([]), empty)).not.toBeNull();
    expect(parseFlowSectionContent("pivots", of([4]), empty)).toBeNull();
  });

  it("변곡점이 하나뿐인 해도 만들 수 있다", () => {
    // z.union 은 최소 2개를 요구한다 — 이 경우를 안 다루면 스키마 조립에서
    // 터져 그 해의 08 이 통째로 생성되지 않는다
    const one = { pivotMonths: [7] as const };
    expect(parseFlowSectionContent("pivots", of([7]), one)).not.toBeNull();
    expect(parseFlowSectionContent("pivots", of([6]), one)).toBeNull();
    expect(parseFlowSectionContent("pivots", of([]), one)).toBeNull();
  });
});

describe("items 스키마", () => {
  it("정확히 3개여야 한다 — '3개 정도' 를 타입으로 굳힌다", () => {
    const make = (n: number) => ({
      lead: "l",
      items: Array.from({ length: n }, (_, i) => ({ title: `t${i}`, body: `b${i}` })),
    });
    expect(parseFlowSectionContent("rising", make(3), CTX)).not.toBeNull();
    expect(parseFlowSectionContent("rising", make(2), CTX)).toBeNull();
    expect(parseFlowSectionContent("rising", make(4), CTX)).toBeNull();
  });
});

describe("overview 스키마", () => {
  it("키워드는 4개다", () => {
    const base = { title: "t", body: "b" };
    expect(parseFlowSectionContent("overview", { ...base, keywords: ["가","나","다","라"] }, CTX)).not.toBeNull();
    expect(parseFlowSectionContent("overview", { ...base, keywords: ["가","나","다"] }, CTX)).toBeNull();
  });
});
