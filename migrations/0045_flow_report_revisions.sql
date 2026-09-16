-- migrations/0045_flow_report_revisions.sql
-- 한 해의 흐름 v2 의 생성 시도 1건. flows 1 : revisions N.
--
-- 사용자가 고른 지금 상황(context_snapshot)·모델 입력(input_snapshot)·그 flow 의
-- 보존된 12개월(months_snapshot)을 발행 시점에 박제한다. 읽을 때 다시 계산하지 않는다.
--
-- phase: draft → complete | failed 가 A 의 전부다. review/repair/review_repaired 는
-- B(검토 루프)가 쓴다. review_payload IS NULL 이면 "미검토 발행"(A 시기) 이다.
-- failure_code 정의역: transport | timeout | http | schema | references | gone.
-- admitted_at: 이용권 차감이 끝난 시각. 값이 있으면 답을 갈아끼울 수 없다.
-- lease_*: B 가 쓴다. A 는 비워 둔다.
CREATE TABLE IF NOT EXISTS flow_report_revisions (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  flow_id               bigint NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  format_version        integer NOT NULL DEFAULT 2,
  prompt_bundle_version integer NOT NULL,
  idempotency_key       text NOT NULL,
  request_hash          text NOT NULL,
  context_snapshot      jsonb NOT NULL,
  input_snapshot        jsonb NOT NULL,
  months_snapshot       jsonb NOT NULL,
  phase                 text NOT NULL CHECK (phase IN ('draft','review','repair','review_repaired','complete','failed')),
  working_payload       jsonb,
  review_payload        jsonb,
  validation_errors     jsonb,
  published_payload     jsonb,
  model                 text,
  usage_summary         jsonb,
  failure_code          text,
  lease_token           text,
  lease_expires_at      timestamptz,
  admitted_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  published_at          timestamptz
);
