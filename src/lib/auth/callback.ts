import type { ProviderConfig, ProviderId, FetchLike } from "./providers";
import type { UpsertUserInput } from "./users";
import { exchangeCode, safeNext } from "./oauth";
import { encodeSession } from "./session";

/**
 * 제공자가 이메일을 안 준 상태. 로그인 자체를 실패시킨다.
 *
 * 토스페이먼츠는 구매자 이메일을 필수로 요구하지 않는다. 그래도 막는 이유는
 * 우리 쪽 필요다 — 결제 영수증과 결제 문의 대응에 연락 수단이 없으면, 돈은 받았는데
 * 사용자에게 닿을 방법이 없는 계정이 생긴다. 그 벽을 결제 화면이 아니라 로그인에서 세운다.
 */
export class MissingEmailError extends Error {
  constructor() {
    super("이메일 제공에 동의해야 가입할 수 있습니다");
    this.name = "MissingEmailError";
  }
}

export interface CallbackParams {
  code: string | null;
  state: string | null;
  storedState: string | null;
  codeVerifier: string | null;
  next: string | null;
}

export interface CallbackDeps {
  fetchImpl: FetchLike;
  upsert: (input: UpsertUserInput) => Promise<{ id: string }>;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  origin: string;
}

export interface CallbackResult {
  redirectTo: string;
  sessionToken: string;
  provider: ProviderId;
  /** 드래프트 승격에 필요하다 — 콜백 라우트가 이 id 로 프로필을 만든다 */
  userId: string;
}

export async function completeOAuth(
  p: ProviderConfig,
  params: CallbackParams,
  deps: CallbackDeps,
): Promise<CallbackResult> {
  if (!params.code) throw new Error("oauth callback: missing code");
  if (!params.state || !params.storedState || params.state !== params.storedState) {
    throw new Error("oauth callback: state mismatch");
  }
  if (!params.codeVerifier) throw new Error("oauth callback: missing code_verifier");

  const token = await exchangeCode(
    p,
    {
      code: params.code,
      clientId: deps.clientId,
      clientSecret: deps.clientSecret,
      redirectUri: deps.redirectUri,
      codeVerifier: params.codeVerifier,
    },
    deps.fetchImpl,
  );

  const profile = await p.fetchProfile(token, deps.fetchImpl);
  // upsert 앞에서 막는다 — 뒤에서 막으면 결제 못 하는 행이 남는다.
  if (!profile.email?.trim()) throw new MissingEmailError();

  const user = await deps.upsert({
    provider: p.id,
    providerUserId: profile.providerUserId,
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  });

  const sessionToken = await encodeSession({ userId: user.id, provider: p.id });
  return {
    redirectTo: safeNext(params.next, deps.origin),
    sessionToken,
    provider: p.id,
    userId: user.id,
  };
}
