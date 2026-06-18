# 간편 로그인 설계 (Line / Kakao / Google / Apple)

- 작성일: 2026-06-18
- 범위: 소셜 간편 로그인만. 이메일/비번 로그인, 회원가입 추가정보 폼, 결제, 수동 계정 연결 UI, 리프레시 토큰 회전은 제외(YAGNI).

## 1. 결정 사항 요약

| 결정 | 선택 |
| --- | --- |
| OAuth 처리 위치 | `apps/api`(Hono)에서 4개 provider 커스텀 OAuth 전부 직접 처리 |
| 도메인 구조 | 단일 부모 도메인 + 서브도메인 (`kr.` / `jp.` / `api.`) |
| 세션 유지 | api가 부모 도메인(`Domain=.example.com`) httpOnly 세션 쿠키 발급, 서브도메인 공유 |
| 세션 형식 | 불투명(opaque) 세션 토큰 + Postgres `sessions` 테이블 (즉시 철회 가능) |
| 계정 모델 | `users` + `auth_identities` 분리, `email_verified`일 때만 이메일로 자동 연결 |
| 프론트 범위 | `packages/ui` 공용 `LoginModal`, kr-web·jp-web 양쪽 연결 |

## 2. 인증 플로우

모든 provider를 Authorization Code + PKCE + `state` 플로우로 통일한다. client secret은 `api`만 보유한다.

```
[web 모달] provider 버튼 클릭
  → GET https://api.example.com/auth/:provider/start?redirect=<돌아갈 web URL>
     · api가 state · PKCE(code_verifier/challenge) · nonce · redirect 를 생성
     · 위 값을 api 도메인 단기 httpOnly 쿠키(만료 ~10분)에 저장
     · provider authorize URL 로 302 리다이렉트
  → provider 로그인/동의
  → https://api.example.com/auth/:provider/callback?code=...&state=...
     · 쿠키의 state 와 쿼리 state 일치 검증 (CSRF 방지)
     · code → access_token / id_token 교환 (code_verifier 사용)
     · provider 프로필 조회: provider_user_id, email, email_verified, name
     · users / auth_identities upsert (아래 4절 규칙)
     · sessions 행 생성 → Set-Cookie 세션 쿠키 (Domain=.example.com, httpOnly, Secure, SameSite=Lax)
     · 단기 state 쿠키 삭제
     · 원래 web redirect URL 로 302
  → web 복귀. 세션 쿠키 보유.
     · root loader 가 fetch(api /auth/me, { credentials: 'include' }) 로 로그인 상태 확인
```

## 3. 백엔드 (`apps/api`, Hono)

### 라우트
- `GET /auth/:provider/start` — state/PKCE 생성, provider authorize로 리다이렉트
- `GET /auth/:provider/callback` — state 검증, 토큰 교환, 프로필 조회, 유저/세션 처리, web으로 리다이렉트
- `GET /auth/me` — 현재 세션의 유저 반환(없으면 401)
- `POST /auth/logout` — 세션 철회(`sessions.revoked_at`) + 쿠키 삭제

### provider 어댑터
provider별 차이를 공통 인터페이스로 흡수한다.

```ts
interface OAuthProvider {
  name: 'google' | 'apple' | 'kakao' | 'line';
  buildAuthorizeUrl(args: { state: string; codeChallenge: string; nonce: string }): string;
  exchangeCode(args: { code: string; codeVerifier: string }): Promise<TokenResponse>;
  fetchProfile(tokens: TokenResponse): Promise<NormalizedProfile>;
}

interface NormalizedProfile {
  providerUserId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  raw: unknown;
}
```

provider별 특이사항:
- **Google**: OIDC. id_token + userinfo. `email_verified` 제공.
- **Apple**: OIDC. `client_secret`을 Apple private key(.p8)로 서명한 JWT로 동적 생성해야 함. 응답은 `response_mode=form_post`. `name`은 최초 인증 시 form POST 바디에서만 제공됨(이후 없음). email은 private relay일 수 있음.
- **Kakao**: OAuth2 + `/v2/user/me` userinfo. email은 동의 항목(scope `account_email`), 미동의 시 null. `kakao_account.is_email_verified` 사용.
- **Line**: OIDC. id_token 제공. email은 scope `openid email` + 채널 email 권한 필요. name·picture 제공.

### 세션 미들웨어
세션 쿠키 → `sessions` 조회(만료/철회 확인) → `c.var.user` 주입. 보호 라우트에서 사용.

### CORS
`kr.example.com` / `jp.example.com`(+ 로컬 dev origin) 허용, `credentials: true`. 응답에 정확한 origin 반영.

### 검증
Zod로 callback 쿼리/바디 파라미터 검증.

## 4. 계정 연결 규칙

callback에서 정규화된 프로필 처리:

1. `auth_identities`에서 `(provider, provider_user_id)`로 조회.
   - 존재 → 해당 `user_id`로 로그인.
2. 없으면, `email`이 있고 `emailVerified === true`인 경우 `users.email`로 기존 유저 조회.
   - 존재 → 그 유저에 새 `auth_identity` 연결(자동 연결).
3. 그 외(이메일 없음 또는 미검증) → 새 `user` + 새 `auth_identity` 생성.

> 보안: `email_verified`가 아닌 이메일로는 절대 자동 연결하지 않는다(이메일 스푸핑을 통한 계정 탈취 방지).

## 5. DB 스키마 (Supabase Postgres, Drizzle ORM)

신규 도입: `drizzle-orm` + `postgres`(postgres.js) 드라이버 + `drizzle-kit`. `apps/api`에 Drizzle 설정 + 마이그레이션 추가. `DATABASE_URL`은 Supabase 연결 문자열.

```
users
  id            uuid pk default gen_random_uuid()
  email         text null
  name          text null
  locale        text null            -- 'ko' | 'ja' 등
  created_at    timestamptz default now()
  updated_at    timestamptz default now()

auth_identities
  id              uuid pk default gen_random_uuid()
  user_id         uuid fk -> users.id (on delete cascade)
  provider        text  -- 'google' | 'apple' | 'kakao' | 'line'
  provider_user_id text
  email           text null
  email_verified  boolean default false
  raw_profile     jsonb
  created_at      timestamptz default now()
  unique (provider, provider_user_id)

sessions
  id            uuid pk default gen_random_uuid()
  token         text unique          -- 쿠키에 담기는 불투명 값
  user_id       uuid fk -> users.id (on delete cascade)
  expires_at    timestamptz
  revoked_at    timestamptz null
  created_at    timestamptz default now()
```

## 6. 프론트엔드 (`packages/ui` + kr-web·jp-web)

- `packages/ui`에 presentational `LoginModal` 컴포넌트:
  - props: `apiBaseUrl`, `returnUrl`, `labels`(ko/ja 텍스트), `open`/`onClose`
  - 4개 provider 버튼 = `${apiBaseUrl}/auth/${provider}/start?redirect=${encodeURIComponent(returnUrl)}` 로 이동하는 링크
  - UI는 최소 형태(대충). 추후 디자인 다듬음.
- kr-web · jp-web:
  - 모달 열기 트리거(버튼/상태)
  - root loader에서 `/auth/me`(credentials: include)로 로그인 상태 조회 후 컨텍스트 제공

## 7. 설정

`apps/api/.env.example` (실제 값은 추후 전달):

```
DATABASE_URL=
SESSION_COOKIE_DOMAIN=.example.com
WEB_ORIGINS=https://kr.example.com,https://jp.example.com

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
KAKAO_REDIRECT_URI=

LINE_CLIENT_ID=
LINE_CLIENT_SECRET=
LINE_REDIRECT_URI=

APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
APPLE_REDIRECT_URI=
```

## 8. 테스트 (TDD)

순수 로직은 단위 테스트, 외부 호출은 모킹:
- state/PKCE 생성·검증
- 계정 연결 규칙(4절): 기존 identity / 이메일 자동 연결 / 신규 생성 / 미검증 이메일 비연결
- 세션 생성·만료·철회 조회
- provider 토큰 교환·프로필 정규화는 HTTP 모킹

## 9. 범위 제외 (YAGNI)
이메일/비밀번호 로그인, 회원가입 추가정보 폼, 결제 연동, 수동 계정 연결 UI, 리프레시 토큰 회전.
