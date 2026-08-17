-- 내 이용권 내역 조회용. purchases_user_idx 와 같은 모양이다.
CREATE INDEX IF NOT EXISTS ticket_entries_user_idx
  ON ticket_entries (user_id, created_at DESC);
