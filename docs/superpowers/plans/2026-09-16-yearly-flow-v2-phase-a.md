# 한 해의 흐름 v2 1단계(A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 연간 운세(/flow)에 "지금 상황" 입력을 받아 revision 에 박제하고, v2 프롬프트로 7섹션 리포트를 **한 번의 호출**로 생성·검증·발행해 v2 화면으로 읽게 한다(플래그 뒤).

**Architecture:** 상황·근거·입력을 `flow_report_revisions` 행에 스냅샷으로 저장하고, 결과 페이지가 pending revision 을 발견하면 한도→이용권→모델 순으로 한 번 생성해 발행한다. v1(`flow_sections`) 경로는 그대로 두고, `resolveFlowRoute` 가 flow 마다 v1/v2 를 가른다. 검토·교정 루프, lease, phase API 는 B.

**Tech Stack:** Next.js App Router(설치본 `node_modules/next/dist/docs/` 기준), TypeScript, Zod 4(`z.toJSONSchema`), Vitest(node 환경, `.tsx` 는 `renderToStaticMarkup`), Neon HTTP `SqlClient`(문장 하나씩), DeepSeek 전송 어댑터(`src/app/api/saju/_lib/deepseek.ts`).

**Spec:** [docs/superpowers/specs/2026-09-15-yearly-flow-v2-phase-a-design.md](../specs/2026-09-15-yearly-flow-v2-phase-a-design.md) — 이 플랜의 모든 결정의 출처. 충돌하면 스펙이 이긴다.

## Global Constraints

- 브랜치 `feat/flow-situation` 위에서 작업한다. 커밋 `2c8c169` 는 되돌리되 히스토리를 고쳐 쓰지 않는다(Task 1).
- 마이그레이션: 파일 하나에 SQL 문장 하나. 번호 0045~0048. `migrations/README.md` 의 "다음 번호" 를 0049 로. **개발 DB 에 적용은 사용자 확인 뒤**(공유 DB).
- v1 프롬프트·registry·`flow_sections`·entitlements 는 손대지 않는다. 예외: v1 `FlowBody` 의 무-변곡점 문구 한 줄(Task 15).
- 플래그 `FLOW_REPORT_V2_ENABLED=true` 만 v2 진입을 연다. 기본은 꺼짐.
- 로그·`validation_errors` 에 모델 본문·입력·출생정보를 남기지 않는다. 오류는 `name`·`status` 만.
- 공개 DTO(`PublicFlowReportV2`)에만 `interpretation`·`basisRefs`·`sourceKeys` 가 없다. 서버 컴포넌트가 `FlowReportV2` 전체를 클라이언트 컴포넌트 props 로 넘기지 않는다.
- 모든 UI 문구는 해요체. 스펙 §9 의 문자열을 그대로 쓴다.
- 커밋 메시지는 이 레포의 관례(한국어, `feat(flow): …`)를 따르고 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` 를 붙인다.
- 각 Task 끝에 `npx tsc --noEmit` 이 0 error 여야 한다.

---

## 파일 구조

| 경로 | 책임 |
|---|---|
| `src/lib/flows/context.ts` | 상황 선택지·enum·정규화·careerTitle (순수) |
| `src/lib/flows/request-hash.ts` | `stableStringify`·`requestHashOf` |
| `src/lib/flows/revisions.ts` | `flow_report_revisions` 저장소 |
| `src/lib/flows/store.ts` | `findOrCreateFlow` 가 행을 돌려주도록 변경 |
| `src/lib/flows/v2-flag.ts` | 플래그 |
| `src/app/api/flows/_lib/store.ts` | `hasAnyFlowSections` 추가 |
| `src/app/api/flows/_lib/v2/facts.ts` | evidence |
| `src/app/api/flows/_lib/v2/input.ts` | `FlowGenerationInput` |
| `src/app/api/flows/_lib/v2/schema.ts` | `FlowReportV2` Zod + tool schema |
| `src/app/api/flows/_lib/v2/references.ts` | basisRefs 존재 검증 |
| `src/app/api/flows/_lib/v2/prompts.ts` | 시스템·user 프롬프트 |
| `src/app/api/flows/_lib/v2/presentation.ts` | 공개 DTO |
| `src/app/api/flows/_lib/v2/generator.ts` | 단일 호출 생성기 |
| `src/app/api/flows/_lib/v2/__fixtures__/reports.ts` | 테스트 fixture |
| `src/app/api/flows/_lib/handler.ts` | `POST /api/flows` 확장 |
| `src/app/api/flows/[id]/revisions/_lib/handler.ts`, `route.ts` | 재시도 endpoint |
| `src/app/flow/[id]/_lib/resolve-flow-route.ts` | v1/v2 분기 |
| `src/app/flow/[id]/_lib/run-flow-report-v2.ts` | 한도→권한→admit→모델→발행 |
| `src/app/flow/[id]/_lib/v2-sections.ts` | 섹션 번호·제목 |
| `src/app/flow/[id]/_components/{FlowHeroV2,FlowBodyV2,MonthTimelineV2,FlowErrorV2}.tsx` | v2 렌더 |
| `src/app/flow/_components/{FlowConfirm,SituationSheet}.tsx` | 상황 시트 |

---

### Task 1: 어제 커밋 되돌리기

**Files:**
- Revert: 커밋 `2c8c169` 전체(13 파일)

- [ ] **Step 1: revert**

```bash
git revert --no-edit 2c8c169
```

- [ ] **Step 2: 확인**

Run: `npx tsc --noEmit && npx vitest run src/lib/flows src/app/api/flows src/app/flow`
Expected: 통과. `src/lib/flows/situation.ts`, `migrations/0045_flows_situation.sql` 이 없어야 한다(`ls` 로 확인).

- [ ] **Step 3: 커밋 메시지 보강** — revert 가 만든 커밋을 그대로 둔다(메시지 "Revert …"). 추가 커밋 없음.

---

### Task 2: 입력 계약 `context.ts`

**Files:**
- Create: `src/lib/flows/context.ts`, `src/lib/flows/context.test.ts`

**Interfaces (Produces):**
- `CAREER_OPTIONS`, `RELATIONSHIP_OPTIONS`, `CONCERN_OPTIONS`, `CAREER`, `RELATIONSHIP`, `CONCERN`
- `type Career | Relationship | Concern | ContextAnswer | ContextSnapshot | YearRelation | ContextReference`
- `contextAnswerSchema`, `isContextComplete(p)`, `yearRelationOf(flowYear, now)`, `normalizeFlowContext(answer, {relation, now})`, `careerTitle(c)`

- [ ] **Step 1: 실패하는 테스트**

```ts
// src/lib/flows/context.test.ts
import { describe, expect, it } from "vitest";
import {
  CAREER_OPTIONS, RELATIONSHIP_OPTIONS, CONCERN_OPTIONS,
  careerTitle, contextAnswerSchema, isContextComplete, normalizeFlowContext, yearRelationOf,
} from "./context";

const now = new Date("2026-09-16T00:00:00.000Z");

describe("normalizeFlowContext", () => {
  it("미응답을 개인 이력으로 채우지 않는다", () => {
    expect(normalizeFlowContext(undefined, { relation: "present", now })).toEqual({
      career: "unspecified", relationship: "unspecified", mainConcern: "overall",
      reference: "unspecified", asOf: "2026-09-16T00:00:00.000Z",
    });
  });
  it("지난 해에 답하면 그 해 초의 상황이다", () => {
    expect(normalizeFlowContext(
      { career: "student", relationship: "unspecified", mainConcern: "career" },
      { relation: "past", now },
    ).reference).toBe("selected_year_start");
  });
  it("올해·다가올 해에 답하면 지금 기준이다", () => {
    for (const relation of ["present", "future"] as const) {
      expect(normalizeFlowContext(
        { career: "unspecified", relationship: "dating", mainConcern: "overall" },
        { relation, now },
      ).reference).toBe("current_baseline");
    }
  });
  it("관심 분야만 답하면 기준 시점이 없다", () => {
    expect(normalizeFlowContext(
      { career: "unspecified", relationship: "unspecified", mainConcern: "money" },
      { relation: "past", now },
    )).toMatchObject({ mainConcern: "money", reference: "unspecified" });
  });
});

describe("careerTitle", () => {
  it("상황 제목은 하나의 매핑을 쓴다", () => {
    expect(careerTitle("employed")).toBe("직업운");
    expect(careerTitle("freelance")).toBe("직업운");
    expect(careerTitle("business")).toBe("직업운");
    expect(careerTitle("student")).toBe("학업운");
    expect(careerTitle("preparing")).toBe("취업·진로운");
    expect(careerTitle("taking_break")).toBe("일과 활동");
    expect(careerTitle("home_care")).toBe("일과 활동");
    expect(careerTitle("unspecified")).toBe("일과 활동");
  });
});

describe("contextAnswerSchema", () => {
  it("세 필드 모두 필수다", () => {
    expect(contextAnswerSchema.safeParse({ career: "employed", relationship: "single" }).success).toBe(false);
  });
  it("reference·asOf 를 보내면 거절한다 — 서버가 파생한다", () => {
    expect(contextAnswerSchema.safeParse({
      career: "employed", relationship: "single", mainConcern: "overall", reference: "current_baseline",
    }).success).toBe(false);
  });
  it("모든 선택지가 정의역에 있다", () => {
    for (const c of CAREER_OPTIONS) for (const r of RELATIONSHIP_OPTIONS) for (const m of CONCERN_OPTIONS) {
      expect(contextAnswerSchema.safeParse({ career: c.value, relationship: r.value, mainConcern: m.value }).success).toBe(true);
    }
  });
});

describe("isContextComplete", () => {
  it("셋 다 골라야 true", () => {
    expect(isContextComplete({ career: "employed", relationship: "single", mainConcern: null })).toBe(false);
    expect(isContextComplete({ career: "employed", relationship: "single", mainConcern: "overall" })).toBe(true);
  });
});

describe("yearRelationOf", () => {
  it("현재 명리 연도 기준이다 (2026-09-16 은 명리 2026년)", () => {
    expect(yearRelationOf(2025, now)).toBe("past");
    expect(yearRelationOf(2026, now)).toBe("present");
    expect(yearRelationOf(2027, now)).toBe("future");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npx vitest run src/lib/flows/context.test.ts` → FAIL (module not found)

- [ ] **Step 3: 구현**

```ts
// src/lib/flows/context.ts
// 흐름을 만들기 직전에 사용자가 고르는 "지금 상황". 화면·API·프롬프트가 같은
// 정의역을 보는 유일한 출처다. DB·환경변수를 import 하지 않는다.
import { z } from "zod";
import { flowYearAt } from "@/lib/saju-core";

export const CAREER_OPTIONS = [
  { value: "employed", label: "직장인" },
  { value: "freelance", label: "프리랜서" },
  { value: "business", label: "자영업 · 사업" },
  { value: "student", label: "학생" },
  { value: "preparing", label: "취업 · 진로 준비 중" },
  { value: "taking_break", label: "잠시 쉬는 중" },
  { value: "home_care", label: "가사 · 돌봄" },
  { value: "unspecified", label: "말하고 싶지 않아요" },
] as const;

export const RELATIONSHIP_OPTIONS = [
  { value: "single", label: "솔로" },
  { value: "crushing", label: "썸" },
  { value: "dating", label: "연애 중" },
  { value: "partnered", label: "기혼 · 파트너" },
  { value: "complicated", label: "복잡해요" },
  { value: "unspecified", label: "말하고 싶지 않아요" },
] as const;

export const CONCERN_OPTIONS = [
  { value: "career", label: "일" },
  { value: "money", label: "돈" },
  { value: "romance", label: "연애" },
  { value: "relationships", label: "대인관계" },
  { value: "overall", label: "전체" },
] as const;

/** 정의역을 배열에서 파생한다 — 화면에는 있고 스키마에는 없는 선택지를 못 만들게. */
function valuesOf<T extends readonly { value: string }[]>(options: T) {
  return options.map((o) => o.value) as unknown as [T[number]["value"], ...T[number]["value"][]];
}

export const CAREER = valuesOf(CAREER_OPTIONS);
export const RELATIONSHIP = valuesOf(RELATIONSHIP_OPTIONS);
export const CONCERN = valuesOf(CONCERN_OPTIONS);
export type Career = (typeof CAREER)[number];
export type Relationship = (typeof RELATIONSHIP)[number];
export type Concern = (typeof CONCERN)[number];

/** 클라이언트가 보내는 것. reference·asOf 는 서버가 파생하므로 받지 않는다(strict). */
export const contextAnswerSchema = z
  .object({ career: z.enum(CAREER), relationship: z.enum(RELATIONSHIP), mainConcern: z.enum(CONCERN) })
  .strict();
export type ContextAnswer = z.infer<typeof contextAnswerSchema>;

/** 시트의 제출 버튼이 열리는 조건. */
export function isContextComplete(p: {
  career: Career | null; relationship: Relationship | null; mainConcern: Concern | null;
}): p is ContextAnswer {
  return p.career !== null && p.relationship !== null && p.mainConcern !== null;
}

export type YearRelation = "past" | "present" | "future";
export type ContextReference = "selected_year_start" | "current_baseline" | "unspecified";

export interface ContextSnapshot {
  career: Career; relationship: Relationship; mainConcern: Concern;
  reference: ContextReference;
  /** ISO. 서버 시각 */
  asOf: string;
}

/** 선택한 해가 지금 명리 연도 기준으로 어디인가. 화면의 지난/올해/다가올 태그와 같은 출처다. */
export function yearRelationOf(flowYear: number, now: Date): YearRelation {
  const current = flowYearAt(now).year;
  return flowYear < current ? "past" : flowYear > current ? "future" : "present";
}

/**
 * 답 → 스냅샷. 던지는 경우가 없다 — 대조할 클라이언트 값이 없기 때문이다.
 * 상황 중 하나라도 답했으면 기준 시점이 생긴다(지난 해면 그 해 초, 아니면 지금).
 */
export function normalizeFlowContext(
  answer: ContextAnswer | undefined,
  opts: { relation: YearRelation; now: Date },
): ContextSnapshot {
  const career = answer?.career ?? "unspecified";
  const relationship = answer?.relationship ?? "unspecified";
  const mainConcern = answer?.mainConcern ?? "overall";
  const answered = career !== "unspecified" || relationship !== "unspecified";
  const reference: ContextReference = !answered
    ? "unspecified"
    : opts.relation === "past" ? "selected_year_start" : "current_baseline";
  return { career, relationship, mainConcern, reference, asOf: opts.now.toISOString() };
}

/** 02 섹션의 화면 제목. UI 와 모델 입력(request.careerTitle)이 같은 함수를 쓴다. */
export function careerTitle(c: Career): "직업운" | "학업운" | "취업·진로운" | "일과 활동" {
  switch (c) {
    case "employed": case "freelance": case "business": return "직업운";
    case "student": return "학업운";
    case "preparing": return "취업·진로운";
    default: return "일과 활동";
  }
}
```

- [ ] **Step 4: 통과 확인** — Run: `npx vitest run src/lib/flows/context.test.ts` → PASS
- [ ] **Step 5: 커밋** — `git add src/lib/flows/context.ts src/lib/flows/context.test.ts && git commit -m "feat(flow): 지금 상황 입력 계약(context.ts)"`

---

### Task 3: `request-hash.ts`

**Files:**
- Create: `src/lib/flows/request-hash.ts`, `src/lib/flows/request-hash.test.ts`

**Interfaces (Produces):** `stableStringify(v: unknown): string`, `requestHashOf(parts: RequestHashParts): string`

- [ ] **Step 1: 테스트**

```ts
// src/lib/flows/request-hash.test.ts
import { describe, expect, it } from "vitest";
import { requestHashOf, stableStringify } from "./request-hash";

const base = {
  flowYear: 2026,
  context: { career: "employed", relationship: "single", mainConcern: "overall", reference: "current_baseline" },
  evidence: { facts: [{ id: "a", kind: "natal", value: 1, monthIndex: null }] },
  months: [{ index: 1, pivot: false }],
  calcVersion: 1, promptBundleVersion: 1,
} as const;

describe("stableStringify", () => {
  it("키 순서가 달라도 같다", () => {
    expect(stableStringify({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(stableStringify({ a: [{ c: 2, d: 1 }], b: 1 }));
  });
  it("배열 순서는 유지한다", () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });
  it("undefined 값 키는 뺀다", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });
});

describe("requestHashOf", () => {
  it("같은 입력이면 같은 해시, 64자 hex", () => {
    const h = requestHashOf(base);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(requestHashOf({ ...base })).toBe(h);
  });
  it("답 하나가 다르면 다르다", () => {
    expect(requestHashOf({ ...base, context: { ...base.context, career: "student" } })).not.toBe(requestHashOf(base));
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/lib/flows/request-hash.test.ts` → FAIL

- [ ] **Step 3: 구현**

```ts
// src/lib/flows/request-hash.ts
// "같은 요청인가" 를 판정하는 해시. asOf 같은 매 요청 달라지는 값은 재료에 없다.
import { createHash } from "node:crypto";
import type { ContextSnapshot } from "./context";

/** 키를 재귀적으로 사전순 정렬한 JSON. 배열 순서는 유지. undefined 값은 키째 뺀다. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

export interface RequestHashParts {
  flowYear: number;
  context: Omit<ContextSnapshot, "asOf">;
  evidence: unknown;
  months: unknown;
  calcVersion: number;
  promptBundleVersion: number;
}

export function requestHashOf(parts: RequestHashParts): string {
  const { asOf: _drop, ...context } = parts.context as ContextSnapshot; // 혹시 asOf 가 섞여 들어와도 뺀다
  void _drop;
  return createHash("sha256").update(stableStringify({ ...parts, context })).digest("hex");
}
```

- [ ] **Step 4: 통과 확인**, `npx tsc --noEmit`
- [ ] **Step 5: 커밋** — `git commit -m "feat(flow): request_hash 재료와 stableStringify"`

---

### Task 4: 마이그레이션 0045~0048

**Files:**
- Create: `migrations/0045_flow_report_revisions.sql`, `migrations/0046_flow_report_revisions_pending_unique.sql`, `migrations/0047_flow_report_revisions_key_unique.sql`, `migrations/0048_flows_active_revision.sql`
- Modify: `migrations/README.md` 마지막 줄 "다음 번호는 0045 부터다" → "0049"

- [ ] **Step 1: 파일 작성**

```sql
-- migrations/0045_flow_report_revisions.sql
-- 한 해의 흐름 v2 의 생성 시도 1건. flows 1 : revisions N.
--
-- 사용자가 고른 지금 상황(context_snapshot)·모델 입력(input_snapshot)·그 flow 의
-- 보존된 12개월(months_snapshot)을 발행 시점에 박제한다. 읽을 때 다시 계산하지 않는다.
--
-- phase: draft → complete | failed 가 A 의 전부다. review/repair/review_repaired 는
-- B(검토 루프)가 쓴다. review_payload IS NULL 이면 "미검토 발행"(A 시기) 이다.
-- failure_code 정의역: transport | timeout | http | schema | references | gone.
-- admitted_at: 이용권 차감이 끝난 시각. 값이 있으면 답을 갈아끼울 수 없다.
-- lease_*: B 가 쓴다. A 는 비워 둔다.
CREATE TABLE IF NOT EXISTS flow_report_revisions (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  flow_id               bigint NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  format_version        integer NOT NULL DEFAULT 2,
  prompt_bundle_version integer NOT NULL,
  idempotency_key       text NOT NULL,
  request_hash          text NOT NULL,
  context_snapshot      jsonb NOT NULL,
  input_snapshot        jsonb NOT NULL,
  months_snapshot       jsonb NOT NULL,
  phase                 text NOT NULL CHECK (phase IN ('draft','review','repair','review_repaired','complete','failed')),
  working_payload       jsonb,
  review_payload        jsonb,
  validation_errors     jsonb,
  published_payload     jsonb,
  model                 text,
  usage_summary         jsonb,
  failure_code          text,
  lease_token           text,
  lease_expires_at      timestamptz,
  admitted_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  published_at          timestamptz
);
```

```sql
-- migrations/0046_flow_report_revisions_pending_unique.sql
-- 한 flow 에 미완성 시도는 하나. upsertPendingRevision 의 ON CONFLICT 가 이 인덱스를 본다.
CREATE UNIQUE INDEX IF NOT EXISTS flow_report_revisions_pending_unique
  ON flow_report_revisions (flow_id) WHERE phase NOT IN ('complete','failed');
```

```sql
-- migrations/0047_flow_report_revisions_key_unique.sql
-- 같은 flow 안에서 idempotency_key 는 유일. A 는 서버 UUID, B 가 클라이언트 requestId 로 바꾼다.
CREATE UNIQUE INDEX IF NOT EXISTS flow_report_revisions_key_unique
  ON flow_report_revisions (flow_id, idempotency_key);
```

```sql
-- migrations/0048_flows_active_revision.sql
-- 발행된 v2 revision. NULL 이면 v1 이거나 아직 발행 전이다. publishRevision 만 채운다.
ALTER TABLE flows ADD COLUMN IF NOT EXISTS active_revision_id bigint REFERENCES flow_report_revisions(id) ON DELETE SET NULL;
```

- [ ] **Step 2: README 갱신** — 마지막 줄을 `**다음 번호는 0049 부터다.**` 로.
- [ ] **Step 3: 커밋** — `git add migrations && git commit -m "feat(flow): flow_report_revisions 마이그레이션"`

(적용은 Task 16 에서 사용자 확인 뒤.)

---

### Task 5: 저장소 — `findOrCreateFlow` 반환 변경, `hasAnyFlowSections`, `revisions.ts`

**Files:**
- Modify: `src/lib/flows/store.ts:98-132` (`findOrCreateFlow`), `src/lib/flows/store.test.ts:50-75`
- Modify: `src/app/api/flows/_lib/handler.ts:45-49` (`CreateFlowDeps.findOrCreate` 타입), `src/app/api/flows/_lib/handler.test.ts:10-16` (`baseDeps`)
- Modify: `src/app/api/flows/_lib/store.ts` (+`hasAnyFlowSections`), `src/app/api/flows/_lib/store.test.ts`
- Create: `src/lib/flows/revisions.ts`, `src/lib/flows/revisions.test.ts`

**Interfaces (Produces):**
- `findOrCreateFlow(userId, input, client?) → Promise<{ row: FlowRow; created: boolean }>`
- `hasAnyFlowSections(flowId, client?) → Promise<boolean>`
- `revisions.ts`: `RevisionPhase`, `FlowRevisionRow`, `PendingRevisionInput`, `UpsertResult`, `upsertPendingRevision`, `findPendingRevision`, `findLatestRevision`, `getActiveRevision`, `admitRevision`, `publishRevision`, `failRevision`, `toRevisionRow`

- [ ] **Step 1: `findOrCreateFlow` 테스트 수정** — `store.test.ts` 의 세 케이스를 `{ row, created }` 로:

```ts
it("새로 넣으면 created 와 행", async () => {
  const { client } = fakeSql([[row]]);
  const out = await findOrCreateFlow("3", { profileId: "11", flowYear: 2026, periodStart: row.period_start, periodEnd: row.period_end, months }, client);
  expect(out.created).toBe(true);
  expect(out.row.id).toBe("7");
  expect(out.row.months).toHaveLength(2);
});
it("충돌하면 기존 행으로 수렴한다 — 이용권이 두 번 나가지 않는 근거다", async () => {
  const { client } = fakeSql([[], [row]]);
  const out = await findOrCreateFlow("3", { /* 같은 input */ }, client);
  expect(out).toMatchObject({ created: false, row: { id: "7" } });
});
// 세 번째(되찾지 못하면 던진다)는 그대로.
```

- [ ] **Step 2: 구현** — `INSERT … RETURNING *` 로, 충돌 시 `SELECT * FROM flows WHERE profile_id … AND flow_year …`. 두 경우 모두 `toFlowRow(row)`. 반환 `{ row, created }`. `handler.ts` 의 deps 타입과 사용처(`const { id, created } = await deps.findOrCreate(...)` → `const { row, created } = …; return { status: created ? 201 : 200, body: { id: row.id } }`), `handler.test.ts` 의 `findOrCreate: async () => ({ row: flowRowFixture, created: true })`(fixture 는 테스트 파일 상단에 `FlowRow` 모양으로 정의: id "7", months 는 `flowMonths(analyze(birth), 2026)`)를 고친다.

- [ ] **Step 3: `hasAnyFlowSections`** — `src/app/api/flows/_lib/store.ts` 에:

```ts
/**
 * flow_sections 행이 하나라도 있는가. 검증된 have 가 아니라 **행 존재**다 — 낡은
 * schema_version 만 남은 v1 흐름도 v1 이다(resolveFlowRoute 가 v2 로 보내면 안 된다).
 */
export async function hasAnyFlowSections(flowId: string, client: SqlClient = sql): Promise<boolean> {
  const rows = await client`SELECT 1 AS one FROM flow_sections WHERE flow_id = ${flowId}::bigint LIMIT 1`;
  return rows.length > 0;
}
```
테스트(`store.test.ts` 에 추가): fakeSql `[[{ one: 1 }]]` → true, `[[]]` → false.

- [ ] **Step 4: `revisions.ts` 테스트**

```ts
// src/lib/flows/revisions.test.ts
import { describe, expect, it } from "vitest";
import type { SqlClient } from "@/lib/db";
import { admitRevision, failRevision, publishRevision, toRevisionRow, upsertPendingRevision } from "./revisions";

function fakeSql(results: unknown[][]) {
  const calls: { text: string; values: unknown[] }[] = [];
  let i = 0;
  const client = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?"), values });
    return Promise.resolve(results[i++] ?? []);
  }) as unknown as SqlClient;
  return { client, calls };
}

const snapshot = { career: "employed", relationship: "single", mainConcern: "overall", reference: "current_baseline", asOf: "2026-09-16T00:00:00.000Z" };
const raw = {
  id: 5, flow_id: 7, format_version: 2, prompt_bundle_version: 1, idempotency_key: "k1", request_hash: "h1",
  context_snapshot: snapshot, input_snapshot: { request: {}, personalContext: snapshot, evidence: {} },
  months_snapshot: [{ index: 1, start: "a", end: "b", korean: "경인", pivot: false }],
  phase: "draft", published_payload: null, validation_errors: null, model: null, usage_summary: null,
  failure_code: null, admitted_at: null, created_at: "2026-09-16T00:00:00.000Z", updated_at: "2026-09-16T00:00:00.000Z", published_at: null,
};
const input = { promptBundleVersion: 1, idempotencyKey: "k2", requestHash: "h1", contextSnapshot: snapshot, inputSnapshot: raw.input_snapshot, monthsSnapshot: raw.months_snapshot };

describe("toRevisionRow", () => {
  it("jsonb 가 문자열로 와도 읽는다", () => {
    const r = toRevisionRow({ ...raw, context_snapshot: JSON.stringify(snapshot), months_snapshot: JSON.stringify(raw.months_snapshot) });
    expect(r.contextSnapshot.career).toBe("employed");
    expect(r.monthsSnapshot[0].korean).toBe("경인");
  });
  it("스냅샷 모양이 아니면 던진다", () => {
    expect(() => toRevisionRow({ ...raw, months_snapshot: "[]" })).toThrow();
  });
});

describe("upsertPendingRevision", () => {
  it("INSERT 가 1행이면 created", async () => {
    const { client, calls } = fakeSql([[raw]]);
    const out = await upsertPendingRevision("7", input, client);
    expect(out).toMatchObject({ kind: "created", revision: { id: "5" } });
    expect(calls[0].text).toMatch(/FOR UPDATE/);
    expect(calls[0].text).toMatch(/ON CONFLICT \(flow_id\) WHERE phase NOT IN/);
  });
  it("충돌 + 같은 해시면 same", async () => {
    const { client } = fakeSql([[], [raw]]);
    expect(await upsertPendingRevision("7", input, client)).toMatchObject({ kind: "same" });
  });
  it("충돌 + 다른 해시 + 과금 전이면 replaced", async () => {
    const { client, calls } = fakeSql([[], [{ ...raw, request_hash: "old" }], [{ ...raw, request_hash: "h1" }]]);
    expect(await upsertPendingRevision("7", input, client)).toMatchObject({ kind: "replaced" });
    expect(calls[2].text).toMatch(/admitted_at IS NULL/);
  });
  it("충돌 + 다른 해시 + 과금 뒤면 busy", async () => {
    const { client } = fakeSql([[], [{ ...raw, request_hash: "old", admitted_at: "2026-09-16T00:00:00.000Z" }], []]);
    expect(await upsertPendingRevision("7", input, client)).toEqual({ kind: "busy" });
  });
  it("충돌했는데 pending 이 없으면 none — 500 이 아니다", async () => {
    const { client } = fakeSql([[], []]);
    expect(await upsertPendingRevision("7", input, client)).toEqual({ kind: "none" });
  });
});

describe("admit / publish / fail", () => {
  it("admit 은 RETURNING 행을 돌려주고, 없으면 null", async () => {
    expect((await admitRevision("5", fakeSql([[{ ...raw, admitted_at: "x" }]]).client))?.admittedAt).toBeInstanceOf(Date);
    expect(await admitRevision("5", fakeSql([[]]).client)).toBeNull();
  });
  it("publish 는 문장 하나로 revision 과 flows 를 함께 바꾸고, 0행이면 false", async () => {
    const { client, calls } = fakeSql([[{ id: 7 }]]);
    expect(await publishRevision("5", "7", { payload: { sections: {} }, model: "m", usage: null }, client)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toMatch(/phase='draft'/);
    expect(calls[0].text).toMatch(/UPDATE flows SET active_revision_id/);
    expect(await publishRevision("5", "7", { payload: {}, model: "m", usage: null }, fakeSql([[]]).client)).toBe(false);
  });
  it("fail 은 draft 만 닫는다", async () => {
    const { client, calls } = fakeSql([[{ id: 5 }]]);
    expect(await failRevision("5", { failureCode: "schema", validationErrors: [], model: "m", usage: null }, client)).toBe(true);
    expect(calls[0].text).toMatch(/phase='draft'/);
  });
});
```

- [ ] **Step 5: 실패 확인** — `npx vitest run src/lib/flows/revisions.test.ts` → FAIL

- [ ] **Step 6: 구현**

```ts
// src/lib/flows/revisions.ts
import { sql as neonSql, type SqlClient } from "@/lib/db";
import type { FlowMonth } from "@/app/api/flows/_lib/pivots";
import type { ContextSnapshot } from "./context";

const sql = neonSql as unknown as SqlClient;

export type RevisionPhase = "draft" | "review" | "repair" | "review_repaired" | "complete" | "failed";

export interface FlowRevisionRow {
  id: string; flowId: string;
  formatVersion: number; promptBundleVersion: number;
  idempotencyKey: string; requestHash: string;
  contextSnapshot: ContextSnapshot;
  /** v2/input.ts 의 FlowGenerationInput. 여기서 타입을 import 하면 lib → app 의존이 생겨 unknown 으로 둔다 */
  inputSnapshot: unknown;
  monthsSnapshot: FlowMonth[];
  phase: RevisionPhase;
  publishedPayload: unknown | null;
  validationErrors: unknown | null;
  model: string | null; usageSummary: unknown | null; failureCode: string | null;
  admittedAt: Date | null;
  createdAt: Date; updatedAt: Date; publishedAt: Date | null;
}

function parseJsonb(v: unknown): unknown {
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return undefined; }
}
/** 화면이 모양을 전제하는 컬럼. 문자열이면 파싱, 아니면 던진다(flows/store.ts 의 toMonths 와 같은 판단). */
function required(v: unknown, col: string, id: unknown, check: (x: unknown) => boolean): unknown {
  const parsed = parseJsonb(v);
  if (!check(parsed)) throw new Error(`toRevisionRow: revision ${String(id)} 의 ${col} 모양이 맞지 않습니다`);
  return parsed;
}
const isObject = (x: unknown) => typeof x === "object" && x !== null && !Array.isArray(x);
const isNonEmptyArray = (x: unknown) => Array.isArray(x) && x.length > 0;
const dateOrNull = (v: unknown) => (v == null ? null : new Date(v as string));

export function toRevisionRow(raw: Record<string, unknown>): FlowRevisionRow {
  return {
    id: String(raw.id), flowId: String(raw.flow_id),
    formatVersion: Number(raw.format_version), promptBundleVersion: Number(raw.prompt_bundle_version),
    idempotencyKey: String(raw.idempotency_key), requestHash: String(raw.request_hash),
    contextSnapshot: required(raw.context_snapshot, "context_snapshot", raw.id, isObject) as ContextSnapshot,
    inputSnapshot: required(raw.input_snapshot, "input_snapshot", raw.id, isObject),
    monthsSnapshot: required(raw.months_snapshot, "months_snapshot", raw.id, isNonEmptyArray) as FlowMonth[],
    phase: raw.phase as RevisionPhase,
    publishedPayload: raw.published_payload == null ? null : required(raw.published_payload, "published_payload", raw.id, isObject),
    validationErrors: parseJsonb(raw.validation_errors) ?? null,
    model: raw.model == null ? null : String(raw.model),
    usageSummary: parseJsonb(raw.usage_summary) ?? null,
    failureCode: raw.failure_code == null ? null : String(raw.failure_code),
    admittedAt: dateOrNull(raw.admitted_at),
    createdAt: new Date(raw.created_at as string), updatedAt: new Date(raw.updated_at as string),
    publishedAt: dateOrNull(raw.published_at),
  };
}

export interface PendingRevisionInput {
  promptBundleVersion: number; idempotencyKey: string; requestHash: string;
  contextSnapshot: ContextSnapshot; inputSnapshot: unknown; monthsSnapshot: FlowMonth[];
}
export type UpsertResult =
  | { kind: "created" | "same" | "replaced"; revision: FlowRevisionRow }
  | { kind: "none" } | { kind: "busy" };

/**
 * pending 을 만들거나, 같은 입력의 pending 으로 수렴하거나, 아직 과금 전인 pending 의 답을 갈아끼운다.
 * INSERT … SELECT … FOR UPDATE 가 publishRevision 의 UPDATE flows 와 직렬화되어, 발행된
 * flow·v1 본문이 있는 flow 에는 넣지 않는다. 자세한 규칙은 스펙 §5.
 */
export async function upsertPendingRevision(
  flowId: string, input: PendingRevisionInput, client: SqlClient = sql,
): Promise<UpsertResult> {
  const inserted = await client`
    INSERT INTO flow_report_revisions
      (flow_id, prompt_bundle_version, idempotency_key, request_hash, context_snapshot, input_snapshot, months_snapshot, phase)
    SELECT f.id, ${input.promptBundleVersion}, ${input.idempotencyKey}, ${input.requestHash},
           ${JSON.stringify(input.contextSnapshot)}::jsonb, ${JSON.stringify(input.inputSnapshot)}::jsonb,
           ${JSON.stringify(input.monthsSnapshot)}::jsonb, 'draft'
      FROM flows f
     WHERE f.id = ${flowId}::bigint AND f.active_revision_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM flow_sections s WHERE s.flow_id = f.id)
       FOR UPDATE OF f
    ON CONFLICT (flow_id) WHERE phase NOT IN ('complete','failed') DO NOTHING
    RETURNING *
  `;
  if (inserted[0]) return { kind: "created", revision: toRevisionRow(inserted[0]) };

  const pending = await findPendingRevision(flowId, client);
  if (!pending) return { kind: "none" };
  if (pending.requestHash === input.requestHash) return { kind: "same", revision: pending };

  const replaced = await client`
    UPDATE flow_report_revisions
       SET context_snapshot = ${JSON.stringify(input.contextSnapshot)}::jsonb,
           input_snapshot = ${JSON.stringify(input.inputSnapshot)}::jsonb,
           months_snapshot = ${JSON.stringify(input.monthsSnapshot)}::jsonb,
           request_hash = ${input.requestHash}, updated_at = now()
     WHERE id = ${pending.id}::bigint AND phase = 'draft' AND admitted_at IS NULL
    RETURNING *
  `;
  return replaced[0] ? { kind: "replaced", revision: toRevisionRow(replaced[0]) } : { kind: "busy" };
}

export async function findPendingRevision(flowId: string, client: SqlClient = sql) {
  const rows = await client`
    SELECT * FROM flow_report_revisions
     WHERE flow_id = ${flowId}::bigint AND phase NOT IN ('complete','failed') LIMIT 1`;
  return rows[0] ? toRevisionRow(rows[0]) : null;
}
export async function findLatestRevision(flowId: string, client: SqlClient = sql) {
  const rows = await client`
    SELECT * FROM flow_report_revisions WHERE flow_id = ${flowId}::bigint ORDER BY created_at DESC, id DESC LIMIT 1`;
  return rows[0] ? toRevisionRow(rows[0]) : null;
}
export async function getActiveRevision(flowId: string, client: SqlClient = sql) {
  const rows = await client`
    SELECT r.* FROM flows f
      JOIN flow_report_revisions r ON r.id = f.active_revision_id AND r.flow_id = f.id
     WHERE f.id = ${flowId}::bigint`;
  return rows[0] ? toRevisionRow(rows[0]) : null;
}

/** 과금이 끝났음을 박제하고 그 시점의 행을 돌려준다. 생성기는 이 행의 input_snapshot 으로 돌린다. */
export async function admitRevision(revisionId: string, client: SqlClient = sql) {
  const rows = await client`
    UPDATE flow_report_revisions SET admitted_at = COALESCE(admitted_at, now()), updated_at = now()
     WHERE id = ${revisionId}::bigint AND phase = 'draft' RETURNING *`;
  return rows[0] ? toRevisionRow(rows[0]) : null;
}

export async function publishRevision(
  revisionId: string, flowId: string,
  a: { payload: unknown; model: string; usage: unknown }, client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    WITH r AS (
      UPDATE flow_report_revisions
         SET phase = 'complete', published_payload = ${JSON.stringify(a.payload)}::jsonb, model = ${a.model},
             usage_summary = ${a.usage == null ? null : JSON.stringify(a.usage)}::jsonb,
             published_at = now(), updated_at = now()
       WHERE id = ${revisionId}::bigint AND flow_id = ${flowId}::bigint AND phase = 'draft'
       RETURNING id, flow_id
    )
    UPDATE flows SET active_revision_id = r.id FROM r WHERE flows.id = r.flow_id RETURNING flows.id`;
  return rows.length > 0;
}

export async function failRevision(
  revisionId: string,
  a: { failureCode: string; validationErrors: unknown; model: string | null; usage: unknown },
  client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    UPDATE flow_report_revisions
       SET phase = 'failed', failure_code = ${a.failureCode},
           validation_errors = ${a.validationErrors == null ? null : JSON.stringify(a.validationErrors)}::jsonb,
           model = ${a.model}, usage_summary = ${a.usage == null ? null : JSON.stringify(a.usage)}::jsonb,
           updated_at = now()
     WHERE id = ${revisionId}::bigint AND phase = 'draft' RETURNING id`;
  return rows.length > 0;
}
```

주의: 테스트의 정규식이 `phase='draft'` 를 찾으므로 SQL 문자열에서 `phase = 'draft'` 를 쓰면 정규식을 `/phase = 'draft'/` 로 맞춘다 — 둘 중 하나로 통일.

- [ ] **Step 7: 통과 확인** — `npx vitest run src/lib/flows src/app/api/flows && npx tsc --noEmit`
- [ ] **Step 8: 커밋** — `git commit -m "feat(flow): revision 저장소와 findOrCreateFlow 행 반환"`

---

### Task 6: 기존 모듈 export 세 곳

**Files:**
- Modify: `src/app/api/saju/_lib/deepseek.ts:63,71` — `class DeepSeekHttpError`, `class DeepSeekTimeoutError` 앞에 `export`
- Modify: `src/app/api/flows/_lib/month-scores.ts:100` — `function groupOf` 앞에 `export`
- Modify: `src/app/api/flows/_lib/prompt/facts.ts` — `supportLabel`, `frictionLabel`, `deltaPhrase`, `distributionLabel`, `daeunPhaseOf` 에 `export`

- [ ] **Step 1: 수정 후** `npx tsc --noEmit && npx vitest run src/app/api` → PASS (동작 변화 없음)
- [ ] **Step 2: 커밋** — `git commit -m "refactor(flow): v2 가 재사용할 함수·오류 클래스를 export 한다"`

---

### Task 7: `v2/facts.ts`, `v2/input.ts`, fixture

**Files:**
- Create: `src/app/api/flows/_lib/v2/facts.ts`, `facts.test.ts`, `input.ts`, `__fixtures__/reports.ts`(evidence 부분만 이 Task; report fixture 는 Task 8)

**Interfaces (Produces):**
- `FLOW_CALC_VERSION = 1`, `EvidenceFact`, `Evidence`, `buildFlowEvidence(analysis, flowYear, months): Evidence`
- `FlowGenerationInput`, `buildFlowGenerationInput({ flowYear, relation, snapshot, evidence, months }): FlowGenerationInput`
- `makeEvidenceFixture(): Evidence`

- [ ] **Step 1: 테스트**

```ts
// src/app/api/flows/_lib/v2/facts.test.ts
import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { flowMonths } from "../pivots";
import { monthScores } from "../month-scores";
import { buildFlowEvidence } from "./facts";

const BIRTH = { year: 1993, month: 4, day: 12, hour: 9, minute: 20, gender: "male", calendar: "solar" } as const;
const a = analyze(BIRTH);
const YEARS = [2021, 2023, 2026, 2027, 2031];

describe("buildFlowEvidence", () => {
  it("ID 가 유일하고 availableFactIds 와 같다", () => {
    for (const y of YEARS) {
      const e = buildFlowEvidence(a, y, flowMonths(a, y));
      const ids = e.facts.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(e.availableFactIds).toEqual(ids);
    }
  });
  it("months 12개, 순번·pivot 이 저장된 값과 같고 factIds 는 그 달 것만", () => {
    const fm = flowMonths(a, 2027);
    const e = buildFlowEvidence(a, 2027, fm);
    expect(e.months).toHaveLength(12);
    e.months.forEach((m, i) => {
      expect(m.monthIndex).toBe(fm[i].index);
      expect(m.pivot).toBe(fm[i].pivot);
      expect(m.factIds.every((id) => id.startsWith(`month.${String(m.monthIndex).padStart(2, "0")}.`))).toBe(true);
      expect(m.factIds.length).toBeGreaterThan(0);
    });
    expect(e.pivotMonths).toEqual(fm.filter((m) => m.pivot).map((m) => m.index));
  });
  it("변곡점이 없어도 change.pivotMonths 는 빈 배열로 있다", () => {
    const found = YEARS.map((y) => buildFlowEvidence(a, y, flowMonths(a, y))).find((e) => e.pivotMonths.length === 0);
    if (!found) return; // 이 사주에 없는 해가 없으면 통과
    expect(found.facts.find((f) => f.id === "change.pivotMonths")?.value).toEqual([]);
  });
  it("관측 그룹은 합집합 이름으로만, 성별은 없다", () => {
    const e = buildFlowEvidence(a, 2027, flowMonths(a, 2027));
    expect(e.facts.some((f) => f.id === "aggregate.monthlyObservedGroups")).toBe(true);
    expect(JSON.stringify(e)).not.toMatch(/남성|여성|gender/);
  });
  it("annual.stemGroup 은 monthScores 와 같은 그룹 정의다", () => {
    const e = buildFlowEvidence(a, 2027, flowMonths(a, 2027));
    const g = e.facts.find((f) => f.id === "annual.stemGroup")!.value;
    expect(["비겁", "식상", "재성", "관성", "인성"]).toContain(g);
    // 1번째 달 그룹은 monthScores 의 것과 같다 (같은 groupOf)
    expect(e.facts.find((f) => f.id === "month.01.groups")!.value).toEqual(monthScores(a, 2027)[0].tenGods);
  });
});
```

- [ ] **Step 2: 실패 확인**

- [ ] **Step 3: 구현**

```ts
// src/app/api/flows/_lib/v2/facts.ts
// 계산값 → 모델이 읽는 evidence. 값은 v1 facts 의 라벨 함수를 재사용한다(복사하지 않는다).
import { STEMS, branchElementOf, sewunPillars, type SajuAnalysis } from "@/lib/saju-core";
import type { FlowMonth } from "../pivots";
import { groupOf } from "../month-scores";
import { parsePillar2 } from "../score";
import { buildFlowContext } from "../prompt/facts";

/** 절기·PIVOT_THRESHOLD·라벨 경계가 바뀌면 올린다. request_hash 재료다. */
export const FLOW_CALC_VERSION = 1;

export type EvidenceKind = "natal" | "annual" | "cycle" | "aggregate" | "month" | "change";
export interface EvidenceFact { id: string; kind: EvidenceKind; value: unknown; monthIndex: number | null }
export interface Evidence {
  facts: EvidenceFact[];
  availableFactIds: string[];
  months: { monthIndex: number; pivot: boolean; factIds: string[] }[];
  pivotMonths: number[];
}

const nn = (i: number) => String(i).padStart(2, "0");

export function buildFlowEvidence(analysis: SajuAnalysis, flowYear: number, months: FlowMonth[]): Evidence {
  // v1 이 이미 라벨(받쳐줌·흔들림·초반…)로 접어 둔 값을 그대로 쓴다.
  const ctx = buildFlowContext(analysis, flowYear, months);
  const dm = STEMS[analysis.chart.dayMaster];
  const el = analysis.elements;
  const total = Object.values(el.counts).reduce((s, n) => s + n, 0) || 1;
  const annual = parsePillar2(sewunPillars(flowYear, 1)[0].korean)!;

  const facts: EvidenceFact[] = [];
  const push = (kind: EvidenceKind, id: string, value: unknown, monthIndex: number | null = null) =>
    facts.push({ id, kind, value, monthIndex });

  push("natal", "natal.dayMaster", `${analysis.chart.dayMaster} (${dm.element}·${dm.yinYang})`);
  push("natal", "natal.strength", analysis.strength.level);
  push("natal", "natal.elements", Object.fromEntries(
    Object.entries(el.counts).map(([k, v]) => [k, distributionLabelOf(Number(v), total)]),
  ));
  push("natal", "natal.yongsin", { yongsin: analysis.yongsin.yongsin, huisin: analysis.yongsin.huisin });

  push("annual", "annual.pillar", ctx.year.sewunKorean);
  push("annual", "annual.stemGroup", groupOf(dm.element, STEMS[annual.stem].element));
  push("annual", "annual.branchGroup", groupOf(dm.element, branchElementOf(annual.branch)));
  push("annual", "annual.support", ctx.year.support);
  push("annual", "annual.friction", ctx.year.friction);

  push("cycle", "cycle.daeun", ctx.year.daeunKorean);
  push("cycle", "cycle.daeunPhase", ctx.year.daeunPhase);
  if (ctx.year.daeunSwitch) push("cycle", "cycle.daeunSwitch", ctx.year.daeunSwitch);

  push("aggregate", "aggregate.monthlyObservedGroups", ctx.year.tenGods);
  push("change", "change.pivotMonths", ctx.pivotMonths);

  const monthsOut = ctx.months.map((m) => {
    const p = nn(m.index);
    const before = facts.length;
    push("month", `month.${p}.support`, m.support, m.index);
    push("month", `month.${p}.friction`, m.friction, m.index);
    push("month", `month.${p}.groups`, m.tenGods, m.index);
    if (m.tenGodsChanged) push("month", `month.${p}.groupsChanged`, m.tenGodsChanged, m.index);
    if (m.interactions.length > 0) push("month", `month.${p}.interactions`, m.interactions, m.index);
    if (m.samhap) push("month", `month.${p}.samhap`, true, m.index);
    if (m.vsPrev) push("month", `month.${p}.vsPrev`, m.vsPrev, m.index);
    return { monthIndex: m.index, pivot: m.pivot, factIds: facts.slice(before).map((f) => f.id) };
  });

  return { facts, availableFactIds: facts.map((f) => f.id), months: monthsOut, pivotMonths: ctx.pivotMonths };
}

// v1 facts.ts 의 distributionLabel 은 Task 6 에서 export 됐다 — 이름 충돌을 피해 감싼다.
import { distributionLabel } from "../prompt/facts";
function distributionLabelOf(count: number, total: number) { return distributionLabel(count, total); }
```

(import 는 파일 상단으로 모은다 — 위 마지막 두 줄은 설명용 위치.)

```ts
// src/app/api/flows/_lib/v2/input.ts
import { careerTitle, type ContextSnapshot, type YearRelation } from "@/lib/flows/context";
import type { FlowMonth } from "../pivots";
import type { Evidence } from "./facts";
import { PROMPT_BUNDLE_VERSION } from "./prompts";

/** 프롬프트 문서 §3 의 모양. 키 이름은 문서를 따른다 — 시스템·user 프롬프트가 그 이름을 직접 부른다. */
export interface FlowGenerationInput {
  request: { flowYear: number; selectedYearRelation: YearRelation; careerTitle: string; promptBundleVersion: number };
  personalContext: {
    reference: ContextSnapshot["reference"];
    careerSituation: ContextSnapshot["career"];
    relationshipSituation: ContextSnapshot["relationship"];
    mainConcern: ContextSnapshot["mainConcern"];
    asOf: string;
  };
  evidence: Evidence;
}

export function buildFlowGenerationInput(a: {
  flowYear: number; relation: YearRelation; snapshot: ContextSnapshot; evidence: Evidence; months: FlowMonth[];
}): FlowGenerationInput {
  void a.months; // months 는 evidence.months 에 이미 접혀 있다. 서명은 스펙과 맞춘다.
  return {
    request: {
      flowYear: a.flowYear, selectedYearRelation: a.relation,
      careerTitle: careerTitle(a.snapshot.career), promptBundleVersion: PROMPT_BUNDLE_VERSION,
    },
    personalContext: {
      reference: a.snapshot.reference,
      careerSituation: a.snapshot.career, relationshipSituation: a.snapshot.relationship,
      mainConcern: a.snapshot.mainConcern, asOf: a.snapshot.asOf,
    },
    evidence: a.evidence,
  };
}
```

`PROMPT_BUNDLE_VERSION` 은 Task 9 의 `prompts.ts` 에서 온다 — 이 Task 에서는 `prompts.ts` 를 `export const PROMPT_BUNDLE_VERSION = 1;` 한 줄로 먼저 만들고 Task 9 가 채운다.

```ts
// src/app/api/flows/_lib/v2/__fixtures__/reports.ts (evidence 부분)
import { analyze } from "@/lib/saju-core";
import { flowMonths } from "../../pivots";
import { buildFlowEvidence, type Evidence } from "../facts";

const BIRTH = { year: 1993, month: 4, day: 12, hour: 9, minute: 20, gender: "male", calendar: "solar" } as const;
export function makeEvidenceFixture(year = 2027): Evidence {
  const a = analyze(BIRTH);
  return buildFlowEvidence(a, year, flowMonths(a, year));
}
```

- [ ] **Step 4: 통과 확인**, `npx tsc --noEmit`
- [ ] **Step 5: 커밋** — `git commit -m "feat(flow): v2 evidence 와 FlowGenerationInput"`

---

### Task 8: `v2/schema.ts`, `references.ts`, `presentation.ts`, report fixture

**Files:**
- Create: `src/app/api/flows/_lib/v2/schema.ts`, `schema.test.ts`, `references.ts`, `references.test.ts`, `presentation.ts`, `presentation.test.ts`
- Modify: `__fixtures__/reports.ts` (+`makeValidFlowReportFixture`)

**Interfaces (Produces):**
- `flowReportV2Schema`, `FlowReportV2`, `FocusDomain`, `DomainKey`, `flowReportToolSchema(): Record<string, unknown>`
- `validateReferences(report, evidence): string[]`
- `PublicFlowReportV2`, `toPublicFlowReportV2(report, { careerTitle, reference }): PublicFlowReportV2`
- `makeValidFlowReportFixture(evidence?): FlowReportV2`

- [ ] **Step 1: 스키마 구현** (프롬프트 문서 §6 제약 그대로)

```ts
// src/app/api/flows/_lib/v2/schema.ts
import { z } from "zod";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const DOMAIN = ["career", "money", "romance", "relationships"] as const;
const FOCUS = [...DOMAIN, "overall"] as const;
const SOURCE = ["overview", ...DOMAIN, "months"] as const; // closing 자기 참조는 enum 에서 막힌다

export type DomainKey = (typeof DOMAIN)[number];
export type FocusDomain = (typeof FOCUS)[number];

/** trim 뒤 길이(JS length). 프롬프트 문서 §6 "앞뒤 공백은 검증 전에 trim" */
const str = (min: number, max: number) => z.string().trim().min(min).max(max);
const unique = <T>(msg: string) => (arr: T[], ctx: z.RefinementCtx) => {
  if (new Set(arr).size !== arr.length) ctx.addIssue({ code: "custom", message: msg });
};
const basisRefs = z.array(z.string().min(1)).min(1).max(6).superRefine(unique("basisRefs 중복"));
const monthIndex = z.union(MONTHS.map((n) => z.literal(n)) as [z.ZodLiteral<number>, z.ZodLiteral<number>, ...z.ZodLiteral<number>[]]);

const claim = z.object({ conclusion: str(1, 200), qualification: z.string().trim().max(160), basisRefs }).strict();
const monthLink = z.object({ monthIndex, note: str(1, 120) }).strict();
const domain = z.object({
  headline: str(15, 55), opportunity: str(1, 280), caution: str(1, 280), action: str(1, 160),
  monthLinks: z.array(monthLink).max(2).superRefine((arr, ctx) => {
    if (new Set(arr.map((m) => m.monthIndex)).size !== arr.length) ctx.addIssue({ code: "custom", message: "monthLinks 달 중복" });
  }),
  basisRefs,
}).strict();
const monthItem = z.object({
  monthIndex, headline: str(8, 45), focusDomain: z.enum(FOCUS), body: str(1, 360), action: str(1, 140), basisRefs,
}).strict();

export const flowReportV2Schema = z.object({
  interpretation: z.object({
    annual: claim, focusDomain: z.enum(FOCUS),
    domains: z.object({ career: claim, money: claim, romance: claim, relationships: claim }).strict(),
  }).strict(),
  sections: z.object({
    overview: z.object({ headline: str(15, 55), body: str(1, 600), basisRefs }).strict(),
    career: domain, money: domain, romance: domain, relationships: domain,
    months: z.object({
      lead: str(1, 240),
      items: z.array(monthItem).length(12).superRefine((arr, ctx) => {
        for (let i = 0; i < arr.length; i++) {
          if (arr[i].monthIndex !== i + 1) { ctx.addIssue({ code: "custom", message: "months.items 는 1..12 오름차순·유일" }); return; }
        }
      }),
    }).strict(),
    closing: z.object({
      items: z.array(z.object({
        title: str(6, 30), body: str(1, 180),
        sourceKeys: z.array(z.enum(SOURCE)).min(1).max(2).superRefine(unique("sourceKeys 중복")),
      }).strict()).length(3),
    }).strict(),
  }).strict(),
}).strict();

export type FlowReportV2 = z.infer<typeof flowReportV2Schema>;

/** tool parameters. $schema 는 지운다(v1 derive.ts 와 같은 처리). refine 은 JSON Schema 에 안 실린다 — 프롬프트 문장이 보완. */
export function flowReportToolSchema(): Record<string, unknown> {
  const s = z.toJSONSchema(flowReportV2Schema) as Record<string, unknown>;
  delete s.$schema;
  return s;
}
```

- [ ] **Step 2: references.ts**

```ts
// src/app/api/flows/_lib/v2/references.ts
import type { Evidence } from "./facts";
import type { FlowReportV2 } from "./schema";

/** 모든 basisRefs 가 실제 근거 ID 인가. 없는 ID 를 "<경로>: <id>" 로 돌려준다. 빈 배열이면 통과. */
export function validateReferences(report: FlowReportV2, evidence: Evidence): string[] {
  const ok = new Set(evidence.availableFactIds);
  const out: string[] = [];
  const check = (path: string, refs: string[]) => { for (const r of refs) if (!ok.has(r)) out.push(`${path}: ${r}`); };
  const i = report.interpretation, s = report.sections;
  check("/interpretation/annual", i.annual.basisRefs);
  for (const k of ["career", "money", "romance", "relationships"] as const) {
    check(`/interpretation/domains/${k}`, i.domains[k].basisRefs);
    check(`/sections/${k}`, s[k].basisRefs);
  }
  check("/sections/overview", s.overview.basisRefs);
  s.months.items.forEach((m, idx) => check(`/sections/months/items/${idx}`, m.basisRefs));
  return out;
}
```

- [ ] **Step 3: presentation.ts**

```ts
// src/app/api/flows/_lib/v2/presentation.ts
import type { ContextReference } from "@/lib/flows/context";
import type { FlowReportV2, FocusDomain } from "./schema";

export interface PublicDomain { headline: string; opportunity: string; caution: string; action: string; monthLinks: { monthIndex: number; note: string }[] }
export interface PublicFlowReportV2 {
  careerTitle: string;
  reference: ContextReference;
  sections: {
    overview: { headline: string; body: string };
    career: PublicDomain; money: PublicDomain; romance: PublicDomain; relationships: PublicDomain;
    months: { lead: string; items: { monthIndex: number; headline: string; focusDomain: FocusDomain; body: string; action: string }[] };
    closing: { items: { title: string; body: string }[] };
  };
}

/** 공개 필드만 명시적으로 고른다. spread 뒤 delete 는 쓰지 않는다 — 새 내부 필드가 생기면 그대로 샌다. */
export function toPublicFlowReportV2(
  r: FlowReportV2, meta: { careerTitle: string; reference: ContextReference },
): PublicFlowReportV2 {
  const dom = (d: FlowReportV2["sections"]["career"]): PublicDomain => ({
    headline: d.headline, opportunity: d.opportunity, caution: d.caution, action: d.action,
    monthLinks: d.monthLinks.map((m) => ({ monthIndex: m.monthIndex, note: m.note })),
  });
  const s = r.sections;
  return {
    careerTitle: meta.careerTitle, reference: meta.reference,
    sections: {
      overview: { headline: s.overview.headline, body: s.overview.body },
      career: dom(s.career), money: dom(s.money), romance: dom(s.romance), relationships: dom(s.relationships),
      months: { lead: s.months.lead, items: s.months.items.map((m) => ({ monthIndex: m.monthIndex, headline: m.headline, focusDomain: m.focusDomain, body: m.body, action: m.action })) },
      closing: { items: s.closing.items.map((c) => ({ title: c.title, body: c.body })) },
    },
  };
}
```

- [ ] **Step 4: fixture** — `__fixtures__/reports.ts` 에 추가:

```ts
import type { FlowReportV2 } from "../schema";
const H = "표현 속도는 빨라지지만 완성할 일을 골라야 하는 해예요";        // 15~55자
export function makeValidFlowReportFixture(evidence: Evidence = makeEvidenceFixture()): FlowReportV2 {
  const ids = evidence.availableFactIds;
  const refs = (n: number) => ids.slice(0, n);
  const monthRefs = (i: number) => evidence.months[i].factIds.slice(0, 2);
  const claim = { conclusion: "벌이기보다 고르는 일이 중요한 해예요.", qualification: "", basisRefs: refs(2) };
  const domain = (n: number) => ({
    headline: H, opportunity: "초안을 보여주고 의견을 받는 과정이 수월해요.", caution: "여러 작업을 동시에 벌리면 마무리에서 집중이 분산되기 쉬워요.",
    action: "이번 달 안에 끝낼 일을 하나 정해요.", monthLinks: [{ monthIndex: n, note: "속도가 붙는 달" }], basisRefs: refs(3),
  });
  return {
    interpretation: { annual: claim, focusDomain: "career", domains: { career: claim, money: claim, romance: claim, relationships: claim } },
    sections: {
      overview: { headline: H, body: "한 해의 핵심 기회와 주의점을 정리해요.", basisRefs: refs(2) },
      career: domain(3), money: domain(5), romance: domain(4), relationships: domain(7),
      months: {
        lead: "안으로 다지던 힘이 밖으로 옮겨가는 한 해예요.",
        items: evidence.months.map((m, i) => ({
          monthIndex: m.monthIndex, headline: "방향을 잡는 달이에요", focusDomain: "overall" as const,
          body: "정리하는 데 마음이 쏠려요.", action: "기준 하나를 정해요.", basisRefs: monthRefs(i),
        })),
      },
      closing: { items: [1, 2, 3].map(() => ({ title: "작은 단위로 먼저 움직이기", body: "한 시간 안에 끝나는 조각을 떼어내 먼저 해봐요.", sourceKeys: ["career" as const] })) },
    },
  };
}
```

- [ ] **Step 5: 테스트**

```ts
// schema.test.ts
import { describe, expect, it } from "vitest";
import { flowReportToolSchema, flowReportV2Schema } from "./schema";
import { makeValidFlowReportFixture } from "./__fixtures__/reports";

const ok = () => makeValidFlowReportFixture();
describe("flowReportV2Schema", () => {
  it("fixture 통과", () => expect(flowReportV2Schema.safeParse(ok()).success).toBe(true));
  it("공백은 trim 뒤 길이를 잰다", () => {
    const r = ok(); r.sections.overview.headline = "   " + "가".repeat(15) + "   ";
    expect(flowReportV2Schema.safeParse(r).success).toBe(true);
    r.sections.overview.headline = "가".repeat(14);
    expect(flowReportV2Schema.safeParse(r).success).toBe(false);
  });
  it("months 는 12개·오름차순·유일", () => {
    const r = ok(); r.sections.months.items[3].monthIndex = 5;
    expect(flowReportV2Schema.safeParse(r).success).toBe(false);
  });
  it("basisRefs 중복·monthLinks 달 중복·sourceKeys 중복 거부", () => {
    const a = ok(); a.sections.overview.basisRefs = [a.sections.overview.basisRefs[0], a.sections.overview.basisRefs[0]];
    expect(flowReportV2Schema.safeParse(a).success).toBe(false);
    const b = ok(); b.sections.career.monthLinks = [{ monthIndex: 3, note: "x" }, { monthIndex: 3, note: "y" }];
    expect(flowReportV2Schema.safeParse(b).success).toBe(false);
    const c = ok(); c.sections.closing.items[0].sourceKeys = ["career", "career"];
    expect(flowReportV2Schema.safeParse(c).success).toBe(false);
  });
  it("closing 은 3개, sourceKeys 에 closing 불가, 추가 필드 거부", () => {
    const a = ok(); a.sections.closing.items.pop();
    expect(flowReportV2Schema.safeParse(a).success).toBe(false);
    const b = ok() as unknown as { sections: { closing: { items: { sourceKeys: string[] }[] } } };
    b.sections.closing.items[0].sourceKeys = ["closing"];
    expect(flowReportV2Schema.safeParse(b).success).toBe(false);
    const c = { ...ok(), extra: 1 };
    expect(flowReportV2Schema.safeParse(c).success).toBe(false);
  });
});
describe("flowReportToolSchema", () => {
  it("$schema 가 없고 object 다", () => {
    const s = flowReportToolSchema();
    expect(s.$schema).toBeUndefined();
    expect(s.type).toBe("object");
  });
});
```

```ts
// references.test.ts
import { expect, it } from "vitest";
import { validateReferences } from "./references";
import { makeEvidenceFixture, makeValidFlowReportFixture } from "./__fixtures__/reports";

it("전부 있으면 빈 배열", () => {
  const e = makeEvidenceFixture();
  expect(validateReferences(makeValidFlowReportFixture(e), e)).toEqual([]);
});
it("없는 ID 는 경로와 함께 나온다", () => {
  const e = makeEvidenceFixture();
  const r = makeValidFlowReportFixture(e);
  r.sections.money.basisRefs = ["nope.id"];
  expect(validateReferences(r, e)).toEqual(["/sections/money: nope.id"]);
});
```

```ts
// presentation.test.ts
import { expect, it } from "vitest";
import { toPublicFlowReportV2 } from "./presentation";
import { makeValidFlowReportFixture } from "./__fixtures__/reports";

it("내부 필드가 없고 메타가 실린다", () => {
  const p = toPublicFlowReportV2(makeValidFlowReportFixture(), { careerTitle: "학업운", reference: "current_baseline" });
  const text = JSON.stringify(p);
  expect(text).not.toMatch(/interpretation|basisRefs|sourceKeys/);
  expect(p.careerTitle).toBe("학업운");
  expect(p.reference).toBe("current_baseline");
  expect(p.sections.months.items).toHaveLength(12);
});
```

- [ ] **Step 6: 실행** — `npx vitest run src/app/api/flows/_lib/v2 && npx tsc --noEmit` → PASS
- [ ] **Step 7: 커밋** — `git commit -m "feat(flow): FlowReportV2 스키마·참조 검증·공개 DTO"`

---

### Task 9: `v2/prompts.ts` + 프롬프트 문서 수정

**Files:**
- Modify: `docs/prompts/2026-09-14-yearly-fortune-v2-prompts.md` (스펙 §4 의 여섯 항목)
- Modify: `src/app/api/flows/_lib/v2/prompts.ts` (Task 7 의 한 줄 파일을 채움), Create: `prompts.test.ts`

**Interfaces (Produces):** `PROMPT_BUNDLE_VERSION`, `FLOW_REPORT_TOOL_NAME = "emit_flow_report"`, `FLOW_REPORT_SYSTEM_V2: string`, `buildFlowReportUserV2(input: FlowGenerationInput): string`

- [ ] **Step 1: 문서 수정** — 프롬프트 문서에서
  1. §3 55행: `careerSituation` 에서 `other` 삭제; 56행 `relationshipSituation` 을 `single | crushing | dating | partnered | complicated | unspecified` 로.
  2. §5 "careerSituation 적용" 의 "other 또는 unspecified:" → "unspecified:".
  3. §5 "relationshipSituation 적용" 의 partnered 줄 뒤에 두 줄 추가 — 스펙 §4 의 crushing·complicated 문장 그대로.
  4. §8 `context_mismatch` 줄 끝에 ", crushing 에게 배우자를 전제, complicated 에게 특정 상대를 전제" 추가.
  5. §6 "monthLinks 길이 0~2, 동일 달 중복 금지" → "…동일 달 중복 금지(한 섹션 안 기준)".

- [ ] **Step 2: 테스트**

```ts
// prompts.test.ts
import { describe, expect, it } from "vitest";
import { buildFlowReportUserV2, FLOW_REPORT_SYSTEM_V2 } from "./prompts";
import { buildFlowGenerationInput } from "./input";
import { makeEvidenceFixture } from "./__fixtures__/reports";

const input = buildFlowGenerationInput({
  flowYear: 2027, relation: "future",
  snapshot: { career: "student", relationship: "crushing", mainConcern: "romance", reference: "current_baseline", asOf: "2026-09-16T00:00:00.000Z" },
  evidence: makeEvidenceFixture(), months: [],
});

describe("buildFlowReportUserV2", () => {
  const user = buildFlowReportUserV2(input);
  it("[입력 데이터] 다음에 입력 JSON 이 그대로 있다", () => {
    expect(user).toContain(`[입력 데이터]\n${JSON.stringify(input, null, 2)}\n[입력 데이터 끝]`);
  });
  it("프롬프트가 부르는 키가 JSON 에 있다", () => {
    expect(user).toContain('"careerSituation": "student"');
    expect(user).toContain('"relationshipSituation": "crushing"');
  });
  it("조립 설명 문구가 남지 않는다", () => {
    expect(user).not.toContain("서버에서 직렬화한");
    expect(user).not.toContain("선택된 예시 JSON");
  });
  it("문체 예시 3종이 실린다", () => {
    expect(user).toContain("표현은 수월하지만 동시 진행이 부담인 경우");
    expect((user.match(/"case":/g) ?? []).length).toBe(3);
  });
  it("crushing·complicated 규칙이 실린다", () => {
    expect(user).toContain("crushing:");
    expect(user).toContain("complicated:");
  });
});
it("시스템 프롬프트는 문서 첫 줄로 시작한다", () => {
  expect(FLOW_REPORT_SYSTEM_V2.startsWith("당신은 한국어 연간 사주 풀이를 작성하는 편집자다.")).toBe(true);
});
```

- [ ] **Step 3: 구현** — 문서 §4 의 `~~~text` 블록 전체를 `FLOW_REPORT_SYSTEM_V2` 템플릿 리터럴에 **그대로** 복사한다. §5 블록을 `buildFlowReportUserV2` 안에 복사하되 두 자리를 치환한다: "서버에서 직렬화한 FlowGenerationInput JSON" 줄 → `${JSON.stringify(input, null, 2)}`, "선택된 예시 JSON" 줄 → `${EXAMPLES}`(§7 의 `~~~json` 블록을 `const EXAMPLES = JSON.stringify([...], null, 2)` 상수로 — 문서의 배열을 객체 리터럴로 옮긴다). 백틱·`${` 이 문서 본문에 있으면 이스케이프한다.

```ts
export const PROMPT_BUNDLE_VERSION = 1;
export const FLOW_REPORT_TOOL_NAME = "emit_flow_report";
export const FLOW_REPORT_SYSTEM_V2 = `…§4 블록…`;
const EXAMPLES = JSON.stringify([ /* §7 세 항목 */ ], null, 2);
export function buildFlowReportUserV2(input: FlowGenerationInput): string {
  return `다음 입력 데이터와 섹션 지시문을 사용해 연간 사주 리포트 전체를 작성하라.

[입력 데이터]
${JSON.stringify(input, null, 2)}
[입력 데이터 끝]

…§5 의 나머지 지시문 그대로…
[예시]
${EXAMPLES}`;
}
```

- [ ] **Step 4: 실행** — `npx vitest run src/app/api/flows/_lib/v2/prompts.test.ts` → PASS
- [ ] **Step 5: 커밋** — `git add docs/prompts src/app/api/flows/_lib/v2/prompts.ts src/app/api/flows/_lib/v2/prompts.test.ts && git commit -m "feat(flow): v2 생성 프롬프트와 문서 정합"`

---

### Task 10: `v2/generator.ts`

**Files:**
- Create: `src/app/api/flows/_lib/v2/generator.ts`, `generator.test.ts`

**Interfaces (Produces):**
- `GenerateResult`, `GenerateFailureCode = "transport" | "timeout" | "http" | "schema" | "references"`
- `generateFlowReportV2(input, transport: { send: DeepSeekTransport; takeUsage(): unknown }): Promise<GenerateResult>`
- `createFlowReportTransport(env?): { send; takeUsage }`

- [ ] **Step 1: 테스트**

```ts
// generator.test.ts
import { describe, expect, it } from "vitest";
import { DeepSeekHttpError, DeepSeekTimeoutError } from "@/app/api/saju/_lib/deepseek";
import { generateFlowReportV2 } from "./generator";
import { buildFlowGenerationInput } from "./input";
import { makeEvidenceFixture, makeValidFlowReportFixture } from "./__fixtures__/reports";

const evidence = makeEvidenceFixture();
const input = buildFlowGenerationInput({
  flowYear: 2027, relation: "future", evidence, months: [],
  snapshot: { career: "employed", relationship: "single", mainConcern: "overall", reference: "current_baseline", asOf: "2026-09-16T00:00:00.000Z" },
});
const transportOf = (impl: () => Promise<unknown>) => {
  let calls = 0;
  return { t: { send: async () => { calls++; return impl(); }, takeUsage: () => ({ total_tokens: 1 }) }, calls: () => calls };
};

describe("generateFlowReportV2", () => {
  it("성공 — content 언랩 없이 tool 인자 자체가 report", async () => {
    const { t, calls } = transportOf(async () => makeValidFlowReportFixture(evidence));
    const r = await generateFlowReportV2(input, t);
    expect(r.ok).toBe(true);
    expect(calls()).toBe(1);
    if (r.ok) expect(r.usage).toEqual({ total_tokens: 1 });
  });
  it("timeout / http / transport 를 가른다 — errors 에 message·본문이 없다", async () => {
    const body = "모델이 낸 긴 본문";
    for (const [err, code] of [
      [new DeepSeekTimeoutError("report", 45_000), "timeout"],
      [new DeepSeekHttpError(429, body), "http"],
      [new Error(`DeepSeek tool arguments 가 JSON 이 아니다 (report): ${body}`), "transport"],
    ] as const) {
      const { t } = transportOf(async () => { throw err; });
      const r = await generateFlowReportV2(input, t);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe(code);
        expect(JSON.stringify(r.errors)).not.toContain(body);
        expect(JSON.stringify(r.errors)).not.toContain("message");
      }
    }
  });
  it("schema 실패는 이슈 경로만", async () => {
    const bad = makeValidFlowReportFixture(evidence) as unknown as { sections: { closing: unknown } };
    bad.sections.closing = { items: [] };
    const { t } = transportOf(async () => bad);
    const r = await generateFlowReportV2(input, t);
    expect(r).toMatchObject({ ok: false, code: "schema" });
  });
  it("references 실패", async () => {
    const bad = makeValidFlowReportFixture(evidence);
    bad.sections.money.basisRefs = ["nope"];
    const { t } = transportOf(async () => bad);
    expect(await generateFlowReportV2(input, t)).toMatchObject({ ok: false, code: "references", errors: ["/sections/money: nope"] });
  });
});
```

- [ ] **Step 2: 실패 확인**, **Step 3: 구현**

```ts
// src/app/api/flows/_lib/v2/generator.ts
// v2 생성기. 한 시도 = HTTP 요청 한 번(retries 0). 교정 호출은 B.
import {
  createDeepSeekTransport, DeepSeekHttpError, DeepSeekTimeoutError, type DeepSeekTransport,
} from "@/app/api/saju/_lib/deepseek";
import { MODEL } from "@/app/api/saju/_lib/generator";
import type { FlowGenerationInput } from "./input";
import { buildFlowReportUserV2, FLOW_REPORT_SYSTEM_V2, FLOW_REPORT_TOOL_NAME } from "./prompts";
import { validateReferences } from "./references";
import { flowReportToolSchema, flowReportV2Schema, type FlowReportV2 } from "./schema";

export type GenerateFailureCode = "transport" | "timeout" | "http" | "schema" | "references";
export type GenerateResult =
  | { ok: true; report: FlowReportV2; usage: unknown }
  | { ok: false; code: GenerateFailureCode; errors: unknown; usage: unknown };

export interface FlowReportTransport { send: DeepSeekTransport; takeUsage(): unknown }

export const FLOW_REPORT_TIMEOUT_MS = 45_000;

export function createFlowReportTransport(env: Record<string, string | undefined> = process.env): FlowReportTransport {
  const apiKey = env.DEEP_SEEK_API_KEY;
  if (!apiKey) throw new Error("DEEP_SEEK_API_KEY 가 없습니다");
  let last: unknown = null;
  const send = createDeepSeekTransport({
    apiKey, model: MODEL, retries: 0, timeoutMs: FLOW_REPORT_TIMEOUT_MS, onUsage: (_k, u) => { last = u; },
  });
  return { send, takeUsage: () => last };
}

/** 오류에서 남길 것은 이름과 상태코드뿐이다. message 에는 모델 본문이 실릴 수 있다. */
function condense(e: unknown): { code: GenerateFailureCode; errors: { name: string; status?: number } } {
  if (e instanceof DeepSeekTimeoutError) return { code: "timeout", errors: { name: e.name } };
  if (e instanceof DeepSeekHttpError) return { code: "http", errors: { name: e.name, status: e.status } };
  return { code: "transport", errors: { name: e instanceof Error ? e.name : "Error" } };
}

export async function generateFlowReportV2(input: FlowGenerationInput, transport: FlowReportTransport): Promise<GenerateResult> {
  let raw: unknown;
  try {
    raw = await transport.send({
      key: "report", system: FLOW_REPORT_SYSTEM_V2, user: buildFlowReportUserV2(input),
      toolName: FLOW_REPORT_TOOL_NAME, inputSchema: flowReportToolSchema(),
    });
  } catch (e) {
    return { ok: false, ...condense(e), usage: transport.takeUsage() };
  }
  const usage = transport.takeUsage();
  const parsed = flowReportV2Schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, code: "schema", errors: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })), usage };
  }
  const missing = validateReferences(parsed.data, input.evidence);
  if (missing.length > 0) return { ok: false, code: "references", errors: missing, usage };
  return { ok: true, report: parsed.data, usage };
}
```

- [ ] **Step 4: 실행**, `npx tsc --noEmit`
- [ ] **Step 5: 커밋** — `git commit -m "feat(flow): v2 단일 호출 생성기"`

---

### Task 11: 플래그 + `POST /api/flows` 확장

**Files:**
- Create: `src/lib/flows/v2-flag.ts`; Modify: `.env.example`(LLM 블록 아래 한 줄)
- Modify: `src/app/api/flows/_lib/handler.ts`, `handler.test.ts`, `src/app/api/flows/route.ts`

**Interfaces (Produces):** `flowReportV2Enabled(): boolean`; `CreateFlowDeps` 에 `v2Enabled`, `hasAnyFlowSections`, `upsertPendingRevision`, `randomUUID`

- [ ] **Step 1: 플래그**

```ts
// src/lib/flows/v2-flag.ts
/** 한 해의 흐름 v2 의 **새 진입**만 정한다. 발행된 v2 읽기·pending 완료·failed 재시도는 플래그를 안 본다. */
export const flowReportV2Enabled = () => process.env.FLOW_REPORT_V2_ENABLED === "true";
```
`.env.example`: `FLOW_REPORT_V2_ENABLED=      # "true" 면 새 흐름이 v2(지금 상황 입력 + 7섹션 단일 생성)로 만들어진다. 기본 꺼짐`

- [ ] **Step 2: handler 테스트 추가**

```ts
// handler.test.ts 에 추가 (baseDeps 에 v2Enabled:false, hasAnyFlowSections: async()=>false, upsertPendingRevision: async()=>({kind:"created", revision: revFixture}), randomUUID: () => "uuid-1" 를 넣는다)
describe("handleCreateFlow · v2", () => {
  const ctx = { career: "student", relationship: "single", mainConcern: "career" };
  it("플래그 꺼짐 + context → 400 flow_v2_disabled", async () => {
    const out = await handleCreateFlow({ profileId: "11", year: 2026, context: ctx }, deps({ v2Enabled: false }));
    expect(out).toMatchObject({ status: 400, body: { error: "flow_v2_disabled" } });
  });
  it("플래그 켜짐 + context 없음 → unspecified 스냅샷으로 pending", async () => {
    let seen: PendingRevisionInput | undefined;
    await handleCreateFlow({ profileId: "11", year: 2026 }, deps({
      v2Enabled: true, upsertPendingRevision: async (_id, input) => { seen = input; return { kind: "created", revision: revFixture }; },
    }));
    expect(seen?.contextSnapshot).toMatchObject({ career: "unspecified", relationship: "unspecified", mainConcern: "overall", reference: "unspecified" });
    expect(seen?.idempotencyKey).toBe("uuid-1");
  });
  it("플래그 켜짐 + context → 스냅샷·근거·months 가 저장된 행 기준", async () => {
    let seen: PendingRevisionInput | undefined;
    const storedMonths = flowRowFixture.months.map((m) => ({ ...m, pivot: false }));
    await handleCreateFlow({ profileId: "11", year: 2026, context: ctx }, deps({
      v2Enabled: true,
      findOrCreate: async () => ({ row: { ...flowRowFixture, months: storedMonths }, created: false }),
      upsertPendingRevision: async (_id, input) => { seen = input; return { kind: "same", revision: revFixture }; },
    }));
    expect(seen?.contextSnapshot).toMatchObject({ career: "student", reference: "current_baseline" });
    expect(seen?.monthsSnapshot).toEqual(storedMonths);
    expect((seen?.inputSnapshot as { personalContext: { careerSituation: string } }).personalContext.careerSituation).toBe("student");
  });
  it("v1 본문이 있는 flow 는 pending 을 만들지 않는다", async () => {
    let called = false;
    const out = await handleCreateFlow({ profileId: "11", year: 2026, context: ctx }, deps({
      v2Enabled: true, findOrCreate: async () => ({ row: flowRowFixture, created: false }),
      hasAnyFlowSections: async () => true, upsertPendingRevision: async () => { called = true; return { kind: "none" }; },
    }));
    expect(called).toBe(false);
    expect(out.status).toBe(200);
  });
  it("busy → 409", async () => {
    const out = await handleCreateFlow({ profileId: "11", year: 2026, context: ctx }, deps({
      v2Enabled: true, upsertPendingRevision: async () => ({ kind: "busy" }),
    }));
    expect(out).toMatchObject({ status: 409, body: { error: "flow_v2_pending_busy" } });
  });
});
```
`revFixture` 는 `FlowRevisionRow` 모양의 최소 객체(테스트 상단 정의). `now` 가 2026-06-01 이므로 2026 은 present.

- [ ] **Step 3: 구현** — `handler.ts`:

```ts
import { contextAnswerSchema, normalizeFlowContext, yearRelationOf } from "@/lib/flows/context";
import { requestHashOf } from "@/lib/flows/request-hash";
import type { PendingRevisionInput, UpsertResult } from "@/lib/flows/revisions";
import type { FlowRow } from "@/lib/flows/store";
import { buildFlowEvidence, FLOW_CALC_VERSION } from "./v2/facts";
import { buildFlowGenerationInput } from "./v2/input";
import { PROMPT_BUNDLE_VERSION } from "./v2/prompts";

const Input = z.object({ profileId: z.string().min(1), year: z.number().int(), context: contextAnswerSchema.optional() }).strict();

export interface CreateFlowDeps {
  userId: string | null; now: Date;
  v2Enabled: boolean;
  checkAccess(userId: string | null): Promise<FlowAccess>;
  getProfile(userId: string, id: string): Promise<FlowProfile | null>;
  findOrCreate(userId: string, input: CreateFlowInput): Promise<{ row: FlowRow; created: boolean }>;
  hasAnyFlowSections(flowId: string): Promise<boolean>;
  upsertPendingRevision(flowId: string, input: PendingRevisionInput): Promise<UpsertResult>;
  randomUUID(): string;
}
```
본문(기존 검증 뒤):
```ts
  if (!deps.v2Enabled && parsed.data.context) return { status: 400, body: { error: "flow_v2_disabled" } };
  // …기존: analysis, birthYear 검사, period, months = flowMonths(analysis, year)
  const { row, created } = await deps.findOrCreate(userId, { profileId: profile.id, flowYear: year, periodStart: period.start, periodEnd: period.end, months });
  const status = created ? 201 : 200;
  if (!deps.v2Enabled) return { status, body: { id: row.id } };
  // v1 구매본이 있는 flow — 업그레이드는 B
  if (!created && (await deps.hasAnyFlowSections(row.id))) return { status, body: { id: row.id } };

  const relation = yearRelationOf(year, deps.now);
  const snapshot = normalizeFlowContext(parsed.data.context, { relation, now: deps.now });
  // ⚠️ months 는 저장된 row.months — 새로 계산한 months 는 INSERT 에만 쓴다(스펙 §5)
  const evidence = buildFlowEvidence(analysis, year, row.months);
  const input = buildFlowGenerationInput({ flowYear: year, relation, snapshot, evidence, months: row.months });
  const { asOf: _asOf, ...contextForHash } = snapshot; void _asOf;
  const up = await deps.upsertPendingRevision(row.id, {
    promptBundleVersion: PROMPT_BUNDLE_VERSION, idempotencyKey: deps.randomUUID(),
    requestHash: requestHashOf({ flowYear: year, context: contextForHash, evidence, months: row.months, calcVersion: FLOW_CALC_VERSION, promptBundleVersion: PROMPT_BUNDLE_VERSION }),
    contextSnapshot: snapshot, inputSnapshot: input, monthsSnapshot: row.months,
  });
  if (up.kind === "busy") return { status: 409, body: { error: "flow_v2_pending_busy" } };
  return { status, body: { id: row.id } };
```
`route.ts`: `v2Enabled: flowReportV2Enabled(), hasAnyFlowSections, upsertPendingRevision, randomUUID: () => crypto.randomUUID()` 를 deps 에 추가(`import { randomUUID } from "node:crypto"`).

- [ ] **Step 4: 실행** — `npx vitest run src/app/api/flows && npx tsc --noEmit` → PASS
- [ ] **Step 5: 커밋** — `git commit -m "feat(flow): POST /api/flows 가 플래그 뒤에서 v2 pending revision 을 만든다"`

---

### Task 12: 재시도 endpoint `POST /api/flows/[id]/revisions`

**Files:**
- Create: `src/app/api/flows/[id]/revisions/_lib/handler.ts`, `handler.test.ts`, `src/app/api/flows/[id]/revisions/route.ts`

Route Handlers 문서를 먼저 읽는다: `node_modules/next/dist/docs/` 에서 route handler 항목(동적 세그먼트 `params` 가 Promise 인지 확인 — `flow/[id]/page.tsx` 와 같은 방식).

**Interfaces (Produces):** `handleRetryRevision({ userId, flowId, raw }, deps): Promise<{ status; body }>`

- [ ] **Step 1: 테스트**

```ts
// handler.test.ts
import { describe, expect, it } from "vitest";
import { handleRetryRevision, type RetryDeps } from "./handler";

const rev = (phase: string, id = "5") => ({ id, flowId: "7", phase, contextSnapshot: {}, inputSnapshot: {}, monthsSnapshot: [{}], promptBundleVersion: 1, requestHash: "h" }) as never;
const base: RetryDeps = {
  getFlow: async () => ({ id: "7" }) as never,
  getActiveRevision: async () => null, findPendingRevision: async () => null, findLatestRevision: async () => null,
  upsertPendingRevision: async () => ({ kind: "created", revision: rev("draft", "9") }),
  randomUUID: () => "u",
};
const d = (o: Partial<RetryDeps> = {}) => ({ ...base, ...o });
const call = (deps: RetryDeps, raw: unknown = {}) => handleRetryRevision({ userId: "3", flowId: "7", raw }, deps);

describe("handleRetryRevision", () => {
  it("본문은 {} 만", async () => expect((await call(d(), { a: 1 })).status).toBe(400));
  it("남의 flow → 404", async () => expect((await call(d({ getFlow: async () => null }))).status).toBe(404));
  it("active 있으면 409", async () => expect(await call(d({ getActiveRevision: async () => rev("complete") }))).toMatchObject({ status: 409, body: { error: "flow_v2_not_applicable" } }));
  it("pending 있으면 200 그 id", async () => expect(await call(d({ findPendingRevision: async () => rev("draft") }))).toEqual({ status: 200, body: { revisionId: "5" } }));
  it("latest 가 failed 면 스냅샷을 베껴 새 pending 201", async () => {
    let seen: { requestHash: string; idempotencyKey: string } | undefined;
    const out = await call(d({
      findLatestRevision: async () => rev("failed"),
      upsertPendingRevision: async (_f, input) => { seen = input; return { kind: "created", revision: rev("draft", "9") }; },
    }));
    expect(out).toEqual({ status: 201, body: { revisionId: "9" } });
    expect(seen).toMatchObject({ requestHash: "h", idempotencyKey: "u" });
  });
  it("revision 이 없으면(v1) 409", async () => expect((await call(d())).status).toBe(409));
});
```

- [ ] **Step 2: 구현**

```ts
// _lib/handler.ts
import { z } from "zod";
import type { FlowRevisionRow, PendingRevisionInput, UpsertResult } from "@/lib/flows/revisions";
import type { FlowRow } from "@/lib/flows/store";

export interface RetryDeps {
  getFlow(userId: string, id: string): Promise<FlowRow | null>;
  getActiveRevision(flowId: string): Promise<FlowRevisionRow | null>;
  findPendingRevision(flowId: string): Promise<FlowRevisionRow | null>;
  findLatestRevision(flowId: string): Promise<FlowRevisionRow | null>;
  upsertPendingRevision(flowId: string, input: PendingRevisionInput): Promise<UpsertResult>;
  randomUUID(): string;
}
const NA = { status: 409, body: { error: "flow_v2_not_applicable" } };

/** 실패한 v2 시도를 다시 pending 으로. 플래그를 보지 않는다 — 이미 이용권을 낸 사용자의 길이다. */
export async function handleRetryRevision(
  a: { userId: string; flowId: string; raw: unknown }, deps: RetryDeps,
): Promise<{ status: number; body: unknown }> {
  if (!z.object({}).strict().safeParse(a.raw).success) return { status: 400, body: { error: "요청 형식이 올바르지 않습니다" } };
  if (!(await deps.getFlow(a.userId, a.flowId))) return { status: 404, body: { error: "흐름을 찾을 수 없습니다" } };
  if (await deps.getActiveRevision(a.flowId)) return NA;
  const pending = await deps.findPendingRevision(a.flowId);
  if (pending) return { status: 200, body: { revisionId: pending.id } };
  const latest = await deps.findLatestRevision(a.flowId);
  if (!latest || latest.phase !== "failed") return NA;
  const up = await deps.upsertPendingRevision(a.flowId, {
    promptBundleVersion: latest.promptBundleVersion, idempotencyKey: deps.randomUUID(), requestHash: latest.requestHash,
    contextSnapshot: latest.contextSnapshot, inputSnapshot: latest.inputSnapshot, monthsSnapshot: latest.monthsSnapshot,
  });
  if (up.kind === "none" || up.kind === "busy") return NA;
  return { status: up.kind === "created" ? 201 : 200, body: { revisionId: up.revision.id } };
}
```

`route.ts`: `getSession()` 없으면 401 `{ error: "unauthenticated" }`; `params` 를 await 해 `id`; `request.json()` 실패 시 400; deps 는 실제 함수(`getFlow` from `@/lib/flows/store`, 나머지 from `@/lib/flows/revisions`, `randomUUID` from `node:crypto`); try/catch 로 500. `src/app/api/flows/route.ts` 와 같은 모양.

- [ ] **Step 3: 실행**, `npx tsc --noEmit`
- [ ] **Step 4: 커밋** — `git commit -m "feat(flow): 실패한 v2 시도 재시도 endpoint"`

---

### Task 13: `resolve-flow-route.ts`, `run-flow-report-v2.ts`

**Files:**
- Create: `src/app/flow/[id]/_lib/resolve-flow-route.ts`, `.test.ts`, `run-flow-report-v2.ts`, `.test.ts`

**Interfaces (Produces):**
- `FlowRoute`, `resolveFlowRoute({ active, hasV1Sections, pending, latest }): FlowRoute`
- `RunFlowReportV2Deps`, `RunOutcome`, `runFlowReportV2(userId, flowId, pendingId, deps): Promise<RunOutcome>`

- [ ] **Step 1: resolve 테스트 + 구현**

```ts
// resolve-flow-route.test.ts
import { expect, it } from "vitest";
import { resolveFlowRoute } from "./resolve-flow-route";
const r = (phase: string) => ({ phase }) as never;
const base = { active: null, hasV1Sections: false, pending: null, latest: null };
it("active → published (v1 섹션이 있어도)", () => expect(resolveFlowRoute({ ...base, active: r("complete"), hasV1Sections: true })).toBe("v2:published"));
it("v1 섹션 → v1 (pending 이 남아 있어도 legacy 먼저)", () => expect(resolveFlowRoute({ ...base, hasV1Sections: true, pending: r("draft") })).toBe("v1"));
it("pending → generate", () => expect(resolveFlowRoute({ ...base, pending: r("draft"), latest: r("draft") })).toBe("v2:generate"));
it("latest failed → failed", () => expect(resolveFlowRoute({ ...base, latest: r("failed") })).toBe("v2:failed"));
it("아무것도 없으면 v1 — 첫 열람이 v1 섹션을 만든다", () => expect(resolveFlowRoute(base)).toBe("v1"));
```

```ts
// resolve-flow-route.ts
import type { FlowRevisionRow } from "@/lib/flows/revisions";
export type FlowRoute = "v2:published" | "v1" | "v2:generate" | "v2:failed";
/** 플래그는 입력이 아니다 — 플래그를 꺼도 발행본 읽기·pending 완료·failed 재시도는 그대로다(스펙 §10). */
export function resolveFlowRoute(s: {
  active: FlowRevisionRow | null;
  /** flow_sections 행 존재 여부(hasAnyFlowSections). 낡은 버전 행만 남은 v1 도 v1 이다 */
  hasV1Sections: boolean;
  pending: FlowRevisionRow | null;
  latest: FlowRevisionRow | null;
}): FlowRoute {
  if (s.active) return "v2:published";
  if (s.hasV1Sections) return "v1";
  if (s.pending) return "v2:generate";
  if (s.latest?.phase === "failed") return "v2:failed";
  return "v1";
}
```

- [ ] **Step 2: run 테스트**

```ts
// run-flow-report-v2.test.ts
import { describe, expect, it } from "vitest";
import { runFlowReportV2, type RunFlowReportV2Deps } from "./run-flow-report-v2";
import { makeValidFlowReportFixture } from "@/app/api/flows/_lib/v2/__fixtures__/reports";

const rev = (o: Partial<{ id: string; inputSnapshot: unknown }> = {}) => ({ id: "5", flowId: "7", inputSnapshot: { marker: "admitted" }, ...o }) as never;
function deps(o: Partial<RunFlowReportV2Deps> = {}) {
  const log: string[] = [];
  const d: RunFlowReportV2Deps = {
    checkLimit: async () => { log.push("limit"); return true; },
    spend: async () => { log.push("spend"); return { ok: true, kind: "spent", balance: 1 }; },
    admit: async () => { log.push("admit"); return rev(); },
    generate: async (input) => { log.push(`generate:${(input as { marker: string }).marker}`); return { ok: true, report: makeValidFlowReportFixture(), usage: null }; },
    publish: async () => { log.push("publish"); return true; },
    fail: async () => { log.push("fail"); return true; },
    getActive: async () => { log.push("active"); return null; },
    model: "m",
    ...o,
  };
  return { d, log };
}

describe("runFlowReportV2", () => {
  it("한도→권한→admit→모델→발행, 입력은 admit 이 돌려준 행", async () => {
    const { d, log } = deps({ getActive: async () => rev() });
    const out = await runFlowReportV2("3", "7", "5", d);
    expect(out.kind).toBe("published");
    expect(log).toEqual(["limit", "spend", "admit", "generate:admitted", "publish", "active"]);
  });
  it("한도 초과면 그 뒤가 안 불린다", async () => {
    const { d, log } = deps({ checkLimit: async () => false });
    expect((await runFlowReportV2("3", "7", "5", d)).kind).toBe("rate_limited");
    expect(log).toEqual(["limit"]);
  });
  it("잔액 부족이면 모델이 안 불린다", async () => {
    const { d, log } = deps({ spend: async () => ({ ok: false, kind: "insufficient", balance: 0 }) });
    expect((await runFlowReportV2("3", "7", "5", d)).kind).toBe("out_of_tickets");
    expect(log).not.toContain("generate:admitted");
  });
  it("admit null → active 있으면 published, 없으면 failed(gone)", async () => {
    expect((await runFlowReportV2("3", "7", "5", deps({ admit: async () => null, getActive: async () => rev() }).d)).kind).toBe("published");
    expect(await runFlowReportV2("3", "7", "5", deps({ admit: async () => null }).d)).toEqual({ kind: "failed", code: "gone" });
  });
  it("publish false → active 있으면 published, 없으면 failed(gone)", async () => {
    expect((await runFlowReportV2("3", "7", "5", deps({ publish: async () => false, getActive: async () => rev() }).d)).kind).toBe("published");
    expect(await runFlowReportV2("3", "7", "5", deps({ publish: async () => false }).d)).toEqual({ kind: "failed", code: "gone" });
  });
  it("생성 실패 → fail 뒤 active 있으면 published, 없으면 failed(code)", async () => {
    const gen = async () => ({ ok: false as const, code: "schema" as const, errors: [], usage: null });
    expect((await runFlowReportV2("3", "7", "5", deps({ generate: gen, getActive: async () => rev() }).d)).kind).toBe("published");
    const { d, log } = deps({ generate: gen });
    expect(await runFlowReportV2("3", "7", "5", d)).toEqual({ kind: "failed", code: "schema" });
    expect(log).toContain("fail");
  });
});
```

- [ ] **Step 3: run 구현**

```ts
// run-flow-report-v2.ts
import type { FlowRevisionRow } from "@/lib/flows/revisions";
import type { SpendResult } from "@/lib/tickets/spend";
import type { GenerateResult } from "@/app/api/flows/_lib/v2/generator";
import type { FlowGenerationInput } from "@/app/api/flows/_lib/v2/input";

export interface RunFlowReportV2Deps {
  checkLimit(userId: string): Promise<boolean>;
  spend(a: { userId: string; feature: "yearly_flow"; subjectKey: string }): Promise<SpendResult>;
  admit(revisionId: string): Promise<FlowRevisionRow | null>;
  generate(input: FlowGenerationInput): Promise<GenerateResult>;
  publish(revisionId: string, flowId: string, a: { payload: unknown; model: string; usage: unknown }): Promise<boolean>;
  fail(revisionId: string, a: { failureCode: string; validationErrors: unknown; model: string | null; usage: unknown }): Promise<boolean>;
  getActive(flowId: string): Promise<FlowRevisionRow | null>;
  model: string;
}
export type RunOutcome =
  | { kind: "rate_limited" } | { kind: "out_of_tickets" }
  | { kind: "published"; revision: FlowRevisionRow }
  | { kind: "failed"; code: GenerateResult extends { ok: false; code: infer C } ? C | "gone" : never };

/**
 * 한도 → 권한·차감 → admit → 모델 → 발행. v1 의 gateFlowGeneration/chargeFlowGeneration 과
 * 같은 순서·같은 근거다(한도에 걸린 요청이 이용권을 쓰면 안 된다; entitlements_unique 가
 * 재차감을 막아 실패 뒤 재시도가 공짜다). 그 래퍼는 섹션 단위 FlowGenerator 를 감싸서
 * 여기서는 못 쓴다.
 */
export async function runFlowReportV2(userId: string, flowId: string, pendingId: string, deps: RunFlowReportV2Deps): Promise<RunOutcome> {
  if (!(await deps.checkLimit(userId))) return { kind: "rate_limited" };
  const spent = await deps.spend({ userId, feature: "yearly_flow", subjectKey: flowId });
  if (!spent.ok) return { kind: "out_of_tickets" };

  const published = async (): Promise<RunOutcome | null> => {
    const active = await deps.getActive(flowId);
    return active ? { kind: "published", revision: active } : null;
  };

  const admitted = await deps.admit(pendingId);
  if (!admitted) return (await published()) ?? { kind: "failed", code: "gone" };

  const result = await deps.generate(admitted.inputSnapshot as FlowGenerationInput);
  if (result.ok) {
    if (await deps.publish(admitted.id, flowId, { payload: result.report, model: deps.model, usage: result.usage })) {
      return (await published()) ?? { kind: "failed", code: "gone" };
    }
    return (await published()) ?? { kind: "failed", code: "gone" };
  }
  await deps.fail(admitted.id, { failureCode: result.code, validationErrors: result.errors, model: deps.model, usage: result.usage });
  return (await published()) ?? { kind: "failed", code: result.code };
}
```

- [ ] **Step 4: 실행**, `npx tsc --noEmit`
- [ ] **Step 5: 커밋** — `git commit -m "feat(flow): v1/v2 분기와 v2 단일 생성 실행기"`

---

### Task 14: 선택 화면 — `SituationSheet`

**Files:**
- Create: `src/app/flow/_components/SituationSheet.tsx`, `SituationSheet.test.tsx`
- Modify: `src/app/flow/_components/FlowConfirm.tsx`, `src/app/flow/page.tsx`

**Interfaces (Produces):** `SituationSheet(props: { name; option: YearOption; busy; failure; onSubmit(answer: ContextAnswer); onClose })`, `FlowConfirmProps.v2Enabled`

- [ ] **Step 1: 테스트**

```tsx
// SituationSheet.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SituationSheet } from "./SituationSheet";
const option = (tag: "지난" | "올해" | "다가올") => ({ year: 2025, tag, range: "2025.2.3 – 2026.2.4", age: 32, owned: false, flowId: null }) as never;
const render = (tag: "지난" | "올해" | "다가올") =>
  renderToStaticMarkup(<SituationSheet name="동진" option={option(tag)} busy={false} failure={null} onSubmit={() => {}} onClose={() => {}} />);

describe("SituationSheet", () => {
  it("칩 3줄과 안내 줄", () => {
    const html = render("올해");
    for (const t of ["현재 직업", "연애 상태", "가장 궁금한 것", "가사 · 돌봄", "썸", "대인관계", "답변은 이 리포트를 쓰는 데만 쓰이고"]) expect(html).toContain(t);
  });
  it("지난 해 문구", () => {
    expect(render("지난")).toContain("선택한 해가 시작될 무렵의 상황을 알려주세요");
    expect(render("올해")).toContain("지금의 상황을 기준으로 설명을 맞춰요");
  });
  it("처음엔 버튼이 잠겨 있다", () => {
    expect(render("올해")).toMatch(/리포트 만들기<\/button>/);
    expect(render("올해")).toMatch(/<button[^>]*disabled=""[^>]*>리포트 만들기/);
  });
});
```
(`YearOption` 의 실제 필드는 `src/app/flow/_lib/to-confirm.ts:3-19` 를 보고 맞춘다.)

- [ ] **Step 2: 구현** — `SituationSheet.tsx`: 어제 커밋의 `SituationModal`(git show 2c8c169:src/app/flow/_components/FlowConfirm.tsx 의 하단)을 바탕으로:
  - `useState<Career|null>`, `useState<Relationship|null>`, `useState<Concern|null>` 세 개, `ready = isContextComplete({career, relationship, mainConcern}) && !busy`
  - `ChipGroup` 세 번: `CAREER_OPTIONS`, `RELATIONSHIP_OPTIONS`, `CONCERN_OPTIONS` (라벨 "현재 직업" · "연애 상태" · "가장 궁금한 것")
  - 부제: `option.tag === "지난" ? "선택한 해가 시작될 무렵의 상황을 알려주세요. 기억이 정확하지 않아도 괜찮아요." : "지금의 상황을 기준으로 설명을 맞춰요. 그해 내내 같은 상황이라고 보진 않아요."`
  - 안내 줄(`text-[12px] text-slate-400`): "답변은 이 리포트를 쓰는 데만 쓰이고, 리포트와 함께 저장돼요."
  - 제출: `if (isContextComplete(p)) onSubmit(p)`. 버튼 텍스트 `busy ? "준비하는 중…" : "리포트 만들기"`, `disabled={!ready}`.
  - 실패 문구 블록은 어제와 같음. Escape 로 닫기, 오버레이 클릭 닫기.
  - `FlowConfirm.tsx`: prop `v2Enabled: boolean`; state `ctxYear`; `PayModal.onConfirm = v2Enabled ? () => openContext(payYear) : () => void start(payYear.year, undefined)`; `start(year, context?: ContextAnswer)` 는 body 에 `context` 가 있을 때만 싣는다; `<SituationSheet key={`${me.id}-${ctxYear.year}`} …/>`; `toStartOutcome` 에 409 케이스 추가: `{ text: "이미 만들고 있는 리포트가 있어요. 잠시 뒤 결과 화면에서 확인해 주세요." }`(`to-start-outcome.test.ts` 에 한 줄 추가).
  - `flow/page.tsx`: `<FlowConfirm … v2Enabled={flowReportV2Enabled()} />`.

- [ ] **Step 3: 실행** — `npx vitest run src/app/flow && npx tsc --noEmit`
- [ ] **Step 4: 커밋** — `git commit -m "feat(flow): 결제 뒤 지금 상황을 묻는 시트(플래그 뒤)"`

---

### Task 15: 결과 화면 — v2 렌더 + `page.tsx` 분기

**Files:**
- Create: `src/app/flow/[id]/_lib/v2-sections.ts`, `src/app/flow/[id]/_components/FlowHeroV2.tsx`, `FlowBodyV2.tsx`, `FlowBodyV2.test.tsx`, `MonthTimelineV2.tsx`, `FlowErrorV2.tsx`
- Modify: `src/app/flow/[id]/page.tsx`, `src/app/flow/[id]/_components/FlowBody.tsx:145`, `AnalyzingFlow.tsx`(문구 prop)

**Interfaces (Consumes):** `PublicFlowReportV2`, `resolveFlowRoute`, `runFlowReportV2`, `monthLabel`·`monthRange`·`currentMonthIndex`(`_lib/current-month.ts`), `FlowChrome`/`FlowShell`

- [ ] **Step 1: 섹션 메타**

```ts
// v2-sections.ts
export const V2_SECTIONS = [
  { key: "overview", no: "01", title: "총운" },
  { key: "career", no: "02", title: null },          // careerTitle 이 채운다
  { key: "money", no: "03", title: "재물운" },
  { key: "romance", no: "04", title: "연애운" },
  { key: "relationships", no: "05", title: "대인운" },
  { key: "months", no: "06", title: "월별 운세" },
  { key: "closing", no: "07", title: "이 해를 잘 보내는 법" },
] as const;
export const NO_PIVOT_COPY = "큰 전환점으로 따로 표시한 달은 없어요. 달마다 주의할 점은 아래에서 확인하세요.";
export const DISCLAIMER = "사주를 바탕으로 한 해석이에요. 실제 선택은 현재 상황과 확인 가능한 정보를 함께 살펴 결정해 주세요.";
export const REFERENCE_COPY = { current_baseline: "지금 상황을 참고했어요", selected_year_start: "선택한 해 초의 상황을 참고했어요", unspecified: null } as const;
export const CTA = {
  career: (profileId: string) => ({ href: `/consult?profile=${profileId}`, label: "내 상황 더 이야기하기" }),
  romance: () => ({ href: "/match", label: "궁합 보기" }),
  relationships: () => ({ href: "/map", label: "관계 지도 보기" }),
} as const;
export const monthAnchor = (i: number) => `month-${String(i).padStart(2, "0")}`;
```

- [ ] **Step 2: FlowBodyV2 테스트**

```tsx
// FlowBodyV2.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlowBodyV2 } from "./FlowBodyV2";
import { toPublicFlowReportV2 } from "@/app/api/flows/_lib/v2/presentation";
import { makeEvidenceFixture, makeValidFlowReportFixture } from "@/app/api/flows/_lib/v2/__fixtures__/reports";
import { analyze } from "@/lib/saju-core";
import { flowMonths } from "@/app/api/flows/_lib/pivots";

const a = analyze({ year: 1993, month: 4, day: 12, hour: 9, minute: 20, gender: "male", calendar: "solar" });
const months = flowMonths(a, 2027);
const report = toPublicFlowReportV2(makeValidFlowReportFixture(makeEvidenceFixture(2027)), { careerTitle: "학업운", reference: "selected_year_start" });
const html = renderToStaticMarkup(<FlowBodyV2 report={report} months={months} currentIndex={null} profileId="11" />);

describe("FlowBodyV2", () => {
  it("7섹션이 번호 순서로", () => {
    const idx = ["01 · 총운", "02 · 학업운", "03 · 재물운", "04 · 연애운", "05 · 대인운", "06 · 월별 운세", "07 · 이 해를 잘 보내는 법"].map((t) => html.indexOf(t));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((x, y) => x - y)).toEqual(idx);
  });
  it("월 앵커·CTA·정보 기준·면책", () => {
    expect(html).toContain('id="month-01"');
    expect(html).toContain('href="/consult?profile=11"');
    expect(html).toContain('href="/match"');
    expect(html).toContain('href="/map"');
    expect(html).toContain("선택한 해 초의 상황을 참고했어요");
    expect(html).toContain("사주를 바탕으로 한 해석이에요");
  });
  it("변곡점이 없으면 중립 문구", () => {
    const none = months.map((m) => ({ ...m, pivot: false }));
    expect(renderToStaticMarkup(<FlowBodyV2 report={report} months={none} currentIndex={null} profileId="11" />)).toContain("큰 전환점으로 따로 표시한 달은 없어요");
  });
});
```

- [ ] **Step 3: 컴포넌트 구현** — 기존 `FlowBody.tsx` 의 `SectionHeading`/카드 클래스를 그대로 재사용한다(파일을 열어 같은 className 을 쓴다).
  - `FlowHeroV2({ headline, flowYear })`: `FlowHero.tsx` 의 마크업에 headline 만.
  - `FlowBodyV2({ report, months, currentIndex, profileId })`:
    - 01: `report.sections.overview.body`
    - 02~05: `DomainCard` — 제목 `${no} · ${title ?? report.careerTitle}`, headline, 세 블록("기회"·"주의할 점"·"이렇게 해보세요"), `monthLinks.map(l => <a href={`#${monthAnchor(l.monthIndex)}`}>{monthRange(months[l.monthIndex-1])} · {l.note}</a>)`, 아래 `CTA[key]` 가 있으면 링크.
    - 06: `months.some(m => m.pivot) ? null : <p>{NO_PIVOT_COPY}</p>` + `<MonthTimelineV2 items={report.sections.months.items} months={months} currentIndex={currentIndex} />`
    - 07: closing.items 3개
    - 정보 기준: `REFERENCE_COPY[report.reference]` 가 있으면 작은 글씨로
    - 하단 `DISCLAIMER`
  - `MonthTimelineV2`: 기존 `MonthTimeline.tsx` 를 복사해 `content: MonthsContent` → `items` 로 바꾸고 `<article id={monthAnchor(item.monthIndex)}>`, headline/body/action, focusDomain 뱃지(`CONCERN_OPTIONS` 라벨). 기간·현재 강조는 `monthLabel`/`monthRange`/`currentIndex` 그대로.
  - `FlowErrorV2({ flowId })` (client): 문구 "운세를 완성하지 못했어요. 다시 시도해 주세요. 이미 사용한 이용권은 다시 차감되지 않아요." + 버튼 "다시 시도" → `fetch(`/api/flows/${flowId}/revisions`, { method: "POST", body: "{}" })` → 2xx `router.refresh()`; 409 → "이미 완성된 리포트가 있어요" 표시 후 `router.refresh()`; 그 외 "잠시 후 다시 시도해 주세요".
  - `AnalyzingFlow` 에 `message?: string` prop(기본 기존 문구). v2 는 "선택한 해의 운세를 정리하고 있어요."
  - v1 `FlowBody.tsx:145` 의 문구를 `NO_PIVOT_COPY` 로.

- [ ] **Step 4: `page.tsx` 분기**

```tsx
// FlowResultPage 안, getFlow 뒤:
const [active, pending, latest, hasV1] = await Promise.all([
  getActiveRevision(flow.id), findPendingRevision(flow.id), findLatestRevision(flow.id), hasAnyFlowSections(flow.id),
]);
const route = resolveFlowRoute({ active, hasV1Sections: hasV1, pending, latest });
if (route === "v1") { /* 기존 코드 그대로 */ }
else if (route === "v2:published") return shell(<FlowV2Published flow={flow} revision={active!} … />);
else if (route === "v2:failed") return shell(chrome(<FlowErrorV2 flowId={flow.id} />));
else return shell(<Suspense fallback={<AnalyzingFlow message="선택한 해의 운세를 정리하고 있어요." />}><FlowV2Generate … pendingId={pending!.id} /></Suspense>);
```
- `FlowV2Published`: `flowReportV2Schema.safeParse(revision.publishedPayload)` — 실패면 `FlowError`(저장본이 깨진 것). 성공이면 `toPublicFlowReportV2(report, { careerTitle: careerTitle(revision.contextSnapshot.career), reference: revision.contextSnapshot.reference })` → `<FlowHeroV2/>` + `<FlowBodyV2 months={revision.monthsSnapshot} …/>`.
- `FlowV2Generate`(async server component, try 안): `const transport = createFlowReportTransport(); const out = await runFlowReportV2(userId, flow.id, pendingId, { checkLimit: checkFlowLimit, spend: spendTicket, admit: admitRevision, generate: (i) => generateFlowReportV2(i, transport), publish: publishRevision, fail: failRevision, getActive: getActiveRevision, model: MODEL })`. outcome 별: `rate_limited` → `<FlowRateLimited/>`, `out_of_tickets` → `<FlowOutOfTickets flowId/>`, `failed` → `<FlowErrorV2/>`, `published` → `FlowV2Published` 와 같은 렌더. catch → `console.error("[/flow/[id]] v2 생성 실패", e instanceof Error ? e.name : "unknown")` 후 `<FlowError/>`. 로그에 `e` 통째로 찍지 않는다.
- `maxDuration = 60` 유지.

- [ ] **Step 5: 실행** — `npx vitest run src/app/flow && npx tsc --noEmit && npm run lint 2>&1 | grep -A3 "flow/\[id\]\|flow/_components" ` (변경 파일 0 error)
- [ ] **Step 6: 커밋** — `git commit -m "feat(flow): v2 결과 화면과 v1/v2 분기"`

---

### Task 16: 검증·실측

- [ ] **Step 1: 전체** — `npx tsc --noEmit && npx vitest run && npm run build`. 실패가 이번 변경 때문인지 기존 것인지 가른다(기존 lint 오류 419건은 워크트리 사본 등 — 이번 파일만 본다).
- [ ] **Step 2: 마이그레이션 적용 — 사용자에게 먼저 묻는다.** 승인 뒤 `npx tsx scripts/migrate.mts`. 적용된 파일명 4개를 보고에 남긴다.
- [ ] **Step 3: 실측** — `.env.local` 에 `FLOW_REPORT_V2_ENABLED=true`, `preview_start` 로 dev 서버, 프로필 1개·연도 3개(지난/올해/다가올)로 시트 → 생성. 각 건의 `flow_report_revisions` 행에서 `phase`·`failure_code`·`validation_errors`·`usage_summary`, 서버 로그의 소요 ms 를 표로 남긴다. 45초 초과·schema 실패 분포가 B 의 설계 입력이다.
- [ ] **Step 4: 완료 보고** — 스펙 §11 의 수동 항목, 실측 표, 미실행 항목을 명시. 커밋하지 않은 변경이 없어야 한다.

---

## Self-review

- 스펙 §3(context) → Task 2. §4(문서) → Task 9. §5(마이그레이션·revisions·request_hash·findOrCreate) → Task 3·4·5. §6(API 둘) → Task 11·12. §7(v2 모듈) → Task 7·8·9·10. §8(전송·실행) → Task 10·13. §9(UI·분기) → Task 14·15. §10(플래그) → Task 11. §11 테스트 표 → 각 Task 의 테스트. §12 실측 → Task 16.
- 이름 일치 확인: `upsertPendingRevision`/`UpsertResult`/`PendingRevisionInput`(5·11·12), `runFlowReportV2`/`RunFlowReportV2Deps`(13·15), `buildFlowEvidence`/`buildFlowGenerationInput`(7·11), `toPublicFlowReportV2`(8·15), `careerTitle`(2·7·15), `hasAnyFlowSections`(5·11·15), `flowReportV2Enabled`(11·14).
- `revisions.ts` 의 `inputSnapshot: unknown` — lib → app 의존을 피한 선택. 소비처(13·15)가 `as FlowGenerationInput` 로 좁힌다.
