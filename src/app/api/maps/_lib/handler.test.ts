import { describe, it, expect } from "vitest";
import { MapPeopleLimitError } from "@/lib/maps/store";
import { handleAddPerson, handleDeletePerson } from "./handler";

const map = {
  id: "7", shareId: "s", ownerUserId: "3",
  center: { name: "나", year: 1990, month: 10, day: 25, calendar: "solar" as const, isLeapMonth: false },
  createdAt: "2026-08-18T00:00:00.000Z",
};
const body = { name: "민수", birth: { year: 1991, month: 3, day: 2 } };
const added = { id: "11", name: "민수", year: 1991, month: 3, day: 2, calendar: "solar" as const, isLeapMonth: false };

describe("handleAddPerson", () => {
  it("없는 지도면 404", async () => {
    const r = await handleAddPerson(body, { findMap: async () => null, add: async () => added });
    expect(r.status).toBe(404);
  });

  it("본문이 스키마에 안 맞으면 400", async () => {
    const r = await handleAddPerson({ name: "" }, { findMap: async () => map, add: async () => added });
    expect(r.status).toBe(400);
  });

  it("만세력이 못 세우는 날짜면 400", async () => {
    const r = await handleAddPerson(
      { name: "민수", birth: { year: 1991, month: 2, day: 31 } },
      { findMap: async () => map, add: async () => added },
    );
    expect(r.status).toBe(400);
  });

  it("한도를 넘으면 409", async () => {
    const r = await handleAddPerson(body, {
      findMap: async () => map,
      add: async () => { throw new MapPeopleLimitError(); },
    });
    expect(r.status).toBe(409);
  });

  // store.addMapPerson 은 이미 있는 사람이면 그 행을 그대로 돌려준다(던지지 않는다) —
  // 그래서 여기서도 deps.add 가 기존 행을 돌려주는 상황을 흉내내 201 이 되는지 본다.
  it("중복(이미 있는 사람)이면 201로 기존 사람을 돌려준다", async () => {
    const r = await handleAddPerson(body, {
      findMap: async () => map,
      add: async () => added,
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ person: { id: "11", name: "민수" } });
  });

  // 오라클 카나리아: 상태 코드로 "이 이름·생년월일 조합이 이미 지도에 있다" 를
  // 구별할 수 있으면, 이름을 이미 아는 익명 호출자가 생년월일을 추측해 맞혔는지
  // 확인하는 창이 열린다. 그래서 새로 더한 경우와 이미 있던 경우가 같은 상태를
  // 돌려주는지 직접 비교한다 — 201 을 두 번 단언하면 성공 코드가 바뀌어도 이
  // 테스트는 계속 통과해 의미를 잃으므로, 두 결과가 서로 같은지를 본다.
  it("새로 더할 때와 이미 있는 사람을 다시 더할 때가 같은 상태 코드를 돌려준다", async () => {
    const fresh = await handleAddPerson(body, { findMap: async () => map, add: async () => added });
    const again = await handleAddPerson(body, { findMap: async () => map, add: async () => added });
    expect(again.status).toBe(fresh.status);
  });

  it("성공하면 201 과 지도 위의 자리를 돌려준다", async () => {
    const r = await handleAddPerson(body, { findMap: async () => map, add: async () => added });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ person: { id: "11", name: "민수" } });
    // 생년월일은 응답에 담지 않는다 — 남의 지도에서 남의 생일을 읽을 수 있게 된다
    expect(JSON.stringify(r.body)).not.toContain("1991");
  });

  // 로그인은 필요 없다. 이 규칙이 "누구나 추가" 의 전부라 테스트로 박아둔다.
  it("세션이 없어도 추가된다", async () => {
    const r = await handleAddPerson(body, { findMap: async () => map, add: async () => added });
    expect(r.status).toBe(201);
  });
});

describe("handleDeletePerson", () => {
  it("없는 지도면 404", async () => {
    const r = await handleDeletePerson({
      findMap: async () => null, userId: "3", personId: "11", remove: async () => true,
    });
    expect(r.status).toBe(404);
  });

  it("비로그인은 403", async () => {
    const r = await handleDeletePerson({
      findMap: async () => map, userId: null, personId: "11", remove: async () => true,
    });
    expect(r.status).toBe(403);
  });

  it("소유자가 아니면 403", async () => {
    const r = await handleDeletePerson({
      findMap: async () => map, userId: "99", personId: "11", remove: async () => true,
    });
    expect(r.status).toBe(403);
  });

  it("소유자면 지운다", async () => {
    const r = await handleDeletePerson({
      findMap: async () => map, userId: "3", personId: "11", remove: async () => true,
    });
    expect(r.status).toBe(200);
  });

  it("이미 없으면 404", async () => {
    const r = await handleDeletePerson({
      findMap: async () => map, userId: "3", personId: "11", remove: async () => false,
    });
    expect(r.status).toBe(404);
  });
});
