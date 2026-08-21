-- "누가 나인가". 지금까지 이 질문에 답하는 것이 없어서 두 곳이 서로 반대인 휴리스틱을
-- 각자 썼다: 상담은 self 중 **최신**, 지도는 self 중 **가장 오래된** 것. 같은 계정에서
-- 두 화면이 다른 사람을 나로 여길 수 있었다.
--
-- users 에 두는 이유: 계정당 하나뿐인 사실이라 profiles 에 플래그로 두면 "둘이 켜진"
-- 상태가 표현 가능해지고, 그걸 막으려면 부분 유니크 인덱스가 또 필요해진다.
--
-- ON DELETE SET NULL: 프로필이 지워지면 나를 잃을 뿐 계정은 살아 있어야 한다.
-- 소비하는 쪽은 null 을 "아직 정해지지 않음" 으로 읽고 가장 오래된 저장 프로필로 물러선다.
ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_profile_id bigint
  REFERENCES profiles(id) ON DELETE SET NULL;
