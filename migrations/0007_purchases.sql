-- 결제 내역. 지금 상품은 리포트 하나지만 product 문자열로 일반화해 두었다.
-- profile_id 가 NULL 허용인 이유: 프로필 단위가 아닌 상품(구독 등)을 같은 테이블에 담기 위해서.
-- provider/provider_txn_id 는 PG사 연동이 붙는 자리다 (지금은 비어 있다).
CREATE TABLE IF NOT EXISTS purchases (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id       bigint REFERENCES profiles(id) ON DELETE CASCADE,
  product          text NOT NULL,
  amount           int NOT NULL,
  currency         text NOT NULL DEFAULT 'KRW',
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'paid', 'refunded', 'failed')),
  provider         text,
  provider_txn_id  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  paid_at          timestamptz
);
