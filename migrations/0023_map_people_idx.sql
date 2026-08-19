-- listMapPeople 의 유일한 조회 패턴: 한 지도의 사람을 등록순으로.
CREATE INDEX IF NOT EXISTS map_people_map ON map_people(map_id, created_at);
