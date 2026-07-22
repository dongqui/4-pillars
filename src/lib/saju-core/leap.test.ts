import { describe, expect, it } from "vitest";
import { getLeapMonth, hasLeapMonth } from "./leap";

describe("getLeapMonth", () => {
  it("윤달이 있는 해는 윤달 월을 반환한다", () => {
    expect(getLeapMonth(2020)).toBe(4); // 윤4월
    expect(getLeapMonth(2025)).toBe(6);
  });
  it("윤달이 없는 해는 null을 반환한다", () => {
    expect(getLeapMonth(2021)).toBeNull();
  });
});

describe("hasLeapMonth", () => {
  it("해당 월이 그 해의 윤달이면 true", () => {
    expect(hasLeapMonth(2020, 4)).toBe(true);
  });
  it("윤달 월이 아니면 false", () => {
    expect(hasLeapMonth(2020, 5)).toBe(false);
    expect(hasLeapMonth(2021, 4)).toBe(false);
  });
});
