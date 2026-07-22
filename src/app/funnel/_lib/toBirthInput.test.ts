import { describe, it, expect } from "vitest";
import { toBirthInput } from "./toBirthInput";
import type { FunnelData } from "../_context/FunnelContext";

function baseData(): FunnelData {
  return {
    name: "홍길동",
    gender: "male",
    calendar: "solar",
    isLeapMonth: false,
    birth: { y: 1990, m: 5, d: 20 },
    timeKnown: true,
    time: { h: 8, m: 30 },
    birthPlace: { country: "KR", regionId: "seoul" },
    trueSolar: true,
  };
}

describe("toBirthInput", () => {
  it("선택한 지역의 경도와 보정 여부를 매핑한다", () => {
    const input = toBirthInput(baseData());
    expect(input).toMatchObject({
      year: 1990,
      month: 5,
      day: 20,
      hour: 8,
      minute: 30,
      calendar: "solar",
      gender: "male",
      longitude: 126.98, // seoul
      applyTimeCorrection: true,
    });
  });

  it("출생지 스킵(null)이면 국가 기본 경도(서울)를 쓴다", () => {
    const input = toBirthInput({ ...baseData(), birthPlace: null });
    expect(input.longitude).toBe(126.98);
  });

  it("시간을 모르면 hour/minute를 생략한다", () => {
    const input = toBirthInput({ ...baseData(), timeKnown: false, time: null });
    expect(input.hour).toBeUndefined();
    expect(input.minute).toBeUndefined();
  });

  it("trueSolar가 false면 보정을 끈다", () => {
    const input = toBirthInput({ ...baseData(), trueSolar: false });
    expect(input.applyTimeCorrection).toBe(false);
  });

  it("음력 윤달이면 isLeapMonth를 전달한다", () => {
    const input = toBirthInput({ ...baseData(), calendar: "lunar", isLeapMonth: true });
    expect(input.calendar).toBe("lunar");
    expect(input.isLeapMonth).toBe(true);
  });

  it("양력이면 isLeapMonth는 undefined다", () => {
    const input = toBirthInput({ ...baseData(), calendar: "solar", isLeapMonth: true });
    expect(input.isLeapMonth).toBeUndefined();
  });
});
