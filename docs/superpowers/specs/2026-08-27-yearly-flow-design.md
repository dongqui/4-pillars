# 한 해의 흐름 — 연간 리포트 서비스

날짜: 2026-08-27
브랜치: `claude/saju-current-flow-planning-d52137`

앞선 스펙 [`2026-08-26-current-flow-design.md`](2026-08-26-current-flow-design.md) 을 대체한다.
그 스펙으로 구현된 코드(커밋 26개)는 계산 층을 남기고 편집 층을 걷어낸다.
논의 기록은 [`2026-08-26-current-flow-decisions.md`](2026-08-26-current-flow-decisions.md) 에 있다.

## 문제

앞선 설계는 "나는 **지금** 어떤 시기를 지나고 있는가" 에 답했다. 그래서 한 해를 1~3개
구간으로 자르고, 읽는 시점이 속한 구간을 골라 보여줬다.

새 기획서는 질문을 바꾼다 — **"내가 고른 한 해는 어떤 흐름을 가지고 있는가."**

질문이 바뀌면서 구간이 답이 아니게 됐다. 몇 달짜리 덩어리 두세 개는 사용자가 기대하는
월별 변화를 보여주지 못하고, 모든 섹션이 같은 구간을 반복 설명하며, `5월부터`·`앞
구간에서는` 같은 표현이 과하게 등장한다. 그리고 사용자가 연도를 직접 고르는 이상
"지금" 을 전제한 섹션명(`지금 살아나는 것`)은 과거·미래 조회에서 거짓말이 된다.

대신 **12개월 전부 + 그중 방향이 실제로 달라지는 지점**을 보여준다.

## 결정 요약

| 축 | 결정 |
| --- | --- |
| 사용자 단위 | 1~3개 구간 → **12개월 + 변곡점 0~4개** |
| 조회 시점 | "현재 구간" 없음. 사용자가 연도를 고른다 (현재 ±5년) |
| 상품 단위 | 그대로 — 프로필 × 명리 연도 = 이용권 1장 |
| 기간 경계 | 그대로 — 입춘 → 다음 입춘 |
| 대운 | 그대로 — 경계가 아니다. 연간 배경과 01 의 내용 |
| 생성 순서 | **코드가 서사를 먼저 확정**하고 9개 섹션이 같은 사실을 본다 |
| 변곡점 판정 | support·friction Δ **만**. 십성·관계 이름은 재료로만 |
| 본문 시제 | **중립**. 지난/올해/다가올은 화면 태그로만 |
| 기능 id | `current_flow` → **`yearly_flow`** |
| 라우트·테이블 | `/flow`·`flows` 그대로 |

## 걷어내는 것

| 대상 | 이유 |
| --- | --- |
| `flowSegments` · `SEGMENT_IDS` · `FLOW_SEGMENT_THRESHOLD` 현재 값 | 구간이 사용자 단위가 아니다 |
| `MIN_SEGMENT_MONTHS` | 구간을 안 자르므로 지킬 폭이 없다 |
| `FLOW_SECTIONS` 8종 전부 | 섹션명·모양·개수가 모두 바뀐다 |
| `src/app/flow/[id]/_lib/current-segment.ts` | 읽는 시점으로 서술을 고르지 않는다 |
| `flows.segments` 컬럼 | `months` 로 교체 |

## 데이터

### 테이블을 다시 만든다

`flows.segments` 가 `months` 로 바뀌고 `flow_sections.section_key` 9종이 전부 새 값이라,
개발 DB 의 기존 행은 남겨도 한 줄도 읽히지 않는다. **판매 이력이 없으므로**(이 브랜치는
main 에 없다) 두 테이블을 지우고 다시 만든다.

> ⚠️ 이 판단은 **미출시 상태에서만** 유효하다. 이 마이그레이션을 프로덕션이 있는
> 상황의 선례로 삼지 말 것.

> ⚠️ 개발 DB 는 워크트리 사이에서 공유된다. 이 마이그레이션을 돌리면 다른 브랜치가
> 만들어 둔 테스트 흐름도 같이 사라진다.

번호는 0037 부터. Neon HTTP 드라이버가 파일당 한 문장만 받으므로 한 문장에 한 파일이다.

| 파일 | 문장 |
| --- | --- |
| `0037_flow_sections_drop.sql` | `DROP TABLE IF EXISTS flow_sections` (FK 때문에 먼저) |
| `0038_flows_drop.sql` | `DROP TABLE IF EXISTS flows` |
| `0039_flows.sql` | `CREATE TABLE flows` (아래) |
| `0040_flows_unique.sql` | `CREATE UNIQUE INDEX flows_unique ON flows (profile_id, flow_year)` |
| `0041_flows_user_profile_idx.sql` | `CREATE INDEX flows_user_profile_idx ON flows (user_id, profile_id)` |
| `0042_flow_sections.sql` | `CREATE TABLE flow_sections` |
| `0043_entitlements_current_flow_purge.sql` | `DELETE FROM entitlements WHERE feature = 'current_flow'` |

`migrations/README.md` 의 "다음 번호" 를 0044 로 고친다.

0041 은 앞선 설계의 `flows_user_created_idx` 를 대신한다. 그 인덱스는 죽은
`listFlows` 하나만을 위해 있었지만, 이제 선택 화면이 **프로필별 보유 연도**를 물어야
해서 `(user_id, profile_id)` 가 실제로 쓰인다.

0043 이 필요한 이유는 id 재사용이다. `flows.id` 는 `GENERATED ALWAYS AS IDENTITY` 라
테이블을 다시 만들면 1 부터 다시 센다. 옛 권한 행의 `subject_key` 가 새 흐름의 id 와
겹칠 수 있다. 기능 id 를 `yearly_flow` 로 바꾸는 것만으로도 매칭이 깨져 사고는 나지
않지만, 죽은 행을 남겨 두면 다음 사람이 이 안전이 **우연이었다는 사실**을 모른다.
(ticket_entries 는 지우지 않는다 — 원장은 일어난 일의 기록이다)

### `flows`

```sql
-- 흐름 리포트 1건. 이용권 1장이 차감되는 단위이기도 하다.
--
-- flow_year 는 달력 연도가 아니라 명리 연도(세운)다 — 입춘에서 바뀐다.
-- 앞선 설계와 달리 "지금" 이 아니라 **사용자가 고른 해**다.
--
-- period_start/end 와 months 를 저장하는 이유는 같다: 절기 계산이 정밀해지거나
-- PIVOT_THRESHOLD 를 튜닝해도 **이미 판 상품이 소급해서 바뀌면 안 된다**.
-- 읽을 때마다 다시 계산하면 임계값 한 번 조정으로 저장된 08 이 가리키는 달과
-- 실제 변곡점이 어긋난다.
--
-- ⚠️ 경계 시각은 절대 시각(instant)이다. solarTermDate/solarTermJD 는 +9h 가
-- 박힌 KST 벽시계 값을 돌려주므로 solarTermInstant() 를 쓸 것.
CREATE TABLE flows (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id   bigint NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  flow_year    integer NOT NULL,
  period_start timestamptz NOT NULL,
  period_end   timestamptz NOT NULL,
  months       jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

`months` 는 12개 원소다:

```jsonc
[
  { "index": 1,  "start": "2027-02-04T…Z", "end": "…", "korean": "임인", "pivot": false },
  { "index": 3,  "start": "…",             "end": "…", "korean": "갑진", "pivot": true  }
]
```

**변곡점을 별도 배열이 아니라 월의 플래그로 둔다.** 두 배열로 나누면 07 과 08 이 서로
다른 달을 가리키는 상태가 표현 가능해진다. 하나의 출처로 묶으면 그 불일치가 애초에
만들어지지 않는다.

### `flow_sections`

앞선 설계와 컬럼이 같다. 주석의 content 설명만 새 모양으로 고친다.

`schema_version` 을 올리면 이미 판 흐름 전부가 다음 열람에서 다시 생성된다. 다만
`entitlements` 행이 남아 있어 `spendTicket` 이 `kind:"already"` 로 돌아오므로 **지갑은
깎이지 않는다** — 원가는 이용권이 아니라 LLM 호출이다.

### 이용권

```
flows_unique (profile_id, flow_year)
  → entitlements.subject_key = flow_id
  → entitlements_unique
```

권한이 로직이 아니라 구성에서 나온다. 사용자가 연도를 고르게 되면서 이 성질이 더
중요해졌다 — 같은 프로필의 2027년과 2028년은 **다른 행**이라 자연히 다른 결제다.

`FEATURE_IDS` 의 `current_flow` 를 `yearly_flow` 로 바꾼다. 이 값은
`entitlements.feature` 에 그대로 들어가는 값이라 원래는 마이그레이션 대상이지만,
판매 이력이 없어 지금은 공짜다. 나중에는 못 바꾼다.

## 계산 층

### 연도로 기간을 묻는다

```ts
/** 명리 연도 하나의 경계. flowYearAt 의 형제 — 이쪽은 시각이 아니라 연도로 묻는다. */
export function flowYearOf(year: number): FlowYearPeriod;
```

`flowYearAt(at: Date)` 는 그대로 둔다. 선택 화면이 "지금은 몇 년인가" 를 물을 때 쓴다.

### 관계를 숫자로 접기 전에 이름으로 꺼낸다

지금 `frictionOf` 는 `pairRelations` 가 돌려준 관계 이름들을 가중합 안에서 숫자로
접어 버린다. 그래서 07 의 달 제목을 만들 재료가 두 축뿐이고, 12개 달이 "받쳐주는
달 / 흔들리는 달" 로 여섯 번씩 반복될 위험이 있다.

`score.ts` 를 둘로 나눈다:

```ts
export type InteractionTarget = "년지" | "월지" | "일지" | "시지" | "세운" | "대운";

export interface Interaction {
  target: InteractionTarget;
  kind: PairKind;
}

/** 이 지지가 무엇과 어떤 관계를 맺는가. 이름 그대로 돌려준다. */
export function relationsOf(branch: Branch, targets: FrictionTargets): Interaction[];

/** 위 목록 + 삼합 완성 여부를 가중합해 −1…+1 로 접는다. */
export function frictionOf(branch: Branch, targets: FrictionTargets): number;
```

**변곡점 판정은 여전히 숫자만 본다.** 십성을 탐지에서 뺀 앞선 판단이 그대로 유지되고,
관계 이름도 같은 대접을 받는다 — 세기는 점수로, 이름은 재료로. 범주가 바뀌었다는
이유만으로 전환을 만들지 않는다.

`FrictionTargets.natal` 이 `[년, 월, 일, 시]` 순서라 자리 이름을 붙일 수 있다. 시주가
없는 프로필은 배열이 3개로 짧아지는데, 시가 마지막이라 앞 세 자리의 대응은 안 깨진다.

### 시간 미상 프로필의 friction 을 바로잡는다

```ts
// 지금: 상수
export const WEIGHT_TOTAL = 12;
```

분자에는 실제로 존재하는 자리만 기여하는데 분모가 12 로 고정이다. **시간 미상
프로필은 friction 이 구조적으로 낮게 나오고, 그래서 변곡점을 덜 받는다.** 분모를
실제 대상 가중치 합으로 바꾼다:

```ts
export function weightTotal(targets: FrictionTargets): number;
```

앞선 설계의 임계값 보정이 `hour: 9` 표본만 썼기 때문에 이 편향이 측정에 잡히지
않았다. 재측정 표본에 시간 미상을 섞는다.

### 월별 채점

`monthScores(analysis, year)` 는 그대로 12개를 채점한다. 달라지는 것은 결과에 관계
목록과 십성 그룹이 함께 실린다는 점이다.

```ts
export interface MonthScore {
  term: MonthTerm;          // index 는 term 의 순서(1‥12)
  support: number;
  friction: number;
  interactions: Interaction[];
  samhap: boolean;          // 이 달이 들어와 삼합이 새로 완성되는가
  tenGods: TenGodGroup[];   // 이 달 간지의 천간·지지가 일간 대비 무슨 세력인가
}
```

### 변곡점

```ts
/** 상한. 넘치면 Δ 가 큰 쪽부터 자른다. */
export const MAX_PIVOTS = 4;

/** 변곡점끼리 이보다 가까우면 작은 쪽을 버린다. */
export const MIN_PIVOT_GAP_MONTHS = 2;

/** ⚠️ 측정으로 정한다. 아래 "열린 항목" 참고. */
export const PIVOT_THRESHOLD = /* TBD */;
```

**후보는 두 번째 월 구간부터 마지막까지다.** 달 이름이 아니라 **순서**로 정의한다 —
08 은 "새 세운이 시작됐다" 를 다시 알려주는 섹션이 아니라, 그 해가 시작된 뒤 내부에서
방향이 달라지는 지점을 찾는 섹션이다. 첫 월 구간은 01 의 연간 축이 이미 설명한다.

첫 월 구간을 빼는 것은 신호 품질 문제이기도 하다. 세운이 입춘에 바뀌므로 첫 달과 전년
마지막 달 사이의 Δ 는 거의 항상 크다. 넣으면 첫 달이 매년 변곡점이 되어 신호가 아니라
상수가 된다.

Δ 는 인접한 월 구간 사이의 변화량이다:

```
Δᵢ = |supportᵢ − supportᵢ₋₁| + |frictionᵢ − frictionᵢ₋₁|      (i = 2‥12)
```

높은 달이 아니라 **달라지는 달**을 고른다. 절대값을 쓰면 "어디서부터 달라지는가" 가
아니라 "어느 달이 센가" 에 답하게 된다.

대운 전환이 든 월 구간은 Δ 에 전후 대운 차이를 얹어 겨룬다. **다만 전환이 첫 월
구간에 걸리면 후보에서 빠진다** — 전환을 잃는 것이 아니라 08 이 아니라 01 이 말한다.

선정:

1. Δ 내림차순으로 정렬한다. 동점이면 이른 달 (같은 입력이 같은 결과를 내야 한다).
2. 위에서부터 훑으며 `Δ < PIVOT_THRESHOLD` 는 버린다.
3. 이미 뽑힌 변곡점과 `MIN_PIVOT_GAP_MONTHS` 미만이면 건너뛴다.
4. `MAX_PIVOTS` 개를 채우면 멈춘다.

Δ 내림차순으로 훑기 때문에 3번에서 **작은 쪽이 자동으로 탈락한다.** 인접한 두 달이
모두 변곡점이면 "3월에 바뀌고 4월에 또 바뀐다" 가 되어 변화가 아니라 소음으로 읽힌다.

변곡점 0개는 유효한 결과다 (§21). 억지로 만들지 않는다.

### 연간 축

```ts
export interface YearFacts {
  sewunKorean: string;
  daeunKorean: string;
  /** 이 해가 대운 10년의 어디쯤인가. 경과 연수 0‥3 초반 · 4‥6 중반 · 7‥9 후반 */
  daeunPhase: "초반" | "중반" | "후반";
  /** 그 해에 대운이 바뀌면 전후 간지. 없으면 null */
  daeunSwitch: { before: string; after: string } | null;
  support: string;
  friction: string;
  tenGods: TenGodGroup[];
}
```

**`daeunSwitch` 를 `daeunPhase` 와 별도로 유지한다.** 전환이 있는 해를 "대운 중반" 하나로
뭉개면 그 해의 가장 큰 배경 변화가 사실 블록에서 사라진다.

## 생성 파이프라인

### 코드가 먼저 서사를 확정한다

```
원국 계산
  → flowYearOf(year)              기간
  → monthTermsOf(year)            12개 절기
  → currentDaeun / daeunSwitchIn  대운 위치·전환
  → monthScores                   월별 두 축 + 관계 + 십성
  → 인접 월 Δ                     변곡점 후보
  → 변곡점 선정                    0~4개
  → 연간 축 확정
  → FlowContext
```

`FlowContext` 하나를 9개 섹션이 **똑같이** 본다. LLM 호출은 병렬 9회로 유지된다.

01 을 먼저 생성해 나머지에 넘기는 방식은 쓰지 않는다. 문장 수준의 일관성은 더 높지만
생성이 2단계가 되어 체감 지연이 두 배가 되고, 01 이 실패하면 나머지 여덟이 전부 막힌다.
같은 사실을 보는 것으로 §36 이 막으려는 것(`3월에는 시작하세요. 4월에도 시작하세요.`)은
막힌다 — 그 반복은 각 달이 **서로를 모른 채** 쓰일 때 생기는데, 07 은 12개월을 한 번에
쓰는 한 호출이라 애초에 서로를 본다.

### 사실 블록

```
[연간]
일간: … · 성별: …
신강약: 신강                      ← 지금은 숫자 필터가 이 줄을 통째로 날린다
오행 분포: 화 많음 · 수 없음
두드러지는 힘: 식상 · 재성
올해 간지: 정미
대운 간지: 신해 (후반)
대운 전환: 신해 → 임자            ← 있는 해만
받쳐줌: 받쳐줌 · 흔들림: 흔들림
용신: 수 · 희신: 금

[3번째 달]
받쳐줌: 받쳐줌 · 흔들림: 잔잔함
두드러지는 힘: 식상 (앞달의 인성에서 바뀜)
원국과의 작용: 일지와 육합 · 월지와 형
세운과의 작용: 충
삼합: 새로 완성됨
앞달 대비: 받쳐줌이 커짐
변곡점: 예
```

**앞선 설계의 F1 을 여기서 고친다.** 지금 `flowFacts` 는 `chartFacts` 출력에서 숫자가
든 줄을 정규식으로 걸러내는데, 그 필터가 네 줄을 날린다 — 오행 분포·십성 분포·세력
점수·**신강약**. LLM 이 신강인지 신약인지 모른 채 팔리는 리포트를 전부 쓰고 있다.
필터 대신 신강약은 단계 어휘로, 분포는 `많음/적음/없음` 라벨로 넘긴다.

숫자를 안 넘기는 원칙은 유지하되 범위를 좁힌다: **금지 대상은 점수·확률 같은 내부
계산값이지 달의 순번이 아니다.** 달은 순번(1‥12)으로 넘기고, `3월` 같은 표시는 화면이
붙인다. 명리 용어를 사실 블록에 넣는 것은 리포트의 `chartFacts` 가 이미 하는 일이다 —
§27 이 금지하는 것은 **출력**이지 입력이 아니다.

### 섹션 9종

| 키 | 섹션 | content |
| --- | --- | --- |
| `overview` | 01 한 해의 흐름 | `{ title, body, keywords[4] }` |
| `rising` | 02 힘이 실리는 것 | `{ lead, items[3] }` |
| `straining` | 03 부담되는 것 | `{ lead, items[3] }` |
| `work` | 04 일과 선택 | `{ lead, body }` |
| `relating` | 05 관계 | `{ lead, body }` |
| `money` | 06 돈과 현실 | `{ lead, body }` |
| `months` | 07 월별 흐름 | `{ lead, months[12] }` |
| `pivots` | 08 올해의 변곡점 | `{ lead, pivots[n] }` |
| `closing` | 09 이 해의 포인트 | `{ lead, items[3], closing }` |

`items` 와 `months` 와 `pivots` 의 원소는 모두 `{ title, body }` 에 식별자가 붙는
모양이다. 기획서가 02·03·09 를 "3개 정도" 라고 쓰지만 **정확히 3개로 고정한다** —
개수를 프롬프트로 부탁하면 지켜지지 않는 날이 오고, 화면은 그때 2개짜리 목록을 받는다. `keywords` 는 §34 첫 화면의 `정리 · 선택 · 연결 · 지속` 이다.

### 개수를 타입으로 못 박는다

스키마는 상수가 아니라 팩토리다. 앞선 설계는 구간 수 `n` 하나를 받았지만, 이제 섹션마다
필요한 값이 다르다:

```ts
export interface FlowSchemaContext {
  /** 계산된 변곡점의 달 번호. 0개일 수 있다 */
  pivotMonths: readonly number[];
}

export interface FlowSectionSpec {
  version: number;
  schema: (ctx: FlowSchemaContext) => z.ZodType;
  prompt: string;
  example: string;
}
```

**07 — 길이 12 + `monthIndex` 가 1‥12 + 중복 없음.** 셋이 모이면 비둘기집 원리로 집합이
정확히 일치한다. 하나만 빠져도 "개수는 맞는데 한 칸이 비고 다른 칸이 두 번" 이 통과한다.

**08 — 정의역을 계산된 변곡점으로 좁힌다.** 변곡점이 3·7·10월이면:

```ts
z.object({
  lead: z.string().min(1),
  pivots: z.array(
    z.object({
      monthIndex: z.union([z.literal(3), z.literal(7), z.literal(10)]),
      title: z.string().min(1),
      body: z.string().min(1),
    }).strict(),
  ).length(3).superRefine(/* 중복 금지 */),
}).strict()
```

LLM 이 5월을 변곡점이라고 우길 방법이 없다. 변곡점이 0개면 `.length(0)` 이라 §21 이
그대로 타입이 된다 — 그때 `lead` 가 "올해는 흐름이 크게 꺾이기보다 비슷한 방향이 길게
이어지는 편이에요" 를 맡는다.

저장소에서 읽어 올 때도 **같은 컨텍스트로 다시 검증한다.** 변곡점은 `flows.months` 에
박제돼 있어 원래 달라질 수 없으므로, 어긋난다면 그것은 손상이다. 손상된 섹션은 없는 것으로
보고 다시 생성한다 — `entitlements` 행이 남아 있어 재생성은 지갑을 깎지 않는다.

### 07 과 08 의 역할 분담

기획서의 두 예시가 같은 달에 대해 거의 같은 말을 한다:

> §17 `4월 · 흐름이 바뀌는 달` — "앞선 달까지 안에서 준비하던 힘이 바깥으로 향하기 시작해요."
> §20 `4월 무렵` — "앞선 시기까지 생각과 준비에 머물던 힘이 실제 행동과 사람 쪽으로 이동하기 시작해요."

같은 달을 두 섹션이 각각 서술하니 구조상 겹친다. 프롬프트에 분담을 명시한다:

- **07 은 장면.** 그 달 안에서 무엇을 하게 되는가. 관계·십성·작용을 재료로 그 달만의
  구체를 쓴다.
- **08 은 구조.** 왜 하필 그 시점에 방향이 바뀌며, 그 전환이 한 해 전체에서 무슨
  의미인가. **앞뒤 구간을 반드시 비교**한다.

같은 달을 다루되 답하는 질문이 다르다.

### 본문은 시제 중립

§23 이 "리포트 본문 자체는 현재 시점에 의존하지 않는다" 고 했는데, 연도 선택이 생기면서
이 규칙의 사정거리가 넓어진다. 2029년 흐름을 2026년에 사면 "다가올" 이지만 2030년에 다시
열면 지난 해다. **박제된 문장이 시간이 지나 거짓말이 되지 않으려면 과거·미래 어투를 본문에
넣으면 안 된다.**

§28 의 표현 원칙(`~하기 쉬운 해예요`·`~가 중요해지는 달이에요`)이 이미 시제 중립이라
그대로 규칙이 된다. 지난/올해/다가올과 현재 월 강조는 **화면이** 붙인다.

### 시스템 프롬프트

`FLOW_SYSTEM_PROMPT` 는 리포트의 `SYSTEM_PROMPT` 를 이어받고 다음을 더한다.

- §27 — 명리 용어를 설명의 중심으로 쓰지 않는다. 사실 블록의 용어는 재료이지 출력이 아니다.
- §28 — 사건을 확정하지 않는다. 흐름과 경향으로 쓴다.
- §29·§30 — 점수·별점으로 환산하지 않는다. 내부 수치를 노출하지 않는다.
- §31 — 우주의 기운·대박운·귀인 같은 어휘를 쓰지 않는다.
- **시제 중립** — 위 항목.
- **연도·월·날짜를 지어내지 않는다.** 시간 표시는 계산된 값이 화면에서 붙는다.
- §19 — 모든 달을 설명하되 모든 달이 특별하다고 말하지 않는다. 변화가 작은 달은 그렇게 쓴다.

## 화면

### `/flow` — 선택

시안 `Saju Yearly Report.dc.html` 을 따른다. 한 화면에서 프로필과 연도를 모두 고른다.

```
한 해의 흐름
어떤 해를 살펴볼까요?

누구의 흐름인가요?   [ 동진  1993.04.12 · 남 · 09:20  ▾ ]  [+ 사주 추가]

어떤 해인가요?                              구매한 해 3개
┌─────────┬─────────┬─────────┬─────────┐
│ 지난     │ 지난     │ 올해   ✓ │ 다가올   │
│ 2024    │ 2025    │ 2026    │ 2027    │
│ 만 31세  │ 만 32세  │ 만 33세  │ 만 34세  │
└─────────┴─────────┴─────────┴─────────┘
  ✓ 이미 구매한 해 · 결제 없이 다시 볼 수 있어요

동진 · 2027년
2027년 흐름 살펴보기                         [ 흐름 보기 ]
이용권 1장
```

- 연도 범위는 **현재 명리 연도 ±5년**, 11개. `flowYearAt(new Date())` 로 중심을 잡는다.
- **출생 연도 이전은 목록에서 뺀다.** 만 나이가 음수가 되고, 그 해의 대운이 없다.
- 소유 배지는 **행 존재가 아니라 `entitlements`** 로 판정한다. 행은 공짜로 만들어지고
  차감은 생성 자리에서 일어나므로, 생성이 한도나 잔액에서 막히면 행만 남고 권한은 없다.
- 프로필 행의 `N개 보유`, 상단의 `구매한 해 N개` 도 같은 출처를 쓴다.
- 가격 문구는 `TICKET_PRICE_LABEL` 에서 온다. **시안의 `4,900원` 은 자리표시자다** —
  레포의 `t1` 패키지는 1,000원이다.

배치 조회가 필요해 `entitlements.ts` 에 한 줄 추가한다:

```ts
/** 이 사용자가 이 기능에 대해 가진 권한의 subject_key 전부. 선택 화면이 쓴다. */
export async function listEntitledSubjects(userId: string, feature: Feature): Promise<string[]>;
```

`toConfirmState` 는 `no_profile` / `new` / `owned` 세 갈래를 유지하되 연도를 인자로 받는다.
`no_profile` 은 막다른 길이 아니라 **프로필 추가로 이어진다** — 앞선 설계가 이걸 빠뜨렸다.

### `/flow/[id]` — 리포트

기존 `FlowShell`/`FlowHero`/`FlowBody` 의 언어를 그대로 따른다. 새로 만드는 것은 월별
타임라인 하나다.

첫 화면(§34):

```
동진 · 2027년
2027년 2월 초 — 2028년 2월 초

넓히기보다
내 것을 분명하게 만드는 해

[01 의 body]

올해의 키워드
정리 · 선택 · 연결 · 지속
```

`formatPeriod` 는 그대로 쓴다 — `"2027년 2월 초부터 2028년 2월 초까지"`.

월별 타임라인:

- 12개 전부 노출한다.
- **변곡점인 달은 시각적으로 강하게**, 나머지는 평범하게. `months[].pivot` 이 근거다.
- 월 표기는 `3월` 이 아니라 **`3월 흐름` + 보조로 `3월 초 ~ 4월 초`** (§18). 명리 월운이
  달력 월과 일치한다는 오해를 막는다. 기간은 `months[].start/end` 에서 온다.
- **현재 월 강조는 선택한 해가 지금의 명리 연도일 때만** 붙인다. 저장된 문장이 아니라
  조회 시점의 화면 상태다.

`current-segment.ts` 는 `current-month.ts` 로 바뀐다 — 저장된 서술을 고르는 것이 아니라
강조할 인덱스 하나만 낸다. 해가 다르면 `null`.

### §32 연결

- 04 일과 선택 → 고민상담
- 05 관계 → 궁합

`ExploreGrid` 의 카드 문구를 새 이름으로 고친다.

## 하지 않는 것

- **§14 근거 패널** — 원국·대운·세운 계산값을 보여주는 별도 화면. 1차 범위 밖.
- **날짜 고르기 연결(§32)** — 그 서비스가 없다.
- **궁합의 삼합 판정 교정** — 이미 판 궁합 전부의 재생성 비용이 든다. 별건.
- **`yearlyLuck`/`daeunOutlook` 제거** — 다른 브랜치의 일.
- **가격 변경** — 시안의 4,900원은 반영하지 않는다. 올릴 거면 별건.
- **구간별 판매** — 상품 단위는 연 1회.

## 열린 항목

`PIVOT_THRESHOLD` 의 값. `scripts/flow-threshold.mts` 를 새 목적에 맞게 고쳐 측정한다.

- 앞선 값 `0.75` 는 **1~3구간 분포**를 목표로 보정한 값이라 목적이 달라진 지금은 근거가 없다.
- 조건: **대다수가 1~3개**, 상한 4개.
- **0개는 목표 비율로 잡지 않는다.** 실제로 의미 있는 변화가 없을 때 자연스럽게 나오면
  되고, 측정에서는 "0 이 구조적으로 불가능하지는 않은가" 만 확인한다.
- 표본에 **시간 미상 프로필을 섞는다.** 앞선 측정은 `hour: 9` 만 썼다.

구현 계획에 별도 항목으로 넣고, 정한 값의 근거를 상수 주석에 남긴다.
