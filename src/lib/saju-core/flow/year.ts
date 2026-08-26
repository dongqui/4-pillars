// 명리 연도(세운) — 입춘에서 바뀐다.
//
// 달력 연도와 다르다. 2026-01-20 은 달력으로 2026 년이지만 명리로는 아직 2025 년이다.
// 입춘은 천문학적 순간이라 전 세계 동일하다 — 서버 시간대나 사용자 locale 로
// 답이 달라지면 안 되므로 현재 시각을 인자로 받는다.

import { solarTermInstant } from "../astro/solar-term";

/** 입춘의 태양 황경. MONTH_TERMS 의 첫 항목과 같은 값이다. */
export const IPCHUN_LONGITUDE = 315;

export interface FlowYearPeriod {
  /** 명리 연도 */
  year: number;
  /** 그해 입춘 (포함) */
  start: Date;
  /** 다음 해 입춘 (제외) */
  end: Date;
}

/**
 * 주어진 순간이 속한 명리 연도와 그 경계.
 *
 * 달력 연도로 먼저 찍고 입춘 전이면 한 해 물러선다. 입춘이 2월 초라 UTC/KST 의
 * 연말 경계(1월 1일)와는 한 달 이상 떨어져 있어, 어느 시계로 연도를 읽든 같은
 * 답이 나온다.
 */
export function flowYearAt(at: Date): FlowYearPeriod {
  const guess = at.getUTCFullYear();
  const start = solarTermInstant(guess, IPCHUN_LONGITUDE);

  if (at.getTime() < start.getTime()) {
    return {
      year: guess - 1,
      start: solarTermInstant(guess - 1, IPCHUN_LONGITUDE),
      end: start,
    };
  }

  return {
    year: guess,
    start,
    end: solarTermInstant(guess + 1, IPCHUN_LONGITUDE),
  };
}
