// 궁합 계산 — 두 사람의 원국에서 관계의 "사실" 만 뽑는다.
//
// 서술은 여기서 하지 않는다. LLM 이 지어내지 못하게 근거를 먼저 못박는 것이
// 이 파일의 존재 이유다 (프롬프트는 src/app/api/matches/_lib/prompt).

import type { SajuAnalysis } from "./analyze";
import type { PillarPosition } from "./ten-gods";
import {
  BRANCHES,
  BRANCH_CHUNG,
  BRANCH_HAE,
  BRANCH_HAP,
  BRANCH_HYEONG,
  BRANCH_PA,
  BRANCH_SAMHAP,
  BRANCH_WONJIN,
  type Branch,
} from "./data/branches";
import { ELEMENTS, tenGod, type TenGod } from "./data/relations";
import { STEMS, type Element, type Stem } from "./data/stems";
import {
  getRelation,
  type Relation,
  type RelationBadge,
  type RelationKind,
} from "./relationship";

export type TieKind = "육합" | "삼합" | "충" | "형" | "해" | "파" | "원진";

export interface BranchTie {
  kind: TieKind;
  subjectPosition: PillarPosition;
  counterpartPosition: PillarPosition;
  subjectBranch: Branch;
  counterpartBranch: Branch;
  /** 자리 가중 — 일지×일지 3, 월지×월지 2, 나머지 1 */
  weight: number;
}

export interface SynastrySide {
  /** 상대 일간이 이 사람의 일간 기준으로 무슨 십성인가 */
  tenGodOfOther: TenGod;
  /** 이 사람의 용신을 상대 원국이 몇 자 갖고 있나 */
  yongsinFromOther: number;
  huisinFromOther: number;
}

export type AgeGap = "또래" | "터울" | "한 세대 차";

export interface Synastry {
  /** 나 → 상대 */
  relation: Relation;
  /** 상대 → 나 */
  reverse: Relation;
  subject: SynastrySide;
  counterpart: SynastrySide;
  ties: BranchTie[];
  combined: Record<Element, number>;
  ageGap: AgeGap;
  label: string;
}

const POSITIONS: readonly PillarPosition[] = ["year", "month", "day", "hour"];

const ey = (s: Stem) => ({ element: STEMS[s].element, yinYang: STEMS[s].yinYang });

/**
 * 자리 가중. 일지는 배우자·가까운 사람의 자리라 궁합에서 가장 무겁고,
 * 월지는 사회적 환경의 자리라 그 다음이다. 다른 조합은 셋 다 같은 무게로 둔다 —
 * 세분할 근거가 없고, 근거 없는 가중치는 나중에 아무도 못 고친다.
 */
function tieWeight(a: PillarPosition, b: PillarPosition): number {
  if (a === "day" && b === "day") return 3;
  if (a === "month" && b === "month") return 2;
  return 1;
}

/** 지지 두 글자 사이의 관계 전부. 한 쌍이 둘 이상 걸릴 수 있다(자미는 해이자 원진). */
function tieKinds(mine: Branch, theirs: Branch): TieKind[] {
  const kinds: TieKind[] = [];
  if (BRANCH_HAP[mine] === theirs) kinds.push("육합");
  if (BRANCH_SAMHAP[mine].includes(theirs)) kinds.push("삼합");
  if (BRANCH_CHUNG[mine] === theirs) kinds.push("충");
  if (BRANCH_HYEONG[mine].includes(theirs)) kinds.push("형");
  if (BRANCH_HAE[mine] === theirs) kinds.push("해");
  if (BRANCH_PA[mine] === theirs) kinds.push("파");
  if (BRANCH_WONJIN[mine] === theirs) kinds.push("원진");
  return kinds;
}

function branchesOf(a: SajuAnalysis): [PillarPosition, Branch][] {
  const out: [PillarPosition, Branch][] = [];
  for (const position of POSITIONS) {
    const pillar = a.chart[position];
    // 시주는 출생 시간 미입력이면 null 이다. 없는 자리를 판정에 넣으면
    // 없는 관계가 사실로 올라간다.
    if (pillar) out.push([position, pillar.branch]);
  }
  return out;
}

function collectTies(subject: SajuAnalysis, counterpart: SajuAnalysis): BranchTie[] {
  const ties: BranchTie[] = [];
  for (const [sPos, sBranch] of branchesOf(subject)) {
    for (const [cPos, cBranch] of branchesOf(counterpart)) {
      for (const kind of tieKinds(sBranch, cBranch)) {
        ties.push({
          kind,
          subjectPosition: sPos,
          counterpartPosition: cPos,
          subjectBranch: sBranch,
          counterpartBranch: cBranch,
          weight: tieWeight(sPos, cPos),
        });
      }
    }
  }
  // 무거운 자리부터. 프롬프트가 앞쪽만 잘라 써도 중요한 것이 남는다.
  return ties.sort((a, b) => b.weight - a.weight);
}

function side(me: SajuAnalysis, other: SajuAnalysis): SynastrySide {
  return {
    tenGodOfOther: tenGod(ey(me.chart.dayMaster), ey(other.chart.dayMaster)),
    yongsinFromOther: other.elements.counts[me.yongsin.yongsin],
    huisinFromOther: other.elements.counts[me.yongsin.huisin],
  };
}

/**
 * 나이차를 범주로 접는다. 숫자를 그대로 프롬프트에 넣지 않는 이유는
 * SYSTEM_PROMPT 의 "숫자를 쓰지 마라" 규칙 때문이다 — 사실 블록에 숫자가 있으면
 * 서술에 새어 나온다.
 *
 * 경계(3 / 12)는 띠 한 바퀴를 기준으로 잡았다. 12년은 같은 지지가 돌아오는 주기라
 * "한 세대" 의 체감과 맞는다.
 */
function ageGapOf(subject: SajuAnalysis, counterpart: SajuAnalysis): AgeGap {
  const gap = Math.abs(subject.chart.solar.year - counterpart.chart.solar.year);
  if (gap <= 3) return "또래";
  if (gap < 12) return "터울";
  return "한 세대 차";
}

/**
 * 결과 맨 위의 단계 라벨.
 *
 * 가중 점수를 매기고 구간을 잘라 라벨로 바꾸지 않는다. 그러면 숨긴 숫자가 그대로
 * 남아 "왜 이 라벨인가" 를 설명할 수 없게 되고, 라벨의 근거만 흐려진다.
 *
 * 라벨은 **일간 관계와 지지 배지의 조합**이다(설계 결정 6-1). 배지가 분류를 덮으면
 * 생아+육합과 극아+육합이 같은 라벨로 접혀 — 나를 채워 주는 사람과 나를 다잡는
 * 사람이 한 문구가 된다 — 두 축 중 하나가 화면에서 사라진다. 그래서 배지는 분류를
 * 대신하지 않고 그 앞에 붙는다.
 *
 * 어휘가 배지 이름(찰떡 · 불꽃 · 쌍둥이, BADGE_LABELS)과 다른 것은 의도다. 배지는
 * 라벨 바로 아래에 근거로 붙으므로, 라벨이 그 이름을 그대로 되풀이하면 결론 자리에
 * 새로 얹히는 정보가 없어진다.
 */
const KIND_LABEL: Record<RelationKind, string> = {
  생아: "나를 채워 주는 쌍",
  비아: "결이 닮은 쌍",
  아생: "내가 내어 주는 쌍",
  아극: "내가 이끄는 쌍",
  극아: "나를 다잡는 쌍",
};

/** 배지는 분류를 어떻게 겪는지를 수식한다 — 자리를 빼앗지 않는다. */
const BADGE_PREFIX: Record<RelationBadge, string> = {
  동일일주: "거울처럼",
  육합: "맞물리며",
  충: "부딪히며",
};

/**
 * 두 축을 합쳐 한 문구로. 배지는 하나뿐이다(relationship.ts 의 badges 가 배타적으로
 * 하나만 낸다) — 여럿이 되면 여기서 어느 것을 앞에 둘지 정해야 한다.
 */
export function synastryLabel(relation: Relation): string {
  const kind = KIND_LABEL[relation.kind];
  const badge = relation.badges[0];
  return badge ? `${BADGE_PREFIX[badge]} ${kind}` : kind;
}

export function analyzeSynastry(
  subject: SajuAnalysis,
  counterpart: SajuAnalysis,
): Synastry {
  const relation = getRelation(subject.chart.day, counterpart.chart.day);
  const combined = {} as Record<Element, number>;
  for (const el of ELEMENTS) {
    combined[el] = subject.elements.counts[el] + counterpart.elements.counts[el];
  }

  return {
    relation,
    reverse: getRelation(counterpart.chart.day, subject.chart.day),
    subject: side(subject, counterpart),
    counterpart: side(counterpart, subject),
    ties: collectTies(subject, counterpart),
    combined,
    ageGap: ageGapOf(subject, counterpart),
    label: synastryLabel(relation),
  };
}

/** 지도·카드에서 배지 이름을 쓸 때 필요하다 */
export function branchElementOf(branch: Branch): Element {
  return BRANCHES[branch].element;
}
