import { describe, it, expect, beforeAll } from "vitest";
import { completeOAuth, MissingEmailError } from "./callback";
import { decodeSession } from "./session";
import { PROVIDERS, type FetchLike } from "./providers";

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = "test-secret-test-secret-test-secret-01";
});

// google 플로우: token 엔드포인트 → userinfo 엔드포인트 순으로 응답
function googleFetch(): FetchLike {
  return (async (url: string) => {
    if (url === "https://oauth2.googleapis.com/token") {
      return { ok: true, status: 200, json: async () => ({ access_token: "AT" }) };
    }
    if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
      return { ok: true, status: 200, json: async () => ({ sub: "g-1", email: "a@g.com", name: "지민" }) };
    }
    throw new Error(`unexpected url ${url}`);
  }) as unknown as FetchLike;
}

const baseParams = {
  code: "CODE",
  state: "S",
  storedState: "S",
  codeVerifier: "V",
  next: "/report",
};

function deps(fetchImpl: FetchLike) {
  const upserts: unknown[] = [];
  return {
    upserts,
    deps: {
      fetchImpl,
      upsert: async (i: unknown) => {
        upserts.push(i);
        return { id: "42" };
      },
      clientId: "cid",
      clientSecret: "sec",
      redirectUri: "http://localhost:3000/api/auth/callbacks/google",
      origin: "http://localhost:3000",
    },
  };
}

describe("completeOAuth", () => {
  it("정상 플로우: upsert 후 세션 발급, next로 리다이렉트", async () => {
    const { deps: d, upserts } = deps(googleFetch());
    const result = await completeOAuth(PROVIDERS.google, baseParams, d);
    expect(result.provider).toBe("google");
    expect(result.redirectTo).toBe("/report");
    expect(upserts[0]).toEqual({ provider: "google", providerUserId: "g-1", email: "a@g.com", displayName: "지민", avatarUrl: undefined });
    expect(await decodeSession(result.sessionToken)).toEqual({ userId: "42", provider: "google" });
    expect(result.userId).toBe("42");
  });
  it("state 불일치면 throw", async () => {
    const { deps: d } = deps(googleFetch());
    await expect(completeOAuth(PROVIDERS.google, { ...baseParams, storedState: "OTHER" }, d)).rejects.toThrow();
  });
  it("code 없으면 throw", async () => {
    const { deps: d } = deps(googleFetch());
    await expect(completeOAuth(PROVIDERS.google, { ...baseParams, code: null }, d)).rejects.toThrow();
  });
  it("외부 next는 /home으로 정규화", async () => {
    const { deps: d } = deps(googleFetch());
    const result = await completeOAuth(PROVIDERS.google, { ...baseParams, next: "https://evil.com" }, d);
    expect(result.redirectTo).toBe("/home");
  });
});

describe("이메일 없는 로그인", () => {
  // 제공자가 이메일을 안 주는 경우: 카카오에서 이메일 동의를 거부한 사용자.
  function noEmailFetch(): FetchLike {
    return (async (url: string) => {
      if (url === "https://oauth2.googleapis.com/token") {
        return { ok: true, status: 200, json: async () => ({ access_token: "AT" }) };
      }
      return { ok: true, status: 200, json: async () => ({ sub: "g-1", name: "지민" }) };
    }) as unknown as FetchLike;
  }

  it("이메일이 없으면 MissingEmailError — 결제창이 구매자 이메일을 요구한다", async () => {
    const { deps: d } = deps(noEmailFetch());
    await expect(completeOAuth(PROVIDERS.google, baseParams, d)).rejects.toBeInstanceOf(
      MissingEmailError,
    );
  });

  it("이메일이 없으면 가입시키지 않는다 — 결제 못 하는 계정을 만들어 두지 않는다", async () => {
    const { deps: d, upserts } = deps(noEmailFetch());
    await completeOAuth(PROVIDERS.google, baseParams, d).catch(() => {});
    expect(upserts).toEqual([]);
  });
});
