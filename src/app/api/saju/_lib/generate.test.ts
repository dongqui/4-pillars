import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/saju-core";
import { StubGenerator } from "./generate";
import { SECTION_KEYS, parseSectionContent, type SectionKey } from "./sections";

const analysis = analyze({ year: 1990, month: 5, day: 15, hour: 10, gender: "male" });

describe("StubGenerator", () => {
  it("요청한 키만 채운다", async () => {
    const keys: SectionKey[] = ["overview", "strengths"];
    const out = await new StubGenerator().generateSections(analysis, keys);
    expect(Object.keys(out).sort()).toEqual([...keys].sort());
  });

  it("모든 섹션의 출력이 자기 스키마를 통과한다", async () => {
    const out = await new StubGenerator().generateSections(analysis, SECTION_KEYS);
    for (const key of SECTION_KEYS) {
      expect(parseSectionContent(key, out[key]), key).not.toBeNull();
    }
  });

  it("키가 비면 빈 객체", async () => {
    expect(await new StubGenerator().generateSections(analysis, [])).toEqual({});
  });

  it("model 을 노출한다", () => {
    expect(new StubGenerator().model).toBe("stub");
  });
});
