import type { PortOnePayment } from "./portone";
import type { PendingOrder } from "./store";

export type ConfirmFailure = "not_found" | "not_paid" | "amount_mismatch" | "currency_mismatch";

export type ConfirmResult =
  | { ok: true; kind: "confirmed" | "already"; profileId: string }
  | { ok: false; kind: ConfirmFailure };

export interface ConfirmDeps {
  findOrder(paymentId: string): Promise<PendingOrder | null>;
  lookupPayment(paymentId: string): Promise<PortOnePayment>;
  /** 갱신된 행이 있으면 true. false 는 이미 다른 경로가 확정했다는 뜻이다. */
  markPaid(a: { paymentId: string; transactionId: string | null }): Promise<boolean>;
  markFailed(paymentId: string): Promise<void>;
}

/** 더 이상 결제가 될 수 없는 상태. 행을 내린다. */
const DEAD: ReadonlySet<PortOnePayment["status"]> = new Set(["FAILED", "CANCELLED"]);

/**
 * 결제 확정. 완료 API 와 웹훅이 공유하는 유일한 경로다.
 *
 * 소유 확인을 하지 않는 이유: 웹훅에는 세션이 없다. 호출자(완료 API 핸들러)가
 * 먼저 주문의 userId 를 세션과 대조하고 나서 이 함수를 부른다.
 *
 * 금액 대조의 기준은 포트원이 아니라 order.amount 다 — 주문 생성 시점에 서버가
 * 박아 둔 값이라 브라우저가 손댈 수 없다.
 */
export async function confirmPayment(
  paymentId: string,
  d: ConfirmDeps,
): Promise<ConfirmResult> {
  const order = await d.findOrder(paymentId);
  if (order === null) return { ok: false, kind: "not_found" };

  // 이미 확정된 주문에 포트원을 다시 부르지 않는다 — 웹훅과 완료 API 가 겹칠 때
  // 같은 결제 건을 두 번 조회할 이유가 없다.
  if (order.status === "paid") return { ok: true, kind: "already", profileId: order.profileId };

  // 여기서 던지는 예외는 삼키지 않는다. 일시 장애를 "미결제"로 접으면 돈은 받고
  // 리포트는 안 열린 채 조용히 끝난다 — 호출자가 5xx 로 올려 재시도를 유도해야 한다.
  const payment = await d.lookupPayment(paymentId);

  if (DEAD.has(payment.status)) {
    await d.markFailed(paymentId);
    return { ok: false, kind: "not_paid" };
  }

  // READY/PENDING/VIRTUAL_ACCOUNT_ISSUED 는 아직 결제가 아니지만 죽지도 않았다.
  // 행을 건드리지 않고 물러난다 — 웹훅이 뒤이어 도착하면 그때 확정된다.
  if (payment.status !== "PAID") return { ok: false, kind: "not_paid" };

  if (payment.currency !== "KRW") {
    await d.markFailed(paymentId);
    return { ok: false, kind: "currency_mismatch" };
  }

  // 돈은 받았는데 금액이 다른 상태다. 자동 취소는 하지 않는다 — 취소 API 연동은
  // 이 작업 범위 밖이라 백로그에 있다. 행을 내리고 로그로 남긴다.
  if (payment.amount.total !== order.amount) {
    console.error(
      `[confirmPayment] 금액 불일치 paymentId=${paymentId} 주문=${order.amount} 결제=${payment.amount.total}`,
    );
    await d.markFailed(paymentId);
    return { ok: false, kind: "amount_mismatch" };
  }

  const flipped = await d.markPaid({
    paymentId,
    transactionId: payment.transactionId ?? null,
  });
  // false 는 실패가 아니다 — 그 사이 다른 경로가 먼저 UPDATE 를 이겼다는 뜻이다.
  // 이 한 줄이 완료 API 와 웹훅의 동시 도착을 멱등하게 만든다.
  return { ok: true, kind: flipped ? "confirmed" : "already", profileId: order.profileId };
}
