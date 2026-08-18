-- 상담 1건 = 이용권 1장 = 이 테이블 한 행.
-- turn_limit 을 상수가 아니라 컬럼에 박는 이유는 purchases.amount 와 같다 —
-- 정책이 12회로 바뀌어도 이미 팔린 상담은 산 조건 그대로 끝나야 한다.
-- profile_id 가 SET NULL 인 이유: 프로필이 지워져도 이미 나눈 대화는 남아야 한다
-- (purchases 의 CASCADE 가 docs/issues/backlog.md 에서 문제로 지적된 것과 같은 건이다).
CREATE TABLE IF NOT EXISTS consultations (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id   bigint REFERENCES profiles(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  turns_used   int  NOT NULL DEFAULT 0,
  turn_limit   int  NOT NULL DEFAULT 10,
  title        text,
  tokens_in    bigint NOT NULL DEFAULT 0,
  tokens_out   bigint NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz
)
