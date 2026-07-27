import { sql as neonSql } from "@/lib/db";
import { decodeSections, type CachedSections, type SectionWrite, type SqlClient } from "./store";
import { sectionVersion, type SectionKey } from "./sections";

const sql = neonSql as unknown as SqlClient;

/**
 * 생시 의존 섹션 캐시. 테이블과 키 컬럼만 다르고 해석 규칙은 chart 캐시와 같아
 * decodeSections 를 공유한다. 태그드 템플릿에 테이블명을 끼워 넣을 수 없어
 * 쿼리는 따로 쓴다.
 */
export async function getLuckCached(
  luckKey: string,
  keys: SectionKey[],
  client: SqlClient = sql,
): Promise<CachedSections> {
  if (keys.length === 0) return { have: {}, missing: [] };
  const rows = await client`
    SELECT section_key, content, schema_version
    FROM saju_luck_sections
    WHERE luck_key = ${luckKey} AND section_key = ANY(${keys}::text[])
  `;
  return decodeSections(rows, keys);
}

/**
 * chart 쪽 putSections 와 달리 DO UPDATE 다.
 * luck_key 에 연도가 들어가 있어 같은 키로 다시 쓰는 일은 재생성뿐이고,
 * 그때는 새 값이 맞다.
 */
export async function putLuckSections(
  luckKey: string,
  sections: SectionWrite[],
  model: string,
  client: SqlClient = sql,
): Promise<void> {
  if (sections.length === 0) return;
  const keys = sections.map((s) => s.sectionKey);
  const contents = sections.map((s) => JSON.stringify(s.content));
  const versions = sections.map((s) => sectionVersion(s.sectionKey));
  await client`
    INSERT INTO saju_luck_sections (luck_key, section_key, content, model, schema_version)
    SELECT ${luckKey}, t.k, t.c::jsonb, ${model}, t.v
    FROM UNNEST(${keys}::text[], ${contents}::text[], ${versions}::int[]) AS t(k, c, v)
    ON CONFLICT (luck_key, section_key) DO UPDATE
    SET content = EXCLUDED.content,
        model = EXCLUDED.model,
        schema_version = EXCLUDED.schema_version,
        updated_at = now()
  `;
}
