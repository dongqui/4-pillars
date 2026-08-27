// 그 해 안에서 흐름의 방향이 실제로 달라지는 지점.
//
// 핵심은 절대값이 아니라 **인접한 달 사이의 변화량**이다. 점수가 높은 달을 고르면
// "어디서부터 달라지는가" 가 아니라 "어느 달이 센가" 에 답하게 된다.
//
// 여기서 쓰는 숫자는 support/friction 둘뿐이다. 십성과 관계 이름은 monthScores 가
// 함께 싣지만 판정에는 넣지 않는다 — 범주가 바뀌었다는 이유만으로 실제 세기 차이가
// 작아도 전환을 만들기 때문이다. "무엇이 변곡점인가" 와 "그 달이 무슨 의미인가" 는
// 다른 질문이다.

import { daeunSwitchIn, flowYearOf, type SajuAnalysis } from "@/lib/saju-core";
import { frictionOf, parsePillar2, supportOf } from "./score";
import { frictionTargets, monthScores, type MonthScore } from "./month-scores";

/** 상한. 넘치면 Δ 가 큰 쪽부터 채운다. */
export const MAX_PIVOTS = 4;

/** 변곡점끼리 이보다 가까우면 Δ 가 작은 쪽을 버린다. */
export const MIN_PIVOT_GAP_MONTHS = 2;

/**
 * ⚠️ 이 값 하나가 변곡점 개수를 정한다.
 *
 * 근거는 이론이 아니라 분포다. scripts/flow-threshold.mts 로 1960~2005년 5년
 * 간격 생년(10명) × 생일 4개 × {시간 있음, 시간 미상} × 남녀 × 2021~2031년(11개
 * 해, 상품이 파는 현재±5) = 총 1,760건의 effectiveDeltas(대운 전환 보너스 포함,
 * 실제 선정이 도는 그 배열) 를 뽑아 selectPivots 를 여러 임계값으로 스윕했다.
 * 표본 절반은 시간 미상(hour: undefined)이다 — Task 2 가 고친 friction 분모
 * 편향이 여기 안 잡히면 다시 낡은 계산으로 되돌아간 것과 같다.
 *
 * 측정값 (임계값별 [0개, 1개, 2개, 3개, 4개] 비율, 0.05 간격 발췌 + 정밀값):
 *   0.75 →  0.1% ·  4.9% · 29.3% · 41.5% · 24.3%  (4개 24.3%, 상한이 흔해짐 — 기각)
 *   0.80 →  0.3% ·  9.5% · 34.7% · 39.1% · 16.3%  (4개 여전히 10% 이상 — 기각)
 *   0.85 →  1.6% · 15.1% · 38.8% · 33.7% · 10.9%  (4개 10.9%, 아깝게 기각)
 *   0.86 →  1.9% · 15.9% · 38.8% · 33.6% ·  9.8%  (4개 처음으로 10% 아래 — 통과 시작)
 *   0.90 →  3.4% · 21.3% · 39.4% · 27.8% ·  8.1%  (통과, 1~3개 합 88.5%)
 *   0.93 →  4.2% · 24.7% · 37.7% · 26.6% ·  6.8%  (통과, 1~3개 합 89.0% — 전 구간 최댓값)
 *   1.00 →  8.2% · 31.5% · 34.1% · 21.1% ·  5.0%  (통과, 1~3개 합 86.8%로 하강 시작)
 *   1.05 → 14.3% · 34.5% · 32.8% · 15.1% ·  3.3%  (1~3개 합 82.4%로 더 하강 — 구간 밖)
 *   1.20 → 32.6% · 41.5% · 21.2% ·  4.4% ·  0.3%  (0개가 흔해짐 — 구간 밖)
 *
 * 채택 근거 (조건 순서대로):
 *   1. 1~3개 합이 임계값 전 구간(0.20~1.60)에서 0.93 부근이 최댓값(89.0%)이다.
 *      0.86~1.00 이 이 최댓값 부근의 고원(86.8~89.0%)을 이룬다.
 *   2. 그 고원 안에서 4개가 10% 미만인 지점은 0.86 부터다 — 0.85 는 10.9% 로
 *      막 넘겨 기각된다. 4개는 상한이지 기본값이면 안 된다.
 *   3. 0개는 0.86 이상에서 이미 0.0% 가 아니다(1.9%~) — 비율을 목표로 삼진
 *      않지만, "변화 없는 해엔 변곡점도 없다"(§21)가 구조적으로 막혀 있지
 *      않다는 확인이다.
 *   4. 조건 2·3을 만족하는 고원 구간은 [0.86, 1.00] — 그 가운데 값 0.93 을
 *      쓴다. 경계(0.86 또는 1.00)를 쓰면 표본이 살짝만 흔들려도 4개가 다시
 *      10%를 넘거나 1~3개 합이 눈에 띄게 꺾인다. 0.93 은 공교롭게도 그 구간의
 *      실측 최댓값과도 일치한다.
 *
 * 올리면 변곡점이 줄고 내리면 늘어난다. 바꾸기 전에 스크립트를 다시 돌릴 것 —
 * 이미 판 흐름은 flows.months 에 박제돼 소급되지 않지만, 새로 파는 흐름의
 * 성격이 통째로 달라진다.
 */
export const PIVOT_THRESHOLD = 0.93;

/** flows.months 에 박제되는 모양. 화면과 프롬프트가 이것만 본다. */
export interface FlowMonth {
  /** 1‥12. 명리 연도 안에서의 순서다 */
  index: number;
  /** ISO instant */
  start: string;
  /** ISO instant */
  end: string;
  /** 월운 간지 (한글) */
  korean: string;
  pivot: boolean;
}

/**
 * 인접한 달 사이의 변화량. 길이 12 이고 `[0]` 은 언제나 0 이다.
 *
 * 첫 달을 0 으로 두는 것은 계산 편의가 아니라 **정의**다. 세운이 입춘에 바뀌므로
 * 첫 달과 전년 마지막 달 사이의 Δ 는 거의 항상 크고, 넣으면 첫 달이 매년 변곡점이
 * 되어 신호가 아니라 상수가 된다. 그리고 "이 해가 어떤 해인가" 는 01 이 이미
 * 답한다 — 08 은 그 해가 시작된 뒤 **안에서** 달라지는 지점만 다룬다.
 */
export function monthDeltas(scores: MonthScore[]): number[] {
  return scores.map((s, i) =>
    i === 0
      ? 0
      : Math.abs(s.support - scores[i - 1].support) +
        Math.abs(s.friction - scores[i - 1].friction),
  );
}

/**
 * 그 해에 대운이 바뀌면, 전후 대운의 차이를 같은 자로 잰다.
 *
 * 대운 전환은 상품 경계가 아니지만(§3.4) 그 해에서 가장 큰 배경 변화일 수 있어
 * 변곡점 후보로 겨룬다. **다만 전환이 첫 달에 걸리면 후보가 되지 못한다** —
 * 첫 달이 후보에서 빠지는 규칙이 먼저다. 그 경우 전환은 01 의 연간 사실로 남는다.
 */
function daeunBonus(
  analysis: SajuAnalysis,
  year: number,
  scores: MonthScore[],
): { index: number; delta: number } | null {
  const sw = daeunSwitchIn(analysis, flowYearOf(year));
  if (!sw) return null;

  const before = parsePillar2(sw.before.pillar);
  const after = parsePillar2(sw.after.pillar);
  if (!before || !after) return null;

  const targets = frictionTargets(analysis, year);
  const delta =
    Math.abs(supportOf(after, analysis.yongsin) - supportOf(before, analysis.yongsin)) +
    Math.abs(frictionOf(after.branch, targets) - frictionOf(before.branch, targets));

  const at = sw.at.getTime();
  const hit = scores.find(
    (s) => at >= s.term.start.getTime() && at < s.term.end.getTime(),
  );
  return hit ? { index: hit.index, delta } : null;
}

/**
 * 후보 선정에 실제로 쓰이는 Δ — monthDeltas 에 대운 보너스를 더한 것.
 *
 * flowMonths 안에 갇혀 있으면 선정 알고리즘과 무관하게 "무엇이 후보였는가" 를
 * 볼 방법이 없다. 이 파일의 프로퍼티 테스트와, Task 5 에서 분포를 재는
 * scripts/flow-threshold.mts 둘 다 선정 *전* 의 Δ 를 그대로 봐야 해서 나눈다 —
 * 둘 중 하나만을 위해서였다면 나누지 않았을 것이다.
 */
export function effectiveDeltas(analysis: SajuAnalysis, year: number): number[] {
  return applyDaeunBonus(analysis, year, monthScores(analysis, year));
}

function applyDaeunBonus(analysis: SajuAnalysis, year: number, scores: MonthScore[]): number[] {
  const deltas = monthDeltas(scores);
  const bonus = daeunBonus(analysis, year, scores);
  if (bonus) deltas[bonus.index - 1] += bonus.delta;
  return deltas;
}

/**
 * Δ 배열에서 변곡점의 index(1‥12)를 고른다. `flowMonths` 의 선정 규칙 그 자체다 —
 * threshold 를 인자로 뺀 것은 scripts/flow-threshold.mts 가 이 함수를 그대로 불러
 * 여러 threshold 를 스윕하기 위해서다. 재구현하면 측정과 실제 선정이 각자
 * 틀려도 서로 맞다고 착각할 수 있다.
 */
export function selectPivots(deltas: readonly number[], threshold: number): number[] {
  // 첫 달(index 1)은 후보에서 빠진다 — 세운이 입춘에 바뀌므로 첫 달의 Δ 는 거의
  // 항상 크고, 넣으면 첫 달이 매년 변곡점이 되어 신호가 아니라 상수가 된다.
  // Δ 내림차순, 동점이면 이른 달 — 같은 입력이 같은 결과를 내야 한다.
  const candidates = deltas
    .map((delta, i) => ({ index: i + 1, delta }))
    .slice(1)
    // 동점 tie-break 를 명시한다. slice(1) 이 이미 index 오름차순이고 ES2019
    // 이후 Array#sort 는 안정 정렬이라 이 항 없이도 결과는 같다 — 하지만
    // "안정 정렬에 기대고 있다" 는 사실을 읽는 사람이 몰라도 되게, 의도를 코드로
    // 남겨 둔다. 지우지 말 것.
    .sort((a, b) => b.delta - a.delta || a.index - b.index);

  const picked: number[] = [];
  for (const c of candidates) {
    if (picked.length >= MAX_PIVOTS) break;
    if (c.delta < threshold) continue;
    // Δ 내림차순으로 훑기 때문에 보장되는 것은 "이 후보를 막은 이웃의 Δ 가 이
    // 후보보다 크다" 는 쌍(pairwise) 관계뿐이다 — "선정된 쪽은 항상 탈락한 쪽보다
    // 크다" 는 전역 보장이 아니다. 이미 뽑힌 달 옆이라 밀려난 후보 바로 다음 자리가
    // 간격을 벌리며 더 작은 Δ 로 뽑힐 수 있다(예: 1985-06-20/여성/2028 표본 —
    // 4번째달 Δ0.879 로 먼저 뽑히고, 5번째달 Δ0.871 은 4번째달과 너무 가까워
    // 탈락하지만, 6번째달 Δ0.767 은 4번째달과 간격이 벌어져 뽑힌다. 최종 {4,6}:
    // 더 작은 Δ 가 더 큰 Δ 옆에서 살아남는다).
    const tooClose = picked.some((p) => Math.abs(p - c.index) < MIN_PIVOT_GAP_MONTHS);
    if (tooClose) continue;
    picked.push(c.index);
  }

  return picked;
}

/**
 * 그 해의 12개월과 변곡점 플래그.
 *
 * 변곡점을 별도 배열이 아니라 월의 플래그로 두는 것이 요점이다 — 두 배열로 나누면
 * 07(월별 흐름)과 08(변곡점)이 서로 다른 달을 가리키는 상태가 표현 가능해진다.
 */
export function flowMonths(analysis: SajuAnalysis, year: number): FlowMonth[] {
  const scores = monthScores(analysis, year);
  const deltas = applyDaeunBonus(analysis, year, scores);
  const pivots = new Set(selectPivots(deltas, PIVOT_THRESHOLD));

  return scores.map((s) => ({
    index: s.index,
    start: s.term.start.toISOString(),
    end: s.term.end.toISOString(),
    korean: s.term.korean,
    pivot: pivots.has(s.index),
  }));
}
