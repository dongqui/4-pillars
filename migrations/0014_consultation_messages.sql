-- bubbles 를 jsonb 배열로 두는 것은 응답 스키마와 짝이다. LLM 이 말풍선 배열로
-- 답하니 저장도 그 모양 그대로 받고, 화면이 다시 쪼갤 필요가 없다.
-- role='user' 인 행은 bubbles 길이가 항상 1 이고 suggestions 는 NULL 이다.
-- crisis 는 위기 안내로 답한 턴의 표시다 — 이 플래그의 개수가 미차감 한도를 정한다.
CREATE TABLE IF NOT EXISTS consultation_messages (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  consultation_id bigint NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'counselor')),
  bubbles         jsonb NOT NULL,
  suggestions     jsonb,
  crisis          boolean NOT NULL DEFAULT false,
  turn_no         int NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
)
