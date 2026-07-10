# 랜딩 페이지 + 사주 입력 퍼널 — 설계 스펙

- 작성일: 2026-07-10
- 상태: 승인됨 (구현 계획 대기)
- 관련 디자인: `design/project/` (랜딩페이지, Saju Desktop Funnel, Saju Funnel mobile, Saju Design System)

## 1. 목표

사주 리포트 서비스의 진입 경험을 구현한다.

1. **랜딩 페이지** (`/`) — 서비스 소개 + "내 리포트 만들기" CTA
2. **사주 입력 퍼널** (`/funnel`) — 5스텝 입력(이름 → 성별 → 생년월일 → 태어난 시간 → 확인) → 분석중 → 리포트(stub)

`design/project/`의 HTML 프로토타입을 픽셀에 가깝게 재현하되, 내부 구조는 React/Next 관용에 맞게 재구성한다. 재활용 가능한 컴포넌트는 반드시 별도로 분리한다.

## 2. 스택 & 기반

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 — 현 코드베이스 그대로
- **폰트: Pretendard**로 교체 (현재 `layout.tsx`의 Geist 대체). 디자인 시스템 폰트가 Pretendard이며 한글/라틴/숫자 정렬이 핵심
- **디자인 토큰**을 `globals.css`의 Tailwind v4 `@theme`(및 CSS 변수)로 인코딩:
  - Primary(accent): `#2563EB` 계열 스케일(#EFF6FF ~ #1D4ED8)
  - 중립: Slate 스케일(#F8FAFC ~ #0F172A)
  - Semantic: success #16A34A, warning #D97706, danger #DC2626, info #2563EB
  - 오행 5색: 목 #2E9E6B / 화 #DC5A4B / 토 #C99A3F / 금 #8492A6 / 수 #3E6FB0 (+ 각 soft 배경/텍스트 톤)
  - radius 기본 12, elevation: none / soft / elevated 그림자 프리셋

> 참고: `docs/prd.md`는 react-router/모노레포 기반의 구버전 계획이다. 현재 코드베이스는 단일 Next.js 앱으로 재시작되었으므로 **실제 코드베이스(Next.js 16)를 기준**으로 한다.

## 3. 라우트

| 경로 | 설명 |
|---|---|
| `/` | 랜딩 페이지. 현 placeholder `src/app/page.tsx`를 대체. CTA "내 리포트 만들기" → `/funnel?step=name` |
| `/funnel` | 퍼널 컨테이너. `?step=` 쿼리스트링으로 현재 스텝을 렌더 |

스텝 순서: `name → gender → birth → time → review` → (제출) → **분석중 스피너**(퍼널 내 전환 화면) → **리포트 stub**.

## 4. 상태 & 라우팅 아키텍처

### 4.1 값 = Context API

`FunnelProvider` (`src/context/FunnelContext.tsx`)가 입력값과 updater를 보유한다.

```ts
type Gender = 'male' | 'female';
type Calendar = 'solar' | 'lunar';

interface FunnelData {
  name: string;
  gender: Gender | null;
  calendar: Calendar;          // 기본 'solar'
  birth: { y: number; m: number; d: number } | null;
  timeKnown: boolean;          // 기본 true
  time: { h: number; m: number } | null;
  trueSolar: boolean;          // 진태양시 보정, 기본 true
}
```

- 값은 **메모리(Context)에만** 저장한다. sessionStorage/URL에 값을 넣지 않는다.
- updater 함수(`setName`, `setGender`, ...)를 Context로 노출한다.

### 4.2 스텝 = 쿼리스트링

- 현재 스텝은 오직 `?step=<key>`로 결정된다. `useFunnelNav()` 훅이 담당:
  - `searchParams`에서 현재 스텝 도출
  - `goNext()` = `router.push(?step=다음)` → **히스토리 push** → 브라우저 뒤로가기로 이전 스텝 이동
  - `goBack()` = `router.back()`
- 스텝 순서/검증은 `src/lib/funnel/steps.ts`의 순수 함수로 분리(테스트 대상).

### 4.3 새로고침 / 딥링크 가드

- Context가 메모리이므로 새로고침 시 값이 사라진다.
- 첫 스텝(`name`)이 아닌데 필요한 이전 데이터가 없으면 `?step=name`으로 리다이렉트한다.
- 알 수 없는/누락된 `step` 값도 `?step=name`으로 리다이렉트한다.
- 이 가드는 퍼널 컨테이너(클라이언트) 진입 시 수행한다.

### 4.4 검증 규칙

- `name`: trim 후 비어있으면 다음 비활성(CTA 비활성 스타일).
- `gender`: 선택해야 다음 진행.
- `birth`: 휠 피커 기본값 존재(예: 1990.01.01)이므로 항상 유효.
- `time`: `timeKnown === false`면 시간 입력 스킵 가능.
- review에서 제출 → 분석중 화면.

## 5. 컴포넌트 구조 (재활용 분리 + co-location)

**분리 원칙**
- **도메인 비의존 프리미티브**는 `src/components/`에 분리해 재활용한다. (전용 컴포넌트는 전부 `app/` 하위에 co-location하므로 `components/`에는 프리미티브만 남고, `ui/` 하위 폴더는 두지 않는다.)
- **랜딩·퍼널 전용 컴포넌트와 로직**은 App Router의 **co-location** 방식으로 각 라우트 폴더 아래(`_` 접두 private 폴더)에 둔다. 라우트에 종속된 관심사를 해당 페이지 옆에 모은다.

```
src/
  components/                 # 디자인 시스템 프리미티브 (도메인 비의존, 재활용)
    Button.tsx                # variant: primary | secondary | ghost | danger
    SegmentedControl.tsx      # 양력/음력 등 범용 세그먼트 토글
    Toggle.tsx                # 진태양시 스위치
    OptionCard.tsx            # 선택형 카드(성별 등)
    ProgressBar.tsx
    Badge.tsx                 # 오행/십성 태그
    WheelPicker.tsx           # 범용 휠(스피너) 컬럼
    DateWheelPicker.tsx       # 년/월/일 휠 (WheelPicker 조합)
    TimeWheelPicker.tsx       # 시/분 휠 (WheelPicker 조합)
  app/
    layout.tsx
    globals.css
    page.tsx                  # 랜딩
    _components/              # 랜딩 전용 (co-location)
      LandingNav.tsx
      Hero.tsx                # 히어로 + 리포트 미리보기 카드
      ReportPreviewCard.tsx
      KnowSection.tsx / KnowCard.tsx
      SampleReport.tsx
      TrustSection.tsx / TrustBadge.tsx
      FooterCta.tsx
    funnel/
      page.tsx                # 퍼널 컨테이너 (FunnelProvider + 가드 + 스텝 스위치)
      _components/
        FunnelLayout.tsx      # 반응형: 데스크톱 좌측 스텝퍼 레일 / 모바일 풀스크린
        Stepper.tsx           # 데스크톱 좌측 스텝 표시
        FunnelProgress.tsx    # 상단 진행 바 + n/5
        FunnelFooter.tsx      # 이전 / 다음(CTA)
        AnalyzingScreen.tsx   # 분석중 스피너 (placeholder 흐름)
        steps/
          NameStep.tsx
          GenderStep.tsx
          BirthDateStep.tsx
          BirthTimeStep.tsx
          ReviewStep.tsx
      _context/
        FunnelContext.tsx     # 입력값 + updater (Context API)
      _hooks/
        useFunnelNav.ts       # ?step 기반 스텝 네비게이션
      _lib/
        steps.ts              # 스텝 순서/검증 (순수)
        date.ts               # 휠 옵션 생성, 날짜/시간 모델 헬퍼 (순수)
```

> `_` 접두 폴더는 라우팅에서 제외되는 private 폴더다(Next 관용). 실제 폴더/파일 규칙은 구현 시 `node_modules/next/dist/docs/`로 재확인한다.

### 5.1 반응형 레이아웃 (`FunnelLayout`)

- **데스크톱(≥ md)**: 좌측 400px 레일(브랜드 + 헤드라인 + 세로 스텝퍼 + 보안 문구) + 우측 콘텐츠(상단 진행 바, 중앙 정렬 질문, 하단 이전/다음). Desktop Funnel 디자인 기준.
- **모바일(< md)**: 풀스크린. 상단 back + 진행 바 + n/5, 본문 스크롤, 하단 CTA. Mobile Funnel 디자인 기준(단, 폰 목업 프레임은 실제 뷰포트로 대체).
- 스텝 콘텐츠(`steps/*`)는 레이아웃과 무관하게 동일 컴포넌트를 공유한다.

## 6. 스타일 방식

- 디자인 프로토타입의 인라인 스타일을 **Tailwind v4 유틸리티 + 디자인 토큰**으로 번역한다.
- 동적/계산 스타일(진행률 width, 활성 상태 색 등)은 CSS 변수 또는 조건부 클래스로 처리.
- 색/간격/라운딩/그림자 수치는 디자인 값을 그대로 반영한다.

## 7. 데이터 흐름

```
랜딩 CTA
  → /funnel?step=name  (FunnelProvider 마운트)
  → 각 스텝 입력 → Context 갱신, goNext로 ?step 히스토리 push
  → review: Context 요약 표시 + 진태양시 토글
  → 제출: AnalyzingScreen(스피너) → 리포트 stub
브라우저 뒤로가기 → ?step 이전으로 (Context 값 유지)
새로고침 → Context 소실 → ?step=name 리다이렉트
```

## 8. 에러 처리

- 이름 미입력: 다음 CTA 비활성.
- 성별 미선택: 다음 진행 불가.
- 알 수 없는 `?step` / 데이터 없는 딥링크: `?step=name` 리다이렉트.
- 휠 피커는 항상 유효 범위 값(범위 clamp)만 반환.

## 9. 테스트

- **Vitest** (기설치)로 비시각 로직을 테스트:
  - `app/funnel/_lib/steps.ts`: 스텝 순서, next/back 전이, 검증 로직
  - `app/funnel/_lib/date.ts`: 휠 옵션 생성(윤년/월별 일수), 값 clamp
- 픽셀 일치는 `npm run dev` 시각 확인으로 검증.
- 컴포넌트 렌더 테스트가 필요하면 `@testing-library/react` 추가를 별도 제안(현재 미설치).

## 10. 범위 밖 (이번 작업 제외 / stub)

- 실제 사주 리포트 화면 구현 (리포트는 "준비 중" stub)
- 음력 ↔ 양력 실제 변환 로직
- 진태양시 실제 보정 계산 (UI 토글만)
- 회원가입/결제/저장

분석중 스피너 화면은 퍼널 흐름 연결을 위해 UI로 포함한다(실제 계산 호출 없음, 타이머 후 stub 이동).

## 11. 구현 시 유의 (AGENTS.md)

이 프로젝트의 Next.js는 학습 데이터와 다를 수 있는 변경이 있으므로, 라우팅/`searchParams`/`redirect`/클라이언트 컴포넌트 관련 코드 작성 전 `node_modules/next/dist/docs/`의 해당 가이드를 확인한다.
