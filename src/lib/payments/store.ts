import { sql as neonSql, type SqlClient } from "@/lib/db";

const sql = neonSql as unknown as SqlClient;

/** purchases.status CHECK 제약과 같은 집합이다. */
export type PurchaseStatus = "pending" | "paid" | "refunded" | "failed";

const STATUSES: readonly string[] = ["pending", "paid", "refunded", "failed"];

/** 확정 로직이 보는 주문 한 건. */
export interface PendingOrder {
  paymentId: string;
  userId: string;
  /** 주문 생성 시점에 서버가 박아 둔 청구 금액. 토스 승인·조회 결과와 대조하는 기준이다. */
  amount: number;
  status: PurchaseStatus;
}

/**
 * DB 행 → PendingOrder. 컬럼 이름을 아는 유일한 곳이다.
 * user_id 를 문자열로 접는 이유: bigint 라 JS number 로 받으면 큰 값에서
 * 정밀도가 깨진다 (toProfileRow 와 같은 판단).
 *
 * 적립 장수(tickets)는 여기 없다 — 적립은 confirmPurchaseAndCredit 이 DB 안에서
 * 직접 읽는다. 값을 앱까지 올렸다 내리면 그 사이에 손댈 자리가 생긴다.
 */
export function toPendingOrder(r: Record<string, unknown>): PendingOrder {
  const status = String(r.status);
  return {
    paymentId: String(r.payment_id),
    userId: String(r.user_id),
    amount: Number(r.amount),
    // 모르는 값을 pending 으로 두면 확정 로직이 재확정을 시도한다. 막다른 쪽으로 접는다.
    status: (STATUSES.includes(status) ? status : "failed") as PurchaseStatus,
  };
}

/**
 * 결제 시작 시점의 pending 행. 재시도할 때마다 새로 만든다 —
 * 재시도 이력이 남는 편이 디버깅에 낫다 (0007 주석 참조).
 *
 * profile_id 를 쓰지 않는다: 이용권 충전에는 대상 프로필이 없다. 0007 이
 * NULL 허용으로 열어 둔 자리를 그대로 비워 둔다.
 *
 * product·amount·tickets 를 호출자가 넘기는 이유: 가격표를 아는 곳은 주문 생성
 * 핸들러 하나여야 한다. 여기서 다시 읽으면 표를 아는 곳이 둘이 된다.
 */
export async function createPendingPurchase(
  input: { userId: string; paymentId: string; product: string; amount: number; tickets: number },
  client: SqlClient = sql,
): Promise<void> {
  await client`
    INSERT INTO purchases (
      user_id, product, amount, tickets, currency, status, provider, payment_id
    ) VALUES (
      ${input.userId}::bigint, ${input.product},
      ${input.amount}, ${input.tickets}, 'KRW', 'pending', 'tosspayments', ${input.paymentId}
    )
  `;
}

export async function findOrderByPaymentId(
  paymentId: string,
  client: SqlClient = sql,
): Promise<PendingOrder | null> {
  const rows = await client`
    SELECT payment_id, user_id, amount, status
    FROM purchases WHERE payment_id = ${paymentId}
  `;
  const row = rows[0];
  return row ? toPendingOrder(row) : null;
}

/** 결제 완료 화면이 보는 영수증 한 건. 확정 로직이 보는 것과 필요한 열이 다르다. */
export interface PurchaseReceipt {
  userId: string;
  /** 이 주문으로 적립된 장수. 완료 화면이 "+N" 으로 띄운다. */
  tickets: number;
  status: PurchaseStatus;
}

/**
 * 완료 화면 전용 조회. PendingOrder 와 달리 tickets 를 싣는다.
 *
 * 확정 경로가 tickets 를 앱까지 올리지 않는 판단(toPendingOrder 주석)은 그대로다 —
 * 여기서 읽은 값은 화면에 숫자를 찍는 데만 쓰이고 적립에는 닿지 않는다. 적립은
 * 여전히 confirmPurchaseAndCredit 이 DB 안에서 스스로 읽는다.
 *
 * tickets 가 NULL 인 행(수기 지급)은 0 으로 접는다. 완료 화면이 뜨는 시점엔 이미
 * 적립이 끝났으므로, 여기서 던져 봐야 결제한 사용자에게 오류만 보일 뿐이다.
 */
export async function findReceiptByPaymentId(
  paymentId: string,
  client: SqlClient = sql,
): Promise<PurchaseReceipt | null> {
  const rows = await client`
    SELECT user_id, tickets, status
    FROM purchases WHERE payment_id = ${paymentId}
  `;
  const row = rows[0];
  if (!row) return null;
  const status = String(row.status);
  return {
    userId: String(row.user_id),
    tickets: Number(row.tickets ?? 0),
    status: (STATUSES.includes(status) ? status : "failed") as PurchaseStatus,
  };
}

/** 금액·통화가 어긋났거나 토스가 실패로 끝낸 주문을 내린다. */
export async function markPurchaseFailed(
  paymentId: string,
  client: SqlClient = sql,
): Promise<void> {
  await client`
    UPDATE purchases SET status = 'failed'
     WHERE payment_id = ${paymentId} AND status = 'pending'
  `;
}
