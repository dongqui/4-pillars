import { describe, it, expect } from "vitest";
import type { SqlClient } from "@/lib/db";
import { refundTicket } from "./refund";

function fakeClient(...responses: Record<string, unknown>[][]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(responses[i++] ?? []);
  };
  return { client, calls };
}

const input = { userId: "7", feature: "consultation" as const, subjectKey: "42" };

describe("refundTicket", () => {
  it("권한이 지워지면 refunded 와 복구된 잔액", async () => {
    const { client, calls } = fakeClient([{ revoked_id: 11, balance: 3 }]);
    expect(await refundTicket(input, client)).toEqual({
      ok: true,
      kind: "refunded",
      balance: 3,
    });
    // 한 문장이어야 한다 — 나뉘면 권한 삭제와 잔액 복구 사이에 프로세스가 죽을 틈이 생긴다.
    expect(calls).toHaveLength(1);
  });

  it("되돌릴 권한이 없으면 nothing_to_refund — 실패가 아니다", async () => {
    const { client } = fakeClient([{ revoked_id: null, balance: 2 }]);
    expect(await refundTicket(input, client)).toEqual({
      ok: true,
      kind: "nothing_to_refund",
      balance: 2,
    });
  });

  it("지갑 행이 없으면 잔액 0 으로 접는다", async () => {
    const { client } = fakeClient([{ revoked_id: null, balance: null }]);
    expect(await refundTicket(input, client)).toEqual({
      ok: true,
      kind: "nothing_to_refund",
      balance: 0,
    });
  });

  it("DELETE ... RETURNING 이 멱등 키다 — 두 번째 호출은 지울 행이 없어 잔액이 오르지 않는다", async () => {
    const { client, calls } = fakeClient([{ revoked_id: 11, balance: 3 }]);
    await refundTicket(input, client);
    const { sql } = calls[0];
    expect(sql).toContain("DELETE FROM entitlements");
    expect(sql).toContain("RETURNING id, cost");
    // 이 EXISTS 가 없으면 되돌릴 것이 없어도 잔액이 오른다.
    expect(sql).toContain("EXISTS (SELECT 1 FROM revoked)");
  });

  it("되돌리는 장수는 지워진 행의 cost 에서 온다 — 바인딩 값이 아니다", async () => {
    const { client, calls } = fakeClient([{ revoked_id: 11, balance: 3 }]);
    await refundTicket(input, client);
    // 가격표가 바뀌어도 "이때 몇 장을 냈는가"는 그 행이 안다.
    expect(calls[0].sql).toContain("(SELECT cost FROM revoked)");
    // 바인딩되는 값은 사용자·feature·대상 셋뿐이다. 장수가 인자로 들어오면 안 된다.
    expect(calls[0].values).toEqual(["7", "consultation", "42", "7", "7"]);
  });

  it("원장에 양수 delta 와 reason='refund' 를 남긴다", async () => {
    const { client, calls } = fakeClient([{ revoked_id: 11, balance: 3 }]);
    await refundTicket(input, client);
    expect(calls[0].sql).toContain("INSERT INTO ticket_entries");
    expect(calls[0].sql).toContain("'refund'");
  });
});
