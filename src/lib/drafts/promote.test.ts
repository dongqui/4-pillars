import { describe, it, expect, vi } from "vitest";
import { ProfileLimitError, type CreateProfileInput } from "@/lib/profiles/store";
import type { CreateProfileBody } from "@/lib/profiles/input";
import { promoteDraft } from "./promote";

const draft: CreateProfileBody = {
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

type Create = (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;

function deps(over: Partial<Parameters<typeof promoteDraft>[2]> = {}) {
  return {
    getDraft: vi.fn(async () => draft),
    createProfile: vi.fn<Create>(async () => ({ id: "42" })),
    deleteDraft: vi.fn(async () => {}),
    setPrimaryIfUnset: vi.fn(async () => {}),
    ...over,
  };
}

describe("promoteDraft", () => {
  it("토큰이 없으면 none 이고 아무것도 부르지 않는다", async () => {
    const d = deps();
    expect(await promoteDraft(null, "7", d)).toEqual({ kind: "none" });
    expect(d.getDraft).not.toHaveBeenCalled();
  });

  it("레코드가 없으면 none", async () => {
    const d = deps({ getDraft: vi.fn(async () => null) });
    expect(await promoteDraft("tok", "7", d)).toEqual({ kind: "none" });
    expect(d.createProfile).not.toHaveBeenCalled();
  });

  it("성공하면 프로필을 만들고 드래프트를 지운다", async () => {
    const d = deps();
    expect(await promoteDraft("tok", "7", d)).toEqual({ kind: "promoted", id: "42" });
    expect(d.createProfile).toHaveBeenCalledWith("7", { ...draft, kind: "saved" });
    expect(d.deleteDraft).toHaveBeenCalledWith("tok");
  });

  it("한도 초과는 limit — 드래프트를 지우지 않는다", async () => {
    const d = deps({
      createProfile: vi.fn<Create>(async () => {
        throw new ProfileLimitError();
      }),
    });
    expect(await promoteDraft("tok", "7", d)).toEqual({ kind: "limit" });
    expect(d.deleteDraft).not.toHaveBeenCalled();
  });

  // 로그인은 이미 성공한 뒤다. 여기서 throw 하면 세션 쿠키를 굽지 못하고 로그인 자체가 깨진다.
  it("DB 오류는 failed 로 삼키고 throw 하지 않는다", async () => {
    const d = deps({
      createProfile: vi.fn<Create>(async () => {
        throw new Error("db down");
      }),
    });
    expect(await promoteDraft("tok", "7", d)).toEqual({ kind: "failed" });
  });

  // 행은 이미 생겼다. 삭제 실패로 promoted 를 뒤집으면 다음 로그인에 중복 프로필이 생긴다.
  it("드래프트 삭제가 실패해도 promoted 다", async () => {
    const d = deps({
      deleteDraft: vi.fn(async () => {
        throw new Error("redis down");
      }),
    });
    expect(await promoteDraft("tok", "7", d)).toEqual({ kind: "promoted", id: "42" });
  });
});
