import { describe, it, expect } from "vitest";
import type { SqlClient } from "@/lib/db";
import { executeRefund, findRefundCandidate, markRefundFailed, toRefundCandidate } from "./refund-store";

function fakeClient(...responses: Record<string, unknown>[][]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(responses[i++] ?? []);
  };
  return { client, calls };
}

const NOW = new Date("2026-10-02T09:00:00.000Z");

describe("toRefundCandidate", () => {
  it("행을 숫자·Date 로 접는다 — bigint 는 문자열, timestamptz 는 Date", () => {
    expect(
      toRefundCandidate({
        id: 9, user_id: 7, payment_id: "saju-abc", status: "paid", amount: 5000, tickets: 6,
        remaining: 4, paid_at: "2026-10-01T09:00:00.000Z",
      }),
    ).toEqual({
      purchaseId: "9", userId: "7", paymentId: "saju-abc", status: "paid", amount: 5000, tickets: 6,
      remaining: 4, paidAt: new Date("2026-10-01T09:00:00.000Z"),
    });
  });

  it("remaining·tickets·paid_at 이 NULL 이면 null 로 둔다 — 규칙 함수가 불가로 접는다", () => {
    const c = toRefundCandidate({ id: 9, user_id: 7, payment_id: "p", status: "paid", amount: 1000, tickets: null, remaining: null, paid_at: null });
    expect(c.tickets).toBeNull();
    expect(c.remaining).toBeNull();
    expect(c.paidAt).toBeNull();
  });
});

describe("findRefundCandidate", () => {
  it("id 와 user_id 를 함께 건다 — purchases.id 는 순번이라 남의 결제를 훑을 수 있다", async () => {
    const { client, calls } = fakeClient([]);
    expect(await findRefundCandidate("9", "7", client)).toBeNull();
    expect(calls[0].sql).toContain("WHERE id = ?::bigint AND user_id = ?::bigint");
    expect(calls[0].values).toEqual(["9", "7"]);
  });
});

describe("executeRefund", () => {
  const input = { purchaseId: "9", userId: "7", amount: 3000, remaining: 4, now: NOW };

  it("한 문장이다 — 결제·지갑·원장이 나뉘면 돈은 돌려주고 이용권은 남는 틈이 생긴다", async () => {
    const { client, calls } = fakeClient([{ payment_id: "saju-abc", remaining: 4 }]);
    expect(await executeRefund(input, client)).toEqual({ paymentId: "saju-abc", remaining: 4 });
    expect(calls).toHaveLength(1);
  });

  it("status='paid' AND remaining > 0 AND paid_at >= 창 시작 을 WHERE 에 건다 — 동시 요청은 한쪽만 통과", async () => {
    const { client, calls } = fakeClient([{ payment_id: "p", remaining: 1 }]);
    await executeRefund(input, client);
    const { sql, values } = calls[0];
    expect(sql).toContain("status = 'paid' AND remaining > 0");
    expect(sql).toContain("paid_at >= ?");
    expect(values).toContainEqual(new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000));
  });

  it("읽을 때의 remaining 을 WHERE 에 건다 — 그 사이 이용권을 썼으면 0행(환불액이 틀어진다)", async () => {
    const { client, calls } = fakeClient([{ payment_id: "p", remaining: 4 }]);
    await executeRefund(input, client);
    expect(calls[0].sql).toContain("AND remaining = ?");
    expect(calls[0].values).toContain(4);
  });

  it("환불액을 refund_amount 에 쓰고 status 를 refunded 로 바꾼다", async () => {
    const { client, calls } = fakeClient([{ payment_id: "p", remaining: 1 }]);
    await executeRefund(input, client);
    expect(calls[0].sql).toContain("SET status = 'refunded', refunded_at = now(), refund_amount = ?");
    expect(calls[0].values).toContain(3000);
  });

  it("지갑은 remaining 만큼 깎고 원장은 -remaining 을 'refund' 로 남긴다", async () => {
    const { client, calls } = fakeClient([{ payment_id: "p", remaining: 1 }]);
    await executeRefund(input, client);
    expect(calls[0].sql).toContain("SET balance = w.balance - t.remaining");
    expect(calls[0].sql).toContain("SELECT user_id, -remaining, 'refund', id FROM target");
  });

  it("0행이면 null — 남의 것·7일 경과·이미 환불·전부 사용을 가르지 않는다", async () => {
    const { client } = fakeClient([]);
    expect(await executeRefund(input, client)).toBeNull();
  });
});

describe("markRefundFailed", () => {
  it("refund_failed_at 만 찍는다 — status 는 refunded 그대로(운영자가 콘솔에서 마저 취소한다)", async () => {
    const { client, calls } = fakeClient([]);
    await markRefundFailed("9", client);
    expect(calls[0].sql).toContain("SET refund_failed_at = now()");
    expect(calls[0].sql).not.toContain("status");
    expect(calls[0].values).toEqual(["9"]);
  });
});
