// 섹션 하나에 대한 LLM 요청을 조립한다. 궁합 프롬프트를 만드는 유일한 자리다.

import { MATCH_SECTIONS, matchLlmInputSchema, type MatchSectionKey } from "../sections";
import { matchFacts, type MatchContext } from "./facts";
import { MATCH_SYSTEM_PROMPT, SECTION_TOOL_NAME } from "./system";

export { matchFacts, type MatchContext } from "./facts";
export { MATCH_SYSTEM_PROMPT, SECTION_TOOL_NAME } from "./system";

export interface MatchSectionRequest {
  key: MatchSectionKey;
  system: string;
  user: string;
  toolName: string;
  inputSchema: Record<string, unknown>;
}

export function buildMatchSectionRequest(
  ctx: MatchContext,
  key: MatchSectionKey,
): MatchSectionRequest {
  const spec = MATCH_SECTIONS[key];

  const user = [
    matchFacts(ctx),
    "",
    `[요청 · ${key}]`,
    spec.prompt,
    "",
    "[문체 예시] 아래는 톤과 길이를 보여주는 예시일 뿐이다. 내용을 가져다 쓰지 말고,",
    "위 [사실] 블록에서 나온 이야기로 새로 써라.",
    spec.example,
  ].join("\n");

  return {
    key,
    system: MATCH_SYSTEM_PROMPT,
    user,
    toolName: SECTION_TOOL_NAME,
    inputSchema: matchLlmInputSchema(key),
  };
}
