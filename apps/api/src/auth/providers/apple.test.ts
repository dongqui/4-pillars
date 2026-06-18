import { describe, expect, it, afterEach, vi } from "vitest";
import { createAppleProvider } from "./apple.js";
import * as http from "./http.js";
import { decodeJwtPayload } from "./http.js";

const config = {
  clientId: "com.x.app",
  teamId: "TEAM123",
  keyId: "KEY123",
  // 테스트용 ES256 PKCS8 (실제 비밀 아님)
  privateKey:
    "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgevZzL1gdAFr88hb2\nOF/2NxApJCzGCEDdfSp6VQO30hyhRANCAAQRWz+jn65BtOMvdyHKcvjBeBSDZH2r\n1RTwjmYSi9R/zpBnuQ4EiMnCqfMPWiZqB4QdbAd0E7oH50VpuZ1P087G\n-----END PRIVATE KEY-----",
  redirectUri: "https://api.x/auth/apple/callback",
};

describe("apple provider", () => {
  afterEach(() => vi.restoreAllMocks());

  it("authorize URL은 appleid 엔드포인트 + response_mode=form_post를 쓴다", () => {
    const p = createAppleProvider(config);
    const url = new URL(p.buildAuthorizeUrl({ state: "st", codeChallenge: "ch", nonce: "no" }));
    expect(url.origin + url.pathname).toBe("https://appleid.apple.com/auth/authorize");
    expect(url.searchParams.get("response_mode")).toBe("form_post");
    expect(url.searchParams.get("scope")).toContain("email");
    expect(url.searchParams.get("state")).toBe("st");
  });

  it("fetchProfile은 id_token claims에서 프로필을 만든다", async () => {
    const p = createAppleProvider(config);
    const idToken = `h.${Buffer.from(JSON.stringify({ sub: "A1", email: "a@b.com", email_verified: "true" })).toString("base64url")}.s`;
    const profile = await p.fetchProfile({ accessToken: "x", idToken, raw: {} });
    expect(profile).toMatchObject({ providerUserId: "A1", email: "a@b.com", emailVerified: true });
  });

  it("exchangeCode는 ES256로 서명된 client_secret JWT를 보낸다", async () => {
    const p = createAppleProvider(config);
    const spy = vi.spyOn(http, "postForm").mockResolvedValue({ access_token: "at", id_token: "it" });
    await p.exchangeCode({ code: "c", codeVerifier: "v" });
    expect(spy).toHaveBeenCalledTimes(1);
    const params = spy.mock.calls[0][1] as Record<string, string>;
    const clientSecret = params.client_secret;
    // header: alg ES256, kid
    const header = JSON.parse(Buffer.from(clientSecret.split(".")[0], "base64url").toString());
    expect(header).toMatchObject({ alg: "ES256", kid: "KEY123" });
    // claims: iss=teamId, sub=clientId, aud=apple
    const claims = decodeJwtPayload(clientSecret);
    expect(claims).toMatchObject({ iss: "TEAM123", sub: "com.x.app", aud: "https://appleid.apple.com" });
  });
});
