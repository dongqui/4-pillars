import { NextResponse, after } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { getApiSecret } from "@/lib/payments/config";
import { cancelPayment } from "@/lib/payments/portone";
import { executeRefund, findRefundCandidate, markRefundFailed } from "@/lib/payments/refund-store";
import { createSupportMailer } from "@/lib/support/mailer";
import { checkSupportLimit } from "@/lib/support/rate-limit";
import { insertSupportTicket } from "@/lib/support/store";
import { handleRefund } from "./_lib/handler";

/**
 * 이용권 부분 환불. 지원 모달의 "환불 요청" 이 여기로 온다 — 접수가 아니라 실행이다.
 * 포트원 시크릿이 없으면 핸들러가 DB 를 건드리기 전에 503 으로 막는다 — 결제창을 열 수 없는 환경과 같은 판단.
 */
export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleRefund(raw, {
      userId: session?.userId ?? null,
      now: new Date(),
      configured: () => getApiSecret() !== null,
      checkLimit: checkSupportLimit,
      getUser,
      findCandidate: findRefundCandidate,
      execute: executeRefund,
      cancel: (paymentId, o) => cancelPayment(paymentId, o),
      markFailed: markRefundFailed,
      insertTicket: insertSupportTicket,
      mailer: createSupportMailer(),
      defer: after,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/refunds]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
