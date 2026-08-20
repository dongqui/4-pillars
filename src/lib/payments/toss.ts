import { z } from "zod";
import { getSecretKey } from "./config";

export const TOSS_API_BASE = "https://api.tosspayments.com";

/**
 * 결제 객체 중 우리가 쓰는 부분만. 전부 받지 않는 이유: 토스가 필드를 늘려도
 * 흔들리지 않고, 우리가 무엇에 기대고 있는지가 이 스키마에 다 적힌다.
 */
export const paymentSchema = z.object({
  paymentKey: z.string(),
  orderId: z.string(),
  status: z.enum([
    "READY",
    "IN_PROGRESS",
    "WAITING_FOR_DEPOSIT",
    "DONE",
    "CANCELED",
    "PARTIAL_CANCELED",
    "ABORTED",
    "EXPIRED",
  ]),
  totalAmount: z.number(),
  currency: z.string(),
  /** 마지막 거래 키. 우리 purchases 행에 남겨 두면 토스 콘솔에서 되짚을 수 있다. */
  lastTransactionKey: z.string().nullish(),
});

export type TossPayment = z.infer<typeof paymentSchema>;

export class TossError extends Error {
  readonly code: string | undefined;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "TossError";
    this.code = code;
  }
}

/** 키가 없는 상태. 호출자는 이걸 503 으로 옮긴다 (장애가 아니라 미설정이다). */
export class TossNotConfiguredError extends Error {
  constructor() {
    super("TOSS_SECRET_KEY 가 설정되지 않았습니다");
    this.name = "TossNotConfiguredError";
  }
}

/**
 * 토스의 인증 헤더는 `Basic base64(시크릿키:)` 다.
 * 콜론이 붙는 것이 요점 — 비밀번호가 빈 문자열인 Basic 인증 형식이라,
 * 콜론을 빠뜨리면 키가 맞아도 401 이 난다.
 */
function authHeader(secret: string): string {
  return `Basic ${Buffer.from(`${secret}:`).toString("base64")}`;
}

interface CallOpts {
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}

async function call(
  path: string,
  init: RequestInit,
  opts: CallOpts,
  what: string,
): Promise<TossPayment> {
  const secret = getSecretKey(opts.env);
  if (!secret) throw new TossNotConfiguredError();

  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(`${TOSS_API_BASE}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: authHeader(secret) },
  });

  // 에러 응답도 본문이 JSON 이 아닐 수 있다(게이트웨이 오류 등). 파싱 실패를 삼킨다.
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const e = body as { code?: string; message?: string } | null;
    throw new TossError(e?.message ?? `토스페이먼츠 ${what} 실패 (HTTP ${res.status})`, e?.code);
  }
  return paymentSchema.parse(body);
}

/**
 * POST /v1/payments/confirm — 결제 승인.
 *
 * ⚠️ 조회가 아니라 돈이 잡히는 호출이다. 토스 결제창은 인증까지만 하고,
 * 이 호출이 성공해야 결제가 성립한다. 그래서 착지 페이지에서 딱 한 번만 부른다.
 *
 * amount 를 같이 보내는 이유: 토스가 인증 시점 금액과 대조해 위변조를 막아 준다.
 * 우리도 따로 대조하지만(confirm.ts), 두 겹이어서 손해 볼 것이 없다.
 *
 * fetchImpl·env 를 주입받는 이유: 테스트가 네트워크와 process.env 를 건드리지 않는다.
 */
export async function approvePayment(
  a: { paymentKey: string; orderId: string; amount: number },
  opts: CallOpts = {},
): Promise<TossPayment> {
  return call(
    "/v1/payments/confirm",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(a),
    },
    opts,
    "결제 승인",
  );
}

/**
 * GET /v1/payments/orders/{orderId} — 결제 조회.
 *
 * paymentKey 가 아니라 orderId 로 찾는다. 우리가 아는 것은 우리가 발급한
 * 주문번호뿐이고, paymentKey 는 결제창이 돌아올 때에야 생긴다 — 웹훅이
 * 진위를 확인할 때 쓸 수 있는 손잡이는 orderId 다.
 */
export async function getPaymentByOrderId(
  orderId: string,
  opts: CallOpts = {},
): Promise<TossPayment> {
  return call(
    `/v1/payments/orders/${encodeURIComponent(orderId)}`,
    { method: "GET" },
    opts,
    "결제 조회",
  );
}
