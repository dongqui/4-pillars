import type { PaymentRequestKind } from "./config";

/**
 * 주문 생성 API 응답 타입은 여기서 소유한다 — API 라우트(`_lib/handler.ts`)와
 * 결제 화면(`checkout/_hooks/use-payment.ts`)이 같은 모양을 봐야 하는데,
 * 어느 한쪽의 폴더에 두면 다른 쪽이 그 폴더 내부(`_lib`)를 들여다보게 된다.
 *
 * 브라우저가 토스 requestPayment 에 그대로 펼쳐 넣는 값들.
 */
export interface OrderBase {
  /** 결제창을 여는 키. 서버가 실어 보낸다 — config.ts 주석 참조. */
  clientKey: string;
  /** 토스의 주문번호. 우리 purchases.payment_id 와 같은 값이다. */
  orderId: string;
  orderName: string;
  /**
   * 토스는 금액을 객체로 받는다. 요청과 조회가 같은 "KRW" 를 써서
   * 표기를 두 벌 들고 다닐 필요가 없다.
   */
  amount: { currency: "KRW"; value: number };
  /** 인증 성공 시 착지. 토스가 paymentKey·orderId·amount 를 쿼리로 붙여 보낸다. */
  successUrl: string;
  /** 인증 실패·취소 시 착지. 토스가 code·message 를 쿼리로 붙여 보낸다. */
  failUrl: string;
  /**
   * 결제창에 찍히는 구매자. 토스는 둘 다 선택 파라미터지만 우리는 채워 보낸다 —
   * 영수증과 결제 문의 대응에 필요하고, 없으면 나중에 사용자를 특정할 수 없다.
   */
  customerName: string;
  customerEmail: string;
}

/**
 * 결제수단 부분은 config 의 PaymentRequestKind 를 그대로 쓴다 — 서버가 고른 조합과
 * 브라우저가 보내는 조합이 같은 타입이라 둘이 어긋날 수 없다.
 */
export type OrderResponse = OrderBase & PaymentRequestKind;

/**
 * 결제 후 돌아갈 자리를 담는 쿠키. 주문 생성이 심고, 착지 페이지가 읽고 지운다.
 *
 * URL 이 아니라 쿠키인 이유는 CreateOrderResult.next 주석 참조.
 * sameSite=lax 로 충분하다 — 토스에서 돌아오는 것은 top-level GET 이동이다.
 */
export const CHECKOUT_NEXT_COOKIE = "checkout_next";

/** 결제창에 머무는 시간까지만 살면 된다. 지나면 착지 페이지가 /home 으로 접는다. */
export const CHECKOUT_NEXT_MAX_AGE = 60 * 30; // 30분
