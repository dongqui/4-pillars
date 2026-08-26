// 월운(月運) — 명리 연도 하나를 12개 절기 구간으로 자른다.
//
// 이 12개를 사용자에게 다 보여주지 않는다. 전환점을 고르기 위한 계산 해상도일 뿐이고,
// 노출은 최대 3구간이다(기획서 §4: 12개월을 모두 해설하지 않는다).

import { calculateSajuSimple } from "@fullstackfamily/manseryeok";
import { MONTH_TERMS, solarTermInstant } from "../astro/solar-term";
import { flowYearAt, IPCHUN_LONGITUDE } from "./year";

export interface MonthTerm {
  /** 절기 이름 (입춘·경칩 …) */
  name: string;
  /** 이 절기가 드는 순간 (포함) */
  start: Date;
  /** 다음 절기가 드는 순간 (제외) */
  end: Date;
  /** 월운 간지 (한글) */
  korean: string;
  /** 월운 간지 (한자) */
  hanja: string;
}

/** 절대 시각을 KST 민간 날짜로 읽는다. manseryeok 은 민간 날짜를 받는다. */
function kstCivil(at: Date): { year: number; month: number; day: number } {
  const shifted = new Date(at.getTime() + 9 * 3600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * 명리 연도 하나의 12개 절기 구간.
 *
 * 절기 시각은 달력 연도로 계산되는데 소한(황경 285)만 다음 달력 연도에 든다.
 * 황경별로 예외를 손으로 적는 대신, **입춘보다 앞서면 한 해 민다** 는 규칙 하나로
 * 접는다 — 절기가 늘거나 순서가 바뀌어도 이 규칙은 그대로 맞는다.
 *
 * 간지는 구간의 **중간 지점**에서 읽는다. 경계에서 읽으면 초 단위 오차가 이웃 달로
 * 넘어갈 수 있다.
 */
export function monthTermsOf(year: number): MonthTerm[] {
  const yearStart = solarTermInstant(year, IPCHUN_LONGITUDE);
  const nextYearStart = solarTermInstant(year + 1, IPCHUN_LONGITUDE);

  const starts = MONTH_TERMS.map((t) => {
    const sameYear = solarTermInstant(year, t.longitude);
    return {
      name: t.name,
      at: sameYear.getTime() < yearStart.getTime()
        ? solarTermInstant(year + 1, t.longitude)
        : sameYear,
    };
  }).sort((a, b) => a.at.getTime() - b.at.getTime());

  return starts.map((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].at : nextYearStart;
    const mid = new Date((s.at.getTime() + end.getTime()) / 2);
    const civil = kstCivil(mid);
    const saju = calculateSajuSimple(civil.year, civil.month, civil.day);
    return {
      name: s.name,
      start: s.at,
      end,
      korean: saju.monthPillar,
      hanja: saju.monthPillarHanja,
    };
  });
}

/** 주어진 순간이 속한 월운 구간. 못 찾으면 null (범위 밖). */
export function monthTermAt(at: Date): MonthTerm | null {
  const { year } = flowYearAt(at);
  const t = at.getTime();
  return (
    monthTermsOf(year).find((m) => t >= m.start.getTime() && t < m.end.getTime()) ?? null
  );
}
