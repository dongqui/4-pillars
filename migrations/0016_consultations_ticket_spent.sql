-- 이 상담에 이용권이 실제로 쓰였는지. 행이 있다는 것만으로는 결제됐다는 뜻이 아니다 —
-- 차감 실패·환불 성공 뒤에도 행은 남기 때문이다(설계 §2). 그 행을 그대로 두면
-- 이용권 없이 쓸 수 있는 상담이 되므로, "쓸 수 있는가"를 행의 존재가 아니라 이 값으로 판단한다.
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS ticket_spent boolean NOT NULL DEFAULT false
