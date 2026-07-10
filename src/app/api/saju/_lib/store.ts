import { sql as neonSql } from "@/lib/db";
import type { Gender } from "@/lib/saju-core";
import type { Interpretation } from "./types";
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

/** 원국 키로 캐시된 해석을 조회. 없으면 null. */
export async function getCached(
  chartKey: string,
  client: SqlClient = sql,
): Promise<Interpretation | null> {
  const rows = await client`
    SELECT interpretation FROM saju_interpretations WHERE chart_key = ${chartKey} LIMIT 1
  `;
  const row = rows[0] as { interpretation: Interpretation } | undefined;
  return row?.interpretation ?? null;
}

/** 해석을 멱등 저장(동일 키 동시 삽입은 선착순, 나머지 무시). */
export async function putCached(record: CacheRecord, client: SqlClient = sql): Promise<void> {
  await client`
    INSERT INTO saju_interpretations (chart_key, gender, pillars, interpretation, model)
    VALUES (
      ${record.chartKey},
      ${record.gender},
      ${JSON.stringify(record.pillars)}::jsonb,
      ${JSON.stringify(record.interpretation)}::jsonb,
      ${record.model}
    )
    ON CONFLICT (chart_key) DO NOTHING
  `;
}
