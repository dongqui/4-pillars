-- (profile_id, product) 유니크는 "프로필당 한 번만 산다"는 단건 상품 전제였다.
-- 이용권은 같은 패키지를 반복 구매한다. profile_id 는 이제 항상 NULL 이다 —
-- 0007 이 "프로필 단위가 아닌 상품을 같은 테이블에 담기 위해" 열어 둔 자리를 쓴다.
DROP INDEX IF EXISTS purchases_paid_unique;
