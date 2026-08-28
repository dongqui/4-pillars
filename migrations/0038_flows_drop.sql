-- segments(1~3구간)가 months(12개월 + 변곡점 플래그)로 바뀐다. 컬럼 교체로는
-- 기존 행의 NOT NULL 을 채울 수 없고, 채운다 해도 그 값이 뜻하는 상품이 없다.
--
-- ⚠️ 0037 과 같은 이유로 미출시 상태에서만 유효하다.
DROP TABLE IF EXISTS flows;
