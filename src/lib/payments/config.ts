/**
 * 포트원 설정을 읽는 유일한 곳. process.env 를 다른 곳에서 읽지 않는다.
 *
 * 모든 함수가 env 를 인자로 받는 이유: 테스트가 process.env 를 건드리지 않고
 * 조합을 검사할 수 있다. 그리고 부재를 예외가 아니라 null 로 다뤄서, 키가 하나도
 * 없는 상태에서도 typecheck 와 테스트가 통과한다.
 *
 * storeId·channelKey 를 NEXT_PUBLIC_ 으로 두지 않는 이유:
 *  1. NEXT_PUBLIC_ 은 빌드타임에 번들로 인라인돼 키 교체마다 재빌드가 필요하다.
 *  2. "이 수단은 쓸 수 없다"는 판단을 서버가 해야 한다. 브라우저에 빈 문자열을
 *     내려 보내면 못 쓰는 수단이 화면에 남았다가 결제창에서 실패한다.
 * 대신 /checkout 이 availableMethods() 로 거르고, 주문 생성 응답이 값을 실어 보낸다.
 */

/**
 * 순서가 곧 화면 순서다 (PAYMENT_METHODS 와 같은 순서를 유지한다).
 * 타입을 배열에서 파생시키는 이유: 수단을 추가할 때 배열과 유니온을 따로 고치면
 * 한쪽만 고쳐도 컴파일이 통과해 조용히 어긋난다. 여기 한 줄만 고치면 된다.
 */
export const PAYMENT_METHOD_IDS = ["card", "naver", "kakao", "toss"] as const;

export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

/** 포트원 간편결제 UI 직접 호출에 넘기는 제휴사 코드. */
export type EasyPayProvider = "NAVERPAY" | "KAKAOPAY" | "TOSSPAY";

/**
 * 수단이 결정하는 것은 포트원 요청의 판별자뿐이다. 채널키는 여기 없다 —
 * KG이니시스 채널 하나가 네 수단을 전부 연다.
 *
 * 판별 유니온인 이유: payMethod 와 easyPayProvider 를 각각 선택 필드로 두면
 * "EASY_PAY 인데 provider 가 없는" 조합이 타입상 살아남는다. 그 조합은
 * 결제창을 수단 선택 화면으로 열어 버려서, 사용자가 고른 수단과 다른 결제가 된다.
 */
export type PaymentRequestKind =
  | { payMethod: "CARD" }
  | { payMethod: "EASY_PAY"; easyPayProvider: EasyPayProvider };

const REQUESTS: Record<PaymentMethodId, PaymentRequestKind> = {
  card: { payMethod: "CARD" },
  naver: { payMethod: "EASY_PAY", easyPayProvider: "NAVERPAY" },
  kakao: { payMethod: "EASY_PAY", easyPayProvider: "KAKAOPAY" },
  toss: { payMethod: "EASY_PAY", easyPayProvider: "TOSSPAY" },
};

export type PaymentChannel = { channelKey: string } & PaymentRequestKind;

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

/** KG이니시스 채널 하나. 카드도 간편결제도 이 키로 연다. */
export function getChannelKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return read(env, "PORTONE_CHANNEL_KEY_INICIS");
}

/**
 * 지금 열어 둔 수단. 간편결제 제휴 계약이 하나씩 열리므로 배포가 아니라 env 로 켠다.
 *
 * 정규 목록(PAYMENT_METHOD_IDS)을 env 집합으로 거르는 방식이라 캐스팅이 없다:
 * 모르는 값은 어느 id 와도 만나지 못해 그대로 사라지고, 중복은 접히고,
 * 결과 순서는 항상 화면 순서다 — env 를 어떤 순서로 적든 화면이 흔들리지 않는다.
 *
 * 미설정이면 빈 배열이다. 전부 켜지 않는다 — env 를 빠뜨렸을 때 결제창이 열리는
 * 것보다 화면이 잠기는 쪽이 안전하다.
 */
export function enabledMethods(env: NodeJS.ProcessEnv = process.env): PaymentMethodId[] {
  const raw = read(env, "PORTONE_METHODS");
  if (!raw) return [];
  const wanted = new Set(raw.split(",").map((s) => s.trim().toLowerCase()));
  return PAYMENT_METHOD_IDS.filter((id) => wanted.has(id));
}

/**
 * 주문 생성의 관문이다. 꺼진 수단을 화면에서만 숨기고 여기서 통과시키면
 * API 를 직접 두드려 열 수 있다.
 */
export function getChannel(
  id: PaymentMethodId,
  env: NodeJS.ProcessEnv = process.env,
): PaymentChannel | null {
  const channelKey = getChannelKey(env);
  if (!channelKey) return null;
  if (!enabledMethods(env).includes(id)) return null;
  return { channelKey, ...REQUESTS[id] };
}

/**
 * 실제로 결제를 걸 수 있는 수단만.
 *
 * API 시크릿도 같이 본다 — 채널키만으로는 결제창을 열고 돈을 받을 수는 있지만,
 * confirmPayment 가 getPayment 를 부를 때 시크릿이 없으면 거기서
 * PortOneNotConfiguredError 로 막힌다. 결제창은 열렸는데 확정할 수 없는 상태로
 * 화면을 켜 두면 고객 돈은 잡히고 완료 API 는 503, 행은 pending 에 갇힌다.
 * 확정 자격이 없으면 애초에 결제창을 열지 않는다.
 */
export function availableMethods(env: NodeJS.ProcessEnv = process.env): PaymentMethodId[] {
  if (!getStoreId(env) || !getApiSecret(env) || !getChannelKey(env)) return [];
  return enabledMethods(env);
}
