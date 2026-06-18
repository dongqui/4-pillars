import { describe, expect, it } from "vitest";
import { createAuthRoutes, type AuthDeps } from "./routes.js";
import type { AuthRepo } from "./account.js";
import type { SessionRepo } from "./session.js";
import type { OAuthProvider } from "./types.js";

function fakeProvider(name: OAuthProvider["name"]): OAuthProvider {
  return {
    name,
    buildAuthorizeUrl: ({ state }) => `https://provider.test/authorize?state=${state}`,
    exchangeCode: async () => ({ accessToken: "at", idToken: "it", raw: {} }),
    fetchProfile: async () => ({ providerUserId: "p1", email: "a@b.com", emailVerified: true, name: "A", raw: {} }),
  };
}

function fakeDeps(): AuthDeps {
  const sessionRows = new Map<string, { userId: string; expiresAt: Date; revokedAt: Date | null }>();
  const authRepo: AuthRepo = {
    findIdentity: async () => ({ userId: "u1" }),
    findUserByEmail: async () => null,
    createUser: async () => ({ id: "u1" }),
    createIdentity: async () => {},
    getUserById: async (id) => ({ id, email: "a@b.com", name: "A", locale: "ko" }),
  };
  const sessionRepo: SessionRepo = {
    createSession: async ({ token, userId, expiresAt }) => void sessionRows.set(token, { userId, expiresAt, revokedAt: null }),
    findSession: async (t) => sessionRows.get(t) ?? null,
    revokeSession: async (t, at) => { const r = sessionRows.get(t); if (r) r.revokedAt = at; },
  };
  return {
    providers: { google: fakeProvider("google"), kakao: fakeProvider("kakao"), line: fakeProvider("line"), apple: fakeProvider("apple") },
    authRepo,
    sessionRepo,
    config: {
      sessionCookieName: "sid",
      sessionCookieDomain: "",
      secureCookies: false,
      webOrigins: ["http://localhost:3000"],
      defaultRedirect: "http://localhost:3000",
    },
  };
}

describe("auth routes", () => {
  it("start는 authorize URL로 302 리다이렉트하고 oauth_tx 쿠키를 세팅한다", async () => {
    const app = createAuthRoutes(fakeDeps());
    const res = await app.request("/google/start?redirect=http://localhost:3000/welcome");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("https://provider.test/authorize");
    expect(res.headers.get("set-cookie")).toContain("oauth_tx=");
  });

  it("허용되지 않은 redirect는 400을 반환한다", async () => {
    const app = createAuthRoutes(fakeDeps());
    const res = await app.request("/google/start?redirect=https://evil.com");
    expect(res.status).toBe(400);
  });

  it("알 수 없는 provider는 404를 반환한다", async () => {
    const app = createAuthRoutes(fakeDeps());
    const res = await app.request("/twitter/start?redirect=http://localhost:3000");
    expect(res.status).toBe(404);
  });

  it("me는 세션 쿠키가 없으면 401을 반환한다", async () => {
    const app = createAuthRoutes(fakeDeps());
    const res = await app.request("/me");
    expect(res.status).toBe(401);
  });

  it("callback은 state 불일치 시 400을 반환한다", async () => {
    const app = createAuthRoutes(fakeDeps());
    const res = await app.request("/google/callback?code=c&state=mismatch", {
      headers: { cookie: "oauth_tx=" + encodeURIComponent(JSON.stringify({ state: "real", verifier: "v", nonce: "n", redirect: "http://localhost:3000" })) },
    });
    expect(res.status).toBe(400);
  });
});
