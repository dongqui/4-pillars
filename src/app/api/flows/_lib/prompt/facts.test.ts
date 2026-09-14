import { describe, expect, it } from "vitest";
import { analyze, type SajuAnalysis } from "@/lib/saju-core";
import { flowMonths } from "../pivots";
import type { FlowSituation } from "@/lib/flows/situation";
import { buildFlowContext, flowFacts } from "./facts";

const BIRTH = {
  year: 1993, month: 4, day: 12, hour: 9, minute: 20,
  gender: "male", calendar: "solar",
} as const;

const YEARS = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031];

function ctxOf(year = 2027, situation: FlowSituation | null = null) {
  const a = analyze(BIRTH);
  return buildFlowContext(a, year, flowMonths(a, year), situation);
}

/** flowFacts 출력을 달 블록 단위로 쪼갠다. blocks[i] 는 (i+1)번째 달이다. */
function monthBlocks(text: string): string[] {
  return text.split(/\n\n(?=\[\d+번째 달\])/).filter((b) => /^\[\d+번째 달\]/.test(b));
}

describe("buildFlowContext", () => {
  it("12개 달의 사실을 낸다", () => {
    expect(ctxOf().months).toHaveLength(12);
  });

  it("첫 달의 vsPrev 는 null 이다", () => {
    expect(ctxOf().months[0].vsPrev).toBeNull();
  });

  it("대운 위치는 초반·중반·후반 중 하나다", () => {
    expect(["초반", "중반", "후반"]).toContain(ctxOf().year.daeunPhase);
  });
});

describe("buildFlowContext · pivotMonths 배선", () => {
  // ctx.pivotMonths 를 ctx.months 에서 다시 뽑아 비교하면 같은 buildFlowContext
  // 호출 결과를 자기 자신과 비교하는 꼴이라, pivot 배선이 깨져도(엉뚱한 소스를
  // 베끼거나 인덱스가 밀려도) 항상 통과한다. flowMonths 를 독립적으로 다시 불러
  // "진짜 변곡점"을 구하고, 그 값과 견준다.
  it("pivotMonths 와 months[].pivot 은 flowMonths 가 고른 변곡점과 일치한다", () => {
    const a = analyze(BIRTH);
    for (const y of YEARS) {
      const fm = flowMonths(a, y);
      const expected = fm.filter((m) => m.pivot).map((m) => m.index);
      const ctx = buildFlowContext(a, y, fm, null);
      expect(ctx.pivotMonths).toEqual(expected);
      expect(ctx.months.filter((m) => m.pivot).map((m) => m.index)).toEqual(expected);
    }
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

  it("변곡점 표시는 정확히 그 달에만 붙는다", () => {
    // "어딘가에 변곡점: 예 가 있다" 만 보면 엉뚱한 달에 붙어도 통과한다.
    // flowMonths 로 독립적으로 구한 변곡점 집합과 달 블록 단위로 대조한다.
    const a: SajuAnalysis = analyze(BIRTH);
    for (const y of YEARS) {
      const fm = flowMonths(a, y);
      const pivotIdx = new Set(fm.filter((m) => m.pivot).map((m) => m.index));
      const ctx = buildFlowContext(a, y, fm, null);
      const blocks = monthBlocks(flowFacts(ctx));
      expect(blocks).toHaveLength(12);
      blocks.forEach((block, i) => {
        const idx = i + 1;
        if (pivotIdx.has(idx)) expect(block).toContain("변곡점: 예");
        else expect(block).not.toContain("변곡점: 예");
      });
    }
  });

  it("대운이 바뀌는 해면 전환을 별도 사실로 남긴다", () => {
    // 초·중·말 하나로 뭉개면 그 해의 가장 큰 배경 변화가 사실에서 사라진다
    const a = analyze(BIRTH);
    const withSwitch = YEARS.map((y) => buildFlowContext(a, y, flowMonths(a, y), null)).find(
      (c) => c.year.daeunSwitch !== null,
    );
    if (withSwitch) expect(flowFacts(withSwitch)).toContain("배경 전환:");
  });
});

describe("flowFacts · 상황 블록", () => {
  it("상황이 없으면 블록이 아예 없다 — \"모른다\" 는 문장을 대신 넣지 않는다", () => {
    expect(flowFacts(ctxOf())).not.toContain("[상황");
  });

  it("고른 값은 코드가 아니라 사람이 읽는 라벨로 실린다", () => {
    const text = flowFacts(ctxOf(2027, { job: "freelancer", love: "dating" }));
    expect(text).toContain("현재 직업: 프리랜서");
    expect(text).toContain("연애 상태: 연애 중");
    expect(text).not.toContain("freelancer");
  });

  it("거절은 블록 안에 남는다 — 안 물어본 것과 다른 사실이다", () => {
    const text = flowFacts(ctxOf(2027, { job: "undisclosed", love: "undisclosed" }));
    expect(text).toContain("현재 직업: 밝히지 않음");
    expect(text).toContain("연애 상태: 밝히지 않음");
  });

  it("상황 블록이 [연간]보다 앞에 온다", () => {
    const text = flowFacts(ctxOf(2027, { job: "student", love: "single" }));
    expect(text.indexOf("[상황")).toBeLessThan(text.indexOf("[연간]"));
  });
});
