import type { ProviderConfig, ProviderId, FetchLike } from "./providers";
import type { UpsertUserInput } from "./users";
import { exchangeCode, safeNext } from "./oauth";
import { encodeSession } from "./session";

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
}

export interface CallbackResult {
  redirectTo: string;
  sessionToken: string;
  provider: ProviderId;
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
  const user = await deps.upsert({
    provider: p.id,
    providerUserId: profile.providerUserId,
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  });

  const sessionToken = await encodeSession({ userId: user.id, provider: p.id });
  return { redirectTo: safeNext(params.next), sessionToken, provider: p.id };
}
