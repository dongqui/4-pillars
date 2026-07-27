-- 해석 본문을 섹션 단위 행으로 저장한다.
-- 목적: (1) 섹션 하나만 재생성/재시도, (2) 무료/유료 섹션을 쿼리 레벨에서 분리.
-- 0001과 한 파일로 합치지 않은 이유: migrate.mts가 파일당 sql.query() 한 번이라
-- neon HTTP 드라이버에서 다중 statement가 안 된다.
CREATE TABLE IF NOT EXISTS saju_interpretation_sections (
  chart_key       text NOT NULL REFERENCES saju_interpretations(chart_key) ON DELETE CASCADE,
  section_key     text NOT NULL,
  -- shape 은 src/app/api/saju/_lib/sections/registry.ts 의 SECTIONS[section_key].schema 가 정의한다.
  -- SQL 에 CHECK 를 걸지 않는 이유: 섹션이 늘 때마다 마이그레이션을 쓰지 않으려고.
  content         jsonb NOT NULL,
  model           text,
  -- SECTIONS[section_key].version. 조회 시 값이 다르면 캐시 미스로 취급해 그 섹션만 재생성한다.
  schema_version  int NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chart_key, section_key)
);
