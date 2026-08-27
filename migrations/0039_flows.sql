-- 흐름 리포트 1건. 이용권 1장이 차감되는 단위이기도 하다.
--
-- flow_year 는 달력 연도가 아니라 명리 연도(세운)다 — 입춘에서 바뀐다.
-- 앞선 설계와 달리 "지금" 이 아니라 사용자가 고른 해다 (현재 ±5년).
--
-- period_start/end 와 months 를 저장하는 이유는 같다: 절기 계산이 정밀해지거나
-- PIVOT_THRESHOLD 를 튜닝해도 이미 판 상품이 소급해서 바뀌면 안 된다. 읽을 때마다
-- 다시 계산하면 임계값 한 번 조정으로 저장된 08(변곡점)이 가리키는 달과 실제
-- 계산 결과가 어긋난다.
--
-- months 는 12개 원소다:
--   [{ "index": 1, "start": "…", "end": "…", "korean": "임인", "pivot": false }, …]
-- 변곡점을 별도 배열이 아니라 월의 플래그로 둔다 — 두 배열이면 07(월별 흐름)과
-- 08(변곡점)이 서로 다른 달을 가리키는 상태가 표현 가능해진다.
--
-- ⚠️ 경계 시각은 절대 시각(instant)이다. solarTermDate/solarTermJD 는 +9h 가
-- 박힌 KST 벽시계 값을 돌려주므로 solarTermInstant() 를 쓸 것.
CREATE TABLE IF NOT EXISTS flows (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id   bigint NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  flow_year    integer NOT NULL,
  period_start timestamptz NOT NULL,
  period_end   timestamptz NOT NULL,
  months       jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
