-- 0026~0028 중 마지막 단계. 새 값 집합을 못 어기게 못박는다.
--
-- DEFAULT 도 같이 옮긴다. 지금 코드는 kind 를 언제나 명시해 넣지만, 기본값을 'self'
-- 로 두면 그 값이 CHECK 를 통과하지 못해 kind 를 빠뜨린 다음 INSERT 가 런타임에야
-- 터진다 — 지뢰를 남기지 않는다.
ALTER TABLE profiles
  ALTER COLUMN kind SET DEFAULT 'saved',
  ADD CONSTRAINT profiles_kind_check CHECK (kind IN ('saved', 'temp'));
