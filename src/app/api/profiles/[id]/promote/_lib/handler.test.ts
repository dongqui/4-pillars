import { describe, expect, it } from "vitest";
import { handlePromote } from "./handler";

describe("handlePromote", () => {
  it("비로그인은 401", async () => {
    const r = await handlePromote("1", { userId: null, promote: async () => true });
    expect(r.status).toBe(401);
  });

  it("id 형식이 어긋나면 400", async () => {
    const r = await handlePromote("abc", { userId: "1", promote: async () => true });
    expect(r.status).toBe(400);
  });

  it("이미 self 면 200 이되 promoted 는 false — 실패가 아니라 할 일 없음이다", async () => {
    const r = await handlePromote("2", { userId: "1", promote: async () => false });
    expect(r).toEqual({ status: 200, body: { promoted: false } });
  });

  it("승격하면 promoted 가 true", async () => {
    const r = await handlePromote("2", { userId: "1", promote: async () => true });
    expect(r).toEqual({ status: 200, body: { promoted: true } });
  });
});
