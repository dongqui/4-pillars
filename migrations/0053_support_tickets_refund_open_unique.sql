-- migrations/0053_support_tickets_refund_open_unique.sql
-- 한 결제 건에 열린 환불 요청은 하나뿐이다.
--
-- ⚠️ 앱도 같은 검사를 하지만(목록의 "요청됨") Neon HTTP 에는 트랜잭션이 없어
-- 연타·동시 요청 두 개가 그 검사를 함께 통과할 수 있다. 이 인덱스가 최후 방어선이다 —
-- INSERT ... ON CONFLICT DO NOTHING 이 여기서 접히고, 앱은 그걸 409 로 돌려준다.
-- 처리가 끝나 status 가 'resolved' 가 되면 같은 결제 건으로 다시 요청할 수 있다.
CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_refund_open_unique
  ON support_tickets (purchase_id)
  WHERE kind = 'refund' AND status = 'open'
