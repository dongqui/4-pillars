import { describe, it, expect } from "vitest";
import type { ProfileRow } from "@/lib/profiles/store";
import { toBirthInput } from "./to-birth-input";

const base: ProfileRow = {
  id: "3",
  name: "홍길동",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1990, month: 2, day: 20 },
  timeKnown: true,
  time: { hour: 4, minute: 30 },
  birthPlace: { country: "KR", regionId: "busan" },
  trueSolar: true,
  createdAt: "2026-07-31T00:00:00.000Z",
  isPaid: false,
};

describe("toBirthInput", () => {
  it("생년월일·성별·달력을 그대로 옮긴다", () => {
    expect(toBirthInput(base)).toMatchObject({
      year: 1990,
      month: 2,
      day: 20,
      hour: 4,
      minute: 30,
      calendar: "solar",
      gender: "male",
    });
  });

  it("출생지가 있으면 그 지역 대표 경도를 쓴다", () => {
    // 부산 = 129.08 (src/lib/regions.ts)
    expect(toBirthInput(base).longitude).toBe(129.08);
  });

  // 퍼널은 브라우저 로케일로 국가 기본값을 골랐지만 서버에는 그 정보가 없고
  // 저장된 프로필에도 남아 있지 않다. saju-core 기본값(127, 서울)에 맡긴다.
  it("출생지를 건너뛴 프로필은 longitude 를 넘기지 않는다", () => {
    expect(toBirthInput({ ...base, birthPlace: null }).longitude).toBeUndefined();
  });

  it("모르는 지역·국가면 longitude 를 넘기지 않는다", () => {
    expect(
      toBirthInput({ ...base, birthPlace: { country: "KR", regionId: "atlantis" } }).longitude,
    ).toBeUndefined();
    expect(
      toBirthInput({ ...base, birthPlace: { country: "US", regionId: "hawaii" } }).longitude,
    ).toBeUndefined();
  });

  it("시간을 모르면 hour·minute 이 undefined — 시주가 생기지 않는다", () => {
    // timeKnown 은 ReportSubject 에 없다 — 시각을 버리는 판단은 프로필 행·드래프트를
    // 옮기는 쪽(toProfileRow · draftToSubject)에서 이미 끝나고, 여기는 time 만 본다.
    const input = toBirthInput({ ...base, time: null });
    expect(input.hour).toBeUndefined();
    expect(input.minute).toBeUndefined();
  });

  it("음력일 때만 isLeapMonth 를 넘긴다", () => {
    expect(toBirthInput({ ...base, calendar: "lunar", isLeapMonth: true }).isLeapMonth).toBe(true);
    expect(toBirthInput({ ...base, calendar: "solar", isLeapMonth: true }).isLeapMonth).toBeUndefined();
  });

  it("trueSolar 를 applyTimeCorrection 으로 넘긴다", () => {
    expect(toBirthInput(base).applyTimeCorrection).toBe(true);
    expect(toBirthInput({ ...base, trueSolar: false }).applyTimeCorrection).toBe(false);
  });
});
