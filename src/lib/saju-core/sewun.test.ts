import { describe, it, expect } from "vitest";
import { sewunPillars } from "./sewun";

describe("sewunPillars", () => {
  it("요청한 개수만큼 연속된 연도를 돌려준다", () => {
    const out = sewunPillars(2026, 3);
    expect(out.map((s) => s.year)).toEqual([2026, 2027, 2028]);
  });

  it("알려진 간지와 맞는다 (1984 갑자, 2024 갑진)", () => {
    expect(sewunPillars(1984, 1)[0]).toMatchObject({ korean: "갑자", hanja: "甲子" });
    expect(sewunPillars(2024, 1)[0]).toMatchObject({ korean: "갑진", hanja: "甲辰" });
  });

  it("연이은 해는 60갑자에서 한 칸씩 움직인다", () => {
    const [a, b] = sewunPillars(2026, 2);
    expect(a.korean).toBe("병오");
    expect(b.korean).toBe("정미");
  });

  it("count 가 0이면 빈 배열", () => {
    expect(sewunPillars(2026, 0)).toEqual([]);
  });
});
