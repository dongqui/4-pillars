import { describe, expect, it } from "vitest";
import { createLineProvider } from "./line.js";

const config = { clientId: "cid", clientSecret: "secret", redirectUri: "https://api.x/auth/line/callback" };

describe("line provider", () => {
  it("authorize URL은 LINE 엔드포인트 + openid email scope를 사용한다", () => {
    const p = createLineProvider(config);
    const url = new URL(p.buildAuthorizeUrl({ state: "st", codeChallenge: "ch", nonce: "no" }));
    expect(url.origin + url.pathname).toBe("https://access.line.me/oauth2/v2.1/authorize");
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("nonce")).toBe("no");
  });

  it("fetchProfile은 id_token claims에서 프로필을 만든다", async () => {
    const p = createLineProvider(config);
    const idToken = `h.${Buffer.from(JSON.stringify({ sub: "L1", email: "a@b.com", name: "Lee" })).toString("base64url")}.s`;
    const profile = await p.fetchProfile({ accessToken: "x", idToken, raw: {} });
    expect(profile).toMatchObject({ providerUserId: "L1", email: "a@b.com", emailVerified: true, name: "Lee" });
  });
});
