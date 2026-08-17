import { describe, expect, it, vi } from "vitest";
import { handleCreateMatch } from "./handler";

const NONE = { type: null, subjectRole: null, counterpartRole: null };

const newCounterpart = {
  name: "상대", gender: "female", calendar: "solar", isLeapMonth: false,
  birth: { year: 1993, month: 4, day: 12 }, timeKnown: true,
  time: { hour: 10, minute: 0 }, birthPlace: null, trueSolar: true,
};

function deps(over: Partial<Parameters<typeof handleCreateMatch>[1]> = {}) {
  return {
    userId: "1",
    checkAccess: async () => ({ ok: true }) as const,
    getProfile: async (_u: string, id: string) => ({ id }),
    createProfile: async () => ({ id: "99" }),
    findOrCreate: async () => ({ id: "7", created: true }),
    ...over,
  };
}

describe("handleCreateMatch", () => {
  it("비로그인은 401 — 프로필을 들여다보기 전에 막는다", async () => {
    const getProfile = vi.fn();
    const r = await handleCreateMatch(
      { subjectProfileId: "2", counterpartProfileId: "3", relation: NONE },
      deps({
        userId: null,
        checkAccess: async () => ({ ok: false, reason: "unauthenticated" }),
        getProfile,
      }),
    );
    expect(r.status).toBe(401);
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("한도를 넘으면 429 — 프로필을 들여다보기 전에 막는다", async () => {
    const getProfile = vi.fn();
    const r = await handleCreateMatch(
      { subjectProfileId: "2", counterpartProfileId: "3", relation: NONE },
      deps({ checkAccess: async () => ({ ok: false, reason: "rate_limited" }), getProfile }),
    );
    expect(r.status).toBe(429);
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("body 가 어긋나면 400", async () => {
    expect((await handleCreateMatch({}, deps())).status).toBe(400);
  });

  it("유형과 역할이 어긋나면 400 — 검증은 relationInputSchema 가 한다", async () => {
    const r = await handleCreateMatch(
      { subjectProfileId: "2", counterpartProfileId: "3", relation: { type: "lover", subjectRole: "윗사람", counterpartRole: "아랫사람" } },
      deps(),
    );
    expect(r.status).toBe(400);
  });

  it("상대를 둘 다 주면 400 — 어느 쪽을 쓸지 서버가 짐작하지 않는다", async () => {
    const r = await handleCreateMatch(
      { subjectProfileId: "2", counterpartProfileId: "3", counterpart: newCounterpart, relation: NONE },
      deps(),
    );
    expect(r.status).toBe(400);
  });

  it("남의 프로필이면 404 — 없는 것과 구분하지 않는다", async () => {
    const r = await handleCreateMatch(
      { subjectProfileId: "2", counterpartProfileId: "3", relation: NONE },
      deps({ getProfile: async () => null }),
    );
    expect(r.status).toBe(404);
  });

  it("나와 상대가 같으면 400", async () => {
    const r = await handleCreateMatch(
      { subjectProfileId: "2", counterpartProfileId: "2", relation: NONE },
      deps(),
    );
    expect(r.status).toBe(400);
  });

  it("즉석 입력한 상대는 kind='other' 로 저장한다 — 내 목록에 새면 안 된다", async () => {
    const createProfile = vi.fn().mockResolvedValue({ id: "99" });
    await handleCreateMatch(
      { subjectProfileId: "2", counterpart: newCounterpart, relation: NONE },
      deps({ createProfile }),
    );
    expect(createProfile).toHaveBeenCalledWith("1", expect.objectContaining({ kind: "other" }));
  });

  it("클라이언트가 kind 를 보내도 무시한다 — 서버가 항상 'other' 로 덮어쓴다", async () => {
    const createProfile = vi.fn().mockResolvedValue({ id: "99" });
    await handleCreateMatch(
      { subjectProfileId: "2", counterpart: { ...newCounterpart, kind: "self" }, relation: NONE },
      deps({ createProfile }),
    );
    expect(createProfile).toHaveBeenCalledWith("1", expect.objectContaining({ kind: "other" }));
  });

  it("성공하면 matchId 를 낸다", async () => {
    const r = await handleCreateMatch(
      { subjectProfileId: "2", counterpartProfileId: "3", relation: NONE },
      deps(),
    );
    expect(r).toEqual({ status: 200, body: { matchId: "7" } });
  });
});
