import { decodeJwt } from "jose";

export type ProviderId = "google" | "line" | "kakao";

export interface OAuthProfile {
  providerUserId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface TokenResponse {
  access_token: string;
  id_token?: string;
  [k: string]: unknown;
}

export type FetchLike = typeof fetch;

export interface ProviderConfig {
  id: ProviderId;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  extraAuthParams?: Record<string, string>;
  fetchProfile(token: TokenResponse, fetchImpl: FetchLike): Promise<OAuthProfile>;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  google: {
    id: "google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    async fetchProfile(token, fetchImpl) {
      const res = await fetchImpl("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!res.ok) throw new Error(`google userinfo failed: ${res.status}`);
      const d = (await res.json()) as Record<string, unknown>;
      return {
        providerUserId: String(d.sub),
        email: str(d.email),
        displayName: str(d.name),
        avatarUrl: str(d.picture),
      };
    },
  },
  line: {
    id: "line",
    authorizeUrl: "https://access.line.me/oauth2/v2.1/authorize",
    tokenUrl: "https://api.line.me/oauth2/v2.1/token",
    scope: "openid profile email",
    clientIdEnv: "LINE_CLIENT_ID",
    clientSecretEnv: "LINE_CLIENT_SECRET",
    // LINE은 token 응답의 id_token(JWT)에 sub/name/email/picture가 담김.
    // MVP에서는 서명 검증 없이 payload만 디코딩(토큰은 TLS로 직접 받은 신뢰 채널).
    async fetchProfile(token) {
      if (!token.id_token) throw new Error("line id_token missing");
      const claims = decodeJwt(token.id_token);
      return {
        providerUserId: String(claims.sub),
        email: str(claims.email),
        displayName: str(claims.name),
        avatarUrl: str((claims as Record<string, unknown>).picture),
      };
    },
  },
  kakao: {
    id: "kakao",
    authorizeUrl: "https://kauth.kakao.com/oauth/authorize",
    tokenUrl: "https://kauth.kakao.com/oauth/token",
    scope: "profile_nickname account_email",
    clientIdEnv: "KAKAO_CLIENT_ID",
    clientSecretEnv: "KAKAO_CLIENT_SECRET",
    async fetchProfile(token, fetchImpl) {
      const res = await fetchImpl("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!res.ok) throw new Error(`kakao user/me failed: ${res.status}`);
      const d = (await res.json()) as Record<string, unknown>;
      const acc = (d.kakao_account ?? {}) as Record<string, unknown>;
      const prof = (acc.profile ?? {}) as Record<string, unknown>;
      return {
        providerUserId: String(d.id),
        email: str(acc.email),
        displayName: str(prof.nickname),
        avatarUrl: str(prof.profile_image_url),
      };
    },
  },
};

export function getProvider(id: string): ProviderConfig | null {
  return (PROVIDERS as Record<string, ProviderConfig>)[id] ?? null;
}
