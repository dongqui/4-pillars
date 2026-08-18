import { describe, it, expect, vi } from "vitest";
import { InsufficientTicketsError } from "./ticket-port";
import { makeTicketPort } from "./deps";

describe("makeTicketPort", () => {
  it("잔액을 그대로 위임한다", async () => {
    const port = makeTicketPort({
      getBalance: vi.fn(async () => 6),
      spend: vi.fn(),
      refund: vi.fn(),
    });
    expect(await port.getBalance("7")).toBe(6);
  });

  it("차감이 성사되면 조용히 지나간다", async () => {
    const spend = vi.fn(async () => ({ ok: true as const, kind: "spent" as const, balance: 5 }));
    const port = makeTicketPort({ getBalance: vi.fn(), spend, refund: vi.fn() });
    await expect(port.spend("7", "42")).resolves.toBeUndefined();
    // 상담 1건이 차감 단위다 — consultationId 가 그대로 멱등 키가 된다.
    expect(spend).toHaveBeenCalledWith({
      userId: "7",
      feature: "consultation",
      subjectKey: "42",
    });
  });

  it("이미 차감된 상담을 다시 열어도 던지지 않는다 — already 는 성공이다", async () => {
    const port = makeTicketPort({
      getBalance: vi.fn(),
      spend: vi.fn(async () => ({ ok: true as const, kind: "already" as const, balance: 5 })),
      refund: vi.fn(),
    });
    await expect(port.spend("7", "42")).resolves.toBeUndefined();
  });

  it("잔액이 부족하면 InsufficientTicketsError 를 던진다 — 라우트가 이 에러만 402 로 바꾼다", async () => {
    const port = makeTicketPort({
      getBalance: vi.fn(),
      spend: vi.fn(async () => ({ ok: false as const, kind: "insufficient" as const, balance: 0 })),
      refund: vi.fn(),
    });
    await expect(port.spend("7", "42")).rejects.toBeInstanceOf(InsufficientTicketsError);
  });

  it("되돌리기를 위임한다", async () => {
    const refund = vi.fn(async () => ({
      ok: true as const,
      kind: "refunded" as const,
      balance: 6,
    }));
    const port = makeTicketPort({ getBalance: vi.fn(), spend: vi.fn(), refund });
    await port.refund("7", "42");
    expect(refund).toHaveBeenCalledWith({
      userId: "7",
      feature: "consultation",
      subjectKey: "42",
    });
  });

  it("되돌릴 것이 없어도 던지지 않는다 — 이미 되돌아간 상태다", async () => {
    const port = makeTicketPort({
      getBalance: vi.fn(),
      spend: vi.fn(),
      refund: vi.fn(async () => ({
        ok: true as const,
        kind: "nothing_to_refund" as const,
        balance: 6,
      })),
    });
    await expect(port.refund("7", "42")).resolves.toBeUndefined();
  });
});
