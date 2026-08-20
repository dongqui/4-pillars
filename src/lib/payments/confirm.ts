import type { TossPayment } from "./toss";
import type { PendingOrder } from "./store";

export type ConfirmFailure = "not_found" | "not_paid" | "amount_mismatch" | "currency_mismatch";

export type ConfirmResult =
  | { ok: true; kind: "confirmed" | "already" }
  | { ok: false; kind: ConfirmFailure };

export interface ConfirmDeps {
  findOrder(paymentId: string): Promise<PendingOrder | null>;
  /**
   * 이 주문의 지금 상태를 확정적으로 알아 온다.
   *
   * 구현이 두 가지다 — 착지 페이지는 승인 API(돈이 잡힌다), 웹훅은 조회 API(읽기만).
   * 토스 결제창은 인증까지만 하므로 누군가는 승인을 불러야 하고, 그 누군가는
   * paymentKey 를 손에 쥔 착지 페이지뿐이다. 웹훅은 그 결과를 확인할 뿐이다.
   */
  resolvePayment(orderId: string): Promise<TossPayment>;
  /**
   * 갱신된 행이 있으면 true. false 는 이미 다른 경로가 확정했다는 뜻이다.
   * 프로덕션 구현(deps.ts)은 확정과 이용권 적립을 한 문장으로 처리한다 —
   * 이 함수가 true 를 돌려줬다는 것은 적립까지 끝났다는 뜻이다.
   */
  markPaid(a: { paymentId: string; transactionId: string | null }): Promise<boolean>;
  markFailed(paymentId: string): Promise<void>;
}

type StatusClass = "paid" | "dead" | "waiting";

/**
 * 토스 결제 상태를 세 갈래로 접는다.
 *
 * switch + never 로 쓰는 이유: 토스가 status 를 하나 추가하면 여기서 컴파일이
 * 깨진다. 모르는 상태가 조용히 "아직 결제 전"으로 흘러가 행을 영원히 pending 으로
 * 남기는 것보다, 빌드가 멈춰서 사람이 판단하는 편이 낫다.
 */
function classify(status: TossPayment["status"]): StatusClass {
  switch (status) {
    case "DONE":
      return "paid";
    case "CANCELED":
    case "ABORTED":
    case "EXPIRED":
    // 부분 취소는 돈이 잡혔다가 일부 돌아간 상태다. 단건 디지털 상품에 이 상태가
    // 나왔다면 정상 결제가 아니므로 행을 내린다 — 그대로 두면 아무도 확정하지 않아
    // 행이 영원히 pending 으로 남는다.
    case "PARTIAL_CANCELED":
      return "dead";
    // 아직 결제가 아니지만 죽지도 않았다. 행을 건드리지 않고 물러난다 —
    // 웹훅이 뒤이어 도착하면 그때 확정된다.
    case "READY":
    case "IN_PROGRESS":
    case "WAITING_FOR_DEPOSIT":
      return "waiting";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

/**
 * 결제 확정. 착지 페이지와 웹훅이 공유하는 유일한 경로다.
 *
 * 소유 확인을 하지 않는 이유: 웹훅에는 세션이 없다. 호출자(착지 페이지)가
 * 먼저 주문의 userId 를 세션과 대조하고 나서 이 함수를 부른다.
 *
 * 금액 대조의 기준은 토스가 아니라 order.amount 다 — 주문 생성 시점에 서버가
 * 박아 둔 값이라 브라우저가 손댈 수 없다.
 */
export async function confirmPayment(
  paymentId: string,
  d: ConfirmDeps,
): Promise<ConfirmResult> {
  const order = await d.findOrder(paymentId);
  if (order === null) return { ok: false, kind: "not_found" };

  // 이미 확정된 주문에 토스를 다시 부르지 않는다 — 웹훅과 착지 페이지가 겹칠 때
  // 같은 결제 건을 두 번 건드릴 이유가 없다. 승인 API 는 두 번째 호출이
  // ALREADY_PROCESSED_PAYMENT 로 떨어지므로, 이 조기 반환이 그 예외를 막는 벽이기도 하다.
  if (order.status === "paid") return { ok: true, kind: "already" };

  // 여기서 던지는 예외는 삼키지 않는다. 일시 장애를 "미결제"로 접으면 돈은 받고
  // 리포트는 안 열린 채 조용히 끝난다 — 호출자가 5xx 로 올려 재시도를 유도해야 한다.
  const payment = await d.resolvePayment(paymentId);

  const statusClass = classify(payment.status);
  if (statusClass === "dead") {
    await d.markFailed(paymentId);
    return { ok: false, kind: "not_paid" };
  }
  if (statusClass === "waiting") return { ok: false, kind: "not_paid" };

  if (payment.currency !== "KRW") {
    await d.markFailed(paymentId);
    return { ok: false, kind: "currency_mismatch" };
  }

  // 돈은 받았는데 금액이 다른 상태다. 자동 취소는 하지 않는다 — 취소 API 연동은
  // 이 작업 범위 밖이라 백로그에 있다. 행을 내리고 로그로 남긴다.
  if (payment.totalAmount !== order.amount) {
    console.error(
      `[confirmPayment] 금액 불일치 paymentId=${paymentId} 주문=${order.amount} 결제=${payment.totalAmount}`,
    );
    await d.markFailed(paymentId);
    return { ok: false, kind: "amount_mismatch" };
  }

  const flipped = await d.markPaid({
    paymentId,
    transactionId: payment.lastTransactionKey ?? null,
  });
  if (flipped) return { ok: true, kind: "confirmed" };

  // false 는 "pending 이 아니었다"만 뜻한다 — paid 일 수도, refunded/failed 일 수도 있다.
  // 다시 읽어 확인한다: 다른 경로가 먼저 확정했으면 already 지만, 환불되거나 실패로
  // 내려간 행을 already 로 돌려주면 결제되지 않은 주문이 이용권을 지급받는다.
  const after = await d.findOrder(paymentId);
  if (after?.status === "paid") return { ok: true, kind: "already" };
  return { ok: false, kind: "not_paid" };
}
