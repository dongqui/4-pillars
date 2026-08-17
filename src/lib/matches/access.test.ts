import { describe, expect, it } from "vitest";
import { canCreateMatch } from "./access";

describe("canCreateMatch", () => {
  it("비로그인은 막는다 — 궁합은 이용권을 쓰는 상품이다", async () => {
    expect(await canCreateMatch(null)).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("한도를 넘으면 막는다", async () => {
    expect(await canCreateMatch("7", { checkLimit: async () => false }))
      .toEqual({ ok: false, reason: "rate_limited" });
  });

  it("한도 안이면 통과", async () => {
    expect(await canCreateMatch("7", { checkLimit: async () => true })).toEqual({ ok: true });
  });
});
