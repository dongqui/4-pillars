import { describe, it, expect, vi } from "vitest";
import { ProfileLimitError, type CreateProfileInput } from "@/lib/profiles/store";
import type { CreateProfileBody } from "@/lib/profiles/input";
import { handleCreateProfile } from "./handler";

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

type Create = (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;
type SaveDraft = (token: string, body: CreateProfileBody) => Promise<void>;

/**
 * 제네릭으로 타입을 박아야 mock.calls[0][1] 이 좁혀진다 —
 * vi.fn(async () => ...) 로 두면 인자가 0개인 목이라 [1] 인덱싱이 타입 오류가 난다.
 */
const okCreate = () => vi.fn<Create>(async () => ({ id: "42" }));
const okSaveDraft = () => vi.fn<SaveDraft>(async () => {});

function baseDeps(over: Partial<Parameters<typeof handleCreateProfile>[1]> = {}) {
  return {
    userId: "7" as string | null,
    create: okCreate(),
    saveDraft: okSaveDraft(),
    newToken: () => "새토큰",
    existingToken: null as string | null,
    ...over,
  };
}

describe("handleCreateProfile", () => {
  it("정상 입력이면 201 과 id", async () => {
    const create = okCreate();
    const res = await handleCreateProfile(validBody, baseDeps({ create }));
    expect(res).toEqual({ status: 201, body: { id: "42" } });
    expect(create).toHaveBeenCalledWith("7", expect.objectContaining({ name: "김동진" }));
  });

  it("본문이 객체가 아니면 400", async () => {
    const res = await handleCreateProfile(null, baseDeps());
    expect(res.status).toBe(400);
  });

  it("이름이 비면 400", async () => {
    const res = await handleCreateProfile({ ...validBody, name: "   " }, baseDeps());
    expect(res.status).toBe(400);
  });

  it("범위를 벗어난 생년은 400", async () => {
    const res = await handleCreateProfile(
      { ...validBody, birth: { year: 1800, month: 1, day: 1 } },
      baseDeps(),
    );
    expect(res.status).toBe(400);
  });

  it("시간을 모른다고 하면 time 을 버리고 저장한다", async () => {
    const create = okCreate();
    await handleCreateProfile({ ...validBody, timeKnown: false }, baseDeps({ create }));
    expect(create.mock.calls[0][1].time).toBeNull();
  });

  it("양력이면 윤달 표시를 버린다", async () => {
    const create = okCreate();
    await handleCreateProfile(
      { ...validBody, calendar: "solar", isLeapMonth: true },
      baseDeps({ create }),
    );
    expect(create.mock.calls[0][1].isLeapMonth).toBe(false);
  });

  it("한도를 넘으면 409", async () => {
    const create = vi.fn<Create>(async () => {
      throw new ProfileLimitError();
    });
    const res = await handleCreateProfile(validBody, baseDeps({ create }));
    expect(res).toEqual({ status: 409, body: { error: "limit" } });
  });

  it("그 밖의 저장 오류는 상위로 던진다", async () => {
    const create = vi.fn<Create>(async () => {
      throw new Error("db down");
    });
    await expect(handleCreateProfile(validBody, baseDeps({ create }))).rejects.toThrow(
      "db down",
    );
  });

  it("세션이 없으면 202 와 새 드래프트 토큰, DB 저장은 하지 않는다", async () => {
    const create = okCreate();
    const saveDraft = okSaveDraft();
    const res = await handleCreateProfile(
      validBody,
      baseDeps({ userId: null, create, saveDraft }),
    );
    expect(res.status).toBe(202);
    expect(res.draftToken).toBe("새토큰");
    expect(create).not.toHaveBeenCalled();
    expect(saveDraft).toHaveBeenCalledWith("새토큰", expect.objectContaining({ name: "김동진" }));
  });

  // 매번 새로 발급하면 손잡이 없는 레코드가 TTL 동안 Redis 에 쌓인다.
  it("이미 드래프트 쿠키가 있으면 그 토큰에 덮어쓴다", async () => {
    const saveDraft = okSaveDraft();
    const res = await handleCreateProfile(
      validBody,
      baseDeps({ userId: null, saveDraft, existingToken: "이전토큰" }),
    );
    expect(res.draftToken).toBe("이전토큰");
    expect(saveDraft.mock.calls[0][0]).toBe("이전토큰");
  });

  it("드래프트에도 정합화가 걸린다 (시간 모름 → time 버림)", async () => {
    const saveDraft = okSaveDraft();
    await handleCreateProfile(
      { ...validBody, timeKnown: false },
      baseDeps({ userId: null, saveDraft }),
    );
    expect(saveDraft.mock.calls[0][1].time).toBeNull();
  });

  it("비로그인이어도 본문이 틀리면 400 이고 드래프트를 남기지 않는다", async () => {
    const saveDraft = okSaveDraft();
    const res = await handleCreateProfile(null, baseDeps({ userId: null, saveDraft }));
    expect(res.status).toBe(400);
    expect(saveDraft).not.toHaveBeenCalled();
  });
});
