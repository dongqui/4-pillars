import { describe, it, expect } from "vitest";
import { daysInMonth, clampDay, formatDate, formatTime, formatCalendarLabel } from "./date";

describe("date helpers", () => {
  it("daysInMonth: 평월/윤년 처리", () => {
    expect(daysInMonth(2021, 2)).toBe(28);
    expect(daysInMonth(2020, 2)).toBe(29); // 윤년
    expect(daysInMonth(1990, 4)).toBe(30);
    expect(daysInMonth(1990, 12)).toBe(31);
  });

  it("clampDay: 월 최대 일수로 제한", () => {
    expect(clampDay(2021, 2, 31)).toBe(28);
    expect(clampDay(1990, 5, 15)).toBe(15);
  });

  it("formatDate: 'YYYY. MM. DD.' zero-pad", () => {
    expect(formatDate({ y: 1990, m: 2, d: 20 })).toBe("1990. 02. 20.");
  });

  it("formatTime: 'HH:MM' zero-pad", () => {
    expect(formatTime({ h: 4, m: 30 })).toBe("04:30");
    expect(formatTime({ h: 14, m: 5 })).toBe("14:05");
  });
});

describe("formatCalendarLabel", () => {
  const birth = { y: 2020, m: 4, d: 1 };
  it("양력이면 '양력' 접두사를 붙인다", () => {
    expect(formatCalendarLabel("solar", false, birth)).toBe("양력 2020. 04. 01.");
  });
  it("음력 평달이면 '음력' 접두사를 붙인다", () => {
    expect(formatCalendarLabel("lunar", false, birth)).toBe("음력 2020. 04. 01.");
  });
  it("음력 윤달이면 '음력(윤달)' 접두사를 붙인다", () => {
    expect(formatCalendarLabel("lunar", true, birth)).toBe("음력(윤달) 2020. 04. 01.");
  });
  it("생년월일이 없으면 접두사 + '-'", () => {
    expect(formatCalendarLabel("solar", false, null)).toBe("양력 -");
  });
});
