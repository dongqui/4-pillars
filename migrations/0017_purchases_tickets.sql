-- 이 결제가 적립할 이용권 장수(보너스 포함). 주문 생성 시점에 서버가 박는다 —
-- amount 와 같은 판단이다. 브라우저가 보내는 값이 아니라 손댈 수 없고, 확정
-- 시점에 가격표를 다시 읽지 않아 그 사이 가격표가 바뀌어도 산 만큼 받는다.
--
-- NOT NULL 을 걸지 않는 이유: 이 컬럼이 붙기 전 행과 PG 를 거치지 않는 행(수기
-- 지급 등)은 NULL 이다. 적립 CTE 는 NULL 을 만나면 balance NOT NULL 위반으로
-- 터진다 — 조용히 0장 적립되는 것보다 낫다.
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS tickets int;
