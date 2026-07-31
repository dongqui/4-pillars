-- 퍼널이 수집한 원본 입력을 그대로 보관한다.
-- 계산된 원국(4기둥)을 저장하지 않는 이유: saju-core 가 바뀌면 원국은 다시 계산하면
-- 되지만, 사용자가 입력한 생년월일시는 복구할 수 없다. 원국은 파생값이다.
-- 컬럼은 src/app/funnel/_context/FunnelContext.tsx 의 FunnelData 와 1:1 로 대응한다
-- (birthPlace 만 country/region_id 두 컬럼으로 펴진다).
CREATE TABLE IF NOT EXISTS profiles (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  gender          text NOT NULL CHECK (gender IN ('male', 'female')),
  calendar        text NOT NULL DEFAULT 'solar' CHECK (calendar IN ('solar', 'lunar')),
  is_leap_month   boolean NOT NULL DEFAULT false,
  birth_year      int NOT NULL,
  birth_month     int NOT NULL,
  birth_day       int NOT NULL,
  time_known      boolean NOT NULL DEFAULT true,
  birth_hour      int,
  birth_minute    int,
  birth_country   text,
  birth_region_id text,
  true_solar      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
