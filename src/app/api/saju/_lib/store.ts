import { sql as neonSql } from "@/lib/db";
import type { Gender } from "@/lib/saju-core";
import {
  assign,
  isSectionKey,
  parseSectionContent,
  sectionVersion,
  type Interpretation,
  type SectionContent,
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
    assign(have, key, content);
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
 * 섹션 하나의 쓰기 단위. 매핑 타입으로 만들어 sectionKey 와 content 가 짝지어진다.
 * { sectionKey: "personality", content: { title, body } } 는 컴파일 에러 —
 * personality 는 배열이다.
 */
export type SectionWrite = {
  [K in SectionKey]: { sectionKey: K; content: SectionContent<K> };
}[SectionKey];

export type SectionRecord = {
  [K in SectionKey]: {
    chartKey: string;
    sectionKey: K;
    content: SectionContent<K>;
    model: string;
  };
}[SectionKey];

/** Partial<Interpretation> 을 쓰기 목록으로 편다. 값이 없는 섹션은 건너뛴다. */
export function toSectionWrites(interpretation: Partial<Interpretation>): SectionWrite[] {
  const writes: SectionWrite[] = [];
  for (const [key, content] of Object.entries(interpretation)) {
    if (content === undefined || !isSectionKey(key)) continue;
    writes.push({ sectionKey: key, content } as SectionWrite);
  }
  return writes;
}

/**
 * 섹션들을 한 번에 삽입(선착순, 기존 값 유지).
 * jsonb_each 대신 UNNEST 를 쓰는 이유: 섹션마다 schema_version 이 달라야 한다.
 * content 를 text[] 로 보내고 행마다 jsonb 로 캐스팅한다 (jsonb[] 파라미터는 드라이버가 까다롭다).
 */
export async function putSections(
  chartKey: string,
  sections: SectionWrite[],
  model: string,
  client: SqlClient = sql,
): Promise<void> {
  if (sections.length === 0) return;
  const keys = sections.map((s) => s.sectionKey);
  const contents = sections.map((s) => JSON.stringify(s.content));
  const versions = sections.map((s) => sectionVersion(s.sectionKey));
  await client`
    INSERT INTO saju_interpretation_sections (chart_key, section_key, content, model, schema_version)
    SELECT ${chartKey}, t.k, t.c::jsonb, ${model}, t.v
    FROM UNNEST(${keys}::text[], ${contents}::text[], ${versions}::int[]) AS t(k, c, v)
    ON CONFLICT (chart_key, section_key) DO NOTHING
  `;
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
  await putSections(record.chartKey, toSectionWrites(record.interpretation), record.model, client);
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
    INSERT INTO saju_interpretation_sections (chart_key, section_key, content, model, schema_version)
    VALUES (
      ${record.chartKey},
      ${record.sectionKey},
      ${JSON.stringify(record.content)}::jsonb,
      ${record.model},
      ${sectionVersion(record.sectionKey)}
    )
    ON CONFLICT (chart_key, section_key) DO UPDATE
    SET content = EXCLUDED.content,
        model = EXCLUDED.model,
        schema_version = EXCLUDED.schema_version,
        updated_at = now()
  `;
}
