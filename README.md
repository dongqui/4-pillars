# 4-pillars (사주대소 / SajuDaiso)

AI 기반 사주 리포트 서비스. 한국/일본 시장 대상, 계산 엔진은 공통·콘텐츠/운영은 국가별 분리.

자세한 제품 정의는 [docs/prd.md](docs/prd.md) 참고.

## 모노레포 구조

```
4-pillars/
├─ apps/
│  ├─ web/      # 통합 웹 (React Router, Vercel) — locale은 런타임 Host로 판별 (kr.* → ko, jp.* → ja)
│  └─ api/      # API (Hono, Render)
└─ packages/
   ├─ types/         # @4-pillars/types        공통 타입
   ├─ i18n/          # @4-pillars/i18n          ko/ja UI 카피 사전
   ├─ saju-core/     # @4-pillars/saju-core     사주 원국 계산
   ├─ report-engine/ # @4-pillars/report-engine 리포트 조합
   ├─ content/       # @4-pillars/content       ko/ja 콘텐츠
   └─ ui/            # @4-pillars/ui            공통 UI
```

- 패키지 매니저: **pnpm** (workspace), 빌드 오케스트레이션: **Turborepo**
- 내부 패키지는 빌드 없이 TS 소스를 직접 소비 (`exports` → `./src/index.ts`)

## 시작하기

```bash
pnpm install
```

### 개발

```bash
pnpm dev                      # 전체 워크스페이스
pnpm --filter web dev         # 웹만 (http://localhost:5173)
pnpm --filter api dev         # API만 (http://localhost:3001)
```

### 빌드 / 타입체크

```bash
pnpm build
pnpm typecheck
```

## 기술 스택

- Frontend: React Router, TypeScript, Tailwind CSS (예정: React Query, Zustand)
- API: Hono, TypeScript (예정: Zod, Drizzle ORM)
- DB: Supabase Postgres
- 배포: Vercel(web, 멀티 도메인), Render(api)
