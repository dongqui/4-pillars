import { afterEach, describe, expect, it, vi } from "vitest";
import { createKakaoProvider } from "./kakao.js";
import * as http from "./http.js";

const config = { clientId: "cid", clientSecret: "secret", redirectUri: "https://api.x/auth/kakao/callback" };

afterEach(() => vi.restoreAllMocks());

describe("kakao provider", () => {
  it("authorize URL은 kauth 엔드포인트를 사용한다", () => {
    const p = createKakaoProvider(config);
    const url = new URL(p.buildAuthorizeUrl({ state: "st", codeChallenge: "ch", nonce: "no" }));
    expect(url.origin + url.pathname).toBe("https://kauth.kakao.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("state")).toBe("st");
  });

  it("fetchProfile은 /v2/user/me 응답을 정규화한다 (is_email_verified 반영)", async () => {
    const p = createKakaoProvider(config);
    vi.spyOn(http, "getJson").mockResolvedValue({
      id: 777,
      kakao_account: { email: "a@b.com", is_email_verified: true, profile: { nickname: "Kim" } },
    });
    const profile = await p.fetchProfile({ accessToken: "tok", raw: {} });
    expect(profile).toMatchObject({ providerUserId: "777", email: "a@b.com", emailVerified: true, name: "Kim" });
  });

  it("이메일 미동의 시 email은 null, emailVerified는 false", async () => {
    const p = createKakaoProvider(config);
    vi.spyOn(http, "getJson").mockResolvedValue({ id: 1, kakao_account: { profile: { nickname: "K" } } });
    const profile = await p.fetchProfile({ accessToken: "tok", raw: {} });
    expect(profile.email).toBeNull();
    expect(profile.emailVerified).toBe(false);
  });
});
