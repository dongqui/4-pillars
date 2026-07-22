import { describe, expect, it } from "vitest";
import { lunarToSolar } from "@fullstackfamily/manseryeok";
import { LEAP_MONTHS } from "./data/leap-months";

// lunarToSolar(y, m, 1, true)는 윤달이 있는 월에는 양력 날짜를 반환하고,
// 없는 월에는 InvalidDateError를 던진다. 이를 이용해 표를 재산출·검증한다.
function computeLeapMonths(): Record<number, number> {
  const out: Record<number, number> = {};
  for (let y = 1930; y <= 2050; y++) {
    for (let m = 1; m <= 12; m++) {
      try {
        lunarToSolar(y, m, 1, true);
        out[y] = m; // 한 해에 윤달은 최대 1회
        break;
      } catch {
        // 이 월엔 윤달 없음 — 계속
      }
    }
  }
  return out;
}

describe("LEAP_MONTHS", () => {
  it("manseryeok(1930~2050) 산출과 정확히 일치한다", () => {
    expect(LEAP_MONTHS).toEqual(computeLeapMonths());
  });
});
