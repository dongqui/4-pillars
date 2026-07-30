# 섹션 프롬프트 빌더 설계

**Goal:** `SajuAnalysis`(계산값)와 섹션 레지스트리에서 LLM 요청 한 건을 조립한다. 실제 LLM 선택·연결은 이 범위 밖이며, 전송 함수만 주입받는 생성기 골격까지 만든다.

**Status:** 설계 승인됨 (2026-07-29)

## 배경

`SECTIONS` 레지스트리(`sections/registry.ts`)는 이미 섹션마다 zod 스키마와 짧은 지시문을 갖고 있고, `llmInputSchema()` 가 tool `input_schema` 까지 만든다. 없는 것은 두 가지다.

1. **시스템 프롬프트** — 문체·금지 규칙·출력 계약.
2. **사실 시트** — `SajuAnalysis` 를 LLM 이 읽을 텍스트로 옮긴 것.

지금은 `StubGenerator` 가 일간만 보고 고정 문구를 뱉는다.

## 지켜야 할 제약 (코드에 이미 박혀 있음)

| 제약                                                      | 근거                                                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| chart 섹션 프롬프트에 이름·생년월일·시각을 넣으면 안 된다 | `chartKey()` 가 4기둥+성별로만 캐시한다. 그 밖의 정보로 쓴 서술은 같은 원국을 가진 **다른 사람에게 그대로 재사용된다** |
| 숫자·연도·나이·퍼센트를 서술에 쓰면 안 된다               | 계산값은 `evidence.ts` 와 `to-report-content.ts` 가 붙인다. LLM 이 지어내면 화면 값과 어긋난다                         |
| `emphasis` 는 `summary` 의 정확한 부분 문자열이어야 한다  | `EmphasizedText` 가 `indexOf` 로 찾고, 못 찾으면 강조를 통째로 버린다                                                  |
| 세운·대운 서술은 계산된 목록과 **같은 개수·같은 순서**    | `zipTimeline` 이 개수가 모자라면 섹션 전체를 `undefined` 로 버린다                                                     |
| 길흉 단정 금지                                            | `EVIDENCE_DISCLAIMER` 가 화면에서 같은 태도를 공표한다                                                                 |

## 구조

```
SajuAnalysis ─┐
              ├→ chartFacts / luckFacts ─┐
SECTIONS[key] ─────────────────────────────├→ buildSectionRequest → SectionRequest
SYSTEM_PROMPT ────────────────────────────┘                              │
                                                                         ▼
                                                    PromptedGenerator(transport)
```

```ts
export interface SectionRequest {
  key: SectionKey;
  system: string;
  user: string;
  toolName: string; // 응답을 tool 호출로 강제
  inputSchema: Record<string, unknown>; // llmInputSchema(WithRows)
}
export type SectionTransport = (req: SectionRequest) => Promise<unknown>;
```

`transport` 는 tool 호출의 input(`{ content: ... }`)을 그대로 돌려준다. `PromptedGenerator` 가 `.content` 를 벗겨 반환하고, 스키마 검증은 지금처럼 `handleSaju` 가 한다 — 검증을 어댑터에 맡기면 어댑터가 늘어날 때마다 새는 곳이 생긴다.

### 파일

**새로 만드는 것**

| 파일                                     | 책임                                                        |
| ---------------------------------------- | ----------------------------------------------------------- |
| `src/lib/saju-core/sewun.ts`             | `sewunPillars(startYear, count)` — 연도별 세운 간지         |
| `src/app/api/saju/_lib/prompt/system.ts` | `SYSTEM_PROMPT`                                             |
| `src/app/api/saju/_lib/prompt/facts.ts`  | `chartFacts(analysis)` / `luckFacts(analysis, year, years)` |
| `src/app/api/saju/_lib/prompt/index.ts`  | `buildSectionRequest(analysis, key, ctx)`                   |
| `src/app/api/saju/_lib/prompted.ts`      | `PromptedGenerator`                                         |

**고치는 것**

| 파일                   | 무엇을                                                              |
| ---------------------- | ------------------------------------------------------------------- |
| `sections/registry.ts` | `SectionSpec.example` 추가 — 톤 예시는 섹션 정의와 같은 자리에 둔다 |
| `_lib/types.ts`        | `generateSections(analysis, keys, ctx: { year })`                   |
| `_lib/handler.ts`      | `deps.year` 를 생성기에 넘긴다                                      |
| `_lib/generate.ts`     | `StubGenerator` 시그니처 맞춤                                       |

`route.ts` 는 그대로 `StubGenerator` 를 쓴다. 실제 LLM 은 `PromptedGenerator` 에 transport 하나를 꽂아 교체한다.

## 사실 시트

`chartFacts` — chart 저장소 섹션 전용. **캐시 키(4기둥+성별) 밖의 값은 한 글자도 들어가지 않는다.**

```
[원국]
일간: 갑 (목·양) / 성별: 남
년주 경오(庚午) — 천간 경 편관 · 지지 오 상관
월주 무인(戊寅) — 천간 무 편재 · 지지 인 비견
일주 갑자(甲子) — 천간 갑 일간(我) · 지지 자 정인
시주 병인(丙寅) — 천간 병 식신 · 지지 인 비견
[오행] 목 3 · 화 2 · 토 1 · 금 1 · 수 1 (총 8자)
[십성] 비견 2 · 정인 1 · …
[세력] 비겁 5 · 식상 3 · 재성 1 · 관성 2.5 · 인성 2
[신강약] 신강 (우호 비율 0.62)
[용신] 금 · 희신 토 — 신강·비겁 과다 → 식상으로 설기
```

시주가 없으면 그 줄을 빼고 `시주 없음(출생 시간 미입력)` 을 적는다 — 빠진 자리를 LLM 이 채워 넣지 않게 한다.

`luckFacts` = `chartFacts` + 대운(방향·대운수·회차별 간지) + 세운(연도별 간지). 연도·나이는 **순서를 맞추기 위한 참고값이며 서술에 표기 금지**임을 같은 블록에 적는다.

## 시스템 프롬프트 규칙

1. 사실 시트 밖의 정보를 지어내지 않는다. 이름·나이·생년월일·직업·가족은 주어지지 않으므로 언급하지 않는다.
2. 숫자·연도·나이·퍼센트·기간 표기를 쓰지 않는다.
3. `emphasis` 는 `summary` 안에 그대로 등장하는 부분 문자열이어야 한다.
4. 단정·운명론 금지. 경향으로 쓴다.
5. 의료·법률·투자·수명에 대한 확정적 조언 금지. 특정 오행이 적다는 이유만으로 흉하다고 하지 않는다.
6. 해요체. 사주 용어는 근거로 한 번씩만 녹이고 나열하지 않는다. 같은 문장을 반복하지 않는다.
7. 반드시 제공된 tool 을 호출한다. `content` 밖의 필드·마크다운·코드펜스 금지.

톤 예시는 `report-content.fixture.ts` 의 실제 문장에서 섹션당 하나씩 뽑아 `SECTIONS[key].example` 에 둔다. 픽스처 전체를 few-shot 으로 넣지 않는다 — 토큰도 토큰이거니와 예시 내용을 그대로 베낄 위험이 있다.

## 현재 대운 위치는 넣지 않는다

"지금 몇 번째 대운인가"는 출생 연도에 의존하는데 `luckKey` 에는 출생 연도가 없다(`chartKey` + 대운 기산값 + 기준 연도 + 회차 수). 같은 원국을 가진 60년 터울의 두 사람은 같은 `luckKey` 를 쓰므로, 현재 구간을 프롬프트에 넣으면 서로의 캐시를 덮어쓴다.

따라서 사실 블록에는 대운 목록만 싣고 현재 위치는 싣지 않는다. 화면의 `now` 표시는 `to-report-content` 가 `analysis` 로 직접 계산하므로 영향이 없다. 서술이 "지금 어디쯤"을 말하게 하려면 `luckKey` 에 출생 연도를 넣어야 한다 — 별도 작업이다.

## 세운 연수 — 알려진 불일치

`yearlyLuck` 은 UI 카피가 "지금부터 1년"(월 단위, 픽스처도 `"8월"`)인데 `to-report-content.ts` 는 `${year + i}년` 라벨을 붙인다 — 연 단위다. 프롬프트는 **현재 조립 코드를 따라 연 단위, 기준 연도 포함 3년**(`YEARLY_LUCK_YEARS = 3`)으로 고정한다. 월 단위로 갈지는 별도 이슈로 남긴다.

## 테스트

- `chartFacts` 에 이름·생년월일·시각이 새지 않는다 — 생일만 다른 두 입력이 같은 원국이면 사실 시트가 같다.
- 시주 없는 원국을 처리한다.
- 모든 `SectionKey` 로 `buildSectionRequest` 가 성립한다.
- `yearlyLuck`/`daeunOutlook` 의 `inputSchema` 가 세운 연수·대운 회차 수로 개수가 고정된다.
- `PromptedGenerator` 가 `.content` 를 벗겨 반환하고, 한 섹션이 실패해도 나머지를 살린다.
