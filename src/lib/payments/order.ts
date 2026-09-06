import type { PaymentRequestKind } from "./config";

/**
 * 주문 생성 API 응답 타입은 여기서 소유한다 — API 라우트(`_lib/handler.ts`)와
 * 결제 화면(`checkout/_hooks/use-payment.ts`)이 같은 모양을 봐야 하는데,
 * 어느 한쪽의 폴더에 두면 다른 쪽이 그 폴더 내부(`_lib`)를 들여다보게 된다.
 *
 * 브라우저가 포트원 requestPayment 에 그대로 펼쳐 넣는 값들.
 */
export interface OrderBase {
  /** 결제창을 여는 값들. 서버가 실어 보낸다 — config.ts 주석 참조. */
  storeId: string;
  channelKey: string;
  /** 우리가 발급한 주문 ID. purchases.payment_id 와 같은 값이고 포트원의 paymentId 다. */
  paymentId: string;
  orderName: string;
  totalAmount: number;
  /** 포트원 요청용 통화 코드. 조회 응답의 "KRW" 와 문자열이 다르다. */
  currency: "CURRENCY_KRW";
  /** 모바일에서 결제창이 돌아올 자리. 포트원이 paymentId·code·message 를 쿼리로 붙인다. */
  redirectUrl: string;
  /**
   * 결제창에 찍히는 구매자. 휴대폰은 없다 — 소셜 로그인이 주지 않아 받아 낼 자리가
   * 없고, KCP 문서상 선택 항목이다. 이메일은 영수증과 결제 문의 대응에 필요하다.
   */
  customer: { fullName: string; email: string };
}

/**
 * 결제수단 부분은 config 의 PaymentRequestKind 를 그대로 쓴다 — 서버가 고른 조합과
 * 브라우저가 보내는 조합이 같은 타입이라 둘이 어긋날 수 없다.
 */
export type OrderResponse = OrderBase & PaymentRequestKind;

/**
 * 결제 후 돌아갈 자리를 담는 쿠키. 주문 생성이 심고, 착지 라우트가 읽고 지운다.
 *
 * redirectUrl 쿼리가 아니라 쿠키인 이유: 토스 시절 successUrl 에 쿼리를 실을 수 없어
 * 생겼고, 포트원으로 돌아오면서도 그대로 둔다 — 이미 있고 테스트돼 있으며, 착지
 * 라우트가 주소창의 next 를 다시 검사할 일이 없어진다.
 * sameSite=lax 로 충분하다 — 결제창에서 돌아오는 것은 top-level GET 이동이다.
 */
export const CHECKOUT_NEXT_COOKIE = "checkout_next";

/** 결제창에 머무는 시간까지만 살면 된다. 지나면 착지 라우트가 /home 으로 접는다. */
export const CHECKOUT_NEXT_MAX_AGE = 60 * 30; // 30분
