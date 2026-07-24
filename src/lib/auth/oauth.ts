import type { ProviderConfig, TokenResponse, FetchLike } from "./providers";

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes); // 32바이트 → 43자 base64url
}

export async function codeChallengeS256(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(digest));
}

export function buildAuthorizeUrl(
  p: ProviderConfig,
  o: { clientId: string; redirectUri: string; state: string; codeChallenge: string },
): string {
  const url = new URL(p.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", o.clientId);
  url.searchParams.set("redirect_uri", o.redirectUri);
  url.searchParams.set("scope", p.scope);
  url.searchParams.set("state", o.state);
  url.searchParams.set("code_challenge", o.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  for (const [k, v] of Object.entries(p.extraAuthParams ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

export async function exchangeCode(
  p: ProviderConfig,
  o: { code: string; clientId: string; clientSecret: string; redirectUri: string; codeVerifier: string },
  fetchImpl: FetchLike,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: o.code,
    redirect_uri: o.redirectUri,
    client_id: o.clientId,
    code_verifier: o.codeVerifier,
  });
  if (o.clientSecret) body.set("client_secret", o.clientSecret);

  const res = await fetchImpl(p.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`token exchange failed: ${p.id} ${res.status}`);
  return (await res.json()) as TokenResponse;
}

/** next는 앱 origin 내부 경로만 허용(오픈 리다이렉트 방어). 그 외엔 "/". */
export function safeNext(next: string | null | undefined, origin: string): string {
  if (!next) return "/";
  try {
    const u = new URL(next, origin);
    if (u.origin !== origin) return "/";
    return u.pathname + u.search + u.hash;
  } catch {
    return "/";
  }
}
