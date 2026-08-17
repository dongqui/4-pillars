-- 잔액이 왜 그 값인지 설명하는 원장. delta 양수 = 적립, 음수 = 사용.
--
-- 잔액 계산에는 쓰지 않는다 — 잔액의 출처는 ticket_wallets 하나다. 여기서
-- SUM 을 떠서 잔액으로 쓰면 값이 두 벌이 되어 언젠가 어긋난다 (profiles 에
-- is_paid 컬럼을 두지 않은 것과 같은 판단, src/lib/profiles/store.ts).
--
-- grant(수기 지급)·refund 는 지금 쓰는 경로가 없지만 CHECK 목록에 미리 넣는다.
-- 목록을 넓히려면 마이그레이션이 필요한데, 그게 필요한 시점은 대개 급한 CS 상황이다.
--
-- FK 가 ON DELETE SET NULL 인 이유: 원장은 지워지면 안 된다. 참조 대상이
-- 사라져도 "언제 몇 장이 움직였다"는 남아야 한다.
CREATE TABLE IF NOT EXISTS ticket_entries (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta          int NOT NULL CHECK (delta <> 0),
  reason         text NOT NULL CHECK (reason IN ('purchase','spend','grant','refund')),
  purchase_id    bigint REFERENCES purchases(id) ON DELETE SET NULL,
  entitlement_id bigint REFERENCES entitlements(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
