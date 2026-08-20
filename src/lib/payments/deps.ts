import type { ConfirmDeps } from "./confirm";
import { approvePayment, getPaymentByOrderId } from "./toss";
import { findOrderByPaymentId, markPurchaseFailed } from "./store";
import { confirmPurchaseAndCredit } from "@/lib/tickets/wallet";

/**
 * 프로덕션 확정 의존성. 착지 페이지와 웹훅이 나머지를 전부 공유하고
 * resolvePayment 하나만 다르게 끼운다.
 *
 * route.ts 가 아니라 여기 두는 이유: Next.js 는 route 파일이 HTTP 메서드와 정해진
 * 설정값 외의 것을 export 하면 빌드에서 거부한다. 두 곳이 공유하는 값은 lib 에 있어야 한다.
 *
 * payments 와 tickets 를 잇는 유일한 지점이기도 하다 — confirm.ts 는 이용권을
 * 모르고, wallet.ts 는 토스를 모른다. 조립은 여기서만 한다.
 */
const shared = {
  findOrder: (paymentId: string) => findOrderByPaymentId(paymentId),
  markPaid: (a: { paymentId: string; transactionId: string | null }) =>
    confirmPurchaseAndCredit(a),
  markFailed: (paymentId: string) => markPurchaseFailed(paymentId),
};

/**
 * 착지 페이지용. resolvePayment 가 승인 API 라 **돈이 잡힌다**.
 *
 * paymentKey 를 인자로 받는 이유: 결제창이 돌아올 때에야 생기는 값이라
 * 모듈 수준 상수로 둘 수 없다. amount 도 같이 보내 토스가 인증 시점 금액과
 * 대조하게 한다 — confirm.ts 의 대조와 두 겹이 된다.
 */
export function approveDeps(a: { paymentKey: string; amount: number }): ConfirmDeps {
  return {
    ...shared,
    resolvePayment: (orderId) =>
      approvePayment({ paymentKey: a.paymentKey, orderId, amount: a.amount }),
  };
}

/**
 * 웹훅용. resolvePayment 가 조회 API 라 상태를 바꾸지 않는다.
 *
 * 웹훅이 승인을 부르지 않는 이유: 토스 웹훅에는 서명이 없어서 본문만으로는
 * 진위를 알 수 없다. 본문을 믿고 승인하면 남이 보낸 POST 한 방으로 결제가
 * 성립한다 — 본문은 "가서 확인해 보라"는 신호로만 쓰고, 판단은 조회 결과로 한다.
 */
export const lookupDeps: ConfirmDeps = {
  ...shared,
  resolvePayment: (orderId) => getPaymentByOrderId(orderId),
};
