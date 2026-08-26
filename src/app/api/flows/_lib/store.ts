import { sql as neonSql, type SqlClient } from "@/lib/db";
import {
  assignFlow,
  flowSectionVersion,
  isFlowSectionKey,
  parseFlowSectionContent,
  type FlowInterpretation,
  type FlowSectionKey,
} from "./sections";

export type { SqlClient };

const sql = neonSql as unknown as SqlClient;

export interface StoredFlowSections {
  have: Partial<FlowInterpretation>;
  missing: FlowSectionKey[];
}

export interface FlowSectionWrite {
  sectionKey: FlowSectionKey;
  content: unknown;
}

/**
 * jsonb 컬럼을 파싱한다. Neon HTTP 드라이버는 jsonb 를 이미 파싱해서 줄 때도 있고
 * 문자열 그대로 줄 때도 있다 — src/lib/consultations/store.ts 의 toStringArray,
 * src/lib/flows/store.ts 의 toSegments 가 이미 겪은 드라이버 특성이다.
 *
 * 다만 그 두 선례를 그대로 베끼면 안 된다. flow_sections 은 캐시가 아니라
 * **이용권을 써서 산 결과물** 이다 — toStringArray 처럼 빈 배열로 죽이면 멀쩡히 산
 * 서술이 빈 값으로 보이고, toSegments 처럼 던지면 그 행 하나 때문에 요청 전체가
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
 * 행 배열을 have/missing 으로 가른다.
 *
 * 버리는 경우가 궁합보다 하나 많다 — **구간 수 불일치**. flows.segments 는 박제라
 * 정상적으로는 바뀌지 않지만, 만에 하나 어긋나면 11월 서술이 2월 칸에 붙으므로
 * 조용히 통과시키지 않고 "없는 섹션" 으로 만들어 다시 생성하게 한다.
 */
export function decodeFlowSections(
  rows: Record<string, unknown>[],
  keys: FlowSectionKey[],
  n: number,
): StoredFlowSections {
  const wanted = new Set<string>(keys);
  const have: Partial<FlowInterpretation> = {};

  for (const row of rows) {
    const key = row.section_key;
    if (!isFlowSectionKey(key) || !wanted.has(key)) continue;
    if (row.schema_version !== flowSectionVersion(key)) continue;
    const content = parseFlowSectionContent(key, parseJsonbContent(row.content), n);
    if (content === null) continue;
    assignFlow(have, key, content);
  }

  return { have, missing: keys.filter((k) => !(k in have)) };
}

export async function getFlowSections(
  flowId: string,
  keys: FlowSectionKey[],
  n: number,
  client: SqlClient = sql,
): Promise<StoredFlowSections> {
  if (keys.length === 0) return { have: {}, missing: [] };
  const rows = await client`
    SELECT section_key, content, schema_version
      FROM flow_sections
     WHERE flow_id = ${flowId}::bigint AND section_key = ANY(${keys}::text[])
  `;
  return decodeFlowSections(rows, keys, n);
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
