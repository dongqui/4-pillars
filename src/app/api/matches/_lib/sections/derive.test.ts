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

  it("모든 섹션의 example 이 자기 스키마를 통과한다 — 예시가 규칙을 어기면 예시가 이긴다", () => {
    for (const key of MATCH_SECTION_KEYS) {
      const parsed = parseMatchSectionContent(key, JSON.parse(MATCH_SECTIONS[key].example));
      expect(parsed, `${key} 의 example 이 스키마를 통과하지 못한다`).not.toBeNull();
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
