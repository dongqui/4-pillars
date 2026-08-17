import { describe, expect, it, vi } from "vitest";
import { MATCH_HOURLY_LIMIT, checkMatchLimit, peekMatchLimit } from "./rate-limit";

const client = (incr: () => Promise<number>) => ({
  incr,
  expire: vi.fn().mockResolvedValue(1),
});

describe("checkMatchLimit", () => {
  it("한도 안이면 통과", async () => {
    expect(await checkMatchLimit("7", client(async () => MATCH_HOURLY_LIMIT))).toBe(true);
  });

  it("한도를 넘으면 막는다", async () => {
    expect(await checkMatchLimit("7", client(async () => MATCH_HOURLY_LIMIT + 1))).toBe(false);
  });

  it("Redis 가 죽으면 막는다 (fail-closed) — 열어 두면 곧바로 무제한 LLM 호출이다", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await checkMatchLimit("7", client(async () => { throw new Error("down"); }))).toBe(false);
    spy.mockRestore();
  });

  it("키는 userId 로 갈린다", async () => {
    const incr = vi.fn().mockResolvedValue(1);
    await checkMatchLimit("7", { incr, expire: vi.fn().mockResolvedValue(1) });
    expect(incr).toHaveBeenCalledWith("match:user:7");
  });

  it("expire 실패는 삼킨다 — 판단은 이미 정해졌다", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ok = await checkMatchLimit("7", {
      incr: async () => 1,
      expire: async () => { throw new Error("nope"); },
    });
    expect(ok).toBe(true);
    spy.mockRestore();
  });
});

describe("peekMatchLimit", () => {
  const reader = (get: () => Promise<unknown>) => ({ get });

  it("아직 아무것도 안 만들었으면(키 없음) 통과", async () => {
    expect(await peekMatchLimit("7", reader(async () => null))).toBe(true);
  });

  it("한 장 남았으면 통과 — checkMatchLimit 이 올릴 n+1 이 아직 한도 안이다", async () => {
    expect(await peekMatchLimit("7", reader(async () => MATCH_HOURLY_LIMIT - 1))).toBe(true);
  });

  it("이미 한도만큼 썼으면 막는다", async () => {
    expect(await peekMatchLimit("7", reader(async () => MATCH_HOURLY_LIMIT))).toBe(false);
  });

  it("문자열로 돌아온 카운터도 숫자로 읽는다 — REST 드라이버가 문자열을 준다", async () => {
    expect(await peekMatchLimit("7", reader(async () => String(MATCH_HOURLY_LIMIT)))).toBe(false);
  });

  it("Redis 가 죽으면 막는다 (fail-closed) — 실제 게이트도 막을 것이라 만들어 둬도 못 본다", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await peekMatchLimit("7", reader(async () => { throw new Error("down"); }))).toBe(false);
    spy.mockRestore();
  });

  it("읽기만 한다 — 키를 한 번 get 하고 끝이다(차감은 생성하는 자리에서)", async () => {
    const get = vi.fn().mockResolvedValue(null);
    await peekMatchLimit("7", { get });
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith("match:user:7");
  });
});
