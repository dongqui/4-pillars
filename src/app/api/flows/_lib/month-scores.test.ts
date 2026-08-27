import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { flowYearOf } from "@/lib/saju-core";
import { currentDaeun, monthScores } from "./month-scores";

const BIRTH = {
  year: 1993,
  month: 4,
  day: 12,
  hour: 9,
  minute: 20,
  gender: "male",
  calendar: "solar",
} as const;

describe("monthScores", () => {
  it("한 해에 정확히 12개를 낸다", () => {
    expect(monthScores(analyze(BIRTH), 2027)).toHaveLength(12);
  });

  it("index 는 1부터 12까지 순서대로다", () => {
    const scores = monthScores(analyze(BIRTH), 2027);
    expect(scores.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("두 축은 -1…+1 언저리에 있다", () => {
    for (const s of monthScores(analyze(BIRTH), 2027)) {
      expect(s.support).toBeGreaterThanOrEqual(-1);
      expect(s.support).toBeLessThanOrEqual(1);
      expect(Math.abs(s.friction)).toBeLessThanOrEqual(1.5);
    }
  });

  it("관계 목록과 십성 그룹을 함께 싣는다 — 월별 서술의 재료다", () => {
    const scores = monthScores(analyze(BIRTH), 2027);
    // 12개 달 중 최소 하나는 원국·세운·대운과 관계를 맺는다
    expect(scores.some((s) => s.interactions.length > 0)).toBe(true);
    for (const s of scores) {
      expect(s.tenGods.length).toBeGreaterThan(0);
      expect(Array.isArray(s.interactions)).toBe(true);
      expect(typeof s.samhap).toBe("boolean");
    }
  });

  it("같은 입력이면 같은 결과다", () => {
    const a = monthScores(analyze(BIRTH), 2027);
    const b = monthScores(analyze(BIRTH), 2027);
    expect(a.map((s) => s.support)).toEqual(b.map((s) => s.support));
    expect(a.map((s) => s.friction)).toEqual(b.map((s) => s.friction));
  });

  it("시간 미상 프로필도 12개를 낸다", () => {
    // BirthInput.hour/minute 는 optional number 다(chart.ts) — "미상" 은
    // undefined 로 표현하지 null 이 아니다. hasHour = input.hour !== undefined
    // 판정이라 null 을 넣으면 오히려 "시간 있음" 취급된다.
    const noHour = analyze({ ...BIRTH, hour: undefined, minute: undefined });
    expect(monthScores(noHour, 2027)).toHaveLength(12);
  });
});

describe("currentDaeun", () => {
  it("그 구간 시작보다 이르거나 같은 전환 중 가장 늦은 회차를 고른다", () => {
    const a = analyze(BIRTH);
    const period = flowYearOf(2027);
    const picked = currentDaeun(a, period);
    expect(a.daeun.periods).toContain(picked);
  });

  it("유년기 대운으로 물러서지 않는다", () => {
    // 오름차순 배열에 find(p => p.startAge <= age) 를 쓰면 첫 칸(유년기)이 나온다.
    const a = analyze(BIRTH);
    const picked = currentDaeun(a, flowYearOf(2027));
    expect(picked).not.toBe(a.daeun.periods[0]);
  });
});
