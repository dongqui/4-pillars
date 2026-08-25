import { describe, expect, it } from "vitest";
import { handleSetPrimary } from "./handler";

describe("handleSetPrimary", () => {
  it("비로그인은 401", async () => {
    const r = await handleSetPrimary("1", { userId: null, setPrimary: async () => true });
    expect(r.status).toBe(401);
  });

  it("id 형식이 어긋나면 400 — ::bigint 캐스팅까지 가지 않는다", async () => {
    const r = await handleSetPrimary("abc", { userId: "1", setPrimary: async () => true });
    expect(r.status).toBe(400);
  });

  // 남의 것 · 없는 것 · 목록에 서지 않는 temp 가 한 갈래로 온다. 401/404 를 가르면
  // id 를 올려가며 어느 번호가 존재하는지 훑을 수 있다(handleDeleteProfile 과 같은 판단).
  it("store 가 false 면 404", async () => {
    const r = await handleSetPrimary("2", { userId: "1", setPrimary: async () => false });
    expect(r.status).toBe(404);
  });

  it("정했으면 200", async () => {
    const seen: string[][] = [];
    const r = await handleSetPrimary("2", {
      userId: "1",
      setPrimary: async (userId, id) => {
        seen.push([userId, id]);
        return true;
      },
    });
    expect(r).toEqual({ status: 200, body: { primary: true } });
    // 세션의 userId 를 그대로 넘긴다 — 소유권 검사는 store 의 WHERE 절이다.
    expect(seen).toEqual([["1", "2"]]);
  });
});
