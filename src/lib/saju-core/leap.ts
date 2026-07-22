import { LEAP_MONTHS } from "./data/leap-months";

/** 해당 음력 연도의 윤달 월(1~12). 없으면 null. */
export function getLeapMonth(year: number): number | null {
  return LEAP_MONTHS[year] ?? null;
}

/** 주어진 음력 연·월이 그 해의 윤달인지 여부. */
export function hasLeapMonth(year: number, month: number): boolean {
  return LEAP_MONTHS[year] === month;
}
