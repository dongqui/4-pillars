import { describe, expect, it } from "vitest";
import { FLOW_SECTIONS, FLOW_SECTION_KEYS } from "./index";
import { parseFlowSectionContent } from "./derive";

describe("FLOW_SECTIONS", () => {
  it("8개 섹션을 기획서 순서대로 갖는다", () => {
    // 변곡점(옛 08)은 섹션이 아니다 — 07 의 변곡점 달 body 와 타임라인 배지가
    // 그 몫을 나눠 가졌다. 여기 pivots 를 다시 추가하려는 사람은 registry.ts 의
    // months v3 주석(07/08 분리가 실제로 낳은 것은 중복이었다)부터 읽을 것.
    expect(FLOW_SECTION_KEYS).toEqual([
      "overview", "rising", "straining", "work",
      "relating", "money", "months", "closing",
    ]);
  });

  it("예시가 자기 스키마를 통과한다", () => {
    // 예시가 스키마를 어기면 LLM 이 어긴 모양을 그대로 따라 한다. 삭제된 08 이
    // 정확히 이걸로 죽었다 — 예시는 변곡점 3개를 보여주는데 스키마는 그 해의
    // 계산 결과를 요구해서, 3개가 아닌 모든 해(측정상 76.6%)에서 예시가 스키마를
    // 어겼고 모델이 예시를 따라갔다.
    for (const key of FLOW_SECTION_KEYS) {
      const parsed = JSON.parse(FLOW_SECTIONS[key].example);
      expect(parseFlowSectionContent(key, parsed), key).not.toBeNull();
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
    expect(parseFlowSectionContent("months", twelve())).not.toBeNull();
  });

  it("11개면 거부한다", () => {
    const c = twelve();
    c.months.pop();
    expect(parseFlowSectionContent("months", c)).toBeNull();
  });

  it("한 칸이 두 번이면 거부한다 — 개수만 맞고 한 달이 비는 경우", () => {
    const c = twelve();
    c.months[5].monthIndex = 1;
    expect(parseFlowSectionContent("months", c)).toBeNull();
  });

  it("13월은 거부한다", () => {
    const c = twelve();
    c.months[0].monthIndex = 13;
    expect(parseFlowSectionContent("months", c)).toBeNull();
  });
});

describe("items 스키마", () => {
  it("정확히 3개여야 한다 — '3개 정도' 를 타입으로 굳힌다", () => {
    const make = (n: number) => ({
      lead: "l",
      items: Array.from({ length: n }, (_, i) => ({ title: `t${i}`, body: `b${i}` })),
    });
    expect(parseFlowSectionContent("rising", make(3))).not.toBeNull();
    expect(parseFlowSectionContent("rising", make(2))).toBeNull();
    expect(parseFlowSectionContent("rising", make(4))).toBeNull();
  });
});

describe("overview 스키마", () => {
  it("키워드는 4개다", () => {
    const base = { title: "t", body: "b" };
    expect(parseFlowSectionContent("overview", { ...base, keywords: ["가","나","다","라"] })).not.toBeNull();
    expect(parseFlowSectionContent("overview", { ...base, keywords: ["가","나","다"] })).toBeNull();
  });
});
