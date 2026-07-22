# 음력 윤달 입력 지원 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 퍼널에서 음력 윤달(閏月) 선택을 캡처해 `isLeapMonth`로 사주 계산 API까지 전달하고, 확인 화면에 표시한다.

**Architecture:** 엔진(`saju-core/chart.ts`)과 API(`api/saju/_lib/input.ts`)는 이미 `isLeapMonth`를 지원한다. 남은 배선은 (1) manseryeok에서 파생한 소형 윤달 표로 "이 음력 연·월에 윤달이 있는가"를 판별하는 순수 헬퍼, (2) `FunnelData.isLeapMonth` 상태, (3) 조건부 윤달 토글 UI, (4) `toBirthInput` 전달, (5) 리뷰 표시다.

**Tech Stack:** Next.js(커스텀), React, TypeScript, vitest, `@fullstackfamily/manseryeok`.

## Global Constraints

- 코드/주석/카피는 기존 파일과 동일하게 **한국어**로 작성한다.
- 새 코드 작성 전 필요한 경우 `node_modules/next/dist/docs/`의 관련 가이드를 확인한다(AGENTS.md).
- 테스트는 vitest(`describe`/`it`/`expect`, `globals: true`), 환경은 `node`다. 컴포넌트 테스트 인프라(testing-library/jsdom)는 없으므로 **UI 컴포넌트는 순수 헬퍼로 분리해 단위 테스트**하고, 컴포넌트 배선은 `typecheck`+`lint`로 검증한다.
- 지원 음력 연도 범위: **1930–2050**(manseryeok 및 퍼널 입력 범위).
- 테스트 실행: `npm test`, 타입: `npm run typecheck`, 린트: `npm run lint`.

---

## File Structure

- `src/lib/saju-core/data/leap-months.ts` — (신규) 파생 윤달 표 `LEAP_MONTHS: Record<year, month>`.
- `src/lib/saju-core/leap.ts` — (신규) `hasLeapMonth`, `getLeapMonth` 헬퍼.
- `src/lib/saju-core/leap.test.ts` — (신규) 헬퍼 단위 테스트.
- `src/lib/saju-core/leap-months.gen.test.ts` — (신규) 표가 manseryeok 산출과 일치하는지 검증.
- `src/lib/saju-core/index.ts` — (수정) 헬퍼 re-export.
- `src/lib/saju-core/chart.test.ts` — (수정) 윤달 vs 평달 원국 구분 스냅샷 추가.
- `src/app/funnel/_context/FunnelContext.tsx` — (수정) `isLeapMonth` 필드.
- `src/app/funnel/_lib/toBirthInput.ts` — (수정) `isLeapMonth` 전달.
- `src/app/funnel/_lib/toBirthInput.test.ts` — (수정) 전달 케이스.
- `src/app/funnel/_lib/date.ts` — (수정) `formatCalendarLabel` 순수 헬퍼.
- `src/app/funnel/_lib/date.test.ts` — (신규) `formatCalendarLabel` 단위 테스트.
- `src/app/funnel/_components/steps/BirthDateStep.tsx` — (수정) 조건부 윤달 토글 + 리셋.
- `src/app/funnel/_components/steps/ReviewStep.tsx` — (수정) 윤달 표시.

---

## Task 1: 윤달 표 + 판별 헬퍼 (saju-core)

**Files:**
- Create: `src/lib/saju-core/data/leap-months.ts`
- Create: `src/lib/saju-core/leap.ts`
- Create: `src/lib/saju-core/leap.test.ts`
- Create: `src/lib/saju-core/leap-months.gen.test.ts`
- Modify: `src/lib/saju-core/index.ts`

**Interfaces:**
- Consumes: `lunarToSolar` from `@fullstackfamily/manseryeok`(gen 테스트에서만).
- Produces:
  - `LEAP_MONTHS: Record<number, number>` (음력 연도 → 윤달 월 1~12)
  - `getLeapMonth(year: number): number | null`
  - `hasLeapMonth(year: number, month: number): boolean`

- [ ] **Step 1: 윤달 표 파일 생성**

`src/lib/saju-core/data/leap-months.ts`:

```ts
// 파생 데이터 — 음력 연도별 윤달 월(1~12). 윤달이 없는 해는 항목 없음.
// manseryeok(1930~2050)에서 도출. leap-months.gen.test.ts가 정확성을 검증한다.
export const LEAP_MONTHS: Record<number, number> = {
  1930: 6, 1933: 5, 1936: 3, 1938: 7, 1941: 6, 1944: 4, 1947: 2, 1949: 7,
  1952: 5, 1955: 3, 1957: 8, 1960: 6, 1963: 4, 1966: 3, 1968: 7, 1971: 5,
  1974: 4, 1976: 8, 1979: 6, 1982: 4, 1984: 10, 1987: 6, 1990: 5, 1993: 3,
  1995: 8, 1998: 5, 2001: 4, 2004: 2, 2006: 7, 2009: 5, 2012: 3, 2014: 9,
  2017: 5, 2020: 4, 2023: 2, 2025: 6, 2028: 5, 2031: 3, 2033: 11, 2036: 6,
  2039: 5, 2042: 2, 2044: 7, 2047: 5, 2050: 3,
};
```

- [ ] **Step 2: 헬퍼 단위 테스트 작성 (실패)**

`src/lib/saju-core/leap.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getLeapMonth, hasLeapMonth } from "./leap";

describe("getLeapMonth", () => {
  it("윤달이 있는 해는 윤달 월을 반환한다", () => {
    expect(getLeapMonth(2020)).toBe(4); // 윤4월
    expect(getLeapMonth(2025)).toBe(6);
  });
  it("윤달이 없는 해는 null을 반환한다", () => {
    expect(getLeapMonth(2021)).toBeNull();
  });
});

describe("hasLeapMonth", () => {
  it("해당 월이 그 해의 윤달이면 true", () => {
    expect(hasLeapMonth(2020, 4)).toBe(true);
  });
  it("윤달 월이 아니면 false", () => {
    expect(hasLeapMonth(2020, 5)).toBe(false);
    expect(hasLeapMonth(2021, 4)).toBe(false);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- leap.test`
Expected: FAIL — `Cannot find module './leap'` (또는 export 없음)

- [ ] **Step 4: 헬퍼 구현**

`src/lib/saju-core/leap.ts`:

```ts
import { LEAP_MONTHS } from "./data/leap-months";

/** 해당 음력 연도의 윤달 월(1~12). 없으면 null. */
export function getLeapMonth(year: number): number | null {
  return LEAP_MONTHS[year] ?? null;
}

/** 주어진 음력 연·월이 그 해의 윤달인지 여부. */
export function hasLeapMonth(year: number, month: number): boolean {
  return LEAP_MONTHS[year] === month;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- leap.test`
Expected: PASS

- [ ] **Step 6: 표 검증(생성) 테스트 작성**

`src/lib/saju-core/leap-months.gen.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { lunarToSolar } from "@fullstackfamily/manseryeok";
import { LEAP_MONTHS } from "./data/leap-months";

// lunarToSolar(y, m, 1, true)는 윤달이 있는 월에는 양력 날짜를 반환하고,
// 없는 월에는 InvalidDateError를 던진다. 이를 이용해 표를 재산출·검증한다.
function computeLeapMonths(): Record<number, number> {
  const out: Record<number, number> = {};
  for (let y = 1930; y <= 2050; y++) {
    for (let m = 1; m <= 12; m++) {
      try {
        lunarToSolar(y, m, 1, true);
        out[y] = m; // 한 해에 윤달은 최대 1회
        break;
      } catch {
        // 이 월엔 윤달 없음 — 계속
      }
    }
  }
  return out;
}

describe("LEAP_MONTHS", () => {
  it("manseryeok(1930~2050) 산출과 정확히 일치한다", () => {
    expect(LEAP_MONTHS).toEqual(computeLeapMonths());
  });
});
```

- [ ] **Step 7: 표 검증 테스트 통과 확인**

Run: `npm test -- leap-months.gen`
Expected: PASS (표가 manseryeok 산출과 일치)

- [ ] **Step 8: index.ts에서 re-export**

`src/lib/saju-core/index.ts`의 절기 export 블록 아래(파일 끝)에 추가:

```ts
// 음력 윤달 판별
export { hasLeapMonth, getLeapMonth } from "./leap";
export { LEAP_MONTHS } from "./data/leap-months";
```

- [ ] **Step 9: 타입체크 + 커밋**

```bash
npm run typecheck
git add src/lib/saju-core/data/leap-months.ts src/lib/saju-core/leap.ts src/lib/saju-core/leap.test.ts src/lib/saju-core/leap-months.gen.test.ts src/lib/saju-core/index.ts
git commit -m "feat(saju-core): 음력 윤달 판별 헬퍼(hasLeapMonth/getLeapMonth)"
```

---

## Task 2: 원국 계산 — 윤달/평달 구분 스냅샷

**Files:**
- Modify: `src/lib/saju-core/chart.test.ts`

**Interfaces:**
- Consumes: `buildChart(input: BirthInput): Chart` (기존).

> 목적: 이미 존재하는 `chart.ts`의 윤달 처리가 평달과 실제로 다른 결과를 내는지
> 회귀 테스트로 고정한다. 2020 음력 4월 1일은 윤달 여부에 따라 양력이 한 달 차이
> (평 2020-04-23 vs 윤 2020-05-23)로 갈린다.

- [ ] **Step 1: 실패하는 테스트 추가**

`src/lib/saju-core/chart.test.ts`의 `describe("buildChart", ...)` 안, 기존
"음력 입력을 양력으로 변환해 계산" it 블록 **뒤**에 추가:

```ts
  it("윤달 여부에 따라 다른 양력·원국으로 계산한다 (2020 음력 4월 1일)", () => {
    const plain = buildChart({
      year: 2020, month: 4, day: 1, calendar: "lunar", isLeapMonth: false, gender: "male",
    });
    expect(plain.solar).toMatchObject({ year: 2020, month: 4, day: 23 });
    expect(plain.day.korean).toBe("병신");

    const leap = buildChart({
      year: 2020, month: 4, day: 1, calendar: "lunar", isLeapMonth: true, gender: "male",
    });
    expect(leap.solar).toMatchObject({ year: 2020, month: 5, day: 23 });
    expect(leap.day.korean).toBe("병인");
  });
```

- [ ] **Step 2: 테스트 실행 (통과해야 함 — 엔진은 이미 지원)**

Run: `npm test -- chart.test`
Expected: PASS. 만약 FAIL이면 `chart.ts`의 `lunarToSolar` 배선을 조사(회귀).

- [ ] **Step 3: 커밋**

```bash
git add src/lib/saju-core/chart.test.ts
git commit -m "test(saju-core): 음력 윤달/평달 원국 구분 회귀 테스트"
```

---

## Task 3: FunnelData.isLeapMonth 상태 + toBirthInput 전달

**Files:**
- Modify: `src/app/funnel/_context/FunnelContext.tsx`
- Modify: `src/app/funnel/_lib/toBirthInput.ts`
- Modify: `src/app/funnel/_lib/toBirthInput.test.ts`

**Interfaces:**
- Consumes: `FunnelData`, `BirthInput`.
- Produces: `FunnelData.isLeapMonth: boolean`; `toBirthInput`가
  `isLeapMonth: data.calendar === "lunar" ? data.isLeapMonth : undefined`를 반환.

- [ ] **Step 1: FunnelData에 필드 추가**

`src/app/funnel/_context/FunnelContext.tsx`의 `interface FunnelData`에서
`calendar: Calendar;` 아래 줄에 추가:

```ts
  isLeapMonth: boolean;
```

그리고 `initialData`에서 `calendar: "solar",` 아래에 추가:

```ts
  isLeapMonth: false,
```

- [ ] **Step 2: toBirthInput 테스트 추가 (실패)**

`src/app/funnel/_lib/toBirthInput.test.ts`의 `baseData()` 반환 객체에
`calendar: "solar",` 아래 줄에 `isLeapMonth: false,`를 추가한다. 그리고
`describe` 블록 마지막 it 뒤에 추가:

```ts
  it("음력 윤달이면 isLeapMonth를 전달한다", () => {
    const input = toBirthInput({ ...baseData(), calendar: "lunar", isLeapMonth: true });
    expect(input.calendar).toBe("lunar");
    expect(input.isLeapMonth).toBe(true);
  });

  it("양력이면 isLeapMonth는 undefined다", () => {
    const input = toBirthInput({ ...baseData(), calendar: "solar", isLeapMonth: true });
    expect(input.isLeapMonth).toBeUndefined();
  });
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npm test -- toBirthInput`
Expected: FAIL — `input.isLeapMonth`가 `undefined`(전달 미구현)

- [ ] **Step 4: toBirthInput 구현**

`src/app/funnel/_lib/toBirthInput.ts`의 반환 객체에서 `calendar: data.calendar,`
아래에 추가:

```ts
    isLeapMonth: data.calendar === "lunar" ? data.isLeapMonth : undefined,
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- toBirthInput`
Expected: PASS

- [ ] **Step 6: 타입체크 + 커밋**

```bash
npm run typecheck
git add src/app/funnel/_context/FunnelContext.tsx src/app/funnel/_lib/toBirthInput.ts src/app/funnel/_lib/toBirthInput.test.ts
git commit -m "feat(funnel): isLeapMonth 상태 추가 및 BirthInput 전달"
```

---

## Task 4: 리뷰 라벨 포매터 (순수 헬퍼) + ReviewStep 표시

**Files:**
- Modify: `src/app/funnel/_lib/date.ts`
- Create: `src/app/funnel/_lib/date.test.ts`
- Modify: `src/app/funnel/_components/steps/ReviewStep.tsx`

**Interfaces:**
- Consumes: `formatDate`, `Calendar`.
- Produces: `formatCalendarLabel(calendar: "solar" | "lunar", isLeapMonth: boolean, birth: { y: number; m: number; d: number } | null): string`.

- [ ] **Step 1: 포매터 테스트 작성 (실패)**

`src/app/funnel/_lib/date.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatCalendarLabel } from "./date";

describe("formatCalendarLabel", () => {
  const birth = { y: 2020, m: 4, d: 1 };
  it("양력이면 '양력' 접두사를 붙인다", () => {
    expect(formatCalendarLabel("solar", false, birth)).toBe("양력 2020. 04. 01.");
  });
  it("음력 평달이면 '음력' 접두사를 붙인다", () => {
    expect(formatCalendarLabel("lunar", false, birth)).toBe("음력 2020. 04. 01.");
  });
  it("음력 윤달이면 '음력(윤달)' 접두사를 붙인다", () => {
    expect(formatCalendarLabel("lunar", true, birth)).toBe("음력(윤달) 2020. 04. 01.");
  });
  it("생년월일이 없으면 접두사 + '-'", () => {
    expect(formatCalendarLabel("solar", false, null)).toBe("양력 -");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- date.test`
Expected: FAIL — `formatCalendarLabel` export 없음

- [ ] **Step 3: 포매터 구현**

`src/app/funnel/_lib/date.ts` 끝에 추가:

```ts
export function formatCalendarLabel(
  calendar: "solar" | "lunar",
  isLeapMonth: boolean,
  birth: { y: number; m: number; d: number } | null,
): string {
  const prefix =
    calendar === "solar" ? "양력" : isLeapMonth ? "음력(윤달)" : "음력";
  return `${prefix} ${birth ? formatDate(birth) : "-"}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- date.test`
Expected: PASS

- [ ] **Step 5: ReviewStep에서 포매터 사용**

`src/app/funnel/_components/steps/ReviewStep.tsx`에서 import에 `formatCalendarLabel`
추가:

```ts
import { formatCalendarLabel, formatTime } from "../../_lib/date";
```

(주의: 기존 `formatDate` import가 이 변경 후 미사용이면 import에서 제거한다.)

그리고 `rows`의 생년월일 항목을 교체:

```ts
    {
      k: "생년월일",
      v: formatCalendarLabel(data.calendar, data.isLeapMonth, data.birth),
    },
```

- [ ] **Step 6: 타입체크 + 린트 + 커밋**

```bash
npm run typecheck
npm run lint
git add src/app/funnel/_lib/date.ts src/app/funnel/_lib/date.test.ts src/app/funnel/_components/steps/ReviewStep.tsx
git commit -m "feat(funnel): 리뷰 화면에 음력 윤달 표시"
```

---

## Task 5: BirthDateStep 조건부 윤달 토글

**Files:**
- Modify: `src/app/funnel/_components/steps/BirthDateStep.tsx`

**Interfaces:**
- Consumes: `hasLeapMonth` (saju-core), `Toggle` (`@/components/Toggle`), `useFunnel`.
- Produces: 없음(UI 배선). 검증은 `typecheck`+`lint`+수동 실행.

> 컴포넌트 테스트 인프라가 없으므로 이 태스크는 단위 테스트 없이 진행한다.
> 게이팅 술어(`hasLeapMonth`)와 전달(`toBirthInput`)은 Task 1·3에서 이미 검증됨.

- [ ] **Step 1: import 추가**

`src/app/funnel/_components/steps/BirthDateStep.tsx` 상단 import 블록에 추가:

```ts
import { hasLeapMonth } from "@/lib/saju-core";
import { Toggle } from "@/components/Toggle";
```

- [ ] **Step 2: commit()에서 윤달이 사라지면 리셋**

`commit()` 함수의 마지막 `update({ birth: { y: yy, m: mm, d: dd } });`를 아래로 교체.
윤달이 없는 연·월로 바뀌면 `isLeapMonth`를 함께 false로 되돌린다:

```ts
    const patch: Partial<typeof data> = { birth: { y: yy, m: mm, d: dd } };
    if (data.calendar === "lunar" && !hasLeapMonth(yy, mm) && data.isLeapMonth) {
      patch.isLeapMonth = false;
    }
    update(patch);
```

- [ ] **Step 3: 달력(양/음력) 변경 핸들러에서 리셋**

`SegmentedControl`의 `onChange`를 아래로 교체. 양력으로 바꾸면 윤달을 끈다:

```ts
        onChange={(calendar) =>
          update({ calendar, ...(calendar === "solar" ? { isLeapMonth: false } : {}) })
        }
```

- [ ] **Step 4: 윤달 토글 UI 추가**

날짜 입력 `div`(`flex items-center gap-2` 블록) **바로 아래**, 컴포넌트 최상위
`div`가 닫히기 전에 추가. 음력이면서 해당 연·월에 윤달이 존재할 때만 노출한다.
값 비교는 커밋된 `birth`(범위 보정 후)를 기준으로 한다:

```tsx
      {data.calendar === "lunar" && hasLeapMonth(birth.y, birth.m) && (
        <div className="mt-5 flex items-center justify-between rounded-[15px] border border-slate-200 bg-slate-50 px-[18px] py-4">
          <span>
            <span className="block text-sm font-semibold text-slate-700">윤달</span>
            <span className="mt-0.5 block text-[12.5px] text-slate-400">
              {birth.m}월에 윤달로 태어났다면 켜주세요
            </span>
          </span>
          <Toggle
            checked={data.isLeapMonth}
            onChange={(v) => update({ isLeapMonth: v })}
            label="윤달"
          />
        </div>
      )}
```

> 참고: `birth`는 컴포넌트 상단에서 `data.birth ?? { y: 1990, m: 1, d: 1 }`로
> 계산된 커밋 상태다. 입력 중(`y`/`m` 로컬 state)이 아니라 `onBlur` 커밋 후 값에
> 반응하므로, 월을 바꾸면 blur 시점에 토글 노출/숨김이 갱신된다.

- [ ] **Step 5: 타입체크 + 린트**

```bash
npm run typecheck
npm run lint
```
Expected: 오류 없음

- [ ] **Step 6: 수동 확인 (dev)**

```bash
npm run dev
```
확인 항목:
1. 음력 선택 → 연 2020, 월 4 입력 후 blur → "윤달" 토글이 나타난다.
2. 월을 5로 바꾸고 blur → 토글이 사라지고, 이전에 켰다면 꺼진다.
3. 양력으로 전환 → 토글이 사라지고 값이 꺼진다.
4. 음력 2020년 4월 + 윤달 ON으로 리뷰까지 진행 → "음력(윤달) 2020. 04. 01." 표시.

- [ ] **Step 7: 커밋**

```bash
git add src/app/funnel/_components/steps/BirthDateStep.tsx
git commit -m "feat(funnel): 음력 윤달 토글(연·월에 윤달 존재 시에만 노출)"
```

---

## Task 6: 이슈 문서 상태 갱신

**Files:**
- Modify: `docs/issues/engine.md`

- [ ] **Step 1: ISSUE-005 상태를 완료로 변경**

`docs/issues/engine.md`의 `## ⬜ ISSUE-005. 음력 입력 지원 (F001 일부)`를
`## ✅ ISSUE-005. 음력 입력 지원 (F001 일부)`로 바꾸고, 항목 아래에 한 줄 추가:

```md
- 퍼널 윤달 토글 → `isLeapMonth` 전달 배선 완료 (`saju-core/leap.ts`, `BirthDateStep`)
```

- [ ] **Step 2: 전체 테스트 + 커밋**

```bash
npm test
git add docs/issues/engine.md
git commit -m "docs: ISSUE-005 음력 윤달 입력 지원 완료"
```
Expected: 전체 스위트 PASS

---

## Self-Review

**Spec coverage:**
- 윤달 판별(A안, 파생 표) → Task 1 ✅
- `FunnelData.isLeapMonth` → Task 3 ✅
- 조건부 윤달 토글 UI(윤달 존재 시에만) → Task 5 ✅
- `toBirthInput` 전달 → Task 3 ✅
- 리뷰 표시 → Task 4 ✅
- 테스트(표 정확성/전달/원국 스냅샷/라벨) → Task 1·2·3·4 ✅
- 엔진/API는 기존 구현 유지(비목표) — 신규 코드 없음, Task 2 회귀 테스트로 고정 ✅

**Placeholder scan:** 모든 코드 블록은 실제 값·경로·명령을 포함. TODO/TBD 없음.

**Type consistency:** `hasLeapMonth(year, month)`·`getLeapMonth(year)`·
`formatCalendarLabel(calendar, isLeapMonth, birth)`·`isLeapMonth: boolean` 시그니처가
Task 1·3·4·5에서 일관되게 사용됨. `LEAP_MONTHS: Record<number, number>` 동일.
