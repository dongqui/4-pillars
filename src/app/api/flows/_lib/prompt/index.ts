// 섹션 하나에 대한 LLM 요청을 조립한다. 흐름 프롬프트를 만드는 유일한 자리다.

import { FLOW_SECTIONS, flowLlmInputSchema, type FlowSectionKey } from "../sections";
import { flowFacts, type FlowContext } from "./facts";
import { FLOW_SYSTEM_PROMPT, SECTION_TOOL_NAME } from "./system";

// flowFacts/MonthFacts/YearFacts 는 여기서 재수출하지 않는다 — 이 파일 밖에서
// "./facts" 를 거치지 않고 쓰는 곳이 없다(생성기·화면은 FlowContext/buildFlowContext
// 만 필요로 한다). 쓰지 않는 이름을 배럴에 얹으면 실제 소비처 파악이 흐려진다.
export { buildFlowContext, type FlowContext } from "./facts";
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
    // 08 의 정의역이 스키마에 박힌다 — LLM 이 계산되지 않은 달을 변곡점이라
    // 우길 수 없다. 07 은 언제나 12개다.
    inputSchema: flowLlmInputSchema(key, { pivotMonths: ctx.pivotMonths }),
  };
}
