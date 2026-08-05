import { describe, it, expect } from "vitest";
import { SECTIONS, type SectionSpec } from "./registry";

const entries = Object.entries(SECTIONS) as [string, SectionSpec][];

describe("SECTIONS", () => {
  // 상단 히어로 + 01 은 overview 하나가 겸한다. 이 수가 곧 /home 의 "N개 중 M개 열림"이다.
  it("섹션 12개", () => {
    expect(entries).toHaveLength(12);
  });

  it("모든 섹션이 version >= 1", () => {
    for (const [key, spec] of entries) {
      expect(spec.version, key).toBeGreaterThanOrEqual(1);
    }
  });

  it("모든 섹션이 tier / storage / prompt 를 갖는다", () => {
    for (const [key, spec] of entries) {
      expect(["free", "paid"], key).toContain(spec.tier);
      expect(["chart", "luck"], key).toContain(spec.storage);
      expect(spec.prompt.length, key).toBeGreaterThan(0);
    }
  });

  it("모든 섹션의 톤 예시가 파싱 가능한 JSON 이다", () => {
    for (const [key, spec] of entries) {
      expect(() => JSON.parse(spec.example), key).not.toThrow();
    }
  });

  // 예시는 규칙보다 세다. 숫자가 든 예시를 두면 "숫자를 쓰지 마라"는 지시가
  // 무력해지고, 화면이 붙이는 계산값과 어긋난 서술이 나온다.
  it("톤 예시에 숫자가 없다", () => {
    for (const [key, spec] of entries) {
      expect(spec.example, key).not.toMatch(/\d/);
    }
  });

  it("생시에 의존하는 섹션만 storage=luck", () => {
    const luck = entries.filter(([, s]) => s.storage === "luck").map(([k]) => k);
    expect(luck.sort()).toEqual(["daeunOutlook", "yearlyLuck"]);
  });

  it("무료는 4개 (히어로+01 겸용 overview, 02~04)", () => {
    const free = entries.filter(([, s]) => s.tier === "free").map(([k]) => k);
    expect(free.sort()).toEqual(["cautions", "outerVsInner", "overview", "strengths"]);
  });

  it("overview 는 traits 를 정확히 4개 요구한다", () => {
    const trait = { title: "t", body: "b", basis: "근거" };
    const four = [trait, trait, trait, trait];
    const ok = { headline: "h", summary: "s", traits: four };
    expect(SECTIONS.overview.schema.safeParse(ok).success).toBe(true);
    expect(SECTIONS.overview.schema.safeParse({ ...ok, traits: four.slice(1) }).success).toBe(false);
    expect(SECTIONS.overview.schema.safeParse({ ...ok, traits: [...four, trait] }).success).toBe(false);
  });

  // basis 가 없으면 "쉬운 말 → 사주 근거" 흐름이 무너진 채로 통과해버린다.
  it("overview 의 trait 은 basis 없이는 통과하지 않는다", () => {
    const trait = { title: "t", body: "b", basis: "근거" };
    const noBasis = { title: "t", body: "b" };
    const bad = { headline: "h", summary: "s", traits: [noBasis, trait, trait, trait] };
    expect(SECTIONS.overview.schema.safeParse(bad).success).toBe(false);
  });

  it("environment 는 양쪽 조건을 각각 3~4개 요구한다", () => {
    const three = ["a", "b", "c"];
    const ok = { energizing: three, draining: three, summary: "s", emphasis: "e" };
    expect(SECTIONS.environment.schema.safeParse(ok).success).toBe(true);
    expect(SECTIONS.environment.schema.safeParse({ ...ok, draining: ["a", "b"] }).success).toBe(false);
    expect(SECTIONS.environment.schema.safeParse({ ...ok, energizing: [...three, "d", "e"] }).success).toBe(false);
  });

  it("daeunOutlook 은 rows/summary/emphasis 를 요구한다", () => {
    const rows = [{ title: "t", desc: "d" }];
    expect(SECTIONS.daeunOutlook.schema.safeParse({ rows, summary: "s", emphasis: "e" }).success).toBe(true);
    expect(SECTIONS.daeunOutlook.schema.safeParse({ rows }).success).toBe(false);
  });
});
