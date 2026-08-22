import { describe, expect, it, vi } from "vitest";
import type { ProfileRow } from "@/lib/profiles/store";

const listProfiles = vi.fn();
const getUser = vi.fn();
vi.mock("@/lib/profiles/store", () => ({ listProfiles: (...a: unknown[]) => listProfiles(...a) }));
vi.mock("@/lib/auth/users", () => ({ getUser: (...a: unknown[]) => getUser(...a) }));

const { defaultConsultationSubject } = await import("./subject");

const row = (id: string): ProfileRow => ({
  id, name: `사람${id}`, gender: "male", calendar: "solar", isLeapMonth: false,
  birth: { year: 1990, month: 1, day: 1 }, timeKnown: false, time: null,
  birthPlace: null, trueSolar: true, createdAt: "2026-01-01", isUnlocked: false, kind: "saved",
});

// listProfiles 는 최신순(created_at DESC)이다 — 앞이 최신, 뒤가 가장 오래된 것.
const NEWEST_FIRST = [row("3"), row("2"), row("1")];

describe("defaultConsultationSubject", () => {
  it("정해진 '나' 를 고른다 — 마지막에 저장한 사람이 아니다", async () => {
    listProfiles.mockResolvedValue(NEWEST_FIRST);
    getUser.mockResolvedValue({ id: "7", displayName: null, primaryProfileId: "2" });

    expect((await defaultConsultationSubject("7"))?.id).toBe("2");
  });

  // 예전에는 여기가 [0](최신)이었다. 홈에서 어머니를 저장하면 상담사가 어머니의
  // 원국을 근거로 나에게 말하기 시작했다 — 물러설 때도 그 자리로 돌아가면 안 된다.
  it("'나' 가 없으면 가장 오래된 프로필로 물러선다 — 최신이 아니다", async () => {
    listProfiles.mockResolvedValue(NEWEST_FIRST);
    getUser.mockResolvedValue({ id: "7", displayName: null, primaryProfileId: null });

    expect((await defaultConsultationSubject("7"))?.id).toBe("1");
  });

  // primary 가 가리키는 행이 목록에 없을 수 있다: temp 로 바뀌었거나 지워진 뒤
  // ON DELETE SET NULL 이 아직 반영되지 않은 경우. 없는 것으로 치고 물러선다.
  it("'나' 가 목록에 없으면 없는 것으로 치고 물러선다", async () => {
    listProfiles.mockResolvedValue(NEWEST_FIRST);
    getUser.mockResolvedValue({ id: "7", displayName: null, primaryProfileId: "99" });

    expect((await defaultConsultationSubject("7"))?.id).toBe("1");
  });

  it("프로필이 하나도 없으면 undefined — 호출자가 409 로 되돌린다", async () => {
    listProfiles.mockResolvedValue([]);
    getUser.mockResolvedValue({ id: "7", displayName: null, primaryProfileId: null });

    expect(await defaultConsultationSubject("7")).toBeUndefined();
  });
});
