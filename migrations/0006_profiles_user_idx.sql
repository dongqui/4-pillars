-- /home 의 유일한 조회 패턴: 내 프로필을 최신순으로.
CREATE INDEX IF NOT EXISTS profiles_user_created_idx ON profiles (user_id, created_at DESC);
