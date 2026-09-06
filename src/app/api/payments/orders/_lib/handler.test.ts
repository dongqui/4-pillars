import { describe, it, expect, vi } from "vitest";
import { handleCreateOrder, type CreateOrderDeps } from "./handler";

function deps(over: Partial<CreateOrderDeps> = {}): CreateOrderDeps {
  return {
    userId: "7",
    getStoreId: () => "store-1",
    getChannel: () => ({ channelKey: "ch-kcp", payMethod: "CARD" }),
    getAppOrigin: () => "https://saju.example",
    newPaymentId: () => "sajuabc",
    getBuyer: async () => ({ displayName: "김동진", email: "buyer@example.com" }),
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
      paymentId: "sajuabc",
      product: "t5",
      amount: 5000,
      tickets: 6,
    });
  });

  it("응답 금액은 pending 행에 박은 금액과 같다 — 갈라지면 확정에서 금액 불일치가 난다", async () => {
    const r = await handleCreateOrder(body, deps());
    expect(r.body).toMatchObject({
      storeId: "store-1",
      channelKey: "ch-kcp",
      paymentId: "sajuabc",
      payMethod: "CARD",
      orderName: "이용권 6장",
      totalAmount: 5000,
      currency: "CURRENCY_KRW",
    });
  });

  it("paymentId 는 pending 행의 paymentId 와 같은 값이다 — 확정 때 이 값으로 대조한다", async () => {
    let pending: { paymentId: string } | null = null;
    const r = await handleCreateOrder(
      body,
      deps({
        createPending: async (i) => {
          pending = i;
        },
      }),
    );
    expect((r.body as { paymentId: string }).paymentId).toBe(pending!.paymentId);
  });

  it("구매자는 이름과 이메일만 싣는다 — 휴대폰은 받은 적이 없어 보내지 않는다", async () => {
    const r = await handleCreateOrder(body, deps());
    expect(r.body).toMatchObject({
      customer: { fullName: "김동진", email: "buyer@example.com" },
    });
    expect((r.body as { customer: object }).customer).not.toHaveProperty("phoneNumber");
  });

  it("표시 이름이 없어도 빈 이름을 내보내지 않는다 — 소셜 제공자가 이름을 안 줄 수 있다", async () => {
    for (const displayName of [null, "", "   "]) {
      const r = await handleCreateOrder(
        body,
        deps({ getBuyer: async () => ({ displayName, email: "buyer@example.com" }) }),
      );
      expect(r.body).toMatchObject({ customer: { fullName: "회원" } });
    }
  });

  it("이메일이 없으면 409 — 이름과 달리 대체값을 지어내지 않는다, pending 행도 만들지 않는다", async () => {
    for (const buyer of [
      null,
      { displayName: "김동진", email: null },
      { displayName: "김동진", email: "  " },
    ]) {
      const createPending = vi.fn(async () => {});
      const r = await handleCreateOrder(body, deps({ getBuyer: async () => buyer, createPending }));
      expect(r.status).toBe(409);
      expect(r.body).toEqual({ error: "이메일 정보가 없습니다. 다시 로그인해 주세요" });
      expect(createPending).not.toHaveBeenCalled();
    }
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

  it("모바일 착지 주소는 쿼리 없이 나간다 — 포트원이 paymentId/code 를 붙이고, 복귀 경로는 쿠키다", async () => {
    const r = await handleCreateOrder(body, deps());
    expect(r.body).toMatchObject({ redirectUrl: "https://saju.example/checkout/complete" });
  });

  it("복귀 경로는 착지 주소가 아니라 next 로 따로 나간다 — 라우트가 쿠키로 심는다", async () => {
    const r = await handleCreateOrder({ ...body, next: "/report?profile=3" }, deps());
    expect(r.next).toBe("/report?profile=3");
    expect(JSON.stringify(r.body)).not.toContain("profile=3");
  });

  it("외부 URL 을 next 로 보내면 홈으로 접는다 — 오픈 리다이렉트를 막는다", async () => {
    const r = await handleCreateOrder({ ...body, next: "https://evil.example" }, deps());
    expect(r.next).toBe("/home");
  });

  it("간편결제는 채널이 준 조합을 그대로 싣는다 — 쪼개면 어긋난 조합이 나간다", async () => {
    const r = await handleCreateOrder(
      { packageId: "t10", method: "toss" },
      deps({
        getChannel: () => ({
          channelKey: "ch-kcp",
          payMethod: "EASY_PAY",
          easyPayProvider: "TOSSPAY",
        }),
      }),
    );
    expect(r.body).toMatchObject({
      channelKey: "ch-kcp",
      payMethod: "EASY_PAY",
      easyPayProvider: "TOSSPAY",
      orderName: "이용권 13장",
      totalAmount: 10000,
    });
  });
});
