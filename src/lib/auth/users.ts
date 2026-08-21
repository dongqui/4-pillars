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

export interface UserProfile {
  id: string;
  /** 소셜 제공자가 이름을 안 줄 수 있어 null 을 허용한다. */
  displayName: string | null;
  /**
   * "나" 인 프로필. 아직 정해지지 않았거나 그 프로필이 지워졌으면 null
   * (0029 의 ON DELETE SET NULL).
   *
   * 소비하는 쪽은 null 을 실패가 아니라 "아직 모른다" 로 읽고 가장 오래된 저장
   * 프로필로 물러선다 — 계정이 생기기 전에 만들어진 행들이 여기 해당한다.
   */
  primaryProfileId: string | null;
}

/** 헤더에 표시할 최소 정보만 읽는다. 세션에는 userId 밖에 없다. */
export async function getUser(
  id: string,
  client: SqlClient = sql,
): Promise<UserProfile | null> {
  const rows = await client`
    SELECT id, display_name, primary_profile_id FROM users WHERE id = ${id}::bigint
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    primaryProfileId:
      row.primary_profile_id === null || row.primary_profile_id === undefined
        ? null
        : String(row.primary_profile_id),
  };
}

/**
 * 이 프로필이 계정의 **첫 저장 프로필**이면 "나" 로 정한다. 아니면 아무 일도 하지 않는다.
 *
 * 읽고 나서 쓰지 않고 조건을 전부 WHERE 에 넣는 이유: 두 요청이 나란히 첫 프로필을
 * 만들면 읽기-쓰기 사이에서 뒤엣것이 앞엣것을 덮어쓴다. 한 문장으로 두면 먼저
 * 도착한 쪽이 이긴다.
 *
 * ⚠️ `primary_profile_id IS NULL` 만 보면 안 된다. 0029 이전에 만들어진 계정은 프로필을
 * 여럿 갖고도 primary 가 null 이라, 그 사람이 다음에 저장하는 아무나(궁합에서 저장한
 * 상대까지)가 "나" 로 박힌다. NOT EXISTS 로 "이 계정에 저장된 사람이 이것뿐" 임을 함께
 * 건다 — 아니면 null 로 남고, 소비하는 쪽이 가장 오래된 저장 프로필로 물러선다.
 * (0030 이 기존 계정을 미리 채워 두므로 이 갈래에 닿는 일은 드물다.)
 *
 * 갱신된 행이 없다는 것은 실패가 아니라 "정할 자리가 아님" 이다 — 호출자는 이 값을
 * 보지 않아도 된다.
 */
export async function setPrimaryProfileIfUnset(
  userId: string,
  profileId: string,
  client: SqlClient = sql,
): Promise<void> {
  await client`
    UPDATE users SET primary_profile_id = ${profileId}::bigint
     WHERE id = ${userId}::bigint
       AND primary_profile_id IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM profiles p
          WHERE p.user_id = ${userId}::bigint
            AND p.kind = 'saved'
            AND p.id <> ${profileId}::bigint
       )
  `;
}
