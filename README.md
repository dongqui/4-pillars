# 4-pillars (사주대소 / SajuDaiso)

AI 기반 사주 리포트 서비스. 사용자가 생년월일시를 입력하면 만세력으로 사주 원국을 계산하고, 이를 기반으로 읽기 쉬운 사주 리포트를 제공한다.

자세한 제품 정의는 [docs/prd.md](docs/prd.md) 참고.

## 구조

단일 Next.js 앱. 만세력·명리 계산 로직은 `src/lib/saju-core`에 위치한다.

```
4-pillars/
├─ src/
│  ├─ app/                 # Next.js App Router
│  └─ lib/
│     └─ saju-core/        # 사주 원국 계산 + 명리 분석 (자체 로직)
│        ├─ chart.ts       # 만세력 → 사주팔자(간지) 변환
│        ├─ elements.ts    # 오행 분포
│        ├─ ten-gods.ts    # 십성 분포
│        ├─ strength.ts    # 신강/신약
│        ├─ yongsin.ts     # 용신/희신
│        ├─ luck.ts        # 대운
│        ├─ astro/         # 절기 계산
│        └─ data/          # 천간·지지·관계 데이터
└─ docs/                   # 제품 문서
```

- 만세력 계산은 [`@fullstackfamily/manseryeok`](https://www.npmjs.com/package/@fullstackfamily/manseryeok)을 사용하고, 그 위의 원국 구성·오행·십성·신강신약·용신·대운은 `saju-core`의 자체 명리 로직으로 계산한다.

## 시작하기

```bash
npm install
npm run dev            # http://localhost:3000
```

### 스크립트

```bash
npm run dev            # 개발 서버
npm run build          # 프로덕션 빌드
npm run typecheck      # tsc --noEmit
npm run test           # vitest (saju-core)
npm run demo -- 1990 5 15 14 30 male   # 원국 계산 데모
```

## 기술 스택

- Framework: **Next.js 16** (App Router), React 19, TypeScript
- Styling: Tailwind CSS v4
- 사주 계산: `@fullstackfamily/manseryeok` + `saju-core` 자체 로직
- 테스트: Vitest
- DB: Supabase (예정)
