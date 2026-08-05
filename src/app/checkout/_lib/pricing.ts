/**
 * 전체 리포트 가격. 결제(PG)가 붙으면 서버가 이 값으로 주문 금액을 만들고,
 * 화면은 지금처럼 읽기만 한다 — 두 곳에 숫자를 적어 두면 반드시 어긋난다.
 *
 * total 을 list - discount 로 계산하지 않고 따로 적는 이유: 표시용 정가·할인과
 * 실제 청구 금액은 언제든 갈라질 수 있고(프로모션, 반올림), 청구 금액은
 * 파생값이 아니라 명시값이어야 한다.
 */
export const FULL_REPORT_PRICE = {
  /** 정가 */
  list: 19900,
  /** 첫 리포트 할인 */
  discount: 10000,
  /** 실제 청구 금액 */
  total: 9900,
} as const;

/**
 * 1234567 → "₩1,234,567".
 * Intl 대신 직접 끊는 이유: toLocaleString 은 런타임 ICU 유무에 따라 구분자가
 * 달라져 서버와 브라우저가 다른 문자열을 낸다(하이드레이션 불일치).
 */
export function formatKrw(won: number): string {
  return `₩${Math.round(won).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/** 할인 줄 표기. "−₩10,000" (U+2212, 하이픈이 아니다) */
export function formatKrwDiscount(won: number): string {
  return `−${formatKrw(won)}`;
}
