# Issues - AI 기반 사주 리포트 서비스

> PRD(`docs/prd.md`) 기반 이슈 목록. 출시 순서(Phase 1~6)에 맞춰 정리.
> 상태: ✅ 완료 / 🚧 진행 중 / ⬜ 대기

---

## Phase 1 - 사주 계산 엔진

### ✅ ISSUE-001. 사주 원국 계산 엔진 (F002)

- 생년월일시 → 년주/월주/일주/시주 계산
- 절기 기준 월주 처리 (`saju-core/astro/solar-term`)
- 구현: `src/lib/saju-core/chart.ts`

### ✅ ISSUE-002. 오행 분석 (F003)

- 목/화/토/금/수 분포 및 비율 계산
- 구현: `src/lib/saju-core/elements.ts`

### ✅ ISSUE-003. 십성 분석 (F004)

- 비견~정인 10종 십성 도출
- 구현: `src/lib/saju-core/ten-gods.ts`

### ✅ ISSUE-004. 신강/신약·용신·대운 계산

- 일간 강약 판정, 용신 분석, 대운 산출
- 구현: `src/lib/saju-core/strength.ts`, `yongsin.ts`, `luck.ts`

### ⬜ ISSUE-005. 음력 입력 지원 (F001 일부)

- 음력 → 양력 변환 후 원국 계산 (`@fullstackfamily/manseryeok` 활용 검토)
- 퍼널의 양력/음력 선택값이 실제 계산에 반영되는지 검증

---

## Phase 2 - 한국 MVP

### ✅ ISSUE-006. 랜딩 페이지

- Hero, 샘플 리포트, 신뢰 섹션, CTA
- 구현: `src/app/page.tsx`, `src/app/_components/`

### ✅ ISSUE-007. 사주 입력 퍼널 (F001)

- 이름 → 성별 → 생년월일(양/음력) → 출생시간 → 확인 단계
- 구현: `src/app/funnel/`

### ✅ ISSUE-008. 사주 계산 API + 결과 저장

- POST `/api/saju`: 입력 검증, 원국 계산, DB 저장
- 구현: `src/app/api/saju/`, `scripts/migrate.mts`

### ⬜ ISSUE-009. 무료 리포트 화면 (F005)

- 원국 표(4주), 오행 비율 차트, 십성 요약 표시
- 일간 성향 / 강점 / 약점 / 인간관계 특징 콘텐츠 노출
- 현재 `src/app/report/page.tsx`는 "준비 중" 스텁 → 실제 리포트 화면으로 교체

### ⬜ ISSUE-010. 룰 기반 콘텐츠 시스템 (1차 콘텐츠 전략)

- GPT 직접 생성 없이, 사전 작성 콘텐츠 조합 방식
- 조합 키 설계: 일간 × 십성 강약 × 오행 과다/부족
- 콘텐츠 데이터 스키마 및 저장 방식 결정 (DB vs 정적 파일)
- 무료 리포트 범위(일간 성향/강점/약점/인간관계) 콘텐츠 작성

### ⬜ ISSUE-011. 유료 리포트 잠금 UI (F006 선행)

- 무료 리포트 하단에 상세 리포트 잠금(블러/티저) 섹션
- 회원가입·결제 유도 CTA

---

## Phase 3 - 회원가입

> 인증 시스템 설계 문서: `docs/superpowers/specs/2026-06-18-social-login-design.md`
> (설계는 Hono 모노레포 기준이므로 현재 Next.js 단일 앱 구조에 맞게 Route Handler로 조정 필요)

### ⬜ ISSUE-012-1. 인증 공통 인프라

- DB 스키마: `users` / `auth_identities` / `sessions` 테이블 마이그레이션
- Authorization Code + PKCE + state 공통 플로우 (`/api/auth/[provider]/start`, `/api/auth/[provider]/callback`)
- provider 어댑터 인터페이스 (`OAuthProvider`, `NormalizedProfile`)
- 계정 연결 규칙: 기존 identity 로그인 / 검증된 이메일 자동 연결 / 신규 생성
- 세션: opaque 토큰 + httpOnly 쿠키, `/api/auth/me`, `/api/auth/logout`
- 단위 테스트: state/PKCE, 계정 연결 규칙, 세션 생성·만료·철회

### ⬜ ISSUE-012-2. 구글 로그인

- OIDC 플로우, id_token + userinfo 프로필 정규화
- `email_verified` 반영
- Google Cloud Console 클라이언트 등록, redirect URI 설정

### ⬜ ISSUE-012-3. 카카오 로그인

- OAuth2 + `/v2/user/me` 프로필 조회
- email 동의 항목(scope `account_email`) 처리, 미동의 시 null 허용
- `kakao_account.is_email_verified` 반영
- Kakao Developers 앱 등록

### ⬜ ISSUE-012-4. 라인 로그인 (일본 서비스 대비)

- OIDC 플로우, id_token 검증
- email은 scope `openid email` + 채널 email 권한 신청 필요
- LINE Developers 채널 등록

### ⬜ ISSUE-012-5. 애플 로그인

- OIDC + `response_mode=form_post` (callback을 POST로 처리)
- client_secret을 .p8 private key로 서명한 JWT로 동적 생성
- name은 최초 인증 시에만 전달됨 → 최초 응답에서 저장
- private relay 이메일 처리
- Apple Developer 등록 (Team ID / Key ID / Service ID)

### ⬜ ISSUE-012-6. 로그인 UI

- 로그인 모달(4개 provider 버튼) 컴포넌트
- 로그인 상태 조회(`/api/auth/me`) 및 전역 컨텍스트 제공
- 리포트 잠금 화면·헤더에 로그인 진입점 연결

### ⬜ ISSUE-013. 리포트 저장 - 회원 연동 (F007)

- 익명 리포트 → 가입 시 계정에 연결
- 내 사주 / 가족 사주 / 과거 리포트 목록 화면

---

## Phase 4 - 결제

### ⬜ ISSUE-014. 결제 연동 (단건 구매)

- PG 선정 (한국: 토스페이먼츠/포트원 등 검토)
- 결제 → 유료 리포트 잠금 해제 플로우
- 주문/결제 내역 테이블

### ⬜ ISSUE-015. 유료 리포트 콘텐츠 (F006)

- 성격 / 직업 / 재물 / 연애 / 결혼 / 인간관계 / 용신 분석 / 대운 분석
- 룰 기반 콘텐츠(ISSUE-010) 확장

---

## Phase 5 - 일본 서비스

### ⬜ ISSUE-016. i18n 인프라

- ko/ja 다국어 라우팅 및 번역 체계 (기존 설계: `docs/superpowers/specs/2026-06-19-unify-web-i18n-design.md`)
- 계산 엔진 공통, 콘텐츠 국가별 분리 구조

### ⬜ ISSUE-017. 일본어 콘텐츠 및 서비스명

- 일본 서비스명 확정
- 리포트 콘텐츠 일본어 버전 작성
- 일본 결제 수단 검토

---

## Phase 6 - AI 리포트

### ⬜ ISSUE-018. AI 기반 맞춤 리포트 (2차 콘텐츠 전략)

- 룰 기반 결과를 입력으로 한 AI 리포트 생성 파이프라인
- 품질 검수 및 비용 관리 방안

---

## 향후 확장 (백로그)

- 궁합 서비스
- AI 상담
- 오늘의 운세 / 월운 / 세운
- 대운 리포트
- 가족 사주 관리
- 구독 모델
