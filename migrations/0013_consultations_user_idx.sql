CREATE INDEX IF NOT EXISTS consultations_user_idx
  ON consultations (user_id, created_at DESC)
