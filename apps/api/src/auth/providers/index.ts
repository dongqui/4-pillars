import type { ProviderName } from "../../db/schema.js";
import type { OAuthProvider } from "../types.js";
import { createAppleProvider } from "./apple.js";
import { createGoogleProvider } from "./google.js";
import { createKakaoProvider } from "./kakao.js";
import { createLineProvider } from "./line.js";

export function buildProviders(env: NodeJS.ProcessEnv = process.env): Record<ProviderName, OAuthProvider> {
  return {
    google: createGoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
      redirectUri: env.GOOGLE_REDIRECT_URI ?? "",
    }),
    kakao: createKakaoProvider({
      clientId: env.KAKAO_CLIENT_ID ?? "",
      clientSecret: env.KAKAO_CLIENT_SECRET ?? "",
      redirectUri: env.KAKAO_REDIRECT_URI ?? "",
    }),
    line: createLineProvider({
      clientId: env.LINE_CLIENT_ID ?? "",
      clientSecret: env.LINE_CLIENT_SECRET ?? "",
      redirectUri: env.LINE_REDIRECT_URI ?? "",
    }),
    apple: createAppleProvider({
      clientId: env.APPLE_CLIENT_ID ?? "",
      teamId: env.APPLE_TEAM_ID ?? "",
      keyId: env.APPLE_KEY_ID ?? "",
      privateKey: (env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
      redirectUri: env.APPLE_REDIRECT_URI ?? "",
    }),
  };
}
