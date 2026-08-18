import { describe, expect, it, vi } from "vitest";
import { canCreateMatch } from "./access";

describe("canCreateMatch", () => {
  it("비로그인은 막는다 — 궁합은 이용권을 쓰는 상품이다", async () => {
    expect(await canCreateMatch(null)).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("비로그인이면 한도를 보지도 않는다", async () => {
    const peekLimit = vi.fn();
    await canCreateMatch(null, { peekLimit, getBalance: async () => 1 });
    expect(peekLimit).not.toHaveBeenCalled();
  });

  it("한도를 넘으면 막는다", async () => {
    expect(
      await canCreateMatch("7", { peekLimit: async () => false, getBalance: async () => 1 }),
    ).toEqual({ ok: false, reason: "rate_limited" });
  });

  it("한도 안이면 통과", async () => {
    expect(
      await canCreateMatch("7", { peekLimit: async () => true, getBalance: async () => 1 }),
    ).toEqual({ ok: true });
  });

  it("잔액이 없으면 insufficient_tickets", async () => {
    const r = await canCreateMatch("7", {
      peekLimit: async () => true,
      getBalance: async () => 0,
    });
    expect(r).toEqual({ ok: false, reason: "insufficient_tickets" });
  });

  it("잔액이 1장이면 통과한다", async () => {
    const r = await canCreateMatch("7", {
      peekLimit: async () => true,
      getBalance: async () => 1,
    });
    expect(r).toEqual({ ok: true });
  });

  it("확인만 하고 차감하지 않는다 — 차감은 생성하는 자리에서다", async () => {
    const getBalance = vi.fn(async () => 3);
    await canCreateMatch("7", { peekLimit: async () => true, getBalance });
    // 잔액을 읽기만 했는지는 호출 횟수로 본다. 이 파일은 spendTicket 을 import 하지 않는다.
    expect(getBalance).toHaveBeenCalledTimes(1);
  });
});
