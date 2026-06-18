import { describe, expect, it, vi, afterEach } from "vitest";
import { createGoogleProvider } from "./google.js";

const config = { clientId: "cid", clientSecret: "secret", redirectUri: "https://api.x/auth/google/callback" };

afterEach(() => vi.restoreAllMocks());

describe("google provider", () => {
  it("authorize URL에 client_id, redirect_uri, S256, state를 포함한다", () => {
    const p = createGoogleProvider(config);
    const url = new URL(p.buildAuthorizeUrl({ state: "st", codeChallenge: "ch", nonce: "no" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("scope")).toContain("email");
  });

  it("fetchProfile은 id_token에서 정규화된 프로필을 만든다", async () => {
    const p = createGoogleProvider(config);
    const b64 = (o: unknown) =>
      Buffer.from(JSON.stringify(o)).toString("base64url");
    const idToken = `h.${b64({ sub: "g1", email: "a@b.com", email_verified: true, name: "Al" })}.s`;
    const profile = await p.fetchProfile({ accessToken: "x", idToken, raw: {} });
    expect(profile).toMatchObject({ providerUserId: "g1", email: "a@b.com", emailVerified: true, name: "Al" });
  });
});
