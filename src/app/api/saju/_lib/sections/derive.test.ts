import { describe, it, expect } from "vitest";
import {
  FREE_SECTION_KEYS,
  PAID_SECTION_KEYS,
  SECTION_KEYS,
  assign,
  isSectionKey,
  llmInputSchema,
  parseSectionContent,
  paidSectionHeadings,
  sectionHeading,
  sectionVersion,
  type Interpretation,
} from "./derive";

describe("키 목록", () => {
  it("무료 + 유료가 전체를 정확히 분할한다", () => {
    expect([...FREE_SECTION_KEYS, ...PAID_SECTION_KEYS].sort()).toEqual([...SECTION_KEYS].sort());
    expect(FREE_SECTION_KEYS.some((k) => PAID_SECTION_KEYS.includes(k))).toBe(false);
  });

  it("isSectionKey 는 모르는 키를 거른다", () => {
    expect(isSectionKey("overview")).toBe(true);
    expect(isSectionKey("environment")).toBe(true);
    expect(isSectionKey("careerFortune")).toBe(false);
    expect(isSectionKey(null)).toBe(false);
  });

  it("sectionVersion", () => {
    // 프롬프트를 고칠 때마다 같이 올라간다. registry 의 version 과 어긋나면 여기서 걸린다.
    expect(sectionVersion("overview")).toBe(3);
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
    const s = llmInputSchema("strengths") as { properties: { content: { type: string } } };
    expect(s.properties.content.type).toBe("array");
  });

  it("객체 섹션은 additionalProperties: false 를 그대로 내린다", () => {
    const s = llmInputSchema("outerVsInner") as {
      properties: { content: { additionalProperties: boolean; required: string[] } };
    };
    expect(s.properties.content.additionalProperties).toBe(false);
    expect(s.properties.content.required.sort()).toEqual(["inner", "outward"]);
  });

  it("overview 의 traits 개수가 tool 스키마에 실린다", () => {
    const s = llmInputSchema("overview") as {
      properties: { content: { properties: { traits: { minItems: number; maxItems: number } } } };
    };
    expect(s.properties.content.properties.traits.minItems).toBe(4);
    expect(s.properties.content.properties.traits.maxItems).toBe(4);
  });
});

describe("assign", () => {
  it("target[key] = value 와 런타임 동작이 같다 (제네릭 우회는 컴파일 타임에만 영향)", () => {
    const target: Partial<Interpretation> = {};
    const outerVsInner = { outward: "겉", inner: "속" };
    assign(target, "outerVsInner", outerVsInner);
    expect(target).toEqual({ outerVsInner });
    expect(target.overview).toBeUndefined();
  });

  it("기존 키를 덮어쓴다 (재대입도 직접 대입과 동일)", () => {
    const trait = { title: "t", body: "b", basis: "근거" };
    const four = [trait, trait, trait, trait];
    const target: Partial<Interpretation> = {
      overview: { headline: "old", summary: "s", traits: four },
    };
    const next = { headline: "new", summary: "s2", traits: four };
    assign(target, "overview", next);
    expect(target.overview).toEqual(next);
  });
});

describe("parseSectionContent", () => {
  it("통과하면 값을, 실패하면 null 을 준다", () => {
    expect(parseSectionContent("outerVsInner", { outward: "겉", inner: "속" }))
      .toEqual({ outward: "겉", inner: "속" });
    expect(parseSectionContent("outerVsInner", { outward: "겉" })).toBeNull();
    expect(parseSectionContent("strengths", "문자열")).toBeNull();
  });
});

describe("sectionHeading", () => {
  it("번호는 레지스트리 선언 순서에서 나온다", () => {
    expect(sectionHeading("overview").no).toBe("01");
    expect(sectionHeading(SECTION_KEYS[SECTION_KEYS.length - 1]).no)
      .toBe(String(SECTION_KEYS.length).padStart(2, "0"));
  });

  it("모든 섹션이 번호·카테고리·제목을 갖는다", () => {
    const nos = SECTION_KEYS.map((k) => sectionHeading(k).no);
    expect(new Set(nos).size, "번호가 겹친다").toBe(SECTION_KEYS.length);
    for (const key of SECTION_KEYS) {
      const h = sectionHeading(key);
      expect(h.category.length, key).toBeGreaterThan(0);
      expect(h.title.length, key).toBeGreaterThan(0);
    }
  });

  it("잠금 목록은 유료 섹션을 화면과 같은 순서·번호로 준다", () => {
    const locked = paidSectionHeadings();
    expect(locked.map((l) => l.no)).toEqual(
      PAID_SECTION_KEYS.map((k) => sectionHeading(k).no),
    );
    // 무료 섹션은 잠기지 않는다
    expect(locked).toHaveLength(PAID_SECTION_KEYS.length);
  });
});
