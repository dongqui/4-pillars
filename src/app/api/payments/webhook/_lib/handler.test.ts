import { describe, it, expect, vi } from "vitest";
import { handleWebhook, type WebhookDeps } from "./handler";

const paidBody = JSON.stringify({
  eventType: "PAYMENT_STATUS_CHANGED",
  createdAt: "2026-08-11T00:00:00.000Z",
  data: { paymentKey: "pk-1", orderId: "saju-abc", status: "DONE" },
});

function deps(over: Partial<WebhookDeps> = {}): WebhookDeps {
  return {
    confirm: vi.fn(async () => ({ ok: true as const, kind: "confirmed" as const })),
    ...over,
  };
}

describe("handleWebhook", () => {
  it("PAYMENT_STATUS_CHANGED 를 확정으로 넘기고 200", async () => {
    const d = deps();
    expect((await handleWebhook(paidBody, d)).status).toBe(200);
    expect(d.confirm).toHaveBeenCalledWith("saju-abc");
  });

  it("본문의 status 를 읽지 않는다 — 서명이 없어서 본문은 신호일 뿐, 판단은 조회가 한다", async () => {
    // 본문이 DONE 이라고 우겨도 확정 여부는 confirm(조회 API) 이 정한다.
    // 여기서 confirm 이 not_paid 를 주면 200 이되 ok:false 여야 한다 — 본문을
    // 근거로 삼았다면 이 테스트는 ok:true 로 통과해 버린다.
    const d = deps({
      confirm: vi.fn(async () => ({ ok: false as const, kind: "not_paid" as const })),
    });
    const r = await handleWebhook(paidBody, d);
    expect(r).toEqual({ status: 200, body: { ok: false, reason: "not_paid" } });
  });

  it("넘기는 값은 본문의 orderId 하나뿐이다 — paymentKey 를 믿고 승인하지 않는다", async () => {
    const d = deps();
    await handleWebhook(paidBody, d);
    expect(d.confirm).toHaveBeenCalledTimes(1);
    expect(d.confirm).toHaveBeenCalledWith("saju-abc");
  });

  it("결제 상태 변경이 아닌 이벤트는 200 으로 흘려보낸다", async () => {
    const d = deps();
    const body = JSON.stringify({
      eventType: "DEPOSIT_CALLBACK",
      data: { orderId: "saju-abc" },
    });
    expect((await handleWebhook(body, d)).status).toBe(200);
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it("본문이 JSON 이 아니거나 모양이 다르면 400 과 invalid_body", async () => {
    for (const bad of ["not json", "{}", '{"eventType":"PAYMENT_STATUS_CHANGED"}']) {
      const r = await handleWebhook(bad, deps());
      expect(r).toEqual({ status: 400, body: { ok: false, reason: "invalid_body" } });
    }
  });

  it("불일치는 200 — 재시도해도 결과가 같고 reason 에 사유가 실린다", async () => {
    for (const kind of ["amount_mismatch", "currency_mismatch"] as const) {
      const d = deps({ confirm: vi.fn(async () => ({ ok: false as const, kind })) });
      const r = await handleWebhook(paidBody, d);
      expect(r).toEqual({ status: 200, body: { ok: false, reason: kind } });
    }
  });

  it("모르는 orderId 는 200 이고 not_found — 아무나 두드려도 여기서 조용히 끝난다", async () => {
    const d = deps({
      confirm: vi.fn(async () => ({ ok: false as const, kind: "not_found" as const })),
    });
    const r = await handleWebhook(paidBody, d);
    expect(r).toEqual({ status: 200, body: { ok: false, reason: "not_found" } });
  });

  it("not_paid 는 200 — 아직 결제 전일 뿐이고 다음 웹훅이 온다", async () => {
    const d = deps({
      confirm: vi.fn(async () => ({ ok: false as const, kind: "not_paid" as const })),
    });
    const r = await handleWebhook(paidBody, d);
    expect(r).toEqual({ status: 200, body: { ok: false, reason: "not_paid" } });
  });

  it("확정이 던지면 500 과 confirm_error — 토스의 재시도를 유도한다", async () => {
    const d = deps({
      confirm: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    const r = await handleWebhook(paidBody, d);
    expect(r).toEqual({ status: 500, body: { ok: false, reason: "confirm_error" } });
  });
});
