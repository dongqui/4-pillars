import { describe, it, expect } from "vitest";
import { upsertUser, getUser, type SqlClient } from "./users";

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
    expect(await getUser("7", client)).toEqual({ id: "7", displayName: "김동진" });
    expect(calls[0].sql).toContain("FROM users");
    expect(calls[0].values).toEqual(["7"]);
  });

  it("행이 없으면 null", async () => {
    const { client } = fakeClient([]);
    expect(await getUser("99", client)).toBeNull();
  });

  it("표시 이름이 비어 있으면 displayName은 null", async () => {
    const { client } = fakeClient([{ id: 7, display_name: null }]);
    expect(await getUser("7", client)).toEqual({ id: "7", displayName: null });
  });
});
