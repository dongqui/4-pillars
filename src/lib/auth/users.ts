import { sql as neonSql } from "@/lib/db";

/** 태그드 템플릿 SQL 클라이언트(주입 가능). 기본은 공유 neon 클라이언트. */
export type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

const sql = neonSql as unknown as SqlClient;

export interface UpsertUserInput {
  provider: string;
  providerUserId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

/** (provider, provider_user_id) 기준 upsert. 존재하면 프로필·last_login_at 갱신. id 반환. */
export async function upsertUser(
  input: UpsertUserInput,
  client: SqlClient = sql,
): Promise<{ id: string }> {
  const rows = await client`
    INSERT INTO users (provider, provider_user_id, email, display_name, avatar_url, last_login_at)
    VALUES (
      ${input.provider},
      ${input.providerUserId},
      ${input.email ?? null},
      ${input.displayName ?? null},
      ${input.avatarUrl ?? null},
      now()
    )
    ON CONFLICT (provider, provider_user_id) DO UPDATE SET
      email         = EXCLUDED.email,
      display_name  = EXCLUDED.display_name,
      avatar_url    = EXCLUDED.avatar_url,
      last_login_at = now()
    RETURNING id
  `;
  const row = rows[0] as { id: string | number } | undefined;
  if (!row) throw new Error("upsertUser: no row returned");
  return { id: String(row.id) };
}
