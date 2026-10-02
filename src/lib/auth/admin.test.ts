import { describe, expect, it, vi } from "vitest";
import type { SqlClient } from "@/lib/db";
import { getUserRole, requireAdmin } from "./admin";

describe("requireAdmin", () => {
  it("세션이 없으면 null", async () => {
    const getUserRole = vi.fn();
    expect(await requireAdmin({ getSession: async () => null, getUserRole })).toBeNull();
    expect(getUserRole).not.toHaveBeenCalled();
  });

  it("role 이 user 면 null", async () => {
    expect(
      await requireAdmin({ getSession: async () => ({ userId: "7", provider: "google" }), getUserRole: async () => "user" }),
    ).toBeNull();
  });

  it("provider 가 'admin'(심사용 로그인)이어도 role 이 user 면 null", async () => {
    expect(
      await requireAdmin({ getSession: async () => ({ userId: "8", provider: "admin" }), getUserRole: async () => "user" }),
    ).toBeNull();
  });

  it("role 이 admin 이면 userId", async () => {
    expect(
      await requireAdmin({ getSession: async () => ({ userId: "7", provider: "kakao" }), getUserRole: async () => "admin" }),
    ).toEqual({ userId: "7" });
  });
});

describe("getUserRole", () => {
  const client = (rows: Record<string, unknown>[]) =>
    (async () => rows) as unknown as SqlClient;

  it("모르는 값·없는 행은 null 로 접는다 — 권한은 확실할 때만", async () => {
    expect(await getUserRole("7", client([{ role: "admin" }]))).toBe("admin");
    expect(await getUserRole("7", client([{ role: "superuser" }]))).toBeNull();
    expect(await getUserRole("7", client([]))).toBeNull();
  });
});
