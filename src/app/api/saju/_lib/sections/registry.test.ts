import { describe, it, expect } from "vitest";
import { SECTIONS, type SectionSpec } from "./registry";

const entries = Object.entries(SECTIONS) as [string, SectionSpec][];

describe("SECTIONS", () => {
  it("섹션 12개", () => {
    expect(entries).toHaveLength(12);
  });

  it("환경(07)은 UI 재검토 중이라 아직 없다", () => {
    expect(SECTIONS).not.toHaveProperty("environment");
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

  it("생시에 의존하는 섹션만 storage=luck", () => {
    const luck = entries.filter(([, s]) => s.storage === "luck").map(([k]) => k);
    expect(luck.sort()).toEqual(["daeunOutlook", "yearlyLuck"]);
  });

  it("무료는 5개 (상단 + 01~04)", () => {
    const free = entries.filter(([, s]) => s.tier === "free").map(([k]) => k);
    expect(free.sort()).toEqual(
      ["cautions", "outerVsInner", "overview", "personality", "strengths"],
    );
  });

  it("overview 는 키워드 3~6개를 요구한다", () => {
    const ok = { headline: "h", summary: "s", keywords: ["a", "b", "c"] };
    expect(SECTIONS.overview.schema.safeParse(ok).success).toBe(true);
    expect(SECTIONS.overview.schema.safeParse({ ...ok, keywords: ["a", "b"] }).success).toBe(false);
  });

  it("personality 는 TitledText 배열", () => {
    const item = { title: "t", body: "b" };
    expect(SECTIONS.personality.schema.safeParse([item, item]).success).toBe(true);
    expect(SECTIONS.personality.schema.safeParse([item]).success).toBe(false);
    expect(SECTIONS.personality.schema.safeParse([{ label: "t", body: "b" }]).success).toBe(false);
  });

  it("daeunOutlook 은 rows/summary/emphasis 를 요구한다", () => {
    const rows = [{ title: "t", desc: "d" }];
    expect(SECTIONS.daeunOutlook.schema.safeParse({ rows, summary: "s", emphasis: "e" }).success).toBe(true);
    expect(SECTIONS.daeunOutlook.schema.safeParse({ rows }).success).toBe(false);
  });
});
