-- 같은 사용자가 같은 대상에 두 번 차감되지 않게 막는다.
--
-- ⚠️ 이 인덱스는 중복 방지이자 멱등 키다. 차감 CTE 의 INSERT 가 여기서 충돌하면
-- ON CONFLICT DO NOTHING 으로 접히고, 뒤따르는 차감 UPDATE 가 EXISTS 에 막혀
-- 아예 일어나지 않는다 — 더블클릭·재시도 방어가 전부 이 인덱스에 걸려 있다.
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_unique
  ON entitlements (user_id, feature, subject_key);
