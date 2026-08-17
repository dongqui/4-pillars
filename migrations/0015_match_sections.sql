-- 생성된 서술. 캐시가 아니라 결과 저장이다.
-- 리포트 해석은 chartKey 로 사람 사이에서 공유되지만, 쌍의 공간은 그 곱이라
-- 교차 사용자 적중률이 0 에 수렴한다. 여기서 필요한 건 적중률이 아니라 영속성이다 —
-- 이용권을 쓴 결과가 새로고침마다 달라지면 안 된다.
CREATE TABLE IF NOT EXISTS match_sections (
  match_id       bigint NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  section_key    text   NOT NULL,
  content        jsonb  NOT NULL,
  schema_version int    NOT NULL,
  model          text   NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, section_key)
);
