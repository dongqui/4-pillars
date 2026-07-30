// DeepSeek(OpenAI 호환) 어댑터. buildSectionRequest 가 만든 SectionRequest 를
// 그대로 옮기기만 한다 — 프롬프트 조립은 여기서 하지 않는다.

import type { SectionTransport } from "./prompted";

export const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export interface DeepSeekOptions {
  apiKey: string;
  /** deepseek-v4-flash | deepseek-v4-pro */
  model: string;
  /**
   * thinking 모드. 기본 false.
   *
   * V4 는 켜는 게 기본값이지만 그 모드에선 특정 함수 강제를 400 으로 거부한다
   * ("Thinking mode does not support this tool_choice"). 이 파이프라인은 스키마
   * 강제가 유일한 방어선이라 기본적으로 끈다 — 켜면 tool_choice 가 auto 로 내려가
   * 모델이 tool 을 안 부를 수 있고, 그만큼 섹션 유실이 늘어난다.
   */
  thinking?: boolean;
  /** 테스트에서 주입한다. 기본은 전역 fetch. */
  fetch?: typeof fetch;
  /**
   * 토큰 사용량 관측용. prompt_cache_hit_tokens 가 여기로 나온다 —
   * 캐시가 실제로 걸리는지는 붙여보기 전엔 알 수 없어서 처음부터 뽑아 둔다.
   */
  onUsage?: (key: string, usage: unknown) => void;
}

/** 응답에서 실제로 읽는 부분만. 나머지 필드는 알 바 아니다. */
interface ChatCompletion {
  choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  usage?: unknown;
}

export function createDeepSeekTransport(opts: DeepSeekOptions): SectionTransport {
  const doFetch = opts.fetch ?? fetch;
  const thinking = opts.thinking ?? false;

  return async (req) => {
    const res = await doFetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.user },
        ],
        // inputSchema 를 그대로 parameters 에 싣는다. 세운·대운의 행 수 강제가
        // 여기 걸려 있어서, 스키마를 빼면 zipTimeline 이 섹션을 통째로 버린다.
        tools: [
          { type: "function", function: { name: req.toolName, parameters: req.inputSchema } },
        ],
        thinking: { type: thinking ? "enabled" : "disabled" },
        tool_choice: thinking
          ? "auto"
          : { type: "function", function: { name: req.toolName } },
      }),
    });

    if (!res.ok) {
      throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as ChatCompletion;
    // 파싱이 실패하든 말든 토큰은 이미 썼다. 검사보다 먼저 기록한다.
    opts.onUsage?.(req.key, json.usage);

    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    // tool_choice 로 강제했는데도 본문 텍스트로 답하는 모델이 있다. 그냥 두면
    // PromptedGenerator 가 undefined 를 받아 섹션을 조용히 버리므로 여기서 깬다.
    if (typeof args !== "string") {
      throw new Error(`DeepSeek 응답에 tool 호출이 없다 (${req.key})`);
    }

    try {
      return JSON.parse(args);
    } catch {
      throw new Error(`DeepSeek tool arguments 가 JSON 이 아니다 (${req.key}): ${args}`);
    }
  };
}
