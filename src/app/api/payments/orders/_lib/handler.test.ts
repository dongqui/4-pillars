import { describe, it, expect, vi } from "vitest";
import { handleCreateOrder, type CreateOrderDeps } from "./handler";

function deps(over: Partial<CreateOrderDeps> = {}): CreateOrderDeps {
  return {
    userId: "7",
    getStoreId: () => "store-1",
    getChannel: () => ({ channelKey: "ch-1", payMethod: "CARD" }),
    getAppOrigin: () => "https://saju.example",
    newPaymentId: () => "saju-abc",
    createPending: vi.fn(async () => {}),
    ...over,
  };
}

const body = { packageId: "t5", method: "card" };

describe("handleCreateOrder", () => {
  it("금액과 장수를 서버 가격표에서 박는다 — 요청에는 그 필드가 아예 없다", async () => {
    const createPending = vi.fn(async () => {});
    const r = await handleCreateOrder(body, deps({ createPending }));

    expect(r.status).toBe(200);
    expect(createPending).toHaveBeenCalledWith({
      userId: "7",
      paymentId: "saju-abc",
      product: "t5",
      amount: 5000,
      tickets: 6,
    });
  });

  it("응답 금액은 pending 행에 박은 금액과 같다 — 갈라지면 확정에서 금액 불일치가 난다", async () => {
    const r = await handleCreateOrder(body, deps());
    expect(r.body).toMatchObject({
      paymentId: "saju-abc",
      storeId: "store-1",
      channelKey: "ch-1",
      payMethod: "CARD",
      orderName: "이용권 6장",
      totalAmount: 5000,
      currency: "CURRENCY_KRW",
    });
  });

  it("로그인하지 않았으면 401", async () => {
    const r = await handleCreateOrder(body, deps({ userId: null }));
    expect(r.status).toBe(401);
  });

  it("요청 모양이 어긋나면 400", async () => {
    const d = deps();
    for (const bad of [
      null,
      {},
      { packageId: "t5" },
      { packageId: "t99", method: "card" },
      { packageId: "t5", method: "paypal" },
    ]) {
      expect((await handleCreateOrder(bad, d)).status).toBe(400);
    }
  });

  it("검증에 걸리면 pending 행을 만들지 않는다", async () => {
    const createPending = vi.fn(async () => {});
    await handleCreateOrder({ packageId: "t99", method: "card" }, deps({ createPending }));
    await handleCreateOrder(body, deps({ createPending, userId: null }));
    expect(createPending).not.toHaveBeenCalled();
  });

  it("결제 설정이 없으면 503 — 장애가 아니라 미설정이다, pending 행도 만들지 않는다", async () => {
    for (const over of [
      { getStoreId: () => null },
      { getChannel: () => null },
      { getAppOrigin: () => null },
    ] as Partial<CreateOrderDeps>[]) {
      const createPending = vi.fn(async () => {});
      const r = await handleCreateOrder(body, deps({ ...over, createPending }));
      expect(r.status).toBe(503);
      expect(createPending).not.toHaveBeenCalled();
    }
  });

  it("복귀 경로를 redirectUrl 에 싣는다", async () => {
    const r = await handleCreateOrder({ ...body, next: "/report?profile=3" }, deps());
    expect(r.body).toMatchObject({
      redirectUrl: `https://saju.example/checkout/complete?next=${encodeURIComponent("/report?profile=3")}`,
    });
  });

  it("외부 URL 을 next 로 보내면 홈으로 접는다 — 오픈 리다이렉트를 막는다", async () => {
    const r = await handleCreateOrder({ ...body, next: "https://evil.example" }, deps());
    expect(r.body).toMatchObject({
      redirectUrl: `https://saju.example/checkout/complete?next=${encodeURIComponent("/home")}`,
    });
  });

  it("간편결제는 채널이 준 판별자를 그대로 싣는다 — 쪼개면 어긋난 조합이 나간다", async () => {
    const r = await handleCreateOrder(
      { packageId: "t10", method: "toss" },
      deps({
        getChannel: () => ({
          channelKey: "ch-1",
          payMethod: "EASY_PAY",
          easyPayProvider: "TOSSPAY",
        }),
      }),
    );
    expect(r.body).toMatchObject({
      payMethod: "EASY_PAY",
      easyPayProvider: "TOSSPAY",
      orderName: "이용권 13장",
      totalAmount: 10000,
    });
  });
});
