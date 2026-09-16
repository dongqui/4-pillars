import { sql as neonSql, type SqlClient } from "@/lib/db";
import {
  assignFlow,
  flowSectionVersion,
  isFlowSectionKey,
  safeParseFlowSectionContent,
  type FlowInterpretation,
  type FlowSectionKey,
} from "./sections";

export type { SqlClient };

const sql = neonSql as unknown as SqlClient;

export interface StoredFlowSections {
  have: Partial<FlowInterpretation>;
  missing: FlowSectionKey[];
}

/**
 * jsonb 컬럼을 파싱한다. Neon HTTP 드라이버는 jsonb 를 이미 파싱해서 줄 때도 있고
 * 문자열 그대로 줄 때도 있다 — src/lib/consultations/store.ts 의 toStringArray,
 * src/lib/flows/store.ts 의 toMonths 가 이미 겪은 드라이버 특성이다.
 *
 * 다만 그 두 선례를 그대로 베끼면 안 된다. flow_sections 은 캐시가 아니라
 * **이용권을 써서 산 결과물** 이다 — toStringArray 처럼 빈 배열로 죽이면 멀쩡히 산
 * 서술이 빈 값으로 보이고, toMonths 처럼 던지면 그 행 하나 때문에 요청 전체가
 * 끊긴다. 여기서는 문자열이면 파싱만 시도해 아래 스키마 검증으로 넘긴다 —
 * 파싱에 성공하면 원래 값과 똑같이 통과해 헛되이 재생성되지 않고, 파싱 자체가
 * 깨졌으면 undefined 가 되어 뒤이은 스키마 검증에서 자연히 실패해 기존
 * "없는 섹션(missing)" 경로를 그대로 탄다 — 절반만 렌더링하느니 다시 만드는 쪽.
 */
function parseJsonbContent(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return undefined;
  }
}

/**
 * 행 배열을 have/missing 으로 가른다. 궁합의 decodeMatchSections 와 같은 계약이다.
 *
 * 검증에 걸린 행을 버리고 다시 만드는 비용은 지갑에 닿지 않는다 — entitlements
 * 행이 남아 있어 spendTicket 이 kind:"already" 로 돌아온다.
 */
export function decodeFlowSections(
  rows: Record<string, unknown>[],
  keys: FlowSectionKey[],
): StoredFlowSections {
  const wanted = new Set<string>(keys);
  const have: Partial<FlowInterpretation> = {};

  for (const row of rows) {
    const key = row.section_key;
    if (!isFlowSectionKey(key) || !wanted.has(key)) continue;
    if (row.schema_version !== flowSectionVersion(key)) continue;
    const parsed = safeParseFlowSectionContent(key, parseJsonbContent(row.content));
    if (!parsed.ok) {
      // 버전이 맞는데 검증에 걸린 행이다 — 버전 불일치는 바로 위에서 이미 걸러졌다.
      // 정상적으로는 나올 수 없는 상태(jsonb 손상 등)이고, 조용히 넘기면 매 열람마다
      // 그 섹션만 영원히 다시 만들어진다. 지갑은 안 깎이지만 LLM 호출은 매번 든다 —
      // 그러니 흔적을 남긴다.
      console.warn(
        `[decodeFlowSections] 저장된 섹션이 검증에 걸림, 다시 만든다: ${key}` +
          `\n  이유: ${parsed.reason}`,
      );
      continue;
    }
    assignFlow(have, key, parsed.content);
  }

  return { have, missing: keys.filter((k) => !(k in have)) };
}

export async function getFlowSections(
  flowId: string,
  keys: FlowSectionKey[],
  client: SqlClient = sql,
): Promise<StoredFlowSections> {
  if (keys.length === 0) return { have: {}, missing: [] };
  const rows = await client`
    SELECT section_key, content, schema_version
      FROM flow_sections
     WHERE flow_id = ${flowId}::bigint AND section_key = ANY(${keys}::text[])
  `;
  return decodeFlowSections(rows, keys);
}

/**
 * flow_sections 행이 하나라도 있는가. 검증된 have 가 아니라 **행 존재**다 — 낡은
 * schema_version 만 남은 v1 흐름도 v1 이다(resolveFlowRoute 가 v2 로 보내면 안 된다).
 */
export async function hasAnyFlowSections(flowId: string, client: SqlClient = sql): Promise<boolean> {
  const rows = await client`SELECT 1 AS one FROM flow_sections WHERE flow_id = ${flowId}::bigint LIMIT 1`;
  return rows.length > 0;
}

export async function putFlowSections(
  flowId: string,
  interpretation: Partial<FlowInterpretation>,
  model: string,
  client: SqlClient = sql,
): Promise<void> {
  const entries = Object.entries(interpretation).filter(([k]) => isFlowSectionKey(k));
  if (entries.length === 0) return;

  const keys = entries.map(([k]) => k);
  const contents = entries.map(([, v]) => JSON.stringify(v));
  const versions = entries.map(([k]) => flowSectionVersion(k as FlowSectionKey));

  await client`
    INSERT INTO flow_sections (flow_id, section_key, content, model, schema_version)
    SELECT ${flowId}::bigint, t.k, t.c::jsonb, ${model}, t.v
      FROM UNNEST(${keys}::text[], ${contents}::text[], ${versions}::int[]) AS t(k, c, v)
    ON CONFLICT (flow_id, section_key) DO UPDATE
       SET content = EXCLUDED.content,
           model = EXCLUDED.model,
           schema_version = EXCLUDED.schema_version,
           updated_at = now()
  `;
}
