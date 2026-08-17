import { describe, expect, it } from "vitest";
import { digitsOnly, emptyDraft, toCounterpart, type Draft } from "./to-counterpart";

const valid: Draft = {
  ...emptyDraft,
  name: "김상대",
  y: "1990",
  m: "4",
  d: "5",
  h: "9",
  min: "30",
};

describe("toCounterpart", () => {
  it("완전한 입력이면 CreateProfileBody 를 만든다", () => {
    expect(toCounterpart(valid, 2026)).toEqual({
      name: "김상대",
      gender: "male",
      calendar: "solar",
      isLeapMonth: false,
      birth: { year: 1990, month: 4, day: 5 },
      timeKnown: true,
      time: { hour: 9, minute: 30 },
      birthPlace: null,
      trueSolar: true,
    });
  });

  it("이름이 공백뿐이면 null", () => {
    expect(toCounterpart({ ...valid, name: "  " }, 2026)).toBeNull();
  });

  it("연도가 4자리를 못 채우면 null", () => {
    expect(toCounterpart({ ...valid, y: "199" }, 2026)).toBeNull();
  });

  it("연도가 하한(1900) 밑이면 null", () => {
    expect(toCounterpart({ ...valid, y: "1899" }, 2026)).toBeNull();
  });

  it("연도가 올해(currentYear)를 넘으면 null", () => {
    expect(toCounterpart({ ...valid, y: "2027" }, 2026)).toBeNull();
  });

  it("올해와 같은 연도는 허용한다", () => {
    expect(toCounterpart({ ...valid, y: "2026" }, 2026)).not.toBeNull();
  });

  it("월이 0이면 null", () => {
    expect(toCounterpart({ ...valid, m: "0" }, 2026)).toBeNull();
  });

  it("월이 13이면 null", () => {
    expect(toCounterpart({ ...valid, m: "13" }, 2026)).toBeNull();
  });

  it("그 달의 마지막 날을 넘는 일은 null (4월 31일)", () => {
    expect(toCounterpart({ ...valid, m: "4", d: "31" }, 2026)).toBeNull();
  });

  it("윤년 2월 29일은 유효하다", () => {
    const result = toCounterpart({ ...valid, y: "2024", m: "2", d: "29" }, 2026);
    expect(result?.birth).toEqual({ year: 2024, month: 2, day: 29 });
  });

  it("평년 2월 29일은 null", () => {
    expect(toCounterpart({ ...valid, y: "2023", m: "2", d: "29" }, 2026)).toBeNull();
  });

  it("시가 24 이상이면 null", () => {
    expect(toCounterpart({ ...valid, h: "24" }, 2026)).toBeNull();
  });

  it("분이 60 이상이면 null", () => {
    expect(toCounterpart({ ...valid, min: "60" }, 2026)).toBeNull();
  });

  it("시간을 모르면 시/분 없이도 유효하고 time 은 null", () => {
    const result = toCounterpart({ ...valid, timeKnown: false, h: "", min: "" }, 2026);
    expect(result).not.toBeNull();
    expect(result?.time).toBeNull();
    expect(result?.timeKnown).toBe(false);
  });

  it("시간을 안다면서 시/분이 비어 있으면 null", () => {
    expect(toCounterpart({ ...valid, timeKnown: true, h: "", min: "" }, 2026)).toBeNull();
  });

  it("양력에서는 윤달 플래그를 무시한다", () => {
    const result = toCounterpart({ ...valid, calendar: "solar", isLeapMonth: true }, 2026);
    expect(result?.isLeapMonth).toBe(false);
  });

  it("음력 윤달 플래그는 그대로 반영한다", () => {
    const result = toCounterpart({ ...valid, calendar: "lunar", isLeapMonth: true }, 2026);
    expect(result?.isLeapMonth).toBe(true);
  });
});

describe("digitsOnly", () => {
  it("숫자가 아닌 문자를 지운다", () => {
    expect(digitsOnly("19a9b0", 10)).toBe("1990");
  });

  it("최대 길이로 자른다", () => {
    expect(digitsOnly("199012", 4)).toBe("1990");
  });
});
