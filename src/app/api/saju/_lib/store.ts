import { sql as neonSql } from "@/lib/db";
import type { Gender } from "@/lib/saju-core";
import { SECTION_KEYS, type Interpretation, type SectionKey } from "./types";
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
  interpretation: Interpretation;
  model: string;
}

export interface SectionRecord {
  chartKey: string;
  sectionKey: SectionKey;
  content: Interpretation[SectionKey];
  model: string;
}

/**
 * 원국 키로 캐시된 해석을 조회. 섹션 행들을 Interpretation으로 조립한다.
 * 섹션이 하나라도 빠졌으면(부분 생성 중이거나 스키마가 늘어난 경우) null을
 * 반환해 재생성시킨다.
 */
export async function getCached(
  chartKey: string,
  client: SqlClient = sql,
): Promise<Interpretation | null> {
  const rows = await client`
    SELECT section_key, content FROM saju_interpretation_sections WHERE chart_key = ${chartKey}
  `;
  const bySection = new Map(rows.map((r) => [r.section_key as string, r.content]));
  if (!SECTION_KEYS.every((k) => bySection.has(k))) return null;

  const interpretation = {} as Record<SectionKey, unknown>;
  for (const key of SECTION_KEYS) interpretation[key] = bySection.get(key);
  return interpretation as unknown as Interpretation;
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
