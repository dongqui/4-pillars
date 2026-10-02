import { describe, expect, it, vi } from "vitest";
import { SUPPORT_LIMIT, checkSupportLimit } from "./rate-limit";

function fakeClient(n: number | Error) {
  return {
    incr: vi.fn(async () => {
      if (n instanceof Error) throw n;
      return n;
    }),
    expire: vi.fn(async () => 1),
  };
}

describe("checkSupportLimit", () => {
  it("한도 안이면 true, 키는 사용자별", async () => {
    const c = fakeClient(SUPPORT_LIMIT);
    expect(await checkSupportLimit("7", c)).toBe(true);
    expect(c.incr).toHaveBeenCalledWith("support:user:7");
  });

  it("한도를 넘으면 false", async () => {
    expect(await checkSupportLimit("7", fakeClient(SUPPORT_LIMIT + 1))).toBe(false);
  });

  it("Redis 가 죽으면 열어 둔다 — 문의 창구가 닫히면 안 된다", async () => {
    expect(await checkSupportLimit("7", fakeClient(new Error("down")))).toBe(true);
  });
});
