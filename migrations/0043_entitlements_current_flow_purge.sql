-- 기능 id 가 current_flow → yearly_flow 로 바뀌면서 이 행들은 아무것도 열지
-- 못한다. 지우는 진짜 이유는 id 재사용이다: flows.id 는 GENERATED ALWAYS AS
-- IDENTITY 라 테이블을 다시 만들면 1 부터 다시 센다. 옛 권한 행의 subject_key 가
-- 새 흐름의 id 와 겹칠 수 있다.
--
-- 기능 id 를 바꾸는 것만으로도 매칭이 깨져 사고는 나지 않지만, 죽은 행을 남겨
-- 두면 다음 사람이 그 안전이 우연이었다는 사실을 모른다.
--
-- ticket_entries 는 지우지 않는다 — 원장은 일어난 일의 기록이다.
DELETE FROM entitlements WHERE feature = 'current_flow';
