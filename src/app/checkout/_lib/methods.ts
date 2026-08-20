// 타입은 src/lib/payments/config.ts 가 소유한다 — 서버(채널 매핑)와 화면이 같은
// 집합을 봐야 하고, src/lib 이 이 폴더를 import 할 수는 없다.
import type { PaymentMethodId } from "@/lib/payments/config";
export type { PaymentMethodId };

export interface PaymentMethod {
  id: PaymentMethodId;
  name: string;
  desc: string;
  /** 로고 칩에 들어가는 글자 */
  logo: string;
  /** 로고 칩 배경·글자색. 브랜드 색이라 팔레트 토큰을 쓰지 않는다. */
  logoClass: string;
  badge?: string;
}

/**
 * 순서가 곧 화면 순서다. 각 항목은 config.ts 의 PaymentRequestKind 와 짝지어진다.
 */
export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "card",
    name: "신용 · 체크카드",
    desc: "국내 카드결제",
    logo: "카드",
    logoClass: "bg-slate-100 text-slate-500",
  },
  {
    id: "naver",
    name: "네이버페이",
    desc: "네이버 앱에서 간편 결제",
    logo: "N",
    logoClass: "bg-[#03C75A] text-white",
    badge: "포인트 적립",
  },
  {
    id: "kakao",
    name: "카카오페이",
    desc: "카카오톡에서 간편 결제",
    logo: "pay",
    logoClass: "bg-[#FEE500] text-[#181600]",
  },
  {
    id: "toss",
    name: "토스페이",
    desc: "토스 앱에서 간편 결제",
    logo: "toss",
    logoClass: "bg-[#0064FF] text-white",
  },
];
