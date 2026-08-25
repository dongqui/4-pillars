import { describe, it, expect } from "vitest";
import { DECISION_AXES, WORK_AXES, axisPromptLines, axisRows, axisSchema } from "./axes";

const AXES = { a: "가", b: "나", c: "다" } as const;
const S = axisSchema(AXES);

describe("axisSchema", () => {
  it("모든 축이 있으면 통과한다", () => {
    expect(S.safeParse({ a: "1", b: "2", c: "3" }).success).toBe(true);
  });

  // 배열 + z.enum(라벨) 로 두면 여기가 통과해버린다 — 객체로 두는 이유다.
  it("축이 하나라도 빠지면 거절한다", () => {
    expect(S.safeParse({ a: "1", b: "2" }).success).toBe(false);
  });

  it("모르는 축을 더하면 거절한다", () => {
    expect(S.safeParse({ a: "1", b: "2", c: "3", d: "4" }).success).toBe(false);
  });

  it("빈 문자열을 거절한다", () => {
    expect(S.safeParse({ a: "", b: "2", c: "3" }).success).toBe(false);
  });
});

describe("axisRows", () => {
  it("선언 순서대로 라벨과 본문을 짝짓는다", () => {
    expect(axisRows(AXES, { a: "1", b: "2", c: "3" })).toEqual([
      { label: "가", body: "1" },
      { label: "나", body: "2" },
      { label: "다", body: "3" },
    ]);
  });
});

describe("axisPromptLines", () => {
  it("축 키와 라벨과 힌트를 한 줄로 묶는다", () => {
    const lines = axisPromptLines(AXES, { a: "힌트가", b: "힌트나", c: "힌트다" });
    expect(lines).toEqual([
      "- a(가): 힌트가",
      "- b(나): 힌트나",
      "- c(다): 힌트다",
    ]);
  });
});

describe("실제 축 정의", () => {
  it("선택과 결정은 축이 4개다", () => {
    expect(Object.keys(DECISION_AXES)).toEqual([
      "deciding", "starting", "unsure", "afterDeciding",
    ]);
  });

  it("일하는 방식은 축이 5개다", () => {
    expect(Object.keys(WORK_AXES)).toEqual([
      "starting", "progressing", "collaborating", "troubled", "performing",
    ]);
  });
});
