import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getSession: (...a: unknown[]) => getSession(...a),
}));

const createProfile = vi.fn();
// importOriginal 로 감싸는 이유: ProfileLimitError 는 handler.ts 가 instanceof 로 분기하는
// 실제 클래스여야 한다 — 통째로 목으로 바꾸면 다른 클래스가 되어 409 분기가 깨진다.
vi.mock("@/lib/profiles/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profiles/store")>()),
  createProfile: (...a: unknown[]) => createProfile(...a),
}));

const putDraft = vi.fn();
vi.mock("@/lib/drafts/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/drafts/store")>()),
  putDraft: (...a: unknown[]) => putDraft(...a),
}));

import { POST } from "./route";

const validBody = {
  name: "김동진",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1990, month: 10, day: 25 },
  timeKnown: true,
  time: { hour: 15, minute: 20 },
  birthPlace: { country: "KR", regionId: "seoul" },
  trueSolar: true,
};

function post(body: unknown, cookie?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new NextRequest("http://localhost/api/profiles", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/profiles", () => {
  beforeEach(() => {
    getSession.mockReset();
    createProfile.mockReset();
    putDraft.mockReset();
    putDraft.mockResolvedValue(undefined);
  });

  // 이 한 줄(session?.userId ?? null)이 profiles 테이블 전체의 테넌트 경계다 —
  // handler.test.ts는 "userId를 받으면 어떻게 되는가"만 증명하지, route.ts가
  // 실제 세션에서 그 userId를 제대로 꺼내는지는 증명하지 않는다.
  it("세션의 userId가 그대로 createProfile 로 전달된다", async () => {
    getSession.mockResolvedValue({ userId: "7", provider: "google" });
    createProfile.mockResolvedValue({ id: "42" });

    const res = await POST(post(validBody));

    expect(res.status).toBe(201);
    expect(createProfile).toHaveBeenCalledWith("7", expect.anything());
  });

  it("세션이 없으면 202 와 draft 쿠키를 굽고 createProfile 을 부르지 않는다", async () => {
    getSession.mockResolvedValue(null);

    const res = await POST(post(validBody));

    expect(res.status).toBe(202);
    expect(createProfile).not.toHaveBeenCalled();
    const cookie = res.cookies.get("draft");
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(putDraft).toHaveBeenCalledWith(cookie?.value, expect.objectContaining({ name: "김동진" }));
  });

  it("요청에 draft 쿠키가 있으면 그 토큰을 다시 쓴다", async () => {
    getSession.mockResolvedValue(null);

    // 쿠키 값은 HTTP 헤더라 ByteString(Latin-1)만 허용된다 — 실제 토큰(UUID)도
    // 언제나 ASCII이므로 테스트 값도 ASCII로 둔다.
    const res = await POST(post(validBody, "draft=prev-token"));

    expect(res.cookies.get("draft")?.value).toBe("prev-token");
    expect(putDraft.mock.calls[0][0]).toBe("prev-token");
  });

  it("로그인 상태면 draft 쿠키를 굽지 않는다", async () => {
    getSession.mockResolvedValue({ userId: "7", provider: "google" });
    createProfile.mockResolvedValue({ id: "42" });

    const res = await POST(post(validBody));

    expect(res.cookies.get("draft")).toBeUndefined();
  });

  it("본문이 JSON이 아니면 400", async () => {
    getSession.mockResolvedValue({ userId: "7", provider: "google" });

    const res = await POST(post("not json{"));

    expect(res.status).toBe(400);
    expect(createProfile).not.toHaveBeenCalled();
  });

  it("createProfile 이 한도 초과가 아닌 오류를 던지면 500", async () => {
    getSession.mockResolvedValue({ userId: "7", provider: "google" });
    createProfile.mockRejectedValue(new Error("db down"));

    const res = await POST(post(validBody));

    expect(res.status).toBe(500);
  });

  it("putDraft 가 실패하면 500 이고 쿠키를 굽지 않는다", async () => {
    getSession.mockResolvedValue(null);
    putDraft.mockRejectedValue(new Error("redis down"));

    const res = await POST(post(validBody));

    expect(res.status).toBe(500);
    expect(res.cookies.get("draft")).toBeUndefined();
  });
});
