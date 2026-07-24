# 소셜 로그인 설계 (Google / LINE / Kakao)

작성일: 2026-07-24
상태: 승인됨 (구현 대기)

## 목표

Google, LINE, Kakao 소셜 로그인을 커스텀 OAuth로 구현한다. Apple은 범위 밖(추후).
기존 로그인 페이지 디자인 목업(`design/project/Saju Login.dc.html`)을 실제 라우트로 만들고,
`report/_lib/access.ts`의 세션 seam과 연결한다.

## 확정된 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| 인증 구현 | 커스텀 OAuth (라이브러리 없음) | 지정된 `/api/auth/callbacks/...` 경로, 코드베이스의 미니멀·raw SQL 성향과 일치 |
| 세션 | Stateless JWT 쿠키 (jose) | MVP에 적합, 별도 sessions 테이블 불필요. 트레이드오프: 개별 강제 로그아웃 어려움 |
| 계정 모델 | 단일 `users` 테이블 (provider별 별도 계정) | 가장 단순. 이메일 병합은 미도입(추후 데이터 재정렬 비용 감수) |
| 로그인 후 이동 | `next` 파라미터로 복귀 (내부 경로만) | 결제/리포트 게이팅 플로우와 자연스럽게 연결 |
| 최근 로그인 배지 | 포함 | 비-HttpOnly 쿠키 `last_provider` 기록 |
| CSRF | state + PKCE 병행 (3개 provider 모두 PKCE 지원) | |
| env | `.env.local`에 직접 항목 추가 (값은 사용자가 채움) | |

## 전체 플로우

```
[로그인 페이지 /login?next=/report]
   │ 버튼 클릭 (링크)
   ▼
GET /api/auth/login/{provider}?next=/report
   · CSRF state + PKCE code_verifier 생성 → HttpOnly 단기 쿠키에 저장 (next 포함)
   · provider authorize URL로 302 redirect
   ▼
[provider 로그인/동의 화면]
   ▼
GET /api/auth/callbacks/{provider}?code=...&state=...
   · state 쿠키 대조 (CSRF 방어), 불일치 시 거부
   · code + code_verifier → access_token 교환 → 프로필 조회
   · users에 (provider, provider_user_id) upsert, last_login_at 갱신
   · 세션 JWT 발급 → HttpOnly 쿠키 `session`
   · 최근 로그인 쿠키 `last_provider` (비-HttpOnly) 기록
   · state 쿠키에 저장된 next(내부 경로만)로 302 redirect
```

로그아웃: `POST /api/auth/logout` → `session` 쿠키 삭제 후 리다이렉트.

## 파일 구조

```
src/app/login/page.tsx                          # 디자인 목업 → Tailwind React 변환
src/app/api/auth/login/[provider]/route.ts      # 인증 시작 (state/PKCE, provider redirect)
src/app/api/auth/callbacks/[provider]/route.ts  # 콜백 (토큰교환·프로필·세션발급)
src/app/api/auth/logout/route.ts                # 로그아웃
src/lib/auth/providers.ts    # provider별 설정 레지스트리 + 프로필 매퍼
src/lib/auth/session.ts      # jose encrypt/decrypt, 세션 쿠키 set/get/delete
src/lib/auth/oauth.ts        # authorize URL 빌드, 토큰 교환, state/PKCE 헬퍼, next 검증
src/lib/auth/users.ts        # upsertUser (raw SQL)
migrations/0002_users.sql    # users 테이블
```

### 모듈 경계

- `providers.ts` — 각 provider의 endpoint/scope/client env 키/프로필 매퍼를 담은 순수 설정.
  네트워크 호출 없음. 의존: 없음.
- `oauth.ts` — authorize URL 조립, 토큰 교환 `fetch`, state/PKCE 생성·검증, `next` 오픈
  리다이렉트 방어. 의존: `providers.ts`.
- `session.ts` — JWT 인코딩/디코딩(jose)과 `session` 쿠키 read/write/delete. 의존: `next/headers`, `jose`.
- `users.ts` — `upsertUser` raw SQL 1개 함수. 의존: `src/lib/db.ts`.
- route handler들 — 위 4개 모듈을 조립. 얇게 유지.

## 데이터 모델 & 세션

`migrations/0002_users.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider          text NOT NULL,       -- 'google' | 'line' | 'kakao'
  provider_user_id  text NOT NULL,
  email             text,                -- nullable (kakao/line 미제공 가능)
  display_name      text,
  avatar_url        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_login_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);
```

`upsertUser`: `INSERT ... ON CONFLICT (provider, provider_user_id) DO UPDATE`로
email/display_name/avatar_url/last_login_at 갱신, `RETURNING id`.

세션 JWT:
- payload: `{ userId, provider }` — 최소한만. PII(email 등) 제외 (Next 인증 문서 권장).
- 알고리즘 HS256, `AUTH_SESSION_SECRET`로 서명, 만료 7일.
- 쿠키 `session`: HttpOnly, Secure(프로덕션), SameSite=Lax, Path=/, Max-Age 7일.

새 의존성: `jose` (Edge/Node 런타임 호환).

## Provider 설정 & env 항목

`.env.local`에 아래 항목 추가 (값은 비워두고 사용자가 채움). `.env.example`도 동일 키로 병행 관리.

```
# --- Auth ---
AUTH_SESSION_SECRET=          # openssl rand -base64 32
APP_ORIGIN=                   # 예: http://localhost:3000 (redirect_uri 조립용)

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

LINE_CLIENT_ID=               # LINE Login channel ID
LINE_CLIENT_SECRET=          # channel secret

KAKAO_CLIENT_ID=             # REST API 키
KAKAO_CLIENT_SECRET=         # (선택) 카카오 client secret 사용 시
```

각 콘솔 등록 redirect URI: `{APP_ORIGIN}/api/auth/callbacks/{google|line|kakao}`

| provider | authorize | token | scope | provider_user_id | 프로필 출처 |
|----------|-----------|-------|-------|------------------|-------------|
| google | accounts.google.com/o/oauth2/v2/auth | oauth2.googleapis.com/token | `openid email profile` | id_token `sub` | id_token / userinfo |
| line | access.line.me/oauth2/v2.1/authorize | api.line.me/oauth2/v2.1/token | `openid profile email` | id_token `sub` | id_token |
| kakao | kauth.kakao.com/oauth/authorize | kauth.kakao.com/oauth/token | `profile_nickname account_email` | 응답 `id` | kapi.kakao.com/v2/user/me |

- 세 provider 모두 PKCE(S256) 적용.
- email은 provider가 주면 저장, 없으면 NULL.
- 프로필 매퍼는 각 provider 응답을 공통 형태 `{ providerUserId, email?, displayName?, avatarUrl? }`로 정규화.

## access.ts 연동 (seam)

`getReportAccess`를 세션 쿠키 기반으로 교체:
- `isLoggedIn` = `session` 쿠키 디코딩 성공 여부 (실제 세션으로 판정).
- `isPaid` = 결제 미구현이므로 기존 `?paid=true` 쿼리 토글을 **그대로 유지**(리포트 유료 UI를
  개발 중 확인하기 위함). 향후 결제 조회가 붙는 지점으로 남긴다.
- 함수 시그니처: `cookies()`가 async이므로 `getReportAccess`도 async로 전환. `searchParams`
  인자는 `isPaid` 토글 때문에 유지. 기존 테스트는 세션 쿠키를 mock하도록 계획 단계에서 조정.
  호출부(report/page)에서 `await` 필요.

## 테스트 (Vitest, 네트워크 mock)

- `session.ts`: encrypt/decrypt 라운드트립, 만료된 토큰 거부, 변조 토큰 거부.
- `oauth.ts`: authorize URL 조립(필수 파라미터 존재), state/PKCE 생성·검증, `next` 오픈
  리다이렉트 방어(외부 URL·프로토콜 상대 경로 거부, 내부 경로만 허용).
- `providers.ts`: 각 provider 프로필 매퍼가 샘플 응답을 공통 형태로 정규화.
- callback route: `fetch` mock으로 토큰교환→upsert→세션 쿠키 발급 경로, state 불일치 시 거부.

## Next.js 16 주의사항 (AGENTS.md)

- `middleware` → `proxy.ts`로 명칭 변경. (이번 범위에서 proxy 도입은 하지 않음 — access.ts에서
  직접 세션 확인. 필요 시 후속.)
- `cookies()`는 async. route handler·access.ts에서 `await cookies()`.
- route handler는 기본 Node.js 런타임. jose 호환.

## 범위 밖 (추후)

- Apple 로그인
- 이메일 기반 계정 병합
- DB 세션 / 강제 로그아웃 / 기기 관리
- 결제(isPaid) 연동
- proxy.ts 기반 라우트 보호
