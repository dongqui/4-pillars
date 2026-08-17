import { describe, it, expect, vi } from "vitest";
import { handleWebhook, type WebhookDeps } from "./handler";

const paidBody = JSON.stringify({
  type: "Transaction.Paid",
  timestamp: "2026-08-11T00:00:00.000Z",
  data: { storeId: "store-1", paymentId: "saju-abc", transactionId: "tx-1" },
});

function deps(over: Partial<WebhookDeps> = {}): WebhookDeps {
  return {
    verify: vi.fn(async () => {}),
    confirm: vi.fn(async () => ({ ok: true as const, kind: "confirmed" as const })),
    ...over,
  };
}

const headers = { "webhook-id": "msg-1" };

describe("handleWebhook", () => {
  it("Transaction.Paid 를 확정으로 넘기고 200", async () => {
    const d = deps();
    expect((await handleWebhook(paidBody, headers, d)).status).toBe(200);
    expect(d.confirm).toHaveBeenCalledWith("saju-abc");
  });

  it("서명 검증이 던지면 400 이고 확정하지 않는다 — 위조된 결제 완료를 막는 유일한 문", async () => {
    const d = deps({
      verify: vi.fn(async () => {
        throw new Error("bad signature");
      }),
    });
    const r = await handleWebhook(paidBody, headers, d);
    expect(r).toEqual({ status: 400, body: { ok: false, reason: "invalid_signature" } });
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it("검증은 파싱 전에 한다 — 원문에 서명이 걸려 있다", async () => {
    const order: string[] = [];
    const d = deps({
      verify: vi.fn(async () => {
        order.push("verify");
      }),
      confirm: vi.fn(async () => {
        order.push("confirm");
        return { ok: true as const, kind: "confirmed" as const };
      }),
    });
    await handleWebhook(paidBody, headers, d);
    expect(order).toEqual(["verify", "confirm"]);
  });

  it("서명이 틀리면 본문이 깨져 있어도 invalid_signature 다 — 검증이 파싱보다 먼저라는 증거", async () => {
    // confirm 순서 테스트는 confirm 이 파싱 뒤에 오므로 JSON.parse 를 verify 앞으로
    // 옮겨도 통과해 버린다. 이 테스트는 파싱 자체가 verify 실패를 가리지 못하게 막는다 —
    // 본문을 깨뜨려서, 파싱이 먼저 일어났다면 reason 이 invalid_body 로 바뀌게 만든다.
    const d = deps({
      verify: vi.fn(async () => {
        throw new Error("bad signature");
      }),
    });
    const r = await handleWebhook("not json", headers, d);
    expect(r).toEqual({ status: 400, body: { ok: false, reason: "invalid_signature" } });
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it("Paid 가 아닌 이벤트는 200 으로 흘려보낸다", async () => {
    const d = deps();
    const body = JSON.stringify({
      type: "Transaction.Ready",
      data: { paymentId: "saju-abc" },
    });
    expect((await handleWebhook(body, headers, d)).status).toBe(200);
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it("본문이 JSON 이 아니거나 모양이 다르면 400 과 invalid_body", async () => {
    for (const bad of ["not json", "{}", '{"type":"Transaction.Paid"}']) {
      const r = await handleWebhook(bad, headers, deps());
      expect(r).toEqual({ status: 400, body: { ok: false, reason: "invalid_body" } });
    }
  });

  it("not_found / 불일치는 200 — 재시도해도 결과가 같고 reason 에 사유가 실린다", async () => {
    for (const kind of ["not_found", "amount_mismatch", "currency_mismatch"] as const) {
      const d = deps({ confirm: vi.fn(async () => ({ ok: false as const, kind })) });
      const r = await handleWebhook(paidBody, headers, d);
      expect(r).toEqual({ status: 200, body: { ok: false, reason: kind } });
    }
  });

  it("not_paid 는 200 — 아직 결제 전일 뿐이고 다음 웹훅이 온다", async () => {
    const d = deps({
      confirm: vi.fn(async () => ({ ok: false as const, kind: "not_paid" as const })),
    });
    const r = await handleWebhook(paidBody, headers, d);
    expect(r).toEqual({ status: 200, body: { ok: false, reason: "not_paid" } });
  });

  it("확정이 던지면 500 과 confirm_error — 포트원의 재시도를 유도한다", async () => {
    const d = deps({
      confirm: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    const r = await handleWebhook(paidBody, headers, d);
    expect(r).toEqual({ status: 500, body: { ok: false, reason: "confirm_error" } });
  });
});
