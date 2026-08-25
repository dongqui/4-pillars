import { describe, it, expect } from "vitest";
import {
  DECISION_AXES,
  WORK_AXES,
  axisCountWord,
  axisPromptLines,
  axisRows,
  axisSchema,
} from "./axes";

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

describe("axisCountWord", () => {
  it("축 개수를 한국어 수관형사로 준다", () => {
    expect(axisCountWord(DECISION_AXES)).toBe("네");
    expect(axisCountWord(WORK_AXES)).toBe("다섯");
  });

  // 표에 없는 개수에서 숫자로 조용히 물러서면 지시문에 숫자가 섞이는데,
  // registry.test.ts 의 숫자 금지 검사는 example 만 보므로 아무도 못 잡는다.
  it("표에 없는 개수면 던진다", () => {
    const tooMany = Object.fromEntries(
      Array.from({ length: 7 }, (_, i) => [`k${i}`, `라벨${i}`]),
    );
    expect(() => axisCountWord(tooMany)).toThrow();
    expect(() => axisCountWord({ only: "하나" })).toThrow();
  });
});

describe("실제 축 정의", () => {
  // starting 이 두 맵에 함께 있으면 06 과 07 이 같은 이름의 칸을 갖게 되고,
  // 화면에서도 "새로운 일을 시작할 때" 와 "일을 시작할 때" 로 겹쳐 읽혔다.
  it("선택과 결정은 축이 4개고, 시작 축은 일하는 방식 쪽에만 있다", () => {
    expect(Object.keys(DECISION_AXES)).toEqual([
      "deciding", "venturing", "unsure", "afterDeciding",
    ]);
  });

  it("일하는 방식은 축이 5개다", () => {
    expect(Object.keys(WORK_AXES)).toEqual([
      "starting", "progressing", "collaborating", "troubled", "performing",
    ]);
  });

  it("두 맵이 같은 축 키도 같은 라벨도 쓰지 않는다", () => {
    const decision = Object.keys(DECISION_AXES);
    const work = Object.keys(WORK_AXES);
    expect(decision.filter((k) => work.includes(k))).toEqual([]);

    const labels = [...Object.values(DECISION_AXES), ...Object.values(WORK_AXES)];
    expect(new Set(labels).size).toBe(labels.length);
  });
});
