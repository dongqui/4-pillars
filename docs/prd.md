# PRD - AI 기반 사주 리포트 서비스

## 1. 프로젝트 개요

### 프로젝트명 (가칭)

- 사주대소 (SajuDaiso)
- 일본 서비스명 별도 검토

### 비전

사용자가 생년월일시를 입력하면 정확한 사주 원국을 계산하고, 이를 기반으로 읽기 쉬운 고품질 사주 리포트를 제공하는 서비스.

한국과 일본 시장을 대상으로 운영하며, 계산 엔진은 공통으로 사용하고 콘텐츠와 서비스 운영은 국가별로 분리한다.

---

## 2. 목표

### 단기 목표 (MVP)

- 사주 원국 계산
- 기본 성향 리포트 제공
- 한국어 서비스 오픈
- 일본어 서비스 오픈
- 회원가입
- 결제
- 리포트 저장

### 중장기 목표

- AI 기반 맞춤 리포트
- 궁합 서비스
- 대운 분석
- 세운 분석
- 월운/일운
- 구독 모델

---

# 3. 서비스 구조

기술 스택: react-router, typescript, tailwind, hono

```txt
모노레포 구조로 구성

4-pillars/
├─ apps/
│  ├─ kr-web/          # React Router, Vercel 배포
│  ├─ jp-web/          # React Router, Vercel 배포
│  └─ api/             # Hono API, Render 배포
│
├─ packages/
│  ├─ saju-core/       # manseryeok-js 래핑, 사주 계산
│  ├─ report-engine/   # 리포트 조합 로직
│  ├─ content/         # ko/ja 사주 콘텐츠
│  ├─ types/           # 공통 타입
│  └─ ui/              # 공통 UI 컴포넌트
│
├─ package.json
```

## 배포 구조

```txt
kr-web  → Vercel
jp-web  → Vercel
api     → Render
db      → Supabase Postgres
```

## 요청 흐름

```txt
사용자
↓
kr-web / jp-web
↓
apps/api (Hono)
↓
Supabase Postgres
```

예:

```txt
POST https://api.example.com/saju/calculate
POST https://api.example.com/reports
POST https://api.example.com/payments/checkout
```

## 역할 분리

```txt
kr-web
- 한국 랜딩
- 한국 SEO
- 한국 결제 화면
- 한국어 UX

jp-web
- 일본 랜딩
- 일본 SEO
- 일본 결제 화면
- 일본어 UX

api
- 회원
- 결제
- 사주 계산
- 리포트 생성
- 리포트 저장

supabase
- users
- birth_profiles
- saju_charts
- reports
- payments
```

## 기술 스택

```txt
Monorepo
- pnpm workspace
- Turborepo

Frontend
- React Router
- TypeScript
- React Query
- Zustand
- Tailwind CSS

API
- Hono
- TypeScript
- Zod
- Drizzle ORM

DB
- Supabase Postgres

Deploy
- Vercel: kr-web, jp-web
- Render: api
- Supabase: DB
```

## 추천 도메인

```txt
sajudaiso.kr      → kr-web
sujimei.jp        → jp-web
api.sajudaiso.com → api
```

또는 초반에는:

```txt
kr.example.com
jp.example.com
api.example.com
```

사용자 플로우

## 최초 방문

```txt
랜딩 페이지

↓
생년월일 입력

↓
무료 결과 확인

↓
상세 리포트 잠금

↓
회원가입

↓
결제

↓
전체 리포트 확인
```

---

# 8. MVP 기능

## F001 - 사주 입력

입력 항목

```txt
이름
성별
양력 / 음력
생년월일
출생시간
```

---

## F002 - 사주 원국 계산

출력

```txt
년주
월주
일주
시주
```

예시

```txt
갑자
병인
정묘
경오
```

---

## F003 - 오행 분석

출력

```txt
목
화
토
금
수
```

비율 표시

---

## F004 - 십성 분석

출력

```txt
비견
겁재
식신
상관
편재
정재
편관
정관
편인
정인
```

---

## F005 - 무료 리포트

제공 범위

```txt
일간 성향
강점
약점
인간관계 특징
```

---

## F006 - 유료 리포트

제공 범위

```txt
성격
직업
재물
연애
결혼
인간관계
용신 분석
대운 분석
```

---

## F007 - 리포트 저장

회원 기능

```txt
내 사주
가족 사주
과거 리포트
```

저장 가능

---

# 10. 콘텐츠 전략

## 핵심 원칙

GPT가 직접 해석 생성하지 않음

### 1차

```txt
룰 기반 콘텐츠
```

예시

```txt
갑목 일간
+
정관 강함
+
목 과다
```

↓

사전 작성된 콘텐츠 조합

### 2차

```txt
AI 리포트 생성
```

도입

# 12. 출시 순서

### Phase 1

사주 계산 엔진

### Phase 2

한국 MVP

### Phase 3

회원가입

### Phase 4

결제

### Phase 5

일본 서비스

### Phase 6

AI 리포트

# 향후 확장

## 기능

- 궁합
- AI 상담
- 오늘의 운세
- 월운
- 세운
- 대운 리포트
- 가족 사주 관리

## 비즈니스

- 단건 구매
