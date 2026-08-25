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
   * 결제창에 넘길 구매자 이메일. 지금은 로그인이 이메일을 요구하지만(MissingEmailError),
   * 그 규칙 이전에 가입한 행은 비어 있어서 null 을 허용한다.
   */
  email: string | null;
  /**
   * "나" 인 프로필 — 홈 셀렉터에서 **마지막으로 고른 사람**이다. 아직 아무것도 고른
   * 적이 없으면 계정의 첫 저장 프로필이고(setPrimaryProfileIfUnset), 그 프로필이
   * 지워졌으면 null 이다 (0029 의 ON DELETE SET NULL).
   *
   * 소비하는 쪽은 null 을 실패가 아니라 "아직 모른다" 로 읽고 가장 오래된 저장
   * 프로필로 물러선다 — 계정이 생기기 전에 만들어진 행들이 여기 해당한다.
   */
  primaryProfileId: string | null;
}

/** 헤더 표시와 결제 구매자 정보에 쓰는 최소 정보만 읽는다. 세션에는 userId 밖에 없다. */
export async function getUser(
  id: string,
  client: SqlClient = sql,
): Promise<UserProfile | null> {
  const rows = await client`
    SELECT id, display_name, email, primary_profile_id FROM users WHERE id = ${id}::bigint
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    displayName: typeof row.display_name === "string" ? row.display_name : null,
    email: typeof row.email === "string" ? row.email : null,
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

/**
 * 홈에서 고른 프로필을 계정의 "나" 로 정한다. 형제 함수 `setPrimaryProfileIfUnset`
 * 과 달리 이미 정해진 값을 덮어쓴다 — 홈 셀렉터를 넘길 때마다 따라와야 한다.
 *
 * 두 조건을 WHERE 안에 두는 것이 이 함수의 존재 이유다:
 *  - `p.user_id`: profiles.id 는 순번 bigint 라 URL 에 노출된다. 밖에서 검사하면
 *    번호를 올려가며 남의 프로필을 자기 "나" 로 박을 수 있다.
 *  - `p.kind = 'saved'`: 궁합에서 저장하지 않고 만든 즉석 상대('temp')는 어느
 *    목록에도 서지 않는다. "나" 가 될 수 있으면 홈에 보이지도 않는 사람이 지도의
 *    중심에 선다.
 *
 * SqlClient 는 rowCount 를 주지 않아 RETURNING 으로 영향 행을 센다(deleteProfile 과 같다).
 * false 는 "없거나 · 남의 것이거나 · temp" 셋 중 하나다 — 호출자는 가르지 않고 404 로 접는다.
 */
export async function setPrimaryProfile(
  userId: string,
  profileId: string,
  client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    UPDATE users SET primary_profile_id = ${profileId}::bigint
     WHERE id = ${userId}::bigint
       AND EXISTS (
         SELECT 1 FROM profiles p
          WHERE p.id = ${profileId}::bigint
            AND p.user_id = ${userId}::bigint
            AND p.kind = 'saved'
       )
    RETURNING id
  `;
  return rows.length > 0;
}
