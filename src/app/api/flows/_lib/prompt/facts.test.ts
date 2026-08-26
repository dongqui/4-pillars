import { describe, expect, it } from "vitest";
import { analyze, daeunSwitchIn, flowYearAt } from "@/lib/saju-core";
import { currentDaeun, flowSegments } from "../segments";
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

describe("buildFlowContext · 대운 선택", () => {
  // 1950-01-01 남성, flowYear=1967 은 반올림된 startAge + 달력 나이(1월 1일 기준)로
  // 근사하는 방법과 정밀 판정(daeunSwitchIn/currentDaeun, 입춘 기준 순간)이 실제로
  // 갈리는 경계 사례다 — 근사 방법은 "갑술"(18세 대운)을 고르지만 정밀 판정은
  // "을해"(8세 대운, startAgePrecise≈8.2)를 고른다. buildFlowContext 는 반드시
  // segments.ts 가 friction 계산에 쓰는 것과 같은 정밀 판정을 써야 한다 — 그래야
  // "지금 구간의 간지" 로 LLM 에 넘기는 사실이 실제로 점수를 결정한 대운과 일치한다.
  it("반올림/역법 근사와 정밀 판정이 갈리는 해에도 segments.ts 의 정밀 판정과 같은 대운을 고른다", () => {
    const boundarySubject = analyze({
      year: 1950, month: 1, day: 1, hour: 10, minute: 0,
      gender: "male", calendar: "solar",
    });
    const flowYear = 1967;

    // "segments.ts 가 선택하는 대운" 그 자체 — targetsFor 안에서 쓰는 것과
    // 정확히 같은 세 줄(같은 period 앵커, 같은 sw?.before ?? currentDaeun 순서).
    const period = flowYearAt(new Date(Date.UTC(flowYear, 5, 1)));
    const sw = daeunSwitchIn(boundarySubject, period);
    const expected = (sw?.before ?? currentDaeun(boundarySubject, period)).pillar;
    expect(expected).toBe("을해"); // 근사 방법이었다면 "갑술" — 실제로 갈리는 사례임을 고정한다

    const boundaryCtx = buildFlowContext(
      boundarySubject,
      flowYear,
      flowSegments(boundarySubject, flowYear),
    );
    expect(boundaryCtx.daeunKorean).toBe(expected);
  });
});
