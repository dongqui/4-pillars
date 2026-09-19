-- migrations/0049_users_provider_admin.sql
-- users.provider 의 CHECK 에 'admin' 을 더한다. 소셜 제공자를 거치지 않고 아이디·비밀번호로
-- 들어오는 운영 계정의 자리다 — 첫 쓰임은 PG 카드사 심사용 임시 로그인(src/lib/auth/review-login.ts).
--
-- ⚠️ 'admin' 은 "어떻게 로그인했나" 일 뿐 권한이 아니다. 이 값으로 관리자 기능을 열면 안 된다 —
-- 심사용 계정의 비밀번호는 카드사 담당자들에게 공유된다.
--
-- 제약을 넓히기만 하므로, 개발 DB 를 같이 쓰는 다른 브랜치의 코드는 그대로 돈다.
-- DROP 과 ADD 를 한 ALTER TABLE 에 담는다 — Neon HTTP 드라이버는 한 쿼리에 여러 문장을 거부한다.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_provider_check,
  ADD CONSTRAINT users_provider_check CHECK (provider IN ('google', 'line', 'kakao', 'admin'));
