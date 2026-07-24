# 사주 리포트 페이지 (`/report`) — 설계 문서

**날짜:** 2026-07-24
**브랜치:** `feat/report-page`
**디자인 출처:** Claude Design 프로젝트 `사주` — `Saju Result.dc.html`(무료 01–04 + 잠금 05–12), `Saju Result Archived 05+.dc.html`(유료 05–12). 로컬 사본: `design/project/`.

## 1. 목표

생년월일시 분석 결과를 보여주는 리포트 페이지를 만든다.

- **무료(비로그인 또는 미결제)**: 섹션 01–04 전체 + 05–12는 잠금 카드 목록 + "전체 결과 보기" CTA.
- **유료(결제 완료)**: 위 무료 영역 + 섹션 05–12 실제 콘텐츠까지 이어서 렌더.
- UI에서 도출한 **데이터 구조**를 타입으로 정리한다.

## 2. 범위 결정 (확정됨)

| 항목 | 결정 |
| --- | --- |
| 데이터 연결 깊이 | **타입 + 픽스처만.** 라이브 API fetch 없음. 리포트 전용 뷰모델 타입 정의 + 디자인 콘텐츠를 픽스처로 시드. |
| 게이팅 | **Stub 함수 + seam.** `getReportAccess()` → `{ isLoggedIn, isPaid }`. 테스트용 `?paid=true` / `?login=true` 쿼리 토글. 실제 auth/결제로 교체할 단일 지점. |
| 잠금 UI | **디자인 그대로.** 05–12 잠금 카드 목록 + 인라인 CTA + 스크롤 시 하단 고정 CTA. |

### 비범위 (YAGNI)
- 실제 로그인/결제/PG 연동.
- `/api/saju` 라이브 fetch 및 `Interpretation`(캐시 키 기반, 테스트 존재) 스키마 변경 — **건드리지 않는다.**
- "공유하기", "궁합 보기 →", CTA 버튼 동작 — 비동작 자리표시자 (라우트 없음).
- 아카이브 디자인 말미의 빈 "마무리 한마디"/"유료 리포트" 섹션 — 콘텐츠가 없어 렌더하지 않음.

## 3. 데이터 모델 — "데이터 구조 정리"

리포트 전용 뷰모델을 새 모듈 `src/app/report/_lib/report-content.ts`에 정의한다. API의 `Interpretation`을 변경하지 않는 이유: 그 타입은 (4기둥+성별) 캐시 키에 묶여 있고 테스트가 존재하며, 지금은 "타입+픽스처만" 범위이기 때문. 뷰모델은 향후 `SajuAnalysis` + 확장된 `Interpretation`에서 채워질 자리로 문서화한다.

### 공용 프리미티브
```ts
interface LabeledText { label: string; body: string }   // label 헤더 + 본문 카드
interface TitledText  { title: string; body: string }   // 굵은 제목 + 본문
interface KeyValue    { label: string; value: string }   // 좌측 라벨(고정폭) + 우측 값
interface AxisRow {                                       // 07 환경 슬라이더
  left: string; right: string;
  pos: number;                 // 0–100, 점 위치(%)
  lean: "left" | "right";      // 강조 방향
}
interface TimelineRow { period: string; title: string; desc: string } // 11 월별
interface DaeunRow {                                       // 12 대운 서술
  range: string; title: string; desc: string; now?: boolean;
}
```

### 근거 패널 (01의 "근거 자세히 보기" collapse)
UI가 실제로 그리는 것에 맞춘 뷰모델. 각 필드는 향후 `SajuAnalysis`에서 매핑(주석으로 seam 명시).
```ts
type ElementKey = "wood" | "fire" | "earth" | "metal" | "water"; // 목화토금수

interface PillarCell {          // 원국 4기둥 각 칸(천간/지지)
  char: string;                 // 한자 (甲, 子 …)
  ko: string;                   // 한글 (갑, 자)
  element: ElementKey;
  tenGod: string;               // 십성 라벨 (비견, 정인 …); 일간 칸은 "일간 · 我"
}
interface PillarColumn {
  slot: "hour" | "day" | "month" | "year"; // 시/일/월/년
  isDayMaster?: boolean;                    // 일주 강조
  stem: PillarCell;                         // 천간
  branch: PillarCell;                       // 지지
}
interface ElementCount { element: ElementKey; count: number; max: number } // 오행 막대
interface ChartEvidence {
  pillars: PillarColumn[];               // ← SajuAnalysis.chart
  elements: ElementCount[];              // ← SajuAnalysis.elements
  yinYang: { yang: number; yin: number };// 음양 비율
  strength: { level: string; percent: number }; // ← SajuAnalysis.strength (신강 62%)
  tags: { label: string; tone: "neutral" | "metal" | "fire" | "accent" }[]; // 십성·용신·희신·신살 칩
  daeunStrip: { gan: string; age: string; now?: boolean }[]; // ← SajuAnalysis.daeun
  disclaimer: string;
}
```

### 최상위 리포트 콘텐츠
```ts
interface ReportContent {
  meta: {
    name: string;                       // 홍길동
    birthLine: string;                  // "양력 1990.02.20 04:30 · 갑자일주"
  };
  // Hero + 무료(01–04)
  headline: string;                     // 큰 한 문장
  summary: string;                      // 보조 문장
  keywords: string[];                   // 상단 키워드 pill
  personality: TitledText[];            // 01 핵심 성향 카드
  evidence: ChartEvidence;              // 01 근거 패널
  outerVsInner: { outward: string; inner: string }; // 02 겉과 속
  strengths: TitledText[];              // 03 강점 (번호 리스트)
  cautions: string[];                   // 04 주의 패턴 단락
  cautionTip: string;                   // 04 TIP
  // 유료(05–12)
  emotion: LabeledText[];               // 05 감정과 스트레스 (4)
  relating: KeyValue[];                 // 06 관계 방식 (5행)
  environment: { axes: AxisRow[]; summary: string }; // 07 잘 맞는 환경
  love: LabeledText[];                  // 08 연애와 관계 (4)
  compatibility: { good: string[]; clash: string[] }; // 09 궁합
  wealth: { points: LabeledText[]; summary: string };  // 10 재물
  yearlyLuck: TimelineRow[];            // 11 올해의 운 (12)
  daeunOutlook: { rows: DaeunRow[]; summary: string }; // 12 대운
}
```

### 잠금 섹션 목록
05–12 각 항목의 `번호 · 카테고리` + 제목만 필요 → `ReportContent`에서 파생하거나 별도 상수 배열로 정의.
```ts
interface LockedSectionMeta { no: string; category: string; title: string }
```

**픽스처:** `src/app/report/_lib/report-content.fixture.ts` — 디자인의 정확한 한글 문구·숫자를 그대로 담는다.

## 4. 게이팅 seam

`src/app/report/_lib/access.ts`:
```ts
export interface ReportAccess { isLoggedIn: boolean; isPaid: boolean }

// 지금은 쿼리 토글. 향후 세션/결제 조회로 교체하는 유일한 지점.
export function getReportAccess(
  searchParams: Record<string, string | string[] | undefined>,
): ReportAccess;
```
- `?paid=true` → `{ isLoggedIn: true, isPaid: true }`
- `?login=true` → `{ isLoggedIn: true, isPaid: false }`
- 기본 → `{ isLoggedIn: false, isPaid: false }`
- 유료 콘텐츠 노출은 `isPaid`만으로 판단(로그인 여부는 향후 확장용).

## 5. 페이지 & 컴포넌트 구조

`src/app/report/page.tsx` (기존 자리표시자 대체) — **서버 컴포넌트**, `async`. Next 16 규약: `searchParams`는 `Promise`이므로 `await` 후 `getReportAccess()`에 전달. 픽스처 로드 → `<ReportView>`에 `content`, `access` 전달.

렌더 순서:
1. `ReportHeader` (sticky 상단 바)
2. `ReportHero`
3. 무료: `PersonalitySection`(+`ChartEvidence`), `OuterInnerSection`, `StrengthsSection`, `CautionsSection`
4. 분기:
   - `access.isPaid` → `EmotionSection`, `RelatingSection`(+궁합 hook), `EnvironmentSection`, `LoveSection`, `CompatibilitySection`, `WealthSection`, `YearlyLuckSection`, `DaeunSection`
   - else → `LockedSections`(05–12 잠금 카드 + 인라인 CTA) + `StickyCta`

### 컴포넌트 목록 (`src/app/report/_components/`)
공용/레이아웃 (서버):
- `ReportView` — 조립 + 게이팅 분기
- `ReportHeader`, `ReportHero`, `SectionHeading`(eyebrow `05 · …` + h2)
- `InfoCard`(label+body), `CardGrid`(auto-fit minmax 그리드), `NoteCard`(회색 요약/TIP 박스)

무료 섹션:
- `PersonalitySection`(서버) + `ChartEvidence`(**client** — collapse 토글)
- `OuterInnerSection`, `StrengthsSection`, `CautionsSection`(서버)

잠금:
- `LockedSections`(서버), `StickyCta`(**client** — scroll 리스너, `scrollY>500` & 인라인 CTA 비가시 시 노출)

유료 섹션 (서버):
- `EmotionSection`, `RelatingSection`, `EnvironmentSection`, `LoveSection`, `CompatibilitySection`, `WealthSection`, `YearlyLuckSection`, `DaeunSection`

**클라이언트 경계 최소화:** 상호작용이 있는 `ChartEvidence`, `StickyCta`만 `"use client"`. 나머지는 서버 컴포넌트.

## 6. 스타일링

- Tailwind v4, `globals.css` 토큰 재사용.
  - 오행 5색: 기존 `--color-wood/fire/earth/metal/water` (+`-soft`/`-ink`) 토큰이 원국·오행 색과 정확히 일치.
  - 파란 CTA/강조: `--color-accent*`.
  - `#E2E8F0`/`#94A3B8`/`#F8FAFC`/`#F1F5F9`/`#334155`/`#0F172A` 등은 표준 slate → `slate-*` 유틸.
- 레이아웃: `max-width:720px` 중앙, `clamp()` 패딩/폰트는 임의값 유틸(`px-[clamp(...)]`) 또는 근사 유틸로 픽셀 충실 재현.
- `word-break:keep-all`, `text-wrap:pretty/balance` 등 디자인의 타이포 디테일 유지.

## 7. 상호작용 상세

- `ChartEvidence`: `useState`로 open 토글. 닫힘 시 대시 보더 버튼만, 열림 시 원국/오행/음양/강약/십성·신살·용신/대운/디스클레이머 패널.
- `StickyCta`: `useEffect`로 scroll 리스너 등록/해제. 인라인 CTA에 `ref` 부여, 화면에 보이면 고정 바 숨김(디자인 로직 동일).

## 8. 테스트

프로젝트에 vitest는 있으나 **React DOM 테스트 셋업 없음**(testing-library/jsdom 미설치). 따라서 순수 로직만 TDD:
- `access.test.ts` — `getReportAccess` 쿼리 파싱 (paid/login/기본/배열 값 방어).
- 파생 헬퍼가 생기면 함께: 오행 막대 % (`count/max`), 강약 %, 축 점 위치 클램프 등.

컴포넌트 시각 검증은 `/run`(dev 서버 + `?paid=true`/기본 비교)으로 수행. DOM 테스트 인프라 도입은 비범위.

## 9. 파일 요약

```
src/app/report/
  page.tsx                       # 서버, async, searchParams → access → ReportView
  _lib/
    report-content.ts            # ReportContent + 프리미티브 타입
    report-content.fixture.ts    # 디자인 콘텐츠 시드
    access.ts                    # getReportAccess seam
    access.test.ts
  _components/
    ReportView.tsx
    ReportHeader.tsx  ReportHero.tsx  SectionHeading.tsx
    InfoCard.tsx  CardGrid.tsx  NoteCard.tsx
    PersonalitySection.tsx  ChartEvidence.tsx (client)
    OuterInnerSection.tsx  StrengthsSection.tsx  CautionsSection.tsx
    LockedSections.tsx  StickyCta.tsx (client)
    EmotionSection.tsx  RelatingSection.tsx  EnvironmentSection.tsx
    LoveSection.tsx  CompatibilitySection.tsx  WealthSection.tsx
    YearlyLuckSection.tsx  DaeunSection.tsx
docs/superpowers/specs/2026-07-24-report-page-design.md
```

## 10. 향후 확장 seam (문서화만)

- `access.ts` → 실제 세션/결제 조회.
- `report-content.fixture.ts` → `SajuAnalysis`(계산값) + 확장된 `Interpretation`(LLM 서술)로부터 빌드하는 매퍼. `types.ts` 주석의 확장 목록(personality/career/wealth/love/marriage/yongsin/daeun)이 본 뷰모델과 대응.
- `ChartEvidence` 필드 주석에 `SajuAnalysis` 매핑 근거 명시.
```
