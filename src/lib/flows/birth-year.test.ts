import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { sajuBirthYearOf } from "./birth-year";
import { buildYearOptions } from "@/app/flow/_lib/to-confirm";

// 1990-01-15 03:30(KST)생 — 그 해 입춘(2/4 무렵)보다 앞이라 달력 연도(1990)와
// 명리 연도(1989)가 갈린다. handler.test.ts 의 "태어난 해" 스위트와 같은 고정값이다.
const preIpchunBirth = {
  year: 1990, month: 1, day: 15, hour: 3, minute: 30, gender: "male", calendar: "solar",
} as const;

describe("sajuBirthYearOf", () => {
  it("입춘 전 출생은 달력 생년보다 명리 생년이 하나 작다", () => {
    expect(sajuBirthYearOf(analyze(preIpchunBirth))).toBe(1989);
  });
});

describe("buildYearOptions × sajuBirthYearOf — 선택 화면과 서버가 같은 자로 재는지", () => {
  it("칸 목록이 명리 출생 연도(1989)는 담고 그 앞해(1988)는 뺀다", () => {
    // 달력 연도(1990)로 걸렀다면 1989 도 함께 빠졌을 것이다 — 서버는 파는데
    // 화면이 감추는, 이 태스크가 막으려는 바로 그 어긋남이다.
    const birthYear = sajuBirthYearOf(analyze(preIpchunBirth));
    const years = buildYearOptions({
      currentYear: 1992,
      span: 5,
      birthYear,
      rangeOf: () => "",
      owned: new Map(),
    }).map((o) => o.year);

    expect(years).toContain(1989);
    expect(years).not.toContain(1988);
    expect(Math.min(...years)).toBe(1989);
  });
});
