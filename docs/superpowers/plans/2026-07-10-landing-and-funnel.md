# 랜딩 페이지 + 사주 입력 퍼널 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사주 서비스의 랜딩 페이지(`/`)와 5스텝 입력 퍼널(`/funnel`)을 디자인에 맞게 구현한다.

**Architecture:** Next.js 16 App Router. 도메인 비의존 UI 프리미티브는 `src/components/`에 분리하고, 랜딩·퍼널 전용 컴포넌트/로직은 각 라우트 아래 `_` private 폴더에 co-location한다. 퍼널 스텝은 `?step=` 쿼리스트링으로 히스토리를 쌓고(브라우저 뒤로가기 동작), 입력값은 React Context(메모리)에 저장한다. 새로고침 시 Context가 비면 첫 스텝으로 리다이렉트한다.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Vitest. 폰트는 Pretendard.

## Global Constraints

- **AGENTS.md**: 이 Next.js는 변경이 있을 수 있음. 라우팅/`next/navigation`/`redirect`/`use client` 관련 코드 작성 전 `node_modules/next/dist/docs/`의 해당 가이드를 확인한다. (본 계획은 확인 완료: `useRouter`/`useSearchParams`/`usePathname`는 `next/navigation`에서 import, `router.push`는 히스토리 push, `router.back`은 뒤로가기 — 모두 표준.)
- **디자인 원본**: `design/project/` — `랜딩페이지.dc.html`, `Saju Desktop Funnel.dc.html`, `Saju Funnel mobile.dc.html`, `Saju Design System.dc.html`. 색/간격/라운딩/폰트 수치는 이 파일들을 진실 소스로 삼는다. `.dc.html`의 `x-dc`/`sc-for`/`{{ }}`는 프로토타입 문법이며 복사하지 않는다 — 시각 결과만 재현한다.
- **폰트**: Pretendard. CDN `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css`.
- **디자인 토큰(정확 값, verbatim)**:
  - accent: 50 `#EFF6FF`, 100 `#DBEAFE`, 200 `#BFDBFE`, 400 `#60A5FA`, 500 `#3B82F6`, **600 `#2563EB`(기본)**, 700 `#1D4ED8`
  - 중립 = Tailwind 기본 `slate-*` 스케일과 일치(`#F8FAFC`=slate-50 … `#0F172A`=slate-900) → `slate-*` 유틸 그대로 사용
  - 오행: 목 `#2E9E6B`, 화 `#DC5A4B`, 토 `#C99A3F`, 금 `#8492A6`, 수 `#3E6FB0`
  - 오행 soft 배경/텍스트: 목 `#E7F5EE`/`#1F7A52`, 화 `#FCEAE7`/`#B23A2E`, 토 `#F8EFD9`/`#9A7320`, 금 `#EEF1F6`/`#4F5E73`, 수 `#E8EEF8`/`#2B5288`
  - radius 기본 12px, 카드 16px, 그림자 soft `0 1px 2px rgba(15,23,42,.04),0 1px 3px rgba(15,23,42,.06)` / elevated `0 6px 16px rgba(15,23,42,.08),0 1px 3px rgba(15,23,42,.06)`
- **테마**: 디자인은 라이트 전용. `globals.css`의 기존 `prefers-color-scheme: dark` 블록을 제거하고 라이트 고정(`color-scheme: light`).
- **퍼널 스텝 순서**: `name → gender → birth → time → review` (5개). 제출 후 `analyzing`(스피너) → 리포트 stub.
- **커밋**: 각 Task 끝에서 커밋. 브랜치는 `feat/landing-and-funnel`(이미 생성됨).
- **검증 명령**: `npm run typecheck`, `npm run test`, `npm run lint`, `npm run dev`.

---

## File Structure

```
src/
  components/                    # 도메인 비의존 프리미티브
    Button.tsx
    SegmentedControl.tsx
    Toggle.tsx
    OptionCard.tsx
    ProgressBar.tsx
    Badge.tsx
    WheelPicker.tsx
    DateWheelPicker.tsx
    TimeWheelPicker.tsx
  app/
    layout.tsx                   # 수정: Pretendard 적용
    globals.css                  # 수정: 디자인 토큰 + 라이트 고정
    page.tsx                     # 수정: 랜딩
    _components/                 # 랜딩 전용
      LandingNav.tsx
      Hero.tsx
      ReportPreviewCard.tsx
      KnowSection.tsx
      SampleReport.tsx
      TrustSection.tsx
      FooterCta.tsx
    funnel/
      page.tsx                   # 퍼널 컨테이너(Provider + 가드 + 스텝 스위치 + analyzing)
      _components/
        FunnelLayout.tsx
        Stepper.tsx
        FunnelProgress.tsx
        FunnelFooter.tsx
        AnalyzingScreen.tsx
        steps/
          NameStep.tsx
          GenderStep.tsx
          BirthDateStep.tsx
          BirthTimeStep.tsx
          ReviewStep.tsx
      _context/
        FunnelContext.tsx
      _hooks/
        useFunnelNav.ts
      _lib/
        steps.ts
        steps.test.ts
        date.ts
        date.test.ts
```

---

## Task 1: 디자인 토큰 · Pretendard · 라이트 테마 기반

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Produces: Tailwind 유틸 `bg-accent`/`text-accent`/`bg-accent-50`/`border-accent`, 오행 색 유틸 `text-wood`/`bg-fire-soft` 등, `font-sans`=Pretendard. body 기본 배경 흰색·텍스트 slate-900.

- [ ] **Step 1: `globals.css`를 디자인 토큰으로 교체**

`src/app/globals.css` 전체를 아래로 교체:

```css
@import "tailwindcss";

:root {
  color-scheme: light;
}

@theme inline {
  --font-sans: "Pretendard", "Pretendard Variable", -apple-system, system-ui,
    sans-serif;

  /* accent (primary blue) */
  --color-accent-50: #eff6ff;
  --color-accent-100: #dbeafe;
  --color-accent-200: #bfdbfe;
  --color-accent-400: #60a5fa;
  --color-accent-500: #3b82f6;
  --color-accent-600: #2563eb;
  --color-accent-700: #1d4ed8;
  --color-accent: #2563eb;
  --color-accent-soft: #eff6ff;

  /* five elements */
  --color-wood: #2e9e6b;
  --color-wood-soft: #e7f5ee;
  --color-wood-ink: #1f7a52;
  --color-fire: #dc5a4b;
  --color-fire-soft: #fceae7;
  --color-fire-ink: #b23a2e;
  --color-earth: #c99a3f;
  --color-earth-soft: #f8efd9;
  --color-earth-ink: #9a7320;
  --color-metal: #8492a6;
  --color-metal-soft: #eef1f6;
  --color-metal-ink: #4f5e73;
  --color-water: #3e6fb0;
  --color-water-soft: #e8eef8;
  --color-water-ink: #2b5288;

  /* radii */
  --radius-card: 12px;
  --radius-card-lg: 16px;

  /* shadows */
  --shadow-soft: 0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06);
  --shadow-elevated: 0 6px 16px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.06);
}

body {
  background: #ffffff;
  color: #0f172a;
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
}

/* hide scrollbars for wheel/scroll regions */
.saju-scroll::-webkit-scrollbar {
  width: 0;
  height: 0;
}
.saju-scroll {
  scrollbar-width: none;
}
```

- [ ] **Step 2: `layout.tsx`에서 Geist 제거하고 Pretendard 적용**

`src/app/layout.tsx` 전체를 아래로 교체:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "사주대소",
  description: "생년월일시로 사주 원국을 계산하는 AI 사주 리포트 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: 타입체크·빌드 확인**

Run: `npm run typecheck`
Expected: 에러 없음(exit 0). (`page.tsx`는 아직 기존 내용이지만 컴파일됨)

- [ ] **Step 4: 개발 서버로 폰트/배경 확인**

Run: `npm run dev` 후 `http://localhost:3000` 접속
Expected: 기존 홈 텍스트가 Pretendard로 렌더, 흰 배경. 확인 후 서버 종료.

- [ ] **Step 5: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: 디자인 토큰 + Pretendard 폰트 + 라이트 테마 기반"
```

---

## Task 2: Button 프리미티브

**Files:**
- Create: `src/components/Button.tsx`

**Interfaces:**
- Produces: `Button` — `props: { variant?: 'primary'|'secondary'|'ghost'|'danger'; fullWidth?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>`. 기본 variant `primary`.

- [ ] **Step 1: `Button.tsx` 작성**

디자인 근거: `Saju Design System.dc.html:153-160`(Buttons).

```tsx
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center font-semibold rounded-xl transition-all disabled:cursor-default cursor-pointer";

const variants: Record<Variant, string> = {
  primary:
    "text-white bg-accent shadow-[0_8px_20px_rgba(37,99,235,.28)] hover:opacity-92 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none",
  secondary:
    "text-slate-700 bg-white border border-slate-300 hover:bg-slate-50",
  ghost: "text-slate-600 bg-transparent hover:bg-slate-100",
  danger:
    "text-red-600 bg-red-50 border border-red-200 hover:bg-red-100",
};

export function Button({
  variant = "primary",
  fullWidth,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${
        fullWidth ? "w-full" : ""
      } px-5 py-3 text-[15px] ${className}`}
      {...props}
    />
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/Button.tsx
git commit -m "feat: Button 프리미티브"
```

---

## Task 3: SegmentedControl · Toggle · OptionCard · ProgressBar · Badge 프리미티브

**Files:**
- Create: `src/components/SegmentedControl.tsx`
- Create: `src/components/Toggle.tsx`
- Create: `src/components/OptionCard.tsx`
- Create: `src/components/ProgressBar.tsx`
- Create: `src/components/Badge.tsx`

**Interfaces:**
- Produces:
  - `SegmentedControl<T extends string>` — `props: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }`
  - `Toggle` — `props: { checked: boolean; onChange: (v: boolean) => void; label?: string }`
  - `OptionCard` — `props: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string }`
  - `ProgressBar` — `props: { value: number; max: number }` (0..max)
  - `Badge` — `props: { element?: 'wood'|'fire'|'earth'|'metal'|'water'; children: React.ReactNode }`

- [ ] **Step 1: `SegmentedControl.tsx`** (근거: 양력/음력 세그먼트 `Saju Funnel mobile.dc.html:76-79`)

```tsx
"use client";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: Props<T>) {
  return (
    <div
      className={`flex gap-[3px] bg-slate-100 rounded-xl p-[3px] ${className}`}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 text-sm rounded-[9px] py-[11px] transition-all cursor-pointer ${
              on
                ? "bg-white text-slate-900 font-semibold shadow-[0_1px_2px_rgba(15,23,42,.08)]"
                : "bg-transparent text-slate-500 font-medium"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: `Toggle.tsx`** (근거: 진태양시 스위치 `Saju Desktop Funnel.dc.html:151-153`)

```tsx
"use client";

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative w-12 h-[27px] rounded-full flex-none transition-colors cursor-pointer"
      style={{ background: checked ? "#2563EB" : "#CBD5E1" }}
    >
      <span
        className="absolute top-[2px] w-[23px] h-[23px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.25)] transition-[left]"
        style={{ left: checked ? "23px" : "2px" }}
      />
    </button>
  );
}
```

- [ ] **Step 3: `OptionCard.tsx`** (근거: 성별 카드 `Saju Desktop Funnel.dc.html:95-100`, 선택 스타일 `:258-260`)

```tsx
"use client";

interface Props {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export function OptionCard({ selected, onClick, children, className = "" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-semibold rounded-2xl transition-all cursor-pointer border-2 ${
        selected
          ? "border-accent bg-accent-50 text-accent"
          : "border-slate-200 bg-white text-slate-900"
      } ${className}`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: `ProgressBar.tsx`** (근거: `Saju Desktop Funnel.dc.html:69-71`)

```tsx
interface Props {
  value: number;
  max: number;
}

export function ProgressBar({ value, max }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex-1 h-[5px] bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-accent rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 5: `Badge.tsx`** (근거: 오행 태그 `Saju Design System.dc.html:166-173`)

```tsx
type Element = "wood" | "fire" | "earth" | "metal" | "water";

interface Props {
  element?: Element;
  children: React.ReactNode;
}

const elementStyles: Record<Element, string> = {
  wood: "text-wood-ink bg-wood-soft",
  fire: "text-fire-ink bg-fire-soft",
  earth: "text-earth-ink bg-earth-soft",
  metal: "text-metal-ink bg-metal-soft",
  water: "text-water-ink bg-water-soft",
};

const dotColor: Record<Element, string> = {
  wood: "#2E9E6B",
  fire: "#DC5A4B",
  earth: "#C99A3F",
  metal: "#8492A6",
  water: "#3E6FB0",
};

export function Badge({ element, children }: Props) {
  if (!element) {
    return (
      <span className="text-[13px] font-semibold text-slate-700 bg-slate-100 px-[11px] py-[5px] rounded-lg">
        {children}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px] font-semibold px-[11px] py-[5px] rounded-full ${elementStyles[element]}`}
    >
      <span
        className="w-[7px] h-[7px] rounded-full"
        style={{ background: dotColor[element] }}
      />
      {children}
    </span>
  );
}
```

- [ ] **Step 6: 타입체크**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/SegmentedControl.tsx src/components/Toggle.tsx src/components/OptionCard.tsx src/components/ProgressBar.tsx src/components/Badge.tsx
git commit -m "feat: SegmentedControl·Toggle·OptionCard·ProgressBar·Badge 프리미티브"
```

---

## Task 4: WheelPicker · DateWheelPicker · TimeWheelPicker

**Files:**
- Create: `src/components/WheelPicker.tsx`
- Create: `src/components/DateWheelPicker.tsx`
- Create: `src/components/TimeWheelPicker.tsx`

**Interfaces:**
- Consumes: `daysInMonth` from Task 6 `date.ts`는 여기서 쓰지 않음(내부 계산). DateWheelPicker는 자체적으로 월별 일수를 clamp한다.
- Produces:
  - `WheelPicker` — `props: { items: { value: number; label: string }[]; value: number; onChange: (v: number) => void; width?: number }`. 스크롤 스냅 휠, 중앙 항목 선택.
  - `DateWheelPicker` — `props: { value: { y: number; m: number; d: number }; onChange: (v: { y: number; m: number; d: number }) => void }`
  - `TimeWheelPicker` — `props: { value: { h: number; m: number }; onChange: (v: { h: number; m: number }) => void }`

- [ ] **Step 1: `WheelPicker.tsx` 작성**

범용 세로 휠. 스크롤 스냅 + 중앙 정렬로 선택값 판정. 아이템 높이 36px, 보이는 행 5개(가운데 선택).

```tsx
"use client";

import { useEffect, useRef } from "react";

export interface WheelItem {
  value: number;
  label: string;
}

interface Props {
  items: WheelItem[];
  value: number;
  onChange: (v: number) => void;
  width?: number;
}

const ITEM_H = 36;
const VISIBLE = 5; // 홀수, 가운데가 선택

export function WheelPicker({ items, value, onChange, width = 72 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pad = (VISIBLE - 1) / 2;

  // value가 바뀌면 해당 위치로 스크롤 정렬
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = items.findIndex((it) => it.value === value);
    if (idx < 0) return;
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
  }, [value, items]);

  function handleScroll() {
    const el = ref.current;
    if (!el) return;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      const next = items[clamped];
      if (next && next.value !== value) onChange(next.value);
      el.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
    }, 120);
  }

  return (
    <div className="relative" style={{ width, height: ITEM_H * VISIBLE }}>
      {/* 중앙 선택 밴드 */}
      <div
        className="pointer-events-none absolute inset-x-0 border-y border-slate-200"
        style={{ top: pad * ITEM_H, height: ITEM_H }}
      />
      <div
        ref={ref}
        onScroll={handleScroll}
        className="saju-scroll h-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollPaddingTop: pad * ITEM_H }}
      >
        <div style={{ height: pad * ITEM_H }} />
        {items.map((it) => (
          <div
            key={it.value}
            className={`snap-center flex items-center justify-center text-[17px] ${
              it.value === value
                ? "text-slate-900 font-bold"
                : "text-slate-400"
            }`}
            style={{ height: ITEM_H }}
          >
            {it.label}
          </div>
        ))}
        <div style={{ height: pad * ITEM_H }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `DateWheelPicker.tsx` 작성**

년(1930..현재), 월(1..12), 일(월별 일수). 일자 clamp: 선택 월/년의 최대 일수 초과 시 조정.

```tsx
"use client";

import { WheelPicker, type WheelItem } from "./WheelPicker";

interface DateValue {
  y: number;
  m: number;
  d: number;
}

interface Props {
  value: DateValue;
  onChange: (v: DateValue) => void;
}

function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate(); // m: 1..12
}

const CURRENT_YEAR = 2026;

export function DateWheelPicker({ value, onChange }: Props) {
  const years: WheelItem[] = range(1930, CURRENT_YEAR).map((y) => ({
    value: y,
    label: `${y}`,
  }));
  const months: WheelItem[] = range(1, 12).map((m) => ({
    value: m,
    label: `${m}`,
  }));
  const days: WheelItem[] = range(1, daysInMonth(value.y, value.m)).map((d) => ({
    value: d,
    label: `${d}`,
  }));

  function clampDay(y: number, m: number, d: number): number {
    return Math.min(d, daysInMonth(y, m));
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <WheelPicker
        items={years}
        value={value.y}
        onChange={(y) => onChange({ y, m: value.m, d: clampDay(y, value.m, value.d) })}
        width={84}
      />
      <span className="text-slate-400">년</span>
      <WheelPicker
        items={months}
        value={value.m}
        onChange={(m) => onChange({ y: value.y, m, d: clampDay(value.y, m, value.d) })}
        width={56}
      />
      <span className="text-slate-400">월</span>
      <WheelPicker
        items={days}
        value={value.d}
        onChange={(d) => onChange({ y: value.y, m: value.m, d })}
        width={56}
      />
      <span className="text-slate-400">일</span>
    </div>
  );
}
```

- [ ] **Step 3: `TimeWheelPicker.tsx` 작성**

시(0..23), 분(0..59). 2자리 zero-pad 라벨.

```tsx
"use client";

import { WheelPicker, type WheelItem } from "./WheelPicker";

interface TimeValue {
  h: number;
  m: number;
}

interface Props {
  value: TimeValue;
  onChange: (v: TimeValue) => void;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function range(start: number, end: number): WheelItem[] {
  const out: WheelItem[] = [];
  for (let i = start; i <= end; i++) out.push({ value: i, label: pad2(i) });
  return out;
}

export function TimeWheelPicker({ value, onChange }: Props) {
  return (
    <div className="flex items-center justify-center gap-2">
      <WheelPicker
        items={range(0, 23)}
        value={value.h}
        onChange={(h) => onChange({ h, m: value.m })}
        width={64}
      />
      <span className="text-slate-400 text-xl font-bold">:</span>
      <WheelPicker
        items={range(0, 59)}
        value={value.m}
        onChange={(m) => onChange({ h: value.h, m })}
        width={64}
      />
    </div>
  );
}
```

- [ ] **Step 4: 타입체크**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/WheelPicker.tsx src/components/DateWheelPicker.tsx src/components/TimeWheelPicker.tsx
git commit -m "feat: WheelPicker + Date/Time 휠 피커"
```

---

## Task 5: 퍼널 스텝 로직 (steps.ts) — TDD

**Files:**
- Create: `src/app/funnel/_lib/steps.ts`
- Test: `src/app/funnel/_lib/steps.test.ts`

**Interfaces:**
- Produces:
  - `type StepKey = 'name' | 'gender' | 'birth' | 'time' | 'review'`
  - `const STEPS: StepKey[]` (순서)
  - `stepIndex(step: StepKey): number`
  - `nextStep(step: StepKey): StepKey | null` (review에서 null)
  - `prevStep(step: StepKey): StepKey | null` (name에서 null)
  - `isValidStep(v: string | null): v is StepKey`

- [ ] **Step 1: 실패 테스트 작성**

`src/app/funnel/_lib/steps.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { STEPS, stepIndex, nextStep, prevStep, isValidStep } from "./steps";

describe("steps", () => {
  it("정의된 순서를 가진다", () => {
    expect(STEPS).toEqual(["name", "gender", "birth", "time", "review"]);
  });

  it("stepIndex는 0-based 인덱스를 반환한다", () => {
    expect(stepIndex("name")).toBe(0);
    expect(stepIndex("review")).toBe(4);
  });

  it("nextStep은 다음 스텝, 마지막은 null", () => {
    expect(nextStep("name")).toBe("gender");
    expect(nextStep("time")).toBe("review");
    expect(nextStep("review")).toBeNull();
  });

  it("prevStep은 이전 스텝, 처음은 null", () => {
    expect(prevStep("gender")).toBe("name");
    expect(prevStep("name")).toBeNull();
  });

  it("isValidStep은 유효 키만 통과", () => {
    expect(isValidStep("birth")).toBe(true);
    expect(isValidStep("nope")).toBe(false);
    expect(isValidStep(null)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test -- steps`
Expected: FAIL — `./steps` 모듈을 찾을 수 없음.

- [ ] **Step 3: `steps.ts` 구현**

```ts
export type StepKey = "name" | "gender" | "birth" | "time" | "review";

export const STEPS: StepKey[] = ["name", "gender", "birth", "time", "review"];

export function stepIndex(step: StepKey): number {
  return STEPS.indexOf(step);
}

export function nextStep(step: StepKey): StepKey | null {
  const i = stepIndex(step);
  return i < STEPS.length - 1 ? STEPS[i + 1] : null;
}

export function prevStep(step: StepKey): StepKey | null {
  const i = stepIndex(step);
  return i > 0 ? STEPS[i - 1] : null;
}

export function isValidStep(v: string | null): v is StepKey {
  return v !== null && (STEPS as string[]).includes(v);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- steps`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/funnel/_lib/steps.ts src/app/funnel/_lib/steps.test.ts
git commit -m "feat: 퍼널 스텝 순서/검증 로직 (TDD)"
```

---

## Task 6: 날짜/시간 모델 헬퍼 (date.ts) — TDD

**Files:**
- Create: `src/app/funnel/_lib/date.ts`
- Test: `src/app/funnel/_lib/date.test.ts`

**Interfaces:**
- Produces:
  - `daysInMonth(y: number, m: number): number` (m: 1..12)
  - `clampDay(y: number, m: number, d: number): number`
  - `formatDate(v: { y: number; m: number; d: number }): string` → `"1990. 02. 20."`
  - `formatTime(v: { h: number; m: number }): string` → `"04:30"`

- [ ] **Step 1: 실패 테스트 작성**

`src/app/funnel/_lib/date.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { daysInMonth, clampDay, formatDate, formatTime } from "./date";

describe("date helpers", () => {
  it("daysInMonth: 평월/윤년 처리", () => {
    expect(daysInMonth(2021, 2)).toBe(28);
    expect(daysInMonth(2020, 2)).toBe(29); // 윤년
    expect(daysInMonth(1990, 4)).toBe(30);
    expect(daysInMonth(1990, 12)).toBe(31);
  });

  it("clampDay: 월 최대 일수로 제한", () => {
    expect(clampDay(2021, 2, 31)).toBe(28);
    expect(clampDay(1990, 5, 15)).toBe(15);
  });

  it("formatDate: 'YYYY. MM. DD.' zero-pad", () => {
    expect(formatDate({ y: 1990, m: 2, d: 20 })).toBe("1990. 02. 20.");
  });

  it("formatTime: 'HH:MM' zero-pad", () => {
    expect(formatTime({ h: 4, m: 30 })).toBe("04:30");
    expect(formatTime({ h: 14, m: 5 })).toBe("14:05");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm run test -- date`
Expected: FAIL — `./date` 모듈 없음.

- [ ] **Step 3: `date.ts` 구현**

```ts
export function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export function clampDay(y: number, m: number, d: number): number {
  return Math.min(d, daysInMonth(y, m));
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatDate(v: { y: number; m: number; d: number }): string {
  return `${v.y}. ${pad2(v.m)}. ${pad2(v.d)}.`;
}

export function formatTime(v: { h: number; m: number }): string {
  return `${pad2(v.h)}:${pad2(v.m)}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- date`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/funnel/_lib/date.ts src/app/funnel/_lib/date.test.ts
git commit -m "feat: 날짜/시간 모델 헬퍼 (TDD)"
```

---

## Task 7: FunnelContext (입력값 상태)

**Files:**
- Create: `src/app/funnel/_context/FunnelContext.tsx`

**Interfaces:**
- Consumes: 없음.
- Produces:
  - `type Gender = 'male' | 'female'`
  - `type Calendar = 'solar' | 'lunar'`
  - `interface FunnelData { name: string; gender: Gender | null; calendar: Calendar; birth: { y: number; m: number; d: number } | null; timeKnown: boolean; time: { h: number; m: number } | null; trueSolar: boolean }`
  - `FunnelProvider` (client 컴포넌트, `children` 래핑)
  - `useFunnel(): { data: FunnelData; update: (patch: Partial<FunnelData>) => void; reset: () => void }`

- [ ] **Step 1: `FunnelContext.tsx` 작성**

```tsx
"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type Gender = "male" | "female";
export type Calendar = "solar" | "lunar";

export interface FunnelData {
  name: string;
  gender: Gender | null;
  calendar: Calendar;
  birth: { y: number; m: number; d: number } | null;
  timeKnown: boolean;
  time: { h: number; m: number } | null;
  trueSolar: boolean;
}

const initialData: FunnelData = {
  name: "",
  gender: null,
  calendar: "solar",
  birth: null,
  timeKnown: true,
  time: null,
  trueSolar: true,
};

interface FunnelContextValue {
  data: FunnelData;
  update: (patch: Partial<FunnelData>) => void;
  reset: () => void;
}

const FunnelContext = createContext<FunnelContextValue | null>(null);

export function FunnelProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<FunnelData>(initialData);

  const update = useCallback((patch: Partial<FunnelData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setData(initialData), []);

  const value = useMemo(() => ({ data, update, reset }), [data, update, reset]);

  return <FunnelContext.Provider value={value}>{children}</FunnelContext.Provider>;
}

export function useFunnel(): FunnelContextValue {
  const ctx = useContext(FunnelContext);
  if (!ctx) throw new Error("useFunnel must be used within FunnelProvider");
  return ctx;
}
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/funnel/_context/FunnelContext.tsx
git commit -m "feat: FunnelContext 입력값 상태"
```

---

## Task 8: useFunnelNav 훅 (스텝 네비게이션)

**Files:**
- Create: `src/app/funnel/_hooks/useFunnelNav.ts`

**Interfaces:**
- Consumes: Task 5 `steps.ts`(`StepKey`, `isValidStep`, `nextStep`, `prevStep`, `stepIndex`, `STEPS`).
- Produces:
  - `useFunnelNav(): { step: StepKey; index: number; total: number; goTo: (s: StepKey) => void; goNext: () => void; goBack: () => void; rawStep: string | null }`
  - `step`: 현재 유효 스텝(쿼리 없거나 유효하지 않으면 `'name'`으로 간주). `goNext`/`goTo`는 `router.push`(히스토리 push), `goBack`은 `router.back`. 쿼리 형식: `/funnel?step=<key>`.

- [ ] **Step 1: `useFunnelNav.ts` 작성** (근거: `useRouter`/`useSearchParams` from `next/navigation` — 문서 확인 완료)

```ts
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  STEPS,
  type StepKey,
  isValidStep,
  nextStep,
  prevStep,
  stepIndex,
} from "../_lib/steps";

export function useFunnelNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStep = searchParams.get("step");
  const step: StepKey = isValidStep(rawStep) ? rawStep : "name";

  const goTo = useCallback(
    (s: StepKey) => {
      router.push(`/funnel?step=${s}`);
    },
    [router]
  );

  const goNext = useCallback(() => {
    const n = nextStep(step);
    if (n) router.push(`/funnel?step=${n}`);
  }, [router, step]);

  const goBack = useCallback(() => {
    if (prevStep(step)) router.back();
  }, [router, step]);

  return {
    step,
    index: stepIndex(step),
    total: STEPS.length,
    goTo,
    goNext,
    goBack,
    rawStep,
  };
}
```

- [ ] **Step 2: 타입체크**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/funnel/_hooks/useFunnelNav.ts
git commit -m "feat: useFunnelNav 스텝 네비게이션 훅"
```

---

## Task 9: 퍼널 레이아웃 · 진행바 · 푸터 · 스텝퍼

**Files:**
- Create: `src/app/funnel/_components/FunnelProgress.tsx`
- Create: `src/app/funnel/_components/FunnelFooter.tsx`
- Create: `src/app/funnel/_components/Stepper.tsx`
- Create: `src/app/funnel/_components/FunnelLayout.tsx`

**Interfaces:**
- Consumes: `ProgressBar`(Task 3), `Button`(Task 2), `useFunnelNav`(Task 8), `STEPS`/`stepIndex`(Task 5).
- Produces:
  - `FunnelProgress` — `props: { index: number; total: number }` (상단 진행바 + `n/총`)
  - `FunnelFooter` — `props: { canNext: boolean; isLast: boolean; onNext: () => void; onBack: () => void; showBack: boolean }`
  - `Stepper` — `props: { index: number }` (데스크톱 좌측 세로 스텝퍼)
  - `FunnelLayout` — `props: { index: number; total: number; footer: React.ReactNode; children: React.ReactNode }`. 데스크톱: 좌측 레일(Stepper) + 우측(진행바/본문/footer). 모바일: 풀스크린(상단 진행바/본문/footer).

- [ ] **Step 1: `FunnelProgress.tsx`** (근거: `Saju Desktop Funnel.dc.html:68-73`)

```tsx
import { ProgressBar } from "@/components/ProgressBar";

interface Props {
  index: number;
  total: number;
}

export function FunnelProgress({ index, total }: Props) {
  return (
    <div className="flex items-center gap-5">
      <ProgressBar value={index + 1} max={total} />
      <span className="text-[13px] font-semibold text-slate-400 whitespace-nowrap">
        {index + 1} / {total}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: `FunnelFooter.tsx`** (근거: `Saju Desktop Funnel.dc.html:162-165`)

```tsx
"use client";

import { Button } from "@/components/Button";

interface Props {
  canNext: boolean;
  isLast: boolean;
  showBack: boolean;
  onNext: () => void;
  onBack: () => void;
}

export function FunnelFooter({ canNext, isLast, showBack, onNext, onBack }: Props) {
  return (
    <div className="flex items-center justify-between gap-4">
      <button
        type="button"
        onClick={onBack}
        className={`text-[15px] font-semibold text-slate-500 hover:text-slate-900 py-3 px-1 cursor-pointer ${
          showBack ? "visible" : "invisible"
        }`}
      >
        ← 이전
      </button>
      <Button onClick={onNext} disabled={!canNext} className="px-10 py-4 text-base">
        {isLast ? "사주 분석 시작" : "다음"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: `Stepper.tsx`** (근거: `Saju Desktop Funnel.dc.html:43-56`, 스텝 정의 `:226-232`, 점 스타일 `:237-251`)

```tsx
import { STEPS, stepIndex } from "../_lib/steps";

interface Props {
  index: number;
}

const meta: Record<(typeof STEPS)[number], { label: string; sub: string }> = {
  name: { label: "이름", sub: "리포트 표시 이름" },
  gender: { label: "성별", sub: "양·음 기운 해석" },
  birth: { label: "생년월일", sub: "만세력 환산" },
  time: { label: "태어난 시간", sub: "시주 계산" },
  review: { label: "확인", sub: "입력 내용 검토" },
};

export function Stepper({ index }: Props) {
  const last = STEPS.length - 1;
  return (
    <nav className="mt-11 flex flex-col">
      {STEPS.map((key, i) => {
        const active = i === index;
        const done = i < index;
        const m = meta[key];
        return (
          <div key={key} className="flex gap-[15px] items-start">
            <div className="flex flex-col items-center flex-none">
              <div
                className={`w-7 h-7 flex-none rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  done
                    ? "bg-accent text-white"
                    : active
                    ? "bg-white text-accent border-2 border-accent shadow-[0_0_0_4px_#EFF6FF]"
                    : "bg-white text-slate-300 border-2 border-dashed border-slate-200"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              {i !== last && (
                <div
                  className="w-[2px] h-[26px] my-1.5 rounded-full transition-colors"
                  style={{ background: done ? "#2563EB" : "#E2E8F0" }}
                />
              )}
            </div>
            <div className={i !== last ? "pb-[22px]" : ""}>
              <div
                className={`text-[15.5px] transition-colors ${
                  active || done
                    ? "font-bold text-slate-900"
                    : "font-semibold text-slate-400"
                }`}
              >
                {m.label}
              </div>
              <div className={`text-[12.5px] text-slate-400 mt-0.5 ${active ? "" : "opacity-70"}`}>
                {m.sub}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// stepIndex re-export 편의 (미사용시 무시)
export { stepIndex };
```

- [ ] **Step 4: `FunnelLayout.tsx`** (근거: 데스크톱 `Saju Desktop Funnel.dc.html:24-197`, 모바일 `Saju Funnel mobile.dc.html:34-132`)

```tsx
import { Stepper } from "./Stepper";
import { FunnelProgress } from "./FunnelProgress";

interface Props {
  index: number;
  total: number;
  footer: React.ReactNode;
  children: React.ReactNode;
}

export function FunnelLayout({ index, total, footer, children }: Props) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* 데스크톱 좌측 레일 */}
      <aside className="hidden md:flex flex-none w-[400px] bg-slate-50 border-r border-slate-200 px-11 py-11 flex-col">
        <div className="flex items-center gap-[11px]">
          <div className="w-[34px] h-[34px] rounded-[10px] bg-slate-900 flex items-center justify-center text-white font-bold text-base">
            사
          </div>
          <span className="font-bold text-lg tracking-tight">사주</span>
        </div>
        <div className="mt-11">
          <div className="text-[13px] font-semibold text-accent mb-2.5">사주 정보 입력</div>
          <h2 className="text-[26px] font-bold tracking-tight leading-tight">
            몇 가지만 알려주시면
            <br />
            사주를 분석해드려요
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed mt-3.5">
            정확한 출생 정보일수록 더 깊이 있는 리포트를 받아보실 수 있어요.
          </p>
        </div>
        <Stepper index={index} />
        <div className="mt-auto pt-8 flex items-center gap-2 text-[12.5px] text-slate-400">
          🔒 입력 정보는 안전하게 보관돼요
        </div>
      </aside>

      {/* 우측/모바일 본문 */}
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="px-6 md:px-14 pt-8">
          <FunnelProgress index={index} total={total} />
        </div>
        <div className="saju-scroll flex-1 overflow-y-auto flex items-center justify-center px-6 md:px-14 py-6">
          <div key={index} className="w-full max-w-[440px]">
            {children}
          </div>
        </div>
        <div className="px-6 md:px-14 py-6 md:border-t md:border-slate-100">
          {footer}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 5: 타입체크**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/funnel/_components/FunnelProgress.tsx src/app/funnel/_components/FunnelFooter.tsx src/app/funnel/_components/Stepper.tsx src/app/funnel/_components/FunnelLayout.tsx
git commit -m "feat: 퍼널 레이아웃·진행바·푸터·스텝퍼"
```

---

## Task 10: 스텝 컴포넌트 (Name/Gender/BirthDate/BirthTime/Review)

**Files:**
- Create: `src/app/funnel/_components/steps/NameStep.tsx`
- Create: `src/app/funnel/_components/steps/GenderStep.tsx`
- Create: `src/app/funnel/_components/steps/BirthDateStep.tsx`
- Create: `src/app/funnel/_components/steps/BirthTimeStep.tsx`
- Create: `src/app/funnel/_components/steps/ReviewStep.tsx`

**Interfaces:**
- Consumes: `useFunnel`(Task 7), `SegmentedControl`/`OptionCard`/`Toggle`(Task 3), `DateWheelPicker`/`TimeWheelPicker`(Task 4), `formatDate`/`formatTime`(Task 6).
- Produces: 각 스텝은 props 없는 클라이언트 컴포넌트. Context에서 값을 읽고 `update`로 갱신한다. 기본값 채우기: BirthDateStep 최초 진입 시 `birth`가 null이면 `{y:1990,m:1,d:1}`로 초기화, BirthTimeStep 최초 진입 시 `time`이 null이면 `{h:12,m:0}`으로 초기화.

- [ ] **Step 1: `NameStep.tsx`** (근거: `Saju Desktop Funnel.dc.html:81-87`)

```tsx
"use client";

import { useFunnel } from "../../_context/FunnelContext";

export function NameStep() {
  const { data, update } = useFunnel();
  return (
    <div>
      <h1 className="text-[32px] font-bold tracking-tight leading-tight mb-2.5">
        이름을 알려주세요
      </h1>
      <p className="text-[15px] text-slate-500 mb-10">리포트에 표시할 이름이에요.</p>
      <input
        value={data.name}
        onChange={(e) => update({ name: e.target.value })}
        placeholder="이름"
        autoFocus
        className="w-full border-0 border-b-2 border-slate-200 focus:border-accent outline-none py-2.5 px-0.5 text-[30px] font-bold text-slate-900 placeholder:text-slate-300"
      />
    </div>
  );
}
```

- [ ] **Step 2: `GenderStep.tsx`** (근거: `Saju Desktop Funnel.dc.html:91-102`)

```tsx
"use client";

import { OptionCard } from "@/components/OptionCard";
import { useFunnel } from "../../_context/FunnelContext";

export function GenderStep() {
  const { data, update } = useFunnel();
  const name = data.name.trim() || "회원";
  return (
    <div>
      <h1 className="text-[32px] font-bold tracking-tight leading-tight mb-2.5">
        {name}님의 성별은?
      </h1>
      <p className="text-[15px] text-slate-500 mb-9">양·음 기운 해석에 사용돼요.</p>
      <div className="flex gap-3.5">
        <OptionCard
          selected={data.gender === "male"}
          onClick={() => update({ gender: "male" })}
          className="flex-1 text-center text-[17px] px-5 py-[34px]"
        >
          <div className="text-[30px] mb-2.5">♂</div>
          남성
        </OptionCard>
        <OptionCard
          selected={data.gender === "female"}
          onClick={() => update({ gender: "female" })}
          className="flex-1 text-center text-[17px] px-5 py-[34px]"
        >
          <div className="text-[30px] mb-2.5">♀</div>
          여성
        </OptionCard>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `BirthDateStep.tsx`** (근거: `Saju Desktop Funnel.dc.html:106-119`; 휠 피커로 대체)

```tsx
"use client";

import { useEffect } from "react";
import { SegmentedControl } from "@/components/SegmentedControl";
import { DateWheelPicker } from "@/components/DateWheelPicker";
import { useFunnel, type Calendar } from "../../_context/FunnelContext";

export function BirthDateStep() {
  const { data, update } = useFunnel();

  useEffect(() => {
    if (!data.birth) update({ birth: { y: 1990, m: 1, d: 1 } });
  }, [data.birth, update]);

  const birth = data.birth ?? { y: 1990, m: 1, d: 1 };

  return (
    <div>
      <h1 className="text-[32px] font-bold tracking-tight leading-tight mb-2.5">
        생년월일을 입력해주세요
      </h1>
      <p className="text-[15px] text-slate-500 mb-8">달력 종류를 먼저 선택해주세요.</p>
      <SegmentedControl<Calendar>
        options={[
          { value: "solar", label: "양력" },
          { value: "lunar", label: "음력" },
        ]}
        value={data.calendar}
        onChange={(calendar) => update({ calendar })}
        className="max-w-[240px] mb-6"
      />
      <DateWheelPicker value={birth} onChange={(v) => update({ birth: v })} />
    </div>
  );
}
```

- [ ] **Step 4: `BirthTimeStep.tsx`** (근거: `Saju Desktop Funnel.dc.html:123-133`; 휠 피커 + 시간 모름 칩)

```tsx
"use client";

import { useEffect } from "react";
import { TimeWheelPicker } from "@/components/TimeWheelPicker";
import { useFunnel } from "../../_context/FunnelContext";

export function BirthTimeStep() {
  const { data, update } = useFunnel();

  useEffect(() => {
    if (data.timeKnown && !data.time) update({ time: { h: 12, m: 0 } });
  }, [data.timeKnown, data.time, update]);

  const time = data.time ?? { h: 12, m: 0 };

  return (
    <div>
      <h1 className="text-[32px] font-bold tracking-tight leading-tight mb-2.5">
        태어난 시간을 알려주세요
      </h1>
      <p className="text-[15px] text-slate-500 mb-8">시(時) 기둥 계산에 사용돼요.</p>

      <div
        className={`transition-opacity ${data.timeKnown ? "" : "opacity-40 pointer-events-none"}`}
      >
        <TimeWheelPicker value={time} onChange={(v) => update({ time: v })} />
      </div>

      <button
        type="button"
        onClick={() => update({ timeKnown: !data.timeKnown })}
        className={`w-full flex items-center gap-2.5 mt-4 text-sm font-semibold rounded-xl px-[18px] py-4 transition-all cursor-pointer border ${
          data.timeKnown
            ? "border-slate-200 bg-white text-slate-500"
            : "border-2 border-accent bg-accent-50 text-accent"
        }`}
      >
        <span className="text-base">{data.timeKnown ? "○" : "●"}</span>
        태어난 시간을 몰라요
      </button>
    </div>
  );
}
```

- [ ] **Step 5: `ReviewStep.tsx`** (근거: `Saju Desktop Funnel.dc.html:137-155`, 리뷰행 `:264-271`)

```tsx
"use client";

import { Toggle } from "@/components/Toggle";
import { useFunnel } from "../../_context/FunnelContext";
import { formatDate, formatTime } from "../../_lib/date";

export function ReviewStep() {
  const { data, update } = useFunnel();

  const rows: { k: string; v: string }[] = [
    { k: "이름", v: data.name.trim() || "-" },
    { k: "성별", v: data.gender === "male" ? "남성" : data.gender === "female" ? "여성" : "-" },
    {
      k: "생년월일",
      v: `${data.calendar === "solar" ? "양력 " : "음력 "}${
        data.birth ? formatDate(data.birth) : "-"
      }`,
    },
    {
      k: "태어난 시간",
      v: data.timeKnown ? (data.time ? formatTime(data.time) : "-") : "시간 모름",
    },
  ];

  return (
    <div>
      <h1 className="text-[32px] font-bold tracking-tight leading-tight mb-2.5">
        입력 내용을 확인해주세요
      </h1>
      <p className="text-[15px] text-slate-500 mb-7">맞다면 분석을 시작할게요.</p>

      <div className="border border-slate-200 rounded-[18px] overflow-hidden">
        {rows.map((r, i) => (
          <div
            key={r.k}
            className={`flex items-center justify-between px-5 py-[17px] ${
              i < rows.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <span className="text-[13.5px] text-slate-400">{r.k}</span>
            <span className="text-[15px] font-semibold">{r.v}</span>
          </div>
        ))}
      </div>

      <div className="w-full flex items-center justify-between border border-slate-200 bg-slate-50 rounded-[15px] px-[18px] py-4 mt-4">
        <span>
          <span className="block text-sm font-semibold text-slate-700">진태양시 보정</span>
          <span className="block text-[12.5px] text-slate-400 mt-0.5">
            출생지 경도 기준 시간 보정
          </span>
        </span>
        <Toggle
          checked={data.trueSolar}
          onChange={(v) => update({ trueSolar: v })}
          label="진태양시 보정"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 타입체크**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/app/funnel/_components/steps
git commit -m "feat: 퍼널 스텝 컴포넌트 5종"
```

---

## Task 11: 분석중 화면 · 퍼널 페이지 조립 · 가드 · 리포트 stub

**Files:**
- Create: `src/app/funnel/_components/AnalyzingScreen.tsx`
- Create: `src/app/funnel/page.tsx`
- Create: `src/app/report/page.tsx`

**Interfaces:**
- Consumes: `FunnelProvider`/`useFunnel`(Task 7), `useFunnelNav`(Task 8), `FunnelLayout`/`FunnelFooter`(Task 9), 스텝 컴포넌트(Task 10), `AnalyzingScreen`.
- Produces: `/funnel?step=<key>` 라우트. 가드: 새로고침 등으로 Context가 비었는데(`name` 공백) 첫 스텝이 아니면 `?step=name`으로 `replace`. 스텝별 다음 진행 가능 여부(`canNext`) 판정. review에서 제출 → analyzing → `/report`.

- [ ] **Step 1: `AnalyzingScreen.tsx`** (근거: `Saju Desktop Funnel.dc.html:169-181`)

```tsx
"use client";

interface Props {
  name: string;
}

export function AnalyzingScreen({ name }: Props) {
  return (
    <div className="flex-1 min-h-screen flex flex-col items-center justify-center px-10">
      <div className="w-[60px] h-[60px] rounded-full border-[3px] border-slate-200 border-t-accent animate-spin" />
      <div className="text-[22px] font-bold mt-[30px] tracking-tight">
        사주를 계산하고 있어요
      </div>
      <div className="text-[15px] text-slate-500 mt-2">
        {name.trim() ? `${name.trim()}님, ` : ""}만세력 환산 · 오행 분석 중
      </div>
      <div className="mt-[34px] flex flex-col gap-3 w-full max-w-[260px]">
        <div className="flex items-center gap-2.5 text-sm text-slate-700">
          <span className="text-green-600">✓</span> 천간·지지 변환
        </div>
        <div className="flex items-center gap-2.5 text-sm text-slate-700">
          <span className="text-green-600">✓</span> 오행 분포 집계
        </div>
        <div className="flex items-center gap-2.5 text-sm text-slate-400">
          <span className="text-accent">●</span> 십성·용신 분석
        </div>
      </div>
    </div>
  );
}
```

> 참고: `animate-spin`은 Tailwind 기본 유틸. 별도 keyframe 불필요.

- [ ] **Step 2: `report/page.tsx` (리포트 stub)**

```tsx
export default function ReportPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="w-16 h-16 rounded-full bg-accent-50 text-accent flex items-center justify-center text-3xl">
        ✓
      </div>
      <h1 className="text-2xl font-bold tracking-tight mt-2">분석이 완료되었어요</h1>
      <p className="text-slate-500">리포트 화면은 준비 중입니다.</p>
      <a
        href="/"
        className="mt-4 text-[15px] font-semibold text-accent hover:opacity-80"
      >
        처음으로 →
      </a>
    </main>
  );
}
```

- [ ] **Step 3: `funnel/page.tsx` 조립**

`useSearchParams`를 쓰는 클라이언트 컴포넌트는 `<Suspense>`로 감싼다(문서 확인: 프로덕션 빌드 요구). 가드는 `useEffect`에서 `router.replace`로 처리.

```tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FunnelProvider, useFunnel } from "./_context/FunnelContext";
import { useFunnelNav } from "./_hooks/useFunnelNav";
import { FunnelLayout } from "./_components/FunnelLayout";
import { FunnelFooter } from "./_components/FunnelFooter";
import { AnalyzingScreen } from "./_components/AnalyzingScreen";
import { NameStep } from "./_components/steps/NameStep";
import { GenderStep } from "./_components/steps/GenderStep";
import { BirthDateStep } from "./_components/steps/BirthDateStep";
import { BirthTimeStep } from "./_components/steps/BirthTimeStep";
import { ReviewStep } from "./_components/steps/ReviewStep";

function FunnelInner() {
  const router = useRouter();
  const { data } = useFunnel();
  const { step, index, total, goNext, goBack } = useFunnelNav();
  const [analyzing, setAnalyzing] = useState(false);

  // 가드: Context가 비었는데(name 공백) 첫 스텝이 아니면 첫 스텝으로
  useEffect(() => {
    if (step !== "name" && !data.name.trim()) {
      router.replace("/funnel?step=name");
    }
  }, [step, data.name, router]);

  // 분석 완료 → 리포트 stub
  useEffect(() => {
    if (!analyzing) return;
    const t = setTimeout(() => router.push("/report"), 2200);
    return () => clearTimeout(t);
  }, [analyzing, router]);

  if (analyzing) return <AnalyzingScreen name={data.name} />;

  const canNext = (() => {
    switch (step) {
      case "name":
        return data.name.trim().length > 0;
      case "gender":
        return data.gender !== null;
      default:
        return true;
    }
  })();

  const isLast = step === "review";

  function handleNext() {
    if (!canNext) return;
    if (isLast) setAnalyzing(true);
    else goNext();
  }

  const stepEl = {
    name: <NameStep />,
    gender: <GenderStep />,
    birth: <BirthDateStep />,
    time: <BirthTimeStep />,
    review: <ReviewStep />,
  }[step];

  return (
    <FunnelLayout
      index={index}
      total={total}
      footer={
        <FunnelFooter
          canNext={canNext}
          isLast={isLast}
          showBack={index > 0}
          onNext={handleNext}
          onBack={goBack}
        />
      }
    >
      {stepEl}
    </FunnelLayout>
  );
}

export default function FunnelPage() {
  return (
    <Suspense fallback={null}>
      <FunnelProvider>
        <FunnelInner />
      </FunnelProvider>
    </Suspense>
  );
}
```

- [ ] **Step 4: 타입체크 + 빌드**

Run: `npm run typecheck && npm run build`
Expected: exit 0. (빌드가 통과해야 `useSearchParams` Suspense 요건 충족 확인 가능.)

- [ ] **Step 5: 개발 서버로 퍼널 흐름 수동 검증**

Run: `npm run dev`, `http://localhost:3000/funnel` 접속
확인:
- `?step=name`으로 시작(쿼리 없으면 name 취급), 이름 입력 후 다음 → `?step=gender` (URL 변경)
- 브라우저 뒤로가기 → `?step=name` 복귀, 입력값 유지
- 성별 미선택 시 다음 비활성
- 생년월일 휠, 시간 휠 동작, "시간 몰라요" 토글
- review 요약 정확, 진태양시 토글
- "사주 분석 시작" → 스피너 → `/report` 이동
- `/funnel?step=review` 새로고침 → `?step=name`으로 리다이렉트(Context 비어서)
확인 후 서버 종료.

- [ ] **Step 6: Commit**

```bash
git add src/app/funnel/page.tsx src/app/funnel/_components/AnalyzingScreen.tsx src/app/report/page.tsx
git commit -m "feat: 퍼널 페이지 조립·가드·분석중 화면·리포트 stub"
```

---

## Task 12: 랜딩 페이지

**Files:**
- Create: `src/app/_components/LandingNav.tsx`
- Create: `src/app/_components/ReportPreviewCard.tsx`
- Create: `src/app/_components/Hero.tsx`
- Create: `src/app/_components/KnowSection.tsx`
- Create: `src/app/_components/SampleReport.tsx`
- Create: `src/app/_components/TrustSection.tsx`
- Create: `src/app/_components/FooterCta.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `next/link`의 `Link`. CTA는 `/funnel?step=name`으로 이동.
- Produces: 랜딩 섹션 컴포넌트들(props 없음) + `Home` 페이지.

- [ ] **Step 1: `LandingNav.tsx`** (근거: `랜딩페이지.dc.html:23-36`)

```tsx
import Link from "next/link";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 bg-white/[.78] backdrop-blur-md border-b border-slate-100">
      <div className="max-w-[1120px] mx-auto px-8 h-[68px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-[10px] bg-slate-900 flex items-center justify-center text-white font-semibold text-[15px]">
            사
          </div>
          <span className="font-semibold text-base tracking-tight">사주</span>
        </div>
        <nav className="flex items-center gap-1.5">
          <a href="#know" className="text-[14.5px] font-medium text-slate-600 px-3.5 py-2 rounded-[10px] hover:bg-slate-100">
            알아보기
          </a>
          <a href="#sample" className="text-[14.5px] font-medium text-slate-600 px-3.5 py-2 rounded-[10px] hover:bg-slate-100">
            예시 리포트
          </a>
          <a href="#trust" className="text-[14.5px] font-medium text-slate-600 px-3.5 py-2 rounded-[10px] hover:bg-slate-100">
            신뢰
          </a>
          <Link
            href="/funnel?step=name"
            className="ml-2.5 text-[14.5px] font-semibold text-white bg-accent px-[18px] py-2.5 rounded-xl hover:opacity-90"
          >
            내 리포트 만들기
          </Link>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: `ReportPreviewCard.tsx`** (근거: `랜딩페이지.dc.html:54-83`, 행 데이터 `:225-230`)

```tsx
import { Badge } from "@/components/Badge";

const rows = [
  { k: "성향 요약", v: "신중하고 분석적인 내향형" },
  { k: "관계 스타일", v: "신뢰를 천천히, 깊게" },
  { k: "직업 적성", v: "전략 · 기획 · 연구" },
  { k: "인생 흐름", v: "30대 중반, 결실의 시기" },
];

export function ReportPreviewCard() {
  return (
    <div className="flex-1 min-w-[300px] max-w-[480px] bg-white border border-slate-100 rounded-3xl shadow-[0_36px_80px_-32px_rgba(17,24,39,.24),0_2px_8px_rgba(17,24,39,.04)] overflow-hidden text-left">
      <div className="px-[26px] py-[22px] border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex-none rounded-full bg-accent-50 text-accent flex items-center justify-center font-bold text-base">
            지
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-tight">지우님의 리포트</div>
            <div className="text-xs text-slate-400">사주로 정리한 나</div>
          </div>
        </div>
        <span className="text-[11.5px] font-semibold text-accent bg-accent-50 px-2.5 py-[5px] rounded-full whitespace-nowrap">
          생년월일
        </span>
      </div>
      <div className="px-[26px] py-6">
        <div className="text-xl font-bold leading-snug tracking-tight text-slate-900">
          깊이 있게 사고하고,
          <br />
          신중하게 판단하는 사람
        </div>
        <div className="flex flex-wrap gap-[7px] mt-4">
          <Badge>분석력</Badge>
          <Badge>책임감</Badge>
          <Badge>적응력</Badge>
        </div>
        <div className="h-px bg-slate-100 my-5" />
        <div className="flex flex-col gap-1">
          {rows.map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-4 px-3.5 py-3 rounded-2xl">
              <span className="text-[13px] text-slate-400 flex-none">{r.k}</span>
              <span className="text-sm font-semibold text-slate-700 text-right">{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `Hero.tsx`** (근거: `랜딩페이지.dc.html:38-85`)

```tsx
import Link from "next/link";
import { ReportPreviewCard } from "./ReportPreviewCard";

export function Hero() {
  return (
    <section className="max-w-[1120px] mx-auto px-8 pt-[clamp(64px,9vw,120px)] pb-[72px] text-center">
      <div className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-accent bg-accent-50 px-3.5 py-[7px] rounded-full mb-[30px]">
        나를 이해하는 새로운 방법
      </div>
      <h1 className="text-[clamp(44px,7vw,78px)] leading-[1.04] font-bold tracking-[-0.045em] mb-[26px]">
        당신은
        <br />
        어떤 사람인가요?
      </h1>
      <p className="text-[clamp(19px,2.4vw,23px)] leading-normal text-slate-700 font-medium max-w-[560px] mx-auto mb-3.5">
        사주를 통해 나를 더 깊이 이해해보세요.
      </p>
      <p className="text-[16.5px] leading-relaxed text-slate-400 max-w-[440px] mx-auto mb-[38px]">
        성향, 관계, 직업, 인생의 흐름까지 당신만의 리포트로 정리해드립니다.
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <Link
          href="/funnel?step=name"
          className="text-base font-semibold text-white bg-accent px-7 py-4 rounded-[14px] shadow-[0_12px_28px_-8px_rgba(79,70,229,.4)] hover:opacity-90"
        >
          내 리포트 만들기
        </Link>
      </div>
      <div className="flex items-start justify-center max-w-[880px] mx-auto mt-16">
        <ReportPreviewCard />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: `KnowSection.tsx`** (근거: `랜딩페이지.dc.html:87-104`, 카드 데이터 `:239-244`)

```tsx
const cards = [
  { title: "성향 분석", desc: "타고난 기질과 사고방식을 차분히 정리합니다." },
  { title: "관계 분석", desc: "사람을 대하고 신뢰를 쌓아가는 방식." },
  { title: "직업 적성", desc: "잘 맞는 일과 타고난 강점의 방향." },
  { title: "인생 흐름", desc: "시기마다 달라지는 삶의 리듬과 결." },
];

export function KnowSection() {
  return (
    <section id="know" className="max-w-[1120px] mx-auto px-8 py-24">
      <div className="text-center mb-14">
        <h2 className="text-[clamp(30px,4vw,46px)] font-bold tracking-tight mb-3.5">
          이런 내용을 알려드립니다
        </h2>
        <p className="text-lg text-slate-400">나를 이루는 네 가지 결을 차분하게 정리합니다.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c) => (
          <div
            key={c.title}
            className="bg-white border border-slate-100 rounded-[20px] px-7 py-8 shadow-[0_1px_3px_rgba(17,24,39,.04)] transition-transform hover:-translate-y-1 hover:shadow-[0_20px_44px_-20px_rgba(17,24,39,.16)]"
          >
            <div className="w-[46px] h-[46px] rounded-[14px] bg-accent-50 flex items-center justify-center mb-[22px]">
              <span className="w-4 h-4 rounded-[5px] bg-accent" />
            </div>
            <div className="text-[19px] font-bold tracking-tight mb-2.5">{c.title}</div>
            <p className="text-[14.5px] leading-relaxed text-slate-500">{c.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: `SampleReport.tsx`** (근거: `랜딩페이지.dc.html:106-131`)

```tsx
export function SampleReport() {
  return (
    <section id="sample" className="bg-slate-50 border-y border-slate-100">
      <div className="max-w-[920px] mx-auto px-8 py-[104px] text-center">
        <div className="text-[13px] font-bold tracking-[0.1em] uppercase text-accent mb-[22px]">
          예시 리포트
        </div>
        <p className="text-[clamp(27px,3.6vw,42px)] font-bold leading-snug tracking-tight text-slate-900 mb-3.5">
          “당신은 깊이 있는 사고와
          <br />
          신중한 판단을 하는 사람입니다.”
        </p>
        <p className="text-base text-slate-400 mb-12">리포트의 한 장면을 미리 보여드릴게요.</p>
        <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_24px_60px_-28px_rgba(17,24,39,.18)] overflow-hidden text-left grid grid-cols-1 md:grid-cols-2">
          <div className="px-[38px] py-9 border-b md:border-b-0 md:border-r border-slate-100">
            <div className="text-[13px] font-bold text-slate-400 tracking-wide uppercase mb-[22px]">
              강점
            </div>
            <div className="flex flex-col gap-4">
              {["분석력", "책임감", "적응력"].map((s) => (
                <div key={s} className="flex items-center gap-3.5">
                  <span className="w-[9px] h-[9px] rounded-full bg-accent flex-none" />
                  <span className="text-lg font-semibold text-slate-900">{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-[38px] py-9">
            <div className="text-[13px] font-bold text-slate-400 tracking-wide uppercase mb-[22px]">
              성장 포인트
            </div>
            <div className="flex flex-col gap-4">
              {["과도한 고민", "결정 지연"].map((s) => (
                <div key={s} className="flex items-center gap-3.5">
                  <span className="w-[9px] h-[9px] rounded-full bg-slate-300 flex-none" />
                  <span className="text-lg font-semibold text-slate-500">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: `TrustSection.tsx`** (근거: `랜딩페이지.dc.html:133-146`, 배지 데이터 `:246-250`)

```tsx
const badges = [
  { title: "전통 명리학 기반", desc: "수백 년 이어온 해석의 틀 위에서." },
  { title: "정확한 만세력 계산", desc: "출생 정보를 정밀하게 환산합니다." },
  { title: "AI 심층 해석", desc: "복잡한 내용을 읽기 쉬운 언어로." },
];

export function TrustSection() {
  return (
    <section id="trust" className="max-w-[1120px] mx-auto px-8 py-[104px] text-center">
      <h2 className="text-[clamp(28px,3.6vw,42px)] font-bold tracking-tight mb-4">
        믿을 수 있는 분석
      </h2>
      <p className="text-lg text-slate-400 mb-[52px]">전통과 기술이 함께 만드는, 신중한 리포트.</p>
      <div className="flex items-stretch justify-center gap-5 flex-wrap">
        {badges.map((b) => (
          <div
            key={b.title}
            className="flex-1 min-w-[240px] max-w-[300px] bg-white border border-slate-100 rounded-[20px] px-7 py-[30px] shadow-[0_1px_3px_rgba(17,24,39,.04)]"
          >
            <div className="w-[42px] h-[42px] rounded-full bg-accent-50 text-accent flex items-center justify-center mx-auto mb-[18px] text-[17px]">
              ✓
            </div>
            <div className="text-[17px] font-bold tracking-tight">{b.title}</div>
            <p className="text-sm leading-relaxed text-slate-400 mt-2">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 7: `FooterCta.tsx`** (근거: `랜딩페이지.dc.html:148-164`)

```tsx
import Link from "next/link";

export function FooterCta() {
  return (
    <section className="bg-slate-900 text-white">
      <div className="max-w-[1120px] mx-auto px-8 py-[108px] text-center">
        <h2 className="text-[clamp(32px,4.4vw,50px)] font-bold tracking-tight leading-tight mb-[18px]">
          지금, 나를 이해하는
          <br />
          여정을 시작하세요
        </h2>
        <p className="text-lg text-slate-400 mb-[38px]">
          몇 가지 정보만 입력하면, 당신만의 리포트가 완성됩니다.
        </p>
        <Link
          href="/funnel?step=name"
          className="inline-block text-[17px] font-semibold text-white bg-accent px-[34px] py-[17px] rounded-[15px] shadow-[0_16px_40px_-12px_rgba(79,70,229,.5)] hover:opacity-90"
        >
          내 리포트 만들기
        </Link>
      </div>
      <div className="border-t border-slate-800">
        <div className="max-w-[1120px] mx-auto px-8 py-7 flex items-center justify-between flex-wrap gap-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-[26px] h-[26px] rounded-lg bg-white flex items-center justify-center text-slate-900 font-semibold text-[13px]">
              사
            </div>
            <span className="font-semibold text-[14.5px]">사주</span>
          </div>
          <div className="text-[13px] text-slate-500">나를 더 깊이 이해하는 가장 차분한 방법.</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 8: `page.tsx` 조립**

`src/app/page.tsx` 전체를 아래로 교체:

```tsx
import { LandingNav } from "./_components/LandingNav";
import { Hero } from "./_components/Hero";
import { KnowSection } from "./_components/KnowSection";
import { SampleReport } from "./_components/SampleReport";
import { TrustSection } from "./_components/TrustSection";
import { FooterCta } from "./_components/FooterCta";

export default function Home() {
  return (
    <div className="flex-1">
      <LandingNav />
      <Hero />
      <KnowSection />
      <SampleReport />
      <TrustSection />
      <FooterCta />
    </div>
  );
}
```

- [ ] **Step 9: 타입체크 + 빌드 + 린트**

Run: `npm run typecheck && npm run build && npm run lint`
Expected: 모두 exit 0.

- [ ] **Step 10: 개발 서버로 랜딩 확인**

Run: `npm run dev`, `http://localhost:3000` 접속
확인: 히어로/미리보기 카드/알아보기/예시/신뢰/푸터 CTA 렌더, "내 리포트 만들기" 클릭 → `/funnel?step=name` 이동, 반응형(창 좁힐 때 그리드/레일 대응). 확인 후 종료.

- [ ] **Step 11: Commit**

```bash
git add src/app/_components src/app/page.tsx
git commit -m "feat: 랜딩 페이지"
```

---

## Self-Review (작성자 확인 완료)

**Spec coverage:**
- §2 스택/토큰/폰트 → Task 1 ✓
- §3 라우트(`/`, `/funnel`) → Task 11, 12 ✓
- §4.1 값=Context → Task 7 ✓ / §4.2 스텝=쿼리 → Task 8 ✓ / §4.3 새로고침 가드 → Task 11 Step 3 ✓ / §4.4 검증 → Task 11 `canNext` + Task 5 ✓
- §5 컴포넌트 분리(components/ 프리미티브 + app 하위 co-location) → Task 2~4(프리미티브), 9~12(전용) ✓
- §5.1 반응형 레이아웃 → Task 9 `FunnelLayout` ✓
- §6 Tailwind 토큰 번역 → 전 Task ✓
- §7 데이터 흐름 → Task 11 ✓
- §8 에러 처리(이름/성별/알수없는 step) → Task 11 `canNext`, 가드 ✓
- §9 테스트(steps/date) → Task 5, 6 ✓
- §10 범위 밖(리포트/음양력/진태양시 stub, 분석중 포함) → Task 11 리포트 stub + AnalyzingScreen ✓

**Placeholder scan:** "TBD/TODO/적절히 처리" 없음. 모든 코드 스텝에 완전한 코드 포함. 디자인 시각 번역 컴포넌트는 `design/project/*.dc.html`의 정확한 라인을 근거로 명시(진실 소스가 리포에 존재).

**Type consistency:**
- `StepKey`/`STEPS`/`nextStep`/`prevStep`/`isValidStep`/`stepIndex` — Task 5 정의, Task 8·9에서 동일 시그니처 사용 ✓
- `FunnelData`/`useFunnel`/`update`/`reset` — Task 7 정의, Task 10·11에서 동일 사용 ✓
- `useFunnelNav` 반환 `{ step,index,total,goNext,goBack,goTo }` — Task 8 정의, Task 11 사용 일치 ✓
- `WheelItem { value:number; label:string }` — Task 4 정의, Date/TimeWheelPicker에서 동일 ✓
- `formatDate`/`formatTime` — Task 6 정의, Task 10 ReviewStep 사용 ✓

---

## Execution Handoff

계획 완료 — 실행 방식은 아래에서 선택.
