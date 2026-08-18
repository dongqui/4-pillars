// 한 턴: 프롬프트 조립 → LLM 호출 → 응답 파싱. DB 도 이용권도 모른다 —
// 그 둘은 service.ts 가 감싼다.

import { buildTurnMessages } from "./prompt";
import {
  COUNSEL_TOOL_NAME,
  MAX_REPLY_TOKENS,
  fallbackTitle,
  parseReply,
  replyToolSchema,
  type CounselorReply,
} from "./schema";
import type { ChatTransport, ChatUsage } from "./chat-transport";
import type { MessageRow } from "./store";

export interface RunTurnInput {
  facts: string;
  history: MessageRow[];
  utterance: string;
  remaining: number;
  isLast: boolean;
  /** 첫 턴이면 제목을 함께 받는다 */
  first: boolean;
}

export interface TurnResult {
  reply: CounselorReply;
  usage: ChatUsage;
}

export interface TurnDeps {
  transport: ChatTransport;
  model: string;
}

/**
 * 던지면 그 턴은 실패다. 호출자가 차감을 되돌리거나(첫 턴) 그냥 재시도하게
 * 둔다(이후 턴) — 어느 쪽이든 깨진 응답에 턴을 쓰지 않는다.
 */
export async function runTurn(input: RunTurnInput, deps: TurnDeps): Promise<TurnResult> {
  const opts = { first: input.first, last: input.isLast };

  const { args, usage } = await deps.transport({
    model: deps.model,
    messages: buildTurnMessages(input),
    toolName: COUNSEL_TOOL_NAME,
    inputSchema: replyToolSchema(opts),
    maxTokens: MAX_REPLY_TOKENS,
  });

  const reply = parseReply(args, opts);

  // 첫 턴에 제목이 안 왔으면 발화에서 메운다. parseReply 가 던지게 두면 제목 한 줄
  // 때문에 이용권이 되돌려지고 상담이 아예 안 열린다 (Task 4 의 결정 참고).
  if (input.first && !reply.title) {
    return { reply: { ...reply, title: fallbackTitle(input.utterance) }, usage };
  }

  return { reply, usage };
}
