import { describe, it, expect, vi } from "vitest";
import { handleComplete, type CompleteDeps } from "./handler";

const order = {
  paymentId: "saju-abc",
  userId: "7",
  amount: 5000,
  status: "pending" as const,
};

function deps(over: Partial<CompleteDeps> = {}): CompleteDeps {
  return {
    userId: "7",
    findOrder: vi.fn(async () => order),
    confirm: vi.fn(async () => ({ ok: true as const, kind: "confirmed" as const })),
    getBalance: vi.fn(async () => 6),
    ...over,
  };
}

const body = { paymentId: "saju-abc" };

describe("handleComplete", () => {
  it("확정되면 200 과 잔액 — 화면이 충전 결과를 응답에서 읽는다", async () => {
    expect(await handleComplete(body, deps())).toEqual({
      status: 200,
      body: { balance: 6 },
    });
  });

  it("이미 확정된 주문도 200 — 웹훅이 먼저 도착한 정상 경로다", async () => {
    const r = await handleComplete(
      body,
      deps({ confirm: vi.fn(async () => ({ ok: true as const, kind: "already" as const })) }),
    );
    expect(r).toEqual({ status: 200, body: { balance: 6 } });
  });

  it("로그인하지 않았으면 401", async () => {
    expect((await handleComplete(body, deps({ userId: null }))).status).toBe(401);
  });

  it("요청 모양이 어긋나면 400", async () => {
    const d = deps();
    for (const bad of [null, {}, { paymentId: "" }]) {
      expect((await handleComplete(bad, d)).status).toBe(400);
    }
  });

  it("없는 주문과 남의 주문을 구분하지 않는다 — 구분하면 paymentId 로 훑을 수 있다", async () => {
    const missing = await handleComplete(body, deps({ findOrder: vi.fn(async () => null) }));
    const others = await handleComplete(
      body,
      deps({ findOrder: vi.fn(async () => ({ ...order, userId: "9" })) }),
    );
    expect(missing.status).toBe(404);
    expect(others).toEqual(missing);
  });

  it("남의 주문이면 확정을 시도하지도 않는다", async () => {
    const confirm = vi.fn(async () => ({ ok: true as const, kind: "confirmed" as const }));
    await handleComplete(body, deps({ confirm, findOrder: vi.fn(async () => ({ ...order, userId: "9" })) }));
    expect(confirm).not.toHaveBeenCalled();
  });

  it("확정 실패는 종류마다 상태코드가 다르다", async () => {
    const cases = [
      ["not_found", 404],
      ["not_paid", 402],
      ["amount_mismatch", 402],
      ["currency_mismatch", 402],
    ] as const;
    for (const [kind, status] of cases) {
      const r = await handleComplete(
        body,
        deps({ confirm: vi.fn(async () => ({ ok: false as const, kind })) }),
      );
      expect(r.status).toBe(status);
      expect(r.body).toMatchObject({ kind });
    }
  });
});
