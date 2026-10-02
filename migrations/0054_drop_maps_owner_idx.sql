-- 계정당 하나를 박던 인덱스. 프로필당 하나(0055)로 옮긴다.
-- createMap 의 ON CONFLICT 대상이 여기서 저쪽으로 바뀌므로, store.ts 변경과
-- 같은 배포에 들어가야 한다.
DROP INDEX IF EXISTS maps_owner_user
