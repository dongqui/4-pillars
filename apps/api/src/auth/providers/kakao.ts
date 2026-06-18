import type { OAuthProvider, TokenResponse } from "../types.js";
import type { ProviderConfig } from "./google.js";
import { getJson, postForm } from "./http.js";

const AUTHORIZE = "https://kauth.kakao.com/oauth/authorize";
const TOKEN = "https://kauth.kakao.com/oauth/token";
const USERINFO = "https://kapi.kakao.com/v2/user/me";

export function createKakaoProvider(config: ProviderConfig): OAuthProvider {
  return {
    name: "kakao",
    buildAuthorizeUrl({ state, codeChallenge }) {
      const q = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: "account_email profile_nickname",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      return `${AUTHORIZE}?${q.toString()}`;
    },
    async exchangeCode({ code, codeVerifier }): Promise<TokenResponse> {
      const data = await postForm(TOKEN, {
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
        code_verifier: codeVerifier,
      });
      return { accessToken: data.access_token, idToken: data.id_token, raw: data };
    },
    async fetchProfile(tokens) {
      const data = await getJson(USERINFO, { Authorization: `Bearer ${tokens.accessToken}` });
      const account = data.kakao_account ?? {};
      const email = account.email ?? null;
      return {
        providerUserId: String(data.id),
        email,
        emailVerified: email !== null && account.is_email_verified === true,
        name: account.profile?.nickname ?? null,
        raw: data,
      };
    },
  };
}
