// 그 해를 몇 구간으로 나눌 것인가 — 명리가 아니라 **편집 규칙**이라 서비스에 산다.
//
// 기획서 §12: 변화가 크지 않으면 굳이 여러 구간을 만들지 않는다.
// 기획서 §4:  12개월을 모두 해설하지 않는다 — 12개를 계산하되 최대 3구간만 노출한다.

import {
  daeunSwitchIn,
  flowYearAt,
  monthTermsOf,
  sewunPillars,
  type MonthTerm,
  type SajuAnalysis,
} from "@/lib/saju-core";
import { frictionOf, parsePillar2, supportOf, type FrictionTargets } from "./score";

export const SEGMENT_IDS = ["segment_1", "segment_2", "segment_3"] as const;
export type SegmentId = (typeof SEGMENT_IDS)[number];

export interface FlowSegment {
  id: SegmentId;
  /** ISO instant */
  start: string;
  /** ISO instant */
  end: string;
  basis: "연시작" | "대운전환" | "월운전환";
}

export interface MonthScore {
  term: MonthTerm;
  support: number;
  friction: number;
}

/**
 * ⚠️ 이 값 하나가 구간 개수를 정한다.
 *
 * strength.ts 의 STRENGTH_THRESHOLDS 와 같은 성격의 상수다 — 근거는 이론이 아니라
 * 분포다. scripts/flow-threshold.mts 로 1960~2005년 5년 간격 생년(10명) × 생일 4개
 * × 남녀 × 2025~2027 세 해를 돌려 총 240건의 Δ 분포를 뽑았다.
 *
 * 측정값 (임계값별 [1구간, 2구간, 3구간] 비율, 0.05 간격 발췌):
 *   0.20 → 1구간  0.0% · 2구간 14.2% · 3구간 85.8%  (3구간 쏠림, 기각)
 *   0.35 → 1구간  0.0% · 2구간 27.5% · 3구간 72.5%  (3구간 쏠림, 기각)
 *   0.50 → 1구간  0.0% · 2구간 43.8% · 3구간 56.3%  (2구간 과반 미달, 기각)
 *   0.60 → 1구간  0.0% · 2구간 52.1% · 3구간 47.9%  (1구간 0건, 기각)
 *   0.65 → 1구간  1.3% · 2구간 57.9% · 3구간 40.8%  (통과 조건을 처음 만족)
 *   0.75 → 1구간  4.6% · 2구간 63.7% · 3구간 31.7%  (여유 있게 통과, 채택)
 *   0.90 → 1구간 22.1% · 2구간 63.7% · 3구간 14.2%  (3구간이 희귀해짐)
 *   1.00 → 1구간 32.1% · 2구간 62.9% · 3구간  5.0%  (3구간 거의 소멸)
 *
 * 0.65 부터 통과 조건(2구간 과반 · 1·3구간 둘 다 0 아님)을 만족하지만 1구간이
 * 240건 중 3건뿐이라 근처 값으로 흔들리면 다시 0건이 될 만큼 얇다. 0.75 를
 * 최종값으로 쓴다 — 2구간이 최빈값(63.7%, 과반)이고 1구간(4.6%)·3구간(31.7%)
 * 모두 여유 있게 관측된다.
 *
 * 올리면 구간이 줄고(1구간이 흔해진다) 내리면 늘어난다(3구간이 흔해진다).
 * 바꾸기 전에 스크립트를 다시 돌릴 것 — 이미 판 흐름은 flows.segments 에 박제돼
 * 있어 소급되지 않지만, 새로 파는 흐름의 성격이 통째로 달라진다.
 */
export const FLOW_SEGMENT_THRESHOLD = 0.75;

/** 구간이 이보다 짧으면 전환으로 치지 않는다. */
export const MIN_SEGMENT_MONTHS = 3;

/** 최대 전환 수. 2 = 최대 3구간. */
export const MAX_TRANSITIONS = 2;

const MONTH_MS = 30 * 24 * 3600_000;

function targetsFor(analysis: SajuAnalysis, year: number): FrictionTargets {
  const c = analysis.chart;
  const sewun = parsePillar2(sewunPillars(year, 1)[0].korean);
  const period = flowYearAt(new Date(Date.UTC(year, 5, 1)));
  const sw = daeunSwitchIn(analysis, period);
  // 그해 대부분을 차지하는 대운을 대표로 쓴다. 전환이 있으면 전환 뒤쪽이 아니라
  // 앞쪽을 쓴다 — 연초부터 적용되는 쪽이다. 전환 자체는 후보로 따로 잰다.
  const current = sw?.before ?? currentDaeun(analysis, period);
  return {
    natal: [c.year.branch, c.month.branch, c.day.branch, c.hour?.branch].filter(
      (b): b is NonNullable<typeof b> => b != null,
    ),
    sewun: sewun!.branch,
    daeun: current.branch,
  };
}

/** 이 구간이 시작될 때 적용 중인 대운. */
function currentDaeun(analysis: SajuAnalysis, period: ReturnType<typeof flowYearAt>) {
  const { periods } = analysis.daeun;
  // 세는 나이 — periods[i].startAge 와 같은 기준이다.
  const ageAtStart = period.start.getUTCFullYear() - analysis.chart.solar.year + 1;
  return [...periods].reverse().find((p) => p.startAge <= ageAtStart) ?? periods[0];
}

/** 12개 월운 전부를 채점한다. */
export function monthScores(analysis: SajuAnalysis, year: number): MonthScore[] {
  const targets = targetsFor(analysis, year);
  return monthTermsOf(year).map((term) => {
    const p = parsePillar2(term.korean)!;
    return {
      term,
      support: supportOf(p, analysis.yongsin),
      friction: frictionOf(p.branch, targets),
    };
  });
}

interface Candidate {
  at: Date;
  delta: number;
  basis: "대운전환" | "월운전환";
}

/**
 * 그 해의 구간. 언제나 1~3개이고 틈도 겹침도 없다.
 *
 * 전환점은 벡터의 절대값이 아니라 **인접 구간 사이의 변화량**이다. 점수가 높은 달을
 * 고르면 "어디서부터 달라지는가" 가 아니라 "어느 달이 센가" 에 답하게 된다.
 */
export function flowSegments(analysis: SajuAnalysis, year: number): FlowSegment[] {
  const scores = monthScores(analysis, year);
  const yearStart = scores[0].term.start;
  const yearEnd = scores[scores.length - 1].term.end;

  const candidates: Candidate[] = [];

  for (let i = 1; i < scores.length; i += 1) {
    const delta =
      Math.abs(scores[i].support - scores[i - 1].support) +
      Math.abs(scores[i].friction - scores[i - 1].friction);
    candidates.push({ at: scores[i].term.start, delta, basis: "월운전환" });
  }

  // 대운 전환도 같은 자로 잰다 — 전후가 같은 편이면 구간을 쪼개지 않는다.
  const period = flowYearAt(new Date(Date.UTC(year, 5, 1)));
  const sw = daeunSwitchIn(analysis, period);
  if (sw) {
    const before = parsePillar2(sw.before.pillar)!;
    const after = parsePillar2(sw.after.pillar)!;
    const targets = targetsFor(analysis, year);
    const delta =
      Math.abs(supportOf(after, analysis.yongsin) - supportOf(before, analysis.yongsin)) +
      Math.abs(frictionOf(after.branch, targets) - frictionOf(before.branch, targets));
    candidates.push({ at: sw.at, delta, basis: "대운전환" });
  }

  // Δ 내림차순. 동점이면 이른 쪽 — 사용자는 지금부터 앞을 보고, 무엇보다
  // 결정적이어서 같은 입력이 같은 구간을 낸다.
  candidates.sort((a, b) => b.delta - a.delta || a.at.getTime() - b.at.getTime());

  const picked: Candidate[] = [];
  for (const c of candidates) {
    if (picked.length >= MAX_TRANSITIONS) break;
    if (c.delta < FLOW_SEGMENT_THRESHOLD) continue;
    const tooClose =
      c.at.getTime() - yearStart.getTime() < MIN_SEGMENT_MONTHS * MONTH_MS ||
      yearEnd.getTime() - c.at.getTime() < MIN_SEGMENT_MONTHS * MONTH_MS ||
      picked.some(
        (p) => Math.abs(p.at.getTime() - c.at.getTime()) < MIN_SEGMENT_MONTHS * MONTH_MS,
      );
    if (tooClose) continue;
    picked.push(c);
  }

  picked.sort((a, b) => a.at.getTime() - b.at.getTime());

  const bounds = [yearStart, ...picked.map((p) => p.at), yearEnd];
  return bounds.slice(0, -1).map((start, i) => ({
    id: SEGMENT_IDS[i],
    start: start.toISOString(),
    end: bounds[i + 1].toISOString(),
    basis: i === 0 ? ("연시작" as const) : picked[i - 1].basis,
  }));
}
