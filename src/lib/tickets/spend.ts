import { sql as neonSql, type SqlClient } from "@/lib/db";
import { FEATURE_COST, type Feature } from "./features";

const sql = neonSql as unknown as SqlClient;

export type SpendResult =
  | { ok: true; kind: "spent" | "already"; balance: number }
  | { ok: false; kind: "insufficient"; balance: number };

interface SpendInput {
  userId: string;
  feature: Feature;
  subjectKey: string;
}

/** Postgres 가 0012 의 인라인 CHECK 에 자동으로 붙이는 제약 이름. */
const BALANCE_CHECK = "ticket_wallets_balance_check";

/**
 * 잔액 CHECK 위반인지 가린다. 23514 = check_violation.
 *
 * constraint 필드를 드라이버가 채워 줄 때도 있고 아닐 때도 있어 메시지로 물러선다.
 * 제약 이름까지 확인하는 이유: ticket_entries 의 delta CHECK 도 같은 코드로 오는데,
 * 그건 우리 버그(0장 차감)라 잔액 부족으로 삼키면 안 된다.
 */
function isBalanceCheckViolation(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const err = e as { code?: unknown; constraint?: unknown; message?: unknown };
  if (err.code !== "23514") return false;
  if (typeof err.constraint === "string") return err.constraint === BALANCE_CHECK;
  return typeof err.message === "string" && err.message.includes(BALANCE_CHECK);
}

/**
 * 이용권 1건 차감 + 열람 권한 부여.
 *
 * ⚠️ CTE 한 문장인 것과 그 안의 순서가 이 함수의 전부다.
 *
 * 권한 INSERT 가 먼저고 차감 UPDATE 가 뒤다. 반대로 하면 차감은 됐는데 권한이
 * UNIQUE 에 걸려 사라지는 경우가 생긴다 — 사용자는 이용권만 잃는다.
 *
 * 네 갈래 모두 앱이 아니라 제약이 판정한다:
 *  - 정상        : 권한이 생기고 잔액이 준다
 *  - 중복 요청   : entitlements_unique 충돌 → claim 이 비고 → EXISTS 가 거짓 → 차감 없음
 *  - 잔액 부족   : 지갑 행이 없거나 balance >= cost 가 거짓 → claim 자체가 안 생김
 *  - 동시 사용   : 두 UPDATE 가 행 잠금으로 직렬화되어 두 번째가 음수 → CHECK 가
 *                  문장 전체를 롤백 (권한 INSERT 까지 되돌아간다)
 *
 * 단위 테스트로는 동시성을 재현할 수 없다. 정확성의 근거는 이 코드가 아니라
 * 0012 의 CHECK 와 0014 의 UNIQUE 다 — 둘을 지우면 방어선이 통째로 사라진다.
 *
 * cost 를 파라미터로 받지 않고 여기서 FEATURE_COST[a.feature] 로 직접 읽는 이유:
 * 호출자가 넘긴 cost 가 음수면 이 CTE 는 잔액 검사(>= cost)를 통과시키고 차감
 * UPDATE 가 잔액을 오히려 늘리며 ledger 에는 양수 delta 가 'spend' 로 찍힌다 —
 * 차감 API 인데 적립이 되는 것이다. 지금은 FEATURE_COST 만이 유일한 출처라
 * 도달 불가능하지만, 런타임 가드로 막는 대신 그 클래스의 버그 자체를 타입에서
 * 지운다 — 이 브랜치가 FEATURE_COST/Feature 전반에서 쓰는 방식과 같다.
 */
export async function spendTicket(
  a: SpendInput,
  client: SqlClient = sql,
): Promise<SpendResult> {
  const cost = FEATURE_COST[a.feature];
  try {
    const rows = await client`
      WITH claim AS (
        INSERT INTO entitlements (user_id, feature, subject_key, cost)
        SELECT ${a.userId}::bigint, ${a.feature}, ${a.subjectKey}, ${cost}
         WHERE (SELECT balance FROM ticket_wallets WHERE user_id = ${a.userId}::bigint) >= ${cost}
        ON CONFLICT (user_id, feature, subject_key) DO NOTHING
        RETURNING id
      ), pay AS (
        UPDATE ticket_wallets
           SET balance = balance - ${cost}, updated_at = now()
         WHERE user_id = ${a.userId}::bigint AND EXISTS (SELECT 1 FROM claim)
        RETURNING balance
      ), ledger AS (
        INSERT INTO ticket_entries (user_id, delta, reason, entitlement_id)
        SELECT ${a.userId}::bigint, ${-cost}, 'spend', id FROM claim
        RETURNING id
      )
      SELECT (SELECT id FROM claim) AS entitlement_id,
             (SELECT balance FROM pay) AS balance
    `;
    const row = rows[0];
    if (row?.entitlement_id != null) {
      return { ok: true, kind: "spent", balance: Number(row.balance ?? 0) };
    }
  } catch (e) {
    // 동시 사용으로 문장 전체가 롤백됐다. 아래 재조회가 실제 상태를 알려준다.
    if (!isBalanceCheckViolation(e)) throw e;
  }

  return await settle(a, client);
}

/**
 * 권한이 안 생긴 두 경우(이미 보유 / 잔액 부족)를 가른다.
 * CTE 결과만으로는 갈리지 않는다 — 둘 다 entitlement_id 가 NULL 이다.
 */
async function settle(a: SpendInput, client: SqlClient): Promise<SpendResult> {
  const rows = await client`
    SELECT
      (SELECT id FROM entitlements
        WHERE user_id = ${a.userId}::bigint
          AND feature = ${a.feature}
          AND subject_key = ${a.subjectKey}) AS entitlement_id,
      (SELECT balance FROM ticket_wallets WHERE user_id = ${a.userId}::bigint) AS balance
  `;
  const row = rows[0];
  const balance = Number(row?.balance ?? 0);
  return row?.entitlement_id != null
    ? { ok: true, kind: "already", balance }
    : { ok: false, kind: "insufficient", balance };
}
