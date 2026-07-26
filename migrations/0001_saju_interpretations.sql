-- 해석 캐시의 부모 행(원국 메타). 해석 본문은 saju_interpretation_sections에
-- 섹션 단위로 나눠 저장한다(0003 참조).
CREATE TABLE IF NOT EXISTS saju_interpretations (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chart_key       text NOT NULL UNIQUE,
  gender          text NOT NULL,
  pillars         jsonb NOT NULL,
  model           text,
  schema_version  int NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now()
);
