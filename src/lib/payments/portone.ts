import { z } from "zod";
import type { Payment } from "@portone/server-sdk/payment";
import type { Unrecognized } from "@portone/server-sdk";
import { getApiSecret } from "./config";

export const PORTONE_API_BASE = "https://api.portone.io";

/**
 * 결제 조회 응답 중 우리가 쓰는 부분만. 전부 받지 않는 이유: 포트원이 필드를
 * 늘려도 흔들리지 않고, 우리가 무엇에 기대고 있는지가 이 스키마에 다 적힌다.
 */
export const paymentSchema = z.object({
  id: z.string(),
  status: z.enum([
    "READY",
    "PAY_PENDING",
    "VIRTUAL_ACCOUNT_ISSUED",
    "PAID",
    "PARTIAL_CANCELLED",
    "CANCELLED",
    "FAILED",
  ]),
  amount: z.object({ total: z.number(), paid: z.number().optional() }),
  currency: z.string(),
  /** PG 거래 ID. 우리 purchases.provider_txn_id 에 남겨 두면 포트원 콘솔에서 되짚을 수 있다. */
  transactionId: z.string().nullish(),
});

export type PortOnePayment = z.infer<typeof paymentSchema>;

// 포트원이 status 를 바꾸거나 우리가 이름을 잘못 적으면 여기서 typecheck 가 깨진다.
// zod enum 은 닫혀 있어서, 이름이 하나라도 어긋나면 실제 응답이 파싱에서 던진다 —
// 런타임 500 보다 컴파일 오류가 낫다. 2026-09-06 에 PENDING/PARTIALLY_CANCELLED 로
// 잘못 적었던 것을 이 검사가 잡도록 한다.
//
// SDK 의 Payment 유니온에는 알려진 7개 상태 말고도 `{ status: Unrecognized }` 분기가
// 하나 더 있다 — SDK 자신도 모르는 미래 상태를 위해 열어 둔 자리표시자다(unique symbol
// 이라 실제 문자열과 절대 겹치지 않는다). 우리 7개 값과 그대로 맞대면 이 분기 때문에
// 항상 어긋나므로, Exclude 로 그 자리표시자를 뺀 "이름이 있는 상태"만 비교한다.
type SdkKnownStatus = Exclude<Payment["status"], Unrecognized>;
type OurStatus = PortOnePayment["status"];
type AssertSame<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _statusesMatchSdk: AssertSame<OurStatus, SdkKnownStatus> = true;
void _statusesMatchSdk;

export class PortOneError extends Error {
  readonly type: string | undefined;
  constructor(message: string, type?: string) {
    super(message);
    this.name = "PortOneError";
    this.type = type;
  }
}

/** 키가 없는 상태. 호출자는 이걸 503 으로 옮긴다 (장애가 아니라 미설정이다). */
export class PortOneNotConfiguredError extends Error {
  constructor() {
    super("PORTONE_API_SECRET 이 설정되지 않았습니다");
    this.name = "PortOneNotConfiguredError";
  }
}

/**
 * GET /payments/{paymentId} — 결제 조회. 상태를 바꾸지 않는다.
 *
 * 승인 API 가 없는 이유: 포트원 v2 결제창은 승인까지 끝내고 돌아온다.
 * 우리는 "정말 PAID 인지, 금액이 맞는지"만 여기서 확인한다.
 *
 * fetchImpl·env 를 주입받는 이유: 테스트가 네트워크와 process.env 를 건드리지 않는다.
 */
export async function getPayment(
  paymentId: string,
  opts: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {},
): Promise<PortOnePayment> {
  const secret = getApiSecret(opts.env);
  if (!secret) throw new PortOneNotConfiguredError();

  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    // Bearer 가 아니라 `PortOne <secret>` 이다. 포트원 v2 의 고유 형식.
    headers: { Authorization: `PortOne ${secret}` },
  });

  // 에러 응답도 본문이 JSON 이 아닐 수 있다(게이트웨이 오류 등). 파싱 실패를 삼킨다.
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const e = body as { type?: string; message?: string } | null;
    throw new PortOneError(e?.message ?? `포트원 결제 조회 실패 (HTTP ${res.status})`, e?.type);
  }
  return paymentSchema.parse(body);
}

/** 포트원이 이미 취소된 결제에 돌려주는 type. 우리에겐 성공이다 — 재시도 때 두 번 취소되지 않는다. */
const ALREADY_CANCELLED = "PAYMENT_ALREADY_CANCELLED";

/**
 * POST /payments/{paymentId}/cancel — 결제 취소(환불).
 *
 * amount 를 생략하면 포트원은 전액 취소로 본다. 부분 환불만 amount 를 싣는다.
 * 호출 전에 우리 DB 는 이미 refunded 다(executeRefund). 여기서 실패하면 호출자가
 * refund_failed_at 을 찍고 운영자에게 알린다 — 되돌리지 않는다(설계 문서 "실행" 절).
 */
export async function cancelPayment(
  paymentId: string,
  o: { reason: string; amount?: number },
  opts: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {},
): Promise<void> {
  const secret = getApiSecret(opts.env);
  if (!secret) throw new PortOneNotConfiguredError();

  const body: { reason: string; amount?: number } = { reason: o.reason };
  if (o.amount !== undefined) body.amount = o.amount;

  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: "POST",
    headers: { Authorization: `PortOne ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    // 응답이 안 오면 15초에 끊는다 — 여기서 영영 걸리면 DB 는 refunded 인데 실패 기록도 메일도 없는
    // 유일한 무음 경로가 된다. 끊기면 호출자가 pending 으로 처리하고, 실제로는 취소됐다면
    // 운영자가 콘솔에서 보고 아무것도 안 하면 된다.
    signal: AbortSignal.timeout(15_000),
  });

  const data: unknown = await res.json().catch(() => null);
  if (res.ok) return;

  const e = data as { type?: string; message?: string } | null;
  if (e?.type === ALREADY_CANCELLED) return;
  throw new PortOneError(e?.message ?? `포트원 결제 취소 실패 (HTTP ${res.status})`, e?.type);
}
