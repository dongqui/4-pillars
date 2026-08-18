import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getMapByShareId = vi.fn();
const addMapPerson = vi.fn();
// importOriginal 로 감싸는 이유: MapPeopleLimitError 는 handler.ts 가 instanceof 로
// 분기하는 실제 클래스여야 한다 — 통째로 목으로 바꾸면 다른 클래스가 되어 409 분기가 깨진다.
vi.mock("@/lib/maps/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/maps/store")>()),
  getMapByShareId: (...a: unknown[]) => getMapByShareId(...a),
  addMapPerson: (...a: unknown[]) => addMapPerson(...a),
}));

import { POST } from "./route";

const map = {
  id: "7",
  shareId: "s",
  ownerUserId: "3",
  center: { name: "나", year: 1990, month: 10, day: 25, calendar: "solar" as const, isLeapMonth: false },
  createdAt: "2026-08-18T00:00:00.000Z",
};
const validBody = { name: "민수", birth: { year: 1991, month: 3, day: 2 } };
const addedRow = {
  id: "11",
  name: "민수",
  year: 1991,
  month: 3,
  day: 2,
  calendar: "solar" as const,
  isLeapMonth: false,
};

function post(share: string, body: unknown) {
  const request = new NextRequest(`http://localhost/api/maps/${share}/people`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { request, ctx: { params: Promise.resolve({ share }) } };
}

describe("POST /api/maps/[share]/people", () => {
  beforeEach(() => {
    getMapByShareId.mockReset();
    addMapPerson.mockReset();
  });

  // 이 라우트가 session 을 아예 보지 않는다는 것이 "링크를 가진 누구나 추가" 규칙의
  // 전부다 — handler.test.ts 는 AddDeps 에 userId 필드가 없어 이 성질을 못 잡는다.
  // 누가 DELETE 라우트를 복붙해 getSession 게이트를 여기 붙여도 handler.test.ts 는
  // 여전히 통과하므로, 실제 route.ts 를 통해서만 이 성질을 증명할 수 있다.
  it("세션이 없어도 201", async () => {
    getMapByShareId.mockResolvedValue(map);
    addMapPerson.mockResolvedValue(addedRow);

    const { request, ctx } = post("s", validBody);
    const res = await POST(request, ctx);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ person: { id: "11", name: "민수" } });
  });

  it("본문이 JSON이 아니면 400이고 store 를 부르지 않는다", async () => {
    const { request, ctx } = post("s", "not json{");
    const res = await POST(request, ctx);

    expect(res.status).toBe(400);
    expect(getMapByShareId).not.toHaveBeenCalled();
    expect(addMapPerson).not.toHaveBeenCalled();
  });

  it("존재하지 않는 share 면 404이고 addMapPerson 을 부르지 않는다", async () => {
    getMapByShareId.mockResolvedValue(null);

    const { request, ctx } = post("unknown", validBody);
    const res = await POST(request, ctx);

    expect(res.status).toBe(404);
    expect(addMapPerson).not.toHaveBeenCalled();
  });
});
