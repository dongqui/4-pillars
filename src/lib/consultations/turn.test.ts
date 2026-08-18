import { describe, it, expect } from "vitest";
import { runTurn } from "./turn";
import { COUNSEL_TOOL_NAME, MAX_REPLY_TOKENS } from "./schema";
import type { ChatRequest, ChatTransport } from "./chat-transport";

const reply = {
  bubbles: ["첫 마디예요", "둘째 마디예요"],
  suggestions: ["더 들려주실래요?", "다른 얘기도 할까요?"],
  crisis: false,
};

function fakeTransport(args: unknown = reply) {
  const seen: ChatRequest[] = [];
  const transport: ChatTransport = async (req) => {
    seen.push(req);
    return { args, usage: { promptTokens: 1200, completionTokens: 300 } };
  };
  return { transport, seen };
}

/** 테스트가 실제로 들여다보는 tool 파라미터 속성만. 나머지는 알 바 아니다. */
interface ReplyToolProperties {
  suggestions: { maxItems: number };
  title?: unknown;
}

const base = {
  facts: "일간: 갑목",
  history: [],
  utterance: "요즘 잠이 안 와요",
  remaining: 8,
  isLast: false,
  first: false,
};

describe("runTurn", () => {
  it("파싱된 답과 사용량을 함께 돌려준다", async () => {
    const { transport } = fakeTransport();
    const r = await runTurn(base, { transport, model: "m" });
    expect(r.reply.bubbles).toEqual(["첫 마디예요", "둘째 마디예요"]);
    expect(r.usage).toEqual({ promptTokens: 1200, completionTokens: 300 });
  });

  it("tool 이름과 출력 상한을 실어 보낸다", async () => {
    const { transport, seen } = fakeTransport();
    await runTurn(base, { transport, model: "m" });
    expect(seen[0].toolName).toBe(COUNSEL_TOOL_NAME);
    expect(seen[0].maxTokens).toBe(MAX_REPLY_TOKENS);
    expect(seen[0].model).toBe("m");
  });

  it("마지막 턴이면 추천질문 없는 스키마를 보낸다", async () => {
    const { transport, seen } = fakeTransport({ ...reply, suggestions: [] });
    await runTurn({ ...base, isLast: true, remaining: 1 }, { transport, model: "m" });
    const props = seen[0].inputSchema.properties as ReplyToolProperties;
    expect(props.suggestions.maxItems).toBe(0);
  });

  it("첫 턴이면 제목을 요구하고 받아온다", async () => {
    const { transport, seen } = fakeTransport({ ...reply, title: "잠 못 드는 밤" });
    const r = await runTurn({ ...base, first: true }, { transport, model: "m" });
    expect((seen[0].inputSchema.properties as ReplyToolProperties).title).toBeDefined();
    expect(r.reply.title).toBe("잠 못 드는 밤");
  });

  it("첫 턴에 제목이 안 오면 발화에서 메운다 — 목록이 '아직 시작하지 않은 상담'으로 거짓말하면 안 된다", async () => {
    const { transport } = fakeTransport(reply);
    const r = await runTurn({ ...base, first: true }, { transport, model: "m" });
    expect(r.reply.title).toBe("요즘 잠이 안 와요");
  });

  it("이후 턴에는 제목을 메우지 않는다 — 기존 제목을 덮어쓰면 안 된다", async () => {
    const { transport } = fakeTransport(reply);
    const r = await runTurn({ ...base, first: false }, { transport, model: "m" });
    expect(r.reply.title).toBeUndefined();
  });

  it("깨진 응답이면 던진다 — 차감 없이 실패해야 한다", async () => {
    const { transport } = fakeTransport({ bubbles: ["하나뿐"] });
    await expect(runTurn(base, { transport, model: "m" })).rejects.toThrow();
  });

  it("transport 가 던지면 그대로 올려보낸다", async () => {
    const transport: ChatTransport = async () => {
      throw new Error("DeepSeek 500");
    };
    await expect(runTurn(base, { transport, model: "m" })).rejects.toThrow(/DeepSeek/);
  });

  it("위기 응답의 crisis 를 그대로 전한다", async () => {
    const { transport } = fakeTransport({ ...reply, crisis: true });
    const r = await runTurn(base, { transport, model: "m" });
    expect(r.reply.crisis).toBe(true);
  });
});
