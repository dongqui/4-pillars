import { z } from "zod";
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
    "PENDING",
    "VIRTUAL_ACCOUNT_ISSUED",
    "PAID",
    "PARTIALLY_CANCELLED",
    "CANCELLED",
    "FAILED",
  ]),
  amount: z.object({ total: z.number(), paid: z.number().optional() }),
  currency: z.string(),
  transactionId: z.string().nullish(),
});

export type PortOnePayment = z.infer<typeof paymentSchema>;

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
 * GET /payments/{paymentId}.
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
