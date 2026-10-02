-- migrations/0051_support_tickets_status_idx.sql
-- 어드민 받은편지함: "열린 것부터, 최신순".
CREATE INDEX IF NOT EXISTS support_tickets_status_created_idx
  ON support_tickets (status, created_at DESC)
