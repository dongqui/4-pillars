import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/saju-core";
import { toChartEvidence } from "./evidence";

const analysis = analyze({ year: 1990, month: 2, day: 20, hour: 4, minute: 30, gender: "male" });
const evidence = toChartEvidence(analysis, 2026);

describe("toChartEvidence", () => {
  it("시주가 있으면 기둥 4개를 시→년 순으로 낸다", () => {
    expect(evidence.pillars.map((p) => p.slot)).toEqual(["hour", "day", "month", "year"]);
  });

  it("시주가 없으면 기둥 3개", () => {
    const noHour = analyze({ year: 1990, month: 2, day: 20, gender: "male" });
    expect(toChartEvidence(noHour, 2026).pillars.map((p) => p.slot)).toEqual([
      "day",
      "month",
      "year",
    ]);
  });

  it("일주 천간을 일간으로 표시한다", () => {
    const day = evidence.pillars.find((p) => p.slot === "day");
    expect(day?.isDayMaster).toBe(true);
    expect(day?.stem.tenGod).toBe("일간 · 我");
  });

  it("각 칸은 한자·한글·오행을 모두 갖는다", () => {
    for (const col of evidence.pillars) {
      for (const cell of [col.stem, col.branch]) {
        expect(cell.char).toHaveLength(1);
        expect(cell.ko).toHaveLength(1);
        expect(["wood", "fire", "earth", "metal", "water"]).toContain(cell.element);
      }
    }
  });

  it("오행 막대는 5개이고 max 는 최댓값", () => {
    expect(evidence.elements).toHaveLength(5);
    const max = Math.max(...evidence.elements.map((e) => e.count));
    expect(new Set(evidence.elements.map((e) => e.max))).toEqual(new Set([max]));
  });

  it("음양 합은 집계 글자 수와 같다", () => {
    expect(evidence.yinYang.yang + evidence.yinYang.yin).toBe(analysis.elements.total);
  });

  it("신강약은 level 과 반올림 백분율", () => {
    expect(evidence.strength.level).toBe(analysis.strength.level);
    expect(evidence.strength.percent).toBe(Math.round(analysis.strength.ratio * 100));
  });

  it("태그에 용신·희신·신강약이 들어간다", () => {
    const labels = evidence.tags.map((t) => t.label);
    expect(labels.some((l) => l.startsWith("용신"))).toBe(true);
    expect(labels.some((l) => l.startsWith("희신"))).toBe(true);
    expect(labels).toContain(analysis.strength.level);
  });

  it("대운 띠는 한자 간지와 연령 구간을 준다", () => {
    expect(evidence.daeunStrip.length).toBe(analysis.daeun.periods.length);
    expect(evidence.daeunStrip[0].age).toMatch(/^\d+–\d+세$/);
  });

  it("현재 대운은 하나만 now 로 표시된다", () => {
    expect(evidence.daeunStrip.filter((d) => d.now).length).toBeLessThanOrEqual(1);
  });

  // luck.ts 의 startAge 는 "세는 나이" 기준이다. year 를 세는 나이로 정확히 환산하지 않으면
  // 경계에서 엉뚱한 대운이 now 로 잡히거나(혹은 아예 안 잡히는) 오프바이원 버그가 생긴다.
  // 실제 두 번째 대운(index 2) 구간을 기준으로 "안쪽/첫 해/마지막 해" 세 지점을 검증한다.
  describe("대운 now 판정 — 세는 나이 경계", () => {
    const targetPeriod = analysis.daeun.periods[1]; // 두 번째 대운
    const birthYear = analysis.chart.solar.year;
    // 세는 나이 = 해당 연도 - 출생 연도 + 1 → 역으로 연도 = 출생 연도 + 세는나이 - 1
    const firstYear = birthYear + targetPeriod.startAge - 1;
    const lastYear = firstYear + 9; // 대운 1개는 10년

    it("구간 안쪽 연도는 해당 대운만 now 로 표시한다", () => {
      const midYear = firstYear + 5;
      const strip = toChartEvidence(analysis, midYear).daeunStrip;
      const flagged = strip.filter((d) => d.now);
      expect(flagged).toHaveLength(1);
      expect(flagged[0].gan).toBe(targetPeriod.pillarHanja);
    });

    it("구간 첫 세는 나이 해는 해당 대운만 now 로 표시한다", () => {
      const strip = toChartEvidence(analysis, firstYear).daeunStrip;
      const flagged = strip.filter((d) => d.now);
      expect(flagged).toHaveLength(1);
      expect(flagged[0].gan).toBe(targetPeriod.pillarHanja);
    });

    it("구간 마지막 세는 나이 해는 해당 대운만 now 로 표시하고 다음 대운으로 넘어가지 않는다", () => {
      const strip = toChartEvidence(analysis, lastYear).daeunStrip;
      const flagged = strip.filter((d) => d.now);
      expect(flagged).toHaveLength(1);
      expect(flagged[0].gan).toBe(targetPeriod.pillarHanja);
    });
  });

  it("면책 문구가 붙는다", () => {
    expect(evidence.disclaimer.length).toBeGreaterThan(0);
  });
});
