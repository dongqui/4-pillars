-- migrations/0046_flow_report_revisions_pending_unique.sql
-- 한 flow 에 미완성 시도는 하나. upsertPendingRevision 의 ON CONFLICT 가 이 인덱스를 본다.
CREATE UNIQUE INDEX IF NOT EXISTS flow_report_revisions_pending_unique
  ON flow_report_revisions (flow_id) WHERE phase NOT IN ('complete','failed');
