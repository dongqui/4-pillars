import { describe, it, expect } from "vitest";
import {
  MAX_MAP_PEOPLE,
  MapPeopleLimitError,
  addMapPerson,
  type SqlClient,
} from "@/lib/maps/store";
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
  // 확인하는 창이 열린다.
  //
  // ⚠️ 두 경우를 **서로 다른 stub** 으로 흉내내야 한다. 예전 이 테스트는 같은 add
  // stub 을 두 번 불러 자기 자신과 비교했고, 그래서 store 의 순서가 뒤집혀 가득 찬
  // 지도가 201/409 로 갈리던 실제 구멍을 잡지 못했다.
  //
  // 리터럴(201)이 아니라 두 결과를 서로 비교한다 — 성공 코드가 바뀌어도 "구별되지
  // 않는다" 는 뜻이 살아 있어야 한다.
  const freshRow = { ...added, id: "12" };
  const existingRow = { ...added, id: "11" };

  it("새로 더한 사람과 이미 있던 사람을 구별할 수 없다", async () => {
    // 신규: store 가 방금 넣은 행을 준다.
    const fresh = await handleAddPerson(body, {
      findMap: async () => map,
      add: async () => freshRow,
    });
    // 중복: store 가 이미 있던 행을 준다(던지지 않는다).
    const again = await handleAddPerson(body, {
      findMap: async () => map,
      add: async () => existingRow,
    });

    expect(again.status).toBe(fresh.status);
    // 본문의 모양도 같아야 한다. id 만 다르고 나머지 키는 그대로여야 신규/중복이
    // 본문으로도 새지 않는다.
    const shape = (r: unknown) =>
      Object.keys((r as { person: Record<string, unknown> }).person).sort();
    expect(shape(again.body)).toEqual(shape(fresh.body));
  });

  // 위 두 테스트는 deps.add 를 stub 으로 두므로 store 의 **순서** 는 보지 못한다.
  // 실제 구멍은 거기 있었다: store 가 dedupe 를 먼저 읽으면 가득 찬 지도에서
  // 이미 있는 사람만 201 이 되어, 빈 슬롯도 흔적도 쓰지 않는 무제한 생일 오라클이
  // 열린다. 그래서 여기서는 **진짜 addMapPerson** 을 가짜 SQL 클라이언트에 물려
  // 라우트 경계까지 통째로 돌린다.
  //
  // fakeSql 은 map_people 을 배열 하나로 흉내낸다: count / INSERT / dedupe SELECT
  // 세 문장만 알아들으면 충분하다.
  function fakeSql(rows: Record<string, unknown>[]) {
    const store = [...rows];
    const client: SqlClient = (strings, ...values) => {
      const text = strings.join("?");
      if (text.includes("count(*)")) return Promise.resolve([{ n: store.length }]);
      if (text.includes("INSERT INTO map_people")) {
        // values: mapId, name, calendar, isLeap, year, month, day
        const [, name, calendar, isLeap, year, month, day] = values;
        const dup = store.some(
          (r) =>
            r.name === name && r.calendar === calendar && r.is_leap_month === isLeap &&
            r.birth_year === year && r.birth_month === month && r.birth_day === day,
        );
        // ON CONFLICT DO NOTHING — 충돌이면 조용히 아무 일도 하지 않는다.
        if (!dup) {
          store.push({
            id: 900 + store.length, name, calendar, is_leap_month: isLeap,
            birth_year: year, birth_month: month, birth_day: day,
          });
        }
        return Promise.resolve([]);
      }
      const [, name, calendar, isLeap, year, month, day] = values;
      return Promise.resolve(
        store.filter(
          (r) =>
            r.name === name && r.calendar === calendar && r.is_leap_month === isLeap &&
            r.birth_year === year && r.birth_month === month && r.birth_day === day,
        ),
      );
    };
    return client;
  }

  const known = { id: 11, name: "민수", calendar: "solar", is_leap_month: false, birth_year: 1991, birth_month: 3, birth_day: 2 };
  const filler = (i: number) => ({
    id: 100 + i, name: `사람${i}`, calendar: "solar", is_leap_month: false,
    birth_year: 1990, birth_month: 1, birth_day: 1,
  });
  const hit = { name: "민수", birth: { year: 1991, month: 3, day: 2 } };
  const miss = { name: "민수", birth: { year: 1991, month: 3, day: 3 } };

  function outcome(r: { status: number; body: unknown }) {
    // person.id 는 새로 넣으면 당연히 다르다 — 오라클이 되는 것은 상태와 그 밖의
    // 응답 모양이므로 id 를 빼고 비교한다.
    const person = (r.body as { person?: Record<string, unknown> }).person;
    const rest = person ? { ...person, id: "<id>" } : undefined;
    return { status: r.status, body: rest ?? r.body };
  }

  it("가득 찬 지도에서는 맞힌 생일과 빗나간 생일이 완전히 같은 응답이다", async () => {
    // 50명 = 한도. 그중 한 명이 우리가 맞히려는 그 사람이다.
    const rows = [known, ...Array.from({ length: MAX_MAP_PEOPLE - 1 }, (_, i) => filler(i))];

    const hitRes = await handleAddPerson(hit, {
      findMap: async () => map,
      add: (mapId, person) => addMapPerson(mapId, person, fakeSql(rows)),
    });
    const missRes = await handleAddPerson(miss, {
      findMap: async () => map,
      add: (mapId, person) => addMapPerson(mapId, person, fakeSql(rows)),
    });

    expect(outcome(hitRes)).toEqual(outcome(missRes));
  });

  it("가득 차지 않은 지도에서도 맞힌 생일과 빗나간 생일이 같은 상태와 모양이다", async () => {
    const rows = [known];

    const hitRes = await handleAddPerson(hit, {
      findMap: async () => map,
      add: (mapId, person) => addMapPerson(mapId, person, fakeSql(rows)),
    });
    const missRes = await handleAddPerson(miss, {
      findMap: async () => map,
      add: (mapId, person) => addMapPerson(mapId, person, fakeSql(rows)),
    });

    expect(outcome(hitRes).status).toBe(outcome(missRes).status);
    expect(Object.keys(outcome(hitRes).body as object).sort())
      .toEqual(Object.keys(outcome(missRes).body as object).sort());
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
