-- 한 프로필의 한 해는 한 행. 재요청이 같은 행으로 수렴하는 근거이자,
-- 같은 해에 이용권이 두 번 차감되지 않게 하는 근거다 (entitlements.subject_key = flow_id).
--
-- user_id 가 없어도 되는 이유: profiles.user_id 가 NOT NULL 이라 프로필의 소유자는
-- 하나뿐이다 — matches_unique 와 같은 판단.
CREATE UNIQUE INDEX IF NOT EXISTS flows_unique ON flows (profile_id, flow_year);
