// Synastry(계산값) → LLM 이 읽을 [사실] 블록.
//
// 리포트의 facts.ts 와 달리 캐시 경계 경고가 없다. 궁합 서술은 match_id 에 묶여
// 다른 유저에게 재사용되지 않으므로, chartKey 밖의 정보를 넣어도 남에게 새지 않는다.
// 그 여유로 나이차를 넘긴다 — 단, 숫자가 아니라 범주값이다(SYSTEM_PROMPT 규칙 2).
//
// 이름은 넘기지 않는다. 이름이 들어가면 LLM 이 "○○님은" 같은 호칭을 쓰기 시작하고,
// 그건 SYSTEM_PROMPT 의 "상대를 부르는 호칭은 쓰지 않는다" 와 정면으로 부딪힌다.

import type { SajuAnalysis, Synastry } from "@/lib/saju-core";
import { chartFacts } from "@/app/api/saju/_lib/prompt/facts";
import {
  relationLabel,
  relationLens,
  type RelationInput,
} from "@/lib/matches/relation-types";

export interface MatchContext {
  subject: SajuAnalysis;
  counterpart: SajuAnalysis;
  synastry: Synastry;
  relation: RelationInput;
}

const ELEMENT_ORDER = ["목", "화", "토", "금", "수"] as const;

/**
 * 지지 관계 줄. 자리를 함께 적는 이유: 어느 자리에서 걸렸는지가 무게를 정한다.
 * 서술에 "일지" 라고 쓰지는 않지만(용어 금지) 판단의 근거가 된다.
 *
 * 앞의 여섯 개만 쓴다. ties 는 무거운 순으로 정렬돼 있고, 4×4 전수라 많으면
 * 스무 줄이 넘는데 그러면 프롬프트에서 중요한 것이 묻힌다.
 */
const POSITION_LABEL = { year: "년지", month: "월지", day: "일지", hour: "시지" } as const;

function tieLines(synastry: Synastry): string {
  if (synastry.ties.length === 0) return "지지 관계: 없음";
  const parts = synastry.ties
    .slice(0, 6)
    .map(
      (t) =>
        `${POSITION_LABEL[t.subjectPosition]}-${POSITION_LABEL[t.counterpartPosition]}` +
        ` ${t.kind}(${t.subjectBranch}-${t.counterpartBranch})`,
    );
  return `지지 관계: ${parts.join(" · ")}`;
}

/**
 * 헤더에 실을 라벨. relationLabel 은 결과 화면의 관계 칩에도 그대로 쓰이는
 * 표시용 함수라(Task 12) 그 안에서 인용부호를 넣으면 화면에 " 가 그대로 찍힌다.
 * 인용은 프롬프트 쪽 관심사이므로 여기, custom 유형일 때만 붙인다 — 나머지
 * 유형의 라벨은 RELATION_TYPES 의 고정 문구(사용자 입력 아님)라 감쌀 이유가 없다.
 */
function headerLabel(relation: RelationInput): string {
  if (relation.type === "custom" && relation.subjectRole && relation.counterpartRole) {
    return `"${relation.subjectRole}" - "${relation.counterpartRole}"`;
  }
  return relationLabel(relation);
}

function relationBlock(relation: RelationInput): string {
  const lines = [`[관계 · ${headerLabel(relation)}]`, relationLens(relation)];
  if (relation.subjectRole && relation.counterpartRole) {
    // 인용부호로 감싼다 — 값이지 지시문이 아니라는 표시다. 시스템 프롬프트가
    // 같은 못을 한 번 더 박는다.
    lines.push(`나의 역할: "${relation.subjectRole}" · 상대의 역할: "${relation.counterpartRole}"`);
  }
  return lines.join("\n");
}

export function matchFacts(ctx: MatchContext): string {
  const { subject, counterpart, synastry } = ctx;

  const between = [
    "[사실 · 두 사람 사이]",
    `일간 관계: 나→상대 ${synastry.relation.kind} · 상대→나 ${synastry.reverse.kind}`,
    `일주 배지: ${synastry.relation.badges.length > 0 ? synastry.relation.badges.join(" · ") : "없음"}`,
    `십성 교차: 상대는 나에게 ${synastry.subject.tenGodOfOther}` +
      ` · 나는 상대에게 ${synastry.counterpart.tenGodOfOther}`,
    tieLines(synastry),
    `오행 보완: 내 용신 ${subject.yongsin.yongsin} — 상대 원국에 ${synastry.subject.yongsinFromOther}자` +
      ` · 상대 용신 ${counterpart.yongsin.yongsin} — 내 원국에 ${synastry.counterpart.yongsinFromOther}자`,
    // 희신도 같이 넘긴다(설계 결정 6 의 "오행 보완 (양방향)"). 용신만 보면 "채워 주는
    // 것이 없다" 로 끝나는 쌍이 실제로는 차선을 채우고 있는 경우를 서술이 놓친다 —
    // synastry 가 이미 계산해 두고 아무도 읽지 않던 값이 이것이다.
    `희신 보완: 내 희신 ${subject.yongsin.huisin} — 상대 원국에 ${synastry.subject.huisinFromOther}자` +
      ` · 상대 희신 ${counterpart.yongsin.huisin} — 내 원국에 ${synastry.counterpart.huisinFromOther}자`,
    `합산 오행: ${ELEMENT_ORDER.map((el) => `${el} ${synastry.combined[el]}`).join(" · ")}`,
    `나이차: ${synastry.ageGap}`,
  ].join("\n");

  return [
    // chartFacts 가 자기 헤더(`[사실 · ${label}]`)를 직접 붙이므로 여기서 따로
    // "[사실 · 나]" 를 앞세우지 않는다 — 헤더를 두 곳에서 관리하면 겹치거나 어긋난다.
    chartFacts(subject, "나"),
    "",
    chartFacts(counterpart, "상대"),
    "",
    between,
    "",
    relationBlock(ctx.relation),
  ].join("\n");
}
