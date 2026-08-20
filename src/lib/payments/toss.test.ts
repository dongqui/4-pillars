import { describe, it, expect } from "vitest";
import {
  TossError,
  TossNotConfiguredError,
  approvePayment,
  getPaymentByOrderId,
} from "./toss";

const env = { TOSS_SECRET_KEY: "sk-1" } as unknown as NodeJS.ProcessEnv;

const done = {
  paymentKey: "pk-1",
  orderId: "saju-abc",
  status: "DONE",
  totalAmount: 9900,
  currency: "KRW",
  lastTransactionKey: "tx-1",
};

/** 한 번 호출되고 준비된 응답을 돌려주는 가짜 fetch. 요청 인자를 기록한다. */
function fakeFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const calls: {
    url: string;
    method: string | undefined;
    headers: Record<string, string>;
    body: string | undefined;
  }[] = [];
  const fetchImpl = (async (url: string | URL | Request, opts?: RequestInit) => {
    calls.push({
      url: String(url),
      method: opts?.method,
      headers: (opts?.headers ?? {}) as Record<string, string>,
      body: opts?.body as string | undefined,
    });
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
    } as Response;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const approval = { paymentKey: "pk-1", orderId: "saju-abc", amount: 9900 };

describe("approvePayment", () => {
  it("Authorization 은 Basic base64(시크릿:) 다 — 콜론을 빠뜨리면 401 이 난다", async () => {
    const { fetchImpl, calls } = fakeFetch(done);
    await approvePayment(approval, { fetchImpl, env });
    expect(calls[0].headers.Authorization).toBe(`Basic ${Buffer.from("sk-1:").toString("base64")}`);
  });

  it("승인 엔드포인트에 paymentKey·orderId·amount 를 실어 POST 한다", async () => {
    const { fetchImpl, calls } = fakeFetch(done);
    await approvePayment(approval, { fetchImpl, env });
    expect(calls[0].url).toBe("https://api.tosspayments.com/v1/payments/confirm");
    expect(calls[0].method).toBe("POST");
    expect(JSON.parse(calls[0].body!)).toEqual(approval);
  });

  it("응답을 스키마로 좁혀 돌려준다", async () => {
    const { fetchImpl } = fakeFetch({ ...done, 모르는필드: 1 });
    const p = await approvePayment(approval, { fetchImpl, env });
    expect(p.status).toBe("DONE");
    expect(p.totalAmount).toBe(9900);
    expect(p.lastTransactionKey).toBe("tx-1");
  });

  it("모르는 status 는 던진다 — 모르는 상태를 결제 완료로 오해하는 것보다 실패가 낫다", async () => {
    const { fetchImpl } = fakeFetch({ ...done, status: "NEW_STATUS" });
    await expect(approvePayment(approval, { fetchImpl, env })).rejects.toThrow();
  });

  it("비 2xx 는 토스 에러 본문을 읽어 TossError 로 던진다", async () => {
    const { fetchImpl } = fakeFetch(
      { code: "ALREADY_PROCESSED_PAYMENT", message: "이미 처리된 결제 입니다." },
      { ok: false, status: 400 },
    );
    await expect(approvePayment(approval, { fetchImpl, env })).rejects.toThrow(TossError);
  });

  it("시크릿이 없으면 네트워크를 타기 전에 던진다 — 승인은 돈이 잡히는 호출이다", async () => {
    const { fetchImpl, calls } = fakeFetch(done);
    await expect(
      approvePayment(approval, { fetchImpl, env: {} as unknown as NodeJS.ProcessEnv }),
    ).rejects.toThrow(TossNotConfiguredError);
    expect(calls).toHaveLength(0);
  });
});

describe("getPaymentByOrderId", () => {
  it("orderId 를 URL 인코딩해 경로에 넣고 GET 한다", async () => {
    const { fetchImpl, calls } = fakeFetch(done);
    await getPaymentByOrderId("saju/abc", { fetchImpl, env });
    expect(calls[0].url).toBe("https://api.tosspayments.com/v1/payments/orders/saju%2Fabc");
    expect(calls[0].method).toBe("GET");
  });

  it("조회에는 본문이 없다 — 상태를 바꾸지 않는 호출이다", async () => {
    const { fetchImpl, calls } = fakeFetch(done);
    await getPaymentByOrderId("saju-abc", { fetchImpl, env });
    expect(calls[0].body).toBeUndefined();
  });

  it("없는 주문은 TossError", async () => {
    const { fetchImpl } = fakeFetch(
      { code: "NOT_FOUND_PAYMENT", message: "존재하지 않는 결제 입니다." },
      { ok: false, status: 404 },
    );
    await expect(getPaymentByOrderId("saju-none", { fetchImpl, env })).rejects.toThrow(TossError);
  });
});
