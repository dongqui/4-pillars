-- 선택 화면이 "이 프로필로 어느 해를 샀나" 를 묻는다. 프로필 드롭다운의
-- "N개 보유" 와 연도 그리드의 소유 배지가 같은 조회를 쓴다.
CREATE INDEX IF NOT EXISTS flows_user_profile_idx ON flows (user_id, profile_id);
