/**
 * 포트원 설정을 읽는 유일한 곳. process.env 를 다른 곳에서 읽지 않는다.
 *
 * 모든 함수가 env 를 인자로 받는 이유: 테스트가 process.env 를 건드리지 않고
 * 조합을 검사할 수 있다. 그리고 부재를 예외가 아니라 null 로 다뤄서, 키가 하나도
 * 없는 상태에서도 typecheck 와 테스트가 통과한다.
 *
 * storeId·channelKey 를 NEXT_PUBLIC_ 으로 두지 않는 이유:
 *  1. NEXT_PUBLIC_ 은 빌드타임에 번들로 인라인돼 키 교체마다 재빌드가 필요하다.
 *  2. "이 수단은 키가 없다"는 판단을 서버가 해야 한다. 브라우저에 빈 문자열을
 *     내려 보내면 키 없는 수단이 화면에 남았다가 결제창에서 실패한다.
 * 대신 /checkout 이 availableMethods() 로 거르고, 주문 생성 응답이 값을 실어 보낸다.
 */

/**
 * 순서가 곧 화면 순서다 (PAYMENT_METHODS 와 같은 순서를 유지한다).
 * 타입을 배열에서 파생시키는 이유: 수단을 추가할 때 배열과 유니온을 따로 고치면
 * 한쪽만 고쳐도 컴파일이 통과해 조용히 어긋난다. 여기 한 줄만 고치면 된다.
 * zod 스키마도 이 배열을 그대로 받으므로 런타임 검증까지 같이 따라온다.
 */
export const PAYMENT_METHOD_IDS = ["card", "naver", "kakao"] as const;

export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

/** 포트원 requestPayment 의 payMethod. 지금 쓰는 두 가지만 둔다. */
export type PortOnePayMethod = "CARD" | "EASY_PAY";

export interface PaymentChannel {
  channelKey: string;
  payMethod: PortOnePayMethod;
}

const CHANNELS: Record<PaymentMethodId, { env: string; payMethod: PortOnePayMethod }> = {
  card: { env: "PORTONE_CHANNEL_KEY_CARD", payMethod: "CARD" },
  naver: { env: "PORTONE_CHANNEL_KEY_NAVERPAY", payMethod: "EASY_PAY" },
  kakao: { env: "PORTONE_CHANNEL_KEY_KAKAOPAY", payMethod: "EASY_PAY" },
};

/** 빈 문자열·공백은 미설정으로 친다 — .env 의 `KEY=` 한 줄이 값으로 살아나면 안 된다. */
function read(env: NodeJS.ProcessEnv, name: string): string | null {
  const v = env[name]?.trim();
  return v ? v : null;
}

export function getStoreId(env: NodeJS.ProcessEnv = process.env): string | null {
  return read(env, "PORTONE_STORE_ID");
}

export function getApiSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  return read(env, "PORTONE_API_SECRET");
}

export function getWebhookSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  return read(env, "PORTONE_WEBHOOK_SECRET");
}

/** 모바일 리다이렉트 주소를 조립하는 데 쓴다. 소셜 로그인이 쓰는 값과 같다. */
export function getAppOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  return read(env, "APP_ORIGIN")?.replace(/\/$/, "") ?? null;
}

/**
 * 간편결제에 easyPayProvider 를 따로 넘기지 않는다 — 채널키가 이미 어느 PG 인지
 * 결정한다. 실결제에서 결제창이 열리지 않으면 easyPay 옵션을 추가한다
 * (설계 문서 §11 의 확인 항목).
 */
export function getChannel(
  id: PaymentMethodId,
  env: NodeJS.ProcessEnv = process.env,
): PaymentChannel | null {
  const spec = CHANNELS[id];
  const channelKey = read(env, spec.env);
  return channelKey ? { channelKey, payMethod: spec.payMethod } : null;
}

/** 실제로 결제를 걸 수 있는 수단만. 상점 ID 가 없으면 채널이 다 있어도 아무것도 못 한다. */
export function availableMethods(env: NodeJS.ProcessEnv = process.env): PaymentMethodId[] {
  if (!getStoreId(env)) return [];
  return PAYMENT_METHOD_IDS.filter((id) => getChannel(id, env) !== null);
}
