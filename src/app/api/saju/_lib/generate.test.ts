import { describe, it, expect } from "vitest";
import { analyze, type BirthInput } from "@/lib/saju-core";
import { StubGenerator } from "./generate";

const analysis = analyze({
  year: 1990,
  month: 5,
  day: 15,
  hour: 10,
  gender: "male",
  calendar: "solar",
} satisfies BirthInput);

describe("StubGenerator", () => {
  it("model이 stub", () => {
    expect(new StubGenerator().model).toBe("stub");
  });

  it("Interpretation 스키마를 채워 반환한다", async () => {
    const result = await new StubGenerator().generate(analysis);
    expect(result.ilgan.title).toBeTruthy();
    expect(result.ilgan.body).toContain(analysis.chart.dayMaster);
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(result.strengths.length).toBeGreaterThan(0);
    expect(Array.isArray(result.weaknesses)).toBe(true);
    expect(result.relationships.body).toBeTruthy();
  });

  it("같은 원국이면 같은 결과(결정적)", async () => {
    const g = new StubGenerator();
    expect(await g.generate(analysis)).toEqual(await g.generate(analysis));
  });
});
