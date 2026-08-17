import { sql as neonSql, type SqlClient } from "@/lib/db";

// 재수출 — 테스트가 가짜 클라이언트를 만들 때 쓴다.
export type { SqlClient };

const sql = neonSql as unknown as SqlClient;

export interface ConsultationRow {
  id: string;
  userId: string;
  /** 프로필이 지워졌으면 null. 이미 나눈 대화는 남는다 */
  profileId: string | null;
  status: "open" | "closed";
  turnsUsed: number;
  turnLimit: number;
  title: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface MessageRow {
  id: string;
  role: "user" | "counselor";
  bubbles: string[];
  /** counselor 만 갖는다. 마지막 턴에는 빈 배열 */
  suggestions: string[] | null;
  crisis: boolean;
  turnNo: number;
  createdAt: string;
}

/** 목록 한 줄. 마지막 상담사 말풍선 한 개를 미리보기로 함께 읽는다 */
export interface ConsultationListItem extends ConsultationRow {
  lastBubble: string | null;
}

/**
 * jsonb 컬럼을 string[] 로 읽는다. 드라이버가 파싱해 주는 경우와 문자열로 주는
 * 경우가 둘 다 있어 양쪽을 받는다. 모양이 다르면 빈 배열로 떨어뜨린다 —
 * 화면에 깨진 값을 흘려보내느니 없는 게 낫다.
 */
function toStringArray(v: unknown): string[] {
  const raw = typeof v === "string" ? safeParse(v) : v;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function toConsultationRow(r: Record<string, unknown>): ConsultationRow {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    profileId: r.profile_id === null || r.profile_id === undefined ? null : String(r.profile_id),
    // 모르는 값은 closed 로 본다. 열린 것으로 잘못 보면 한도 검사를 통과해
    // 차감 없는 턴이 열린다 — 안전한 쪽으로 넘어진다.
    status: r.status === "open" ? "open" : "closed",
    turnsUsed: Number(r.turns_used),
    turnLimit: Number(r.turn_limit),
    title: typeof r.title === "string" ? r.title : null,
    createdAt: String(r.created_at),
    closedAt: r.closed_at === null || r.closed_at === undefined ? null : String(r.closed_at),
  };
}

export function toMessageRow(r: Record<string, unknown>): MessageRow {
  const suggestions = r.suggestions;
  return {
    id: String(r.id),
    role: r.role === "user" ? "user" : "counselor",
    bubbles: toStringArray(r.bubbles),
    suggestions:
      suggestions === null || suggestions === undefined ? null : toStringArray(suggestions),
    crisis: r.crisis === true,
    turnNo: Number(r.turn_no),
    createdAt: String(r.created_at),
  };
}

export interface CreateConsultationInput {
  userId: string;
  profileId: string | null;
  turnLimit: number;
}

export async function createConsultation(
  input: CreateConsultationInput,
  client: SqlClient = sql,
): Promise<ConsultationRow> {
  const rows = await client`
    INSERT INTO consultations (user_id, profile_id, turn_limit)
    VALUES (${input.userId}::bigint, ${input.profileId}::bigint, ${input.turnLimit})
    RETURNING *
  `;
  return toConsultationRow(rows[0]);
}

/** user_id 로 함께 거른다 — id 만으로는 남의 상담을 조회할 수 없다 */
export async function getConsultation(
  userId: string,
  id: string,
  client: SqlClient = sql,
): Promise<ConsultationRow | null> {
  const rows = await client`
    SELECT * FROM consultations
    WHERE user_id = ${userId}::bigint AND id = ${id}::bigint
  `;
  return rows[0] ? toConsultationRow(rows[0]) : null;
}

export async function listConsultations(
  userId: string,
  client: SqlClient = sql,
): Promise<ConsultationListItem[]> {
  const rows = await client`
    SELECT c.*, (
      SELECT m.bubbles FROM consultation_messages m
      WHERE m.consultation_id = c.id AND m.role = 'counselor'
      ORDER BY m.id DESC LIMIT 1
    ) AS last_bubbles
    FROM consultations c
    WHERE c.user_id = ${userId}::bigint
    ORDER BY (c.status = 'open') DESC, c.created_at DESC
  `;
  return rows.map((r) => ({
    ...toConsultationRow(r),
    lastBubble: toStringArray(r.last_bubbles)[0] ?? null,
  }));
}

export async function listMessages(
  consultationId: string,
  client: SqlClient = sql,
): Promise<MessageRow[]> {
  const rows = await client`
    SELECT * FROM consultation_messages
    WHERE consultation_id = ${consultationId}::bigint
    ORDER BY id
  `;
  return rows.map(toMessageRow);
}

export interface AppendMessageInput {
  consultationId: string;
  role: "user" | "counselor";
  bubbles: string[];
  suggestions?: string[] | null;
  crisis?: boolean;
  turnNo: number;
}

export async function appendMessage(
  input: AppendMessageInput,
  client: SqlClient = sql,
): Promise<MessageRow> {
  // jsonb 는 문자열로 바인딩한다 — 배열을 그대로 넘기면 드라이버가 postgres
  // 배열로 보내 jsonb 컬럼과 타입이 어긋난다.
  const suggestions =
    input.suggestions === undefined || input.suggestions === null
      ? null
      : JSON.stringify(input.suggestions);

  const rows = await client`
    INSERT INTO consultation_messages
      (consultation_id, role, bubbles, suggestions, crisis, turn_no)
    VALUES (
      ${input.consultationId}::bigint,
      ${input.role},
      ${JSON.stringify(input.bubbles)}::jsonb,
      ${suggestions}::jsonb,
      ${input.crisis ?? false},
      ${input.turnNo}
    )
    RETURNING *
  `;
  return toMessageRow(rows[0]);
}

export interface CommitTurnInput {
  id: string;
  turnsUsed: number;
  status: "open" | "closed";
  /** 첫 턴에만 값이 있다. null 이면 기존 제목을 유지한다 */
  title: string | null;
  tokensIn: number;
  tokensOut: number;
}

/**
 * 턴 수·상태·제목·토큰을 한 번에 올린다. 닫는 턴이면 closed_at 도 채운다.
 *
 * status 를 CTE(v)에 한 번만 바인딩하고 CASE 에서 v.status 를 참조한다 —
 * UPDATE 의 SET 표현식은 갱신 전 옛 값을 보므로, status 를 두 번째 자리에서
 * 다시 보간하면 "지금 이 턴에서 닫히는지"가 아니라 "갱신 전에 이미 닫혀 있었는지"를
 * 묻게 되어 open→closed 전환에서 closed_at 이 안 채워진다.
 */
export async function commitTurn(
  input: CommitTurnInput,
  client: SqlClient = sql,
): Promise<ConsultationRow> {
  const rows = await client`
    WITH v AS (
      SELECT
        ${input.turnsUsed}::int AS turns_used,
        ${input.status}::text AS status,
        ${input.title}::text AS title,
        ${input.tokensIn}::bigint AS tokens_in,
        ${input.tokensOut}::bigint AS tokens_out
    )
    UPDATE consultations SET
      turns_used = v.turns_used,
      status     = v.status,
      title      = COALESCE(v.title, consultations.title),
      tokens_in  = consultations.tokens_in + v.tokens_in,
      tokens_out = consultations.tokens_out + v.tokens_out,
      closed_at  = CASE WHEN v.status = 'closed' THEN now() ELSE consultations.closed_at END
    FROM v
    WHERE consultations.id = ${input.id}::bigint
    RETURNING consultations.*
  `;
  return toConsultationRow(rows[0]);
}
