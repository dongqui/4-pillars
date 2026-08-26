# 지금의 흐름 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 궁합·상담과 나란한 독립 서비스 `지금의 흐름`을 세운다 — 명리 연도(세운) 1개를 이용권 1장에 팔고, 그해를 1~3개 구간으로 나눠 전 구간 서술을 한 번에 생성해 박제하며, 다시 열 때는 읽는 시점이 속한 구간을 골라 보여준다.

**Architecture:** 궁합(`api/matches`, `lib/matches`, `match_sections`)의 골격을 그대로 복제한다. 리포트의 `SECTIONS` 레지스트리에 얹지 않고 `FLOW_SECTIONS` 를 따로 둔다. 순수 명리 계산은 `saju-core` 에, "몇 구간으로 나눌지"라는 편집 규칙은 서비스(`api/flows/_lib/segments.ts`)에 둔다. 결과는 캐시가 아니라 박제라 `flow_sections` 에 `flow_id` 로 저장한다.

**Tech Stack:** Next.js 16.2.10 (App Router), TypeScript, Postgres(neon, 태그드 템플릿 SQL), zod v4, vitest(`environment: node`), Tailwind, DeepSeek.

**Spec:** `docs/superpowers/specs/2026-08-26-current-flow-design.md`

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-08-26-current-flow-design.md`. 이 계획은 스펙에서 논증을 가져온다 — 두 문서를 같이 읽는다.
- **`src/lib/saju-core/astro/solar-term.ts` 의 `solarTermJD` 를 고치지 않는다.** `+ 9 / 24` 가 박혀 있고 `computeDaeun` 이 `birthJD`(민간시를 그대로 JD 로 만든 값)와 상쇄시켜 쓴다. 걷어내면 모든 사용자의 대운수가 바뀐다. `src/lib/saju-core/luck.test.ts` 가 `daeunSu`·`basisTerm` 을 못박고 있으므로 **그 파일이 계속 통과하는 것이 통과 조건**이다.
- **궁합의 동작을 바꾸지 않는다.** `match_sections` 는 박제된 결과이고 레지스트리가 "재생성이 곧 이용권 원가"라고 경고한다. 지지 관계를 공용 모듈로 꺼낼 때 `analyzeSynastry` 의 결과가 **바이트 단위로 같아야** 한다.
- **리포트의 `SECTIONS`·`derive.ts`·`store.ts` 를 고치지 않는다.** 흐름은 자기 레지스트리를 갖는다. `primitives.ts` 만 import 한다 (궁합이 하는 것과 같다).
- 마이그레이션 파일 하나에 **SQL 문장은 하나만** 담는다 — Neon HTTP 드라이버가 거부한다 (`migrations/README.md`).
- 마이그레이션 번호는 **0033 부터** 시작한다 (`0032_profiles_drop_retention.sql` 이 마지막).
- 테스트 환경이 `node` 라 클라이언트 컴포넌트는 렌더하지 않는다. 테스트는 순수 함수·store·핸들러에만 붙인다.
- LLM 은 날짜·연도·구간 번호를 쓰지 않는다. 정확한 시간은 계산 결과가 화면에서 붙인다.
- 커밋 메시지는 레포 관례를 따른다: 한국어, `type(scope): 명령형 한 줄`.
- 모든 커밋 메시지 끝에 다음 줄을 붙인다:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- 테스트 실행: `npm test`. 타입 검사: `npm run typecheck`. 린트: `npm run lint`.

## 파일 구조

### 계산 (순수 명리 — `saju-core`)

| 파일 | 책임 |
|---|---|
| `src/lib/saju-core/astro/solar-term.ts` (수정) | `solarTermInstant` 추가 — 절기의 **절대 시각**. 기존 함수는 손대지 않는다 |
| `src/lib/saju-core/flow/year.ts` (신규) | `flowYearAt(at)` — 입춘 기준 명리 연도와 그 경계 |
| `src/lib/saju-core/flow/months.ts` (신규) | `monthTermsOf(year)` — 그 명리 연도의 12개 절기 구간 + 월운 간지 |
| `src/lib/saju-core/flow/switch.ts` (신규) | `daeunSwitchIn(analysis, period)` — 그 구간 안의 대운 전환 시각 |
| `src/lib/saju-core/branch-relations.ts` (신규) | `pairRelations` / `setRelations` — 지지 관계를 쌍·집합으로 가른 공용 모듈 |
| `src/lib/saju-core/synastry.ts` (수정) | `tieKinds` 내부를 `pairRelations` 로 갈아끼운다. **결과 불변** |
| `src/lib/saju-core/index.ts` (수정) | 위 신규 심볼 재수출 |

### 구간 선별 (편집 규칙 — 서비스)

| 파일 | 책임 |
|---|---|
| `src/app/api/flows/_lib/score.ts` (신규) | `supportOf` / `frictionOf` — 정규화된 두 축 |
| `src/app/api/flows/_lib/segments.ts` (신규) | `flowSegments` — Δ 로 전환을 골라 1~3구간을 낸다. `FLOW_SEGMENT_THRESHOLD` 가 여기 산다 |
| `scripts/flow-threshold.mts` (신규) | 임계값 측정 스크립트. 60 일주 × 여러 생년의 Δ 분포를 찍는다 |

### 데이터

| 파일 | 책임 |
|---|---|
| `migrations/0033_flows.sql` (신규) | `flows` 테이블 |
| `migrations/0034_flows_unique.sql` (신규) | `flows_unique` |
| `migrations/0035_flows_user_created_idx.sql` (신규) | 목록 인덱스 |
| `migrations/0036_flow_sections.sql` (신규) | `flow_sections` 테이블 |
| `migrations/README.md` (수정) | "다음 번호" 갱신 |
| `src/lib/flows/store.ts` (신규) | `findFlow` / `findOrCreateFlow` |
| `src/lib/flows/tickets.ts` (신규) | `FlowTicketsError` |
| `src/lib/flows/rate-limit.ts` (신규) | 시간당 한도 |
| `src/lib/flows/access.ts` (신규) | `canCreateFlow` — 잔액·한도 **확인만** |
| `src/lib/tickets/features.ts` (수정) | `current_flow` 두 줄 |

### 생성

| 파일 | 책임 |
|---|---|
| `src/app/api/flows/_lib/sections/registry.ts` (신규) | `FLOW_SECTIONS` 8개. `schema` 가 `(n) => ZodType` 팩토리 |
| `src/app/api/flows/_lib/sections/derive.ts` (신규) | 타입·LLM 스키마·파서 파생. `n` 을 받는다 |
| `src/app/api/flows/_lib/sections/index.ts` (신규) | 재수출 |
| `src/app/api/flows/_lib/store.ts` (신규) | `flow_sections` CRUD + decode |
| `src/app/api/flows/_lib/prompt/system.ts` (신규) | `FLOW_SYSTEM_PROMPT` |
| `src/app/api/flows/_lib/prompt/facts.ts` (신규) | 계산값 → `[사실]` 블록. 숫자 대신 범주 라벨 |
| `src/app/api/flows/_lib/prompt/index.ts` (신규) | `buildFlowSectionRequest` |
| `src/app/api/flows/_lib/generator.ts` (신규) | `FlowGenerator` + DeepSeek |
| `src/app/api/flows/_lib/produce.ts` (신규) | 없는 섹션만 생성·검증·저장 |
| `src/app/api/flows/_lib/gated-generator.ts` (신규) | 한도·이용권 게이트 |
| `src/app/api/flows/_lib/handler.ts` (신규) | 순수 판정 |
| `src/app/api/flows/route.ts` (신규) | 얇은 라우트 |

### 화면

| 파일 | 책임 |
|---|---|
| `src/app/flow/_lib/to-confirm.ts` (신규) | 확인 화면 상태 판정 (순수) |
| `src/app/flow/page.tsx` (신규) | 확인 화면 |
| `src/app/flow/_components/FlowConfirm.tsx` (신규) | 확인 카드 |
| `src/app/flow/[id]/_lib/current-segment.ts` (신규) | 읽는 시점 → 구간 선택 (순수) |
| `src/app/flow/[id]/_lib/to-flow-view.ts` (신규) | 저장된 섹션 + 구간 → 화면 모델 |
| `src/app/flow/[id]/page.tsx` (신규) | 결과 |
| `src/app/flow/[id]/_components/*.tsx` (신규) | `FlowShell`·`FlowHero`·`FlowBody`·`AnalyzingFlow`·`FlowError`·`FlowRateLimited`·`FlowOutOfTickets` |
| `src/app/home/_components/ExploreGrid.tsx` (수정) | 다섯 번째 카드 |

---

## Phase A · 계산

### Task 1: `solarTermInstant` — 절기의 절대 시각

`solarTermJD` 는 이름과 달리 진짜 JD 가 아니다. 마지막 줄에 `+ 9 / 24` 가 붙어 있어 "KST 벽시계를 UT인 척" 하는 값이다. `computeDaeun` 이 `birthJD`(출생 민간시를 그대로 JD 로 만든 값)와 빼서 쓰기 때문에 그 +9h 가 상쇄된다. **그래서 고치면 안 되고, 대신 진짜 instant 를 주는 함수를 옆에 세운다.**

**Files:**
- Modify: `src/lib/saju-core/astro/solar-term.ts` (파일 끝에 함수 추가)
- Modify: `src/lib/saju-core/index.ts` (재수출)
- Test: `src/lib/saju-core/astro/solar-term.test.ts` (없으면 신규)

**Interfaces:**
- Consumes: `solarTermJDE(year, targetLongitude): number` (같은 파일, 이미 export), `deltaTSeconds(year): number` (같은 파일, 모듈 지역), `solarTermDate(year, longitude): CalendarTime` (같은 파일, 이미 export)
- Produces: `solarTermInstant(year: number, targetLongitude: number): Date`

**배경 (읽고 시작할 것):**
- `src/lib/saju-core/astro/solar-term.ts:124-133` — `solarTermJD` 와 `solarTermDate`
- `src/lib/saju-core/luck.ts:38` — `birthJD` 가 민간시를 그대로 JD 로 만든다
- `src/lib/saju-core/luck.test.ts:9-22` — 이 파일이 `solarTermJD` 의 회귀 테스트다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/saju-core/astro/solar-term.test.ts` 에 추가한다 (파일이 없으면 아래 import 로 새로 만든다):

```ts
import { describe, expect, it } from "vitest";
import { solarTermDate, solarTermInstant } from "./solar-term";

describe("solarTermInstant", () => {
  // solarTermDate 는 KST 벽시계, solarTermInstant 는 절대 시각.
  // 둘 사이의 차이는 정확히 9시간이어야 한다 — 이 불변식이 깨지면
  // 한쪽이 다른 순간을 가리키고 있다는 뜻이다.
  it("solarTermDate 와 같은 순간을 가리킨다 — 9시간이 차이의 전부다", () => {
    const inst = solarTermInstant(2026, 315); // 입춘
    const kst = solarTermDate(2026, 315);
    const shifted = new Date(inst.getTime() + 9 * 3600_000);

    expect(shifted.getUTCFullYear()).toBe(kst.year);
    expect(shifted.getUTCMonth() + 1).toBe(kst.month);
    expect(shifted.getUTCDate()).toBe(kst.day);
    expect(shifted.getUTCHours()).toBe(kst.hour);
  });

  it("입춘은 2월 초에 든다", () => {
    const kstDay = new Date(solarTermInstant(2026, 315).getTime() + 9 * 3600_000);
    expect(kstDay.getUTCMonth() + 1).toBe(2);
    expect(kstDay.getUTCDate()).toBeGreaterThanOrEqual(3);
    expect(kstDay.getUTCDate()).toBeLessThanOrEqual(5);
  });

  it("해가 바뀌면 다른 순간이다", () => {
    expect(solarTermInstant(2026, 315).getTime()).not.toBe(
      solarTermInstant(2027, 315).getTime(),
    );
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/saju-core/astro/solar-term.test.ts`
Expected: FAIL — `solarTermInstant` is not exported / is not a function

- [ ] **Step 3: 최소 구현을 쓴다**

`src/lib/saju-core/astro/solar-term.ts` 파일 끝에 추가한다:

```ts
/** Unix epoch 의 율리우스일. JD → epoch ms 환산의 기준점이다. */
const JD_UNIX_EPOCH = 2440587.5;

/**
 * 절기 순간의 **절대 시각**.
 *
 * ⚠️ solarTermJD 와 헷갈리지 말 것. 그쪽은 끝에 `+ 9 / 24` 가 붙어 있어 진짜 JD 가
 * 아니라 "KST 벽시계를 UT인 척한" 값이다. computeDaeun 이 birthJD(민간시를 그대로
 * JD 로 만든 값)와 빼서 쓰기 때문에 그 +9h 가 상쇄되는 구조라, 그 함수는 고칠 수 없다.
 *
 * 시간대와 무관한 순간이 필요한 곳(흐름 서비스의 연·구간 경계)은 이 함수를 쓴다.
 * DB 의 timestamptz 에 넣을 값도 이것이다.
 */
export function solarTermInstant(year: number, targetLongitude: number): Date {
  const jdeTT = solarTermJDE(year, targetLongitude);
  const jdUT = jdeTT - deltaTSeconds(year) / 86400;
  return new Date(Math.round((jdUT - JD_UNIX_EPOCH) * 86400_000));
}
```

`src/lib/saju-core/index.ts` 의 절기 재수출 줄을 넓힌다:

```ts
// 절기(대운/월령 계산에 사용)
export {
  MONTH_TERMS,
  solarTermDate,
  solarTermInstant,
  type CalendarTime,
} from "./astro/solar-term";
```

- [ ] **Step 4: 통과를 확인한다 — 그리고 대운이 그대로인지도**

Run: `npx vitest run src/lib/saju-core/astro/solar-term.test.ts src/lib/saju-core/luck.test.ts`
Expected: 둘 다 PASS. `luck.test.ts` 가 깨지면 `solarTermJD` 를 건드린 것이다 — 되돌린다.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/saju-core/astro/solar-term.ts src/lib/saju-core/astro/solar-term.test.ts src/lib/saju-core/index.ts
git commit -m "feat(saju-core): 절기의 절대 시각을 주는 함수를 옆에 세운다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `flowYearAt` — 입춘 기준 명리 연도

**Files:**
- Create: `src/lib/saju-core/flow/year.ts`
- Create: `src/lib/saju-core/flow/year.test.ts`
- Modify: `src/lib/saju-core/index.ts`

**Interfaces:**
- Consumes: `solarTermInstant(year, longitude): Date` (Task 1)
- Produces:
  - `interface FlowYearPeriod { year: number; start: Date; end: Date }`
  - `flowYearAt(at: Date): FlowYearPeriod`
  - `const IPCHUN_LONGITUDE = 315`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/saju-core/flow/year.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { flowYearAt } from "./year";

describe("flowYearAt", () => {
  it("입춘 전이면 전년도다 — 달력 연도가 아니라 명리 연도다", () => {
    expect(flowYearAt(new Date("2026-01-20T00:00:00Z")).year).toBe(2025);
  });

  it("입춘 뒤면 그해다", () => {
    expect(flowYearAt(new Date("2026-06-01T00:00:00Z")).year).toBe(2026);
  });

  it("12월 말도 그해다 — 다음 입춘이 아직 안 왔다", () => {
    expect(flowYearAt(new Date("2026-12-31T23:00:00Z")).year).toBe(2026);
  });

  it("UTC 연도와 KST 연도가 갈리는 순간에도 같은 답을 낸다", () => {
    // 2025-12-31T20:00Z = 2026-01-01 05:00 KST. 둘 다 입춘 전이라 2025 다.
    expect(flowYearAt(new Date("2025-12-31T20:00:00Z")).year).toBe(2025);
    expect(flowYearAt(new Date("2026-01-01T00:00:00Z")).year).toBe(2025);
  });

  it("경계는 닫힌-열린 구간이다 — start 는 포함, end 는 제외", () => {
    const p = flowYearAt(new Date("2026-06-01T00:00:00Z"));
    expect(flowYearAt(p.start).year).toBe(2026);
    expect(flowYearAt(p.end).year).toBe(2027);
  });

  it("한 해의 end 는 다음 해의 start 다 — 틈이 없다", () => {
    const a = flowYearAt(new Date("2026-06-01T00:00:00Z"));
    const b = flowYearAt(new Date("2027-06-01T00:00:00Z"));
    expect(a.end.getTime()).toBe(b.start.getTime());
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/saju-core/flow/year.test.ts`
Expected: FAIL — Cannot find module './year'

- [ ] **Step 3: 최소 구현을 쓴다**

`src/lib/saju-core/flow/year.ts`:

```ts
// 명리 연도(세운) — 입춘에서 바뀐다.
//
// 달력 연도와 다르다. 2026-01-20 은 달력으로 2026 년이지만 명리로는 아직 2025 년이다.
// 입춘은 천문학적 순간이라 전 세계 동일하다 — 서버 시간대나 사용자 locale 로
// 답이 달라지면 안 되므로 현재 시각을 인자로 받는다.

import { solarTermInstant } from "../astro/solar-term";

/** 입춘의 태양 황경. MONTH_TERMS 의 첫 항목과 같은 값이다. */
export const IPCHUN_LONGITUDE = 315;

export interface FlowYearPeriod {
  /** 명리 연도 */
  year: number;
  /** 그해 입춘 (포함) */
  start: Date;
  /** 다음 해 입춘 (제외) */
  end: Date;
}

/**
 * 주어진 순간이 속한 명리 연도와 그 경계.
 *
 * 달력 연도로 먼저 찍고 입춘 전이면 한 해 물러선다. 입춘이 2월 초라 UTC/KST 의
 * 연말 경계(1월 1일)와는 한 달 이상 떨어져 있어, 어느 시계로 연도를 읽든 같은
 * 답이 나온다.
 */
export function flowYearAt(at: Date): FlowYearPeriod {
  const guess = at.getUTCFullYear();
  const start = solarTermInstant(guess, IPCHUN_LONGITUDE);

  if (at.getTime() < start.getTime()) {
    return {
      year: guess - 1,
      start: solarTermInstant(guess - 1, IPCHUN_LONGITUDE),
      end: start,
    };
  }

  return {
    year: guess,
    start,
    end: solarTermInstant(guess + 1, IPCHUN_LONGITUDE),
  };
}
```

`src/lib/saju-core/index.ts` 에 재수출을 더한다:

```ts
// 흐름(지금의 흐름 서비스) — 명리 연도와 그 안의 구간
export { flowYearAt, IPCHUN_LONGITUDE, type FlowYearPeriod } from "./flow/year";
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/saju-core/flow/year.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/saju-core/flow/year.ts src/lib/saju-core/flow/year.test.ts src/lib/saju-core/index.ts
git commit -m "feat(saju-core): 입춘으로 끊는 명리 연도를 계산한다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `monthTermsOf` — 명리 연도 안의 12개 절기 구간

**Files:**
- Create: `src/lib/saju-core/flow/months.ts`
- Create: `src/lib/saju-core/flow/months.test.ts`
- Modify: `src/lib/saju-core/index.ts`

**Interfaces:**
- Consumes: `solarTermInstant` (Task 1), `flowYearAt` / `FlowYearPeriod` (Task 2), `MONTH_TERMS` (기존 `astro/solar-term.ts`), `calculateSajuSimple` (`@fullstackfamily/manseryeok`)
- Produces:
  - `interface MonthTerm { name: string; start: Date; end: Date; korean: string; hanja: string }`
  - `monthTermsOf(year: number): MonthTerm[]` — 언제나 12개, 시간순

**배경 (읽고 시작할 것):**
- `src/lib/saju-core/sewun.ts` — `calculateSajuSimple(year, month, day)` 를 불러 `yearPillar` 를 읽는 선례. 여기서는 `monthPillar` / `monthPillarHanja` 를 읽는다.
- `src/lib/saju-core/chart.ts:110` — `parsePillar(raw.monthPillar, raw.monthPillarHanja)` 로 필드 이름이 확인된다.
- `MONTH_TERMS` 는 황경 순서(입춘 315 → 소한 285)로 이미 정렬돼 있다. **소한(285)만 다음 달력 연도에 든다** — 그래서 달력 연도를 그대로 넘기면 안 되고, 입춘보다 앞서면 한 해 밀어야 한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/saju-core/flow/months.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { flowYearAt } from "./year";
import { monthTermsOf } from "./months";

describe("monthTermsOf", () => {
  const terms = monthTermsOf(2026);

  it("언제나 12개다", () => {
    expect(terms).toHaveLength(12);
  });

  it("입춘에서 시작한다", () => {
    expect(terms[0].name).toBe("입춘");
    expect(terms[0].start.getTime()).toBe(flowYearAt(new Date("2026-06-01T00:00:00Z")).start.getTime());
  });

  it("시간순이고 틈이 없다 — 한 칸의 end 가 다음 칸의 start 다", () => {
    for (let i = 0; i < terms.length - 1; i += 1) {
      expect(terms[i].end.getTime()).toBe(terms[i + 1].start.getTime());
    }
  });

  it("마지막 칸(소한)은 다음 달력 연도에 든다 — 명리 연도는 아직 2026 이다", () => {
    const last = terms[11];
    expect(last.name).toBe("소한");
    expect(last.start.getUTCFullYear()).toBe(2027);
    expect(flowYearAt(last.start).year).toBe(2026);
  });

  it("마지막 칸의 end 는 다음 입춘이다", () => {
    expect(terms[11].end.getTime()).toBe(flowYearAt(new Date("2026-06-01T00:00:00Z")).end.getTime());
  });

  it("각 칸에 월운 간지가 붙는다", () => {
    for (const t of terms) {
      expect(t.korean).toMatch(/^[가-힣]{2}$/);
      expect(t.hanja).toHaveLength(2);
    }
  });

  it("이웃한 두 칸의 간지는 다르다 — 60갑자에서 한 칸씩 움직인다", () => {
    const koreans = terms.map((t) => t.korean);
    expect(new Set(koreans).size).toBe(12);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/saju-core/flow/months.test.ts`
Expected: FAIL — Cannot find module './months'

- [ ] **Step 3: 최소 구현을 쓴다**

`src/lib/saju-core/flow/months.ts`:

```ts
// 월운(月運) — 명리 연도 하나를 12개 절기 구간으로 자른다.
//
// 이 12개를 사용자에게 다 보여주지 않는다. 전환점을 고르기 위한 계산 해상도일 뿐이고,
// 노출은 최대 3구간이다(기획서 §4: 12개월을 모두 해설하지 않는다).

import { calculateSajuSimple } from "@fullstackfamily/manseryeok";
import { MONTH_TERMS, solarTermInstant } from "../astro/solar-term";
import { flowYearAt, IPCHUN_LONGITUDE } from "./year";

export interface MonthTerm {
  /** 절기 이름 (입춘·경칩 …) */
  name: string;
  /** 이 절기가 드는 순간 (포함) */
  start: Date;
  /** 다음 절기가 드는 순간 (제외) */
  end: Date;
  /** 월운 간지 (한글) */
  korean: string;
  /** 월운 간지 (한자) */
  hanja: string;
}

/** 절대 시각을 KST 민간 날짜로 읽는다. manseryeok 은 민간 날짜를 받는다. */
function kstCivil(at: Date): { year: number; month: number; day: number } {
  const shifted = new Date(at.getTime() + 9 * 3600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * 명리 연도 하나의 12개 절기 구간.
 *
 * 절기 시각은 달력 연도로 계산되는데 소한(황경 285)만 다음 달력 연도에 든다.
 * 황경별로 예외를 손으로 적는 대신, **입춘보다 앞서면 한 해 민다** 는 규칙 하나로
 * 접는다 — 절기가 늘거나 순서가 바뀌어도 이 규칙은 그대로 맞는다.
 *
 * 간지는 구간의 **중간 지점**에서 읽는다. 경계에서 읽으면 초 단위 오차가 이웃 달로
 * 넘어갈 수 있다.
 */
export function monthTermsOf(year: number): MonthTerm[] {
  const yearStart = solarTermInstant(year, IPCHUN_LONGITUDE);
  const nextYearStart = solarTermInstant(year + 1, IPCHUN_LONGITUDE);

  const starts = MONTH_TERMS.map((t) => {
    const sameYear = solarTermInstant(year, t.longitude);
    return {
      name: t.name,
      at: sameYear.getTime() < yearStart.getTime()
        ? solarTermInstant(year + 1, t.longitude)
        : sameYear,
    };
  }).sort((a, b) => a.at.getTime() - b.at.getTime());

  return starts.map((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].at : nextYearStart;
    const mid = new Date((s.at.getTime() + end.getTime()) / 2);
    const civil = kstCivil(mid);
    const saju = calculateSajuSimple(civil.year, civil.month, civil.day);
    return {
      name: s.name,
      start: s.at,
      end,
      korean: saju.monthPillar,
      hanja: saju.monthPillarHanja,
    };
  });
}

/** 주어진 순간이 속한 월운 구간. 못 찾으면 null (범위 밖). */
export function monthTermAt(at: Date): MonthTerm | null {
  const { year } = flowYearAt(at);
  const t = at.getTime();
  return (
    monthTermsOf(year).find((m) => t >= m.start.getTime() && t < m.end.getTime()) ?? null
  );
}
```

`src/lib/saju-core/index.ts` 의 흐름 재수출 블록을 넓힌다:

```ts
// 흐름(지금의 흐름 서비스) — 명리 연도와 그 안의 구간
export { flowYearAt, IPCHUN_LONGITUDE, type FlowYearPeriod } from "./flow/year";
export { monthTermsOf, monthTermAt, type MonthTerm } from "./flow/months";
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/saju-core/flow/months.test.ts`
Expected: PASS (7 tests)

만약 `이웃한 두 칸의 간지는 다르다` 가 깨지면 중간 지점 계산이나 `monthPillar` 필드명을 확인한다 — `src/lib/saju-core/chart.ts:110` 이 실제 필드명의 근거다.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/saju-core/flow/months.ts src/lib/saju-core/flow/months.test.ts src/lib/saju-core/index.ts
git commit -m "feat(saju-core): 명리 연도를 12개 절기 구간으로 자른다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `branch-relations.ts` — 지지 관계를 쌍과 집합으로 가른다

`tieKinds` 가 `synastry.ts` 안에 private 으로 묶여 있어 흐름이 쓸 수 없다. 꺼내되 **그대로 꺼내면 안 된다** — 삼합은 세 지지가 필요한 관계인데 현재 구현은 `BRANCH_SAMHAP[mine].includes(theirs)` 라는 2항 근사(사실상 반합)다. 흐름은 월운·세운·대운·원국 4지를 한 판에 놓으므로 완성 여부를 실제로 판정할 수 있고, 같은 함수를 쓰면 과대평가된다.

**궁합의 결과는 바꾸지 않는다.** `analyzeSynastry` 는 `pairRelations` + 기존 2항 삼합을 그대로 유지한다. 정식 `setRelations` 는 흐름만 쓴다.

**Files:**
- Create: `src/lib/saju-core/branch-relations.ts`
- Create: `src/lib/saju-core/branch-relations.test.ts`
- Modify: `src/lib/saju-core/synastry.ts` (`tieKinds` 내부만)
- Modify: `src/lib/saju-core/index.ts`

**Interfaces:**
- Consumes: `BRANCH_HAP`, `BRANCH_CHUNG`, `BRANCH_HYEONG`, `BRANCH_HAE`, `BRANCH_PA`, `BRANCH_WONJIN`, `BRANCH_SAMHAP`, `type Branch` (모두 `./data/branches` 에서 이미 export)
- Produces:
  - `type PairKind = "육합" | "충" | "형" | "해" | "파" | "원진"`
  - `pairRelations(a: Branch, b: Branch): PairKind[]`
  - `type SetKind = "삼합" | "반합"`
  - `interface SetRelation { kind: SetKind; branches: Branch[] }`
  - `setRelations(branches: Branch[]): SetRelation[]`

**배경 (읽고 시작할 것):**
- `src/lib/saju-core/synastry.ts:78-89` — 현재 `tieKinds`
- `src/lib/saju-core/synastry.ts:28` — `TieKind` 는 `"육합" | "삼합" | "충" | "형" | "해" | "파" | "원진"`. 이 타입과 `Synastry.ties` 는 **그대로 둔다** (궁합 화면·프롬프트가 읽는다)
- `src/lib/saju-core/data/branches.ts:76` — `BRANCH_SAMHAP: Record<Branch, readonly [Branch, Branch]>` — 한 지지에 대해 삼합을 이루는 **나머지 둘**을 준다. 그래서 `{a, ...BRANCH_SAMHAP[a]}` 가 삼합 한 세트다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/saju-core/branch-relations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pairRelations, setRelations } from "./branch-relations";

describe("pairRelations", () => {
  it("자오는 충이다", () => {
    expect(pairRelations("자", "오")).toContain("충");
  });

  it("자축은 육합이다", () => {
    expect(pairRelations("자", "축")).toContain("육합");
  });

  it("한 쌍이 둘 이상 걸릴 수 있다 — 자미는 해이자 원진이다", () => {
    const kinds = pairRelations("자", "미");
    expect(kinds).toContain("해");
    expect(kinds).toContain("원진");
  });

  it("삼합은 여기서 나오지 않는다 — 두 글자로 판정할 관계가 아니다", () => {
    expect(pairRelations("인", "오")).not.toContain("삼합");
  });

  it("관계가 없으면 빈 배열", () => {
    expect(pairRelations("자", "자")).toEqual([]);
  });
});

describe("setRelations", () => {
  it("세 지지가 다 모이면 삼합이다", () => {
    const out = setRelations(["인", "오", "술"]);
    expect(out).toEqual([{ kind: "삼합", branches: ["인", "오", "술"] }]);
  });

  it("둘만 있으면 반합이다 — 삼합이 아니다", () => {
    const out = setRelations(["인", "오"]);
    expect(out).toEqual([{ kind: "반합", branches: ["인", "오"] }]);
  });

  it("하나만 있으면 아무것도 아니다", () => {
    expect(setRelations(["인"])).toEqual([]);
  });

  it("같은 세트를 한 번만 센다 — 세 글자가 서로를 세 번 가리켜도 하나다", () => {
    expect(setRelations(["인", "오", "술"])).toHaveLength(1);
  });

  it("중복된 지지가 있어도 세트는 하나다 — 인이 둘이어도 삼합은 하나", () => {
    expect(setRelations(["인", "인", "오", "술"])).toEqual([
      { kind: "삼합", branches: ["인", "오", "술"] },
    ]);
  });

  it("두 세트가 동시에 성립하면 둘 다 낸다", () => {
    const out = setRelations(["인", "오", "술", "신", "자", "진"]);
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.kind === "삼합")).toBe(true);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/saju-core/branch-relations.test.ts`
Expected: FAIL — Cannot find module './branch-relations'

- [ ] **Step 3: 최소 구현을 쓴다**

`src/lib/saju-core/branch-relations.ts`:

```ts
// 지지(地支)끼리의 관계 — 서비스 중립 모듈.
//
// 두 종류를 명시적으로 가른다:
//   쌍 관계  충·형·해·파·원진·육합 — 두 글자로 판정이 끝난다
//   집합 관계 삼합·반합           — 세 글자가 있어야 완성된다
//
// 가르는 이유: 삼합을 2항 함수로 다루면(BRANCH_SAMHAP[a].includes(b)) 실제로는
// 반합인 것을 삼합으로 세어 과대평가한다. 궁합은 역사적으로 그 근사를 써 왔고
// 결과가 박제돼 있어 지금 고치지 않는다 — synastry.ts 를 볼 것.

import {
  BRANCH_CHUNG,
  BRANCH_HAE,
  BRANCH_HAP,
  BRANCH_HYEONG,
  BRANCH_PA,
  BRANCH_SAMHAP,
  BRANCH_WONJIN,
  type Branch,
} from "./data/branches";

export type PairKind = "육합" | "충" | "형" | "해" | "파" | "원진";

/** 지지 두 글자 사이의 관계 전부. 한 쌍이 둘 이상 걸릴 수 있다(자미는 해이자 원진). */
export function pairRelations(a: Branch, b: Branch): PairKind[] {
  const kinds: PairKind[] = [];
  if (BRANCH_HAP[a] === b) kinds.push("육합");
  if (BRANCH_CHUNG[a] === b) kinds.push("충");
  if (BRANCH_HYEONG[a].includes(b)) kinds.push("형");
  if (BRANCH_HAE[a] === b) kinds.push("해");
  if (BRANCH_PA[a] === b) kinds.push("파");
  if (BRANCH_WONJIN[a] === b) kinds.push("원진");
  return kinds;
}

export type SetKind = "삼합" | "반합";

export interface SetRelation {
  kind: SetKind;
  /** 실제로 모인 지지들. 삼합이면 3개, 반합이면 2개 */
  branches: Branch[];
}

/**
 * 주어진 지지 무리 안에서 성립하는 삼합·반합.
 *
 * 한 세트를 한 번만 낸다. 인·오·술 셋이 각자 서로를 가리키므로 그냥 훑으면 같은
 * 세트가 세 번 나온다 — 정렬한 키로 접는다.
 *
 * 중복된 지지(인이 둘)는 세트를 늘리지 않는다. 같은 글자가 두 장 있다고 삼합이
 * 두 벌 성립하지는 않는다.
 */
export function setRelations(branches: Branch[]): SetRelation[] {
  const present = new Set(branches);
  const seen = new Set<string>();
  const out: SetRelation[] = [];

  for (const b of present) {
    const [x, y] = BRANCH_SAMHAP[b];
    const full = [b, x, y];
    const key = [...full].sort().join("");
    if (seen.has(key)) continue;

    const found = full.filter((v) => present.has(v));
    if (found.length === 3) {
      seen.add(key);
      out.push({ kind: "삼합", branches: found });
    } else if (found.length === 2) {
      // 반합은 짝마다 다르므로 세트 키가 아니라 짝 키로 접는다.
      const halfKey = [...found].sort().join("");
      if (seen.has(halfKey)) continue;
      seen.add(halfKey);
      out.push({ kind: "반합", branches: found });
    }
  }

  return out;
}
```

`src/lib/saju-core/synastry.ts` 의 `tieKinds` 를 갈아끼운다. **결과는 그대로다** — 순서까지 맞춘다(육합 → 삼합 → 충 → 형 → 해 → 파 → 원진):

```ts
import { pairRelations } from "./branch-relations";

/**
 * 지지 두 글자 사이의 관계 전부. 한 쌍이 둘 이상 걸릴 수 있다(자미는 해이자 원진).
 *
 * ⚠️ 여기의 "삼합" 은 BRANCH_SAMHAP 2항 판정이라 실제로는 반합까지 삼합으로 센다.
 * 근사인 줄 알면서 두는 이유: match_sections 는 박제된 결과이고 판정을 바꾸면 이미
 * 판 궁합 전부가 다음 열람에서 다시 생성된다(registry.ts 의 version 주석). 정식
 * 판정은 branch-relations.ts 의 setRelations 에 있고 흐름 서비스가 쓴다.
 */
function tieKinds(mine: Branch, theirs: Branch): TieKind[] {
  const pairs = pairRelations(mine, theirs);
  const kinds: TieKind[] = [];
  if (pairs.includes("육합")) kinds.push("육합");
  if (BRANCH_SAMHAP[mine].includes(theirs)) kinds.push("삼합");
  for (const k of ["충", "형", "해", "파", "원진"] as const) {
    if (pairs.includes(k)) kinds.push(k);
  }
  return kinds;
}
```

`src/lib/saju-core/index.ts` 에 재수출을 더한다:

```ts
// 지지 관계 — 쌍(충·형·해·파·원진·육합)과 집합(삼합·반합)을 가른 공용 모듈
export {
  pairRelations,
  setRelations,
  type PairKind,
  type SetKind,
  type SetRelation,
} from "./branch-relations";
```

- [ ] **Step 4: 통과를 확인한다 — 궁합이 그대로인지도**

Run: `npx vitest run src/lib/saju-core/branch-relations.test.ts src/lib/saju-core/synastry.test.ts`
Expected: 둘 다 PASS. `synastry.test.ts` 가 깨지면 `tieKinds` 의 결과나 순서가 바뀐 것이다 — 궁합은 불변이어야 하므로 되돌린다.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/saju-core/branch-relations.ts src/lib/saju-core/branch-relations.test.ts src/lib/saju-core/synastry.ts src/lib/saju-core/index.ts
git commit -m "refactor(saju-core): 지지 관계를 쌍과 집합으로 갈라 공용 모듈로 꺼낸다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `daeunSwitchIn` — 그 해 안의 대운 전환 시각

대운은 구간 **경계**가 아니다(스펙: 경계는 입춘 단독). 하지만 전환이 그 해 안에 있으면 **전환 후보**이고 07 섹션의 내용이 된다.

**Files:**
- Create: `src/lib/saju-core/flow/switch.ts`
- Create: `src/lib/saju-core/flow/switch.test.ts`
- Modify: `src/lib/saju-core/index.ts`

**Interfaces:**
- Consumes: `type SajuAnalysis` (`../analyze`), `type DaeunPeriod` (`../luck`), `type FlowYearPeriod` (Task 2)
- Produces:
  - `interface DaeunSwitch { at: Date; before: DaeunPeriod; after: DaeunPeriod }`
  - `daeunSwitchIn(analysis: SajuAnalysis, period: FlowYearPeriod): DaeunSwitch | null`

**배경 (읽고 시작할 것):**
- `src/lib/saju-core/luck.ts:15-37` — `DaeunPeriod.startAge` 는 **세는 나이 기준 시작 나이**이고, `Daeun.startAgePrecise` 는 소수점까지 있는 첫 대운 시작 나이다. `periods[i].startAge = daeunSu + i * 10` 이라 반올림된 값이다.
- 전환 시각은 **출생 순간 + startAgePrecise + i×10 년**으로 잡는다. 반올림된 `startAge` 로 잡으면 최대 반년이 어긋난다.
- `analysis.chart.solar` 에 `{ year, month, day, hour, minute }` 가 있다 (`luck.ts:38` 의 `birthJD` 가 그렇게 읽는다). 이 값은 **KST 민간시**다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/saju-core/flow/switch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { flowYearAt } from "./year";
import { daeunSwitchIn } from "./switch";

const subject = analyze({
  year: 1990,
  month: 6,
  day: 15,
  hour: 10,
  minute: 30,
  gender: "male",
  calendar: "solar",
});

describe("daeunSwitchIn", () => {
  it("전환이 없는 해에는 null 이다", () => {
    // 대운은 10년에 한 번이므로 연속한 10년 중 아홉 해는 전환이 없다.
    const years = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029];
    const hits = years.filter(
      (y) => daeunSwitchIn(subject, flowYearAt(new Date(Date.UTC(y, 5, 1)))) !== null,
    );
    expect(hits).toHaveLength(1);
  });

  it("전환이 있는 해에는 그 구간 안의 시각을 준다", () => {
    const year = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029].find(
      (y) => daeunSwitchIn(subject, flowYearAt(new Date(Date.UTC(y, 5, 1)))) !== null,
    )!;
    const period = flowYearAt(new Date(Date.UTC(year, 5, 1)));
    const found = daeunSwitchIn(subject, period)!;

    expect(found.at.getTime()).toBeGreaterThanOrEqual(period.start.getTime());
    expect(found.at.getTime()).toBeLessThan(period.end.getTime());
  });

  it("전후 대운은 이웃한 회차다", () => {
    const year = [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029].find(
      (y) => daeunSwitchIn(subject, flowYearAt(new Date(Date.UTC(y, 5, 1)))) !== null,
    )!;
    const found = daeunSwitchIn(subject, flowYearAt(new Date(Date.UTC(year, 5, 1))))!;

    expect(found.after.index).toBe(found.before.index + 1);
    expect(found.after.pillar).not.toBe(found.before.pillar);
  });

  it("첫 대운이 시작되기 한참 전(유년기)에는 null 이다", () => {
    expect(daeunSwitchIn(subject, flowYearAt(new Date(Date.UTC(1991, 5, 1))))).toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/saju-core/flow/switch.test.ts`
Expected: FAIL — Cannot find module './switch'

- [ ] **Step 3: 최소 구현을 쓴다**

`src/lib/saju-core/flow/switch.ts`:

```ts
// 대운 전환이 이 명리 연도 안에 드는가.
//
// 대운은 구간 경계가 아니다 — 경계는 입춘 단독이고 상품 단위는 연 1회다.
// 대운 전환은 "전환 후보" 이고, 전후 변화가 임계를 넘을 때만 구간이 갈린다.
// (판정은 api/flows/_lib/segments.ts)

import type { SajuAnalysis } from "../analyze";
import type { DaeunPeriod } from "../luck";
import type { FlowYearPeriod } from "./year";

export interface DaeunSwitch {
  /** 전환 순간 */
  at: Date;
  before: DaeunPeriod;
  after: DaeunPeriod;
}

/** 율리우스력 1년의 평균 길이(ms). 나이를 시각으로 옮길 때 쓴다. */
const YEAR_MS = 365.25 * 24 * 3600_000;

/** 출생 순간(KST 민간시)을 절대 시각으로. */
function birthInstant(analysis: SajuAnalysis): Date {
  const s = analysis.chart.solar;
  return new Date(
    Date.UTC(s.year, s.month - 1, s.day, s.hour ?? 0, s.minute, 0) - 9 * 3600_000,
  );
}

/**
 * 이 구간 안에 드는 대운 전환. 없으면 null.
 *
 * 회차 i 의 전환 시각 = 출생 + (startAgePrecise + i×10) 년.
 * 반올림된 periods[i].startAge 를 쓰지 않는 이유: 대운수는 정수로 반올림되므로
 * 최대 반년이 어긋난다. 구간 경계를 여기서 정하지는 않지만, 07 섹션이 "11월
 * 무렵부터" 를 이 값에서 뽑으므로 반년 오차는 그대로 사용자에게 보인다.
 */
export function daeunSwitchIn(
  analysis: SajuAnalysis,
  period: FlowYearPeriod,
): DaeunSwitch | null {
  const { startAgePrecise, periods } = analysis.daeun;
  const birth = birthInstant(analysis).getTime();

  for (let i = 1; i < periods.length; i += 1) {
    const at = birth + (startAgePrecise + i * 10) * YEAR_MS;
    if (at >= period.start.getTime() && at < period.end.getTime()) {
      return { at: new Date(at), before: periods[i - 1], after: periods[i] };
    }
  }

  return null;
}
```

`src/lib/saju-core/index.ts` 의 흐름 재수출 블록을 넓힌다:

```ts
export { daeunSwitchIn, type DaeunSwitch } from "./flow/switch";
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/saju-core/flow/switch.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/saju-core/flow/switch.ts src/lib/saju-core/flow/switch.test.ts src/lib/saju-core/index.ts
git commit -m "feat(saju-core): 명리 연도 안에 드는 대운 전환 시각을 구한다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase B · 구간 선별

### Task 6: `score.ts` — 정규화된 두 축

전환점을 고르는 자는 두 축뿐이다. **십성은 넣지 않는다** — 십성은 "변화가 어디에서 체감되는가"를 정하는 축이라 성격이 다르고, 전환 점수에 넣으면 같은 작용을 두 번 반영한다.

**두 축을 같은 자로 만드는 것이 이 태스크의 요점이다.** `friction` 이 가중합이고 `support` 가 ±점수면 `friction` 이 혼자 전환을 결정한다.

**Files:**
- Create: `src/app/api/flows/_lib/score.ts`
- Create: `src/app/api/flows/_lib/score.test.ts`

**Interfaces:**
- Consumes: `STEMS`, `branchElementOf`, `controlledBy`, `isStem`, `isBranch`, `pairRelations` (Task 4), `setRelations` (Task 4), `type Branch`, `type Element`, `type Yongsin` — 모두 `@/lib/saju-core`
- Produces:
  - `interface Pillar2 { stem: Stem; branch: Branch }`
  - `parsePillar2(korean: string): Pillar2 | null`
  - `supportOf(pillar: Pillar2, yongsin: Yongsin): number` — `−1 … +1`
  - `interface FrictionTargets { natal: Branch[]; sewun: Branch; daeun: Branch }`
  - `frictionOf(branch: Branch, targets: FrictionTargets): number` — 대략 `−1 … +1`
  - `WEIGHT_TOTAL: 12`

**배경 (읽고 시작할 것):**
- `src/lib/saju-core/strength.ts:18-27` — `POSITION_WEIGHTS`. 자리 가중의 근거다
- `src/lib/saju-core/synastry.ts:67-76` — `tieWeight`. **이걸 쓰지 않는다.** 거기서 재는 것은 "두 사람의 밀착" 이고 여기서 재는 것은 "원국이 흔들리는 정도" 다
- `src/lib/saju-core/yongsin.ts:18-27` — `Yongsin { yongsin: Element; huisin: Element }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/score.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Yongsin } from "@/lib/saju-core";
import { frictionOf, parsePillar2, supportOf } from "./score";

// 용신 화, 희신 목. 화를 극하는 것은 수다.
const yongsin: Yongsin = {
  method: "억부",
  basis: "신약",
  yongsin: "화",
  huisin: "목",
  reason: "테스트",
};

describe("parsePillar2", () => {
  it("두 글자 간지를 천간과 지지로 가른다", () => {
    expect(parsePillar2("병오")).toEqual({ stem: "병", branch: "오" });
  });

  it("모양이 아니면 null", () => {
    expect(parsePillar2("병")).toBeNull();
    expect(parsePillar2("가나")).toBeNull();
  });
});

describe("supportOf", () => {
  it("천간·지지가 둘 다 용신이면 최대치 +1 이다", () => {
    // 병(화) + 오(화) — 둘 다 용신
    expect(supportOf(parsePillar2("병오")!, yongsin)).toBe(1);
  });

  it("둘 다 용신을 극하면 최소치 −1 이다", () => {
    // 임(수) + 자(수) — 화를 극한다
    expect(supportOf(parsePillar2("임자")!, yongsin)).toBe(-1);
  });

  it("희신은 용신의 절반으로 센다", () => {
    // 갑(목) + 인(목) — 둘 다 희신 → (0.5 + 0.5) / 2
    expect(supportOf(parsePillar2("갑인")!, yongsin)).toBeCloseTo(0.5);
  });

  it("무관한 오행은 0 이다", () => {
    // 경(금) + 신(금) — 용신도 희신도 아니고 화를 극하지도 않는다
    expect(supportOf(parsePillar2("경신")!, yongsin)).toBe(0);
  });

  it("언제나 −1 과 +1 사이다", () => {
    for (const p of ["병오", "임자", "갑인", "경신", "무진", "계축"]) {
      const v = supportOf(parsePillar2(p)!, yongsin);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("frictionOf", () => {
  const targets = { natal: ["자", "축", "인", "묘"] as const, sewun: "오", daeun: "미" };

  it("충이 많을수록 커진다", () => {
    // 오는 자와 충. 자는 원국 년지(가중 1.5)에 있다.
    const withChung = frictionOf("오", { ...targets, natal: ["자", "축", "인", "묘"] });
    const without = frictionOf("술", { ...targets, natal: ["자", "축", "인", "묘"] });
    expect(withChung).toBeGreaterThan(without);
  });

  it("육합은 흔들림을 줄인다 — 음수 기여다", () => {
    // 축은 자와 육합
    expect(frictionOf("축", { natal: ["자", "자", "자", "자"], sewun: "자", daeun: "자" }))
      .toBeLessThan(0);
  });

  it("아무 관계도 없으면 0 이다", () => {
    expect(frictionOf("자", { natal: ["자", "자", "자", "자"], sewun: "자", daeun: "자" })).toBe(0);
  });

  it("자리 가중이 다르다 — 같은 충이라도 월지가 년지보다 무겁다", () => {
    // natal 순서는 [년, 월, 일, 시]
    const atMonth = frictionOf("오", { natal: ["신", "자", "신", "신"], sewun: "신", daeun: "신" });
    const atYear = frictionOf("오", { natal: ["자", "신", "신", "신"], sewun: "신", daeun: "신" });
    expect(atMonth).toBeGreaterThan(atYear);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/score.test.ts`
Expected: FAIL — Cannot find module './score'

- [ ] **Step 3: 최소 구현을 쓴다**

`src/app/api/flows/_lib/score.ts`:

```ts
// 흐름의 두 축.
//
//   support   흐름이 나에게 힘을 보태는가 소모시키는가   (−1 … +1)
//   friction  원국·세운·대운과의 관계가 얼마나 흔들리는가 (대략 −1 … +1)
//
// ⚠️ 두 축을 반드시 같은 자로 만든다. friction 이 가중합이고 support 가 ±점수면
// Δ 를 더할 때 friction 이 혼자 전환을 결정한다.
//
// 십성은 여기 없다. 십성은 "변화가 어디에서 체감되는가" 를 정하는 축이라
// 전환 시점 판정에 넣으면 같은 작용을 두 번 반영하고, 범주가 바뀌었다는 이유만으로
// 실제 세기 차이가 작아도 구간을 억지로 나눈다. (프롬프트의 facts 블록에서는 쓴다)

import {
  STEMS,
  branchElementOf,
  controlledBy,
  isBranch,
  isStem,
  pairRelations,
  setRelations,
  type Branch,
  type Element,
  type Stem,
  type Yongsin,
} from "@/lib/saju-core";

export interface Pillar2 {
  stem: Stem;
  branch: Branch;
}

/** "병오" → { stem: "병", branch: "오" }. 모양이 아니면 null. */
export function parsePillar2(korean: string): Pillar2 | null {
  if (korean.length !== 2) return null;
  const [s, b] = [korean[0], korean[1]];
  if (!isStem(s) || !isBranch(b)) return null;
  return { stem: s, branch: b };
}

/** 오행 하나가 용신 축에서 어느 편인가. */
function elementScore(el: Element, yongsin: Yongsin): number {
  if (el === yongsin.yongsin) return 1;
  if (el === yongsin.huisin) return 0.5;
  if (el === controlledBy(yongsin.yongsin)) return -1;
  return 0;
}

/**
 * 간지 두 글자의 오행을 용신 축에서 채점하고 글자 수로 나눈다.
 * 원값 −2 … +2 → −1 … +1.
 */
export function supportOf(pillar: Pillar2, yongsin: Yongsin): number {
  const stemEl = STEMS[pillar.stem].element;
  const branchEl = branchElementOf(pillar.branch);
  return (elementScore(stemEl, yongsin) + elementScore(branchEl, yongsin)) / 2;
}

/**
 * 관계 계수. 부호가 뜻을 갖는다 — 양수는 흔들림, 음수는 결속이다.
 * 충이 가장 무겁고 파가 가장 가볍다는 순서 말고는 근거가 없는 값이므로
 * 여기 한 곳에만 둔다.
 */
const KIND_COEFF = {
  충: 1.0,
  형: 0.7,
  원진: 0.5,
  해: 0.4,
  파: 0.3,
  육합: -0.6,
} as const;

/** 삼합 완성은 육합보다 강한 결속이다. */
const SAMHAP_COEFF = -0.8;

/**
 * 자리 가중. strength.ts 의 POSITION_WEIGHTS 를 따른다 — 여기서 재는 것이
 * "원국이 흔들리는 정도" 이기 때문이다. synastry 의 tieWeight(일지 3 / 월지 2)는
 * "두 사람의 밀착" 을 재는 다른 자라서 쓰지 않는다.
 *
 * 세운·대운을 2 로 두는 이유: 지금 들어와 있는 흐름이라 일지만큼 무겁게 본다.
 */
const NATAL_WEIGHTS = [1.5, 3, 2, 1.5] as const; // 년 · 월 · 일 · 시
const SEWUN_WEIGHT = 2;
const DAEUN_WEIGHT = 2;

/** 정규화 분모. 두 축이 같은 자를 쓰게 하는 값이다. */
export const WEIGHT_TOTAL =
  NATAL_WEIGHTS.reduce((a, b) => a + b, 0) + SEWUN_WEIGHT + DAEUN_WEIGHT; // 12

export interface FrictionTargets {
  /** 원국 4지 — [년, 월, 일, 시] 순서 */
  natal: readonly Branch[];
  sewun: Branch;
  daeun: Branch;
}

function pairScore(a: Branch, b: Branch): number {
  let sum = 0;
  for (const kind of pairRelations(a, b)) sum += KIND_COEFF[kind];
  return sum;
}

/**
 * 이 지지가 원국·세운·대운을 얼마나 흔드는가.
 *
 * 쌍 관계는 상대별로 가중해 더하고, 삼합은 판 전체를 놓고 한 번만 판정한다 —
 * 세 글자가 있어야 성립하는 관계를 쌍으로 세면 반합을 삼합으로 과대평가한다.
 */
export function frictionOf(branch: Branch, targets: FrictionTargets): number {
  let sum = 0;

  targets.natal.forEach((b, i) => {
    sum += pairScore(branch, b) * (NATAL_WEIGHTS[i] ?? 1);
  });
  sum += pairScore(branch, targets.sewun) * SEWUN_WEIGHT;
  sum += pairScore(branch, targets.daeun) * DAEUN_WEIGHT;

  // 삼합은 이 지지가 들어와서 **새로 완성되는** 것만 센다.
  const without = [...targets.natal, targets.sewun, targets.daeun];
  const before = setRelations(without).filter((r) => r.kind === "삼합").length;
  const after = setRelations([...without, branch]).filter((r) => r.kind === "삼합").length;
  if (after > before) sum += SAMHAP_COEFF * (after - before) * SEWUN_WEIGHT;

  return sum / WEIGHT_TOTAL;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/score.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/flows/_lib/score.ts src/app/api/flows/_lib/score.test.ts
git commit -m "feat(flows): 흐름의 두 축을 같은 자로 정규화해 매긴다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: `segments.ts` — Δ 로 전환을 골라 1~3구간을 낸다

**전환점은 벡터의 절대값이 아니라 인접 구간 사이의 변화량이다.** 기획서 §12 가 묻는 것은 "어느 달이 센가"가 아니라 "어디서부터 달라지는가"다.

이 태스크는 **임계값 측정 스텝을 포함한다.** 값을 정하지 않은 채로 끝났다고 하지 않는다.

**Files:**
- Create: `src/app/api/flows/_lib/segments.ts`
- Create: `src/app/api/flows/_lib/segments.test.ts`
- Create: `scripts/flow-threshold.mts`

**Interfaces:**
- Consumes: `monthTermsOf` / `type MonthTerm` (Task 3), `flowYearAt` / `type FlowYearPeriod` (Task 2), `daeunSwitchIn` / `type DaeunSwitch` (Task 5), `sewunPillars` (기존), `supportOf` / `frictionOf` / `parsePillar2` / `type FrictionTargets` (Task 6), `type SajuAnalysis` (기존)
- Produces:
  - `const SEGMENT_IDS = ["segment_1", "segment_2", "segment_3"] as const`
  - `type SegmentId = (typeof SEGMENT_IDS)[number]`
  - `interface FlowSegment { id: SegmentId; start: string; end: string; basis: "연시작" | "대운전환" | "월운전환" }`
  - `interface MonthScore { term: MonthTerm; support: number; friction: number }`
  - `monthScores(analysis: SajuAnalysis, year: number): MonthScore[]`
  - `flowSegments(analysis: SajuAnalysis, year: number): FlowSegment[]` — 언제나 1~3개
  - `FLOW_SEGMENT_THRESHOLD: number`
  - `MIN_SEGMENT_MONTHS: 3`, `MAX_TRANSITIONS: 2`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/segments.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { flowSegments, monthScores, SEGMENT_IDS } from "./segments";

const subject = analyze({
  year: 1990,
  month: 6,
  day: 15,
  hour: 10,
  minute: 30,
  gender: "male",
  calendar: "solar",
});

describe("monthScores", () => {
  it("12개 월운 전부를 채점한다 — 계산 해상도는 12, 노출은 최대 3", () => {
    expect(monthScores(subject, 2026)).toHaveLength(12);
  });

  it("두 축 다 정규화 범위 안이다", () => {
    for (const s of monthScores(subject, 2026)) {
      expect(s.support).toBeGreaterThanOrEqual(-1);
      expect(s.support).toBeLessThanOrEqual(1);
      expect(Math.abs(s.friction)).toBeLessThanOrEqual(2);
    }
  });
});

describe("flowSegments", () => {
  const segs = flowSegments(subject, 2026);

  it("언제나 1~3개다", () => {
    expect(segs.length).toBeGreaterThanOrEqual(1);
    expect(segs.length).toBeLessThanOrEqual(3);
  });

  it("id 는 순서대로 붙는다", () => {
    expect(segs.map((s) => s.id)).toEqual(SEGMENT_IDS.slice(0, segs.length));
  });

  it("첫 구간은 연시작이다", () => {
    expect(segs[0].basis).toBe("연시작");
  });

  it("틈도 겹침도 없다 — 한 구간의 end 가 다음 구간의 start 다", () => {
    for (let i = 0; i < segs.length - 1; i += 1) {
      expect(segs[i].end).toBe(segs[i + 1].start);
    }
  });

  it("전체가 그 명리 연도를 덮는다", () => {
    const all = flowSegments(subject, 2026);
    const months = monthScores(subject, 2026);
    expect(all[0].start).toBe(months[0].term.start.toISOString());
    expect(all[all.length - 1].end).toBe(months[11].term.end.toISOString());
  });

  it("구간은 최소 3개월이다", () => {
    const MONTH_MS = 30 * 24 * 3600_000;
    for (const s of segs) {
      expect(Date.parse(s.end) - Date.parse(s.start)).toBeGreaterThanOrEqual(2.5 * MONTH_MS);
    }
  });

  it("같은 입력은 같은 구간을 낸다 — 동점 처리가 결정적이다", () => {
    expect(flowSegments(subject, 2026)).toEqual(flowSegments(subject, 2026));
  });

  it("여러 사람·여러 해를 돌려도 언제나 1~3개다", () => {
    for (const y of [2024, 2025, 2026, 2027]) {
      for (const g of ["male", "female"] as const) {
        const a = analyze({ year: 1985, month: 3, day: 3, hour: 7, minute: 0, gender: g, calendar: "solar" });
        const out = flowSegments(a, y);
        expect(out.length).toBeGreaterThanOrEqual(1);
        expect(out.length).toBeLessThanOrEqual(3);
      }
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/segments.test.ts`
Expected: FAIL — Cannot find module './segments'

- [ ] **Step 3: 최소 구현을 쓴다**

`src/app/api/flows/_lib/segments.ts`:

```ts
// 그 해를 몇 구간으로 나눌 것인가 — 명리가 아니라 **편집 규칙**이라 서비스에 산다.
//
// 기획서 §12: 변화가 크지 않으면 굳이 여러 구간을 만들지 않는다.
// 기획서 §4:  12개월을 모두 해설하지 않는다 — 12개를 계산하되 최대 3구간만 노출한다.

import {
  daeunSwitchIn,
  flowYearAt,
  monthTermsOf,
  sewunPillars,
  type MonthTerm,
  type SajuAnalysis,
} from "@/lib/saju-core";
import { frictionOf, parsePillar2, supportOf, type FrictionTargets } from "./score";

export const SEGMENT_IDS = ["segment_1", "segment_2", "segment_3"] as const;
export type SegmentId = (typeof SEGMENT_IDS)[number];

export interface FlowSegment {
  id: SegmentId;
  /** ISO instant */
  start: string;
  /** ISO instant */
  end: string;
  basis: "연시작" | "대운전환" | "월운전환";
}

export interface MonthScore {
  term: MonthTerm;
  support: number;
  friction: number;
}

/**
 * ⚠️ 이 값 하나가 구간 개수를 정한다.
 *
 * strength.ts 의 STRENGTH_THRESHOLDS 와 같은 성격의 상수다 — 근거는 이론이 아니라
 * 분포다. scripts/flow-threshold.mts 로 60 일주 × 여러 생년의 Δ 분포를 뽑아
 * "대부분 2구간 · 드물게 1 또는 3" 이 되는 지점을 골랐다.
 *
 * 올리면 구간이 줄고(1구간이 흔해진다) 내리면 늘어난다(3구간이 흔해진다).
 * 바꾸기 전에 스크립트를 다시 돌릴 것 — 이미 판 흐름은 flows.segments 에 박제돼
 * 있어 소급되지 않지만, 새로 파는 흐름의 성격이 통째로 달라진다.
 */
export const FLOW_SEGMENT_THRESHOLD = 0.35;

/** 구간이 이보다 짧으면 전환으로 치지 않는다. */
export const MIN_SEGMENT_MONTHS = 3;

/** 최대 전환 수. 2 = 최대 3구간. */
export const MAX_TRANSITIONS = 2;

const MONTH_MS = 30 * 24 * 3600_000;

function targetsFor(analysis: SajuAnalysis, year: number): FrictionTargets {
  const c = analysis.chart;
  const sewun = parsePillar2(sewunPillars(year, 1)[0].korean);
  const period = flowYearAt(new Date(Date.UTC(year, 5, 1)));
  const sw = daeunSwitchIn(analysis, period);
  // 그해 대부분을 차지하는 대운을 대표로 쓴다. 전환이 있으면 전환 뒤쪽이 아니라
  // 앞쪽을 쓴다 — 연초부터 적용되는 쪽이다. 전환 자체는 후보로 따로 잰다.
  const current = sw?.before ?? currentDaeun(analysis, period);
  return {
    natal: [c.year.branch, c.month.branch, c.day.branch, c.hour?.branch].filter(
      (b): b is NonNullable<typeof b> => b != null,
    ),
    sewun: sewun!.branch,
    daeun: current.branch,
  };
}

/** 이 구간이 시작될 때 적용 중인 대운. */
function currentDaeun(analysis: SajuAnalysis, period: ReturnType<typeof flowYearAt>) {
  const { periods } = analysis.daeun;
  // 세는 나이 — periods[i].startAge 와 같은 기준이다.
  const ageAtStart = period.start.getUTCFullYear() - analysis.chart.solar.year + 1;
  return [...periods].reverse().find((p) => p.startAge <= ageAtStart) ?? periods[0];
}

/** 12개 월운 전부를 채점한다. */
export function monthScores(analysis: SajuAnalysis, year: number): MonthScore[] {
  const targets = targetsFor(analysis, year);
  return monthTermsOf(year).map((term) => {
    const p = parsePillar2(term.korean)!;
    return {
      term,
      support: supportOf(p, analysis.yongsin),
      friction: frictionOf(p.branch, targets),
    };
  });
}

interface Candidate {
  at: Date;
  delta: number;
  basis: "대운전환" | "월운전환";
}

/**
 * 그 해의 구간. 언제나 1~3개이고 틈도 겹침도 없다.
 *
 * 전환점은 벡터의 절대값이 아니라 **인접 구간 사이의 변화량**이다. 점수가 높은 달을
 * 고르면 "어디서부터 달라지는가" 가 아니라 "어느 달이 센가" 에 답하게 된다.
 */
export function flowSegments(analysis: SajuAnalysis, year: number): FlowSegment[] {
  const scores = monthScores(analysis, year);
  const yearStart = scores[0].term.start;
  const yearEnd = scores[scores.length - 1].term.end;

  const candidates: Candidate[] = [];

  for (let i = 1; i < scores.length; i += 1) {
    const delta =
      Math.abs(scores[i].support - scores[i - 1].support) +
      Math.abs(scores[i].friction - scores[i - 1].friction);
    candidates.push({ at: scores[i].term.start, delta, basis: "월운전환" });
  }

  // 대운 전환도 같은 자로 잰다 — 전후가 같은 편이면 구간을 쪼개지 않는다.
  const period = flowYearAt(new Date(Date.UTC(year, 5, 1)));
  const sw = daeunSwitchIn(analysis, period);
  if (sw) {
    const before = parsePillar2(sw.before.pillar)!;
    const after = parsePillar2(sw.after.pillar)!;
    const targets = targetsFor(analysis, year);
    const delta =
      Math.abs(supportOf(after, analysis.yongsin) - supportOf(before, analysis.yongsin)) +
      Math.abs(frictionOf(after.branch, targets) - frictionOf(before.branch, targets));
    candidates.push({ at: sw.at, delta, basis: "대운전환" });
  }

  // Δ 내림차순. 동점이면 이른 쪽 — 사용자는 지금부터 앞을 보고, 무엇보다
  // 결정적이어서 같은 입력이 같은 구간을 낸다.
  candidates.sort((a, b) => b.delta - a.delta || a.at.getTime() - b.at.getTime());

  const picked: Candidate[] = [];
  for (const c of candidates) {
    if (picked.length >= MAX_TRANSITIONS) break;
    if (c.delta < FLOW_SEGMENT_THRESHOLD) continue;
    const tooClose =
      c.at.getTime() - yearStart.getTime() < MIN_SEGMENT_MONTHS * MONTH_MS ||
      yearEnd.getTime() - c.at.getTime() < MIN_SEGMENT_MONTHS * MONTH_MS ||
      picked.some(
        (p) => Math.abs(p.at.getTime() - c.at.getTime()) < MIN_SEGMENT_MONTHS * MONTH_MS,
      );
    if (tooClose) continue;
    picked.push(c);
  }

  picked.sort((a, b) => a.at.getTime() - b.at.getTime());

  const bounds = [yearStart, ...picked.map((p) => p.at), yearEnd];
  return bounds.slice(0, -1).map((start, i) => ({
    id: SEGMENT_IDS[i],
    start: start.toISOString(),
    end: bounds[i + 1].toISOString(),
    basis: i === 0 ? ("연시작" as const) : picked[i - 1].basis,
  }));
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/segments.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: 임계값을 측정한다**

`scripts/flow-threshold.mts`:

```ts
// FLOW_SEGMENT_THRESHOLD 를 고르기 위한 분포 측정.
//
// 눈대중으로 고른 상수는 나중에 아무도 못 고친다(synastry.ts:70). 값의 근거를
// 분포로 남기려고 둔다. 실행: npx tsx scripts/flow-threshold.mts

import { analyze } from "../src/lib/saju-core/index.js";
import { flowSegments } from "../src/app/api/flows/_lib/segments.js";

const YEARS = [2025, 2026, 2027];
const BIRTHS: { year: number; month: number; day: number }[] = [];
for (let y = 1960; y <= 2005; y += 5) {
  for (const [m, d] of [[2, 10], [5, 22], [8, 3], [11, 17]] as const) {
    BIRTHS.push({ year: y, month: m, day: d });
  }
}

const counts = new Map<number, number>();
for (const b of BIRTHS) {
  for (const g of ["male", "female"] as const) {
    const a = analyze({ ...b, hour: 9, minute: 0, gender: g, calendar: "solar" });
    for (const y of YEARS) {
      const n = flowSegments(a, y).length;
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
  }
}

const total = [...counts.values()].reduce((x, y) => x + y, 0);
for (const n of [1, 2, 3]) {
  const c = counts.get(n) ?? 0;
  console.log(`${n}구간: ${c}건 (${((c / total) * 100).toFixed(1)}%)`);
}
```

Run: `npx tsx scripts/flow-threshold.mts`

**통과 조건:** 2구간이 가장 흔하고(대략 50% 이상), 1구간과 3구간이 둘 다 0이 아니다. 그렇지 않으면 `FLOW_SEGMENT_THRESHOLD` 를 조정하고 다시 돌린다 — 3구간이 없으면 내리고, 1구간이 없으면 올린다. 최종값과 그때의 분포를 `segments.ts` 의 상수 주석에 적는다.

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/flows/_lib/segments.ts src/app/api/flows/_lib/segments.test.ts scripts/flow-threshold.mts
git commit -m "feat(flows): 인접 구간의 변화량으로 그 해를 1~3구간으로 나눈다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase C · 데이터

### Task 8: 마이그레이션

**파일 하나에 SQL 문장은 하나만 담는다** — Neon HTTP 드라이버가 한 쿼리에 문장 여러 개를 거부한다(`migrations/README.md`). 그래서 테이블 하나에 인덱스 둘이면 파일이 셋이다.

**Files:**
- Create: `migrations/0033_flows.sql`
- Create: `migrations/0034_flows_unique.sql`
- Create: `migrations/0035_flows_user_created_idx.sql`
- Create: `migrations/0036_flow_sections.sql`
- Modify: `migrations/README.md` (마지막 줄 "다음 번호")

**Interfaces:**
- Produces: 테이블 `flows`, `flow_sections`. 이후 모든 store 태스크가 이 컬럼 이름에 의존한다.

**배경 (읽고 시작할 것):**
- `migrations/README.md` — 번호 규칙과 한 파일 한 문장 제약
- `migrations/0015_match_sections.sql` — `flow_sections` 가 그대로 따르는 모양
- 현재 마지막 번호는 `0032_profiles_drop_retention.sql` 이다

- [ ] **Step 1: `flows` 테이블**

`migrations/0033_flows.sql`:

```sql
-- 흐름 리포트 1건. 이용권 1장이 차감되는 단위이기도 하다.
--
-- flow_year 는 달력 연도가 아니라 명리 연도(세운)다 — 입춘에서 바뀐다.
-- 2026-01-20 에 조회하면 flow_year 는 2025 다.
--
-- period_start/end 는 flow_year 만 알면 계산되는 값이라 중복이다. 그럼에도
-- 저장하는 이유: 절기 계산이 나중에 정밀해져 입춘 시각이 움직여도, 이미 판
-- 상품의 유효 기간이 소급해서 바뀌면 안 된다. 발행 시점의 경계를 박제한다.
--
-- segments 를 같이 박제하는 이유도 같다. 읽을 때마다 다시 계산하면
-- FLOW_SEGMENT_THRESHOLD 를 한 번 튜닝하는 것만으로 저장된 서술의 구간 수·경계가
-- 어긋나 11월 서술이 2월 칸에 붙는다.
--   [{ "id": "segment_1", "start": ISO, "end": ISO, "basis": "연시작" }, ...]
--
-- ⚠️ 경계 시각은 절대 시각이다. solarTermDate/solarTermJD 는 +9h 가 박힌 KST
-- 벽시계 값을 돌려주므로 그대로 넣으면 9시간 밀린다. solarTermInstant() 를 쓸 것.
CREATE TABLE IF NOT EXISTS flows (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id   bigint NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  flow_year    integer NOT NULL,
  period_start timestamptz NOT NULL,
  period_end   timestamptz NOT NULL,
  segments     jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: 유니크 인덱스**

`migrations/0034_flows_unique.sql`:

```sql
-- 한 프로필의 한 해는 한 행. 재요청이 같은 행으로 수렴하는 근거이자,
-- 같은 해에 이용권이 두 번 차감되지 않게 하는 근거다 (entitlements.subject_key = flow_id).
--
-- user_id 가 없어도 되는 이유: profiles.user_id 가 NOT NULL 이라 프로필의 소유자는
-- 하나뿐이다 — matches_unique 와 같은 판단.
CREATE UNIQUE INDEX IF NOT EXISTS flows_unique ON flows (profile_id, flow_year);
```

- [ ] **Step 3: 목록 인덱스**

`migrations/0035_flows_user_created_idx.sql`:

```sql
-- '이미 본 흐름' 목록은 user_id 로 걸러 created_at 역순으로 읽는다.
-- 없으면 flows 전체를 훑는다 (matches_user_created_idx 와 같은 판단).
CREATE INDEX IF NOT EXISTS flows_user_created_idx ON flows (user_id, created_at DESC);
```

- [ ] **Step 4: `flow_sections` 테이블**

`migrations/0036_flow_sections.sql`:

```sql
-- 생성된 서술. 캐시가 아니라 결과 저장이다.
--
-- 리포트 해석은 chartKey 로 사람 사이에서 공유되지만, 흐름은 프로필 × 연도라
-- 교차 사용자 적중률이 0 에 수렴한다. 여기서 필요한 건 적중률이 아니라 영속성이다 —
-- 이용권을 쓴 결과가 새로고침마다 달라지면 안 된다. (match_sections 와 같은 판단)
--
-- content 는 01~06·08 이 { common, segments: [...] }, 07 이 { segments: [...] } 다.
-- segments 의 개수는 flows.segments 와 반드시 일치한다 — 어긋나면 파싱에서 걸러진다.
CREATE TABLE IF NOT EXISTS flow_sections (
  flow_id        bigint NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  section_key    text   NOT NULL,
  content        jsonb  NOT NULL,
  schema_version int    NOT NULL,
  model          text   NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (flow_id, section_key)
);
```

- [ ] **Step 5: README 의 다음 번호를 갱신한다**

`migrations/README.md` 의 마지막 줄을 바꾼다:

```markdown
**다음 번호는 0037 부터다.**
```

- [ ] **Step 6: 마이그레이션을 돌린다**

Run: `npm run db:migrate`
Expected: `0033_flows.sql` ~ `0036_flow_sections.sql` 네 개가 적용됐다고 찍힌다.

> 개발 DB 는 워크트리들이 공유한다. 이 네 파일은 **신규 생성만** 하고 기존 테이블을 건드리지 않으므로 다른 브랜치를 깨뜨리지 않는다.

- [ ] **Step 7: 커밋**

```bash
git add migrations/0033_flows.sql migrations/0034_flows_unique.sql migrations/0035_flows_user_created_idx.sql migrations/0036_flow_sections.sql migrations/README.md
git commit -m "feat(db): 흐름 리포트와 그 서술을 담을 테이블을 연다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: `lib/flows/store.ts` — 행 찾기와 만들기

**Files:**
- Create: `src/lib/flows/store.ts`
- Create: `src/lib/flows/store.test.ts`

**Interfaces:**
- Consumes: `sql`, `type SqlClient` (`@/lib/db`), `type FlowSegment` (Task 7)
- Produces:
  - `interface FlowRow { id: string; userId: string; profileId: string; flowYear: number; periodStart: Date; periodEnd: Date; segments: FlowSegment[]; createdAt: Date }`
  - `interface CreateFlowInput { profileId: string; flowYear: number; periodStart: Date; periodEnd: Date; segments: FlowSegment[] }`
  - `findFlow(profileId: string, flowYear: number, client?): Promise<FlowRow | null>`
  - `findOrCreateFlow(userId: string, input: CreateFlowInput, client?): Promise<{ id: string; created: boolean }>`
  - `getFlow(userId: string, id: string, client?): Promise<FlowRow | null>`
  - `listFlows(userId: string, client?): Promise<FlowRow[]>`

**배경 (읽고 시작할 것):**
- `src/lib/matches/store.ts:121-158` — `findOrCreateMatch`. INSERT … ON CONFLICT DO NOTHING RETURNING 이 비면 SELECT 로 되찾고, 그것도 없으면 **던진다**. 조용히 null 을 흘리면 화면이 "찾을 수 없다" 로만 보여 원인이 묻힌다.
- `src/lib/matches/store.ts:167-177` — `getMatch`. **`user_id` 조건이 존재 이유다.** id 가 순번 bigint 라 URL 에 노출되므로 id 만으로 찾으면 파라미터를 증가시켜 남의 것을 읽는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/flows/store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SqlClient } from "@/lib/db";
import { findFlow, findOrCreateFlow, getFlow } from "./store";

const segments = [
  { id: "segment_1" as const, start: "2026-02-04T00:00:00.000Z", end: "2026-08-07T00:00:00.000Z", basis: "연시작" as const },
  { id: "segment_2" as const, start: "2026-08-07T00:00:00.000Z", end: "2027-02-04T00:00:00.000Z", basis: "월운전환" as const },
];

const row = {
  id: 7,
  user_id: 3,
  profile_id: 11,
  flow_year: 2026,
  period_start: new Date("2026-02-04T00:00:00.000Z"),
  period_end: new Date("2027-02-04T00:00:00.000Z"),
  segments,
  created_at: new Date("2026-03-01T00:00:00.000Z"),
};

/** 태그드 템플릿 호출을 받아 쿼리 문자열과 값을 기록하는 가짜 client. */
function fakeSql(results: unknown[][]) {
  const calls: { text: string; values: unknown[] }[] = [];
  let i = 0;
  const client = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return Promise.resolve(results[i++] ?? []);
  }) as unknown as SqlClient;
  return { client, calls };
}

describe("findFlow", () => {
  it("프로필과 연도로 찾는다", async () => {
    const { client, calls } = fakeSql([[row]]);
    const out = await findFlow("11", 2026, client);

    expect(calls[0].text).toContain("FROM flows");
    expect(calls[0].values).toEqual(["11", 2026]);
    expect(out?.id).toBe("7");
    expect(out?.flowYear).toBe(2026);
    expect(out?.segments).toHaveLength(2);
  });

  it("없으면 null", async () => {
    const { client } = fakeSql([[]]);
    expect(await findFlow("11", 2026, client)).toBeNull();
  });
});

describe("findOrCreateFlow", () => {
  it("새로 넣으면 created 다", async () => {
    const { client } = fakeSql([[{ id: 7 }]]);
    expect(await findOrCreateFlow("3", {
      profileId: "11", flowYear: 2026,
      periodStart: row.period_start, periodEnd: row.period_end, segments,
    }, client)).toEqual({ id: "7", created: true });
  });

  it("충돌하면 기존 행으로 수렴한다 — 이용권이 두 번 나가지 않는 근거다", async () => {
    const { client } = fakeSql([[], [{ id: 7 }]]);
    expect(await findOrCreateFlow("3", {
      profileId: "11", flowYear: 2026,
      periodStart: row.period_start, periodEnd: row.period_end, segments,
    }, client)).toEqual({ id: "7", created: false });
  });

  it("충돌했는데 되찾지도 못하면 던진다 — 조용히 null 을 흘리지 않는다", async () => {
    const { client } = fakeSql([[], []]);
    await expect(
      findOrCreateFlow("3", {
        profileId: "11", flowYear: 2026,
        periodStart: row.period_start, periodEnd: row.period_end, segments,
      }, client),
    ).rejects.toThrow(/되찾지 못했습니다/);
  });
});

describe("getFlow", () => {
  it("user_id 를 WHERE 에 건다 — id 는 순번이라 URL 로 남의 것을 읽을 수 있다", async () => {
    const { client, calls } = fakeSql([[row]]);
    await getFlow("3", "7", client);
    expect(calls[0].text).toContain("user_id");
    expect(calls[0].values).toEqual(["7", "3"]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/flows/store.test.ts`
Expected: FAIL — Cannot find module './store'

- [ ] **Step 3: 최소 구현을 쓴다**

`src/lib/flows/store.ts`:

```ts
import { sql as neonSql, type SqlClient } from "@/lib/db";
import type { FlowSegment } from "@/app/api/flows/_lib/segments";

const sql = neonSql as unknown as SqlClient;

export interface FlowRow {
  id: string;
  userId: string;
  profileId: string;
  /** 명리 연도(세운). 달력 연도가 아니다 */
  flowYear: number;
  /** 발행 시점에 박제한 적용 기간 */
  periodStart: Date;
  periodEnd: Date;
  /** 발행 시점에 박제한 구간. 읽을 때 다시 계산하지 않는다 */
  segments: FlowSegment[];
  createdAt: Date;
}

export interface CreateFlowInput {
  profileId: string;
  flowYear: number;
  periodStart: Date;
  periodEnd: Date;
  segments: FlowSegment[];
}

function toFlowRow(raw: Record<string, unknown>): FlowRow {
  return {
    id: String(raw.id),
    userId: String(raw.user_id),
    profileId: String(raw.profile_id),
    flowYear: Number(raw.flow_year),
    periodStart: new Date(raw.period_start as string),
    periodEnd: new Date(raw.period_end as string),
    segments: raw.segments as FlowSegment[],
    createdAt: new Date(raw.created_at as string),
  };
}

/** 이 프로필의 이 해. 확인 화면이 "이미 만든 적 있나" 를 묻는 자리다. */
export async function findFlow(
  profileId: string,
  flowYear: number,
  client: SqlClient = sql,
): Promise<FlowRow | null> {
  const rows = await client`
    SELECT * FROM flows
     WHERE profile_id = ${profileId}::bigint AND flow_year = ${flowYear}
  `;
  const row = rows[0];
  return row ? toFlowRow(row) : null;
}

/**
 * 행을 만들거나 기존 행으로 수렴한다.
 *
 * ⚠️ 여기서 이용권을 깎지 않는다. 행 생성은 공짜고 차감은 생성기 자리
 * (api/flows/_lib/gated-generator.ts)에서 일어난다 — 같은 프로필·같은 해를 다시
 * 제출해 flows_unique 로 기존 행에 수렴하는 요청, 즉 LLM 을 한 번도 부르지 않는
 * 요청이 이용권을 먹으면 안 되기 때문이다. (궁합의 access.ts 와 같은 판단)
 */
export async function findOrCreateFlow(
  userId: string,
  input: CreateFlowInput,
  client: SqlClient = sql,
): Promise<{ id: string; created: boolean }> {
  const inserted = await client`
    INSERT INTO flows (user_id, profile_id, flow_year, period_start, period_end, segments)
    VALUES (
      ${userId}::bigint, ${input.profileId}::bigint, ${input.flowYear},
      ${input.periodStart.toISOString()}::timestamptz,
      ${input.periodEnd.toISOString()}::timestamptz,
      ${JSON.stringify(input.segments)}::jsonb
    )
    ON CONFLICT (profile_id, flow_year) DO NOTHING
    RETURNING id
  `;
  const row = inserted[0] as { id: string | number } | undefined;
  if (row) return { id: String(row.id), created: true };

  const existing = await client`
    SELECT id FROM flows
     WHERE profile_id = ${input.profileId}::bigint AND flow_year = ${input.flowYear}
  `;
  const found = existing[0] as { id: string | number } | undefined;
  // 충돌해서 안 넣었는데 찾지도 못하는 건 인덱스와 조회 조건이 어긋났다는 뜻이다.
  // 조용히 null 을 흘리면 화면이 "흐름을 찾을 수 없다" 로만 보여 원인이 묻힌다.
  if (!found) throw new Error("findOrCreateFlow: 충돌한 행을 다시 찾지 못했습니다");
  return { id: String(found.id), created: false };
}

/**
 * 내 흐름 하나.
 *
 * ⚠️ user_id 조건이 이 함수의 존재 이유다. flows.id 는 순번 bigint 라
 * URL(/flow/<id>)에 노출된다 — id 만으로 찾으면 파라미터를 증가시켜 남의 흐름을
 * 읽을 수 있다 (matches.getMatch 와 같은 판단).
 */
export async function getFlow(
  userId: string,
  id: string,
  client: SqlClient = sql,
): Promise<FlowRow | null> {
  const rows = await client`
    SELECT * FROM flows WHERE id = ${id}::bigint AND user_id = ${userId}::bigint
  `;
  const row = rows[0];
  return row ? toFlowRow(row) : null;
}

/** 이미 본 흐름 목록. 최신순. */
export async function listFlows(
  userId: string,
  client: SqlClient = sql,
): Promise<FlowRow[]> {
  const rows = await client`
    SELECT * FROM flows WHERE user_id = ${userId}::bigint ORDER BY created_at DESC
  `;
  return rows.map(toFlowRow);
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/flows/store.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/flows/store.ts src/lib/flows/store.test.ts
git commit -m "feat(flows): 프로필과 명리 연도로 흐름 행을 찾고 만든다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: 이용권 · 한도 · 접근 판정

**Files:**
- Modify: `src/lib/tickets/features.ts`
- Create: `src/lib/flows/tickets.ts`
- Create: `src/lib/flows/rate-limit.ts`
- Create: `src/lib/flows/access.ts`
- Create: `src/lib/flows/access.test.ts`

**Interfaces:**
- Consumes: `getBalance` (`@/lib/tickets/wallet`), `FEATURE_COST` (`@/lib/tickets/features`)
- Produces:
  - `FEATURE_IDS` 에 `"current_flow"` 추가, `FEATURE_COST.current_flow = 1`
  - `class FlowTicketsError extends Error`
  - `class FlowRateLimitError extends Error`
  - `checkFlowLimit(userId: string): Promise<boolean>` (세면서 확인)
  - `peekFlowLimit(userId: string): Promise<boolean>` (세지 않고 확인)
  - `type FlowAccess = { ok: true } | { ok: false; reason: "unauthenticated" | "rate_limited" | "insufficient_tickets" }`
  - `canCreateFlow(userId: string | null, deps?: FlowAccessDeps): Promise<FlowAccess>`
  - `interface FlowAccessDeps { peekLimit(userId: string): Promise<boolean>; getBalance(userId: string): Promise<number> }`

**배경 (읽고 시작할 것):**
- `src/lib/tickets/features.ts` — 새 서비스는 두 줄이다. `Feature` 를 배열에서 파생시키는 것이 요점 — 문자열을 그대로 받으면 오타가 조용한 무료 열람이 된다
- `src/lib/matches/access.ts:1-40` — `canCreateMatch`. **여기서는 세지도 깎지도 않고 읽기만 한다.** 차감은 생성기 자리에서
- `src/lib/matches/rate-limit.ts` — `checkMatchLimit` / `peekMatchLimit` 의 짝. 그대로 베낀다

- [ ] **Step 1: 이용권 서비스를 등록한다**

`src/lib/tickets/features.ts` 두 줄을 고친다:

```ts
export const FEATURE_IDS = [
  "full_report",
  "compatibility",
  "consultation",
  "current_flow",
] as const;

export const FEATURE_COST: Record<Feature, number> = {
  full_report: 1,
  compatibility: 1,
  consultation: 1,
  current_flow: 1,
};
```

Run: `npm run typecheck`
Expected: PASS. `FEATURE_COST` 가 `Record<Feature, number>` 라 단가를 빠뜨렸으면 여기서 깨진다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/lib/flows/access.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canCreateFlow } from "./access";

const allow = {
  peekLimit: async () => true,
  getBalance: async () => 5,
};

describe("canCreateFlow", () => {
  it("비로그인은 막는다", async () => {
    expect(await canCreateFlow(null, allow)).toEqual({
      ok: false,
      reason: "unauthenticated",
    });
  });

  it("한도에 걸리면 막는다", async () => {
    expect(await canCreateFlow("3", { ...allow, peekLimit: async () => false })).toEqual({
      ok: false,
      reason: "rate_limited",
    });
  });

  it("잔액이 모자라면 막는다 — 기다려도 안 풀리므로 한도와 다른 이유다", async () => {
    expect(await canCreateFlow("3", { ...allow, getBalance: async () => 0 })).toEqual({
      ok: false,
      reason: "insufficient_tickets",
    });
  });

  it("둘 다 통과하면 연다", async () => {
    expect(await canCreateFlow("3", allow)).toEqual({ ok: true });
  });

  it("여기서는 세지도 깎지도 않는다 — 읽기만 한다", async () => {
    let counted = false;
    await canCreateFlow("3", {
      peekLimit: async () => {
        counted = true; // peek 은 세지 않는 쪽이다. 이름이 곧 계약이다
        return true;
      },
      getBalance: async () => 5,
    });
    expect(counted).toBe(true);
  });
});
```

- [ ] **Step 3: 최소 구현을 쓴다**

`src/lib/flows/tickets.ts`:

```ts
/**
 * 흐름을 볼 이용권이 없다.
 *
 * FlowRateLimitError 와 나란한 타입이다. 둘을 가르는 이유는 사용자에게 할 말이
 * 다르기 때문이다 — 한도는 기다리면 풀리지만 잔액 부족은 충전해야 한다.
 *
 * matches 의 MatchTicketsError 와 합치지 않는다. 합치면 flows 가 matches 를
 * import 하게 되는데 둘은 서로 모르는 기능이고, 각자의 화면이 각자의 에러를 다룬다.
 */
export class FlowTicketsError extends Error {
  constructor() {
    super("지금의 흐름을 볼 이용권이 부족합니다");
    this.name = "FlowTicketsError";
  }
}
```

`src/lib/flows/rate-limit.ts` 는 `src/lib/matches/rate-limit.ts` 를 그대로 옮기되 이름과 키만 바꾼다 — 그 파일을 열어 다음 세 가지를 `flow` 로 치환한다: 클래스 이름(`MatchRateLimitError` → `FlowRateLimitError`), 함수 이름(`checkMatchLimit`/`peekMatchLimit` → `checkFlowLimit`/`peekFlowLimit`), Redis 키 접두사(`match:` → `flow:`). **키 접두사를 바꾸지 않으면 궁합과 흐름이 같은 한도를 나눠 쓴다.**

`src/lib/flows/access.ts`:

```ts
import { getBalance } from "@/lib/tickets/wallet";
import { FEATURE_COST } from "@/lib/tickets/features";
import { peekFlowLimit } from "./rate-limit";

/**
 * 흐름을 만들 수 있는가.
 *
 * **여기서는 세지도, 깎지도 않는다(읽기만 한다).** 실제로 LLM 을 부르는 자리는
 * /flow/[id] 의 생성이고, 한도 카운터와 이용권 차감 모두 거기서 이뤄진다
 * (app/api/flows/_lib/gated-generator.ts).
 *
 * 만들기에서 같이 차감하면 같은 프로필·같은 해를 다시 제출해 flows_unique 로 기존
 * 행에 수렴하는 요청 — LLM 을 한 번도 부르지 않는 요청 — 이 한도와 이용권을 함께
 * 먹는다. (궁합의 access.ts 와 같은 판단)
 */
export type FlowAccess =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "rate_limited" | "insufficient_tickets" };

export interface FlowAccessDeps {
  /** 세지 않고 보는 쪽만 주입한다 — 이름이 곧 계약이다 */
  peekLimit(userId: string): Promise<boolean>;
  /** 잔액도 읽기만 한다. 차감은 생성기 자리에서 한다 */
  getBalance(userId: string): Promise<number>;
}

const defaultDeps: FlowAccessDeps = {
  peekLimit: (id) => peekFlowLimit(id),
  getBalance: (id) => getBalance(id),
};

export async function canCreateFlow(
  userId: string | null,
  deps: FlowAccessDeps = defaultDeps,
): Promise<FlowAccess> {
  if (!userId) return { ok: false, reason: "unauthenticated" };
  if (!(await deps.peekLimit(userId))) return { ok: false, reason: "rate_limited" };
  if ((await deps.getBalance(userId)) < FEATURE_COST.current_flow) {
    return { ok: false, reason: "insufficient_tickets" };
  }
  return { ok: true };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/flows/access.test.ts && npm run typecheck`
Expected: 테스트 5개 PASS, 타입 검사 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/tickets/features.ts src/lib/flows/tickets.ts src/lib/flows/rate-limit.ts src/lib/flows/access.ts src/lib/flows/access.test.ts
git commit -m "feat(flows): 흐름을 이용권 서비스로 등록하고 접근을 판정한다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase D · 생성

### Task 11: `sections/` — 레지스트리와 파생

리포트·궁합 레지스트리와 갈라지는 유일한 지점: **`schema` 가 상수가 아니라 `(n) => ZodType` 팩토리다.** 구간 수가 프로필마다 다르기 때문이다.

리포트는 `llmInputSchemaWithRows` 로 이걸 우회했는데(`saju/_lib/sections/derive.ts:54`), 그쪽은 **LLM 요청에만 개수를 걸고 검증에는 안 건다**("저장·조회 검증에는 쓰지 않는다"). 흐름은 검증에서도 `n` 이 맞아야 `segmentId` enum 이 의미를 가지므로 팩토리로 간다.

**Files:**
- Create: `src/app/api/flows/_lib/sections/registry.ts`
- Create: `src/app/api/flows/_lib/sections/derive.ts`
- Create: `src/app/api/flows/_lib/sections/index.ts`
- Create: `src/app/api/flows/_lib/sections/registry.test.ts`
- Create: `src/app/api/flows/_lib/sections/derive.test.ts`

**Interfaces:**
- Consumes: `zod` v4, `SEGMENT_IDS` / `type SegmentId` (Task 7)
- Produces:
  - `interface FlowSegmentBody { segmentId: SegmentId; title: string; body: string }`
  - `interface SegmentedContent { common: string; segments: FlowSegmentBody[] }`
  - `interface TimelineContent { segments: FlowSegmentBody[] }`
  - `interface FlowSectionSpec { version: number; schema: (n: number) => z.ZodType; prompt: string; example: string }`
  - `FLOW_SECTIONS` — 8개 키: `now`·`rising`·`straining`·`work`·`relating`·`money`·`ahead`·`remember`
  - `type FlowSectionKey`, `FLOW_SECTION_KEYS`, `type FlowInterpretation`
  - `isFlowSectionKey(v: unknown): v is FlowSectionKey`
  - `flowSectionVersion(key: FlowSectionKey): number`
  - `flowLlmInputSchema(key: FlowSectionKey, n: number): Record<string, unknown>`
  - `parseFlowSectionContent<K extends FlowSectionKey>(key: K, raw: unknown, n: number): FlowInterpretation[K] | null`
  - `assignFlow<T, K extends keyof T>(target: Partial<T>, key: K, value: T[K]): void`

**배경 (읽고 시작할 것):**
- `src/app/api/matches/_lib/sections/registry.ts:1-45` — `MatchSectionSpec` 의 `version` 주석. **재생성이 곧 이용권 원가**라는 경고를 그대로 옮긴다
- `src/app/api/matches/_lib/sections/derive.ts` — 이 파일의 구조를 따른다. 특히 `assignMatch` 의 주석(microsoft/TypeScript#30581) — 단순 대입으로 바꾸지 말 것
- `src/app/api/saju/_lib/sections/derive.ts:38` — `llmInputSchema` 가 `{ content: ... }` 로 한 겹 감싸는 이유(최상위가 객체여야 하는데 배열인 섹션이 있다). 같은 계약을 따른다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/sections/derive.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FLOW_SECTION_KEYS, flowLlmInputSchema, parseFlowSectionContent } from "./derive";

const seg = (id: string, i: number) => ({
  segmentId: id,
  title: `제목${i}`,
  body: `본문${i}`,
});

describe("parseFlowSectionContent", () => {
  it("구간 수가 맞으면 통과한다", () => {
    const out = parseFlowSectionContent(
      "now",
      { common: "배경", segments: [seg("segment_1", 1), seg("segment_2", 2)] },
      2,
    );
    expect(out?.segments).toHaveLength(2);
  });

  it("구간 수가 모자라면 null — 조용히 어긋나게 두지 않는다", () => {
    expect(
      parseFlowSectionContent("now", { common: "배경", segments: [seg("segment_1", 1)] }, 2),
    ).toBeNull();
  });

  it("계산된 구간 수 밖의 id 는 enum 이 막는다", () => {
    expect(
      parseFlowSectionContent(
        "now",
        { common: "배경", segments: [seg("segment_1", 1), seg("segment_3", 3)] },
        2,
      ),
    ).toBeNull();
  });

  it("id 가 중복되면 null — 개수만 맞고 한 칸이 비는 응답을 막는다", () => {
    expect(
      parseFlowSectionContent(
        "now",
        { common: "배경", segments: [seg("segment_1", 1), seg("segment_1", 1)] },
        2,
      ),
    ).toBeNull();
  });

  it("07(ahead)에는 common 이 없다 — 타임라인 그 자체다", () => {
    const out = parseFlowSectionContent("ahead", { segments: [seg("segment_1", 1)] }, 1);
    expect(out).not.toBeNull();
    expect(out as object).not.toHaveProperty("common");
  });

  it("01~06·08 에 common 이 없으면 null", () => {
    expect(parseFlowSectionContent("now", { segments: [seg("segment_1", 1)] }, 1)).toBeNull();
  });

  it("빈 문자열은 통과하지 못한다", () => {
    expect(
      parseFlowSectionContent("now", { common: "", segments: [seg("segment_1", 1)] }, 1),
    ).toBeNull();
  });

  it("모르는 키는 좁혀지지 않는다", () => {
    expect(FLOW_SECTION_KEYS).toHaveLength(8);
  });
});

describe("flowLlmInputSchema", () => {
  it("최상위를 content 로 한 겹 감싼다 — 리포트·궁합과 같은 계약", () => {
    const schema = flowLlmInputSchema("now", 2);
    expect(schema.type).toBe("object");
    expect(schema.properties).toHaveProperty("content");
  });

  it("구간 수가 스키마에 박힌다 — LLM 이 개수를 못 바꾼다", () => {
    const two = JSON.stringify(flowLlmInputSchema("now", 2));
    const three = JSON.stringify(flowLlmInputSchema("now", 3));
    expect(two).not.toBe(three);
    expect(two).toContain("segment_2");
    expect(two).not.toContain("segment_3");
  });
});
```

`src/app/api/flows/_lib/sections/registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FLOW_SECTIONS } from "./registry";

describe("FLOW_SECTIONS", () => {
  it("기획서의 8개 섹션이 다 있다", () => {
    expect(Object.keys(FLOW_SECTIONS)).toEqual([
      "now", "rising", "straining", "work", "relating", "money", "ahead", "remember",
    ]);
  });

  it("모든 섹션에 지시문과 예시가 있다", () => {
    for (const spec of Object.values(FLOW_SECTIONS)) {
      expect(spec.prompt.length).toBeGreaterThan(0);
      expect(spec.example.length).toBeGreaterThan(0);
      expect(spec.version).toBeGreaterThanOrEqual(1);
    }
  });

  it("예시는 스키마를 통과한다 — 통과 못 하는 예시는 LLM 을 잘못 이끈다", () => {
    for (const [key, spec] of Object.entries(FLOW_SECTIONS)) {
      // 예시마다 구간 수가 다르므로(07 은 앞뒤 대비를 보이려고 2개다)
      // 예시 자신의 개수로 스키마를 만들어 검증한다.
      const example = JSON.parse(spec.example) as { segments: unknown[] };
      const parsed = spec.schema(example.segments.length).safeParse(example);
      expect(parsed.success, `${key} 의 example 이 스키마를 통과하지 못한다`).toBe(true);
    }
  });

  it("예시에 연도·월·날짜가 없다 — 예시가 규칙을 이긴다", () => {
    for (const [key, spec] of Object.entries(FLOW_SECTIONS)) {
      expect(spec.example, `${key}`).not.toMatch(/\d{4}년|\d{1,2}월|\d{1,2}일/);
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/sections/`
Expected: FAIL — Cannot find module './registry'

- [ ] **Step 3: 레지스트리를 쓴다**

`src/app/api/flows/_lib/sections/registry.ts`:

```ts
import { z } from "zod";
import { SEGMENT_IDS, type SegmentId } from "../segments";

export interface FlowSegmentBody {
  segmentId: SegmentId;
  title: string;
  body: string;
}

/** 01~06·08 — 연간 배경 + 구간별 서술 */
export interface SegmentedContent {
  /** 그해 전체의 배경. 구간이 하나여도 segments 와 역할이 달라 중복이 아니다 */
  common: string;
  segments: FlowSegmentBody[];
}

/** 07 — 타임라인 그 자체. 배경 문단이 따로 없다 */
export interface TimelineContent {
  segments: FlowSegmentBody[];
}

export interface FlowSectionSpec {
  /**
   * 이 섹션 스키마의 버전. flow_sections.schema_version 에 기록된다.
   * shape 을 바꿀 때만이 아니라 프롬프트 의미가 바뀌었을 때도 올린다.
   *
   * ⚠️ 리포트와 달리 재생성이 곧 이용권 원가다. 버전을 올리면 이미 판 흐름 전부가
   * 다음 열람에서 다시 생성된다. 올리기 전에 비용을 계산할 것.
   */
  version: number;
  /**
   * content 의 유일한 shape 정의.
   *
   * 리포트·궁합과 달리 **상수가 아니라 팩토리**다 — 구간 수 n 이 프로필마다 다르고,
   * 그 n 이 검증에도 걸려야 segmentId enum 이 의미를 갖기 때문이다.
   */
  schema: (n: number) => z.ZodType;
  /** 이 섹션만 재생성할 때 LLM 에 줄 지시문 */
  prompt: string;
  /**
   * 문체를 잡아주는 짧은 예시.
   * ⚠️ 예시도 FLOW_SYSTEM_PROMPT 규칙을 지켜야 한다 — 연도·월·날짜를 쓰면
   * "쓰지 말라" 는 규칙보다 예시가 이긴다.
   */
  example: string;
}

/**
 * 구간 하나. segmentId 를 z.enum 으로 좁히는 것이 요점이다 —
 * 자유 문자열로 받으면 LLM 이 쓴 id 는 LLM 이 쓴 순서보다 더 믿을 만하지 않아서
 * 검증할 수 없는 값이 하나 늘 뿐이다.
 */
const segmentBody = (n: number) =>
  z
    .object({
      segmentId: z.enum(SEGMENT_IDS.slice(0, n) as [SegmentId, ...SegmentId[]]),
      title: z.string().min(1),
      body: z.string().min(1),
    })
    .strict();

/**
 * 개수 n + id 가 그 n개 중 하나 + id 중복 없음 → **집합이 정확히 일치한다**.
 * 셋 중 하나만 빠져도 "개수는 맞는데 한 칸이 비고 다른 칸이 두 번" 이 통과한다.
 */
const segmentList = (n: number) =>
  z
    .array(segmentBody(n))
    .length(n)
    .superRefine((arr, ctx) => {
      if (new Set(arr.map((s) => s.segmentId)).size !== arr.length) {
        ctx.addIssue({ code: "custom", message: "segmentId 가 중복되었습니다" });
      }
    });

const segmented = (n: number) =>
  z.object({ common: z.string().min(1), segments: segmentList(n) }).strict();

const timeline = (n: number) => z.object({ segments: segmentList(n) }).strict();

const SEGMENT_RULE =
  "구간마다 하나씩, 계산된 구간 수와 같은 개수로 써라. segmentId 는 주어진 값만 쓴다. " +
  "각 구간에 '원래는 …지만 지금은 …' 같은 대비를 최소 한 번 넣어라. " +
  "연도·월·날짜·기간을 지어내지 마라 — 시간 표시는 계산된 값이 화면에서 붙는다.";

/**
 * 흐름 서술 섹션. section_key = 이 객체의 키.
 *
 * 리포트의 SECTIONS 와 나란한 구조지만 tier·storage 가 없다 — 무료/유료로 갈리지
 * 않고 저장소가 하나다. (궁합의 MATCH_SECTIONS 와 같다)
 */
export const FLOW_SECTIONS = {
  now: {
    version: 1,
    schema: segmented,
    prompt: [
      "01 지금의 흐름. common 에는 올해 전체의 성격을 3~4문장으로 쓴다.",
      "각 구간의 title 은 '지금 어떤 시기를 지나고 있는가' 를 한 줄로 압축한 대표 문장이다.",
      "body 는 지금 들어와 있는 흐름이 타고난 성향과 만나 무엇이 평소와 달라지는지 3~4문장.",
      "좋은 시기 / 나쁜 시기로 평가하지 마라 — 같은 흐름에 기회와 부담이 함께 있다.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"common":"올해는 안으로 쌓아온 것을 밖으로 꺼내는 힘이 커지는 흐름이에요.","segments":[{"segmentId":"segment_1","title":"오래 눌러두었던 것을 조금씩 밖으로 꺼내기 시작하는 때","body":"원래는 충분히 살핀 뒤 움직이는 편인데, 요즘은 생각이 끝나기 전에 먼저 해보고 싶은 마음이 평소보다 강해지기 쉬워요. 답답했던 일을 움직이기에는 힘이 생기지만, 동시에 너무 많은 일을 한꺼번에 벌이고 싶어질 수도 있어요."}]}',
  },

  rising: {
    version: 1,
    schema: segmented,
    prompt: [
      "02 지금 살아나는 것. 평소보다 자연스럽게 강해지거나 쓰기 쉬워지는 힘을 다룬다.",
      "타고난 강점을 다시 설명하지 마라 — '원래 잘하는 것' 이 아니라 '지금 평소보다 힘이 실리는 것' 이다.",
      "각 구간의 body 에 그런 힘을 2~3개 담되 목록이 아니라 이어지는 문장으로 쓴다.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"common":"올해는 결정을 미루지 않는 힘과 밖으로 꺼내는 힘이 함께 올라와요.","segments":[{"segmentId":"segment_1","title":"결정을 미루지 않는 힘","body":"평소에는 여러 가능성을 오래 살피는 편이지만, 지금은 어느 정도 판단이 서면 직접 움직여보려는 힘이 강해져요. 생각만 하던 것을 말이나 결과물로 보여주는 일도 조금 더 자연스러워지는 때예요."}]}',
  },

  straining: {
    version: 1,
    schema: segmented,
    prompt: [
      "03 지금 부담되는 것. 흐름과 타고난 성향이 만나 에너지가 쉽게 소진되는 지점을 다룬다.",
      "'조심하세요' 같은 경고가 아니다. 사용자가 '그래서 요즘 이게 유독 힘들었구나' 라고 이해하게 만드는 것이 목적이다.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"common":"밖에서 들어오는 요구가 늘면서 무엇을 내려놓을지가 중요해지는 흐름이에요.","segments":[{"segmentId":"segment_1","title":"해야 할 일이 자꾸 늘어날 때","body":"평소에도 부탁을 잘 못 넘기는 편인데, 요즘은 밖에서 들어오는 역할이 많아져 하나를 끝내기도 전에 다음 일을 붙잡게 될 수 있어요. 지금은 더 많이 잡는 것보다 무엇을 내려놓을지가 중요해져요."}]}',
  },

  work: {
    version: 1,
    schema: segmented,
    prompt: [
      "04 일과 선택. 일·공부·진로·개인 목표 등 무언가를 해내고 고르는 과정을 다룬다.",
      "특정 직업을 전제하지 마라. 퇴사·창업·이직을 권하거나 결과를 예언하지 마라.",
      "선택의 결과가 아니라 **판단의 기준**을 준다.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"common":"벌이기보다 고르는 일이 중요해지는 흐름이에요.","segments":[{"segmentId":"segment_1","title":"새로운 선택지가 눈에 들어올 때","body":"평소에는 하던 것을 다듬는 쪽이 편한데, 지금은 다른 길을 검토하려는 마음이 강해지기 쉬워요. 다만 지금의 답답함에서 벗어나고 싶은 것인지, 실제로 더 원하는 방향이 생긴 것인지는 구분해서 보는 게 좋아요."}]}',
  },

  relating: {
    version: 1,
    schema: segmented,
    prompt: [
      "05 관계. 연애만이 아니라 인간관계 전반을 다룬다.",
      "특정 인물이 나타난다고 예측하지 마라. 관계의 지속·이별·결혼을 예언하지 마라.",
      "'원래 사람을 어떻게 대하는가' 가 아니라 '요즘 무엇이 평소와 달라지는가' 를 쓴다.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"common":"사람에게 쓰는 에너지가 늘어나는 흐름이에요.","segments":[{"segmentId":"segment_1","title":"먼저 살피는 성향이 더 세게 작동할 때","body":"평소에도 상대를 먼저 살피는 편인데, 요즘은 바깥에서 들어오는 부탁과 역할이 많아지면서 그 성향이 평소보다 더 강하게 작동하기 쉬워요. 혼자 감당하기보다 이미 가진 관계에 기대는 쪽이 지금 흐름과 잘 맞아요."}]}',
  },

  money: {
    version: 1,
    schema: segmented,
    prompt: [
      "06 돈과 현실. 돈이 들어올지 나갈지를 예측하지 말고, 돈·소비·성과를 대하는 **태도**가 어떻게 달라지기 쉬운지 쓴다.",
      "금지: 투자 종목 추천, 투자 시점 예측, 수익 보장, 부동산 매수/매도 지시, 큰돈이 들어온다는 단정, 복권·도박.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"common":"크게 벌이는 것보다 이미 가진 것을 효율적으로 쓰는 것이 중요한 흐름이에요.","segments":[{"segmentId":"segment_1","title":"사람 때문에 나가는 돈이 늘 때","body":"평소에는 계획한 만큼 쓰는 편인데, 요즘은 사람과 자리에 얽힌 지출이 늘기 쉬워요. 불안해서 서둘러 결정하는 소비가 있는지 한 번 살펴볼 만한 때예요."}]}',
  },

  ahead: {
    version: 1,
    schema: timeline,
    prompt: [
      "07 앞으로의 변화. 각 구간이 어떤 흐름인지를 title 과 body 로 쓴다.",
      "common 은 없다 — 이 섹션이 구간 타임라인 그 자체다.",
      "**앞 구간과 무엇이 달라지는가** 를 반드시 쓴다. 각 구간을 독립적으로 소개하지 마라.",
      "구간이 하나뿐이면 올해는 흐름이 크게 갈리지 않는다는 것을 그대로 쓴다 — 없는 변화를 만들지 마라.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"segments":[{"segmentId":"segment_1","title":"밖으로 움직이는 흐름","body":"사람이나 일이 늘어나면서 가만히 있기보다 움직이고 시도하는 힘이 강해지는 구간이에요."},{"segmentId":"segment_2","title":"벌인 것을 정리하는 흐름","body":"앞에서 시작한 것을 다듬고 무엇을 남길지 고르는 일이 중요해져요. 앞 구간이 넓히는 때였다면 여기서는 좁히는 쪽으로 무게가 옮겨가요."}]}',
  },

  remember: {
    version: 1,
    schema: segmented,
    prompt: [
      "08 지금 기억할 것. 앞의 내용을 요약하지 말고, 이 흐름에서 가져갈 태도와 행동을 준다.",
      "각 구간의 body 에 실제로 해볼 수 있는 것 하나를 포함한다.",
      SEGMENT_RULE,
    ].join("\n"),
    example:
      '{"common":"이 시기를 지나는 동안 무엇을 하지 않을지 정하는 것이 중요해요.","segments":[{"segmentId":"segment_1","title":"모든 기회를 잡으려고 하지 않기","body":"평소에는 기회를 놓치는 것이 더 아깝게 느껴졌겠지만, 지금은 바깥에서 들어오는 일이 많아질수록 무엇을 하지 않을지 정하는 것이 더 중요해요. 이번 주에 들어온 요청 하나를 골라 정중히 미뤄보세요."}]}',
  },
} as const satisfies Record<string, FlowSectionSpec>;
```

- [ ] **Step 4: 파생을 쓴다**

`src/app/api/flows/_lib/sections/derive.ts`:

```ts
import { z } from "zod";
import {
  FLOW_SECTIONS,
  type FlowSectionSpec,
  type SegmentedContent,
  type TimelineContent,
} from "./registry";

export type FlowSectionKey = keyof typeof FLOW_SECTIONS;

/**
 * 섹션별 content 타입.
 *
 * schema 가 팩토리라 z.infer 로 뽑으면 n 에 따라 타입이 흔들린다. 모양은 두 가지뿐이라
 * (07만 common 이 없다) 여기서 명시적으로 짝지어 준다 — 읽는 쪽이 훨씬 분명하다.
 */
export type FlowInterpretation = {
  now: SegmentedContent;
  rising: SegmentedContent;
  straining: SegmentedContent;
  work: SegmentedContent;
  relating: SegmentedContent;
  money: SegmentedContent;
  ahead: TimelineContent;
  remember: SegmentedContent;
};

export const FLOW_SECTION_KEYS = Object.keys(FLOW_SECTIONS) as FlowSectionKey[];

const spec = (key: FlowSectionKey): FlowSectionSpec => FLOW_SECTIONS[key] as FlowSectionSpec;

/** DB 에서 읽은 section_key 를 좁힌다 (모르는 키 = 지워진 섹션). */
export function isFlowSectionKey(v: unknown): v is FlowSectionKey {
  return typeof v === "string" && Object.hasOwn(FLOW_SECTIONS, v);
}

export function flowSectionVersion(key: FlowSectionKey): number {
  return spec(key).version;
}

/**
 * LLM tool 의 input_schema. 최상위가 객체여야 하는데 배열인 섹션이 있을 수 있어
 * 전부 { content: ... } 한 겹으로 감싼다 — 리포트·궁합과 같은 계약이다.
 *
 * n 을 받는 것이 리포트·궁합과 다른 점이다. 구간 수가 스키마 안에 박히므로
 * LLM 이 개수를 바꿀 수 없다.
 */
export function flowLlmInputSchema(key: FlowSectionKey, n: number): Record<string, unknown> {
  const content = z.toJSONSchema(spec(key).schema(n)) as Record<string, unknown>;
  delete content.$schema;
  return {
    type: "object",
    properties: { content },
    required: ["content"],
    additionalProperties: false,
  };
}

/** 검증 통과하면 content, 아니면 null. 호출자는 null 을 "없는 섹션" 으로 다룬다. */
export function parseFlowSectionContent<K extends FlowSectionKey>(
  key: K,
  raw: unknown,
  n: number,
): FlowInterpretation[K] | null {
  const result = spec(key).schema(n).safeParse(raw);
  return result.success ? (result.data as FlowInterpretation[K]) : null;
}

/**
 * `target[key] = value` 를 대신한다. 이유는 saju sections/derive.ts 의 assign 과 같다
 * (microsoft/TypeScript#30581). 단순 대입으로 바꾸지 말 것.
 */
export function assignFlow<T, K extends keyof T>(
  target: Partial<T>,
  key: K,
  value: T[K],
): void {
  target[key] = value;
}
```

`src/app/api/flows/_lib/sections/index.ts`:

```ts
export * from "./registry";
export * from "./derive";
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/sections/ && npm run typecheck`
Expected: 테스트 12개 PASS, 타입 검사 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/flows/_lib/sections/
git commit -m "feat(flows): 구간 수를 스키마에 박는 섹션 레지스트리를 세운다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: `_lib/store.ts` — `flow_sections` 읽고 쓰기

궁합의 `store.ts` 와 같되 **`n`(구간 수)을 받는다** — 검증에 구간 수가 걸리기 때문이다.

**Files:**
- Create: `src/app/api/flows/_lib/store.ts`
- Create: `src/app/api/flows/_lib/store.test.ts`

**Interfaces:**
- Consumes: `sql`, `type SqlClient` (`@/lib/db`), `assignFlow` / `isFlowSectionKey` / `flowSectionVersion` / `parseFlowSectionContent` / `type FlowInterpretation` / `type FlowSectionKey` (Task 11)
- Produces:
  - `interface StoredFlowSections { have: Partial<FlowInterpretation>; missing: FlowSectionKey[] }`
  - `interface FlowSectionWrite { sectionKey: FlowSectionKey; content: unknown }`
  - `decodeFlowSections(rows: Record<string, unknown>[], keys: FlowSectionKey[], n: number): StoredFlowSections`
  - `getFlowSections(flowId: string, keys: FlowSectionKey[], n: number, client?): Promise<StoredFlowSections>`
  - `putFlowSections(flowId: string, interpretation: Partial<FlowInterpretation>, model: string, client?): Promise<void>`

**배경 (읽고 시작할 것):**
- `src/app/api/matches/_lib/store.ts:22-41` — `decodeMatchSections`. 버리는 두 경우(버전 불일치 · 파싱 실패)를 그대로 따른다
- `src/app/api/saju/_lib/store-luck.ts:29-51` — `putLuckSections` 의 `UNNEST` + `ON CONFLICT DO UPDATE`. 같은 수법을 쓴다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/store.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SqlClient } from "@/lib/db";
import { FLOW_SECTIONS } from "./sections";
import { decodeFlowSections, getFlowSections } from "./store";

const now = {
  common: "배경",
  segments: [
    { segmentId: "segment_1", title: "가", body: "나" },
    { segmentId: "segment_2", title: "다", body: "라" },
  ],
};

describe("decodeFlowSections", () => {
  it("멀쩡한 행은 담는다", () => {
    const out = decodeFlowSections(
      [{ section_key: "now", content: now, schema_version: FLOW_SECTIONS.now.version }],
      ["now"],
      2,
    );
    expect(out.have.now).toEqual(now);
    expect(out.missing).toEqual([]);
  });

  it("버전이 다른 행은 버린다 — 옛 스키마의 서술을 그대로 쓰면 안 된다", () => {
    const out = decodeFlowSections(
      [{ section_key: "now", content: now, schema_version: 0 }],
      ["now"],
      2,
    );
    expect(out.missing).toEqual(["now"]);
  });

  it("구간 수가 다르면 버린다 — 저장된 서술이 지금 구간과 어긋난다", () => {
    const out = decodeFlowSections(
      [{ section_key: "now", content: now, schema_version: FLOW_SECTIONS.now.version }],
      ["now"],
      3,
    );
    expect(out.missing).toEqual(["now"]);
  });

  it("모르는 키는 무시한다 — 지워진 섹션이다", () => {
    const out = decodeFlowSections(
      [{ section_key: "사라진섹션", content: {}, schema_version: 1 }],
      ["now"],
      2,
    );
    expect(out.have).toEqual({});
  });
});

describe("getFlowSections", () => {
  it("빈 키 목록이면 DB 를 부르지 않는다", async () => {
    let called = false;
    const client = (() => {
      called = true;
      return Promise.resolve([]);
    }) as unknown as SqlClient;

    expect(await getFlowSections("7", [], 2, client)).toEqual({ have: {}, missing: [] });
    expect(called).toBe(false);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/store.test.ts`
Expected: FAIL — Cannot find module './store'

- [ ] **Step 3: 최소 구현을 쓴다**

`src/app/api/flows/_lib/store.ts`:

```ts
import { sql as neonSql, type SqlClient } from "@/lib/db";
import {
  assignFlow,
  flowSectionVersion,
  isFlowSectionKey,
  parseFlowSectionContent,
  type FlowInterpretation,
  type FlowSectionKey,
} from "./sections";

export type { SqlClient };

const sql = neonSql as unknown as SqlClient;

export interface StoredFlowSections {
  have: Partial<FlowInterpretation>;
  missing: FlowSectionKey[];
}

/**
 * 행 배열을 have/missing 으로 가른다.
 *
 * 버리는 경우가 궁합보다 하나 많다 — **구간 수 불일치**. flows.segments 는 박제라
 * 정상적으로는 바뀌지 않지만, 만에 하나 어긋나면 11월 서술이 2월 칸에 붙으므로
 * 조용히 통과시키지 않고 "없는 섹션" 으로 만들어 다시 생성하게 한다.
 */
export function decodeFlowSections(
  rows: Record<string, unknown>[],
  keys: FlowSectionKey[],
  n: number,
): StoredFlowSections {
  const wanted = new Set<string>(keys);
  const have: Partial<FlowInterpretation> = {};

  for (const row of rows) {
    const key = row.section_key;
    if (!isFlowSectionKey(key) || !wanted.has(key)) continue;
    if (row.schema_version !== flowSectionVersion(key)) continue;
    const content = parseFlowSectionContent(key, row.content, n);
    if (content === null) continue;
    assignFlow(have, key, content);
  }

  return { have, missing: keys.filter((k) => !(k in have)) };
}

export async function getFlowSections(
  flowId: string,
  keys: FlowSectionKey[],
  n: number,
  client: SqlClient = sql,
): Promise<StoredFlowSections> {
  if (keys.length === 0) return { have: {}, missing: [] };
  const rows = await client`
    SELECT section_key, content, schema_version
      FROM flow_sections
     WHERE flow_id = ${flowId}::bigint AND section_key = ANY(${keys}::text[])
  `;
  return decodeFlowSections(rows, keys, n);
}

export async function putFlowSections(
  flowId: string,
  interpretation: Partial<FlowInterpretation>,
  model: string,
  client: SqlClient = sql,
): Promise<void> {
  const entries = Object.entries(interpretation).filter(([k]) => isFlowSectionKey(k));
  if (entries.length === 0) return;

  const keys = entries.map(([k]) => k);
  const contents = entries.map(([, v]) => JSON.stringify(v));
  const versions = entries.map(([k]) => flowSectionVersion(k as FlowSectionKey));

  await client`
    INSERT INTO flow_sections (flow_id, section_key, content, model, schema_version)
    SELECT ${flowId}::bigint, t.k, t.c::jsonb, ${model}, t.v
      FROM UNNEST(${keys}::text[], ${contents}::text[], ${versions}::int[]) AS t(k, c, v)
    ON CONFLICT (flow_id, section_key) DO UPDATE
       SET content = EXCLUDED.content,
           model = EXCLUDED.model,
           schema_version = EXCLUDED.schema_version,
           updated_at = now()
  `;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/store.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/flows/_lib/store.ts src/app/api/flows/_lib/store.test.ts
git commit -m "feat(flows): 흐름 서술을 구간 수까지 검증해 읽고 쓴다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: `prompt/` — 시스템 프롬프트와 사실 블록

**숫자를 넘기지 않는 것이 이 태스크의 핵심이다.** `support`/`friction` 은 범주 라벨로, 십성은 그룹 이름으로, 구간은 서수로 넘긴다. 날짜는 아예 넘기지 않는다.

**Files:**
- Create: `src/app/api/flows/_lib/prompt/system.ts`
- Create: `src/app/api/flows/_lib/prompt/facts.ts`
- Create: `src/app/api/flows/_lib/prompt/index.ts`
- Create: `src/app/api/flows/_lib/prompt/facts.test.ts`

**Interfaces:**
- Consumes: `SYSTEM_PROMPT` / `SECTION_TOOL_NAME` (`@/app/api/saju/_lib/prompt/system`), `chartFacts` (`@/app/api/saju/_lib/prompt/facts`), `elementControls` / `elementGenerates` / `generatedBy` / `STEMS` / `branchElementOf` / `type Element` / `type TenGodGroup` / `type SajuAnalysis` (`@/lib/saju-core`), `parsePillar2` (Task 6), `type FlowSegment` / `type SegmentId` (Task 7), `FLOW_SECTIONS` / `flowLlmInputSchema` / `type FlowSectionKey` (Task 11)
- Produces:
  - `FLOW_SYSTEM_PROMPT: string`
  - `interface FlowSegmentFacts { id: SegmentId; ordinal: string; support: string; friction: string; tenGods: TenGodGroup[]; vsPrev: string | null }`
  - `interface FlowContext { analysis: SajuAnalysis; flowYear: number; sewunKorean: string; daeunKorean: string; segments: FlowSegmentFacts[] }`
  - `buildFlowContext(analysis: SajuAnalysis, flowYear: number, segments: FlowSegment[]): FlowContext`
  - `flowFacts(ctx: FlowContext): string`
  - `interface FlowSectionRequest { key: FlowSectionKey; system: string; user: string; toolName: string; inputSchema: Record<string, unknown> }`
  - `buildFlowSectionRequest(ctx: FlowContext, key: FlowSectionKey): FlowSectionRequest`

**배경 (읽고 시작할 것):**
- `src/app/api/matches/_lib/prompt/system.ts` — `SYSTEM_PROMPT` 를 상속하고 덧붙이는 방식. 문체·금지 조항을 두 벌로 두면 한쪽만 고쳐진다
- `src/app/api/matches/_lib/prompt/facts.ts:1-8` — 나이차를 숫자가 아니라 범주값으로 넘기는 이유
- `src/app/api/matches/_lib/prompt/index.ts` — `buildMatchSectionRequest` 의 구조. `[사실]` → `[요청]` → `[문체 예시]` 순서를 그대로 따른다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/prompt/facts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { flowSegments } from "../segments";
import { buildFlowContext, flowFacts } from "./facts";

const subject = analyze({
  year: 1990, month: 6, day: 15, hour: 10, minute: 30,
  gender: "male", calendar: "solar",
});
const segs = flowSegments(subject, 2026);
const ctx = buildFlowContext(subject, 2026, segs);
const text = flowFacts(ctx);

describe("flowFacts", () => {
  it("구간마다 한 블록씩 낸다", () => {
    for (let i = 1; i <= segs.length; i += 1) {
      expect(text).toContain(`[구간 ${i}/${segs.length}]`);
    }
  });

  it("날짜·연도를 넘기지 않는다 — LLM 이 지어내는 통로를 막는다", () => {
    expect(text).not.toMatch(/\d{4}/);
    expect(text).not.toMatch(/\d{1,2}월/);
  });

  it("점수를 숫자가 아니라 범주 라벨로 넘긴다", () => {
    expect(text).toMatch(/받쳐줌: (크게 받쳐줌|받쳐줌|중립|눌림|크게 눌림)/);
    expect(text).toMatch(/흔들림: (잔잔함|흔들림|크게 흔들림)/);
  });

  it("첫 구간에는 '앞 구간 대비' 가 없다", () => {
    expect(ctx.segments[0].vsPrev).toBeNull();
  });

  it("두 번째 구간부터는 앞 구간과의 차이를 말한다", () => {
    if (ctx.segments.length > 1) {
      expect(ctx.segments[1].vsPrev).toBeTruthy();
      expect(text).toContain("앞 구간 대비");
    }
  });

  it("십성을 그룹 이름으로 넘긴다", () => {
    expect(text).toMatch(/두드러지는 힘: (비겁|인성|식상|재성|관성)/);
  });

  it("원국 배경이 들어간다", () => {
    expect(text).toContain("[연간 배경]");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/prompt/facts.test.ts`
Expected: FAIL — Cannot find module './facts'

- [ ] **Step 3: 시스템 프롬프트를 쓴다**

`src/app/api/flows/_lib/prompt/system.ts`:

```ts
import { SECTION_TOOL_NAME, SYSTEM_PROMPT } from "@/app/api/saju/_lib/prompt/system";

export { SECTION_TOOL_NAME };

/**
 * 흐름용 시스템 프롬프트. 리포트의 SYSTEM_PROMPT 를 그대로 쓰고 시기 서술에만
 * 필요한 규칙을 덧붙인다 — 문체·금지 조항을 두 벌로 두면 한쪽만 고쳐진다.
 */
export const FLOW_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

## 시기 서술에 대한 규칙

- **타고난 성향 자체를 독립적으로 설명하지 마라.** 반드시 평소의 경향을 짧게 제시한 뒤, 현재 흐름으로 무엇이 강해지거나 약해지거나 다른 방식으로 나타나는지 설명하라. 각 구간·항목에 이 대비를 최소 한 번 넣는다.
- 사건을 확정적으로 예언하지 마라. "반드시 일어납니다", "이때 돈을 법니다", "연인이 생깁니다", "취업합니다" 같은 문장을 쓰지 않는다. 대신 "~하기 쉬운 시기예요", "~가 두드러질 수 있어요" 처럼 경향으로 쓴다.
- 좋은 시기 / 나쁜 시기로 평가하지 마라. 점수·별점·등급을 매기지 마라. 같은 흐름에 기회와 부담이 함께 있다.
- 신비주의 어휘를 쓰지 마라: 하늘의 기운, 우주의 흐름, 운명의 문, 대박운, 악운, 액운, 귀인이 나타난다, 횡재수.
- 명리 용어를 본문에 노출하지 마라: 세운, 대운, 월운, 원국, 간지, 십성, 오행, 비겁, 재성 등. 경험으로 풀어 쓴다.
- 돈에 대해: 투자 종목 추천, 투자 시점 예측, 수익 보장, 부동산 매수·매도 지시, 큰돈이 들어온다는 단정, 복권·도박 관련 예측을 하지 마라.
- **연도, 월, 날짜, 구간 번호와 기간을 임의로 만들지 마라.** 정확한 시간 표시는 계산된 메타데이터가 화면에서 붙인다. 본문에서는 "지금", "요즘", "이 구간", "앞으로 몇 달", "다음 흐름으로 넘어가면서" 같은 상대 표현을 쓴다. ("두 가지를 함께", "한 번에" 같은 수량 표현은 괜찮다 — 금지 대상은 지어낸 시점과 기간이다.)`;
```

- [ ] **Step 4: 사실 블록을 쓴다**

`src/app/api/flows/_lib/prompt/facts.ts`:

```ts
// 계산값 → LLM 이 읽을 [사실] 블록.
//
// ⚠️ 숫자를 넘기지 않는다. FLOW_SYSTEM_PROMPT 가 지어낸 시점·기간을 금지하는데
// 프롬프트에 숫자가 들어 있으면 예시가 규칙을 이긴다. support/friction 은 범주
// 라벨로, 십성은 그룹 이름으로, 구간은 서수("1/3")로 넘긴다.
// 궁합이 나이차를 "또래 | 터울 | 한 세대 차" 로 바꿔 넘긴 것과 같은 처리다.

import {
  STEMS,
  branchElementOf,
  elementControls,
  elementGenerates,
  generatedBy,
  sewunPillars,
  type Element,
  type SajuAnalysis,
  type TenGodGroup,
} from "@/lib/saju-core";
import { chartFacts } from "@/app/api/saju/_lib/prompt/facts";
import { frictionOf, parsePillar2, supportOf } from "../score";
import { monthScores, type FlowSegment, type SegmentId } from "../segments";

export interface FlowSegmentFacts {
  id: SegmentId;
  /** "1/3" — 구간을 가리키는 유일한 식별자다. 날짜는 주지 않는다 */
  ordinal: string;
  support: string;
  friction: string;
  tenGods: TenGodGroup[];
  /** 첫 구간은 null */
  vsPrev: string | null;
}

export interface FlowContext {
  analysis: SajuAnalysis;
  flowYear: number;
  sewunKorean: string;
  daeunKorean: string;
  segments: FlowSegmentFacts[];
}

function supportLabel(v: number): string {
  if (v >= 0.6) return "크게 받쳐줌";
  if (v >= 0.2) return "받쳐줌";
  if (v > -0.2) return "중립";
  if (v > -0.6) return "눌림";
  return "크게 눌림";
}

function frictionLabel(v: number): string {
  if (v >= 0.3) return "크게 흔들림";
  if (v >= 0.1) return "흔들림";
  return "잔잔함";
}

/** 일간 오행 기준으로 다른 오행이 무슨 세력인가. yongsin.ts 의 groupElements 와 같은 정의다. */
function groupOf(dayEl: Element, other: Element): TenGodGroup {
  if (other === dayEl) return "비겁";
  if (other === generatedBy(dayEl)) return "인성";
  if (other === elementGenerates(dayEl)) return "식상";
  if (other === elementControls(dayEl)) return "재성";
  return "관성";
}

function deltaPhrase(prev: { s: number; f: number }, cur: { s: number; f: number }): string {
  const parts: string[] = [];
  const ds = cur.s - prev.s;
  const df = cur.f - prev.f;
  if (Math.abs(ds) >= 0.15) parts.push(ds > 0 ? "받쳐줌이 커짐" : "받쳐줌이 줄어듦");
  if (Math.abs(df) >= 0.15) parts.push(df > 0 ? "흔들림이 커짐" : "흔들림이 줄어듦");
  return parts.length > 0 ? parts.join(", ") : "성격은 비슷하되 무게중심이 옮겨감";
}

/**
 * 구간마다 그 구간에 속한 월운들의 평균으로 두 축을 잡는다.
 *
 * 구간은 여러 달을 묶은 것이라 대표값이 필요하다. 최대값이 아니라 평균을 쓰는 이유:
 * 한 달만 튀는 구간을 "내내 흔들리는 구간" 으로 설명하게 되기 때문이다.
 */
export function buildFlowContext(
  analysis: SajuAnalysis,
  flowYear: number,
  segments: FlowSegment[],
): FlowContext {
  const scores = monthScores(analysis, flowYear);
  const dayEl = STEMS[analysis.chart.dayMaster].element;

  const perSegment = segments.map((seg) => {
    const from = Date.parse(seg.start);
    const to = Date.parse(seg.end);
    const inside = scores.filter(
      (m) => m.term.start.getTime() >= from && m.term.start.getTime() < to,
    );
    const mean = (pick: (m: (typeof inside)[number]) => number) =>
      inside.length === 0 ? 0 : inside.reduce((a, m) => a + pick(m), 0) / inside.length;

    const groups = new Set<TenGodGroup>();
    for (const m of inside) {
      const p = parsePillar2(m.term.korean);
      if (!p) continue;
      groups.add(groupOf(dayEl, STEMS[p.stem].element));
      groups.add(groupOf(dayEl, branchElementOf(p.branch)));
    }

    return {
      seg,
      s: mean((m) => m.support),
      f: mean((m) => m.friction),
      tenGods: [...groups],
    };
  });

  const daeun = analysis.daeun.periods.find(
    (p) => p.startAge <= flowYear - analysis.chart.solar.year + 1,
  );

  return {
    analysis,
    flowYear,
    sewunKorean: sewunPillars(flowYear, 1)[0].korean,
    daeunKorean: daeun?.pillar ?? analysis.daeun.periods[0].pillar,
    segments: perSegment.map((cur, i) => ({
      id: cur.seg.id,
      ordinal: `${i + 1}/${segments.length}`,
      support: supportLabel(cur.s),
      friction: frictionLabel(cur.f),
      tenGods: cur.tenGods,
      vsPrev: i === 0 ? null : deltaPhrase(perSegment[i - 1], cur),
    })),
  };
}

export function flowFacts(ctx: FlowContext): string {
  const lines: string[] = [
    "[연간 배경]",
    // chartFacts 는 리포트용이라 나이·연도가 섞인 줄이 있을 수 있다. 그 파일은
    // 리포트가 쓰므로 고치지 않고, 여기서 숫자가 든 줄만 걸러낸다 — 프롬프트에
    // 숫자가 남으면 "시점을 지어내지 마라" 는 규칙보다 그 숫자가 이긴다.
    chartFacts(ctx.analysis)
      .split("\n")
      .filter((l) => !/\d/.test(l))
      .join("\n"),
    `올해 간지: ${ctx.sewunKorean}`,
    `지금 구간의 간지: ${ctx.daeunKorean}`,
    `용신: ${ctx.analysis.yongsin.yongsin} · 희신: ${ctx.analysis.yongsin.huisin}`,
  ];

  for (const s of ctx.segments) {
    lines.push(
      "",
      `[구간 ${s.ordinal}] segmentId=${s.id}`,
      `받쳐줌: ${s.support}`,
      `흔들림: ${s.friction}`,
      `두드러지는 힘: ${s.tenGods.join(" · ")}`,
    );
    // 이 줄이 §12 의 핵심이다. 없으면 LLM 이 각 구간을 독립적으로 소개해서
    // "무엇이 달라지는가" 가 아니라 "각 구간이 어떤가" 가 된다.
    if (s.vsPrev) lines.push(`앞 구간 대비: ${s.vsPrev}`);
  }

  return lines.join("\n");
}
```

- [ ] **Step 5: 요청 조립을 쓴다**

`src/app/api/flows/_lib/prompt/index.ts`:

```ts
// 섹션 하나에 대한 LLM 요청을 조립한다. 흐름 프롬프트를 만드는 유일한 자리다.

import { FLOW_SECTIONS, flowLlmInputSchema, type FlowSectionKey } from "../sections";
import { flowFacts, type FlowContext } from "./facts";
import { FLOW_SYSTEM_PROMPT, SECTION_TOOL_NAME } from "./system";

export { buildFlowContext, flowFacts, type FlowContext, type FlowSegmentFacts } from "./facts";
export { FLOW_SYSTEM_PROMPT, SECTION_TOOL_NAME } from "./system";

export interface FlowSectionRequest {
  key: FlowSectionKey;
  system: string;
  user: string;
  toolName: string;
  inputSchema: Record<string, unknown>;
}

export function buildFlowSectionRequest(
  ctx: FlowContext,
  key: FlowSectionKey,
): FlowSectionRequest {
  const spec = FLOW_SECTIONS[key];

  const user = [
    flowFacts(ctx),
    "",
    `[요청 · ${key}]`,
    spec.prompt,
    "",
    "[문체 예시] 아래는 톤과 길이를 보여주는 예시일 뿐이다. 내용을 가져다 쓰지 말고,",
    "위 [사실] 블록에서 나온 이야기로 새로 써라.",
    spec.example,
  ].join("\n");

  return {
    key,
    system: FLOW_SYSTEM_PROMPT,
    user,
    toolName: SECTION_TOOL_NAME,
    // 구간 수가 스키마에 박힌다 — LLM 이 개수를 바꿀 수 없다.
    inputSchema: flowLlmInputSchema(key, ctx.segments.length),
  };
}
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/prompt/ && npm run typecheck`
Expected: 테스트 7개 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/flows/_lib/prompt/
git commit -m "feat(flows): 숫자 대신 범주로 말하는 사실 블록과 시기 규칙을 세운다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: 생성기 · produce · 게이트

**게이트를 생성기 자리에 두는 것이 요점이다.** `produceFlowSections` 는 저장소에 없는 섹션이 있을 때만 생성기를 부르므로, 여기 두면 **실제로 비용이 드는 순간에만** 차감된다. 이미 다 저장된 흐름을 다시 여는 것은 생성기에 닿지 않아 공짜다.

**Files:**
- Create: `src/app/api/flows/_lib/generator.ts`
- Create: `src/app/api/flows/_lib/produce.ts`
- Create: `src/app/api/flows/_lib/gated-generator.ts`
- Create: `src/app/api/flows/_lib/produce.test.ts`
- Create: `src/app/api/flows/_lib/gated-generator.test.ts`

**Interfaces:**
- Consumes: `createDeepSeekTransport` (`@/app/api/saju/_lib/deepseek`), `MODEL` (`@/app/api/saju/_lib/generator`), `buildFlowSectionRequest` / `type FlowContext` / `type FlowSectionRequest` (Task 13), `assignFlow` / `isFlowSectionKey` / `parseFlowSectionContent` / `type FlowInterpretation` / `type FlowSectionKey` (Task 11), `type StoredFlowSections` (Task 12), `spendTicket` (`@/lib/tickets/spend`), `FlowTicketsError` / `checkFlowLimit` / `FlowRateLimitError` (Task 10)
- Produces:
  - `type FlowTransport = (req: FlowSectionRequest) => Promise<unknown>`
  - `interface FlowGenerator { readonly model: string; generateSections(ctx: FlowContext, keys: FlowSectionKey[]): Promise<Partial<FlowInterpretation>> }`
  - `class PromptedFlowGenerator implements FlowGenerator`
  - `createFlowGenerator(env?): FlowGenerator`
  - `class FlowGenerationError extends Error { readonly partial: Partial<FlowInterpretation> }`
  - `interface ProduceFlowDeps { generator; getStored; putStored; sectionKeys }`
  - `produceFlowSections(flowId, ctx, deps): Promise<{ interpretation: Partial<FlowInterpretation>; stored: boolean }>`
  - `gateFlowGeneration(inner, userId, checkLimit?): FlowGenerator`
  - `chargeFlowGeneration(inner, userId, flowId, spend?): FlowGenerator`
  - `isFlowRateLimited(e: unknown): boolean`

**배경 (읽고 시작할 것):**
- `src/app/api/matches/_lib/generator.ts` — `PromptedMatchGenerator`. 섹션마다 독립 호출이라 병렬로 보내고, 한 섹션이 죽어도 나머지는 남는다. **스키마 검증은 여기서 하지 않는다** — produce 가 저장 직전 한 곳에서 건다
- `src/app/api/matches/_lib/produce.ts:44-70` — `produceMatchSections`. 생성기가 준 값을 여기서 한 번 거르는 이유("화면과 저장 양쪽에 그대로 쓰이므로 한쪽에서만 검증하면 다른 쪽은 새는 채로 남는다")
- `src/app/api/matches/_lib/gated-generator.ts` — 게이트 두 겹(한도·이용권)과 "던지기 전에 inner 를 부르지 않는다" 는 순서 규칙
- `src/lib/tickets/spend.ts:35-60` — `spendTicket` 의 네 갈래를 제약이 판정한다는 설명

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/gated-generator.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { FlowContext } from "./prompt";
import type { FlowGenerator } from "./generator";
import { chargeFlowGeneration, gateFlowGeneration, isFlowRateLimited } from "./gated-generator";
import { FlowRateLimitError } from "@/lib/flows/rate-limit";
import { FlowTicketsError } from "@/lib/flows/tickets";

const ctx = { segments: [{ id: "segment_1" }] } as unknown as FlowContext;

function stub(): FlowGenerator & { calls: number } {
  const g = {
    model: "test-model",
    calls: 0,
    async generateSections() {
      g.calls += 1;
      return {};
    },
  };
  return g as unknown as FlowGenerator & { calls: number };
}

describe("gateFlowGeneration", () => {
  it("한도에 걸리면 안쪽 생성기를 부르지 않는다 — 비용을 쓴 뒤 보고하면 게이트가 아니다", async () => {
    const inner = stub();
    const gated = gateFlowGeneration(inner, "3", async () => false);
    await expect(gated.generateSections(ctx, ["now"])).rejects.toBeInstanceOf(FlowRateLimitError);
    expect(inner.calls).toBe(0);
  });

  it("통과하면 그대로 흘려보낸다", async () => {
    const inner = stub();
    const gated = gateFlowGeneration(inner, "3", async () => true);
    await gated.generateSections(ctx, ["now"]);
    expect(inner.calls).toBe(1);
  });

  it("모델 식별자를 바꾸지 않는다 — DB 에 기록되는 값이다", () => {
    expect(gateFlowGeneration(stub(), "3", async () => true).model).toBe("test-model");
  });
});

describe("chargeFlowGeneration", () => {
  it("잔액이 모자라면 안쪽 생성기를 부르지 않는다", async () => {
    const inner = stub();
    const charged = chargeFlowGeneration(inner, "3", "7", async () => ({
      ok: false, kind: "insufficient", balance: 0,
    }));
    await expect(charged.generateSections(ctx, ["now"])).rejects.toBeInstanceOf(FlowTicketsError);
    expect(inner.calls).toBe(0);
  });

  it("subject_key 로 flowId 를 넘긴다 — 같은 해에 두 번 차감되지 않는 근거다", async () => {
    const spend = vi.fn(async () => ({ ok: true as const, kind: "spent" as const, balance: 4 }));
    await chargeFlowGeneration(stub(), "3", "7", spend).generateSections(ctx, ["now"]);
    expect(spend).toHaveBeenCalledWith({
      userId: "3", feature: "current_flow", subjectKey: "7",
    });
  });

  it("이미 권한이 있으면 다시 깎지 않고 통과한다", async () => {
    const inner = stub();
    await chargeFlowGeneration(inner, "3", "7", async () => ({
      ok: true, kind: "already", balance: 4,
    })).generateSections(ctx, ["now"]);
    expect(inner.calls).toBe(1);
  });
});

describe("isFlowRateLimited", () => {
  it("cause 에 싸인 것도 알아본다 — produce 가 감싸서 던진다", () => {
    expect(isFlowRateLimited(new Error("x", { cause: new FlowRateLimitError() }))).toBe(true);
    expect(isFlowRateLimited(new Error("x"))).toBe(false);
  });
});
```

`src/app/api/flows/_lib/produce.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { FlowContext } from "./prompt";
import { produceFlowSections, FlowGenerationError } from "./produce";

const ctx = { segments: [{ id: "segment_1" }] } as unknown as FlowContext;
const good = {
  common: "배경",
  segments: [{ segmentId: "segment_1", title: "가", body: "나" }],
};

describe("produceFlowSections", () => {
  it("다 저장돼 있으면 생성기를 부르지 않는다", async () => {
    let called = false;
    const out = await produceFlowSections("7", ctx, {
      generator: {
        model: "m",
        async generateSections() {
          called = true;
          return {};
        },
      },
      getStored: async () => ({ have: { now: good }, missing: [] }),
      putStored: async () => {},
      sectionKeys: ["now"],
    });
    expect(called).toBe(false);
    expect(out.stored).toBe(true);
  });

  it("스키마를 통과 못 한 섹션은 버린다 — 화면과 저장 양쪽에 새지 않게", async () => {
    let saved: unknown = null;
    const out = await produceFlowSections("7", ctx, {
      generator: {
        model: "m",
        async generateSections() {
          return { now: { common: "", segments: [] } } as never;
        },
      },
      getStored: async () => ({ have: {}, missing: ["now"] }),
      putStored: async (_id, v) => {
        saved = v;
      },
      sectionKeys: ["now"],
    });
    expect(out.interpretation.now).toBeUndefined();
    expect(saved).toEqual({});
  });

  it("생성기가 죽으면 이미 확보한 섹션을 실어 던진다", async () => {
    await expect(
      produceFlowSections("7", ctx, {
        generator: {
          model: "m",
          async generateSections() {
            throw new Error("boom");
          },
        },
        getStored: async () => ({ have: { now: good }, missing: ["rising"] }),
        putStored: async () => {},
        sectionKeys: ["now", "rising"],
      }),
    ).rejects.toMatchObject({ partial: { now: good } });
  });

  it("FlowGenerationError 는 원인을 cause 에 담는다", () => {
    const cause = new Error("inner");
    expect(new FlowGenerationError(cause, {}).cause).toBe(cause);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/produce.test.ts src/app/api/flows/_lib/gated-generator.test.ts`
Expected: FAIL — Cannot find module './produce'

- [ ] **Step 3: 생성기를 쓴다**

`src/app/api/flows/_lib/generator.ts`:

```ts
// 흐름 생성기. 프롬프트 조립은 prompt/ 에서 끝나고 여기서는 transport 로 옮기기만 한다.

import { createDeepSeekTransport } from "@/app/api/saju/_lib/deepseek";
import { MODEL } from "@/app/api/saju/_lib/generator";
import { assignFlow, type FlowInterpretation, type FlowSectionKey } from "./sections";
import { buildFlowSectionRequest, type FlowContext, type FlowSectionRequest } from "./prompt";

export type FlowTransport = (req: FlowSectionRequest) => Promise<unknown>;

export interface FlowGenerator {
  readonly model: string;
  generateSections(
    ctx: FlowContext,
    keys: FlowSectionKey[],
  ): Promise<Partial<FlowInterpretation>>;
}

function unwrapContent(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || !("content" in raw)) return undefined;
  return (raw as { content: unknown }).content;
}

export class PromptedFlowGenerator implements FlowGenerator {
  constructor(
    readonly model: string,
    private readonly transport: FlowTransport,
  ) {}

  async generateSections(
    ctx: FlowContext,
    keys: FlowSectionKey[],
  ): Promise<Partial<FlowInterpretation>> {
    // 섹션마다 독립된 호출이라 병렬로 보낸다. 한 섹션이 죽어도 나머지는 남고,
    // 빠진 섹션은 다음 열람에서 missing 으로 다시 잡힌다.
    const settled = await Promise.all(
      keys.map(async (key) => {
        try {
          const raw = await this.transport(buildFlowSectionRequest(ctx, key));
          return { key, content: unwrapContent(raw) };
        } catch (e) {
          console.warn(`[PromptedFlowGenerator] 섹션 생성 실패, 건너뜀: ${key}`, e);
          return null;
        }
      }),
    );

    const out: Partial<FlowInterpretation> = {};
    for (const result of settled) {
      if (!result || result.content === undefined) continue;
      // 스키마 검증은 하지 않는다 — produceFlowSections 가 저장 직전에 한 곳에서 건다.
      assignFlow(out, result.key, result.content as FlowInterpretation[FlowSectionKey]);
    }
    return out;
  }
}

export function createFlowGenerator(
  env: Record<string, string | undefined> = process.env,
): FlowGenerator {
  const apiKey = env.DEEP_SEEK_API_KEY;
  // stub 으로 조용히 물러서지 않는다 — 자리표시자 문구가 그대로 사용자에게 나간다.
  if (!apiKey) throw new Error("DEEP_SEEK_API_KEY 가 없습니다");
  return new PromptedFlowGenerator(MODEL, createDeepSeekTransport({ apiKey, model: MODEL }));
}
```

- [ ] **Step 4: produce 를 쓴다**

`src/app/api/flows/_lib/produce.ts`:

```ts
import {
  assignFlow,
  isFlowSectionKey,
  parseFlowSectionContent,
  type FlowInterpretation,
  type FlowSectionKey,
} from "./sections";
import type { FlowContext } from "./prompt";
import type { FlowGenerator } from "./generator";
import type { StoredFlowSections } from "./store";

/**
 * 생성기 호출 실패. DB 오류와 구분해야 호출자가 다르게 대응한다.
 * partial 은 실패 직전 저장소에서 읽어 둔 섹션들이다 — 싣지 않으면 이미 확보한
 * 서술까지 통째로 잃는다.
 */
export class FlowGenerationError extends Error {
  constructor(
    cause: unknown,
    readonly partial: Partial<FlowInterpretation>,
  ) {
    super("흐름 해석 생성에 실패했습니다", { cause });
    this.name = "FlowGenerationError";
  }
}

export interface ProduceFlowDeps {
  generator: FlowGenerator;
  getStored: (flowId: string, keys: FlowSectionKey[]) => Promise<StoredFlowSections>;
  putStored: (
    flowId: string,
    interpretation: Partial<FlowInterpretation>,
    model: string,
  ) => Promise<void>;
  sectionKeys: FlowSectionKey[];
}

/**
 * 저장된 서술은 그대로, 없는 것만 생성·검증·저장.
 *
 * 구간 수는 ctx.segments.length 하나가 유일한 출처다 — getStored 도 검증도 이 값을
 * 쓴다. 저장된 서술의 구간 수가 다르면 missing 으로 잡혀 다시 생성된다.
 */
export async function produceFlowSections(
  flowId: string,
  ctx: FlowContext,
  deps: ProduceFlowDeps,
): Promise<{ interpretation: Partial<FlowInterpretation>; stored: boolean }> {
  const n = ctx.segments.length;
  const { have, missing } = await deps.getStored(flowId, deps.sectionKeys);
  if (missing.length === 0) return { interpretation: have, stored: true };

  let generated: Partial<FlowInterpretation>;
  try {
    generated = await deps.generator.generateSections(ctx, missing);
  } catch (e) {
    throw new FlowGenerationError(e, have);
  }

  // 생성기가 준 값은 무엇이든 여기서 한 번 걸러야 한다. 이 결과가 화면과 저장
  // 양쪽에 그대로 쓰이므로, 한쪽에서만 검증하면 다른 쪽은 새는 채로 남는다.
  const clean: Partial<FlowInterpretation> = {};
  for (const [key, raw] of Object.entries(generated)) {
    if (!isFlowSectionKey(key)) continue;
    const content = parseFlowSectionContent(key, raw, n);
    if (content === null) {
      console.warn(`[produceFlowSections] 스키마 검증 실패, 버림: ${key}`);
      continue;
    }
    assignFlow(clean, key, content);
  }

  await deps.putStored(flowId, clean, deps.generator.model);
  return { interpretation: { ...have, ...clean }, stored: true };
}
```

- [ ] **Step 5: 게이트를 쓴다**

`src/app/api/flows/_lib/gated-generator.ts`:

```ts
import { FlowRateLimitError, checkFlowLimit } from "@/lib/flows/rate-limit";
import { FlowTicketsError } from "@/lib/flows/tickets";
import { spendTicket, type SpendResult } from "@/lib/tickets/spend";
import type { FlowGenerator } from "./generator";

/**
 * 시간당 한도를 씌운 흐름 생성기.
 *
 * 게이트를 **생성기 자리**에 두는 이유는 궁합·리포트와 같다: produceFlowSections 는
 * 저장소에 없는 섹션이 있을 때만 생성기를 부른다. 그래서 이 자리에 두면 **실제로
 * 비용이 드는 순간에만** 카운터가 깎인다.
 *
 * userId 를 인자로 받는다(생성기가 세션을 읽지 않는다) — 이 함수가 순수해야
 * 한도 초과에서 안쪽 생성기가 정말 안 불리는지를 테스트로 못박을 수 있다.
 */
export function gateFlowGeneration(
  inner: FlowGenerator,
  userId: string,
  checkLimit: (userId: string) => Promise<boolean> = checkFlowLimit,
): FlowGenerator {
  return {
    // 모델 식별자는 그대로 넘긴다 — DB 에 기록되는 값이라 래퍼가 바꾸면 안 된다.
    model: inner.model,
    async generateSections(ctx, keys) {
      // 던지기 전에 inner 를 부르지 않는다. 순서가 뒤집히면 게이트는 "비용을 막는 것"
      // 이 아니라 "비용을 쓴 뒤 보고하는 것" 이 된다.
      if (!(await checkLimit(userId))) throw new FlowRateLimitError();
      return inner.generateSections(ctx, keys);
    },
  };
}

/**
 * 이용권을 씌운 흐름 생성기.
 *
 * subjectKey 가 flowId 인 것이 요점이다. flows_unique 가 (프로필, 명리 연도)로 잡혀
 * 있어 같은 해의 흐름은 항상 같은 행이고, entitlements_unique 가 그 행에 두 번
 * 차감되는 것을 막는다. **기간별 권한이 여기서 저절로 나온다** — 흐름이 넘어가면
 * 새 flow_year → 새 행 → 새 subject_key → 새 결제다.
 *
 * 생성이 실패해도 되돌리지 않는다 — 권한 행이 남아 재시도가 공짜이기 때문이다.
 * (상담은 반대다: 그쪽은 상담 1건이 죽으면 되돌린다)
 */
export function chargeFlowGeneration(
  inner: FlowGenerator,
  userId: string,
  flowId: string,
  spend: (a: {
    userId: string;
    feature: "current_flow";
    subjectKey: string;
  }) => Promise<SpendResult> = spendTicket,
): FlowGenerator {
  return {
    model: inner.model,
    async generateSections(ctx, keys) {
      const result = await spend({ userId, feature: "current_flow", subjectKey: flowId });
      if (!result.ok) throw new FlowTicketsError();
      return inner.generateSections(ctx, keys);
    },
  };
}

/**
 * produceFlowSections 는 생성기 예외를 FlowGenerationError 로 감싸며 원인을 cause 에
 * 넣는다. 한도에 걸린 것과 생성이 실패한 것은 사용자에게 할 말이 다르므로 갈라낸다.
 */
export function isFlowRateLimited(e: unknown): boolean {
  if (e instanceof FlowRateLimitError) return true;
  return e instanceof Error && e.cause instanceof FlowRateLimitError;
}

/** 위와 같은 이유로 이용권 부족도 갈라낸다. */
export function isFlowOutOfTickets(e: unknown): boolean {
  if (e instanceof FlowTicketsError) return true;
  return e instanceof Error && e.cause instanceof FlowTicketsError;
}
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/ && npm run typecheck`
Expected: 전부 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/flows/_lib/generator.ts src/app/api/flows/_lib/produce.ts src/app/api/flows/_lib/gated-generator.ts src/app/api/flows/_lib/produce.test.ts src/app/api/flows/_lib/gated-generator.test.ts
git commit -m "feat(flows): 비용이 드는 순간에만 한도와 이용권을 거는 생성기를 세운다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 15: `handler.ts` · `route.ts` — 흐름 행 만들기

`POST /api/flows` 는 **행만 만든다.** 차감은 하지 않는다 — 같은 프로필·같은 해를 다시 제출해 `flows_unique` 로 기존 행에 수렴하는 요청이 이용권을 먹으면 안 되기 때문이다.

**Files:**
- Create: `src/app/api/flows/_lib/handler.ts`
- Create: `src/app/api/flows/_lib/handler.test.ts`
- Create: `src/app/api/flows/route.ts`

**Interfaces:**
- Consumes: `flowYearAt` (Task 2), `flowSegments` (Task 7), `canCreateFlow` / `type FlowAccess` (Task 10), `findOrCreateFlow` (Task 9), `getProfile` (`@/lib/profiles/store`), `analyze` (`@/lib/saju-core`), `getSession` (`@/lib/auth/session`)
- Produces:
  - `interface CreateFlowDeps { userId: string | null; now: Date; checkAccess(userId: string | null): Promise<FlowAccess>; getProfile(userId: string, id: string): Promise<{ id: string; birth: unknown } | null>; findOrCreate(userId: string, input: CreateFlowInput): Promise<{ id: string; created: boolean }> }`
  - `handleCreateFlow(raw: unknown, deps: CreateFlowDeps): Promise<{ status: number; body: unknown }>`

**배경 (읽고 시작할 것):**
- `src/app/api/matches/route.ts` — 얇은 라우트. `json()` 파싱 실패를 400 으로, 나머지 예외를 500 으로 굽고 판정은 전부 핸들러에 맡긴다
- `src/app/api/matches/_lib/handler.ts` — deps 주입으로 순수하게 유지하는 방식. **`getProfile` 에 `userId` 를 넘겨 남의 프로필로 만들지 못하게 막는다**
- `src/lib/profiles/store.ts` 의 `getProfile` 시그니처 — 실제 반환 타입을 열어 확인하고 `analyze` 에 넣을 생년월일 필드 이름을 맞춘다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/handler.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { handleCreateFlow } from "./handler";

const birth = { year: 1990, month: 6, day: 15, hour: 10, minute: 30, gender: "male", calendar: "solar" };
const now = new Date("2026-06-01T00:00:00Z");

const deps = {
  userId: "3",
  now,
  checkAccess: async () => ({ ok: true }) as const,
  getProfile: async () => ({ id: "11", birth }),
  findOrCreate: async () => ({ id: "7", created: true }),
};

describe("handleCreateFlow", () => {
  it("본문이 모양에 안 맞으면 400", async () => {
    expect((await handleCreateFlow({}, deps)).status).toBe(400);
  });

  it("비로그인은 401", async () => {
    const out = await handleCreateFlow({ profileId: "11" }, {
      ...deps,
      userId: null,
      checkAccess: async () => ({ ok: false, reason: "unauthenticated" }) as const,
    });
    expect(out.status).toBe(401);
  });

  it("한도에 걸리면 429", async () => {
    const out = await handleCreateFlow({ profileId: "11" }, {
      ...deps,
      checkAccess: async () => ({ ok: false, reason: "rate_limited" }) as const,
    });
    expect(out.status).toBe(429);
  });

  it("잔액이 모자라면 402 — 한도와 다른 코드다", async () => {
    const out = await handleCreateFlow({ profileId: "11" }, {
      ...deps,
      checkAccess: async () => ({ ok: false, reason: "insufficient_tickets" }) as const,
    });
    expect(out.status).toBe(402);
  });

  it("남의 프로필이면 404 — getProfile 이 userId 로 거른다", async () => {
    const out = await handleCreateFlow({ profileId: "99" }, {
      ...deps,
      getProfile: async () => null,
    });
    expect(out.status).toBe(404);
  });

  it("만들면 201 과 id 를 준다", async () => {
    const out = await handleCreateFlow({ profileId: "11" }, deps);
    expect(out.status).toBe(201);
    expect(out.body).toMatchObject({ id: "7" });
  });

  it("이미 있으면 200 — 같은 행으로 수렴한다", async () => {
    const out = await handleCreateFlow({ profileId: "11" }, {
      ...deps,
      findOrCreate: async () => ({ id: "7", created: false }),
    });
    expect(out.status).toBe(200);
  });

  it("명리 연도와 구간을 계산해 넘긴다 — 행에 박제될 값이다", async () => {
    let got: { flowYear: number; segments: unknown[] } | null = null;
    await handleCreateFlow({ profileId: "11" }, {
      ...deps,
      findOrCreate: async (_u, input) => {
        got = input as never;
        return { id: "7", created: true };
      },
    });
    expect(got!.flowYear).toBe(2026);
    expect(got!.segments.length).toBeGreaterThanOrEqual(1);
    expect(got!.segments.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/handler.test.ts`
Expected: FAIL — Cannot find module './handler'

- [ ] **Step 3: 핸들러를 쓴다**

`src/app/api/flows/_lib/handler.ts`:

```ts
import { z } from "zod";
import { analyze, flowYearAt, type SajuAnalysis } from "@/lib/saju-core";
import type { FlowAccess } from "@/lib/flows/access";
import type { CreateFlowInput } from "@/lib/flows/store";
import { flowSegments } from "./segments";

const Input = z.object({ profileId: z.string().min(1) }).strict();

/** getProfile 이 돌려주는 것 중 이 핸들러가 실제로 읽는 필드만. */
export interface FlowProfile {
  id: string;
  birth: Parameters<typeof analyze>[0];
}

export interface CreateFlowDeps {
  userId: string | null;
  /** 현재 시각을 주입한다 — 서버 시계를 읽으면 명리 연도를 테스트로 못 박을 수 없다 */
  now: Date;
  checkAccess(userId: string | null): Promise<FlowAccess>;
  /** ⚠️ userId 를 함께 넘긴다. 남의 프로필로 흐름을 만들지 못하게 하는 유일한 방어선이다 */
  getProfile(userId: string, id: string): Promise<FlowProfile | null>;
  findOrCreate(
    userId: string,
    input: CreateFlowInput,
  ): Promise<{ id: string; created: boolean }>;
}

const STATUS: Record<Exclude<FlowAccess, { ok: true }>["reason"], number> = {
  unauthenticated: 401,
  rate_limited: 429,
  insufficient_tickets: 402,
};

export async function handleCreateFlow(
  raw: unknown,
  deps: CreateFlowDeps,
): Promise<{ status: number; body: unknown }> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "요청 형식이 올바르지 않습니다" } };

  const access = await deps.checkAccess(deps.userId);
  if (!access.ok) {
    return { status: STATUS[access.reason], body: { error: access.reason } };
  }

  // access.ok 가 true 면 userId 는 반드시 있다 — canCreateFlow 가 null 을 먼저 막는다.
  const userId = deps.userId!;

  const profile = await deps.getProfile(userId, parsed.data.profileId);
  if (!profile) return { status: 404, body: { error: "프로필을 찾을 수 없습니다" } };

  const analysis: SajuAnalysis = analyze(profile.birth);
  const period = flowYearAt(deps.now);
  // 구간과 기간을 여기서 확정해 행에 박제한다. 임계값을 나중에 튜닝해도 이미 판
  // 흐름의 구간은 소급해서 바뀌지 않는다.
  const segments = flowSegments(analysis, period.year);

  const { id, created } = await deps.findOrCreate(userId, {
    profileId: profile.id,
    flowYear: period.year,
    periodStart: period.start,
    periodEnd: period.end,
    segments,
  });

  return { status: created ? 201 : 200, body: { id } };
}
```

- [ ] **Step 4: 라우트를 쓴다**

`src/app/api/flows/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { canCreateFlow } from "@/lib/flows/access";
import { findOrCreateFlow } from "@/lib/flows/store";
import { getProfile } from "@/lib/profiles/store";
import { handleCreateFlow } from "./_lib/handler";

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleCreateFlow(raw, {
      userId: session?.userId ?? null,
      now: new Date(),
      checkAccess: canCreateFlow,
      getProfile,
      findOrCreate: findOrCreateFlow,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/flows]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
```

`getProfile` 의 실제 시그니처와 반환 필드가 `FlowProfile` 과 다르면 **`handler.ts` 의 `FlowProfile` 을 실제에 맞춘다** — `src/lib/profiles/store.ts` 를 열어 생년월일 필드 이름을 확인하고, `analyze` 에 넘길 값을 만드는 어댑터를 `route.ts` 에서 씌운다. 핸들러는 순수하게 둔다.

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/handler.test.ts && npm run typecheck && npm run lint`
Expected: 테스트 8개 PASS, 타입·린트 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/flows/_lib/handler.ts src/app/api/flows/_lib/handler.test.ts src/app/api/flows/route.ts
git commit -m "feat(api): 흐름 행을 만드는 라우트를 연다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Phase E · 화면

### Task 16: `/flow` 확인 화면

**⚠️ 이 태스크의 핵심은 "이미 확인한 흐름" 판정을 `flows` 행이 아니라 `entitlements` 로 하는 것이다.**

행 생성(무료)과 차감(생성 자리)이 다른 자리라, CTA 를 눌러 행은 만들어졌는데 생성이 한도나 잔액에서 막히면 **행은 있고 이용권은 안 나간** 상태가 남는다. 행 존재로 판정하면 "추가로 사용하지 않습니다"라고 안내한 뒤 실제로 차감된다.

**Files:**
- Create: `src/lib/tickets/entitlements.ts`
- Create: `src/lib/tickets/entitlements.test.ts`
- Create: `src/app/flow/_lib/to-confirm.ts`
- Create: `src/app/flow/_lib/to-confirm.test.ts`
- Create: `src/app/flow/_components/FlowConfirm.tsx`
- Create: `src/app/flow/page.tsx`

**Interfaces:**
- Consumes: `sql` / `type SqlClient` (`@/lib/db`), `type Feature` (`@/lib/tickets/features`), `findFlow` (Task 9), `flowYearAt` (Task 2), `getSession`, `getProfile`, `listProfiles` (`@/lib/profiles/store` — 실제 이름을 확인해 맞춘다)
- Produces:
  - `hasEntitlement(userId: string, feature: Feature, subjectKey: string, client?): Promise<boolean>`
  - `type ConfirmState = { kind: "new"; profileId: string; profileName: string; periodStart: Date; periodEnd: Date } | { kind: "owned"; flowId: string; profileName: string; periodStart: Date; periodEnd: Date } | { kind: "no_profile" }`
  - `toConfirmState(input: ConfirmInput): ConfirmState`
  - `interface ConfirmInput { profile: { id: string; name: string } | null; period: { start: Date; end: Date }; existing: { id: string } | null; owned: boolean }`
  - `formatPeriod(start: Date, end: Date): string` — "2026년 2월 초부터 2027년 2월 초까지"

**배경 (읽고 시작할 것):**
- `src/lib/tickets/spend.ts:100-110` — `entitlements` 를 읽는 유일한 기존 자리. 컬럼 이름(`user_id`, `feature`, `subject_key`)의 근거다
- `src/app/match/page.tsx` — 확인/입력 화면이 서버 컴포넌트로 세션과 프로필을 읽는 방식
- `src/app/home/_lib/to-home-entry.ts` — 화면 상태를 순수 함수로 빼고 페이지는 조립만 하는 이 레포의 패턴

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/tickets/entitlements.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SqlClient } from "@/lib/db";
import { hasEntitlement } from "./entitlements";

function fakeSql(rows: unknown[]) {
  const calls: { text: string; values: unknown[] }[] = [];
  const client = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return Promise.resolve(rows);
  }) as unknown as SqlClient;
  return { client, calls };
}

describe("hasEntitlement", () => {
  it("권한 행이 있으면 true", async () => {
    const { client } = fakeSql([{ id: 1 }]);
    expect(await hasEntitlement("3", "current_flow", "7", client)).toBe(true);
  });

  it("없으면 false", async () => {
    const { client } = fakeSql([]);
    expect(await hasEntitlement("3", "current_flow", "7", client)).toBe(false);
  });

  it("세 컬럼 모두로 거른다", async () => {
    const { client, calls } = fakeSql([]);
    await hasEntitlement("3", "current_flow", "7", client);
    expect(calls[0].text).toContain("user_id");
    expect(calls[0].text).toContain("feature");
    expect(calls[0].text).toContain("subject_key");
    expect(calls[0].values).toEqual(["3", "current_flow", "7"]);
  });
});
```

`src/app/flow/_lib/to-confirm.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatPeriod, toConfirmState } from "./to-confirm";

const period = {
  start: new Date("2026-02-04T00:00:00Z"),
  end: new Date("2027-02-04T00:00:00Z"),
};
const profile = { id: "11", name: "김OO" };

describe("toConfirmState", () => {
  it("프로필이 없으면 no_profile", () => {
    expect(toConfirmState({ profile: null, period, existing: null, owned: false }).kind)
      .toBe("no_profile");
  });

  it("행이 없으면 new — 이용권을 쓴다고 안내한다", () => {
    expect(toConfirmState({ profile, period, existing: null, owned: false }).kind).toBe("new");
  });

  it("⚠️ 행은 있어도 권한이 없으면 new 다 — 행 존재로 판정하면 안내와 실제가 어긋난다", () => {
    expect(toConfirmState({ profile, period, existing: { id: "7" }, owned: false }).kind)
      .toBe("new");
  });

  it("행도 있고 권한도 있으면 owned — 이어서 보기", () => {
    const out = toConfirmState({ profile, period, existing: { id: "7" }, owned: true });
    expect(out).toMatchObject({ kind: "owned", flowId: "7" });
  });
});

describe("formatPeriod", () => {
  it("연도를 감추지 않는다 — 구매 범위와 다음 결제 시점을 알아야 한다", () => {
    const text = formatPeriod(period.start, period.end);
    expect(text).toContain("2026년");
    expect(text).toContain("2027년");
  });

  it("입춘 시각을 그대로 노출하지 않고 '초' 로 부드럽게 말한다", () => {
    expect(formatPeriod(period.start, period.end)).toBe(
      "2026년 2월 초부터 2027년 2월 초까지",
    );
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/tickets/entitlements.test.ts src/app/flow/_lib/to-confirm.test.ts`
Expected: FAIL — Cannot find module

- [ ] **Step 3: 권한 조회를 쓴다**

`src/lib/tickets/entitlements.ts`:

```ts
import { sql as neonSql, type SqlClient } from "@/lib/db";
import type { Feature } from "./features";

const sql = neonSql as unknown as SqlClient;

/**
 * 이 사용자가 이 대상에 대한 열람 권한을 이미 갖고 있는가.
 *
 * spendTicket 이 권한 행을 넣는 자리라면 여기는 읽기만 하는 자리다. 확인 화면이
 * "이용권을 또 쓰나요" 에 답하려면 **행이 아니라 권한**을 봐야 한다 — 흐름 행은
 * 공짜로 만들어지고 차감은 생성 자리에서 일어나므로, 생성이 한도나 잔액에서
 * 막히면 행만 남고 권한은 없는 상태가 된다.
 */
export async function hasEntitlement(
  userId: string,
  feature: Feature,
  subjectKey: string,
  client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    SELECT 1 AS id FROM entitlements
     WHERE user_id = ${userId}::bigint
       AND feature = ${feature}
       AND subject_key = ${subjectKey}
     LIMIT 1
  `;
  return rows.length > 0;
}
```

- [ ] **Step 4: 화면 상태를 쓴다**

`src/app/flow/_lib/to-confirm.ts`:

```ts
// 확인 화면의 상태. 페이지는 조립만 하고 판정은 여기서 끝낸다.

export interface ConfirmInput {
  profile: { id: string; name: string } | null;
  period: { start: Date; end: Date };
  /** 이 프로필·이 해의 flows 행. 없으면 null */
  existing: { id: string } | null;
  /** 그 행에 대한 열람 권한이 있는가. ⚠️ 행 존재와 다른 값이다 */
  owned: boolean;
}

export type ConfirmState =
  | { kind: "no_profile" }
  | { kind: "new"; profileId: string; profileName: string; periodStart: Date; periodEnd: Date }
  | { kind: "owned"; flowId: string; profileName: string; periodStart: Date; periodEnd: Date };

/**
 * ⚠️ owned 는 existing 이 아니라 entitlements 에서 온다.
 *
 * 행 존재로 판정하면 "이용권을 추가로 사용하지 않습니다" 라고 안내한 뒤 실제로
 * 차감된다 — CTA 를 눌러 행은 만들어졌는데 생성이 한도나 잔액에서 막힌 경우다.
 */
export function toConfirmState(input: ConfirmInput): ConfirmState {
  if (!input.profile) return { kind: "no_profile" };

  const common = {
    profileName: input.profile.name,
    periodStart: input.period.start,
    periodEnd: input.period.end,
  };

  if (input.existing && input.owned) {
    return { kind: "owned", flowId: input.existing.id, ...common };
  }
  return { kind: "new", profileId: input.profile.id, ...common };
}

/**
 * "2026년 2월 초부터 2027년 2월 초까지"
 *
 * 연도를 감추지 않는다 — 감추면 사용자가 구매한 범위와 다음 결제 시점을 이해하지
 * 못한다. 반대로 입춘의 정확한 시각은 내부 판정에만 쓰고 화면에는 "초" 로 눅인다.
 */
export function formatPeriod(start: Date, end: Date): string {
  const label = (d: Date) => {
    const kst = new Date(d.getTime() + 9 * 3600_000);
    const day = kst.getUTCDate();
    const phase = day <= 10 ? "초" : day <= 20 ? "중순" : "말";
    return `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${phase}`;
  };
  return `${label(start)}부터 ${label(end)}까지`;
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/lib/tickets/entitlements.test.ts src/app/flow/_lib/to-confirm.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: 화면을 붙인다**

`src/app/flow/_components/FlowConfirm.tsx` — 클라이언트 컴포넌트. `kind` 에 따라 문구와 CTA 를 바꾼다.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ConfirmState } from "../_lib/to-confirm";
import { formatPeriod } from "../_lib/to-confirm";

export function FlowConfirm({ state }: { state: ConfirmState }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (state.kind === "no_profile") {
    return (
      <p className="text-[13.5px] leading-[1.55] text-gray-500">
        먼저 사주 정보를 저장해주세요.
      </p>
    );
  }

  const period = formatPeriod(state.periodStart, state.periodEnd);

  if (state.kind === "owned") {
    return (
      <section className="mx-auto max-w-[520px] px-5 py-9">
        <h1 className="mb-1.5 text-xl font-bold tracking-[-0.025em]">지금의 흐름</h1>
        <p className="mb-5 text-[13.5px] text-gray-500">{state.profileName}님의 현재 흐름</p>
        <dl className="mb-5">
          <dt className="text-[11.5px] font-bold tracking-[0.08em] text-slate-400">적용 기간</dt>
          <dd className="text-[13.5px]">{period}</dd>
        </dl>
        <p className="mb-5 text-[13.5px] text-gray-500">
          이미 확인한 흐름이에요. 이용권을 추가로 사용하지 않습니다.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/flow/${state.flowId}`)}
          className="w-full rounded-[14px] bg-accent py-3 text-sm font-bold text-white"
        >
          이어서 보기
        </button>
      </section>
    );
  }

  async function start() {
    setBusy(true);
    const res = await fetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: state.profileId }),
    });
    if (!res.ok) {
      setBusy(false);
      return;
    }
    const { id } = (await res.json()) as { id: string };
    router.push(`/flow/${id}`);
  }

  return (
    <section className="mx-auto max-w-[520px] px-5 py-9">
      <h1 className="mb-1.5 text-xl font-bold tracking-[-0.025em]">지금의 흐름</h1>
      <p className="mb-5 text-[13.5px] text-gray-500">
        {state.profileName}님의 현재 흐름을 살펴볼게요.
      </p>
      <dl className="mb-5">
        <dt className="text-[11.5px] font-bold tracking-[0.08em] text-slate-400">적용 기간</dt>
        <dd className="text-[13.5px]">{period}</dd>
      </dl>
      <p className="mb-5 text-[13.5px] text-gray-500">이용권 1장을 사용합니다.</p>
      <button
        type="button"
        disabled={busy}
        onClick={start}
        className="w-full rounded-[14px] bg-accent py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {busy ? "준비하는 중…" : "지금의 흐름 보기"}
      </button>
    </section>
  );
}
```

`src/app/flow/page.tsx` — 서버 컴포넌트. 세션·프로필·행·권한을 읽어 순수 함수에 넘긴다.

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { flowYearAt } from "@/lib/saju-core";
import { findFlow } from "@/lib/flows/store";
import { hasEntitlement } from "@/lib/tickets/entitlements";
import { FlowConfirm } from "./_components/FlowConfirm";
import { toConfirmState } from "./_lib/to-confirm";

export default async function FlowPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/flow");

  // 홈에서 "나로 정한" 프로필을 기본 선택으로 쓴다. 실제 조회 함수 이름은
  // src/lib/profiles/store.ts 와 src/lib/auth/users.ts 를 열어 맞춘다 —
  // 홈(src/app/home/page.tsx)이 같은 값을 읽는 자리다.
  const profile = await loadPrimaryProfile(session.userId);

  const period = flowYearAt(new Date());
  const existing = profile ? await findFlow(profile.id, period.year) : null;
  const owned = existing
    ? await hasEntitlement(session.userId, "current_flow", existing.id)
    : false;

  return (
    <FlowConfirm
      state={toConfirmState({
        profile: profile && { id: profile.id, name: profile.name },
        period: { start: period.start, end: period.end },
        existing: existing && { id: existing.id },
        owned,
      })}
    />
  );
}
```

`loadPrimaryProfile` 은 홈이 이미 하는 일이다. `src/app/home/page.tsx` 가 `user.primaryProfileId` 를 읽어 프로필을 고르는 코드를 그대로 따라 이 파일 안에 작은 헬퍼로 쓴다. 새 store 함수를 만들지 않는다.

- [ ] **Step 7: 확인한다**

Run: `npm run typecheck && npm run lint && npm test`
Expected: 전부 PASS

- [ ] **Step 8: 커밋**

```bash
git add src/lib/tickets/entitlements.ts src/lib/tickets/entitlements.test.ts src/app/flow/
git commit -m "feat(flow): 이용권이 나가는 자리를 확인 화면으로 세운다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 17: `/flow/[id]` 결과 화면

읽는 시점이 속한 구간을 골라 보여준다. **LLM 도 재계산도 없다** — `flows.segments` 는 박제고, 고르기만 한다.

**Files:**
- Create: `src/app/flow/[id]/_lib/current-segment.ts`
- Create: `src/app/flow/[id]/_lib/current-segment.test.ts`
- Create: `src/app/flow/[id]/_lib/to-flow-view.ts`
- Create: `src/app/flow/[id]/_lib/to-flow-view.test.ts`
- Create: `src/app/flow/[id]/page.tsx`
- Create: `src/app/flow/[id]/_components/FlowShell.tsx`
- Create: `src/app/flow/[id]/_components/FlowHero.tsx`
- Create: `src/app/flow/[id]/_components/FlowBody.tsx`
- Create: `src/app/flow/[id]/_components/AnalyzingFlow.tsx`
- Create: `src/app/flow/[id]/_components/FlowError.tsx`
- Create: `src/app/flow/[id]/_components/FlowRateLimited.tsx`
- Create: `src/app/flow/[id]/_components/FlowOutOfTickets.tsx`

**Interfaces:**
- Consumes: `type FlowSegment` (Task 7), `type FlowInterpretation` / `type FlowSegmentBody` (Task 11), `getFlow` (Task 9), `getFlowSections` / `putFlowSections` (Task 12), `produceFlowSections` (Task 14), `gateFlowGeneration` / `chargeFlowGeneration` / `isFlowRateLimited` / `isFlowOutOfTickets` (Task 14), `createFlowGenerator` (Task 14), `buildFlowContext` (Task 13), `FLOW_SECTION_KEYS` (Task 11)
- Produces:
  - `currentSegmentIndex(segments: FlowSegment[], now: Date): number`
  - `interface FlowSectionView { key: string; common: string | null; current: FlowSegmentBody | null; all: FlowSegmentBody[] }`
  - `toFlowView(interpretation: Partial<FlowInterpretation>, index: number): FlowSectionView[]`
  - `segmentLabel(segment: FlowSegment): string` — "11월 무렵부터"

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/flow/[id]/_lib/current-segment.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { currentSegmentIndex, segmentLabel } from "./current-segment";

const segments = [
  { id: "segment_1" as const, start: "2026-02-04T00:00:00Z", end: "2026-08-07T00:00:00Z", basis: "연시작" as const },
  { id: "segment_2" as const, start: "2026-08-07T00:00:00Z", end: "2027-02-04T00:00:00Z", basis: "월운전환" as const },
];

describe("currentSegmentIndex", () => {
  it("지금이 속한 칸을 고른다", () => {
    expect(currentSegmentIndex(segments, new Date("2026-03-01T00:00:00Z"))).toBe(0);
    expect(currentSegmentIndex(segments, new Date("2026-11-01T00:00:00Z"))).toBe(1);
  });

  it("경계는 닫힌-열린 구간이다", () => {
    expect(currentSegmentIndex(segments, new Date("2026-08-07T00:00:00Z"))).toBe(1);
  });

  it("기간이 지난 뒤에도 마지막 칸을 준다 — 산 리포트는 계속 볼 수 있어야 한다", () => {
    expect(currentSegmentIndex(segments, new Date("2028-01-01T00:00:00Z"))).toBe(1);
  });

  it("기간 전이면 첫 칸이다", () => {
    expect(currentSegmentIndex(segments, new Date("2025-01-01T00:00:00Z"))).toBe(0);
  });

  it("ISO 문자열을 instant 로 되돌려 비교한다 — 오프셋 표기가 달라도 맞는다", () => {
    const offset = [
      { ...segments[0], end: "2026-08-07T09:00:00+09:00" },
      { ...segments[1], start: "2026-08-07T09:00:00+09:00" },
    ];
    expect(currentSegmentIndex(offset, new Date("2026-08-07T00:30:00Z"))).toBe(1);
  });
});

describe("segmentLabel", () => {
  it("첫 구간은 '지금부터' 가 아니라 시작을 말한다", () => {
    expect(segmentLabel(segments[0])).toBe("2월 무렵부터");
  });

  it("계산된 날짜에서 붙인다 — LLM 이 쓴 값이 아니다", () => {
    expect(segmentLabel(segments[1])).toBe("8월 무렵부터");
  });
});
```

`src/app/flow/[id]/_lib/to-flow-view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toFlowView } from "./to-flow-view";

const body = (id: string) => ({ segmentId: id, title: `제목-${id}`, body: `본문-${id}` });

describe("toFlowView", () => {
  it("현재 구간의 서술을 고른다", () => {
    const view = toFlowView(
      { now: { common: "배경", segments: [body("segment_1"), body("segment_2")] } },
      1,
    );
    expect(view[0].current?.title).toBe("제목-segment_2");
    expect(view[0].common).toBe("배경");
  });

  it("07 은 common 이 없고 전체 타임라인을 준다", () => {
    const view = toFlowView({ ahead: { segments: [body("segment_1")] } }, 0);
    const ahead = view.find((v) => v.key === "ahead")!;
    expect(ahead.common).toBeNull();
    expect(ahead.all).toHaveLength(1);
  });

  it("없는 섹션은 빼고 낸다 — 생성이 일부 실패해도 나머지는 보인다", () => {
    expect(toFlowView({}, 0)).toEqual([]);
  });

  it("인덱스가 범위를 벗어나면 마지막 칸으로 눕힌다", () => {
    const view = toFlowView({ now: { common: "c", segments: [body("segment_1")] } }, 5);
    expect(view[0].current?.segmentId).toBe("segment_1");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run "src/app/flow/[id]/_lib/"`
Expected: FAIL — Cannot find module

- [ ] **Step 3: 순수 함수를 쓴다**

`src/app/flow/[id]/_lib/current-segment.ts`:

```ts
import type { FlowSegment } from "@/app/api/flows/_lib/segments";

/**
 * 읽는 시점이 속한 구간의 인덱스.
 *
 * segments 의 start/end 는 jsonb 안에서 ISO 문자열이다. 비교 전에 instant 로
 * 되돌린다 — 문자열끼리 비교하면 대부분 맞다가 오프셋 표기가 다른 행에서 틀린다.
 *
 * 못 찾으면 마지막 칸이다. period_end 를 지난 뒤에도 산 리포트는 계속 볼 수 있어야
 * 하고, 그때는 "이 흐름은 지났습니다 — 새 흐름 보기" 로 안내한다.
 */
export function currentSegmentIndex(segments: FlowSegment[], now: Date): number {
  const at = now.getTime();
  const found = segments.findIndex(
    (s) => at >= Date.parse(s.start) && at < Date.parse(s.end),
  );
  if (found >= 0) return found;
  return at < Date.parse(segments[0].start) ? 0 : segments.length - 1;
}

/**
 * "8월 무렵부터" — 계산된 날짜에서 붙인다. LLM 은 시점을 쓰지 않는다.
 * 정확한 절기 시각은 내부 판정에만 쓰고 화면에서는 달까지만 말한다.
 */
export function segmentLabel(segment: FlowSegment): string {
  const kst = new Date(Date.parse(segment.start) + 9 * 3600_000);
  return `${kst.getUTCMonth() + 1}월 무렵부터`;
}
```

`src/app/flow/[id]/_lib/to-flow-view.ts`:

```ts
import {
  FLOW_SECTION_KEYS,
  type FlowInterpretation,
  type FlowSegmentBody,
} from "@/app/api/flows/_lib/sections";

export interface FlowSectionView {
  key: string;
  /** 그해 전체의 배경. 07 은 null */
  common: string | null;
  /** 읽는 시점의 구간 서술 */
  current: FlowSegmentBody | null;
  /** 전체 구간. 07 타임라인이 쓴다 */
  all: FlowSegmentBody[];
}

/**
 * 저장된 서술 + 현재 구간 인덱스 → 화면 모델.
 *
 * 없는 섹션은 빼고 낸다 — 생성이 일부 실패해도 확보한 섹션은 보여야 한다.
 */
export function toFlowView(
  interpretation: Partial<FlowInterpretation>,
  index: number,
): FlowSectionView[] {
  const out: FlowSectionView[] = [];

  for (const key of FLOW_SECTION_KEYS) {
    const content = interpretation[key];
    if (!content) continue;

    const all = content.segments;
    const i = Math.min(Math.max(index, 0), all.length - 1);
    out.push({
      key,
      common: "common" in content ? content.common : null,
      current: all[i] ?? null,
      all,
    });
  }

  return out;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run "src/app/flow/[id]/_lib/"`
Expected: PASS (9 tests)

- [ ] **Step 5: 화면을 붙인다**

`src/app/flow/[id]/page.tsx` — 서버 컴포넌트. 궁합의 `/match/[id]/page.tsx` 를 그대로 따른다: 행을 읽고(소유권은 `getFlow` 의 `user_id` 가 막는다), 생성기를 두 겹 게이트로 감싸 `produceFlowSections` 를 부르고, 예외를 종류별로 갈라 화면을 고른다.

```tsx
import { notFound, redirect } from "next/navigation";
import { analyze } from "@/lib/saju-core";
import { getSession } from "@/lib/auth/session";
import { getFlow } from "@/lib/flows/store";
import { getProfileById } from "@/lib/profiles/store";
import { FLOW_SECTION_KEYS } from "@/app/api/flows/_lib/sections";
import { buildFlowContext } from "@/app/api/flows/_lib/prompt";
import { createFlowGenerator } from "@/app/api/flows/_lib/generator";
import {
  chargeFlowGeneration,
  gateFlowGeneration,
  isFlowOutOfTickets,
  isFlowRateLimited,
} from "@/app/api/flows/_lib/gated-generator";
import { produceFlowSections } from "@/app/api/flows/_lib/produce";
import { getFlowSections, putFlowSections } from "@/app/api/flows/_lib/store";
import { currentSegmentIndex } from "./_lib/current-segment";
import { toFlowView } from "./_lib/to-flow-view";
import { FlowShell } from "./_components/FlowShell";
import { FlowError } from "./_components/FlowError";
import { FlowRateLimited } from "./_components/FlowRateLimited";
import { FlowOutOfTickets } from "./_components/FlowOutOfTickets";

export default async function FlowResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/flow/${id}`);

  // ⚠️ getFlow 가 user_id 를 WHERE 에 건다. id 만으로 찾으면 남의 흐름이 열린다.
  const flow = await getFlow(session.userId, id);
  if (!flow) notFound();

  const profile = await getProfileById(session.userId, flow.profileId);
  if (!profile) notFound();

  const analysis = analyze(profile.birth);
  const ctx = buildFlowContext(analysis, flow.flowYear, flow.segments);
  const n = flow.segments.length;

  const generator = chargeFlowGeneration(
    gateFlowGeneration(createFlowGenerator(), session.userId),
    session.userId,
    flow.id,
  );

  try {
    const { interpretation } = await produceFlowSections(flow.id, ctx, {
      generator,
      getStored: (flowId, keys) => getFlowSections(flowId, keys, n),
      putStored: putFlowSections,
      sectionKeys: FLOW_SECTION_KEYS,
    });

    const index = currentSegmentIndex(flow.segments, new Date());
    return (
      <FlowShell
        flow={flow}
        index={index}
        sections={toFlowView(interpretation, index)}
      />
    );
  } catch (e) {
    if (isFlowRateLimited(e)) return <FlowRateLimited />;
    if (isFlowOutOfTickets(e)) return <FlowOutOfTickets />;
    console.error("[/flow/[id]]", e);
    return <FlowError />;
  }
}
```

`getProfileById` 의 실제 이름과 반환 필드는 `src/lib/profiles/store.ts` 를 열어 맞춘다 — 궁합의 `/match/[id]/page.tsx` 가 같은 일을 하는 자리다.

나머지 컴포넌트는 궁합의 `/match/[id]/_components/` 를 그대로 따른다:

- `FlowShell` — 헤더 + 히어로 + 본문 조립. `flow.periodStart`/`periodEnd` 로 기간 줄을, `flow.segments[index]` 로 "지금은 이 흐름의 N번째 구간을 지나고 있어요" 를 만든다. `index === segments.length - 1` 이고 `now >= flow.periodEnd` 면 "이 흐름은 지났습니다 — 새 흐름 보기(`/flow`)" 를 붙인다
- `FlowHero` — `sections` 중 `now` 의 `current.title` 을 대표 문장으로
- `FlowBody` — 01~06·08 은 `common` + `current`, 07(`ahead`)은 `all` 을 타임라인으로. 각 칸 앞에 `segmentLabel(flow.segments[i])` 를 붙이고 현재 칸을 강조한다. **04 끝에 `/consult`, 05 끝에 `/match` 링크를 화면이 붙인다** (LLM 이 쓰지 않는다)
- `AnalyzingFlow` / `FlowError` / `FlowRateLimited` / `FlowOutOfTickets` — 궁합의 같은 이름 컴포넌트에서 문구만 흐름으로 바꾼다

- [ ] **Step 6: 확인한다**

Run: `npm run typecheck && npm run lint && npm test`
Expected: 전부 PASS

- [ ] **Step 7: 커밋**

```bash
git add "src/app/flow/[id]/"
git commit -m "feat(flow): 읽는 시점이 속한 구간을 골라 흐름을 보여준다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 18: 홈 진입

**Files:**
- Modify: `src/app/home/_components/ExploreGrid.tsx`

**Interfaces:**
- Consumes: 없음 (링크만 더한다)
- Produces: 없음

- [ ] **Step 1: 카드를 더한다**

`src/app/home/_components/ExploreGrid.tsx` 의 리포트 카드 **바로 다음**에 넣는다. `md:grid-cols-2` 라 5개면 마지막 한 장이 혼자 남으므로, 노출이 중요한 흐름을 두 번째에 놓아 홀로 남는 자리가 뒤쪽 카드가 되게 한다.

```tsx
        <Link href="/flow" className={CARD}>
          <div className={EYEBROW}>요즘의 나</div>
          <div className={TITLE}>지금의 흐름</div>
          <p className={DESC}>
            요즘 나를 둘러싼 흐름과, 가까운 변화를 읽어보세요.
          </p>
          <span className={CTA}>흐름 보기 →</span>
        </Link>
```

- [ ] **Step 2: 홈 테스트가 그대로인지 확인한다**

Run: `npm test`
Expected: PASS. 홈 관련 테스트가 카드 개수를 세고 있으면 그 기대값을 5로 고친다.

- [ ] **Step 3: 실제로 열어본다**

`.claude/launch.json` 의 dev 서버로 미리보기를 띄우고 `/home` → 흐름 카드 → `/flow` 확인 화면 → CTA → `/flow/[id]` 까지 눌러본다. 확인할 것:

- 확인 화면의 기간 문구가 `2026년 2월 초부터 2027년 2월 초까지` 처럼 나온다
- 이용권이 실제로 1장만 빠진다 (같은 프로필·같은 해로 다시 들어가면 "이어서 보기")
- 결과 화면에 현재 구간이 표시된다
- 07 타임라인의 각 칸 앞에 "○월 무렵부터" 가 붙는다
- 본문 어디에도 LLM 이 쓴 연도·월·날짜가 없다

- [ ] **Step 4: 커밋**

```bash
git add src/app/home/_components/ExploreGrid.tsx
git commit -m "feat(home): 지금의 흐름을 리포트 다음 카드로 붙인다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## 자체 검토 결과

**스펙 커버리지** — 스펙의 각 절이 어느 태스크로 가는지:

| 스펙 절 | 태스크 |
|---|---|
| 데이터 · `flows` / `flow_sections` / 이용권 | 8, 9, 10 |
| 구간 계산 · 코드 위치 | 1~5 (saju-core), 6~7 (서비스) |
| 구간 계산 · 절대 시각 / `solarTermJD` 불변 | 1 |
| 구간 계산 · 지지 관계 모듈 | 4 |
| 구간 계산 · 두 축 / 정규화 / 선별 / 임계값 | 6, 7 |
| 생성 · 골격 | 14, 15 |
| 생성 · 입력을 닫는다 / 역할 기준 중복 방지 | 13 |
| 생성 · facts 블록 | 13 |
| 생성 · 섹션 스키마 / `segmentId` 강제 | 11 |
| 생성 · 시스템 프롬프트 | 13 |
| 화면 · 라우트 / 확인 화면 / entitlements 판정 | 16 |
| 화면 · "지금 여기" | 17 |
| 화면 · 연도 표기 | 16 (`formatPeriod`), 17 (`segmentLabel`) |
| 화면 · 홈 진입 / §22 연결 | 18, 17 |
| 열린 항목 · `FLOW_SEGMENT_THRESHOLD` | 7 Step 5 |

**남은 확인 지점 두 곳** — 계획이 실제 시그니처를 못 박지 못한 자리다. 해당 태스크에서 파일을 열어 맞춘다:

- `src/lib/profiles/store.ts` 의 프로필 조회 함수 이름과 생년월일 필드 (Task 15, 16, 17). 궁합의 `/match/[id]/page.tsx` 와 `src/app/home/page.tsx` 가 같은 일을 하는 자리다
- `src/lib/matches/rate-limit.ts` 의 내부 구조 (Task 10). Redis 키 접두사를 반드시 `flow:` 로 바꿀 것 — 안 바꾸면 궁합과 한도를 나눠 쓴다

