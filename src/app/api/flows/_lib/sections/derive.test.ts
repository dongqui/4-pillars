import { describe, expect, it } from "vitest";
import {
  assignFlow,
  FLOW_SECTION_KEYS,
  flowLlmInputSchema,
  flowSectionVersion,
  isFlowSectionKey,
} from "./derive";

describe("isFlowSectionKey / flowSectionVersion", () => {
  it("8개 키를 모두 인식한다", () => {
    expect(FLOW_SECTION_KEYS).toHaveLength(8);
    for (const key of FLOW_SECTION_KEYS) {
      expect(isFlowSectionKey(key)).toBe(true);
      expect(flowSectionVersion(key)).toBeGreaterThanOrEqual(1);
    }
  });

  it("모르는 키·지워진 섹션(구 now/ahead/pivots 등)은 좁혀지지 않는다", () => {
    expect(isFlowSectionKey("now")).toBe(false);
    expect(isFlowSectionKey("ahead")).toBe(false);
    expect(isFlowSectionKey("remember")).toBe(false);
    // 08(변곡점)은 07 로 흡수됐다 — DB 에 남은 pivots 행은 여기서 걸러져 무시된다
    expect(isFlowSectionKey("pivots")).toBe(false);
    expect(isFlowSectionKey("nonexistent")).toBe(false);
  });
});

describe("flowLlmInputSchema", () => {
  it("최상위를 content 로 한 겹 감싼다 — 리포트·궁합과 같은 계약", () => {
    const schema = flowLlmInputSchema("overview");
    expect(schema.type).toBe("object");
    expect(schema.properties).toHaveProperty("content");
    expect(schema.required).toEqual(["content"]);
    expect(schema.additionalProperties).toBe(false);
  });

  it("07 의 정의역(1~12)이 JSON Schema 에 실린다 — LLM 이 13월을 못 우긴다", () => {
    const s = JSON.stringify(flowLlmInputSchema("months"));
    expect(s).toContain('"const":1');
    expect(s).toContain('"const":12');
    expect(s).not.toContain('"const":13');
    expect(s).toContain('"minItems":12');
    expect(s).toContain('"maxItems":12');
  });

  it("z.toJSONSchema 는 superRefine 이 있어도 던지지 않는다 — 중복 금지는 런타임 몫", () => {
    // monthList 는 .superRefine 으로 중복을 막는데, 그건 JSON Schema로 표현할 수
    // 없다. toJSONSchema 가 여기서 터지면 flowLlmInputSchema 자체가 죽는다.
    expect(() => flowLlmInputSchema("months")).not.toThrow();
  });
});

describe("assignFlow", () => {
  it("target[key] = value 와 같은 결과를 낸다", () => {
    const target: { a?: number; b?: string } = {};
    assignFlow(target, "a", 1);
    assignFlow(target, "b", "x");
    expect(target).toEqual({ a: 1, b: "x" });
  });
});
