import { z } from "zod";
import {
  PAYMENT_METHOD_IDS,
  type PaymentMethodId,
  type PaymentRequestKind,
} from "@/lib/payments/config";
import {
  TICKET_PACKAGE_IDS,
  creditedTickets,
  getPackage,
  packageOrderName,
} from "@/lib/payments/pricing";
import type { OrderResponse } from "@/lib/payments/order";
import { resolveDisplayName } from "@/lib/auth/display-name";
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
  getClientKey(): string | null;
  getMethod(id: PaymentMethodId): PaymentRequestKind | null;
  getAppOrigin(): string | null;
  newPaymentId(): string;
  /** 결제창에 넘길 구매자. 행이 없거나 필드가 비어 있을 수 있다. */
  getBuyer(userId: string): Promise<{ displayName: string | null; email: string | null } | null>;
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
  /**
   * 결제 후 돌아갈 자리. 200 일 때만 실린다.
   *
   * 응답 본문이 아니라 따로 내보내는 이유: 라우트가 이 값을 쿠키로 심는다.
   * successUrl 에 `?next=` 로 실으면 토스가 거기에 자기 쿼리를 덧붙이는데,
   * 이어 붙이는 방식에 우리가 기댈 수 없다 — 소셜 로그인이 oauth_next 쿠키를
   * 쓰는 것과 같은 이유이고, 같은 방식으로 푼다.
   */
  next?: string;
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
  const clientKey = d.getClientKey();
  const method = d.getMethod(parsed.data.method);
  const origin = d.getAppOrigin();
  // 셋 중 하나라도 없으면 결제창을 열 수 없다. 장애가 아니라 미설정이라 503 이다.
  if (!clientKey || !method || !origin) {
    return { status: 503, body: { error: "결제를 준비 중입니다" } };
  }

  const buyer = await d.getBuyer(d.userId);

  // 이메일에는 대체값이 없다. 이름과 달리 아무 값이나 채우면 영수증이 아무 데도
  // 가지 않는다. 로그인이 이메일을 요구하게 됐으니(MissingEmailError) 비어 있는 것은
  // 그 규칙 이전에 가입한 행뿐이다 — 다시 로그인하면 채워진다.
  const email = buyer?.email?.trim();
  if (!email) {
    return { status: 409, body: { error: "이메일 정보가 없습니다. 다시 로그인해 주세요" } };
  }

  // 이름은 헤더에 쓰는 표시 이름을 그대로 쓴다 — 별도로 입력받지 않는다.
  // resolveDisplayName 을 거치는 이유: 빈 이름을 결제창에 넘기지 않기 위해서다.
  const customerName = resolveDisplayName({ displayName: buyer?.displayName ?? null });

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
  // 성공도 실패도 같은 자리로 돌아온다. 토스가 붙여 보내는 쿼리(성공은 paymentKey,
  // 실패는 code)로 갈라지므로, 착지 페이지 하나가 둘을 다 받는다.
  const landing = `${origin}/checkout/complete`;

  return {
    status: 200,
    next,
    body: {
      clientKey,
      orderId: paymentId,
      // 결제창 여는 방법을 한 덩이로 넘긴다 — 따로 옮기면 flowMode 와
      // easyPay 가 어긋난 조합을 만들 수 있다.
      ...method,
      orderName: packageOrderName(pkg),
      amount: { currency: "KRW", value: pkg.amount },
      successUrl: landing,
      failUrl: landing,
      customerName,
      customerEmail: email,
    },
  };
}
