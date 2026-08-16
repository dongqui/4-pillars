// 관계 엔진 — 두 사람의 일주로 관계 분류와 배지를 판정한다 (귀인지도)
//
// 분류는 일간 오행의 생극으로만 가른다. 사이클은 data/relations.ts의 것을
// 그대로 쓰고 여기서 다시 정의하지 않는다.
// 배지는 일지 관계로만 붙인다. v1은 육합·충·동일일주까지고,
// 삼합·형·해·파·원진은 유료 궁합 재료로 미룬다.

import {
  BRANCHES,
  BRANCH_CHUNG,
  BRANCH_HAP,
  type Branch,
} from "./data/branches";
import { elementControls, elementGenerates } from "./data/relations";
import { STEMS, type Stem } from "./data/stems";

/** 관계 판정에 필요한 최소 입력 — Chart의 일주(chart.day)를 그대로 넘기면 된다 */
export interface DayPillarInput {
  stem: Stem;
  branch: Branch;
}

/**
 * 나 → 친구 관계 5분류 (명리 용어가 내부 키, 노출명은 RELATION_LABELS)
 * - 생아: 친구가 나를 생한다
 * - 비아: 오행이 같다
 * - 아생: 내가 친구를 생한다
 * - 아극: 내가 친구를 극한다
 * - 극아: 친구가 나를 극한다
 */
export type RelationKind = "생아" | "비아" | "아생" | "아극" | "극아";

export type RelationBadge = "육합" | "충" | "동일일주";

export interface RelationLabel {
  /** 카드·지도에 쓰는 이름 */
  name: string;
  /** 한 줄 설명 */
  hint: string;
}

/** 노출명 — B01 확정 전 임시안. 이름만 바꿔 끼울 수 있게 데이터로 둔다. */
export const RELATION_LABELS: Record<RelationKind, RelationLabel> = {
  생아: { name: "귀인", hint: "나를 채워 주는 기운이에요." },
  비아: { name: "단짝", hint: "결이 닮아 편한 사이예요." },
  아생: { name: "내 사람", hint: "내가 챙겨 주게 되는 사이예요." },
  아극: { name: "오른팔", hint: "내가 이끌기 좋은 사이예요." },
  극아: { name: "스승", hint: "나를 다잡아 주는 기운이에요." },
};

export const BADGE_LABELS: Record<RelationBadge, RelationLabel> = {
  육합: { name: "찰떡", hint: "일지가 맞물리는 조합이에요." },
  충: { name: "불꽃", hint: "일지가 정면으로 부딪히는 조합이에요." },
  동일일주: { name: "쌍둥이", hint: "일주가 통째로 같아요." },
};

export interface Relation {
  kind: RelationKind;
  /** RELATION_LABELS[kind].name */
  label: string;
  badges: readonly RelationBadge[];
}

function relationKind(me: Stem, friend: Stem): RelationKind {
  const mine = STEMS[me].element;
  const theirs = STEMS[friend].element;

  if (mine === theirs) return "비아";
  if (elementGenerates(theirs) === mine) return "생아";
  if (elementGenerates(mine) === theirs) return "아생";
  if (elementControls(mine) === theirs) return "아극";
  return "극아";
}

function badges(me: DayPillarInput, friend: DayPillarInput): RelationBadge[] {
  if (me.stem === friend.stem && me.branch === friend.branch) {
    return ["동일일주"];
  }
  if (BRANCH_HAP[me.branch] === friend.branch) return ["육합"];
  if (BRANCH_CHUNG[me.branch] === friend.branch) return ["충"];
  return [];
}

/** 나 기준으로 친구와의 관계를 판정한다 (분류는 방향이 있고, 배지는 대칭이다) */
export function getRelation(
  me: DayPillarInput,
  friend: DayPillarInput,
): Relation {
  const kind = relationKind(me.stem, friend.stem);
  return {
    kind,
    label: RELATION_LABELS[kind].name,
    badges: badges(me, friend),
  };
}

/** 일지 본기 오행 — 지도에서 친구 배치에 쓸 보조 정보 */
export function branchElement(branch: Branch) {
  return BRANCHES[branch].element;
}
