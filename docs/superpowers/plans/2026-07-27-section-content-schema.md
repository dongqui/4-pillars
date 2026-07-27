# 해석 섹션 content 스키마 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `saju_interpretation_sections.content` 의 shape 을 섹션 레지스트리 하나로 정의하고, 거기서 TS 타입 · LLM JSON Schema · 런타임 검증을 파생시킨다.

**Architecture:** `src/app/api/saju/_lib/sections/` 에 zod 스키마 레지스트리를 두고 12개 섹션을 선언한다. 저장·조회·생성·리포트 조립이 모두 이 레지스트리에서 타입과 검증기를 가져온다. 계산값(원국·오행·신강약·대운 기간)은 스키마에 넣지 않고 조립 단계에서 `SajuAnalysis` 로 채운다. 생시에 의존하는 대운·세운 섹션은 별도 테이블(`saju_luck_sections`)로 분리한다.

**Tech Stack:** TypeScript, zod v4, Next.js 16.2.10, Neon HTTP 드라이버, vitest

**Spec:** `docs/superpowers/specs/2026-07-27-section-content-schema-design.md`

## Global Constraints

- **zod 는 `^4` 이어야 한다.** `z.toJSONSchema()` 는 v4에서 추가됐다. v3 로는 이 계획이 성립하지 않는다.
- **주석과 커밋 메시지는 한국어.** 기존 코드 스타일을 따른다. 주석은 "무엇"이 아니라 "왜"를 쓴다.
- **Neon HTTP 드라이버는 호출당 statement 하나만 받는다.** 여러 statement 를 세미콜론으로 이어 쓰지 않는다. 마이그레이션 파일도 파일당 statement 하나다 (`scripts/migrate.mts` 가 파일 전체를 `sql.query()` 한 번에 넘긴다).
- **`scripts/migrate.mts` 는 파일명으로 적용 여부를 추적한다.** 이미 적용된 마이그레이션 파일을 고쳐도 재실행되지 않는다. 스키마를 바꾸려면 새 번호 파일을 만든다.
- **테스트는 `npm test` (vitest run).** 타입 검사는 `npm run typecheck`. 린트는 `npm run lint`.
- **DB 테스트는 `SqlClient` 를 주입한 가짜 클라이언트로 한다.** `store.test.ts` 의 `fakeClient` 패턴을 그대로 쓴다. 실제 DB 에 붙지 않는다.
- **모든 객체 zod 스키마는 `.strict()`.** 중첩된 것도 포함. LLM 이 없는 필드를 지어내면 걸려야 한다.
- **`environment` (07) 섹션은 범위 밖.** UI 재검토 예정이라 레지스트리에 넣지 않는다.

## File Structure

**새로 만드는 것**

| 파일 | 책임 |
| --- | --- |
| `src/app/api/saju/_lib/sections/primitives.ts` | 여러 섹션이 공유하는 잎 스키마 (`TitledText` 등) |
| `src/app/api/saju/_lib/sections/registry.ts` | `SECTIONS` — 섹션 12개의 유일한 정의 |
| `src/app/api/saju/_lib/sections/derive.ts` | 레지스트리 → 타입 · 키 목록 · JSON Schema · 파서 |
| `src/app/api/saju/_lib/store-luck.ts` | `saju_luck_sections` 읽기/쓰기 |
| `migrations/0004_saju_luck_sections.sql` | 생시 의존 섹션 테이블 |
| `src/app/report/_lib/evidence.ts` | `SajuAnalysis` → `ChartEvidence` (계산값 조립) |
| `src/app/report/_lib/to-report-content.ts` | 계산값 + LLM 섹션 → `ReportContent` |

**고치는 것**

| 파일 | 무엇을 |
| --- | --- |
| `src/app/api/saju/_lib/types.ts` | `Interpretation`/`Section`/`SECTION_KEY_SET`/`SECTION_KEYS` 삭제, 생성기 인터페이스 교체 |
| `src/app/api/saju/_lib/generate.ts` | `StubGenerator` 를 섹션 단위로 |
| `src/app/api/saju/_lib/store.ts` | `getCached` 반환 변경, `putSections`, 판별 유니온 |
| `src/app/api/saju/_lib/key.ts` | `luckKey` 추가 |
| `src/app/api/saju/_lib/handler.ts` | 키 집합 기반 조회 + 부분 생성 |
| `src/app/report/_lib/report-content.ts` | 잎 타입을 `primitives` 에서 import, 유료 필드 옵셔널 |
| `src/app/report/_components/ReportView.tsx` | 옵셔널 섹션 가드 |
| `migrations/0003_saju_interpretation_sections.sql` | 주석만 추가 |

---

### Task 1: zod 도입과 공용 잎 스키마

**Files:**
- Modify: `package.json` (dependencies)
- Create: `src/app/api/saju/_lib/sections/primitives.ts`
- Test: `src/app/api/saju/_lib/sections/primitives.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `TitledText`, `LabeledText`, `KeyValue`, `TimelineNote` — 각각 zod 스키마이자 같은 이름의 TS 타입 (값/타입 네임스페이스 이중 선언)

- [ ] **Step 1: zod 설치**

```bash
npm install zod@^4
```

`node -e "console.log(require('zod/package.json').version)"` 로 4.x 인지 확인한다. 3.x 가 깔리면 `z.toJSONSchema` 가 없어 Task 3 이 막힌다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/app/api/saju/_lib/sections/primitives.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { KeyValue, LabeledText, TimelineNote, TitledText } from "./primitives";

describe("primitives", () => {
  it("TitledText 는 title/body 를 요구한다", () => {
    expect(TitledText.safeParse({ title: "제목", body: "본문" }).success).toBe(true);
    expect(TitledText.safeParse({ title: "제목" }).success).toBe(false);
  });

  it("빈 문자열을 거부한다 (LLM 이 필드만 채우고 내용을 비우는 것 방지)", () => {
    expect(TitledText.safeParse({ title: "", body: "본문" }).success).toBe(false);
  });

  it("모르는 필드를 거부한다 (strict)", () => {
    expect(TitledText.safeParse({ title: "제목", body: "본문", extra: 1 }).success).toBe(false);
  });

  it("LabeledText / KeyValue / TimelineNote 도 같은 규칙", () => {
    expect(LabeledText.safeParse({ label: "라벨", body: "본문" }).success).toBe(true);
    expect(KeyValue.safeParse({ label: "라벨", value: "값" }).success).toBe(true);
    expect(TimelineNote.safeParse({ title: "제목", desc: "설명" }).success).toBe(true);
    expect(KeyValue.safeParse({ label: "라벨", body: "본문" }).success).toBe(false);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/api/saju/_lib/sections/primitives.test.ts`
Expected: FAIL — "Failed to resolve import ./primitives"

- [ ] **Step 4: primitives.ts 를 쓴다**

```ts
import { z } from "zod";

// 여러 섹션이 공유하는 잎 스키마. 리포트 화면(report-content.ts)이 이 타입을
// 그대로 import 하므로, LLM 이 받는 구조와 화면이 읽는 타입이 갈라질 수 없다.

/** 제목 + 본문 — 01 성향, 03 강점 */
export const TitledText = z
  .object({ title: z.string().min(1), body: z.string().min(1) })
  .strict();
export type TitledText = z.infer<typeof TitledText>;

/** 라벨 + 본문 — 05 감정, 08 연애, 10 재물 */
export const LabeledText = z
  .object({ label: z.string().min(1), body: z.string().min(1) })
  .strict();
export type LabeledText = z.infer<typeof LabeledText>;

/** 라벨 + 짧은 값 — 06 관계 맺기 */
export const KeyValue = z
  .object({ label: z.string().min(1), value: z.string().min(1) })
  .strict();
export type KeyValue = z.infer<typeof KeyValue>;

/**
 * 제목 + 설명 — 11 세운, 12 대운.
 * 기간(2026년 / 32–41세)은 계산값이라 여기 없다. 조립 단계에서 인덱스로 짝짓는다.
 */
export const TimelineNote = z
  .object({ title: z.string().min(1), desc: z.string().min(1) })
  .strict();
export type TimelineNote = z.infer<typeof TimelineNote>;
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/app/api/saju/_lib/sections/primitives.test.ts`
Expected: PASS (4개)

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json src/app/api/saju/_lib/sections/
git commit -m "feat(saju): zod 도입과 섹션 공용 잎 스키마"
```

---

### Task 2: 섹션 레지스트리 12개

**Files:**
- Create: `src/app/api/saju/_lib/sections/registry.ts`
- Test: `src/app/api/saju/_lib/sections/registry.test.ts`
- Modify: `migrations/0003_saju_interpretation_sections.sql` (주석만)

**Interfaces:**
- Consumes: `TitledText`, `LabeledText`, `KeyValue`, `TimelineNote` (Task 1)
- Produces:
  - `type SectionTier = "free" | "paid"`
  - `type SectionStorage = "chart" | "luck"`
  - `interface SectionSpec { version: number; tier: SectionTier; storage: SectionStorage; schema: z.ZodType; prompt: string }`
  - `const SECTIONS` — 키 12개: `overview` `personality` `outerVsInner` `strengths` `cautions` `emotion` `relating` `love` `compatibility` `wealth` `yearlyLuck` `daeunOutlook`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/saju/_lib/sections/registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SECTIONS, type SectionSpec } from "./registry";

const entries = Object.entries(SECTIONS) as [string, SectionSpec][];

describe("SECTIONS", () => {
  it("섹션 12개", () => {
    expect(entries).toHaveLength(12);
  });

  it("환경(07)은 UI 재검토 중이라 아직 없다", () => {
    expect(SECTIONS).not.toHaveProperty("environment");
  });

  it("모든 섹션이 version >= 1", () => {
    for (const [key, spec] of entries) {
      expect(spec.version, key).toBeGreaterThanOrEqual(1);
    }
  });

  it("모든 섹션이 tier / storage / prompt 를 갖는다", () => {
    for (const [key, spec] of entries) {
      expect(["free", "paid"], key).toContain(spec.tier);
      expect(["chart", "luck"], key).toContain(spec.storage);
      expect(spec.prompt.length, key).toBeGreaterThan(0);
    }
  });

  it("생시에 의존하는 섹션만 storage=luck", () => {
    const luck = entries.filter(([, s]) => s.storage === "luck").map(([k]) => k);
    expect(luck.sort()).toEqual(["daeunOutlook", "yearlyLuck"]);
  });

  it("무료는 5개 (상단 + 01~04)", () => {
    const free = entries.filter(([, s]) => s.tier === "free").map(([k]) => k);
    expect(free.sort()).toEqual(
      ["cautions", "outerVsInner", "overview", "personality", "strengths"],
    );
  });

  it("overview 는 키워드 3~6개를 요구한다", () => {
    const ok = { headline: "h", summary: "s", keywords: ["a", "b", "c"] };
    expect(SECTIONS.overview.schema.safeParse(ok).success).toBe(true);
    expect(SECTIONS.overview.schema.safeParse({ ...ok, keywords: ["a", "b"] }).success).toBe(false);
  });

  it("personality 는 TitledText 배열", () => {
    const item = { title: "t", body: "b" };
    expect(SECTIONS.personality.schema.safeParse([item, item]).success).toBe(true);
    expect(SECTIONS.personality.schema.safeParse([item]).success).toBe(false);
    expect(SECTIONS.personality.schema.safeParse([{ label: "t", body: "b" }]).success).toBe(false);
  });

  it("daeunOutlook 은 rows/summary/emphasis 를 요구한다", () => {
    const rows = [{ title: "t", desc: "d" }];
    expect(SECTIONS.daeunOutlook.schema.safeParse({ rows, summary: "s", emphasis: "e" }).success).toBe(true);
    expect(SECTIONS.daeunOutlook.schema.safeParse({ rows }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/api/saju/_lib/sections/registry.test.ts`
Expected: FAIL — "Failed to resolve import ./registry"

- [ ] **Step 3: registry.ts 를 쓴다**

```ts
import { z } from "zod";
import { KeyValue, LabeledText, TimelineNote, TitledText } from "./primitives";

/** 무료 노출 여부. 어떤 키를 실제로 요청할지는 호출자가 정한다. */
export type SectionTier = "free" | "paid";

/**
 * 저장 테이블. "chart" 는 4기둥+성별(chartKey)로 캐시되고,
 * "luck" 은 정확한 생시에 의존해 luckKey 로 따로 캐시된다.
 */
export type SectionStorage = "chart" | "luck";

export interface SectionSpec {
  /** 이 섹션 스키마의 버전. DB schema_version 컬럼에 기록된다. shape 을 바꾸면 올린다. */
  version: number;
  tier: SectionTier;
  storage: SectionStorage;
  /** content 의 유일한 shape 정의. 타입·LLM 스키마·런타임 검증이 전부 여기서 나온다. */
  schema: z.ZodType;
  /** 이 섹션만 재생성할 때 LLM 에 줄 지시문 */
  prompt: string;
}

const shortList = (min: number, max: number) => z.array(z.string().min(1)).min(min).max(max);

/**
 * 해석 섹션의 유일한 정의. section_key = 이 객체의 키.
 *
 * 계산값(원국·오행·신강약·대운 기간)은 여기 없다. LLM 서술만 담고,
 * 숫자는 조립 단계에서 SajuAnalysis 로 채운다 — LLM 이 숫자를 지어내지 못하게 하려고.
 */
export const SECTIONS = {
  overview: {
    version: 1,
    tier: "free",
    storage: "chart",
    schema: z
      .object({
        headline: z.string().min(1),
        summary: z.string().min(1),
        keywords: shortList(3, 6),
      })
      .strict(),
    prompt:
      "원국 전체를 한 줄 헤드라인과 3~4문장 요약으로 정리하고, 성향을 대표하는 키워드를 3~6개 뽑아라.",
  },

  personality: {
    version: 1,
    tier: "free",
    storage: "chart",
    schema: z.array(TitledText).min(2).max(4),
    prompt:
      "타고난 성향을 서로 겹치지 않는 관점 2~4개로 나눠, 각각 제목과 2~4문장 본문으로 써라. 근거가 되는 십성·오행을 본문에 녹여라.",
  },

  outerVsInner: {
    version: 1,
    tier: "free",
    storage: "chart",
    schema: z
      .object({ outward: z.string().min(1), inner: z.string().min(1) })
      .strict(),
    prompt:
      "남에게 보이는 모습(outward)과 속마음(inner)의 차이를 각각 2~3문장으로 대비시켜 써라.",
  },

  strengths: {
    version: 1,
    tier: "free",
    storage: "chart",
    schema: z.array(TitledText).min(2).max(4),
    prompt: "강점을 2~4개, 각각 제목과 1~2문장 본문으로 써라. 제목은 서술형 문장으로.",
  },

  cautions: {
    version: 1,
    tier: "free",
    storage: "chart",
    schema: z
      .object({ items: shortList(2, 4), tip: z.string().min(1) })
      .strict(),
    prompt:
      "주의할 점을 2~4개 각각 두세 문장으로 쓰고, 이를 보완할 실천 팁(tip)을 한 문단으로 덧붙여라.",
  },

  emotion: {
    version: 1,
    tier: "paid",
    storage: "chart",
    schema: z.array(LabeledText).min(2).max(4),
    prompt:
      "감정 패턴을 2~4개 항목으로 나눠라. label 은 상황(예: 스트레스가 쌓이는 상황), body 는 그 상황에서의 반응을 2~3문장으로.",
  },

  relating: {
    version: 1,
    tier: "paid",
    storage: "chart",
    schema: z.array(KeyValue).min(3).max(6),
    prompt:
      "관계를 맺는 방식을 3~6개 항목으로 정리하라. label 은 관점, value 는 한 문장 이내의 짧은 값.",
  },

  love: {
    version: 1,
    tier: "paid",
    storage: "chart",
    schema: z.array(LabeledText).min(2).max(4),
    prompt: "연애에서의 성향을 2~4개 항목으로. label 은 국면, body 는 2~3문장.",
  },

  compatibility: {
    version: 1,
    tier: "paid",
    storage: "chart",
    schema: z
      .object({ good: shortList(2, 4), clash: shortList(2, 4) })
      .strict(),
    prompt:
      "잘 맞는 상대 유형(good)과 부딪히기 쉬운 유형(clash)을 각각 2~4개, 한 문장씩 써라.",
  },

  wealth: {
    version: 1,
    tier: "paid",
    storage: "chart",
    schema: z
      .object({
        points: z.array(LabeledText).min(2).max(4),
        summary: z.string().min(1),
        emphasis: z.string().min(1),
      })
      .strict(),
    prompt:
      "재물 성향을 points 2~4개(label + 2~3문장 body)로 쓰고, 전체 요약(summary)과 한 줄 강조(emphasis)를 덧붙여라.",
  },

  yearlyLuck: {
    version: 1,
    tier: "paid",
    storage: "luck",
    schema: z.array(TimelineNote).min(1).max(12),
    prompt:
      "주어진 연도 목록과 같은 개수·같은 순서로, 각 해의 제목(title)과 설명(desc)을 써라. 연도 표기는 넣지 마라 — 계산된 값을 따로 붙인다.",
  },

  daeunOutlook: {
    version: 1,
    tier: "paid",
    storage: "luck",
    schema: z
      .object({
        rows: z.array(TimelineNote).min(1).max(12),
        summary: z.string().min(1),
        emphasis: z.string().min(1),
      })
      .strict(),
    prompt:
      "주어진 대운 목록과 같은 개수·같은 순서로 rows 를 쓰고(연령대 표기는 넣지 마라 — 계산된 값을 따로 붙인다), 전체 흐름 요약(summary)과 한 줄 강조(emphasis)를 덧붙여라.",
  },
} as const satisfies Record<string, SectionSpec>;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/app/api/saju/_lib/sections/registry.test.ts`
Expected: PASS (9개)

- [ ] **Step 5: 0003 마이그레이션에 주석을 단다**

`migrations/0003_saju_interpretation_sections.sql` 의 `content` / `schema_version` 줄 위에 주석을 넣는다. 테이블 구조는 건드리지 않는다 (이미 적용된 파일이라 재실행되지 않는다 — 주석은 읽는 사람용).

```sql
CREATE TABLE IF NOT EXISTS saju_interpretation_sections (
  chart_key       text NOT NULL REFERENCES saju_interpretations(chart_key) ON DELETE CASCADE,
  section_key     text NOT NULL,
  -- shape 은 src/app/api/saju/_lib/sections/registry.ts 의 SECTIONS[section_key].schema 가 정의한다.
  -- SQL 에 CHECK 를 걸지 않는 이유: 섹션이 늘 때마다 마이그레이션을 쓰지 않으려고.
  content         jsonb NOT NULL,
  model           text,
  -- SECTIONS[section_key].version. 조회 시 값이 다르면 캐시 미스로 취급해 그 섹션만 재생성한다.
  schema_version  int NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chart_key, section_key)
);
```

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/saju/_lib/sections/registry.ts src/app/api/saju/_lib/sections/registry.test.ts migrations/0003_saju_interpretation_sections.sql
git commit -m "feat(saju): 해석 섹션 레지스트리 12개 정의"
```

---

### Task 3: 레지스트리 파생 — 타입 · 키 목록 · LLM 스키마 · 파서

**Files:**
- Create: `src/app/api/saju/_lib/sections/derive.ts`
- Create: `src/app/api/saju/_lib/sections/index.ts`
- Test: `src/app/api/saju/_lib/sections/derive.test.ts`

**Interfaces:**
- Consumes: `SECTIONS`, `SectionSpec` (Task 2)
- Produces:
  - `type SectionKey = keyof typeof SECTIONS`
  - `type SectionContent<K extends SectionKey>`
  - `type Interpretation = { [K in SectionKey]: SectionContent<K> }`
  - `const SECTION_KEYS: SectionKey[]`, `FREE_SECTION_KEYS`, `PAID_SECTION_KEYS`, `CHART_SECTION_KEYS`, `LUCK_SECTION_KEYS`
  - `function isSectionKey(v: unknown): v is SectionKey`
  - `function sectionVersion(key: SectionKey): number`
  - `function sectionStorage(key: SectionKey): SectionStorage`
  - `function llmInputSchema(key: SectionKey): Record<string, unknown>`
  - `function llmInputSchemaWithRows(key: SectionKey, rows: number): Record<string, unknown>`
  - `function parseSectionContent<K extends SectionKey>(key: K, raw: unknown): SectionContent<K> | null`
  - `index.ts` 가 `primitives` / `registry` / `derive` 를 재수출한다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/saju/_lib/sections/derive.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  CHART_SECTION_KEYS,
  FREE_SECTION_KEYS,
  LUCK_SECTION_KEYS,
  PAID_SECTION_KEYS,
  SECTION_KEYS,
  isSectionKey,
  llmInputSchema,
  llmInputSchemaWithRows,
  parseSectionContent,
  sectionStorage,
  sectionVersion,
} from "./derive";

describe("키 목록", () => {
  it("무료 + 유료가 전체를 정확히 분할한다", () => {
    expect([...FREE_SECTION_KEYS, ...PAID_SECTION_KEYS].sort()).toEqual([...SECTION_KEYS].sort());
    expect(FREE_SECTION_KEYS.some((k) => PAID_SECTION_KEYS.includes(k))).toBe(false);
  });

  it("chart + luck 도 전체를 정확히 분할한다", () => {
    expect([...CHART_SECTION_KEYS, ...LUCK_SECTION_KEYS].sort()).toEqual([...SECTION_KEYS].sort());
    expect(CHART_SECTION_KEYS.some((k) => LUCK_SECTION_KEYS.includes(k))).toBe(false);
  });

  it("isSectionKey 는 모르는 키를 거른다", () => {
    expect(isSectionKey("overview")).toBe(true);
    expect(isSectionKey("environment")).toBe(false);
    expect(isSectionKey(null)).toBe(false);
  });

  it("sectionVersion / sectionStorage", () => {
    expect(sectionVersion("overview")).toBe(1);
    expect(sectionStorage("daeunOutlook")).toBe("luck");
    expect(sectionStorage("overview")).toBe("chart");
  });
});

describe("llmInputSchema", () => {
  it("최상위는 항상 객체 — tool input_schema 로 넘길 수 있어야 한다", () => {
    for (const key of SECTION_KEYS) {
      const s = llmInputSchema(key) as { type: string; required: string[]; additionalProperties: boolean };
      expect(s.type, key).toBe("object");
      expect(s.required, key).toEqual(["content"]);
      expect(s.additionalProperties, key).toBe(false);
    }
  });

  it("배열 섹션도 content 한 겹으로 감싸진다", () => {
    const s = llmInputSchema("personality") as { properties: { content: { type: string } } };
    expect(s.properties.content.type).toBe("array");
  });

  it("객체 섹션은 additionalProperties: false 를 그대로 내린다", () => {
    const s = llmInputSchema("outerVsInner") as {
      properties: { content: { additionalProperties: boolean; required: string[] } };
    };
    expect(s.properties.content.additionalProperties).toBe(false);
    expect(s.properties.content.required.sort()).toEqual(["inner", "outward"]);
  });
});

describe("llmInputSchemaWithRows", () => {
  it("yearlyLuck(배열 섹션)의 개수를 못박는다", () => {
    const s = llmInputSchemaWithRows("yearlyLuck", 6) as {
      properties: { content: { minItems: number; maxItems: number } };
    };
    expect(s.properties.content.minItems).toBe(6);
    expect(s.properties.content.maxItems).toBe(6);
  });

  it("daeunOutlook(객체 섹션)은 rows 의 개수를 못박는다", () => {
    const s = llmInputSchemaWithRows("daeunOutlook", 6) as {
      properties: { content: { properties: { rows: { minItems: number; maxItems: number } } } };
    };
    expect(s.properties.content.properties.rows.minItems).toBe(6);
    expect(s.properties.content.properties.rows.maxItems).toBe(6);
  });

  it("기간이 없는 섹션은 그대로 둔다", () => {
    expect(llmInputSchemaWithRows("overview", 6)).toEqual(llmInputSchema("overview"));
  });

  it("저장·조회 검증 스키마는 개수를 강제하지 않는다 (n 은 chartKey 밖 입력)", () => {
    expect(parseSectionContent("yearlyLuck", [{ title: "t", desc: "d" }])).not.toBeNull();
  });
});

describe("parseSectionContent", () => {
  it("통과하면 값을, 실패하면 null 을 준다", () => {
    expect(parseSectionContent("outerVsInner", { outward: "겉", inner: "속" }))
      .toEqual({ outward: "겉", inner: "속" });
    expect(parseSectionContent("outerVsInner", { outward: "겉" })).toBeNull();
    expect(parseSectionContent("personality", "문자열")).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/api/saju/_lib/sections/derive.test.ts`
Expected: FAIL — "Failed to resolve import ./derive"

- [ ] **Step 3: derive.ts 를 쓴다**

```ts
import { z } from "zod";
import { SECTIONS, type SectionSpec, type SectionStorage } from "./registry";

export type SectionKey = keyof typeof SECTIONS;

/** 섹션 하나의 content 타입. registry 의 zod 스키마에서 바로 나온다. */
export type SectionContent<K extends SectionKey> = z.infer<(typeof SECTIONS)[K]["schema"]>;

/** 전 섹션이 다 있는 완전한 해석. 실제로는 대부분 Partial 로 다룬다. */
export type Interpretation = { [K in SectionKey]: SectionContent<K> };

export const SECTION_KEYS = Object.keys(SECTIONS) as SectionKey[];

const spec = (key: SectionKey): SectionSpec => SECTIONS[key] as SectionSpec;

const keysWhere = (p: (s: SectionSpec) => boolean): SectionKey[] =>
  SECTION_KEYS.filter((k) => p(spec(k)));

export const FREE_SECTION_KEYS = keysWhere((s) => s.tier === "free");
export const PAID_SECTION_KEYS = keysWhere((s) => s.tier === "paid");
export const CHART_SECTION_KEYS = keysWhere((s) => s.storage === "chart");
export const LUCK_SECTION_KEYS = keysWhere((s) => s.storage === "luck");

/** DB에서 읽은 section_key 문자열을 좁힌다 (모르는 키 = 지워진 섹션). */
export function isSectionKey(v: unknown): v is SectionKey {
  return typeof v === "string" && Object.hasOwn(SECTIONS, v);
}

export function sectionVersion(key: SectionKey): number {
  return spec(key).version;
}

export function sectionStorage(key: SectionKey): SectionStorage {
  return spec(key).storage;
}

/**
 * LLM tool 의 input_schema. 최상위가 객체여야 하는데 배열인 섹션이 있어서
 * 전부 { content: ... } 한 겹으로 감싼다. 응답에서 .content 를 벗겨 검증한다.
 */
export function llmInputSchema(key: SectionKey): Record<string, unknown> {
  return {
    type: "object",
    properties: { content: z.toJSONSchema(spec(key).schema) },
    required: ["content"],
    additionalProperties: false,
  };
}

/**
 * 세운·대운은 LLM 서술을 계산된 기간과 인덱스로 짝짓는다. 개수가 어긋나면
 * 조립 단계에서 통째로 버려지므로, 요청할 때만 개수를 못박아 넘긴다.
 *
 * 저장·조회 검증에는 쓰지 않는다 — getCached 는 chartKey 밖 입력인 rows 를 모른다.
 */
export function llmInputSchemaWithRows(
  key: SectionKey,
  rows: number,
): Record<string, unknown> {
  const schema = llmInputSchema(key);
  const content = (schema.properties as { content: Record<string, unknown> }).content;
  // 배열 섹션(yearlyLuck)은 content 자신이, 객체 섹션(daeunOutlook)은 rows 가 대상이다.
  const target =
    content.type === "array"
      ? content
      : (content.properties as Record<string, Record<string, unknown>> | undefined)?.rows;
  if (target) {
    target.minItems = rows;
    target.maxItems = rows;
  }
  return schema;
}

/** 검증 통과하면 content, 아니면 null. 호출자는 null 을 "없는 섹션"으로 다룬다. */
export function parseSectionContent<K extends SectionKey>(
  key: K,
  raw: unknown,
): SectionContent<K> | null {
  const result = spec(key).schema.safeParse(raw);
  return result.success ? (result.data as SectionContent<K>) : null;
}
```

- [ ] **Step 4: index.ts 를 쓴다**

```ts
export * from "./primitives";
export * from "./registry";
export * from "./derive";
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/app/api/saju/_lib/sections/`
Expected: PASS (전부)

`llmInputSchema` 테스트가 `type: "object"` 대신 `$ref` 를 받아 실패하면, zod v4 의 `z.toJSONSchema(schema, { io: "output" })` 로 바꿔 인라인 출력을 강제한다.

- [ ] **Step 6: 타입 검사**

Run: `npm run typecheck`
Expected: 통과 (아직 types.ts 의 옛 `Interpretation` 과 공존 — 이름이 겹치지만 다른 모듈이라 문제없다)

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/saju/_lib/sections/
git commit -m "feat(saju): 섹션 레지스트리에서 타입·LLM 스키마·파서 파생"
```

---

### Task 4: 생성기를 섹션 단위로

**Files:**
- Modify: `src/app/api/saju/_lib/types.ts`
- Modify: `src/app/api/saju/_lib/generate.ts`
- Test: `src/app/api/saju/_lib/generate.test.ts` (덮어씀)

**Interfaces:**
- Consumes: `SectionKey`, `Interpretation`, `SECTION_KEYS`, `parseSectionContent` (Task 3)
- Produces:
  - `interface InterpretationGenerator { readonly model: string; generateSections(analysis: SajuAnalysis, keys: SectionKey[]): Promise<Partial<Interpretation>> }`
  - `class StubGenerator implements InterpretationGenerator`
  - `types.ts` 는 이제 `ErrorResponse` / `SajuResponse` / `InterpretationGenerator` 만 내보내고, `Interpretation` 은 `sections` 에서 재수출

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/saju/_lib/generate.test.ts` 전체를 다음으로 바꾼다:

```ts
import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/saju-core";
import { StubGenerator } from "./generate";
import { SECTION_KEYS, parseSectionContent, type SectionKey } from "./sections";

const analysis = analyze({ year: 1990, month: 5, day: 15, hour: 10, gender: "male" });

describe("StubGenerator", () => {
  it("요청한 키만 채운다", async () => {
    const keys: SectionKey[] = ["overview", "personality"];
    const out = await new StubGenerator().generateSections(analysis, keys);
    expect(Object.keys(out).sort()).toEqual([...keys].sort());
  });

  it("모든 섹션의 출력이 자기 스키마를 통과한다", async () => {
    const out = await new StubGenerator().generateSections(analysis, SECTION_KEYS);
    for (const key of SECTION_KEYS) {
      expect(parseSectionContent(key, out[key]), key).not.toBeNull();
    }
  });

  it("키가 비면 빈 객체", async () => {
    expect(await new StubGenerator().generateSections(analysis, [])).toEqual({});
  });

  it("model 을 노출한다", () => {
    expect(new StubGenerator().model).toBe("stub");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/api/saju/_lib/generate.test.ts`
Expected: FAIL — `generateSections is not a function`

- [ ] **Step 3: types.ts 를 정리한다**

`Interpretation` / `Section` / `SECTION_KEY_SET` / `SectionKey` / `SECTION_KEYS` 선언을 지우고 `sections` 재수출로 바꾼다. 파일 전체:

```ts
import type { SajuAnalysis } from "@/lib/saju-core";
import type { Interpretation, SectionKey } from "./sections";

// 해석의 shape 은 전부 ./sections 레지스트리가 정의한다. 여기서 다시 선언하지 않는다.
export type { Interpretation, SectionKey } from "./sections";

/** API 에러 응답 본문 */
export interface ErrorResponse {
  error: string;
}

/** API 성공 응답 */
export interface SajuResponse {
  /** 요청받은 이름 (해석엔 미반영, echo용) */
  name: string;
  analysis: SajuAnalysis;
  /** 요청한 섹션 중 확보된 것만. 실패·미생성 섹션은 빠진다. */
  interpretation: Partial<Interpretation>;
  /** 요청한 섹션이 전부 캐시에 있었는지 */
  cached: boolean;
}

/**
 * 해석 생성기 (LLM 어댑터). 지금은 stub, 나중에 실제 LLM으로 교체.
 *
 * 섹션 단위로 받는 이유: 한 섹션이 스키마 검증에 실패해도 나머지는 살리고,
 * 캐시에 없는 섹션만 골라 다시 뽑기 위해서다.
 *
 * ⚠️ 캐시 주의: storage="chart" 섹션은 (4기둥 + 성별)로만 캐시된다(chartKey 참조).
 * 따라서 그 섹션들은 원국·성별에서 파생되는 사실만 사용해야 한다.
 * 생시에 의존하는 서술은 storage="luck" 섹션에만 넣는다.
 */
export interface InterpretationGenerator {
  /** 생성 모델 식별자 (DB에 기록) */
  readonly model: string;
  generateSections(
    analysis: SajuAnalysis,
    keys: SectionKey[],
  ): Promise<Partial<Interpretation>>;
}
```

- [ ] **Step 4: StubGenerator 를 다시 쓴다**

`src/app/api/saju/_lib/generate.ts` 전체:

```ts
import type { SajuAnalysis } from "@/lib/saju-core";
import type { Interpretation, SectionKey } from "./sections";
import type { InterpretationGenerator } from "./types";

/**
 * 자리표시자 생성기. 실제 LLM 연동 전까지 파이프라인을 끝까지 동작시키기 위한
 * 결정적 stub. 일간(dayMaster)만으로 고정 문구를 만든다.
 * 실제 LLM 어댑터는 같은 InterpretationGenerator 인터페이스를 구현해 교체한다.
 */
export class StubGenerator implements InterpretationGenerator {
  readonly model = "stub";

  async generateSections(
    analysis: SajuAnalysis,
    keys: SectionKey[],
  ): Promise<Partial<Interpretation>> {
    const dm = analysis.chart.dayMaster;
    const rows = analysis.daeun.periods.map((p, i) => ({
      title: `${p.pillar} 대운 (자리표시자 ${i + 1})`,
      desc: `${p.startAge}세부터의 흐름에 대한 자리표시자 서술입니다.`,
    }));
    // 스키마가 1~12개를 요구한다. 대운이 비는 경우(생시 미입력 등)도 최소 한 줄은 채운다.
    const timeline = rows.length > 0
      ? rows.slice(0, 12)
      : [{ title: "대운 자리표시자", desc: "대운 정보가 없어 자리표시자로 채웁니다." }];

    const all: Interpretation = {
      overview: {
        headline: `일간 ${dm} — 자리표시자 헤드라인`,
        summary: `일간이 ${dm}인 사주입니다. 실제 LLM 연동 전 자리표시자 요약입니다.`,
        keywords: [`${dm} 일간`, "자리표시자", "샘플"],
      },
      personality: [
        { title: `${dm}의 성향 1`, body: "자리표시자 본문입니다." },
        { title: `${dm}의 성향 2`, body: "자리표시자 본문입니다." },
      ],
      outerVsInner: { outward: "겉모습 자리표시자.", inner: "속마음 자리표시자." },
      strengths: [
        { title: `${dm} 일간의 강점 1`, body: "자리표시자 본문입니다." },
        { title: `${dm} 일간의 강점 2`, body: "자리표시자 본문입니다." },
      ],
      cautions: {
        items: [`${dm} 일간의 약점 1 (자리표시자)`, `${dm} 일간의 약점 2 (자리표시자)`],
        tip: "실천 팁 자리표시자입니다.",
      },
      emotion: [
        { label: "스트레스 상황", body: "자리표시자 본문입니다." },
        { label: "회복 방식", body: "자리표시자 본문입니다." },
      ],
      relating: [
        { label: "첫인상", value: "자리표시자" },
        { label: "거리 두기", value: "자리표시자" },
        { label: "갈등 대응", value: "자리표시자" },
      ],
      love: [
        { label: "끌리는 유형", body: "자리표시자 본문입니다." },
        { label: "관계 유지", body: "자리표시자 본문입니다." },
      ],
      compatibility: {
        good: ["잘 맞는 유형 1 (자리표시자)", "잘 맞는 유형 2 (자리표시자)"],
        clash: ["부딪히는 유형 1 (자리표시자)", "부딪히는 유형 2 (자리표시자)"],
      },
      wealth: {
        points: [
          { label: "버는 방식", body: "자리표시자 본문입니다." },
          { label: "쓰는 방식", body: "자리표시자 본문입니다." },
        ],
        summary: "재물 요약 자리표시자입니다.",
        emphasis: "재물 강조 자리표시자입니다.",
      },
      yearlyLuck: timeline,
      daeunOutlook: {
        rows: timeline,
        summary: "대운 흐름 요약 자리표시자입니다.",
        emphasis: "대운 강조 자리표시자입니다.",
      },
    };

    const out: Partial<Interpretation> = {};
    for (const key of keys) out[key] = all[key];
    return out;
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/app/api/saju/_lib/generate.test.ts`
Expected: PASS (4개)

- [ ] **Step 6: 커밋**

이 시점에 `store.ts` / `handler.ts` 가 깨진다 (다음 태스크에서 고친다). `npm run typecheck` 는 아직 실패한다.

```bash
git add src/app/api/saju/_lib/types.ts src/app/api/saju/_lib/generate.ts src/app/api/saju/_lib/generate.test.ts
git commit -m "feat(saju): 생성기를 섹션 단위 인터페이스로 교체"
```

---

### Task 5: store.ts — 섹션 조회를 {have, missing} 으로

**Files:**
- Modify: `src/app/api/saju/_lib/store.ts`
- Test: `src/app/api/saju/_lib/store.test.ts` (`getCached` 부분 교체)

**Interfaces:**
- Consumes: `SectionKey`, `Interpretation`, `isSectionKey`, `parseSectionContent`, `sectionVersion` (Task 3)
- Produces:
  - `interface CachedSections { have: Partial<Interpretation>; missing: SectionKey[] }`
  - `function decodeSections(rows: Record<string, unknown>[], keys: SectionKey[]): CachedSections` — `store-luck.ts` 가 재사용
  - `function getCached(chartKey: string, keys: SectionKey[], client?: SqlClient): Promise<CachedSections>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`store.test.ts` 의 상단 픽스처와 `describe("getCached")` 블록을 다음으로 교체한다 (`putCached`/`putSection` 블록은 Task 6 에서 손댄다 — 지금은 남겨둔다):

```ts
import { describe, it, expect } from "vitest";
import { getCached, decodeSections, type SqlClient } from "./store";
import type { SectionKey } from "./sections";

function fakeClient(rows: Record<string, unknown>[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(rows);
  };
  return { client, calls };
}

const keys: SectionKey[] = ["overview", "outerVsInner"];

const row = (section_key: string, content: unknown, schema_version = 1) => ({
  section_key,
  content,
  schema_version,
});

const overview = { headline: "h", summary: "s", keywords: ["a", "b", "c"] };
const outerVsInner = { outward: "겉", inner: "속" };

describe("getCached", () => {
  it("요청한 섹션이 다 있으면 have 에 담고 missing 은 빈다", async () => {
    const { client } = fakeClient([
      row("overview", overview),
      row("outerVsInner", outerVsInner),
    ]);
    expect(await getCached("k", keys, client)).toEqual({
      have: { overview, outerVsInner },
      missing: [],
    });
  });

  it("없는 섹션은 missing 으로 (일부만 재생성하려고)", async () => {
    const { client } = fakeClient([row("overview", overview)]);
    const res = await getCached("k", keys, client);
    expect(res.have).toEqual({ overview });
    expect(res.missing).toEqual(["outerVsInner"]);
  });

  it("schema_version 이 다르면 없는 것으로 취급한다", async () => {
    const { client } = fakeClient([row("overview", overview, 99)]);
    const res = await getCached("k", ["overview"], client);
    expect(res.have).toEqual({});
    expect(res.missing).toEqual(["overview"]);
  });

  it("스키마 검증에 실패한 행도 없는 것으로 취급한다 (손상된 캐시)", async () => {
    const { client } = fakeClient([row("overview", { headline: "h" })]);
    const res = await getCached("k", ["overview"], client);
    expect(res.missing).toEqual(["overview"]);
  });

  it("요청하지 않은 섹션 행은 무시한다", async () => {
    const { client } = fakeClient([row("overview", overview), row("wealth", {})]);
    const res = await getCached("k", ["overview"], client);
    expect(Object.keys(res.have)).toEqual(["overview"]);
  });

  it("행이 없으면 전부 missing", async () => {
    const { client } = fakeClient([]);
    expect(await getCached("k", keys, client)).toEqual({ have: {}, missing: keys });
  });

  it("섹션 테이블을 chart_key + 키 목록으로 조회한다", async () => {
    const { client, calls } = fakeClient([]);
    await getCached("k", keys, client);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("FROM saju_interpretation_sections");
    expect(calls[0].values).toContain("k");
    expect(calls[0].values).toContainEqual(keys);
  });
});

describe("decodeSections", () => {
  it("행 배열을 have/missing 으로 가른다 (테이블과 무관한 순수 함수)", () => {
    expect(decodeSections([row("overview", overview)], keys)).toEqual({
      have: { overview },
      missing: ["outerVsInner"],
    });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/api/saju/_lib/store.test.ts -t getCached`
Expected: FAIL — `getCached` 가 `Interpretation | null` 을 준다

- [ ] **Step 3: store.ts 의 조회 부분을 다시 쓴다**

파일 상단 import 와 `CacheRecord`/`SectionRecord`/`getCached` 를 다음으로 바꾼다 (`putCached`/`putSection` 은 Task 6 까지 그대로 두되, 컴파일이 깨지므로 이 태스크에서 함께 손본다 — 아래 Step 4).

```ts
import { sql as neonSql } from "@/lib/db";
import type { Gender } from "@/lib/saju-core";
import {
  isSectionKey,
  parseSectionContent,
  sectionVersion,
  type Interpretation,
  type SectionKey,
} from "./sections";
import type { PillarsJson } from "./key";

/** 태그드 템플릿 SQL 클라이언트(주입 가능). 기본은 공유 neon 클라이언트. */
export type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

const sql = neonSql as unknown as SqlClient;

/** 조회 결과. missing 은 재생성 대상이다. */
export interface CachedSections {
  have: Partial<Interpretation>;
  missing: SectionKey[];
}

/**
 * 섹션 행 배열을 have/missing 으로 가른다. 테이블 이름과 무관해서
 * chart 캐시와 luck 캐시가 같이 쓴다.
 *
 * 행을 버리는 두 경우:
 *  - schema_version 불일치: 스키마가 바뀌었으니 옛 값은 못 쓴다
 *  - 파싱 실패: 버전은 맞는데 손상됐다
 * 둘 다 "없는 섹션"으로 만들어 그 섹션만 다시 뽑게 한다.
 */
export function decodeSections(
  rows: Record<string, unknown>[],
  keys: SectionKey[],
): CachedSections {
  const wanted = new Set<string>(keys);
  const have: Partial<Interpretation> = {};

  for (const row of rows) {
    const key = row.section_key;
    if (!isSectionKey(key) || !wanted.has(key)) continue;
    if (row.schema_version !== sectionVersion(key)) continue;
    const content = parseSectionContent(key, row.content);
    if (content === null) continue;
    have[key] = content;
  }

  return { have, missing: keys.filter((k) => !(k in have)) };
}

/**
 * 요청한 섹션들을 캐시에서 읽는다. 전부 있어야 한다고 요구하지 않는 이유:
 * 무료 사용자는 유료 섹션이 아예 없으므로, 전부를 요구하면 영원히 캐시 미스가 난다.
 */
export async function getCached(
  chartKey: string,
  keys: SectionKey[],
  client: SqlClient = sql,
): Promise<CachedSections> {
  if (keys.length === 0) return { have: {}, missing: [] };
  const rows = await client`
    SELECT section_key, content, schema_version
    FROM saju_interpretation_sections
    WHERE chart_key = ${chartKey} AND section_key = ANY(${keys}::text[])
  `;
  return decodeSections(rows, keys);
}
```

- [ ] **Step 4: 쓰기 함수의 타입만 임시로 맞춘다**

`CacheRecord.interpretation` 의 타입이 새 `Interpretation` 을 가리키게만 바꿔 컴파일을 통과시킨다 (본격적인 교체는 Task 6):

```ts
export interface CacheRecord {
  chartKey: string;
  gender: Gender;
  pillars: PillarsJson;
  interpretation: Partial<Interpretation>;
  model: string;
}
```

`SectionRecord` 는 이 태스크에서 건드리지 않는다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/app/api/saju/_lib/store.test.ts -t getCached`
Expected: PASS (7개)

Run: `npx vitest run src/app/api/saju/_lib/store.test.ts -t decodeSections`
Expected: PASS (1개)

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/saju/_lib/store.ts src/app/api/saju/_lib/store.test.ts
git commit -m "feat(saju): 섹션 조회를 have/missing 으로 바꾸고 버전 검사 추가"
```

---

### Task 6: store.ts — 쓰기에 schema_version 과 판별 유니온

**Files:**
- Modify: `src/app/api/saju/_lib/store.ts`
- Test: `src/app/api/saju/_lib/store.test.ts` (`putCached`/`putSection` 블록 교체)

**Interfaces:**
- Consumes: `CachedSections`, `decodeSections` (Task 5), `sectionVersion` (Task 3)
- Produces:
  - `type SectionWrite = { [K in SectionKey]: { sectionKey: K; content: SectionContent<K> } }[SectionKey]`
  - `type SectionRecord = { [K in SectionKey]: { chartKey: string; sectionKey: K; content: SectionContent<K>; model: string } }[SectionKey]`
  - `function toSectionWrites(interpretation: Partial<Interpretation>): SectionWrite[]`
  - `function putSections(chartKey: string, sections: SectionWrite[], model: string, client?: SqlClient): Promise<void>`
  - `function putCached(record: CacheRecord, client?: SqlClient): Promise<void>`
  - `function putSection(record: SectionRecord, client?: SqlClient): Promise<void>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`store.test.ts` 의 `describe("putCached")` 와 `describe("putSection")` 블록을 다음으로 교체한다:

```ts
import { putCached, putSection, putSections, toSectionWrites, type CacheRecord } from "./store";

const record: CacheRecord = {
  chartKey: "경오|신사|정묘|을사|male",
  gender: "male",
  pillars: { year: "경오", month: "신사", day: "정묘", hour: "을사" },
  interpretation: { overview, outerVsInner },
  model: "stub",
};

describe("toSectionWrites", () => {
  it("Partial<Interpretation> 을 쓰기 목록으로 편다", () => {
    expect(toSectionWrites({ overview, outerVsInner })).toEqual([
      { sectionKey: "overview", content: overview },
      { sectionKey: "outerVsInner", content: outerVsInner },
    ]);
  });

  it("undefined 인 섹션은 빠진다", () => {
    expect(toSectionWrites({ overview, wealth: undefined })).toEqual([
      { sectionKey: "overview", content: overview },
    ]);
  });
});

describe("putSections", () => {
  it("UNNEST 로 섹션마다 schema_version 을 함께 넣는다", async () => {
    const { client, calls } = fakeClient([]);
    await putSections("k", toSectionWrites({ overview, outerVsInner }), "stub", client);
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("INSERT INTO saju_interpretation_sections");
    expect(calls[0].sql).toContain("UNNEST");
    expect(calls[0].sql).toContain("ON CONFLICT (chart_key, section_key) DO NOTHING");
    expect(calls[0].values).toContainEqual(["overview", "outerVsInner"]);
    expect(calls[0].values).toContainEqual([1, 1]);
  });

  it("빈 목록이면 쿼리를 보내지 않는다", async () => {
    const { client, calls } = fakeClient([]);
    await putSections("k", [], "stub", client);
    expect(calls).toHaveLength(0);
  });
});

describe("putCached", () => {
  it("부모 행을 ON CONFLICT DO NOTHING으로 넣는다", async () => {
    const { client, calls } = fakeClient([]);
    await putCached(record, client);
    expect(calls[0].sql).toContain("INSERT INTO saju_interpretations");
    expect(calls[0].sql).toContain("ON CONFLICT (chart_key) DO NOTHING");
    expect(calls[0].values).toContain(record.chartKey);
    expect(calls[0].values).toContain("stub");
  });

  it("부모 행을 섹션보다 먼저 넣는다 (FK 순서)", async () => {
    const { client, calls } = fakeClient([]);
    await putCached(record, client);
    expect(calls).toHaveLength(2);
    expect(calls[0].sql).toContain("INSERT INTO saju_interpretations (");
    expect(calls[1].sql).toContain("INSERT INTO saju_interpretation_sections");
  });

  it("해석이 비어도 부모 행은 넣는다", async () => {
    const { client, calls } = fakeClient([]);
    await putCached({ ...record, interpretation: {} }, client);
    expect(calls).toHaveLength(1);
  });
});

describe("putSection", () => {
  it("단일 섹션을 schema_version 과 함께 덮어쓴다 (재생성용)", async () => {
    const { client, calls } = fakeClient([]);
    await putSection(
      { chartKey: record.chartKey, sectionKey: "overview", content: overview, model: "llm-v2" },
      client,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("ON CONFLICT (chart_key, section_key) DO UPDATE");
    expect(calls[0].sql).toContain("schema_version = EXCLUDED.schema_version");
    expect(calls[0].values).toContain("overview");
    expect(calls[0].values).toContain("llm-v2");
    expect(calls[0].values).toContain(JSON.stringify(overview));
    expect(calls[0].values).toContain(1);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/api/saju/_lib/store.test.ts`
Expected: FAIL — `putSections is not a function`

- [ ] **Step 3: 쓰기 함수를 다시 쓴다**

`store.ts` 의 `SectionRecord` / `putCached` / `putSection` 을 다음으로 교체한다. import 에 `SectionContent` 를 추가한다.

```ts
/**
 * 섹션 하나의 쓰기 단위. 매핑 타입으로 만들어 sectionKey 와 content 가 짝지어진다.
 * { sectionKey: "personality", content: { title, body } } 는 컴파일 에러 —
 * personality 는 배열이다.
 */
export type SectionWrite = {
  [K in SectionKey]: { sectionKey: K; content: SectionContent<K> };
}[SectionKey];

export type SectionRecord = {
  [K in SectionKey]: {
    chartKey: string;
    sectionKey: K;
    content: SectionContent<K>;
    model: string;
  };
}[SectionKey];

/** Partial<Interpretation> 을 쓰기 목록으로 편다. 값이 없는 섹션은 건너뛴다. */
export function toSectionWrites(interpretation: Partial<Interpretation>): SectionWrite[] {
  const writes: SectionWrite[] = [];
  for (const [key, content] of Object.entries(interpretation)) {
    if (content === undefined || !isSectionKey(key)) continue;
    writes.push({ sectionKey: key, content } as SectionWrite);
  }
  return writes;
}

/**
 * 섹션들을 한 번에 삽입(선착순, 기존 값 유지).
 * jsonb_each 대신 UNNEST 를 쓰는 이유: 섹션마다 schema_version 이 달라야 한다.
 * content 를 text[] 로 보내고 행마다 jsonb 로 캐스팅한다 (jsonb[] 파라미터는 드라이버가 까다롭다).
 */
export async function putSections(
  chartKey: string,
  sections: SectionWrite[],
  model: string,
  client: SqlClient = sql,
): Promise<void> {
  if (sections.length === 0) return;
  const keys = sections.map((s) => s.sectionKey);
  const contents = sections.map((s) => JSON.stringify(s.content));
  const versions = sections.map((s) => sectionVersion(s.sectionKey));
  await client`
    INSERT INTO saju_interpretation_sections (chart_key, section_key, content, model, schema_version)
    SELECT ${chartKey}, t.k, t.c::jsonb, ${model}, t.v
    FROM UNNEST(${keys}::text[], ${contents}::text[], ${versions}::int[]) AS t(k, c, v)
    ON CONFLICT (chart_key, section_key) DO NOTHING
  `;
}

/**
 * 해석을 멱등 저장(동일 키 동시 삽입은 선착순, 나머지 무시).
 * 부모 행 → 섹션 행 순서로 넣는다(섹션의 FK가 부모를 참조).
 */
export async function putCached(record: CacheRecord, client: SqlClient = sql): Promise<void> {
  await client`
    INSERT INTO saju_interpretations (chart_key, gender, pillars, model)
    VALUES (
      ${record.chartKey},
      ${record.gender},
      ${JSON.stringify(record.pillars)}::jsonb,
      ${record.model}
    )
    ON CONFLICT (chart_key) DO NOTHING
  `;
  await putSections(record.chartKey, toSectionWrites(record.interpretation), record.model, client);
}

/**
 * 섹션 하나를 덮어쓴다. 프롬프트/모델을 바꿔 특정 섹션만 다시 뽑을 때 사용.
 * putCached와 달리 기존 값을 갱신한다.
 */
export async function putSection(
  record: SectionRecord,
  client: SqlClient = sql,
): Promise<void> {
  await client`
    INSERT INTO saju_interpretation_sections (chart_key, section_key, content, model, schema_version)
    VALUES (
      ${record.chartKey},
      ${record.sectionKey},
      ${JSON.stringify(record.content)}::jsonb,
      ${record.model},
      ${sectionVersion(record.sectionKey)}
    )
    ON CONFLICT (chart_key, section_key) DO UPDATE
    SET content = EXCLUDED.content,
        model = EXCLUDED.model,
        schema_version = EXCLUDED.schema_version,
        updated_at = now()
  `;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/app/api/saju/_lib/store.test.ts`
Expected: PASS (전부)

- [ ] **Step 5: 판별 유니온이 실제로 잘못된 짝을 막는지 확인**

`store.test.ts` 맨 아래에 컴파일 타임 확인용 주석 테스트를 넣는다:

```ts
describe("SectionWrite 타입", () => {
  it("잘못된 짝은 컴파일되지 않는다 (@ts-expect-error 가 지워지면 이 테스트가 깨진다)", () => {
    // @ts-expect-error personality 의 content 는 TitledText[] 이지 객체가 아니다
    const bad: SectionWrite = { sectionKey: "personality", content: { title: "t", body: "b" } };
    expect(bad).toBeDefined();
  });
});
```

`store.test.ts` 상단 import 에 `type SectionWrite` 를 추가한다.

Run: `npm run typecheck`
Expected: `@ts-expect-error` 가 실제 에러를 덮으므로 통과. 만약 "Unused '@ts-expect-error' directive" 가 나오면 판별 유니온이 안 걸린 것이니 `SectionWrite` 정의를 고친다.

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/saju/_lib/store.ts src/app/api/saju/_lib/store.test.ts
git commit -m "feat(saju): 섹션 쓰기에 schema_version 기록과 키-값 판별 유니온"
```

---

### Task 7: 생시 의존 섹션의 별도 저장 경로

**Files:**
- Create: `migrations/0004_saju_luck_sections.sql`
- Create: `src/app/api/saju/_lib/store-luck.ts`
- Modify: `src/app/api/saju/_lib/key.ts`
- Test: `src/app/api/saju/_lib/store-luck.test.ts`
- Test: `src/app/api/saju/_lib/key.test.ts` (추가)

**Interfaces:**
- Consumes: `decodeSections`, `SqlClient`, `SectionWrite`, `CachedSections` (Task 5/6), `sectionVersion` (Task 3)
- Produces:
  - `function luckKey(analysis: SajuAnalysis, year: number): string`
  - `function getLuckCached(luckKey: string, keys: SectionKey[], client?: SqlClient): Promise<CachedSections>`
  - `function putLuckSections(luckKey: string, sections: SectionWrite[], model: string, client?: SqlClient): Promise<void>`

- [ ] **Step 1: 마이그레이션을 쓴다**

`migrations/0004_saju_luck_sections.sql`:

```sql
-- 생시에 의존하는 해석 섹션(세운·대운)을 따로 저장한다.
-- saju_interpretation_sections 와 분리한 이유: 그 테이블의 chart_key 는
-- 4기둥+성별로만 만들어져 대운 기산(생시·절입)을 구분하지 못한다.
-- content 의 shape 은 src/app/api/saju/_lib/sections/registry.ts 가 정의한다
-- (storage: "luck" 인 섹션들).
-- FK 를 걸지 않는 이유: 부모 키가 chart_key 인데 luck_key 는 그보다 좁다.
CREATE TABLE IF NOT EXISTS saju_luck_sections (
  luck_key        text NOT NULL,
  section_key     text NOT NULL,
  content         jsonb NOT NULL,
  model           text,
  schema_version  int NOT NULL DEFAULT 1,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (luck_key, section_key)
);
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/app/api/saju/_lib/key.test.ts` 에 다음 블록을 추가한다:

```ts
import { luckKey } from "./key";
import { analyze } from "@/lib/saju-core";

describe("luckKey", () => {
  const base = { year: 1990, month: 5, day: 15, gender: "male" } as const;

  it("chartKey 로 시작한다 (원국이 다르면 키가 다르다)", () => {
    const a = analyze({ ...base, hour: 10 });
    expect(luckKey(a, 2026).startsWith(chartKey(a.chart))).toBe(true);
  });

  it("기준 연도가 다르면 키가 다르다 (세운·현재 대운이 해마다 바뀐다)", () => {
    const a = analyze({ ...base, hour: 10 });
    expect(luckKey(a, 2026)).not.toBe(luckKey(a, 2027));
  });

  it("생시가 달라 대운수가 갈리면 키가 다르다", () => {
    const a = analyze({ ...base, hour: 1 });
    const b = analyze({ ...base, hour: 23 });
    expect(luckKey(a, 2026)).not.toBe(luckKey(b, 2026));
  });
});
```

`src/app/api/saju/_lib/store-luck.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getLuckCached, putLuckSections } from "./store-luck";
import type { SqlClient } from "./store";
import type { SectionKey } from "./sections";

function fakeClient(rows: Record<string, unknown>[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(rows);
  };
  return { client, calls };
}

const keys: SectionKey[] = ["yearlyLuck"];
const yearlyLuck = [{ title: "t", desc: "d" }];

describe("getLuckCached", () => {
  it("saju_luck_sections 를 luck_key 로 조회한다", async () => {
    const { client, calls } = fakeClient([]);
    await getLuckCached("lk", keys, client);
    expect(calls[0].sql).toContain("FROM saju_luck_sections");
    expect(calls[0].sql).toContain("luck_key");
    expect(calls[0].values).toContain("lk");
  });

  it("chart 캐시와 같은 규칙으로 have/missing 을 가른다", async () => {
    const { client } = fakeClient([
      { section_key: "yearlyLuck", content: yearlyLuck, schema_version: 1 },
    ]);
    expect(await getLuckCached("lk", keys, client)).toEqual({
      have: { yearlyLuck },
      missing: [],
    });
  });

  it("schema_version 이 다르면 missing", async () => {
    const { client } = fakeClient([
      { section_key: "yearlyLuck", content: yearlyLuck, schema_version: 99 },
    ]);
    expect((await getLuckCached("lk", keys, client)).missing).toEqual(["yearlyLuck"]);
  });
});

describe("putLuckSections", () => {
  it("UNNEST 로 넣고 기존 값을 갱신한다 (대운은 해마다 다시 뽑힌다)", async () => {
    const { client, calls } = fakeClient([]);
    await putLuckSections("lk", [{ sectionKey: "yearlyLuck", content: yearlyLuck }], "stub", client);
    expect(calls[0].sql).toContain("INSERT INTO saju_luck_sections");
    expect(calls[0].sql).toContain("UNNEST");
    expect(calls[0].sql).toContain("ON CONFLICT (luck_key, section_key) DO UPDATE");
    expect(calls[0].values).toContainEqual(["yearlyLuck"]);
  });

  it("빈 목록이면 쿼리를 보내지 않는다", async () => {
    const { client, calls } = fakeClient([]);
    await putLuckSections("lk", [], "stub", client);
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/api/saju/_lib/store-luck.test.ts src/app/api/saju/_lib/key.test.ts`
Expected: FAIL — "Failed to resolve import ./store-luck", `luckKey is not a function`

- [ ] **Step 4: luckKey 를 추가한다**

`src/app/api/saju/_lib/key.ts` 끝에 붙인다 (`SajuAnalysis` import 추가):

```ts
/**
 * 생시 의존 해석(세운·대운)의 캐시 키.
 * chartKey + 대운 기산값(방향·대운수·기준 절기) + 기준 연도.
 *
 * 연도를 넣는 이유: 세운은 해마다 바뀌고, 대운도 "지금 어디"가 해마다 옮겨간다.
 * chartKey 를 넓히지 않고 따로 두는 이유: 원국 해석 캐시의 적중률을 지키려고.
 */
export function luckKey(analysis: SajuAnalysis, year: number): string {
  const { direction, daeunSu, basisTerm } = analysis.daeun;
  return [chartKey(analysis.chart), direction, daeunSu, basisTerm, year].join("|");
}
```

- [ ] **Step 5: store-luck.ts 를 쓴다**

```ts
import { sql as neonSql } from "@/lib/db";
import { decodeSections, type CachedSections, type SectionWrite, type SqlClient } from "./store";
import { sectionVersion, type SectionKey } from "./sections";

const sql = neonSql as unknown as SqlClient;

/**
 * 생시 의존 섹션 캐시. 테이블과 키 컬럼만 다르고 해석 규칙은 chart 캐시와 같아
 * decodeSections 를 공유한다. 태그드 템플릿에 테이블명을 끼워 넣을 수 없어
 * 쿼리는 따로 쓴다.
 */
export async function getLuckCached(
  luckKey: string,
  keys: SectionKey[],
  client: SqlClient = sql,
): Promise<CachedSections> {
  if (keys.length === 0) return { have: {}, missing: [] };
  const rows = await client`
    SELECT section_key, content, schema_version
    FROM saju_luck_sections
    WHERE luck_key = ${luckKey} AND section_key = ANY(${keys}::text[])
  `;
  return decodeSections(rows, keys);
}

/**
 * chart 쪽 putSections 와 달리 DO UPDATE 다.
 * luck_key 에 연도가 들어가 있어 같은 키로 다시 쓰는 일은 재생성뿐이고,
 * 그때는 새 값이 맞다.
 */
export async function putLuckSections(
  luckKey: string,
  sections: SectionWrite[],
  model: string,
  client: SqlClient = sql,
): Promise<void> {
  if (sections.length === 0) return;
  const keys = sections.map((s) => s.sectionKey);
  const contents = sections.map((s) => JSON.stringify(s.content));
  const versions = sections.map((s) => sectionVersion(s.sectionKey));
  await client`
    INSERT INTO saju_luck_sections (luck_key, section_key, content, model, schema_version)
    SELECT ${luckKey}, t.k, t.c::jsonb, ${model}, t.v
    FROM UNNEST(${keys}::text[], ${contents}::text[], ${versions}::int[]) AS t(k, c, v)
    ON CONFLICT (luck_key, section_key) DO UPDATE
    SET content = EXCLUDED.content,
        model = EXCLUDED.model,
        schema_version = EXCLUDED.schema_version,
        updated_at = now()
  `;
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run src/app/api/saju/_lib/store-luck.test.ts src/app/api/saju/_lib/key.test.ts`
Expected: PASS

- [ ] **Step 7: 커밋**

마이그레이션 적용은 `.env.local` 이 있는 환경에서 `npm run db:migrate` 로 따로 돌린다. 이 커밋은 파일만 추가한다.

```bash
git add migrations/0004_saju_luck_sections.sql src/app/api/saju/_lib/store-luck.ts src/app/api/saju/_lib/store-luck.test.ts src/app/api/saju/_lib/key.ts src/app/api/saju/_lib/key.test.ts
git commit -m "feat(saju): 생시 의존 섹션을 saju_luck_sections 로 분리"
```

---

### Task 8: 핸들러 — 키 집합 조회와 부분 생성

**Files:**
- Modify: `src/app/api/saju/_lib/handler.ts`
- Modify: `src/app/api/saju/route.ts`
- Test: `src/app/api/saju/_lib/handler.test.ts` (덮어씀)
- Test: `src/app/api/saju/route.test.ts` (수정)

**Interfaces:**
- Consumes: `getCached`/`putCached`/`toSectionWrites`/`CachedSections`/`SectionWrite` (Task 5/6), `getLuckCached`/`putLuckSections`/`luckKey` (Task 7), `InterpretationGenerator` (Task 4), `sectionStorage`/`FREE_SECTION_KEYS` (Task 3)
- Produces: `interface HandlerDeps`, `function handleSaju(raw: unknown, deps: HandlerDeps): Promise<HandlerResult>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/saju/_lib/handler.test.ts` 전체를 다음으로 바꾼다:

```ts
import { describe, it, expect, vi } from "vitest";
import { handleSaju, type HandlerDeps } from "./handler";
import { StubGenerator } from "./generate";
import type { SajuResponse } from "./types";

const validBody = {
  name: "홍길동",
  gender: "male",
  calendar: "solar",
  year: 1990,
  month: 5,
  day: 15,
  hour: 10,
};

const overview = { headline: "캐시", summary: "캐시된 요약", keywords: ["a", "b", "c"] };
const yearlyLuck = [{ title: "t", desc: "d" }];

const empty = { have: {}, missing: [] as never[] };

function deps(over: Partial<HandlerDeps> = {}): HandlerDeps {
  return {
    generator: new StubGenerator(),
    getCached: vi.fn().mockResolvedValue({ have: {}, missing: ["overview"] }),
    putCached: vi.fn().mockResolvedValue(undefined),
    getLuckCached: vi.fn().mockResolvedValue(empty),
    putLuckSections: vi.fn().mockResolvedValue(undefined),
    sectionKeys: ["overview"],
    year: 2026,
    ...over,
  };
}

describe("handleSaju", () => {
  it("캐시 HIT: generator/putCached 호출 없이 cached=true", async () => {
    const d = deps({
      getCached: vi.fn().mockResolvedValue({ have: { overview }, missing: [] }),
      generator: { model: "stub", generateSections: vi.fn() },
    });
    const res = await handleSaju(validBody, d);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cached: true, interpretation: { overview } });
    expect(d.generator.generateSections).not.toHaveBeenCalled();
    expect(d.putCached).not.toHaveBeenCalled();
  });

  it("캐시 MISS: 없는 섹션만 생성해 저장하고 cached=false", async () => {
    const d = deps();
    const res = await handleSaju(validBody, d);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ cached: false });
    expect(d.putCached).toHaveBeenCalledOnce();
  });

  it("일부만 캐시에 있으면 나머지만 생성기에 요청한다", async () => {
    const gen = { model: "stub", generateSections: vi.fn().mockResolvedValue({}) };
    const d = deps({
      sectionKeys: ["overview", "personality"],
      getCached: vi.fn().mockResolvedValue({ have: { overview }, missing: ["personality"] }),
      generator: gen,
    });
    await handleSaju(validBody, d);
    expect(gen.generateSections).toHaveBeenCalledWith(expect.anything(), ["personality"]);
  });

  it("캐시에 있던 섹션과 새로 생성한 섹션을 합쳐 응답한다", async () => {
    const d = deps({
      sectionKeys: ["overview", "personality"],
      getCached: vi.fn().mockResolvedValue({ have: { overview }, missing: ["personality"] }),
    });
    const res = await handleSaju(validBody, d);
    const body = res.body as SajuResponse;
    expect(Object.keys(body.interpretation).sort()).toEqual(["overview", "personality"]);
  });

  it("luck 섹션은 luck 저장소로 간다", async () => {
    const d = deps({
      sectionKeys: ["yearlyLuck"],
      getCached: vi.fn().mockResolvedValue(empty),
      getLuckCached: vi.fn().mockResolvedValue({ have: {}, missing: ["yearlyLuck"] }),
    });
    await handleSaju(validBody, d);
    expect(d.putLuckSections).toHaveBeenCalledOnce();
    expect(d.putCached).not.toHaveBeenCalled();
  });

  it("luck 캐시 HIT 도 cached=true 에 반영된다", async () => {
    const d = deps({
      sectionKeys: ["yearlyLuck"],
      getCached: vi.fn().mockResolvedValue(empty),
      getLuckCached: vi.fn().mockResolvedValue({ have: { yearlyLuck }, missing: [] }),
      generator: { model: "stub", generateSections: vi.fn() },
    });
    const res = await handleSaju(validBody, d);
    expect(res.body).toMatchObject({ cached: true, interpretation: { yearlyLuck } });
    expect(d.generator.generateSections).not.toHaveBeenCalled();
  });

  it("생성기가 일부 섹션을 빠뜨려도 나머지로 200 을 준다", async () => {
    const d = deps({
      sectionKeys: ["overview", "personality"],
      getCached: vi.fn().mockResolvedValue({ have: {}, missing: ["overview", "personality"] }),
      generator: {
        model: "stub",
        generateSections: vi.fn().mockResolvedValue({ overview }),
      },
    });
    const res = await handleSaju(validBody, d);
    expect(res.status).toBe(200);
    expect(Object.keys((res.body as SajuResponse).interpretation)).toEqual(["overview"]);
  });

  it("잘못된 입력 → 400", async () => {
    const res = await handleSaju({ ...validBody, gender: "x" }, deps());
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("계산 불가한 날짜 → 422", async () => {
    const res = await handleSaju({ ...validBody, month: 2, day: 31 }, deps());
    expect(res.status).toBe(422);
    expect(res.body).toHaveProperty("error");
  });

  it("생성 자체가 실패하면 → 502, 저장 미호출", async () => {
    const d = deps({
      generator: {
        model: "stub",
        generateSections: vi.fn().mockRejectedValue(new Error("LLM down")),
      },
    });
    const res = await handleSaju(validBody, d);
    expect(res.status).toBe(502);
    expect(d.putCached).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/api/saju/_lib/handler.test.ts`
Expected: FAIL — `deps.getLuckCached is not a function` 등

- [ ] **Step 3: handler.ts 를 다시 쓴다**

```ts
import { analyze } from "@/lib/saju-core";
import { parseRequest, ValidationError } from "./input";
import { chartKey, luckKey, pillarsJson } from "./key";
import { toSectionWrites, type CachedSections, type CacheRecord, type SectionWrite } from "./store";
import { sectionStorage, type Interpretation, type SectionKey } from "./sections";
import type { ErrorResponse, InterpretationGenerator, SajuResponse } from "./types";

export interface HandlerDeps {
  generator: InterpretationGenerator;
  getCached: (chartKey: string, keys: SectionKey[]) => Promise<CachedSections>;
  putCached: (record: CacheRecord) => Promise<void>;
  getLuckCached: (luckKey: string, keys: SectionKey[]) => Promise<CachedSections>;
  putLuckSections: (
    luckKey: string,
    sections: SectionWrite[],
    model: string,
  ) => Promise<void>;
  /** 요청할 섹션. 무료/유료 결정은 호출자 몫이다. */
  sectionKeys: SectionKey[];
  /** 세운·대운의 기준 연도 */
  year: number;
}

export interface HandlerResult {
  status: number;
  body: SajuResponse | ErrorResponse;
}

const splitByStorage = (keys: SectionKey[]) => ({
  chart: keys.filter((k) => sectionStorage(k) === "chart"),
  luck: keys.filter((k) => sectionStorage(k) === "luck"),
});

export async function handleSaju(raw: unknown, deps: HandlerDeps): Promise<HandlerResult> {
  // 1. 입력 검증
  let parsed;
  try {
    parsed = parseRequest(raw);
  } catch (e) {
    if (e instanceof ValidationError) return { status: 400, body: { error: e.message } };
    throw e;
  }

  // 2. 만세력 계산 (결정적)
  let analysis;
  try {
    analysis = analyze(parsed.input);
  } catch (e) {
    console.error("[handleSaju] 원국 계산 실패", e);
    return { status: 422, body: { error: "생년월일시를 확인해 주세요" } };
  }

  // 3. 캐시 조회 — 저장소가 갈리므로 두 곳을 함께 본다 (DB 오류는 상위로 → 500)
  const wanted = splitByStorage(deps.sectionKeys);
  const cKey = chartKey(analysis.chart);
  const lKey = luckKey(analysis, deps.year);
  const [chartCache, luckCache] = await Promise.all([
    deps.getCached(cKey, wanted.chart),
    deps.getLuckCached(lKey, wanted.luck),
  ]);

  const interpretation: Partial<Interpretation> = { ...chartCache.have, ...luckCache.have };
  const missing = [...chartCache.missing, ...luckCache.missing];

  if (missing.length === 0) {
    return {
      status: 200,
      body: { name: parsed.name, analysis, interpretation, cached: true },
    };
  }

  // 4. 없는 섹션만 생성. 생성기가 일부를 빠뜨려도 나머지로 응답한다
  //    (섹션 단위 실패는 다음 요청에서 missing 으로 다시 잡힌다).
  let generated: Partial<Interpretation>;
  try {
    generated = await deps.generator.generateSections(analysis, missing);
  } catch {
    return { status: 502, body: { error: "해석 생성에 실패했습니다" } };
  }
  Object.assign(interpretation, generated);

  // 5. 저장 (멱등) — 생성에 성공한 것만, 저장소별로 나눠서
  const produced = splitByStorage(Object.keys(generated).filter((k): k is SectionKey =>
    missing.includes(k as SectionKey),
  ));
  const chartProduced = Object.fromEntries(
    produced.chart.map((k) => [k, generated[k]]),
  ) as Partial<Interpretation>;

  if (produced.chart.length > 0) {
    await deps.putCached({
      chartKey: cKey,
      gender: analysis.chart.gender,
      pillars: pillarsJson(analysis.chart),
      interpretation: chartProduced,
      model: deps.generator.model,
    });
  }
  if (produced.luck.length > 0) {
    await deps.putLuckSections(
      lKey,
      toSectionWrites(Object.fromEntries(produced.luck.map((k) => [k, generated[k]]))),
      deps.generator.model,
    );
  }

  return {
    status: 200,
    body: { name: parsed.name, analysis, interpretation, cached: false },
  };
}
```

- [ ] **Step 4: route.ts 에서 새 의존성을 주입한다**

`src/app/api/saju/route.ts` 의 `handleSaju` 호출부에 `getLuckCached` / `putLuckSections` / `sectionKeys` / `year` 를 넘긴다. 무료 범위를 기본으로 한다:

import 줄을 다음으로 바꾼다 (`generator` 상수 선언과 POST 본체의 JSON 파싱·500 감싸기는 그대로 둔다):

```ts
import { handleSaju } from "./_lib/handler";
import { StubGenerator } from "./_lib/generate";
import { getCached, putCached } from "./_lib/store";
import { getLuckCached, putLuckSections } from "./_lib/store-luck";
import { FREE_SECTION_KEYS } from "./_lib/sections";
import type { ErrorResponse } from "./_lib/types";
```

`try` 블록 안의 호출부를 바꾼다:

```ts
    const result = await handleSaju(raw, {
      generator,
      getCached,
      putCached,
      getLuckCached,
      putLuckSections,
      // 결제 연동 전까지는 무료 범위만. 유료 키를 언제 넓힐지는 별도 작업이다.
      sectionKeys: FREE_SECTION_KEYS,
      year: new Date().getFullYear(),
    });
```

- [ ] **Step 5: route.test.ts 를 새 모양에 맞춘다**

`store-luck` 도 목으로 막고, 옛 `interpretation.ilgan` 단언을 새 카탈로그로 바꾼다. 파일 상단 목 블록을 다음으로 교체한다:

```ts
const getCached = vi.fn();
const putCached = vi.fn();
const getLuckCached = vi.fn();
const putLuckSections = vi.fn();
vi.mock("./_lib/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./_lib/store")>()),
  getCached: (...a: unknown[]) => getCached(...a),
  putCached: (...a: unknown[]) => putCached(...a),
}));
vi.mock("./_lib/store-luck", () => ({
  getLuckCached: (...a: unknown[]) => getLuckCached(...a),
  putLuckSections: (...a: unknown[]) => putLuckSections(...a),
}));
```

`importOriginal` 로 감싸는 이유: `handler.ts` 가 같은 모듈에서 `toSectionWrites` 를 가져다 쓴다. 목이 그것까지 지우면 핸들러가 죽는다.

`beforeEach` 에 새 목 두 개를 추가한다:

```ts
  beforeEach(() => {
    getCached.mockReset();
    putCached.mockReset();
    getLuckCached.mockReset().mockResolvedValue({ have: {}, missing: [] });
    putLuckSections.mockReset().mockResolvedValue(undefined);
  });
```

`getCached.mockResolvedValue(null)` 을 쓰는 두 테스트("캐시 MISS 시 200 + cached:false", "putCached 실패도 500으로 감싼다")를 `{ have: {}, missing: ["overview"] }` 로 바꾸고, 첫 테스트의 마지막 단언을 새 카탈로그로 바꾼다:

```ts
    expect(json.interpretation.overview.headline).toBeTruthy();
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run src/app/api/saju/`
Expected: PASS

- [ ] **Step 7: 타입 검사와 린트**

Run: `npm run typecheck && npm run lint`
Expected: 통과. 아직 `report` 쪽은 손대지 않아 영향 없다.

- [ ] **Step 8: 커밋**

```bash
git add src/app/api/saju/
git commit -m "feat(saju): 핸들러가 섹션 키 집합으로 조회하고 없는 것만 생성"
```

---

### Task 9: 계산값 → ChartEvidence 조립

**Files:**
- Create: `src/app/report/_lib/evidence.ts`
- Test: `src/app/report/_lib/evidence.test.ts`

**Interfaces:**
- Consumes: `SajuAnalysis` (`@/lib/saju-core`), `ChartEvidence`/`ElementKey`/`PillarColumn`/`EvidenceTag` (`./report-content`)
- Produces:
  - `function toChartEvidence(analysis: SajuAnalysis, year: number): ChartEvidence`
  - `const EVIDENCE_DISCLAIMER: string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/report/_lib/evidence.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/saju-core";
import { toChartEvidence } from "./evidence";

const analysis = analyze({ year: 1990, month: 2, day: 20, hour: 4, minute: 30, gender: "male" });
const evidence = toChartEvidence(analysis, 2026);

describe("toChartEvidence", () => {
  it("시주가 있으면 기둥 4개를 시→년 순으로 낸다", () => {
    expect(evidence.pillars.map((p) => p.slot)).toEqual(["hour", "day", "month", "year"]);
  });

  it("시주가 없으면 기둥 3개", () => {
    const noHour = analyze({ year: 1990, month: 2, day: 20, gender: "male" });
    expect(toChartEvidence(noHour, 2026).pillars.map((p) => p.slot)).toEqual([
      "day",
      "month",
      "year",
    ]);
  });

  it("일주 천간을 일간으로 표시한다", () => {
    const day = evidence.pillars.find((p) => p.slot === "day");
    expect(day?.isDayMaster).toBe(true);
    expect(day?.stem.tenGod).toBe("일간 · 我");
  });

  it("각 칸은 한자·한글·오행을 모두 갖는다", () => {
    for (const col of evidence.pillars) {
      for (const cell of [col.stem, col.branch]) {
        expect(cell.char).toHaveLength(1);
        expect(cell.ko).toHaveLength(1);
        expect(["wood", "fire", "earth", "metal", "water"]).toContain(cell.element);
      }
    }
  });

  it("오행 막대는 5개이고 max 는 최댓값", () => {
    expect(evidence.elements).toHaveLength(5);
    const max = Math.max(...evidence.elements.map((e) => e.count));
    expect(new Set(evidence.elements.map((e) => e.max))).toEqual(new Set([max]));
  });

  it("음양 합은 집계 글자 수와 같다", () => {
    expect(evidence.yinYang.yang + evidence.yinYang.yin).toBe(analysis.elements.total);
  });

  it("신강약은 level 과 반올림 백분율", () => {
    expect(evidence.strength.level).toBe(analysis.strength.level);
    expect(evidence.strength.percent).toBe(Math.round(analysis.strength.ratio * 100));
  });

  it("태그에 용신·희신·신강약이 들어간다", () => {
    const labels = evidence.tags.map((t) => t.label);
    expect(labels.some((l) => l.startsWith("용신"))).toBe(true);
    expect(labels.some((l) => l.startsWith("희신"))).toBe(true);
    expect(labels).toContain(analysis.strength.level);
  });

  it("대운 띠는 한자 간지와 연령 구간을 준다", () => {
    expect(evidence.daeunStrip.length).toBe(analysis.daeun.periods.length);
    expect(evidence.daeunStrip[0].age).toMatch(/^\d+–\d+세$/);
  });

  it("현재 대운은 하나만 now 로 표시된다", () => {
    expect(evidence.daeunStrip.filter((d) => d.now).length).toBeLessThanOrEqual(1);
  });

  it("면책 문구가 붙는다", () => {
    expect(evidence.disclaimer.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/report/_lib/evidence.test.ts`
Expected: FAIL — "Failed to resolve import ./evidence"

- [ ] **Step 3: evidence.ts 를 쓴다**

```ts
// SajuAnalysis(계산값) → 리포트 01 "근거 자세히 보기" 패널.
// LLM 은 여기 관여하지 않는다. 숫자를 지어내지 못하게 하려고 계산값은 전부 여기서 만든다.

import type { SajuAnalysis } from "@/lib/saju-core";
import { STEMS, type Element } from "@/lib/saju-core/data/stems";
import { BRANCHES } from "@/lib/saju-core/data/branches";
import type {
  ChartEvidence,
  ElementCount,
  ElementKey,
  EvidenceTag,
  PillarCell,
  PillarColumn,
} from "./report-content";

export const EVIDENCE_DISCLAIMER =
  "위 요소들은 개별 점수가 아니라 서로의 관계 속에서 종합적으로 해석되며, 이 리포트의 모든 결과는 이 원국 데이터를 근거로 작성되었습니다. 특정 오행이 적다는 것만으로 좋고 나쁨을 단정하지 않습니다.";

const ELEMENT_KEY: Record<Element, ElementKey> = {
  목: "wood",
  화: "fire",
  토: "earth",
  금: "metal",
  수: "water",
};

const ORDER: Element[] = ["목", "화", "토", "금", "수"];

/** 화면은 시→년 순으로 읽는다 (오른쪽이 년주). */
const SLOTS = ["hour", "day", "month", "year"] as const;

export function toChartEvidence(analysis: SajuAnalysis, year: number): ChartEvidence {
  const { chart, elements, tenGods, strength, yongsin, daeun } = analysis;

  // 십성은 (자리, 천간/지지)로 찾는다
  const tenGodAt = (slot: string, kind: "stem" | "branch") =>
    tenGods.cells.find((c) => c.position === slot && c.kind === kind)?.tenGod ?? null;

  const pillars: PillarColumn[] = [];
  for (const slot of SLOTS) {
    const pillar = chart[slot];
    if (!pillar) continue; // 시주 미입력
    const isDayMaster = slot === "day";
    const stem: PillarCell = {
      char: pillar.hanja[0],
      ko: pillar.stem,
      element: ELEMENT_KEY[STEMS[pillar.stem].element],
      tenGod: isDayMaster ? "일간 · 我" : (tenGodAt(slot, "stem") ?? "-"),
    };
    const branch: PillarCell = {
      char: pillar.hanja[1],
      ko: pillar.branch,
      element: ELEMENT_KEY[BRANCHES[pillar.branch].element],
      tenGod: tenGodAt(slot, "branch") ?? "-",
    };
    pillars.push(isDayMaster ? { slot, isDayMaster, stem, branch } : { slot, stem, branch });
  }

  const max = Math.max(...ORDER.map((el) => elements.counts[el]));
  const elementBars: ElementCount[] = ORDER.map((el) => ({
    element: ELEMENT_KEY[el],
    count: elements.counts[el],
    max,
  }));

  // 음양은 원국 8자(천간 + 지지 본기) 기준 — elements.total 과 같은 집계 범위.
  // 지지는 본기 천간의 음양을 따른다 (elements 집계와 같은 규칙).
  let yang = 0;
  let yin = 0;
  for (const slot of SLOTS) {
    const pillar = chart[slot];
    if (!pillar) continue;
    for (const stem of [pillar.stem, BRANCHES[pillar.branch].mainStem]) {
      if (STEMS[stem].yinYang === "양") yang += 1;
      else yin += 1;
    }
  }

  // 태그: 신강약 · 용신 · 희신 · 개수가 많은 십성 상위 3개.
  // 신살(역마·화개 등)은 saju-core 에 계산이 없어 넣지 않는다.
  const topTenGods = Object.entries(tenGods.distribution)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const tags: EvidenceTag[] = [
    { label: strength.level, tone: "accent" },
    { label: `용신 · ${yongsin.yongsin}`, tone: "metal" },
    { label: `희신 · ${yongsin.huisin}`, tone: "fire" },
    ...topTenGods.map(([name, n]): EvidenceTag => ({
      label: n > 1 ? `${name} ×${n}` : name,
      tone: "neutral",
    })),
  ];

  const age = year - chart.solar.year;
  const daeunStrip = daeun.periods.map((p) => ({
    gan: p.pillarHanja,
    age: `${p.startAge}–${p.startAge + 9}세`,
    ...(age >= p.startAge && age < p.startAge + 10 ? { now: true } : {}),
  }));

  return {
    pillars,
    elements: elementBars,
    yinYang: { yang, yin },
    strength: { level: strength.level, percent: Math.round(strength.ratio * 100) },
    tags,
    daeunStrip,
    disclaimer: EVIDENCE_DISCLAIMER,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/app/report/_lib/evidence.test.ts`
Expected: PASS (11개)

`chart[slot]` 인덱싱에서 타입 에러가 나면 `SLOTS` 를 `readonly ("hour"|"day"|"month"|"year")[]` 로 두고 `chart[slot] as Pillar | null` 로 좁힌다.

- [ ] **Step 5: 커밋**

```bash
git add src/app/report/_lib/evidence.ts src/app/report/_lib/evidence.test.ts
git commit -m "feat(report): 계산값에서 근거 패널을 조립"
```

---

### Task 10: 리포트 조립 — 계산값 + LLM 섹션

**Files:**
- Modify: `src/app/report/_lib/report-content.ts`
- Create: `src/app/report/_lib/to-report-content.ts`
- Modify: `src/app/report/_components/ReportView.tsx`
- Test: `src/app/report/_lib/to-report-content.test.ts`

**Interfaces:**
- Consumes: `toChartEvidence` (Task 9), `Interpretation` (Task 3), `TitledText`/`LabeledText`/`KeyValue` (Task 1)
- Produces: `function toReportContent(analysis: SajuAnalysis, interpretation: Partial<Interpretation>, meta: { name: string; birthLine: string }, year: number): ReportContent`

- [ ] **Step 1: report-content.ts 의 잎 타입을 레지스트리에서 가져온다**

`src/app/report/_lib/report-content.ts` 상단의 세 줄을 지우고 재수출로 바꾼다:

```ts
// 잎 타입은 해석 스키마(sections/primitives)가 원본이다. 여기서 다시 선언하면
// LLM 이 받는 구조와 화면이 읽는 타입이 갈라진다.
export type { TitledText, LabeledText, KeyValue } from "@/app/api/saju/_lib/sections";
```

지우는 줄:

```ts
export interface LabeledText { label: string; body: string }
export interface TitledText { title: string; body: string }
export interface KeyValue { label: string; value: string }
```

`TimelineRow` / `DaeunRow` / `AxisRow` 는 계산값이 섞여 있어 그대로 둔다.

- [ ] **Step 2: ReportContent 의 유료·미정 필드를 옵셔널로 만든다**

`ReportContent` 를 다음으로 바꾼다:

```ts
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
  // 아래는 유료 섹션 — 생성되지 않았거나 권한이 없으면 없다.
  emotion?: LabeledText[];          // 05
  relating?: KeyValue[];            // 06
  /** 07 — UI 재검토 중이라 아직 해석 스키마가 없다. 픽스처에서만 채워진다. */
  environment?: { axes: AxisRow[]; summary: string; emphasis: string };
  love?: LabeledText[];             // 08
  compatibility?: { good: string[]; clash: string[] }; // 09
  wealth?: { points: LabeledText[]; summary: string; emphasis: string };  // 10
  yearlyLuck?: TimelineRow[];       // 11
  daeunOutlook?: { rows: DaeunRow[]; summary: string; emphasis: string }; // 12
}
```

무료 섹션(`headline`~`cautionTip`)을 필수로 두는 이유: 이게 없으면 리포트가 성립하지 않는다. `toReportContent` 가 없을 때 빈 값으로 채운다.

- [ ] **Step 3: 실패하는 테스트를 쓴다**

`src/app/report/_lib/to-report-content.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/saju-core";
import type { Interpretation } from "@/app/api/saju/_lib/sections";
import { toReportContent } from "./to-report-content";

const analysis = analyze({ year: 1990, month: 2, day: 20, hour: 4, minute: 30, gender: "male" });
const meta = { name: "홍길동", birthLine: "양력 1990.02.20 04:30" };

const free: Partial<Interpretation> = {
  overview: { headline: "헤드라인", summary: "요약", keywords: ["a", "b", "c"] },
  personality: [{ title: "t", body: "b" }, { title: "t2", body: "b2" }],
  outerVsInner: { outward: "겉", inner: "속" },
  strengths: [{ title: "s", body: "b" }, { title: "s2", body: "b2" }],
  cautions: { items: ["주의1", "주의2"], tip: "팁" },
};

describe("toReportContent", () => {
  it("overview 를 상단 필드로 편다", () => {
    const c = toReportContent(analysis, free, meta, 2026);
    expect(c.headline).toBe("헤드라인");
    expect(c.summary).toBe("요약");
    expect(c.keywords).toEqual(["a", "b", "c"]);
  });

  it("cautions 를 목록과 팁으로 나눈다", () => {
    const c = toReportContent(analysis, free, meta, 2026);
    expect(c.cautions).toEqual(["주의1", "주의2"]);
    expect(c.cautionTip).toBe("팁");
  });

  it("계산값에서 근거 패널을 채운다", () => {
    const c = toReportContent(analysis, free, meta, 2026);
    expect(c.evidence.pillars.length).toBeGreaterThan(0);
    expect(c.evidence.strength.level).toBe(analysis.strength.level);
  });

  it("유료 섹션이 없으면 undefined (화면이 잠금으로 그린다)", () => {
    const c = toReportContent(analysis, free, meta, 2026);
    expect(c.emotion).toBeUndefined();
    expect(c.wealth).toBeUndefined();
    expect(c.daeunOutlook).toBeUndefined();
  });

  it("해석이 아예 비어도 무료 필드는 빈 값으로 성립한다", () => {
    const c = toReportContent(analysis, {}, meta, 2026);
    expect(c.headline).toBe("");
    expect(c.personality).toEqual([]);
    expect(c.evidence.pillars.length).toBeGreaterThan(0);
  });

  it("대운 서술에 계산된 연령 구간을 인덱스로 붙인다", () => {
    const rows = analysis.daeun.periods.map((_, i) => ({ title: `t${i}`, desc: `d${i}` }));
    const c = toReportContent(
      analysis,
      { ...free, daeunOutlook: { rows, summary: "s", emphasis: "e" } },
      meta,
      2026,
    );
    expect(c.daeunOutlook?.rows).toHaveLength(rows.length);
    expect(c.daeunOutlook?.rows[0].range).toMatch(/^\d+–\d+세$/);
    expect(c.daeunOutlook?.rows[0].title).toBe("t0");
  });

  it("대운 서술이 계산 개수보다 많으면 자른다", () => {
    const rows = [...analysis.daeun.periods, ...analysis.daeun.periods]
      .slice(0, 12)
      .map((_, i) => ({ title: `t${i}`, desc: `d${i}` }));
    const c = toReportContent(
      analysis,
      { ...free, daeunOutlook: { rows, summary: "s", emphasis: "e" } },
      meta,
      2026,
    );
    expect(c.daeunOutlook?.rows.length).toBe(analysis.daeun.periods.length);
  });

  it("대운 서술이 계산 개수보다 적으면 섹션을 버린다 (인덱스가 어긋난다)", () => {
    const c = toReportContent(
      analysis,
      { ...free, daeunOutlook: { rows: [{ title: "t", desc: "d" }], summary: "s", emphasis: "e" } },
      meta,
      2026,
    );
    expect(c.daeunOutlook).toBeUndefined();
  });
});
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/report/_lib/to-report-content.test.ts`
Expected: FAIL — "Failed to resolve import ./to-report-content"

- [ ] **Step 5: to-report-content.ts 를 쓴다**

```ts
// 계산값(SajuAnalysis) + LLM 섹션(Interpretation) → 화면 뷰모델(ReportContent).
// 두 출처를 합치는 유일한 자리. 어느 필드가 어디서 왔는지 여기서만 보면 된다.

import type { SajuAnalysis } from "@/lib/saju-core";
import type { Interpretation } from "@/app/api/saju/_lib/sections";
import { toChartEvidence } from "./evidence";
import type { DaeunRow, ReportContent, TimelineRow } from "./report-content";

/**
 * LLM 서술 배열에 계산된 기간을 인덱스로 붙인다.
 * 서술이 더 많으면 자르고, 모자라면 null — 인덱스가 어긋난 채로 붙이면
 * 엉뚱한 연령대에 엉뚱한 설명이 달린다.
 */
function zipTimeline<T>(
  notes: { title: string; desc: string }[] | undefined,
  computed: string[],
  make: (note: { title: string; desc: string }, label: string, index: number) => T,
): T[] | undefined {
  if (!notes || notes.length < computed.length) return undefined;
  return computed.map((label, i) => make(notes[i], label, i));
}

export function toReportContent(
  analysis: SajuAnalysis,
  interpretation: Partial<Interpretation>,
  meta: { name: string; birthLine: string },
  year: number,
): ReportContent {
  const { overview, cautions, daeunOutlook, yearlyLuck, wealth } = interpretation;
  const age = year - analysis.chart.solar.year;

  const daeunLabels = analysis.daeun.periods.map((p) => `${p.startAge}–${p.startAge + 9}세`);
  const daeunRows = zipTimeline<DaeunRow>(
    daeunOutlook?.rows,
    daeunLabels,
    (note, range, i) => {
      const p = analysis.daeun.periods[i];
      const now = age >= p.startAge && age < p.startAge + 10;
      return { range, title: note.title, desc: note.desc, ...(now ? { now: true } : {}) };
    },
  );

  // 세운은 기준 연도부터 서술 개수만큼
  const yearLabels = (yearlyLuck ?? []).map((_, i) => `${year + i}년`);
  const yearlyRows = zipTimeline<TimelineRow>(
    yearlyLuck,
    yearLabels,
    (note, period) => ({ period, title: note.title, desc: note.desc }),
  );

  return {
    meta,
    headline: overview?.headline ?? "",
    summary: overview?.summary ?? "",
    keywords: overview?.keywords ?? [],
    personality: interpretation.personality ?? [],
    evidence: toChartEvidence(analysis, year),
    outerVsInner: interpretation.outerVsInner ?? { outward: "", inner: "" },
    strengths: interpretation.strengths ?? [],
    cautions: cautions?.items ?? [],
    cautionTip: cautions?.tip ?? "",
    emotion: interpretation.emotion,
    relating: interpretation.relating,
    // environment(07)는 아직 해석 스키마가 없다 — UI 재검토 후 레지스트리에 추가한다.
    love: interpretation.love,
    compatibility: interpretation.compatibility,
    wealth,
    yearlyLuck: yearlyRows,
    daeunOutlook: daeunRows && daeunOutlook
      ? { rows: daeunRows, summary: daeunOutlook.summary, emphasis: daeunOutlook.emphasis }
      : undefined,
  };
}
```

- [ ] **Step 6: ReportView 에 옵셔널 가드를 넣는다**

`src/app/report/_components/ReportView.tsx` 의 유료 블록을 섹션마다 존재 확인하도록 바꾼다:

```tsx
        {access.isPaid ? (
          <>
            {content.emotion && <EmotionSection items={content.emotion} />}
            {content.relating && <RelatingSection rows={content.relating} />}
            {content.environment && (
              <EnvironmentSection
                axes={content.environment.axes}
                summary={content.environment.summary}
                emphasis={content.environment.emphasis}
              />
            )}
            {content.love && <LoveSection items={content.love} />}
            {content.compatibility && (
              <CompatibilitySection
                good={content.compatibility.good}
                clash={content.compatibility.clash}
              />
            )}
            {content.wealth && (
              <WealthSection
                points={content.wealth.points}
                summary={content.wealth.summary}
                emphasis={content.wealth.emphasis}
              />
            )}
            {content.yearlyLuck && <YearlyLuckSection rows={content.yearlyLuck} />}
            {content.daeunOutlook && (
              <DaeunSection
                rows={content.daeunOutlook.rows}
                summary={content.daeunOutlook.summary}
                emphasis={content.daeunOutlook.emphasis}
              />
            )}
          </>
        ) : (
          <LockedSections sections={lockedSections} />
        )}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npx vitest run src/app/report/`
Expected: PASS

`report-content.fixture.ts` 는 모든 필드를 채우므로 옵셔널화 후에도 그대로 유효하다.

- [ ] **Step 8: 전체 검증**

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 전부 통과. `npm run build` 는 리포트 페이지가 여전히 렌더되는지 확인한다.

- [ ] **Step 9: 커밋**

```bash
git add src/app/report/
git commit -m "feat(report): 계산값과 해석 섹션을 뷰모델로 조립"
```

---

## 마무리 확인

- [ ] `npm test` — 전체 통과
- [ ] `npm run typecheck` — 통과
- [ ] `npm run lint` — 통과
- [ ] `npm run build` — 통과
- [ ] `.env.local` 이 있는 환경에서 `npm run db:migrate` — `0004_saju_luck_sections.sql` 적용 확인
- [ ] `git log --oneline` — 태스크별 커밋 10개

## 이 계획이 하지 않는 것

- **실제 LLM 어댑터.** `llmInputSchema()` 와 `prompt` 는 준비되지만, Anthropic API 를 부르는 코드는 없다. `StubGenerator` 로 파이프라인을 끝까지 돌린다.
- **`environment` (07) 섹션.** UI 재검토 후 `SECTIONS` 에 항목을 추가한다. 그때 `report-content.ts` 의 `AxisRow` 도 `primitives.ts` 로 옮긴다.
- **섹션 실패 시 재시도.** 실패한 섹션은 저장되지 않고 다음 요청에서 `missing` 으로 다시 잡힌다. 즉시 재시도는 레이턴시·비용 설계가 선행되어야 한다.
- **결제·권한 연동.** `route.ts` 는 `FREE_SECTION_KEYS` 를 고정으로 넘긴다. 유료 키를 언제 넘길지는 별도 작업이다.
- **리포트 페이지를 실제 API 에 연결.** `src/app/report/page.tsx` 는 여전히 `sampleReport` 픽스처를 쓴다. `toReportContent` 는 만들어두되 배선은 별도 작업이다.
