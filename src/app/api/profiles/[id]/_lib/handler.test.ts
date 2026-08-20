import { describe, expect, it } from "vitest";
import { handleDeleteProfile } from "./handler";

describe("handleDeleteProfile", () => {
  it("비로그인은 401", async () => {
    const r = await handleDeleteProfile("1", { userId: null, remove: async () => true });
    expect(r.status).toBe(401);
  });

  it("id 형식이 어긋나면 400 — ::bigint 캐스팅까지 가지 않는다", async () => {
    const r = await handleDeleteProfile("abc", { userId: "1", remove: async () => true });
    expect(r.status).toBe(400);
  });

  it("남의 프로필도 없는 프로필도 404 — 둘을 가르면 id 로 존재 여부를 훑을 수 있다", async () => {
    const r = await handleDeleteProfile("2", { userId: "1", remove: async () => false });
    expect(r.status).toBe(404);
  });

  it("지웠으면 200", async () => {
    const seen: string[][] = [];
    const r = await handleDeleteProfile("2", {
      userId: "1",
      remove: async (userId, id) => {
        seen.push([userId, id]);
        return true;
      },
    });
    expect(r).toEqual({ status: 200, body: { deleted: true } });
    // 세션의 userId 를 그대로 넘긴다 — 소유권 검사는 store 의 WHERE 절이다.
    expect(seen).toEqual([["1", "2"]]);
  });
});
