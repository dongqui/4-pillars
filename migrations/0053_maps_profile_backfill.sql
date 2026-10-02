-- 이미 있는 지도를 그 계정의 "나"(users.primary_profile_id)에 붙인다.
-- primary 가 없는 계정의 지도는 NULL 로 남는다 — 0055 의 유니크 인덱스는
-- Postgres 가 NULL 을 서로 다른 값으로 보므로 그 행이 여럿이어도 막지 않는다.
UPDATE maps m
   SET profile_id = u.primary_profile_id
  FROM users u
 WHERE u.id = m.owner_user_id
   AND m.profile_id IS NULL
   AND u.primary_profile_id IS NOT NULL
