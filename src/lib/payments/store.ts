import { sql as neonSql, type SqlClient } from "@/lib/db";
import { PRODUCT_FULL_REPORT } from "@/lib/profiles/products";

const sql = neonSql as unknown as SqlClient;

/** purchases.status CHECK 제약과 같은 집합이다. */
export type PurchaseStatus = "pending" | "paid" | "refunded" | "failed";

const STATUSES: readonly string[] = ["pending", "paid", "refunded", "failed"];

/** 확정 로직이 보는 주문 한 건. */
export interface PendingOrder {
  paymentId: string;
  userId: string;
  profileId: string;
  /** 주문 생성 시점에 서버가 박아 둔 청구 금액. 포트원 조회 결과와 대조하는 기준이다. */
  amount: number;
  status: PurchaseStatus;
}

/**
 * DB 행 → PendingOrder. 컬럼 이름을 아는 유일한 곳이다.
 * user_id/profile_id 를 문자열로 접는 이유: bigint 라 JS number 로 받으면 큰 값에서
 * 정밀도가 깨진다 (toProfileRow 와 같은 판단).
 */
export function toPendingOrder(r: Record<string, unknown>): PendingOrder {
  const status = String(r.status);
  return {
    paymentId: String(r.payment_id),
    userId: String(r.user_id),
    profileId: String(r.profile_id),
    amount: Number(r.amount),
    // 모르는 값을 pending 으로 두면 확정 로직이 재확정을 시도한다. 막다른 쪽으로 접는다.
    status: (STATUSES.includes(status) ? status : "failed") as PurchaseStatus,
  };
}

/**
 * 결제 시작 시점의 pending 행. 재시도할 때마다 새로 만든다 —
 * 0008 의 부분 유니크 인덱스가 paid 에만 걸려 있어 pending 은 여러 개여도 되고,
 * 재시도 이력이 남는 편이 디버깅에 낫다 (0007 주석 참조).
 */
export async function createPendingPurchase(
  input: { userId: string; profileId: string; paymentId: string; amount: number },
  client: SqlClient = sql,
): Promise<void> {
  await client`
    INSERT INTO purchases (
      user_id, profile_id, product, amount, currency, status, provider, payment_id
    ) VALUES (
      ${input.userId}::bigint, ${input.profileId}::bigint, ${PRODUCT_FULL_REPORT},
      ${input.amount}, 'KRW', 'pending', 'portone', ${input.paymentId}
    )
  `;
}

export async function findOrderByPaymentId(
  paymentId: string,
  client: SqlClient = sql,
): Promise<PendingOrder | null> {
  const rows = await client`
    SELECT payment_id, user_id, profile_id, amount, status
    FROM purchases WHERE payment_id = ${paymentId}
  `;
  const row = rows[0];
  return row ? toPendingOrder(row) : null;
}

/**
 * 결제 확정. 갱신된 행이 있으면 true.
 *
 * ⚠️ `status = 'pending'` 조건이 이 함수의 존재 이유다. 완료 API 와 웹훅이 같은
 * 결제 건을 동시에 확정하러 와도 UPDATE 를 이긴 쪽만 true 를 받는다 —
 * 진 쪽은 실패가 아니라 "이미 확정됨"이다 (confirm.ts 참조).
 */
export async function markPurchasePaid(
  a: { paymentId: string; transactionId: string | null },
  client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    UPDATE purchases
       SET status = 'paid', paid_at = now(), provider_txn_id = ${a.transactionId}
     WHERE payment_id = ${a.paymentId} AND status = 'pending'
    RETURNING id
  `;
  return rows.length > 0;
}

/** 금액·통화가 어긋났거나 포트원이 실패로 끝낸 주문을 내린다. */
export async function markPurchaseFailed(
  paymentId: string,
  client: SqlClient = sql,
): Promise<void> {
  await client`
    UPDATE purchases SET status = 'failed'
     WHERE payment_id = ${paymentId} AND status = 'pending'
  `;
}
