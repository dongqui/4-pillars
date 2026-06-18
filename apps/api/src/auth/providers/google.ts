import type { OAuthProvider, TokenResponse } from "../types.js";
import { decodeJwtPayload, postForm } from "./http.js";

export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";

export function createGoogleProvider(config: ProviderConfig): OAuthProvider {
  return {
    name: "google",
    buildAuthorizeUrl({ state, codeChallenge, nonce }) {
      const q = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      return `${AUTHORIZE}?${q.toString()}`;
    },
    async exchangeCode({ code, codeVerifier }): Promise<TokenResponse> {
      const data = await postForm(TOKEN, {
        grant_type: "authorization_code",
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
      });
      return { accessToken: data.access_token, idToken: data.id_token, raw: data };
    },
    async fetchProfile(tokens) {
      const claims = decodeJwtPayload(tokens.idToken ?? "");
      return {
        providerUserId: String(claims.sub),
        email: claims.email ?? null,
        emailVerified: Boolean(claims.email_verified),
        name: claims.name ?? null,
        raw: claims,
        nonce: claims.nonce ?? null,
      };
    },
  };
}
