// DeepSeek(OpenAI 호환) 어댑터. buildSectionRequest 가 만든 SectionRequest 를
// 그대로 옮기기만 한다 — 프롬프트 조립은 여기서 하지 않는다.

export const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

/**
 * 이 어댑터가 실제로 읽는 필드만 담은 구조 타입. 리포트의 SectionRequest 와
 * 궁합의 MatchSectionRequest 는 둘 다 이 다섯 필드를 가지되 key 의 유니온이
 * 서로 달라서, 어느 한쪽 타입을 그대로 매개변수로 쓰면 다른 쪽이 캐스팅 없이는
 * 안 맞는다. key 를 string 으로 넓혀 두 타입 모두가 구조적으로 이 타입의
 * 부분집합이 되게 한다 — 반환 함수를 SectionTransport/MatchTransport 어느
 * 자리에 대입해도 캐스팅이 필요 없다.
 */
export interface DeepSeekSectionRequest {
  key: string;
  system: string;
  user: string;
  toolName: string;
  inputSchema: Record<string, unknown>;
}

export type DeepSeekTransport = (req: DeepSeekSectionRequest) => Promise<unknown>;

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
  /**
   * 한 번의 시도에 거는 제한 시간(ms). 기본 40초.
   *
   * 없으면 응답하지 않는 콜 하나가 라우트의 maxDuration 을 통째로 태워, 이미 끝난
   * 다른 섹션들까지 저장되지 못한 채 함수가 죽는다 — 섹션은 전부 병렬로 나가고
   * 저장은 전부 끝난 뒤 한 번에 일어나기 때문이다.
   */
  timeoutMs?: number;
  /**
   * 실패했을 때 더 시도할 횟수. 기본 1.
   *
   * 재시도가 없으면 실패한 섹션은 저장되지 않고, 다음 열람에서 다시 missing 으로
   * 잡혀 LLM 을 또 부른다 — 성공할 때까지 매 열람마다. 한 요청 안에서 한 번 더
   * 물어보는 편이 사용자에게도 원가에도 싸다.
   */
  retries?: number;
}

/** 상태코드를 들고 다니는 실패. 재시도할 값이 있는지를 이걸로 가른다. */
export class DeepSeekHttpError extends Error {
  constructor(readonly status: number, body: string) {
    super(`DeepSeek ${status}: ${body}`);
    this.name = "DeepSeekHttpError";
  }
}

/** 제한 시간을 넘긴 시도. 유일하게 재시도하지 않는 실패다. */
export class DeepSeekTimeoutError extends Error {
  constructor(key: string, ms: number) {
    super(`DeepSeek 응답이 제한 시간을 넘겼다 (${key})`);
    this.name = "DeepSeekTimeoutError";
    this.cause = ms;
  }
}

/**
 * 다시 물어볼 값이 있는 실패인가.
 *
 * 4xx 는 우리가 잘못 보낸 것이라 같은 몸통으로 다시 물으면 같은 답이 온다 — 429만
 * 예외로, 그건 요청이 틀린 게 아니라 지금 붐빈다는 뜻이다.
 *
 * 타임아웃은 재시도하지 않는다. 한 번에 timeoutMs 를 다 쓰고 또 그만큼 쓰면
 * maxDuration 을 넘겨 **모든** 섹션이 함께 죽는다 — 한 섹션을 구하려고 나머지
 * 여섯을 거는 거래가 된다.
 */
function isRetryable(e: unknown): boolean {
  if (e instanceof DeepSeekTimeoutError) return false;
  if (e instanceof DeepSeekHttpError) return e.status === 429 || e.status >= 500;
  // 네트워크 오류·JSON 파싱 실패·tool 호출 누락 — 전부 다시 물어볼 값이 있다.
  return true;
}

/** 응답에서 실제로 읽는 부분만. 나머지 필드는 알 바 아니다. */
interface ChatCompletion {
  choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  usage?: unknown;
}

export function createDeepSeekTransport(opts: DeepSeekOptions): DeepSeekTransport {
  const doFetch = opts.fetch ?? fetch;
  const thinking = opts.thinking ?? false;
  const timeoutMs = opts.timeoutMs ?? 40_000;
  const retries = opts.retries ?? 1;

  const attempt = async (req: DeepSeekSectionRequest): Promise<unknown> => {
    let res: Response;
    try {
      res = await doFetch(DEEPSEEK_URL, {
      method: "POST",
      // 제한 시간은 시도마다 새로 건다 — 재시도가 첫 시도의 남은 시간을 물려받으면
      // 두 번째는 시작하자마자 죽는다.
      signal: AbortSignal.timeout(timeoutMs),
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
        // inputSchema 를 그대로 parameters 에 싣는다. 섹션마다 다른 필드·개수 제약이
        // 여기 걸려 있어서, 스키마를 빼면 응답이 자기 섹션 스키마를 통과하지 못해
        // 검증 단계에서 그 섹션이 통째로 버려진다.
        tools: [
          { type: "function", function: { name: req.toolName, parameters: req.inputSchema } },
        ],
        thinking: { type: thinking ? "enabled" : "disabled" },
        tool_choice: thinking
          ? "auto"
          : { type: "function", function: { name: req.toolName } },
      }),
      });
    } catch (e) {
      // AbortSignal.timeout 은 name 이 "TimeoutError" 인 DOMException 을 던진다.
      // 그것만 갈라내야 재시도 판단이 선다 — 나머지는 네트워크 오류다.
      if (e instanceof Error && e.name === "TimeoutError") {
        throw new DeepSeekTimeoutError(req.key, timeoutMs);
      }
      throw e;
    }

    if (!res.ok) {
      throw new DeepSeekHttpError(res.status, await res.text());
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

  return async (req) => {
    let last: unknown;
    for (let tries = 0; tries <= retries; tries++) {
      try {
        return await attempt(req);
      } catch (e) {
        last = e;
        if (tries === retries || !isRetryable(e)) break;
        console.warn(
          `[deepseek] ${req.key} 실패, 다시 시도합니다 (${tries + 1}/${retries + 1})`,
          e instanceof Error ? e.message : e,
        );
      }
    }
    throw last;
  };
}
