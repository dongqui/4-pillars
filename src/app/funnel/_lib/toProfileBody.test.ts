import { describe, it, expect } from "vitest";
import type { FunnelData } from "../_context/FunnelContext";
import { toProfileBody } from "./toProfileBody";

const full: FunnelData = {
  name: "  김동진  ",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { y: 1990, m: 10, d: 25 },
  timeKnown: true,
  time: { h: 15, m: 20 },
  birthPlace: { country: "KR", regionId: "seoul" },
  trueSolar: true,
};

describe("toProfileBody", () => {
  it("퍼널 입력을 API 본문 모양으로 옮긴다", () => {
    expect(toProfileBody(full)).toEqual({
      name: "김동진",
      gender: "male",
      calendar: "solar",
      isLeapMonth: false,
      birth: { year: 1990, month: 10, day: 25 },
      timeKnown: true,
      time: { hour: 15, minute: 20 },
      birthPlace: { country: "KR", regionId: "seoul" },
      trueSolar: true,
    });
  });

  it("시간을 건너뛰면 time 은 null", () => {
    const body = toProfileBody({ ...full, timeKnown: false, time: null });
    expect(body.timeKnown).toBe(false);
    expect(body.time).toBeNull();
  });

  it("timeKnown 이 true 라도 값이 없으면 null", () => {
    expect(toProfileBody({ ...full, time: null }).time).toBeNull();
  });

  it("양력이면 윤달 표시를 버린다", () => {
    expect(toProfileBody({ ...full, isLeapMonth: true }).isLeapMonth).toBe(false);
  });

  it("음력이면 윤달 표시를 유지한다", () => {
    const body = toProfileBody({ ...full, calendar: "lunar", isLeapMonth: true });
    expect(body.isLeapMonth).toBe(true);
  });

  it("출생지를 건너뛰면 null", () => {
    expect(toProfileBody({ ...full, birthPlace: null }).birthPlace).toBeNull();
  });

  it("생년월일이나 성별이 없으면 던진다", () => {
    expect(() => toProfileBody({ ...full, birth: null })).toThrow();
    expect(() => toProfileBody({ ...full, gender: null })).toThrow();
  });
});
