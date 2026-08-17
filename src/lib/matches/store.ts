import { sql as neonSql, type SqlClient } from "@/lib/db";
import {
  RELATION_TYPES,
  type RelationInput,
  type RelationTypeId,
} from "./relation-types";

export type { SqlClient };

const sql = neonSql as unknown as SqlClient;

export interface MatchRow {
  id: string;
  userId: string;
  subjectProfileId: string;
  counterpartProfileId: string;
  relation: RelationInput;
  createdAt: string;
}

/** DB 의 '' ↔ TS 의 null. 이 변환을 아는 유일한 자리다. */
const toNull = (v: unknown): string | null => {
  const s = typeof v === "string" ? v : "";
  return s === "" ? null : s;
};

const toText = (v: string | null): string => v ?? "";

function toRelationType(v: unknown): RelationTypeId | null {
  const s = toNull(v);
  // 목록에서 지워진 유형이 DB 에 남아 있을 수 있다. 모르는 값은 "유형 없음" 으로
  // 접어 범용 렌즈로 물러선다 — 옛 행 하나 때문에 화면이 깨지게 두지 않는다.
  return s !== null && Object.hasOwn(RELATION_TYPES, s) ? (s as RelationTypeId) : null;
}

export function toMatchRow(r: Record<string, unknown>): MatchRow {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    subjectProfileId: String(r.subject_profile_id),
    counterpartProfileId: String(r.counterpart_profile_id),
    relation: {
      type: toRelationType(r.relation_type),
      subjectRole: toNull(r.subject_role),
      counterpartRole: toNull(r.counterpart_role),
    },
    createdAt: String(r.created_at),
  };
}

export interface CreateMatchInput {
  subjectProfileId: string;
  counterpartProfileId: string;
  relation: RelationInput;
}

/**
 * 같은 쌍·같은 관계는 한 행으로 수렴시킨다 (matches_unique).
 *
 * INSERT ... ON CONFLICT DO NOTHING 뒤에 SELECT 를 두는 이유: DO NOTHING 은
 * 충돌한 행을 RETURNING 으로 돌려주지 않는다. DO UPDATE 로 억지로 돌려받는 방법도
 * 있지만, 그러면 남의 재요청이 created_at 을 계속 밀어낸다.
 *
 * created 를 돌려주는 이유: 이용권이 붙으면 "새로 만든 경우에만 차감" 이 필요하다.
 * 그 판단을 access.ts 가 할 수 있게 여기서 사실만 넘긴다.
 */
export async function findOrCreateMatch(
  userId: string,
  input: CreateMatchInput,
  client: SqlClient = sql,
): Promise<{ id: string; created: boolean }> {
  const type = toText(input.relation.type);
  const subjectRole = toText(input.relation.subjectRole);
  const counterpartRole = toText(input.relation.counterpartRole);

  const inserted = await client`
    INSERT INTO matches (
      user_id, subject_profile_id, counterpart_profile_id,
      relation_type, subject_role, counterpart_role
    ) VALUES (
      ${userId}::bigint, ${input.subjectProfileId}::bigint, ${input.counterpartProfileId}::bigint,
      ${type}, ${subjectRole}, ${counterpartRole}
    )
    ON CONFLICT (subject_profile_id, counterpart_profile_id, relation_type, subject_role, counterpart_role)
    DO NOTHING
    RETURNING id
  `;
  const row = inserted[0] as { id: string | number } | undefined;
  if (row) return { id: String(row.id), created: true };

  const existing = await client`
    SELECT id FROM matches
     WHERE subject_profile_id = ${input.subjectProfileId}::bigint
       AND counterpart_profile_id = ${input.counterpartProfileId}::bigint
       AND relation_type = ${type}
       AND subject_role = ${subjectRole}
       AND counterpart_role = ${counterpartRole}
  `;
  const found = existing[0] as { id: string | number } | undefined;
  // 충돌해서 안 넣었는데 찾지도 못하는 건 인덱스와 조회 조건이 어긋났다는 뜻이다.
  // 조용히 null 을 흘리면 화면이 "궁합을 찾을 수 없다" 로만 보여 원인이 묻힌다.
  if (!found) throw new Error("findOrCreateMatch: 충돌한 행을 다시 찾지 못했습니다");
  return { id: String(found.id), created: false };
}

/**
 * 내 궁합 하나.
 *
 * ⚠️ user_id 조건이 이 함수의 존재 이유다. matches.id 는 순번 bigint 라
 * URL(/match/<id>)에 노출된다 — id 만으로 찾으면 파라미터를 증가시켜 남의 궁합을
 * 읽을 수 있다 (profiles.getProfile 과 같은 판단).
 */
export async function getMatch(
  userId: string,
  id: string,
  client: SqlClient = sql,
): Promise<MatchRow | null> {
  const rows = await client`
    SELECT * FROM matches WHERE id = ${id}::bigint AND user_id = ${userId}::bigint
  `;
  const row = rows[0];
  return row ? toMatchRow(row) : null;
}
