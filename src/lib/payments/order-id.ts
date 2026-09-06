/** 포트원 콘솔과 로그에서 우리 주문임을 한눈에 알아보게 붙인다. */
export const PAYMENT_ID_PREFIX = "saju";

/**
 * 고객사 발급 주문 ID. 예: saju3f0c1a9e….
 * 클라이언트가 만들지 않는다 — 주문 ID 와 청구 금액이 한 곳(주문 생성 API)에서
 * 같이 정해져야 확정 시 대조할 기준이 생긴다.
 *
 * uuid 의 하이픈을 빼는 이유: NHN KCP 는 paymentId 에 영문·숫자만, 최대 40자를
 * 허용한다. `saju-` + uuid 는 41자에 하이픈이 네 개라 두 규칙을 다 어겼다.
 * 빼면 4 + 32 = 36자다. 옛 형식(saju-…)의 기존 행은 그대로 둔다 — 조회는 문자열
 * 일치라 형식이 섞여도 문제없다.
 */
export function newPaymentId(): string {
  return PAYMENT_ID_PREFIX + crypto.randomUUID().replaceAll("-", "");
}
