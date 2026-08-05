# overview · personality 병합 (traits) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 히어로 키워드 칩과 01 핵심 성향 카드를 `overview.traits` 한 배열에서 파생시켜, 둘이 어긋나는 것이 스키마상 불가능하게 만든다.

**Architecture:** `SECTIONS` 의 키 하나 = LLM 호출 한 번 = DB 한 행이다. `overview` 와 `personality` 가 별개 키라 두 호출이 서로를 못 봐서 어긋난다. 두 키를 `overview` 하나로 합치고 성향을 `traits: TraitNote[]`(정확히 4개)로 표현한다. 화면 분리는 `to-report-content.ts` 한 곳에서 `traits` 를 `keywords`(= `title` 목록)와 `personality`(= 카드)로 풀어 유지한다. 카드 본문은 `body`(쉬운 말) + `basis`(사주 근거)로 나눠 흐름과 용어 허용 범위를 스키마로 고정한다.

**Tech Stack:** TypeScript, zod 4.4.3, Next.js, vitest, Tailwind

## Global Constraints

- 설계 문서: `docs/superpowers/specs/2026-08-05-overview-traits-merge-design.md`
- `traits` 는 **정확히 4개** (`z.array(TraitNote).length(4)`).
- `TraitNote` 의 세 필드 역할: `title` = 히어로 칩 겸 카드 제목(사주 용어 금지), `body` = 쉬운 말(사주 용어 금지), `basis` = 사주 근거 한 문장(**레지스트리 전체에서 사주 용어가 허용되는 유일한 자리**).
- `basis` 는 `body` 뒤에 이어붙여 읽어도 말이 되는 종결("~해서 그래요", "~라 그래요")이어야 한다.
- 레지스트리의 `example` 문자열에는 **숫자가 하나도 들어가면 안 된다** (`registry.test.ts:34` 가 `/\d/` 로 막는다).
- 옛 `section_key='personality'` DB 행은 삭제하지 않는다. `store.ts:54` 의 `isSectionKey` 가 걸러 무해하다.
- `design/project/*.dc.html` 목업은 이번 범위 밖 — 건드리지 않는다.
- 검증 명령: `npm run test` (vitest run), `npm run typecheck` (tsc --noEmit), `npm run lint`.

## File Structure

| 파일 | 책임 | 태스크 |
| --- | --- | --- |
| `src/app/api/saju/_lib/sections/primitives.ts` | 공용 잎 스키마. `TraitNote` 추가 | 1 |
| `src/app/api/saju/_lib/sections/registry.ts` | 섹션 정의. `overview` 를 traits 로, 이후 `personality` 삭제 | 2, 3 |
| `src/app/report/_lib/report-content.ts` | 화면 뷰모델 타입. `personality: TraitNote[]` | 2 |
| `src/app/report/_lib/to-report-content.ts` | traits → keywords + personality 분해 (유일한 조립 지점) | 2 |
| `src/app/report/_lib/report-content.fixture.ts` | `/report` 데모 샘플 | 2 |
| `src/app/api/saju/_lib/generate.ts` | StubGenerator 자리표시자 | 2, 3 |
| `src/app/report/_components/PersonalitySection.tsx` | 01 카드. `basis` 렌더 추가 | 4 |

**태스크 경계의 근거:** 레지스트리에서 키를 지우면 `Interpretation` 타입이 바뀌어 12개 파일의 타입이 한꺼번에 깨진다. 그래서 "`overview` 를 traits 로 바꾸기"(Task 2)와 "`personality` 키 지우기"(Task 3)를 나눈다. Task 2 가 끝난 시점에 `personality` 키는 레지스트리에 남아 있지만 화면은 이미 `traits` 를 쓴다 — 한 커밋 동안만 존재하는 죽은 키이고, 그 사이에도 테스트·타입체크는 전부 통과한다.

---

### Task 1: `TraitNote` 프리미티브

**Files:**
- Modify: `src/app/api/saju/_lib/sections/primitives.ts`
- Test: `src/app/api/saju/_lib/sections/primitives.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `TraitNote` — zod 스키마 겸 타입. `{ title: string; body: string; basis: string }`, `.strict()`, 세 필드 모두 `.min(1)`. Task 2 의 `overview.schema` 와 Task 2 의 `ReportContent.personality` 가 이 이름을 그대로 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/saju/_lib/sections/primitives.test.ts` 의 import 줄을 바꾸고, 마지막 `it` 블록 뒤(`describe` 닫는 괄호 앞)에 테스트를 추가한다.

import 줄 교체:

```ts
import { KeyValue, LabeledText, TimelineNote, TitledText, TraitNote } from "./primitives";
```

추가할 테스트:

```ts
  // basis 는 사주 근거가 들어가는 유일한 필드다. 이게 옵셔널이면 LLM 이
  // 그냥 빼먹고, 카드가 "왜 그런지" 없이 단정만 남는다.
  it("TraitNote 는 title/body/basis 를 모두 요구한다", () => {
    const ok = { title: "신중한 관찰자", body: "본문", basis: "근거" };
    expect(TraitNote.safeParse(ok).success).toBe(true);
    expect(TraitNote.safeParse({ title: "제목", body: "본문" }).success).toBe(false);
    expect(TraitNote.safeParse({ ...ok, basis: "" }).success).toBe(false);
    expect(TraitNote.safeParse({ ...ok, extra: 1 }).success).toBe(false);
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/primitives.test.ts`
Expected: FAIL — `TraitNote` 가 없어 `SyntaxError` 또는 `TraitNote is not defined`

- [ ] **Step 3: 최소 구현**

`src/app/api/saju/_lib/sections/primitives.ts` 의 `TitledText` 블록 바로 뒤에 추가한다.

```ts
/**
 * 키워드 제목 + 쉬운 말 본문 + 사주 근거 한 줄 — 01 핵심 성향.
 *
 * title 은 히어로의 키워드 칩으로도 그대로 렌더된다(to-report-content.ts).
 * 한 문자열이 두 자리에 쓰이므로 칩과 카드 제목이 갈라질 수 없다.
 *
 * basis 는 레지스트리 전체에서 사주 용어가 허용되는 유일한 자리다
 * (system.ts 의 "섹션 지시문이 명시적으로 요구하면" 예외).
 */
export const TraitNote = z
  .object({
    title: z.string().min(1),
    body: z.string().min(1),
    basis: z.string().min(1),
  })
  .strict();
export type TraitNote = z.infer<typeof TraitNote>;
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/primitives.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/saju/_lib/sections/primitives.ts src/app/api/saju/_lib/sections/primitives.test.ts
git commit -m "feat(sections): 성향 카드용 TraitNote 프리미티브를 추가한다"
```

---

### Task 2: `overview` 를 traits 로 교체하고 화면 배선을 옮긴다

`personality` 키는 이 태스크에서 **지우지 않는다** (Task 3). 화면만 먼저 `traits` 를 쓰게 만든다.

**Files:**
- Modify: `src/app/api/saju/_lib/sections/registry.ts:41-56` (overview 블록)
- Modify: `src/app/report/_lib/report-content.ts:9-10, 52`
- Modify: `src/app/report/_lib/to-report-content.ts:56-59`
- Modify: `src/app/report/_lib/report-content.fixture.ts:1-17`
- Modify: `src/app/api/saju/_lib/generate.ts:28-32`
- Test: `src/app/api/saju/_lib/sections/registry.test.ts:52-56`
- Test: `src/app/report/_lib/to-report-content.test.ts:10-24, 45-50`
- Test: `src/app/api/saju/_lib/sections/derive.test.ts:37, 105-110`
- Test: `src/app/api/saju/_lib/handler.test.ts:16, 124-125, 143-147, 163-173, 182-187`
- Test: `src/app/api/saju/_lib/produce.test.ts:10`
- Test: `src/app/api/saju/_lib/store.test.ts:13, 26, 32, 192`

**Interfaces:**
- Consumes: `TraitNote` (Task 1)
- Produces:
  - `SECTIONS.overview.schema` → `{ headline: string; summary: string; traits: TraitNote[] }`, `version: 2`
  - `ReportContent.personality: TraitNote[]` — Task 4 가 `item.basis` 를 읽는다
  - `ReportContent.keywords: string[]` — 변경 없음. 값이 `traits.map(t => t.title)` 로 바뀔 뿐

- [ ] **Step 1: 레지스트리 테스트를 실패하게 고친다**

`src/app/api/saju/_lib/sections/registry.test.ts:52-56` 의 `it("overview 는 키워드 3~6개를 요구한다", ...)` 블록 전체를 아래로 교체한다.

```ts
  it("overview 는 traits 를 정확히 4개 요구한다", () => {
    const trait = { title: "t", body: "b", basis: "근거" };
    const four = [trait, trait, trait, trait];
    const ok = { headline: "h", summary: "s", traits: four };
    expect(SECTIONS.overview.schema.safeParse(ok).success).toBe(true);
    expect(SECTIONS.overview.schema.safeParse({ ...ok, traits: four.slice(1) }).success).toBe(false);
    expect(SECTIONS.overview.schema.safeParse({ ...ok, traits: [...four, trait] }).success).toBe(false);
  });

  // basis 가 없으면 "쉬운 말 → 사주 근거" 흐름이 무너진 채로 통과해버린다.
  it("overview 의 trait 은 basis 없이는 통과하지 않는다", () => {
    const trait = { title: "t", body: "b", basis: "근거" };
    const noBasis = { title: "t", body: "b" };
    const bad = { headline: "h", summary: "s", traits: [noBasis, trait, trait, trait] };
    expect(SECTIONS.overview.schema.safeParse(bad).success).toBe(false);
  });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/registry.test.ts`
Expected: FAIL — 새 테스트 2개가 실패한다 (아직 스키마가 `keywords` 를 요구한다)

- [ ] **Step 3: 레지스트리의 `overview` 를 교체한다**

`src/app/api/saju/_lib/sections/registry.ts:2` 의 import 에 `TraitNote` 를 넣는다.

```ts
import { KeyValue, LabeledText, TimelineNote, TitledText, TraitNote } from "./primitives";
```

`registry.ts:41-56` 의 `overview` 블록 전체를 아래로 교체한다.

```ts
  overview: {
    version: 2,
    tier: "free",
    storage: "chart",
    // traits 하나가 히어로 키워드 칩과 01 카드 양쪽을 채운다. 두 섹션으로
    // 나뉘어 있던 시절엔 호출이 따로 나가 칩과 카드가 어긋났다.
    schema: z
      .object({
        headline: z.string().min(1),
        summary: z.string().min(1),
        traits: z.array(TraitNote).length(4),
      })
      .strict(),
    // basis 는 사주 용어를 쓰는 유일한 자리다. 시스템 프롬프트의 "용어 금지"에
    // 대한 명시적 예외라, 이 지시문을 지우면 리포트 전체에서 용어가 사라진다.
    prompt: [
      "타고난 기질 전체를 한 줄 헤드라인(headline)과 3~4문장 요약(summary)으로 정리하고,",
      "성향을 대표하는 서로 겹치지 않는 관점 4개를 traits 로 써라. 각 trait 은 세 부분이다.",
      "- title: 그 관점을 한눈에 보여주는 짧은 말. 그대로 키워드로 노출되므로 사주 용어를 쓰지 말고, 성격을 바로 알아볼 수 있는 말로 짧게 쓴다.",
      "- body: 그 성향이 일상에서 어떻게 드러나는지 2~3문장. 여기서도 사주 용어를 쓰지 마라.",
      '- basis: 그 성향의 사주 근거 한 문장. 이 필드에서만 사주 용어를 써도 된다 — 일간·십성·오행을 자연스럽게 녹이되 나열하거나 강의하지 마라. body 뒤에 이어붙여 읽어도 말이 되도록 "~해서 그래요", "~라 그래요" 처럼 앞 문장을 받는 종결로 쓴다.',
    ].join("\n"),
    example:
      '{"headline":"겉으로는 차분하지만, 자신만의 기준과 승부욕이 강한 사람","summary":"사람들과 잘 어울리지만, 혼자 생각을 정리하는 시간이 꼭 필요한 타입이에요.","traits":[{"title":"신중한 관찰자","body":"상황을 먼저 파악한 뒤 움직여요. 말보다 판단이 앞서는 이유예요.","basis":"일간 갑목이 인월의 단단한 뿌리 위에 서 있어서 그래요."}]}',
  },
```

`example` 에 숫자가 없는지 눈으로 한 번 더 확인한다 — `registry.test.ts:34` 가 막는다.

- [ ] **Step 4: 레지스트리 테스트 통과를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/sections/registry.test.ts`
Expected: PASS

- [ ] **Step 5: 조립 테스트를 실패하게 고친다**

`src/app/report/_lib/to-report-content.test.ts:10-16` 의 `free` 정의 위에 `traits` 를 추가하고 `overview`·`personality` 줄을 바꾼다.

```ts
const traits = [1, 2, 3, 4].map((n) => ({
  title: `t${n}`,
  body: `b${n}`,
  basis: `근거${n}`,
}));

const free: Partial<Interpretation> = {
  overview: { headline: "헤드라인", summary: "요약", traits },
  outerVsInner: { outward: "겉", inner: "속" },
  strengths: [{ title: "s", body: "b" }, { title: "s2", body: "b2" }],
  cautions: { items: ["주의1", "주의2"], tip: "팁" },
};
```

`to-report-content.test.ts:19-24` 의 `it("overview 를 상단 필드로 편다", ...)` 블록을 아래 세 블록으로 교체한다.

```ts
  it("overview 를 상단 필드로 편다", () => {
    const c = toReportContent(analysis, free, meta, 2026);
    expect(c.headline).toBe("헤드라인");
    expect(c.summary).toBe("요약");
  });

  // 이 테스트가 병합의 목적 그 자체다. 칩과 카드 제목이 갈라지면 여기서 깨진다.
  it("히어로 키워드는 traits 의 제목과 원소·순서까지 같다", () => {
    const c = toReportContent(analysis, free, meta, 2026);
    expect(c.keywords).toEqual(["t1", "t2", "t3", "t4"]);
    expect(c.keywords).toEqual(c.personality.map((p) => p.title));
  });

  it("01 카드는 traits 를 basis 까지 그대로 쓴다", () => {
    const c = toReportContent(analysis, free, meta, 2026);
    expect(c.personality).toEqual(traits);
  });
```

`to-report-content.test.ts:45-50` 의 빈 해석 테스트에 `keywords` 확인을 한 줄 더한다.

```ts
  it("해석이 아예 비어도 무료 필드는 빈 값으로 성립한다", () => {
    const c = toReportContent(analysis, {}, meta, 2026);
    expect(c.headline).toBe("");
    expect(c.keywords).toEqual([]);
    expect(c.personality).toEqual([]);
    expect(c.evidence.pillars.length).toBeGreaterThan(0);
  });
```

- [ ] **Step 6: 실패를 확인한다**

Run: `npx vitest run src/app/report/_lib/to-report-content.test.ts`
Expected: FAIL — `c.keywords` 가 `undefined ?? []` 로 빈 배열이라 `["t1".."t4"]` 와 다르다

- [ ] **Step 7: 뷰모델 타입과 조립을 고친다**

`src/app/report/_lib/report-content.ts:9-10` 의 import/재수출에 `TraitNote` 를 넣는다.

```ts
import type { TitledText, LabeledText, KeyValue, TraitNote } from "@/app/api/saju/_lib/sections";
export type { TitledText, LabeledText, KeyValue, TraitNote } from "@/app/api/saju/_lib/sections";
```

`report-content.ts:52` 를 바꾼다.

```ts
  personality: TraitNote[];         // 01 — keywords 와 같은 traits 에서 나온다
```

`src/app/report/_lib/to-report-content.ts:56-59` 의 네 줄을 바꾼다.

```ts
    headline: overview?.headline ?? "",
    summary: overview?.summary ?? "",
    // 칩과 카드가 같은 배열에서 나온다 — 두 값이 갈라질 수 없다.
    keywords: overview?.traits.map((t) => t.title) ?? [],
    personality: overview?.traits ?? [],
```

- [ ] **Step 8: 조립 테스트 통과를 확인한다**

Run: `npx vitest run src/app/report/_lib/to-report-content.test.ts`
Expected: PASS

- [ ] **Step 9: 데모 픽스처를 traits 로 다시 쓴다**

`src/app/report/_lib/report-content.fixture.ts:1-3` 의 머리 주석을 바꾼다.

```ts
// /report 데모 화면이 그리는 샘플. 문구는 프롬프트(sections/registry.ts)가 뽑아낼
// 결과와 같은 규칙을 따른다 — traits 의 basis 와 evidence(근거 차트)에서만 사주
// 용어를 쓰고, 나머지는 용어 없이 쉬운 말로 쓴다.
```

`report-content.fixture.ts:12-17` 의 `keywords` + `personality` 를 아래로 교체한다. `keywords` 는 `personality` 의 `title` 과 글자까지 같아야 한다 — 실제 코드가 그렇게 파생시키므로, 픽스처가 어긋나면 데모만 거짓말을 하게 된다.

```ts
  keywords: ["신중한 관찰자", "독립적인 판단", "오래 밀고 나감", "느린 속마음"],
  personality: [
    {
      title: "신중한 관찰자",
      body: "상황을 먼저 파악한 뒤 움직여요. 말보다 판단이 앞서는 이유예요.",
      basis: "일간 갑목이 인월의 단단한 뿌리 위에 서 있어서 그래요.",
    },
    {
      title: "독립적인 판단",
      body: "남의 의견은 듣지만, 최종 결정은 스스로 내려야 마음이 편한 편이에요.",
      basis: "비견이 둘이라 자기 기준이 뚜렷하게 서 있어서 그래요.",
    },
    {
      title: "오래 밀고 나감",
      body: "방향이 정해지면 쉽게 흔들리지 않아요. 다만 방향을 정하기까지가 오래 걸리죠.",
      basis: "정인이 일간을 꾸준히 받쳐주는 구조라 그래요.",
    },
    {
      title: "느린 속마음",
      body: "마음을 여는 데 시간이 걸려요. 가까워진 뒤에야 진짜 이야기가 나오는 편이에요.",
      basis: "일지의 기운이 안으로 갈무리되는 자리라 그래요.",
    },
  ],
```

- [ ] **Step 10: 스텁 생성기를 고친다**

`src/app/api/saju/_lib/generate.ts:28-32` 의 `overview` 를 아래로 교체한다. `personality` 항목은 그대로 둔다 (Task 3 에서 지운다).

```ts
      overview: {
        headline: `일간 ${dm} — 자리표시자 헤드라인`,
        summary: `일간이 ${dm}인 사주입니다. 실제 LLM 연동 전 자리표시자 요약입니다.`,
        traits: [1, 2, 3, 4].map((n) => ({
          title: `${dm} 성향 ${n}`,
          body: "자리표시자 본문입니다.",
          basis: "자리표시자 근거입니다.",
        })),
      },
```

- [ ] **Step 11: 나머지 테스트의 overview 픽스처를 traits 로 바꾼다**

`src/app/api/saju/_lib/produce.test.ts:10` 을 교체한다.

```ts
const trait = { title: "t", body: "b", basis: "근거" };
const overview = { headline: "캐시", summary: "캐시된 요약", traits: [trait, trait, trait, trait] };
```

`src/app/api/saju/_lib/handler.test.ts:16` 을 같은 두 줄로 교체한다.

```ts
const trait = { title: "t", body: "b", basis: "근거" };
const overview = { headline: "캐시", summary: "캐시된 요약", traits: [trait, trait, trait, trait] };
```

`handler.test.ts` 안에서 `{ headline: "h", summary: "s", keywords: ["a", "b", "c"] }` 로 쓰인 세 곳(143-147 블록, 163-173 블록, 182-187 블록)을 `{ headline: "h", summary: "s", traits: [trait, trait, trait, trait] }` 로 바꾼다. 172-173 의 `toEqual` 기대값도 같은 모양으로 바꾼다.

`handler.test.ts:124` 의 주석을 바꾼다.

```ts
        // traits 가 빠져 overview 스키마를 통과하지 못한다.
```

`src/app/api/saju/_lib/sections/derive.test.ts:37` 을 바꾼다.

```ts
    expect(sectionVersion("overview")).toBe(2);
```

`derive.test.ts` 의 `describe("llmInputSchema")` 안, "배열 섹션도 content 한 겹으로 감싸진다" 블록 뒤에 테스트를 하나 더한다. 개수가 tool 스키마까지 내려가지 않으면 LLM 이 4개를 지킬 이유가 없다.

```ts
  it("overview 의 traits 개수가 tool 스키마에 실린다", () => {
    const s = llmInputSchema("overview") as {
      properties: { content: { properties: { traits: { minItems: number; maxItems: number } } } };
    };
    expect(s.properties.content.properties.traits.minItems).toBe(4);
    expect(s.properties.content.properties.traits.maxItems).toBe(4);
  });
```

`derive.test.ts:105-110` 의 `it("기존 키를 덮어쓴다 ...")` 블록 본문을 바꾼다.

```ts
  it("기존 키를 덮어쓴다 (재대입도 직접 대입과 동일)", () => {
    const trait = { title: "t", body: "b", basis: "근거" };
    const four = [trait, trait, trait, trait];
    const target: Partial<Interpretation> = {
      overview: { headline: "old", summary: "s", traits: four },
    };
    const next = { headline: "new", summary: "s2", traits: four };
    assign(target, "overview", next);
    expect(target.overview).toEqual(next);
  });
```

- [ ] **Step 12: store 테스트가 버전 2를 따라가게 고친다**

`store.test.ts:26` 의 `row()` 는 `schema_version` 기본값이 `1` 로 박혀 있다. `overview` 가 2가 되면 그 행들이 전부 "버전 불일치"로 버려져 관계없는 테스트가 무더기로 깨진다. 레지스트리에서 파생하도록 바꿔 다음 버전 업에도 견디게 한다.

`store.test.ts:13` 의 import 를 바꾼다.

```ts
import { isSectionKey, sectionVersion, type SectionKey } from "./sections";
```

`store.test.ts:26-30` 을 바꾼다.

```ts
// schema_version 기본값은 레지스트리에서 가져온다 — 여기 1 을 박아 두면
// 어떤 섹션의 version 이 올라갈 때마다 무관한 테스트가 무더기로 깨진다.
const row = (
  section_key: string,
  content: unknown,
  schema_version = isSectionKey(section_key) ? sectionVersion(section_key) : 1,
) => ({
  section_key,
  content,
  schema_version,
});
```

`store.test.ts:32` 를 바꾼다.

```ts
const trait = { title: "t", body: "b", basis: "근거" };
const overview = { headline: "h", summary: "s", traits: [trait, trait, trait, trait] };
```

`store.test.ts:192` 를 바꾼다.

```ts
    expect(calls[0].values).toContain(sectionVersion("overview"));
```

- [ ] **Step 13: 전체 검증**

Run: `npm run test`
Expected: PASS (실패가 남으면 그 파일의 `overview` 픽스처에 아직 `keywords` 가 남아 있는 것이다)

Run: `npm run typecheck`
Expected: 출력 없음 (성공)

Run: `npm run lint`
Expected: 오류 없음

- [ ] **Step 14: 커밋**

```bash
git add -A
git commit -m "feat(sections): overview 를 traits 로 바꿔 히어로 칩과 01 카드를 한 배열에서 뽑는다"
```

---

### Task 3: `personality` 키를 지운다

**Files:**
- Modify: `src/app/api/saju/_lib/sections/registry.ts:58-69` (personality 블록 삭제)
- Modify: `src/app/api/saju/_lib/generate.ts:33-36` (StubGenerator 의 personality 삭제)
- Modify: `src/app/api/saju/_lib/sections/derive.ts:58` (주석)
- Modify: `src/app/api/saju/_lib/store.ts:84-85` (주석)
- Modify: `src/app/home/_lib/to-profile-card.ts:5-7` (주석)
- Test: `src/app/api/saju/_lib/sections/registry.test.ts:7-10, 45-50, 58-63`
- Test: `src/app/api/saju/_lib/sections/derive.test.ts:54, 84, 118`
- Test: `src/app/api/saju/_lib/prompt/index.test.ts:24, 26, 66`
- Test: `src/app/api/saju/_lib/prompted.test.ts:14, 23, 26, 32, 37, 40, 50`
- Test: `src/app/api/saju/_lib/handler.test.ts:58, 59, 65, 72, 73, 77, 105, 106, 139, 140, 145, 146, 185, 186`
- Test: `src/app/api/saju/_lib/produce.test.ts:63, 64`
- Test: `src/app/api/saju/_lib/store.test.ts:198, 199`
- Test: `src/app/api/saju/_lib/deepseek.test.ts:6, 147`
- Test: `src/app/api/saju/_lib/generate.test.ts:10`
- Test: `src/app/home/_lib/to-profile-card.test.ts:25-32`

**Interfaces:**
- Consumes: Task 2 의 `SECTIONS.overview`
- Produces: `SectionKey` 유니온에서 `"personality"` 제거. `SECTION_KEYS.length === 12`, `FREE_SECTION_KEYS.length === 4`.

**치환 규칙:** 위 테스트 대부분은 `personality` 를 "배열 섹션 아무거나"라는 **샘플로만** 쓴다. 이들은 `strengths` 로 바꾼다 — `strengths` 도 `z.array(TitledText).min(2).max(4)` 로 모양이 완전히 같아서 테스트 의도(배열이다 / 개수를 안 건드린다 / 짝이 안 맞으면 컴파일 에러다)가 그대로 보존된다. `personality` 를 `overview` 로 바꾸면 안 된다 — `overview` 는 객체 섹션이라 "배열 섹션" 을 검사하는 테스트가 무의미해진다.

- [ ] **Step 1: 카운트 핀 테스트를 먼저 고쳐 실패하게 만든다**

`src/app/home/_lib/to-profile-card.test.ts:25-32` 를 교체한다.

```ts
describe("섹션 개수", () => {
  // 레지스트리에서 파생되므로 하드코딩이 아니다. 이 테스트는 티어가 실수로
  // 바뀌었을 때(무료 섹션을 유료로 돌리는 등) 알아채기 위한 핀이다.
  it("현재 레지스트리는 총 12개 / 무료 4개", () => {
    expect(TOTAL_SECTIONS).toBe(12);
    expect(FREE_SECTIONS).toBe(4);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/home/_lib/to-profile-card.test.ts`
Expected: FAIL — `expected 13 to be 12`

- [ ] **Step 3: 레지스트리에서 `personality` 를 지운다**

`src/app/api/saju/_lib/sections/registry.ts:58-69` 의 `personality: { ... },` 블록 전체(앞뒤 빈 줄 포함)를 삭제한다. `overview` 다음이 바로 `outerVsInner` 가 된다.

`src/app/api/saju/_lib/generate.ts:33-36` 의 `personality: [ ... ],` 네 줄을 삭제한다.

- [ ] **Step 4: 카운트 테스트 통과를 확인한다**

Run: `npx vitest run src/app/home/_lib/to-profile-card.test.ts`
Expected: PASS

- [ ] **Step 5: 레지스트리 테스트를 고친다**

`src/app/api/saju/_lib/sections/registry.test.ts:7-10` 을 바꾼다.

```ts
  // 상단 히어로 + 01 은 overview 하나가 겸한다. 이 수가 곧 /home 의 "N개 중 M개 열림"이다.
  it("섹션 12개", () => {
    expect(entries).toHaveLength(12);
  });
```

`registry.test.ts:45-50` 을 바꾼다.

```ts
  it("무료는 4개 (히어로+01 겸용 overview, 02~04)", () => {
    const free = entries.filter(([, s]) => s.tier === "free").map(([k]) => k);
    expect(free.sort()).toEqual(["cautions", "outerVsInner", "overview", "strengths"]);
  });
```

`registry.test.ts:58-63` 의 `it("personality 는 TitledText 배열", ...)` 블록 전체를 삭제한다 (같은 성질을 Task 2 의 overview traits 테스트가 검사한다).

- [ ] **Step 6: derive 테스트의 샘플을 `strengths` 로 바꾼다**

`src/app/api/saju/_lib/sections/derive.test.ts:53-56` 을 바꾼다.

```ts
  it("배열 섹션도 content 한 겹으로 감싸진다", () => {
    const s = llmInputSchema("strengths") as { properties: { content: { type: string } } };
    expect(s.properties.content.type).toBe("array");
  });
```

`derive.test.ts:84` 의 `it` 제목에서 `personality` 를 `strengths` 로 바꾼다.

```ts
  it("luck 이 아닌 섹션은 그대로 둔다 — 배열 섹션(strengths 등)이라도 자기 자신의 min/max 를 건드리면 안 된다", () => {
```

`derive.test.ts:118` 을 바꾼다.

```ts
    expect(parseSectionContent("strengths", "문자열")).toBeNull();
```

- [ ] **Step 7: 프롬프트 테스트의 샘플을 `strengths` 로 바꾼다**

`src/app/api/saju/_lib/prompt/index.test.ts:23-28` 을 바꾼다.

```ts
  it("user 프롬프트에 사실 블록 · 지시문 · 문체 예시가 다 들어간다", () => {
    const req = buildSectionRequest(analysis, "strengths", ctx);
    expect(req.user).toContain("[사실 · 원국]");
    expect(req.user).toContain("[요청 · strengths]");
    expect(req.user).toContain("[문체 예시]");
  });
```

`prompt/index.test.ts:64-70` 을 바꾼다.

```ts
  // 배열 섹션 전부의 min/max 를 덮어쓴 적이 있다 (derive.ts:llmInputSchemaWithRows 주석).
  it("개수 고정은 세운·대운에만 적용된다", () => {
    const req = buildSectionRequest(analysis, "strengths", ctx);
    expect(contentSchema(req).minItems).toBe(2);
    expect(contentSchema(req).maxItems).toBe(4);
    expect(req.user).not.toContain("항목은 정확히");
  });
```

- [ ] **Step 8: PromptedGenerator 테스트의 샘플을 바꾼다**

`src/app/api/saju/_lib/prompted.test.ts` 에서 `personality` 를 `strengths` 로, 기존 `strengths` 자리는 `cautions` 로 옮긴다 (두 개의 서로 다른 키가 필요한 테스트라 이름이 겹치면 안 된다). 바뀌는 블록은 넷이다.

```ts
  it("요청한 섹션마다 transport 를 한 번씩 부른다", async () => {
    const transport = vi.fn(ok);
    const keys: SectionKey[] = ["strengths", "cautions"];
    await new PromptedGenerator("test", transport).generateSections(analysis, keys, ctx);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls.map(([req]) => req.key).sort()).toEqual([...keys].sort());
  });

  it("content 를 벗겨서 돌려준다", async () => {
    const out = await new PromptedGenerator("test", ok).generateSections(
      analysis,
      ["strengths"],
      ctx,
    );
    expect(out.strengths).toEqual([{ title: "t", body: "b" }]);
  });

  it("한 섹션이 실패해도 나머지는 살린다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const transport: SectionTransport = async (req) => {
      if (req.key === "cautions") throw new Error("boom");
      return { content: [{ title: "t", body: "b" }] };
    };
    const out = await new PromptedGenerator("test", transport).generateSections(
      analysis,
      ["strengths", "cautions"],
      ctx,
    );
    expect(Object.keys(out)).toEqual(["strengths"]);
    warn.mockRestore();
  });

  // { content } 로 감싸지 않은 응답은 계약 위반이다. 통째로 담으면
  // handleSaju 의 스키마 검증에서 어차피 떨어지지만, 여기서 먼저 버린다.
  it("content 로 감싸지 않은 응답은 버린다", async () => {
    const transport: SectionTransport = async () => [{ title: "t", body: "b" }];
    const out = await new PromptedGenerator("test", transport).generateSections(
      analysis,
      ["strengths"],
      ctx,
    );
    expect(out).toEqual({});
  });
```

- [ ] **Step 9: 나머지 테스트의 샘플 키를 바꾼다**

`src/app/api/saju/_lib/handler.test.ts` — 문자열 `"personality"` 를 전부 `"strengths"` 로 바꾼다 (58, 59, 65, 72, 73, 77, 105, 106, 139, 140, 185, 186행). 145-146 의 주석과 값도 바꾼다.

```ts
          // strengths 는 TitledText[] 여야 하는데 객체를 줬다.
          strengths: { title: "t", body: "b" },
```

185-186 의 주석과 값도 바꾼다.

```ts
          // strengths 는 요청(sectionKeys/missing)에 없었다.
          strengths: [{ title: "t", body: "b" }],
```

77행의 정렬 기대값은 `["overview", "strengths"]` 가 된다.

`src/app/api/saju/_lib/produce.test.ts:63-64` 의 `"personality"` 두 곳을 `"strengths"` 로 바꾼다.

`src/app/api/saju/_lib/store.test.ts:198-199` 를 바꾼다.

```ts
    // @ts-expect-error strengths 의 content 는 TitledText[] 이지 객체가 아니다
    const bad: SectionWrite = { sectionKey: "strengths", content: { title: "t", body: "b" } };
```

`src/app/api/saju/_lib/deepseek.test.ts:6` 을 `key: "strengths",` 로, `:147` 을 `expect(onUsage).toHaveBeenCalledWith("strengths", usage);` 로 바꾼다.

`src/app/api/saju/_lib/generate.test.ts:10` 을 바꾼다.

```ts
    const keys: SectionKey[] = ["overview", "strengths"];
```

- [ ] **Step 10: 남은 주석 세 곳을 고친다**

`src/app/api/saju/_lib/sections/derive.ts:58` 을 바꾼다.

```ts
 * luck 저장소인 이 둘 말고는 손대면 안 된다 — strengths 등 다른 배열 섹션까지
```

`src/app/api/saju/_lib/store.ts:84-85` 를 바꾼다.

```ts
 * { sectionKey: "strengths", content: { title, body } } 는 컴파일 에러 —
 * strengths 는 배열이다.
```

`src/app/home/_lib/to-profile-card.ts:5-7` 의 예시 숫자를 바꾼다.

```ts
/**
 * 화면 문구의 숫자는 섹션 레지스트리에서 파생한다 — 섹션을 추가하거나 티어를
 * 바꿔도 "12개 중 4개 열림"이 저절로 따라간다.
 */
```

- [ ] **Step 11: 전체 검증**

Run: `npm run test`
Expected: PASS

Run: `npm run typecheck`
Expected: 출력 없음. `personality` 가 남아 있으면 `Type '"personality"' is not assignable to type 'SectionKey'` 로 잡힌다.

Run: `npm run lint`
Expected: 오류 없음

레지스트리에 `personality` 문자열이 하나도 안 남았는지 확인한다.

Run: `git grep -n "personality" -- src ':!src/app/report'`
Expected: 결과 없음

- [ ] **Step 12: 커밋**

```bash
git add -A
git commit -m "refactor(sections): personality 키를 지우고 샘플 테스트를 strengths 로 옮긴다"
```

---

### Task 4: 01 카드에 `basis` 를 렌더한다

이 프로젝트에는 컴포넌트 테스트가 없다(`src/**/*.test.tsx` 가 하나도 없다). 새 테스트 관례를 이 태스크에서 세우지 않고, 기존 방식대로 타입체크와 데모 화면으로 확인한다.

**Files:**
- Modify: `src/app/report/_components/PersonalitySection.tsx:16-21`

**Interfaces:**
- Consumes: `ReportContent.personality: TraitNote[]` (Task 2), `sampleReport` 픽스처의 traits 4개 (Task 2)
- Produces: 없음 (화면 말단)

- [ ] **Step 1: 카드에 `basis` 줄을 추가한다**

`src/app/report/_components/PersonalitySection.tsx:16-21` 의 `items.map` 블록을 아래로 교체한다.

```tsx
        {items.map((item) => (
          <div key={item.title} className="border border-slate-200 rounded-[14px] px-5 py-[18px]">
            <div className="text-[15px] font-bold mb-1">{item.title}</div>
            <p className="text-sm text-slate-600 leading-[1.65] m-0 break-keep [text-wrap:pretty]">{item.body}</p>
            {/* 쉬운 말(body) 다음에 근거 한 줄. 아래 ChartEvidence 패널로 이어지는 다리라
                본문보다 한 단계 옅게 둔다. */}
            <p className="text-[13px] text-slate-400 leading-[1.6] mt-2 mb-0 break-keep [text-wrap:pretty]">{item.basis}</p>
          </div>
        ))}
```

- [ ] **Step 2: 타입체크와 테스트**

Run: `npm run typecheck`
Expected: 출력 없음

Run: `npm run test`
Expected: PASS

Run: `npm run lint`
Expected: 오류 없음

- [ ] **Step 3: 데모 화면으로 눈으로 확인한다**

Run: `npm run dev`

브라우저에서 `http://localhost:3000/report` 를 연다 (프로필 파라미터가 없으면 `page.tsx:108-113` 이 픽스처 데모를 그린다). 확인할 것:

1. 히어로의 키워드 칩이 **4개**이고, 01 카드 4장의 제목과 **글자까지 같다**
2. 각 카드가 "쉬운 말 → 옅은 근거 한 줄" 순서로 읽힌다
3. 근거 문장이 본문 뒤에 이어붙여 읽어도 말이 된다

- [ ] **Step 4: 커밋**

```bash
git add src/app/report/_components/PersonalitySection.tsx
git commit -m "feat(report): 01 카드에 사주 근거 한 줄을 붙인다"
```

---

## 완료 후 남는 것

- `saju_interpretation_sections` 의 `section_key='personality'` 행은 읽히지 않은 채 남는다 (설계상 의도).
- `overview` 는 `schema_version=2` 로 재생성되므로, 기존 리포트를 다시 열면 LLM 호출이 한 번 발생한다.
- `design/project/*.dc.html` 목업은 `basis` 줄만큼 화면과 어긋난 상태로 남는다.
