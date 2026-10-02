import { sql as neonSql, type SqlClient } from "@/lib/db";
import { getSession, type SessionPayload } from "./session";

const sql = neonSql as unknown as SqlClient;

/** users.role 의 CHECK 와 같은 목록이다(0054). */
export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export async function getUserRole(userId: string, client: SqlClient = sql): Promise<UserRole | null> {
  const rows = await client`SELECT role FROM users WHERE id = ${userId}::bigint`;
  const role = rows[0]?.role;
  return (USER_ROLES as readonly unknown[]).includes(role) ? (role as UserRole) : null;
}

interface AdminDeps {
  getSession(): Promise<SessionPayload | null>;
  getUserRole(userId: string): Promise<UserRole | null>;
}

/**
 * 어드민 화면·API 의 문지기. 관리자면 { userId }, 아니면 null.
 *
 * ⚠️ 세션의 provider 를 보지 않는다. provider = 'admin' 은 PG 심사용 임시 로그인의
 * "로그인 방식" 이고(0049, review-login.ts) 비밀번호가 외부에 공유된다. 권한은 오직
 * users.role 이다 — 세션에 role 을 싣지 않고 매번 DB 를 읽는 것도 같은 이유다:
 * 권한을 회수하면 7일짜리 세션이 끝나기를 기다리지 않고 바로 막혀야 한다.
 */
export async function requireAdmin(
  deps: AdminDeps = { getSession, getUserRole: (id) => getUserRole(id) },
): Promise<{ userId: string } | null> {
  const session = await deps.getSession();
  if (!session) return null;
  return (await deps.getUserRole(session.userId)) === "admin" ? { userId: session.userId } : null;
}
