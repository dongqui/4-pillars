import { describe, it, expect } from "vitest";
import {
  generateState,
  generateCodeVerifier,
  codeChallengeS256,
  buildAuthorizeUrl,
  exchangeCode,
  safeNext,
} from "./oauth";
import { PROVIDERS, type FetchLike } from "./providers";

describe("PKCE/state 생성", () => {
  it("code_verifier는 43자 base64url", () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("state는 base64url 문자열", () => {
    expect(generateState()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it("S256 challenge는 RFC 7636 벡터와 일치", async () => {
    const c = await codeChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(c).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("buildAuthorizeUrl", () => {
  it("필수 파라미터를 포함", () => {
    const url = new URL(
      buildAuthorizeUrl(PROVIDERS.google, {
        clientId: "cid",
        redirectUri: "http://localhost:3000/api/auth/callbacks/google",
        state: "st",
        codeChallenge: "ch",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/callbacks/google");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("exchangeCode", () => {
  it("form-encoded로 토큰 교환하고 응답 반환", async () => {
    const calls: { url: string; body: string }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) });
      return { ok: true, status: 200, json: async () => ({ access_token: "AT", id_token: "IT" }) };
    }) as unknown as FetchLike;

    const token = await exchangeCode(
      PROVIDERS.kakao,
      { code: "C", clientId: "cid", clientSecret: "sec", redirectUri: "http://x/cb", codeVerifier: "ver" },
      fetchImpl,
    );
    expect(token.access_token).toBe("AT");
    expect(calls[0].url).toBe("https://kauth.kakao.com/oauth/token");
    const body = new URLSearchParams(calls[0].body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("C");
    expect(body.get("code_verifier")).toBe("ver");
    expect(body.get("client_secret")).toBe("sec");
  });
  it("client_secret이 빈 문자열이면 생략", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      calls.push(String(init.body));
      return { ok: true, status: 200, json: async () => ({ access_token: "AT" }) };
    }) as unknown as FetchLike;
    await exchangeCode(
      PROVIDERS.google,
      { code: "C", clientId: "cid", clientSecret: "", redirectUri: "http://x/cb", codeVerifier: "ver" },
      fetchImpl,
    );
    expect(new URLSearchParams(calls[0]).has("client_secret")).toBe(false);
  });
  it("non-ok 응답이면 throw", async () => {
    const fetchImpl = (async () => ({ ok: false, status: 400, json: async () => ({}) })) as unknown as FetchLike;
    await expect(
      exchangeCode(PROVIDERS.line, { code: "C", clientId: "c", clientSecret: "s", redirectUri: "r", codeVerifier: "v" }, fetchImpl),
    ).rejects.toThrow();
  });
});

describe("safeNext (오픈 리다이렉트 방어)", () => {
  const origin = "https://app.example.com";

  it("내부 경로는 그대로 통과", () => {
    expect(safeNext("/report", origin)).toBe("/report");
    expect(safeNext("/report?paid=true", origin)).toBe("/report?paid=true");
  });

  it("외부 origin 은 기본 행선으로 떨군다", () => {
    expect(safeNext("https://evil.com", origin)).toBe("/home");
    expect(safeNext("//evil.com", origin)).toBe("/home");
    expect(safeNext("/\\evil.com", origin)).toBe("/home");
  });

  it("next 가 없으면 로그인 홈으로 보낸다", () => {
    expect(safeNext(null, origin)).toBe("/home");
    expect(safeNext(undefined, origin)).toBe("/home");
  });

  it("상대 경로는 앞에 슬래시를 붙여 통과", () => {
    expect(safeNext("report", origin)).toBe("/report");
  });

  it("개행이 섞여도 origin 을 벗어나지 않는다", () => {
    expect(new URL(safeNext("/\n/evil.com", origin), origin).origin).toBe(origin);
  });
});
