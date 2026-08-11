import { describe, it, expect } from "vitest";
import type { SqlClient } from "@/lib/db";
import {
  createPendingPurchase,
  findOrderByPaymentId,
  markPurchaseFailed,
  markPurchasePaid,
  toPendingOrder,
} from "./store";

/** 호출된 SQL 과 바인딩 값을 기록하는 가짜 클라이언트. 응답은 순서대로 꺼내 쓴다. */
function fakeClient(...responses: Record<string, unknown>[][]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(responses[i++] ?? []);
  };
  return { client, calls };
}

const dbRow = {
  payment_id: "saju-abc",
  user_id: 7,
  profile_id: 3,
  amount: 9900,
  status: "pending",
};

describe("toPendingOrder", () => {
  it("bigint 컬럼을 문자열로 접는다 — JS number 는 bigint 를 담지 못한다", () => {
    expect(toPendingOrder(dbRow)).toEqual({
      paymentId: "saju-abc",
      userId: "7",
      profileId: "3",
      amount: 9900,
      status: "pending",
    });
  });

  it("모르는 status 는 failed 로 접는다 — 모르는 값을 pending 으로 두면 재확정 대상이 된다", () => {
    expect(toPendingOrder({ ...dbRow, status: "weird" }).status).toBe("failed");
  });
});

describe("createPendingPurchase", () => {
  it("product 는 상수를, status 는 pending 을, provider 는 portone 을 박는다", async () => {
    const { client, calls } = fakeClient([]);
    await createPendingPurchase(
      { userId: "7", profileId: "3", paymentId: "saju-abc", amount: 9900 },
      client,
    );
    expect(calls[0].sql).toContain("INSERT INTO purchases");
    expect(calls[0].values).toEqual(["7", "3", "full_report", 9900, "saju-abc"]);
    expect(calls[0].sql).toContain("'pending'");
    expect(calls[0].sql).toContain("'portone'");
  });
});

describe("findOrderByPaymentId", () => {
  it("행이 없으면 null", async () => {
    const { client } = fakeClient([]);
    expect(await findOrderByPaymentId("saju-none", client)).toBeNull();
  });

  it("payment_id 로 찾는다", async () => {
    const { client, calls } = fakeClient([dbRow]);
    const order = await findOrderByPaymentId("saju-abc", client);
    expect(order?.profileId).toBe("3");
    expect(calls[0].values).toEqual(["saju-abc"]);
  });
});

describe("markPurchasePaid", () => {
  it("갱신된 행이 있으면 true", async () => {
    const { client, calls } = fakeClient([{ id: 1 }]);
    expect(await markPurchasePaid({ paymentId: "saju-abc", transactionId: "tx-1" }, client)).toBe(
      true,
    );
    // status='pending' 조건이 빠지면 이미 확정된 행을 다시 뒤집어 멱등성이 깨진다.
    expect(calls[0].sql).toContain("status = 'pending'");
    expect(calls[0].values).toEqual(["tx-1", "saju-abc"]);
  });

  it("갱신된 행이 없으면 false — 그 사이 다른 경로가 먼저 확정했다는 뜻", async () => {
    const { client } = fakeClient([]);
    expect(await markPurchasePaid({ paymentId: "saju-abc", transactionId: null }, client)).toBe(
      false,
    );
  });
});

describe("markPurchaseFailed", () => {
  it("pending 인 행만 내린다 — 이미 확정된 결제를 실패로 뒤집지 않는다", async () => {
    const { client, calls } = fakeClient([]);
    await markPurchaseFailed("saju-abc", client);
    expect(calls[0].sql).toContain("status = 'failed'");
    expect(calls[0].sql).toContain("status = 'pending'");
  });
});
