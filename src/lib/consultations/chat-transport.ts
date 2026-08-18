// DeepSeek(OpenAI 호환) 채팅 어댑터.
//
// src/app/api/saju/_lib/deepseek.ts 와 형제지만 합치지 않는다. 그쪽은
// SectionRequest(system + user 두 메시지)에 묶여 있어 대화 이력을 실을 자리가
// 없고, 토큰 사용량도 콜백으로만 흘린다. 상담은 메시지 배열이 매 턴 자라고
// 사용량을 상담 행에 누적해야 해서 반환값으로 받아야 한다. 기존 어댑터를
// 일반화하면 리포트 경로를 건드리게 되고, 얻는 것 없이 위험만 진다.

import type { ChatMessage } from "./prompt";

export const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  toolName: string;
  inputSchema: Record<string, unknown>;
  maxTokens: number;
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface ChatResult {
  /** tool 호출 인자. 검증은 호출자가 한다 */
  args: unknown;
  usage: ChatUsage;
}

export type ChatTransport = (req: ChatRequest) => Promise<ChatResult>;

/** 응답에서 실제로 읽는 부분만. 나머지 필드는 알 바 아니다. */
interface ChatCompletion {
  choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

export function createDeepSeekChatTransport(opts: {
  apiKey: string;
  /** 테스트에서 주입한다. 기본은 전역 fetch */
  fetch?: typeof fetch;
}): ChatTransport {
  const doFetch = opts.fetch ?? fetch;

  return async (req) => {
    const res = await doFetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        tools: [
          { type: "function", function: { name: req.toolName, parameters: req.inputSchema } },
        ],
        // thinking 모드는 특정 함수 강제를 400 으로 거부한다
        // ("Thinking mode does not support this tool_choice"). 이 파이프라인은
        // 스키마 강제가 유일한 방어선이라 끈다.
        thinking: { type: "disabled" },
        tool_choice: { type: "function", function: { name: req.toolName } },
        // 출력 상한. 비용 상한의 두 번째 자물쇠다.
        max_tokens: req.maxTokens,
      }),
    });

    if (!res.ok) {
      throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as ChatCompletion;

    const usage: ChatUsage = {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
    };

    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    // tool_choice 로 강제했는데도 본문 텍스트로 답하는 모델이 있다.
    if (typeof args !== "string") {
      throw new Error("DeepSeek 응답에 tool 호출이 없다");
    }

    try {
      return { args: JSON.parse(args), usage };
    } catch {
      throw new Error(`DeepSeek tool arguments 가 JSON 이 아니다: ${args}`);
    }
  };
}
