# 해석 섹션 content 스키마 설계

날짜: 2026-07-27

## 문제

`saju_interpretation_sections.content` 는 `jsonb NOT NULL` 일 뿐 shape 정의가 없다. 그 결과:

1. **LLM에 요청할 구조가 없다.** `InterpretationGenerator` 는 `Promise<Interpretation>` 만 약속하고, 그 `Interpretation` 은 `ilgan`/`strengths`/`weaknesses`/`relationships` 4개짜리 임시 타입이다. structured output 으로 넘길 JSON Schema 가 어디에도 없다.
2. **프론트 맵핑이 끊겨 있다.** `src/app/report/_lib/report-content.ts` 의 `ReportContent` 는 리포트 01–12 섹션의 리치한 shape 을 기대하는데, 이를 채울 LLM 쪽 정의가 없어 화면은 더미로 돌아간다.
3. **키와 값이 짝지어지지 않는다.** `SectionRecord.content: Interpretation[SectionKey]` 는 유니온이라
   `putSection({ sectionKey: "ilgan", content: ["a"] })` 가 컴파일을 통과한다.
4. **`schema_version` 컬럼이 죽어 있다.** 테이블에 있으나 `store.ts` 가 한 번도 쓰지 않아 항상 기본값 1이다.

## 해결 방향

섹션 레지스트리 하나를 단일 소스로 두고, 거기서 TS 타입 · LLM JSON Schema · 런타임 검증 세 가지를 모두 파생시킨다. SQL 에는 제약을 걸지 않고 `jsonb` 를 유지한다 — 섹션이 늘 때마다 마이그레이션을 쓰지 않기 위해서다.

zod v4 를 런타임 의존성으로 추가한다. `z.infer` / `z.toJSONSchema()` / `.safeParse()` 로 세 파생물이 한 선언에서 나온다.

## 구조

```
src/app/api/saju/_lib/sections/
  primitives.ts   TitledText / LabeledText / KeyValue — 공용 zod 스키마
  registry.ts     SECTIONS = { <section_key>: SectionSpec }
  derive.ts       레지스트리 → 타입 · JSON Schema · 파서
```

### SectionSpec

```ts
interface SectionSpec {
  /** 이 섹션 스키마의 버전. DB schema_version 컬럼에 기록된다. */
  version: number;
  /** 무료/유료 구분. 쿼리에 넘길 키 목록이 여기서 파생된다. */
  tier: "free" | "paid";
  /** 저장 테이블 라우팅. "chart" = chartKey 캐시, "luck" = 생시 의존 캐시. */
  storage: "chart" | "luck";
  /** content 의 유일한 shape 정의. */
  schema: z.ZodType;
  /** 이 섹션만 재생성할 때 LLM에 줄 지시문. */
  prompt: string;
}
```

### 파생물

| 파생물 | 방법 | 쓰이는 곳 |
| --- | --- | --- |
| TS 타입 | `z.infer` | `Interpretation`, `SectionRecord`, 리포트 조립 |
| JSON Schema | `z.toJSONSchema(spec.schema)` | LLM structured output 요청 |
| 런타임 파서 | `spec.schema.safeParse` | 저장 전 · 조회 후 |

```ts
export type SectionKey = keyof typeof SECTIONS;
export type SectionContent<K extends SectionKey> = z.infer<(typeof SECTIONS)[K]["schema"]>;
export type Interpretation = { [K in SectionKey]: SectionContent<K> };

export const SECTION_KEYS: SectionKey[];
export const FREE_SECTION_KEYS: SectionKey[];   // tier === "free"
export const PAID_SECTION_KEYS: SectionKey[];   // tier === "paid"
```

`Interpretation` 은 더 이상 손으로 선언하지 않는다. 기존 `types.ts` 의 `Interpretation` / `Section` / `SECTION_KEY_SET` / `SECTION_KEYS` 는 삭제하고 레지스트리 파생물로 대체한다. `types.ts` 에는 `ErrorResponse` / `SajuResponse` / `InterpretationGenerator` 만 남는다.

### 프론트 맵핑

`report-content.ts` 의 `TitledText` / `LabeledText` / `KeyValue` 를 손으로 선언하지 않고 `sections/primitives.ts` 에서 import 한 타입으로 바꾼다. LLM이 받는 스키마와 화면이 읽는 타입이 같은 객체에서 나오므로 어긋날 수 없다.

`AxisRow` 는 `environment` 섹션이 이번 범위에서 빠졌으므로 `report-content.ts` 에 그대로 둔다.

## 섹션 카탈로그 (12개)

무료 5 / 유료 7.

| key | 리포트 | content shape | tier | storage |
| --- | --- | --- | --- | --- |
| `overview` | 상단 | `{ headline, summary, keywords: string[3..6] }` | free | chart |
| `personality` | 01 | `TitledText[]` | free | chart |
| `outerVsInner` | 02 | `{ outward, inner }` | free | chart |
| `strengths` | 03 | `TitledText[]` | free | chart |
| `cautions` | 04 | `{ items: string[], tip }` | free | chart |
| `emotion` | 05 | `LabeledText[]` | paid | chart |
| `relating` | 06 | `KeyValue[]` | paid | chart |
| `love` | 08 | `LabeledText[]` | paid | chart |
| `compatibility` | 09 | `{ good: string[], clash: string[] }` | paid | chart |
| `wealth` | 10 | `{ points: LabeledText[], summary, emphasis }` | paid | chart |
| `yearlyLuck` | 11 | `{ title, desc }[]` | paid | luck |
| `daeunOutlook` | 12 | `{ rows: { title, desc }[], summary, emphasis }` | paid | luck |

모든 **객체** 스키마는 `.strict()` (`additionalProperties: false`) 로 선언한다 — 중첩된 `TitledText` 등도 포함. LLM이 없는 필드를 지어내면 검증에서 걸린다.

### 배열 섹션과 tool input_schema

`personality` / `emotion` / `relating` / `love` / `yearlyLuck` 은 content 자체가 배열이라 JSON Schema 최상위가 `type: "array"` 가 된다. tool input_schema 는 최상위가 객체여야 하므로 그대로 넘길 수 없다.

`derive.ts` 의 `llmInputSchema(key)` 가 모든 섹션을 한 겹 감싸 통일한다:

```ts
{ type: "object",
  properties: { content: z.toJSONSchema(spec.schema) },
  required: ["content"],
  additionalProperties: false }
```

응답에서 `.content` 를 벗겨 `spec.schema.safeParse` 에 넣는다. 저장되는 shape 과 프론트가 읽는 타입은 감싸지 않은 원본 그대로다.

### 범위에서 제외한 것

**`environment` (07)** — UI 재검토 예정이라 shape 이 확정되지 않았다. 이번 레지스트리에 넣지 않는다. UI가 정해지면 `SECTIONS` 에 항목 하나를 추가하는 것으로 끝난다.

**계산값 전부** — LLM 서술만 스키마화한다. 아래는 섹션이 아니며 조립 단계에서 `SajuAnalysis` 로 채운다.

| ReportContent 필드 | 출처 |
| --- | --- |
| `meta` | 요청 입력 (이름, 생년월일시) |
| `evidence.pillars` | `analysis.chart` + `analysis.tenGods.cells` |
| `evidence.elements` | `analysis.elements` |
| `evidence.yinYang` | `analysis.elements` |
| `evidence.strength` | `analysis.strength.level` / `.ratio` |
| `evidence.daeunStrip` | `analysis.daeun.periods` |
| `evidence.tags` | 신강약 레벨 · 용신 오행 · 최다 십성 세 개를 태그로 |
| `evidence.disclaimer` | 상수 |
| `yearlyLuck[].period` | `analysis.daeun` |
| `daeunOutlook.rows[].range` / `.now` | `analysis.daeun.periods` |

`yearlyLuck` 과 `daeunOutlook.rows` 는 LLM이 `title`/`desc` 만 주고 계산값을 **배열 인덱스로** 붙인다. 길이 처리는 두 갈래로 나눈다:

- **요청 시** — `analysis.daeun.periods.length` 를 `n` 으로 `.length(n)` 을 덧붙인 스키마를 만들어 LLM에 넘긴다. 개수를 맞춰 달라는 지시가 스키마에 실린다.
- **저장·조회 검증** — 길이 제약이 없는 기본 스키마를 쓴다. `n` 은 `chartKey` 밖 입력에서 나오므로 `getCached` 가 알 수 없기 때문이다.
- **조립 시** — 계산 배열과 zip 한다. LLM 배열이 더 길면 자르고, 짧으면 그 섹션을 없는 것으로 취급해 재생성 대상에 넣는다.

## 저장 경로 분리

`chartKey` 는 4기둥 + 성별로만 만들어진다 (`_lib/key.ts`). 대운은 정확한 생시·절입에 의존하므로 이 키로 캐시하면 틀린 값이 섞인다.

`storage: "luck"` 인 두 섹션(`yearlyLuck`, `daeunOutlook`)은 새 테이블에 저장한다.

`migrations/0004_saju_luck_sections.sql`:

```sql
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

`luck_key` 는 `chartKey` + 대운 기산 입력(생시·절입 기준·순행/역행)에서 만든다. `_lib/key.ts` 에 `luckKey(analysis)` 를 추가한다. FK 를 걸지 않는 이유는 부모가 `chart_key` 인데 `luck_key` 가 그보다 좁은 키라서다.

레지스트리·검증·조립 코드는 두 테이블이 그대로 공유하고, `storage` 필드가 테이블만 고른다.

`migrations/0003_saju_interpretation_sections.sql` 은 구조 변경 없이 주석만 추가한다 — `content` 의 shape 정의는 `sections/registry.ts` 이고 `schema_version` 은 거기 `version` 값이라는 것. (`scripts/migrate.mts` 가 파일명으로 적용 여부를 추적하므로 이미 적용된 0003 은 재실행되지 않는다. 주석은 읽는 사람을 위한 것.)

## 데이터 흐름

### 생성 (LLM → DB)

```
generateSections(analysis, keys)
  → 섹션마다: z.toJSONSchema(spec.schema) 를 tool input_schema 로 넘겨 요청
  → spec.schema.safeParse(응답)
       성공 → { key, content, version: spec.version } 수집
       실패 → 그 섹션만 버리고 경고 로그, 나머지는 계속
  → putSections(성공한 것만)
```

`InterpretationGenerator` 인터페이스를 바꾼다:

```ts
export interface InterpretationGenerator {
  readonly model: string;
  generateSections(
    analysis: SajuAnalysis,
    keys: SectionKey[],
  ): Promise<Partial<Interpretation>>;
}
```

`StubGenerator` 는 요청받은 키만 자리표시자로 채워 반환한다. 실제 LLM 어댑터는 같은 인터페이스를 구현해 교체한다.

### 조회 (DB → 화면)

```
getCached(chartKey, keys)
  → SELECT section_key, content, schema_version
      WHERE chart_key = $1 AND section_key = ANY($2)
  → 행마다: schema_version === SECTIONS[key].version 인가? → 아니면 없는 것 취급
            spec.schema.safeParse 통과하는가?           → 아니면 없는 것 취급
  → { have: Partial<Interpretation>, missing: SectionKey[] }
```

반환을 `Interpretation | null` 에서 `{ have, missing }` 으로 바꾸는 이유: 지금은 `SECTION_KEYS` 전부를 요구해 하나라도 빠지면 `null`(=전부 재생성)이다. 무료/유료가 갈리면 무료 사용자는 유료 섹션이 없어 영원히 캐시 미스가 난다. 요청한 키 집합을 인자로 받고 부족한 키만 돌려주면 "유료 섹션만 추가 생성"이 자연스럽게 나온다.

핸들러는 `missing` 이 비어 있지 않을 때만 생성기를 부르고, 생성 결과를 `have` 에 합쳐 응답한다.

### 조립

`src/app/report/_lib/to-report-content.ts` 에 `toReportContent(analysis, interpretation, meta): ReportContent` 를 둔다. 계산값과 LLM 섹션을 합쳐 뷰모델을 만든다. 유료 섹션이 없으면 해당 필드를 `undefined` 로 두고 화면이 `LockedSectionMeta` 로 잠금 UI 를 그린다. 이에 맞춰 `ReportContent` 의 유료 섹션 필드는 옵셔널이 된다.

## 타입 안전성

`SectionRecord` 를 판별 유니온으로 바꿔 키와 값을 묶는다:

```ts
export type SectionRecord = {
  [K in SectionKey]: {
    chartKey: string;
    sectionKey: K;
    content: SectionContent<K>;
    model: string;
  };
}[SectionKey];
```

`putSection({ sectionKey: "personality", content: { title, body } })` 는 컴파일 에러가 된다 — `personality` 는 배열이다.

## 쓰기 SQL

`putCached` 의 `jsonb_each` 방식은 섹션마다 다른 `version` 을 쓸 수 없다. `UNNEST` 로 바꾼다:

```sql
INSERT INTO saju_interpretation_sections
  (chart_key, section_key, content, model, schema_version)
SELECT $1, k, c::jsonb, $2, v
FROM UNNEST($3::text[], $4::jsonb[], $5::int[]) AS t(k, c, v)
ON CONFLICT (chart_key, section_key) DO NOTHING
```

`putSection` (단건 덮어쓰기) 도 `schema_version` 을 함께 쓰고 `DO UPDATE` 에 포함한다.

## 에러 처리

| 상황 | 처리 |
| --- | --- |
| LLM 응답이 섹션 스키마 불통과 | 그 섹션만 저장하지 않음. 나머지는 저장. 경고 로그. 다음 요청에서 `missing` 으로 잡혀 재생성. |
| DB 행의 `schema_version` 불일치 | 없는 것 취급 → 해당 섹션만 재생성. 옛 행은 `DO UPDATE` 로 덮어씀. |
| DB 행이 파싱 실패 (버전은 같은데 손상) | 없는 것 취급 → 재생성. 경고 로그. |
| 요청 키가 전부 캐시에 있음 | 생성기 호출 없음. `cached: true`. |
| 생성 후에도 일부 섹션이 없음 | 있는 것만 응답. 해당 리포트 섹션은 잠금/빈 상태로 렌더. 요청 전체를 실패시키지 않는다. |

재시도는 하지 않는다. 생성기가 아직 stub 이라 재시도 동작을 검증할 수 없고, 레이턴시·비용 설계가 선행되어야 한다.

## 테스트

기존 `store.test.ts` / `generate.test.ts` / `handler.test.ts` 는 4섹션 `Interpretation` 을 전제하므로 새 카탈로그에 맞춰 고친다.

새로 추가할 것:

- **레지스트리 불변식** — `version >= 1` 인가, `FREE_SECTION_KEYS` + `PAID_SECTION_KEYS` 가 `SECTION_KEYS` 를 정확히 분할하는가.
- **JSON Schema 파생** — 각 섹션의 `llmInputSchema()` 최상위가 객체이고 `content` 를 요구하는가, 안쪽 객체 스키마가 전부 `additionalProperties: false` 를 내는가, 필수 필드가 `required` 에 들어가는가.
- **왕복** — `StubGenerator` 출력 → `safeParse` → 저장 → 조회 → 다시 `safeParse` 가 같은 값을 준다.
- **버전 불일치** — `schema_version` 이 다른 행을 심고 `getCached` 가 그 키를 `missing` 에 넣는지.
- **부분 실패** — 한 섹션만 스키마 불통과일 때 나머지가 저장되는지.
- **무료/유료 분리** — `FREE_SECTION_KEYS` 만 요청하면 유료 섹션이 없어도 `missing` 이 비는지.
- **조립** — `toReportContent` 가 계산값을 올바른 자리에 넣는지, 유료 섹션 부재 시 `undefined` 인지, `daeunOutlook.rows` 인덱스 매칭이 맞는지.

## 범위 밖

- `environment` (07) 섹션 스키마 — UI 재검토 후.
- 실제 LLM 어댑터 구현 — 이 설계는 인터페이스와 스키마까지만. `StubGenerator` 로 파이프라인을 끝까지 돌린다.
- 섹션 실패 시 재시도 정책.
- 결제·권한 연동. `tier` 는 레지스트리 메타로만 존재하고, 실제로 어떤 키를 요청할지 정하는 것은 호출자 몫이다.
