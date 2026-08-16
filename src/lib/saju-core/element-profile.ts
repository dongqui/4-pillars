// 오행 프로필 — 최다·결핍 판정과 귀인지도 문구
//
// 집계 자체는 elements.ts(원국 8자, 지지는 본기만)를 그대로 쓴다.
// 여기서 더하는 건 "무엇이 많고 무엇이 귀한가"의 판정 규칙뿐이다.
//
// 동률 규칙:
// - 결핍이 여럿이면 일간을 생하는 오행(생아)을 먼저 고른다.
//   귀인지도의 "귀한 기운"은 나를 돕는 기운이라는 관계 엔진(B07)의 정의와 맞춘다.
//   생아가 후보에 없으면 목·화·토·금·수 고정 순서로 정한다.
// - 최다가 여럿이면 고정 순서로만 정한다(많은 쪽엔 우열을 두지 않는다).

import type { Chart } from "./chart";
import { distributeElements, type ElementDistribution } from "./elements";
import { ELEMENTS, generatedBy } from "./data/relations";
import { STEMS, type Element } from "./data/stems";

export interface ElementVerdict {
  /** 가장 많은 오행 */
  dominant: Element;
  /** 가장 적은 오행 — 귀인지도에서 "귀한 기운"으로 쓴다 */
  lacking: Element;
  /** 한 글자도 없는 오행 (없으면 빈 배열) */
  absent: readonly Element[];
  /** 최다와 최소 차이가 1 이하 — 많다·적다로 단정하지 않는 구성 */
  isBalanced: boolean;
}

export type ElementProfile = ElementDistribution & ElementVerdict;

export interface ElementProfileCopy {
  /** 분포 한 줄 */
  summary: string;
  /** 귀인 안내 한 줄 */
  guiin: string;
  /** 아예 없는 기운일 때만 덧붙이는 한 줄 */
  absentNote: string | null;
}

/** 개수 집계에서 최다·결핍을 판정한다 */
export function elementProfile(
  counts: Record<Element, number>,
  dayMasterElement: Element,
): ElementVerdict {
  const values = ELEMENTS.map((el) => counts[el]);
  const max = Math.max(...values);
  const min = Math.min(...values);

  const dominant = ELEMENTS.find((el) => counts[el] === max) as Element;

  const lackingCandidates = ELEMENTS.filter((el) => counts[el] === min);
  const supporter = generatedBy(dayMasterElement);
  const lacking = lackingCandidates.includes(supporter)
    ? supporter
    : lackingCandidates[0];

  return {
    dominant,
    lacking,
    absent: ELEMENTS.filter((el) => counts[el] === 0),
    isBalanced: max - min <= 1,
  };
}

/** 원국에서 분포와 판정을 함께 얻는다 */
export function profileElements(chart: Chart): ElementProfile {
  const distribution = distributeElements(chart);
  return {
    ...distribution,
    ...elementProfile(distribution.counts, STEMS[chart.dayMaster].element),
  };
}

/** 귀인지도 상단 문구 — 해요체, 단정 금지 */
export function elementProfileCopy(verdict: ElementVerdict): ElementProfileCopy {
  const summary = verdict.isBalanced
    ? "오행이 고르게 퍼져 있는 구성이에요."
    : `${verdict.dominant} 기운이 많고 ${verdict.lacking} 기운이 적은 구성이에요.`;

  return {
    summary,
    guiin: `${verdict.lacking} 기운을 지닌 친구가 특히 귀해요.`,
    absentNote: verdict.absent.includes(verdict.lacking)
      ? `${verdict.lacking} 기운은 원국에 한 글자도 없어요.`
      : null,
  };
}
