-- 같은 프로필의 같은 상품을 두 번 결제 완료로 만들 수 없다.
-- 부분 인덱스라 pending/failed 행은 여러 개 남을 수 있다 (결제 재시도).
CREATE UNIQUE INDEX IF NOT EXISTS purchases_paid_unique
  ON purchases (profile_id, product) WHERE status = 'paid';
