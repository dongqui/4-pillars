import { describe, expect, it } from "vitest";
import {
  MATCH_SECTIONS,
  MATCH_SECTION_KEYS,
  isMatchSectionKey,
  matchLlmInputSchema,
  matchSectionVersion,
  parseMatchSectionContent,
} from "./index";

describe("MATCH_SECTIONS", () => {
  it("다섯 섹션이다", () => {
    expect(MATCH_SECTION_KEYS).toEqual(["verdict", "chemistry", "eachSide", "moments", "bridge"]);
  });

  // example 은 문체를 잡아주는 톤 샘플이지 개수 제약까지 지킬 필요는 없다
  // (registry.ts의 다른 예시들도 min() 에 못 미치는 개수로 실려 있다) — 배열
  // 길이는 example 이 아니라 matchLlmInputSchema 의 minItems/maxItems 가 강제한다.
  // 여기서는 example 이 파싱 가능한 JSON 인지만 확인한다 (saju sections/registry.test.ts 와 같은 결).
  it("모든 섹션의 example 이 파싱 가능한 JSON 이다", () => {
    for (const key of MATCH_SECTION_KEYS) {
      expect(() => JSON.parse(MATCH_SECTIONS[key].example), key).not.toThrow();
    }
  });

  it("example 에 숫자가 없다 — 시스템 프롬프트의 숫자 금지를 예시가 깨면 안 된다", () => {
    for (const key of MATCH_SECTION_KEYS) {
      expect(MATCH_SECTIONS[key].example, key).not.toMatch(/[0-9]/);
    }
  });

  it("모든 섹션이 지시문을 갖는다", () => {
    for (const key of MATCH_SECTION_KEYS) {
      expect(MATCH_SECTIONS[key].prompt.length, key).toBeGreaterThan(0);
    }
  });
});

describe("파생", () => {
  it("isMatchSectionKey 는 모르는 키를 거른다", () => {
    expect(isMatchSectionKey("verdict")).toBe(true);
    expect(isMatchSectionKey("overview")).toBe(false);
    expect(isMatchSectionKey(7)).toBe(false);
  });

  it("matchSectionVersion 은 레지스트리 값을 낸다", () => {
    expect(matchSectionVersion("verdict")).toBe(MATCH_SECTIONS.verdict.version);
  });

  it("llm 스키마는 { content } 한 겹으로 감싼다 — 최상위가 배열인 섹션이 있다", () => {
    const schema = matchLlmInputSchema("moments");
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.properties as object)).toEqual(["content"]);
    expect(schema.required).toEqual(["content"]);
  });

  it("검증에 실패하면 null 이다 — 호출자는 '없는 섹션' 으로 다룬다", () => {
    expect(parseMatchSectionContent("verdict", { headline: "" })).toBeNull();
    expect(parseMatchSectionContent("verdict", { headline: "가", summary: "나" }))
      .toEqual({ headline: "가", summary: "나" });
  });
});
