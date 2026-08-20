/**
 * 토스페이먼츠 설정을 읽는 유일한 곳. process.env 를 다른 곳에서 읽지 않는다.
 *
 * 모든 함수가 env 를 인자로 받는 이유: 테스트가 process.env 를 건드리지 않고
 * 조합을 검사할 수 있다. 그리고 부재를 예외가 아니라 null 로 다뤄서, 키가 하나도
 * 없는 상태에서도 typecheck 와 테스트가 통과한다.
 *
 * 클라이언트 키를 NEXT_PUBLIC_ 으로 두지 않는 이유(토스 문서상 공개해도 되는 값이지만):
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

/**
 * 토스페이먼츠 간편결제사 코드. 우리 수단 id 와 글자가 다르다 —
 * 화면에는 "카카오페이"로 쓰고 결제창에는 "KAKAOPAY"로 보낸다.
 */
export type EasyPayProvider = "NAVERPAY" | "KAKAOPAY" | "TOSSPAY";

/**
 * 수단이 결정하는 것은 결제창을 여는 방법뿐이다. 클라이언트 키는 여기 없다 —
 * 키 하나가 네 수단을 전부 연다.
 *
 * 토스 결제창은 넷 다 `method: "CARD"` 로 연다. 갈리는 것은 card.flowMode 다:
 *  - DEFAULT: 카드·간편결제 통합결제창
 *  - DIRECT:  easyPay 로 지정한 간편결제사의 자체창
 *
 * 판별 유니온인 이유: flowMode 와 easyPay 를 각각 선택 필드로 두면
 * "DIRECT 인데 easyPay 가 없는" 조합이 타입상 살아남는다. 그 조합은
 * 결제창을 통합 화면으로 열어 버려서, 사용자가 고른 수단과 다른 결제가 된다.
 */
export type PaymentRequestKind =
  | { flowMode: "DEFAULT" }
  | { flowMode: "DIRECT"; easyPay: EasyPayProvider };

const REQUESTS: Record<PaymentMethodId, PaymentRequestKind> = {
  card: { flowMode: "DEFAULT" },
  naver: { flowMode: "DIRECT", easyPay: "NAVERPAY" },
  kakao: { flowMode: "DIRECT", easyPay: "KAKAOPAY" },
  toss: { flowMode: "DIRECT", easyPay: "TOSSPAY" },
};

/** 빈 문자열·공백은 미설정으로 친다 — .env 의 `KEY=` 한 줄이 값으로 살아나면 안 된다. */
function read(env: NodeJS.ProcessEnv, name: string): string | null {
  const v = env[name]?.trim();
  return v ? v : null;
}

/** 결제창을 여는 키. 브라우저까지 내려간다(토스 문서상 공개 가능한 값이다). */
export function getClientKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return read(env, "TOSS_CLIENT_KEY");
}

/** 승인·조회 API 를 부르는 키. 브라우저로 절대 내보내지 않는다. */
export function getSecretKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return read(env, "TOSS_SECRET_KEY");
}

/** 결제창이 돌아올 주소를 조립하는 데 쓴다. 소셜 로그인이 쓰는 값과 같다. */
export function getAppOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  return read(env, "APP_ORIGIN")?.replace(/\/$/, "") ?? null;
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
  const raw = read(env, "TOSS_METHODS");
  if (!raw) return [];
  const wanted = new Set(raw.split(",").map((s) => s.trim().toLowerCase()));
  return PAYMENT_METHOD_IDS.filter((id) => wanted.has(id));
}

/**
 * 주문 생성의 관문이다. 꺼진 수단을 화면에서만 숨기고 여기서 통과시키면
 * API 를 직접 두드려 열 수 있다.
 */
export function getMethod(
  id: PaymentMethodId,
  env: NodeJS.ProcessEnv = process.env,
): PaymentRequestKind | null {
  if (!getClientKey(env)) return null;
  if (!enabledMethods(env).includes(id)) return null;
  return REQUESTS[id];
}

/**
 * 실제로 결제를 걸 수 있는 수단만.
 *
 * 시크릿 키도 같이 본다 — 클라이언트 키만으로 결제창을 열고 인증까지 받을 수는
 * 있지만, 토스는 인증만으로 돈이 잡히지 않는다. 승인 API 를 부를 시크릿이 없으면
 * 결제창은 열렸는데 승인할 수 없는 상태가 되고, 사용자는 결제한 줄 알지만 행은
 * pending 에 갇힌다. 승인 자격이 없으면 애초에 결제창을 열지 않는다.
 */
export function availableMethods(env: NodeJS.ProcessEnv = process.env): PaymentMethodId[] {
  if (!getClientKey(env) || !getSecretKey(env)) return [];
  return enabledMethods(env);
}
