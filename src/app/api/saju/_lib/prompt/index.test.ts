import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/saju-core";
import { SECTION_KEYS } from "../sections";
import { buildSectionRequest, SECTION_TOOL_NAME, YEARLY_LUCK_YEARS } from "./index";

const analysis = analyze({ year: 1990, month: 5, day: 15, hour: 10, gender: "male" });
const ctx = { year: 2026 };

const contentSchema = (req: { inputSchema: Record<string, unknown> }) =>
  (req.inputSchema.properties as { content: Record<string, unknown> }).content;

describe("buildSectionRequest", () => {
  it("모든 섹션에 대해 요청을 만든다", () => {
    for (const key of SECTION_KEYS) {
      const req = buildSectionRequest(analysis, key, ctx);
      expect(req.key, key).toBe(key);
      expect(req.system.length, key).toBeGreaterThan(0);
      expect(req.toolName, key).toBe(SECTION_TOOL_NAME);
      expect(req.inputSchema.required, key).toEqual(["content"]);
    }
  });

  it("user 프롬프트에 사실 블록 · 지시문 · 문체 예시가 다 들어간다", () => {
    const req = buildSectionRequest(analysis, "personality", ctx);
    expect(req.user).toContain("[사실 · 원국]");
    expect(req.user).toContain("[요청 · personality]");
    expect(req.user).toContain("[문체 예시]");
  });

  it("chart 섹션에는 대운·세운을 넣지 않는다", () => {
    const req = buildSectionRequest(analysis, "overview", ctx);
    expect(req.user).not.toContain("[사실 · 대운]");
    expect(req.user).not.toContain("[사실 · 세운]");
  });

  it("luck 섹션에는 대운·세운을 넣는다", () => {
    const req = buildSectionRequest(analysis, "daeunOutlook", ctx);
    expect(req.user).toContain("[사실 · 대운]");
    expect(req.user).toContain("[사실 · 세운]");
  });

  // 개수가 어긋나면 zipTimeline 이 섹션을 통째로 버린다.
  it("daeunOutlook 의 rows 를 대운 회차 수로 못박는다", () => {
    const n = analysis.daeun.periods.length;
    const req = buildSectionRequest(analysis, "daeunOutlook", ctx);
    const rows = (contentSchema(req).properties as Record<string, Record<string, unknown>>).rows;
    expect(rows.minItems).toBe(n);
    expect(rows.maxItems).toBe(n);
    expect(req.user).toContain(`항목은 정확히 ${n}개`);
  });

  it("yearlyLuck 의 항목 수를 세운 연수로 못박는다", () => {
    const req = buildSectionRequest(analysis, "yearlyLuck", ctx);
    expect(contentSchema(req).minItems).toBe(YEARLY_LUCK_YEARS);
    expect(contentSchema(req).maxItems).toBe(YEARLY_LUCK_YEARS);
  });

  it("yearlyLuckYears 로 세운 연수를 바꿀 수 있다", () => {
    const req = buildSectionRequest(analysis, "yearlyLuck", { year: 2026, yearlyLuckYears: 5 });
    expect(contentSchema(req).minItems).toBe(5);
    expect(req.user).toContain("2030년");
  });

  // 배열 섹션 전부의 min/max 를 덮어쓴 적이 있다 (derive.ts:llmInputSchemaWithRows 주석).
  it("개수 고정은 세운·대운에만 적용된다", () => {
    const req = buildSectionRequest(analysis, "personality", ctx);
    expect(contentSchema(req).minItems).toBe(2);
    expect(contentSchema(req).maxItems).toBe(4);
    expect(req.user).not.toContain("항목은 정확히");
  });
});
