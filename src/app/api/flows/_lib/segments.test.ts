import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { flowSegments, monthScores, SEGMENT_IDS } from "./segments";

const subject = analyze({
  year: 1990,
  month: 6,
  day: 15,
  hour: 10,
  minute: 30,
  gender: "male",
  calendar: "solar",
});

describe("monthScores", () => {
  it("12개 월운 전부를 채점한다 — 계산 해상도는 12, 노출은 최대 3", () => {
    expect(monthScores(subject, 2026)).toHaveLength(12);
  });

  it("두 축 다 정규화 범위 안이다", () => {
    for (const s of monthScores(subject, 2026)) {
      expect(s.support).toBeGreaterThanOrEqual(-1);
      expect(s.support).toBeLessThanOrEqual(1);
      expect(Math.abs(s.friction)).toBeLessThanOrEqual(2);
    }
  });
});

describe("flowSegments", () => {
  const segs = flowSegments(subject, 2026);

  it("언제나 1~3개다", () => {
    expect(segs.length).toBeGreaterThanOrEqual(1);
    expect(segs.length).toBeLessThanOrEqual(3);
  });

  it("id 는 순서대로 붙는다", () => {
    expect(segs.map((s) => s.id)).toEqual(SEGMENT_IDS.slice(0, segs.length));
  });

  it("첫 구간은 연시작이다", () => {
    expect(segs[0].basis).toBe("연시작");
  });

  it("틈도 겹침도 없다 — 한 구간의 end 가 다음 구간의 start 다", () => {
    for (let i = 0; i < segs.length - 1; i += 1) {
      expect(segs[i].end).toBe(segs[i + 1].start);
    }
  });

  it("전체가 그 명리 연도를 덮는다", () => {
    const all = flowSegments(subject, 2026);
    const months = monthScores(subject, 2026);
    expect(all[0].start).toBe(months[0].term.start.toISOString());
    expect(all[all.length - 1].end).toBe(months[11].term.end.toISOString());
  });

  it("구간은 최소 3개월이다", () => {
    const MONTH_MS = 30 * 24 * 3600_000;
    for (const s of segs) {
      expect(Date.parse(s.end) - Date.parse(s.start)).toBeGreaterThanOrEqual(2.5 * MONTH_MS);
    }
  });

  it("같은 입력은 같은 구간을 낸다 — 동점 처리가 결정적이다", () => {
    expect(flowSegments(subject, 2026)).toEqual(flowSegments(subject, 2026));
  });

  it("여러 사람·여러 해를 돌려도 언제나 1~3개다", () => {
    for (const y of [2024, 2025, 2026, 2027]) {
      for (const g of ["male", "female"] as const) {
        const a = analyze({ year: 1985, month: 3, day: 3, hour: 7, minute: 0, gender: g, calendar: "solar" });
        const out = flowSegments(a, y);
        expect(out.length).toBeGreaterThanOrEqual(1);
        expect(out.length).toBeLessThanOrEqual(3);
      }
    }
  });
});
