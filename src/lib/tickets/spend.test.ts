import { describe, it, expect } from "vitest";
import type { SqlClient } from "@/lib/db";
import { spendTicket } from "./spend";

function fakeClient(...responses: (Record<string, unknown>[] | Error)[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    const r = responses[i++];
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve(r ?? []);
  };
  return { client, calls };
}

/** Postgres CHECK 위반. 23514 = check_violation. */
function checkViolation(constraint = "ticket_wallets_balance_check") {
  return Object.assign(
    new Error(`new row for relation "ticket_wallets" violates check constraint "${constraint}"`),
    { code: "23514", constraint },
  );
}

const input = { userId: "7", feature: "full_report" as const, subjectKey: "3" };

describe("spendTicket", () => {
  it("권한이 생기면 spent 와 차감된 잔액", async () => {
    const { client, calls } = fakeClient([{ entitlement_id: 11, balance: 5 }]);
    expect(await spendTicket(input, client)).toEqual({ ok: true, kind: "spent", balance: 5 });
    // 한 문장이어야 한다 — 나뉘면 차감과 권한 부여 사이에 프로세스가 죽을 틈이 생긴다.
    expect(calls).toHaveLength(1);
  });

  it("권한 INSERT 가 차감 UPDATE 보다 먼저다 — 반대면 돈만 없어지는 경우가 생긴다", async () => {
    const { client, calls } = fakeClient([{ entitlement_id: 11, balance: 5 }]);
    await spendTicket(input, client);
    const { sql } = calls[0];
    // indexOf 비교만으로는 INSERT 자체가 사라져도 -1(못 찾음)이 다른 자리보다
    // 작아 그대로 통과해 버린다. 존재를 먼저 못 박아야 "먼저다" 라는 주장이
    // 실제로 그 문장을 가리킨다.
    expect(sql).toContain("INSERT INTO entitlements");
    expect(sql.indexOf("INSERT INTO entitlements")).toBeLessThan(sql.indexOf("UPDATE ticket_wallets"));
  });

  it("중복 요청은 UNIQUE 에 막혀 차감 없이 already 가 된다", async () => {
    const { client, calls } = fakeClient(
      [{ entitlement_id: null, balance: null }],
      [{ entitlement_id: 11, balance: 5 }],
    );
    expect(await spendTicket(input, client)).toEqual({ ok: true, kind: "already", balance: 5 });
    expect(calls[0].sql).toContain("ON CONFLICT");
    expect(calls[0].sql).toContain("DO NOTHING");
    // 이 두 관문은 동시성 안전의 핵심이라 단위 테스트로 행동을 재현할 수 없다 —
    // claim 이 비어도(중복이든 잔액 부족이든) pay 가 EXISTS 로 막지 못하면 매 중복
    // 요청마다 조용히 이중 차감된다. SQL 텍스트에 고정해 두는 것이 유일한 가드다.
    expect(calls[0].sql).toContain("WHERE user_id = ?::bigint AND EXISTS (SELECT 1 FROM claim)");
    // claim 이 아예 안 생기는 조건(잔액 >= 비용)도 같은 이유로 텍스트에 고정한다 —
    // 이게 없으면 잔액이 모자라도 권한이 그냥 생겨 버린다.
    expect(calls[0].sql).toContain(
      "WHERE (SELECT balance FROM ticket_wallets WHERE user_id = ?::bigint) >= ?",
    );
  });

  it("잔액이 모자라면 insufficient", async () => {
    const { client } = fakeClient(
      [{ entitlement_id: null, balance: null }],
      [{ entitlement_id: null, balance: 0 }],
    );
    expect(await spendTicket(input, client)).toEqual({
      ok: false,
      kind: "insufficient",
      balance: 0,
    });
  });

  it("지갑 행이 아예 없어도 잔액 0 으로 접는다", async () => {
    const { client } = fakeClient(
      [{ entitlement_id: null, balance: null }],
      [{ entitlement_id: null, balance: null }],
    );
    expect(await spendTicket(input, client)).toEqual({
      ok: false,
      kind: "insufficient",
      balance: 0,
    });
  });

  it("동시 사용으로 CHECK 가 터지면 insufficient — 문장 전체가 롤백돼 권한도 없다", async () => {
    const { client } = fakeClient(checkViolation(), [{ entitlement_id: null, balance: 0 }]);
    expect(await spendTicket(input, client)).toEqual({
      ok: false,
      kind: "insufficient",
      balance: 0,
    });
  });

  it("다른 제약 위반은 다시 던진다 — 전부 삼키면 DB 장애가 잔액 부족으로 둔갑한다", async () => {
    const { client } = fakeClient(checkViolation("ticket_entries_delta_check"));
    await expect(spendTicket(input, client)).rejects.toThrow();
  });

  it("CHECK 가 아닌 예외도 다시 던진다", async () => {
    const { client } = fakeClient(new Error("connection reset"));
    await expect(spendTicket(input, client)).rejects.toThrow("connection reset");
  });

  it("원장에 음수 delta 와 reason='spend' 를 남긴다", async () => {
    const { client, calls } = fakeClient([{ entitlement_id: 11, balance: 5 }]);
    await spendTicket(input, client);
    expect(calls[0].sql).toContain("INSERT INTO ticket_entries");
    expect(calls[0].sql).toContain("'spend'");
    // cost 는 이제 FEATURE_COST[feature] 에서 읽는다 — full_report 단가 1의 음수.
    expect(calls[0].values).toContain(-1);
  });
});
