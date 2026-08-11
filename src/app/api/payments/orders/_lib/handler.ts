import { z } from "zod";
import {
  PAYMENT_METHOD_IDS,
  type PaymentChannel,
  type PaymentMethodId,
  type PortOnePayMethod,
} from "@/lib/payments/config";
import { FULL_REPORT_ORDER_NAME, FULL_REPORT_PRICE } from "@/lib/payments/pricing";
import { parseProfileParam } from "@/lib/profiles/param";

// 금액을 받는 필드가 없는 것이 이 스키마의 요점이다 — 청구 금액은 서버 상수에서만 온다.
// method 는 config 의 배열을 그대로 받는다: 수단이 늘면 스키마도 같이 넓어진다.
const createOrderSchema = z.object({
  profileId: z.string(),
  method: z.enum(PAYMENT_METHOD_IDS),
});

/** 브라우저가 requestPayment 에 그대로 펼쳐 넣는 값들. */
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

export interface CreateOrderDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  getProfile(userId: string, id: string): Promise<{ id: string; isPaid: boolean } | null>;
  getStoreId(): string | null;
  getChannel(id: PaymentMethodId): PaymentChannel | null;
  getAppOrigin(): string | null;
  newPaymentId(): string;
  createPending(i: {
    userId: string;
    profileId: string;
    paymentId: string;
    amount: number;
  }): Promise<void>;
}

export interface CreateOrderResult {
  status: number;
  body: OrderResponse | { error: string };
}

export async function handleCreateOrder(
  raw: unknown,
  d: CreateOrderDeps,
): Promise<CreateOrderResult> {
  const parsed = createOrderSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "요청을 확인해 주세요" } };

  // ?profile 과 같은 형식 검사를 재사용한다 — 검증 없이 넘기면 ::bigint 캐스팅이
  // DB 에러로 터져 400 이어야 할 것이 500 이 된다.
  const param = parseProfileParam({ profile: parsed.data.profileId });
  if (param.kind !== "id") return { status: 400, body: { error: "요청을 확인해 주세요" } };

  if (d.userId === null) return { status: 401, body: { error: "로그인이 필요합니다" } };

  const profile = await d.getProfile(d.userId, param.id);
  // 없는 프로필과 남의 프로필을 구분하지 않는다 — 구분하면 id 로 존재 여부를 훑을 수 있다.
  if (profile === null) return { status: 404, body: { error: "프로필을 찾을 수 없습니다" } };
  if (profile.isPaid) return { status: 409, body: { error: "이미 결제한 리포트입니다" } };

  const storeId = d.getStoreId();
  const channel = d.getChannel(parsed.data.method);
  const origin = d.getAppOrigin();
  // 셋 중 하나라도 없으면 결제창을 열 수 없다. 장애가 아니라 미설정이라 503 이다.
  if (!storeId || !channel || !origin) {
    return { status: 503, body: { error: "결제를 준비 중입니다" } };
  }

  const paymentId = d.newPaymentId();
  // 행을 먼저 만들고 결제창을 연다 — 순서가 반대면 결제는 됐는데 대조할 주문이 없다.
  await d.createPending({
    userId: d.userId,
    profileId: profile.id,
    paymentId,
    amount: FULL_REPORT_PRICE.total,
  });

  return {
    status: 200,
    body: {
      paymentId,
      storeId,
      channelKey: channel.channelKey,
      payMethod: channel.payMethod,
      orderName: FULL_REPORT_ORDER_NAME,
      totalAmount: FULL_REPORT_PRICE.total,
      currency: "CURRENCY_KRW",
      // 모바일은 결제창이 페이지를 떠난다. 돌아올 자리를 여기서 정한다.
      redirectUrl: `${origin}/checkout/complete?profile=${profile.id}`,
    },
  };
}
