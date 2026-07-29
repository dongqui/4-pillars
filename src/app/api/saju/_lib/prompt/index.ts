// 섹션 하나에 대한 LLM 요청을 조립한다.
// 프롬프트를 만드는 유일한 자리 — 어떤 LLM 을 쓰든 여기서 나온 SectionRequest 를 옮기기만 한다.

import type { SajuAnalysis } from "@/lib/saju-core";
import {
  SECTIONS,
  llmInputSchema,
  llmInputSchemaWithRows,
  sectionStorage,
  type SectionKey,
} from "../sections";
import { chartFacts, luckFacts } from "./facts";
import { SECTION_TOOL_NAME, SYSTEM_PROMPT } from "./system";

export { SECTION_TOOL_NAME, SYSTEM_PROMPT } from "./system";
export { chartFacts, luckFacts } from "./facts";

/**
 * 세운 서술을 몇 해치 뽑을지.
 *
 * to-report-content 가 `${year + i}년` 라벨을 붙이므로 연 단위다. UI 카피는
 * "지금부터 1년"(월 단위)이라 아직 어긋나 있다 — 월 단위로 갈지는 별도 이슈다.
 */
export const YEARLY_LUCK_YEARS = 3;

/** LLM 어댑터가 그대로 옮겨 담으면 되는 요청 한 건. */
export interface SectionRequest {
  key: SectionKey;
  system: string;
  user: string;
  /** 응답을 tool 호출로 강제할 때 쓸 이름 */
  toolName: string;
  /** tool 의 input_schema. 최상위는 항상 { content: ... } */
  inputSchema: Record<string, unknown>;
}

export interface PromptContext {
  /** 세운·대운의 기준 연도 */
  year: number;
  /** 세운 서술 연수. 기본 YEARLY_LUCK_YEARS */
  yearlyLuckYears?: number;
}

/**
 * 개수를 못박아야 하는 섹션의 행 수.
 * 세운·대운은 계산된 목록과 인덱스로 짝지어지므로, 개수가 어긋나면
 * 조립 단계(zipTimeline)에서 섹션이 통째로 버려진다.
 */
function rowCount(
  key: SectionKey,
  analysis: SajuAnalysis,
  years: number,
): number | null {
  if (key === "yearlyLuck") return years;
  if (key === "daeunOutlook") return analysis.daeun.periods.length;
  return null;
}

export function buildSectionRequest(
  analysis: SajuAnalysis,
  key: SectionKey,
  ctx: PromptContext,
): SectionRequest {
  const spec = SECTIONS[key];
  const years = ctx.yearlyLuckYears ?? YEARLY_LUCK_YEARS;

  const facts =
    sectionStorage(key) === "luck"
      ? luckFacts(analysis, ctx.year, years)
      : chartFacts(analysis);

  const rows = rowCount(key, analysis, years);

  const user = [
    facts,
    "",
    `[요청 · ${key}]`,
    spec.prompt,
    ...(rows === null
      ? []
      : [`항목은 정확히 ${rows}개. 주어진 목록과 같은 순서로 쓴다.`]),
    "",
    "[문체 예시] 아래는 톤과 길이를 보여주는 예시일 뿐이다. 내용을 가져다 쓰지 말고,",
    "위 [사실] 블록에서 나온 이야기로 새로 써라.",
    spec.example,
  ].join("\n");

  return {
    key,
    system: SYSTEM_PROMPT,
    user,
    toolName: SECTION_TOOL_NAME,
    inputSchema:
      rows === null ? llmInputSchema(key) : llmInputSchemaWithRows(key, rows),
  };
}
