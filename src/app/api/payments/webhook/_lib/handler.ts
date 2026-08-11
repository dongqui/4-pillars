import { z } from "zod";
import type { ConfirmResult } from "@/lib/payments/confirm";

/**
 * 포트원 웹훅 본문 중 우리가 쓰는 부분. type 은 여러 가지가 오지만
 * Transaction.Paid 만 확정으로 이어진다.
 */
const webhookSchema = z.object({
  type: z.string(),
  data: z.object({ paymentId: z.string().min(1) }),
});

export interface WebhookDeps {
  /** 검증 실패 시 던진다. 서명 계산은 포트원 SDK 에 맡긴다. */
  verify(rawBody: string, headers: Record<string, string>): Promise<void>;
  confirm(paymentId: string): Promise<ConfirmResult>;
}

export interface WebhookResult {
  status: number;
  body: { ok: boolean; reason?: string };
}

const PAID_EVENT = "Transaction.Paid";

/**
 * 포트원발 결제 확정.
 *
 * 상태코드가 곧 재시도 지시다:
 *  - 200: 더 볼 것 없음 (확정됐거나, 재시도해도 결과가 같음)
 *  - 400: 우리가 받아들일 수 없는 요청 (서명 실패·모양 불일치)
 *  - 500: 일시 장애. 포트원이 다시 보내주기를 바란다
 *
 * rawBody 를 문자열로 받는 이유: 서명은 파싱된 JSON 이 아니라 원문에 걸려 있다.
 * 라우트에서 request.json() 을 먼저 부르면 검증이 반드시 실패한다.
 */
export async function handleWebhook(
  rawBody: string,
  headers: Record<string, string>,
  d: WebhookDeps,
): Promise<WebhookResult> {
  // 파싱보다 먼저 검증한다 — 위조된 본문을 해석할 이유가 없다.
  try {
    await d.verify(rawBody, headers);
  } catch (e) {
    console.error("[webhook] 서명 검증 실패", e instanceof Error ? e.message : e);
    return { status: 400, body: { ok: false, reason: "invalid_signature" } };
  }

  let parsed;
  try {
    parsed = webhookSchema.safeParse(JSON.parse(rawBody));
  } catch {
    return { status: 400, body: { ok: false, reason: "invalid_body" } };
  }
  if (!parsed.success) return { status: 400, body: { ok: false, reason: "invalid_body" } };

  // 결제 완료 외의 이벤트도 같은 URL 로 온다. 조용히 200 으로 받는다.
  if (parsed.data.type !== PAID_EVENT) return { status: 200, body: { ok: true } };

  const paymentId = parsed.data.data.paymentId;
  try {
    const result = await d.confirm(paymentId);
    if (result.ok) return { status: 200, body: { ok: true } };
    // 재시도해도 결과가 같은 사유들이다. 200 으로 닫아 재시도 폭주를 막고 로그로 남긴다.
    console.error(`[webhook] 확정 실패 paymentId=${paymentId} kind=${result.kind}`);
    return { status: 200, body: { ok: false, reason: result.kind } };
  } catch (e) {
    // 조회 장애·DB 장애. 다시 보내달라는 뜻으로 5xx 를 준다.
    console.error("[webhook] 확정 중 예외", e);
    return { status: 500, body: { ok: false, reason: "confirm_error" } };
  }
}
