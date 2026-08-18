import { describe, it, expect } from "vitest";
import { addPersonSchema } from "./input";

const ok = { name: "민수", birth: { year: 1990, month: 5, day: 15 } };

describe("addPersonSchema", () => {
  it("이름과 생년월일만으로 통과하고 기본값이 채워진다", () => {
    const parsed = addPersonSchema.parse(ok);
    expect(parsed).toEqual({
      name: "민수",
      birth: { year: 1990, month: 5, day: 15 },
      calendar: "solar",
      isLeapMonth: false,
    });
  });

  it("이름 앞뒤 공백을 자른다", () => {
    expect(addPersonSchema.parse({ ...ok, name: "  민수  " }).name).toBe("민수");
  });

  it("빈 이름과 21자 이름을 거절한다", () => {
    expect(addPersonSchema.safeParse({ ...ok, name: "  " }).success).toBe(false);
    expect(addPersonSchema.safeParse({ ...ok, name: "가".repeat(21) }).success).toBe(false);
  });

  it("1900년 이전과 내년을 거절한다", () => {
    const next = new Date().getFullYear() + 1;
    expect(addPersonSchema.safeParse({ ...ok, birth: { year: 1899, month: 1, day: 1 } }).success).toBe(false);
    expect(addPersonSchema.safeParse({ ...ok, birth: { year: next, month: 1, day: 1 } }).success).toBe(false);
  });

  it("월·일 범위를 거절한다", () => {
    expect(addPersonSchema.safeParse({ ...ok, birth: { year: 1990, month: 13, day: 1 } }).success).toBe(false);
    expect(addPersonSchema.safeParse({ ...ok, birth: { year: 1990, month: 1, day: 32 } }).success).toBe(false);
  });

  it("시각·성별·출생지를 받아도 결과에 담지 않는다", () => {
    const parsed = addPersonSchema.parse({ ...ok, gender: "male", time: { hour: 3, minute: 0 } });
    expect(parsed).not.toHaveProperty("gender");
    expect(parsed).not.toHaveProperty("time");
  });
});
