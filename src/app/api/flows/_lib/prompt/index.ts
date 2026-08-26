// 섹션 하나에 대한 LLM 요청을 조립한다. 흐름 프롬프트를 만드는 유일한 자리다.

import { FLOW_SECTIONS, flowLlmInputSchema, type FlowSectionKey } from "../sections";
import { flowFacts, type FlowContext } from "./facts";
import { FLOW_SYSTEM_PROMPT, SECTION_TOOL_NAME } from "./system";

export { buildFlowContext, flowFacts, type FlowContext, type FlowSegmentFacts } from "./facts";
export { FLOW_SYSTEM_PROMPT, SECTION_TOOL_NAME } from "./system";

export interface FlowSectionRequest {
  key: FlowSectionKey;
  system: string;
  user: string;
  toolName: string;
  inputSchema: Record<string, unknown>;
}

export function buildFlowSectionRequest(
  ctx: FlowContext,
  key: FlowSectionKey,
): FlowSectionRequest {
  const spec = FLOW_SECTIONS[key];

  const user = [
    flowFacts(ctx),
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
    system: FLOW_SYSTEM_PROMPT,
    user,
    toolName: SECTION_TOOL_NAME,
    // 구간 수가 스키마에 박힌다 — LLM 이 개수를 바꿀 수 없다.
    inputSchema: flowLlmInputSchema(key, ctx.segments.length),
  };
}
