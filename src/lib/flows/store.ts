import { sql as neonSql, type SqlClient } from "@/lib/db";
import type { FlowMonth } from "@/app/api/flows/_lib/pivots";

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
  /** 발행 시점에 박제한 12개월 + 변곡점 플래그. 읽을 때 다시 계산하지 않는다 */
  months: FlowMonth[];
  createdAt: Date;
}

export interface CreateFlowInput {
  profileId: string;
  flowYear: number;
  periodStart: Date;
  periodEnd: Date;
  months: FlowMonth[];
}

/**
 * jsonb 로 저장된 months 를 읽는다. Neon HTTP 드라이버가 이미 파싱된 배열을
 * 주는 경우와 JSON 문자열 그대로 주는 경우가 둘 다 있어 양쪽을 받는다
 * (consultations.toStringArray 와 같은 이유).
 *
 * consultations.toStringArray 와 다른 점: 모양이 다르면 빈 배열로 접지 않고
 * 던진다. months 는 07(월별 흐름)·08(변곡점) 화면 전부가 "12칸이 있다" 를
 * 전제로 짜여 있다 — 빈 배열이나 문자열을 그대로 흘리면 .length 가 글자 수가
 * 되고 인덱싱이 문자를 돌려주는데, 이게 조용히 깨진 화면으로만 보이고 원인
 * (드라이버가 문자열을 줬다는 사실)은 묻힌다.
 */
function toMonths(v: unknown, flowId: unknown): FlowMonth[] {
  const raw = typeof v === "string" ? safeParse(v) : v;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`toFlowRow: flow ${String(flowId)} 의 months 가 배열이 아닙니다`);
  }
  return raw as FlowMonth[];
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
    months: toMonths(raw.months, raw.id),
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
): Promise<{ row: FlowRow; created: boolean }> {
  const inserted = await client`
    INSERT INTO flows (user_id, profile_id, flow_year, period_start, period_end, months)
    VALUES (
      ${userId}::bigint, ${input.profileId}::bigint, ${input.flowYear},
      ${input.periodStart.toISOString()}::timestamptz,
      ${input.periodEnd.toISOString()}::timestamptz,
      ${JSON.stringify(input.months)}::jsonb
    )
    ON CONFLICT (profile_id, flow_year) DO NOTHING
    RETURNING *
  `;
  const row = inserted[0];
  if (row) return { row: toFlowRow(row), created: true };

  const existing = await client`
    SELECT * FROM flows
     WHERE profile_id = ${input.profileId}::bigint AND flow_year = ${input.flowYear}
  `;
  const found = existing[0];
  // 충돌해서 안 넣었는데 찾지도 못하는 건 인덱스와 조회 조건이 어긋났다는 뜻이다.
  // 조용히 null 을 흘리면 화면이 "흐름을 찾을 수 없다" 로만 보여 원인이 묻힌다.
  if (!found) throw new Error("findOrCreateFlow: 충돌한 행을 되찾지 못했습니다");
  return { row: toFlowRow(found), created: false };
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

/**
 * 이 프로필로 만든 흐름의 연도 목록. 선택 화면이 연도 칸에 배지를 붙이는 자리다.
 *
 * 행 전체를 읽지 않는다 — months 를 12개씩 파싱해 봐야 이 화면은 id 와 연도만
 * 쓴다. 그리고 소유 여부는 여기가 아니라 entitlements 가 답한다: 행은 공짜로
 * 만들어지고 차감은 생성 자리에서 일어나므로, 생성이 막히면 행만 남고 권한은 없다.
 */
export async function listFlowYears(
  userId: string,
  profileId: string,
  client: SqlClient = sql,
): Promise<{ id: string; flowYear: number }[]> {
  const rows = await client`
    SELECT id, flow_year FROM flows
     WHERE user_id = ${userId}::bigint AND profile_id = ${profileId}::bigint
     ORDER BY flow_year DESC
  `;
  return rows.map((r) => ({ id: String(r.id), flowYear: Number(r.flow_year) }));
}
