import { describe, it, expect } from "vitest";
import {
  CHART_SECTION_KEYS,
  FREE_SECTION_KEYS,
  LUCK_SECTION_KEYS,
  PAID_SECTION_KEYS,
  SECTION_KEYS,
  isSectionKey,
  llmInputSchema,
  llmInputSchemaWithRows,
  parseSectionContent,
  sectionStorage,
  sectionVersion,
} from "./derive";

describe("키 목록", () => {
  it("무료 + 유료가 전체를 정확히 분할한다", () => {
    expect([...FREE_SECTION_KEYS, ...PAID_SECTION_KEYS].sort()).toEqual([...SECTION_KEYS].sort());
    expect(FREE_SECTION_KEYS.some((k) => PAID_SECTION_KEYS.includes(k))).toBe(false);
  });

  it("chart + luck 도 전체를 정확히 분할한다", () => {
    expect([...CHART_SECTION_KEYS, ...LUCK_SECTION_KEYS].sort()).toEqual([...SECTION_KEYS].sort());
    expect(CHART_SECTION_KEYS.some((k) => LUCK_SECTION_KEYS.includes(k))).toBe(false);
  });

  it("isSectionKey 는 모르는 키를 거른다", () => {
    expect(isSectionKey("overview")).toBe(true);
    expect(isSectionKey("environment")).toBe(false);
    expect(isSectionKey(null)).toBe(false);
  });

  it("sectionVersion / sectionStorage", () => {
    expect(sectionVersion("overview")).toBe(1);
    expect(sectionStorage("daeunOutlook")).toBe("luck");
    expect(sectionStorage("overview")).toBe("chart");
  });
});

describe("llmInputSchema", () => {
  it("최상위는 항상 객체 — tool input_schema 로 넘길 수 있어야 한다", () => {
    for (const key of SECTION_KEYS) {
      const s = llmInputSchema(key) as { type: string; required: string[]; additionalProperties: boolean };
      expect(s.type, key).toBe("object");
      expect(s.required, key).toEqual(["content"]);
      expect(s.additionalProperties, key).toBe(false);
    }
  });

  it("배열 섹션도 content 한 겹으로 감싸진다", () => {
    const s = llmInputSchema("personality") as { properties: { content: { type: string } } };
    expect(s.properties.content.type).toBe("array");
  });

  it("객체 섹션은 additionalProperties: false 를 그대로 내린다", () => {
    const s = llmInputSchema("outerVsInner") as {
      properties: { content: { additionalProperties: boolean; required: string[] } };
    };
    expect(s.properties.content.additionalProperties).toBe(false);
    expect(s.properties.content.required.sort()).toEqual(["inner", "outward"]);
  });
});

describe("llmInputSchemaWithRows", () => {
  it("yearlyLuck(배열 섹션)의 개수를 못박는다", () => {
    const s = llmInputSchemaWithRows("yearlyLuck", 6) as {
      properties: { content: { minItems: number; maxItems: number } };
    };
    expect(s.properties.content.minItems).toBe(6);
    expect(s.properties.content.maxItems).toBe(6);
  });

  it("daeunOutlook(객체 섹션)은 rows 의 개수를 못박는다", () => {
    const s = llmInputSchemaWithRows("daeunOutlook", 6) as {
      properties: { content: { properties: { rows: { minItems: number; maxItems: number } } } };
    };
    expect(s.properties.content.properties.rows.minItems).toBe(6);
    expect(s.properties.content.properties.rows.maxItems).toBe(6);
  });

  it("luck 이 아닌 섹션은 그대로 둔다 — 배열 섹션(personality 등)이라도 자기 자신의 min/max 를 건드리면 안 된다", () => {
    for (const key of SECTION_KEYS) {
      if (sectionStorage(key) === "luck") continue; // yearlyLuck·daeunOutlook 은 별도 테스트로 검증
      expect(llmInputSchemaWithRows(key, 6), key).toEqual(llmInputSchema(key));
    }
  });

  it("저장·조회 검증 스키마는 개수를 강제하지 않는다 (n 은 chartKey 밖 입력)", () => {
    expect(parseSectionContent("yearlyLuck", [{ title: "t", desc: "d" }])).not.toBeNull();
  });
});

describe("parseSectionContent", () => {
  it("통과하면 값을, 실패하면 null 을 준다", () => {
    expect(parseSectionContent("outerVsInner", { outward: "겉", inner: "속" }))
      .toEqual({ outward: "겉", inner: "속" });
    expect(parseSectionContent("outerVsInner", { outward: "겉" })).toBeNull();
    expect(parseSectionContent("personality", "문자열")).toBeNull();
  });
});
