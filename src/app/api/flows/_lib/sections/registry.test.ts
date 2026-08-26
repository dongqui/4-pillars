import { describe, expect, it } from "vitest";
import { FLOW_SECTIONS } from "./registry";

describe("FLOW_SECTIONS", () => {
  it("기획서의 8개 섹션이 다 있다", () => {
    expect(Object.keys(FLOW_SECTIONS)).toEqual([
      "now", "rising", "straining", "work", "relating", "money", "ahead", "remember",
    ]);
  });

  it("모든 섹션에 지시문과 예시가 있다", () => {
    for (const spec of Object.values(FLOW_SECTIONS)) {
      expect(spec.prompt.length).toBeGreaterThan(0);
      expect(spec.example.length).toBeGreaterThan(0);
      expect(spec.version).toBeGreaterThanOrEqual(1);
    }
  });

  it("예시는 스키마를 통과한다 — 통과 못 하는 예시는 LLM 을 잘못 이끈다", () => {
    for (const [key, spec] of Object.entries(FLOW_SECTIONS)) {
      // 예시마다 구간 수가 다르므로(07 은 앞뒤 대비를 보이려고 2개다)
      // 예시 자신의 개수로 스키마를 만들어 검증한다.
      const example = JSON.parse(spec.example) as { segments: unknown[] };
      const parsed = spec.schema(example.segments.length).safeParse(example);
      expect(parsed.success, `${key} 의 example 이 스키마를 통과하지 못한다`).toBe(true);
    }
  });

  it("예시에 연도·월·날짜가 없다 — 예시가 규칙을 이긴다", () => {
    for (const [key, spec] of Object.entries(FLOW_SECTIONS)) {
      expect(spec.example, `${key}`).not.toMatch(/\d{4}년|\d{1,2}월|\d{1,2}일/);
    }
  });
});
