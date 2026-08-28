# 지금의 흐름 — 시기 리포트 서비스

날짜: 2026-08-26
브랜치: `claude/saju-current-flow-planning-d52137`

## 문제

기존 개인 리포트는 "나는 어떤 사람인가"에 답한다. 타고난 성향과 오래 유지되는 패턴을
설명하고, 조회 시점과 무관하게 같은 결과를 낸다.

답하지 못하는 질문이 하나 남아 있다 — **"나는 지금 어떤 시기를 지나고 있는가."**

리포트 안에 `yearlyLuck`(연도 12줄)·`daeunOutlook`(대운)이 유료 섹션으로 있었지만,
그 둘은 명리 단위를 그대로 나열하는 구조라 이 질문에 답하지 못한다. 두 섹션은 별도
브랜치에서 리포트에서 제거된다.

`지금의 흐름`은 그 자리를 메우는 섹션이 아니라 **궁합·상담과 나란한 독립 서비스**다.
기획서가 요구하는 것은 운세의 나열이 아니라 "타고난 나 × 현재 흐름 = 요즘의 나"라는 곱이다.

## 결정 요약

| 축 | 결정 |
| --- | --- |
| 서비스 경계 | 궁합처럼 완전히 분리. 자기 레지스트리·저장소·프롬프트·라우트 |
| 상품 단위 | 명리 연도(세운) 1개 = 이용권 1장 |
| 구간 경계 | 입춘 단독. 대운 전환은 경계가 아니라 07 섹션의 내용 |
| 결과 | 박제(캐시 아님). 구매 시 그해 전 구간 서술을 한 번에 생성 |
| 재조회 | LLM 재호출 없음. 읽는 시점이 속한 구간을 골라 보여준다 |
| 리포트 의존 | 없음. 리포트 본문을 입력으로 받지 않는다 |

## 데이터

### `flows` — 흐름 리포트 1건

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
--
-- ⚠️ 경계 시각은 절대 시각(instant)이다. solarTermDate/solarTermJD 는 +9h 가
-- 박힌 KST 벽시계 값을 돌려주므로 그대로 넣으면 9시간 밀린다. solarTermInstant()
-- 를 쓸 것.
CREATE TABLE flows (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id   bigint NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  flow_year    integer NOT NULL,
  period_start timestamptz NOT NULL,
  period_end   timestamptz NOT NULL,
  segments     jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 한 프로필의 한 해는 한 행. 재요청이 같은 행으로 수렴하는 근거이자,
-- 같은 해에 이용권이 두 번 차감되지 않게 하는 근거다 (subject_key = flow_id).
-- user_id 가 없어도 되는 이유: profiles.user_id 가 NOT NULL 이라 프로필의
-- 소유자는 하나뿐이다 — matches_unique 와 같은 판단.
CREATE UNIQUE INDEX flows_unique ON flows (profile_id, flow_year);
CREATE INDEX flows_user_created_idx ON flows (user_id, created_at DESC);
```

`segments` 의 shape:

```ts
interface FlowSegment {
  id: "segment_1" | "segment_2" | "segment_3";
  start: string; // ISO instant
  end: string; // ISO instant
  basis: "연시작" | "대운전환" | "월운전환";
}
```

### `flow_sections` — 생성된 서술

`match_sections` 와 컬럼까지 같다. 캐시가 아니라 결과 저장이다 — 이용권을 쓴 결과가
새로고침마다 달라지면 안 된다.

```sql
CREATE TABLE flow_sections (
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

### 이용권

`src/lib/tickets/features.ts` 에 두 줄:

```ts
export const FEATURE_IDS = ["full_report", "compatibility", "consultation", "current_flow"] as const;
export const FEATURE_COST: Record<Feature, number> = { ..., current_flow: 1 };
```

**기간별 권한이 따로 필요 없다.** `spendTicket` 의 `subject_key` 에 `flowId` 를 넣으면
`flows_unique` 가 "같은 프로필·같은 해 = 같은 행"을 보장하고, `entitlements_unique` 가
그 행에 두 번 차감되는 것을 막는다. 흐름이 넘어가면 새 `flow_year` → 새 행 → 새
`subject_key` → 새 결제. 궁합이 `matchId` 로 하는 것과 완전히 같은 구조다.

## 구간 계산

### 코드 위치

순수 명리는 `saju-core`, "몇 구간으로 나눌지"는 상품 규칙이라 서비스에 둔다.

```
src/lib/saju-core/flow/
  year.ts     flowYearAt(at: Date) → { year, start, end }
  months.ts   monthTermsOf(year)   → 12개 { 시작 instant, 월운 간지 }
  switch.ts   daeunSwitchIn(analysis, year) → 그해 안의 대운 전환 instant | null
src/lib/saju-core/branch-relations.ts   pairRelations / setRelations
src/app/api/flows/_lib/segments.ts      flowSegments(analysis, year) → FlowSegment[]
```

### 시각은 절대 시각으로 다룬다

`flowYearAt` 은 현재 시각을 인자로 받는다. 서버 로컬 시간이나 사용자 locale 로
`flow_year` 가 달라지면 안 된다. 입춘은 천문학적 순간이라 전 세계 동일하다.

`solar-term.ts` 에 `solarTermInstant(year, longitude): Date` 를 더한다
(`solarTermJDE − ΔT` → 진짜 JD → `Date`). 흐름은 이것만 쓴다.

**⚠️ `solarTermJD` 는 건드리지 않는다.** 그 함수에는 `+ 9 / 24` 가 박혀 있고
(`solar-term.ts:127`), `computeDaeun` 이 `birthJD`(출생 민간시를 그대로 JD 로 만든 값,
`luck.ts:38`)와의 날짜 차로 대운수를 구한다. 양쪽 다 "KST 벽시계를 UT인 척" 하고 있어
`+9/24` 가 상쇄된다. 걷어내면 모든 사용자의 대운수가 조용히 바뀐다.

### 지지 관계 모듈

`tieKinds` 가 `synastry.ts` 안에 private 으로 묶여 있다(`synastry.ts:79`). 이를
서비스 중립 모듈로 꺼내되 **두 종류로 가른다**:

- `pairRelations(a, b)` — 충·형·해·파·원진·육합. 2항으로 완결된다.
- `setRelations(branches)` — 삼합/방합의 완성·반합. 세 지지가 필요하다.

궁합의 현재 삼합 판정은 `BRANCH_SAMHAP[mine].includes(theirs)` 라는 2항 근사(사실상
반합)다. 흐름은 월운·세운·대운·원국 4지를 한 판에 놓으므로 완성 여부를 실제로 판정할
수 있고, 같은 함수를 쓰면 과대평가된다.

**이 브랜치에서 궁합의 삼합 판정은 고치지 않는다.** `match_sections` 는 박제된 결과이고
레지스트리가 직접 경고한다 — "재생성이 곧 이용권 원가다"(`matches/.../registry.ts:11`).
궁합은 `pairRelations` + 기존 2항 삼합을 그대로 유지하고, `setRelations` 는 흐름만 쓴다.
궁합 교정은 비용을 따로 계산해 별건으로 다룬다.

### 전환점 점수

각 월운 구간에 두 축짜리 벡터를 매긴다. **십성은 넣지 않는다.**

- `support` — 흐름이 나에게 힘을 보태는가 소모시키는가
- `friction` — 원국·세운·대운과의 관계가 얼마나 흔들리는가

십성은 그 변화가 **어디에서 체감되는가**(일·관계·돈·표현)를 정하는 축이라 성격이 다르다.
전환 점수에 넣으면 같은 작용을 두 번 반영하고, 재성→관성처럼 범주가 바뀌었다는 이유만으로
실제 세기 차이가 작아도 구간을 억지로 나눈다.

정리하면 **경계 선정은 `support + friction`, 구간별 내용 생성은 거기에 십성까지.**

#### 정규화

두 축이 같은 자를 쓰지 않으면 `friction` 이 혼자 전환을 결정한다.

`support` — 월운 두 글자(천간·지지)의 오행을 각각 채점. 용신 `+1`, 희신 `+0.5`,
용신을 극하는 오행 `−1`, 그 외 `0`. 원값 `−2 … +2`, `/2` 로 `−1 … +1`.

`friction` — 대상 지지 6개(원국 4 + 세운 + 대운)에 `POSITION_WEIGHTS` 기반 자리 가중
(월지 3, 일지 2, 년·시지 1.5, 세운 2, 대운 2 — 합 12). 관계 계수는 충 `1.0`, 형 `0.7`,
원진 `0.5`, 해 `0.4`, 파 `0.3`, 육합 `−0.6`, 삼합 완성 `−0.8`. `Σ(가중 × 계수) / 12`.

synastry 의 `tieWeight`(일지 3 / 월지 2)가 아니라 `POSITION_WEIGHTS` 를 쓰는 이유:
여기서 재는 것은 "두 사람의 밀착"이 아니라 "원국이 흔들리는 정도"다.

#### 전환 선별

**전환점은 벡터의 절대값이 아니라 인접 구간 사이의 변화량이다.**

```
Δ = |Δsupport| + |Δfriction|     (각 축 정규화 후)
```

§12 가 묻는 것은 "어느 달이 센가"가 아니라 "어디서부터 달라지는가"다. 점수가 높은 달을
고르면 다른 질문에 답하게 된다.

대운 전환도 같은 자로 잰다 — 전후 대운 간지로 두 축을 각각 계산해 Δ 를 내고 같은 임계를
통과해야 채택한다. 대운이 바뀌어도 전후가 같은 편이면 구간을 쪼개지 않는다.

채택 규칙:

- Δ 내림차순으로 훑는다
- 임계 미만은 버린다
- 이미 뽑은 전환의 3개월 안에 들면 버린다 (큰 Δ 가 남는다)
- 최대 2개 전환 = 최대 3구간
- 동점이면 **이른 쪽**. 사용자는 지금부터 앞을 보므로 가까운 전환이 더 쓸모 있고,
  무엇보다 결정적이어서 같은 입력이 같은 구간을 낸다

전부 임계 미만이면 구간은 하나이고, 07 섹션은 "올해는 흐름이 크게 갈리지 않는다"는
한 덩어리가 된다.

월운 12개를 **전부 계산하되 최대 2개만 노출**하는 것이 §4 의 "12개월을 모두 해설하지
않는다"를 지키는 방식이다. 계산 해상도와 노출 해상도를 분리한다.

#### 임계값

`FLOW_SEGMENT_THRESHOLD` 상수 하나로 모아 "이 값이 구간 개수를 정한다"고 주석에 못박는다.
`STRENGTH_THRESHOLDS = { strong: 0.55, weak: 0.45 }`(`strength.ts:29`)와 같은 방식이다.
`synastry.ts:70` 이 경고한 "근거 없는 가중치는 나중에 아무도 못 고친다"를 피하는 방법은
상수를 없애는 게 아니라 하나로 모으고 이름을 주는 것이다.

**값은 구현 중에 측정해서 정한다.** `characters-60.json` 의 60 일주 × 여러 생년으로 Δ
분포를 뽑고, **대부분 2구간 · 드물게 1 또는 3** 이 되는 값을 골라 근거를 주석에 남긴다.
눈대중으로 고른 숫자는 아무도 못 고치는 상수가 된다.

## 생성 파이프라인

### 골격

궁합을 복제한다. 파일 이름까지 같게 둬야 나중에 한쪽을 고칠 때 다른 쪽을 찾는다.

```
src/app/api/flows/route.ts              POST — flows 행 findOrCreate
src/app/api/flows/_lib/
  handler.ts           순수 판정 (입력 검증 · 소유권 · 접근)
  generator.ts         FlowGenerator + DeepSeek 구현
  gated-generator.ts   한도 · 이용권 게이트
  produce.ts           저장소에 없는 섹션만 생성
  store.ts             flow_sections CRUD + decode
  segments.ts          구간 계산
  prompt/{system,facts,index}.ts
  sections/{registry,derive,index}.ts
src/lib/flows/
  access.ts  store.ts  rate-limit.ts  tickets.ts
```

게이트 자리는 궁합과 같다. `produce` 가 저장소에 없는 섹션이 있을 때만 생성기를 부르므로
`gated-generator` 에 걸면 **실제로 비용이 드는 순간에만** 차감된다. 생성이 중간에 실패해도
되돌리지 않는다 — 권한 행이 남아 재시도가 공짜이고, `produce` 가 이미 저장된 섹션을
건너뛰어 남은 것만 부른다.

### 입력을 닫는다

흐름 생성의 입력은 다음으로 **닫는다**:

- 원국 계산값
- 신강약·용신 등 타고난 배경
- 해당 연도의 세운
- 현재 대운과 연중 대운 전환
- 계산된 1~3개 구간
- 각 구간의 `support`·`friction`
- 구간별 십성 해석 재료

**리포트 본문은 넘기지 않는다.** 리포트 구매 여부나 생성 상태가 흐름 결과에 영향을 주지
않는다. 이유 셋:

1. 왼쪽 항("타고난 나")은 이미 facts 에 있다. 리포트와 흐름은 같은 원국 계산에서 나온다.
   리포트 본문은 그 계산에서 이미 파생된 것이라, 넘기면 같은 정보를 두 번 주면서 결합만
   만든다.
2. 하드 의존이 생긴다. "있으면 쓰고 없으면 만다"로 하면 같은 사람의 같은 해가 리포트 구매
   여부에 따라 다르게 생성되고 그게 박제된다. **결정적이지 않은 입력을 박제 상품에 넣으면
   재현할 수 없는 결과가 남는다.**
3. 리포트 섹션이 버전업되면 흐름 서술의 전제가 바뀌는데 흐름은 박제라 어긋난 채 남는다.

### 중복 방지는 역할 기준

§15 의 목표를 **문장 중복 방지가 아니라 역할 중복 방지**로 정의한다. 우연히 비슷한 표현이
일부 나오는 것은 허용하되, **흐름 서비스가 타고난 성향 설명에서 끝나는 것은 금지한다.**

프롬프트 규칙:

> 타고난 성향 자체를 독립적으로 설명하지 마라. 반드시 평소의 경향을 짧게 제시한 뒤,
> 현재 흐름으로 무엇이 강해지거나 약해지거나 다른 방식으로 나타나는지 설명하라.

대비 문형("원래는 …하는 편이지만, 지금은 …", "평소보다 …하기 쉬워요", "기존의 … 성향이
요즘에는 …으로 작동할 수 있어요")을 예시로 준다. 다만 모든 문장을 같은 틀로 쓰면 기계적으로
보이므로 **각 구간 또는 항목마다 최소 한 번** 대비를 포함하도록 규정한다.

### facts 블록 — 숫자를 넘기지 않는다

`SYSTEM_PROMPT` 가 숫자를 금지하므로 계산한 점수를 그대로 넘길 수 없다. 궁합이 나이차를
`"또래" | "터울" | "한 세대 차"` 로 바꿔 넘긴 것과 같은 처리다(`matches/.../facts.ts:5`).

```
[연간 배경]   원국 요약(chartFacts 재사용) · 신강약 · 용신/희신 · 올해 간지 · 현재 대운 간지

[구간 1/3]    받쳐줌: 크게 받쳐줌 | 받쳐줌 | 중립 | 눌림 | 크게 눌림
              흔들림: 잔잔함 | 흔들림 | 크게 흔들림
              두드러지는 힘: 재성 · 식상        ← 십성. 04·05·06 섹션의 재료
              앞 구간 대비: 받쳐줌이 커지고 흔들림은 줄어듦
```

`support`/`friction` 은 5단계·3단계 **범주 라벨**로, 십성은 **그룹 이름**으로 넘긴다.
날짜는 넘기지 않는다 — 구간은 "1/3" 같은 서수로만 식별한다.

"앞 구간 대비" 줄이 §12 의 핵심이다. 없으면 LLM 이 각 구간을 독립적으로 써서 "무엇이
달라지는가"가 아니라 "각 구간이 어떤가"가 된다.

### 섹션 스키마

```ts
export const FLOW_SECTIONS = {
  now:       { ... },  // 01 지금의 흐름
  rising:    { ... },  // 02 지금 살아나는 것
  straining: { ... },  // 03 지금 부담되는 것
  work:      { ... },  // 04 일과 선택
  relating:  { ... },  // 05 관계
  money:     { ... },  // 06 돈과 현실
  ahead:     { ... },  // 07 앞으로의 변화 — common 없음, 타임라인 그 자체
  remember:  { ... },  // 08 지금 기억할 것
} as const satisfies Record<string, FlowSectionSpec>;
```

01~06·08 은 `segmented(n)`, 07은 `timeline(n)` 이다. `common` 은 그해 전체의 배경,
`segments[i]` 는 그 구간의 서술 — 역할이 달라서 구간이 하나여도 중복이 아니다.

```ts
const segmented = (n: number) =>
  z.object({ common: z.string().min(1), segments: segmentList(n) }).strict();

const timeline = (n: number) => z.object({ segments: segmentList(n) }).strict();
```

`n` 은 계산된 구간 수라 스키마가 요청 시점에 만들어진다. 레지스트리의 `schema` 가
`z.ZodType` 상수가 아니라 `(n: number) => z.ZodType` 팩토리가 되는 것이 리포트·궁합
레지스트리와 다른 유일한 점이고, `derive.ts` 의 `llmInputSchema`/`parseSectionContent` 도
`n` 을 받는다.

**한 섹션당 한 콜**로 `common` 과 전 구간을 함께 받는다. 비용뿐 아니라 품질 때문이다 —
LLM 이 구간 셋을 한자리에서 보면 서로 다르게 쓰지만, 따로 부르면 같은 말을 세 번 한다.

`FlowSectionSpec` 은 궁합처럼 `tier`/`storage` 가 없다. `version` 주석에 궁합과 같은 경고를
단다 — **버전을 올리면 이미 판 흐름 전부가 다시 생성된다.**

### `segmentId` 는 타입으로 강제한다

LLM 이 `segmentId` 를 반환하되 **자유 문자열이면 받는 의미가 없다.** LLM 이 쓴 id 는
LLM 이 쓴 순서보다 더 믿을 만하지 않아서, 검증 없이 받으면 확인할 수 없는 값이 하나 늘 뿐이다.

계산된 구간 개수로 `z.enum` 을 만들어 **어긋남이 파싱 실패가 되게** 한다:

```ts
// 구간이 2개면 z.enum(["segment_1", "segment_2"]) — 3은 애초에 통과하지 못한다.
const segmentSchema = (n: number) =>
  z
    .object({
      segmentId: z.enum(SEGMENT_IDS.slice(0, n)),
      title: z.string().min(1),
      body: z.string().min(1),
    })
    .strict();
```

파서는 **id 집합이 정확히 일치하는지**(누락·중복 없음)까지 확인한다. 잘못 정렬되거나
빠뜨린 응답은 조용히 어긋나는 대신 `parseFlowSectionContent` 가 `null` 을 돌려주고
`produce` 가 그 섹션만 다시 생성한다.

이는 `yearlyLuck` 의 인덱스 짝짓기에서 **의도적으로 벗어나는 지점**이다. 그쪽은 행들이
균질한 타임라인이라 순서만 맞으면 되지만, 여기 구간은 `flows.segments` 의 날짜와 교차
참조되므로 어긋나면 11월 서술이 2월 칸에 붙는다.

### 시스템 프롬프트

`SYSTEM_PROMPT` 를 상속하고 흐름 전용 규칙만 덧붙인다 — 궁합의 `MATCH_SYSTEM_PROMPT` 와
같다. 문체·금지 조항을 두 벌로 두면 한쪽만 고쳐진다.

덧붙일 것:

- 사건 확정 예언 금지 (§17)
- 점수·별점 금지 (§18)
- 좋은 시기 / 나쁜 시기 평가 금지 (§6)
- 신비주의 어휘 금지 (§19 — 하늘의 기운·대박운·귀인·횡재수)
- 명리 용어 금지 (§20)
- 투자 종목·시점·수익 보장·부동산·복권 금지 (§11)
- 역할 중복 방지 규칙 (위 "중복 방지는 역할 기준")

시간 표현 규칙은 **좁게** 쓴다. "숫자 금지"로 넓게 걸면 §16 이 권장하는 "앞으로 몇 달",
"한 번에" 같은 표현까지 막힌다:

> 연도, 월, 날짜, 구간 번호와 기간을 임의로 만들지 마라. 정확한 시간 표시는 계산된
> 메타데이터가 화면에서 붙인다. 본문에서는 "지금", "이 구간", "다음 흐름으로 넘어가면서"
> 같은 상대 표현을 사용하라.

## 화면

### 라우트

```
/flow          확인 화면 (프로필 기본 선택 + 기간 + 차감 안내)
/flow/[id]     결과
```

컴포넌트는 궁합 복제: `FlowShell` · `FlowHero` · `FlowBody` · `AnalyzingFlow` ·
`FlowError` · `FlowRateLimited` · `FlowOutOfTickets`.

### 확인 화면

홈에서 "나로 정한" 프로필(`users.primary_profile_id`)을 들고 `/flow` 로 이동하고, 진입
화면에서는 그 프로필이 **이미 선택된 상태**로 보인다. 매번 고르는 번거로움은 없애되,
이용권이 차감되는 순간은 사용자가 명확히 확인한다.

```
지금의 흐름

김OO님의 현재 흐름을 살펴볼게요.

적용 기간
2026년 2월 초부터 2027년 2월 초까지

이용권 1장을 사용합니다.

[지금의 흐름 보기]   [다른 프로필 선택]
```

바로 `/flow/[id]` 로 보내지 않는 이유: `id` 는 흐름 행이 생성된 뒤에 생기므로 미구매
사용자는 결국 생성 요청이 필요하다. 그 요청을 명시적인 CTA 뒤에 두는 편이 결제 경험으로도
안전하다.

**⚠️ "이미 확인한 흐름" 판정은 `flows` 행 존재가 아니라 `entitlements` 로 한다.**
행 생성(무료)과 차감(생성 자리)이 다른 자리이기 때문이다. CTA 를 눌러 행은 만들어졌는데
생성이 한도나 잔액에서 막히면 **행은 있고 이용권은 안 나간** 상태가 남는다. 행 존재로
판정하면 "추가로 사용하지 않습니다"라고 안내한 뒤 실제로 차감된다.

```
1. findFlow(profileId, flowYear) → row | null
2. row 있음 + entitlement(userId, 'current_flow', row.id) 있음 → "이어서 보기"
3. 그 외 → "이용권 1장을 사용합니다"
```

동선:

- 미구매: 홈 → `/flow` 확인 → 차감 및 생성 → `/flow/[id]`
- 구매 완료: 홈 → `/flow` → 추가 차감 안내 없이 기존 결과 열기
- 다른 프로필: `/flow` 에서 변경 → 그 프로필의 구매 여부 재확인

### "지금 여기"

서버 컴포넌트가 읽는 시점의 `now` 로 `flows.segments` 에서 칸을 고른다. LLM 도 재계산도 없다.

```ts
// segments 의 start/end 는 jsonb 안에서 ISO 문자열이다. 비교 전에 instant 로 되돌린다 —
// 문자열끼리 비교하면 대부분 맞다가 오프셋 표기가 다른 행에서 틀린다.
const at = now.getTime();
const current =
  flow.segments.find((s) => at >= Date.parse(s.start) && at < Date.parse(s.end)) ??
  flow.segments.at(-1);
```

`?? at(-1)` 이 필요한 이유: `period_end` 를 지난 뒤에도 산 리포트는 계속 볼 수 있어야 한다.
그때는 마지막 구간을 보여주면서 "이 흐름은 지났습니다 — 새 흐름 보기"로 안내한다. 이것이
§21 의 재조회 동선이자 재구매 동선이다.

01~06·08 은 `common` 위에 `segments[current]` 를 얹고, 07은 전체 타임라인에 현재 칸을
표시한다.

### 연도 표기

**2026년 1월 20일에 조회하면 `flow_year` 는 2025 다.** 그 사람에게 "2025년의 흐름"이라고
쓰면 이상하고 "2026년"이라고 쓰면 내용과 다른 말이 된다.

결정: **연도를 상품명으로 쓰지 않되, 적용 기간에서 연도를 감추지도 않는다.** 연도를 감추면
사용자가 이미 구매한 범위와 다음 결제 시점을 이해하지 못한다.

```
지금의 흐름
2026년 2월 4일 무렵부터 2027년 2월 4일 무렵까지
지금은 이 흐름의 두 번째 구간을 지나고 있어요.
```

정확한 입춘 시각은 내부 권한 판정에만 쓰고, 화면에는 날짜 또는 "2월 초 무렵" 정도로
부드럽게 표시한다. `flow_year` 는 유니크 키와 권한의 정체성으로만 남는다.

### 홈 진입

`ExploreGrid` 에 카드를 더한다. `md:grid-cols-2` 라 5개면 마지막 한 장이 혼자 남으므로
(`ExploreGrid.tsx:25`), 흐름을 리포트 다음 **두 번째**에 놓아 노출을 살리고 홀로 남는
자리는 뒤쪽 카드가 되게 한다.

> **요즘의 나** / 지금의 흐름 / 요즘 나를 둘러싼 흐름과, 가까운 변화를 읽어보세요. /
> **흐름 보기 →**

### §22 연결

04(일과 선택) 끝에 상담, 05(관계) 끝에 궁합 링크를 단다. **링크는 LLM 이 아니라 화면이
붙인다** — 문구가 고정이라 생성할 이유가 없고, 생성하면 §11 이 금지한 조언으로 새기 쉽다.

## 하지 않는 것

- **§14 "내 흐름의 근거 자세히 보기"** — 1차 범위 밖. 원국·대운·세운 계산값을 보여주는
  별도 화면이 필요하다.
- **궁합의 삼합 판정 교정** — 이미 판 궁합 전부의 재생성 비용이 든다. 별건.
- **`yearlyLuck`/`daeunOutlook` 제거** — 다른 브랜치의 일. 흐름은 새 테이블이라 그쪽이
  무엇을 지우든 독립적으로 머지된다.
- **월별 운세** — 월운 12개를 계산하되 최대 2개 전환만 노출한다 (§4).
- **구간별 판매** — 상품 단위는 연 1회. 대운이 바뀌는 해에도 결제는 한 번이다.

## 열린 항목

`FLOW_SEGMENT_THRESHOLD` 의 값. 구현 중 측정 단계에서 정하고 근거를 주석에 남긴다.
구현 계획에 별도 항목으로 넣는다.
