import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET } from "./route";

const ORIGIN = "http://localhost:3000";

function loginRequest(query = ""): NextRequest {
  return new NextRequest(`${ORIGIN}/api/auth/login/kakao${query}`);
}

function params(provider = "kakao") {
  return { params: Promise.resolve({ provider }) };
}

describe("GET /api/auth/login/[provider]", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ORIGIN", ORIGIN);
    vi.stubEnv("KAKAO_CLIENT_ID", "kakao-test-id");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("내부 경로는 oauth_next 쿠키에 그대로 싣는다", async () => {
    const res = await GET(loginRequest("?next=%2Fmap"), params());
    expect(res.cookies.get("oauth_next")?.value).toBe("/map");
  });

  // 랜딩의 "로그인" 은 next 를 붙이지 않는다. 예전 기본값은 "/" 여서 로그인하고도
  // 랜딩으로 되돌아왔다 — 로그인한 사용자에게 맞는 자리는 /home 이다.
  it("next 가 없으면 /home 으로 접는다", async () => {
    const res = await GET(loginRequest(), params());
    expect(res.cookies.get("oauth_next")?.value).toBe("/home");
  });

  // 콜백도 safeNext 로 한 번 더 거르지만, 쿠키에 애초에 담지 않는 편이 낫다.
  it("외부 URL 은 쿠키에 담지 않고 /home 으로 접는다 — 오픈 리다이렉트 방어", async () => {
    const res = await GET(loginRequest("?next=https%3A%2F%2Fevil.example"), params());
    expect(res.cookies.get("oauth_next")?.value).toBe("/home");
  });

  it("state·verifier 쿠키를 심고 제공자 인증 화면으로 보낸다", async () => {
    const res = await GET(loginRequest(), params());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("https://kauth.kakao.com");
    expect(res.cookies.get("oauth_state")?.value).toBeTruthy();
    expect(res.cookies.get("oauth_verifier")?.value).toBeTruthy();
  });

  it("모르는 제공자는 404", async () => {
    const res = await GET(loginRequest(), params("myspace"));
    expect(res.status).toBe(404);
  });
});
