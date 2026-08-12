import type { PaymentRequestKind } from "./config";

/**
 * 주문 생성 API 응답 타입은 여기서 소유한다 — API 라우트(`_lib/handler.ts`)와
 * 결제 화면(`checkout/_hooks/use-payment.ts`)이 같은 모양을 봐야 하는데,
 * 어느 한쪽의 폴더에 두면 다른 쪽이 그 폴더 내부(`_lib`)를 들여다보게 된다.
 *
 * 브라우저가 requestPayment 에 그대로 펼쳐 넣는 값들.
 */
interface OrderBase {
  paymentId: string;
  storeId: string;
  channelKey: string;
  orderName: string;
  totalAmount: number;
  /** 포트원 요청용 통화 코드. 조회 응답의 "KRW" 와 문자열이 다르다. */
  currency: "CURRENCY_KRW";
  redirectUrl: string;
}

/**
 * 결제수단 부분은 config 의 PaymentRequestKind 를 그대로 쓴다 — 서버가 고른 조합과
 * 브라우저가 보내는 조합이 같은 타입이라 둘이 어긋날 수 없다.
 */
export type OrderResponse = OrderBase & PaymentRequestKind;
