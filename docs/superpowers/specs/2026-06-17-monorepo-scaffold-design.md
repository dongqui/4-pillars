# 모노레포 골격 세팅 설계

- 날짜: 2026-06-17
- 범위: PRD(`docs/prd.md`)에 정의된 모노레포 구조 스캐폴딩. **기능 개발 제외.**

## 목표

`create-react-router` 단일 앱을 PRD의 pnpm workspace + Turborepo 모노레포 골격으로 전환한다. 모든 워크스페이스는 빌드/타입체크가 통과하는 스텁 상태로 만든다.

## 결정사항

| 항목 | 결정 |
|------|------|
| 워크스페이스 범위 | PRD 그대로 전체 (apps 3 + packages 5) |
| 기존 루트 앱 | `apps/kr-web`으로 이동 |
| 패키지 매니저 | npm → **pnpm** 전환 (`package-lock.json` 제거) |
| 빌드 도구 | Turborepo |
| 패키지 스코프 | `@4-pillars/*` |
| 내부 패키지 소비 | 빌드리스 — `exports`가 `./src/index.ts`를 직접 가리킴 |

## 최종 구조

```
4-pillars/
├─ package.json              # 루트, private, turbo 스크립트
├─ pnpm-workspace.yaml       # apps/*, packages/*
├─ turbo.json                # dev/build/typecheck 파이프라인
├─ tsconfig.base.json        # 공통 컴파일러 옵션
├─ apps/
│  ├─ kr-web/   # 루트 app/·설정 이동 (ko)
│  ├─ jp-web/   # kr-web 미러 (ja)
│  └─ api/      # Hono + @hono/node-server, GET /health
└─ packages/
   ├─ types/         # @4-pillars/types (의존 없음)
   ├─ saju-core/     # @4-pillars/saju-core → types
   ├─ report-engine/ # @4-pillars/report-engine → saju-core, content, types
   ├─ content/       # @4-pillars/content → types
   └─ ui/            # @4-pillars/ui → types
```

## 스텁 내용

- **kr-web**: 현재 welcome 페이지 유지(ko), 내부 패키지 워크스페이스 의존만 추가.
- **jp-web**: kr-web 복제, ja 로케일 표시 텍스트만 변경.
- **api**: Hono 앱, `GET /health` → `{ ok: true }`, `tsx` dev 서버.
- **packages/\***: `src/index.ts`에 스텁 export(타입/상수/플레이스홀더 함수)만.

## 범위 밖

사주 계산/리포트 로직, Drizzle/Supabase 스키마, 결제, React Query/Zustand 배선, 배포 설정(Vercel/Render).

## 검증

- `pnpm install` 성공
- `pnpm typecheck` 전 워크스페이스 통과
- `pnpm --filter kr-web dev` / `api` dev 서버 기동 확인
