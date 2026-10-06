-- migrations/0056_purchases_refund_columns.sql
-- 이용권 부분 환불(docs/superpowers/specs/2026-10-02-ticket-partial-refund-design.md).
--
-- remaining: 이 결제에서 아직 안 쓴 장수. 지갑(ticket_wallets.balance)은 합산이라
--   "어느 결제의 이용권이 쓰였나" 가 없었다 — 소비가 가장 오래된 결제부터 여기를 깎는다.
--   paid 가 아닌 행은 NULL. 적립(confirmPurchaseAndCredit)이 tickets 로 채운다.
-- refund_amount·refunded_at: 환불 실행 때 status='refunded' 와 함께 채운다.
-- refund_failed_at: DB 차감은 끝났는데 포트원 취소가 실패한 시각. 운영자가 콘솔에서 수동 취소한다.
--
-- ADD COLUMN 넷을 한 ALTER 에 담는다 — Neon HTTP 드라이버는 한 쿼리에 여러 문장을 거부한다.
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS remaining        int,
  ADD COLUMN IF NOT EXISTS refund_amount    int,
  ADD COLUMN IF NOT EXISTS refunded_at      timestamptz,
  ADD COLUMN IF NOT EXISTS refund_failed_at timestamptz;
