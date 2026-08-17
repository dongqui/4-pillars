import { describe, it, expect } from "vitest";
import type { SqlClient } from "@/lib/db";
import { confirmPurchaseAndCredit, getBalance } from "./wallet";

/** 호출된 SQL 과 바인딩 값을 기록하는 가짜 클라이언트. payments/store.test.ts 와 같은 모양. */
function fakeClient(...responses: Record<string, unknown>[][]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(responses[i++] ?? []);
  };
  return { client, calls };
}

describe("getBalance", () => {
  it("행이 있으면 그 값", async () => {
    const { client, calls } = fakeClient([{ balance: 6 }]);
    expect(await getBalance("7", client)).toBe(6);
    expect(calls[0].values).toEqual(["7"]);
  });

  it("행이 없으면 0 — 회원가입 때 지갑을 만들지 않는다", async () => {
    const { client } = fakeClient([]);
    expect(await getBalance("7", client)).toBe(0);
  });
});

describe("confirmPurchaseAndCredit", () => {
  it("확정과 적립이 한 문장이다 — 나뉘면 돈은 받고 이용권이 없는 행이 남는다", async () => {
    const { client, calls } = fakeClient([{ balance: 6 }]);
    await confirmPurchaseAndCredit({ paymentId: "saju-abc", transactionId: "tx-1" }, client);

    expect(calls).toHaveLength(1);
    const { sql } = calls[0];
    expect(sql).toContain("UPDATE purchases");
    expect(sql).toContain("INSERT INTO ticket_wallets");
    expect(sql).toContain("INSERT INTO ticket_entries");
  });

  it("status='pending' 조건이 이중 적립을 막는다", async () => {
    const { client, calls } = fakeClient([{ balance: 6 }]);
    await confirmPurchaseAndCredit({ paymentId: "saju-abc", transactionId: "tx-1" }, client);
    expect(calls[0].sql).toContain("status = 'pending'");
  });

  it("적립 장수는 purchases.tickets 에서 온다 — 확정 시점에 가격표를 다시 읽지 않는다", async () => {
    const { client, calls } = fakeClient([{ balance: 6 }]);
    await confirmPurchaseAndCredit({ paymentId: "saju-abc", transactionId: "tx-1" }, client);
    // 바인딩 값은 거래 id 와 결제 id 둘뿐이다. 장수가 인자로 들어오면 브라우저발 값이 섞일 수 있다.
    expect(calls[0].values).toEqual(["tx-1", "saju-abc"]);
  });

  it("원장은 지갑과 같은 문장에서 쌓인다 — reason 은 purchase", async () => {
    const { client, calls } = fakeClient([{ balance: 6 }]);
    await confirmPurchaseAndCredit({ paymentId: "saju-abc", transactionId: null }, client);
    expect(calls[0].sql).toContain("'purchase'");
  });

  it("갱신된 행이 있으면 true", async () => {
    const { client } = fakeClient([{ balance: 6 }]);
    expect(
      await confirmPurchaseAndCredit({ paymentId: "saju-abc", transactionId: "tx-1" }, client),
    ).toBe(true);
  });

  it("갱신된 행이 없으면 false — 그 사이 다른 경로가 먼저 확정했다는 뜻", async () => {
    const { client } = fakeClient([]);
    expect(
      await confirmPurchaseAndCredit({ paymentId: "saju-abc", transactionId: null }, client),
    ).toBe(false);
  });
});
