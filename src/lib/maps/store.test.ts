import { describe, it, expect } from "vitest";
import {
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

  // 순서: 1) count 2) INSERT ... ON CONFLICT DO NOTHING 3) dedupe 키로 읽기.
  // 세 문장이 언제나 이 순서로 전부 실행된다 — 아래 fakeClient 응답 순서가 그것이다.

  it("한도에 다다르면 MapPeopleLimitError", async () => {
    const { client } = fakeClient([{ n: MAX_MAP_PEOPLE }]);
    await expect(addMapPerson("7", person, client)).rejects.toBeInstanceOf(MapPeopleLimitError);
  });

  // 한도 검사가 맨 앞이라는 것을 쿼리 순서로 못 박는다. dedupe 읽기가 앞에 오면
  // 가득 찬 지도가 "이미 있음/없음" 을 상태 코드로 흘리는 오라클이 된다.
  it("한도 검사가 dedupe 읽기보다 먼저다", async () => {
    const { client, calls } = fakeClient([{ n: MAX_MAP_PEOPLE }]);
    await expect(addMapPerson("7", person, client)).rejects.toBeInstanceOf(MapPeopleLimitError);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("count(*)");
  });

  // 이미 있는 사람은 에러가 아니다 — 상태 코드가 "이 생년월일이 맞다" 는 오라클이
  // 되지 않도록, 새로 더한 것과 이미 있던 것을 구별하지 않는다(handler.ts 의 오라클
  // 카나리아 테스트가 이 성질을 라우트 경계까지 잇는다). 중복이어도 INSERT 를 건너뛰지
  // 않는다 — ON CONFLICT DO NOTHING 이 받아내고, 그래야 두 경우의 왕복 수가 같다.
  it("이미 있는 사람이면 그 행을 그대로 돌려주고, 신규와 같은 문장 수를 쓴다", async () => {
    const dup = fakeClient([{ n: 3 }], [], [personDbRow]);
    const fresh = fakeClient([{ n: 3 }], [], [personDbRow]);
    expect((await addMapPerson("7", person, dup.client)).id).toBe("11");
    expect((await addMapPerson("7", person, fresh.client)).id).toBe("11");
    // 타이밍 오라클을 줄이는 성질: 중복도 신규도 같은 SQL 을 같은 순서로 지난다.
    expect(dup.calls.map((c) => c.sql)).toEqual(fresh.calls.map((c) => c.sql));
    expect(dup.calls).toHaveLength(3);
  });

  // 가득 찬 지도에서는 이미 있는 사람과 새 사람이 **같은** 결과를 받는다. 이것이
  // 오라클을 닫는 성질 그 자체다. 리터럴(409·MapPeopleLimitError)이 아니라 두 결과를
  // 서로 비교한다 — 에러가 바뀌어도 "둘이 구별되지 않는다" 는 뜻이 살아 있어야 한다.
  it("가득 찬 지도에서는 이미 있는 사람과 새 사람이 구별되지 않는다", async () => {
    async function outcome(client: SqlClient) {
      try {
        return { kind: "ok" as const, id: (await addMapPerson("7", person, client)).id };
      } catch (e) {
        return { kind: "throw" as const, name: (e as Error).name, message: (e as Error).message };
      }
    }

    // 이미 있는 사람: dedupe 읽기까지 갔다면 personDbRow 가 나올 준비가 되어 있다.
    const existing = fakeClient([{ n: MAX_MAP_PEOPLE }], [], [personDbRow]);
    // 새 사람: 같은 자리에서 빈 결과가 나온다.
    const newcomer = fakeClient([{ n: MAX_MAP_PEOPLE }], [], []);

    const a = await outcome(existing.client);
    const b = await outcome(newcomer.client);

    expect(a).toEqual(b);
    // 그리고 둘 다 dedupe 읽기 자체에 닿지 못한다 — count 한 문장에서 끝난다.
    expect(existing.calls.map((c) => c.sql)).toEqual(newcomer.calls.map((c) => c.sql));
    expect(existing.calls).toHaveLength(1);
  });

  // INSERT 와 dedupe 읽기 사이에 동시 요청이 같은 사람을 먼저 넣어도(ON CONFLICT 가
  // 우리 INSERT 를 무음 처리해도) 마지막 읽기가 그 행을 준다.
  it("동시 요청이 먼저 넣었어도 마지막 읽기가 그 행을 돌려준다", async () => {
    const { client, calls } = fakeClient([{ n: 3 }], [], [personDbRow]);
    const row = await addMapPerson("7", person, client);
    expect(row.id).toBe("11");
    expect(calls).toHaveLength(3);
    expect(calls[1].sql).toContain("INSERT INTO map_people");
    // RETURNING 을 쓰지 않는다 — 돌려줄 행은 언제나 3)의 읽기가 준다.
    expect(calls[1].sql).not.toContain("RETURNING");
  });

  it("INSERT 뒤에도 못 찾으면 던진다", async () => {
    const { client } = fakeClient([{ n: 3 }], [], []);
    await expect(addMapPerson("7", person, client)).rejects.toThrow(/dedupe/);
  });

  it("성공하면 저장된 행을 돌려준다", async () => {
    const { client } = fakeClient([{ n: 3 }], [], [personDbRow]);
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
