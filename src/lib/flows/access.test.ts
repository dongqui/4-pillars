import { describe, expect, it } from "vitest";
import { canCreateFlow } from "./access";

const allow = {
  peekLimit: async () => true,
  getBalance: async () => 5,
};

describe("canCreateFlow", () => {
  it("비로그인은 막는다", async () => {
    expect(await canCreateFlow(null, allow)).toEqual({
      ok: false,
      reason: "unauthenticated",
    });
  });

  it("한도에 걸리면 막는다", async () => {
    expect(await canCreateFlow("3", { ...allow, peekLimit: async () => false })).toEqual({
      ok: false,
      reason: "rate_limited",
    });
  });

  it("잔액이 모자라면 막는다 — 기다려도 안 풀리므로 한도와 다른 이유다", async () => {
    expect(await canCreateFlow("3", { ...allow, getBalance: async () => 0 })).toEqual({
      ok: false,
      reason: "insufficient_tickets",
    });
  });

  it("둘 다 통과하면 연다", async () => {
    expect(await canCreateFlow("3", allow)).toEqual({ ok: true });
  });

  it("여기서는 세지도 깎지도 않는다 — 읽기만 한다", async () => {
    let counted = false;
    await canCreateFlow("3", {
      peekLimit: async () => {
        counted = true; // peek 은 세지 않는 쪽이다. 이름이 곧 계약이다
        return true;
      },
      getBalance: async () => 5,
    });
    expect(counted).toBe(true);
  });
});
