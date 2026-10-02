import { describe, it, expect } from "vitest";
import { PortOneError, PortOneNotConfiguredError, getPayment, cancelPayment } from "./portone";

const env = { PORTONE_API_SECRET: "secret-1" } as unknown as NodeJS.ProcessEnv;

const paid = {
  id: "sajuabc",
  status: "PAID",
  amount: { total: 9900, paid: 9900 },
  currency: "KRW",
  transactionId: "tx-1",
};

/** 한 번 호출되고 준비된 응답을 돌려주는 가짜 fetch. 요청 인자를 기록한다. */
function fakeFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetchImpl = (async (url: string | URL | Request, opts?: RequestInit) => {
    calls.push({
      url: String(url),
      headers: (opts?.headers ?? {}) as Record<string, string>,
    });
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
    } as Response;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe("getPayment", () => {
  it("Authorization 헤더는 `PortOne <secret>` 형태다 — Bearer 가 아니다", async () => {
    const { fetchImpl, calls } = fakeFetch(paid);
    await getPayment("sajuabc", { fetchImpl, env });
    expect(calls[0].headers.Authorization).toBe("PortOne secret-1");
  });

  it("paymentId 를 URL 인코딩해 경로에 넣는다", async () => {
    const { fetchImpl, calls } = fakeFetch(paid);
    await getPayment("saju/abc", { fetchImpl, env });
    expect(calls[0].url).toBe("https://api.portone.io/payments/saju%2Fabc");
  });

  it("응답을 스키마로 좁혀 돌려준다", async () => {
    const { fetchImpl } = fakeFetch({ ...paid, 모르는필드: 1 });
    const p = await getPayment("sajuabc", { fetchImpl, env });
    expect(p.status).toBe("PAID");
    expect(p.amount.total).toBe(9900);
    expect(p.transactionId).toBe("tx-1");
  });

  it("모르는 status 는 던진다 — 모르는 상태를 결제 완료로 오해하는 것보다 실패가 낫다", async () => {
    const { fetchImpl } = fakeFetch({ ...paid, status: "NEW_STATUS" });
    await expect(getPayment("sajuabc", { fetchImpl, env })).rejects.toThrow();
  });

  it("비 2xx 는 포트원 에러 본문을 읽어 PortOneError 로 던진다", async () => {
    const { fetchImpl } = fakeFetch(
      { type: "PaymentNotFoundError", message: "결제 건이 없습니다" },
      { ok: false, status: 404 },
    );
    await expect(getPayment("sajunone", { fetchImpl, env })).rejects.toThrow(PortOneError);
  });

  it("시크릿이 없으면 네트워크를 타기 전에 던진다", async () => {
    const { fetchImpl, calls } = fakeFetch(paid);
    await expect(
      getPayment("sajuabc", { fetchImpl, env: {} as unknown as NodeJS.ProcessEnv }),
    ).rejects.toThrow(PortOneNotConfiguredError);
    expect(calls).toHaveLength(0);
  });

  it("PAY_PENDING 은 파싱된다 — SDK 이름 그대로다", async () => {
    const { fetchImpl } = fakeFetch({ ...paid, status: "PAY_PENDING" });
    const p = await getPayment("sajuabc", { fetchImpl, env });
    expect(p.status).toBe("PAY_PENDING");
  });

  it("PARTIAL_CANCELLED 는 파싱된다 — SDK 이름 그대로다", async () => {
    const { fetchImpl } = fakeFetch({ ...paid, status: "PARTIAL_CANCELLED" });
    const p = await getPayment("sajuabc", { fetchImpl, env });
    expect(p.status).toBe("PARTIAL_CANCELLED");
  });

  it("에러 응답 본문이 JSON 이 아니면 fallback 메시지로 던진다", async () => {
    const fetchImpl = (async () => {
      return {
        ok: false,
        status: 502,
        json: async () => {
          throw new Error("not json");
        },
      } as unknown as Response;
    }) as typeof fetch;
    await expect(getPayment("sajuabc", { fetchImpl, env })).rejects.toThrow(
      "포트원 결제 조회 실패 (HTTP 502)",
    );
  });

  it("PortOneError.type 은 에러 본문의 type 이다", async () => {
    const { fetchImpl } = fakeFetch(
      { type: "PaymentNotFoundError", message: "결제 건이 없습니다" },
      { ok: false, status: 404 },
    );
    try {
      await getPayment("sajunone", { fetchImpl, env });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PortOneError);
      expect((e as PortOneError).type).toBe("PaymentNotFoundError");
    }
  });
});

/** cancelPayment 용 — 요청 본문까지 기록한다. */
function fakePost(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const calls: {
    url: string;
    method: string | undefined;
    headers: Record<string, string>;
    body: unknown;
    signal: AbortSignal | null | undefined;
  }[] = [];
  const fetchImpl = (async (url: string | URL | Request, opts?: RequestInit) => {
    calls.push({
      url: String(url),
      method: opts?.method,
      headers: (opts?.headers ?? {}) as Record<string, string>,
      body: typeof opts?.body === "string" ? JSON.parse(opts.body) : null,
      signal: opts?.signal,
    });
    return { ok: init.ok ?? true, status: init.status ?? 200, json: async () => body } as Response;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe("cancelPayment", () => {
  it("POST /payments/{id}/cancel 에 PortOne 인증과 JSON 본문", async () => {
    const { fetchImpl, calls } = fakePost({ cancellation: { status: "SUCCEEDED" } });
    await cancelPayment("saju/abc", { reason: "실수로 결제했어요", amount: 3000 }, { fetchImpl, env });
    expect(calls[0].url).toBe("https://api.portone.io/payments/saju%2Fabc/cancel");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers.Authorization).toBe("PortOne secret-1");
    expect(calls[0].headers["Content-Type"]).toBe("application/json");
    expect(calls[0].body).toEqual({ reason: "실수로 결제했어요", amount: 3000 });
  });

  // 전액이면 amount 를 보내지 않는다 — 포트원은 amount 없는 요청을 전액 취소로 본다.
  it("amount 가 없으면 본문에도 없다 — 전액 취소", async () => {
    const { fetchImpl, calls } = fakePost({ cancellation: { status: "SUCCEEDED" } });
    await cancelPayment("p", { reason: "기타" }, { fetchImpl, env });
    expect(calls[0].body).toEqual({ reason: "기타" });
  });

  // 타임아웃이 없으면 응답이 안 오는 동안 DB 는 refunded 인데 실패 기록도 메일도 없는 무음 경로가 된다.
  it("취소 fetch 에 AbortSignal 을 싣는다 — 응답이 안 오면 끊긴다", async () => {
    const { fetchImpl, calls } = fakePost({ cancellation: { status: "SUCCEEDED" } });
    await cancelPayment("p", { reason: "기타" }, { fetchImpl, env });
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
  });

  it("이미 취소된 결제는 성공으로 본다 — 재시도 안전", async () => {
    const { fetchImpl } = fakePost({ type: "PAYMENT_ALREADY_CANCELLED", message: "already" }, { ok: false, status: 409 });
    await expect(cancelPayment("p", { reason: "기타" }, { fetchImpl, env })).resolves.toBeUndefined();
  });

  it("그 외 실패는 PortOneError 에 type 을 싣는다", async () => {
    const { fetchImpl } = fakePost({ type: "PAYMENT_NOT_FOUND", message: "없음" }, { ok: false, status: 404 });
    await expect(cancelPayment("p", { reason: "기타" }, { fetchImpl, env })).rejects.toMatchObject({
      name: "PortOneError", type: "PAYMENT_NOT_FOUND",
    });
  });

  it("시크릿이 없으면 PortOneNotConfiguredError — fetch 를 부르지 않는다", async () => {
    const { fetchImpl, calls } = fakePost({});
    await expect(
      cancelPayment("p", { reason: "기타" }, { fetchImpl, env: {} as NodeJS.ProcessEnv }),
    ).rejects.toBeInstanceOf(PortOneNotConfiguredError);
    expect(calls).toHaveLength(0);
  });
});
