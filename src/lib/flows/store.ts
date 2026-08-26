import { sql as neonSql, type SqlClient } from "@/lib/db";
import type { FlowSegment } from "@/app/api/flows/_lib/segments";

const sql = neonSql as unknown as SqlClient;

export interface FlowRow {
  id: string;
  userId: string;
  profileId: string;
  /** 명리 연도(세운). 달력 연도가 아니다 */
  flowYear: number;
  /** 발행 시점에 박제한 적용 기간 */
  periodStart: Date;
  periodEnd: Date;
  /** 발행 시점에 박제한 구간. 읽을 때 다시 계산하지 않는다 */
  segments: FlowSegment[];
  createdAt: Date;
}

export interface CreateFlowInput {
  profileId: string;
  flowYear: number;
  periodStart: Date;
  periodEnd: Date;
  segments: FlowSegment[];
}

/**
 * jsonb 로 저장된 segments 를 읽는다. Neon HTTP 드라이버가 이미 파싱된 배열을
 * 주는 경우와 JSON 문자열 그대로 주는 경우가 둘 다 있어 양쪽을 받는다
 * (consultations.toStringArray 와 같은 이유).
 *
 * consultations.toStringArray 와 다른 점: 모양이 다르면 빈 배열로 접지 않고
 * 던진다. segments 는 이 흐름의 서사 구간을 가르는 필드라 화면·PDF 등 아래
 * 소비자 전부가 "최소 한 구간은 있다" 를 전제로 짜여 있다 — 빈 배열이나 문자열을
 * 그대로 흘리면 .length 가 글자 수가 되고 인덱싱이 문자를 돌려주는데, 이게
 * 조용히 깨진 화면으로만 보이고 원인(드라이버가 문자열을 줬다는 사실)은 묻힌다.
 * findOrCreateFlow 가 충돌 후 null 대신 던지는 것과 같은 판단이다.
 */
function toSegments(v: unknown, flowId: unknown): FlowSegment[] {
  const raw = typeof v === "string" ? safeParse(v) : v;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`toFlowRow: flow ${String(flowId)} 의 segments 가 배열이 아닙니다`);
  }
  return raw as FlowSegment[];
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function toFlowRow(raw: Record<string, unknown>): FlowRow {
  return {
    id: String(raw.id),
    userId: String(raw.user_id),
    profileId: String(raw.profile_id),
    flowYear: Number(raw.flow_year),
    periodStart: new Date(raw.period_start as string),
    periodEnd: new Date(raw.period_end as string),
    segments: toSegments(raw.segments, raw.id),
    createdAt: new Date(raw.created_at as string),
  };
}

/** 이 프로필의 이 해. 확인 화면이 "이미 만든 적 있나" 를 묻는 자리다. */
export async function findFlow(
  profileId: string,
  flowYear: number,
  client: SqlClient = sql,
): Promise<FlowRow | null> {
  const rows = await client`
    SELECT * FROM flows
     WHERE profile_id = ${profileId}::bigint AND flow_year = ${flowYear}
  `;
  const row = rows[0];
  return row ? toFlowRow(row) : null;
}

/**
 * 행을 만들거나 기존 행으로 수렴한다.
 *
 * ⚠️ 여기서 이용권을 깎지 않는다. 행 생성은 공짜고 차감은 생성기 자리
 * (api/flows/_lib/gated-generator.ts)에서 일어난다 — 같은 프로필·같은 해를 다시
 * 제출해 flows_unique 로 기존 행에 수렴하는 요청, 즉 LLM 을 한 번도 부르지 않는
 * 요청이 이용권을 먹으면 안 되기 때문이다. (궁합의 access.ts 와 같은 판단)
 */
export async function findOrCreateFlow(
  userId: string,
  input: CreateFlowInput,
  client: SqlClient = sql,
): Promise<{ id: string; created: boolean }> {
  const inserted = await client`
    INSERT INTO flows (user_id, profile_id, flow_year, period_start, period_end, segments)
    VALUES (
      ${userId}::bigint, ${input.profileId}::bigint, ${input.flowYear},
      ${input.periodStart.toISOString()}::timestamptz,
      ${input.periodEnd.toISOString()}::timestamptz,
      ${JSON.stringify(input.segments)}::jsonb
    )
    ON CONFLICT (profile_id, flow_year) DO NOTHING
    RETURNING id
  `;
  const row = inserted[0] as { id: string | number } | undefined;
  if (row) return { id: String(row.id), created: true };

  const existing = await client`
    SELECT id FROM flows
     WHERE profile_id = ${input.profileId}::bigint AND flow_year = ${input.flowYear}
  `;
  const found = existing[0] as { id: string | number } | undefined;
  // 충돌해서 안 넣었는데 찾지도 못하는 건 인덱스와 조회 조건이 어긋났다는 뜻이다.
  // 조용히 null 을 흘리면 화면이 "흐름을 찾을 수 없다" 로만 보여 원인이 묻힌다.
  if (!found) throw new Error("findOrCreateFlow: 충돌한 행을 되찾지 못했습니다");
  return { id: String(found.id), created: false };
}

/**
 * 내 흐름 하나.
 *
 * ⚠️ user_id 조건이 이 함수의 존재 이유다. flows.id 는 순번 bigint 라
 * URL(/flow/<id>)에 노출된다 — id 만으로 찾으면 파라미터를 증가시켜 남의 흐름을
 * 읽을 수 있다 (matches.getMatch 와 같은 판단).
 */
export async function getFlow(
  userId: string,
  id: string,
  client: SqlClient = sql,
): Promise<FlowRow | null> {
  const rows = await client`
    SELECT * FROM flows WHERE id = ${id}::bigint AND user_id = ${userId}::bigint
  `;
  const row = rows[0];
  return row ? toFlowRow(row) : null;
}

/** 이미 본 흐름 목록. 최신순. */
export async function listFlows(
  userId: string,
  client: SqlClient = sql,
): Promise<FlowRow[]> {
  const rows = await client`
    SELECT * FROM flows WHERE user_id = ${userId}::bigint ORDER BY created_at DESC
  `;
  return rows.map(toFlowRow);
}
