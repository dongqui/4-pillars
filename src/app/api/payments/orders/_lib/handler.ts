import { z } from "zod";
import { PAYMENT_METHOD_IDS, type PaymentChannel, type PaymentMethodId } from "@/lib/payments/config";
import {
  TICKET_PACKAGE_IDS,
  creditedTickets,
  getPackage,
  packageOrderName,
} from "@/lib/payments/pricing";
import type { OrderResponse } from "@/lib/payments/order";
import { safeNextPath } from "@/lib/nav/next-param";

// 타입은 src/lib/payments/order.ts 가 소유한다 — 여기서는 재수출만 해서
// 기존 import 경로(`_lib/handler`)를 깨지 않는다.
export type { OrderResponse };

// 금액과 장수를 받는 필드가 없는 것이 이 스키마의 요점이다 — 둘 다 서버 가격표에서만 온다.
// packageId·method 는 각자의 상수 배열을 그대로 받는다: 목록이 늘면 스키마도 같이 넓어진다.
// next 는 문자열로 받되 값은 믿지 않는다 (safeNextPath).
const createOrderSchema = z.object({
  packageId: z.enum(TICKET_PACKAGE_IDS),
  method: z.enum(PAYMENT_METHOD_IDS),
  next: z.string().optional(),
});

export interface CreateOrderDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  getStoreId(): string | null;
  getChannel(id: PaymentMethodId): PaymentChannel | null;
  getAppOrigin(): string | null;
  newPaymentId(): string;
  createPending(i: {
    userId: string;
    paymentId: string;
    product: string;
    amount: number;
    tickets: number;
  }): Promise<void>;
}

export interface CreateOrderResult {
  status: number;
  body: OrderResponse | { error: string };
}

/**
 * 이용권 충전 주문 생성.
 *
 * 프로필 소유 확인과 중복 결제 가드가 없는 것은 누락이 아니다 — 충전에는 대상
 * 프로필이 없고, 같은 패키지를 몇 번이든 다시 사는 것이 정상이다.
 */
export async function handleCreateOrder(
  raw: unknown,
  d: CreateOrderDeps,
): Promise<CreateOrderResult> {
  const parsed = createOrderSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "요청을 확인해 주세요" } };

  if (d.userId === null) return { status: 401, body: { error: "로그인이 필요합니다" } };

  const pkg = getPackage(parsed.data.packageId);
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
    paymentId,
    product: pkg.id,
    amount: pkg.amount,
    tickets: creditedTickets(pkg),
  });

  const next = safeNextPath(parsed.data.next);

  return {
    status: 200,
    body: {
      paymentId,
      storeId,
      // 채널키와 판별자를 한 덩이로 넘긴다 — 따로 옮기면 payMethod 와
      // easyPayProvider 가 어긋난 조합을 만들 수 있다.
      ...channel,
      orderName: packageOrderName(pkg),
      totalAmount: pkg.amount,
      currency: "CURRENCY_KRW",
      // 모바일은 결제창이 페이지를 떠난다. 돌아올 자리를 여기서 정한다.
      // next 는 이미 safeNextPath 를 지났다 — 착지 페이지가 다시 검사하지만,
      // 검증된 값만 내보내는 편이 두 곳의 판단이 어긋날 여지를 줄인다.
      redirectUrl: `${origin}/checkout/complete?next=${encodeURIComponent(next)}`,
    },
  };
}
