# Phase 3 - 회원가입

> 상태: ✅ 완료 / 🚧 진행 중 / ⬜ 대기
>
> 인증 시스템 설계 문서: `docs/superpowers/specs/2026-06-18-social-login-design.md`
> (설계는 Hono 모노레포 기준이므로 현재 Next.js 단일 앱 구조에 맞게 Route Handler로 조정 필요)

## ⬜ ISSUE-012-1. 인증 공통 인프라

- DB 스키마: `users` / `auth_identities` / `sessions` 테이블 마이그레이션
- Authorization Code + PKCE + state 공통 플로우 (`/api/auth/[provider]/start`, `/api/auth/[provider]/callback`)
- provider 어댑터 인터페이스 (`OAuthProvider`, `NormalizedProfile`)
- 계정 연결 규칙: 기존 identity 로그인 / 검증된 이메일 자동 연결 / 신규 생성
- 세션: opaque 토큰 + httpOnly 쿠키, `/api/auth/me`, `/api/auth/logout`
- 단위 테스트: state/PKCE, 계정 연결 규칙, 세션 생성·만료·철회

## ⬜ ISSUE-012-2. 구글 로그인

- OIDC 플로우, id_token + userinfo 프로필 정규화
- `email_verified` 반영
- Google Cloud Console 클라이언트 등록, redirect URI 설정

## ⬜ ISSUE-012-3. 카카오 로그인

- OAuth2 + `/v2/user/me` 프로필 조회
- email 동의 항목(scope `account_email`) 처리, 미동의 시 null 허용
- `kakao_account.is_email_verified` 반영
- Kakao Developers 앱 등록

## ⬜ ISSUE-012-4. 라인 로그인 (일본 서비스 대비)

- OIDC 플로우, id_token 검증
- email은 scope `openid email` + 채널 email 권한 신청 필요
- LINE Developers 채널 등록

## ⬜ ISSUE-012-5. 애플 로그인

- OIDC + `response_mode=form_post` (callback을 POST로 처리)
- client_secret을 .p8 private key로 서명한 JWT로 동적 생성
- name은 최초 인증 시에만 전달됨 → 최초 응답에서 저장
- private relay 이메일 처리
- Apple Developer 등록 (Team ID / Key ID / Service ID)

## ⬜ ISSUE-012-6. 로그인 UI

- 로그인 모달(4개 provider 버튼) 컴포넌트
- 로그인 상태 조회(`/api/auth/me`) 및 전역 컨텍스트 제공
- 리포트 잠금 화면·헤더에 로그인 진입점 연결

## ⬜ ISSUE-013. 리포트 저장 - 회원 연동 (F007)

- 익명 리포트 → 가입 시 계정에 연결
- 내 사주 / 가족 사주 / 과거 리포트 목록 화면
