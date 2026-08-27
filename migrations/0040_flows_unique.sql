-- 프로필 × 명리 연도 = 상품 1개. 이 인덱스가 곧 과금 단위다.
--
-- user_id 를 넣지 않는 이유: 프로필이 이미 한 사용자에게 속한다. 넣으면 같은
-- 프로필의 같은 해가 사용자별로 여러 행이 될 수 있어 unique 가 뜻을 잃는다.
--
-- entitlements.subject_key 가 이 행의 id 를 가리키므로, 여기서 "연도별 권한" 이
-- 새 로직 없이 저절로 나온다.
CREATE UNIQUE INDEX IF NOT EXISTS flows_unique ON flows (profile_id, flow_year);
