import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// completeOAuth 는 OAuth 왕복(코드 교환·userinfo 호출)을 통째로 감춘다 — 이 테스트는
// 콜백 라우트가 completeOAuth·promoteDraft 의 결과를 행선지·쿠키로 옮기는 배선만 본다.
const completeOAuth = vi.fn();
vi.mock("@/lib/auth/callback", () => ({
  completeOAuth: (...a: unknown[]) => completeOAuth(...a),
}));

const promoteDraft = vi.fn();
vi.mock("@/lib/drafts/promote", () => ({
  promoteDraft: (...a: unknown[]) => promoteDraft(...a),
}));

import { GET } from "./route";

beforeAll(() => {
  // getProvider("google") 가 500 없이 동작하려면 clientId·origin 이 있어야 한다.
  process.env.APP_ORIGIN = "http://localhost:3000";
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
});

beforeEach(() => {
  completeOAuth.mockReset();
  promoteDraft.mockReset();
});

const baseCallbackResult = {
  redirectTo: "/report",
  sessionToken: "session-tok-1",
  provider: "google" as const,
  userId: "7",
};

function callbackRequest(cookie?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new NextRequest(
    "http://localhost:3000/api/auth/callbacks/google?code=CODE&state=S",
    { headers },
  );
}

function ctx() {
  return { params: Promise.resolve({ provider: "google" }) };
}

describe("GET /api/auth/callbacks/[provider]", () => {
  it("promoted: /report?profile=<id> 로 보내고 draft 쿠키를 지운다", async () => {
    completeOAuth.mockResolvedValue(baseCallbackResult);
    promoteDraft.mockResolvedValue({ kind: "promoted", id: "42" });

    const res = await GET(callbackRequest("draft=tok-1"), ctx());

    expect(res.headers.get("location")).toBe("http://localhost:3000/report?profile=42");
    // NextResponse.cookies.delete() 는 value:"" 에 만료된 Set-Cookie 를 굽는다 — 실험으로 확인.
    expect(res.cookies.get("draft")?.value).toBe("");
  });

  it("limit: /home?error=limit 로 보내고 draft 쿠키를 남긴다", async () => {
    completeOAuth.mockResolvedValue(baseCallbackResult);
    promoteDraft.mockResolvedValue({ kind: "limit" });

    const res = await GET(callbackRequest("draft=tok-1"), ctx());

    expect(res.headers.get("location")).toBe("http://localhost:3000/home?error=limit");
    // 손잡이를 지우면 재시도가 불가능해진다 — 굽지 않아야 하므로 undefined.
    expect(res.cookies.get("draft")).toBeUndefined();
  });

  it("none: completeOAuth 의 redirectTo 로 보내고 draft 쿠키를 지운다", async () => {
    completeOAuth.mockResolvedValue({ ...baseCallbackResult, redirectTo: "/home" });
    promoteDraft.mockResolvedValue({ kind: "none" });

    const res = await GET(callbackRequest("draft=tok-1"), ctx());

    expect(res.headers.get("location")).toBe("http://localhost:3000/home");
    expect(res.cookies.get("draft")?.value).toBe("");
  });

  it("failed: completeOAuth 의 redirectTo 로 보내고 draft 쿠키를 남긴다", async () => {
    completeOAuth.mockResolvedValue({ ...baseCallbackResult, redirectTo: "/home" });
    promoteDraft.mockResolvedValue({ kind: "failed" });

    const res = await GET(callbackRequest("draft=tok-1"), ctx());

    expect(res.headers.get("location")).toBe("http://localhost:3000/home");
    expect(res.cookies.get("draft")).toBeUndefined();
  });

  // 승격 결과가 무엇이든 로그인 자체는 항상 성공해야 한다 — 세션 쿠키가 항상 구워지는지 확인.
  it.each([
    { kind: "promoted" as const, id: "42" },
    { kind: "limit" as const },
    { kind: "none" as const },
    { kind: "failed" as const },
  ])("promoteDraft 결과가 $kind 여도 세션 쿠키는 항상 구워진다", async (promoteResult) => {
    completeOAuth.mockResolvedValue(baseCallbackResult);
    promoteDraft.mockResolvedValue(promoteResult);

    const res = await GET(callbackRequest("draft=tok-1"), ctx());

    const sessionCookie = res.cookies.get("session");
    expect(sessionCookie?.value).toBe("session-tok-1");
    expect(sessionCookie?.httpOnly).toBe(true);
  });
});
