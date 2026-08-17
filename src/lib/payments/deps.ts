import type { ConfirmDeps } from "./confirm";
import { getPayment } from "./portone";
import { findOrderByPaymentId, markPurchaseFailed } from "./store";
import { confirmPurchaseAndCredit } from "@/lib/tickets/wallet";

/**
 * 프로덕션 확정 의존성. 완료 API·웹훅·모바일 착지 페이지 셋이 같은 조합을 쓴다.
 *
 * route.ts 가 아니라 여기 두는 이유: Next.js 는 route 파일이 HTTP 메서드와 정해진
 * 설정값 외의 것을 export 하면 빌드에서 거부한다. 세 곳이 공유하는 값은 lib 에 있어야 한다.
 *
 * payments 와 tickets 를 잇는 유일한 지점이기도 하다 — confirm.ts 는 이용권을
 * 모르고, wallet.ts 는 포트원을 모른다. 조립은 여기서만 한다.
 */
export const confirmDeps: ConfirmDeps = {
  findOrder: (paymentId) => findOrderByPaymentId(paymentId),
  lookupPayment: (paymentId) => getPayment(paymentId),
  markPaid: (a) => confirmPurchaseAndCredit(a),
  markFailed: (paymentId) => markPurchaseFailed(paymentId),
};
