import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortOneError, PortOneNotConfiguredError } from "@/lib/payments/portone";
import type { RefundCandidate } from "@/lib/payments/refund-store";
import { handleRefund, type RefundDeps } from "./handler";

const NOW = new Date("2026-10-02T09:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const candidate: RefundCandidate = {
  purchaseId: "9", userId: "7", paymentId: "saju-abc", status: "paid", amount: 5000, tickets: 6,
  remaining: 4, paidAt: new Date(NOW.getTime() - DAY),
};

let deferred: (() => Promise<void>)[] = [];
const runDeferred = () => Promise.all(deferred.splice(0).map((t) => t()));

function deps(over: Partial<RefundDeps> = {}): RefundDeps {
  deferred = [];
  return {
    userId: "7",
    now: NOW,
    configured: () => true,
    checkLimit: vi.fn(async () => true),
    getUser: vi.fn(async () => ({ displayName: "동진", email: "dj@example.com" })),
    findCandidate: vi.fn(async () => candidate),
    execute: vi.fn(async () => ({ paymentId: "saju-exec", remaining: 4 })),
    cancel: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    insertTicket: vi.fn(async () => ({ id: "42", createdAt: NOW.toISOString() })),
    mailer: { send: vi.fn(async () => {}) },
    defer: (task) => {
      deferred.push(task);
    },
    ...over,
  };
}

const body = { purchaseId: "9", reason: "실수로 결제했어요" };

// 핸들러가 실패·건너뜀을 console 로 남긴다 — 테스트 출력을 깨끗하게 두려고 막고, 필요한 곳에서만 확인한다.
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("handleRefund", () => {
  it("비로그인은 401", async () => {
    expect((await handleRefund(body, deps({ userId: null }))).status).toBe(401);
  });

  it("사용자 행이 없으면 401", async () => {
    const d = deps({ getUser: vi.fn(async () => null) });
    expect((await handleRefund(body, d)).status).toBe(401);
    expect(d.execute).not.toHaveBeenCalled();
  });

  it.each([
    [{}],
    [{ purchaseId: "abc", reason: "기타" }],
    [{ purchaseId: "9", reason: "그냥요" }],
    [{ purchaseId: "9" }],
  ])("본문이 틀리면 400 — %j", async (raw) => {
    const d = deps();
    expect(await handleRefund(raw, d)).toEqual({ status: 400, body: { error: "요청을 확인해 주세요" } });
    expect(d.execute).not.toHaveBeenCalled();
  });

  it("시크릿이 없으면 503 — DB 를 건드리지 않는다", async () => {
    const d = deps({ configured: () => false });
    expect(await handleRefund(body, d)).toEqual({ status: 503, body: { error: "지금은 환불을 처리할 수 없어요" } });
    expect(d.findCandidate).not.toHaveBeenCalled();
    expect(d.execute).not.toHaveBeenCalled();
  });

  it("remaining 을 모르는 행은 409 — execute 에 넘길 값이 없다", async () => {
    const d = deps({ findCandidate: vi.fn(async () => ({ ...candidate, remaining: null })) });
    expect((await handleRefund(body, d)).status).toBe(409);
    expect(d.execute).not.toHaveBeenCalled();
  });

  it("한도를 넘으면 429", async () => {
    const d = deps({ checkLimit: vi.fn(async () => false) });
    expect((await handleRefund(body, d)).status).toBe(429);
    expect(d.execute).not.toHaveBeenCalled();
  });

  it("후보가 없으면 409 — 남의 결제와 없는 결제를 가르지 않는다", async () => {
    const d = deps({ findCandidate: vi.fn(async () => null) });
    expect(await handleRefund(body, d)).toEqual({ status: 409, body: { error: "환불할 수 없는 결제예요" } });
    expect(d.execute).not.toHaveBeenCalled();
  });

  it("7일이 지났으면 409 — 목록이 걸렀어도 실행 직전에 다시 본다", async () => {
    const d = deps({ findCandidate: vi.fn(async () => ({ ...candidate, paidAt: new Date(NOW.getTime() - 8 * DAY) })) });
    expect((await handleRefund(body, d)).status).toBe(409);
    expect(d.execute).not.toHaveBeenCalled();
  });

  it("환불액은 서버가 계산한다 — 6장 5,000원에서 2장 쓰면 3,000원을 execute 에 넘긴다", async () => {
    const d = deps();
    const r = await handleRefund({ ...body, amount: 999999 }, d);
    expect(r).toEqual({ status: 200, body: { amount: 3000, pending: false } });
    expect(d.execute).toHaveBeenCalledWith({ purchaseId: "9", userId: "7", amount: 3000, remaining: 4, now: NOW });
  });

  it("부분 환불이면 포트원에 amount 를 보내고, 전액이면 보내지 않는다", async () => {
    const partial = deps();
    await handleRefund(body, partial);
    expect(partial.cancel).toHaveBeenCalledWith("saju-exec", { reason: "실수로 결제했어요", amount: 3000 });

    const full = deps({ findCandidate: vi.fn(async () => ({ ...candidate, remaining: 6 })) });
    await handleRefund(body, full);
    expect(full.cancel).toHaveBeenCalledWith("saju-exec", { reason: "실수로 결제했어요" });
  });

  it("execute 가 0행이면 409 — 더블 클릭의 두 번째 요청. 포트원을 부르지 않는다", async () => {
    const d = deps({ execute: vi.fn(async () => null) });
    expect((await handleRefund(body, d)).status).toBe(409);
    expect(d.cancel).not.toHaveBeenCalled();
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it("execute 가 던지면(잔액 CHECK 롤백) 예외가 그대로 나간다 — 라우트가 500 으로 옮긴다. 포트원·티켓 없음", async () => {
    const d = deps({
      execute: vi.fn(async () => {
        throw new Error("check");
      }),
    });
    await expect(handleRefund(body, d)).rejects.toThrow("check");
    expect(d.cancel).not.toHaveBeenCalled();
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it("성공하면 resolved 티켓을 남기고 메일은 응답 뒤에 보낸다", async () => {
    const d = deps();
    await handleRefund({ ...body, body: "두 번 눌렀어요" }, d);
    expect(d.insertTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "7", kind: "refund", purchaseId: "9", refundReason: "실수로 결제했어요",
        targetLabel: "이용권 6장 · 5,000원", body: "두 번 눌렀어요", replyEmail: "dj@example.com",
        status: "resolved", adminNote: "자동 환불 3,000원",
      }),
    );
    expect(d.mailer!.send).not.toHaveBeenCalled();
    await runDeferred();
    expect(d.mailer!.send).toHaveBeenCalledTimes(1);
    const mail = (d.mailer!.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { subject: string; text: string };
    expect(mail.subject).toContain("[환불 완료]");
    expect(mail.text).toContain("환불액: 3,000원");
    expect(d.markFailed).not.toHaveBeenCalled();
  });

  // DB 는 이미 refunded 다. 되돌리지 않고 운영자가 콘솔에서 마저 취소한다 — 설계 문서 "실행" 절.
  it("포트원이 실패하면 pending=true, refund_failed_at 을 찍고 open 티켓과 [환불 실패] 메일", async () => {
    const d = deps({
      cancel: vi.fn(async () => {
        throw new PortOneError("pg down", "PG_PROVIDER");
      }),
    });
    expect(await handleRefund(body, d)).toEqual({ status: 200, body: { amount: 3000, pending: true } });
    expect(d.markFailed).toHaveBeenCalledWith("9");
    expect(d.insertTicket).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open", adminNote: "포트원 취소 실패(PG_PROVIDER: pg down) — 콘솔에서 수동 취소" }),
    );
    await runDeferred();
    const mail = (d.mailer!.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { subject: string };
    expect(mail.subject).toContain("[환불 실패]");
    expect(errorSpy).toHaveBeenCalled();
  });

  it("실행 도중 시크릿이 사라져도 다른 포트원 실패와 같다 — pending, open 티켓, [환불 실패] 메일", async () => {
    const d = deps({
      cancel: vi.fn(async () => {
        throw new PortOneNotConfiguredError();
      }),
    });
    expect(await handleRefund(body, d)).toEqual({ status: 200, body: { amount: 3000, pending: true } });
    expect(d.markFailed).toHaveBeenCalledWith("9");
    expect(d.insertTicket).toHaveBeenCalledWith(expect.objectContaining({ status: "open" }));
    await runDeferred();
    const mail = (d.mailer!.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { subject: string };
    expect(mail.subject).toContain("[환불 실패]");
  });

  it("markFailed 가 던져도 200 pending — 티켓도 메일도 간다(DB 는 이미 refunded)", async () => {
    const d = deps({
      cancel: vi.fn(async () => {
        throw new PortOneError("pg down", "PG_PROVIDER");
      }),
      markFailed: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    expect(await handleRefund(body, d)).toEqual({ status: 200, body: { amount: 3000, pending: true } });
    expect(d.insertTicket).toHaveBeenCalledWith(expect.objectContaining({ status: "open" }));
    expect(errorSpy).toHaveBeenCalled();
    await runDeferred();
    const mail = (d.mailer!.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { subject: string };
    expect(mail.subject).toContain("[환불 실패]");
  });

  it("insertTicket 이 던져도 200 — 돈은 돌아갔다. 메일은 티켓 번호 없이 간다", async () => {
    const d = deps({
      insertTicket: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    expect(await handleRefund(body, d)).toEqual({ status: 200, body: { amount: 3000, pending: false } });
    expect(errorSpy).toHaveBeenCalled();
    await runDeferred();
    const mail = (d.mailer!.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { subject: string; text: string };
    expect(mail.subject).toContain("[환불 완료]");
    expect(mail.text).toContain("문의 #-");
  });

  it("insertTicket 이 null 이면(열린 환불 요청과 충돌) 200 이고 경고를 남긴다", async () => {
    const d = deps({ insertTicket: vi.fn(async () => null) });
    expect(await handleRefund(body, d)).toEqual({ status: 200, body: { amount: 3000, pending: false } });
    expect(warnSpy).toHaveBeenCalledWith("[refund] 티켓이 저장되지 않았다(열린 환불 요청과 충돌)", "9");
  });

  it("메일러가 없으면 건너뛰고 200", async () => {
    expect((await handleRefund(body, deps({ mailer: null }))).status).toBe(200);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("알림 메일이 실패해도 응답은 그대로다", async () => {
    const d = deps({
      mailer: {
        send: vi.fn(async () => {
          throw new Error("smtp");
        }),
      },
    });
    expect((await handleRefund(body, d)).status).toBe(200);
    await expect(runDeferred()).resolves.toBeDefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});
