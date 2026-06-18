import { describe, expect, it } from "vitest";
import { authIdentities, sessions, users } from "./schema.js";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("auth schema", () => {
  it("users 테이블에 email/name/locale 컬럼이 있다", () => {
    const cols = getTableConfig(users).columns.map((c) => c.name);
    expect(cols).toEqual(
      expect.arrayContaining(["id", "email", "name", "locale", "created_at", "updated_at"]),
    );
  });

  it("auth_identities는 (provider, provider_user_id) 유니크 제약을 가진다", () => {
    const { uniqueConstraints } = getTableConfig(authIdentities);
    const cols = uniqueConstraints.flatMap((u) => u.columns.map((c) => c.name));
    expect(cols).toEqual(expect.arrayContaining(["provider", "provider_user_id"]));
  });

  it("sessions는 token 유니크 컬럼을 가진다", () => {
    const tokenCol = getTableConfig(sessions).columns.find((c) => c.name === "token");
    expect(tokenCol?.isUnique).toBe(true);
  });
});
