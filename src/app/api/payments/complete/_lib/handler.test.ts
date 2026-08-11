import { describe, it, expect, vi } from "vitest";
import { handleComplete, type CompleteDeps } from "./handler";
import type { PendingOrder } from "@/lib/payments/store";

const order: PendingOrder = {
  paymentId: "saju-abc",
  userId: "7",
  profileId: "3",
  amount: 9900,
  status: "pending",
};

function deps(over: Partial<CompleteDeps> = {}): CompleteDeps {
  return {
    userId: "7",
    findOrder: vi.fn(async () => order),
    confirm: vi.fn(async () => ({ ok: true as const, kind: "confirmed" as const, profileId: "3" })),
    ...over,
  };
}

const body = { paymentId: "saju-abc" };

describe("handleComplete", () => {
  it("확정되면 200 과 profileId — 클라이언트가 갈 곳을 응답에서 읽는다", async () => {
    expect(await handleComplete(body, deps())).toEqual({
      status: 200,
      body: { profileId: "3" },
    });
  });

  it("already 도 200 — 웹훅이 먼저 확정한 경우다", async () => {
    const d = deps({
      confirm: vi.fn(async () => ({ ok: true as const, kind: "already" as const, profileId: "3" })),
    });
    expect((await handleComplete(body, d)).status).toBe(200);
  });

  it("본문에 paymentId 가 없으면 400", async () => {
    for (const bad of [null, {}, { paymentId: 1 }, { paymentId: "" }]) {
      expect((await handleComplete(bad, deps())).status).toBe(400);
    }
  });

  it("비로그인은 401", async () => {
    expect((await handleComplete(body, deps({ userId: null }))).status).toBe(401);
  });

  it("남의 주문은 404 이고 확정을 시도조차 하지 않는다", async () => {
    const d = deps({ findOrder: vi.fn(async () => ({ ...order, userId: "99" })) });
    expect((await handleComplete(body, d)).status).toBe(404);
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it("없는 주문도 404 — 남의 주문과 구분하지 않는다", async () => {
    const d = deps({ findOrder: vi.fn(async () => null) });
    expect((await handleComplete(body, d)).status).toBe(404);
  });

  it("확정 실패는 402 와 kind 를 함께 돌려준다", async () => {
    for (const kind of ["not_paid", "amount_mismatch", "currency_mismatch"] as const) {
      const d = deps({ confirm: vi.fn(async () => ({ ok: false as const, kind })) });
      const r = await handleComplete(body, d);
      expect(r.status).toBe(402);
      expect(r.body).toMatchObject({ kind });
    }
  });

  it("확정 단계의 not_found 는 404 로 옮긴다", async () => {
    const d = deps({
      confirm: vi.fn(async () => ({ ok: false as const, kind: "not_found" as const })),
    });
    expect((await handleComplete(body, d)).status).toBe(404);
  });
});
