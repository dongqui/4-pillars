// 흐름의 두 축.
//
//   support   흐름이 나에게 힘을 보태는가 소모시키는가   (−1 … +1)
//   friction  원국·세운·대운과의 관계가 얼마나 흔들리는가 (대략 −1 … +1)
//
// ⚠️ 두 축을 반드시 같은 자로 만든다. friction 이 가중합이고 support 가 ±점수면
// Δ 를 더할 때 friction 이 혼자 전환을 결정한다.
//
// 십성은 여기 없다. 십성은 "변화가 어디에서 체감되는가" 를 정하는 축이라
// 전환 시점 판정에 넣으면 같은 작용을 두 번 반영하고, 범주가 바뀌었다는 이유만으로
// 실제 세기 차이가 작아도 구간을 억지로 나눈다. (프롬프트의 facts 블록에서는 쓴다)

import {
  STEMS,
  branchElementOf,
  controlledBy,
  isBranch,
  isStem,
  pairRelations,
  setRelations,
  type Branch,
  type Element,
  type Stem,
  type Yongsin,
} from "@/lib/saju-core";

export interface Pillar2 {
  stem: Stem;
  branch: Branch;
}

/** "병오" → { stem: "병", branch: "오" }. 모양이 아니면 null. */
export function parsePillar2(korean: string): Pillar2 | null {
  if (korean.length !== 2) return null;
  const [s, b] = [korean[0], korean[1]];
  if (!isStem(s) || !isBranch(b)) return null;
  return { stem: s, branch: b };
}

/** 오행 하나가 용신 축에서 어느 편인가. */
function elementScore(el: Element, yongsin: Yongsin): number {
  if (el === yongsin.yongsin) return 1;
  if (el === yongsin.huisin) return 0.5;
  if (el === controlledBy(yongsin.yongsin)) return -1;
  return 0;
}

/**
 * 간지 두 글자의 오행을 용신 축에서 채점하고 글자 수로 나눈다.
 * 원값 −2 … +2 → −1 … +1.
 */
export function supportOf(pillar: Pillar2, yongsin: Yongsin): number {
  const stemEl = STEMS[pillar.stem].element;
  const branchEl = branchElementOf(pillar.branch);
  return (elementScore(stemEl, yongsin) + elementScore(branchEl, yongsin)) / 2;
}

/**
 * 관계 계수. 부호가 뜻을 갖는다 — 양수는 흔들림, 음수는 결속이다.
 * 충이 가장 무겁고 파가 가장 가볍다는 순서 말고는 근거가 없는 값이므로
 * 여기 한 곳에만 둔다.
 */
const KIND_COEFF = {
  충: 1.0,
  형: 0.7,
  원진: 0.5,
  해: 0.4,
  파: 0.3,
  육합: -0.6,
} as const;

/** 삼합 완성은 육합보다 강한 결속이다. */
const SAMHAP_COEFF = -0.8;

/**
 * 자리 가중. strength.ts 의 POSITION_WEIGHTS 를 따른다 — 여기서 재는 것이
 * "원국이 흔들리는 정도" 이기 때문이다. synastry 의 tieWeight(일지 3 / 월지 2)는
 * "두 사람의 밀착" 을 재는 다른 자라서 쓰지 않는다.
 *
 * 세운·대운을 2 로 두는 이유: 지금 들어와 있는 흐름이라 일지만큼 무겁게 본다.
 */
const NATAL_WEIGHTS = [1.5, 3, 2, 1.5] as const; // 년 · 월 · 일 · 시
const SEWUN_WEIGHT = 2;
const DAEUN_WEIGHT = 2;

/** 정규화 분모. 두 축이 같은 자를 쓰게 하는 값이다. */
export const WEIGHT_TOTAL =
  NATAL_WEIGHTS.reduce((a, b) => a + b, 0) + SEWUN_WEIGHT + DAEUN_WEIGHT; // 12

export interface FrictionTargets {
  /** 원국 4지 — [년, 월, 일, 시] 순서 */
  natal: readonly Branch[];
  sewun: Branch;
  daeun: Branch;
}

function pairScore(a: Branch, b: Branch): number {
  let sum = 0;
  for (const kind of pairRelations(a, b)) sum += KIND_COEFF[kind];
  return sum;
}

/**
 * 이 지지가 원국·세운·대운을 얼마나 흔드는가.
 *
 * 쌍 관계는 상대별로 가중해 더하고, 삼합은 판 전체를 놓고 한 번만 판정한다 —
 * 세 글자가 있어야 성립하는 관계를 쌍으로 세면 반합을 삼합으로 과대평가한다.
 */
export function frictionOf(branch: Branch, targets: FrictionTargets): number {
  let sum = 0;

  targets.natal.forEach((b, i) => {
    sum += pairScore(branch, b) * (NATAL_WEIGHTS[i] ?? 1);
  });
  sum += pairScore(branch, targets.sewun) * SEWUN_WEIGHT;
  sum += pairScore(branch, targets.daeun) * DAEUN_WEIGHT;

  // 삼합은 이 지지가 들어와서 **새로 완성되는** 것만 센다.
  const without = [...targets.natal, targets.sewun, targets.daeun];
  const before = setRelations(without).filter((r) => r.kind === "삼합").length;
  const after = setRelations([...without, branch]).filter((r) => r.kind === "삼합").length;
  if (after > before) sum += SAMHAP_COEFF * (after - before) * SEWUN_WEIGHT;

  return sum / WEIGHT_TOTAL;
}
