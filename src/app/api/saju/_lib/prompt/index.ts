// 섹션 하나에 대한 LLM 요청을 조립한다.
// 프롬프트를 만드는 유일한 자리 — 어떤 LLM 을 쓰든 여기서 나온 SectionRequest 를 옮기기만 한다.

import type { SajuAnalysis } from "@/lib/saju-core";
import { SECTIONS, llmInputSchema, type SectionKey } from "../sections";
import { chartFacts } from "./facts";
import { SECTION_TOOL_NAME, SYSTEM_PROMPT } from "./system";

export { SECTION_TOOL_NAME, SYSTEM_PROMPT } from "./system";
export { chartFacts } from "./facts";

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

export function buildSectionRequest(
  analysis: SajuAnalysis,
  key: SectionKey,
): SectionRequest {
  const spec = SECTIONS[key];

  const user = [
    chartFacts(analysis),
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
    system: SYSTEM_PROMPT,
    user,
    toolName: SECTION_TOOL_NAME,
    inputSchema: llmInputSchema(key),
  };
}
