import { describe, it, expect } from "vitest";
import {
  DuplicatePersonError,
  MAX_MAP_PEOPLE,
  MapPeopleLimitError,
  addMapPerson,
  createMap,
  deleteMapPerson,
  getMapByShareId,
  listMapPeople,
  toMapPersonRow,
  toMapRow,
  type SqlClient,
} from "./store";

function fakeClient(...responses: Record<string, unknown>[][]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(responses[i++] ?? []);
  };
  return { client, calls };
}

const mapDbRow = {
  id: 7,
  share_id: "0f4b0a5e-1111-4222-8333-444455556666",
  owner_user_id: 3,
  center_name: "김동진",
  center_calendar: "solar",
  center_is_leap_month: false,
  center_birth_year: 1990,
  center_birth_month: 10,
  center_birth_day: 25,
  created_at: "2026-08-18T00:00:00.000Z",
};

const personDbRow = {
  id: 11,
  name: "민수",
  calendar: "lunar",
  is_leap_month: true,
  birth_year: 1991,
  birth_month: 3,
  birth_day: 2,
};

describe("toMapRow", () => {
  it("컬럼을 카멜케이스 구조로 옮긴다", () => {
    expect(toMapRow(mapDbRow)).toEqual({
      id: "7",
      shareId: "0f4b0a5e-1111-4222-8333-444455556666",
      ownerUserId: "3",
      center: {
        name: "김동진",
        year: 1990, month: 10, day: 25,
        calendar: "solar", isLeapMonth: false,
      },
      createdAt: "2026-08-18T00:00:00.000Z",
    });
  });
});

describe("toMapPersonRow", () => {
  it("컬럼을 카멜케이스 구조로 옮긴다", () => {
    expect(toMapPersonRow(personDbRow)).toEqual({
      id: "11", name: "민수",
      year: 1991, month: 3, day: 2,
      calendar: "lunar", isLeapMonth: true,
    });
  });
});

describe("getMapByShareId", () => {
  it("없으면 null", async () => {
    const { client } = fakeClient([]);
    expect(await getMapByShareId("nope", client)).toBeNull();
  });
});

describe("createMap", () => {
  it("이미 있으면 INSERT 하지 않고 그대로 돌려준다", async () => {
    const { client, calls } = fakeClient([mapDbRow]);
    const row = await createMap("3", {
      name: "김동진", year: 1990, month: 10, day: 25,
      calendar: "solar", isLeapMonth: false,
    }, client);
    expect(row.id).toBe("7");
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("SELECT");
  });

  it("없으면 INSERT 하고 다시 읽어 돌려준다", async () => {
    const { client, calls } = fakeClient([], [], [mapDbRow]);
    const row = await createMap("3", {
      name: "김동진", year: 1990, month: 10, day: 25,
      calendar: "solar", isLeapMonth: false,
    }, client);
    expect(row.id).toBe("7");
    expect(calls).toHaveLength(3);
    expect(calls[1].sql).toContain("INSERT INTO maps");
    // share_id 는 UUID 로 만든다 — 연속 정수 PK 를 URL 에 노출하지 않기 위해서다
    expect(calls[1].values[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

describe("listMapPeople", () => {
  it("행을 변환해 돌려준다", async () => {
    const { client } = fakeClient([personDbRow]);
    expect(await listMapPeople("7", client)).toHaveLength(1);
  });
});

describe("addMapPerson", () => {
  const person = {
    name: "민수", year: 1991, month: 3, day: 2,
    calendar: "lunar" as const, isLeapMonth: true,
  };

  it("한도에 다다르면 MapPeopleLimitError", async () => {
    const { client } = fakeClient([{ n: MAX_MAP_PEOPLE }]);
    await expect(addMapPerson("7", person, client)).rejects.toBeInstanceOf(MapPeopleLimitError);
  });

  it("중복이면 DuplicatePersonError", async () => {
    // count 는 여유가 있는데 INSERT 가 아무 행도 돌려주지 않는다 = 유니크 인덱스 충돌
    const { client } = fakeClient([{ n: 3 }], []);
    await expect(addMapPerson("7", person, client)).rejects.toBeInstanceOf(DuplicatePersonError);
  });

  it("성공하면 저장된 행을 돌려준다", async () => {
    const { client } = fakeClient([{ n: 3 }], [personDbRow]);
    expect((await addMapPerson("7", person, client)).id).toBe("11");
  });
});

describe("deleteMapPerson", () => {
  it("지운 행이 없으면 false", async () => {
    const { client } = fakeClient([]);
    expect(await deleteMapPerson("7", "11", client)).toBe(false);
  });

  it("map_id 를 함께 조건에 넣는다", async () => {
    const { client, calls } = fakeClient([{ id: 11 }]);
    expect(await deleteMapPerson("7", "11", client)).toBe(true);
    expect(calls[0].sql).toContain("map_id");
  });
});
