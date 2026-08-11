import { describe, it, expect, vi } from "vitest";
import { handleCreateOrder, type CreateOrderDeps } from "./handler";

function deps(over: Partial<CreateOrderDeps> = {}): CreateOrderDeps {
  return {
    userId: "7",
    getProfile: vi.fn(async () => ({ id: "3", isPaid: false })),
    getStoreId: () => "store-1",
    getChannel: () => ({ channelKey: "ch-card", payMethod: "CARD" as const }),
    getAppOrigin: () => "https://saju.example",
    newPaymentId: () => "saju-fixed",
    createPending: vi.fn(async () => {}),
    ...over,
  };
}

const body = { profileId: "3", method: "card" };

describe("handleCreateOrder", () => {
  it("성공하면 결제창에 넘길 값을 한 번에 돌려준다", async () => {
    const d = deps();
    const r = await handleCreateOrder(body, d);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      paymentId: "saju-fixed",
      storeId: "store-1",
      channelKey: "ch-card",
      payMethod: "CARD",
      orderName: "사주 전체 리포트",
      totalAmount: 9900,
      currency: "CURRENCY_KRW",
      redirectUrl: "https://saju.example/checkout/complete?profile=3",
    });
  });

  it("청구 금액은 요청이 아니라 서버 상수에서 온다", async () => {
    const d = deps();
    // 본문에 금액을 실어 보내도 무시된다 — 스키마에 그런 필드가 없다.
    await handleCreateOrder({ ...body, totalAmount: 100 }, d);
    expect(d.createPending).toHaveBeenCalledWith({
      userId: "7",
      profileId: "3",
      paymentId: "saju-fixed",
      amount: 9900,
    });
  });

  it("비로그인은 401 이고 행을 만들지 않는다", async () => {
    const d = deps({ userId: null });
    expect((await handleCreateOrder(body, d)).status).toBe(401);
    expect(d.createPending).not.toHaveBeenCalled();
  });

  it("없는/남의 프로필은 404", async () => {
    const d = deps({ getProfile: vi.fn(async () => null) });
    expect((await handleCreateOrder(body, d)).status).toBe(404);
    expect(d.createPending).not.toHaveBeenCalled();
  });

  it("이미 결제한 프로필은 409 — 이중 결제를 결제창 열기 전에 막는다", async () => {
    const d = deps({ getProfile: vi.fn(async () => ({ id: "3", isPaid: true })) });
    const r = await handleCreateOrder(body, d);
    expect(r.status).toBe(409);
    expect(d.createPending).not.toHaveBeenCalled();
  });

  it("본문이 스키마에 맞지 않으면 400", async () => {
    const d = deps();
    for (const bad of [null, {}, { profileId: "3" }, { profileId: "3", method: "toss" }]) {
      expect((await handleCreateOrder(bad, d)).status).toBe(400);
    }
  });

  it("profileId 가 순번 id 형태가 아니면 400 — ::bigint 캐스팅에 닿기 전에 막는다", async () => {
    const d = deps();
    for (const bad of ["0", "007", "abc", "-1", "9999999999999999999"]) {
      expect((await handleCreateOrder({ profileId: bad, method: "card" }, d)).status).toBe(400);
    }
  });

  it("채널키가 없으면 503 — 장애가 아니라 미설정이다", async () => {
    const d = deps({ getChannel: () => null });
    expect((await handleCreateOrder(body, d)).status).toBe(503);
    expect(d.createPending).not.toHaveBeenCalled();
  });

  it("상점 ID 나 APP_ORIGIN 이 없어도 503", async () => {
    const noStoreId = deps({ getStoreId: () => null });
    expect((await handleCreateOrder(body, noStoreId)).status).toBe(503);
    expect(noStoreId.createPending).not.toHaveBeenCalled();

    const noAppOrigin = deps({ getAppOrigin: () => null });
    expect((await handleCreateOrder(body, noAppOrigin)).status).toBe(503);
    expect(noAppOrigin.createPending).not.toHaveBeenCalled();
  });
});
