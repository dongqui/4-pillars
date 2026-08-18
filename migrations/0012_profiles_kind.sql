-- 궁합 상대는 profiles 에 들어가되 "내 사주 목록" 에는 보이지 않아야 한다.
-- 별도 테이블 대신 컬럼으로 가르는 이유: 생년월일 컬럼 14개를 한 벌 더 복제하지
-- 않아도 되고, 상대가 나중에 자기 리포트를 살 때 purchases.profile_id 가 그대로 붙는다.
-- 'other' 를 'self' 로 올리는 것이 "내 목록에도 저장" 이다 (promoteProfileToSelf).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'self'
  CHECK (kind IN ('self', 'other'));
