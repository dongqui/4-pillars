import { NextResponse } from "next/server";
import * as PortOne from "@portone/server-sdk";
import { confirmPayment } from "@/lib/payments/confirm";
import { getWebhookSecret } from "@/lib/payments/config";
import { confirmDeps } from "@/lib/payments/deps";
import { handleWebhook } from "./_lib/handler";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = getWebhookSecret();
  // 시크릿 없이 200 을 주면 검증 없이 받아들이는 것과 같다. 아예 닫는다.
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  // ⚠️ json() 이 아니라 text() 다. 서명은 원문 문자열에 걸려 있다.
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers);

  const result = await handleWebhook(rawBody, headers, {
    verify: async (body, hs) => {
      await PortOne.Webhook.verify(secret, body, hs);
    },
    confirm: (paymentId) => confirmPayment(paymentId, confirmDeps),
  });

  return NextResponse.json(result.body, { status: result.status });
}
