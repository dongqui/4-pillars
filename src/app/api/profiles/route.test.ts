import { describe, it, expect, vi, beforeEach } from "vitest";

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

function post(body: unknown) {
  return new Request("http://localhost/api/profiles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/profiles", () => {
  beforeEach(() => {
    getSession.mockReset();
    createProfile.mockReset();
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

  it("세션이 없으면 401 이고 createProfile 을 부르지 않는다", async () => {
    getSession.mockResolvedValue(null);

    const res = await POST(post(validBody));

    expect(res.status).toBe(401);
    expect(createProfile).not.toHaveBeenCalled();
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
});
