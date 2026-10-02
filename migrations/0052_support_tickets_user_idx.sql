-- migrations/0052_support_tickets_user_idx.sql
-- 사용자별 조회(어드민 상세의 "이 사람의 다른 문의") 와 user 삭제 CASCADE 용.
CREATE INDEX IF NOT EXISTS support_tickets_user_idx
  ON support_tickets (user_id, created_at DESC)
