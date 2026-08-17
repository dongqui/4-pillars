import { describe, it, expect, vi } from "vitest";
import { openConsultation, advanceConsultation, ConsultationClosedError } from "./service";
import { InsufficientTicketsError, type TicketPort } from "./ticket-port";
import type { ConsultationRow, MessageRow } from "./store";
import type { ChatTransport } from "./chat-transport";

const consultation: ConsultationRow = {
  id: "7",
  userId: "3",
  profileId: "12",
  status: "open",
  turnsUsed: 0,
  turnLimit: 10,
  title: null,
  createdAt: "2026-08-17T00:00:00.000Z",
  closedAt: null,
};

const reply = {
  bubbles: ["첫 마디예요", "둘째 마디예요"],
  suggestions: ["더 들려주실래요?", "다른 얘기도 할까요?"],
  crisis: false,
};

function fakeTransport(args: unknown = reply): ChatTransport {
  return async () => ({ args, usage: { promptTokens: 1200, completionTokens: 300 } });
}

function fakeTickets(over: Partial<TicketPort> = {}): TicketPort {
  return {
    getBalance: vi.fn(async () => 3),
    spend: vi.fn(async () => {}),
    refund: vi.fn(async () => {}),
    ...over,
  };
}

function fakeStore(over: Record<string, unknown> = {}) {
  return {
    createConsultation: vi.fn(async () => consultation),
    getConsultation: vi.fn(async () => consultation),
    listMessages: vi.fn(async (): Promise<MessageRow[]> => []),
    appendMessage: vi.fn(async () => ({}) as MessageRow),
    commitTurn: vi.fn(async () => ({ ...consultation, turnsUsed: 1 })),
    ...over,
  };
}

function deps(over: Record<string, unknown> = {}) {
  return {
    store: fakeStore(),
    tickets: fakeTickets(),
    transport: fakeTransport(),
    model: "m",
    ...over,
  } as any;
}

const openInput = { userId: "3", profileId: "12", facts: "일간: 갑목", utterance: "잠이 안 와요" };

describe("openConsultation", () => {
  it("행을 먼저 만들고 그 id 로 차감한다 — 멱등키가 있어야 두 번 안 빠진다", async () => {
    const d = deps();
    await openConsultation(openInput, d);
    expect(d.store.createConsultation).toHaveBeenCalled();
    expect(d.tickets.spend).toHaveBeenCalledWith("3", "7");
  });

  it("차감이 실패하면 LLM 을 부르지 않는다", async () => {
    let called = false;
    const d = deps({
      tickets: fakeTickets({
        spend: async () => {
          throw new InsufficientTicketsError();
        },
      }),
      transport: (async () => {
        called = true;
        return { args: reply, usage: { promptTokens: 0, completionTokens: 0 } };
      }) as ChatTransport,
    });
    await expect(openConsultation(openInput, d)).rejects.toThrow(InsufficientTicketsError);
    expect(called).toBe(false);
  });

  it("첫 턴 LLM 이 실패하면 이용권을 되돌린다", async () => {
    const d = deps({
      transport: (async () => {
        throw new Error("DeepSeek 500");
      }) as ChatTransport,
    });
    await expect(openConsultation(openInput, d)).rejects.toThrow(/DeepSeek/);
    expect(d.tickets.refund).toHaveBeenCalledWith("3", "7");
  });

  it("되돌리기까지 실패해도 원래 에러를 올려보낸다 — turns_used=0 행이 증거다", async () => {
    const d = deps({
      transport: (async () => {
        throw new Error("DeepSeek 500");
      }) as ChatTransport,
      tickets: fakeTickets({
        refund: async () => {
          throw new Error("환불 실패");
        },
      }),
    });
    await expect(openConsultation(openInput, d)).rejects.toThrow(/DeepSeek/);
  });

  it("첫 턴에서 받은 제목을 상담에 적는다", async () => {
    const d = deps({ transport: fakeTransport({ ...reply, title: "잠 못 드는 밤" }) });
    await openConsultation(openInput, d);
    expect(d.store.commitTurn).toHaveBeenCalledWith(
      expect.objectContaining({ title: "잠 못 드는 밤", turnsUsed: 1, status: "open" }),
    );
  });

  it("사용자 발화와 상담사 답을 둘 다 남긴다", async () => {
    const d = deps();
    await openConsultation(openInput, d);
    expect(d.store.appendMessage).toHaveBeenCalledTimes(2);
    expect(d.store.appendMessage.mock.calls[0][0].role).toBe("user");
    expect(d.store.appendMessage.mock.calls[1][0].role).toBe("counselor");
  });

  it("토큰 사용량을 상담 행에 누적한다", async () => {
    const d = deps();
    await openConsultation(openInput, d);
    expect(d.store.commitTurn).toHaveBeenCalledWith(
      expect.objectContaining({ tokensIn: 1200, tokensOut: 300 }),
    );
  });
});

describe("advanceConsultation", () => {
  const advInput = { userId: "3", id: "7", facts: "일간: 갑목", utterance: "그래서 고민이에요" };

  it("이용권을 다시 쓰지 않는다 — 상담 1건에 1장이다", async () => {
    const d = deps();
    await advanceConsultation(advInput, d);
    expect(d.tickets.spend).not.toHaveBeenCalled();
  });

  it("없는 상담이면 null 이다", async () => {
    const d = deps({ store: fakeStore({ getConsultation: async () => null }) });
    expect(await advanceConsultation(advInput, d)).toBeNull();
  });

  it("턴을 다 쓴 상담이면 던진다", async () => {
    const d = deps({
      store: fakeStore({
        getConsultation: async () => ({ ...consultation, turnsUsed: 10 }),
      }),
    });
    await expect(advanceConsultation(advInput, d)).rejects.toThrow(ConsultationClosedError);
  });

  it("닫힌 상담이면 던진다", async () => {
    const d = deps({
      store: fakeStore({
        getConsultation: async () => ({ ...consultation, status: "closed" as const }),
      }),
    });
    await expect(advanceConsultation(advInput, d)).rejects.toThrow(ConsultationClosedError);
  });

  it("마지막 턴을 쓰면 상담을 닫는다", async () => {
    const d = deps({
      store: fakeStore({
        getConsultation: async () => ({ ...consultation, turnsUsed: 9 }),
      }),
    });
    await advanceConsultation(advInput, d);
    expect(d.store.commitTurn).toHaveBeenCalledWith(
      expect.objectContaining({ turnsUsed: 10, status: "closed" }),
    );
  });

  it("위기 턴은 차감하지 않는다", async () => {
    const d = deps({
      store: fakeStore({
        getConsultation: async () => ({ ...consultation, turnsUsed: 4 }),
      }),
      transport: fakeTransport({ ...reply, crisis: true }),
    });
    await advanceConsultation(advInput, d);
    expect(d.store.commitTurn).toHaveBeenCalledWith(
      expect.objectContaining({ turnsUsed: 4, status: "open" }),
    );
  });

  it("무료 위기 턴 한도를 채웠으면 위기여도 차감한다", async () => {
    const crisisMsg = {
      id: "1",
      role: "counselor" as const,
      bubbles: ["안내"],
      suggestions: [],
      crisis: true,
      turnNo: 1,
      createdAt: "2026-08-17T00:00:00.000Z",
    };
    const d = deps({
      store: fakeStore({
        getConsultation: async () => ({ ...consultation, turnsUsed: 4 }),
        listMessages: async () => [crisisMsg, crisisMsg, crisisMsg],
      }),
      transport: fakeTransport({ ...reply, crisis: true }),
    });
    await advanceConsultation(advInput, d);
    expect(d.store.commitTurn).toHaveBeenCalledWith(
      expect.objectContaining({ turnsUsed: 5 }),
    );
  });

  it("이후 턴은 제목을 덮어쓰지 않는다", async () => {
    const d = deps();
    await advanceConsultation(advInput, d);
    expect(d.store.commitTurn).toHaveBeenCalledWith(expect.objectContaining({ title: null }));
  });

  it("LLM 이 실패하면 사용자 발화도 남기지 않는다 — 유령 발화가 이력에 남으면 안 된다", async () => {
    const d = deps({
      transport: (async () => {
        throw new Error("DeepSeek 500");
      }) as ChatTransport,
    });
    await expect(advanceConsultation(advInput, d)).rejects.toThrow(/DeepSeek/);
    expect(d.store.appendMessage).not.toHaveBeenCalled();
  });
});
