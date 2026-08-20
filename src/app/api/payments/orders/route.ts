import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { getAppOrigin, getClientKey, getMethod } from "@/lib/payments/config";
import { newPaymentId } from "@/lib/payments/order-id";
import { CHECKOUT_NEXT_COOKIE, CHECKOUT_NEXT_MAX_AGE } from "@/lib/payments/order";
import { createPendingPurchase } from "@/lib/payments/store";
import { handleCreateOrder } from "./_lib/handler";

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleCreateOrder(raw, {
      userId: session?.userId ?? null,
      getClientKey: () => getClientKey(),
      getMethod: (id) => getMethod(id),
      getAppOrigin: () => getAppOrigin(),
      newPaymentId,
      getBuyer: (userId) => getUser(userId),
      createPending: (i) => createPendingPurchase(i),
    });

    const res = NextResponse.json(result.body, { status: result.status });
    // 복귀 경로는 응답이 아니라 쿠키로 나간다 — 토스 successUrl 에 우리 쿼리를
    // 실을 수 없어서다(handler.ts 의 CreateOrderResult.next 주석 참조).
    if (result.next !== undefined) {
      res.cookies.set(CHECKOUT_NEXT_COOKIE, result.next, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: CHECKOUT_NEXT_MAX_AGE,
      });
    }
    return res;
  } catch (e) {
    console.error("[POST /api/payments/orders]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
