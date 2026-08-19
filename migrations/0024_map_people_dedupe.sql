-- 더블탭·새로고침 재전송으로 같은 사람이 두 번 들어가는 것을 DB 층에서 막는다.
-- 이 인덱스는 이제 거절의 근거가 아니다. addMapPerson(store.ts)은
-- INSERT ... ON CONFLICT DO NOTHING 으로 충돌을 조용히 흘려보내고 같은 키로
-- 다시 읽어 그 행을 돌려준다 — 중복 추가가 오류가 아니라 멱등한 성공인 이유다
-- (설계 §6.1: 중복을 오류로 가르면 상태 코드가 생일 추측의 오라클이 된다).
-- 인덱스가 하는 일은 하나로 남았다: 동시 요청에서 같은 사람이 두 행으로 갈리지
-- 않게 하는 것.
CREATE UNIQUE INDEX IF NOT EXISTS map_people_dedupe
  ON map_people(map_id, name, birth_year, birth_month, birth_day, calendar, is_leap_month);
