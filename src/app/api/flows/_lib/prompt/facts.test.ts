import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { flowSegments } from "../segments";
import { buildFlowContext, flowFacts } from "./facts";

const subject = analyze({
  year: 1990, month: 6, day: 15, hour: 10, minute: 30,
  gender: "male", calendar: "solar",
});
const segs = flowSegments(subject, 2026);
const ctx = buildFlowContext(subject, 2026, segs);
const text = flowFacts(ctx);

describe("flowFacts", () => {
  it("구간마다 한 블록씩 낸다", () => {
    for (let i = 1; i <= segs.length; i += 1) {
      expect(text).toContain(`[구간 ${i}/${segs.length}]`);
    }
  });

  it("날짜·연도를 넘기지 않는다 — LLM 이 지어내는 통로를 막는다", () => {
    expect(text).not.toMatch(/\d{4}/);
    expect(text).not.toMatch(/\d{1,2}월/);
  });

  it("점수를 숫자가 아니라 범주 라벨로 넘긴다", () => {
    expect(text).toMatch(/받쳐줌: (크게 받쳐줌|받쳐줌|중립|눌림|크게 눌림)/);
    expect(text).toMatch(/흔들림: (잔잔함|흔들림|크게 흔들림)/);
  });

  it("첫 구간에는 '앞 구간 대비' 가 없다", () => {
    expect(ctx.segments[0].vsPrev).toBeNull();
  });

  it("두 번째 구간부터는 앞 구간과의 차이를 말한다", () => {
    if (ctx.segments.length > 1) {
      expect(ctx.segments[1].vsPrev).toBeTruthy();
      expect(text).toContain("앞 구간 대비");
    }
  });

  it("십성을 그룹 이름으로 넘긴다", () => {
    expect(text).toMatch(/두드러지는 힘: (비겁|인성|식상|재성|관성)/);
  });

  it("원국 배경이 들어간다", () => {
    expect(text).toContain("[연간 배경]");
  });
});
