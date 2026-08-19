-- 지도에 올라온 사람. 링크를 가진 누구나 추가할 수 있다.
--
-- 시각·성별·출생지 컬럼이 없는 것은 의도다. 지도는 일주만 쓰고, 일주는 그
-- 셋과 무관하다. 나중에 이 사람의 전체 리포트가 필요해지면 컬럼 14개를
-- 복제하는 것이 아니라 profiles 로 승격하고 여기엔 profile_id 하나만 붙인다
-- (0012_profiles_kind.sql 이 같은 판단을 적어뒀다).
CREATE TABLE IF NOT EXISTS map_people (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  map_id        bigint NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  name          text NOT NULL,
  calendar      text NOT NULL DEFAULT 'solar' CHECK (calendar IN ('solar', 'lunar')),
  is_leap_month boolean NOT NULL DEFAULT false,
  birth_year    int NOT NULL,
  birth_month   int NOT NULL,
  birth_day     int NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
