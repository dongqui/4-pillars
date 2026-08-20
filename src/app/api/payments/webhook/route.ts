import { NextResponse } from "next/server";
import { confirmPayment } from "@/lib/payments/confirm";
import { lookupDeps } from "@/lib/payments/deps";
import { handleWebhook } from "./_lib/handler";

export async function POST(request: Request): Promise<NextResponse> {
  // 서명 검증이 없어서 원문이 필요 없다 — 파싱해도 잃을 것이 없다.
  // 그래도 text() 로 받는 이유는 본문이 JSON 이 아닐 때를 핸들러가 400 으로
  // 판단하게 하기 위해서다. request.json() 은 그 전에 던져 버린다.
  const rawBody = await request.text();

  const result = await handleWebhook(rawBody, {
    confirm: (orderId) => confirmPayment(orderId, lookupDeps),
  });

  return NextResponse.json(result.body, { status: result.status });
}
