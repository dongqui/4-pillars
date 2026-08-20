import { describe, it, expect, vi } from "vitest";
import { confirmPayment, type ConfirmDeps } from "./confirm";
import type { PendingOrder } from "./store";
import type { TossPayment } from "./toss";

const order: PendingOrder = {
  paymentId: "saju-abc",
  userId: "7",
  amount: 5000,
  status: "pending",
};

const paid: TossPayment = {
  paymentKey: "pk-1",
  orderId: "saju-abc",
  status: "DONE",
  totalAmount: 5000,
  currency: "KRW",
  lastTransactionKey: "tx-1",
};

function deps(over: Partial<ConfirmDeps> = {}): ConfirmDeps {
  return {
    findOrder: vi.fn(async () => order),
    resolvePayment: vi.fn(async () => paid),
    markPaid: vi.fn(async () => true),
    markFailed: vi.fn(async () => {}),
    ...over,
  };
}

describe("confirmPayment", () => {
  it("주문이 없으면 not_found — 토스를 부르지 않는다", async () => {
    const d = deps({ findOrder: vi.fn(async () => null) });
    expect(await confirmPayment("saju-none", d)).toEqual({ ok: false, kind: "not_found" });
    expect(d.resolvePayment).not.toHaveBeenCalled();
  });

  it("이미 paid 인 주문은 토스를 다시 부르지 않고 already", async () => {
    const d = deps({ findOrder: vi.fn(async () => ({ ...order, status: "paid" as const })) });
    expect(await confirmPayment("saju-abc", d)).toEqual({
      ok: true,
      kind: "already",
    });
    expect(d.resolvePayment).not.toHaveBeenCalled();
  });

  it("정상 결제는 confirmed + transactionId 를 넘긴다", async () => {
    const d = deps();
    expect(await confirmPayment("saju-abc", d)).toEqual({
      ok: true,
      kind: "confirmed",
    });
    expect(d.markPaid).toHaveBeenCalledWith({ paymentId: "saju-abc", transactionId: "tx-1" });
  });

  it("markPaid 가 false 면 다시 읽어 확인한다 — 그 사이 다른 경로가 먼저 확정했으면 already", async () => {
    const findOrder = vi
      .fn<ConfirmDeps["findOrder"]>()
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: "paid" });
    const d = deps({ findOrder, markPaid: vi.fn(async () => false) });
    expect(await confirmPayment("saju-abc", d)).toEqual({
      ok: true,
      kind: "already",
    });
    expect(d.markFailed).not.toHaveBeenCalled();
  });

  it("markPaid 가 false 이고 다시 읽은 행이 failed/refunded 면 already 가 아니라 not_paid", async () => {
    for (const status of ["failed", "refunded"] as const) {
      const findOrder = vi
        .fn<ConfirmDeps["findOrder"]>()
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce({ ...order, status });
      const d = deps({ findOrder, markPaid: vi.fn(async () => false) });
      expect(await confirmPayment("saju-abc", d)).toEqual({ ok: false, kind: "not_paid" });
    }
  });

  it("markPaid 가 false 이고 다시 읽었더니 행이 사라졌으면 not_paid", async () => {
    const findOrder = vi
      .fn<ConfirmDeps["findOrder"]>()
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce(null);
    const d = deps({ findOrder, markPaid: vi.fn(async () => false) });
    expect(await confirmPayment("saju-abc", d)).toEqual({ ok: false, kind: "not_paid" });
  });

  it("CANCELED / ABORTED / EXPIRED / PARTIAL_CANCELED 는 not_paid 이고 행을 내린다", async () => {
    for (const status of ["CANCELED", "ABORTED", "EXPIRED", "PARTIAL_CANCELED"] as const) {
      const d = deps({ resolvePayment: vi.fn(async () => ({ ...paid, status })) });
      expect(await confirmPayment("saju-abc", d)).toEqual({ ok: false, kind: "not_paid" });
      expect(d.markFailed).toHaveBeenCalledWith("saju-abc");
      expect(d.markPaid).not.toHaveBeenCalled();
    }
  });

  it("READY / IN_PROGRESS / WAITING_FOR_DEPOSIT 은 not_paid 지만 행을 건드리지 않는다 — 웹훅이 뒤이어 확정할 수 있다", async () => {
    for (const status of ["READY", "IN_PROGRESS", "WAITING_FOR_DEPOSIT"] as const) {
      const d = deps({ resolvePayment: vi.fn(async () => ({ ...paid, status })) });
      expect(await confirmPayment("saju-abc", d)).toEqual({ ok: false, kind: "not_paid" });
      expect(d.markFailed).not.toHaveBeenCalled();
      expect(d.markPaid).not.toHaveBeenCalled();
    }
  });

  it("금액이 다르면 amount_mismatch — 확정하지 않고 행을 내린다", async () => {
    const d = deps({ resolvePayment: vi.fn(async () => ({ ...paid, totalAmount: 100 })) });
    expect(await confirmPayment("saju-abc", d)).toEqual({ ok: false, kind: "amount_mismatch" });
    expect(d.markPaid).not.toHaveBeenCalled();
    expect(d.markFailed).toHaveBeenCalledWith("saju-abc");
  });

  it("통화가 다르면 currency_mismatch", async () => {
    const d = deps({ resolvePayment: vi.fn(async () => ({ ...paid, currency: "JPY" })) });
    expect(await confirmPayment("saju-abc", d)).toEqual({ ok: false, kind: "currency_mismatch" });
    expect(d.markPaid).not.toHaveBeenCalled();
    expect(d.markFailed).toHaveBeenCalledWith("saju-abc");
  });

  it("lastTransactionKey 가 없으면 markPaid 에 null 로 넘긴다", async () => {
    const d = deps({
      resolvePayment: vi.fn(async () => ({ ...paid, lastTransactionKey: undefined })),
    });
    await confirmPayment("saju-abc", d);
    expect(d.markPaid).toHaveBeenCalledWith({ paymentId: "saju-abc", transactionId: null });
  });

  it("토스 승인이 던지면 그대로 올린다 — 일시 장애를 미결제로 접지 않는다", async () => {
    const d = deps({
      resolvePayment: vi.fn(async () => {
        throw new Error("network");
      }),
    });
    await expect(confirmPayment("saju-abc", d)).rejects.toThrow("network");
    expect(d.markFailed).not.toHaveBeenCalled();
  });
});
