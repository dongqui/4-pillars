import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/saju-core";
import type { ProfileRow } from "@/lib/profiles/store";
import { toReportMeta } from "./to-meta";

const base: ProfileRow = {
  id: "3",
  name: "홍길동",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1990, month: 2, day: 20 },
  timeKnown: true,
  time: { hour: 4, minute: 30 },
  birthPlace: { country: "KR", regionId: "seoul" },
  trueSolar: true,
  createdAt: "2026-07-31T00:00:00.000Z",
  isPaid: false,
  kind: "self",
};

const chart = analyze({
  year: 1990, month: 2, day: 20, hour: 4, minute: 30, gender: "male",
}).chart;

// 일주는 만세력 계산 결과다 — 여기 값을 손으로 박으면 saju-core 를 테스트하게 된다.
const ilju = `${chart.day.korean}일주`;

describe("toReportMeta", () => {
  it("이름은 그대로 옮긴다", () => {
    expect(toReportMeta(base, chart).name).toBe("홍길동");
  });

  it("양력·날짜·시각·일주를 한 줄로", () => {
    expect(toReportMeta(base, chart).birthLine).toBe(`양력 1990.02.20 04:30 · ${ilju}`);
  });

  it("월·일·시·분을 두 자리로 채운다", () => {
    const p = { ...base, birth: { year: 2001, month: 3, day: 5 }, time: { hour: 9, minute: 7 } };
    expect(toReportMeta(p, chart).birthLine).toBe(`양력 2001.03.05 09:07 · ${ilju}`);
  });

  // 환산된 양력을 "음력"이라 적으면 사용자가 자기 입력을 알아보지 못한다.
  it("음력은 사용자가 입력한 음력 날짜를 그대로 쓴다", () => {
    const p = { ...base, calendar: "lunar" as const, birth: { year: 1963, month: 4, day: 12 } };
    expect(toReportMeta(p, chart).birthLine).toBe(`음력 1963.04.12 04:30 · ${ilju}`);
  });

  it("윤달을 표기한다", () => {
    const p = {
      ...base,
      calendar: "lunar" as const,
      isLeapMonth: true,
      birth: { year: 1963, month: 4, day: 12 },
    };
    expect(toReportMeta(p, chart).birthLine).toBe(`음력 1963.04.12 윤달 04:30 · ${ilju}`);
  });

  // 00:00 으로 적으면 자시 출생으로 읽힌다.
  it("시간을 모르면 시각을 뺀다", () => {
    const p = { ...base, timeKnown: false, time: null };
    expect(toReportMeta(p, chart).birthLine).toBe(`양력 1990.02.20 · ${ilju}`);
  });
});
