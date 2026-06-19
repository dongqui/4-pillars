# kr-web + jp-web 통합 (단일 web + i18n) 설계

작성일: 2026-06-19

## 배경

현재 `apps/kr-web`과 `apps/jp-web`은 사실상 동일한 앱이다. 전체 소스를
비교한 결과 실제 차이는 다음이 전부다.

- `app/routes/login.tsx` — `locale`(`ja`/`ko`)와 라벨 문자열
- `app/root.tsx` — `<html lang>`
- `package.json` — `name`
- `app/lib/auth.ts` — 주석 한 줄

즉 코드 차이는 없고 번역 문자열 차이만 존재한다. 이 상태로는 공통 기능을
추가할 때마다 양쪽에 동일한 코드를 두 번 작성해야 하며, 그 비용이 매
기능마다 누적된다.

`@4-pillars/ui`의 `LoginModal`은 이미 `locale`/`labels` prop을 받도록 설계돼
있고, locale은 `buildAuthUrl`이 `&locale=` 쿼리로 API에 전달하여 API가 user에
저장한다. API는 어느 웹이 호출하든 무관하므로, 앱을 합쳐도 resolved locale만
`LoginModal`에 넘기면 인증 end-to-end 흐름은 변경 없이 유지된다.

## 목표

`apps/kr-web` + `apps/jp-web`을 단일 `apps/web` 앱으로 통합하고, locale은
런타임에 판별하여 i18n으로 처리한다. 시장별로 크게 다른 결제만 locale 분기
모듈로 흡수한다.

## 비목표 (Non-goals)

- 결제 로직 자체의 구현/변경 (분기 지점만 마련, PG 연동은 별도 작업)
- `@4-pillars/content`(리포트 본문 콘텐츠)의 구조 변경
- API 측 변경 (locale 흐름은 기존 그대로 동작)

## 결정된 전제

- 한국/일본 시장은 **언어 + 결제**만 크게 다르고, 페이지/기능 구조는 공유한다.
  → 단일 i18n 앱이 조건문 지옥이 될 위험이 낮다.
- 번역 문자열은 **경량 타입 사전**으로 관리한다 (외부 i18n 라이브러리 미도입).
- 마이그레이션은 점진적이 아니라 **한 번에 치환**한다 (두 앱이 거의 동일해
  단계적 마이그레이션의 이점이 없고 중간 상태가 더 복잡해진다).

## 알려진 트레이드오프

단일 앱의 본질적 손해는 **배포 격리 상실**이다. 잘못된 배포 하나가 KR/JP
양쪽 시장을 동시에 내린다. 이는 수용하기로 한다(프리뷰 배포로 완화). 그 외
단점(SSR locale 판별 실패 지점, SEO 책임 집중, 번들 동거)은 아래 설계에서
완화책을 둔다.

## 설계

### 1. 앱 통합

- `apps/kr-web`, `apps/jp-web` 삭제 → `apps/web` 단일 앱 신설.
- 라우트/루트/설정(`react-router.config.ts`, `vite.config.ts`, `tsconfig.json`,
  `Dockerfile` 등)은 기존 것을 그대로 가져오되, 하드코딩된 locale 문자열만
  동적으로 치환한다.
- `package.json` `name`은 `web`.

### 2. locale 판별 — `apps/web/app/lib/locale.ts`

- 타입: `type Locale = "ko" | "ja"`.
- **프로덕션**: SSR 진입점(root loader)에서 요청의 `Host` 헤더를 파싱한다.
  - `kr.` 으로 시작 → `ko`
  - `jp.` 으로 시작 → `ja`
  - 그 외(프리뷰 `*.vercel.app` 등 매칭 실패) → **fallback `ko`** (명시적 기본값)
- **개발/오버라이드**: `?lang=ko|ja` 쿼리가 있으면 최우선 적용, 없으면
  `VITE_LOCALE` env. 둘 다 없으면 Host 판별로 폴백. 로컬에서 양쪽 시장을 모두
  테스트할 수 있게 한다.
- 우선순위: `?lang=` 쿼리 > `VITE_LOCALE` env > Host 헤더 > fallback(`ko`).
- root loader가 resolved locale을 내려주고, 하위 컴포넌트는 `useLocale()`
  (loader 데이터 기반 훅)로 소비한다.

### 3. 경량 타입 사전 — `packages/i18n` (신규 내부 패키지)

```
@4-pillars/i18n
  src/index.ts   → export type Locale; export const messages; export t(locale)
  src/ko.ts      → 한국어 사전 (기준 타입)
  src/ja.ts      → 일본어 사전 (ko와 동일 키 강제)
```

- `ko` 사전의 타입을 `Messages`로 삼고, `ja: Messages`로 선언하여 키 누락 시
  **컴파일 에러**가 나도록 한다.
- `messages: Record<Locale, Messages>`, `t(locale)`은 해당 locale 사전을
  반환하는 단순 함수. 보간/복수형이 필요하면 사전 값에 함수를 두어 처리
  (`greeting: (name: string) => \`...\``).
- 초기 키셋(현재 화면 기준): `login.open`, `login.title`, `login.kakao`,
  `login.line`, `login.google`, `login.apple`.
- 리포트 본문 콘텐츠(`@4-pillars/content`)와는 분리한다 (UI 카피 ≠ 리포트 본문).

### 4. 라우팅 & 결제 분기

- 공통 라우트(home, login 등)는 단일 모듈에서 `t(locale)`로 카피만 분기한다.
- `login.tsx`는 resolved locale을 `LoginModal`의 `locale`/`labels`에 주입한다
  (라벨은 `t(locale).login.*`에서 가져온다).
- **결제**는 시장별 차이가 크므로 `routes/payment.tsx`의 loader/컴포넌트에서
  `locale` 기준으로 분기한다. 분기가 커지면 `payment.ko.tsx` /
  `payment.ja.tsx`로 모듈을 분리할 수 있도록 경계를 명확히 둔다. (이번 범위는
  분기 지점 마련까지이며 PG 연동은 비목표.)
- `root.tsx`의 `<html lang>` = resolved locale.

### 5. 배포

- **Vercel 프로젝트 1개**에 `kr.example.com` + `jp.example.com` 두 도메인을
  매핑한다. locale은 런타임 Host로 판별되므로 빌드는 하나다.
- 부모 도메인 스코프 httpOnly 세션 쿠키 공유 구조는 그대로 유지된다(변동 없음).

### 6. 정리 작업

- `pnpm-workspace.yaml`, `turbo.json`, 루트 `package.json` 스크립트
  (`--filter kr-web`, `--filter jp-web` 등)에서 옛 앱 참조 제거,
  `--filter web`으로 갱신.
- `README.md` / `docs/prd.md`의 모노레포 구조 · 역할 분리 · 배포 구조 · 도메인
  구조 섹션을 단일 `web` + locale 분기 방식으로 갱신한다.

## 테스트

- `apps/web/app/lib/locale.ts` 단위 테스트:
  - Host 헤더 → locale 매핑 (`kr.*`→ko, `jp.*`→ja, 미매칭→ko)
  - 오버라이드 우선순위 (`?lang=` > `VITE_LOCALE` > Host)
- `@4-pillars/i18n`:
  - 키 정합성은 타입으로 1차 보장.
  - `ko`/`ja` 키셋 일치 단위 테스트 (런타임 누락 방어).
- 기존 `buildAuthUrl` / `LoginModal` 테스트는 변경 없이 통과해야 한다
  (locale 흐름 불변).

## 마이그레이션 순서(개략)

1. `packages/i18n` 신설 + ko/ja 사전 + 테스트.
2. `apps/web` 신설: kr-web 기반으로 복제 후 locale 동적화 + `locale.ts` + 테스트.
3. login/root을 i18n·locale 연동으로 전환.
4. 결제 라우트 분기 지점 마련(스텁 수준).
5. `kr-web`/`jp-web` 삭제, 워크스페이스/turbo/스크립트 정리.
6. README/PRD 문서 갱신.
7. 전체 `pnpm typecheck` / `pnpm test` / `pnpm build` 통과 확인.
