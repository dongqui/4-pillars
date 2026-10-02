import { sql as neonSql, type SqlClient } from "@/lib/db";
import { refundWindowStart, type RefundablePurchase } from "./refund";

const sql = neonSql as unknown as SqlClient;

export interface RefundCandidate extends RefundablePurchase {
  purchaseId: string;
  userId: string;
  paymentId: string;
}

/** DB 행 → RefundCandidate. 컬럼 이름을 아는 유일한 곳이다. bigint 는 문자열로(toPendingOrder 와 같은 판단). */
export function toRefundCandidate(r: Record<string, unknown>): RefundCandidate {
  return {
    purchaseId: String(r.id),
    userId: String(r.user_id),
    paymentId: String(r.payment_id ?? ""),
    status: String(r.status),
    amount: Number(r.amount),
    tickets: r.tickets == null ? null : Number(r.tickets),
    remaining: r.remaining == null ? null : Number(r.remaining),
    paidAt: r.paid_at == null ? null : new Date(r.paid_at as string | Date),
  };
}

/**
 * 환불 실행 직전에 행을 다시 읽는다 — 클라이언트가 보낸 금액은 받지 않고 여기서 계산한다.
 * user_id 를 함께 거는 이유: purchases.id 는 순번 bigint 라 번호를 올려 가며 남의 결제를 훑을 수 있다.
 */
export async function findRefundCandidate(
  purchaseId: string,
  userId: string,
  client: SqlClient = sql,
): Promise<RefundCandidate | null> {
  const rows = await client`
    SELECT id, user_id, payment_id, status, amount, tickets, remaining, paid_at
      FROM purchases
     WHERE id = ${purchaseId}::bigint AND user_id = ${userId}::bigint
  `;
  const row = rows[0];
  return row ? toRefundCandidate(row) : null;
}

/**
 * 환불 실행. 적립(confirmPurchaseAndCredit)의 정확한 역이다.
 *
 * ⚠️ CTE 한 문장인 이유는 적립과 같다 — Neon HTTP 드라이버에 대화형 트랜잭션이 없어 세 테이블을
 * 나누면 그 사이에 프로세스가 죽었을 때 "돈은 돌려줬는데 이용권은 남은" 상태가 생긴다.
 *
 * WHERE 가 곧 환불 가능 조건이다(isRefundable 과 같은 셋). 동시 요청 두 개는 status='paid'
 * 조건으로 한쪽만 통과한다. 0행은 실패가 아니라 "환불할 수 없는 결제" — 남의 것·7일 경과·
 * 이미 환불·전부 사용을 가르지 않는다(가르면 id 로 존재 여부를 훑을 수 있다).
 *
 * 지갑 잔액이 remaining 보다 작은 비정상 행(백필 뒤 잔액이 바뀐 경우)은 0012 의 balance CHECK 가
 * 문장 전체를 롤백한다 — 호출자에게 예외로 나간다.
 *
 * 환불액(amount)은 호출자가 findRefundCandidate 로 읽은 행에서 refundAmount 로 계산한 값이다.
 * 여기서 다시 계산하지 않는 이유: SQL 안에서 가격 규칙을 또 적으면 규칙을 아는 곳이 둘이 된다.
 */
export async function executeRefund(
  a: { purchaseId: string; userId: string; amount: number; now: Date },
  client: SqlClient = sql,
): Promise<{ paymentId: string; remaining: number } | null> {
  const rows = await client`
    WITH target AS (
      UPDATE purchases
         SET status = 'refunded', refunded_at = now(), refund_amount = ${a.amount}
       WHERE id = ${a.purchaseId}::bigint AND user_id = ${a.userId}::bigint
         AND status = 'paid' AND remaining > 0
         AND paid_at >= ${refundWindowStart(a.now)}
      RETURNING id, user_id, remaining, payment_id
    ), wallet AS (
      UPDATE ticket_wallets w
         SET balance = w.balance - t.remaining, updated_at = now()
        FROM target t
       WHERE w.user_id = t.user_id
      RETURNING w.balance
    ), ledger AS (
      INSERT INTO ticket_entries (user_id, delta, reason, purchase_id)
      SELECT user_id, -remaining, 'refund', id FROM target
      RETURNING id
    )
    SELECT t.payment_id, t.remaining FROM target t
  `;
  const row = rows[0];
  if (!row) return null;
  return { paymentId: String(row.payment_id), remaining: Number(row.remaining) };
}

/**
 * 포트원 취소가 실패한 시각. status 는 refunded 그대로 둔다 — DB 차감은 끝났고, 운영자가 콘솔에서
 * 취소를 마저 하면 맞춰진다. 되돌리지 않는 이유는 설계 문서의 "실행" 절 참고.
 */
export async function markRefundFailed(purchaseId: string, client: SqlClient = sql): Promise<void> {
  await client`
    UPDATE purchases SET refund_failed_at = now() WHERE id = ${purchaseId}::bigint
  `;
}
