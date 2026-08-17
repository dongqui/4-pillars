-- 이용권을 써서 얻은 열람 권한. 한 번 생기면 영구다 (재열람은 무료).
--
-- feature + subject_key 로 서비스를 일반화한다 — 새 서비스는 테이블을 건드리지
-- 않고 값만 추가한다:
--   전체 리포트 : ('full_report',   프로필 id)
--   궁합        : ('compatibility', 정렬한 두 프로필 id, 예 '12:34')
--
-- cost 를 박아 두는 이유: 가격표는 바뀌지만 "이때 몇 장을 냈는가"는 사실이다.
-- 환불·CS 때 현재 가격표로 역산하면 과거 건이 틀린다.
CREATE TABLE IF NOT EXISTS entitlements (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature     text NOT NULL,
  subject_key text NOT NULL,
  cost        int NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
