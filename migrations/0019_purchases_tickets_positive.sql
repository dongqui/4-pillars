-- tickets 는 결제 확정 시 ticket_entries 에 그대로 delta 로 들어가고, 그 컬럼은
-- CHECK (delta <> 0) 다. tickets = 0 인 행이 들어오면 확정 CTE 는 돈을 이미 받은
-- 뒤(purchases.status = 'paid' 로 UPDATE 까지 끝낸 뒤)에야 이 위반으로 실패해
-- 행이 pending 에 그대로 남고 웹훅은 영원히 재시도한다 — 실패를 결제 전으로
-- 당겨 막는다. NULL 은 그대로 둔다: 이 컬럼이 붙기 전 행과 PG 를 거치지 않는
-- 수기 지급 행(0017 주석 참조)이 NULL 이라 여기서 막으면 그 행들이 깨진다.
ALTER TABLE purchases ADD CONSTRAINT purchases_tickets_positive
  CHECK (tickets IS NULL OR tickets > 0);
