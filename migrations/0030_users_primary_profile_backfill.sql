-- 0029 이전에 만들어진 계정은 primary_profile_id 가 null 이다. 그대로 두면 두 가지가
-- 곤란하다: 상담·지도가 계속 물러섬(가장 오래된 저장 프로필)으로만 돌고, 그 계정이
-- 다음에 저장하는 사람이 "나" 로 박힐 여지가 남는다.
--
-- 가장 오래된 저장 프로필을 고른다 — 퍼널을 처음 끝냈을 때 만들어진 것이 그 계정의
-- 첫 프로필이고, 그게 나일 확률이 가장 높다. 지도가 이미 같은 판단을 쓰고 있었다.
UPDATE users u SET primary_profile_id = (
  SELECT p.id FROM profiles p
   WHERE p.user_id = u.id AND p.kind = 'saved'
   ORDER BY p.created_at ASC
   LIMIT 1
) WHERE u.primary_profile_id IS NULL;
