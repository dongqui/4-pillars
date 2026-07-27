import { sql as neonSql } from "@/lib/db";
import type { Gender } from "@/lib/saju-core";
import {
  isSectionKey,
  parseSectionContent,
  sectionVersion,
  type Interpretation,
  type SectionKey,
} from "./sections";
import type { PillarsJson } from "./key";

/** 태그드 템플릿 SQL 클라이언트(주입 가능). 기본은 공유 neon 클라이언트. */
export type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

const sql = neonSql as unknown as SqlClient;

export interface CacheRecord {
  chartKey: string;
  gender: Gender;
  pillars: PillarsJson;
  interpretation: Partial<Interpretation>;
  model: string;
}

export interface SectionRecord {
  chartKey: string;
  sectionKey: SectionKey;
  content: Interpretation[SectionKey];
  model: string;
}

/** 조회 결과. missing 은 재생성 대상이다. */
export interface CachedSections {
  have: Partial<Interpretation>;
  missing: SectionKey[];
}

/**
 * 섹션 행 배열을 have/missing 으로 가른다. 테이블 이름과 무관해서
 * chart 캐시와 luck 캐시가 같이 쓴다.
 *
 * 행을 버리는 두 경우:
 *  - schema_version 불일치: 스키마가 바뀌었으니 옛 값은 못 쓴다
 *  - 파싱 실패: 버전은 맞는데 손상됐다
 * 둘 다 "없는 섹션"으로 만들어 그 섹션만 다시 뽑게 한다.
 */
export function decodeSections(
  rows: Record<string, unknown>[],
  keys: SectionKey[],
): CachedSections {
  const wanted = new Set<string>(keys);
  const have: Partial<Interpretation> = {};

  for (const row of rows) {
    const key = row.section_key;
    if (!isSectionKey(key) || !wanted.has(key)) continue;
    if (row.schema_version !== sectionVersion(key)) continue;
    const content = parseSectionContent(key, row.content);
    if (content === null) continue;
    have[key] = content;
  }

  return { have, missing: keys.filter((k) => !(k in have)) };
}

/**
 * 요청한 섹션들을 캐시에서 읽는다. 전부 있어야 한다고 요구하지 않는 이유:
 * 무료 사용자는 유료 섹션이 아예 없으므로, 전부를 요구하면 영원히 캐시 미스가 난다.
 */
export async function getCached(
  chartKey: string,
  keys: SectionKey[],
  client: SqlClient = sql,
): Promise<CachedSections> {
  if (keys.length === 0) return { have: {}, missing: [] };
  const rows = await client`
    SELECT section_key, content, schema_version
    FROM saju_interpretation_sections
    WHERE chart_key = ${chartKey} AND section_key = ANY(${keys}::text[])
  `;
  return decodeSections(rows, keys);
}

/**
 * 해석을 멱등 저장(동일 키 동시 삽입은 선착순, 나머지 무시).
 * 부모 행 → 섹션 행 순서로 넣는다(섹션의 FK가 부모를 참조).
 */
export async function putCached(record: CacheRecord, client: SqlClient = sql): Promise<void> {
  await client`
    INSERT INTO saju_interpretations (chart_key, gender, pillars, model)
    VALUES (
      ${record.chartKey},
      ${record.gender},
      ${JSON.stringify(record.pillars)}::jsonb,
      ${record.model}
    )
    ON CONFLICT (chart_key) DO NOTHING
  `;
  await client`
    INSERT INTO saju_interpretation_sections (chart_key, section_key, content, model)
    SELECT ${record.chartKey}, e.key, e.value, ${record.model}
    FROM jsonb_each(${JSON.stringify(record.interpretation)}::jsonb) AS e
    ON CONFLICT (chart_key, section_key) DO NOTHING
  `;
}

/**
 * 섹션 하나를 덮어쓴다. 프롬프트/모델을 바꿔 특정 섹션만 다시 뽑을 때 사용.
 * putCached와 달리 기존 값을 갱신한다.
 */
export async function putSection(
  record: SectionRecord,
  client: SqlClient = sql,
): Promise<void> {
  await client`
    INSERT INTO saju_interpretation_sections (chart_key, section_key, content, model)
    VALUES (
      ${record.chartKey},
      ${record.sectionKey},
      ${JSON.stringify(record.content)}::jsonb,
      ${record.model}
    )
    ON CONFLICT (chart_key, section_key) DO UPDATE
    SET content = EXCLUDED.content, model = EXCLUDED.model, updated_at = now()
  `;
}
