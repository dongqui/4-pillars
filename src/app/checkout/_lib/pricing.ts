// 상수는 src/lib/payments/pricing.ts 가 소유한다 — 주문 생성 API 가 같은 값으로
// 청구 금액을 박아야 하는데, src/lib 이 이 폴더를 import 할 수는 없다.
// 포맷 함수는 화면 관심사라 여기 남는다.
export { creditedTickets, listPackages, type TicketPackage, type TicketPackageId } from "@/lib/payments/pricing";

/**
 * 1234567 → "₩1,234,567".
 * Intl 대신 직접 끊는 이유: toLocaleString 은 런타임 ICU 유무에 따라 구분자가
 * 달라져 서버와 브라우저가 다른 문자열을 낸다(하이드레이션 불일치).
 */
export function formatKrw(won: number): string {
  return `₩${Math.round(won).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/** 장당 단가 한 줄. "장당 ₩769" — 소수점을 버려 두 패키지가 같은 값으로 보이지 않게 반올림한다. */
export function formatPerTicket(amount: number, tickets: number): string {
  return `장당 ${formatKrw(Math.round(amount / tickets))}`;
}
