-- 더블탭·새로고침 재전송으로 같은 사람이 두 번 들어가는 것을 DB 층에서 막는다.
-- addMapPerson(store.ts)의 DuplicatePersonError 는 이 인덱스 충돌을 읽은 결과다.
CREATE UNIQUE INDEX IF NOT EXISTS map_people_dedupe
  ON map_people(map_id, name, birth_year, birth_month, birth_day, calendar, is_leap_month);
