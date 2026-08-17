import { describe, it, expect } from "vitest";
import { CONSULT_MODEL } from "./model";
import { DEEPSEEK_URL, createDeepSeekChatTransport } from "./chat-transport";

const req = {
  model: CONSULT_MODEL,
  messages: [
    { role: "system" as const, content: "규칙" },
    { role: "user" as const, content: "안녕" },
  ],
  toolName: "emit_reply",
  inputSchema: { type: "object", properties: {} },
  maxTokens: 900,
};

function okResponse(args: unknown, usage?: unknown) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(args) } }] } }],
      usage: usage === undefined ? { prompt_tokens: 1200, completion_tokens: 300 } : usage,
    }),
    { status: 200 },
  );
}

describe("createDeepSeekChatTransport", () => {
  it("tool 인자를 파싱해 돌려준다", async () => {
    const t = createDeepSeekChatTransport({ apiKey: "k", fetch: async () => okResponse({ a: 1 }) });
    const r = await t(req);
    expect(r.args).toEqual({ a: 1 });
  });

  it("토큰 사용량을 반환값에 담는다 — 상담 행에 누적해야 한다", async () => {
    const t = createDeepSeekChatTransport({ apiKey: "k", fetch: async () => okResponse({}) });
    const r = await t(req);
    expect(r.usage).toEqual({ promptTokens: 1200, completionTokens: 300 });
  });

  it("usage 가 없으면 0 으로 둔다", async () => {
    const t = createDeepSeekChatTransport({
      apiKey: "k",
      fetch: async () => okResponse({}, null),
    });
    const r = await t(req);
    expect(r.usage).toEqual({ promptTokens: 0, completionTokens: 0 });
  });

  it("메시지 배열을 그대로 싣고 tool 을 강제한다", async () => {
    let body: any;
    const t = createDeepSeekChatTransport({
      apiKey: "k",
      fetch: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return okResponse({});
      },
    });
    await t(req);
    expect(body.messages).toHaveLength(2);
    expect(body.tool_choice).toEqual({ type: "function", function: { name: "emit_reply" } });
    expect(body.max_tokens).toBe(900);
  });

  it("thinking 을 끈다 — 켜면 tool_choice 강제가 400 으로 거부된다", async () => {
    let body: any;
    const t = createDeepSeekChatTransport({
      apiKey: "k",
      fetch: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return okResponse({});
      },
    });
    await t(req);
    expect(body.thinking).toEqual({ type: "disabled" });
  });

  it("HTTP 에러면 던진다", async () => {
    const t = createDeepSeekChatTransport({
      apiKey: "k",
      fetch: async () => new Response("nope", { status: 500 }),
    });
    await expect(t(req)).rejects.toThrow(/500/);
  });

  it("tool 을 안 부르고 텍스트로 답하면 던진다", async () => {
    const t = createDeepSeekChatTransport({
      apiKey: "k",
      fetch: async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "안녕하세요" } }] }), {
          status: 200,
        }),
    });
    await expect(t(req)).rejects.toThrow(/tool/);
  });

  it("tool 인자가 JSON 이 아니면 던진다", async () => {
    const t = createDeepSeekChatTransport({
      apiKey: "k",
      fetch: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { tool_calls: [{ function: { arguments: "{깨진" } }] } }],
          }),
          { status: 200 },
        ),
    });
    await expect(t(req)).rejects.toThrow(/JSON/);
  });

  it("엔드포인트는 DeepSeek chat/completions 다", () => {
    expect(DEEPSEEK_URL).toBe("https://api.deepseek.com/chat/completions");
  });
});

describe("CONSULT_MODEL", () => {
  it("리포트와 따로 움직일 수 있도록 상수로 분리돼 있다", () => {
    expect(CONSULT_MODEL).toBe("deepseek-v4-pro");
  });
});
