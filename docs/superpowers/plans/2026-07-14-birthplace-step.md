# 출생지 스텝 + 경도 보정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 퍼널에 출생지(지역) 스텝을 추가해 국가·지역별 경도를 사주 계산에 전달하고, 한국·일본 사용자 모두 정확한 시주 보정을 받게 한다.

**Architecture:** 지역→경도 매핑(`regions.ts`)과 locale→국가 판별(`locale.ts`)을 순수 모듈로 두고, `timeKnown`일 때만 노출되는 `BirthPlaceStep`을 추가한다. 스텝 네비게이션을 정적 배열에서 `activeSteps(timeKnown)` 기반 동적 목록으로 바꿔 조건부 스텝과 진행바 총계를 처리한다. 제출 시 `toBirthInput()`이 `FunnelData`를 `BirthInput`으로 변환하며 경도·보정 여부를 채운다.

**Tech Stack:** Next.js(비표준 버전 — 아래 제약 참조), React, TypeScript, Vitest(node 환경), Tailwind.

## Global Constraints

- **비표준 Next.js:** 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 읽는다. API·규약이 학습 데이터와 다를 수 있다 (AGENTS.md).
- **테스트 환경은 node:** `vitest.config.ts`의 `environment: "node"`. React Testing Library/jsdom 없음. **컴포넌트 렌더 테스트를 추가하지 않는다.** 순수 로직 모듈만 테스트하고, 컴포넌트는 기존 패턴(GenderStep 등, 무테스트)을 따른다. UI는 `npm run typecheck`로 검증.
- **테스트 러너:** `npm run test`(= `vitest run`). 단일 파일: `npx vitest run <path>`.
- **경도 보정 계산은 라이브러리 담당:** `@fullstackfamily/manseryeok`의 `calculateSaju`가 `(135 - longitude) * 4분` 보정을 수행. 우리 코드는 경도 매핑과 파라미터 전달만 한다.
- **국가는 locale로만 결정:** `ko → KR`, `ja → JP`. 국가 수동 변경 UI 없음. 현재 `getLocale()`는 `"ko"` 고정.
- **한국어 copy**, 기존 퍼널 컴포넌트의 Tailwind 토큰(`accent`, `accent-50`, `slate-*` 등) 재사용.
- **경도 값은 스펙 테이블에서 그대로 복사** (`docs/superpowers/specs/2026-07-14-birthplace-step-design.md`).

---

## File Structure

- `src/app/funnel/_lib/regions.ts` (신설) — 지역 데이터 + 경도 매핑
- `src/app/funnel/_lib/regions.test.ts` (신설)
- `src/app/funnel/_lib/locale.ts` (신설) — locale→국가
- `src/app/funnel/_lib/locale.test.ts` (신설)
- `src/app/funnel/_context/FunnelContext.tsx` (수정) — `birthPlace` 필드
- `src/app/funnel/_components/steps/BirthPlaceStep.tsx` (신설) — 출생지 UI
- `src/app/funnel/_lib/steps.ts` (수정) — 동적 스텝 목록
- `src/app/funnel/_lib/steps.test.ts` (수정)
- `src/app/funnel/_hooks/useFunnelNav.ts` (수정) — 동적 목록 사용
- `src/app/funnel/page.tsx` (수정) — stepEl 등록 + 가드
- `src/app/funnel/_components/steps/ReviewStep.tsx` (수정) — 출생지 행
- `src/app/funnel/_lib/toBirthInput.ts` (신설) — FunnelData→BirthInput
- `src/app/funnel/_lib/toBirthInput.test.ts` (신설)

---

### Task 1: 지역 데이터 모듈 (`regions.ts`)

**Files:**
- Create: `src/app/funnel/_lib/regions.ts`
- Test: `src/app/funnel/_lib/regions.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type Country = "KR" | "JP"`
  - `interface Region { id: string; ko: string; ja: string; lon: number }`
  - `const KR_REGIONS: Region[]`, `const JP_REGIONS: Region[]`
  - `const DEFAULT_REGION_ID: Record<Country, string>`
  - `getRegions(country: Country): Region[]`
  - `findRegion(country: Country, id: string): Region | undefined`
  - `resolveLongitude(birthPlace: { country: Country; regionId: string } | null, country: Country): number`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/app/funnel/_lib/regions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  getRegions,
  findRegion,
  resolveLongitude,
  DEFAULT_REGION_ID,
} from "./regions";

describe("regions", () => {
  it("KR 17개, JP 47개를 가진다", () => {
    expect(getRegions("KR")).toHaveLength(17);
    expect(getRegions("JP")).toHaveLength(47);
  });

  it("id는 국가 내에서 유일하다", () => {
    for (const c of ["KR", "JP"] as const) {
      const ids = getRegions(c).map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("기본 지역 id가 실제로 존재한다", () => {
    expect(findRegion("KR", DEFAULT_REGION_ID.KR)).toBeDefined();
    expect(findRegion("JP", DEFAULT_REGION_ID.JP)).toBeDefined();
  });

  it("resolveLongitude는 선택된 지역의 경도를 반환한다", () => {
    expect(resolveLongitude({ country: "KR", regionId: "seoul" }, "KR")).toBe(126.98);
    expect(resolveLongitude({ country: "JP", regionId: "tokyo" }, "JP")).toBe(139.69);
  });

  it("resolveLongitude는 null이면 국가 기본 경도를 반환한다", () => {
    expect(resolveLongitude(null, "KR")).toBe(126.98); // seoul
    expect(resolveLongitude(null, "JP")).toBe(139.69); // tokyo
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/app/funnel/_lib/regions.test.ts`
Expected: FAIL — `Cannot find module './regions'`

- [ ] **Step 3: 구현 작성**

Create `src/app/funnel/_lib/regions.ts`:

```ts
export type Country = "KR" | "JP";

export interface Region {
  /** 안정적 식별자 */
  id: string;
  /** 한국어 라벨 */
  ko: string;
  /** 일본어 라벨 */
  ja: string;
  /** 대표 경도 (도청/현청 소재지) */
  lon: number;
}

// 대표 경도 = 도청 소재지
export const KR_REGIONS: Region[] = [
  { id: "seoul", ko: "서울", ja: "ソウル", lon: 126.98 },
  { id: "busan", ko: "부산", ja: "釜山", lon: 129.08 },
  { id: "daegu", ko: "대구", ja: "大邱", lon: 128.6 },
  { id: "incheon", ko: "인천", ja: "仁川", lon: 126.71 },
  { id: "gwangju", ko: "광주", ja: "光州", lon: 126.85 },
  { id: "daejeon", ko: "대전", ja: "大田", lon: 127.38 },
  { id: "ulsan", ko: "울산", ja: "蔚山", lon: 129.31 },
  { id: "sejong", ko: "세종", ja: "世宗", lon: 127.29 },
  { id: "gyeonggi", ko: "경기", ja: "京畿", lon: 127.03 },
  { id: "gangwon", ko: "강원", ja: "江原", lon: 127.73 },
  { id: "chungbuk", ko: "충북", ja: "忠北", lon: 127.49 },
  { id: "chungnam", ko: "충남", ja: "忠南", lon: 126.66 },
  { id: "jeonbuk", ko: "전북", ja: "全北", lon: 127.11 },
  { id: "jeonnam", ko: "전남", ja: "全南", lon: 126.46 },
  { id: "gyeongbuk", ko: "경북", ja: "慶北", lon: 128.73 },
  { id: "gyeongnam", ko: "경남", ja: "慶南", lon: 128.68 },
  { id: "jeju", ko: "제주", ja: "済州", lon: 126.53 },
];

// 대표 경도 = 県庁所在地
export const JP_REGIONS: Region[] = [
  { id: "hokkaido", ko: "홋카이도", ja: "北海道", lon: 141.35 },
  { id: "aomori", ko: "아오모리", ja: "青森県", lon: 140.74 },
  { id: "iwate", ko: "이와테", ja: "岩手県", lon: 141.15 },
  { id: "miyagi", ko: "미야기", ja: "宮城県", lon: 140.87 },
  { id: "akita", ko: "아키타", ja: "秋田県", lon: 140.1 },
  { id: "yamagata", ko: "야마가타", ja: "山形県", lon: 140.36 },
  { id: "fukushima", ko: "후쿠시마", ja: "福島県", lon: 140.47 },
  { id: "ibaraki", ko: "이바라키", ja: "茨城県", lon: 140.45 },
  { id: "tochigi", ko: "도치기", ja: "栃木県", lon: 139.88 },
  { id: "gunma", ko: "군마", ja: "群馬県", lon: 139.06 },
  { id: "saitama", ko: "사이타마", ja: "埼玉県", lon: 139.65 },
  { id: "chiba", ko: "지바", ja: "千葉県", lon: 140.12 },
  { id: "tokyo", ko: "도쿄", ja: "東京都", lon: 139.69 },
  { id: "kanagawa", ko: "가나가와", ja: "神奈川県", lon: 139.64 },
  { id: "niigata", ko: "니가타", ja: "新潟県", lon: 139.02 },
  { id: "toyama", ko: "도야마", ja: "富山県", lon: 137.21 },
  { id: "ishikawa", ko: "이시카와", ja: "石川県", lon: 136.63 },
  { id: "fukui", ko: "후쿠이", ja: "福井県", lon: 136.22 },
  { id: "yamanashi", ko: "야마나시", ja: "山梨県", lon: 138.57 },
  { id: "nagano", ko: "나가노", ja: "長野県", lon: 138.18 },
  { id: "gifu", ko: "기후", ja: "岐阜県", lon: 136.72 },
  { id: "shizuoka", ko: "시즈오카", ja: "静岡県", lon: 138.38 },
  { id: "aichi", ko: "아이치", ja: "愛知県", lon: 136.91 },
  { id: "mie", ko: "미에", ja: "三重県", lon: 136.51 },
  { id: "shiga", ko: "시가", ja: "滋賀県", lon: 135.87 },
  { id: "kyoto", ko: "교토", ja: "京都府", lon: 135.76 },
  { id: "osaka", ko: "오사카", ja: "大阪府", lon: 135.52 },
  { id: "hyogo", ko: "효고", ja: "兵庫県", lon: 135.18 },
  { id: "nara", ko: "나라", ja: "奈良県", lon: 135.83 },
  { id: "wakayama", ko: "와카야마", ja: "和歌山県", lon: 135.17 },
  { id: "tottori", ko: "돗토리", ja: "鳥取県", lon: 134.24 },
  { id: "shimane", ko: "시마네", ja: "島根県", lon: 133.05 },
  { id: "okayama", ko: "오카야마", ja: "岡山県", lon: 133.93 },
  { id: "hiroshima", ko: "히로시마", ja: "広島県", lon: 132.46 },
  { id: "yamaguchi", ko: "야마구치", ja: "山口県", lon: 131.47 },
  { id: "tokushima", ko: "도쿠시마", ja: "徳島県", lon: 134.56 },
  { id: "kagawa", ko: "가가와", ja: "香川県", lon: 134.04 },
  { id: "ehime", ko: "에히메", ja: "愛媛県", lon: 132.77 },
  { id: "kochi", ko: "고치", ja: "高知県", lon: 133.53 },
  { id: "fukuoka", ko: "후쿠오카", ja: "福岡県", lon: 130.42 },
  { id: "saga", ko: "사가", ja: "佐賀県", lon: 130.3 },
  { id: "nagasaki", ko: "나가사키", ja: "長崎県", lon: 129.87 },
  { id: "kumamoto", ko: "구마모토", ja: "熊本県", lon: 130.74 },
  { id: "oita", ko: "오이타", ja: "大分県", lon: 131.61 },
  { id: "miyazaki", ko: "미야자키", ja: "宮崎県", lon: 131.42 },
  { id: "kagoshima", ko: "가고시마", ja: "鹿児島県", lon: 130.56 },
  { id: "okinawa", ko: "오키나와", ja: "沖縄県", lon: 127.68 },
];

export const DEFAULT_REGION_ID: Record<Country, string> = {
  KR: "seoul",
  JP: "tokyo",
};

export function getRegions(country: Country): Region[] {
  return country === "KR" ? KR_REGIONS : JP_REGIONS;
}

export function findRegion(country: Country, id: string): Region | undefined {
  return getRegions(country).find((r) => r.id === id);
}

/** birthPlace가 null(스킵)이면 국가 기본 지역 경도로 대체한다. */
export function resolveLongitude(
  birthPlace: { country: Country; regionId: string } | null,
  country: Country,
): number {
  if (birthPlace) {
    const r = findRegion(birthPlace.country, birthPlace.regionId);
    if (r) return r.lon;
  }
  const fallback = findRegion(country, DEFAULT_REGION_ID[country]);
  // DEFAULT_REGION_ID는 항상 유효한 지역을 가리키므로 fallback은 존재한다.
  return fallback!.lon;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/app/funnel/_lib/regions.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/app/funnel/_lib/regions.ts src/app/funnel/_lib/regions.test.ts
git commit -m "feat: 지역→경도 매핑 모듈 (한국 17 / 일본 47)"
```

---

### Task 2: locale→국가 모듈 (`locale.ts`)

**Files:**
- Create: `src/app/funnel/_lib/locale.ts`
- Test: `src/app/funnel/_lib/locale.test.ts`

**Interfaces:**
- Consumes: `Country` from `./regions`
- Produces:
  - `type Locale = "ko" | "ja"`
  - `getLocale(): Locale`
  - `localeToCountry(locale: Locale): Country`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/app/funnel/_lib/locale.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getLocale, localeToCountry } from "./locale";

describe("locale", () => {
  it("localeToCountry는 ko→KR, ja→JP", () => {
    expect(localeToCountry("ko")).toBe("KR");
    expect(localeToCountry("ja")).toBe("JP");
  });

  it("getLocale는 현재 ko 고정", () => {
    expect(getLocale()).toBe("ko");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/app/funnel/_lib/locale.test.ts`
Expected: FAIL — `Cannot find module './locale'`

- [ ] **Step 3: 구현 작성**

Create `src/app/funnel/_lib/locale.ts`:

```ts
import type { Country } from "./regions";

export type Locale = "ko" | "ja";

/**
 * 현재 locale. i18n 도입 전까지 "ko" 고정.
 * 추후 i18n이 붙으면 이 함수 내부만 교체한다.
 */
export function getLocale(): Locale {
  return "ko";
}

export function localeToCountry(locale: Locale): Country {
  return locale === "ja" ? "JP" : "KR";
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/app/funnel/_lib/locale.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/app/funnel/_lib/locale.ts src/app/funnel/_lib/locale.test.ts
git commit -m "feat: locale→국가 판별 모듈"
```

---

### Task 3: FunnelContext에 birthPlace 필드 추가

**Files:**
- Modify: `src/app/funnel/_context/FunnelContext.tsx`

**Interfaces:**
- Consumes: `Country` from `../_lib/regions`
- Produces: `FunnelData.birthPlace: { country: Country; regionId: string } | null`

이 태스크는 타입/상태 변경만이라 전용 단위 테스트가 없다. `npm run typecheck`로 검증한다.

- [ ] **Step 1: birthPlace 필드 추가**

Modify `src/app/funnel/_context/FunnelContext.tsx`.

파일 상단 import 추가 (기존 `"use client";`와 React import 아래):

```ts
import type { Country } from "../_lib/regions";
```

`FunnelData` 인터페이스에 필드 추가 (`trueSolar: boolean;` 위):

```ts
  birthPlace: { country: Country; regionId: string } | null;
```

`initialData`에 초기값 추가 (`trueSolar: true,` 위):

```ts
  birthPlace: null,
```

- [ ] **Step 2: 타입 검증**

Run: `npm run typecheck`
Expected: 에러 없음 (birthPlace는 아직 아무도 읽지 않으므로 통과)

- [ ] **Step 3: 커밋**

```bash
git add src/app/funnel/_context/FunnelContext.tsx
git commit -m "feat: FunnelData에 birthPlace 상태 추가"
```

---

### Task 4: BirthPlaceStep 컴포넌트 + page.tsx 등록

**Files:**
- Create: `src/app/funnel/_components/steps/BirthPlaceStep.tsx`
- Modify: `src/app/funnel/page.tsx` (import + stepEl 맵에 등록)

**Interfaces:**
- Consumes: `useFunnel` from `../../_context/FunnelContext`; `getLocale`, `localeToCountry` from `../../_lib/locale`; `getRegions`, `DEFAULT_REGION_ID`, `Region` from `../../_lib/regions`
- Produces: `BirthPlaceStep` (default export 없음, named export)

이 태스크에서 `BirthPlaceStep`은 stepEl 맵에 등록되지만 아직 `activeSteps`에 birthplace가 없어 **도달 불가**(안전). Task 5에서 라우팅이 열린다. node 환경이라 컴포넌트 렌더 테스트는 없고 `npm run typecheck`로 검증한다.

- [ ] **Step 1: BirthPlaceStep 작성**

Create `src/app/funnel/_components/steps/BirthPlaceStep.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useFunnel } from "../../_context/FunnelContext";
import { getLocale, localeToCountry } from "../../_lib/locale";
import { getRegions, DEFAULT_REGION_ID, type Region } from "../../_lib/regions";

export function BirthPlaceStep() {
  const { data, update } = useFunnel();
  const locale = getLocale();
  const country = localeToCountry(locale);
  const regions = useMemo(() => getRegions(country), [country]);
  const [q, setQ] = useState("");

  // 진입 시 기본 지역(서울/도쿄) 프리셋. 스킵하면 null로 되돌린다.
  useEffect(() => {
    if (!data.birthPlace) {
      update({ birthPlace: { country, regionId: DEFAULT_REGION_ID[country] } });
    }
    // 최초 마운트 시 1회만 실행 (스킵을 덮어쓰지 않도록)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = (r: Region) => (locale === "ja" ? r.ja : r.ko);
  const query = q.trim().toLowerCase();
  const filtered = regions.filter((r) => label(r).toLowerCase().includes(query));

  const selectedId =
    data.birthPlace && data.birthPlace.country === country
      ? data.birthPlace.regionId
      : null;

  return (
    <div>
      <h1 className="text-[32px] font-bold tracking-tight leading-tight mb-2.5">
        어디서 태어났나요?
      </h1>
      <p className="text-[15px] text-slate-500 mb-6">출생지 경도로 시(時)를 정밀 보정해요.</p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="지역 검색"
        aria-label="지역 검색"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none focus:border-accent placeholder:text-slate-300 mb-3"
      />

      <ul className="max-h-[280px] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
        {filtered.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => update({ birthPlace: { country, regionId: r.id } })}
              aria-pressed={selectedId === r.id}
              className={`w-full text-left px-4 py-3 text-[15px] transition-colors ${
                selectedId === r.id
                  ? "bg-accent-50 text-accent font-semibold"
                  : "text-slate-700"
              }`}
            >
              {label(r)}
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-3 text-[14px] text-slate-400">검색 결과가 없어요</li>
        )}
      </ul>

      <button
        type="button"
        onClick={() => update({ birthPlace: null })}
        aria-pressed={data.birthPlace === null}
        className={`w-full flex items-center gap-2.5 mt-4 text-sm font-semibold rounded-xl px-[18px] py-4 transition-all cursor-pointer border ${
          data.birthPlace === null
            ? "border-2 border-accent bg-accent-50 text-accent"
            : "border-slate-200 bg-white text-slate-500"
        }`}
      >
        <span className="text-base">{data.birthPlace === null ? "●" : "○"}</span>
        출생지를 몰라요
      </button>
    </div>
  );
}
```

- [ ] **Step 2: page.tsx에 등록**

Modify `src/app/funnel/page.tsx`.

import 추가 (`ReviewStep` import 아래):

```ts
import { BirthPlaceStep } from "./_components/steps/BirthPlaceStep";
```

`stepEl` 맵에 birthplace 항목 추가 (`time: <BirthTimeStep />,`와 `review: <ReviewStep />,` 사이):

```ts
    birthplace: <BirthPlaceStep />,
```

- [ ] **Step 3: 타입 검증**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/app/funnel/_components/steps/BirthPlaceStep.tsx src/app/funnel/page.tsx
git commit -m "feat: 출생지 선택 스텝 컴포넌트 (검색 리스트 + 스킵)"
```

---

### Task 5: 동적 스텝 네비게이션 (birthplace 라우팅 활성화)

**Files:**
- Modify: `src/app/funnel/_lib/steps.ts`
- Modify: `src/app/funnel/_lib/steps.test.ts`
- Modify: `src/app/funnel/_hooks/useFunnelNav.ts`
- Modify: `src/app/funnel/page.tsx` (가드)

**Interfaces:**
- Consumes: 없음 (내부 리팩터)
- Produces:
  - `type StepKey = "name" | "gender" | "birth" | "time" | "birthplace" | "review"`
  - `const ALL_STEPS: StepKey[]`
  - `activeSteps(timeKnown: boolean): StepKey[]`
  - `stepIndex(steps: StepKey[], step: StepKey): number`
  - `nextStep(steps: StepKey[], step: StepKey): StepKey | null`
  - `prevStep(steps: StepKey[], step: StepKey): StepKey | null`
  - `isValidStep(v: string | null): v is StepKey`

**주의:** `nextStep`/`prevStep`/`stepIndex` 시그니처가 `(steps, step)`로 바뀐다. 모든 호출부(useFunnelNav, page.tsx)를 이 태스크 안에서 함께 수정해 그린 상태를 유지한다.

- [ ] **Step 1: steps.test.ts를 새 시그니처로 재작성 (실패하는 테스트)**

Replace 전체 내용 of `src/app/funnel/_lib/steps.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { activeSteps, stepIndex, nextStep, prevStep, isValidStep } from "./steps";

describe("steps", () => {
  it("activeSteps는 timeKnown이면 birthplace를 포함한다", () => {
    expect(activeSteps(true)).toEqual([
      "name",
      "gender",
      "birth",
      "time",
      "birthplace",
      "review",
    ]);
  });

  it("activeSteps는 timeKnown이 아니면 birthplace를 제외한다", () => {
    expect(activeSteps(false)).toEqual(["name", "gender", "birth", "time", "review"]);
  });

  it("stepIndex는 주어진 목록 기준 인덱스를 반환한다", () => {
    const s = activeSteps(true);
    expect(stepIndex(s, "name")).toBe(0);
    expect(stepIndex(s, "birthplace")).toBe(4);
    expect(stepIndex(s, "review")).toBe(5);
  });

  it("nextStep은 timeKnown이면 time 다음이 birthplace", () => {
    const s = activeSteps(true);
    expect(nextStep(s, "time")).toBe("birthplace");
    expect(nextStep(s, "birthplace")).toBe("review");
    expect(nextStep(s, "review")).toBeNull();
  });

  it("nextStep은 timeKnown이 아니면 time 다음이 review", () => {
    const s = activeSteps(false);
    expect(nextStep(s, "time")).toBe("review");
  });

  it("prevStep은 birthplace 이전이 time, 처음은 null", () => {
    const s = activeSteps(true);
    expect(prevStep(s, "birthplace")).toBe("time");
    expect(prevStep(s, "name")).toBeNull();
  });

  it("isValidStep은 유효 키만 통과", () => {
    expect(isValidStep("birthplace")).toBe(true);
    expect(isValidStep("nope")).toBe(false);
    expect(isValidStep(null)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/app/funnel/_lib/steps.test.ts`
Expected: FAIL — `activeSteps is not a function` / 시그니처 불일치

- [ ] **Step 3: steps.ts 재작성**

Replace 전체 내용 of `src/app/funnel/_lib/steps.ts`:

```ts
export type StepKey = "name" | "gender" | "birth" | "time" | "birthplace" | "review";

export const ALL_STEPS: StepKey[] = [
  "name",
  "gender",
  "birth",
  "time",
  "birthplace",
  "review",
];

/** timeKnown일 때만 birthplace를 포함한 활성 스텝 목록 */
export function activeSteps(timeKnown: boolean): StepKey[] {
  return timeKnown
    ? ["name", "gender", "birth", "time", "birthplace", "review"]
    : ["name", "gender", "birth", "time", "review"];
}

export function stepIndex(steps: StepKey[], step: StepKey): number {
  return steps.indexOf(step);
}

export function nextStep(steps: StepKey[], step: StepKey): StepKey | null {
  const i = steps.indexOf(step);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : null;
}

export function prevStep(steps: StepKey[], step: StepKey): StepKey | null {
  const i = steps.indexOf(step);
  return i > 0 ? steps[i - 1] : null;
}

export function isValidStep(v: string | null): v is StepKey {
  return v !== null && (ALL_STEPS as string[]).includes(v);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/app/funnel/_lib/steps.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: useFunnelNav를 동적 목록으로 수정**

Replace 전체 내용 of `src/app/funnel/_hooks/useFunnelNav.ts`:

```ts
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import {
  type StepKey,
  activeSteps,
  isValidStep,
  nextStep,
  prevStep,
  stepIndex,
} from "../_lib/steps";
import { useFunnel } from "../_context/FunnelContext";

export function useFunnelNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data } = useFunnel();
  const steps = activeSteps(data.timeKnown);

  const rawStep = searchParams.get("step");
  const step: StepKey = isValidStep(rawStep) ? rawStep : "name";

  const goTo = useCallback(
    (s: StepKey) => {
      router.push(`/funnel?step=${s}`);
    },
    [router]
  );

  const goNext = useCallback(() => {
    const n = nextStep(steps, step);
    if (n) router.push(`/funnel?step=${n}`);
  }, [router, steps, step]);

  const goBack = useCallback(() => {
    if (prevStep(steps, step)) router.back();
  }, [router, steps, step]);

  return {
    step,
    index: stepIndex(steps, step),
    total: steps.length,
    goTo,
    goNext,
    goBack,
    rawStep,
  };
}
```

- [ ] **Step 6: page.tsx 가드를 동적 목록 기준으로 수정**

Modify `src/app/funnel/page.tsx`.

import 라인 수정 — `stepIndex`만 쓰던 것을 `activeSteps`와 함께 가져온다:

```ts
import { activeSteps, stepIndex, type StepKey } from "./_lib/steps";
```

가드 `useEffect`를 아래로 교체 (기존 30~36행 블록):

```ts
  // 가드: 현재 스텝이 활성 목록에 없거나 허용 스텝보다 앞서면(수동 URL 이동 등) 되돌린다
  useEffect(() => {
    const steps = activeSteps(data.timeKnown);
    const allowed = earliestAllowedStep(data);
    const stepIdx = stepIndex(steps, step);
    if (stepIdx === -1 || stepIdx > stepIndex(steps, allowed)) {
      router.replace(`/funnel?step=${allowed}`);
    }
  }, [step, data, router]);
```

`handleNext` 안의 가드도 새 시그니처를 쓰지 않으므로 그대로 둔다. 단, `earliestAllowedStep`은 변경 없음(birthplace는 기본값/스킵으로 항상 진행 가능하므로 review 도달을 막지 않는다).

- [ ] **Step 7: 전체 검증**

Run: `npm run typecheck`
Expected: 에러 없음

Run: `npm run test`
Expected: 전체 PASS

- [ ] **Step 8: 커밋**

```bash
git add src/app/funnel/_lib/steps.ts src/app/funnel/_lib/steps.test.ts src/app/funnel/_hooks/useFunnelNav.ts src/app/funnel/page.tsx
git commit -m "feat: timeKnown 기반 동적 스텝 목록 + birthplace 라우팅 활성화"
```

---

### Task 6: ReviewStep에 출생지 행 추가

**Files:**
- Modify: `src/app/funnel/_components/steps/ReviewStep.tsx`

**Interfaces:**
- Consumes: `getLocale`, `localeToCountry` from `../../_lib/locale`; `findRegion` from `../../_lib/regions`
- Produces: 없음 (UI)

`timeKnown`일 때만 "출생지" 행을 노출한다. `birthPlace`가 null이면 "출생지 모름", 있으면 지역 라벨. node 환경이라 렌더 테스트 없음 — `npm run typecheck`로 검증.

- [ ] **Step 1: 출생지 라벨 + 행 추가**

Modify `src/app/funnel/_components/steps/ReviewStep.tsx`.

import 추가 (`formatDate, formatTime` import 아래):

```ts
import { getLocale, localeToCountry } from "../../_lib/locale";
import { findRegion } from "../../_lib/regions";
```

`ReviewStep` 함수 안, `rows` 배열 정의 **뒤에** 다음을 추가한다 (birthPlace 라벨 계산 + 조건부 행 추가):

```ts
  if (data.timeKnown) {
    const bp = data.birthPlace;
    let placeLabel = "출생지 모름";
    if (bp) {
      const r = findRegion(bp.country, bp.regionId);
      if (r) placeLabel = getLocale() === "ja" ? r.ja : r.ko;
    }
    rows.push({ k: "출생지", v: placeLabel });
  }
```

주의: `rows`는 `const rows: { k: string; v: string }[] = [...]`로 선언돼 있어 `push` 가능하다. 위 블록은 `rows` 선언과 `return (` 사이에 넣는다.

- [ ] **Step 2: 타입 검증**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/app/funnel/_components/steps/ReviewStep.tsx
git commit -m "feat: 확인 화면에 출생지 행 추가"
```

---

### Task 7: toBirthInput 변환 헬퍼

**Files:**
- Create: `src/app/funnel/_lib/toBirthInput.ts`
- Test: `src/app/funnel/_lib/toBirthInput.test.ts`

**Interfaces:**
- Consumes: `BirthInput` from `@/lib/saju-core`; `FunnelData` from `../_context/FunnelContext`; `getLocale`, `localeToCountry` from `./locale`; `resolveLongitude` from `./regions`
- Produces: `toBirthInput(data: FunnelData): BirthInput`

제출 시 `FunnelData`를 API 입력으로 변환한다. 경도는 `resolveLongitude`(스킵이면 국가 기본값), 보정 여부는 `trueSolar`. 시간을 모르면 hour/minute를 생략한다. 현재 퍼널은 `/report` 스텁으로만 이동하므로 이 헬퍼는 **API 배선 시점에 연결**한다 (아래 주석 참조).

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/app/funnel/_lib/toBirthInput.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toBirthInput } from "./toBirthInput";
import type { FunnelData } from "../_context/FunnelContext";

function baseData(): FunnelData {
  return {
    name: "홍길동",
    gender: "male",
    calendar: "solar",
    birth: { y: 1990, m: 5, d: 20 },
    timeKnown: true,
    time: { h: 8, m: 30 },
    birthPlace: { country: "KR", regionId: "seoul" },
    trueSolar: true,
  };
}

describe("toBirthInput", () => {
  it("선택한 지역의 경도와 보정 여부를 매핑한다", () => {
    const input = toBirthInput(baseData());
    expect(input).toMatchObject({
      year: 1990,
      month: 5,
      day: 20,
      hour: 8,
      minute: 30,
      calendar: "solar",
      gender: "male",
      longitude: 126.98, // seoul
      applyTimeCorrection: true,
    });
  });

  it("출생지 스킵(null)이면 국가 기본 경도(서울)를 쓴다", () => {
    const input = toBirthInput({ ...baseData(), birthPlace: null });
    expect(input.longitude).toBe(126.98);
  });

  it("시간을 모르면 hour/minute를 생략한다", () => {
    const input = toBirthInput({ ...baseData(), timeKnown: false, time: null });
    expect(input.hour).toBeUndefined();
    expect(input.minute).toBeUndefined();
  });

  it("trueSolar가 false면 보정을 끈다", () => {
    const input = toBirthInput({ ...baseData(), trueSolar: false });
    expect(input.applyTimeCorrection).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/app/funnel/_lib/toBirthInput.test.ts`
Expected: FAIL — `Cannot find module './toBirthInput'`

- [ ] **Step 3: 구현 작성**

Create `src/app/funnel/_lib/toBirthInput.ts`:

```ts
import type { BirthInput } from "@/lib/saju-core";
import type { FunnelData } from "../_context/FunnelContext";
import { getLocale, localeToCountry } from "./locale";
import { resolveLongitude } from "./regions";

/**
 * 퍼널 입력을 사주 API 입력으로 변환한다.
 * 경도는 출생지(스킵 시 국가 기본), 보정 여부는 trueSolar를 따른다.
 *
 * 사용처: 리뷰 → 분석 시작 시 POST /api/saju 배선 지점에서 호출.
 */
export function toBirthInput(data: FunnelData): BirthInput {
  if (!data.birth || !data.gender) {
    throw new Error("생년월일·성별이 필요합니다");
  }

  const country = localeToCountry(getLocale());
  const hasTime = data.timeKnown && data.time !== null;

  return {
    year: data.birth.y,
    month: data.birth.m,
    day: data.birth.d,
    hour: hasTime ? data.time!.h : undefined,
    minute: hasTime ? data.time!.m : undefined,
    calendar: data.calendar,
    gender: data.gender,
    longitude: resolveLongitude(data.birthPlace, country),
    applyTimeCorrection: data.trueSolar,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/app/funnel/_lib/toBirthInput.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 전체 회귀 검증**

Run: `npm run test`
Expected: 전체 PASS

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add src/app/funnel/_lib/toBirthInput.ts src/app/funnel/_lib/toBirthInput.test.ts
git commit -m "feat: FunnelData→BirthInput 변환 헬퍼 (경도·보정 매핑)"
```

---

## Self-Review 결과

**Spec 커버리지:**
- 지역 데이터/경도 매핑 → Task 1 ✓
- locale→국가 (ko 고정, 변경 UI 없음) → Task 2 ✓
- birthPlace 상태 → Task 3 ✓
- 검색 리스트 UI + 스킵 → Task 4 ✓
- 별도 스텝, timeKnown 조건부, 진행바 총계 자동 → Task 5 ✓
- 확인 화면 출생지 행 (스킵 시 "출생지 모름", 시간 모름 시 숨김) → Task 6 ✓
- toBirthInput 매핑 (경도·applyTimeCorrection, 배선 지점 주석) → Task 7 ✓
- 진태양시 토글 유지 → 기존 ReviewStep 유지, 변경 없음 ✓

**타입 일관성:** `Country`/`Region`/`resolveLongitude`/`activeSteps`/`stepIndex(steps, step)` 등 시그니처가 태스크 간 일치. Task 5에서 시그니처 변경 시 모든 호출부(useFunnelNav, page.tsx) 동시 수정으로 그린 유지.

**플레이스홀더:** 없음. 모든 코드/명령/기대 출력 명시.

**범위:** 단일 플랜 규모. 도시 세분화·균시차·외부 API는 스펙과 동일하게 제외.
