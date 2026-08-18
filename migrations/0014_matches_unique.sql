-- 같은 쌍·같은 관계는 한 행. 재요청이 같은 행으로 수렴하는 근거이자,
-- 이용권이 붙었을 때 같은 궁합에 두 번 차감되지 않게 하는 근거다.
CREATE UNIQUE INDEX IF NOT EXISTS matches_unique ON matches (
  subject_profile_id, counterpart_profile_id,
  relation_type, subject_role, counterpart_role
);
