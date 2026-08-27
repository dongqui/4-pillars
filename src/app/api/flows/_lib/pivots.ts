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
 * 근거는 이론이 아니라 분포다. Task 5 에서 scripts/flow-threshold.mts 로 측정하고
 * 실측값을 이 주석에 남긴다. 그전까지는 앞선 설계(구간용)의 값을 자리에 둔다 —
 * **목적이 다르므로 이 값에는 근거가 없다.**
 */
export const PIVOT_THRESHOLD = 0.75;

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
 * 그 해의 12개월과 변곡점 플래그.
 *
 * 변곡점을 별도 배열이 아니라 월의 플래그로 두는 것이 요점이다 — 두 배열로 나누면
 * 07(월별 흐름)과 08(변곡점)이 서로 다른 달을 가리키는 상태가 표현 가능해진다.
 */
export function flowMonths(analysis: SajuAnalysis, year: number): FlowMonth[] {
  const scores = monthScores(analysis, year);
  const deltas = applyDaeunBonus(analysis, year, scores);

  // 첫 달을 뺀 나머지가 후보다. Δ 내림차순, 동점이면 이른 달 — 같은 입력이
  // 같은 결과를 내야 한다.
  const candidates = scores
    .slice(1)
    .map((s) => ({ index: s.index, delta: deltas[s.index - 1] }))
    // 동점 tie-break 를 명시한다. scores.slice(1) 이 이미 index 오름차순이고
    // ES2019 이후 Array#sort 는 안정 정렬이라 이 항 없이도 결과는 같다 — 하지만
    // "안정 정렬에 기대고 있다" 는 사실을 읽는 사람이 몰라도 되게, 의도를 코드로
    // 남겨 둔다. 지우지 말 것.
    .sort((a, b) => b.delta - a.delta || a.index - b.index);

  const picked: number[] = [];
  for (const c of candidates) {
    if (picked.length >= MAX_PIVOTS) break;
    if (c.delta < PIVOT_THRESHOLD) continue;
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

  const pivots = new Set(picked);
  return scores.map((s) => ({
    index: s.index,
    start: s.term.start.toISOString(),
    end: s.term.end.toISOString(),
    korean: s.term.korean,
    pivot: pivots.has(s.index),
  }));
}
