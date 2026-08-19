-- 사용자당 지도 하나. createMap 의 멱등성(store.ts)이 이 인덱스에 걸려 있다 —
-- ON CONFLICT (owner_user_id) 가 겨냥하는 대상이 바로 이 유니크 인덱스다.
CREATE UNIQUE INDEX IF NOT EXISTS maps_owner_user ON maps(owner_user_id);
