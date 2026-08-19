-- 관계 지도. 사용자당 하나다.
--
-- share_id 가 PK 와 별도인 이유: maps.id 는 bigint IDENTITY 라 연속 정수다.
-- 공개 URL 에 그대로 쓰면 /map/1, /map/2 를 훑어 남의 지도를 전부 열 수 있다.
--
-- 중심 생년월일을 profiles 참조가 아니라 복사하는 이유: 소유자가 프로필을
-- 지웠을 때 이미 뿌린 공유 링크가 깨지면 안 된다. 지도는 자기 완결적인
-- 스냅샷이다. 원국이 아니라 생년월일을 담는 것은 0005_profiles.sql 이
-- 정한 규칙을 따른다("원국은 파생값이다").
CREATE TABLE IF NOT EXISTS maps (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  share_id       text NOT NULL UNIQUE,
  owner_user_id  bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_name    text NOT NULL,
  center_calendar      text NOT NULL DEFAULT 'solar' CHECK (center_calendar IN ('solar', 'lunar')),
  center_is_leap_month boolean NOT NULL DEFAULT false,
  center_birth_year    int NOT NULL,
  center_birth_month   int NOT NULL,
  center_birth_day     int NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
