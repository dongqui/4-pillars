import { sql as neonSql, type SqlClient } from "@/lib/db";
import {
  assignMatch,
  isMatchSectionKey,
  matchSectionVersion,
  parseMatchSectionContent,
  type MatchInterpretation,
  type MatchSectionKey,
} from "./sections";

export type { SqlClient };

const sql = neonSql as unknown as SqlClient;

export interface StoredMatchSections {
  have: Partial<MatchInterpretation>;
  missing: MatchSectionKey[];
}

/**
 * 행 배열을 have/missing 으로 가른다.
 * 버리는 두 경우(버전 불일치 · 파싱 실패)는 리포트 store.decodeSections 와 같다.
 */
export function decodeMatchSections(
  rows: Record<string, unknown>[],
  keys: MatchSectionKey[],
): StoredMatchSections {
  const wanted = new Set<string>(keys);
  const have: Partial<MatchInterpretation> = {};

  for (const row of rows) {
    const key = row.section_key;
    if (!isMatchSectionKey(key) || !wanted.has(key)) continue;
    if (row.schema_version !== matchSectionVersion(key)) continue;
    const content = parseMatchSectionContent(key, row.content);
    if (content === null) continue;
    assignMatch(have, key, content);
  }

  return { have, missing: keys.filter((k) => !(k in have)) };
}

export async function getMatchSections(
  matchId: string,
  keys: MatchSectionKey[],
  client: SqlClient = sql,
): Promise<StoredMatchSections> {
  if (keys.length === 0) return { have: {}, missing: [] };
  const rows = await client`
    SELECT section_key, content, schema_version
    FROM match_sections
    WHERE match_id = ${matchId}::bigint AND section_key = ANY(${keys}::text[])
  `;
  return decodeMatchSections(rows, keys);
}

/**
 * 섹션들을 한 번에 저장.
 *
 * ON CONFLICT 가 조건부 DO UPDATE 인 이유는 리포트 putSections 와 같다:
 * DO NOTHING 으로 두면 버전이 올라간 뒤 옛 행이 영원히 남아, 열 때마다 재생성 →
 * 저장 실패 → 재생성을 반복하며 LLM 비용만 나간다. 궁합에서는 그 비용이 곧
 * 이용권 원가라 리포트보다 더 아프다.
 */
export async function putMatchSections(
  matchId: string,
  interpretation: Partial<MatchInterpretation>,
  model: string,
  client: SqlClient = sql,
): Promise<void> {
  const entries = Object.entries(interpretation).filter(
    ([key, content]) => content !== undefined && isMatchSectionKey(key),
  ) as [MatchSectionKey, unknown][];
  if (entries.length === 0) return;

  const keys = entries.map(([k]) => k);
  const contents = entries.map(([, c]) => JSON.stringify(c));
  const versions = entries.map(([k]) => matchSectionVersion(k));

  await client`
    INSERT INTO match_sections (match_id, section_key, content, model, schema_version)
    SELECT ${matchId}::bigint, t.k, t.c::jsonb, ${model}, t.v
    FROM UNNEST(${keys}::text[], ${contents}::text[], ${versions}::int[]) AS t(k, c, v)
    ON CONFLICT (match_id, section_key) DO UPDATE
    SET content = EXCLUDED.content,
        model = EXCLUDED.model,
        schema_version = EXCLUDED.schema_version,
        updated_at = now()
    WHERE match_sections.schema_version <> EXCLUDED.schema_version
  `;
}
