import { describe, it, expect } from "vitest";
import type { SqlClient } from "@/lib/db";
import {
  createPendingPurchase,
  findOrderByPaymentId,
  findReceiptByPaymentId,
  markPurchaseFailed,
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
  amount: 5000,
  status: "pending",
};

describe("toPendingOrder", () => {
  it("bigint 컬럼을 문자열로 접는다 — JS number 는 bigint 를 담지 못한다", () => {
    expect(toPendingOrder(dbRow)).toEqual({
      paymentId: "saju-abc",
      userId: "7",
      amount: 5000,
      status: "pending",
    });
  });

  it("모르는 status 는 failed 로 접는다 — 모르는 값을 pending 으로 두면 재확정 대상이 된다", () => {
    expect(toPendingOrder({ ...dbRow, status: "weird" }).status).toBe("failed");
  });
});

describe("createPendingPurchase", () => {
  it("상품·금액·장수를 호출자가 넘긴 값 그대로 박는다", async () => {
    const { client, calls } = fakeClient([]);
    await createPendingPurchase(
      { userId: "7", paymentId: "saju-abc", product: "t5", amount: 5000, tickets: 6 },
      client,
    );
    expect(calls[0].sql).toContain("INSERT INTO purchases");
    expect(calls[0].values).toEqual(["7", "t5", 5000, 6, "saju-abc"]);
    expect(calls[0].sql).toContain("'pending'");
    expect(calls[0].sql).toContain("'tosspayments'");
  });

  it("profile_id 를 쓰지 않는다 — 이용권 충전에는 대상 프로필이 없다", async () => {
    const { client, calls } = fakeClient([]);
    await createPendingPurchase(
      { userId: "7", paymentId: "saju-abc", product: "t1", amount: 1000, tickets: 1 },
      client,
    );
    expect(calls[0].sql).not.toContain("profile_id");
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
    expect(order?.userId).toBe("7");
    expect(calls[0].values).toEqual(["saju-abc"]);
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

describe("findReceiptByPaymentId", () => {
  const receiptRow = { user_id: 7, tickets: 6, status: "paid" };

  it("행이 없으면 null", async () => {
    const { client } = fakeClient([]);
    expect(await findReceiptByPaymentId("saju-none", client)).toBeNull();
  });

  it("적립 장수까지 읽는다 — 완료 화면이 +N 을 띄우려면 필요하다", async () => {
    const { client, calls } = fakeClient([receiptRow]);
    expect(await findReceiptByPaymentId("saju-abc", client)).toEqual({
      userId: "7",
      tickets: 6,
      status: "paid",
    });
    expect(calls[0].values).toEqual(["saju-abc"]);
  });

  it("tickets 가 NULL 이면 0 — 완료 화면 시점엔 이미 적립이 끝나 던져 봐야 소용없다", async () => {
    const { client } = fakeClient([{ ...receiptRow, tickets: null }]);
    expect((await findReceiptByPaymentId("saju-abc", client))?.tickets).toBe(0);
  });

  it("모르는 status 는 failed 로 접는다 — 완료 화면이 paid 만 통과시킨다", async () => {
    const { client } = fakeClient([{ ...receiptRow, status: "weird" }]);
    expect((await findReceiptByPaymentId("saju-abc", client))?.status).toBe("failed");
  });
});
