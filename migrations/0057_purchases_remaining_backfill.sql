-- migrations/0057_purchases_remaining_backfill.sql
-- 0056 의 remaining 을 기존 paid 결제에 채운다. 소비는 FIFO 로 봤으므로 옛 결제가 먼저 비었다 —
-- 현재 잔액을 최근 결제부터 채워 넣는다(ahead = 이 결제보다 최근인 결제들의 장수 합).
-- 잔액이 결제 합계보다 큰 유저(수기 지급)는 초과분이 어느 결제에도 안 붙는다. 환불 대상이 아니다.
-- 이미 remaining 이 있는 행(이 마이그레이션 뒤 적립된 행)은 건드리지 않는다.
UPDATE purchases p
   SET remaining = LEAST(
         COALESCE(p.tickets, 0),
         GREATEST(0, COALESCE(w.balance, 0) - q.ahead)
       )
  FROM (
         SELECT id,
                user_id,
                COALESCE(SUM(COALESCE(tickets, 0)) OVER (
                  PARTITION BY user_id
                  ORDER BY COALESCE(paid_at, created_at) DESC, id DESC
                  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                ), 0) AS ahead
           FROM purchases
          WHERE status = 'paid'
       ) q
  LEFT JOIN ticket_wallets w ON w.user_id = q.user_id
 WHERE p.id = q.id
   AND p.status = 'paid'
   AND p.remaining IS NULL;
