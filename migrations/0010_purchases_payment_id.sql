-- 고객사가 발급하는 주문 ID (포트원 v2 paymentId). 완료 API 와 웹훅이 이걸로 행을 찾는다.
-- provider_txn_id 와 다르다: 그쪽은 포트원이 발급하는 거래 ID(transactionId)다.
-- 포트원 웹훅은 transactionId 가 아니라 paymentId 로 오기 때문에 이 컬럼이 없으면
-- 웹훅이 어느 행을 확정해야 하는지 알 수 없다.
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_id text;

-- 부분 인덱스인 이유: 이 컬럼이 붙기 전 행과 PG 를 거치지 않는 행(수기 지급 등)은 NULL 이다.
CREATE UNIQUE INDEX IF NOT EXISTS purchases_payment_id_unique
  ON purchases (payment_id) WHERE payment_id IS NOT NULL;
