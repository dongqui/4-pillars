import { describe, expect, it } from "vitest";
import { flowYearAt } from "./year";
import { monthTermsOf } from "./months";

describe("monthTermsOf", () => {
  const terms = monthTermsOf(2026);

  it("언제나 12개다", () => {
    expect(terms).toHaveLength(12);
  });

  it("입춘에서 시작한다", () => {
    expect(terms[0].name).toBe("입춘");
    expect(terms[0].start.getTime()).toBe(flowYearAt(new Date("2026-06-01T00:00:00Z")).start.getTime());
  });

  it("시간순이고 틈이 없다 — 한 칸의 end 가 다음 칸의 start 다", () => {
    for (let i = 0; i < terms.length - 1; i += 1) {
      expect(terms[i].end.getTime()).toBe(terms[i + 1].start.getTime());
    }
  });

  it("마지막 칸(소한)은 다음 달력 연도에 든다 — 명리 연도는 아직 2026 이다", () => {
    const last = terms[11];
    expect(last.name).toBe("소한");
    expect(last.start.getUTCFullYear()).toBe(2027);
    expect(flowYearAt(last.start).year).toBe(2026);
  });

  it("마지막 칸의 end 는 다음 입춘이다", () => {
    expect(terms[11].end.getTime()).toBe(flowYearAt(new Date("2026-06-01T00:00:00Z")).end.getTime());
  });

  it("각 칸에 월운 간지가 붙는다", () => {
    for (const t of terms) {
      expect(t.korean).toMatch(/^[가-힣]{2}$/);
      expect(t.hanja).toHaveLength(2);
    }
  });

  it("이웃한 두 칸의 간지는 다르다 — 60갑자에서 한 칸씩 움직인다", () => {
    const koreans = terms.map((t) => t.korean);
    expect(new Set(koreans).size).toBe(12);
  });
});
