-- migrations/0048_flows_active_revision.sql
-- 발행된 v2 revision. NULL 이면 v1 이거나 아직 발행 전이다. publishRevision 만 채운다.
ALTER TABLE flows ADD COLUMN IF NOT EXISTS active_revision_id bigint REFERENCES flow_report_revisions(id) ON DELETE SET NULL;
