import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { MAX_PIVOTS, MIN_PIVOT_GAP_MONTHS, flowMonths } from "./pivots";

const BIRTH = {
  year: 1993, month: 4, day: 12, hour: 9, minute: 20,
  gender: "male", calendar: "solar",
} as const;

const YEARS = [2021, 2024, 2026, 2027, 2029, 2031];

describe("flowMonths", () => {
  it("언제나 12개를 낸다", () => {
    for (const y of YEARS) expect(flowMonths(analyze(BIRTH), y)).toHaveLength(12);
  });

  it("index 는 1‥12, 경계는 틈 없이 이어진다", () => {
    const months = flowMonths(analyze(BIRTH), 2027);
    expect(months.map((m) => m.index)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12]);
    for (let i = 1; i < months.length; i += 1) {
      expect(months[i].start).toBe(months[i - 1].end);
    }
  });

  it("첫 달은 절대 변곡점이 아니다", () => {
    // 세운이 입춘에 바뀌므로 첫 달의 Δ 는 거의 항상 크다. 넣으면 매년
    // 변곡점이 되어 신호가 아니라 상수가 된다. 그리고 그 이야기는 01 이 한다.
    for (const y of YEARS) {
      expect(flowMonths(analyze(BIRTH), y)[0].pivot).toBe(false);
    }
  });

  it("변곡점은 MAX_PIVOTS 개를 넘지 않는다", () => {
    for (const y of YEARS) {
      const n = flowMonths(analyze(BIRTH), y).filter((m) => m.pivot).length;
      expect(n).toBeLessThanOrEqual(MAX_PIVOTS);
    }
  });

  it("변곡점끼리 MIN_PIVOT_GAP_MONTHS 보다 가깝지 않다", () => {
    for (const y of YEARS) {
      const picked = flowMonths(analyze(BIRTH), y).filter((m) => m.pivot).map((m) => m.index);
      for (let i = 1; i < picked.length; i += 1) {
        expect(picked[i] - picked[i - 1]).toBeGreaterThanOrEqual(MIN_PIVOT_GAP_MONTHS);
      }
    }
  });

  it("같은 입력이면 같은 변곡점이 나온다", () => {
    const a = flowMonths(analyze(BIRTH), 2027).map((m) => m.pivot);
    const b = flowMonths(analyze(BIRTH), 2027).map((m) => m.pivot);
    expect(a).toEqual(b);
  });

  it("간격에 걸리면 Δ 가 큰 쪽이 남는다", () => {
    // Δ 내림차순으로 훑기 때문에 이미 뽑힌 것 옆의 작은 후보가 탈락한다.
    // 표본 전체에서 "인접한 두 달이 모두 변곡점" 인 경우가 없어야 한다.
    for (let y = 2015; y <= 2035; y += 1) {
      const picked = flowMonths(analyze(BIRTH), y).filter((m) => m.pivot).map((m) => m.index);
      const adjacent = picked.some((v, i) => i > 0 && v - picked[i - 1] < MIN_PIVOT_GAP_MONTHS);
      expect(adjacent).toBe(false);
    }
  });

  it("시간 미상 프로필도 변곡점을 받을 수 있다", () => {
    // BirthInput.hour/minute 는 optional number 다(chart.ts) — "미상" 은 undefined
    // 로 표현하지 null 이 아니다. hasHour = input.hour !== undefined 판정이라
    // null 을 넣으면 오히려 "시간 있음" 취급된다.
    const noHour = analyze({ ...BIRTH, hour: undefined, minute: undefined });
    const anyPivot = [2024, 2025, 2026, 2027, 2028].some((y) =>
      flowMonths(noHour, y).some((m) => m.pivot),
    );
    expect(anyPivot).toBe(true);
  });
});
