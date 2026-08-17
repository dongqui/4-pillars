-- 궁합 1건. 나중에 이용권 1장이 차감되는 단위이기도 하다.
--
-- relation_type 에 CHECK 를 걸지 않는다: 유형 추가는 카피 수준의 변경인데
-- CHECK 를 걸면 매번 마이그레이션이 된다. 검증은 relation-types.ts 의 zod 가 한다.
--
-- 세 text 컬럼이 NULL 대신 '' 를 쓰는 이유: NULL 은 서로 같지 않아서 유니크
-- 인덱스(0014)가 "관계 건너뛰기" 건을 매번 새 행으로 만든다. COALESCE 로 접으면
-- ON CONFLICT 가 같은 표현식 목록을 반복해야 해 삽입·조회·충돌 세 자리로 흩어진다.
CREATE TABLE IF NOT EXISTS matches (
  id                     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_profile_id     bigint NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  counterpart_profile_id bigint NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  relation_type          text NOT NULL DEFAULT '',
  subject_role           text NOT NULL DEFAULT '',
  counterpart_role       text NOT NULL DEFAULT '',
  created_at             timestamptz NOT NULL DEFAULT now()
);
