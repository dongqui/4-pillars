-- '이미 본 궁합' 목록은 user_id 로 걸러 created_at 역순으로 읽는다.
-- 없으면 matches 전체를 훑는다 (purchases_user_idx 와 같은 판단).
CREATE INDEX IF NOT EXISTS matches_user_created_idx ON matches (user_id, created_at DESC);
