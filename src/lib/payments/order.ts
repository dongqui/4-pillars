import type { PortOnePayMethod } from "./config";

/**
 * 주문 생성 API 응답 타입은 여기서 소유한다 — API 라우트(`_lib/handler.ts`)와
 * 결제 화면(`checkout/_hooks/use-payment.ts`)이 같은 모양을 봐야 하는데,
 * 어느 한쪽의 폴더에 두면 다른 쪽이 그 폴더 내부(`_lib`)를 들여다보게 된다.
 *
 * 브라우저가 requestPayment 에 그대로 펼쳐 넣는 값들.
 */
export interface OrderResponse {
  paymentId: string;
  storeId: string;
  channelKey: string;
  payMethod: PortOnePayMethod;
  orderName: string;
  totalAmount: number;
  /** 포트원 요청용 통화 코드. 조회 응답의 "KRW" 와 문자열이 다르다. */
  currency: "CURRENCY_KRW";
  redirectUrl: string;
}
