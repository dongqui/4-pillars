import { describe, expect, it, vi } from "vitest";
import { MATCH_HOURLY_LIMIT, checkMatchLimit } from "./rate-limit";

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
