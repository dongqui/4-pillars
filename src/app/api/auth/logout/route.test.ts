import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const deleteDraft = vi.fn();
vi.mock("@/lib/drafts/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/drafts/store")>()),
  deleteDraft: (...a: unknown[]) => deleteDraft(...a),
}));

import { POST } from "./route";

function logoutRequest(cookie?: string) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return new NextRequest("http://localhost:3000/api/auth/logout", {
    method: "POST",
    headers,
  });
}

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    deleteDraft.mockReset();
    deleteDraft.mockResolvedValue(undefined);
  });

  it("세션 쿠키를 지우고 /로 303 리다이렉트한다", async () => {
    const res = await POST(logoutRequest("session=tok"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
    expect(res.cookies.get("session")?.value).toBe("");
  });

  // 공유 브라우저 시나리오: draft 쿠키가 남아 있으면 다음 로그인 사용자에게 승격될 수 있다.
  it("draft 쿠키가 있으면 지우고 Redis 레코드도 deleteDraft 로 지운다", async () => {
    const res = await POST(logoutRequest("draft=tok-1"));
    expect(res.cookies.get("draft")?.value).toBe("");
    expect(deleteDraft).toHaveBeenCalledWith("tok-1");
  });

  it("draft 쿠키가 없으면 deleteDraft 를 부르지 않는다", async () => {
    const res = await POST(logoutRequest());
    expect(deleteDraft).not.toHaveBeenCalled();
    expect(res.status).toBe(303);
  });

  // promoteDraft 와 같은 이유: 삭제 실패가 로그아웃 자체를 막으면 안 된다.
  it("deleteDraft 가 실패해도 로그아웃은 303 으로 성공한다", async () => {
    deleteDraft.mockRejectedValue(new Error("redis down"));
    const res = await POST(logoutRequest("draft=tok-1"));
    expect(res.status).toBe(303);
    expect(res.cookies.get("session")?.value).toBe("");
    expect(res.cookies.get("draft")?.value).toBe("");
  });
});
