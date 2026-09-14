import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { flowMonths } from "../pivots";
import { buildFlowContext } from "./facts";
import { buildFlowSectionRequest, FLOW_SYSTEM_PROMPT } from "./index";

const BIRTH = {
  year: 1993, month: 4, day: 12, hour: 9, minute: 20,
  gender: "male", calendar: "solar",
} as const;

function ctxOf(year = 2027) {
  const a = analyze(BIRTH);
  return buildFlowContext(a, year, flowMonths(a, year), null);
}

describe("FLOW_SYSTEM_PROMPT", () => {
  it("시제 중립을 요구한다", () => {
    expect(FLOW_SYSTEM_PROMPT).toContain("시제");
  });

  it("구간 이야기를 더 이상 하지 않는다", () => {
    // 구간이 사라졌는데 프롬프트에 남아 있으면 LLM 이 없는 구간을 지어낸다
    expect(FLOW_SYSTEM_PROMPT).not.toContain("구간 번호");
  });
});

describe("buildFlowSectionRequest", () => {
  it("사실 블록과 섹션 지시문을 함께 낸다", () => {
    const req = buildFlowSectionRequest(ctxOf(), "months");
    expect(req.user).toContain("[연간]");
    expect(req.user).toContain("[1번째 달]");
    expect(req.user).toContain("[요청 · months]");
  });

  it("변곡점이 [사실] 블록에 실린다 — 07 이 전환 서술을 어디에 쓸지 이 줄이 정한다", () => {
    // 08(변곡점 섹션)이 07 로 흡수되면서 스키마 정의역 대신 [사실] 의 변곡점
    // 표기가 유일한 전달 경로가 됐다 — 연간 줄과 달 블록의 "변곡점: 예" 둘 다.
    const ctx = ctxOf();
    expect(ctx.pivotMonths.length).toBeGreaterThan(0);
    const req = buildFlowSectionRequest(ctx, "months");
    expect(req.user).toContain("변곡점:");
    expect(req.user).toContain("변곡점: 예");
  });

  it("모든 섹션이 요청을 만들 수 있다", () => {
    const ctx = ctxOf();
    for (const key of ["overview","rising","straining","work","relating","money","months","closing"] as const) {
      const req = buildFlowSectionRequest(ctx, key);
      expect(req.system.length, key).toBeGreaterThan(0);
      expect(req.inputSchema, key).toBeTruthy();
    }
  });
});
