-- 이용권 잔액. 사용자당 한 행이고 잔액의 유일한 출처다.
--
-- ⚠️ CHECK (balance >= 0) 가 이 테이블의 존재 이유다. Neon HTTP 드라이버에는
-- 대화형 트랜잭션이 없어 "읽고 판단하고 차감"을 앱에서 하면 동시 요청 두 개가
-- 같은 잔액을 읽는다. 차감 UPDATE 가 음수를 만드는 순간 이 제약이 문장 전체를
-- 되돌린다 — 앱 코드가 실수해도 잔액은 새지 않는다.
-- 이 제약을 지우거나 완화하면 동시성 방어선이 통째로 사라진다.
--
-- 행이 없는 사용자 = 잔액 0 이다. 회원가입 때 미리 만들지 않는다: 적립이
-- INSERT ... ON CONFLICT DO UPDATE 라 첫 충전에서 생기고, 차감 쪽은 행이 없으면
-- NULL >= 1 이 거짓이라 알아서 잔액 부족으로 떨어진다.
CREATE TABLE IF NOT EXISTS ticket_wallets (
  user_id    bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance    int NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
