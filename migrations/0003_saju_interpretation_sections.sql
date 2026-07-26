-- 해석 본문을 섹션 단위 행으로 저장한다.
-- 목적: (1) 섹션 하나만 재생성/재시도, (2) 무료/유료 섹션을 쿼리 레벨에서 분리.
-- 0001과 한 파일로 합치지 않은 이유: migrate.mts가 파일당 sql.query() 한 번이라
-- neon HTTP 드라이버에서 다중 statement가 안 된다.
CREATE TABLE IF NOT EXISTS saju_interpretation_sections (
  chart_key       text NOT NULL REFERENCES saju_interpretations(chart_key) ON DELETE CASCADE,
  section_key     text NOT NULL,
  content         jsonb NOT NULL,
  model           text,
  schema_version  int NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chart_key, section_key)
);
