import { describe, expect, it } from "vitest";
import {
  assignFlow,
  FLOW_SECTION_KEYS,
  flowLlmInputSchema,
  flowSectionVersion,
  isFlowSectionKey,
} from "./derive";

const CTX = { pivotMonths: [3, 7, 10] as const };

describe("isFlowSectionKey / flowSectionVersion", () => {
  it("9개 키를 모두 인식한다", () => {
    expect(FLOW_SECTION_KEYS).toHaveLength(9);
    for (const key of FLOW_SECTION_KEYS) {
      expect(isFlowSectionKey(key)).toBe(true);
      expect(flowSectionVersion(key)).toBeGreaterThanOrEqual(1);
    }
  });

  it("모르는 키·지워진 섹션(구 now/ahead 등)은 좁혀지지 않는다", () => {
    expect(isFlowSectionKey("now")).toBe(false);
    expect(isFlowSectionKey("ahead")).toBe(false);
    expect(isFlowSectionKey("remember")).toBe(false);
    expect(isFlowSectionKey("nonexistent")).toBe(false);
  });
});

describe("flowLlmInputSchema", () => {
  it("최상위를 content 로 한 겹 감싼다 — 리포트·궁합과 같은 계약", () => {
    const schema = flowLlmInputSchema("overview", CTX);
    expect(schema.type).toBe("object");
    expect(schema.properties).toHaveProperty("content");
    expect(schema.required).toEqual(["content"]);
    expect(schema.additionalProperties).toBe(false);
  });

  it("08 의 정의역이 pivotMonths 로 스키마 안에 박힌다 — LLM 이 계산되지 않은 달을 못 우긴다", () => {
    const three = JSON.stringify(flowLlmInputSchema("pivots", { pivotMonths: [3, 7, 10] }));
    const one = JSON.stringify(flowLlmInputSchema("pivots", { pivotMonths: [7] }));
    const zero = JSON.stringify(flowLlmInputSchema("pivots", { pivotMonths: [] }));

    expect(three).not.toBe(one);
    expect(three).toContain('"const":3');
    expect(three).not.toContain('"const":5');

    // 변곡점 1개: z.union 을 못 쓰고 z.literal 로 가는 분기 — 조립이 안 터지고
    // const 로 스키마에 반영되는지가 핵심이다
    expect(one).toContain('"const":7');

    // 변곡점 0개: 빈 배열만 통과하는 길이 제약이 JSON Schema 에도 살아 있어야 한다
    expect(zero).toContain('"maxItems":0');
    expect(zero).toContain('"minItems":0');
  });

  it("z.toJSONSchema 는 superRefine 이 있어도 던지지 않는다 — 중복 금지는 런타임 몫", () => {
    // monthList 는 .superRefine 으로 중복을 막는데, 그건 JSON Schema로 표현할 수
    // 없다. toJSONSchema 가 여기서 터지면 flowLlmInputSchema 자체가 죽는다.
    expect(() => flowLlmInputSchema("months", CTX)).not.toThrow();
    expect(() => flowLlmInputSchema("pivots", CTX)).not.toThrow();
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
