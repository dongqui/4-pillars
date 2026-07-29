// 세운(歲運) — 특정 연도의 간지
//
// 원국·대운과 달리 출생 정보와 무관하다. "그 해가 무슨 해인가"만 구한다.
// 연주는 입춘에서 바뀌므로 6월 1일로 조회한다 — 입춘(2월 초)과 다음 입춘 사이
// 어디에 두어도 같은 값이지만, 경계에서 헷갈릴 여지가 없는 날짜를 고른다.

import { calculateSajuSimple } from "@fullstackfamily/manseryeok";

export interface SewunYear {
  year: number;
  /** 한글 간지 (예: "병오") */
  korean: string;
  /** 한자 간지 (예: "丙午") */
  hanja: string;
}

/**
 * startYear 부터 count 개 연도의 세운 간지.
 *
 * ⚠️ manseryeok 지원 범위(1900~2050) 밖 연도는 예외를 던진다.
 */
export function sewunPillars(startYear: number, count: number): SewunYear[] {
  const out: SewunYear[] = [];
  for (let i = 0; i < count; i += 1) {
    const year = startYear + i;
    const saju = calculateSajuSimple(year, 6, 1);
    out.push({ year, korean: saju.yearPillar, hanja: saju.yearPillarHanja });
  }
  return out;
}
