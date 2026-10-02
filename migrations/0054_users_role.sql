-- migrations/0054_users_role.sql
-- 관리자 권한. 어드민 화면은 이 컬럼만 본다(src/lib/auth/admin.ts).
--
-- ⚠️ users.provider = 'admin'(0049) 과 무관하다. 그건 PG 심사용 임시 로그인의 "로그인 방식" 이고
-- 비밀번호가 카드사 담당자들에게 공유된다. 그 계정이 관리자가 되면 안 된다.
--
-- 관리자 지정은 운영 DB 에서 손으로 한다:
--   UPDATE users SET role = 'admin' WHERE id = <내 id>;
-- 기본값이 있는 컬럼 추가라 개발 DB 를 같이 쓰는 다른 브랜치의 코드는 그대로 돈다.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'))
