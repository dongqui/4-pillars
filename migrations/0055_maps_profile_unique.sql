-- 프로필당 지도 하나. flows_unique 가 user_id 를 뺀 것과 같은 이유로 여기도
-- owner_user_id 를 넣지 않는다 — 프로필이 이미 한 사용자에 속하므로, 넣으면
-- 같은 프로필의 지도가 사용자별로 여럿인 상태가 표현 가능해져 유니크가 뜻을 잃는다.
CREATE UNIQUE INDEX IF NOT EXISTS maps_profile ON maps(profile_id)
