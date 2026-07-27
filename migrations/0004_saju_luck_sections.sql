-- 생시에 의존하는 해석 섹션(세운·대운)을 따로 저장한다.
-- saju_interpretation_sections 와 분리한 이유: 그 테이블의 chart_key 는
-- 4기둥+성별로만 만들어져 대운 기산(생시·절입)을 구분하지 못한다.
-- content 의 shape 은 src/app/api/saju/_lib/sections/registry.ts 가 정의한다
-- (storage: "luck" 인 섹션들).
-- FK 를 걸지 않는 이유: 부모 키가 chart_key 인데 luck_key 는 그보다 좁다.
CREATE TABLE IF NOT EXISTS saju_luck_sections (
  luck_key        text NOT NULL,
  section_key     text NOT NULL,
  content         jsonb NOT NULL,
  model           text,
  schema_version  int NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (luck_key, section_key)
);
