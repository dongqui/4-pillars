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
// 실제 세기 차이가 작아도 전환을 억지로 만든다.
//
// 관계 이름(충·형·육합…)도 같은 대접이다 — relationsOf 로 이름을 꺼내되 변곡점
// 판정은 frictionOf 가 접은 숫자만 본다. 세기는 점수로, 이름은 재료로.

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
  type PairKind,
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
const NATAL_LABELS = ["년지", "월지", "일지", "시지"] as const;
const SEWUN_WEIGHT = 2;
const DAEUN_WEIGHT = 2;

export type InteractionTarget = (typeof NATAL_LABELS)[number] | "세운" | "대운";

/** 이 달의 지지가 무엇과 어떤 관계를 맺는가. 숫자로 접기 전의 이름이다. */
export interface Interaction {
  target: InteractionTarget;
  kind: PairKind;
}

/**
 * 가중치의 유일한 출처. NATAL_WEIGHTS 에서 파생시켜 두 표가 갈리는 것을 막는다.
 */
const WEIGHT_OF: Record<InteractionTarget, number> = {
  년지: NATAL_WEIGHTS[0],
  월지: NATAL_WEIGHTS[1],
  일지: NATAL_WEIGHTS[2],
  시지: NATAL_WEIGHTS[3],
  세운: SEWUN_WEIGHT,
  대운: DAEUN_WEIGHT,
};

export interface FrictionTargets {
  /** 원국 4지 — [년, 월, 일, 시] 순서. 시간 미상이면 3개로 짧다 */
  natal: readonly Branch[];
  sewun: Branch;
  daeun: Branch;
}

/**
 * 정규화 분모. **상수가 아니다.**
 *
 * 시간 미상 프로필은 시지가 없어 분자에 세 자리만 기여하는데, 분모를 12 로
 * 고정하면 그 사람의 friction 이 구조적으로 낮게 나온다 — 두 축을 합해 변곡점을
 * 고르므로 그대로 두면 시간 미상인 사람은 변곡점을 덜 받는다.
 */
export function weightTotal(targets: FrictionTargets): number {
  const natal = targets.natal.reduce((sum, _, i) => sum + (NATAL_WEIGHTS[i] ?? 1), 0);
  return natal + SEWUN_WEIGHT + DAEUN_WEIGHT;
}

/**
 * 이 지지가 무엇과 어떤 관계를 맺는가.
 *
 * frictionOf 가 이 목록을 가중합해 숫자 하나로 접는다. **이름을 따로 꺼내는 이유는
 * 프롬프트다** — 07 이 12개 달을 서로 다르게 쓰려면 두 축 말고도 재료가 있어야
 * 한다. 변곡점 판정에는 쓰지 않는다(십성을 탐지에서 뺀 것과 같은 판단: 범주가
 * 바뀌었다는 이유만으로 전환을 만들지 않는다).
 */
export function relationsOf(branch: Branch, targets: FrictionTargets): Interaction[] {
  const out: Interaction[] = [];
  targets.natal.forEach((b, i) => {
    const target = NATAL_LABELS[i];
    if (!target) return; // natal 이 4개를 넘으면 무시한다
    for (const kind of pairRelations(branch, b)) out.push({ target, kind });
  });
  for (const kind of pairRelations(branch, targets.sewun)) out.push({ target: "세운", kind });
  for (const kind of pairRelations(branch, targets.daeun)) out.push({ target: "대운", kind });
  return out;
}

/**
 * 이 지지가 들어와서 **새로 완성되는** 삼합의 개수.
 *
 * 세 글자가 있어야 성립하는 관계를 쌍으로 세면 반합을 삼합으로 과대평가한다.
 * 그래서 판 전체를 놓고 전후를 비교한다.
 */
export function samhapGain(branch: Branch, targets: FrictionTargets): number {
  const without = [...targets.natal, targets.sewun, targets.daeun];
  const before = setRelations(without).filter((r) => r.kind === "삼합").length;
  const after = setRelations([...without, branch]).filter((r) => r.kind === "삼합").length;
  return after - before;
}

/** 이 지지가 원국·세운·대운을 얼마나 흔드는가. 대략 −1 … +1. */
export function frictionOf(branch: Branch, targets: FrictionTargets): number {
  let sum = 0;
  for (const r of relationsOf(branch, targets)) sum += KIND_COEFF[r.kind] * WEIGHT_OF[r.target];
  sum += SAMHAP_COEFF * samhapGain(branch, targets) * SEWUN_WEIGHT;
  return sum / weightTotal(targets);
}
