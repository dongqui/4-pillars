# 사주 리포트 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/report` 페이지를 구현한다 — 무료(비로그인/미결제) 사용자는 섹션 01–04 + 05–12 잠금 목록을, 유료 사용자는 05–12 실제 콘텐츠까지 본다.

**Architecture:** 서버 컴포넌트 `page.tsx`가 `getReportAccess(searchParams)`로 권한을 판정하고 픽스처 `ReportContent`를 로드해 `<ReportView>`에 전달한다. 섹션은 presentational 컴포넌트로 분해하고, 상호작용(근거 패널 collapse, 스크롤 고정 CTA)만 client 컴포넌트로 격리한다. 라이브 API/결제 연동은 없으며 게이팅·데이터는 교체 가능한 seam으로 문서화한다.

**Tech Stack:** Next.js 16.2.10 (App Router, 서버 컴포넌트 기본, `searchParams`는 Promise), React 19, Tailwind CSS v4 (`globals.css` 토큰), TypeScript, vitest.

## Global Constraints

- **Next 16 규약:** `page.tsx`의 `searchParams`/`params`는 `Promise` — 반드시 `await` 후 사용. 페이지는 `async` 서버 컴포넌트.
- **클라이언트 경계 최소화:** `"use client"`는 `ChartEvidence`, `StickyCta`에만. 나머지는 서버 컴포넌트.
- **디자인 픽셀 소스(권위):** `design/project/Saju Result.dc.html`(무료 01–04 + 잠금 05–12), `design/project/Saju Result Archived 05+.dc.html`(유료 05–12). 마크업/색/여백은 이 파일들을 그대로 재현한다.
- **토큰 재사용:** 오행 5색 = `--color-{wood,fire,earth,metal,water}(-soft/-ink)`; 파란 강조/CTA = `--color-accent*`. `#E2E8F0/#94A3B8/#F8FAFC/#F1F5F9/#334155/#0F172A/#64748B/#475569/#CBD5E1` 등은 표준 slate 유틸(`slate-200/400/50/100/700/900/500/600/300`).
- **레이아웃:** 본문 `max-w-[720px] mx-auto`, 좌우 패딩 `px-[clamp(20px,5vw,24px)]`, 섹션 간 `mt-[72px]`. 디자인의 `word-break:keep-all`(`break-keep`), `text-wrap:pretty/balance` 유지.
- **비동작 버튼:** "공유하기", "궁합 보기 →", "전체 결과 보기" CTA는 자리표시자(`type="button"` 또는 `<a href="#">`), 라우팅 없음.
- **콘텐츠 정확도:** 픽스처 문구·숫자는 디자인 파일과 100% 일치.
- **커밋 서명:** 각 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **검증 명령:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

---

### Task 1: 리포트 뷰모델 타입

**Files:**
- Create: `src/app/report/_lib/report-content.ts`

**Interfaces:**
- Produces: `ReportContent`, `ChartEvidence`, `PillarColumn`, `PillarCell`, `ElementCount`, `ElementKey`, `LabeledText`, `TitledText`, `KeyValue`, `AxisRow`, `TimelineRow`, `DaeunRow`, `LockedSectionMeta` (모두 `export`).

- [ ] **Step 1: 타입 파일 작성**

```ts
// src/app/report/_lib/report-content.ts
// 리포트 전용 뷰모델. UI에서 도출. 향후 SajuAnalysis(계산값) + 확장 Interpretation(LLM 서술)에서 채워질 자리.

export type ElementKey = "wood" | "fire" | "earth" | "metal" | "water";

export interface LabeledText { label: string; body: string }
export interface TitledText { title: string; body: string }
export interface KeyValue { label: string; value: string }

export interface AxisRow {
  left: string;
  right: string;
  /** 0–100, 점 위치(%) */
  pos: number;
  /** 강조 방향 */
  lean: "left" | "right";
}

export interface TimelineRow { period: string; title: string; desc: string }
export interface DaeunRow { range: string; title: string; desc: string; now?: boolean }

/** 원국 한 칸(천간 또는 지지) — ← SajuAnalysis.chart */
export interface PillarCell {
  char: string; // 한자 (甲, 子 …)
  ko: string;   // 한글 (갑, 자)
  element: ElementKey;
  tenGod: string; // 십성 (비견 …); 일간 칸은 "일간 · 我"
}
export interface PillarColumn {
  slot: "hour" | "day" | "month" | "year";
  isDayMaster?: boolean;
  stem: PillarCell;
  branch: PillarCell;
}
/** 오행 막대 — ← SajuAnalysis.elements */
export interface ElementCount { element: ElementKey; count: number; max: number }

export type TagTone = "neutral" | "metal" | "fire" | "accent";
export interface EvidenceTag { label: string; tone: TagTone }

/** 01 "근거 자세히 보기" collapse 패널 */
export interface ChartEvidence {
  pillars: PillarColumn[];
  elements: ElementCount[];
  yinYang: { yang: number; yin: number };
  /** ← SajuAnalysis.strength (예: 신강 62%) */
  strength: { level: string; percent: number };
  tags: EvidenceTag[];
  /** ← SajuAnalysis.daeun */
  daeunStrip: { gan: string; age: string; now?: boolean }[];
  disclaimer: string;
}

export interface ReportContent {
  meta: { name: string; birthLine: string };
  headline: string;
  summary: string;
  keywords: string[];
  personality: TitledText[];       // 01
  evidence: ChartEvidence;          // 01 근거
  outerVsInner: { outward: string; inner: string }; // 02
  strengths: TitledText[];          // 03
  cautions: string[];               // 04
  cautionTip: string;               // 04 TIP
  emotion: LabeledText[];           // 05
  relating: KeyValue[];             // 06
  environment: { axes: AxisRow[]; summary: string }; // 07
  love: LabeledText[];              // 08
  compatibility: { good: string[]; clash: string[] }; // 09
  wealth: { points: LabeledText[]; summary: string };  // 10
  yearlyLuck: TimelineRow[];        // 11
  daeunOutlook: { rows: DaeunRow[]; summary: string }; // 12
}

/** 무료 사용자에게 보이는 05–12 잠금 목록 항목 */
export interface LockedSectionMeta { no: string; category: string; title: string }
```

- [ ] **Step 2: 타입 컴파일 확인**

Run: `npm run typecheck`
Expected: PASS (신규 파일 타입 에러 없음)

- [ ] **Step 3: 커밋**

```bash
git add src/app/report/_lib/report-content.ts
git commit -m "feat(report): 리포트 뷰모델 타입 정의"
```

---

### Task 2: 게이팅 seam (`getReportAccess`) — TDD

**Files:**
- Create: `src/app/report/_lib/access.ts`
- Test: `src/app/report/_lib/access.test.ts`

**Interfaces:**
- Produces: `interface ReportAccess { isLoggedIn: boolean; isPaid: boolean }`, `function getReportAccess(searchParams: Record<string, string | string[] | undefined>): ReportAccess`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// src/app/report/_lib/access.test.ts
import { describe, it, expect } from "vitest";
import { getReportAccess } from "./access";

describe("getReportAccess", () => {
  it("기본은 비로그인·미결제", () => {
    expect(getReportAccess({})).toEqual({ isLoggedIn: false, isPaid: false });
  });
  it("?paid=true 는 로그인+결제", () => {
    expect(getReportAccess({ paid: "true" })).toEqual({ isLoggedIn: true, isPaid: true });
  });
  it("?login=true 는 로그인·미결제", () => {
    expect(getReportAccess({ login: "true" })).toEqual({ isLoggedIn: true, isPaid: false });
  });
  it("배열 쿼리값도 첫 값으로 처리", () => {
    expect(getReportAccess({ paid: ["true", "false"] })).toEqual({ isLoggedIn: true, isPaid: true });
  });
  it("true 가 아니면 무시", () => {
    expect(getReportAccess({ paid: "1", login: "yes" })).toEqual({ isLoggedIn: false, isPaid: false });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- access`
Expected: FAIL ("getReportAccess" 미정의 / 모듈 없음)

- [ ] **Step 3: 최소 구현**

```ts
// src/app/report/_lib/access.ts
// 리포트 접근 권한. 지금은 쿼리 토글 stub — 향후 세션/결제 조회로 교체하는 유일한 지점.

export interface ReportAccess {
  isLoggedIn: boolean;
  isPaid: boolean;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function getReportAccess(searchParams: SearchParams): ReportAccess {
  const paid = first(searchParams.paid) === "true";
  const login = first(searchParams.login) === "true";
  if (paid) return { isLoggedIn: true, isPaid: true };
  if (login) return { isLoggedIn: true, isPaid: false };
  return { isLoggedIn: false, isPaid: false };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- access`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/app/report/_lib/access.ts src/app/report/_lib/access.test.ts
git commit -m "feat(report): getReportAccess 게이팅 seam (쿼리 토글 stub)"
```

---

### Task 3: 콘텐츠 픽스처

**Files:**
- Create: `src/app/report/_lib/report-content.fixture.ts`

**Interfaces:**
- Consumes: `ReportContent` (Task 1).
- Produces: `export const sampleReport: ReportContent`.

**픽스처 값 출처(정확히 전사):**
- meta/headline/summary/keywords/personality/outerVsInner/strengths/cautions/cautionTip → `design/project/Saju Result.dc.html` L36–231.
- evidence(원국·오행·음양·강약·태그·대운 strip·disclaimer) → 같은 파일 L81–172, 대운 strip은 스크립트 L345–354(`daeunDefs`, 6칸, `丙戌 32–41` now).
- emotion → Archived L24–46; relating → L48–58; environment(axes+summary) → L69–89(축 4개는 스크립트 L222–232); love → L91–113; compatibility → L115–137; wealth → L139–156; yearlyLuck → 스크립트 L233–246(12개); daeunOutlook → 스크립트 L247–258(3개, 첫 항목 now) + 요약 L191–193.

- [ ] **Step 1: 픽스처 작성 (디자인 값 전사)**

```ts
// src/app/report/_lib/report-content.fixture.ts
import type { ReportContent } from "./report-content";

export const sampleReport: ReportContent = {
  meta: { name: "홍길동", birthLine: "양력 1990.02.20 04:30 · 갑자일주" },
  headline: "겉으로는 차분하지만, 자신만의 기준과 승부욕이 강한 사람",
  summary: "사람들과 잘 어울리지만, 혼자 생각을 정리하는 시간이 꼭 필요한 타입이에요.",
  keywords: ["신중한 관찰자", "독립적인 판단", "강한 책임감", "느린 속마음", "오래 밀고 나감"],
  personality: [
    { title: "신중한 관찰자", body: "일간 갑목이 인월의 단단한 뿌리 위에 서 있어, 상황을 먼저 파악한 뒤 움직이는 힘이 강해요. 말보다 판단이 앞서는 이유예요." },
    { title: "독립적인 판단", body: "비견이 두 개로 자기 기준이 뚜렷해요. 남의 의견은 듣지만, 최종 결정은 스스로 내려야 마음이 편한 편이에요." },
    { title: "한번 정하면 오래 밀고 나감", body: "정인이 일간을 꾸준히 받쳐주는 구조라, 방향이 정해지면 쉽게 흔들리지 않아요. 다만 방향을 정하기까지가 오래 걸리죠." },
  ],
  evidence: {
    pillars: [
      { slot: "hour", stem: { char: "丙", ko: "병", element: "fire", tenGod: "식신" }, branch: { char: "寅", ko: "인", element: "wood", tenGod: "비견" } },
      { slot: "day", isDayMaster: true, stem: { char: "甲", ko: "갑", element: "wood", tenGod: "일간 · 我" }, branch: { char: "子", ko: "자", element: "water", tenGod: "정인" } },
      { slot: "month", stem: { char: "戊", ko: "무", element: "earth", tenGod: "편재" }, branch: { char: "寅", ko: "인", element: "wood", tenGod: "비견" } },
      { slot: "year", stem: { char: "庚", ko: "경", element: "metal", tenGod: "편관" }, branch: { char: "午", ko: "오", element: "fire", tenGod: "상관" } },
    ],
    elements: [
      { element: "wood", count: 3, max: 3 },
      { element: "fire", count: 2, max: 3 },
      { element: "earth", count: 1, max: 3 },
      { element: "metal", count: 1, max: 3 },
      { element: "water", count: 1, max: 3 },
    ],
    yinYang: { yang: 5, yin: 3 },
    strength: { level: "신강", percent: 62 },
    tags: [
      { label: "비견 ×2", tone: "neutral" }, { label: "식신", tone: "neutral" },
      { label: "편재", tone: "neutral" }, { label: "편관", tone: "neutral" },
      { label: "정인", tone: "neutral" }, { label: "상관", tone: "neutral" },
      { label: "용신 · 금 金", tone: "metal" }, { label: "희신 · 화 火", tone: "fire" },
      { label: "역마살", tone: "accent" }, { label: "화개살", tone: "accent" },
    ],
    daeunStrip: [
      { gan: "甲申", age: "12–21세" }, { gan: "乙酉", age: "22–31세" },
      { gan: "丙戌", age: "32–41세", now: true }, { gan: "丁亥", age: "42–51세" },
      { gan: "戊子", age: "52–61세" }, { gan: "己丑", age: "62–71세" },
    ],
    disclaimer: "위 요소들은 개별 점수가 아니라 서로의 관계 속에서 종합적으로 해석되며, 이 리포트의 모든 결과는 이 원국 데이터를 근거로 작성되었습니다. 특정 오행이 적다는 것만으로 좋고 나쁨을 단정하지 않습니다.",
  },
  outerVsInner: {
    outward: "침착하고 단단한 사람. 감정 기복이 적고, 맡은 일은 조용히 끝까지 해내는 믿음직한 인상을 줘요.",
    inner: "관계와 선택을 오래 고민하는 편. 결정 전에 수많은 경우의 수를 혼자 돌려보느라, 겉보다 속이 훨씬 바빠요.",
  },
  strengths: [
    { title: "복잡한 상황의 핵심을 빠르게 파악해요", body: "회의가 산으로 갈 때 \"그래서 결정할 건 이거죠\"라고 정리하는 쪽이에요." },
    { title: "쉽게 흔들리지 않고 끝까지 책임져요", body: "중간에 상황이 나빠져도 맡은 몫은 마무리하고 나오는 타입이에요." },
    { title: "사람의 분위기와 감정을 잘 읽어요", body: "말하지 않아도 상대의 컨디션 변화를 먼저 알아차리는 경우가 많아요." },
  ],
  cautions: [
    "충분히 잘하고 있어도 스스로 만족하지 못할 수 있어요. 기준이 늘 자기 자신이라, 남의 인정이 와도 잘 안 쌓여요.",
    "싫은 것을 바로 말하지 않고 참다가, 어느 순간 한 번에 거리를 두는 경향이 있어요. 상대는 이유를 모른 채 멀어졌다고 느낄 수 있어요.",
  ],
  cautionTip: "완벽하게 정리된 뒤 말하려 하기보다, 생각이 60%쯤 정리됐을 때 먼저 표현해 보세요. 관계도 일도 훨씬 가벼워져요.",
  emotion: [
    { label: "스트레스가 쌓이는 상황", body: "내 뜻대로 할 수 없는 상황이 계속될 때. 특히 결정권 없이 책임만 지는 구조에서 크게 소모돼요." },
    { label: "감정을 처리하는 방식", body: "즉시 표현하기보다 일단 안으로 접어두는 편. 정리가 끝난 뒤에야 담담하게 말로 꺼내요." },
    { label: "회복에 필요한 환경", body: "혼자 생각을 정리할 시간과 명확한 선택권. 이 둘이 주어지면 회복이 빠른 편이에요." },
    { label: "힘들 때 보이는 신호", body: "말수가 줄고 약속을 미뤄요. 연락이 뜸해지면 화난 게 아니라 정리 중일 가능성이 높아요." },
  ],
  relating: [
    { label: "처음 만날 때", value: "거리를 두고 관찰부터. 먼저 다가가기보다 상대를 파악한 뒤 마음을 열어요." },
    { label: "가까워지는 방식", value: "한 번에 훅 가까워지기보다, 신뢰가 쌓일 때마다 한 단계씩 깊어져요." },
    { label: "신뢰의 기준", value: "말보다 행동의 일관성. 약속을 지키는 사람에게만 속마음을 보여줘요." },
    { label: "갈등이 생기면", value: "그 자리에서 부딪히기보다 시간을 두고 정리한 뒤 대화를 시도해요." },
    { label: "애정 표현", value: "말보다 챙김으로. 기억해뒀다가 필요한 걸 먼저 해주는 방식이에요." },
  ],
  environment: {
    axes: [
      { left: "자유도 높은 환경", right: "체계적인 환경", pos: 24, lean: "left" },
      { left: "혼자 집중하는 일", right: "사람과 협력하는 일", pos: 38, lean: "left" },
      { left: "안정적인 반복", right: "빠른 변화", pos: 62, lean: "right" },
      { left: "앞에서 이끄는 역할", right: "뒤에서 설계하는 역할", pos: 72, lean: "right" },
    ],
    summary: "정해진 방식만 반복하는 환경보다, 스스로 판단하고 개선할 여지가 있는 환경에서 능력이 잘 드러나요.",
  },
  love: [
    { label: "관계가 시작될 때", body: "호감이 있어도 먼저 표현하지 않는 편. 상대가 다가와야 마음을 확인하고 움직여요." },
    { label: "깊어지는 과정", body: "천천히, 그러나 한번 마음을 열면 오래 가요. 얕은 만남을 여러 번 하기보다 깊은 관계 하나를 택하는 유형이에요." },
    { label: "반복되는 갈등 지점", body: "서운함을 말하지 않고 쌓아두다 한 번에 터지는 패턴. 상대는 갑작스럽다고 느끼기 쉬워요." },
    { label: "관계가 끝난 뒤", body: "미련을 오래 두기보다 스스로 정리한 뒤 깔끔하게 끝내요. 다만 정리까지의 시간이 긴 편이에요." },
  ],
  compatibility: {
    good: ["말과 행동이 일치하고 약속을 지키는 사람", "혼자만의 시간을 존중해 주는 사람", "감정보다 대화로 갈등을 푸는 사람"],
    clash: ["즉흥적으로 계획을 바꾸는 사람", "감정을 즉시 표출하고 즉답을 요구하는 사람", "사생활의 경계를 자주 넘는 사람"],
  },
  wealth: {
    points: [
      { label: "돈이 모이는 방식", body: "한 번에 크게 벌기보다 꾸준히 쌓는 구조가 맞아요. 전문성이 깊어질수록 수입이 계단식으로 올라가는 흐름이에요." },
      { label: "새어나가는 지점", body: "평소엔 아끼다가 스트레스가 쌓였을 때 한 번에 크게 쓰는 패턴. 지출의 총량보다 타이밍이 문제예요." },
    ],
    summary: "투자는 단기 매매보다 긴 호흡의 적립식이 사주 구조와 잘 맞아요.",
  },
  yearlyLuck: [
    { period: "8월", title: "정리", desc: "미뤄둔 결정을 끝내기 좋은 달. 벌이기보다 마무리가 유리해요." },
    { period: "9월", title: "전환", desc: "흐름이 바뀌는 달. 작은 변화의 신호를 놓치지 마세요." },
    { period: "10월", title: "인연", desc: "새 사람과 제안이 들어와요. 만남을 피하지 않는 게 좋아요." },
    { period: "11월", title: "연결", desc: "관계에서 시작된 기회가 일로 이어지는 흐름이에요." },
    { period: "12월", title: "준비", desc: "내년 상반기를 설계하는 달. 계획을 구체화하세요." },
    { period: "2027년 1월", title: "시동", desc: "운이 오르기 시작해요. 준비한 일을 꺼내기 좋은 타이밍이에요." },
    { period: "2월", title: "상승", desc: "한 해 중 가장 운이 강한 구간의 시작. 새로운 시도는 지금." },
    { period: "3월", title: "확장", desc: "벌인 일이 커지는 달. 다만 계약과 문서는 꼼꼼히 확인하세요." },
    { period: "4월", title: "성과", desc: "상반기 노력의 결과가 눈에 보이기 시작해요." },
    { period: "5월", title: "조정", desc: "속도를 한 템포 줄이는 달. 무리한 확장보다 다지기가 유리해요." },
    { period: "6월", title: "점검", desc: "건강과 체력을 챙길 때. 컨디션 관리가 운을 지켜요." },
    { period: "7월", title: "수확", desc: "1년의 흐름을 정리하고 성과를 거두는 달이에요." },
  ],
  daeunOutlook: {
    rows: [
      { range: "현재 대운 · ~2028", title: "기반을 쌓는 10년", desc: "실력과 신뢰를 축적하는 구간이에요. 눈에 띄는 성과보다 토대가 만들어지는 시기예요.", now: true },
      { range: "다음 대운 · 2029~2038", title: "쌓은 것이 드러나는 10년", desc: "축적된 역량이 인정과 성과로 전환돼요. 역할과 위치가 크게 바뀔 수 있는 구간이에요." },
      { range: "그다음 대운 · 2039~", title: "확장과 안정의 10년", desc: "이룬 것을 넓히고 지키는 흐름. 재물운이 가장 안정적으로 자리 잡는 시기예요." },
    ],
    summary: "지금은 기반을 쌓는 구간의 후반부예요. 앞으로 2~3년의 선택이 다음 10년의 방향을 정해요.",
  },
};

/** 무료 사용자용 05–12 잠금 목록 (Saju Result.dc.html L233–290) */
export const lockedSections: import("./report-content").LockedSectionMeta[] = [
  { no: "05", category: "감정과 스트레스", title: "힘들 때 이런 패턴이 나타나요" },
  { no: "06", category: "사람을 대하는 방식", title: "관계에서의 나" },
  { no: "07", category: "잘 맞는 환경", title: "능력이 잘 드러나는 조건" },
  { no: "08", category: "연애와 관계", title: "연애할 때 반복되는 관계 패턴" },
  { no: "09", category: "궁합", title: "당신과 잘 맞는 사람의 특징" },
  { no: "10", category: "재물", title: "돈이 모이는 방식과 새어나가는 지점" },
  { no: "11", category: "올해의 운", title: "지금부터 1년, 나의 운의 흐름" },
  { no: "12", category: "대운", title: "앞으로 10년의 큰 운 흐름" },
];
```

- [ ] **Step 2: 타입 정합 확인**

Run: `npm run typecheck`
Expected: PASS (`sampleReport`가 `ReportContent`에 부합)

- [ ] **Step 3: 커밋**

```bash
git add src/app/report/_lib/report-content.fixture.ts
git commit -m "feat(report): 디자인 콘텐츠 픽스처"
```

---

### Task 4: 공용 프리미티브 컴포넌트

**Files:**
- Create: `src/app/report/_components/SectionHeading.tsx`, `InfoCard.tsx`, `CardGrid.tsx`, `NoteCard.tsx`

**Interfaces:**
- Produces (모두 서버 컴포넌트, named export):
  - `SectionHeading({ no, category, title }: { no: string; category: string; title: string })` — eyebrow(`{no} · {category}`) + `<h2>{title}</h2>`.
  - `InfoCard({ label, children }: { label: string; children: React.ReactNode })` — 라벨 헤더 + 본문 카드.
  - `CardGrid({ children }: { children: React.ReactNode })` — `grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3`.
  - `NoteCard({ children, tip }: { children: React.ReactNode; tip?: boolean })` — 회색 요약 박스(디자인 `#F8FAFC`+`#E2E8F0`). `tip` 시 좌측 TIP 배지.

**픽셀 소스:** eyebrow/h2 = Result L52–53; InfoCard(카드) = Archived L29–32; CardGrid = Archived L28; NoteCard = Archived L86–88, TIP 배지 = Result L226–229.

- [ ] **Step 1: 네 파일 작성**

각 컴포넌트는 위 디자인 라인의 인라인 스타일을 Tailwind로 옮긴다. 매핑 규칙:
- 카드 테두리 `border border-slate-200 rounded-[14px] px-5 py-[18px]`.
- 라벨 `text-[13px] font-bold text-slate-400 mb-1.5`.
- 본문 `text-sm text-slate-700 leading-[1.65] break-keep [text-wrap:pretty]`.
- eyebrow `text-xs font-bold tracking-[0.08em] text-slate-400 mb-2`; h2 `text-[clamp(20px,4vw,24px)] font-bold tracking-[-0.02em] mb-5`.
- NoteCard `bg-slate-50 border border-slate-200 rounded-[14px] px-5 py-4`; 본문 `text-sm text-slate-600 leading-[1.65]`; TIP 배지 `text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-[9px] py-1 rounded-full`.

```tsx
// src/app/report/_components/SectionHeading.tsx
export function SectionHeading({ no, category, title }: { no: string; category: string; title: string }) {
  return (
    <>
      <div className="text-xs font-bold tracking-[0.08em] text-slate-400 mb-2">{no} · {category}</div>
      <h2 className="text-[clamp(20px,4vw,24px)] font-bold tracking-[-0.02em] m-0 mb-5">{title}</h2>
    </>
  );
}
```

```tsx
// src/app/report/_components/InfoCard.tsx
export function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-[14px] px-5 py-[18px]">
      <div className="text-[13px] font-bold text-slate-400 mb-1.5">{label}</div>
      <p className="text-sm text-slate-700 leading-[1.65] m-0 break-keep [text-wrap:pretty]">{children}</p>
    </div>
  );
}
```

```tsx
// src/app/report/_components/CardGrid.tsx
export function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">{children}</div>;
}
```

```tsx
// src/app/report/_components/NoteCard.tsx
export function NoteCard({ children, tip }: { children: React.ReactNode; tip?: boolean }) {
  return (
    <div className={`bg-slate-50 border border-slate-200 rounded-[14px] px-5 py-4 mt-3 ${tip ? "flex gap-3 items-start" : ""}`}>
      {tip && (
        <span className="flex-none text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-[9px] py-1 rounded-full mt-px">TIP</span>
      )}
      <p className="text-sm text-slate-600 leading-[1.65] m-0 break-keep [text-wrap:pretty]">{children}</p>
    </div>
  );
}
```

- [ ] **Step 2: 타입/린트 확인**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/app/report/_components/SectionHeading.tsx src/app/report/_components/InfoCard.tsx src/app/report/_components/CardGrid.tsx src/app/report/_components/NoteCard.tsx
git commit -m "feat(report): 공용 프리미티브(SectionHeading/InfoCard/CardGrid/NoteCard)"
```

---

### Task 5: 헤더 & Hero

**Files:**
- Create: `src/app/report/_components/ReportHeader.tsx`, `ReportHero.tsx`

**Interfaces:**
- Consumes: `ReportContent["meta"]`, `headline`, `summary`, `keywords`.
- Produces: `ReportHeader()` (인자 없음), `ReportHero({ meta, headline, summary, keywords })`.

**픽셀 소스:** 헤더 = Result L24–32(sticky, `bg-white/92 backdrop-blur`, 로고 26px 사각 `bg-slate-900` "사", "사주 리포트", "공유하기" 버튼). Hero = Result L37–47(중앙정렬, mono birthLine, `text-[clamp(26px,5.5vw,36px)]` headline, summary, 키워드 pill `bg-slate-100 rounded-full`).

- [ ] **Step 1: 두 파일 작성**

```tsx
// src/app/report/_components/ReportHeader.tsx
export function ReportHeader() {
  return (
    <header className="sticky top-0 z-20 bg-white/[0.92] backdrop-blur-[8px] border-b border-slate-100">
      <div className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] py-[14px] flex items-center justify-between gap-3">
        <div className="flex items-center gap-[9px]">
          <div className="w-[26px] h-[26px] rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-[13px]">사</div>
          <span className="font-bold text-[15px] tracking-[-0.01em]">사주 리포트</span>
        </div>
        <button type="button" className="text-[13px] font-semibold text-slate-700 bg-white border border-slate-200 px-[14px] py-2 rounded-[10px] cursor-pointer hover:bg-slate-50">공유하기</button>
      </div>
    </header>
  );
}
```

```tsx
// src/app/report/_components/ReportHero.tsx
import type { ReportContent } from "../_lib/report-content";

type Props = Pick<ReportContent, "headline" | "summary" | "keywords"> & { meta: ReportContent["meta"] };

export function ReportHero({ meta, headline, summary, keywords }: Props) {
  return (
    <section className="text-center">
      <div className="text-[13px] text-slate-400 font-mono">{meta.name} · {meta.birthLine}</div>
      <h1 className="text-[clamp(26px,5.5vw,36px)] font-bold tracking-[-0.03em] leading-[1.35] mt-[18px] mx-auto max-w-[560px] [text-wrap:balance] break-keep">{headline}</h1>
      <p className="text-[clamp(15px,2.5vw,16px)] text-slate-500 mt-4 mx-auto max-w-[440px] [text-wrap:pretty] break-keep">{summary}</p>
      <div className="flex flex-wrap justify-center gap-2 mt-[26px]">
        {keywords.map((k) => (
          <span key={k} className="text-[13px] font-semibold text-slate-700 bg-slate-100 px-[13px] py-1.5 rounded-full">{k}</span>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 타입/린트 확인**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/app/report/_components/ReportHeader.tsx src/app/report/_components/ReportHero.tsx
git commit -m "feat(report): 헤더 & Hero 섹션"
```

---

### Task 6: 근거 패널 `ChartEvidence` (client, collapse)

**Files:**
- Create: `src/app/report/_components/ChartEvidence.tsx`

**Interfaces:**
- Consumes: `ChartEvidence` 타입 (Task 1).
- Produces: `"use client"` 컴포넌트 `ChartEvidence({ evidence }: { evidence: ChartEvidenceType })`.

**픽셀 소스:** 토글 버튼 = Result L70–76, 패널 = L79–172. 오행 5색은 `element` → 토큰 매핑:
```ts
const EL: Record<ElementKey, { soft: string; ink: string; bar: string; ko: string; han: string }> = {
  wood:  { soft: "bg-wood-soft",  ink: "text-wood-ink",  bar: "bg-wood",  ko: "목", han: "木" },
  fire:  { soft: "bg-fire-soft",  ink: "text-fire-ink",  bar: "bg-fire",  ko: "화", han: "火" },
  earth: { soft: "bg-earth-soft", ink: "text-earth-ink", bar: "bg-earth", ko: "토", han: "土" },
  metal: { soft: "bg-metal-soft", ink: "text-metal-ink", bar: "bg-metal", ko: "금", han: "金" },
  water: { soft: "bg-water-soft", ink: "text-water-ink", bar: "bg-water", ko: "수", han: "水" },
};
```
(위 클래스명은 `globals.css`의 `--color-wood-soft` 등 토큰에서 Tailwind v4가 생성.)

- [ ] **Step 1: 컴포넌트 작성**

구조: `useState(false)` open. 닫힘 시 대시 보더 토글 버튼만. 열림 시 패널:
1. **원국 grid** — `grid grid-cols-4 gap-2`. 각 `PillarColumn`: 슬롯 라벨(시/일/월/년, 일주는 accent) → 천간 십성 → 천간 셀(`EL[el].soft`/`EL[el].ink`, 일주 천간은 `ring-2 ring-accent`) → 지지 셀 → 지지 십성.
2. **오행 분포** — 각 `ElementCount`: 라벨 `{ko} {han}`(`EL.ink`), 트랙 `bg-slate-100`, 채움 `EL.bar` 폭 `${count/max*100}%`, 우측 count.
3. **음양** — `yang/(yang+yin)*100`% 앰버, 나머지 slate-700.
4. **강약** — `strength.percent`% 그라디언트 바 + `신강 62%` 라벨.
5. **태그 칩** — `tags`: tone별 색(neutral=slate-100/700, metal=metal-soft/ink, fire=fire-soft/ink, accent=accent-50/accent).
6. **대운 strip** — `overflow-x-auto`, `min-w-[480px]`, 각 칸 `now`면 accent 링/텍스트.
7. **disclaimer** — `NoteCard` 유사 회색 박스, `text-[12.5px] text-slate-400`.

폭 계산 헬퍼(순수 함수, 파일 상단):
```ts
function pct(n: number, d: number): string { return `${d > 0 ? Math.round((n / d) * 100) : 0}%`; }
```
막대/음양 채움 폭은 `style={{ width: pct(count, max) }}` 인라인 스타일로 적용(동적 값이라 Tailwind 임의값 대신 style 사용).

전체 마크업은 Result L79–172의 인라인 스타일을 위 Tailwind 매핑으로 1:1 이식한다. 토글 버튼 우측 chevron은 `open`에 따라 `rotate-180`.

- [ ] **Step 2: 타입/린트 확인**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/app/report/_components/ChartEvidence.tsx
git commit -m "feat(report): 근거 패널 ChartEvidence (collapse, 오행 토큰)"
```

---

### Task 7: 무료 섹션 (01–04)

**Files:**
- Create: `src/app/report/_components/PersonalitySection.tsx`, `OuterInnerSection.tsx`, `StrengthsSection.tsx`, `CautionsSection.tsx`

**Interfaces:**
- Consumes: `SectionHeading`, `InfoCard`(미사용 가능), `CardGrid`, `NoteCard`, `ChartEvidence`; 픽스처 필드.
- Produces (서버 컴포넌트):
  - `PersonalitySection({ items, evidence }: { items: TitledText[]; evidence: ChartEvidence })`
  - `OuterInnerSection({ data }: { data: { outward: string; inner: string } })`
  - `StrengthsSection({ items }: { items: TitledText[] })`
  - `CautionsSection({ cautions, tip }: { cautions: string[]; tip: string })`

**픽셀 소스:** 01 = Result L51–177(카드 3 + 근거 토글). 02 = L180–193(2열 회색 카드). 03 = L196–213(번호 리스트, 파란 번호 배지). 04 = L216–231(단락 카드 + TIP NoteCard).

- [ ] **Step 1: 네 파일 작성**

- `PersonalitySection`: `<section className="mt-[72px]">` → `SectionHeading no="01" category="핵심 성향" title="이렇게 보이는 데는 이유가 있어요"` → `flex flex-col gap-3` 카드들(각 `TitledText`: `text-[15px] font-bold mb-1` 제목 + `text-sm text-slate-600 leading-[1.65]` 본문) → `<ChartEvidence evidence={evidence} />`.
- `OuterInnerSection`: `SectionHeading no="02" category="겉과 속" title="남이 보는 나 vs 실제 내면"` → `CardGrid`에 회색 카드 2개("남에게 보이는 모습" outward / "실제 내면" inner). 회색 카드 = `bg-slate-50 border border-slate-200 rounded-2xl p-[22px]`.
- `StrengthsSection`: `SectionHeading no="03" category="타고난 강점" title="이런 순간에 빛나요"` → 테두리 컨테이너 `border border-slate-200 rounded-2xl overflow-hidden`, 각 행 `flex gap-4 px-[22px] py-5` + 마지막 제외 `border-b border-slate-100`, 좌측 번호 배지 `w-8 h-8 rounded-[10px] bg-accent-50 text-accent`.
- `CautionsSection`: `SectionHeading no="04" category="주의할 패턴" title="나도 모르게 반복하는 것들"` → `flex flex-col gap-3`, 각 `cautions` 문단 카드(`border border-slate-200 rounded-[14px] px-5 py-[18px]`, `text-[15px] text-slate-700 leading-[1.7]`) + `<NoteCard tip>{tip}</NoteCard>`.

- [ ] **Step 2: 타입/린트 확인**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/app/report/_components/PersonalitySection.tsx src/app/report/_components/OuterInnerSection.tsx src/app/report/_components/StrengthsSection.tsx src/app/report/_components/CautionsSection.tsx
git commit -m "feat(report): 무료 섹션 01–04"
```

---

### Task 8: 유료 섹션 (05–12)

**Files:**
- Create: `src/app/report/_components/EmotionSection.tsx`, `RelatingSection.tsx`, `EnvironmentSection.tsx`, `LoveSection.tsx`, `CompatibilitySection.tsx`, `WealthSection.tsx`, `YearlyLuckSection.tsx`, `DaeunSection.tsx`

**Interfaces:**
- Consumes: `SectionHeading`, `InfoCard`, `CardGrid`, `NoteCard`; 픽스처 필드.
- Produces (서버 컴포넌트):
  - `EmotionSection({ items }: { items: LabeledText[] })`
  - `RelatingSection({ rows }: { rows: KeyValue[] })`
  - `EnvironmentSection({ axes, summary }: { axes: AxisRow[]; summary: string })`
  - `LoveSection({ items }: { items: LabeledText[] })`
  - `CompatibilitySection({ good, clash }: { good: string[]; clash: string[] })`
  - `WealthSection({ points, summary }: { points: LabeledText[]; summary: string })`
  - `YearlyLuckSection({ rows }: { rows: TimelineRow[] })`
  - `DaeunSection({ rows, summary }: { rows: DaeunRow[]; summary: string })`

**픽셀 소스(Archived):** 05 L24–46; 06 L48–67(KeyValue 행 목록 + 궁합 hook `bg-slate-900` 다크 배너); 07 L69–89(축 슬라이더); 08 L91–113; 09 L115–137(good=파란 카드/clash=회색 카드, `<ul>`); 10 L139–156; 11 L158–170(period 128px + 굵은 title — desc); 12 L172–194(타임라인: 점+세로선, now=accent 링).

- [ ] **Step 1: 여덟 파일 작성 (섹션별 매핑)**

각 파일은 `<section className="mt-[72px]">` + `SectionHeading` + 아래 본문. 반복 데이터는 `.map`, `key`는 라벨/제목 등 안정 값.

- `EmotionSection` (05 · 감정과 스트레스 / "힘들 때 이런 패턴이 나타나요"): `CardGrid`에 `items`를 `<InfoCard label={it.label}>{it.body}</InfoCard>`.
- `LoveSection` (08 · 연애와 관계 / "연애할 때 반복되는 관계 패턴"): 05와 동일 패턴, `items`.
- `RelatingSection` (06 · 사람을 대하는 방식 / "관계에서의 나"): 테두리 컨테이너 `border border-slate-200 rounded-2xl overflow-hidden`, 각 `KeyValue` 행 `flex flex-wrap gap-x-4 gap-y-1 px-5 py-[17px] items-baseline` + 마지막 제외 `border-b border-slate-100`; 좌 `flex-none w-32 text-[13px] font-semibold text-slate-400`, 우 `flex-1 min-w-[200px] text-sm text-slate-700 leading-[1.6]`. 이어서 **궁합 hook** 배너 `mt-3.5 bg-slate-900 rounded-2xl p-6 flex flex-wrap items-center gap-4`: 좌측 흰 제목 "나와 잘 맞는 사람은 어떤 유형일까요?" + slate-400 설명, 우측 흰 버튼 "궁합 보기 →"(`type="button"`, 비동작).
- `EnvironmentSection` (07 · 잘 맞는 환경 / "능력이 잘 드러나는 조건"): 컨테이너 `border border-slate-200 rounded-2xl px-[22px] pt-[22px] pb-2`, 각 `AxisRow`: 상단 `flex justify-between`에 left/right(강조측 `font-bold text-slate-900`, 반대 `font-medium text-slate-400`), 하단 트랙 `h-1.5 bg-slate-100 rounded-full relative`에 점 `absolute w-4 h-4 rounded-full bg-accent` `style={{ left: `${pos}%` }}` + `-translate-x-1/2 -translate-y-1/2 top-1/2` + `shadow-[0_0_0_3px_#fff,0_0_0_4px_var(--color-accent-200)]`. 이어서 `<NoteCard>{summary}</NoteCard>` (요약의 "스스로 판단하고 개선할 여지가 있는 환경"은 `<strong className="text-slate-900">`; NoteCard가 children으로 JSX를 받으므로 `EnvironmentSection`에서 강조 span을 직접 조립).
- `CompatibilitySection` (09 · 궁합 / "당신과 잘 맞는 사람의 특징"): `CardGrid`에 카드 2개. good 카드 `border border-accent-200 bg-accent-50 rounded-2xl px-[22px] py-5`, 헤더 `text-accent` "잘 맞는 유형", `<ul className="list-disc pl-[18px] ...">`. clash 카드 `border border-slate-200`, 헤더 slate-400 "부딪히기 쉬운 유형".
- `WealthSection` (10 · 재물 / "돈이 모이는 방식과 새어나가는 지점"): `CardGrid`에 `points`를 `InfoCard`(단 라운드 `rounded-2xl`) + `<NoteCard>` summary("긴 호흡의 적립식" strong 강조).
- `YearlyLuckSection` (11 · 올해의 운 / "지금부터 1년, 나의 운의 흐름"): 컨테이너 `border border-slate-200 rounded-2xl overflow-hidden`, 각 `TimelineRow` 행 `flex flex-wrap gap-x-4 gap-y-1 px-5 py-[17px] items-baseline` + `border-b border-slate-100`(마지막 제외 필요시 유지), 좌 period `flex-none w-32 text-[13px] font-semibold text-slate-400`, 우 `flex-1 min-w-[200px] text-sm text-slate-700`에 `<strong className="text-slate-900">{title}</strong> — {desc}`.
- `DaeunSection` (12 · 대운 / "앞으로 10년의 큰 운 흐름"): 컨테이너 `border border-slate-200 rounded-2xl p-[22px] flex flex-col`, 각 `DaeunRow`: `flex gap-4`; 좌측 타임라인 열 `flex-none flex flex-col items-center`(점 `w-2.5 h-2.5 rounded-full` — now면 `bg-accent shadow-[0_0_0_4px_var(--color-accent-100)]` 아니면 `bg-slate-300`; 세로선 `flex-1 w-0.5` — 마지막 행이면 `bg-transparent` 아니면 `bg-slate-200`); 우측 본문 `pb-6`(마지막 `pb-0`): range(slate-400 굵게) / title(slate-900 굵게) / desc. 이어서 `<NoteCard>` summary("기반을 쌓는 구간의 후반부" strong 강조). `now`는 배열 순서상 첫 항목, `last`는 인덱스로 판정.

`pct`/`left` 등 인라인 동적 스타일은 `style={{ ... }}` 사용.

- [ ] **Step 2: 타입/린트 확인**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/app/report/_components/EmotionSection.tsx src/app/report/_components/RelatingSection.tsx src/app/report/_components/EnvironmentSection.tsx src/app/report/_components/LoveSection.tsx src/app/report/_components/CompatibilitySection.tsx src/app/report/_components/WealthSection.tsx src/app/report/_components/YearlyLuckSection.tsx src/app/report/_components/DaeunSection.tsx
git commit -m "feat(report): 유료 섹션 05–12"
```

---

### Task 9: 잠금 목록 `LockedSections` + 고정 CTA `StickyCta`

**Files:**
- Create: `src/app/report/_components/LockedSections.tsx`, `src/app/report/_components/StickyCta.tsx`

**Interfaces:**
- Consumes: `LockedSectionMeta[]` (`lockedSections` 픽스처).
- Produces:
  - `LockedSections({ sections, ctaRef }: { sections: LockedSectionMeta[]; ctaRef?: React.Ref<HTMLAnchorElement> })` (서버 컴포넌트지만 ref는 client 부모가 전달) — **주의:** ref 전달 때문에 `LockedSections`는 client로 두거나, 인라인 CTA를 `StickyCta` 쪽에서 관리. 아래 Step에서 단순화한다.
  - `StickyCta()` — `"use client"`, scroll 리스너로 하단 고정 바 노출.

**픽셀 소스:** 잠금 카드 = Result L234–290(각 `flex justify-between bg-slate-50 border rounded-2xl px-[22px] py-5`, 우측 🔒 원형); 인라인 CTA = L293–296; 고정 바 = L300–307 + 스크립트 L318–330(`scrollY>500` & 인라인 CTA 비가시 시 노출).

- [ ] **Step 1: `LockedSections.tsx` 작성 (client, 인라인 CTA ref 포함)**

`"use client"`로 두고 내부에서 `useRef<HTMLAnchorElement>(null)` 인라인 CTA + scroll 로직까지 한 컴포넌트에 통합(디자인의 `inlineCtaRef` 동작 일치). 즉 `StickyCta`를 별도 파일로 두되 `LockedSections`가 ref를 만들어 `StickyCta`에 넘기는 대신, **하나의 client 컴포넌트 `LockedSections`**가:
1. 잠금 카드 목록 렌더(`sections.map`).
2. 인라인 CTA `<a ref={inlineRef} href="#">전체 결과 보기</a>`.
3. `useState(showBar)` + `useEffect` scroll 리스너: `scrollY>500` 이고 인라인 CTA가 뷰포트 안이면 `false`.
4. `showBar` 시 하단 고정 바 렌더.

→ `StickyCta.tsx`는 만들지 않고 로직을 `LockedSections`에 통합(파일 단순화). Files 목록에서 `StickyCta.tsx` 생성 취소.

```tsx
// src/app/report/_components/LockedSections.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import type { LockedSectionMeta } from "../_lib/report-content";

export function LockedSections({ sections }: { sections: LockedSectionMeta[] }) {
  const inlineRef = useRef<HTMLAnchorElement>(null);
  const [showBar, setShowBar] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      let show = window.scrollY > 500;
      const el = inlineRef.current;
      if (show && el && el.getBoundingClientRect().top < window.innerHeight) show = false;
      setShowBar((prev) => (prev !== show ? show : prev));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <section className="mt-[72px] flex flex-col gap-3">
        {sections.map((s) => (
          <div key={s.no} className="flex items-center justify-between gap-3.5 bg-slate-50 border border-slate-200 rounded-2xl px-[22px] py-5">
            <div>
              <div className="text-xs font-bold tracking-[0.08em] text-slate-400 mb-1">{s.no} · {s.category}</div>
              <div className="text-[15.5px] font-bold text-slate-700">{s.title}</div>
            </div>
            <div className="flex-none w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[13px]">🔒</div>
          </div>
        ))}
        <div className="mt-5 text-center flex flex-col items-center gap-3.5">
          <p className="text-[15px] text-slate-500 m-0 [text-wrap:pretty]">나머지 결과가 궁금하신가요?</p>
          <a ref={inlineRef} href="#" className="block w-full max-w-[360px] text-base font-semibold text-white bg-accent py-4 rounded-[14px] shadow-[0_8px_20px_rgba(37,99,235,.28)] text-center hover:bg-accent-700">전체 결과 보기</a>
        </div>
      </section>
      {showBar && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-[clamp(20px,5vw,24px)] pt-7 pb-[18px] bg-gradient-to-b from-transparent to-white to-[55%] pointer-events-none">
          <div className="max-w-[720px] mx-auto flex justify-center">
            <a href="#" className="pointer-events-auto block w-full max-w-[360px] text-base font-semibold text-white bg-accent py-[15px] rounded-[14px] shadow-[0_8px_20px_rgba(37,99,235,.32)] text-center hover:bg-accent-700">전체 결과 보기</a>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: 타입/린트 확인**

Run: `npm run typecheck && npm run lint`
Expected: PASS

- [ ] **Step 3: 커밋**

```bash
git add src/app/report/_components/LockedSections.tsx
git commit -m "feat(report): 잠금 섹션 목록 + 스크롤 고정 CTA"
```

---

### Task 10: `ReportView` 조립 + `page.tsx` 게이팅 배선

**Files:**
- Create: `src/app/report/_components/ReportView.tsx`
- Modify: `src/app/report/page.tsx` (자리표시자 전체 대체)

**Interfaces:**
- Consumes: 모든 섹션 컴포넌트, `sampleReport`/`lockedSections` 픽스처, `getReportAccess`/`ReportAccess`.
- Produces: `ReportView({ content, access }: { content: ReportContent; access: ReportAccess })` (서버 컴포넌트).

- [ ] **Step 1: `ReportView.tsx` 작성**

```tsx
// src/app/report/_components/ReportView.tsx
import type { ReportContent } from "../_lib/report-content";
import type { ReportAccess } from "../_lib/access";
import { lockedSections } from "../_lib/report-content.fixture";
import { ReportHeader } from "./ReportHeader";
import { ReportHero } from "./ReportHero";
import { PersonalitySection } from "./PersonalitySection";
import { OuterInnerSection } from "./OuterInnerSection";
import { StrengthsSection } from "./StrengthsSection";
import { CautionsSection } from "./CautionsSection";
import { LockedSections } from "./LockedSections";
import { EmotionSection } from "./EmotionSection";
import { RelatingSection } from "./RelatingSection";
import { EnvironmentSection } from "./EnvironmentSection";
import { LoveSection } from "./LoveSection";
import { CompatibilitySection } from "./CompatibilitySection";
import { WealthSection } from "./WealthSection";
import { YearlyLuckSection } from "./YearlyLuckSection";
import { DaeunSection } from "./DaeunSection";

export function ReportView({ content, access }: { content: ReportContent; access: ReportAccess }) {
  return (
    <div className="bg-white min-h-screen text-slate-900 leading-normal break-keep [overflow-wrap:break-word]">
      <ReportHeader />
      <main className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] pt-[clamp(36px,7vw,64px)] pb-24">
        <ReportHero meta={content.meta} headline={content.headline} summary={content.summary} keywords={content.keywords} />
        <PersonalitySection items={content.personality} evidence={content.evidence} />
        <OuterInnerSection data={content.outerVsInner} />
        <StrengthsSection items={content.strengths} />
        <CautionsSection cautions={content.cautions} tip={content.cautionTip} />
        {access.isPaid ? (
          <>
            <EmotionSection items={content.emotion} />
            <RelatingSection rows={content.relating} />
            <EnvironmentSection axes={content.environment.axes} summary={content.environment.summary} />
            <LoveSection items={content.love} />
            <CompatibilitySection good={content.compatibility.good} clash={content.compatibility.clash} />
            <WealthSection points={content.wealth.points} summary={content.wealth.summary} />
            <YearlyLuckSection rows={content.yearlyLuck} />
            <DaeunSection rows={content.daeunOutlook.rows} summary={content.daeunOutlook.summary} />
          </>
        ) : (
          <LockedSections sections={lockedSections} />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: `page.tsx` 대체**

```tsx
// src/app/report/page.tsx
import { getReportAccess } from "./_lib/access";
import { sampleReport } from "./_lib/report-content.fixture";
import { ReportView } from "./_components/ReportView";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const access = getReportAccess(sp);
  return <ReportView content={sampleReport} access={access} />;
}
```

- [ ] **Step 3: 타입/린트/빌드 확인**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS (라우트 `/report` 정적/동적 빌드 성공)

- [ ] **Step 4: 커밋**

```bash
git add src/app/report/_components/ReportView.tsx src/app/report/page.tsx
git commit -m "feat(report): ReportView 조립 + page 게이팅 배선"
```

---

### Task 11: 시각 검증 & 마무리

**Files:** 없음(검증만). 이슈 발견 시 해당 컴포넌트 수정 후 재커밋.

- [ ] **Step 1: 전체 테스트/타입/린트/빌드**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 모두 PASS

- [ ] **Step 2: dev 서버로 세 상태 육안 확인 (`/run` 스킬 사용)**

- `/report` → 무료: 01–04 + 05–12 잠금 카드 8개 + 인라인 CTA, 스크롤 시 하단 고정 바 등장.
- `/report?login=true` → 무료와 동일(로그인만으론 미해금).
- `/report?paid=true` → 05–12 실제 콘텐츠(감정/관계/환경 슬라이더/연애/궁합/재물/올해의 운 12행/대운 타임라인), 잠금·고정바 없음.
- 근거 "자세히 보기" 토글 → 원국 grid·오행 막대·음양·강약·태그·대운 strip 표시.

각 화면을 `design/project/*.dc.html`와 대조해 여백/색/폰트 크기 일치 확인.

- [ ] **Step 3: (이슈 수정 시) 커밋**

```bash
git add -A
git commit -m "fix(report): 시각 검증 후 디자인 정합 보정"
```

---

## Self-Review 결과

- **Spec coverage:** 데이터 모델(Task 1,3) · 게이팅 seam(Task 2,10) · 페이지/컴포넌트(Task 4–10) · 스타일 토큰(Task 4,6) · 잠금 UI(Task 9) · 테스트(Task 2) · Next16 규약(Task 10) · 시각 검증(Task 11) — 스펙 §3–8 전부 대응.
- **Placeholder scan:** "적절한 처리" 류 없음. 컴포넌트 마크업은 디자인 파일 라인 참조(권위 소스)로 명시 — 임의 재량 아님.
- **Type consistency:** `getReportAccess`/`ReportAccess`, `ReportContent`/`sampleReport`, `LockedSectionMeta`/`lockedSections`, 각 섹션 prop 명이 Task 간 일치. `StickyCta` 별도 파일은 Task 9에서 `LockedSections`에 통합하기로 정정(Files 목록의 `StickyCta.tsx`는 생성하지 않음) — §9 파일 요약과의 차이를 여기 명시.
