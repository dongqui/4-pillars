-- 흐름 리포트 1건. 이용권 1장이 차감되는 단위이기도 하다.
--
-- flow_year 는 달력 연도가 아니라 명리 연도(세운)다 — 입춘에서 바뀐다.
-- 2026-01-20 에 조회하면 flow_year 는 2025 다.
--
-- period_start/end 는 flow_year 만 알면 계산되는 값이라 중복이다. 그럼에도
-- 저장하는 이유: 절기 계산이 나중에 정밀해져 입춘 시각이 움직여도, 이미 판
-- 상품의 유효 기간이 소급해서 바뀌면 안 된다. 발행 시점의 경계를 박제한다.
--
-- segments 를 같이 박제하는 이유도 같다. 읽을 때마다 다시 계산하면
-- FLOW_SEGMENT_THRESHOLD 를 한 번 튜닝하는 것만으로 저장된 서술의 구간 수·경계가
-- 어긋나 11월 서술이 2월 칸에 붙는다.
--   [{ "id": "segment_1", "start": ISO, "end": ISO, "basis": "연시작" }, ...]
--
-- ⚠️ 경계 시각은 절대 시각이다. solarTermDate/solarTermJD 는 +9h 가 박힌 KST
-- 벽시계 값을 돌려주므로 그대로 넣으면 9시간 밀린다. solarTermInstant() 를 쓸 것.
CREATE TABLE IF NOT EXISTS flows (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id   bigint NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  flow_year    integer NOT NULL,
  period_start timestamptz NOT NULL,
  period_end   timestamptz NOT NULL,
  segments     jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
