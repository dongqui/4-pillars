import { SignJWT, importPKCS8 } from "jose";
import type { OAuthProvider, TokenResponse } from "../types.js";
import { decodeJwtPayload, postForm } from "./http.js";

export interface AppleConfig {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
  redirectUri: string;
}

const AUTHORIZE = "https://appleid.apple.com/auth/authorize";
const TOKEN = "https://appleid.apple.com/auth/token";

async function buildClientSecret(config: AppleConfig): Promise<string> {
  const key = await importPKCS8(config.privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setAudience("https://appleid.apple.com")
    .setSubject(config.clientId)
    .sign(key);
}

export function createAppleProvider(config: AppleConfig): OAuthProvider {
  return {
    name: "apple",
    buildAuthorizeUrl({ state, codeChallenge, nonce }) {
      const q = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        response_mode: "form_post",
        scope: "name email",
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      return `${AUTHORIZE}?${q.toString()}`;
    },
    async exchangeCode({ code, codeVerifier }): Promise<TokenResponse> {
      const clientSecret = await buildClientSecret(config);
      const data = await postForm(TOKEN, {
        grant_type: "authorization_code",
        code,
        client_id: config.clientId,
        client_secret: clientSecret,
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
        // Apple은 email_verified를 문자열 "true"/불리언 둘 다로 보낼 수 있다
        emailVerified: claims.email_verified === true || claims.email_verified === "true",
        name: null, // name은 최초 form_post 바디에서만 옴 (라우트에서 별도 처리)
        raw: claims,
        nonce: claims.nonce ?? null,
      };
    },
  };
}
