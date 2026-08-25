# 리포트 섹션 개편 — 운세 축 제거, 행동 섹션 3종 추가

날짜: 2026-08-25
대상: `/report` (사주 리포트)

## 배경

지금 리포트는 12섹션이다. 그중 `11 올해의 운`·`12 대운`은 유일하게 생시에 의존하는
섹션이라, 이 둘만을 위해 별도 저장 축(`storage: "luck"`, `saju_luck_sections` 테이블,
`luckKey`, `luckFacts`, `llmInputSchemaWithRows`)이 파이프라인 전체를 관통하고 있다.

운세는 리포트 안에서 다루지 않기로 했다. 다시 하더라도 리포트 섹션이 아니라 별도
서비스가 되고, 그때는 궁합(`api/matches/_lib/sections/registry.ts`)처럼 자기 레지스트리를
따로 갖게 된다 — 지금의 luck 축은 "리포트 섹션 하나를 캐시한다"는 전제에 묶여 있어
그 서비스가 재사용할 수 없다.

대신 "나는 실제로 어떻게 움직이는가"를 다루는 섹션 3종을 넣는다. "너는 부드럽지만
기준이 있다" 같은 성격 요약보다, 내가 실제 삶에서 왜 이렇게 결정하는지가 자기 이야기처럼
읽힌다는 판단이다.

## 최종 섹션 구성 (13개 · 무료 4 / 유료 9)

| # | key | 카테고리 | 제목 | tier |
|---|---|---|---|---|
| 01 | `overview` | 핵심 성향 | 이렇게 보이는 데는 이유가 있어요 | free |
| 02 | `outerVsInner` | 겉과 속 | 남이 보는 나 vs 실제 내면 | free |
| 03 | `strengths` | 타고난 강점 | 이런 순간에 빛나요 | free |
| 04 | `cautions` | 주의할 패턴 | 나도 모르게 반복하는 것들 | free |
| 05 | `emotion` | 감정과 스트레스 | 힘들 때 이런 패턴이 나타나요 | paid |
| 06 | `decisions` | 선택과 결정 | 중요한 순간, 나는 어떻게 움직일까 | paid · **신규** |
| 07 | `workStyle` | 일하는 방식 | 일할 때 드러나는 나만의 리듬 | paid · **신규** |
| 08 | `environment` | 잘 맞는 환경 | 능력이 잘 드러나는 조건 | paid · 직무 팁 추가 |
| 09 | `relating` | 사람을 대하는 방식 | 관계에서의 나 | paid · CTA 제거 |
| 10 | `love` | 연애와 관계 | 연애할 때 반복되는 관계 패턴 | paid |
| 11 | `compatibility` | 궁합 | 당신과 잘 맞는 사람의 특징 | paid · CTA 이동 |
| 12 | `wealth` | 재물 | 돈이 모이는 방식과 새어나가는 지점 | paid |
| 13 | `playbook` | 나를 잘 쓰는 법 | 내 성향을 내 편으로 만드는 방법 | paid · **신규** |

읽히는 흐름: 나는 누구인가(01–04) → 어떻게 움직이나(05–07) → 어디서 잘 되나(08) →
누구와(09–11) → 돈(12) → 그래서 뭘 하면 되나(13).

## 설계

### 1. 번호·제목의 단일 출처

지금은 번호·카테고리·제목이 각 섹션 컴포넌트에 `no="06"` 식으로 하드코딩돼 있고,
무료 사용자용 잠금 목록(`report-content.fixture.ts`의 `lockedSections`)이 그걸 손으로 한 번
더 베껴 쓴다. 순서를 건드리면 둘이 조용히 어긋난다.

`SectionSpec`에 필수 필드를 추가한다:

```ts
interface SectionSpec {
  // …기존 필드
  /** 화면에 그대로 나가는 머리말. 번호는 SECTIONS 선언 순서에서 나온다. */
  heading: { category: string; title: string };
}
```

**`SECTIONS` 객체의 선언 순서 = 화면 순서 = 번호**로 못박는다. 새로 만드는 규칙이 아니라
이미 `SECTION_KEYS = Object.keys(SECTIONS)`가 그 순서를 정본으로 쓰고 있는 것을 문서화하고,
레지스트리를 화면 순서대로 재배열하는 것이다. 레지스트리에 그 뜻을 주석으로 남긴다.

`sections/derive.ts`에 추가:

```ts
/** 타입 이름은 SectionHeading 컴포넌트와 겹치지 않게 …Meta 로 둔다 */
export interface SectionHeadingMeta { no: string; category: string; title: string }
export function sectionHeading(key: SectionKey): SectionHeadingMeta;  // no = String(index+1).padStart(2,"0")
export function paidSectionHeadings(): SectionHeadingMeta[];          // 잠금 목록
```

결과:

- `SectionHeading` 컴포넌트가 `{ section: SectionKey }` 하나만 받는다.
- `lockedSections` 픽스처가 사라지고 `paidSectionHeadings()`가 대신한다.
  (`LockedSectionMeta` 타입은 `SectionHeadingMeta`로 통합)
- 새 섹션에 `heading`을 빼먹으면 컴파일이 깨진다.

### 2. 신규 섹션 — 축은 타입으로 고정

`선택과 결정`·`일하는 방식`은 항목의 축이 정해져 있다. 축이 사람마다 달라지면 "다른
사람과 비교되는 골격"이라는 이 섹션의 강점이 사라진다. 프롬프트로 부탁하지 않고
스키마로 막는다.

`sections/axes.ts` 신설:

```ts
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

/**
 * 축 맵 → 모든 축이 정확히 한 번씩 있는 문자열 객체 스키마.
 *
 * 반환 타입을 z.ZodType 으로 뭉개면 안 된다 — SectionContent 가
 * z.infer<SECTIONS[K]["schema"]> 로 나오므로, 뭉개는 순간 화면이 받는 타입이
 * unknown 이 되어 필드를 못 읽는다. 축 키가 살아 있는 ZodObject 로 돌려준다.
 */
export function axisSchema<T extends Record<string, string>>(
  axes: T,
): z.ZodObject<{ [K in keyof T]: z.ZodString }>;

/** 축 맵 + content → 화면이 그리는 행. 선언 순서를 지킨다. */
export function axisRows<T extends Record<string, string>>(
  axes: T,
  content: Record<keyof T, string>,
): { label: string; body: string }[];
```

배열 + `z.enum(라벨)`을 쓰면 LLM이 같은 축을 두 번 쓰거나 하나를 빠뜨려도 스키마를
통과한다. 객체는 넷/다섯이 정확히 한 번씩 있어야 한다.

라벨 문자열은 `axes.ts` 한 곳에만 있다 — 프롬프트 지시문도 화면 라벨도 여기서 읽으므로
둘이 갈라질 수 없다. (`report-content.ts`가 이미 `sections/primitives`를 import 하는 것과
같은 방향이다.)

#### 06 `decisions`

```ts
{ version: 1, tier: "paid", schema: axisSchema(DECISION_AXES), heading: { … } }
```

프롬프트 요지 — 각 축 2~3문장, 그리고 **성격을 형용사로 요약하지 말고 그 순간에 실제로
무엇을 하는지 행동으로 쓸 것.** `overview`가 헤드라인 대비 규칙에 좋은 예/나쁜 예를
다는 것과 같은 방식으로 못박는다.

- `deciding`: 정보를 얼마나 모으는지, 속도, 무엇을 기준으로 삼는지
- `starting`: 크게 뛰어드는 쪽인지 안전한 범위를 확인하며 넓히는 쪽인지
- `unsure`: 혼자 정리하는지 남에게 묻는지, 무엇이 있으면 결정이 빨라지는지
- `afterDeciding`: 번복하는 편인지 밀고 가는 편인지, 주변 반응에 얼마나 흔들리는지

#### 07 `workStyle`

```ts
{ version: 1, tier: "paid", schema: axisSchema(WORK_AXES), heading: { … } }
```

- `starting`: 계획을 세우고 들어가는지 일단 시작하는지, 목표가 얼마나 뚜렷해야 하는지
- `progressing`: 몰아치는지 매일 쌓는지, 디테일부터 보는지 전체부터 보는지
- `collaborating`: 주도·조율·지원 중 어느 자리가 편한지, 의견이 갈리거나 역할을 나눌 때
- `troubled`: 문제가 터졌을 때 먼저 하는 행동, 압박받을 때 달라지는 점
- `performing`: 어떤 목표와 보상에서 힘이 나는지, 결과형인지 과정형인지

#### 13 `playbook`

```ts
{ version: 1, tier: "paid", schema: z.array(TitledText).length(4), heading: { … } }
```

`title`은 "결정에는 마감 시간을 만들어두기"처럼 `~하기`로 끝나는 짧은 실천 문장,
`body`는 왜 이 사람에게 그게 필요한지 2~3문장. 프롬프트에 두 가지를 못박는다:

- 일반적인 자기계발 조언이 아니라 `[사실]` 블록에서 나온 이 사람의 성향을 근거로 쓴다.
- 고치라는 훈계가 아니라 이미 가진 성향을 유리하게 쓰는 방법으로 쓴다.

개수를 `.length(4)`로 고정하는 이유: 마지막 섹션이라 카드 4장이 화면을 닫는 모양을
잡는다. `llmInputSchema`가 `minItems`/`maxItems`를 4로 내보내 tool 호출 단계에서 강제된다.

### 3. 08 환경 — 직무 팁

`environment` 스키마에 두 필드를 더한다 (version 2 → 3):

```ts
roles: z.array(z.string().min(1)).min(3).max(5),
roleNote: z.string().min(1),
```

프롬프트: 자격이 필요한 직업명 대신 "기획"·"리서치"·"팀 안의 조율자"처럼 하는 일의
성격이 드러나는 짧은 말로. **직업을 정해 주는 말이 아니라 예시라는 게 드러나게** 쓴다
(시스템 프롬프트의 "단정하지 마라"와 같은 결).

화면: 기존 요약 `NoteCard` 아래 TIP 카드 하나. `roles`는 칩, `roleNote`는 한 줄.
`NoteCard.tsx`에 같은 껍데기를 공유하는 `TipCard`를 추가한다 (`NoteCard`는 children을
`<p>`로 감싸서 칩을 못 담는다). 카드 배경·테두리 클래스는 상수로 뽑아 둘이 공유한다.

### 4. 궁합 보기 CTA 이동

`RelatingSection`(09) 하단의 어두운 CTA 카드를 `CompatibilitySection`(11)의 두 카드
아래로 옮긴다.

- `<button>` → `<a>`. 지금은 아무 데도 안 가는 버튼이다.
- 목적지: 로그인 상태면 `/match`, 아니면 `/login?next=%2Fmatch`.
  (`/match/page.tsx`가 이미 비로그인을 `/login?next=/match`로 보내지만, 링크를 눌러
  한 번 튕기게 두는 것보다 처음부터 맞는 곳으로 보낸다.)
- `ReportBody`가 `access.isLoggedIn`을 `CompatibilitySection`에 내려준다.
- 문구 교체: 바로 위 섹션이 이미 "잘 맞는 유형"을 답하므로
  "나와 잘 맞는 사람은 어떤 유형일까요?" → "실제 상대와의 궁합이 궁금하다면",
  본문은 "상대방의 생년월일을 입력하면 두 사람 사이의 흐름을 볼 수 있어요.",
  버튼은 그대로 "궁합 보기 →".

### 5. luck 축 제거

한 줄기로 걷어낸다:

- `migrations/0033_drop_saju_luck_sections.sql` 신설 (`DROP TABLE IF EXISTS`)
- `store-luck.ts` + 테스트 삭제
- `key.ts`: `luckKey` 삭제
- `prompt/facts.ts`: `luckFacts`와 `sewunPillars` import 삭제
- `prompt/index.ts`: `YEARLY_LUCK_YEARS`, `PromptContext`(year/yearlyLuckYears), `rowCount`,
  storage 분기 삭제 → `buildSectionRequest(analysis, key)` 2인자로
- `sections/derive.ts`: `llmInputSchemaWithRows`, `LUCK_SECTION_KEYS`, `CHART_SECTION_KEYS`,
  `sectionStorage` 삭제
- `sections/registry.ts`: `SectionStorage` 타입과 `storage` 필드, `yearlyLuck`·`daeunOutlook` 삭제
- `sections/primitives.ts`: `TimelineNote` 삭제
- `produce.ts`: `splitByStorage`, `getLuckCached`/`putLuckSections`/`year` deps 삭제
- `handler.ts`·`api/saju/route.ts`·`report/page.tsx`: 위 deps 제거
- `generate.ts`(자리표시자 생성기): `timeline` 삭제
- 화면: `YearlyLuckSection.tsx`·`DaeunSection.tsx` 삭제
- `report-content.ts`: `TimelineRow`·`DaeunRow` 타입과 `yearlyLuck`·`daeunOutlook` 필드 삭제
- `to-report-content.ts`: `zipTimeline` 삭제. `year` 인자는 남는다 —
  `toChartEvidence(analysis, year)`가 근거 패널의 현재 대운 표시에 계속 쓴다.
- `report-content.fixture.ts`: 두 섹션과 `lockedSections` 삭제, 신규 3섹션 샘플 추가

**남기는 것**

- `saju-core`의 `sewunPillars`/`sewun.ts`: 계산 라이브러리의 만세력 원시값이고 자체
  테스트가 있다. 나중 운세 서비스가 그대로 쓴다.
- 근거 패널(`ChartEvidence`)의 "대운 흐름 · 10년 주기" 스트립: 접혀 있는 근거 패널은
  사주 용어가 허용된 유일한 구역이고(원국·오행·신강약·용신이 이미 있다), 대운은 그
  계산의 일부다. 해석 섹션이 없어졌다고 근거에서 뺄 이유가 없다.

### 6. 뷰모델 반영

`report-content.ts`의 `ReportContent`에 유료 선택 필드 3개를 더한다. 잎 타입은 기존
규칙대로 해석 스키마에서 가져온다 (직접 다시 선언하지 않는다):

```ts
decisions?: DecisionsContent;   // = SectionContent<"decisions">
workStyle?: WorkStyleContent;
playbook?: TitledText[];
environment?: { …기존; roles: string[]; roleNote: string };
```

`to-report-content.ts`는 이 셋을 `interpretation`에서 그대로 옮긴다 — 계산값과 짝지을
게 없어 `zipTimeline` 같은 조립이 필요 없다.

## 화면 구성 (신규 3섹션)

기존 섹션들과 같은 부품(`SectionHeading`, `CardGrid`, `InfoCard`, `NoteCard`)을 쓴다.

- **06 선택과 결정** — `RelatingSection`의 행 목록 스타일. 왼쪽 고정폭 축 라벨, 오른쪽
  본문. 축이 4개뿐이고 본문이 2~3문장이라 카드 그리드보다 목록이 읽기 쉽다.
- **07 일하는 방식** — `CardGrid` + `InfoCard`. 05 감정·10 연애와 같은 모양이다.
  축 5개는 auto-fit 그리드에서 3+2로 앉는다.
- **13 나를 잘 쓰는 법** — 마무리 섹션이라 한 단계 강조한다. `CardGrid` 위에
  accent 원형 번호(1~4) + 실천 제목 + 본문. 테두리는 `accent-200`, 배경은 `accent-50`.
  03 강점의 번호 배지와 08 환경의 accent 카드에서 이미 쓰는 어휘라 새 스타일이 아니다.

## 검증

- `npm run typecheck` — `heading` 누락, 삭제된 심볼 참조가 여기서 잡힌다.
- `npm test` — luck 관련 테스트 삭제, 신규 항목 추가:
  - `sectionHeading`이 레지스트리 순서대로 `01`…`13`을 내는지
  - `paidSectionHeadings()`가 유료 9개를 순서대로 내는지
  - `axisSchema`가 축을 빠뜨린 객체와 모르는 키를 거부하는지
  - `axisRows`가 선언 순서를 지키는지
  - `playbook` 스키마가 3개·5개를 거부하는지
  - `environment` 스키마가 `roles` 2개·6개를 거부하는지
- `npm run lint`
- `npm run db:migrate`로 0033 적용
- `/report?paid=true`로 13섹션 렌더 확인, 무료 경로에서 잠금 9개 확인

## 하지 않는 것

- 리포트 밖 운세 서비스 설계 — 별도 작업이다.
- `maxDuration` 재조정 — 유료 LLM 호출이 8 → 9로 늘지만 가장 느리던 `daeunOutlook`이
  빠져 총 시간은 줄어든다. 값은 60 그대로 두고 실측 후 다시 본다.
