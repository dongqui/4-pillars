import { describe, it, expect } from "vitest";
import { PortOneError, PortOneNotConfiguredError, getPayment } from "./portone";

const env = { PORTONE_API_SECRET: "secret-1" } as unknown as NodeJS.ProcessEnv;

const paid = {
  id: "saju-abc",
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
    await getPayment("saju-abc", { fetchImpl, env });
    expect(calls[0].headers.Authorization).toBe("PortOne secret-1");
  });

  it("paymentId 를 URL 인코딩해 경로에 넣는다", async () => {
    const { fetchImpl, calls } = fakeFetch(paid);
    await getPayment("saju/abc", { fetchImpl, env });
    expect(calls[0].url).toBe("https://api.portone.io/payments/saju%2Fabc");
  });

  it("응답을 스키마로 좁혀 돌려준다", async () => {
    const { fetchImpl } = fakeFetch({ ...paid, 모르는필드: 1 });
    const p = await getPayment("saju-abc", { fetchImpl, env });
    expect(p.status).toBe("PAID");
    expect(p.amount.total).toBe(9900);
    expect(p.transactionId).toBe("tx-1");
  });

  it("모르는 status 는 던진다 — 모르는 상태를 결제 완료로 오해하는 것보다 실패가 낫다", async () => {
    const { fetchImpl } = fakeFetch({ ...paid, status: "NEW_STATUS" });
    await expect(getPayment("saju-abc", { fetchImpl, env })).rejects.toThrow();
  });

  it("비 2xx 는 포트원 에러 본문을 읽어 PortOneError 로 던진다", async () => {
    const { fetchImpl } = fakeFetch(
      { type: "PaymentNotFoundError", message: "결제 건이 없습니다" },
      { ok: false, status: 404 },
    );
    await expect(getPayment("saju-none", { fetchImpl, env })).rejects.toThrow(PortOneError);
  });

  it("시크릿이 없으면 네트워크를 타기 전에 던진다", async () => {
    const { fetchImpl, calls } = fakeFetch(paid);
    await expect(
      getPayment("saju-abc", { fetchImpl, env: {} as unknown as NodeJS.ProcessEnv }),
    ).rejects.toThrow(PortOneNotConfiguredError);
    expect(calls).toHaveLength(0);
  });
});
