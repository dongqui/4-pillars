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
type DropDraft = (token: string) => Promise<void>;
type SetPrimary = (userId: string, profileId: string) => Promise<void>;

/**
 * 제네릭으로 타입을 박아야 mock.calls[0][1] 이 좁혀진다 —
 * vi.fn(async () => ...) 로 두면 인자가 0개인 목이라 [1] 인덱싱이 타입 오류가 난다.
 */
const okCreate = () => vi.fn<Create>(async () => ({ id: "42" }));
const okSaveDraft = () => vi.fn<SaveDraft>(async () => {});
const okDropDraft = () => vi.fn<DropDraft>(async () => {});
const okSetPrimary = () => vi.fn<SetPrimary>(async () => {});

// 유효한 UUID 형식 — 진짜 토큰(crypto.randomUUID())과 같은 모양이어야 형식 검증을 통과한다.
const VALID_TOKEN = "b3b1c9b0-6f2e-4c3a-9b3e-2a1f0c8d7e6f";

function baseDeps(over: Partial<Parameters<typeof handleCreateProfile>[1]> = {}) {
  return {
    userId: "7" as string | null,
    create: okCreate(),
    saveDraft: okSaveDraft(),
    newToken: () => "새토큰",
    existingToken: null as string | null,
    dropDraft: okDropDraft(),
    setPrimaryIfUnset: okSetPrimary(),
    ...over,
  };
}

describe("handleCreateProfile", () => {
  // 계정의 첫 저장 프로필이 "나" 가 된다. 이 호출이 빠지면 primary 가 영영 null 로
  // 남고, 상담·지도가 다시 휴리스틱(최신 / 가장 오래된 것)으로 물러선다.
  it("저장한 프로필이면 '나' 후보로 올린다", async () => {
    const setPrimaryIfUnset = okSetPrimary();
    await handleCreateProfile(validBody, baseDeps({ setPrimaryIfUnset }));
    expect(setPrimaryIfUnset).toHaveBeenCalledWith("7", "42");
  });

  // 이번 한 번만 쓰겠다고 한 사람을 나로 삼을 수 없다.
  it("temp 는 '나' 후보가 아니다", async () => {
    const setPrimaryIfUnset = okSetPrimary();
    await handleCreateProfile({ ...validBody, saved: false }, baseDeps({ setPrimaryIfUnset }));
    expect(setPrimaryIfUnset).not.toHaveBeenCalled();
  });

  // 프로필은 이미 만들어졌다. 여기서 201 을 뒤집으면 사용자는 저장에 실패한 줄 알고
  // 같은 사람을 한 번 더 넣는다 — "나" 는 소비하는 쪽이 null 로 물러설 수 있다.
  it("'나' 지정이 실패해도 201 을 뒤집지 않는다", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleCreateProfile(
      validBody,
      baseDeps({
        setPrimaryIfUnset: vi.fn<SetPrimary>(async () => {
          throw new Error("db down");
        }),
      }),
    );
    expect(res.status).toBe(201);
    spy.mockRestore();
  });

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
      baseDeps({ userId: null, saveDraft, existingToken: VALID_TOKEN }),
    );
    expect(res.draftToken).toBe(VALID_TOKEN);
    expect(saveDraft.mock.calls[0][0]).toBe(VALID_TOKEN);
  });

  // 쿠키에서 온 값이 그대로 Redis 키가 된다 — 형식이 깨졌으면 쓰레기 키를 만들지 말고
  // 정상 갈래(새 토큰 발급)로 흘린다. 에러가 아니다.
  it("existingToken 형식이 UUID 가 아니면 새 토큰을 발급한다", async () => {
    const saveDraft = okSaveDraft();
    const res = await handleCreateProfile(
      validBody,
      baseDeps({ userId: null, saveDraft, existingToken: "이전토큰" }),
    );
    expect(res.draftToken).toBe("새토큰");
    expect(saveDraft.mock.calls[0][0]).toBe("새토큰");
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

  // limit 으로 남겨둔 드래프트가 있는 채로 프로필을 지우고 퍼널을 다시 돌면 201 로
  // 저장되는데, 옛 드래프트를 안 지우면 다음 로그인에 한 번 더 승격돼 중복 프로필이 생긴다.
  it("로그인 + existingToken 있음 → dropDraft 가 호출되고 쿠키 삭제 신호가 실린다", async () => {
    const dropDraft = okDropDraft();
    const res = await handleCreateProfile(
      validBody,
      baseDeps({ userId: "7", existingToken: VALID_TOKEN, dropDraft }),
    );
    expect(res).toEqual({ status: 201, body: { id: "42" }, clearDraftCookie: true });
    expect(dropDraft).toHaveBeenCalledWith(VALID_TOKEN);
  });

  // 프로필은 이미 만들어졌다 — 정리 실패로 201 자체를 뒤집으면 안 된다.
  it("dropDraft 가 실패해도 201은 그대로 나간다", async () => {
    const dropDraft = vi.fn<DropDraft>(async () => {
      throw new Error("redis down");
    });
    const res = await handleCreateProfile(
      validBody,
      baseDeps({ userId: "7", existingToken: VALID_TOKEN, dropDraft }),
    );
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "42" });
  });

  it("existingToken 이 없으면 dropDraft 를 부르지 않고 쿠키 삭제 신호도 없다", async () => {
    const dropDraft = okDropDraft();
    const res = await handleCreateProfile(validBody, baseDeps({ userId: "7", dropDraft }));
    expect(dropDraft).not.toHaveBeenCalled();
    expect(res.clearDraftCookie).toBeUndefined();
  });
});
