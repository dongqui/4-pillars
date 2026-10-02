-- migrations/0050_support_tickets.sql
-- 헤더 ⋯ 메뉴의 오류 문의 · 피드백 · 환불 요청. 메일 알림과 별개로 여기 남는 것이 원본이다 —
-- 메일은 놓칠 수 있고, 어드민 받은편지함은 이 테이블을 읽는다.
--
-- target_label 을 박제하는 이유: 프로필·상담이 나중에 지워지거나 이름이 바뀌어도
-- "그때 무엇에 대해 문의했나" 는 바뀌면 안 된다.
-- reply_email 도 같은 이유로 보낸 시점의 users.email 을 복사한다.
--
-- refund_reason 에 CHECK 를 걸지 않는다: 사유 문구는 카피라 바뀔 수 있다.
-- 검증은 src/lib/support/types.ts 의 REFUND_REASONS(zod enum) 가 한다.
--
-- purchase_id 가 CASCADE 인 이유: 아래 refund CHECK 가 purchase_id 를 요구한다.
-- SET NULL 이면 결제 행이 지워질 때 그 CHECK 에 걸려 삭제 자체가 실패한다.
-- 결제 행은 사용자째 지워질 때만 사라지므로 잃는 것이 없다.
CREATE TABLE IF NOT EXISTS support_tickets (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('error', 'feedback', 'refund')),
  target_kind   text CHECK (target_kind IN ('full_report', 'compatibility', 'consultation', 'yearly_flow', 'map', 'other')),
  target_ref    text,
  target_label  text,
  purchase_id   bigint REFERENCES purchases(id) ON DELETE CASCADE,
  refund_reason text,
  body          text NOT NULL DEFAULT '',
  reply_email   text,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  admin_note    text,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_tickets_error_target CHECK (kind <> 'error' OR target_kind IS NOT NULL),
  CONSTRAINT support_tickets_refund_purchase CHECK (kind <> 'refund' OR (purchase_id IS NOT NULL AND refund_reason IS NOT NULL))
)
