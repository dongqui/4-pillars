# 리포트 섹션 개편 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/report`에서 세운·대운을 걷어내고 그 자리에 행동을 다루는 섹션 3종을 넣는다. 섹션 번호를 단일 출처로 모으고, 관계 지도·궁합 CTA를 각 섹션에 붙인다.

**Architecture:** 해석 섹션은 `src/app/api/saju/_lib/sections/registry.ts`의 `SECTIONS` 객체 하나가 정의한다 — zod 스키마·LLM 프롬프트·tier가 전부 거기서 나오고, 화면 뷰모델(`report/_lib/report-content.ts`)은 그 스키마에서 타입을 import 한다. 이 계획은 그 레지스트리에 `heading`(카테고리·제목)까지 얹어 **선언 순서 = 화면 순서 = 섹션 번호**로 만들고, 축이 고정된 섹션을 위해 `axisSchema` 헬퍼를 추가한다.

**Tech Stack:** Next.js 16 (App Router, React 19 서버 컴포넌트), TypeScript, zod 4, Tailwind 4, vitest, Neon Postgres

## Global Constraints

- **최종 섹션 구성은 13개, 무료 4 / 유료 9.** 무료는 `overview`·`outerVsInner`·`strengths`·`cautions` 넷 그대로.
- **최종 레지스트리 선언 순서(= 번호):** `overview`(01), `outerVsInner`(02), `strengths`(03), `cautions`(04), `emotion`(05), `decisions`(06), `workStyle`(07), `environment`(08), `relating`(09), `love`(10), `compatibility`(11), `wealth`(12), `playbook`(13)
- **프롬프트 문체 규칙은 `prompt/system.ts`가 전역으로 잡는다.** 섹션 프롬프트에서 다시 적지 않는다. 특히: 숫자 금지, 사주 용어 금지(`overview`의 `basis` 필드만 예외), 해요체, 호칭 금지.
- **`example` 문자열에 숫자를 쓰면 안 된다.** `registry.test.ts`의 `톤 예시에 숫자가 없다`가 `/\d/`로 막는다. `example`은 파싱 가능한 JSON이어야 한다.
- **프롬프트 의미를 바꾸면 그 섹션의 `version`을 올린다.** 캐시(`store.ts: decodeSections`)는 `schema_version`이 다를 때만 무효화된다.
- **마이그레이션 파일 하나에 SQL 문장은 하나만.** Neon HTTP 드라이버가 다중 문장을 거부한다.
- 검증 명령: `npm run typecheck`, `npm test`, `npm run lint`

---

## File Structure

**신규**

| 파일 | 책임 |
| --- | --- |
| `migrations/0033_drop_saju_luck_sections.sql` | 죽은 luck 캐시 테이블 제거 |
| `src/app/api/saju/_lib/sections/axes.ts` | 고정 축 정의(`DECISION_AXES`·`WORK_AXES`)와 `axisSchema`/`axisRows` |
| `src/app/api/saju/_lib/sections/axes.test.ts` | 위 헬퍼 테스트 |
| `src/app/report/_lib/cta.ts` | `ctaHref(path, isLoggedIn)` |
| `src/app/report/_lib/cta.test.ts` | 위 테스트 |
| `src/app/report/_components/CtaCard.tsx` | 09·11이 공유하는 어두운 CTA 카드 |
| `src/app/report/_components/DecisionsSection.tsx` | 06 |
| `src/app/report/_components/WorkStyleSection.tsx` | 07 |
| `src/app/report/_components/PlaybookSection.tsx` | 13 |

**삭제**

`src/app/api/saju/_lib/store-luck.ts`, `store-luck.test.ts`, `src/app/report/_components/YearlyLuckSection.tsx`, `src/app/report/_components/DaeunSection.tsx`

**주요 수정**

| 파일 | 무엇이 바뀌나 |
| --- | --- |
| `sections/registry.ts` | luck 섹션 제거, `storage` 필드 제거, `heading` 필드 추가, 순서 재배열, 신규 3섹션 |
| `sections/derive.ts` | luck 파생 제거, `sectionHeading`/`paidSectionHeadings` 추가 |
| `sections/primitives.ts` | `TimelineNote` 제거 |
| `prompt/index.ts`, `prompt/facts.ts` | luck 분기·`luckFacts` 제거 |
| `_lib/key.ts`, `produce.ts`, `handler.ts`, `types.ts`, `prompted.ts`, `generate.ts` | luck 저장 축·`year` 제거 |
| `report/_lib/report-content.ts`, `to-report-content.ts`, `report-content.fixture.ts` | 뷰모델에서 luck 제거, 신규 3섹션 추가 |
| `report/_components/ReportBody.tsx` | 섹션 목록 갱신, `isLoggedIn` 전달 |
| `report/_components/SectionHeading.tsx` | `{ section: SectionKey }` 하나만 받음 |
| `report/_components/NoteCard.tsx` | `TipCard` 추가 |
| `app/_lib/catalog.ts` | 리포트 상품 설명에서 "올해의 흐름" 제거 |

---

## Task 1: 세운·대운 화면 제거

화면과 뷰모델에서 먼저 뗀다. 레지스트리는 아직 두 섹션을 생성하지만 아무도 읽지 않는 상태가 된다 — 이 단계에서 타입 체크와 테스트가 모두 통과해야 Task 2가 안전하다.

**Files:**
- Delete: `src/app/report/_components/YearlyLuckSection.tsx`, `src/app/report/_components/DaeunSection.tsx`
- Modify: `src/app/report/_components/ReportBody.tsx`, `src/app/report/_lib/report-content.ts`, `src/app/report/_lib/to-report-content.ts`, `src/app/report/_lib/report-content.fixture.ts`
- Test: `src/app/report/_lib/to-report-content.test.ts`

**Interfaces:**
- Produces: `ReportContent`에서 `yearlyLuck`·`daeunOutlook` 필드와 `TimelineRow`·`DaeunRow` 타입이 사라진다. `toReportContent(analysis, interpretation, meta, year)` 시그니처는 그대로 — `year`는 `toChartEvidence`가 계속 쓴다.

- [ ] **Step 1: 뷰모델에서 필드와 타입을 뺀다**

`src/app/report/_lib/report-content.ts`에서 아래 두 줄을 삭제한다:

```ts
export interface TimelineRow { period: string; title: string; desc: string }
export interface DaeunRow { range: string; title: string; desc: string; now?: boolean }
```

그리고 `ReportContent` 인터페이스에서 아래 두 줄을 삭제한다:

```ts
  yearlyLuck?: TimelineRow[];       // 11
  daeunOutlook?: { rows: DaeunRow[]; summary: string; emphasis: string }; // 12
```

- [ ] **Step 2: 조립 단계에서 zipTimeline 을 걷어낸다**

`src/app/report/_lib/to-report-content.ts`를 아래로 바꾼다 (파일 전체):

```ts
// 계산값(SajuAnalysis) + LLM 섹션(Interpretation) → 화면 뷰모델(ReportContent).
// 두 출처를 합치는 유일한 자리. 어느 필드가 어디서 왔는지 여기서만 보면 된다.

import type { SajuAnalysis } from "@/lib/saju-core";
import type { Interpretation } from "@/app/api/saju/_lib/sections";
import { toChartEvidence } from "./evidence";
import type { ReportContent } from "./report-content";

export function toReportContent(
  analysis: SajuAnalysis,
  interpretation: Partial<Interpretation>,
  meta: { name: string; birthLine: string },
  /** 근거 패널의 "지금 이 대운" 표시에 쓴다. */
  year: number,
): ReportContent {
  const { overview, cautions, wealth } = interpretation;

  return {
    meta,
    headline: overview?.headline ?? "",
    summary: overview?.summary ?? "",
    // 칩과 카드가 같은 배열에서 나온다 — 두 값이 갈라질 수 없다.
    personality: overview?.traits ?? [],
    evidence: toChartEvidence(analysis, year),
    outerVsInner: interpretation.outerVsInner ?? { outward: "", inner: "" },
    strengths: interpretation.strengths ?? [],
    cautions: cautions?.items ?? [],
    cautionTip: cautions?.tip ?? "",
    emotion: interpretation.emotion,
    relating: interpretation.relating,
    environment: interpretation.environment,
    love: interpretation.love,
    compatibility: interpretation.compatibility,
    wealth,
  };
}
```

- [ ] **Step 3: 픽스처에서 두 섹션과 잠금 목록 항목을 뺀다**

`src/app/report/_lib/report-content.fixture.ts`에서 `yearlyLuck: [...]` 블록 전체와 `daeunOutlook: {...}` 블록 전체를 삭제한다. 이어서 `lockedSections` 배열에서 마지막 두 줄을 삭제한다:

```ts
  { no: "11", category: "올해의 운", title: "지금부터 1년, 나의 운의 흐름" },
  { no: "12", category: "10년 단위 흐름", title: "앞으로 10년의 큰 운 흐름" },
```

`evidence.daeunStrip`은 **그대로 둔다** — 근거 패널은 남는다.

- [ ] **Step 4: ReportBody 에서 두 섹션을 뺀다**

`src/app/report/_components/ReportBody.tsx`에서 아래 import 두 줄을 삭제한다:

```ts
import { YearlyLuckSection } from "./YearlyLuckSection";
import { DaeunSection } from "./DaeunSection";
```

그리고 JSX에서 아래 블록을 삭제한다:

```tsx
          {content.yearlyLuck && <YearlyLuckSection rows={content.yearlyLuck} />}
          {content.daeunOutlook && (
            <DaeunSection
              rows={content.daeunOutlook.rows}
              summary={content.daeunOutlook.summary}
              emphasis={content.daeunOutlook.emphasis}
            />
          )}
```

- [ ] **Step 5: 컴포넌트 파일 두 개를 삭제한다**

```bash
git rm src/app/report/_components/YearlyLuckSection.tsx src/app/report/_components/DaeunSection.tsx
```

- [ ] **Step 6: 죽은 테스트를 지운다**

`src/app/report/_lib/to-report-content.test.ts`에서 아래 테스트를 삭제한다 (이름으로 찾는다):

- `대운 서술에 계산된 연령 구간을 인덱스로 붙인다`
- `대운 서술이 계산 개수보다 많으면 자른다`
- `대운 서술이 계산 개수보다 적으면 섹션을 버린다 (인덱스가 어긋난다)`
- `대운 now 판정 — 세는 나이 경계` describe 블록 전체 (안의 두 테스트 포함)

그리고 `유료 섹션이 없으면 undefined (화면이 잠금으로 그린다)` 테스트 안의 아래 줄을 삭제한다:

```ts
    expect(c.daeunOutlook).toBeUndefined();
```

같은 테스트에 다른 유료 섹션 단언이 남아 있는지 확인하고, 하나도 없으면 아래로 대체한다:

```ts
    expect(c.emotion).toBeUndefined();
    expect(c.wealth).toBeUndefined();
```

> 근거 패널의 `now` 판정은 `src/app/report/_lib/evidence.test.ts`의 `대운 now 판정 — 세는 나이 경계` describe가 경계 세 가지(구간 안쪽·첫 해·마지막 해)를 이미 덮는다. 여기서 지워도 커버리지가 비지 않는다.

- [ ] **Step 7: 검증**

Run: `npm run typecheck`
Expected: 오류 없음

Run: `npx vitest run src/app/report`
Expected: 전부 PASS

- [ ] **Step 8: 커밋**

```bash
git add -A src/app/report
git commit -m "refactor(report): 세운·대운 섹션을 화면에서 걷어낸다"
```

---

## Task 2: luck 저장 축 제거

이제 아무도 읽지 않는 두 섹션의 **생성·저장 경로**를 통째로 없앤다. 저장소 판별자(`storage`)가 사라지므로 `produceSections`가 단일 캐시만 보게 된다.

**Files:**
- Create: `migrations/0033_drop_saju_luck_sections.sql`
- Delete: `src/app/api/saju/_lib/store-luck.ts`, `src/app/api/saju/_lib/store-luck.test.ts`
- Modify: `src/app/api/saju/_lib/sections/registry.ts`, `sections/derive.ts`, `sections/primitives.ts`, `_lib/prompt/index.ts`, `_lib/prompt/facts.ts`, `_lib/key.ts`, `_lib/produce.ts`, `_lib/handler.ts`, `_lib/types.ts`, `_lib/prompted.ts`, `_lib/generate.ts`, `src/app/api/saju/route.ts`, `src/app/report/page.tsx`, `src/app/report/_lib/gated-generator.ts`, `migrations/README.md`
- Test: `sections/registry.test.ts`, `sections/derive.test.ts`, `_lib/prompt/index.test.ts`, `_lib/prompt/facts.test.ts`, `_lib/key.test.ts`, `_lib/produce.test.ts`, `_lib/handler.test.ts`, `src/app/api/saju/route.test.ts`

**Interfaces:**
- Produces:
  - `ProduceDeps`가 `{ generator, getCached, putCached, sectionKeys }` 넷으로 줄어든다 (`getLuckCached`·`putLuckSections`·`year` 삭제).
  - `InterpretationGenerator.generateSections(analysis: SajuAnalysis, keys: SectionKey[]): Promise<Partial<Interpretation>>` — 세 번째 인자 `ctx` 삭제, `GenerationContext` 타입 삭제.
  - `buildSectionRequest(analysis: SajuAnalysis, key: SectionKey): SectionRequest` — 세 번째 인자 `ctx` 삭제, `PromptContext` 타입 삭제.
  - `SectionSpec`에서 `storage` 필드와 `SectionStorage` 타입 삭제.
  - `derive.ts`에서 `LUCK_SECTION_KEYS`·`CHART_SECTION_KEYS`·`sectionStorage`·`llmInputSchemaWithRows` 삭제.

- [ ] **Step 1: 마이그레이션을 쓴다**

Create `migrations/0033_drop_saju_luck_sections.sql`:

```sql
-- 세운·대운 해석을 리포트에서 걷어내면서 이 캐시(0004)는 읽는 곳이 없어졌다.
--
-- 운세를 다시 하더라도 리포트 섹션이 아니라 별도 서비스가 되고, 그쪽은 궁합
-- (match_sections)처럼 자기 레지스트리와 자기 키 설계를 갖는다. luck_key 는
-- "리포트 한 섹션을 원국+대운기산+기준연도로 캐시한다" 는 전제에 묶여 있어
-- 그 서비스가 재사용할 수 없다 — 되살릴 일이 없으므로 남겨 두지 않는다.
DROP TABLE IF EXISTS saju_luck_sections;
```

Modify `migrations/README.md` 마지막 줄:

```markdown
**다음 번호는 0034 부터다.**
```

- [ ] **Step 2: 레지스트리에서 두 섹션과 storage 를 뺀다**

`src/app/api/saju/_lib/sections/registry.ts`:

1. 아래 타입 선언과 그 위 주석을 삭제한다:

```ts
/**
 * 저장 테이블. "chart" 는 4기둥+성별(chartKey)로 캐시되고,
 * "luck" 은 정확한 생시에 의존해 luckKey 로 따로 캐시된다.
 */
export type SectionStorage = "chart" | "luck";
```

2. `SectionSpec`에서 `storage: SectionStorage;` 줄을 삭제한다.
3. 모든 섹션 스펙에서 `storage: "chart",` 줄을 삭제한다 (10곳).
4. `yearlyLuck: {...}` 와 `daeunOutlook: {...}` 스펙 전체를 삭제한다.
5. `import { KeyValue, LabeledText, TimelineNote, TitledText, TraitNote } from "./primitives";` 에서 `TimelineNote` 를 뺀다.

- [ ] **Step 3: primitives 에서 TimelineNote 를 뺀다**

`src/app/api/saju/_lib/sections/primitives.ts`에서 아래 블록을 삭제한다:

```ts
/**
 * 제목 + 설명 — 11 세운, 12 대운.
 * 기간(2026년 / 32–41세)은 계산값이라 여기 없다. 조립 단계에서 인덱스로 짝짓는다.
 */
export const TimelineNote = z
  .object({ title: z.string().min(1), desc: z.string().min(1) })
  .strict();
export type TimelineNote = z.infer<typeof TimelineNote>;
```

`LabeledText`·`KeyValue` 위 주석에 적힌 섹션 번호(`05 감정, 08 연애, 10 재물` 등)는 Task 3에서 번호가 다시 매겨지므로 지금은 건드리지 않는다.

- [ ] **Step 4: derive 에서 luck 파생을 뺀다**

`src/app/api/saju/_lib/sections/derive.ts`:

1. import 에서 `type SectionStorage` 를 뺀다.
2. 아래 두 줄을 삭제한다:

```ts
export const CHART_SECTION_KEYS = keysWhere((s) => s.storage === "chart");
export const LUCK_SECTION_KEYS = keysWhere((s) => s.storage === "luck");
```

3. `sectionStorage` 함수 전체를 삭제한다.
4. `llmInputSchemaWithRows` 함수와 그 위 주석 블록 전체를 삭제한다.

- [ ] **Step 5: 프롬프트에서 luck 분기를 뺀다**

`src/app/api/saju/_lib/prompt/facts.ts`에서 `luckFacts` 함수 전체와 `import` 의 `sewunPillars` 를 삭제한다. `sewunPillars` 자체(`src/lib/saju-core/sewun.ts`)는 **남긴다** — 계산 라이브러리의 만세력 원시값이고 자체 테스트가 있다.

`src/app/api/saju/_lib/prompt/index.ts` 를 아래로 바꾼다 (파일 전체):

```ts
// 섹션 하나에 대한 LLM 요청을 조립한다.
// 프롬프트를 만드는 유일한 자리 — 어떤 LLM 을 쓰든 여기서 나온 SectionRequest 를 옮기기만 한다.

import type { SajuAnalysis } from "@/lib/saju-core";
import { SECTIONS, llmInputSchema, type SectionKey } from "../sections";
import { chartFacts } from "./facts";
import { SECTION_TOOL_NAME, SYSTEM_PROMPT } from "./system";

export { SECTION_TOOL_NAME, SYSTEM_PROMPT } from "./system";
export { chartFacts } from "./facts";

/** LLM 어댑터가 그대로 옮겨 담으면 되는 요청 한 건. */
export interface SectionRequest {
  key: SectionKey;
  system: string;
  user: string;
  /** 응답을 tool 호출로 강제할 때 쓸 이름 */
  toolName: string;
  /** tool 의 input_schema. 최상위는 항상 { content: ... } */
  inputSchema: Record<string, unknown>;
}

export function buildSectionRequest(
  analysis: SajuAnalysis,
  key: SectionKey,
): SectionRequest {
  const spec = SECTIONS[key];

  const user = [
    chartFacts(analysis),
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
    system: SYSTEM_PROMPT,
    user,
    toolName: SECTION_TOOL_NAME,
    inputSchema: llmInputSchema(key),
  };
}
```

- [ ] **Step 6: key.ts 에서 luckKey 를 뺀다**

`src/app/api/saju/_lib/key.ts`에서 `luckKey` 함수와 그 위 주석 블록 전체를 삭제한다. import 에서 `SajuAnalysis` 가 더 안 쓰이면 같이 뺀다 (`Chart` 만 남는다).

- [ ] **Step 7: 생성기 인터페이스에서 ctx 를 뺀다**

`src/app/api/saju/_lib/types.ts`: `GenerationContext` 인터페이스와 그 위 주석 문단(`⚠️ 캐시 주의:` 문단의 마지막 문장 `생시에 의존하는 서술은 storage="luck" 섹션에만 넣는다.` 포함)을 삭제하고, `generateSections` 를 아래로 바꾼다:

```ts
/**
 * 해석 생성기 (LLM 어댑터).
 *
 * 섹션 단위로 받는 이유: 한 섹션이 스키마 검증에 실패해도 나머지는 살리고,
 * 캐시에 없는 섹션만 골라 다시 뽑기 위해서다.
 *
 * ⚠️ 캐시 주의: 섹션은 (4기둥 + 성별)로만 캐시된다(chartKey 참조).
 * 따라서 서술은 원국·성별에서 파생되는 사실만 사용해야 한다.
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

`src/app/api/saju/_lib/prompted.ts`: 생성자에서 `options` 매개변수를 삭제하고, `generateSections` 의 `ctx` 인자와 `buildSectionRequest` 호출을 바꾼다:

```ts
export class PromptedGenerator implements InterpretationGenerator {
  constructor(
    readonly model: string,
    private readonly transport: SectionTransport,
  ) {}

  async generateSections(
    analysis: SajuAnalysis,
    keys: SectionKey[],
  ): Promise<Partial<Interpretation>> {
    // 섹션마다 독립된 호출이라 병렬로 보낸다. 한 섹션이 죽어도 나머지는 남고,
    // 빠진 섹션은 다음 요청에서 missing 으로 다시 잡힌다.
    const settled = await Promise.all(
      keys.map(async (key) => {
        try {
          const raw = await this.transport(buildSectionRequest(analysis, key));
          return { key, content: unwrapContent(raw) };
        } catch (e) {
          console.warn(`[PromptedGenerator] 섹션 생성 실패, 건너뜀: ${key}`, e);
          return null;
        }
      }),
    );
    // …이후는 그대로
  }
}
```

import 에서 `type PromptContext` 와 `type GenerationContext` 를 뺀다.

`src/app/report/_lib/gated-generator.ts`: 래퍼의 시그니처를 맞춘다.

```ts
    async generateSections(analysis, keys) {
      if (!(await checkAnonReportLimit(ip))) throw new ReportRateLimitError();
      return inner.generateSections(analysis, keys);
    },
```

`src/app/api/saju/_lib/generate.ts`(자리표시자 생성기): `timeline` 변수 선언과 `yearlyLuck: timeline,`, `daeunOutlook: {...}` 블록을 삭제하고, `generateSections` 시그니처에서 `ctx` 를 뺀다.

- [ ] **Step 8: produce 에서 저장소 분기를 뺀다**

`src/app/api/saju/_lib/produce.ts`:

1. import 에서 `toSectionWrites`·`SectionWrite`·`sectionStorage`·`isSectionKey` 를 뺀다 (남는 것: `CachedSections`, `CacheRecord`, `assign`, `parseSectionContent`, `Interpretation`, `SectionKey`).
2. `ProduceDeps` 를 아래로 바꾼다:

```ts
export interface ProduceDeps {
  generator: InterpretationGenerator;
  getCached: (chartKey: string, keys: SectionKey[]) => Promise<CachedSections>;
  putCached: (record: CacheRecord) => Promise<void>;
  /** 요청할 섹션. 무료/유료 결정은 호출자 몫이다. */
  sectionKeys: SectionKey[];
}
```

3. `splitByStorage` 상수 전체를 삭제한다.
4. `produceSections` 본문을 아래로 바꾼다:

```ts
export async function produceSections(
  analysis: SajuAnalysis,
  deps: ProduceDeps,
): Promise<{ interpretation: Partial<Interpretation>; cached: boolean }> {
  const cKey = chartKey(analysis.chart);
  const { have, missing } = await deps.getCached(cKey, deps.sectionKeys);

  const interpretation: Partial<Interpretation> = { ...have };
  if (missing.length === 0) return { interpretation, cached: true };

  // 없는 섹션만 생성. 생성기가 일부를 빠뜨려도 나머지로 진행한다
  // (섹션 단위 실패는 다음 요청에서 missing 으로 다시 잡힌다).
  let generated: Partial<Interpretation>;
  try {
    generated = await deps.generator.generateSections(analysis, missing);
  } catch (e) {
    throw new GenerationError(e, interpretation);
  }

  // 생성기가 반환한 값은 무엇이든 여기서 한 번 걸러야 한다 — 이 결과가 응답과
  // 저장 양쪽에 그대로 쓰이므로, 한쪽에서만 검증하면 다른 쪽은 새는 채로 남는다.
  //  - missing 에 없는 키는 버린다: 요청하지 않은 섹션이 섞이거나
  //    이미 검증된 캐시 값을 덮어쓰지 않게 한다.
  //  - 자기 스키마에 안 맞는 값은 버리고 warn: 어댑터의 규율에 기대지 않고
  //    여기서 막는다. 떨어진 섹션은 다음 요청에서 다시 시도된다.
  const validated: Partial<Interpretation> = {};
  for (const key of missing) {
    const raw = generated[key];
    if (raw === undefined) continue;
    const parsed = parseSectionContent(key, raw);
    if (parsed === null) {
      console.warn(`[produceSections] 섹션 검증 실패, 건너뜀: ${key}`);
      continue;
    }
    assign(validated, key, parsed);
  }
  Object.assign(interpretation, validated);

  // 저장 (멱등) — 검증까지 통과한 것만
  if (Object.keys(validated).length > 0) {
    await deps.putCached({
      chartKey: cKey,
      gender: analysis.chart.gender,
      pillars: pillarsJson(analysis.chart),
      interpretation: validated,
      model: deps.generator.model,
    });
  }

  return { interpretation, cached: false };
}
```

- [ ] **Step 9: 호출부 세 곳에서 deps 를 줄인다**

`src/app/api/saju/route.ts`: `import { getLuckCached, putLuckSections } from "./_lib/store-luck";` 삭제, `handleSaju` 호출에서 `getLuckCached,`·`putLuckSections,`·`year: new Date().getFullYear(),` 삭제. 파일 상단 `maxDuration` 주석의 `유료 섹션(daeunOutlook 이 가장 느리다)까지 열면 이 값을 다시 본다.` 를 `유료 섹션까지 열면 이 값을 다시 본다.` 로 고친다.

`src/app/report/page.tsx`: `import { getLuckCached, putLuckSections } from "@/app/api/saju/_lib/store-luck";` 삭제, `produceSections` 호출에서 `getLuckCached,`·`putLuckSections,`·`year,` 삭제. `const year = new Date().getFullYear();` 는 **남긴다** — 아래 `toReportContent(..., year)` 가 쓴다. 파일 상단 `maxDuration` 주석에서 `daeunOutlook 이 느려` 를 지우고 `유료 13섹션은 이 값을 넘길 수 있다.` 로 문장을 다듬는다.

- [ ] **Step 10: store-luck 을 지운다**

```bash
git rm src/app/api/saju/_lib/store-luck.ts src/app/api/saju/_lib/store-luck.test.ts
```

- [ ] **Step 11: 테스트를 정리한다**

`sections/registry.test.ts`:
- `섹션 12개` → `expect(entries).toHaveLength(10);` (테스트 이름도 `섹션 10개`)
- `모든 섹션이 tier / storage / prompt 를 갖는다` → `storage` 단언 줄 삭제, 이름을 `모든 섹션이 tier / prompt 를 갖는다` 로
- `생시에 의존하는 섹션만 storage=luck` 테스트 전체 삭제
- `daeunOutlook 은 rows/summary/emphasis 를 요구한다` 테스트 전체 삭제

`sections/derive.test.ts`:
- import 에서 `CHART_SECTION_KEYS`, `LUCK_SECTION_KEYS`, `llmInputSchemaWithRows`, `sectionStorage` 삭제
- `chart + luck 도 전체를 정확히 분할한다` 테스트 삭제
- `sectionVersion / sectionStorage` 테스트를 아래로 바꾼다:

```ts
  it("sectionVersion", () => {
    // 프롬프트를 고칠 때마다 같이 올라간다. registry 의 version 과 어긋나면 여기서 걸린다.
    expect(sectionVersion("overview")).toBe(3);
  });
```

- `describe("llmInputSchemaWithRows", ...)` 블록 전체 삭제

`prompt/index.test.ts`: `luck 섹션에는 대운·세운을 넣는다`, `daeunOutlook 의 rows 를 대운 회차 수로 못박는다`, `yearlyLuck 의 항목 수를 세운 연수로 못박는다`, `yearlyLuckYears 로 세운 연수를 바꿀 수 있다`, `개수 고정은 세운·대운에만 적용된다` 삭제. 남는 테스트에서 `buildSectionRequest(analysis, key, { year })` 호출을 `buildSectionRequest(analysis, key)` 로 바꾼다. `chart 섹션에는 대운·세운을 넣지 않는다` 는 이름을 `요청에 대운·세운이 들어가지 않는다` 로 바꾸고 남긴다.

`prompt/facts.test.ts`: `describe("luckFacts", ...)` 블록 전체 삭제.

`key.test.ts`: `describe("luckKey", ...)` 블록 전체 삭제. import 에서 `luckKey` 삭제.

`produce.test.ts`: `luck 섹션은 luck 저장소로 간다` 삭제. 남는 테스트의 deps 객체에서 `getLuckCached`·`putLuckSections`·`year` 를 삭제한다.

`handler.test.ts`: `luck 섹션은 luck 저장소로 간다`, `luck 캐시 HIT 도 cached=true 에 반영된다` 삭제. 상단 `const yearlyLuck = ...` 삭제. 기본 deps 에서 `getLuckCached`·`putLuckSections`·`year` 삭제.

`src/app/api/saju/route.test.ts`: `vi.mock("./_lib/store-luck", ...)` 블록과 `getLuckCached`/`putLuckSections` 목 선언·리셋 삭제.

`generate.test.ts`: `generateSections(analysis, SECTION_KEYS)` 호출에 세 번째 인자가 있으면 뺀다.

- [ ] **Step 12: 검증**

Run: `npm run typecheck`
Expected: 오류 없음. `luckKey`·`sectionStorage`·`GenerationContext` 참조가 남아 있으면 여기서 잡힌다.

Run: `npm test`
Expected: 전부 PASS

Run: `npm run lint`
Expected: 오류 없음

- [ ] **Step 13: 마이그레이션 적용**

Run: `npm run db:migrate`
Expected: `0033_drop_saju_luck_sections.sql` 적용 로그

- [ ] **Step 14: 커밋**

```bash
git add -A
git commit -m "refactor(saju): 리포트에서 luck 저장 축을 걷어낸다"
```

---

## Task 3: 섹션 머리말을 레지스트리 한 곳으로

번호·카테고리·제목을 `SECTIONS`로 옮기고, 잠금 목록을 파생시킨다. 이 시점의 섹션은 10개다.

**Files:**
- Modify: `src/app/api/saju/_lib/sections/registry.ts`, `sections/derive.ts`, `src/app/report/_components/SectionHeading.tsx`, `PersonalitySection.tsx`, `OuterInnerSection.tsx`, `StrengthsSection.tsx`, `CautionsSection.tsx`, `EmotionSection.tsx`, `EnvironmentSection.tsx`, `RelatingSection.tsx`, `LoveSection.tsx`, `CompatibilitySection.tsx`, `WealthSection.tsx`, `LockedSections.tsx`, `ReportBody.tsx`, `src/app/report/_lib/report-content.ts`, `report-content.fixture.ts`
- Test: `sections/registry.test.ts`, `sections/derive.test.ts`

**Interfaces:**
- Consumes: Task 2가 남긴 10섹션 레지스트리 (`storage` 없음)
- Produces:
  - `SectionSpec.heading: { category: string; title: string }` — 필수 필드
  - `sectionHeading(key: SectionKey): SectionHeadingMeta` where `SectionHeadingMeta = { no: string; category: string; title: string }`
  - `paidSectionHeadings(): SectionHeadingMeta[]`
  - `<SectionHeading section={key} />` — prop 하나

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/saju/_lib/sections/derive.test.ts` 맨 아래에 추가:

```ts
describe("sectionHeading", () => {
  it("번호는 레지스트리 선언 순서에서 나온다", () => {
    expect(sectionHeading("overview").no).toBe("01");
    expect(sectionHeading(SECTION_KEYS[SECTION_KEYS.length - 1]).no)
      .toBe(String(SECTION_KEYS.length).padStart(2, "0"));
  });

  it("모든 섹션이 번호·카테고리·제목을 갖는다", () => {
    const nos = SECTION_KEYS.map((k) => sectionHeading(k).no);
    expect(new Set(nos).size, "번호가 겹친다").toBe(SECTION_KEYS.length);
    for (const key of SECTION_KEYS) {
      const h = sectionHeading(key);
      expect(h.category.length, key).toBeGreaterThan(0);
      expect(h.title.length, key).toBeGreaterThan(0);
    }
  });

  it("잠금 목록은 유료 섹션을 화면과 같은 순서·번호로 준다", () => {
    const locked = paidSectionHeadings();
    expect(locked.map((l) => l.no)).toEqual(
      PAID_SECTION_KEYS.map((k) => sectionHeading(k).no),
    );
    // 무료 섹션은 잠기지 않는다
    expect(locked).toHaveLength(PAID_SECTION_KEYS.length);
  });
});
```

import 에 `sectionHeading`, `paidSectionHeadings` 를 추가한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/derive.test.ts`
Expected: FAIL — `sectionHeading is not a function` (또는 import 오류)

- [ ] **Step 3: SectionSpec 에 heading 을 추가하고 순서를 재배열한다**

`src/app/api/saju/_lib/sections/registry.ts`:

`SectionSpec` 에 필드를 더한다:

```ts
  /**
   * 화면 머리말. 번호는 여기 없다 — 아래 SECTIONS 의 선언 순서에서 나온다
   * (derive.ts: sectionHeading). 잠금 목록도 같은 자리에서 파생되므로
   * 화면과 잠금이 어긋날 수 없다.
   */
  heading: { category: string; title: string };
```

`SECTIONS` 객체 위 주석에 한 줄을 더한다:

```ts
/**
 * 해석 섹션의 유일한 정의. section_key = 이 객체의 키.
 *
 * ⚠️ **선언 순서 = 화면 순서 = 섹션 번호다.** SECTION_KEYS 가 Object.keys 로
 * 이 순서를 그대로 쓰고, sectionHeading 이 그 인덱스로 "01"…을 만든다.
 * 순서를 바꾸면 화면 번호와 잠금 목록이 함께 움직인다 — 한쪽만 고칠 자리가 없다.
 *
 * 계산값(원국·오행·신강약)은 여기 없다. LLM 서술만 담고,
 * 숫자는 조립 단계에서 SajuAnalysis 로 채운다 — LLM 이 숫자를 지어내지 못하게 하려고.
 */
```

각 섹션 스펙에 `heading` 을 넣고, 객체를 아래 순서로 재배열한다 (`environment` 가 `relating` 앞으로 온다):

| 선언 위치 | key | heading |
| --- | --- | --- |
| 1 | `overview` | `{ category: "핵심 성향", title: "이렇게 보이는 데는 이유가 있어요" }` |
| 2 | `outerVsInner` | `{ category: "겉과 속", title: "남이 보는 나 vs 실제 내면" }` |
| 3 | `strengths` | `{ category: "타고난 강점", title: "이런 순간에 빛나요" }` |
| 4 | `cautions` | `{ category: "주의할 패턴", title: "나도 모르게 반복하는 것들" }` |
| 5 | `emotion` | `{ category: "감정과 스트레스", title: "힘들 때 이런 패턴이 나타나요" }` |
| 6 | `environment` | `{ category: "잘 맞는 환경", title: "능력이 잘 드러나는 조건" }` |
| 7 | `relating` | `{ category: "사람을 대하는 방식", title: "관계에서의 나" }` |
| 8 | `love` | `{ category: "연애와 관계", title: "연애할 때 반복되는 관계 패턴" }` |
| 9 | `compatibility` | `{ category: "궁합", title: "당신과 잘 맞는 사람의 특징" }` |
| 10 | `wealth` | `{ category: "재물", title: "돈이 모이는 방식과 새어나가는 지점" }` |

- [ ] **Step 4: derive 에 파생 함수를 더한다**

`src/app/api/saju/_lib/sections/derive.ts` 의 `sectionVersion` 아래에 추가:

```ts
/** 화면 머리말 한 줄. no 는 레지스트리 선언 순서에서 나온다. */
export interface SectionHeadingMeta {
  no: string;
  category: string;
  title: string;
}

export function sectionHeading(key: SectionKey): SectionHeadingMeta {
  const { category, title } = spec(key).heading;
  return {
    no: String(SECTION_KEYS.indexOf(key) + 1).padStart(2, "0"),
    category,
    title,
  };
}

/**
 * 무료 사용자에게 보여줄 잠금 목록. 화면이 그리는 것과 같은 순서·번호다 —
 * 목록을 따로 손으로 적어 두면 섹션 순서를 바꿀 때 조용히 어긋난다.
 */
export function paidSectionHeadings(): SectionHeadingMeta[] {
  return PAID_SECTION_KEYS.map(sectionHeading);
}
```

- [ ] **Step 5: 테스트 통과를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/derive.test.ts`
Expected: PASS

- [ ] **Step 6: SectionHeading 컴포넌트를 바꾼다**

`src/app/report/_components/SectionHeading.tsx` 전체:

```tsx
import { sectionHeading, type SectionKey } from "@/app/api/saju/_lib/sections";

/**
 * 섹션 머리말. 번호·카테고리·제목을 여기서 받지 않고 레지스트리에서 읽는다 —
 * 컴포넌트마다 번호를 적어 두면 순서를 바꿀 때 화면과 잠금 목록이 갈라진다.
 */
export function SectionHeading({ section }: { section: SectionKey }) {
  const { no, category, title } = sectionHeading(section);
  return (
    <>
      <div className="text-xs font-bold tracking-[0.08em] text-slate-400 mb-2">{no} · {category}</div>
      <h2 className="text-[clamp(20px,4vw,24px)] font-bold tracking-[-0.02em] m-0 mb-5">{title}</h2>
    </>
  );
}
```

- [ ] **Step 7: 섹션 컴포넌트 10곳의 호출을 바꾼다**

각 파일에서 `<SectionHeading no=… category=… title=… />` 한 줄을 아래로 교체한다:

| 파일 | 새 호출 |
| --- | --- |
| `PersonalitySection.tsx` | `<SectionHeading section="overview" />` |
| `OuterInnerSection.tsx` | `<SectionHeading section="outerVsInner" />` |
| `StrengthsSection.tsx` | `<SectionHeading section="strengths" />` |
| `CautionsSection.tsx` | `<SectionHeading section="cautions" />` |
| `EmotionSection.tsx` | `<SectionHeading section="emotion" />` |
| `EnvironmentSection.tsx` | `<SectionHeading section="environment" />` |
| `RelatingSection.tsx` | `<SectionHeading section="relating" />` |
| `LoveSection.tsx` | `<SectionHeading section="love" />` |
| `CompatibilitySection.tsx` | `<SectionHeading section="compatibility" />` |
| `WealthSection.tsx` | `<SectionHeading section="wealth" />` |

- [ ] **Step 8: 잠금 목록을 파생으로 바꾼다**

`src/app/report/_lib/report-content.ts` 에서 아래를 삭제한다:

```ts
/** 무료 사용자에게 보이는 05–12 잠금 목록 항목 */
export interface LockedSectionMeta { no: string; category: string; title: string }
```

`src/app/report/_lib/report-content.fixture.ts` 에서 `lockedSections` export 전체를 삭제한다 (`import("./report-content").LockedSectionMeta` 참조 포함).

`src/app/report/_components/LockedSections.tsx` 의 import 와 prop 타입을 바꾼다:

```ts
import type { SectionHeadingMeta } from "@/app/api/saju/_lib/sections";
```

```ts
  sections: SectionHeadingMeta[];
```

`src/app/report/_components/ReportBody.tsx`:

```ts
import { paidSectionHeadings } from "@/app/api/saju/_lib/sections";
```

`import { lockedSections } from "../_lib/report-content.fixture";` 를 삭제하고, 잠금 렌더를 바꾼다:

```tsx
        <LockedSections sections={paidSectionHeadings()} isLoggedIn={access.isLoggedIn} profileId={profileId} />
```

- [ ] **Step 9: registry 테스트를 맞춘다**

`sections/registry.test.ts` 의 `모든 섹션이 tier / prompt 를 갖는다` 에 heading 단언을 더한다:

```ts
  it("모든 섹션이 tier / prompt / heading 을 갖는다", () => {
    for (const [key, spec] of entries) {
      expect(["free", "paid"], key).toContain(spec.tier);
      expect(spec.prompt.length, key).toBeGreaterThan(0);
      expect(spec.heading.category.length, key).toBeGreaterThan(0);
      expect(spec.heading.title.length, key).toBeGreaterThan(0);
    }
  });
```

- [ ] **Step 10: 검증**

Run: `npm run typecheck`
Expected: 오류 없음

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 11: 커밋**

```bash
git add -A
git commit -m "refactor(report): 섹션 번호·제목을 레지스트리 한 곳에서 낸다"
```

---

## Task 4: 고정 축 헬퍼 (`axes.ts`)

`선택과 결정`·`일하는 방식`이 쓸 스키마 헬퍼. 이 태스크는 순수 함수만 만든다 — 레지스트리는 아직 건드리지 않는다.

**Files:**
- Create: `src/app/api/saju/_lib/sections/axes.ts`, `src/app/api/saju/_lib/sections/axes.test.ts`
- Modify: `src/app/api/saju/_lib/sections/index.ts`

**Interfaces:**
- Produces:
  - `DECISION_AXES` — `{ deciding, starting, unsure, afterDeciding }` (한글 라벨)
  - `WORK_AXES` — `{ starting, progressing, collaborating, troubled, performing }`
  - `axisSchema(axes)` → 축 키가 살아 있는 `ZodObject`. `z.infer` 는 `{ [K in keyof T]: string }`
  - `axisRows(axes, content)` → `{ label: string; body: string }[]` (선언 순서)
  - `axisPromptLines(axes, hints)` → `string[]` — 각 축의 지시문 줄. `hints` 는 축 키별 한 줄 설명

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `src/app/api/saju/_lib/sections/axes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DECISION_AXES, WORK_AXES, axisPromptLines, axisRows, axisSchema } from "./axes";

const AXES = { a: "가", b: "나", c: "다" } as const;
const S = axisSchema(AXES);

describe("axisSchema", () => {
  it("모든 축이 있으면 통과한다", () => {
    expect(S.safeParse({ a: "1", b: "2", c: "3" }).success).toBe(true);
  });

  // 배열 + z.enum(라벨) 로 두면 여기가 통과해버린다 — 객체로 두는 이유다.
  it("축이 하나라도 빠지면 거절한다", () => {
    expect(S.safeParse({ a: "1", b: "2" }).success).toBe(false);
  });

  it("모르는 축을 더하면 거절한다", () => {
    expect(S.safeParse({ a: "1", b: "2", c: "3", d: "4" }).success).toBe(false);
  });

  it("빈 문자열을 거절한다", () => {
    expect(S.safeParse({ a: "", b: "2", c: "3" }).success).toBe(false);
  });
});

describe("axisRows", () => {
  it("선언 순서대로 라벨과 본문을 짝짓는다", () => {
    expect(axisRows(AXES, { a: "1", b: "2", c: "3" })).toEqual([
      { label: "가", body: "1" },
      { label: "나", body: "2" },
      { label: "다", body: "3" },
    ]);
  });
});

describe("axisPromptLines", () => {
  it("축 키와 라벨과 힌트를 한 줄로 묶는다", () => {
    const lines = axisPromptLines(AXES, { a: "힌트가", b: "힌트나", c: "힌트다" });
    expect(lines).toEqual([
      "- a(가): 힌트가",
      "- b(나): 힌트나",
      "- c(다): 힌트다",
    ]);
  });
});

describe("실제 축 정의", () => {
  it("선택과 결정은 축이 4개다", () => {
    expect(Object.keys(DECISION_AXES)).toEqual([
      "deciding", "starting", "unsure", "afterDeciding",
    ]);
  });

  it("일하는 방식은 축이 5개다", () => {
    expect(Object.keys(WORK_AXES)).toEqual([
      "starting", "progressing", "collaborating", "troubled", "performing",
    ]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/axes.test.ts`
Expected: FAIL — `Cannot find module './axes'`

- [ ] **Step 3: axes.ts 를 쓴다**

Create `src/app/api/saju/_lib/sections/axes.ts`:

```ts
import { z } from "zod";

/**
 * 축이 고정된 섹션(선택과 결정 · 일하는 방식)의 축 정의.
 *
 * 라벨 문자열은 여기에만 있다 — 레지스트리의 프롬프트 지시문도, 화면의 행 라벨도
 * 이 맵에서 읽는다. 프롬프트와 화면이 각자 문자열을 들고 있으면 둘이 갈라진다.
 *
 * 축을 고정하는 이유: 사람마다 축이 달라지면 "다른 사람과 비교되는 골격" 이라는
 * 이 섹션의 강점이 사라진다.
 */
export const DECISION_AXES = {
  deciding: "결정을 내릴 때",
  starting: "새로운 일을 시작할 때",
  unsure: "확신이 없을 때",
  afterDeciding: "이미 결정한 뒤에는",
} as const;

export const WORK_AXES = {
  starting: "일을 시작할 때",
  progressing: "일을 풀어가는 방식",
  collaborating: "함께 일할 때",
  troubled: "일이 꼬였을 때",
  performing: "성과를 낼 때",
} as const;

export type AxisMap = Record<string, string>;

/**
 * 축 맵 → 모든 축이 정확히 한 번씩 있는 문자열 객체 스키마.
 *
 * 배열 + z.enum(라벨) 로 두면 LLM 이 같은 축을 두 번 쓰거나 하나를 빠뜨려도
 * 스키마를 통과한다. 객체는 통과하지 못한다.
 *
 * ⚠️ 반환 타입을 z.ZodType 으로 넓혀 적지 마라. SectionContent 가
 * z.infer<SECTIONS[K]["schema"]> 로 나오므로, 넓히는 순간 화면이 받는 타입이
 * unknown 이 되어 필드를 못 읽는다. 추론에 맡겨 축 키를 살려 둔다.
 */
export function axisSchema<T extends AxisMap>(axes: T) {
  const shape = Object.fromEntries(
    Object.keys(axes).map((k) => [k, z.string().min(1)]),
  ) as { [K in keyof T]: z.ZodString };
  return z.object(shape).strict();
}

/** 축 맵 + 내용 → 화면이 그리는 행. 선언 순서를 지킨다. */
export function axisRows<T extends AxisMap>(
  axes: T,
  content: Record<keyof T, string>,
): { label: string; body: string }[] {
  return Object.entries(axes).map(([key, label]) => ({
    label,
    body: content[key as keyof T],
  }));
}

/**
 * 축별 지시문 줄. 키를 함께 적는 이유: LLM 이 채워야 하는 것은 라벨이 아니라
 * 스키마의 필드명이라, 둘을 나란히 보여줘야 어느 칸에 무엇을 쓸지 헷갈리지 않는다.
 */
export function axisPromptLines<T extends AxisMap>(
  axes: T,
  hints: Record<keyof T, string>,
): string[] {
  return Object.entries(axes).map(
    ([key, label]) => `- ${key}(${label}): ${hints[key as keyof T]}`,
  );
}
```

- [ ] **Step 4: 배럴에 붙인다**

`src/app/api/saju/_lib/sections/index.ts` 에 한 줄을 더한다:

```ts
export * from "./axes";
```

- [ ] **Step 5: 테스트 통과를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/axes.test.ts`
Expected: 전부 PASS

Run: `npm run typecheck`
Expected: 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add -A src/app/api/saju/_lib/sections
git commit -m "feat(saju): 축이 고정된 섹션을 위한 axisSchema 를 더한다"
```

---

## Task 5: 06 선택과 결정

**Files:**
- Create: `src/app/report/_components/DecisionsSection.tsx`
- Modify: `src/app/api/saju/_lib/sections/registry.ts`, `src/app/report/_lib/report-content.ts`, `to-report-content.ts`, `report-content.fixture.ts`, `src/app/report/_components/ReportBody.tsx`
- Test: `src/app/api/saju/_lib/sections/registry.test.ts`

**Interfaces:**
- Consumes: `axisSchema`, `axisPromptLines`, `axisRows`, `DECISION_AXES` (Task 4)
- Produces:
  - 레지스트리 키 `decisions`, 선언 위치는 `emotion` **바로 뒤** → 번호 `06`
  - `DecisionsContent = SectionContent<"decisions">` (`report-content.ts` 에서 export)
  - `ReportContent.decisions?: DecisionsContent`
  - `<DecisionsSection content={content.decisions} />`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/saju/_lib/sections/registry.test.ts` 의 `섹션 10개` 를 `섹션 11개` / `toHaveLength(11)` 로 바꾸고, 아래 테스트를 추가한다:

```ts
  it("decisions 는 네 축을 정확히 요구한다", () => {
    const full = { deciding: "a", starting: "b", unsure: "c", afterDeciding: "d" };
    expect(SECTIONS.decisions.schema.safeParse(full).success).toBe(true);
    const { unsure: _drop, ...missing } = full;
    expect(SECTIONS.decisions.schema.safeParse(missing).success).toBe(false);
    expect(SECTIONS.decisions.schema.safeParse({ ...full, extra: "e" }).success).toBe(false);
  });

  it("decisions 는 emotion 바로 뒤에 온다 (06)", () => {
    const keys = Object.keys(SECTIONS);
    expect(keys[keys.indexOf("emotion") + 1]).toBe("decisions");
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/registry.test.ts`
Expected: FAIL — `Cannot read properties of undefined (reading 'schema')`

- [ ] **Step 3: 레지스트리에 섹션을 더한다**

`src/app/api/saju/_lib/sections/registry.ts` 상단 import 에 추가:

```ts
import { DECISION_AXES, axisPromptLines, axisSchema } from "./axes";
```

`emotion` 스펙 **바로 뒤에** 아래를 넣는다:

```ts
  decisions: {
    version: 1,
    tier: "paid",
    heading: { category: "선택과 결정", title: "중요한 순간, 나는 어떻게 움직일까" },
    schema: axisSchema(DECISION_AXES),
    // 축을 스키마로 고정한 섹션이다 — 지시문은 각 칸에 "무엇을" 쓸지만 정한다.
    prompt: [
      "중요한 순간에 어떻게 움직이는지를 네 국면으로 나눠 각각 2~3문장으로 써라.",
      "",
      ...axisPromptLines(DECISION_AXES, {
        deciding: "정보를 얼마나 모으고 얼마나 빨리 정하는지, 무엇을 기준으로 삼는지",
        starting: "처음부터 크게 뛰어드는 쪽인지, 안전한 범위를 확인하고 조금씩 넓히는 쪽인지",
        unsure: "혼자 생각을 반복하는 쪽인지 남에게 의견을 구하는 쪽인지, 무엇이 있으면 결정이 빨라지는지",
        afterDeciding: "주변에서 다른 이야기가 나올 때 번복하는 편인지 밀고 가는 편인지",
      }),
      "",
      "성격을 형용사로 요약하지 말고, 그 순간에 실제로 무엇을 하는지 행동으로 써라.",
      '- 좋은 예: "선택지가 많아질수록 결정을 미루고, 주변 사람의 반응을 한 번씩 확인한 뒤에 움직여요."',
      '- 나쁜 예: "부드럽지만 자기 기준이 뚜렷한 편이에요." (성격 요약일 뿐, 무엇을 하는지가 없다)',
      "국면마다 다른 행동을 써라. 네 칸이 같은 이야기의 말바꿈이 되면 안 된다.",
    ].join("\n"),
    example:
      '{"deciding":"바로 답을 내기보다 주변 상황과 다른 사람의 반응을 충분히 살펴본 뒤 움직이는 편이에요. 선택지가 많아질수록 생각하는 시간이 길어져요.","starting":"처음부터 크게 뛰어들기보다 안전한 범위를 확인하고 조금씩 넓혀가는 쪽에 가까워요.","unsure":"혼자 생각을 반복하기보다 믿을 만한 사람에게 의견을 구했을 때 결정이 빨라지는 편이에요.","afterDeciding":"주변에서 다른 이야기가 나오더라도 충분히 고민해서 내린 결정이라면 자기 방식대로 밀고 가려는 힘이 있어요."}',
  },
```

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/registry.test.ts`
Expected: PASS

- [ ] **Step 5: 뷰모델에 필드를 더한다**

`src/app/report/_lib/report-content.ts` 의 import 줄에 `SectionContent` 를 더하고 타입을 export 한다:

```ts
import type { SectionContent } from "@/app/api/saju/_lib/sections";

/** 축이 고정된 섹션 — 축 정의는 sections/axes.ts 가 갖는다. */
export type DecisionsContent = SectionContent<"decisions">;
```

`ReportContent` 의 `emotion?: LabeledText[];` 줄 **아래**에 넣는다:

```ts
  decisions?: DecisionsContent;     // 06
```

`src/app/report/_lib/to-report-content.ts` 의 반환 객체에서 `emotion:` 줄 아래에 넣는다:

```ts
    decisions: interpretation.decisions,
```

- [ ] **Step 6: 픽스처에 샘플을 더한다**

`src/app/report/_lib/report-content.fixture.ts` 의 `emotion: [...]` 블록 **아래**에 넣는다:

```ts
  decisions: {
    deciding: "바로 답을 내기보다 주변 상황과 다른 사람의 반응을 충분히 살펴본 뒤 움직이는 편이에요. 선택지가 많아질수록 생각하는 시간이 길어지지만, 한번 자기 안에서 선을 정하고 나면 의외로 쉽게 바꾸지 않아요.",
    starting: "처음부터 크게 뛰어들기보다 안전한 범위를 확인하고 조금씩 넓혀가는 쪽에 가까워요.",
    unsure: "혼자 생각을 반복하기보다 믿을 만한 사람에게 의견을 구했을 때 결정이 빨라지는 편이에요.",
    afterDeciding: "주변에서 다른 이야기가 나오더라도 충분히 고민해서 내린 결정이라면 자기 방식대로 밀고 가려는 힘이 있어요.",
  },
```

- [ ] **Step 7: 컴포넌트를 쓴다**

Create `src/app/report/_components/DecisionsSection.tsx`:

```tsx
import { SectionHeading } from "./SectionHeading";
import { DECISION_AXES, axisRows } from "@/app/api/saju/_lib/sections";
import type { DecisionsContent } from "../_lib/report-content";

/**
 * 축이 고정된 섹션이라 라벨을 화면이 들고 있지 않는다 — axes.ts 에서 읽는다.
 * 06 은 본문이 2~3문장이라 관계(09)의 두 칸 배치 대신 라벨을 본문 위에 얹는다.
 */
export function DecisionsSection({ content }: { content: DecisionsContent }) {
  const rows = axisRows(DECISION_AXES, content);
  return (
    <section className="mt-[72px]">
      <SectionHeading section="decisions" />
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`px-[22px] py-5 ${i < rows.length - 1 ? "border-b border-slate-100" : ""}`}
          >
            <div className="text-[13px] font-bold text-accent">{row.label}</div>
            <p className="text-sm text-slate-700 leading-[1.65] mt-1.5 mb-0 break-keep [text-wrap:pretty]">
              {row.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 8: ReportBody 에 붙인다**

`src/app/report/_components/ReportBody.tsx` 에 import 를 더하고:

```ts
import { DecisionsSection } from "./DecisionsSection";
```

`{content.emotion && <EmotionSection items={content.emotion} />}` 바로 아래에 넣는다:

```tsx
          {content.decisions && <DecisionsSection content={content.decisions} />}
```

- [ ] **Step 9: 검증**

Run: `npm run typecheck`
Expected: 오류 없음

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat(report): 선택과 결정 섹션을 더한다"
```

---

## Task 6: 07 일하는 방식

**Files:**
- Create: `src/app/report/_components/WorkStyleSection.tsx`
- Modify: `src/app/api/saju/_lib/sections/registry.ts`, `src/app/report/_lib/report-content.ts`, `to-report-content.ts`, `report-content.fixture.ts`, `src/app/report/_components/ReportBody.tsx`
- Test: `src/app/api/saju/_lib/sections/registry.test.ts`

**Interfaces:**
- Consumes: `axisSchema`, `axisPromptLines`, `axisRows`, `WORK_AXES` (Task 4)
- Produces:
  - 레지스트리 키 `workStyle`, 선언 위치는 `decisions` **바로 뒤** → 번호 `07`
  - `WorkStyleContent = SectionContent<"workStyle">`
  - `ReportContent.workStyle?: WorkStyleContent`
  - `<WorkStyleSection content={content.workStyle} />`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`registry.test.ts` 의 `섹션 11개` 를 `섹션 12개` / `toHaveLength(12)` 로 바꾸고 추가한다:

```ts
  it("workStyle 은 다섯 축을 정확히 요구한다", () => {
    const full = {
      starting: "a", progressing: "b", collaborating: "c", troubled: "d", performing: "e",
    };
    expect(SECTIONS.workStyle.schema.safeParse(full).success).toBe(true);
    const { troubled: _drop, ...missing } = full;
    expect(SECTIONS.workStyle.schema.safeParse(missing).success).toBe(false);
    expect(SECTIONS.workStyle.schema.safeParse({ ...full, extra: "f" }).success).toBe(false);
  });

  it("workStyle 은 decisions 바로 뒤에 온다 (07)", () => {
    const keys = Object.keys(SECTIONS);
    expect(keys[keys.indexOf("decisions") + 1]).toBe("workStyle");
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/registry.test.ts`
Expected: FAIL

- [ ] **Step 3: 레지스트리에 섹션을 더한다**

import 에 `WORK_AXES` 를 더하고, `decisions` 스펙 **바로 뒤에** 넣는다:

```ts
  workStyle: {
    version: 1,
    tier: "paid",
    heading: { category: "일하는 방식", title: "일할 때 드러나는 나만의 리듬" },
    schema: axisSchema(WORK_AXES),
    prompt: [
      "일할 때의 리듬을 다섯 국면으로 나눠 각각 2~3문장으로 써라.",
      "",
      ...axisPromptLines(WORK_AXES, {
        starting: "계획을 세우고 들어가는지 일단 시작하는지, 목표가 얼마나 뚜렷해야 움직이는지",
        progressing: "한 번에 몰아치는지 하나씩 쌓는지, 디테일부터 보는지 전체 그림부터 보는지",
        collaborating: "주도·조율·지원 중 어느 자리가 편한지, 의견이 갈리거나 역할을 나눌 때 어떻게 하는지",
        troubled: "문제가 터졌을 때 먼저 하는 행동, 압박을 받을 때 달라지는 점",
        performing: "어떤 목표와 보상에서 힘이 나는지, 결과에서 만족을 얻는지 과정에서 얻는지",
      }),
      "",
      "성격을 형용사로 요약하지 말고, 그 국면에서 실제로 무엇을 하는지 행동으로 써라.",
      "특정 직업·직무를 지목하지 마라 — 그건 다른 섹션이 다룬다.",
      "국면마다 다른 행동을 써라. 다섯 칸이 같은 이야기의 말바꿈이 되면 안 된다.",
    ].join("\n"),
    example:
      '{"starting":"무엇을 만들지 그림이 서야 손이 움직이는 편이에요. 목표가 흐릿하면 시작 자체를 미루게 돼요.","progressing":"몰아쳐서 끝내기보다 매일 조금씩 쌓아 올리는 쪽이에요. 전체 구조를 먼저 잡고 세부는 나중에 채워요.","collaborating":"먼저 나서기보다 사이를 맞추는 자리가 편해요. 의견이 갈리면 각자 원하는 바를 정리해 보여주는 방식으로 풀어요.","troubled":"우선 상황을 다시 확인하고 원인을 좁혀요. 급하게 손대기보다 어디서 어긋났는지부터 찾는 편이에요.","performing":"눈에 보이는 결과가 남는 일에서 힘이 나요. 과정만 길고 결과가 흐릿한 일에서는 동력이 빨리 떨어져요."}',
  },
```

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/registry.test.ts`
Expected: PASS

- [ ] **Step 5: 뷰모델에 필드를 더한다**

`src/app/report/_lib/report-content.ts`:

```ts
export type WorkStyleContent = SectionContent<"workStyle">;
```

`ReportContent` 의 `decisions?` 줄 아래:

```ts
  workStyle?: WorkStyleContent;     // 07
```

`to-report-content.ts` 반환 객체의 `decisions:` 줄 아래:

```ts
    workStyle: interpretation.workStyle,
```

- [ ] **Step 6: 픽스처에 샘플을 더한다**

`report-content.fixture.ts` 의 `decisions: {...}` 블록 아래:

```ts
  workStyle: {
    starting: "무엇을 만들지 그림이 서야 손이 움직이는 편이에요. 목표가 흐릿한 채로 시작하면 중간에 방향을 다시 잡느라 시간이 더 걸려요.",
    progressing: "몰아쳐서 한 번에 끝내기보다 매일 조금씩 쌓아 올리는 쪽이에요. 전체 구조를 먼저 잡고 세부는 나중에 채워요.",
    collaborating: "먼저 나서기보다 사이를 맞추는 자리가 편해요. 의견이 갈리면 각자 원하는 바를 정리해 보여주는 방식으로 풀어요.",
    troubled: "급하게 손대기보다 어디서 어긋났는지부터 찾아요. 다만 원인을 다 밝히려다 대응이 늦어질 때가 있어요.",
    performing: "눈에 보이는 결과가 남는 일에서 힘이 나요. 과정만 길고 결과가 흐릿한 일에서는 동력이 빨리 떨어져요.",
  },
```

- [ ] **Step 7: 컴포넌트를 쓴다**

Create `src/app/report/_components/WorkStyleSection.tsx`:

```tsx
import { SectionHeading } from "./SectionHeading";
import { CardGrid } from "./CardGrid";
import { InfoCard } from "./InfoCard";
import { WORK_AXES, axisRows } from "@/app/api/saju/_lib/sections";
import type { WorkStyleContent } from "../_lib/report-content";

/** 축 다섯이라 카드 그리드가 3+2 로 앉는다 — 05·10 과 같은 부품을 쓴다. */
export function WorkStyleSection({ content }: { content: WorkStyleContent }) {
  return (
    <section className="mt-[72px]">
      <SectionHeading section="workStyle" />
      <CardGrid>
        {axisRows(WORK_AXES, content).map((row) => (
          <InfoCard key={row.label} label={row.label}>
            {row.body}
          </InfoCard>
        ))}
      </CardGrid>
    </section>
  );
}
```

- [ ] **Step 8: ReportBody 에 붙인다**

```ts
import { WorkStyleSection } from "./WorkStyleSection";
```

`{content.decisions && ...}` 바로 아래:

```tsx
          {content.workStyle && <WorkStyleSection content={content.workStyle} />}
```

- [ ] **Step 9: 검증**

Run: `npm run typecheck`
Expected: 오류 없음

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat(report): 일하는 방식 섹션을 더한다"
```

---

## Task 7: 13 나를 잘 쓰는 법

**Files:**
- Create: `src/app/report/_components/PlaybookSection.tsx`
- Modify: `src/app/api/saju/_lib/sections/registry.ts`, `src/app/report/_lib/report-content.ts`, `to-report-content.ts`, `report-content.fixture.ts`, `src/app/report/_components/ReportBody.tsx`
- Test: `src/app/api/saju/_lib/sections/registry.test.ts`

**Interfaces:**
- Produces:
  - 레지스트리 키 `playbook`, 선언 위치는 **맨 마지막** → 번호 `13`
  - `ReportContent.playbook?: TitledText[]`
  - `<PlaybookSection items={content.playbook} />`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`registry.test.ts` 의 `섹션 12개` 를 `섹션 13개` / `toHaveLength(13)` 로 바꾸고 추가한다:

```ts
  it("playbook 은 항목을 정확히 4개 요구한다", () => {
    const item = { title: "t", body: "b" };
    const four = [item, item, item, item];
    expect(SECTIONS.playbook.schema.safeParse(four).success).toBe(true);
    expect(SECTIONS.playbook.schema.safeParse(four.slice(1)).success).toBe(false);
    expect(SECTIONS.playbook.schema.safeParse([...four, item]).success).toBe(false);
  });

  it("playbook 이 마지막 섹션이다 (13)", () => {
    const keys = Object.keys(SECTIONS);
    expect(keys[keys.length - 1]).toBe("playbook");
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/registry.test.ts`
Expected: FAIL

- [ ] **Step 3: 레지스트리 맨 끝에 섹션을 더한다**

`wealth` 스펙 **뒤에**, `SECTIONS` 객체의 마지막 항목으로 넣는다:

```ts
  playbook: {
    version: 1,
    tier: "paid",
    heading: { category: "나를 잘 쓰는 법", title: "내 성향을 내 편으로 만드는 방법" },
    // 마지막 섹션이라 카드 4장이 화면을 닫는 모양을 잡는다. length(4) 는
    // llmInputSchema 를 통해 minItems/maxItems 4 로 tool 스키마에 실린다.
    schema: z.array(TitledText).length(4),
    prompt: [
      "앞의 성향을 실제로 써먹는 방법을 정확히 4개 써라.",
      "- title: 무엇을 할지 한눈에 보이는 짧은 실천 문장. '~하기' 로 끝낸다. 스무 자를 넘기지 마라.",
      "- body: 왜 이 사람에게 그게 필요한지 2~3문장. 어떤 성향 때문에 그런지가 드러나야 한다.",
      "",
      "누구에게나 통하는 일반적인 자기계발 조언을 쓰지 마라. [사실] 블록에서 나온 이 사람의 성향을 근거로 써라.",
      "고치라는 훈계로 쓰지 마라 — 이미 가진 성향을 유리하게 쓰는 방법으로 쓴다.",
      '- 좋은 예: "충분히 살피는 건 강점이지만 선택지가 계속 열려 있으면 생각도 계속 길어져요."',
      '- 나쁜 예: "우유부단한 성격을 고쳐야 해요." (강점을 결함으로 뒤집었다)',
      "네 항목이 서로 다른 상황을 다뤄야 한다. 같은 조언의 말바꿈을 늘어놓지 마라.",
    ].join("\n"),
    example:
      '[{"title":"결정에는 마감 시간을 만들어두기","body":"충분히 살피는 건 강점이지만 선택지가 계속 열려 있으면 생각도 계속 길어져요. 중요한 결정일수록 언제까지 정한다는 선을 먼저 만들어두는 게 좋아요."}]',
  },
```

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/registry.test.ts`
Expected: PASS

- [ ] **Step 5: 뷰모델에 필드를 더한다**

`report-content.ts` 의 `ReportContent` 마지막 유료 필드로:

```ts
  playbook?: TitledText[];          // 13
```

`to-report-content.ts` 반환 객체의 `wealth,` 줄 아래:

```ts
    playbook: interpretation.playbook,
```

- [ ] **Step 6: 픽스처에 샘플을 더한다**

`report-content.fixture.ts` 의 `wealth: {...}` 블록 아래:

```ts
  playbook: [
    {
      title: "결정에는 마감 시간을 만들어두기",
      body: "충분히 살피는 건 강점이지만 선택지가 계속 열려 있으면 생각도 계속 길어져요. 중요한 결정일수록 언제까지 정한다는 선을 먼저 만들어두는 게 좋아요.",
    },
    {
      title: "부탁보다 내 일정부터 확인하기",
      body: "상대에게 먼저 맞추는 습관 때문에 내 몫의 시간이 쉽게 줄어들어요. 바로 대답하기보다 내 일정부터 확인하는 작은 습관이 중심을 지켜줘요.",
    },
    {
      title: "혼자 버티는 것을 독립이라고 여기지 않기",
      body: "스스로 정리한 뒤에 말하려다 보니 도움을 청하는 시점이 늘 늦어요. 절반쯤 정리됐을 때 꺼내 놓으면 오히려 결론이 빨리 나요.",
    },
    {
      title: "성과가 눈에 보이는 일을 가까이 두기",
      body: "결과가 흐릿한 일이 길어지면 동력이 빨리 떨어지는 편이에요. 짧게 끝나고 흔적이 남는 일을 사이사이에 두면 리듬이 유지돼요.",
    },
  ],
```

- [ ] **Step 7: 컴포넌트를 쓴다**

Create `src/app/report/_components/PlaybookSection.tsx`:

```tsx
import { SectionHeading } from "./SectionHeading";
import { CardGrid } from "./CardGrid";
import type { TitledText } from "../_lib/report-content";

/**
 * 리포트를 닫는 실천 카드. 03 강점의 번호 배지와 08 환경의 accent 카드에서
 * 이미 쓰는 어휘를 합쳤다 — 새 스타일이 아니라 한 단계 강조다.
 */
export function PlaybookSection({ items }: { items: TitledText[] }) {
  return (
    <section className="mt-[72px]">
      <SectionHeading section="playbook" />
      <CardGrid>
        {items.map((item, i) => (
          <div
            key={item.title}
            className="border border-accent-200 bg-accent-50 rounded-2xl px-[22px] py-5"
          >
            <div className="flex gap-2.5 items-start mb-2">
              <span className="flex-none w-6 h-6 mt-px rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-[15px] font-bold text-slate-900 leading-[1.4]">{item.title}</span>
            </div>
            <p className="text-sm text-slate-700 leading-[1.65] m-0 break-keep [text-wrap:pretty]">
              {item.body}
            </p>
          </div>
        ))}
      </CardGrid>
    </section>
  );
}
```

- [ ] **Step 8: ReportBody 에 붙인다**

```ts
import { PlaybookSection } from "./PlaybookSection";
```

`{content.wealth && ...}` 블록 **아래**, 유료 프래그먼트의 마지막에:

```tsx
          {content.playbook && <PlaybookSection items={content.playbook} />}
```

- [ ] **Step 9: 검증**

Run: `npm run typecheck`
Expected: 오류 없음

Run: `npm test`
Expected: 전부 PASS. `registry.test.ts` 의 `섹션 13개` 가 통과하면 최종 구성이 맞다.

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat(report): 나를 잘 쓰는 법 섹션을 더한다"
```

---

## Task 8: 08 환경에 직무 팁

**Files:**
- Modify: `src/app/api/saju/_lib/sections/registry.ts`, `src/app/report/_components/NoteCard.tsx`, `EnvironmentSection.tsx`, `ReportBody.tsx`, `src/app/report/_lib/report-content.ts`, `report-content.fixture.ts`
- Test: `src/app/api/saju/_lib/sections/registry.test.ts`

**Interfaces:**
- Produces:
  - `environment` 스키마에 `roles: string[]`(3~5), `roleNote: string` 추가, `version` 2 → 3
  - `TipCard({ label, children })` — `NoteCard.tsx` 에서 export
  - `ReportContent.environment?: SectionContent<"environment">` (인라인 중복 타입 제거)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`registry.test.ts` 의 `environment 는 양쪽 조건을 각각 3~4개 요구한다` 테스트를 아래로 바꾼다:

```ts
  it("environment 는 양쪽 조건을 각각 3~4개 요구한다", () => {
    const three = ["a", "b", "c"];
    const ok = {
      energizing: three, draining: three,
      summary: "s", emphasis: "e",
      roles: three, roleNote: "n",
    };
    expect(SECTIONS.environment.schema.safeParse(ok).success).toBe(true);
    expect(SECTIONS.environment.schema.safeParse({ ...ok, draining: ["a", "b"] }).success).toBe(false);
    expect(SECTIONS.environment.schema.safeParse({ ...ok, energizing: [...three, "d", "e"] }).success).toBe(false);
  });

  it("environment 는 직무 예시를 3~5개 요구한다", () => {
    const three = ["a", "b", "c"];
    const ok = {
      energizing: three, draining: three,
      summary: "s", emphasis: "e",
      roles: three, roleNote: "n",
    };
    expect(SECTIONS.environment.schema.safeParse({ ...ok, roles: ["a", "b"] }).success).toBe(false);
    expect(SECTIONS.environment.schema.safeParse({ ...ok, roles: [...three, "d", "e"] }).success).toBe(true);
    expect(SECTIONS.environment.schema.safeParse({ ...ok, roles: [...three, "d", "e", "f"] }).success).toBe(false);
    // roleNote 가 없으면 칩만 남아 근거 없이 직업을 콕 집는 모양이 된다.
    const { roleNote: _drop, ...noNote } = ok;
    expect(SECTIONS.environment.schema.safeParse(noNote).success).toBe(false);
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/registry.test.ts`
Expected: FAIL — `roles` 가 스키마에 없어 `additionalProperties` 위반

- [ ] **Step 3: 스키마와 프롬프트를 고친다**

`registry.ts` 의 `environment` 스펙을 아래로 바꾼다 (`heading` 은 Task 3에서 넣은 값 그대로 유지):

```ts
  environment: {
    version: 3,
    tier: "paid",
    heading: { category: "잘 맞는 환경", title: "능력이 잘 드러나는 조건" },
    schema: z
      .object({
        energizing: shortList(3, 4),
        draining: shortList(3, 4),
        summary: z.string().min(1),
        emphasis: z.string().min(1),
        roles: shortList(3, 5),
        roleNote: z.string().min(1),
      })
      .strict(),
    prompt: [
      "능력이 잘 드러나는 조건을 두 갈래로 나눠라. energizing 은 힘이 나는 조건, draining 은 기운이 빠지는 조건을 각각 3~4개, 한 문장 이내의 짧은 구절로 쓴다.",
      "성격 묘사가 아니라 일하는 방식·조직 문화·일정처럼 밖에서 알아볼 수 있는 조건으로 써라.",
      "이어서 전체 요약(summary)과 한 줄 강조(emphasis)를 덧붙여라.",
      "",
      "마지막으로 강점이 드러나는 역할·직무 예시(roles)를 3~5개 쓰고, 왜 그 자리가 맞는지 한 문장(roleNote)을 덧붙여라.",
      "- roles 는 자격이나 면허가 필요한 직업명 대신, 하는 일의 성격이 드러나는 짧은 말로 쓴다.",
      '- 좋은 예: "기획", "리서치", "팀 안의 조율자", "혼자 깊게 파는 전문 영역"',
      '- 나쁜 예: "의사", "변호사", "대기업 인사팀" (자격·소속을 지목한다)',
      "- 직업을 정해 주는 말이 아니라 예시라는 게 문장에서 드러나야 한다. roleNote 는 그 자리들이 왜 맞는지를 설명하지, 그 일을 하라고 권하지 않는다.",
    ].join("\n"),
    // emphasis 가 summary 안에 그대로 들어 있는 예시다 — 화면이 부분 문자열로 찾는다.
    example:
      '{"energizing":["방법은 맡기고 결과로 평가하는 팀"],"draining":["과정을 자주 보고해야 하는 관리 방식"],"summary":"정해진 방식만 반복하는 환경보다, 스스로 판단하고 개선할 여지가 있는 환경에서 능력이 잘 드러나요.","emphasis":"스스로 판단하고 개선할 여지가 있는 환경","roles":["기획","리서치","혼자 깊게 파는 전문 영역"],"roleNote":"방법을 스스로 정할 여지가 큰 자리일수록 강점이 잘 보이는 편이에요."}',
  },
```

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/registry.test.ts`
Expected: PASS

- [ ] **Step 5: TipCard 를 더한다**

`src/app/report/_components/NoteCard.tsx` 전체를 아래로 바꾼다:

```tsx
const CARD_CLASS = "bg-slate-50 border border-slate-200 rounded-[14px] px-5 py-4 mt-3";
const TIP_BADGE_CLASS =
  "flex-none text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-[9px] py-1 rounded-full mt-px";

export function NoteCard({ children, tip }: { children: React.ReactNode; tip?: boolean }) {
  return (
    <div className={`${CARD_CLASS} ${tip ? "flex gap-3 items-start" : ""}`}>
      {tip && <span className={TIP_BADGE_CLASS}>TIP</span>}
      <p className="text-sm text-slate-600 leading-[1.65] m-0 break-keep [text-wrap:pretty]">{children}</p>
    </div>
  );
}

/**
 * TIP 배지 + 제목 + 자유 블록. NoteCard 는 children 을 <p> 로 감싸므로
 * 칩 목록처럼 문단이 아닌 것을 담을 수 없다 — 껍데기만 공유한다.
 */
export function TipCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={CARD_CLASS}>
      <div className="flex gap-2.5 items-center mb-2.5">
        <span className={TIP_BADGE_CLASS}>TIP</span>
        <span className="text-[13px] font-bold text-slate-700">{label}</span>
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 6: EnvironmentSection 에 칩 카드를 붙인다**

`src/app/report/_components/EnvironmentSection.tsx`:

import 를 바꾼다:

```tsx
import { NoteCard, TipCard } from "./NoteCard";
```

props 에 두 개를 더한다:

```tsx
export function EnvironmentSection({
  energizing,
  draining,
  summary,
  emphasis,
  roles,
  roleNote,
}: {
  energizing: string[];
  draining: string[];
  summary: string;
  emphasis: string;
  roles: string[];
  roleNote: string;
}) {
```

기존 `<NoteCard>` 블록 **아래**에 넣는다:

```tsx
      <TipCard label="강점이 드러나는 자리">
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          {roles.map((role, i) => (
            <span
              key={`${role}-${i}`}
              className="text-[13px] font-semibold text-accent bg-accent-50 border border-accent-200 px-[11px] py-1 rounded-lg"
            >
              {role}
            </span>
          ))}
        </div>
        <p className="text-sm text-slate-600 leading-[1.65] m-0 break-keep [text-wrap:pretty]">
          {roleNote}
        </p>
      </TipCard>
```

- [ ] **Step 7: 뷰모델의 중복 타입을 걷어낸다**

`src/app/report/_lib/report-content.ts` 의 `environment` 필드를 바꾼다:

```ts
  // 인라인으로 다시 적으면 스키마가 늘 때마다 여기서 어긋난다 — 스키마에서 받는다.
  environment?: SectionContent<"environment">; // 08
```

- [ ] **Step 8: ReportBody 에서 두 prop 을 내려준다**

```tsx
          {content.environment && (
            <EnvironmentSection
              energizing={content.environment.energizing}
              draining={content.environment.draining}
              summary={content.environment.summary}
              emphasis={content.environment.emphasis}
              roles={content.environment.roles}
              roleNote={content.environment.roleNote}
            />
          )}
```

- [ ] **Step 9: 픽스처를 채운다**

`report-content.fixture.ts` 의 `environment` 블록에서 `emphasis` 줄 아래에 넣는다:

```ts
    roles: ["기획", "리서치", "혼자 깊게 파는 전문 영역", "팀 안의 조율자"],
    roleNote: "방법을 스스로 정할 여지가 큰 자리일수록 강점이 잘 보이는 편이에요. 자격이나 직업명보다 이런 성격의 일을 기준으로 보는 게 잘 맞아요.",
```

- [ ] **Step 10: 검증**

Run: `npm run typecheck`
Expected: 오류 없음

Run: `npm test`
Expected: 전부 PASS

- [ ] **Step 11: 커밋**

```bash
git add -A
git commit -m "feat(report): 잘 맞는 환경에 직무 예시 팁을 더한다"
```

---

## Task 9: CTA 두 장 (09 관계 지도 · 11 궁합)

**Files:**
- Create: `src/app/report/_lib/cta.ts`, `src/app/report/_lib/cta.test.ts`, `src/app/report/_components/CtaCard.tsx`
- Modify: `src/app/report/_components/RelatingSection.tsx`, `CompatibilitySection.tsx`, `ReportBody.tsx`

**Interfaces:**
- Produces:
  - `ctaHref(path: string, isLoggedIn: boolean): string`
  - `<CtaCard title desc label href />`
  - `<RelatingSection rows={…} isLoggedIn={…} />`, `<CompatibilitySection good={…} clash={…} isLoggedIn={…} />`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `src/app/report/_lib/cta.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ctaHref } from "./cta";

describe("ctaHref", () => {
  it("로그인 상태면 목적지로 바로 보낸다", () => {
    expect(ctaHref("/map", true)).toBe("/map");
    expect(ctaHref("/match", true)).toBe("/match");
  });

  it("비로그인이면 로그인 화면을 거쳐 돌아오게 한다", () => {
    expect(ctaHref("/map", false)).toBe("/login?next=%2Fmap");
    expect(ctaHref("/match", false)).toBe("/login?next=%2Fmatch");
  });

  // 인코딩하지 않으면 next 가 쿼리 경계에서 잘린다.
  it("목적지를 인코딩한다", () => {
    expect(ctaHref("/match?from=report", false)).toBe(
      "/login?next=%2Fmatch%3Ffrom%3Dreport",
    );
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/report/_lib/cta.test.ts`
Expected: FAIL — `Cannot find module './cta'`

- [ ] **Step 3: ctaHref 를 쓴다**

Create `src/app/report/_lib/cta.ts`:

```ts
/**
 * 로그인이 필요한 화면으로 보내는 링크.
 *
 * /map·/match 둘 다 서버에서 비로그인을 로그인으로 넘기지만, 링크를 눌러 한 번
 * 튕기게 두는 것보다 처음부터 맞는 곳으로 보낸다. LockedSections 가 쓰는 형태와 같다.
 */
export function ctaHref(path: string, isLoggedIn: boolean): string {
  return isLoggedIn ? path : `/login?next=${encodeURIComponent(path)}`;
}
```

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `npx vitest run src/app/report/_lib/cta.test.ts`
Expected: 전부 PASS

- [ ] **Step 5: CtaCard 를 쓴다**

Create `src/app/report/_components/CtaCard.tsx`:

```tsx
/**
 * 섹션 끝에 붙는 다음 행동 카드. 09(관계 지도)·11(궁합)이 같은 모양을 쓴다.
 *
 * next/link 가 아니라 <a> 인 이유: /map 은 GET 이 지도 행을 만든다(멱등하지만
 * 만들긴 한다). Link 의 프리페치는 그 서버 컴포넌트를 실제로 돌리므로, 누르지도
 * 않은 사용자의 지도가 미리 생긴다.
 */
export function CtaCard({
  title,
  desc,
  label,
  href,
}: {
  title: string;
  desc: string;
  label: string;
  href: string;
}) {
  return (
    <div className="mt-3.5 bg-slate-900 rounded-2xl p-6 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[220px]">
        <div className="text-base font-bold text-white tracking-[-0.01em]">{title}</div>
        <p className="text-[13.5px] text-slate-400 mt-[5px] mb-0 leading-[1.6] break-keep [text-wrap:pretty]">
          {desc}
        </p>
      </div>
      <a
        href={href}
        className="flex-none text-sm font-semibold text-slate-900 bg-white px-5 py-3 rounded-xl hover:bg-slate-100"
      >
        {label}
      </a>
    </div>
  );
}
```

- [ ] **Step 6: RelatingSection 의 CTA 를 관계 지도로 바꾼다**

`src/app/report/_components/RelatingSection.tsx` 전체를 아래로 바꾼다:

```tsx
import { SectionHeading } from "./SectionHeading";
import { CtaCard } from "./CtaCard";
import { ctaHref } from "../_lib/cta";
import type { KeyValue } from "../_lib/report-content";

export function RelatingSection({
  rows,
  isLoggedIn,
}: {
  rows: KeyValue[];
  isLoggedIn: boolean;
}) {
  return (
    <section className="mt-[72px]">
      <SectionHeading section="relating" />
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex flex-wrap gap-x-4 gap-y-1 px-5 py-[17px] items-baseline ${
              i < rows.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <span className="flex-none w-32 text-[13px] font-semibold text-slate-400">{row.label}</span>
            <span className="flex-1 min-w-[200px] text-sm text-slate-700 leading-[1.6]">{row.value}</span>
          </div>
        ))}
      </div>
      {/* 관계 맺는 방식을 읽은 직후, 그 관계들이 실제로 어떻게 놓여 있는지로 잇는다.
          지도는 이용권을 쓰지 않아 무료로 적는다 (app/_lib/catalog.ts 와 같은 결). */}
      <CtaCard
        title="내 주변 사람들은 나에게 어떤 자리일까요?"
        desc="한 사람씩 추가하면 그 사람이 나에게 어떤 역할인지 보여요. 몇 명이든 무료예요."
        label="관계 지도 열기 →"
        href={ctaHref("/map", isLoggedIn)}
      />
    </section>
  );
}
```

- [ ] **Step 7: CompatibilitySection 에 궁합 CTA 를 붙인다**

`src/app/report/_components/CompatibilitySection.tsx` 전체를 아래로 바꾼다:

```tsx
import { SectionHeading } from "./SectionHeading";
import { CardGrid } from "./CardGrid";
import { CtaCard } from "./CtaCard";
import { ctaHref } from "../_lib/cta";

export function CompatibilitySection({
  good,
  clash,
  isLoggedIn,
}: {
  good: string[];
  clash: string[];
  isLoggedIn: boolean;
}) {
  return (
    <section className="mt-[72px]">
      <SectionHeading section="compatibility" />
      <CardGrid>
        <div className="border border-accent-200 bg-accent-50 rounded-2xl px-[22px] py-5">
          <div className="text-[13px] font-bold text-accent mb-2.5">잘 맞는 유형</div>
          <ul className="m-0 pl-[18px] text-sm text-slate-700 leading-[1.7] flex flex-col gap-1.5">
            {good.map((item, i) => (
              <li key={`${item}-${i}`}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="border border-slate-200 rounded-2xl px-[22px] py-5">
          <div className="text-[13px] font-bold text-slate-400 mb-2.5">부딪히기 쉬운 유형</div>
          <ul className="m-0 pl-[18px] text-sm text-slate-700 leading-[1.7] flex flex-col gap-1.5">
            {clash.map((item, i) => (
              <li key={`${item}-${i}`}>{item}</li>
            ))}
          </ul>
        </div>
      </CardGrid>
      {/* 위 두 카드가 이미 "어떤 유형인가" 의 답이라, 같은 질문을 다시 묻지 않는다. */}
      <CtaCard
        title="실제 상대와의 궁합이 궁금하다면"
        desc="상대방의 생년월일을 입력하면 두 사람 사이의 흐름을 볼 수 있어요."
        label="궁합 보기 →"
        href={ctaHref("/match", isLoggedIn)}
      />
    </section>
  );
}
```

- [ ] **Step 8: ReportBody 에서 isLoggedIn 을 내려준다**

```tsx
          {content.relating && <RelatingSection rows={content.relating} isLoggedIn={access.isLoggedIn} />}
```

```tsx
          {content.compatibility && (
            <CompatibilitySection
              good={content.compatibility.good}
              clash={content.compatibility.clash}
              isLoggedIn={access.isLoggedIn}
            />
          )}
```

- [ ] **Step 9: 검증**

Run: `npm run typecheck`
Expected: 오류 없음

Run: `npm test`
Expected: 전부 PASS

Run: `npm run lint`
Expected: 오류 없음

- [ ] **Step 10: 커밋**

```bash
git add -A
git commit -m "feat(report): 관계 지도·궁합 CTA 를 각 섹션에 붙인다"
```

---

## Task 10: 상품 설명에서 "올해의 흐름" 제거

리포트에 올해 운이 없어졌으므로 랜딩·홈 메뉴의 상품 설명이 거짓이 된다.

**Files:**
- Modify: `src/app/_lib/catalog.ts`
- Test: `src/app/_lib/catalog.test.ts`

**Interfaces:**
- Consumes: 없음 (문구만 바뀐다)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/_lib/catalog.test.ts` 맨 아래에 추가한다. 이 파일은 `it` 이 아니라 `test` 를 쓰고 `MENU_ITEMS` 는 이미 import 돼 있다:

```ts
// 리포트에서 세운·대운을 걷어냈다. 상품 설명이 없는 것을 팔면 안 된다.
test("리포트 설명이 운세를 약속하지 않는다", () => {
  const report = MENU_ITEMS.find((m) => m.href === "/report");
  expect(report).toBeDefined();
  expect(report!.desc).not.toMatch(/올해|운세|대운|흐름/);
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/_lib/catalog.test.ts`
Expected: FAIL — `desc` 가 `"…올해의 흐름과 잘 맞는 환경까지 한 번에 열려요."`

- [ ] **Step 3: 문구를 고친다**

`src/app/_lib/catalog.ts` 의 `full_report.desc` 를 바꾼다:

```ts
    desc: "기질과 사고방식, 강점과 성장 포인트. 결정하는 방식과 잘 맞는 환경까지 한 번에 열려요.",
```

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `npx vitest run src/app/_lib/catalog.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add -A src/app/_lib
git commit -m "fix: 리포트 상품 설명에서 없어진 운세를 걷어낸다"
```

---

## Task 11: 화면으로 최종 확인

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 검증을 돌린다**

Run: `npm run typecheck`
Expected: 오류 없음

Run: `npm test`
Expected: 전부 PASS

Run: `npm run lint`
Expected: 오류 없음

- [ ] **Step 2: 개발 서버를 띄운다**

`.claude/launch.json` 에 아래 항목이 없으면 추가한다:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 3000 }
  ]
}
```

preview_start 로 `dev` 를 띄운다 (Bash 로 서버를 돌리지 않는다).

- [ ] **Step 3: 유료 경로를 눈으로 확인한다**

`/report?paid=true` 로 이동해 확인한다:

- 섹션 머리말이 `01`부터 `13`까지 빠짐없이, 겹치지 않고 나온다
- `06 선택과 결정` 네 줄, `07 일하는 방식` 카드 다섯 장, `13 나를 잘 쓰는 법` 카드 네 장
- `08 잘 맞는 환경` 아래 TIP 카드에 직무 칩과 한 줄 설명이 있다
- `09` 끝의 CTA 버튼이 `/map` 을 가리킨다
- `11` 끝의 CTA 버튼이 `/match` 를 가리킨다
- `올해의 운`·`대운` 섹션이 없다
- `01` 의 "근거 자세히 보기" 를 펼치면 "대운 흐름 · 10년 주기" 스트립은 그대로 있다

read_console_messages 로 오류가 없는지 확인한다.

- [ ] **Step 4: 무료 경로를 확인한다**

`/report` (쿼리 없이) 로 이동해 확인한다:

- 무료 섹션 `01`~`04` 가 보인다
- 잠금 목록이 9개이고 번호가 `05`~`13` 이다
- 잠금 목록의 카테고리·제목이 유료 화면의 머리말과 같다

- [ ] **Step 5: 스크린샷을 남기고 마무리한다**

computer screenshot 으로 유료 경로 상단과 신규 3섹션을 찍어 사용자에게 보여준다.

---

## Self-Review

**스펙 커버리지**

| 스펙 항목 | 태스크 |
| --- | --- |
| 최종 13섹션 구성·순서 | 2(10개) → 5(11) → 6(12) → 7(13) |
| 번호·제목 단일 출처 | 3 |
| `axisSchema`/`axisRows` | 4 |
| 06 선택과 결정 | 5 |
| 07 일하는 방식 | 6 |
| 13 나를 잘 쓰는 법 | 7 |
| 08 환경 직무 팁 | 8 |
| 09 관계 지도 CTA / 11 궁합 CTA | 9 |
| luck 축 제거 + 0033 마이그레이션 | 2 |
| 세운·대운 화면 제거 | 1 |
| `sewunPillars`·근거 패널 대운 스트립 유지 | 1(명시), 2(Step 5 명시) |
| 검증 (typecheck/test/lint/migrate/화면) | 각 태스크 + 11 |

스펙에 없던 항목 하나를 추가했다 — **Task 10**. `src/app/_lib/catalog.ts` 의 리포트 상품 설명이 "올해의 흐름"을 약속하고 있어, 운세를 빼면 랜딩이 없는 것을 파는 상태가 된다.

**타입 일관성**

- `SectionHeadingMeta` — Task 3에서 정의, Task 3의 `LockedSections`·`ReportBody` 에서 사용. 컴포넌트 `SectionHeading` 과 이름이 겹치지 않는다.
- `sectionHeading(key)` / `paidSectionHeadings()` — Task 3에서 정의, 이후 모든 섹션 컴포넌트가 `<SectionHeading section={key} />` 로 간접 사용.
- `axisSchema` / `axisRows` / `axisPromptLines` — Task 4에서 정의, Task 5·6에서 사용. `axisRows(AXES, content)` 의 `content` 타입은 `SectionContent<"decisions">` = `Record<keyof typeof DECISION_AXES, string>` 로 맞는다.
- `DecisionsContent` / `WorkStyleContent` — Task 5·6에서 `report-content.ts` 에 정의, 같은 태스크의 컴포넌트가 사용.
- `ctaHref` / `CtaCard` — Task 9 안에서 정의·사용.
- `TipCard` — Task 8 안에서 정의·사용.
- `produceSections` 의 `ProduceDeps` 축소(Task 2)는 호출부 두 곳(`api/saju/route.ts`, `report/page.tsx`)을 같은 태스크에서 함께 고친다.
