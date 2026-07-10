import { describe, it, expect } from "vitest";
import { parseRequest, ValidationError } from "./input";

const valid = {
  name: "홍길동",
  gender: "male",
  calendar: "solar",
  year: 1990,
  month: 5,
  day: 15,
  hour: 10,
  minute: 30,
};

describe("parseRequest", () => {
  it("유효한 입력을 파싱한다", () => {
    const { name, input } = parseRequest(valid);
    expect(name).toBe("홍길동");
    expect(input.year).toBe(1990);
    expect(input.gender).toBe("male");
    expect(input.hour).toBe(10);
  });

  it("hour 미입력을 허용한다", () => {
    const { input } = parseRequest({ ...valid, hour: undefined });
    expect(input.hour).toBeUndefined();
  });

  it("lunar 달력을 통과시킨다", () => {
    const { input } = parseRequest({ ...valid, calendar: "lunar", isLeapMonth: true });
    expect(input.calendar).toBe("lunar");
    expect(input.isLeapMonth).toBe(true);
  });

  it.each([
    ["본문이 객체가 아님", null],
    ["이름 누락", { ...valid, name: "" }],
    ["성별 오류", { ...valid, gender: "x" }],
    ["달력 오류", { ...valid, calendar: "julian" }],
    ["월 범위 밖", { ...valid, month: 13 }],
    ["일 범위 밖", { ...valid, day: 0 }],
    ["시 범위 밖", { ...valid, hour: 24 }],
    ["연도 누락", { ...valid, year: undefined }],
  ])("%s 이면 ValidationError", (_label, body) => {
    expect(() => parseRequest(body)).toThrow(ValidationError);
  });
});
