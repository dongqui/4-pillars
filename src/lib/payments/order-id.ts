/** 토스 콘솔과 로그에서 우리 주문임을 한눈에 알아보게 붙인다. */
export const PAYMENT_ID_PREFIX = "saju-";

/**
 * 고객사 발급 주문 ID. 예: saju-3f0c1a9e-….
 * 클라이언트가 만들지 않는다 — 주문 ID 와 청구 금액이 한 곳(주문 생성 API)에서
 * 같이 정해져야 확정 시 대조할 기준이 생긴다.
 */
export function newPaymentId(): string {
  return `${PAYMENT_ID_PREFIX}${crypto.randomUUID()}`;
}
