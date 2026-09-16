-- migrations/0047_flow_report_revisions_key_unique.sql
-- 같은 flow 안에서 idempotency_key 는 유일. A 는 서버 UUID, B 가 클라이언트 requestId 로 바꾼다.
CREATE UNIQUE INDEX IF NOT EXISTS flow_report_revisions_key_unique
  ON flow_report_revisions (flow_id, idempotency_key);
