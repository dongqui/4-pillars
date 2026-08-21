import { describe, expect, it, vi } from "vitest";
import { CounterpartLimitError } from "@/lib/profiles/store";
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

  // rate_limited(429)와 다른 코드여야 한다 — 한도는 기다리면 풀리지만 잔액 부족은
  // 충전이 필요해, 화면이 두 상황을 구분해서 안내해야 한다.
  it("이용권이 부족하면 402 — 프로필을 들여다보기 전에 막는다", async () => {
    const getProfile = vi.fn();
    const r = await handleCreateMatch(
      { subjectProfileId: "2", counterpartProfileId: "3", relation: NONE },
      deps({
        checkAccess: async () => ({ ok: false, reason: "insufficient_tickets" }),
        getProfile,
      }),
    );
    expect(r.status).toBe(402);
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

  // 오래된 클라이언트 빌드가 우연히 밟는 쪽은 이 절반이다 — 상대를 아예 안 싣는 경우.
  it("상대를 둘 다 안 주면 400 — 궁합은 상대 없이 성립하지 않는다", async () => {
    const findOrCreate = vi.fn();
    const r = await handleCreateMatch(
      { subjectProfileId: "2", relation: NONE },
      deps({ findOrCreate }),
    );
    expect(r.status).toBe(400);
    expect(findOrCreate).not.toHaveBeenCalled();
  });

  it("궁합 상대 상한에 걸리면 409 로 그 이유를 말한다 — 500 이 아니다", async () => {
    const r = await handleCreateMatch(
      { subjectProfileId: "2", counterpart: newCounterpart, relation: NONE },
      deps({
        createProfile: async () => {
          throw new CounterpartLimitError();
        },
      }),
    );
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ error: new CounterpartLimitError().message });
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

  it("즉석 입력한 상대는 저장하기로 했으면 kind='saved' 다", async () => {
    const createProfile = vi.fn().mockResolvedValue({ id: "99" });
    await handleCreateMatch(
      { subjectProfileId: "2", counterpart: newCounterpart, relation: NONE },
      deps({ createProfile }),
    );
    expect(createProfile).toHaveBeenCalledWith("1", expect.objectContaining({ kind: "saved" }));
  });

  it("클라이언트가 kind 를 보내도 무시한다 — 서버가 saveCounterpart 로만 정한다", async () => {
    const createProfile = vi.fn().mockResolvedValue({ id: "99" });
    await handleCreateMatch(
      { subjectProfileId: "2", counterpart: { ...newCounterpart, kind: "saved" }, relation: NONE },
      deps({ createProfile }),
    );
    expect(createProfile).toHaveBeenCalledWith("1", expect.objectContaining({ kind: "saved" }));
  });

  // kind 를 클라이언트가 정하지는 못하지만, 'other' 냐 'temp' 냐는 사용자의 선택이다 —
  // 입력 폼의 "이 사람 프로필 저장하기" 가 형제 필드로 실려 온다.
  it("저장하지 않기로 한 상대는 kind='temp' — 다음 목록에 서지 않는다", async () => {
    const createProfile = vi.fn().mockResolvedValue({ id: "99" });
    await handleCreateMatch(
      {
        subjectProfileId: "2",
        counterpart: newCounterpart,
        saveCounterpart: false,
        relation: NONE,
      },
      deps({ createProfile }),
    );
    expect(createProfile).toHaveBeenCalledWith("1", expect.objectContaining({ kind: "temp" }));
  });

  // 이 값을 안 싣는 옛 클라이언트가 상대를 조용히 잃어버리면 안 된다.
  it("saveCounterpart 를 안 실으면 저장하는 쪽이 기본이다", async () => {
    const createProfile = vi.fn().mockResolvedValue({ id: "99" });
    await handleCreateMatch(
      { subjectProfileId: "2", counterpart: newCounterpart, relation: NONE },
      deps({ createProfile }),
    );
    expect(createProfile).toHaveBeenCalledWith("1", expect.objectContaining({ kind: "saved" }));
  });

  // 본문에 kind 를 심어 'temp' 를 우회하려 해도 통하지 않는다 — 스키마가 벗겨낸다.
  it("본문의 kind 는 saveCounterpart 를 이기지 못한다", async () => {
    const createProfile = vi.fn().mockResolvedValue({ id: "99" });
    await handleCreateMatch(
      {
        subjectProfileId: "2",
        counterpart: { ...newCounterpart, kind: "saved" },
        saveCounterpart: false,
        relation: NONE,
      },
      deps({ createProfile }),
    );
    expect(createProfile).toHaveBeenCalledWith("1", expect.objectContaining({ kind: "temp" }));
  });

  it("성공하면 matchId 를 낸다", async () => {
    const r = await handleCreateMatch(
      { subjectProfileId: "2", counterpartProfileId: "3", relation: NONE },
      deps(),
    );
    expect(r).toEqual({ status: 200, body: { matchId: "7" } });
  });
});
