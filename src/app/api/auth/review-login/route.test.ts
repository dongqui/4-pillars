import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// 이 테스트는 자격 검증 → upsert → 세션 쿠키 → 행선지의 배선만 본다. DB 와 드래프트 저장소는 감춘다.
const upsertUser = vi.fn();
const setPrimaryProfileIfUnset = vi.fn();
vi.mock("@/lib/auth/users", () => ({
  upsertUser: (...a: unknown[]) => upsertUser(...a),
  setPrimaryProfileIfUnset: (...a: unknown[]) => setPrimaryProfileIfUnset(...a),
}));

// 샘플 프로필 시드가 실제 DB 에 붙지 않게 한다. 나머지 export(에러 클래스 등)는 그대로 둔다.
const countProfiles = vi.fn();
const createProfile = vi.fn();
vi.mock("@/lib/profiles/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profiles/store")>()),
  countProfiles: (...a: unknown[]) => countProfiles(...a),
  createProfile: (...a: unknown[]) => createProfile(...a),
}));

const promoteDraft = vi.fn();
vi.mock("@/lib/drafts/promote", () => ({
  promoteDraft: (...a: unknown[]) => promoteDraft(...a),
}));

const redisIncr = vi.fn();
const redisExpire = vi.fn();
vi.mock("@/lib/redis", () => ({
  redis: {
    incr: (...a: unknown[]) => redisIncr(...a),
    expire: (...a: unknown[]) => redisExpire(...a),
  },
}));

import { POST } from "./route";
import { decodeSession } from "@/lib/auth/session";

const ORIGIN = "http://localhost:3000";
const GOOD = { id: "pgreview", password: "dummy-Pass#1" };

function loginRequest(
  fields: Record<string, string>,
  opts: { cookie?: string; origin?: string; forwardedFor?: string } = {},
): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
  };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.origin) headers.origin = opts.origin;
  if (opts.forwardedFor) headers["x-forwarded-for"] = opts.forwardedFor;
  return new NextRequest(`${ORIGIN}/api/auth/review-login`, {
    method: "POST",
    headers,
    body: new URLSearchParams(fields).toString(),
  });
}

describe("POST /api/auth/review-login", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ORIGIN", ORIGIN);
    vi.stubEnv("AUTH_SESSION_SECRET", "test-secret-test-secret-test-secret");
    vi.stubEnv("REVIEW_LOGIN_ID", "pgreview");
    vi.stubEnv("REVIEW_LOGIN_PASSWORD", "dummy-Pass#1");
    vi.stubEnv("REVIEW_LOGIN_EMAIL", "guest@example.com");
    upsertUser.mockReset().mockResolvedValue({ id: "9" });
    promoteDraft.mockReset().mockResolvedValue({ kind: "none" });
    redisIncr.mockReset().mockResolvedValue(1);
    redisExpire.mockReset().mockResolvedValue(1);
    setPrimaryProfileIfUnset.mockReset().mockResolvedValue(undefined);
    countProfiles.mockReset().mockResolvedValue(0);
    createProfile.mockReset().mockResolvedValue({ id: "77" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // 심사가 끝나 env 를 지우면, 코드를 걷기 전이라도 입구는 닫혀 있어야 한다.
  it("env 가 없으면 404 — 맞는 자격을 보내도 아무 일도 하지 않는다", async () => {
    vi.stubEnv("REVIEW_LOGIN_PASSWORD", "");
    const res = await POST(loginRequest(GOOD));
    expect(res.status).toBe(404);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  // config 는 있어도 origin 이 없으면 안전한 리다이렉트 URL 을 만들 수 없다.
  it("APP_ORIGIN 이 없으면 500 — 자격이 맞아도 아무 일도 하지 않는다", async () => {
    vi.stubEnv("APP_ORIGIN", "");
    const res = await POST(loginRequest(GOOD));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("auth not configured");
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it("비밀번호가 틀리면 /login?error=review 로 보내고 세션을 굽지 않는다", async () => {
    const res = await POST(loginRequest({ ...GOOD, password: "nope" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login?error=review`);
    expect(res.cookies.get("session")).toBeUndefined();
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it("틀렸을 때 next 를 잃지 않는다 — 다시 입력하면 원래 가려던 곳으로 간다", async () => {
    const res = await POST(loginRequest({ ...GOOD, password: "nope", next: "/checkout" }));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login?error=review&next=%2Fcheckout`);
  });

  it("필드가 빠진 요청도 같은 실패로 접는다", async () => {
    const res = await POST(loginRequest({ id: "pgreview" }));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login?error=review`);
  });

  it("맞으면 provider=admin 로 upsert 하고 세션 쿠키를 굽는다", async () => {
    const res = await POST(loginRequest(GOOD));

    expect(upsertUser).toHaveBeenCalledWith({
      provider: "admin",
      providerUserId: "pgreview",
      email: "guest@example.com",
      displayName: "심사용 계정",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/home`);
    expect(await decodeSession(res.cookies.get("session")?.value)).toEqual({
      userId: "9",
      provider: "admin",
    });
  });

  // /login 은 last_provider 로 "최근 로그인" 배지를 단다. review 에는 달 버튼이 없다.
  it("last_provider 쿠키는 심지 않는다", async () => {
    const res = await POST(loginRequest(GOOD));
    expect(res.cookies.get("last_provider")).toBeUndefined();
  });

  it("내부 next 는 따르고, 외부 URL 은 /home 으로 접는다 — 오픈 리다이렉트 방어", async () => {
    const inner = await POST(loginRequest({ ...GOOD, next: "/checkout?plan=yearly" }));
    expect(inner.headers.get("location")).toBe(`${ORIGIN}/checkout?plan=yearly`);

    const outer = await POST(loginRequest({ ...GOOD, next: "https://evil.example" }));
    expect(outer.headers.get("location")).toBe(`${ORIGIN}/home`);
  });

  // 담당자가 생년월일부터 넣고 로그인해도 소셜 로그인과 똑같이 리포트로 이어져야 한다.
  it("드래프트가 승격되면 /report?profile=<id> 로 보내고 draft 쿠키를 지운다", async () => {
    promoteDraft.mockResolvedValue({ kind: "promoted", id: "42" });
    const res = await POST(loginRequest(GOOD, { cookie: "draft=tok-1" }));

    expect(promoteDraft).toHaveBeenCalledWith("tok-1", "9", expect.anything());
    expect(res.headers.get("location")).toBe(`${ORIGIN}/report?profile=42`);
    expect(res.cookies.get("draft")?.value).toBe("");
  });

  it("한도 초과면 /home?error=limit 로 보내고 draft 쿠키를 남긴다", async () => {
    promoteDraft.mockResolvedValue({ kind: "limit" });
    const res = await POST(loginRequest(GOOD, { cookie: "draft=tok-1" }));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/home?error=limit`);
    expect(res.cookies.get("draft")).toBeUndefined();
  });

  // 비밀번호가 담당자들 사이에 도는 공용 계정이다. 남의 사이트가 방문자를 이 계정으로
  // 로그인시켜 놓으면, 그 사람이 넣은 생년월일을 비밀번호를 아는 누구나 본다.
  it("다른 출처에서 온 폼은 로그인시키지 않고 정식 주소의 /login 으로 돌려보낸다", async () => {
    const res = await POST(loginRequest(GOOD, { origin: "https://evil.example" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login`);
    expect(res.cookies.get("session")).toBeUndefined();
    expect(upsertUser).not.toHaveBeenCalled();
    // Origin 검사가 리미터보다 앞이다 — 여기서는 시도 횟수를 세지 않는다.
    expect(redisIncr).not.toHaveBeenCalled();
  });

  it("같은 출처의 Origin 헤더는 통과한다", async () => {
    const res = await POST(loginRequest(GOOD, { origin: ORIGIN }));
    expect(res.status).toBe(303);
  });

  // 비밀번호가 짧고 담당자들 사이에 돈다 — 온라인 대입을 IP 당 10분에 10번으로 묶는다.
  it("11번째 시도는 맞는 자격이어도 /login?error=throttled 로 보낸다", async () => {
    redisIncr.mockResolvedValue(11);
    const res = await POST(loginRequest(GOOD));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login?error=throttled`);
    expect(upsertUser).not.toHaveBeenCalled();
    expect(res.cookies.get("session")).toBeUndefined();
  });

  it("10번째까지는 통과한다", async () => {
    redisIncr.mockResolvedValue(10);
    const res = await POST(loginRequest(GOOD));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/home`);
  });

  it("첫 시도에만 만료를 건다 — IP 는 x-forwarded-for 의 첫 값을 쓴다", async () => {
    redisIncr.mockResolvedValue(1);
    await POST(loginRequest(GOOD, { forwardedFor: "203.0.113.7, 10.0.0.1" }));
    expect(redisExpire).toHaveBeenCalledWith("review-login:attempts:203.0.113.7", 600);

    redisExpire.mockClear();
    redisIncr.mockResolvedValue(2);
    await POST(loginRequest(GOOD, { forwardedFor: "203.0.113.7, 10.0.0.1" }));
    expect(redisExpire).not.toHaveBeenCalled();
  });

  it("Redis 가 던져도 로그인은 된다", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    redisIncr.mockRejectedValue(new Error("upstash down"));
    const res = await POST(loginRequest(GOOD));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/home`);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  // 어느 쪽으로 들어와도 같은 계정이어야 한다 — 이메일로 들어왔다고 users 행이 하나 더 생기면
  // 담당자가 저장한 프로필이 두 계정으로 갈린다.
  it("이메일로 로그인해도 같은 계정(providerUserId = 아이디)으로 upsert 한다", async () => {
    const res = await POST(loginRequest({ id: "Guest@Example.com", password: "dummy-Pass#1" }));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/home`);
    expect(upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "admin", providerUserId: "pgreview" }),
    );
  });

  it("프로필이 없는 계정에는 샘플 프로필을 넣고 '나' 로 정한다", async () => {
    const res = await POST(loginRequest(GOOD));

    expect(countProfiles).toHaveBeenCalledWith("9", "saved");
    expect(createProfile).toHaveBeenCalledWith(
      "9",
      expect.objectContaining({ name: "홍길동", kind: "saved" }),
    );
    expect(setPrimaryProfileIfUnset).toHaveBeenCalledWith("9", "77");
    // 행선지는 그대로다 — 샘플은 홈에 서 있으면 된다.
    expect(res.headers.get("location")).toBe(`${ORIGIN}/home`);
  });

  it("이미 프로필이 있으면 샘플을 더 넣지 않는다", async () => {
    countProfiles.mockResolvedValue(2);
    await POST(loginRequest(GOOD));
    expect(createProfile).not.toHaveBeenCalled();
  });

  // 담당자가 직접 넣은 생년월일이 방금 프로필이 됐다 — 그 옆에 홍길동을 세우지 않는다.
  it("드래프트가 승격됐으면 샘플을 넣지 않는다", async () => {
    promoteDraft.mockResolvedValue({ kind: "promoted", id: "42" });
    await POST(loginRequest(GOOD, { cookie: "draft=tok-1" }));
    expect(countProfiles).not.toHaveBeenCalled();
    expect(createProfile).not.toHaveBeenCalled();
  });

  it("샘플을 넣다 실패해도 로그인은 된다", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    createProfile.mockRejectedValue(new Error("db down"));
    const res = await POST(loginRequest(GOOD));

    expect(res.status).toBe(303);
    expect(res.cookies.get("session")?.value).toBeTruthy();
    consoleError.mockRestore();
  });

  it("자격이 틀리면 샘플도 없다", async () => {
    await POST(loginRequest({ ...GOOD, password: "nope" }));
    expect(countProfiles).not.toHaveBeenCalled();
  });
});
