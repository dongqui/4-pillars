import { sql as neonSql, type SqlClient } from "@/lib/db";
import type { FlowMonth } from "@/app/api/flows/_lib/pivots";
import type { ContextSnapshot } from "./context";

const sql = neonSql as unknown as SqlClient;

export type RevisionPhase = "draft" | "review" | "repair" | "review_repaired" | "complete" | "failed";

export interface FlowRevisionRow {
  id: string; flowId: string;
  formatVersion: number; promptBundleVersion: number;
  idempotencyKey: string; requestHash: string;
  contextSnapshot: ContextSnapshot;
  /** v2/input.ts 의 FlowGenerationInput. 여기서 타입을 import 하면 lib → app 의존이 생겨 unknown 으로 둔다 */
  inputSnapshot: unknown;
  monthsSnapshot: FlowMonth[];
  phase: RevisionPhase;
  publishedPayload: unknown | null;
  validationErrors: unknown | null;
  model: string | null; usageSummary: unknown | null; failureCode: string | null;
  admittedAt: Date | null;
  createdAt: Date; updatedAt: Date; publishedAt: Date | null;
}

function parseJsonb(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return undefined; }
}
/** 화면이 모양을 전제하는 컬럼. 문자열이면 파싱, 아니면 던진다(flows/store.ts 의 toMonths 와 같은 판단). */
function required(v: unknown, col: string, id: unknown, check: (x: unknown) => boolean): unknown {
  const parsed = parseJsonb(v);
  if (!check(parsed)) throw new Error(`toRevisionRow: revision ${String(id)} 의 ${col} 모양이 맞지 않습니다`);
  return parsed;
}
const isObject = (x: unknown) => typeof x === "object" && x !== null && !Array.isArray(x);
const isNonEmptyArray = (x: unknown) => Array.isArray(x) && x.length > 0;
const dateOrNull = (v: unknown) => (v == null ? null : new Date(v as string));

export function toRevisionRow(raw: Record<string, unknown>): FlowRevisionRow {
  return {
    id: String(raw.id), flowId: String(raw.flow_id),
    formatVersion: Number(raw.format_version), promptBundleVersion: Number(raw.prompt_bundle_version),
    idempotencyKey: String(raw.idempotency_key), requestHash: String(raw.request_hash),
    contextSnapshot: required(raw.context_snapshot, "context_snapshot", raw.id, isObject) as ContextSnapshot,
    inputSnapshot: required(raw.input_snapshot, "input_snapshot", raw.id, isObject),
    monthsSnapshot: required(raw.months_snapshot, "months_snapshot", raw.id, isNonEmptyArray) as FlowMonth[],
    phase: raw.phase as RevisionPhase,
    publishedPayload: raw.published_payload == null ? null : required(raw.published_payload, "published_payload", raw.id, isObject),
    validationErrors: parseJsonb(raw.validation_errors) ?? null,
    model: raw.model == null ? null : String(raw.model),
    usageSummary: parseJsonb(raw.usage_summary) ?? null,
    failureCode: raw.failure_code == null ? null : String(raw.failure_code),
    admittedAt: dateOrNull(raw.admitted_at),
    createdAt: new Date(raw.created_at as string), updatedAt: new Date(raw.updated_at as string),
    publishedAt: dateOrNull(raw.published_at),
  };
}

export interface PendingRevisionInput {
  promptBundleVersion: number; idempotencyKey: string; requestHash: string;
  contextSnapshot: ContextSnapshot; inputSnapshot: unknown; monthsSnapshot: FlowMonth[];
}
export type UpsertResult =
  | { kind: "created" | "same" | "replaced"; revision: FlowRevisionRow }
  | { kind: "none" } | { kind: "busy" };

/**
 * pending 을 만들거나, 같은 입력의 pending 으로 수렴하거나, 아직 과금 전인 pending 의 답을 갈아끼운다.
 * INSERT … SELECT … FOR UPDATE 가 publishRevision 의 UPDATE flows 와 직렬화되어, 발행된
 * flow·v1 본문이 있는 flow 에는 넣지 않는다. 자세한 규칙은 스펙 §5.
 */
export async function upsertPendingRevision(
  flowId: string, input: PendingRevisionInput, client: SqlClient = sql,
): Promise<UpsertResult> {
  const inserted = await client`
    INSERT INTO flow_report_revisions
      (flow_id, prompt_bundle_version, idempotency_key, request_hash, context_snapshot, input_snapshot, months_snapshot, phase)
    SELECT f.id, ${input.promptBundleVersion}, ${input.idempotencyKey}, ${input.requestHash},
           ${JSON.stringify(input.contextSnapshot)}::jsonb, ${JSON.stringify(input.inputSnapshot)}::jsonb,
           ${JSON.stringify(input.monthsSnapshot)}::jsonb, 'draft'
      FROM flows f
     WHERE f.id = ${flowId}::bigint AND f.active_revision_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM flow_sections s WHERE s.flow_id = f.id)
       FOR UPDATE OF f
    ON CONFLICT (flow_id) WHERE phase NOT IN ('complete','failed') DO NOTHING
    RETURNING *
  `;
  if (inserted[0]) return { kind: "created", revision: toRevisionRow(inserted[0]) };

  const pending = await findPendingRevision(flowId, client);
  if (!pending) return { kind: "none" };
  if (pending.requestHash === input.requestHash) return { kind: "same", revision: pending };

  const replaced = await client`
    UPDATE flow_report_revisions
       SET context_snapshot = ${JSON.stringify(input.contextSnapshot)}::jsonb,
           input_snapshot = ${JSON.stringify(input.inputSnapshot)}::jsonb,
           months_snapshot = ${JSON.stringify(input.monthsSnapshot)}::jsonb,
           request_hash = ${input.requestHash}, updated_at = now()
     WHERE id = ${pending.id}::bigint AND phase='draft' AND admitted_at IS NULL
    RETURNING *
  `;
  return replaced[0] ? { kind: "replaced", revision: toRevisionRow(replaced[0]) } : { kind: "busy" };
}

export async function findPendingRevision(flowId: string, client: SqlClient = sql) {
  const rows = await client`
    SELECT * FROM flow_report_revisions
     WHERE flow_id = ${flowId}::bigint AND phase NOT IN ('complete','failed') LIMIT 1`;
  return rows[0] ? toRevisionRow(rows[0]) : null;
}
export async function findLatestRevision(flowId: string, client: SqlClient = sql) {
  const rows = await client`
    SELECT * FROM flow_report_revisions WHERE flow_id = ${flowId}::bigint ORDER BY created_at DESC, id DESC LIMIT 1`;
  return rows[0] ? toRevisionRow(rows[0]) : null;
}
export async function getActiveRevision(flowId: string, client: SqlClient = sql) {
  const rows = await client`
    SELECT r.* FROM flows f
      JOIN flow_report_revisions r ON r.id = f.active_revision_id AND r.flow_id = f.id
     WHERE f.id = ${flowId}::bigint`;
  return rows[0] ? toRevisionRow(rows[0]) : null;
}

/** 과금이 끝났음을 박제하고 그 시점의 행을 돌려준다. 생성기는 이 행의 input_snapshot 으로 돌린다. */
export async function admitRevision(revisionId: string, client: SqlClient = sql) {
  const rows = await client`
    UPDATE flow_report_revisions SET admitted_at = COALESCE(admitted_at, now()), updated_at = now()
     WHERE id = ${revisionId}::bigint AND phase='draft' RETURNING *`;
  return rows[0] ? toRevisionRow(rows[0]) : null;
}

export async function publishRevision(
  revisionId: string, flowId: string,
  a: { payload: unknown; model: string; usage: unknown }, client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    WITH r AS (
      UPDATE flow_report_revisions
         SET phase = 'complete', published_payload = ${JSON.stringify(a.payload)}::jsonb, model = ${a.model},
             usage_summary = ${a.usage == null ? null : JSON.stringify(a.usage)}::jsonb,
             published_at = now(), updated_at = now()
       WHERE id = ${revisionId}::bigint AND flow_id = ${flowId}::bigint AND phase='draft'
       RETURNING id, flow_id
    )
    UPDATE flows SET active_revision_id = r.id FROM r WHERE flows.id = r.flow_id RETURNING flows.id`;
  return rows.length > 0;
}

export async function failRevision(
  revisionId: string,
  a: { failureCode: string; validationErrors: unknown; model: string | null; usage: unknown },
  client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    UPDATE flow_report_revisions
       SET phase = 'failed', failure_code = ${a.failureCode},
           validation_errors = ${a.validationErrors == null ? null : JSON.stringify(a.validationErrors)}::jsonb,
           model = ${a.model}, usage_summary = ${a.usage == null ? null : JSON.stringify(a.usage)}::jsonb,
           updated_at = now()
     WHERE id = ${revisionId}::bigint AND phase='draft' RETURNING id`;
  return rows.length > 0;
}
