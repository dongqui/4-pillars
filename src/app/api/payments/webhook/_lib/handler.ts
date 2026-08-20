import { z } from "zod";
import type { ConfirmResult } from "@/lib/payments/confirm";

/**
 * 토스 웹훅 본문 중 우리가 쓰는 부분. eventType 은 여러 가지가 오지만
 * PAYMENT_STATUS_CHANGED 만 확정으로 이어진다.
 *
 * data 안의 status 를 스키마에 넣지 않은 것이 요점이다 — 읽지 않기 때문이다.
 * 아래 주석 참조: 본문의 상태는 판단 근거가 아니다.
 */
const webhookSchema = z.object({
  eventType: z.string(),
  data: z.object({ orderId: z.string().min(1) }),
});

export interface WebhookDeps {
  /** 조회 API 로 진위를 확인하고 확정까지 하는 경로(lookupDeps). */
  confirm(orderId: string): Promise<ConfirmResult>;
}

export interface WebhookResult {
  status: number;
  body: { ok: boolean; reason?: string };
}

const PAID_EVENT = "PAYMENT_STATUS_CHANGED";

/**
 * 토스발 결제 확정.
 *
 * ⚠️ 토스 웹훅에는 서명이 없다. 그래서 본문은 "이 주문을 다시 봐라"는 신호로만
 * 쓰고, 결제 여부는 조회 API 결과로만 판단한다(deps.ts 의 lookupDeps).
 * 본문의 status 를 믿으면 아무나 보낸 POST 한 방으로 이용권이 지급된다.
 *
 * 그 결과 이 엔드포인트는 아무나 두드릴 수 있지만, 두드려 봐야 우리가 토스에
 * 다시 물어볼 뿐이라 남의 주문을 확정시킬 수는 없다.
 *
 * 상태코드가 곧 재시도 지시다:
 *  - 200: 더 볼 것 없음 (확정됐거나, 재시도해도 결과가 같음)
 *  - 400: 우리가 받아들일 수 없는 요청 (모양 불일치)
 *  - 500: 일시 장애. 토스가 다시 보내주기를 바란다
 */
export async function handleWebhook(rawBody: string, d: WebhookDeps): Promise<WebhookResult> {
  let parsed;
  try {
    parsed = webhookSchema.safeParse(JSON.parse(rawBody));
  } catch {
    return { status: 400, body: { ok: false, reason: "invalid_body" } };
  }
  if (!parsed.success) return { status: 400, body: { ok: false, reason: "invalid_body" } };

  // 결제 상태 변경 외의 이벤트도 같은 URL 로 온다. 조용히 200 으로 받는다.
  if (parsed.data.eventType !== PAID_EVENT) return { status: 200, body: { ok: true } };

  const orderId = parsed.data.data.orderId;
  try {
    const result = await d.confirm(orderId);
    if (result.ok) return { status: 200, body: { ok: true } };
    // not_paid 는 가상계좌 발급·결제 대기 같은 정상 경로에서도 나온다(confirmPayment 의
    // waiting 갈래) — error 로 찍으면 평상시에도 로그가 쌓여 진짜 이상 신호인
    // amount_mismatch/currency_mismatch 가 묻힌다. 재시도해도 결과가 같다는 점은 같으므로
    // 200 으로 닫는 것은 공통이고, 로그 레벨만 가른다.
    //
    // not_found 도 여기로 온다 — 우리가 만든 적 없는 orderId 를 남이 밀어 넣은 경우다.
    if (result.kind === "not_paid" || result.kind === "not_found") {
      console.warn(`[webhook] 확정하지 않음 orderId=${orderId} kind=${result.kind}`);
    } else {
      console.error(`[webhook] 확정 실패 orderId=${orderId} kind=${result.kind}`);
    }
    return { status: 200, body: { ok: false, reason: result.kind } };
  } catch (e) {
    // 조회 장애·DB 장애. 다시 보내달라는 뜻으로 5xx 를 준다.
    console.error("[webhook] 확정 중 예외", e);
    return { status: 500, body: { ok: false, reason: "confirm_error" } };
  }
}
