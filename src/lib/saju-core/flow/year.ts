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
 * 명리 연도 하나의 경계.
 *
 * flowYearAt 의 형제다 — 이쪽은 시각이 아니라 **연도**로 묻는다. 사용자가 연도를
 * 고르는 화면(§26: 현재 ±5년)과, 이미 판 흐름의 flow_year 로 기간을 되짚는 자리가
 * 쓴다.
 */
export function flowYearOf(year: number): FlowYearPeriod {
  return {
    year,
    start: solarTermInstant(year, IPCHUN_LONGITUDE),
    end: solarTermInstant(year + 1, IPCHUN_LONGITUDE),
  };
}

/**
 * 주어진 순간이 속한 명리 연도와 그 경계.
 *
 * 달력 연도로 먼저 찍고 입춘 전이면 한 해 물러선다. 입춘이 2월 초라 UTC/KST 의
 * 연말 경계(1월 1일)와는 한 달 이상 떨어져 있어, 어느 시계로 연도를 읽든 같은
 * 답이 나온다.
 *
 * 경계 계산은 flowYearOf 에 위임한다 — 두 함수가 각자 절기를 재면 확인 화면과
 * 리포트가 다른 기간을 표시할 수 있다.
 */
export function flowYearAt(at: Date): FlowYearPeriod {
  const guess = at.getUTCFullYear();
  const start = solarTermInstant(guess, IPCHUN_LONGITUDE);
  return flowYearOf(at.getTime() < start.getTime() ? guess - 1 : guess);
}
