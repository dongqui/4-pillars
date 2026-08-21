import { describe, it, expect } from "vitest";
import { upsertUser, getUser, setPrimaryProfileIfUnset, type SqlClient } from "./users";

function fakeClient(rows: Record<string, unknown>[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(rows);
  };
  return { client, calls };
}

describe("upsertUser", () => {
  it("ON CONFLICT UPSERT를 실행하고 id를 문자열로 반환", async () => {
    const { client, calls } = fakeClient([{ id: 7 }]);
    const result = await upsertUser(
      { provider: "google", providerUserId: "g-1", email: "a@g.com", displayName: "지민", avatarUrl: "http://img" },
      client,
    );
    expect(result).toEqual({ id: "7" });
    expect(calls[0].sql).toContain("INSERT INTO users");
    expect(calls[0].sql).toContain("ON CONFLICT (provider, provider_user_id) DO UPDATE");
    expect(calls[0].values).toEqual(["google", "g-1", "a@g.com", "지민", "http://img"]);
  });
  it("선택 필드는 null로 바인딩", async () => {
    const { client, calls } = fakeClient([{ id: 9 }]);
    await upsertUser({ provider: "kakao", providerUserId: "k-2" }, client);
    expect(calls[0].values).toEqual(["kakao", "k-2", null, null, null]);
  });
});

describe("getUser", () => {
  it("id로 조회해 표시 이름을 반환", async () => {
    const { client, calls } = fakeClient([{ id: 7, display_name: "김동진" }]);
    expect(await getUser("7", client)).toEqual({
      id: "7",
      displayName: "김동진",
      primaryProfileId: null,
    });
    expect(calls[0].sql).toContain("FROM users");
    expect(calls[0].values).toEqual(["7"]);
  });

  it("행이 없으면 null", async () => {
    const { client } = fakeClient([]);
    expect(await getUser("99", client)).toBeNull();
  });

  it("표시 이름이 비어 있으면 displayName은 null", async () => {
    const { client } = fakeClient([{ id: 7, display_name: null }]);
    expect(await getUser("7", client)).toEqual({
      id: "7",
      displayName: null,
      primaryProfileId: null,
    });
  });
});

describe("primary_profile_id", () => {
  it("getUser 가 함께 읽어 문자열로 준다 — 소비하는 쪽은 프로필 id 와 비교한다", async () => {
    const { client, calls } = fakeClient([
      { id: 7, display_name: "김동진", primary_profile_id: 42 },
    ]);
    const user = await getUser("7", client);

    expect(user?.primaryProfileId).toBe("42");
    expect(calls[0].sql).toContain("primary_profile_id");
  });

  // 계정이 생기기 전에 만들어진 행, 또는 그 프로필이 지워진 경우(0029 의 ON DELETE
  // SET NULL). 소비하는 쪽은 이걸 실패가 아니라 "아직 모른다" 로 읽어야 한다.
  it("정해지지 않았으면 null 이다", async () => {
    const { client } = fakeClient([{ id: 7, display_name: null, primary_profile_id: null }]);
    expect((await getUser("7", client))?.primaryProfileId).toBeNull();
  });

  // 조건을 WHERE 에 두는 것이 이 함수의 존재 이유다. 읽고 나서 쓰면 두 요청이 나란히
  // 첫 프로필을 만들 때 뒤엣것이 앞엣것을 덮어써, 나중에 넣은 사람이 "나" 가 된다.
  it("이미 정해져 있으면 덮어쓰지 않는다 — 조건이 WHERE 안에 있다", async () => {
    const { client, calls } = fakeClient([]);
    await setPrimaryProfileIfUnset("7", "42", client);

    expect(calls[0].sql).toContain("UPDATE users SET primary_profile_id");
    expect(calls[0].sql).toContain("primary_profile_id IS NULL");
    // 남의 계정을 건드리지 못하게 user_id 도 함께 건다.
    expect(calls[0].sql).toContain("id =");
    expect(calls[0].values).toEqual(["42", "7", "7", "42"]);
  });

  // IS NULL 만 보면 0029 이전 계정(프로필은 여럿, primary 는 null)에서 다음에 저장하는
  // 아무나가 — 궁합에서 저장한 상대까지 — "나" 로 박힌다.
  it("이미 저장된 사람이 있으면 정하지 않는다 — 첫 프로필일 때만이다", async () => {
    const { client, calls } = fakeClient([]);
    await setPrimaryProfileIfUnset("7", "42", client);

    expect(calls[0].sql).toContain("NOT EXISTS");
    expect(calls[0].sql).toContain("p.kind = 'saved'");
    expect(calls[0].sql).toContain("p.id <>");
  });
});
