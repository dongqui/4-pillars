import type { ProviderName } from "../db/schema.js";

export type { ProviderName };

export interface NormalizedProfile {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  raw: unknown;
  nonce?: string | null;
}

export interface TokenResponse {
  accessToken: string;
  idToken?: string;
  raw: unknown;
}

export interface AuthorizeArgs {
  state: string;
  codeChallenge: string;
  nonce: string;
}

export interface OAuthProvider {
  name: ProviderName;
  buildAuthorizeUrl(args: AuthorizeArgs): string;
  exchangeCode(args: { code: string; codeVerifier: string }): Promise<TokenResponse>;
  fetchProfile(tokens: TokenResponse): Promise<NormalizedProfile>;
}
