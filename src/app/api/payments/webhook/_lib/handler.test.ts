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
    confirm: vi.fn(async () => ({ ok: true as const, kind: "confirmed" as const, profileId: "3" })),
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
    expect((await handleWebhook(paidBody, headers, d)).status).toBe(400);
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
        return { ok: true as const, kind: "confirmed" as const, profileId: "3" };
      }),
    });
    await handleWebhook(paidBody, headers, d);
    expect(order).toEqual(["verify", "confirm"]);
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

  it("본문이 JSON 이 아니거나 모양이 다르면 400", async () => {
    for (const bad of ["not json", "{}", '{"type":"Transaction.Paid"}']) {
      expect((await handleWebhook(bad, headers, deps())).status).toBe(400);
    }
  });

  it("not_found / 불일치는 200 — 재시도해도 결과가 같다", async () => {
    for (const kind of ["not_found", "amount_mismatch", "currency_mismatch"] as const) {
      const d = deps({ confirm: vi.fn(async () => ({ ok: false as const, kind })) });
      expect((await handleWebhook(paidBody, headers, d)).status).toBe(200);
    }
  });

  it("not_paid 는 200 — 아직 결제 전일 뿐이고 다음 웹훅이 온다", async () => {
    const d = deps({
      confirm: vi.fn(async () => ({ ok: false as const, kind: "not_paid" as const })),
    });
    expect((await handleWebhook(paidBody, headers, d)).status).toBe(200);
  });

  it("확정이 던지면 500 — 포트원의 재시도를 유도한다", async () => {
    const d = deps({
      confirm: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    expect((await handleWebhook(paidBody, headers, d)).status).toBe(500);
  });
});
