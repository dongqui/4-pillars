-- 고객사가 발급하는 주문 ID (포트원 v2 paymentId). 완료 API 와 웹훅이 이걸로 행을 찾는다.
-- provider_txn_id 와 다르다: 그쪽은 포트원이 발급하는 거래 ID(transactionId)다.
-- 포트원 웹훅은 transactionId 가 아니라 paymentId 로 오기 때문에 이 컬럼이 없으면
-- 웹훅이 어느 행을 확정해야 하는지 알 수 없다.
-- (인덱스는 별도 파일 0011 로 뺐다 — migrate.mts 는 파일당 한 문장만 실행할 수 있다.)
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_id text;
