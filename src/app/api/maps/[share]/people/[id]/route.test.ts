import { describe, it, expect, vi, beforeEach } from "vitest";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getSession: (...a: unknown[]) => getSession(...a),
}));

const getMapByShareId = vi.fn();
const deleteMapPerson = vi.fn();
vi.mock("@/lib/maps/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/maps/store")>()),
  getMapByShareId: (...a: unknown[]) => getMapByShareId(...a),
  deleteMapPerson: (...a: unknown[]) => deleteMapPerson(...a),
}));

import { DELETE } from "./route";

const map = {
  id: "7",
  shareId: "s",
  ownerUserId: "3",
  center: { name: "나", year: 1990, month: 10, day: 25, calendar: "solar" as const, isLeapMonth: false },
  createdAt: "2026-08-18T00:00:00.000Z",
};

function del(share: string, id: string) {
  const request = new Request(`http://localhost/api/maps/${share}/people/${id}`, { method: "DELETE" });
  return { request, ctx: { params: Promise.resolve({ share, id }) } };
}

describe("DELETE /api/maps/[share]/people/[id]", () => {
  beforeEach(() => {
    getSession.mockReset();
    getMapByShareId.mockReset();
    deleteMapPerson.mockReset();
  });

  // 이 한 줄(session?.userId ?? null)이 "소유자만 삭제" 의 테넌트 경계다 —
  // handler.test.ts 는 "userId 를 받으면 어떻게 되는가" 만 증명하지, route.ts 가
  // 실제 세션에서 그 userId 를 제대로 꺼내는지는 증명하지 않는다.
  it("세션이 없으면 403이고 deleteMapPerson 을 부르지 않는다", async () => {
    getSession.mockResolvedValue(null);
    getMapByShareId.mockResolvedValue(map);

    const { request, ctx } = del("s", "11");
    const res = await DELETE(request, ctx);

    expect(res.status).toBe(403);
    expect(deleteMapPerson).not.toHaveBeenCalled();
  });

  it("소유자가 아니면 403이고 deleteMapPerson 을 부르지 않는다", async () => {
    getSession.mockResolvedValue({ userId: "99", provider: "google" });
    getMapByShareId.mockResolvedValue(map);

    const { request, ctx } = del("s", "11");
    const res = await DELETE(request, ctx);

    expect(res.status).toBe(403);
    expect(deleteMapPerson).not.toHaveBeenCalled();
  });

  it("소유자면 200이고 mapId·personId 가 그대로 전달된다", async () => {
    getSession.mockResolvedValue({ userId: "3", provider: "google" });
    getMapByShareId.mockResolvedValue(map);
    deleteMapPerson.mockResolvedValue(true);

    const { request, ctx } = del("s", "11");
    const res = await DELETE(request, ctx);

    expect(res.status).toBe(200);
    expect(deleteMapPerson).toHaveBeenCalledWith("7", "11");
  });

  // ::bigint 캐스팅 전에 형식을 거른다. 자릿수만 세는 정규식은 bigint 상한을 넘는
  // 값을 못 거르는데, 그런 값이 store 까지 가면 Postgres 가 "value out of range for
  // type bigint" 를 던지고 500 으로 샌다 — bigint 상한(19자리)을 넘는 20자리 값으로
  // 그 경계를 실제로 확인한다.
  it.each(["abc", "12;drop", "99999999999999999999"])(
    "id가 순번 id 형식이 아니면(%s) 400이고 store 를 전혀 부르지 않는다",
    async (id) => {
      getSession.mockResolvedValue({ userId: "3", provider: "google" });

      const { request, ctx } = del("s", id);
      const res = await DELETE(request, ctx);

      expect(res.status).toBe(400);
      expect(getMapByShareId).not.toHaveBeenCalled();
      expect(deleteMapPerson).not.toHaveBeenCalled();
    },
  );
});
