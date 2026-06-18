import type { OAuthProvider, TokenResponse } from "../types.js";
import type { ProviderConfig } from "./google.js";
import { decodeJwtPayload, postForm } from "./http.js";

const AUTHORIZE = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN = "https://api.line.me/oauth2/v2.1/token";

export function createLineProvider(config: ProviderConfig): OAuthProvider {
  return {
    name: "line",
    buildAuthorizeUrl({ state, codeChallenge, nonce }) {
      const q = new URLSearchParams({
        response_type: "code",
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: "openid profile email",
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
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: codeVerifier,
      });
      return { accessToken: data.access_token, idToken: data.id_token, raw: data };
    },
    async fetchProfile(tokens) {
      const claims = decodeJwtPayload(tokens.idToken ?? "");
      const email = claims.email ?? null;
      return {
        providerUserId: String(claims.sub),
        email,
        emailVerified: email !== null,
        name: claims.name ?? null,
        raw: claims,
        nonce: claims.nonce ?? null,
      };
    },
  };
}
