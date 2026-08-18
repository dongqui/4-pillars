import { BADGE_LABELS, RELATION_LABELS, type Synastry } from "@/lib/saju-core";
import { relationLabel, type RelationInput } from "@/lib/matches/relation-types";

export interface MatchBadgeView {
  name: string;
  hint: string;
}

export interface MatchHeroView {
  /** 결과 맨 위의 단계 라벨 */
  label: string;
  relationLabel: string;
  subject: { name: string; initial: string };
  counterpart: { name: string; initial: string };
  badges: MatchBadgeView[];
}

const initialOf = (name: string) => Array.from(name.trim())[0] ?? "?";

/**
 * 히어로 영역은 계산값만 쓴다 — LLM 없이 즉시 렌더되므로 <Suspense> 바깥에 둔다.
 * 관계 분류를 첫 배지로 항상 넣는 이유: 지지 배지는 없을 수 있는데,
 * 그때 배지 줄이 통째로 비면 라벨만 덩그러니 남는다.
 */
export function toMatchHeroView(args: {
  synastry: Synastry;
  relation: RelationInput;
  subjectName: string;
  counterpartName: string;
}): MatchHeroView {
  const { synastry } = args;
  const kind = RELATION_LABELS[synastry.relation.kind];

  return {
    label: synastry.label,
    relationLabel: relationLabel(args.relation),
    subject: { name: args.subjectName, initial: initialOf(args.subjectName) },
    counterpart: { name: args.counterpartName, initial: initialOf(args.counterpartName) },
    badges: [
      { name: kind.name, hint: kind.hint },
      ...synastry.relation.badges.map((b) => ({
        name: BADGE_LABELS[b].name,
        hint: BADGE_LABELS[b].hint,
      })),
    ],
  };
}
