-- 같은 주문 ID 로 행이 둘 생기지 않게 막는다.
-- 부분 인덱스인 이유: 이 컬럼이 붙기 전 행과 PG 를 거치지 않는 행(수기 지급 등)은 NULL 이다.
CREATE UNIQUE INDEX IF NOT EXISTS purchases_payment_id_unique
  ON purchases (payment_id) WHERE payment_id IS NOT NULL;
