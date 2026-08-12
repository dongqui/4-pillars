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
  /** 선택했을 때 목록 아래에 뜨는 안내문 — 결제창이 열린다는 사실을 미리 알린다. */
  note: string;
}

/**
 * 순서가 곧 화면 순서다. PG 를 붙일 때 각 항목이 PortOne 결제수단 코드와 짝지어진다.
 */
export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "card",
    name: "신용 · 체크카드",
    desc: "KG이니시스 국내 카드결제",
    logo: "카드",
    logoClass: "bg-slate-100 text-slate-500",
    note: "결제하기를 누르면 KG이니시스 카드결제 창이 열립니다. 카드 정보 입력과 인증을 마치면 이 화면으로 돌아옵니다.",
  },
  {
    id: "naver",
    name: "네이버페이",
    desc: "네이버 앱에서 간편 결제",
    logo: "N",
    logoClass: "bg-[#03C75A] text-white",
    badge: "포인트 적립",
    note: "결제하기를 누르면 네이버페이 창이 열립니다. 인증을 완료하면 이 화면으로 돌아옵니다.",
  },
  {
    id: "kakao",
    name: "카카오페이",
    desc: "카카오톡에서 간편 결제",
    logo: "pay",
    logoClass: "bg-[#FEE500] text-[#181600]",
    note: "결제하기를 누르면 카카오페이 QR·앱 인증 창이 열립니다. 인증을 완료하면 이 화면으로 돌아옵니다.",
  },
  {
    id: "toss",
    name: "토스페이",
    desc: "토스 앱에서 간편 결제",
    logo: "toss",
    logoClass: "bg-[#0064FF] text-white",
    note: "결제하기를 누르면 토스페이 창이 열립니다. 인증을 완료하면 이 화면으로 돌아옵니다.",
  },
];
