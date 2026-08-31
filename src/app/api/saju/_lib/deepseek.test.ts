import { describe, it, expect, vi } from "vitest";
import { createDeepSeekTransport, DEEPSEEK_URL } from "./deepseek";
import type { SectionRequest } from "./prompt";

const req: SectionRequest = {
  key: "strengths",
  system: "너는 작성자다",
  user: "[사실 · 원국]\n일간: 계",
  toolName: "emit_section",
  inputSchema: { type: "object", properties: { content: { type: "array" } } },
};

/** tool 호출 하나를 담은 정상 응답. */
const reply = (args: unknown, usage: Record<string, number> = {}) =>
  new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            tool_calls: [
              { function: { name: "emit_section", arguments: JSON.stringify(args) } },
            ],
          },
        },
      ],
      usage,
    }),
    { status: 200 },
  );

const transportWith = (
  fetchImpl: typeof fetch,
  extra: { onUsage?: (u: unknown) => void } = {},
) =>
  createDeepSeekTransport({
    apiKey: "sk-test",
    model: "deepseek-v4-flash",
    fetch: fetchImpl,
    ...extra,
  });

describe("createDeepSeekTransport", () => {
  it("tool 호출 인자를 파싱해 돌려준다", async () => {
    const transport = transportWith(async () => reply({ content: [{ title: "t", body: "b" }] }));
    expect(await transport(req)).toEqual({ content: [{ title: "t", body: "b" }] });
  });

  it("system·user 를 각 역할의 메시지로 보낸다", async () => {
    const fetchMock = vi.fn(async () => reply({ content: [] }));
    await transportWith(fetchMock)(req);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(DEEPSEEK_URL);
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("deepseek-v4-flash");
    expect(body.messages).toEqual([
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ]);
  });

  // 개수·shape 강제가 이 파이프라인의 유일한 방어선이다. 스키마를 안 보내면
  // zipTimeline 이 섹션을 통째로 버리는 실패가 조용히 늘어난다.
  it("inputSchema 를 function parameters 로 싣고 그 tool 을 강제한다", async () => {
    const fetchMock = vi.fn(async () => reply({ content: [] }));
    await transportWith(fetchMock)(req);

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.tools).toEqual([
      { type: "function", function: { name: "emit_section", parameters: req.inputSchema } },
    ]);
    expect(body.tool_choice).toEqual({ type: "function", function: { name: "emit_section" } });
  });

  // V4 는 기본이 thinking 모드인데, 그 모드에선 특정 함수 강제를 400 으로 거부한다
  // ("Thinking mode does not support this tool_choice"). 강제를 유지하려면 꺼야 한다.
  it("기본으로 thinking 을 끈다", async () => {
    const fetchMock = vi.fn(async () => reply({ content: [] }));
    await transportWith(fetchMock)(req);

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.thinking).toEqual({ type: "disabled" });
  });

  // thinking 을 켜면 강제를 못 쓰므로 auto 로 낮춘다. 모델이 tool 을 안 부르면
  // 위의 "tool 호출 없이 텍스트만 오면 throw" 가 잡는다.
  it("thinking 을 켜면 tool_choice 를 auto 로 낮춘다", async () => {
    const fetchMock = vi.fn(async () => reply({ content: [] }));
    await createDeepSeekTransport({
      apiKey: "sk-test",
      model: "deepseek-v4-flash",
      fetch: fetchMock,
      thinking: true,
    })(req);

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.thinking).toEqual({ type: "enabled" });
    expect(body.tool_choice).toBe("auto");
  });

  it("Authorization 헤더에 키를 담는다", async () => {
    const fetchMock = vi.fn(async () => reply({ content: [] }));
    await transportWith(fetchMock)(req);

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer sk-test");
  });

  it("HTTP 실패면 상태코드를 담아 throw", async () => {
    const transport = transportWith(async () => new Response("nope", { status: 429 }));
    await expect(transport(req)).rejects.toThrow(/429/);
  });

  // thinking 을 끈 모델이 tool 호출 대신 본문 텍스트로 답하는 실패 모드.
  // 여기서 안 잡으면 PromptedGenerator 가 조용히 섹션을 버리고 로그도 안 남는다.
  it("tool 호출 없이 텍스트만 오면 throw", async () => {
    const transport = transportWith(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: '{"content": []}' } }] }),
          { status: 200 },
        ),
    );
    await expect(transport(req)).rejects.toThrow(/tool/i);
  });

  it("arguments 가 JSON 이 아니면 throw", async () => {
    const transport = transportWith(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              { message: { tool_calls: [{ function: { name: "emit_section", arguments: "{oops" } }] } },
            ],
          }),
          { status: 200 },
        ),
    );
    await expect(transport(req)).rejects.toThrow(/JSON/i);
  });

  // 캐시 히트율은 붙여보기 전엔 알 수 없는 값이라 처음부터 관측 가능하게 둔다.
  it("usage 를 onUsage 로 넘긴다", async () => {
    const onUsage = vi.fn();
    const usage = { prompt_cache_hit_tokens: 832, prompt_cache_miss_tokens: 668 };
    await transportWith(async () => reply({ content: [] }, usage), { onUsage })(req);
    expect(onUsage).toHaveBeenCalledWith("strengths", usage);
  });
});

/**
 * 재시도가 없던 시절의 실패 모드가 이 테스트들이 막는 것이다.
 *
 * 섹션 하나가 실패하면 PromptedGenerator 가 조용히 건너뛰고, 그 섹션은 저장되지
 * 않는다. 다음 열람에서 다시 missing 으로 잡혀 LLM 을 또 부른다 — 성공할 때까지
 * 매 열람마다. 실제로 match_sections 에 08-23 자 v1 행이 열흘째 갱신되지 않은 채
 * 남아 있었다. 한 요청 안에서 한 번 더 시도하면 그 고리가 대부분 끊긴다.
 */
describe("재시도", () => {
  const ok = () => reply({ content: [] });

  it("5xx 면 한 번 더 시도한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("boom", { status: 503 }))
      .mockResolvedValueOnce(ok());
    expect(await transportWith(fetchMock as unknown as typeof fetch)(req)).toEqual({ content: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("429 면 한 번 더 시도한다 — 잠깐의 혼잡이지 잘못된 요청이 아니다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
      .mockResolvedValueOnce(ok());
    expect(await transportWith(fetchMock as unknown as typeof fetch)(req)).toEqual({ content: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("네트워크 오류면 한 번 더 시도한다", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(ok());
    expect(await transportWith(fetchMock as unknown as typeof fetch)(req)).toEqual({ content: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // tool 호출 없이 텍스트만 오는 것은 모델이 가끔 하는 일이라 다시 물어볼 값이 있다.
  it("tool 호출이 없으면 한 번 더 시도한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "그냥 글" } }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(ok());
    expect(await transportWith(fetchMock as unknown as typeof fetch)(req)).toEqual({ content: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  // 400 은 우리가 잘못 보낸 것이다. 같은 몸통으로 다시 물으면 같은 400 이 온다.
  it("400 이면 다시 시도하지 않는다", async () => {
    const fetchMock = vi.fn(async () => new Response("bad request", { status: 400 }));
    await expect(transportWith(fetchMock)(req)).rejects.toThrow(/400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /**
   * 타임아웃만은 재시도하지 않는다. 한 번에 timeoutMs 를 다 쓴 뒤 또 그만큼 쓰면
   * 라우트의 maxDuration 을 넘겨 **모든** 섹션이 함께 죽는다 — 한 섹션을 구하려다
   * 나머지 여섯을 잃는 거래다.
   */
  it("타임아웃이면 다시 시도하지 않는다", async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    await expect(transportWith(fetchMock)(req)).rejects.toThrow(/시간/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("두 번 다 실패하면 마지막 오류를 던진다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("first", { status: 500 }))
      .mockResolvedValueOnce(new Response("second", { status: 502 }));
    await expect(transportWith(fetchMock as unknown as typeof fetch)(req)).rejects.toThrow(/502/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries: 0 이면 재시도하지 않는다", async () => {
    const fetchMock = vi.fn(async () => new Response("boom", { status: 500 }));
    await expect(
      createDeepSeekTransport({
        apiKey: "sk-test",
        model: "deepseek-v4-flash",
        fetch: fetchMock,
        retries: 0,
      })(req),
    ).rejects.toThrow(/500/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("모든 시도에 제한 시간을 건다 — 끝나지 않는 콜이 라우트를 통째로 잡아먹지 않게", async () => {
    const fetchMock = vi.fn(async () => ok());
    await createDeepSeekTransport({
      apiKey: "sk-test",
      model: "deepseek-v4-flash",
      fetch: fetchMock,
      timeoutMs: 1234,
    })(req);

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
