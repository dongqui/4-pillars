CREATE TABLE IF NOT EXISTS saju_interpretations (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chart_key       text NOT NULL UNIQUE,
  gender          text NOT NULL,
  pillars         jsonb NOT NULL,
  interpretation  jsonb NOT NULL,
  model           text,
  schema_version  int NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now()
);
