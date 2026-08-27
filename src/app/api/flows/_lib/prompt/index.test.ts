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
  return buildFlowContext(a, year, flowMonths(a, year));
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

  it("08 의 스키마에 계산된 변곡점만 들어간다", () => {
    const ctx = ctxOf();
    const req = buildFlowSectionRequest(ctx, "pivots");
    const json = JSON.stringify(req.inputSchema);
    // 계산되지 않은 달이 정의역에 있으면 LLM 이 그 달을 쓸 수 있다
    for (let i = 1; i <= 12; i += 1) {
      if (ctx.pivotMonths.includes(i)) continue;
      expect(json).not.toContain(`"const":${i}`);
    }
  });

  it("모든 섹션이 요청을 만들 수 있다", () => {
    const ctx = ctxOf();
    for (const key of ["overview","rising","straining","work","relating","money","months","pivots","closing"] as const) {
      const req = buildFlowSectionRequest(ctx, key);
      expect(req.system.length, key).toBeGreaterThan(0);
      expect(req.inputSchema, key).toBeTruthy();
    }
  });
});
