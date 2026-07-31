import { describe, it, expect, vi } from "vitest";
import { ProfileLimitError, type CreateProfileInput } from "@/lib/profiles/store";
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

/**
 * 제네릭으로 타입을 박아야 mock.calls[0][1] 이 CreateProfileInput 으로 좁혀진다 —
 * vi.fn(async () => ...) 로 두면 인자가 0개인 목이라 [1] 인덱싱이 타입 오류가 난다.
 */
const okCreate = () => vi.fn<Create>(async () => ({ id: "42" }));

describe("handleCreateProfile", () => {
  it("세션이 없으면 401 이고 저장을 시도하지 않는다", async () => {
    const create = okCreate();
    const res = await handleCreateProfile(validBody, { userId: null, create });
    expect(res.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("정상 입력이면 201 과 id", async () => {
    const create = okCreate();
    const res = await handleCreateProfile(validBody, { userId: "7", create });
    expect(res).toEqual({ status: 201, body: { id: "42" } });
    expect(create).toHaveBeenCalledWith("7", expect.objectContaining({ name: "김동진" }));
  });

  it("본문이 객체가 아니면 400", async () => {
    const res = await handleCreateProfile(null, { userId: "7", create: okCreate() });
    expect(res.status).toBe(400);
  });

  it("이름이 비면 400", async () => {
    const res = await handleCreateProfile(
      { ...validBody, name: "   " },
      { userId: "7", create: okCreate() },
    );
    expect(res.status).toBe(400);
  });

  it("범위를 벗어난 생년은 400", async () => {
    const res = await handleCreateProfile(
      { ...validBody, birth: { year: 1800, month: 1, day: 1 } },
      { userId: "7", create: okCreate() },
    );
    expect(res.status).toBe(400);
  });

  it("시간을 모른다고 하면 time 을 버리고 저장한다", async () => {
    const create = okCreate();
    await handleCreateProfile(
      { ...validBody, timeKnown: false },
      { userId: "7", create },
    );
    expect(create.mock.calls[0][1].time).toBeNull();
  });

  it("양력이면 윤달 표시를 버린다", async () => {
    const create = okCreate();
    await handleCreateProfile(
      { ...validBody, calendar: "solar", isLeapMonth: true },
      { userId: "7", create },
    );
    expect(create.mock.calls[0][1].isLeapMonth).toBe(false);
  });

  it("한도를 넘으면 409", async () => {
    const create = vi.fn<Create>(async () => {
      throw new ProfileLimitError();
    });
    const res = await handleCreateProfile(validBody, { userId: "7", create });
    expect(res).toEqual({ status: 409, body: { error: "limit" } });
  });

  it("그 밖의 저장 오류는 상위로 던진다", async () => {
    const create = vi.fn<Create>(async () => {
      throw new Error("db down");
    });
    await expect(
      handleCreateProfile(validBody, { userId: "7", create }),
    ).rejects.toThrow("db down");
  });
});
