CREATE INDEX IF NOT EXISTS purchases_user_idx ON purchases (user_id, created_at DESC);
