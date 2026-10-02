/**
 * 이용권 부분 환불의 규칙. 순수 함수만 — 목록(listPurchaseOptions)과 실행(executeRefund)이
 * 같은 답을 보게 조건을 여기 한 곳에 둔다. DB·fetch 는 refund-store.ts 와 portone.ts 에 있다.
 *
 * 환불액 = 결제액 − 쓴 장수 × 정가. 묶음 할인과 보너스는 "다 쓰는 조건" 이라 쓴 만큼은
 * 정가로 친다. 그래서 남은 장수가 있어도 환불액이 0 이 될 수 있고, 그 결제는 목록에서 빠진다.
 */

export const REFUND_WINDOW_DAYS = 7;
export const USED_TICKET_PRICE = 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RefundablePurchase {
  status: string;
  amount: number;
  /** 적립 장수(보너스 포함). 옛 행은 NULL 일 수 있다. */
  tickets: number | null;
  /** 아직 안 쓴 장수. 0057 백필 전 행은 NULL — 환불 불가로 본다. */
  remaining: number | null;
  paidAt: Date | null;
}

export function refundAmount(p: { amount: number; tickets: number | null; remaining: number | null }): number {
  // tickets 가 NULL 이면 사용량이 음수가 되어 결제액보다 큰 환불이 나온다 — 0 으로 접는다.
  if (p.tickets === null) return 0;
  const remaining = p.remaining ?? 0;
  const used = Math.max(0, p.tickets - remaining);
  return Math.max(0, p.amount - used * USED_TICKET_PRICE);
}

export function refundWindowStart(now: Date): Date {
  return new Date(now.getTime() - REFUND_WINDOW_DAYS * DAY_MS);
}

export function isRefundable(p: RefundablePurchase, now: Date): boolean {
  if (p.status !== "paid") return false;
  if (p.paidAt === null) return false;
  if (p.paidAt.getTime() < refundWindowStart(now).getTime()) return false;
  if ((p.remaining ?? 0) <= 0) return false;
  return refundAmount(p) > 0;
}
