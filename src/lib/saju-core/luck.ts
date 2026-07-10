// 대운(大運) — 10년 단위 운의 흐름
//
// 방향: 양남음녀 順行, 음남양녀 逆行 (년간 음양 × 성별).
// 대운수(시작 나이): 순행=출생→다음 節氣, 역행=출생→이전 節氣 까지의 일수 ÷ 3 (3일=1년).
// 간지: 월주에서 60갑자를 순/역으로 한 칸씩 전개, 각 대운 10년.

import { getPillarById, getPillarByHangul } from "@fullstackfamily/manseryeok";
import type { Chart } from "./chart";
import { STEMS, type Stem } from "./data/stems";
import type { Branch } from "./data/branches";
import { MONTH_TERMS, gregorianToJD, solarTermJD } from "./astro/solar-term";

export type LuckDirection = "순행" | "역행";

export interface DaeunPeriod {
  /** 1부터 시작하는 순번 */
  index: number;
  /** 이 대운이 시작되는 나이 (세는 나이 기준 대운수 + (index-1)*10) */
  startAge: number;
  pillar: string;
  pillarHanja: string;
  stem: Stem;
  branch: Branch;
}

export interface Daeun {
  direction: LuckDirection;
  /** 반올림한 시작 나이(대운수) */
  daeunSu: number;
  /** 정밀 시작 나이 (일수/3) */
  startAgePrecise: number;
  /** 기준 절기까지의 일수 */
  daysToTerm: number;
  /** 기준이 된 절기 이름 */
  basisTerm: string;
  periods: DaeunPeriod[];
}

function birthJD(chart: Chart): number {
  const s = chart.solar;
  const dayFrac = s.day + ((s.hour ?? 0) + s.minute / 60) / 24;
  return gregorianToJD(s.year, s.month, dayFrac);
}

/** 출생 연도 전후 3년치 월(月) 절기를 시간순으로 모은다. */
function monthTermsAround(year: number): { name: string; jd: number }[] {
  const out: { name: string; jd: number }[] = [];
  for (const y of [year - 1, year, year + 1]) {
    for (const t of MONTH_TERMS) {
      out.push({ name: t.name, jd: solarTermJD(y, t.longitude) });
    }
  }
  out.sort((a, b) => a.jd - b.jd);
  return out;
}

export function computeDaeun(chart: Chart, options?: { count?: number }): Daeun {
  const count = options?.count ?? 9;
  const isYang = STEMS[chart.year.stem].yinYang === "양";
  const isMale = chart.gender === "male";
  const forward = isYang === isMale; // 양남·음녀 → 순행
  const direction: LuckDirection = forward ? "순행" : "역행";

  const bj = birthJD(chart);
  const terms = monthTermsAround(chart.solar.year);
  let prev: { name: string; jd: number } | undefined;
  let next: { name: string; jd: number } | undefined;
  for (const t of terms) {
    if (t.jd <= bj) prev = t;
    else if (!next) next = t;
  }

  const basis = forward ? next : prev;
  const days = forward ? next!.jd - bj : bj - prev!.jd;
  const startAgePrecise = days / 3;
  const daeunSu = Math.round(startAgePrecise);

  const monthPillar = getPillarByHangul(chart.month.korean);
  if (!monthPillar) throw new Error(`월주를 찾을 수 없음: ${chart.month.korean}`);

  const periods: DaeunPeriod[] = [];
  for (let k = 1; k <= count; k++) {
    const id = (((monthPillar.id + (forward ? k : -k)) % 60) + 60) % 60;
    const p = getPillarById(id);
    periods.push({
      index: k,
      startAge: daeunSu + (k - 1) * 10,
      pillar: p.combined.hangul,
      pillarHanja: p.combined.hanja,
      stem: p.tiangan.hangul as Stem,
      branch: p.dizhi.hangul as Branch,
    });
  }

  return {
    direction,
    daeunSu,
    startAgePrecise,
    daysToTerm: days,
    basisTerm: basis!.name,
    periods,
  };
}
