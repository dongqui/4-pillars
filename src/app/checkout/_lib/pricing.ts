// 상수는 src/lib/payments/pricing.ts 가 소유한다 — 주문 생성 API 가 같은 값으로
// 청구 금액을 박아야 하는데, src/lib 이 이 폴더를 import 할 수는 없다.
// 포맷 함수는 화면 관심사라 여기 남는다.
import { FULL_REPORT_PRICE } from "@/lib/payments/pricing";
export { FULL_REPORT_PRICE };

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
