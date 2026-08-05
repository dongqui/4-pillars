# overview · personality 병합 (traits) 설계

날짜: 2026-08-05

## 문제

히어로의 키워드 칩과 01 핵심 성향 카드는 같은 성향을 가리키도록 의도됐지만, 실제로는 어긋난다.

`prompted.ts:36` 은 섹션마다 **독립된 LLM 호출을 병렬로** 던진다. `overview` 를 쓰는 호출과 `personality` 를 쓰는 호출은 서로의 결과를 보지 못한다. 그래서 픽스처(`report-content.fixture.ts:12-17`)조차 이미 어긋나 있다.

| keywords (5) | personality 카드 (3) |
| --- | --- |
| 신중한 관찰자 | 신중한 관찰자 ✅ |
| 독립적인 판단 | 독립적인 판단 ✅ |
| 강한 책임감 | — |
| 느린 속마음 | — |
| 오래 밀고 나감 | 한번 정하면 오래 밀고 나감 ⚠️ |

두 섹션의 예시가 이미 같은 문자열(`registry.ts:55` 의 `"신중한 관찰자"` = `registry.ts:68` 의 title)을 쓰고 있다 — 의도는 있었으나 스키마가 그걸 잡아주지 못하는 상태다.

부수적으로 카드 본문의 구성도 정해져 있지 않다. `personality` 는 사주 용어가 허용되는 유일한 섹션인데(`registry.ts:63-66`, 커밋 `8351e0d`), 용어를 본문 어디에 얼마나 써야 하는지가 지시문의 톤에만 맡겨져 있다.

## 해결 방향

두 섹션을 `overview` 한 키로 합치고, 성향을 `traits` 배열 하나로 표현한다. 한 번의 LLM 호출·한 번의 스키마 검증 안에 키워드와 카드가 같이 들어오므로 **어긋남이 표현 불가능해진다.** 프롬프트로 부탁하는 대신 타입으로 막는다.

UI 상의 분리는 그대로다. `traits` 를 히어로용 문자열 배열과 카드 배열로 푸는 곳은 `to-report-content.ts` 하나뿐이고, 이 파일은 이미 "계산값 + LLM 서술 → 뷰모델" 을 합치는 유일한 자리다.

카드 본문은 **쉬운 말 → 사주 근거** 흐름을 필드로 강제한다. 근거를 별도 필드(`basis`)로 떼면 순서와 존재가 스키마로 보장되고, 사주 용어가 허용되는 범위가 그 한 필드로 정확히 잘린다.

## 구조

### 프리미티브 (`sections/primitives.ts`)

```ts
/**
 * 키워드 제목 + 쉬운 말 본문 + 사주 근거 한 줄 — 01 핵심 성향.
 * title 은 히어로 키워드 칩으로도 그대로 렌더된다.
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

### 레지스트리 (`sections/registry.ts`)

`personality` 키를 삭제하고 `overview` 를 다음으로 교체한다. `tier: "free"`, `storage: "chart"` 는 그대로, `version` 만 1 → 2.

```ts
overview: {
  version: 2,
  tier: "free",
  storage: "chart",
  schema: z
    .object({
      headline: z.string().min(1),
      summary: z.string().min(1),
      traits: z.array(TraitNote).length(4),
    })
    .strict(),
  ...
}
```

`.length(4)` 는 zod 4.4.3 에서 `z.toJSONSchema` 를 거치면 `minItems: 4, maxItems: 4` 로 내려간다 (확인함). 개수도 프롬프트 부탁이 아니라 tool 스키마로 강제된다. `prompt/index.ts` 의 `rowCount` 는 손대지 않는다 — 그건 계산된 목록과 인덱스로 짝지어야 하는 세운·대운 전용 장치다.

### 지시문

```
타고난 기질 전체를 한 줄 헤드라인(headline)과 3~4문장 요약(summary)으로 정리하고,
성향을 대표하는 서로 겹치지 않는 관점 4개를 traits 로 써라. 각 trait 는 세 부분이다.
- title: 그 관점을 한눈에 보여주는 짧은 말. 그대로 키워드로 노출되므로 사주 용어를
  쓰지 말고, 성격을 바로 알아볼 수 있는 말로 짧게 쓴다.
- body: 그 성향이 일상에서 어떻게 드러나는지 2~3문장. 여기서도 사주 용어를 쓰지 마라.
- basis: 그 성향의 사주 근거 한 문장. 이 필드에서만 사주 용어를 써도 된다 —
  일간·십성·오행을 자연스럽게 녹이되 나열하거나 강의하지 마라. body 뒤에 이어붙여
  읽어도 말이 되도록 "~해서 그래요", "~라 그래요" 처럼 앞 문장을 받는 종결로 쓴다.
```

예시:

```json
{
  "headline": "겉으로는 차분하지만, 자신만의 기준과 승부욕이 강한 사람",
  "summary": "사람들과 잘 어울리지만, 혼자 생각을 정리하는 시간이 꼭 필요한 타입이에요.",
  "traits": [
    {
      "title": "신중한 관찰자",
      "body": "상황을 먼저 파악한 뒤 움직여요. 말보다 판단이 앞서는 이유예요.",
      "basis": "일간 갑목이 인월의 단단한 뿌리 위에 서 있어서 그래요."
    }
  ]
}
```

예시가 4개를 다 채우지 않는 건 기존 섹션들의 관례를 따른 것이다 (`strengths` 등도 min 미만의 조각만 보여준다) — 예시는 톤과 길이를 보이는 용도고, 개수는 지시문과 tool 스키마가 강제한다.

`registry.ts:63-66` 의 "사주 용어를 쓰는 유일한 섹션" 주석은 `basis` 옆으로 옮기고, 범위가 필드 단위로 좁아졌음을 적는다. `system.ts:27` 의 예외 조항("섹션 지시문이 용어를 쓰라고 명시적으로 요구하면 그 섹션에서만")은 그대로 살아 있다.

### 조립 (`report/_lib/to-report-content.ts`)

```ts
keywords:    overview?.traits.map((t) => t.title) ?? [],
personality: overview?.traits ?? [],
```

같은 문자열이 두 자리에 렌더되므로 두 곳이 갈라질 수 없다.

### 화면

`ReportContent.personality` 의 타입만 `TitledText[]` → `TraitNote[]` 로 바뀐다. `PersonalitySection.tsx` 는 카드 하단에 `basis` 를 작은 글씨로 한 줄 덧붙인다 — 바로 아래 `ChartEvidence` 근거 패널(`PersonalitySection.tsx:23`)로 이어지는 다리 역할이다. `ReportHero` · `ReportBody` · 섹션 번호(01)는 무변경.

### 캐시

- `overview` 의 `version` 이 2로 올라가므로 옛 행은 `store.ts:55` 에서 폐기되고 다음 요청에 재생성된다.
- `section_key = 'personality'` 로 저장된 옛 행은 `store.ts:54` 의 `isSectionKey` 가 걸러 무시한다. 읽히지 않는 고아 데이터로 남지만 동작에는 영향이 없어 **삭제하지 않는다.**
- 무료 섹션이 5개 → 4개가 되어 무료 리포트 1건당 LLM 호출이 한 번 줄어든다.

## 변경 파일

| 파일 | 변경 |
| --- | --- |
| `sections/primitives.ts` | `TraitNote` 추가 |
| `sections/registry.ts` | `overview` v2 로 병합, `personality` 삭제 |
| `sections/derive.ts` | 주석 58행의 `personality` 예시를 `strengths` 로 |
| `_lib/store.ts` | 주석 84-85행의 `personality` 예시를 `strengths` 로 |
| `_lib/generate.ts` | `StubGenerator` 의 `overview` 를 traits 4개로, `personality` 제거 |
| `report/_lib/report-content.ts` | `TraitNote` 재수출, `personality: TraitNote[]` |
| `report/_lib/to-report-content.ts` | `traits` → `keywords` + `personality` 분해 |
| `report/_lib/report-content.fixture.ts` | traits 4개로 재작성, 상단 주석의 용어 허용 범위 갱신 |
| `report/_components/PersonalitySection.tsx` | `basis` 렌더 추가 |

## 테스트

새로 쓰거나 고치는 것:

- `sections/registry.test.ts` — 무료 키 목록에서 `personality` 가 빠졌는지, `overview` 가 traits 4개를 요구하고 3개·5개를 거부하는지, `TraitNote` 가 `basis` 없는 항목을 거부하는지
- `sections/derive.test.ts` — `llmInputSchema("overview")` 가 `traits` 에 `minItems/maxItems: 4` 를 실어 보내는지
- `report/_lib/to-report-content.test.ts` — `keywords` 가 `traits[].title` 과 원소·순서까지 같은지 (병합의 목적 자체를 지키는 테스트), `overview` 가 없을 때 `keywords`·`personality` 가 빈 배열인지

`personality` 를 "배열 섹션 아무거나" 라는 **샘플로만** 쓰던 파일들은 동형(`TitledText[]`, min 2 max 4)인 `strengths` 로 치환한다. 테스트 의도는 그대로 보존된다.

`deepseek.test.ts` · `prompted.test.ts` · `handler.test.ts` · `produce.test.ts` · `store.test.ts` · `prompt/index.test.ts` · `generate.test.ts`

## 범위 밖

- `design/project/*.dc.html` 목업은 `basis` 추가분만큼 화면과 어긋나게 된다. 이번 작업에서 맞추지 않는다.
- 옛 `personality` 행 삭제 SQL.

## 구현 중 변경

전체 리뷰 픽스 웨이브(2026-08-05)에서 위 "구조" 절의 `keywords: overview?.traits.map(...)`, `personality: overview?.traits ?? []` 두 필드를 함께 두는 안을 뒤집었다. `ReportContent.keywords` 필드 자체를 지우고, 히어로 칩은 `ReportBody`가 `content.personality.map((t) => t.title)`로 렌더 시점에 뽑는다. `keywords`와 `personality`를 뷰모델에 나란히 두면 `report-content.fixture.ts`처럼 손으로 쓰는 자리에서 두 목록이 다시 갈라질 수 있다는 게 이유였다 — 애초에 이 설계가 고치려던 버그와 같은 모양이다. 사람이 승인했다.
