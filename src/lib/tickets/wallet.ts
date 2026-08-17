import { sql as neonSql, type SqlClient } from "@/lib/db";

const sql = neonSql as unknown as SqlClient;

/**
 * 지갑 잔액. 행이 없으면 0 이다 — 회원가입 때 지갑을 만들지 않는 판단(0012 주석)의
 * 반대편이라, 여기서 없음을 0 으로 접어야 화면이 특수 케이스를 몰라도 된다.
 */
export async function getBalance(userId: string, client: SqlClient = sql): Promise<number> {
  const rows = await client`
    SELECT balance FROM ticket_wallets WHERE user_id = ${userId}::bigint
  `;
  return Number(rows[0]?.balance ?? 0);
}

/**
 * 결제 확정 + 이용권 적립. 갱신된 행이 있으면 true.
 * 기존 markPurchasePaid 의 자리를 그대로 받는다 — false 는 "pending 이 아니었다"는
 * 뜻이고, 그게 paid 인지 refunded 인지는 호출자(confirmPayment)가 다시 읽어 가린다.
 *
 * ⚠️ CTE 한 문장인 것이 이 함수의 존재 이유다. Neon HTTP 드라이버에는 대화형
 * 트랜잭션이 없어, 확정과 적립을 두 문장으로 나누면 그 사이에 프로세스가 죽었을 때
 * 돈은 받고 이용권은 없는 행이 남는다. 한 문장은 암묵적 트랜잭션이라 그 틈이 없다.
 *
 * 이중 적립도 여기서 막힌다: 완료 API 와 웹훅이 동시에 와도 status='pending' 조건을
 * 이긴 쪽만 paid 에 행을 받고, 진 쪽은 paid 가 비어 뒤따르는 SELECT ... FROM paid 가
 * 0행이 된다 — 지갑도 원장도 건드리지 않는다.
 *
 * 적립 장수를 인자가 아니라 purchases.tickets 에서 읽는 이유: 주문 생성 시점에
 * 서버가 박아 둔 값이라 브라우저가 손댈 수 없고, 확정 시점에 가격표가 바뀌어 있어도
 * 사용자는 산 만큼 받는다.
 *
 * tickets 가 NULL 인 행(수기 지급 등)을 만나면 balance NOT NULL 위반으로 던진다.
 * 조용히 0장 적립되어 "결제는 됐는데 이용권이 없다"로 나타나는 것보다 낫다.
 */
export async function confirmPurchaseAndCredit(
  a: { paymentId: string; transactionId: string | null },
  client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    WITH paid AS (
      UPDATE purchases
         SET status = 'paid', paid_at = now(), provider_txn_id = ${a.transactionId}
       WHERE payment_id = ${a.paymentId} AND status = 'pending'
      RETURNING id, user_id, tickets
    ), wallet AS (
      INSERT INTO ticket_wallets (user_id, balance)
      SELECT user_id, tickets FROM paid
      ON CONFLICT (user_id) DO UPDATE
        SET balance = ticket_wallets.balance + EXCLUDED.balance,
            updated_at = now()
      RETURNING balance
    ), ledger AS (
      INSERT INTO ticket_entries (user_id, delta, reason, purchase_id)
      SELECT user_id, tickets, 'purchase', id FROM paid
      RETURNING id
    )
    SELECT balance FROM wallet
  `;
  return rows.length > 0;
}
