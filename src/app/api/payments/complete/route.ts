import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { confirmPayment } from "@/lib/payments/confirm";
import { confirmDeps } from "@/lib/payments/deps";
import { PortOneNotConfiguredError } from "@/lib/payments/portone";
import { findOrderByPaymentId } from "@/lib/payments/store";
import { getBalance } from "@/lib/tickets/wallet";
import { handleComplete } from "./_lib/handler";

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleComplete(raw, {
      userId: session?.userId ?? null,
      findOrder: (paymentId) => findOrderByPaymentId(paymentId),
      confirm: (paymentId) => confirmPayment(paymentId, confirmDeps),
      getBalance: (userId) => getBalance(userId),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    // 키 미설정은 장애가 아니라 준비 안 됨이다. 500 으로 흘리면 원인이 로그에 묻힌다.
    if (e instanceof PortOneNotConfiguredError) {
      return NextResponse.json({ error: "결제를 준비 중입니다" }, { status: 503 });
    }
    console.error("[POST /api/payments/complete]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
