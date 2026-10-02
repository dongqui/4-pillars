-- 살아 있는 프로필 조회(listProfiles·countProfiles)가 대부분이라 부분 인덱스로 받친다.
-- 0050 과 파일을 나눈 것은 Neon HTTP 드라이버가 한 쿼리에 문장 여러 개를 거부하기
-- 때문이다 — migrate.mts 가 파일 전체를 한 번의 prepared statement 로 보낸다.
CREATE INDEX IF NOT EXISTS profiles_user_live ON profiles(user_id) WHERE deleted_at IS NULL
