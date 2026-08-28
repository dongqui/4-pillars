-- '이미 본 흐름' 목록은 user_id 로 걸러 created_at 역순으로 읽는다.
-- 없으면 flows 전체를 훑는다 (matches_user_created_idx 와 같은 판단).
CREATE INDEX IF NOT EXISTS flows_user_created_idx ON flows (user_id, created_at DESC);
