# 한 해의 흐름 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「지금의 흐름」의 1~3구간 편집 층을 걷어내고, 사용자가 고른 명리 연도의 12개월 전부와 그중 방향이 실제로 달라지는 변곡점 0~4개를 보여주는 「한 해의 흐름」으로 바꾼다.

**Architecture:** 계산 층(두 축 점수·절기·대운·지지 관계)과 과금 구조(무료 행 / 유료 렌더, 게이트 바깥·과금 안쪽)는 그대로 둔다. 코드가 먼저 12개월 사실과 변곡점을 확정해 `FlowContext` 하나를 만들고, 9개 섹션이 **같은** 사실을 보며 병렬로 생성된다. 결과는 `flow_sections` 에 박제되고 `flows.months` 가 그 해의 월 경계와 변곡점 플래그를 함께 박제한다.

**Tech Stack:** Next.js 16.2.10 App Router · TypeScript · Neon Postgres(태그드 템플릿 SQL) · zod v4 · vitest(`environment: node`) · Tailwind · DeepSeek

**Spec:** [`docs/superpowers/specs/2026-08-27-yearly-flow-design.md`](../specs/2026-08-27-yearly-flow-design.md)

## Global Constraints

- **`git stash` 를 절대 쓰지 않는다.** stash 스택이 워크트리 사이에서 공유된다.
- **DB 명령을 직접 실행하지 않는다.** 개발 DB 가 워크트리 사이에서 공유되어, 한 브랜치가 돌린 마이그레이션이 머지 전까지 나머지를 500 으로 만든다. 마이그레이션 파일만 쓰고 실행은 사람이 한다.
- **DeepSeek API 를 부르지 않는다.** `DEEP_SEEK_API_KEY` 를 설정하지 않는다.
- **dev 서버·브라우저 프리뷰를 띄우지 않는다.**
- **린트는 자기가 만진 파일만.** 레포 전체 `npm run lint` 는 이 브랜치를 따기 전부터 빨갛다 (`src/app/map/_components/ConnectionLines.tsx:62`, `72d1664` 부터). 자기 파일만 지정해서 돌린다.
- 테스트: `npx vitest run <path>` · 타입: `npx tsc --noEmit`
- 커밋 메시지는 한국어 현재형 한 줄 + 필요하면 본문. 기존 커밋(`git log --oneline -20`)의 어투를 따른다.
- 주석은 **무엇이 아니라 왜**를 쓴다. 이 레포의 기존 주석 밀도를 따른다.
- 사용자에게 보이는 모든 문구는 한국어다.
- **명리 용어를 사실 블록(프롬프트 입력)에는 넣되 출력에서는 금지한다.** 스펙 §27.

---

## File Structure

**saju-core (명리 계산 — 서비스를 모른다)**

| 파일 | 책임 |
| --- | --- |
| `src/lib/saju-core/flow/year.ts` | `flowYearAt(at)` · **신규 `flowYearOf(year)`** |
| `src/lib/saju-core/flow/months.ts` | `monthTermsOf(year)`. **`monthTermAt` 삭제(죽은 export)** |
| `src/lib/saju-core/flow/switch.ts` | 손대지 않는다 |
| `src/lib/saju-core/branch-relations.ts` | 손대지 않는다 |

**흐름 서비스 — 계산**

| 파일 | 책임 |
| --- | --- |
| `src/app/api/flows/_lib/score.ts` | 두 축 + **신규 `relationsOf` · `weightTotal`** |
| `src/app/api/flows/_lib/month-scores.ts` | **신규.** 12개월 채점 + `currentDaeun`. `segments.ts` 를 대체 |
| `src/app/api/flows/_lib/pivots.ts` | **신규.** 변곡점 선정 + `flowMonths` |
| `src/app/api/flows/_lib/segments.ts` | **삭제** |

**흐름 서비스 — 생성**

| 파일 | 책임 |
| --- | --- |
| `src/app/api/flows/_lib/sections/registry.ts` | 섹션 9종의 스키마·프롬프트·예시 |
| `src/app/api/flows/_lib/sections/derive.ts` | 키 좁히기 · LLM 스키마 · 검증 |
| `src/app/api/flows/_lib/prompt/facts.ts` | `FlowContext` 조립 + `[사실]` 블록 |
| `src/app/api/flows/_lib/prompt/system.ts` | 시스템 프롬프트 |
| `src/app/api/flows/_lib/prompt/index.ts` | 섹션 하나의 요청 조립 |
| `src/app/api/flows/_lib/store.ts` | `flow_sections` 읽기/쓰기 |
| `src/app/api/flows/_lib/produce.ts` | 없는 섹션만 생성·검증·저장 |
| `src/app/api/flows/_lib/generator.ts` | transport. 거의 그대로 |
| `src/app/api/flows/_lib/gated-generator.ts` | 기능 id 만 바뀐다 |
| `src/app/api/flows/_lib/handler.ts` | POST 본체. **연도를 받는다** |

**저장소·권한**

| 파일 | 책임 |
| --- | --- |
| `src/lib/flows/store.ts` | `flows` 행. `segments`→`months`, `listFlows`→`listFlowYears` |
| `src/lib/tickets/features.ts` | `current_flow`→`yearly_flow` |
| `src/lib/tickets/entitlements.ts` | `hasEntitlement` + **신규 `listEntitledSubjects`** |
| `src/lib/flows/access.ts` · `rate-limit.ts` · `tickets.ts` | 기능 id 만 바뀐다 |

**화면**

| 파일 | 책임 |
| --- | --- |
| `src/app/flow/_lib/to-confirm.ts` | 선택 화면 상태 + 연도 목록 |
| `src/app/flow/_lib/to-start-outcome.ts` | 상태코드 → 문구. 이름만 바뀐다 |
| `src/app/flow/_components/FlowConfirm.tsx` | 프로필 드롭다운 + 연도 그리드 + CTA |
| `src/app/flow/page.tsx` | 서버 조립 |
| `src/app/flow/[id]/_lib/current-month.ts` | **신규.** UI 강조용 인덱스. `current-segment.ts` 를 대체 |
| `src/app/flow/[id]/_lib/to-flow-view.ts` | 저장된 서술 → 화면 모델 |
| `src/app/flow/[id]/_components/MonthTimeline.tsx` | **신규.** 12개월 타임라인 |
| `src/app/flow/[id]/_components/FlowShell/Hero/Body` | 새 구조에 맞춰 고친다 |
| `src/app/_lib/catalog.ts` · `src/app/home/_components/ExploreGrid.tsx` | 이름·문구 |

---

## Task 1: `flowYearOf` — 연도로 기간을 묻는다

**Files:**
- Modify: `src/lib/saju-core/flow/year.ts`
- Modify: `src/lib/saju-core/flow/months.ts` (`monthTermAt` 삭제)
- Modify: `src/lib/saju-core/index.ts:150-151`
- Test: `src/lib/saju-core/flow/year.test.ts`, `src/lib/saju-core/flow/months.test.ts`

**Interfaces:**
- Consumes: `solarTermInstant(year, longitude): Date`, `IPCHUN_LONGITUDE = 315`
- Produces: `flowYearOf(year: number): FlowYearPeriod` — 배럴(`@/lib/saju-core`)에서 export

지금은 "지금이 몇 년인가" 만 물을 수 있다. 사용자가 연도를 고르면 "2029년의 경계는 언제인가" 를 물어야 한다.

`monthTermAt` 은 아무도 쓰지 않는다(F6). 지금 지운다 — 새 코드가 실수로 잡아 쓰면 "지금" 을 전제한 함수가 연도 선택 화면에 섞인다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/saju-core/flow/year.test.ts` 끝에 추가:

```ts
describe("flowYearOf", () => {
  it("연도를 주면 그 해 입춘부터 다음 해 입춘까지를 돌려준다", () => {
    const p = flowYearOf(2027);
    expect(p.year).toBe(2027);
    // 입춘은 2월 3~5일 사이에 든다
    expect(p.start.getUTCMonth()).toBe(1);
    expect(p.end.getUTCFullYear()).toBe(2028);
    expect(p.end.getUTCMonth()).toBe(1);
  });

  it("flowYearAt 이 고른 해를 flowYearOf 에 넣으면 같은 경계가 나온다", () => {
    // 두 함수가 같은 절기 계산을 쓰는지 — 갈리면 확인 화면과 리포트가 다른
    // 기간을 표시한다
    const at = flowYearAt(new Date("2026-06-15T00:00:00Z"));
    const of = flowYearOf(at.year);
    expect(of.start.getTime()).toBe(at.start.getTime());
    expect(of.end.getTime()).toBe(at.end.getTime());
  });

  it("1월 20일은 아직 앞 해다 — flowYearOf 로 그 해를 되짚을 수 있다", () => {
    const at = flowYearAt(new Date("2026-01-20T00:00:00Z"));
    expect(at.year).toBe(2025);
    expect(flowYearOf(2025).end.getTime()).toBe(at.end.getTime());
  });
});
```

같은 파일 상단 import 에 `flowYearOf` 를 더한다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/lib/saju-core/flow/year.test.ts`
Expected: FAIL — `flowYearOf is not a function` (혹은 import 오류)

- [ ] **Step 3: `flowYearOf` 를 만들고 `flowYearAt` 이 그것을 쓰게 한다**

`src/lib/saju-core/flow/year.ts` 의 `flowYearAt` 을 통째로 아래로 교체:

```ts
/**
 * 명리 연도 하나의 경계.
 *
 * flowYearAt 의 형제다 — 이쪽은 시각이 아니라 **연도**로 묻는다. 사용자가 연도를
 * 고르는 화면(§26: 현재 ±5년)과, 이미 판 흐름의 flow_year 로 기간을 되짚는 자리가
 * 쓴다.
 */
export function flowYearOf(year: number): FlowYearPeriod {
  return {
    year,
    start: solarTermInstant(year, IPCHUN_LONGITUDE),
    end: solarTermInstant(year + 1, IPCHUN_LONGITUDE),
  };
}

/**
 * 주어진 순간이 속한 명리 연도와 그 경계.
 *
 * 달력 연도로 먼저 찍고 입춘 전이면 한 해 물러선다. 입춘이 2월 초라 UTC/KST 의
 * 연말 경계(1월 1일)와는 한 달 이상 떨어져 있어, 어느 시계로 연도를 읽든 같은
 * 답이 나온다.
 *
 * 경계 계산은 flowYearOf 에 위임한다 — 두 함수가 각자 절기를 재면 확인 화면과
 * 리포트가 다른 기간을 표시할 수 있다.
 */
export function flowYearAt(at: Date): FlowYearPeriod {
  const guess = at.getUTCFullYear();
  const start = solarTermInstant(guess, IPCHUN_LONGITUDE);
  return flowYearOf(at.getTime() < start.getTime() ? guess - 1 : guess);
}
```

- [ ] **Step 4: `monthTermAt` 을 지운다**

`src/lib/saju-core/flow/months.ts` 파일 끝의 `monthTermAt` 함수 전체를 삭제하고, 그로 인해 쓰이지 않게 된 `flowYearAt` import 도 지운다(`import { flowYearAt, IPCHUN_LONGITUDE } from "./year";` → `import { IPCHUN_LONGITUDE } from "./year";`).

`src/lib/saju-core/flow/months.test.ts` 에서 `monthTermAt` 을 쓰는 `describe`/`it` 블록과 import 를 삭제한다.

`src/lib/saju-core/flow/months.ts` 파일 상단 주석에서 구간 이야기를 고친다:

```ts
// 월운(月運) — 명리 연도 하나를 12개 절기 구간으로 자른다.
//
// 12개를 전부 사용자에게 보여준다(§17). 그중 인접 월 사이의 변화가 큰 달만
// 변곡점으로 따로 표시한다(§20) — 계산 해상도가 곧 노출 단위다.
```

- [ ] **Step 5: 배럴을 고친다**

`src/lib/saju-core/index.ts:150-151` 를:

```ts
export { flowYearAt, flowYearOf, IPCHUN_LONGITUDE, type FlowYearPeriod } from "./flow/year";
export { monthTermsOf, type MonthTerm } from "./flow/months";
```

- [ ] **Step 6: 테스트와 타입을 확인한다**

Run: `npx vitest run src/lib/saju-core/flow/`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: `src/app/api/flows/_lib/segments.ts` 등에서 오류가 **날 수 있다** — 이 시점에는 무시한다(Task 3 에서 그 파일이 사라진다). `src/lib/saju-core/` 아래에서 오류가 나면 고친다.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/saju-core/flow/ src/lib/saju-core/index.ts
git commit -m "feat(saju-core): 연도로 명리 연도 경계를 묻는 flowYearOf 를 더한다

사용자가 연도를 고르는 화면이 '지금' 이 아니라 '2029년' 의 경계를 물어야 한다.
flowYearAt 은 새 함수에 경계 계산을 위임해 두 함수가 같은 절기를 쓰게 한다.

쓰이지 않는 monthTermAt 을 함께 지운다 — '지금' 을 전제한 함수라 연도 선택
화면에 실수로 섞이면 조용히 틀린다."
```

---

## Task 2: `relationsOf` 분리와 시간 미상 프로필의 friction 교정

**Files:**
- Modify: `src/app/api/flows/_lib/score.ts`
- Test: `src/app/api/flows/_lib/score.test.ts`

**Interfaces:**
- Consumes: `pairRelations(a, b): PairKind[]`, `setRelations(branches): SetRelation[]`
- Produces:
  - `type InteractionTarget = "년지" | "월지" | "일지" | "시지" | "세운" | "대운"`
  - `interface Interaction { target: InteractionTarget; kind: PairKind }`
  - `relationsOf(branch: Branch, targets: FrictionTargets): Interaction[]`
  - `samhapGain(branch: Branch, targets: FrictionTargets): number`
  - `weightTotal(targets: FrictionTargets): number`
  - `frictionOf(branch, targets): number` — 시그니처 그대로, 구현만 위 셋을 쓴다
  - `WEIGHT_TOTAL` 상수는 **사라진다**

두 가지를 동시에 고친다.

**(1) 이름을 잃지 않는다.** 지금 `frictionOf` 는 `pairRelations` 가 돌려준 관계 이름들을 가중합 안에서 숫자로 접어 버린다. 07 의 달 제목을 만들 재료가 두 축뿐이면 12개 달이 "받쳐주는 달 / 흔들리는 달" 로 여섯 번씩 반복된다. **변곡점 판정은 여전히 숫자만 본다** — 이름은 프롬프트의 재료로만 쓴다.

**(2) 분모를 실제 대상에 맞춘다.** `WEIGHT_TOTAL = 12` 가 상수인데 시간 미상 프로필은 시지가 없어 분자에 세 자리만 기여한다. **시간 미상인 사람은 friction 이 구조적으로 낮게 나오고, 그래서 변곡점을 덜 받는다.**

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/score.test.ts` 끝에 추가:

```ts
describe("relationsOf", () => {
  const targets = {
    // 자·오 충 / 인·해 육합 을 일부러 만든다
    natal: ["자", "축", "인", "묘"],
    sewun: "오",
    daeun: "해",
  } as const;

  it("어떤 자리와 어떤 관계인지를 이름으로 돌려준다", () => {
    const rel = relationsOf("오", targets);
    expect(rel).toContainEqual({ target: "년지", kind: "충" });
  });

  it("관계가 없으면 빈 배열이다", () => {
    // 진은 위 대상들과 쌍 관계가 없다
    expect(relationsOf("진", { natal: ["축"], sewun: "축", daeun: "축" })).toEqual([]);
  });

  it("시지가 없는 프로필은 시지 항목을 내지 않는다", () => {
    const rel = relationsOf("오", { natal: ["자", "축", "인"], sewun: "미", daeun: "미" });
    expect(rel.every((r) => r.target !== "시지")).toBe(true);
  });
});

describe("weightTotal", () => {
  it("네 기둥이 다 있으면 12 다", () => {
    expect(weightTotal({ natal: ["자", "축", "인", "묘"], sewun: "진", daeun: "사" })).toBe(12);
  });

  it("시지가 없으면 시지 가중(1.5)만큼 줄어든다", () => {
    expect(weightTotal({ natal: ["자", "축", "인"], sewun: "진", daeun: "사" })).toBe(10.5);
  });
});

describe("frictionOf — 시간 미상 보정", () => {
  it("시간 미상 프로필의 분모는 실제로 있는 자리의 가중치 합이다", () => {
    // ⚠️ "시지를 더해도 값이 같다" 로 쓰면 안 된다. 무관한 시지를 더하면
    // 분자는 그대로인데 분모가 10.5 → 12 로 커져 값이 **정당하게** 내려간다.
    // 그런 단언은 분자가 0 일 때만 통과하고, 0/12 == 0/10.5 라 고치기 전
    // 구현에서도 통과한다 — 아무것도 검증하지 못한다.
    //
    // 대신 구체적인 값을 못박는다. 술은 오와 아무 관계도 맺지 않으므로
    // 자·오 충(계수 1.0, 년지 가중 1.5) 하나만 남는다.
    //   고친 뒤: 1.5 / 10.5 ≈ 0.142857
    //   고치기 전: 1.5 / 12  = 0.125   ← 이 테스트가 실패한다
    const v = frictionOf("오", { natal: ["자", "술", "술"], sewun: "술", daeun: "술" });
    expect(v).toBeCloseTo(1.5 / 10.5, 6);
    expect(v).toBeGreaterThan(1.5 / 12);
  });
});
```

> ⚠️ 위 테스트의 지지 조합을 `src/lib/saju-core/branch-relations.ts` 의 실제 표에서
> **반드시 확인할 것.** 술이 오와 관계를 맺거나 자·오 충의 계수가 1.0 이 아니면
> 기대값이 달라진다. 요구는 하나다 — **분자가 0 이 아니고**, 고치기 전 구현
> (분모 12 고정)에서 실패하는 구체적인 값을 단언할 것.

파일 상단 import 에 `relationsOf`, `weightTotal` 을 더한다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/score.test.ts`
Expected: FAIL — `relationsOf is not a function`, `weightTotal is not a function`

- [ ] **Step 3: `score.ts` 의 가중치·관계 부분을 교체한다**

`NATAL_WEIGHTS` 선언부터 파일 끝(`frictionOf` 종료)까지를 아래로 교체:

```ts
/**
 * 자리 가중. strength.ts 의 POSITION_WEIGHTS 를 따른다 — 여기서 재는 것이
 * "원국이 흔들리는 정도" 이기 때문이다. synastry 의 tieWeight(일지 3 / 월지 2)는
 * "두 사람의 밀착" 을 재는 다른 자라서 쓰지 않는다.
 *
 * 세운·대운을 2 로 두는 이유: 지금 들어와 있는 흐름이라 일지만큼 무겁게 본다.
 */
const NATAL_WEIGHTS = [1.5, 3, 2, 1.5] as const; // 년 · 월 · 일 · 시
const NATAL_LABELS = ["년지", "월지", "일지", "시지"] as const;
const SEWUN_WEIGHT = 2;
const DAEUN_WEIGHT = 2;

export type InteractionTarget = (typeof NATAL_LABELS)[number] | "세운" | "대운";

/** 이 달의 지지가 무엇과 어떤 관계를 맺는가. 숫자로 접기 전의 이름이다. */
export interface Interaction {
  target: InteractionTarget;
  kind: PairKind;
}

/**
 * 가중치의 유일한 출처. NATAL_WEIGHTS 에서 파생시켜 두 표가 갈리는 것을 막는다.
 */
const WEIGHT_OF: Record<InteractionTarget, number> = {
  년지: NATAL_WEIGHTS[0],
  월지: NATAL_WEIGHTS[1],
  일지: NATAL_WEIGHTS[2],
  시지: NATAL_WEIGHTS[3],
  세운: SEWUN_WEIGHT,
  대운: DAEUN_WEIGHT,
};

export interface FrictionTargets {
  /** 원국 4지 — [년, 월, 일, 시] 순서. 시간 미상이면 3개로 짧다 */
  natal: readonly Branch[];
  sewun: Branch;
  daeun: Branch;
}

/**
 * 정규화 분모. **상수가 아니다.**
 *
 * 시간 미상 프로필은 시지가 없어 분자에 세 자리만 기여하는데, 분모를 12 로
 * 고정하면 그 사람의 friction 이 구조적으로 낮게 나온다 — 두 축을 합해 변곡점을
 * 고르므로 그대로 두면 시간 미상인 사람은 변곡점을 덜 받는다.
 */
export function weightTotal(targets: FrictionTargets): number {
  const natal = targets.natal.reduce((sum, _, i) => sum + (NATAL_WEIGHTS[i] ?? 1), 0);
  return natal + SEWUN_WEIGHT + DAEUN_WEIGHT;
}

/**
 * 이 지지가 무엇과 어떤 관계를 맺는가.
 *
 * frictionOf 가 이 목록을 가중합해 숫자 하나로 접는다. **이름을 따로 꺼내는 이유는
 * 프롬프트다** — 07 이 12개 달을 서로 다르게 쓰려면 두 축 말고도 재료가 있어야
 * 한다. 변곡점 판정에는 쓰지 않는다(십성을 탐지에서 뺀 것과 같은 판단: 범주가
 * 바뀌었다는 이유만으로 전환을 만들지 않는다).
 */
export function relationsOf(branch: Branch, targets: FrictionTargets): Interaction[] {
  const out: Interaction[] = [];
  targets.natal.forEach((b, i) => {
    const target = NATAL_LABELS[i];
    if (!target) return; // natal 이 4개를 넘으면 무시한다
    for (const kind of pairRelations(branch, b)) out.push({ target, kind });
  });
  for (const kind of pairRelations(branch, targets.sewun)) out.push({ target: "세운", kind });
  for (const kind of pairRelations(branch, targets.daeun)) out.push({ target: "대운", kind });
  return out;
}

/**
 * 이 지지가 들어와서 **새로 완성되는** 삼합의 개수.
 *
 * 세 글자가 있어야 성립하는 관계를 쌍으로 세면 반합을 삼합으로 과대평가한다.
 * 그래서 판 전체를 놓고 전후를 비교한다.
 */
export function samhapGain(branch: Branch, targets: FrictionTargets): number {
  const without = [...targets.natal, targets.sewun, targets.daeun];
  const before = setRelations(without).filter((r) => r.kind === "삼합").length;
  const after = setRelations([...without, branch]).filter((r) => r.kind === "삼합").length;
  return after - before;
}

/** 이 지지가 원국·세운·대운을 얼마나 흔드는가. 대략 −1 … +1. */
export function frictionOf(branch: Branch, targets: FrictionTargets): number {
  let sum = 0;
  for (const r of relationsOf(branch, targets)) sum += KIND_COEFF[r.kind] * WEIGHT_OF[r.target];
  sum += SAMHAP_COEFF * samhapGain(branch, targets) * SEWUN_WEIGHT;
  return sum / weightTotal(targets);
}
```

파일 상단 import 에 `type PairKind` 를 더한다:

```ts
import {
  STEMS,
  branchElementOf,
  controlledBy,
  isBranch,
  isStem,
  pairRelations,
  setRelations,
  type Branch,
  type Element,
  type PairKind,
  type Stem,
  type Yongsin,
} from "@/lib/saju-core";
```

> `PairKind` 가 배럴에서 안 나오면 `@/lib/saju-core/branch-relations` 에서 직접 가져오고, 배럴에도 `export type { PairKind }` 를 더한다.

파일 상단 주석의 마지막 문단을 고친다:

```ts
// 십성은 여기 없다. 십성은 "변화가 어디에서 체감되는가" 를 정하는 축이라
// 전환 시점 판정에 넣으면 같은 작용을 두 번 반영하고, 범주가 바뀌었다는 이유만으로
// 실제 세기 차이가 작아도 전환을 억지로 만든다.
//
// 관계 이름(충·형·육합…)도 같은 대접이다 — relationsOf 로 이름을 꺼내되 변곡점
// 판정은 frictionOf 가 접은 숫자만 본다. 세기는 점수로, 이름은 재료로.
```

- [ ] **Step 4: `WEIGHT_TOTAL` 을 쓰던 곳을 찾아 고친다**

Run: `npx tsc --noEmit 2>&1 | grep -i weight_total`

나온 곳을 `weightTotal(targets)` 로 바꾼다. (테스트 파일 포함)

- [ ] **Step 5: 테스트를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/score.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/flows/_lib/score.ts src/app/api/flows/_lib/score.test.ts
git commit -m "feat(flow): 관계를 숫자로 접기 전에 이름으로 꺼낸다

frictionOf 가 pairRelations 의 결과를 가중합 안에서 숫자로 접어 버려, 월별
서술의 재료가 두 축뿐이었다. 12개 달을 서로 다르게 쓰려면 이름이 필요하다.
변곡점 판정은 여전히 숫자만 본다.

같은 자리에서 WEIGHT_TOTAL 상수를 weightTotal(targets) 로 바꾼다. 분자에는
있는 자리만 기여하는데 분모가 12 로 고정이라, 시간 미상 프로필은 friction 이
구조적으로 낮게 나오고 그만큼 변곡점을 덜 받았다."
```

---

## Task 3: 12개월 채점 — `month-scores.ts`

**Files:**
- Create: `src/app/api/flows/_lib/month-scores.ts`
- Create: `src/app/api/flows/_lib/month-scores.test.ts`
- Delete: `src/app/api/flows/_lib/segments.ts`, `src/app/api/flows/_lib/segments.test.ts`

**Interfaces:**
- Consumes: `monthTermsOf(year): MonthTerm[]`, `flowYearOf(year)`, `daeunSwitchIn(analysis, period)`, `birthInstant`, `YEAR_MS`, Task 2 의 `relationsOf`/`samhapGain`/`frictionOf`/`supportOf`/`parsePillar2`
- Produces:
  - `interface MonthScore { index; term; support; friction; interactions; samhap; tenGods }`
  - `monthScores(analysis: SajuAnalysis, year: number): MonthScore[]`
  - `currentDaeun(analysis, period): DaeunPeriod`
  - `frictionTargets(analysis, year): FrictionTargets`

`segments.ts` 가 하던 일 중 **채점만** 옮기고 구간 나누기는 버린다. `currentDaeun` 은 `daeunSwitchIn` 과 같은 정밀도로 재야 해서 함께 온다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/month-scores.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { flowYearOf } from "@/lib/saju-core";
import { currentDaeun, monthScores } from "./month-scores";

const BIRTH = {
  year: 1993,
  month: 4,
  day: 12,
  hour: 9,
  minute: 20,
  gender: "male",
  calendar: "solar",
} as const;

describe("monthScores", () => {
  it("한 해에 정확히 12개를 낸다", () => {
    expect(monthScores(analyze(BIRTH), 2027)).toHaveLength(12);
  });

  it("index 는 1부터 12까지 순서대로다", () => {
    const scores = monthScores(analyze(BIRTH), 2027);
    expect(scores.map((s) => s.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("두 축은 -1…+1 언저리에 있다", () => {
    for (const s of monthScores(analyze(BIRTH), 2027)) {
      expect(s.support).toBeGreaterThanOrEqual(-1);
      expect(s.support).toBeLessThanOrEqual(1);
      expect(Math.abs(s.friction)).toBeLessThanOrEqual(1.5);
    }
  });

  it("관계 목록과 십성 그룹을 함께 싣는다 — 월별 서술의 재료다", () => {
    const scores = monthScores(analyze(BIRTH), 2027);
    // 12개 달 중 최소 하나는 원국·세운·대운과 관계를 맺는다
    expect(scores.some((s) => s.interactions.length > 0)).toBe(true);
    for (const s of scores) {
      expect(s.tenGods.length).toBeGreaterThan(0);
      expect(Array.isArray(s.interactions)).toBe(true);
      expect(typeof s.samhap).toBe("boolean");
    }
  });

  it("같은 입력이면 같은 결과다", () => {
    const a = monthScores(analyze(BIRTH), 2027);
    const b = monthScores(analyze(BIRTH), 2027);
    expect(a.map((s) => s.support)).toEqual(b.map((s) => s.support));
    expect(a.map((s) => s.friction)).toEqual(b.map((s) => s.friction));
  });

  it("시간 미상 프로필도 12개를 낸다", () => {
    const noHour = analyze({ ...BIRTH, hour: null, minute: null });
    expect(monthScores(noHour, 2027)).toHaveLength(12);
  });
});

describe("currentDaeun", () => {
  it("그 구간 시작보다 이르거나 같은 전환 중 가장 늦은 회차를 고른다", () => {
    // ⚠️ periods 안에 있다는 것만 확인하면 아무것도 검증하지 못한다 — 틀린 회차도
    // periods 안에 있다. **몇 번째** 회차인지를 못박고, 근거를 주석에 남긴다.
    //    birth + (startAgePrecise + i×10) × YEAR_MS 가 구간 시작보다
    //    이르거나 같은 i 중 가장 큰 것.
    const a = analyze(BIRTH);
    const period = flowYearOf(2027);
    const expected = expectedDaeunIndex(a, period); // 아래 헬퍼로 독립 계산
    expect(a.daeun.periods.indexOf(currentDaeun(a, period))).toBe(expected);
  });

  it("유년기 대운으로 물러서지 않는다", () => {
    // 오름차순 배열에 find(p => p.startAge <= age) 를 쓰면 첫 칸(유년기)이 나온다.
    const a = analyze(BIRTH);
    const picked = currentDaeun(a, flowYearOf(2027));
    expect(picked).not.toBe(a.daeun.periods[0]);
  });

  // ⚠️ 이 테스트를 빼지 마라. 이 레포에서 **실제로 났던 버그**를 잡는 유일한
  // 테스트다: currentDaeun 이 반올림된 startAge 를 쓰고 daeunSwitchIn 이
  // startAgePrecise + i×10 을 쓰던 시절, 둘이 최대 반년 어긋났다. 하필 그
  // 어긋남이 대운 경계 해에 나면 이웃 회차가 조용히 뽑히고, 그 회차가 그 해
  // **전체**의 friction 대상이 된다. (1967년생에서 반올림은 갑술, 정밀은 을해)
  //
  // "유년기로 안 물러선다" 는 조잡한 실수만 잡고 반년 어긋남은 못 잡는다.
  it("대운 경계 해에서 daeunSwitchIn 과 같은 회차를 고른다", () => {
    // 경계에 걸리는 실제 생년을 쓴다. 지운 segments.test.ts 의 픽스처를
    // 그대로 가져온다 — git show <이 태스크 직전 커밋>:src/app/api/flows/_lib/segments.test.ts
    const a = analyze({ ...BIRTH, year: 1950 });
    const period = flowYearOf(2012);
    const sw = daeunSwitchIn(a, period);
    expect(sw).not.toBeNull();
    // 전환이 있는 해에서 currentDaeun 은 전환 **앞쪽**과 같은 회차여야 한다 —
    // frictionTargets 가 sw.before 를 쓰고, 없을 때만 currentDaeun 으로 물러선다.
    expect(currentDaeun(a, period).pillar).toBe(sw!.before.pillar);
  });
});
```

> `analyze` 의 시간 미상 표현은 `hour: null` 이 아니다 — `src/lib/saju-core/chart.ts`
> 가 `hour?: number` 로 선언하고 `input.hour !== undefined` 로 판정하므로 `undefined`
> 여야 한다. `null` 을 넣으면 "시간 있음" 으로 읽힌다.

> ⚠️ `expectedDaeunIndex` 헬퍼는 구현을 베끼지 말고 **테스트 안에서 따로** 계산할 것.
> 구현과 같은 식을 호출하면 둘이 같이 틀려도 통과한다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/month-scores.test.ts`
Expected: FAIL — `Cannot find module './month-scores'`

- [ ] **Step 3: `month-scores.ts` 를 만든다**

```ts
// 명리 연도 하나의 12개월을 채점한다.
//
// 앞선 설계는 이 12개를 "전환점을 고르기 위한 계산 해상도" 로만 썼다. 이제 12개가
// 그대로 노출 단위다(§17) — 그래서 두 축뿐 아니라 **서술의 재료**(관계 이름·십성
// 그룹)까지 함께 싣는다. 재료 없이 두 축만으로 12개 제목을 만들면 "받쳐주는 달 /
// 흔들리는 달" 이 여섯 번씩 반복된다.
//
// 변곡점 판정은 이 재료를 보지 않는다 — pivots.ts 가 support/friction 만 쓴다.

import {
  STEMS,
  branchElementOf,
  daeunSwitchIn,
  elementControls,
  elementGenerates,
  flowYearOf,
  generatedBy,
  monthTermsOf,
  sewunPillars,
  type Element,
  type FlowYearPeriod,
  type MonthTerm,
  type SajuAnalysis,
  type TenGodGroup,
} from "@/lib/saju-core";
// 배럴은 daeunSwitchIn 만 내보낸다 — currentDaeun 이 그와 "같은 자" 로 재야 해서
// birthInstant/YEAR_MS 는 소스 파일에서 직접 가져온다. (아래 currentDaeun 참고)
import { birthInstant, YEAR_MS } from "@/lib/saju-core/flow/switch";
import {
  frictionOf,
  parsePillar2,
  relationsOf,
  samhapGain,
  supportOf,
  type FrictionTargets,
  type Interaction,
} from "./score";

export interface MonthScore {
  /** 1‥12. 명리 연도 안에서의 순서다 — 달력 월이 아니다 */
  index: number;
  term: MonthTerm;
  support: number;
  friction: number;
  /** 이 달이 원국·세운·대운과 맺는 관계. 서술의 재료다 */
  interactions: Interaction[];
  /** 이 달이 들어와 삼합이 새로 완성되는가 */
  samhap: boolean;
  /** 이 달 간지의 천간·지지가 일간 대비 무슨 세력인가 */
  tenGods: TenGodGroup[];
}

/**
 * 이 구간이 시작될 때 적용 중인 대운.
 *
 * daeunSwitchIn 과 반드시 같은 정밀도로 재야 한다 — 반올림된 periods[i].startAge 로
 * 세는 나이를 근사하면 daeunSwitchIn 의 정밀 판정과 최대 반년 어긋날 수 있고,
 * 하필 그 어긋남이 경계에서 나면 이웃 회차를 조용히 골라 그 해 전체의 friction
 * 대상이 틀어진다. 그래서 daeunSwitchIn 과 같은 식
 * (birth + (startAgePrecise + i×10) × YEAR_MS) 으로, "이 구간 시작보다 이르거나
 * 같은 전환 중 가장 늦은 회차" 를 그대로 고른다.
 */
export function currentDaeun(analysis: SajuAnalysis, period: FlowYearPeriod) {
  const { startAgePrecise, periods } = analysis.daeun;
  const birth = birthInstant(analysis).getTime();
  const target = period.start.getTime();

  let current = periods[0];
  for (let i = 1; i < periods.length; i += 1) {
    const at = birth + (startAgePrecise + i * 10) * YEAR_MS;
    if (at > target) break;
    current = periods[i];
  }
  return current;
}

/**
 * friction 을 잴 대상. 그해 대부분을 차지하는 대운을 대표로 쓴다.
 *
 * 전환이 있으면 전환 뒤쪽이 아니라 앞쪽을 쓴다 — 연초부터 적용되는 쪽이다.
 * 전환 자체는 pivots.ts 가 따로 잰다.
 */
export function frictionTargets(analysis: SajuAnalysis, year: number): FrictionTargets {
  const c = analysis.chart;
  const sewun = parsePillar2(sewunPillars(year, 1)[0].korean)!;
  const period = flowYearOf(year);
  const sw = daeunSwitchIn(analysis, period);
  const current = sw?.before ?? currentDaeun(analysis, period);
  return {
    natal: [c.year.branch, c.month.branch, c.day.branch, c.hour?.branch].filter(
      (b): b is NonNullable<typeof b> => b != null,
    ),
    sewun: sewun.branch,
    daeun: current.branch,
  };
}

/** 일간 오행 기준으로 다른 오행이 무슨 세력인가. yongsin.ts 의 groupElements 와 같은 정의다. */
function groupOf(dayEl: Element, other: Element): TenGodGroup {
  if (other === dayEl) return "비겁";
  if (other === generatedBy(dayEl)) return "인성";
  if (other === elementGenerates(dayEl)) return "식상";
  if (other === elementControls(dayEl)) return "재성";
  return "관성";
}

/** 12개 월운 전부를 채점한다. */
export function monthScores(analysis: SajuAnalysis, year: number): MonthScore[] {
  const targets = frictionTargets(analysis, year);
  const dayEl = STEMS[analysis.chart.dayMaster].element;

  return monthTermsOf(year).map((term, i) => {
    const p = parsePillar2(term.korean)!;
    const groups = new Set<TenGodGroup>();
    groups.add(groupOf(dayEl, STEMS[p.stem].element));
    groups.add(groupOf(dayEl, branchElementOf(p.branch)));

    return {
      index: i + 1,
      term,
      support: supportOf(p, analysis.yongsin),
      friction: frictionOf(p.branch, targets),
      interactions: relationsOf(p.branch, targets),
      samhap: samhapGain(p.branch, targets) > 0,
      tenGods: [...groups],
    };
  });
}
```

- [ ] **Step 4: `segments.ts` 를 지운다**

```bash
git rm src/app/api/flows/_lib/segments.ts src/app/api/flows/_lib/segments.test.ts
```

이 시점에 `src/app/api/flows/_lib/prompt/facts.ts` · `handler.ts` · `src/lib/flows/store.ts` · 화면 파일들이 컴파일에서 깨진다. **정상이다** — Task 4~13 이 차례로 고친다. 이 태스크에서는 `month-scores.test.ts` 만 통과시킨다.

- [ ] **Step 5: 테스트를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/month-scores.test.ts src/app/api/flows/_lib/score.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/flows/_lib/month-scores.ts src/app/api/flows/_lib/month-scores.test.ts
git commit -m "feat(flow): 12개월 채점을 구간 나누기에서 떼어낸다

12개월이 계산 해상도가 아니라 노출 단위가 되면서, 두 축 말고 서술의 재료
(관계 이름·십성 그룹)까지 함께 실어야 한다. 재료 없이 두 축만으로 12개
제목을 만들면 같은 표현이 여섯 번씩 반복된다.

segments.ts 를 지운다 — 구간은 더 이상 사용자 단위가 아니다. 이 커밋 시점에
프롬프트·핸들러·화면이 컴파일에서 깨지고, 뒤따르는 커밋들이 차례로 고친다."
```

---

## Task 4: 변곡점 선정 — `pivots.ts`

**Files:**
- Create: `src/app/api/flows/_lib/pivots.ts`
- Create: `src/app/api/flows/_lib/pivots.test.ts`

**Interfaces:**
- Consumes: Task 3 의 `monthScores`/`frictionTargets`, `daeunSwitchIn`, `flowYearOf`, Task 2 의 `supportOf`/`frictionOf`/`parsePillar2`
- Produces:
  - `interface FlowMonth { index: number; start: string; end: string; korean: string; pivot: boolean }`
  - `flowMonths(analysis: SajuAnalysis, year: number): FlowMonth[]` — 항상 12개
  - `MAX_PIVOTS`, `MIN_PIVOT_GAP_MONTHS`, `PIVOT_THRESHOLD`
  - `monthDeltas(scores: MonthScore[]): number[]` — 길이 12, `[0]` 은 0 (첫 달은 후보 아님)

`FlowMonth` 가 `flows.months` 에 그대로 박제되는 모양이다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/pivots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { MAX_PIVOTS, MIN_PIVOT_GAP_MONTHS, flowMonths } from "./pivots";

const BIRTH = {
  year: 1993, month: 4, day: 12, hour: 9, minute: 20,
  gender: "male", calendar: "solar",
} as const;

const YEARS = [2021, 2024, 2026, 2027, 2029, 2031];

describe("flowMonths", () => {
  it("언제나 12개를 낸다", () => {
    for (const y of YEARS) expect(flowMonths(analyze(BIRTH), y)).toHaveLength(12);
  });

  it("index 는 1‥12, 경계는 틈 없이 이어진다", () => {
    const months = flowMonths(analyze(BIRTH), 2027);
    expect(months.map((m) => m.index)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12]);
    for (let i = 1; i < months.length; i += 1) {
      expect(months[i].start).toBe(months[i - 1].end);
    }
  });

  it("첫 달은 절대 변곡점이 아니다", () => {
    // 세운이 입춘에 바뀌므로 첫 달의 Δ 는 거의 항상 크다. 넣으면 매년
    // 변곡점이 되어 신호가 아니라 상수가 된다. 그리고 그 이야기는 01 이 한다.
    for (const y of YEARS) {
      expect(flowMonths(analyze(BIRTH), y)[0].pivot).toBe(false);
    }
  });

  it("변곡점은 MAX_PIVOTS 개를 넘지 않는다", () => {
    for (const y of YEARS) {
      const n = flowMonths(analyze(BIRTH), y).filter((m) => m.pivot).length;
      expect(n).toBeLessThanOrEqual(MAX_PIVOTS);
    }
  });

  it("변곡점끼리 MIN_PIVOT_GAP_MONTHS 보다 가깝지 않다", () => {
    for (const y of YEARS) {
      const picked = flowMonths(analyze(BIRTH), y).filter((m) => m.pivot).map((m) => m.index);
      for (let i = 1; i < picked.length; i += 1) {
        expect(picked[i] - picked[i - 1]).toBeGreaterThanOrEqual(MIN_PIVOT_GAP_MONTHS);
      }
    }
  });

  it("같은 입력이면 같은 변곡점이 나온다", () => {
    const a = flowMonths(analyze(BIRTH), 2027).map((m) => m.pivot);
    const b = flowMonths(analyze(BIRTH), 2027).map((m) => m.pivot);
    expect(a).toEqual(b);
  });

  it("간격에 걸리면 Δ 가 큰 쪽이 남는다", () => {
    // Δ 내림차순으로 훑기 때문에 이미 뽑힌 것 옆의 작은 후보가 탈락한다.
    // 표본 전체에서 "인접한 두 달이 모두 변곡점" 인 경우가 없어야 한다.
    for (let y = 2015; y <= 2035; y += 1) {
      const picked = flowMonths(analyze(BIRTH), y).filter((m) => m.pivot).map((m) => m.index);
      const adjacent = picked.some((v, i) => i > 0 && v - picked[i - 1] < MIN_PIVOT_GAP_MONTHS);
      expect(adjacent).toBe(false);
    }
  });

  it("시간 미상 프로필도 변곡점을 받을 수 있다", () => {
    const noHour = analyze({ ...BIRTH, hour: null, minute: null });
    const anyPivot = [2024, 2025, 2026, 2027, 2028].some((y) =>
      flowMonths(noHour, y).some((m) => m.pivot),
    );
    expect(anyPivot).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/pivots.test.ts`
Expected: FAIL — `Cannot find module './pivots'`

- [ ] **Step 3: `pivots.ts` 를 만든다**

```ts
// 그 해 안에서 흐름의 방향이 실제로 달라지는 지점.
//
// 핵심은 절대값이 아니라 **인접한 달 사이의 변화량**이다. 점수가 높은 달을 고르면
// "어디서부터 달라지는가" 가 아니라 "어느 달이 센가" 에 답하게 된다.
//
// 여기서 쓰는 숫자는 support/friction 둘뿐이다. 십성과 관계 이름은 monthScores 가
// 함께 싣지만 판정에는 넣지 않는다 — 범주가 바뀌었다는 이유만으로 실제 세기 차이가
// 작아도 전환을 만들기 때문이다. "무엇이 변곡점인가" 와 "그 달이 무슨 의미인가" 는
// 다른 질문이다.

import { daeunSwitchIn, flowYearOf, type SajuAnalysis } from "@/lib/saju-core";
import { frictionOf, parsePillar2, supportOf } from "./score";
import { frictionTargets, monthScores, type MonthScore } from "./month-scores";

/** 상한. 넘치면 Δ 가 큰 쪽부터 채운다. */
export const MAX_PIVOTS = 4;

/** 변곡점끼리 이보다 가까우면 Δ 가 작은 쪽을 버린다. */
export const MIN_PIVOT_GAP_MONTHS = 2;

/**
 * ⚠️ 이 값 하나가 변곡점 개수를 정한다.
 *
 * 근거는 이론이 아니라 분포다. Task 5 에서 scripts/flow-threshold.mts 로 측정하고
 * 실측값을 이 주석에 남긴다. 그전까지는 앞선 설계(구간용)의 값을 자리에 둔다 —
 * **목적이 다르므로 이 값에는 근거가 없다.**
 */
export const PIVOT_THRESHOLD = 0.75;

/** flows.months 에 박제되는 모양. 화면과 프롬프트가 이것만 본다. */
export interface FlowMonth {
  /** 1‥12. 명리 연도 안에서의 순서다 */
  index: number;
  /** ISO instant */
  start: string;
  /** ISO instant */
  end: string;
  /** 월운 간지 (한글) */
  korean: string;
  pivot: boolean;
}

/**
 * 인접한 달 사이의 변화량. 길이 12 이고 `[0]` 은 언제나 0 이다.
 *
 * 첫 달을 0 으로 두는 것은 계산 편의가 아니라 **정의**다. 세운이 입춘에 바뀌므로
 * 첫 달과 전년 마지막 달 사이의 Δ 는 거의 항상 크고, 넣으면 첫 달이 매년 변곡점이
 * 되어 신호가 아니라 상수가 된다. 그리고 "이 해가 어떤 해인가" 는 01 이 이미
 * 답한다 — 08 은 그 해가 시작된 뒤 **안에서** 달라지는 지점만 다룬다.
 */
export function monthDeltas(scores: MonthScore[]): number[] {
  return scores.map((s, i) =>
    i === 0
      ? 0
      : Math.abs(s.support - scores[i - 1].support) +
        Math.abs(s.friction - scores[i - 1].friction),
  );
}

/**
 * 그 해에 대운이 바뀌면, 전후 대운의 차이를 같은 자로 잰다.
 *
 * 대운 전환은 상품 경계가 아니지만(§3.4) 그 해에서 가장 큰 배경 변화일 수 있어
 * 변곡점 후보로 겨룬다. **다만 전환이 첫 달에 걸리면 후보가 되지 못한다** —
 * 첫 달이 후보에서 빠지는 규칙이 먼저다. 그 경우 전환은 01 의 연간 사실로 남는다.
 */
function daeunBonus(
  analysis: SajuAnalysis,
  year: number,
  scores: MonthScore[],
): { index: number; delta: number } | null {
  const sw = daeunSwitchIn(analysis, flowYearOf(year));
  if (!sw) return null;

  const before = parsePillar2(sw.before.pillar);
  const after = parsePillar2(sw.after.pillar);
  if (!before || !after) return null;

  const targets = frictionTargets(analysis, year);
  const delta =
    Math.abs(supportOf(after, analysis.yongsin) - supportOf(before, analysis.yongsin)) +
    Math.abs(frictionOf(after.branch, targets) - frictionOf(before.branch, targets));

  const at = sw.at.getTime();
  const hit = scores.find(
    (s) => at >= s.term.start.getTime() && at < s.term.end.getTime(),
  );
  return hit ? { index: hit.index, delta } : null;
}

/**
 * 그 해의 12개월과 변곡점 플래그.
 *
 * 변곡점을 별도 배열이 아니라 월의 플래그로 두는 것이 요점이다 — 두 배열로 나누면
 * 07(월별 흐름)과 08(변곡점)이 서로 다른 달을 가리키는 상태가 표현 가능해진다.
 */
export function flowMonths(analysis: SajuAnalysis, year: number): FlowMonth[] {
  const scores = monthScores(analysis, year);
  const deltas = monthDeltas(scores);

  const bonus = daeunBonus(analysis, year, scores);
  if (bonus) deltas[bonus.index - 1] += bonus.delta;

  // 첫 달을 뺀 나머지가 후보다. Δ 내림차순, 동점이면 이른 달 — 같은 입력이
  // 같은 결과를 내야 한다.
  const candidates = scores
    .slice(1)
    .map((s) => ({ index: s.index, delta: deltas[s.index - 1] }))
    .sort((a, b) => b.delta - a.delta || a.index - b.index);

  const picked: number[] = [];
  for (const c of candidates) {
    if (picked.length >= MAX_PIVOTS) break;
    if (c.delta < PIVOT_THRESHOLD) continue;
    // Δ 내림차순으로 훑기 때문에, 이미 뽑힌 이웃이 있다는 것은 그쪽 Δ 가 더
    // 크다는 뜻이다 — 여기서 건너뛰면 자연히 큰 쪽이 남는다.
    const tooClose = picked.some((p) => Math.abs(p - c.index) < MIN_PIVOT_GAP_MONTHS);
    if (tooClose) continue;
    picked.push(c.index);
  }

  const pivots = new Set(picked);
  return scores.map((s) => ({
    index: s.index,
    start: s.term.start.toISOString(),
    end: s.term.end.toISOString(),
    korean: s.term.korean,
    pivot: pivots.has(s.index),
  }));
}
```

- [ ] **Step 4: 테스트를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/pivots.test.ts`
Expected: PASS

`"변곡점끼리 가깝지 않다"` 나 `"시간 미상 프로필도 변곡점을 받을 수 있다"` 가 실패하면 구현이 아니라 임계값 문제일 수 있다 — Task 5 에서 다시 본다. 다른 테스트가 실패하면 구현을 고친다.

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/flows/_lib/pivots.ts src/app/api/flows/_lib/pivots.test.ts
git commit -m "feat(flow): 구간 자르기를 변곡점 탐지로 바꾼다

한 해를 1~3구간으로 자르는 대신 12개월을 그대로 두고, 그중 방향이 달라지는
달에만 플래그를 세운다. 첫 달은 후보에서 뺀다 — 세운이 입춘에 바뀌어 Δ 가
거의 항상 크고, 넣으면 매년 변곡점이 되어 신호가 아니라 상수가 된다.

변곡점을 별도 배열이 아니라 월의 플래그로 둔다. 두 배열이면 07 과 08 이
서로 다른 달을 가리키는 상태가 표현 가능해진다.

임계값은 아직 앞선 설계의 값 그대로다 — 다음 커밋에서 측정해 바꾼다."
```

---

## Task 5: `PIVOT_THRESHOLD` 측정

**Files:**
- Modify: `scripts/flow-threshold.mts`
- Modify: `src/app/api/flows/_lib/pivots.ts` (상수와 주석)

**Interfaces:**
- Consumes: Task 4 의 `flowMonths`
- Produces: 근거가 주석에 남은 `PIVOT_THRESHOLD`

앞선 값 `0.75` 는 **1~3구간 분포**를 목표로 보정한 값이라 목적이 달라진 지금은 근거가 없다.

조건:
- **대다수가 1~3개**, 상한 4개
- **0개는 목표 비율로 잡지 않는다.** 실제로 의미 있는 변화가 없을 때 자연스럽게 나오면 되고, 측정에서는 "0 이 구조적으로 불가능하지는 않은가" 만 확인한다
- 표본에 **시간 미상 프로필을 섞는다** — 앞선 측정은 `hour: 9` 만 썼고, 그래서 Task 2 가 고친 편향이 측정에 잡히지 않았다

- [ ] **Step 1: 측정 스크립트를 새 목적에 맞게 고친다**

`scripts/flow-threshold.mts` 를 통째로 교체:

```ts
// PIVOT_THRESHOLD 를 고르기 위한 분포 측정.
//
// 눈대중으로 고른 상수는 나중에 아무도 못 고친다(synastry.ts:70). 값의 근거를
// 분포로 남기려고 둔다. 실행: npx tsx scripts/flow-threshold.mts
//
// 앞선 측정(구간용)과 다른 점 둘:
//   1. 세는 것이 구간 수가 아니라 변곡점 수다 (0~4)
//   2. 표본에 시간 미상을 섞는다 — 시지가 없으면 friction 의 분모가 달라진다

import { analyze } from "@/lib/saju-core/analyze";
import { monthDeltas, MAX_PIVOTS, MIN_PIVOT_GAP_MONTHS } from "@/app/api/flows/_lib/pivots";
import { monthScores } from "@/app/api/flows/_lib/month-scores";

const YEARS = [2021, 2023, 2025, 2026, 2027, 2029, 2031];

interface Sample {
  year: number; month: number; day: number;
  hour: number | null; minute: number | null;
}

const BIRTHS: Sample[] = [];
for (let y = 1960; y <= 2005; y += 5) {
  for (const [m, d] of [[2, 10], [5, 22], [8, 3], [11, 17]] as const) {
    BIRTHS.push({ year: y, month: m, day: d, hour: 9, minute: 0 });
    // 표본의 절반은 시간 미상 — 분모가 달라져 friction 의 크기가 달라진다
    BIRTHS.push({ year: y, month: m, day: d, hour: null, minute: null });
  }
}

/** flowMonths 의 선정 규칙을 임계값만 바꿔 가며 재현한다. */
function countPivots(deltas: number[], threshold: number): number {
  const candidates = deltas
    .map((delta, i) => ({ index: i + 1, delta }))
    .slice(1)
    .sort((a, b) => b.delta - a.delta || a.index - b.index);

  const picked: number[] = [];
  for (const c of candidates) {
    if (picked.length >= MAX_PIVOTS) break;
    if (c.delta < threshold) continue;
    if (picked.some((p) => Math.abs(p - c.index) < MIN_PIVOT_GAP_MONTHS)) continue;
    picked.push(c.index);
  }
  return picked.length;
}

// 대운 전환 보너스는 넣지 않는다 — 전환이 있는 해는 표본의 일부일 뿐이고,
// 임계값이 정하는 것은 "평범한 달 사이의 변화를 어디부터 전환으로 볼 것인가" 다.
const allDeltas: number[][] = [];
for (const b of BIRTHS) {
  for (const g of ["male", "female"] as const) {
    const a = analyze({ ...b, gender: g, calendar: "solar" });
    for (const y of YEARS) allDeltas.push(monthDeltas(monthScores(a, y)));
  }
}

console.log(`표본 ${allDeltas.length}건 (시간 미상 절반 포함)\n`);
console.log("임계값 |  0개  |  1개  |  2개  |  3개  |  4개  | 1~3개 합");
console.log("-".repeat(62));

for (let t = 0.2; t <= 1.6001; t += 0.05) {
  const counts = [0, 0, 0, 0, 0];
  for (const d of allDeltas) counts[countPivots(d, t)] += 1;
  const pct = (n: number) => ((n / allDeltas.length) * 100).toFixed(1).padStart(5);
  const mid = ((counts[1] + counts[2] + counts[3]) / allDeltas.length) * 100;
  console.log(
    `${t.toFixed(2).padStart(6)} |${pct(counts[0])} |${pct(counts[1])} |` +
      `${pct(counts[2])} |${pct(counts[3])} |${pct(counts[4])} | ${mid.toFixed(1)}%`,
  );
}
```

- [ ] **Step 2: 측정을 돌린다**

Run: `npx tsx scripts/flow-threshold.mts`
Expected: 임계값별 분포 표가 출력된다

> `npx tsx` 가 `@/` 별칭을 못 풀면 `tsconfig.json` 의 `paths` 를 tsx 가 읽도록
> `npx tsx --tsconfig tsconfig.json scripts/flow-threshold.mts` 로 시도하고,
> 그래도 안 되면 스크립트의 import 를 상대경로로 바꾼다.

- [ ] **Step 3: 값을 고르고 근거를 주석에 남긴다**

**고르는 규칙:**
1. `1~3개 합` 이 가장 큰 구간을 찾는다.
2. 그 안에서 `4개` 가 10% 미만인 값을 고른다 — 4개는 상한이지 흔한 결과가 아니다.
3. `0개` 가 0.0% 인 값은 피한다. 비율을 목표로 삼는 것이 아니라, **0 이 구조적으로 불가능하면 §21("변곡점 없음도 유효한 분석 결과")이 죽은 문장이 되기 때문이다.**
4. 조건을 만족하는 구간의 **가운데** 값을 쓴다 — 경계값은 표본이 조금만 달라져도 성질이 바뀐다.

조건을 모두 만족하는 값이 **하나도 없으면** 임계값을 억지로 고르지 말고 멈춘다.
그건 임계값이 아니라 Δ 의 스케일이나 `MIN_PIVOT_GAP_MONTHS` 가 잘못됐다는 뜻이다 —
측정 표를 그대로 들고 사람에게 보고한다.

`src/app/api/flows/_lib/pivots.ts` 의 `PIVOT_THRESHOLD` 주석을 실측표로 교체한다. 형식은 `month-scores.ts` 이전 버전(`FLOW_SEGMENT_THRESHOLD`)의 주석을 따른다:

```ts
/**
 * ⚠️ 이 값 하나가 변곡점 개수를 정한다.
 *
 * 근거는 이론이 아니라 분포다. scripts/flow-threshold.mts 로 1960~2005년 5년
 * 간격 생년(10명) × 생일 4개 × {시간 있음, 시간 미상} × 남녀 × 7개 해 =
 * 총 <실측 건수>건의 Δ 분포를 뽑았다.
 *
 * 측정값 (임계값별 [0개, 1개, 2개, 3개, 4개] 비율):
 *   <스크립트 출력에서 발췌한 표를 여기 붙인다>
 *
 * 채택 근거:
 *   - 1~3개 합이 <n>% 로 가장 두껍다
 *   - 4개가 <n>% 로 드물다 — 상한이지 기본값이 아니다
 *   - 0개가 <n>% 로 관측된다. 비율을 맞추려는 것이 아니라, 0 이 구조적으로
 *     불가능하면 "변곡점 없음도 유효한 결과" 라는 기획이 죽은 문장이 되기 때문이다
 *   - 조건을 만족하는 구간의 가운데 값이라 표본이 조금 흔들려도 성질이 안 바뀐다
 *
 * 올리면 변곡점이 줄고 내리면 늘어난다. 바꾸기 전에 스크립트를 다시 돌릴 것 —
 * 이미 판 흐름은 flows.months 에 박제돼 소급되지 않지만, 새로 파는 흐름의
 * 성격이 통째로 달라진다.
 */
export const PIVOT_THRESHOLD = /* 측정값 */;
```

- [ ] **Step 4: Task 4 의 테스트를 다시 돌린다**

Run: `npx vitest run src/app/api/flows/_lib/pivots.test.ts`
Expected: PASS — 특히 `"시간 미상 프로필도 변곡점을 받을 수 있다"` 와 `"간격에 걸리면 Δ 가 큰 쪽이 남는다"`

실패하면 임계값 선택을 다시 본다.

- [ ] **Step 5: 커밋**

```bash
git add scripts/flow-threshold.mts src/app/api/flows/_lib/pivots.ts
git commit -m "fix(flow): 변곡점 임계값을 새 목적에 맞춰 다시 측정한다

앞선 0.75 는 1~3구간 분포를 목표로 보정한 값이라, 세는 대상이 구간에서
변곡점으로 바뀐 지금은 근거가 없다.

표본에 시간 미상을 절반 섞었다. 앞선 측정이 hour: 9 만 써서, 시지가 없으면
friction 의 분모가 달라진다는 사실이 분포에 잡히지 않았다."
```

---

## Task 6: 마이그레이션과 저장소 — `months` 로 갈아탄다

**Files:**
- Create: `migrations/0037_flow_sections_drop.sql` … `migrations/0043_entitlements_current_flow_purge.sql`
- Modify: `migrations/README.md`
- Modify: `src/lib/flows/store.ts`, `src/lib/tickets/features.ts`, `src/lib/tickets/entitlements.ts`
- Modify: `src/lib/flows/access.ts`, `src/lib/flows/tickets.ts`, `src/app/api/flows/_lib/gated-generator.ts`, `src/app/api/tickets/spend/route.ts`
- Test: `src/lib/flows/store.test.ts`, `src/lib/tickets/entitlements.test.ts`(신규)

**Interfaces:**
- Consumes: Task 4 의 `FlowMonth`
- Produces:
  - `FlowRow { id; userId; profileId; flowYear; periodStart; periodEnd; months: FlowMonth[]; createdAt }`
  - `CreateFlowInput { profileId; flowYear; periodStart; periodEnd; months: FlowMonth[] }`
  - `findFlow(profileId, flowYear, client?)`, `findOrCreateFlow(userId, input, client?)`, `getFlow(userId, id, client?)`
  - `listFlowYears(userId, profileId, client?): Promise<{ id: string; flowYear: number }[]>`
  - `listEntitledSubjects(userId, feature, client?): Promise<string[]>`
  - `Feature` 에 `"yearly_flow"` (기존 `"current_flow"` 는 사라진다)

> ⚠️ **마이그레이션 파일만 만든다. 절대 실행하지 않는다.** 개발 DB 가 워크트리
> 사이에서 공유되어, 여기서 돌리면 다른 브랜치가 머지 전까지 500 이 된다.

- [ ] **Step 1: 마이그레이션 7개를 쓴다**

`migrations/0037_flow_sections_drop.sql`:

```sql
-- 섹션 키 9종이 전부 새 값이고 content 모양도 바뀌어, 남은 행은 한 줄도 읽히지
-- 않는다. 되살릴 수 있는 형태로 옮길 방법이 없어 지운다.
--
-- ⚠️ 이 판단은 미출시 상태에서만 유효하다. 이 브랜치는 main 에 없고 판매 이력이
-- 없다. 프로덕션이 있는 상황의 선례로 삼지 말 것.
--
-- flows 를 참조하는 FK 가 있어 먼저 지운다.
DROP TABLE IF EXISTS flow_sections;
```

`migrations/0038_flows_drop.sql`:

```sql
-- segments(1~3구간)가 months(12개월 + 변곡점 플래그)로 바뀐다. 컬럼 교체로는
-- 기존 행의 NOT NULL 을 채울 수 없고, 채운다 해도 그 값이 뜻하는 상품이 없다.
--
-- ⚠️ 0037 과 같은 이유로 미출시 상태에서만 유효하다.
DROP TABLE IF EXISTS flows;
```

`migrations/0039_flows.sql`:

```sql
-- 흐름 리포트 1건. 이용권 1장이 차감되는 단위이기도 하다.
--
-- flow_year 는 달력 연도가 아니라 명리 연도(세운)다 — 입춘에서 바뀐다.
-- 앞선 설계와 달리 "지금" 이 아니라 사용자가 고른 해다 (현재 ±5년).
--
-- period_start/end 와 months 를 저장하는 이유는 같다: 절기 계산이 정밀해지거나
-- PIVOT_THRESHOLD 를 튜닝해도 이미 판 상품이 소급해서 바뀌면 안 된다. 읽을 때마다
-- 다시 계산하면 임계값 한 번 조정으로 저장된 08(변곡점)이 가리키는 달과 실제
-- 계산 결과가 어긋난다.
--
-- months 는 12개 원소다:
--   [{ "index": 1, "start": "…", "end": "…", "korean": "임인", "pivot": false }, …]
-- 변곡점을 별도 배열이 아니라 월의 플래그로 둔다 — 두 배열이면 07(월별 흐름)과
-- 08(변곡점)이 서로 다른 달을 가리키는 상태가 표현 가능해진다.
--
-- ⚠️ 경계 시각은 절대 시각(instant)이다. solarTermDate/solarTermJD 는 +9h 가
-- 박힌 KST 벽시계 값을 돌려주므로 solarTermInstant() 를 쓸 것.
CREATE TABLE IF NOT EXISTS flows (
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

`migrations/0040_flows_unique.sql`:

```sql
-- 프로필 × 명리 연도 = 상품 1개. 이 인덱스가 곧 과금 단위다.
--
-- user_id 를 넣지 않는 이유: 프로필이 이미 한 사용자에게 속한다. 넣으면 같은
-- 프로필의 같은 해가 사용자별로 여러 행이 될 수 있어 unique 가 뜻을 잃는다.
--
-- entitlements.subject_key 가 이 행의 id 를 가리키므로, 여기서 "연도별 권한" 이
-- 새 로직 없이 저절로 나온다.
CREATE UNIQUE INDEX IF NOT EXISTS flows_unique ON flows (profile_id, flow_year);
```

`migrations/0041_flows_user_profile_idx.sql`:

```sql
-- 선택 화면이 "이 프로필로 어느 해를 샀나" 를 묻는다. 프로필 드롭다운의
-- "N개 보유" 와 연도 그리드의 소유 배지가 같은 조회를 쓴다.
CREATE INDEX IF NOT EXISTS flows_user_profile_idx ON flows (user_id, profile_id);
```

`migrations/0042_flow_sections.sql`:

```sql
-- 생성된 서술. 캐시가 아니라 결과 저장이다.
--
-- 리포트 해석은 chartKey 로 사람 사이에서 공유되지만, 흐름은 프로필 × 연도라
-- 교차 사용자 적중률이 0 에 수렴한다. 여기서 필요한 건 적중률이 아니라 영속성이다 —
-- 이용권을 쓴 결과가 새로고침마다 달라지면 안 된다. (match_sections 와 같은 판단)
--
-- content 의 모양은 섹션마다 다르다:
--   overview                     { title, body, keywords[4] }
--   rising · straining           { lead, items[3] }
--   work · relating · money      { lead, body }
--   months                       { lead, months[12] }
--   pivots                       { lead, pivots[n] }   n = flows.months 의 pivot 개수
--   closing                      { lead, items[3], closing }
CREATE TABLE IF NOT EXISTS flow_sections (
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

`migrations/0043_entitlements_current_flow_purge.sql`:

```sql
-- 기능 id 가 current_flow → yearly_flow 로 바뀌면서 이 행들은 아무것도 열지
-- 못한다. 지우는 진짜 이유는 id 재사용이다: flows.id 는 GENERATED ALWAYS AS
-- IDENTITY 라 테이블을 다시 만들면 1 부터 다시 센다. 옛 권한 행의 subject_key 가
-- 새 흐름의 id 와 겹칠 수 있다.
--
-- 기능 id 를 바꾸는 것만으로도 매칭이 깨져 사고는 나지 않지만, 죽은 행을 남겨
-- 두면 다음 사람이 그 안전이 우연이었다는 사실을 모른다.
--
-- ticket_entries 는 지우지 않는다 — 원장은 일어난 일의 기록이다.
DELETE FROM entitlements WHERE feature = 'current_flow';
```

- [ ] **Step 2: `migrations/README.md` 의 다음 번호를 고친다**

파일 끝의 `**다음 번호는 0037 부터다.**` 를 `**다음 번호는 0044 부터다.**` 로 바꾼다.

- [ ] **Step 3: 실패하는 테스트를 쓴다**

`src/lib/tickets/entitlements.test.ts` (신규):

```ts
import { describe, expect, it } from "vitest";
import { listEntitledSubjects } from "./entitlements";

function fakeClient(rows: Record<string, unknown>[]) {
  return (() => Promise.resolve(rows)) as never;
}

describe("listEntitledSubjects", () => {
  it("subject_key 만 문자열로 뽑는다", async () => {
    const out = await listEntitledSubjects(
      "1",
      "yearly_flow",
      fakeClient([{ subject_key: "7" }, { subject_key: 9 }]),
    );
    expect(out).toEqual(["7", "9"]);
  });

  it("없으면 빈 배열이다", async () => {
    expect(await listEntitledSubjects("1", "yearly_flow", fakeClient([]))).toEqual([]);
  });
});
```

`src/lib/flows/store.test.ts` 의 `segments` 를 쓰는 테스트를 `months` 로 바꾸고, 아래를 더한다:

```ts
describe("toFlowRow — months", () => {
  it("드라이버가 jsonb 를 문자열로 줘도 파싱한다", async () => {
    const months = [{ index: 1, start: "a", end: "b", korean: "임인", pivot: false }];
    const row = await getFlow("1", "2", fakeClient([{
      id: 2, user_id: 1, profile_id: 3, flow_year: 2027,
      period_start: "2027-02-04T00:00:00Z", period_end: "2028-02-04T00:00:00Z",
      months: JSON.stringify(months), created_at: "2026-08-27T00:00:00Z",
    }]));
    expect(row?.months).toEqual(months);
  });

  it("months 가 배열이 아니면 던진다", async () => {
    // 빈 배열로 접으면 12칸짜리 화면이 0칸으로 조용히 깨지고 원인이 묻힌다
    await expect(getFlow("1", "2", fakeClient([{
      id: 2, user_id: 1, profile_id: 3, flow_year: 2027,
      period_start: "2027-02-04T00:00:00Z", period_end: "2028-02-04T00:00:00Z",
      months: "not json", created_at: "2026-08-27T00:00:00Z",
    }]))).rejects.toThrow();
  });
});
```

> 기존 `store.test.ts` 의 fake client 헬퍼 이름·모양을 그대로 쓴다. 파일을 먼저 읽고 맞출 것.

- [ ] **Step 4: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/lib/tickets/entitlements.test.ts src/lib/flows/store.test.ts`
Expected: FAIL — `listEntitledSubjects is not a function`, `months` 관련 실패

- [ ] **Step 5: 기능 id 를 바꾼다**

`src/lib/tickets/features.ts`:

```ts
export const FEATURE_IDS = [
  "full_report",
  "compatibility",
  "consultation",
  "yearly_flow",
] as const;

export const FEATURE_COST: Record<Feature, number> = {
  full_report: 1,
  compatibility: 1,
  consultation: 1,
  yearly_flow: 1,
};
```

주석에 한 줄 더한다:

```ts
 * 값은 entitlements.feature 컬럼에 그대로 들어간다. 한 번 나간 값은 사용자의
 * 열람 권한이므로 이름을 바꾸려면 마이그레이션이 필요하다.
 * (yearly_flow 는 출시 전이라 0043 에서 옛 행을 지우는 것으로 끝났다 — 다음엔 못 한다)
```

그다음 컴파일이 가리키는 곳을 전부 고친다:

Run: `npx tsc --noEmit 2>&1 | grep -n current_flow`

- `src/lib/flows/access.ts` — `FEATURE_COST.current_flow` → `FEATURE_COST.yearly_flow`
- `src/app/api/flows/_lib/gated-generator.ts` — `feature: "current_flow"` 두 곳(타입과 값)
- `src/app/api/tickets/spend/route.ts` — `case "current_flow":` → `case "yearly_flow":`
- `src/app/_lib/catalog.ts` — 키 이름(문구는 Task 14 에서)
- 각 `.test.ts`

- [ ] **Step 6: `listEntitledSubjects` 를 더한다**

`src/lib/tickets/entitlements.ts` 끝에:

```ts
/**
 * 이 사용자가 이 기능에 대해 가진 권한의 subject_key 전부.
 *
 * hasEntitlement 는 한 건을 묻는다. 선택 화면은 연도 11칸의 소유 여부를 한 번에
 * 물어야 해서 배치가 필요하다 — 칸마다 hasEntitlement 를 부르면 왕복이 11번이다.
 */
export async function listEntitledSubjects(
  userId: string,
  feature: Feature,
  client: SqlClient = sql,
): Promise<string[]> {
  const rows = await client`
    SELECT subject_key FROM entitlements
     WHERE user_id = ${userId}::bigint AND feature = ${feature}
  `;
  return rows.map((r) => String(r.subject_key));
}
```

- [ ] **Step 7: `src/lib/flows/store.ts` 를 `months` 로 바꾼다**

세 곳을 고친다.

(1) 타입과 `toSegments` → `toMonths`:

```ts
import { sql as neonSql, type SqlClient } from "@/lib/db";
import type { FlowMonth } from "@/app/api/flows/_lib/pivots";

const sql = neonSql as unknown as SqlClient;

export interface FlowRow {
  id: string;
  userId: string;
  profileId: string;
  /** 명리 연도(세운). 달력 연도가 아니다 */
  flowYear: number;
  /** 발행 시점에 박제한 적용 기간 */
  periodStart: Date;
  periodEnd: Date;
  /** 발행 시점에 박제한 12개월 + 변곡점 플래그. 읽을 때 다시 계산하지 않는다 */
  months: FlowMonth[];
  createdAt: Date;
}

export interface CreateFlowInput {
  profileId: string;
  flowYear: number;
  periodStart: Date;
  periodEnd: Date;
  months: FlowMonth[];
}

/**
 * jsonb 로 저장된 months 를 읽는다. Neon HTTP 드라이버가 이미 파싱된 배열을
 * 주는 경우와 JSON 문자열 그대로 주는 경우가 둘 다 있어 양쪽을 받는다
 * (consultations.toStringArray 와 같은 이유).
 *
 * consultations.toStringArray 와 다른 점: 모양이 다르면 빈 배열로 접지 않고
 * 던진다. months 는 07(월별 흐름)·08(변곡점) 화면 전부가 "12칸이 있다" 를
 * 전제로 짜여 있다 — 빈 배열이나 문자열을 그대로 흘리면 .length 가 글자 수가
 * 되고 인덱싱이 문자를 돌려주는데, 이게 조용히 깨진 화면으로만 보이고 원인
 * (드라이버가 문자열을 줬다는 사실)은 묻힌다.
 */
function toMonths(v: unknown, flowId: unknown): FlowMonth[] {
  const raw = typeof v === "string" ? safeParse(v) : v;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`toFlowRow: flow ${String(flowId)} 의 months 가 배열이 아닙니다`);
  }
  return raw as FlowMonth[];
}
```

`toFlowRow` 의 `segments: toSegments(raw.segments, raw.id)` 를 `months: toMonths(raw.months, raw.id)` 로 바꾼다.

(2) `findOrCreateFlow` 의 INSERT:

```ts
  const inserted = await client`
    INSERT INTO flows (user_id, profile_id, flow_year, period_start, period_end, months)
    VALUES (
      ${userId}::bigint, ${input.profileId}::bigint, ${input.flowYear},
      ${input.periodStart.toISOString()}::timestamptz,
      ${input.periodEnd.toISOString()}::timestamptz,
      ${JSON.stringify(input.months)}::jsonb
    )
    ON CONFLICT (profile_id, flow_year) DO NOTHING
    RETURNING id
  `;
```

(3) `listFlows` 를 `listFlowYears` 로 교체:

```ts
/**
 * 이 프로필로 만든 흐름의 연도 목록. 선택 화면이 연도 칸에 배지를 붙이는 자리다.
 *
 * 행 전체를 읽지 않는다 — months 를 12개씩 파싱해 봐야 이 화면은 id 와 연도만
 * 쓴다. 그리고 소유 여부는 여기가 아니라 entitlements 가 답한다: 행은 공짜로
 * 만들어지고 차감은 생성 자리에서 일어나므로, 생성이 막히면 행만 남고 권한은 없다.
 */
export async function listFlowYears(
  userId: string,
  profileId: string,
  client: SqlClient = sql,
): Promise<{ id: string; flowYear: number }[]> {
  const rows = await client`
    SELECT id, flow_year FROM flows
     WHERE user_id = ${userId}::bigint AND profile_id = ${profileId}::bigint
     ORDER BY flow_year DESC
  `;
  return rows.map((r) => ({ id: String(r.id), flowYear: Number(r.flow_year) }));
}
```

- [ ] **Step 8: 테스트와 타입을 확인한다**

Run: `npx vitest run src/lib/flows/ src/lib/tickets/`
Expected: PASS

Run: `npx tsc --noEmit 2>&1 | grep -c "src/lib/"`
Expected: `0` — `src/lib/` 아래는 깨끗해야 한다. `src/app/` 은 아직 깨져 있다(Task 7~13).

- [ ] **Step 9: 커밋**

```bash
git add migrations/ src/lib/flows/ src/lib/tickets/ src/app/api/tickets/spend/route.ts src/app/api/flows/_lib/gated-generator.ts
git commit -m "feat(flow): 저장소를 12개월 박제로 갈아탄다

segments(1~3구간)를 months(12개월 + 변곡점 플래그)로 바꾸고, 컬럼 교체로
기존 행을 살릴 수 없어 두 테이블을 다시 만든다. 판매 이력이 없어 지금은
가능하지만 프로덕션이 있는 상황의 선례가 아니다.

기능 id 를 current_flow 에서 yearly_flow 로 바꾼다 — 5년 전 해도 사게 되면서
'current' 가 거짓이 됐다. entitlements 에 나간 값이라 출시 후엔 못 바꾼다.
옛 권한 행을 함께 지운다: id 가 1부터 다시 세어져 새 흐름과 겹칠 수 있고,
기능 id 변경이 그걸 막아 주는 것은 우연이다."
```

---

## Task 7: 섹션 레지스트리 9종

**Files:**
- Rewrite: `src/app/api/flows/_lib/sections/registry.ts`
- Rewrite: `src/app/api/flows/_lib/sections/derive.ts`
- Test: `src/app/api/flows/_lib/sections/registry.test.ts`, `derive.test.ts`

**Interfaces:**
- Consumes: 없음(순수)
- Produces:
  - `interface FlowSchemaContext { pivotMonths: readonly number[] }`
  - `interface FlowItem { title: string; body: string }`
  - `OverviewContent { title; body; keywords: string[] }`
  - `ItemsContent { lead; items: FlowItem[] }`
  - `ProseContent { lead; body }`
  - `MonthsContent { lead; months: { monthIndex: number; title; body }[] }`
  - `PivotsContent { lead; pivots: { monthIndex: number; title; body }[] }`
  - `ClosingContent { lead; items: FlowItem[]; closing: string }`
  - `FLOW_SECTIONS`, `FlowSectionKey`, `FLOW_SECTION_KEYS`, `FlowInterpretation`
  - `flowLlmInputSchema(key, ctx: FlowSchemaContext)`, `parseFlowSectionContent(key, raw, ctx)`
  - `isFlowSectionKey`, `flowSectionVersion`, `assignFlow`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/sections/registry.test.ts` 를 통째로 교체:

```ts
import { describe, expect, it } from "vitest";
import { FLOW_SECTIONS, FLOW_SECTION_KEYS } from "./index";
import { parseFlowSectionContent } from "./derive";

const CTX = { pivotMonths: [3, 7, 10] as const };

describe("FLOW_SECTIONS", () => {
  it("9개 섹션을 기획서 순서대로 갖는다", () => {
    expect(FLOW_SECTION_KEYS).toEqual([
      "overview", "rising", "straining", "work",
      "relating", "money", "months", "pivots", "closing",
    ]);
  });

  it("예시가 자기 스키마를 통과한다", () => {
    // 예시가 스키마를 어기면 LLM 이 어긴 모양을 그대로 따라 한다
    for (const key of FLOW_SECTION_KEYS) {
      const parsed = JSON.parse(FLOW_SECTIONS[key].example);
      expect(parseFlowSectionContent(key, parsed, CTX), key).not.toBeNull();
    }
  });

  it("예시가 연도·월 숫자를 쓰지 않는다", () => {
    // 규칙보다 예시가 이긴다 — 예시에 "3월" 이 있으면 본문에도 나온다
    for (const key of FLOW_SECTION_KEYS) {
      expect(FLOW_SECTIONS[key].example, key).not.toMatch(/\d+월|\d{4}년/);
    }
  });
});

describe("months 스키마", () => {
  const twelve = (extra: Partial<Record<string, unknown>> = {}) => ({
    lead: "한 해가 이렇게 흘러가요.",
    months: Array.from({ length: 12 }, (_, i) => ({
      monthIndex: i + 1, title: `t${i}`, body: `b${i}`,
    })),
    ...extra,
  });

  it("12개가 정확히 다 있으면 통과한다", () => {
    expect(parseFlowSectionContent("months", twelve(), CTX)).not.toBeNull();
  });

  it("11개면 거부한다", () => {
    const c = twelve();
    c.months.pop();
    expect(parseFlowSectionContent("months", c, CTX)).toBeNull();
  });

  it("한 칸이 두 번이면 거부한다 — 개수만 맞고 한 달이 비는 경우", () => {
    const c = twelve();
    c.months[5].monthIndex = 1;
    expect(parseFlowSectionContent("months", c, CTX)).toBeNull();
  });

  it("13월은 거부한다", () => {
    const c = twelve();
    c.months[0].monthIndex = 13;
    expect(parseFlowSectionContent("months", c, CTX)).toBeNull();
  });
});

describe("pivots 스키마", () => {
  const of = (indices: number[]) => ({
    lead: "흐름이 크게 달라지는 시기예요.",
    pivots: indices.map((i) => ({ monthIndex: i, title: `t${i}`, body: `b${i}` })),
  });

  it("계산된 달과 정확히 일치하면 통과한다", () => {
    expect(parseFlowSectionContent("pivots", of([3, 7, 10]), CTX)).not.toBeNull();
  });

  it("계산되지 않은 달은 거부한다", () => {
    expect(parseFlowSectionContent("pivots", of([3, 5, 10]), CTX)).toBeNull();
  });

  it("개수가 모자라면 거부한다", () => {
    expect(parseFlowSectionContent("pivots", of([3, 7]), CTX)).toBeNull();
  });

  it("변곡점이 없는 해는 빈 배열만 받는다", () => {
    const empty = { pivotMonths: [] as const };
    expect(parseFlowSectionContent("pivots", of([]), empty)).not.toBeNull();
    expect(parseFlowSectionContent("pivots", of([4]), empty)).toBeNull();
  });

  it("변곡점이 하나뿐인 해도 만들 수 있다", () => {
    // z.union 은 최소 2개를 요구한다 — 이 경우를 안 다루면 스키마 조립에서
    // 터져 그 해의 08 이 통째로 생성되지 않는다
    const one = { pivotMonths: [7] as const };
    expect(parseFlowSectionContent("pivots", of([7]), one)).not.toBeNull();
    expect(parseFlowSectionContent("pivots", of([6]), one)).toBeNull();
    expect(parseFlowSectionContent("pivots", of([]), one)).toBeNull();
  });
});

describe("items 스키마", () => {
  it("정확히 3개여야 한다 — '3개 정도' 를 타입으로 굳힌다", () => {
    const make = (n: number) => ({
      lead: "l",
      items: Array.from({ length: n }, (_, i) => ({ title: `t${i}`, body: `b${i}` })),
    });
    expect(parseFlowSectionContent("rising", make(3), CTX)).not.toBeNull();
    expect(parseFlowSectionContent("rising", make(2), CTX)).toBeNull();
    expect(parseFlowSectionContent("rising", make(4), CTX)).toBeNull();
  });
});

describe("overview 스키마", () => {
  it("키워드는 4개다", () => {
    const base = { title: "t", body: "b" };
    expect(parseFlowSectionContent("overview", { ...base, keywords: ["가","나","다","라"] }, CTX)).not.toBeNull();
    expect(parseFlowSectionContent("overview", { ...base, keywords: ["가","나","다"] }, CTX)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/sections/`
Expected: FAIL

- [ ] **Step 3: `registry.ts` 를 통째로 교체한다**

```ts
import { z } from "zod";

export interface FlowItem {
  title: string;
  body: string;
}

export interface FlowMonthBody {
  /** 1‥12. 명리 연도 안에서의 순서다 — 달력 월이 아니다 */
  monthIndex: number;
  title: string;
  body: string;
}

/** 01 — 대표 제목 + 본문 + 첫 화면의 키워드 */
export interface OverviewContent {
  title: string;
  body: string;
  keywords: string[];
}

/** 02·03 — 배경 한 문단 + 항목 3개 */
export interface ItemsContent {
  lead: string;
  items: FlowItem[];
}

/** 04·05·06 — 배경 한 문단 + 이어지는 본문 */
export interface ProseContent {
  lead: string;
  body: string;
}

/** 07 — 12개월 전부 */
export interface MonthsContent {
  lead: string;
  months: FlowMonthBody[];
}

/** 08 — 계산된 변곡점만. 0개일 수 있다 */
export interface PivotsContent {
  lead: string;
  pivots: FlowMonthBody[];
}

/** 09 — 항목 3개 + 마지막 한 문장 */
export interface ClosingContent {
  lead: string;
  items: FlowItem[];
  closing: string;
}

/**
 * 스키마 팩토리가 받는 것.
 *
 * 앞선 설계는 구간 수 n 하나였다. 이제 섹션마다 필요한 값이 달라 객체로 받는다 —
 * 07 은 언제나 12개라 아무것도 필요 없고, 08 만 계산된 변곡점 목록을 쓴다.
 */
export interface FlowSchemaContext {
  /** 계산된 변곡점의 달 번호. 0개일 수 있다 */
  pivotMonths: readonly number[];
}

export interface FlowSectionSpec {
  /**
   * 이 섹션 스키마의 버전. flow_sections.schema_version 에 기록된다.
   * shape 을 바꿀 때만이 아니라 프롬프트 의미가 바뀌었을 때도 올린다.
   *
   * ⚠️ 올리면 이미 판 흐름 전부가 다음 열람에서 다시 생성된다. entitlements 행이
   * 남아 있어 지갑은 안 깎이지만 LLM 호출은 다시 든다. 올리기 전에 비용을 계산할 것.
   */
  version: number;
  /**
   * content 의 유일한 shape 정의.
   *
   * 리포트·궁합과 달리 **상수가 아니라 팩토리**다 — 08 의 정의역이 그 해의 계산
   * 결과에 따라 달라지고, 그 좁힘이 곧 검증이기 때문이다.
   */
  schema: (ctx: FlowSchemaContext) => z.ZodType;
  /** 이 섹션만 재생성할 때 LLM 에 줄 지시문 */
  prompt: string;
  /**
   * 문체를 잡아주는 짧은 예시.
   * ⚠️ 예시도 FLOW_SYSTEM_PROMPT 규칙을 지켜야 한다 — 연도·월·날짜를 쓰면
   * "쓰지 말라" 는 규칙보다 예시가 이긴다.
   */
  example: string;
}

const item = z.object({ title: z.string().min(1), body: z.string().min(1) }).strict();

/**
 * 항목 3개. 기획서는 "3개 정도" 라고 쓰지만 정확히 3개로 굳힌다 — 개수를
 * 프롬프트로 부탁하면 지켜지지 않는 날이 오고, 화면은 그때 2개짜리 목록을 받는다.
 */
const items = () => z.array(item).length(3);

/**
 * 달 목록. **개수 + 정의역 + 중복 금지** 셋이 모여야 집합이 정확히 일치한다.
 * 하나만 빠져도 "개수는 맞는데 한 달이 비고 다른 달이 두 번" 이 통과한다.
 */
function monthList(allowed: readonly number[]) {
  // 변곡점이 없는 해. 원소 스키마를 만들 필요 자체가 없다 — 빈 배열만 통과시킨다.
  // (§21: "변곡점 없음" 도 유효한 결과다. 여기서 그게 문장이 아니라 타입이 된다)
  if (allowed.length === 0) return z.array(z.never()).length(0);

  // ⚠️ z.union 은 최소 2개를 요구한다. 변곡점이 정확히 1개인 해가 실제로 있어
  // (임계값을 넘긴 후보가 하나뿐인 경우) 그때 union 을 쓰면 스키마 조립에서
  // 터진다 — 그 해의 08 이 통째로 생성되지 않는다.
  const domain =
    allowed.length === 1
      ? z.literal(allowed[0])
      : z.union(
          allowed.map((n) => z.literal(n)) as [
            z.ZodLiteral<number>,
            z.ZodLiteral<number>,
            ...z.ZodLiteral<number>[],
          ],
        );

  const body = z
    .object({
      // 정의역이 그대로 JSON Schema 의 const/enum 이 되어 LLM 이 본다. refine 으로
      // 좁히면 검증은 되지만 LLM 은 그 제약을 못 봐서 틀린 뒤에야 걸린다.
      monthIndex: domain as z.ZodType<number>,
      title: z.string().min(1),
      body: z.string().min(1),
    })
    .strict();

  return z
    .array(body)
    .length(allowed.length)
    .superRefine((arr, ctx) => {
      if (new Set(arr.map((m) => m.monthIndex)).size !== arr.length) {
        ctx.addIssue({ code: "custom", message: "monthIndex 가 중복되었습니다" });
      }
    });
}

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const overview = () =>
  z
    .object({
      title: z.string().min(1),
      body: z.string().min(1),
      keywords: z.array(z.string().min(1)).length(4),
    })
    .strict();

const withItems = () => z.object({ lead: z.string().min(1), items: items() }).strict();

const prose = () => z.object({ lead: z.string().min(1), body: z.string().min(1) }).strict();

const months = () =>
  z.object({ lead: z.string().min(1), months: monthList(ALL_MONTHS) }).strict();

const pivots = (ctx: FlowSchemaContext) =>
  z.object({ lead: z.string().min(1), pivots: monthList(ctx.pivotMonths) }).strict();

const closing = () =>
  z
    .object({ lead: z.string().min(1), items: items(), closing: z.string().min(1) })
    .strict();

/** 모든 섹션에 걸리는 공통 규칙. 한 곳에 두어 한쪽만 고쳐지는 일을 막는다. */
const COMMON_RULE =
  "연도·월·날짜를 지어내지 마라 — 시간 표시는 계산된 값이 화면에서 붙는다. " +
  "과거형이나 미래형으로 시점을 못박지 마라: 사용자는 지난 해도 다가올 해도 고를 수 있고, " +
  "다가올 해는 시간이 지나면 지난 해가 된다. '~하기 쉬운 해예요' 처럼 시제 중립으로 쓴다.";

/**
 * 흐름 서술 섹션. section_key = 이 객체의 키. 렌더 순서도 이 선언 순서다.
 *
 * 리포트의 SECTIONS 와 나란한 구조지만 tier·storage 가 없다 — 무료/유료로 갈리지
 * 않고 저장소가 하나다. (궁합의 MATCH_SECTIONS 와 같다)
 */
export const FLOW_SECTIONS = {
  overview: {
    version: 1,
    schema: overview,
    prompt: [
      "01 한 해의 흐름. 이 해 전체를 관통하는 주제를 정한다.",
      "title 은 이 해를 한마디로 압축한 대표 문장이다. 예: '넓히기보다 내 것을 분명하게 만드는 해'.",
      "body 는 큰 배경(오래 이어지는 흐름)과 이 해의 기운이 만나 어떤 흐름이 만들어지는지 4~6문장.",
      "큰 흐름 안에서 이 해가 어떤 위치인지도 자연스럽게 포함한다. 배경이 바뀌는 해라면 그것도 여기서 말한다.",
      "길흉 총평으로 만들지 마라 — 좋은 해 / 나쁜 해가 아니라 어떤 방향의 해인가를 쓴다.",
      "keywords 는 이 해를 대표하는 낱말 4개. 각 2~4글자의 명사.",
      COMMON_RULE,
    ].join("\n"),
    example:
      '{"title":"넓히기보다 내 것을 분명하게 만드는 해","body":"오래 이어져온 변화의 흐름 안에서도 이 해는 직접 고르고 움직이는 힘이 강해져요. 이전에는 주변 상황을 살피는 일이 중요했다면, 지금은 살펴온 것 가운데 무엇을 남길지 정하는 쪽으로 무게가 옮겨가요. 새로 벌이기보다 이미 가진 것을 분명하게 만드는 편이 흐름과 잘 맞아요.","keywords":["정리","선택","연결","지속"]}',
  },

  rising: {
    version: 1,
    schema: withItems,
    prompt: [
      "02 힘이 실리는 것. 이 해에 평소보다 자연스럽게 쓰기 쉬워지는 힘 3가지.",
      "타고난 강점을 다시 설명하지 마라 — '원래 잘하는 것' 이 아니라 '이 해에 평소보다 사용하기 쉬워지는 힘' 이다.",
      "각 item 의 title 은 그 힘을 한 줄로, body 는 2~3문장으로 실제 생활 장면과 함께 쓴다.",
      "각 item 에 '원래는 …지만 이 해에는 …' 같은 대비를 최소 한 번 넣어라.",
      COMMON_RULE,
    ].join("\n"),
    example:
      '{"lead":"결정을 미루지 않는 힘과 밖으로 꺼내는 힘이 함께 올라와요.","items":[{"title":"생각을 행동으로 옮기는 힘","body":"평소에는 여러 가능성을 오래 살피는 편이지만, 이 해에는 어느 정도 판단이 서면 직접 움직여보려는 힘이 강해져요. 생각만 하던 것을 말이나 결과물로 보여주는 일도 조금 더 자연스러워져요."},{"title":"사람과 연결해서 일을 키우는 힘","body":"혼자 끌고 가던 일에 다른 사람을 들이는 것이 덜 어색해지는 시기예요. 도움을 청하는 일이 부담이 아니라 방법으로 느껴지기 쉬워요."},{"title":"오래 미뤄둔 것을 정리하는 힘","body":"미뤄둔 일을 꺼내 보는 마음이 평소보다 자주 올라와요. 크게 마음먹기보다 손에 잡히는 것부터 하나씩 끝내는 편이 흐름과 맞아요."}]}',
  },

  straining: {
    version: 1,
    schema: withItems,
    prompt: [
      "03 부담되는 것. 이 해에 평소보다 에너지를 많이 쓰게 되는 지점 3가지.",
      "'조심하세요' 같은 경고가 아니다. 사용자가 '그래서 이 시기가 유독 힘들었구나' 라고 이해하게 만드는 것이 목적이다.",
      "핵심 질문은 '어디에서 평소보다 힘을 많이 쓰게 되는가' 다.",
      "각 item 에 '원래는 …지만 이 해에는 …' 같은 대비를 최소 한 번 넣어라.",
      COMMON_RULE,
    ].join("\n"),
    example:
      '{"lead":"밖에서 들어오는 요구가 늘면서 무엇을 내려놓을지가 중요해지는 흐름이에요.","items":[{"title":"선택지가 너무 많아질 때","body":"평소에는 고를 것이 있다는 게 반가운 편이지만, 이 해에는 선택지가 늘수록 결정이 늦어지기 쉬워요. 다 검토하려다 아무것도 시작하지 못하는 장면이 생길 수 있어요."},{"title":"사람과 일이 동시에 몰릴 때","body":"평소에도 부탁을 잘 못 넘기는 편인데, 밖에서 들어오는 역할이 많아져 하나를 끝내기도 전에 다음 일을 붙잡게 될 수 있어요."},{"title":"모든 것을 혼자 책임지려고 할 때","body":"맡은 일을 끝까지 끌고 가려는 마음이 강해지는 만큼, 나눌 수 있는 일까지 혼자 지고 가기 쉬워요. 어디까지가 내 몫인지 한 번 그어볼 만한 시기예요."}]}',
  },

  work: {
    version: 1,
    schema: prose,
    prompt: [
      "04 일과 선택. 일·사업·프로젝트·공부·진로·개인 목표 등 무언가를 해내고 고르는 과정 전체를 다룬다.",
      "직장인만 전제하지 마라. 퇴사·창업·이직을 권하거나 결과를 예언하지 마라.",
      "다룰 것: 확장과 정리 중 어디에 무게가 실리는지, 새로 시작하기와 기존 것을 강화하기, 혼자와 협업, 선택의 기준, 성과를 내는 방식.",
      "선택의 결과가 아니라 **판단의 기준**을 준다.",
      "lead 는 한 문장, body 는 5~7문장의 이어지는 글이다.",
      COMMON_RULE,
    ].join("\n"),
    example:
      '{"lead":"벌이기보다 고르는 일이 중요해지는 흐름이에요.","body":"평소에는 하던 것을 다듬는 쪽이 편했다면, 이 해에는 다른 길을 검토하려는 마음이 강해지기 쉬워요. 다만 지금의 답답함에서 벗어나고 싶은 것인지, 실제로 더 원하는 방향이 생긴 것인지는 구분해서 보는 게 좋아요. 새로 시작하는 것보다 이미 손에 있는 것 가운데 무엇을 키울지 고르는 쪽에 힘이 실려요. 혼자 끌고 가기보다 이미 아는 사람과 엮어서 움직일 때 속도가 붙기 쉬운 시기예요. 무엇을 고를지 망설여진다면, 끝냈을 때 남는 것이 무엇인지를 기준으로 두면 덜 흔들려요."}',
  },

  relating: {
    version: 1,
    schema: prose,
    prompt: [
      "05 관계. 연애만이 아니라 인간관계 전반을 다룬다.",
      "특정 인물이 나타난다고 예측하지 마라. 관계의 지속·이별·결혼을 예언하지 마라.",
      "다룰 것: 관계에서 달라지는 태도, 넓어지는 관계와 깊어지는 관계, 에너지를 많이 쓰게 되는 패턴, 갈등이 생겼을 때 나타나기 쉬운 모습, 기억할 태도.",
      "'원래 사람을 어떻게 대하는가' 가 아니라 '이 해에 무엇이 평소와 달라지는가' 를 쓴다.",
      "lead 는 한 문장, body 는 5~7문장의 이어지는 글이다.",
      COMMON_RULE,
    ].join("\n"),
    example:
      '{"lead":"사람에게 쓰는 에너지가 늘어나는 흐름이에요.","body":"평소에도 상대를 먼저 살피는 편인데, 이 해에는 밖에서 들어오는 부탁과 역할이 많아지면서 그 성향이 더 강하게 작동하기 쉬워요. 아는 사람이 늘어나는 쪽보다, 이미 있는 관계가 한 겹 더 가까워지는 쪽에 무게가 실려요. 다만 한꺼번에 여러 사람을 챙기려다 정작 가까운 관계에 쓸 힘이 남지 않는 장면이 생길 수 있어요. 서운함이 쌓였을 때 곧장 말하기보다 혼자 정리하려는 버릇이 나오기 쉬운 시기라, 짧게라도 말로 꺼내 두는 편이 나아요. 혼자 감당하기보다 이미 가진 관계에 기대는 쪽이 이 해의 흐름과 잘 맞아요."}',
  },

  money: {
    version: 1,
    schema: prose,
    prompt: [
      "06 돈과 현실. 돈이 들어올지 나갈지를 예측하지 말고, 돈·수입·소비·성과·안정·현실적 책임을 대하는 **태도**가 어떻게 달라지기 쉬운지 쓴다.",
      "금지: 투자 종목 추천, 투자 시점 예측, 수익 보장, 부동산 매수/매도 지시, 큰돈이 들어온다는 단정, 횡재, 복권·도박.",
      "lead 는 한 문장, body 는 5~7문장의 이어지는 글이다.",
      COMMON_RULE,
    ].join("\n"),
    example:
      '{"lead":"크게 늘리는 것보다 이미 가진 것을 제대로 쓰는 것이 중요한 흐름이에요.","body":"평소에는 계획한 만큼 쓰는 편이지만, 이 해에는 사람과 자리에 얽힌 지출이 늘기 쉬워요. 기회가 들어왔을 때 크기부터 보게 되는 마음이 강해지는데, 감당할 수 있는 범위를 먼저 정해 두면 덜 흔들려요. 불안해서 서둘러 결정하는 소비가 있는지 한 번 살펴볼 만한 시기예요. 새 수입원을 만드는 것보다 이미 들어오는 것을 안정적으로 만드는 쪽에 힘이 실려요. 현실적인 책임이 늘어나는 만큼, 무엇을 줄일지 정하는 일이 무엇을 더할지 정하는 일보다 먼저예요."}',
  },

  months: {
    version: 1,
    schema: months,
    prompt: [
      "07 월별 흐름. 이 해의 12개 달을 **모두** 쓴다. monthIndex 1부터 12까지 하나씩, 빠짐없이.",
      "각 달은 title(그 달을 한 줄로) + body(2~4문장). 장문의 독립 리포트로 만들지 마라.",
      "**이 섹션은 장면을 쓴다** — 그 달 안에서 무엇을 하게 되고 무엇이 눈에 들어오는가. 왜 그 시점에 바뀌는지, 한 해에서 무슨 의미인지는 08 이 쓴다.",
      "각 달의 [사실]에 실린 관계·두드러지는 힘을 재료로 써서 달마다 다른 장면을 만들어라. 두 축(받쳐줌·흔들림)만 보고 쓰면 같은 표현이 여섯 번 반복된다.",
      "**모든 달을 설명하되 모든 달이 특별하다고 말하지 마라.** 변화가 작은 달은 '앞선 흐름이 이어지는 달' 로 솔직하게 쓴다.",
      "12개 달은 하나의 연간 흐름 안에서 이어져야 한다. 같은 말(예: '새로 시작하는 달')을 여러 달에 반복하지 마라.",
      "변곡점이라고 표시된 달은 앞 달과 무엇이 달라지는지를 body 에 반드시 넣는다.",
      COMMON_RULE,
    ].join("\n"),
    example:
      '{"lead":"안에서 정리하던 힘이 서서히 밖으로 옮겨가는 한 해예요.","months":[{"monthIndex":1,"title":"방향을 잡는 달","body":"새로운 흐름이 시작되면서 무엇을 계속 가져가고 무엇을 내려놓을지 생각이 많아져요. 바로 크게 움직이기보다 힘을 어디에 쓸지 먼저 정리하는 편이 좋아요."},{"monthIndex":2,"title":"움직임이 살아나는 달","body":"생각으로만 두었던 것을 꺼내보려는 힘이 조금씩 강해져요. 사람과 이야기하거나 작은 결과물부터 만들어보는 것이 흐름을 이어가는 데 도움이 돼요."}]}',
  },

  pivots: {
    version: 1,
    schema: pivots,
    prompt: [
      "08 올해의 변곡점. **주어진 monthIndex 만** 쓴다. 하나도 없으면 pivots 는 빈 배열이다.",
      "**이 섹션은 구조를 쓴다** — 왜 하필 그 시점에 방향이 바뀌며, 그 전환이 한 해 전체에서 무슨 의미인가.",
      "그 달 안에서 무엇을 하게 되는가(장면)는 07 이 이미 썼다. 같은 말을 반복하지 말고, **앞뒤 시기를 반드시 비교**해라 — '앞선 시기까지 …하던 힘이 …쪽으로 옮겨가요' 같은 형태.",
      "title 은 그 전환을 한 줄로. 예: '안에서 밖으로 움직이기 시작하는 지점'.",
      "body 는 2~3문장.",
      "변곡점이 없으면 lead 하나로 끝낸다 — 없는 변화를 만들지 마라. 흐름이 크게 꺾이지 않고 비슷한 방향이 길게 이어진다는 것도 유효한 결과다.",
      COMMON_RULE,
    ].join("\n"),
    example:
      '{"lead":"이 해에는 흐름의 방향이 크게 달라지는 지점이 두 번 있어요.","pivots":[{"monthIndex":3,"title":"안에서 밖으로 움직이기 시작하는 지점","body":"앞선 시기까지 생각과 준비에 머물던 힘이 실제 행동과 사람 쪽으로 옮겨가기 시작해요. 여기서부터는 완성도를 높이는 것보다 일단 내보이는 쪽이 흐름과 맞아요."},{"monthIndex":10,"title":"늘리기보다 남길 것을 고르는 지점","body":"계속 넓혀가던 흐름이 한 차례 꺾이면서 무엇을 유지하고 무엇을 내려놓을지가 중요해져요. 앞선 시기가 벌이는 때였다면 여기서는 추리는 쪽으로 무게가 옮겨가요."}]}',
  },

  closing: {
    version: 1,
    schema: closing,
    prompt: [
      "09 이 해의 포인트. 앞의 내용을 요약하지 말고, 이 흐름에서 가져갈 태도와 행동 3가지를 준다.",
      "각 item 의 body 에 실제로 해볼 수 있는 것 하나를 포함한다.",
      "closing 은 '가장 기억할 한 가지' 다 — 한 문장으로 끝낸다.",
      COMMON_RULE,
    ].join("\n"),
    example:
      '{"lead":"이 해를 지나는 동안 무엇을 하지 않을지 정하는 것이 중요해요.","items":[{"title":"모든 기회를 잡으려고 하지 않기","body":"밖에서 들어오는 일이 많아질수록 무엇을 하지 않을지 정하는 것이 더 중요해져요. 이번 주에 들어온 요청 하나를 골라 정중히 미뤄보세요."},{"title":"도움을 받는 것도 하나의 선택으로 보기","body":"혼자 끝내는 것이 더 빠르게 느껴져도, 나눌 수 있는 일을 하나 정해 넘겨보세요. 넘긴 만큼 남는 힘이 더 중요한 데 쓰여요."},{"title":"생각보다 작은 단위로 먼저 움직여보기","body":"크게 마음먹을수록 시작이 늦어지기 쉬워요. 지금 하려는 일에서 한 시간 안에 끝나는 조각을 하나 떼어내 먼저 해보세요."}],"closing":"더 많이 하는 것보다 무엇을 계속할지 고르는 것이 중요한 해예요."}',
  },
} as const satisfies Record<string, FlowSectionSpec>;
```

> ⚠️ zod v4 에서 `z.toJSONSchema(z.array(z.never()).length(0))` 가 통과하는지 확인할 것.
> 터지면 `z.tuple([])` 이나 `z.array(z.unknown()).length(0)` 로 바꾼다 — 요구는
> "길이 0 만 통과" 하나뿐이다. 테스트가 판정한다.

> ⚠️ **변곡점 1개인 해를 반드시 테스트한다.** `z.union` 이 최소 2개를 요구해서,
> 이 경우를 안 다루면 그 해의 08 이 통째로 생성되지 않는다. 아래 테스트에
> `{ pivotMonths: [7] }` 케이스가 들어 있다.

- [ ] **Step 4: `derive.ts` 를 고친다**

```ts
import { z } from "zod";
import {
  FLOW_SECTIONS,
  type ClosingContent,
  type FlowSchemaContext,
  type FlowSectionSpec,
  type ItemsContent,
  type MonthsContent,
  type OverviewContent,
  type PivotsContent,
  type ProseContent,
} from "./registry";

export type FlowSectionKey = keyof typeof FLOW_SECTIONS;

/**
 * 섹션별 content 타입.
 *
 * schema 가 팩토리라 z.infer 로 뽑으면 컨텍스트에 따라 타입이 흔들린다. 모양은
 * 여섯 가지뿐이라 여기서 명시적으로 짝지어 준다 — 읽는 쪽이 훨씬 분명하다.
 */
export type FlowInterpretation = {
  overview: OverviewContent;
  rising: ItemsContent;
  straining: ItemsContent;
  work: ProseContent;
  relating: ProseContent;
  money: ProseContent;
  months: MonthsContent;
  pivots: PivotsContent;
  closing: ClosingContent;
};

export const FLOW_SECTION_KEYS = Object.keys(FLOW_SECTIONS) as FlowSectionKey[];

const spec = (key: FlowSectionKey): FlowSectionSpec => FLOW_SECTIONS[key] as FlowSectionSpec;

/** DB 에서 읽은 section_key 를 좁힌다 (모르는 키 = 지워진 섹션). */
export function isFlowSectionKey(v: unknown): v is FlowSectionKey {
  return typeof v === "string" && Object.hasOwn(FLOW_SECTIONS, v);
}

export function flowSectionVersion(key: FlowSectionKey): number {
  return spec(key).version;
}

/**
 * LLM tool 의 input_schema. 최상위가 객체여야 하는데 배열인 섹션이 있을 수 있어
 * 전부 { content: ... } 한 겹으로 감싼다 — 리포트·궁합과 같은 계약이다.
 *
 * 컨텍스트를 받는 것이 리포트·궁합과 다른 점이다. 08 의 정의역이 스키마 안에
 * 박히므로 LLM 이 계산되지 않은 달을 변곡점이라고 우길 수 없다.
 */
export function flowLlmInputSchema(
  key: FlowSectionKey,
  ctx: FlowSchemaContext,
): Record<string, unknown> {
  const content = z.toJSONSchema(spec(key).schema(ctx)) as Record<string, unknown>;
  delete content.$schema;
  return {
    type: "object",
    properties: { content },
    required: ["content"],
    additionalProperties: false,
  };
}

/** 검증 통과하면 content, 아니면 null. 호출자는 null 을 "없는 섹션" 으로 다룬다. */
export function parseFlowSectionContent<K extends FlowSectionKey>(
  key: K,
  raw: unknown,
  ctx: FlowSchemaContext,
): FlowInterpretation[K] | null {
  const result = spec(key).schema(ctx).safeParse(raw);
  return result.success ? (result.data as FlowInterpretation[K]) : null;
}

/**
 * `target[key] = value` 를 대신한다. 이유는 saju sections/derive.ts 의 assign 과 같다
 * (microsoft/TypeScript#30581). 단순 대입으로 바꾸지 말 것.
 */
export function assignFlow<T, K extends keyof T>(
  target: Partial<T>,
  key: K,
  value: T[K],
): void {
  target[key] = value;
}
```

- [ ] **Step 5: 테스트를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/sections/`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/flows/_lib/sections/
git commit -m "feat(flow): 섹션을 9종 새 구조로 다시 짠다

'지금' 을 전제한 이름(지금 살아나는 것 등)이 과거·미래 조회에서 거짓말이
되므로 전부 갈아엎는다. 07 은 12개월 전부, 08 은 계산된 변곡점만 받는다.

08 의 정의역을 계산 결과로 좁힌다 — LLM 이 변곡점이 아닌 달을 변곡점이라고
우길 방법이 없다. 변곡점 0개는 length(0) 이라 '변곡점 없음도 유효한 결과'
가 문장이 아니라 타입이 된다.

02·03·09 의 항목 수를 '3개 정도' 가 아니라 정확히 3개로 굳힌다. 개수를
프롬프트로 부탁하면 안 지켜지는 날이 오고 화면이 그때 2개짜리 목록을 받는다."
```

---

## Task 8: 사실 블록 — `FlowContext`

**Files:**
- Rewrite: `src/app/api/flows/_lib/prompt/facts.ts`
- Test: `src/app/api/flows/_lib/prompt/facts.test.ts`

**Interfaces:**
- Consumes: Task 3 의 `monthScores`/`currentDaeun`, Task 4 의 `FlowMonth`, `chartFacts(analysis, label?)`
- Produces:
  - `interface YearFacts { sewunKorean; daeunKorean; daeunPhase; daeunSwitch; support; friction; tenGods }`
  - `interface MonthFacts { index; support; friction; tenGods; tenGodsChanged; interactions: string[]; samhap; vsPrev; pivot }`
  - `interface FlowContext { analysis; flowYear; year: YearFacts; months: MonthFacts[]; pivotMonths: number[] }`
  - `buildFlowContext(analysis: SajuAnalysis, flowYear: number, months: FlowMonth[]): FlowContext`
  - `flowFacts(ctx: FlowContext): string`

여기서 **앞선 설계의 F1 을 고친다.** 지금 `flowFacts` 는 `chartFacts` 출력에서 숫자가 든 줄을 정규식으로 걸러내는데, 그 필터가 네 줄을 날린다 — 오행 분포·십성 분포·세력 점수·**신강약**. LLM 이 신강인지 신약인지 모른 채 팔리는 리포트를 전부 쓰고 있다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/prompt/facts.test.ts` 를 통째로 교체:

```ts
import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { flowMonths } from "../pivots";
import { buildFlowContext, flowFacts } from "./facts";

const BIRTH = {
  year: 1993, month: 4, day: 12, hour: 9, minute: 20,
  gender: "male", calendar: "solar",
} as const;

function ctxOf(year = 2027) {
  const a = analyze(BIRTH);
  return buildFlowContext(a, year, flowMonths(a, year));
}

describe("buildFlowContext", () => {
  it("12개 달의 사실을 낸다", () => {
    expect(ctxOf().months).toHaveLength(12);
  });

  it("pivotMonths 는 months 의 pivot 플래그와 일치한다", () => {
    const ctx = ctxOf();
    expect(ctx.pivotMonths).toEqual(ctx.months.filter((m) => m.pivot).map((m) => m.index));
  });

  it("첫 달의 vsPrev 는 null 이다", () => {
    expect(ctxOf().months[0].vsPrev).toBeNull();
  });

  it("대운 위치는 초반·중반·후반 중 하나다", () => {
    expect(["초반", "중반", "후반"]).toContain(ctxOf().year.daeunPhase);
  });
});

describe("flowFacts", () => {
  it("신강약을 넘긴다 — 숫자 필터가 이 줄을 날리고 있었다", () => {
    // LLM 이 신강/신약을 모른 채 쓰면 02·03 이 전부 일반론이 된다
    expect(flowFacts(ctxOf())).toMatch(/신강|중화|신약/);
  });

  it("오행 분포와 십성 분포를 라벨로 넘긴다", () => {
    const text = flowFacts(ctxOf());
    expect(text).toContain("오행 분포:");
    expect(text).toContain("두드러지는 힘:");
  });

  it("연도와 달력 월 숫자를 넘기지 않는다", () => {
    // 프롬프트에 연도가 남으면 "시점을 지어내지 마라" 는 규칙보다 그 숫자가 이긴다
    const text = flowFacts(ctxOf());
    expect(text).not.toMatch(/\d{4}년/);
    expect(text).not.toMatch(/\d+월/);
  });

  it("달을 순번으로 가리킨다", () => {
    expect(flowFacts(ctxOf())).toContain("[1번째 달]");
    expect(flowFacts(ctxOf())).toContain("[12번째 달]");
  });

  it("변곡점인 달을 표시한다", () => {
    const ctx = ctxOf();
    const text = flowFacts(ctx);
    if (ctx.pivotMonths.length > 0) expect(text).toContain("변곡점: 예");
  });

  it("대운이 바뀌는 해면 전환을 별도 사실로 남긴다", () => {
    // 초·중·말 하나로 뭉개면 그 해의 가장 큰 배경 변화가 사실에서 사라진다
    const a = analyze(BIRTH);
    const years = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031];
    const withSwitch = years
      .map((y) => buildFlowContext(a, y, flowMonths(a, y)))
      .find((c) => c.year.daeunSwitch !== null);
    if (withSwitch) expect(flowFacts(withSwitch)).toContain("배경 전환:");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/prompt/facts.test.ts`
Expected: FAIL

- [ ] **Step 3: `facts.ts` 를 통째로 교체한다**

```ts
// 계산값 → LLM 이 읽을 [사실] 블록.
//
// ⚠️ 내부 계산값(점수·확률)을 숫자로 넘기지 않는다. support/friction 은 범주
// 라벨로, 십성은 그룹 이름으로 넘긴다. 궁합이 나이차를 "또래 | 터울 | 한 세대 차"
// 로 바꿔 넘긴 것과 같은 처리다.
//
// 달은 **순번**(1‥12)으로 넘긴다. 앞선 설계는 숫자가 든 줄을 통째로 걸러냈지만
// 그 필터가 신강약·오행 분포·십성 분포·세력 점수 네 줄을 함께 날렸다 — LLM 이
// 신강인지 신약인지 모른 채 쓰고 있었다. 금지 대상은 **지어낸 시점과 기간**이지
// 달의 순번이 아니다.
//
// 명리 용어를 여기 넣는 것은 리포트의 chartFacts 가 이미 하는 일이다. 기획서 §27 이
// 금지하는 것은 출력이지 입력이 아니다.

import {
  STEMS,
  daeunSwitchIn,
  flowYearOf,
  sewunPillars,
  type SajuAnalysis,
  type TenGodGroup,
} from "@/lib/saju-core";
import { currentDaeun, monthScores, type MonthScore } from "../month-scores";
import type { FlowMonth } from "../pivots";

export interface YearFacts {
  sewunKorean: string;
  daeunKorean: string;
  /** 이 해가 대운 10년의 어디쯤인가 */
  daeunPhase: "초반" | "중반" | "후반";
  /** 그 해에 대운이 바뀌면 전후 간지. 없으면 null */
  daeunSwitch: { before: string; after: string } | null;
  support: string;
  friction: string;
  tenGods: TenGodGroup[];
}

export interface MonthFacts {
  /** 1‥12 */
  index: number;
  support: string;
  friction: string;
  tenGods: TenGodGroup[];
  /** 앞 달과 세력이 달라졌으면 그 문구. 첫 달과 변화 없는 달은 null */
  tenGodsChanged: string | null;
  /** "일지와 충" 처럼 읽을 수 있게 편 관계 목록 */
  interactions: string[];
  samhap: boolean;
  /** 첫 달은 null */
  vsPrev: string | null;
  pivot: boolean;
}

export interface FlowContext {
  analysis: SajuAnalysis;
  flowYear: number;
  year: YearFacts;
  months: MonthFacts[];
  /** 변곡점인 달의 순번. 08 의 스키마 정의역이 된다 */
  pivotMonths: number[];
}

function supportLabel(v: number): string {
  if (v >= 0.6) return "크게 받쳐줌";
  if (v >= 0.2) return "받쳐줌";
  if (v > -0.2) return "중립";
  if (v > -0.6) return "눌림";
  return "크게 눌림";
}

function frictionLabel(v: number): string {
  if (v >= 0.3) return "크게 흔들림";
  if (v >= 0.1) return "흔들림";
  if (v > -0.1) return "잔잔함";
  return "묶임";
}

function deltaPhrase(prev: MonthScore, cur: MonthScore): string {
  const parts: string[] = [];
  const ds = cur.support - prev.support;
  const df = cur.friction - prev.friction;
  if (Math.abs(ds) >= 0.15) parts.push(ds > 0 ? "받쳐줌이 커짐" : "받쳐줌이 줄어듦");
  if (Math.abs(df) >= 0.15) parts.push(df > 0 ? "흔들림이 커짐" : "흔들림이 줄어듦");
  return parts.length > 0 ? parts.join(", ") : "성격은 비슷하되 무게중심이 옮겨감";
}

/** 오행·십성 분포를 숫자 대신 라벨로. 리포트의 chartFacts 와 달리 점수를 안 준다. */
function distributionLabel(count: number, total: number): string {
  if (count === 0) return "없음";
  const share = count / total;
  if (share >= 0.35) return "많음";
  if (share <= 0.1) return "적음";
  return "보통";
}

/**
 * 대운 10년 안에서 이 해의 위치.
 *
 * daeunSwitch 와 **별도로** 유지한다 — 전환이 있는 해를 "중반" 하나로 뭉개면 그
 * 해의 가장 큰 배경 변화가 사실 블록에서 사라진다.
 */
function daeunPhaseOf(analysis: SajuAnalysis, flowYear: number): "초반" | "중반" | "후반" {
  const period = flowYearOf(flowYear);
  const daeun = currentDaeun(analysis, period);
  const idx = analysis.daeun.periods.indexOf(daeun);
  const start = analysis.daeun.startAgePrecise + Math.max(idx, 0) * 10;
  // 이 해 시작 시점의 정밀 나이
  const ageAtStart =
    (period.start.getTime() - birthMs(analysis)) / (365.25 * 24 * 3600_000);
  const elapsed = Math.min(Math.max(ageAtStart - start, 0), 9.999);
  if (elapsed < 4) return "초반";
  if (elapsed < 7) return "중반";
  return "후반";
}

function birthMs(analysis: SajuAnalysis): number {
  // switch.ts 의 birthInstant 와 같은 값을 쓴다 — 두 곳이 다른 기준으로 나이를
  // 재면 대운 위치와 대운 회차가 어긋난다.
  return birthInstant(analysis).getTime();
}

export function buildFlowContext(
  analysis: SajuAnalysis,
  flowYear: number,
  months: FlowMonth[],
): FlowContext {
  const scores = monthScores(analysis, flowYear);
  const period = flowYearOf(flowYear);
  const sw = daeunSwitchIn(analysis, period);
  const daeun = sw?.before ?? currentDaeun(analysis, period);

  const pivotOf = new Map(months.map((m) => [m.index, m.pivot]));

  const monthFacts: MonthFacts[] = scores.map((cur, i) => {
    const prev = i === 0 ? null : scores[i - 1];
    const changed =
      prev && prev.tenGods.join("·") !== cur.tenGods.join("·")
        ? `앞달의 ${prev.tenGods.join("·")}에서 바뀜`
        : null;

    return {
      index: cur.index,
      support: supportLabel(cur.support),
      friction: frictionLabel(cur.friction),
      tenGods: cur.tenGods,
      tenGodsChanged: changed,
      interactions: cur.interactions.map((r) => `${r.target}와 ${r.kind}`),
      samhap: cur.samhap,
      vsPrev: prev ? deltaPhrase(prev, cur) : null,
      pivot: pivotOf.get(cur.index) ?? false,
    };
  });

  const mean = (pick: (s: MonthScore) => number) =>
    scores.reduce((a, s) => a + pick(s), 0) / scores.length;

  const yearGroups = new Set<TenGodGroup>();
  for (const s of scores) for (const g of s.tenGods) yearGroups.add(g);

  return {
    analysis,
    flowYear,
    year: {
      sewunKorean: sewunPillars(flowYear, 1)[0].korean,
      daeunKorean: daeun.pillar,
      daeunPhase: daeunPhaseOf(analysis, flowYear),
      daeunSwitch: sw ? { before: sw.before.pillar, after: sw.after.pillar } : null,
      support: supportLabel(mean((s) => s.support)),
      friction: frictionLabel(mean((s) => s.friction)),
      tenGods: [...yearGroups],
    },
    months: monthFacts,
    pivotMonths: monthFacts.filter((m) => m.pivot).map((m) => m.index),
  };
}

export function flowFacts(ctx: FlowContext): string {
  const { analysis, year } = ctx;
  const dm = STEMS[analysis.chart.dayMaster];
  const el = analysis.elements;
  const elTotal = Object.values(el.counts).reduce((a, b) => a + b, 0) || 1;

  const lines: string[] = [
    "[연간]",
    `일간: ${analysis.chart.dayMaster} (${dm.element}·${dm.yinYang})`,
    `성별: ${analysis.chart.gender === "male" ? "남성" : "여성"}`,
    // ⚠️ 이 줄이 F1 의 핵심이다. 앞선 구현은 숫자 필터가 이 줄을 통째로 날려
    // LLM 이 신강인지 신약인지 모른 채 모든 리포트를 썼다.
    `신강약: ${analysis.strength.level}`,
    `오행 분포: ${Object.entries(el.counts)
      .map(([k, v]) => `${k} ${distributionLabel(Number(v), elTotal)}`)
      .join(" · ")}`,
    `용신: ${analysis.yongsin.yongsin} · 희신: ${analysis.yongsin.huisin}`,
    `올해 간지: ${year.sewunKorean}`,
    `배경 간지: ${year.daeunKorean} (${year.daeunPhase})`,
  ];

  // 전환은 초·중·말과 별도 줄이다 — 뭉개면 그 해의 가장 큰 배경 변화가 사라진다.
  if (year.daeunSwitch) {
    lines.push(`배경 전환: ${year.daeunSwitch.before} → ${year.daeunSwitch.after}`);
  }

  lines.push(
    `받쳐줌: ${year.support}`,
    `흔들림: ${year.friction}`,
    `두드러지는 힘: ${year.tenGods.join(" · ")}`,
  );

  for (const m of ctx.months) {
    lines.push(
      "",
      `[${m.index}번째 달]`,
      `받쳐줌: ${m.support} · 흔들림: ${m.friction}`,
      `두드러지는 힘: ${m.tenGods.join(" · ")}${m.tenGodsChanged ? ` (${m.tenGodsChanged})` : ""}`,
    );
    if (m.interactions.length > 0) lines.push(`작용: ${m.interactions.join(" · ")}`);
    if (m.samhap) lines.push("결속: 새로 완성됨");
    // 이 줄이 §36 의 핵심이다. 없으면 LLM 이 각 달을 독립적으로 소개해서
    // "무엇이 달라지는가" 가 아니라 "각 달이 어떤가" 가 된다.
    if (m.vsPrev) lines.push(`앞달 대비: ${m.vsPrev}`);
    if (m.pivot) lines.push("변곡점: 예");
  }

  return lines.join("\n");
}
```

파일 상단 import 에 `birthInstant` 를 더한다:

```ts
import { birthInstant } from "@/lib/saju-core/flow/switch";
```

> ⚠️ `analysis.strength.level` 과 `analysis.elements.counts` 의 실제 필드명을
> `src/lib/saju-core/analyze.ts` 와 `src/app/api/saju/_lib/prompt/facts.ts` 에서
> 확인해 맞출 것. `chartFacts` 가 그 값을 어떻게 읽는지 보면 정확한 경로가 나온다.
> **`chartFacts` 를 재사용하지 않는다** — 그쪽은 리포트용이라 점수와 나이가 섞여 있고,
> 걸러내려다 필요한 줄까지 날린 것이 F1 이다.

- [ ] **Step 4: 테스트를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/prompt/facts.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/flows/_lib/prompt/facts.ts src/app/api/flows/_lib/prompt/facts.test.ts
git commit -m "fix(flow): LLM 에 신강약을 넘기고 월별 재료를 싣는다

숫자가 든 줄을 정규식으로 걸러내던 것이 신강약·오행 분포·십성 분포·세력
점수 네 줄을 함께 날렸다. LLM 이 신강인지 신약인지 모른 채 모든 리포트를
쓰고 있었다. 필터 대신 신강약은 단계 어휘로, 분포는 라벨로 넘긴다.

달은 순번으로 가리킨다 — 금지 대상은 지어낸 시점이지 달의 번호가 아니다.
달마다 관계·세력 변화·앞달 대비를 함께 실어 12개 제목이 반복되지 않게 한다.

대운 전환은 초·중·말과 별도 줄로 남긴다. 뭉개면 그 해의 가장 큰 배경
변화가 사실 블록에서 사라진다."
```

---

## Task 9: 시스템 프롬프트와 요청 조립

**Files:**
- Modify: `src/app/api/flows/_lib/prompt/system.ts`
- Modify: `src/app/api/flows/_lib/prompt/index.ts`
- Test: `src/app/api/flows/_lib/prompt/index.test.ts`

**Interfaces:**
- Consumes: Task 7 의 `flowLlmInputSchema`, Task 8 의 `flowFacts`/`FlowContext`
- Produces: `buildFlowSectionRequest(ctx: FlowContext, key: FlowSectionKey): FlowSectionRequest`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/prompt/index.test.ts` 를 통째로 교체:

```ts
import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/saju-core";
import { flowMonths } from "../pivots";
import { buildFlowContext } from "./facts";
import { buildFlowSectionRequest, FLOW_SYSTEM_PROMPT } from "./index";

const BIRTH = {
  year: 1993, month: 4, day: 12, hour: 9, minute: 20,
  gender: "male", calendar: "solar",
} as const;

function ctxOf(year = 2027) {
  const a = analyze(BIRTH);
  return buildFlowContext(a, year, flowMonths(a, year));
}

describe("FLOW_SYSTEM_PROMPT", () => {
  it("시제 중립을 요구한다", () => {
    expect(FLOW_SYSTEM_PROMPT).toContain("시제");
  });

  it("구간 이야기를 더 이상 하지 않는다", () => {
    // 구간이 사라졌는데 프롬프트에 남아 있으면 LLM 이 없는 구간을 지어낸다
    expect(FLOW_SYSTEM_PROMPT).not.toContain("구간 번호");
  });
});

describe("buildFlowSectionRequest", () => {
  it("사실 블록과 섹션 지시문을 함께 낸다", () => {
    const req = buildFlowSectionRequest(ctxOf(), "months");
    expect(req.user).toContain("[연간]");
    expect(req.user).toContain("[1번째 달]");
    expect(req.user).toContain("[요청 · months]");
  });

  it("08 의 스키마에 계산된 변곡점만 들어간다", () => {
    const ctx = ctxOf();
    const req = buildFlowSectionRequest(ctx, "pivots");
    const json = JSON.stringify(req.inputSchema);
    // 계산되지 않은 달이 정의역에 있으면 LLM 이 그 달을 쓸 수 있다
    for (let i = 1; i <= 12; i += 1) {
      if (ctx.pivotMonths.includes(i)) continue;
      expect(json).not.toContain(`"const":${i}`);
    }
  });

  it("모든 섹션이 요청을 만들 수 있다", () => {
    const ctx = ctxOf();
    for (const key of ["overview","rising","straining","work","relating","money","months","pivots","closing"] as const) {
      const req = buildFlowSectionRequest(ctx, key);
      expect(req.system.length, key).toBeGreaterThan(0);
      expect(req.inputSchema, key).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/prompt/index.test.ts`
Expected: FAIL

- [ ] **Step 3: `system.ts` 의 마지막 두 규칙을 고친다**

`FLOW_SYSTEM_PROMPT` 의 첫 항목과 마지막 항목을 아래로 바꾸고, 시제 항목을 더한다:

```ts
export const FLOW_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

## 시기 서술에 대한 규칙

- **타고난 성향 자체를 독립적으로 설명하지 마라.** 반드시 평소의 경향을 짧게 제시한 뒤, 이 해의 흐름으로 무엇이 강해지거나 약해지거나 다른 방식으로 나타나는지 설명하라. 각 항목에 이 대비를 최소 한 번 넣는다.
- 사건을 확정적으로 예언하지 마라. "반드시 일어납니다", "이때 돈을 법니다", "연인이 생깁니다", "취업합니다" 같은 문장을 쓰지 않는다. 대신 "~하기 쉬운 시기예요", "~가 두드러질 수 있어요" 처럼 경향으로 쓴다.
- 좋은 해 / 나쁜 해로 평가하지 마라. 점수·별점·등급을 매기지 마라. 같은 흐름에 기회와 부담이 함께 있다.
- 내부 수치를 노출하지 마라. "받쳐줌", "흔들림" 같은 [사실]의 라벨을 그대로 옮겨 쓰지 말고 생활의 말로 바꾼다.
- 신비주의 어휘를 쓰지 마라: 하늘의 기운, 우주의 흐름, 운명의 문, 대박운, 악운, 액운, 귀인이 나타난다, 횡재수, 천운.
- 명리 용어를 본문에 노출하지 마라: 세운, 대운, 월운, 원국, 간지, 십성, 오행, 용신, 희신, 기신, 비겁, 재성, 합, 충, 형, 파, 해 등. [사실] 블록의 용어는 재료일 뿐이다 — 경험으로 풀어 쓴다.
- 돈에 대해: 투자 종목 추천, 투자 시점 예측, 수익 보장, 부동산 매수·매도 지시, 큰돈이 들어온다는 단정, 복권·도박 관련 예측을 하지 마라.
- **연도, 월, 날짜를 임의로 만들지 마라.** [사실]의 달은 순번이고, 실제 시간 표시는 계산된 값이 화면에서 붙인다. 본문에서는 "이 시기", "앞선 달", "이어지는 흐름" 같은 상대 표현을 쓴다. ("두 가지를 함께", "한 번에" 같은 수량 표현은 괜찮다 — 금지 대상은 지어낸 시점과 기간이다.)
- **시제를 중립으로 쓴다.** 사용자는 지난 해도 올해도 다가올 해도 고를 수 있고, 다가올 해는 시간이 지나면 지난 해가 된다. 이 글은 그때도 그대로 읽힌다 — "~했어요", "~할 거예요" 대신 "~하기 쉬운 해예요", "~가 중요해지는 시기예요" 로 쓴다. 지난/올해/다가올 표시는 화면이 붙인다.
- **모든 달을 설명하되 모든 달이 특별하다고 말하지 마라.** 변화가 작은 달은 앞선 흐름이 이어진다고 솔직하게 쓴다. 이것이 일반적인 월별 운세와 갈리는 지점이다.`;
```

- [ ] **Step 4: `prompt/index.ts` 를 고친다**

```ts
// 섹션 하나에 대한 LLM 요청을 조립한다. 흐름 프롬프트를 만드는 유일한 자리다.

import { FLOW_SECTIONS, flowLlmInputSchema, type FlowSectionKey } from "../sections";
import { flowFacts, type FlowContext } from "./facts";
import { FLOW_SYSTEM_PROMPT, SECTION_TOOL_NAME } from "./system";

export {
  buildFlowContext,
  flowFacts,
  type FlowContext,
  type MonthFacts,
  type YearFacts,
} from "./facts";
export { FLOW_SYSTEM_PROMPT, SECTION_TOOL_NAME } from "./system";

export interface FlowSectionRequest {
  key: FlowSectionKey;
  system: string;
  user: string;
  toolName: string;
  inputSchema: Record<string, unknown>;
}

export function buildFlowSectionRequest(
  ctx: FlowContext,
  key: FlowSectionKey,
): FlowSectionRequest {
  const spec = FLOW_SECTIONS[key];

  const user = [
    flowFacts(ctx),
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
    system: FLOW_SYSTEM_PROMPT,
    user,
    toolName: SECTION_TOOL_NAME,
    // 08 의 정의역이 스키마에 박힌다 — LLM 이 계산되지 않은 달을 변곡점이라
    // 우길 수 없다. 07 은 언제나 12개다.
    inputSchema: flowLlmInputSchema(key, { pivotMonths: ctx.pivotMonths }),
  };
}
```

- [ ] **Step 5: 테스트를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/prompt/`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/flows/_lib/prompt/
git commit -m "feat(flow): 프롬프트에 시제 중립 규칙을 박는다

다가올 해로 산 리포트가 시간이 지나면 지난 해가 된다. 본문이 박제라
'~할 거예요' 로 쓰면 그때 거짓말이 된다. 지난/올해/다가올 표시는 화면 몫이다.

구간 이야기를 걷어내고, 모든 달을 설명하되 모든 달이 특별하다고 말하지
말라는 규칙을 더한다 — 일반적인 월별 운세와 갈리는 지점이다."
```

---

## Task 10: 저장·생성 배선

**Files:**
- Modify: `src/app/api/flows/_lib/store.ts`
- Modify: `src/app/api/flows/_lib/produce.ts`
- Test: `src/app/api/flows/_lib/store.test.ts`, `produce.test.ts`

**Interfaces:**
- Consumes: Task 7 의 `FlowSchemaContext`/`parseFlowSectionContent`
- Produces:
  - `decodeFlowSections(rows, keys, ctx: FlowSchemaContext): StoredFlowSections`
  - `getFlowSections(flowId, keys, ctx, client?)`
  - `putFlowSections(flowId, interpretation, model, client?)` — 그대로
  - `produceFlowSections(flowId, ctx: FlowContext, deps)` — `deps.getStored(flowId, keys)` 시그니처 유지

`n: number` 를 받던 자리가 전부 `ctx: FlowSchemaContext` 로 바뀐다. `FlowSectionWrite` 는 죽은 export 라 지운다(F6).

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/store.test.ts` 의 `decodeFlowSections` 호출에서 `n` 자리를 `{ pivotMonths: [...] }` 로 바꾸고, 아래를 더한다:

```ts
describe("decodeFlowSections — 손상 판정", () => {
  const CTX = { pivotMonths: [3, 7] };

  const row = (content: unknown) => ({
    section_key: "pivots",
    schema_version: 1,
    content: JSON.stringify(content),
  });

  it("저장된 변곡점이 계산과 어긋나면 없는 섹션으로 본다", () => {
    // months 는 박제라 정상적으로는 달라질 수 없다 — 어긋나면 손상이다.
    // 조용히 통과시키면 08 이 07 과 다른 달을 가리킨다.
    const bad = row({
      lead: "l",
      pivots: [{ monthIndex: 5, title: "t", body: "b" }],
    });
    const out = decodeFlowSections([bad], ["pivots"], CTX);
    expect(out.missing).toContain("pivots");
  });

  it("일치하면 그대로 쓴다 — 헛되이 재생성하지 않는다", () => {
    const good = row({
      lead: "l",
      pivots: [
        { monthIndex: 3, title: "t", body: "b" },
        { monthIndex: 7, title: "t", body: "b" },
      ],
    });
    const out = decodeFlowSections([good], ["pivots"], CTX);
    expect(out.missing).not.toContain("pivots");
  });
});
```

`produce.test.ts` 에서 `ctx.segments.length` 를 쓰던 자리를 `ctx.pivotMonths` 로 바꾼다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/store.test.ts src/app/api/flows/_lib/produce.test.ts`
Expected: FAIL

- [ ] **Step 3: `store.ts` 를 고친다**

`FlowSectionWrite` 인터페이스를 지우고, `n: number` 를 받는 두 함수를 고친다:

```ts
import type { FlowSchemaContext } from "./sections";

/**
 * 행 배열을 have/missing 으로 가른다.
 *
 * 버리는 경우가 궁합보다 하나 많다 — **변곡점 불일치**. flows.months 는 박제라
 * 정상적으로는 바뀌지 않으므로, 저장된 08 이 다른 달을 가리킨다면 그것은 손상이다.
 * 조용히 통과시키면 07 과 08 이 서로 다른 달을 말한다.
 *
 * 다시 만드는 비용이 지갑에 닿지 않는다는 점도 근거다 — entitlements 행이 남아
 * 있어 spendTicket 이 kind:"already" 로 돌아온다.
 */
export function decodeFlowSections(
  rows: Record<string, unknown>[],
  keys: FlowSectionKey[],
  ctx: FlowSchemaContext,
): StoredFlowSections {
  const wanted = new Set<string>(keys);
  const have: Partial<FlowInterpretation> = {};

  for (const row of rows) {
    const key = row.section_key;
    if (!isFlowSectionKey(key) || !wanted.has(key)) continue;
    if (row.schema_version !== flowSectionVersion(key)) continue;
    const content = parseFlowSectionContent(key, parseJsonbContent(row.content), ctx);
    if (content === null) continue;
    assignFlow(have, key, content);
  }

  return { have, missing: keys.filter((k) => !(k in have)) };
}

export async function getFlowSections(
  flowId: string,
  keys: FlowSectionKey[],
  ctx: FlowSchemaContext,
  client: SqlClient = sql,
): Promise<StoredFlowSections> {
  if (keys.length === 0) return { have: {}, missing: [] };
  const rows = await client`
    SELECT section_key, content, schema_version
      FROM flow_sections
     WHERE flow_id = ${flowId}::bigint AND section_key = ANY(${keys}::text[])
  `;
  return decodeFlowSections(rows, keys, ctx);
}
```

- [ ] **Step 4: `produce.ts` 를 고친다**

`produceFlowSections` 안의 `const n = ctx.segments.length;` 를 지우고, 검증 자리를 고친다:

```ts
export async function produceFlowSections(
  flowId: string,
  ctx: FlowContext,
  deps: ProduceFlowDeps,
): Promise<{ interpretation: Partial<FlowInterpretation>; stored: boolean }> {
  // 스키마 컨텍스트의 유일한 출처다 — getStored 도 아래 검증도 이 값을 쓴다.
  // 저장된 08 의 변곡점이 다르면 missing 으로 잡혀 다시 생성된다.
  const schemaCtx = { pivotMonths: ctx.pivotMonths };
  const { have, missing } = await deps.getStored(flowId, deps.sectionKeys);
  if (missing.length === 0) return { interpretation: have, stored: true };

  let generated: Partial<FlowInterpretation>;
  try {
    generated = await deps.generator.generateSections(ctx, missing);
  } catch (e) {
    throw new FlowGenerationError(e, have);
  }

  // 생성기가 준 값은 무엇이든 여기서 한 번 걸러야 한다. 이 결과가 화면과 저장
  // 양쪽에 그대로 쓰이므로, 한쪽에서만 검증하면 다른 쪽은 새는 채로 남는다.
  const clean: Partial<FlowInterpretation> = {};
  for (const [key, raw] of Object.entries(generated)) {
    if (!isFlowSectionKey(key)) continue;
    const content = parseFlowSectionContent(key, raw, schemaCtx);
    if (content === null) {
      console.warn(`[produceFlowSections] 스키마 검증 실패, 버림: ${key}`);
      continue;
    }
    assignFlow(clean, key, content);
  }

  await deps.putStored(flowId, clean, deps.generator.model);
  return { interpretation: { ...have, ...clean }, stored: false };
}
```

문서 주석의 "구간 수는 ctx.segments.length 하나가 유일한 출처다" 문단을 위 코드 주석에 맞춰 고친다.

- [ ] **Step 5: 테스트를 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/`
Expected: PASS

Run: `npx tsc --noEmit 2>&1 | grep "api/flows"`
Expected: `handler.ts` 만 남는다(Task 11).

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/flows/_lib/store.ts src/app/api/flows/_lib/produce.ts src/app/api/flows/_lib/store.test.ts src/app/api/flows/_lib/produce.test.ts
git commit -m "feat(flow): 저장·검증을 스키마 컨텍스트로 갈아탄다

구간 수 하나를 넘기던 자리가 변곡점 목록으로 바뀐다. 저장된 08 이 계산과
어긋나면 손상이므로 없는 섹션으로 보고 다시 만든다 — 조용히 통과시키면
07 과 08 이 서로 다른 달을 말한다. 재생성은 권한 행이 남아 지갑을 안 깎는다.

쓰이지 않는 FlowSectionWrite 를 지운다."
```

---

## Task 11: 핸들러 — 연도를 받는다

**Files:**
- Modify: `src/app/api/flows/_lib/handler.ts`
- Modify: `src/app/api/flows/route.ts`
- Test: `src/app/api/flows/_lib/handler.test.ts`

**Interfaces:**
- Consumes: Task 4 의 `flowMonths`, Task 6 의 `CreateFlowInput`, `flowYearOf`/`flowYearAt`
- Produces:
  - `FLOW_YEAR_SPAN = 5`
  - `flowYearRange(now: Date): { min: number; max: number }`
  - `handleCreateFlow(raw, deps)` — 입력이 `{ profileId: string; year: number }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/flows/_lib/handler.test.ts` 에 추가(기존 테스트의 입력에 `year` 를 더한다):

```ts
describe("handleCreateFlow — 연도", () => {
  const NOW = new Date("2026-06-15T00:00:00Z"); // 명리 2026년

  it("고른 해로 행을 만든다", async () => {
    const captured: unknown[] = [];
    const res = await handleCreateFlow(
      { profileId: "3", year: 2029 },
      deps({ now: NOW, findOrCreate: async (_u, input) => { captured.push(input); return { id: "9", created: true }; } }),
    );
    expect(res.status).toBe(201);
    expect((captured[0] as { flowYear: number }).flowYear).toBe(2029);
  });

  it("과거 해도 만든다 — 복기가 이 서비스의 절반이다", async () => {
    const res = await handleCreateFlow({ profileId: "3", year: 2021 }, deps({ now: NOW }));
    expect(res.status).toBeLessThan(400);
  });

  it("범위 밖 연도는 400 이다", async () => {
    for (const year of [2020, 2032]) {
      const res = await handleCreateFlow({ profileId: "3", year }, deps({ now: NOW }));
      expect(res.status, String(year)).toBe(400);
    }
  });

  it("연도가 없으면 400 이다 — 지금으로 조용히 물러서지 않는다", async () => {
    // 물러서면 사용자가 2029 를 골랐는데 2026 을 사는 일이 생긴다
    const res = await handleCreateFlow({ profileId: "3" }, deps({ now: NOW }));
    expect(res.status).toBe(400);
  });

  it("period 는 고른 해의 입춘 경계다", async () => {
    const captured: { periodStart: Date; periodEnd: Date }[] = [];
    await handleCreateFlow(
      { profileId: "3", year: 2029 },
      deps({ now: NOW, findOrCreate: async (_u, i) => { captured.push(i); return { id: "9", created: true }; } }),
    );
    expect(captured[0].periodStart.getUTCFullYear()).toBe(2029);
    expect(captured[0].periodEnd.getUTCFullYear()).toBe(2030);
  });

  it("months 12개를 박제한다", async () => {
    const captured: { months: unknown[] }[] = [];
    await handleCreateFlow(
      { profileId: "3", year: 2027 },
      deps({ now: NOW, findOrCreate: async (_u, i) => { captured.push(i); return { id: "9", created: true }; } }),
    );
    expect(captured[0].months).toHaveLength(12);
  });
});
```

> `deps(...)` 헬퍼는 기존 `handler.test.ts` 의 것을 그대로 쓴다. 없으면 기존 테스트가 만드는 deps 객체 모양을 따라 헬퍼를 하나 만든다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/app/api/flows/_lib/handler.test.ts`
Expected: FAIL

- [ ] **Step 3: `handler.ts` 를 고친다**

```ts
import { z } from "zod";
import { analyze, flowYearAt, flowYearOf, type SajuAnalysis } from "@/lib/saju-core";
import type { FlowAccess } from "@/lib/flows/access";
import type { CreateFlowInput } from "@/lib/flows/store";
import { flowMonths } from "./pivots";

/** 현재 명리 연도에서 앞뒤로 몇 년까지 고를 수 있는가. 화면의 연도 칸 수와 같은 출처다. */
export const FLOW_YEAR_SPAN = 5;

/**
 * 고를 수 있는 연도의 경계.
 *
 * 서버가 다시 재는 이유는 화면을 못 믿어서가 아니라, 화면을 거치지 않는 요청이
 * 있기 때문이다 — 범위 밖 연도는 절기 계산의 검증 범위 밖이기도 하다.
 */
export function flowYearRange(now: Date): { min: number; max: number } {
  const current = flowYearAt(now).year;
  return { min: current - FLOW_YEAR_SPAN, max: current + FLOW_YEAR_SPAN };
}

const Input = z
  .object({
    profileId: z.string().min(1),
    // 기본값을 두지 않는다 — 지금으로 조용히 물러서면 사용자가 고른 해와 사는
    // 해가 갈린다. 이용권이 걸린 요청에서 가장 나쁜 실패다.
    year: z.number().int(),
  })
  .strict();

/** getProfile 이 돌려주는 것 중 이 핸들러가 실제로 읽는 필드만. */
export interface FlowProfile {
  id: string;
  birth: Parameters<typeof analyze>[0];
}

export interface CreateFlowDeps {
  userId: string | null;
  /** 현재 시각을 주입한다 — 서버 시계를 읽으면 연도 범위를 테스트로 못 박을 수 없다 */
  now: Date;
  checkAccess(userId: string | null): Promise<FlowAccess>;
  /** ⚠️ userId 를 함께 넘긴다. 남의 프로필로 흐름을 만들지 못하게 하는 유일한 방어선이다 */
  getProfile(userId: string, id: string): Promise<FlowProfile | null>;
  findOrCreate(
    userId: string,
    input: CreateFlowInput,
  ): Promise<{ id: string; created: boolean }>;
}

const STATUS: Record<Exclude<FlowAccess, { ok: true }>["reason"], number> = {
  unauthenticated: 401,
  rate_limited: 429,
  insufficient_tickets: 402,
};

export async function handleCreateFlow(
  raw: unknown,
  deps: CreateFlowDeps,
): Promise<{ status: number; body: unknown }> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "요청 형식이 올바르지 않습니다" } };

  const { min, max } = flowYearRange(deps.now);
  const year = parsed.data.year;
  if (year < min || year > max) {
    return { status: 400, body: { error: "선택할 수 없는 연도입니다" } };
  }

  const access = await deps.checkAccess(deps.userId);
  if (!access.ok) {
    return { status: STATUS[access.reason], body: { error: access.reason } };
  }

  // access.ok 가 true 면 userId 는 반드시 있다 — canCreateFlow 가 null 을 먼저 막는다.
  const userId = deps.userId!;

  const profile = await deps.getProfile(userId, parsed.data.profileId);
  if (!profile) return { status: 404, body: { error: "프로필을 찾을 수 없습니다" } };

  // 태어나기 전 해에는 대운이 없다. 화면도 그 칸을 빼지만 화면을 안 거치는
  // 요청이 있어 여기서도 막는다.
  if (year < profile.birth.year) {
    return { status: 400, body: { error: "선택할 수 없는 연도입니다" } };
  }

  const analysis: SajuAnalysis = analyze(profile.birth);
  const period = flowYearOf(year);
  // 12개월과 기간을 여기서 확정해 행에 박제한다. 임계값을 나중에 튜닝해도 이미
  // 판 흐름의 변곡점은 소급해서 바뀌지 않는다.
  const months = flowMonths(analysis, year);

  const { id, created } = await deps.findOrCreate(userId, {
    profileId: profile.id,
    flowYear: year,
    periodStart: period.start,
    periodEnd: period.end,
    months,
  });

  return { status: created ? 201 : 200, body: { id } };
}
```

`route.ts` 는 고칠 것이 없다 — `handleCreateFlow` 의 시그니처가 그대로다. 주석 하나만 확인한다.

- [ ] **Step 4: 테스트와 타입을 확인한다**

Run: `npx vitest run src/app/api/flows/`
Expected: PASS

Run: `npx tsc --noEmit 2>&1 | grep "api/flows"`
Expected: 없음

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/flows/
git commit -m "feat(flow): 흐름 생성이 사용자가 고른 연도를 받는다

year 에 기본값을 두지 않는다 — 지금으로 조용히 물러서면 사용자가 2029 를
골랐는데 2026 을 사는 일이 생긴다. 이용권이 걸린 요청에서 가장 나쁜 실패다.

범위를 서버가 다시 잰다. 화면을 못 믿어서가 아니라 화면을 안 거치는 요청이
있고, 범위 밖은 절기 계산의 검증 범위 밖이기도 하다. 태어나기 전 해도 막는다."
```

---

## Task 12: `/flow` 선택 화면

> ### ⚠️ 이 태스크의 코드 블록은 낡았다 — 아래 네 가지를 먼저 읽을 것
>
> 계획을 쓸 때 읽은 파일들이 그 뒤로 바뀌었다. 아래가 우선한다.
>
> **1. `ProfileRow` 에는 `birthYear` 가 없다.** 실제 모양은
> `birth: { year, month, day }` · `timeKnown: boolean` · `time: { hour, minute } | null` ·
> `gender` · `kind` 다. `src/lib/profiles/store.ts` 를 볼 것.
>
> **2. 프로필 요약을 손으로 만들지 마라.** `@/lib/profiles/option` 의
> `toPersonOption(row): PersonOption` 이 `{ id, name, initial, birthLabel, saved }` 를 준다.
> `birthLabel` 은 `"1990.04.05 · 07:20"` 또는 `"1990.04.05 · 시간 모름"` 이다.
> 계획의 `describeProfile` 과 `ProfileOption` 은 버린다.
>
> **3. 드롭다운을 새로 만들지 마라.** `src/app/consult/_components/SubjectSelect.tsx` 가
> 이미 같은 드롭다운을 갖고 있다 — 바깥 클릭 닫기, Escape, `aria-expanded`/`aria-controls`,
> 아바타, "새 프로필 추가" 까지. 아래 `FlowConfirm` 의 손수 만든 드롭다운은 그것을 더
> 나쁘게 복제한 것이다.
>
> 프레젠테이션 부분을 공용 컴포넌트로 뽑아 `SubjectSelect` 는 URL 이동을,
> `FlowConfirm` 은 로컬 상태를 `onPick` 으로 넘기게 한다. **`SubjectSelect` 의 동작은
> 한 톨도 바뀌면 안 된다** — 방금 나간 화면이다.
>
> **4. 출생 연도 필터는 달력 연도가 아니라 명리 연도다.** Task 11 이 서버에서 같은
> 버그를 고쳤다: 입춘(2월 4일경) 전에 태어난 사람은 명리 출생 연도가 달력 연도보다
> 하나 작다. 화면이 달력 연도로 칸을 거르면 서버가 허용하는 해를 화면이 감춘다.
>
> 서버는 이렇게 잰다:
> ```ts
> const birthYear = flowYearAt(birthInstant(analyze(birth))).year;
> ```
> **화면과 서버가 갈리지 않도록 이 계산을 한 곳으로 모아라.** 작은 헬퍼 하나를 만들어
> `handler.ts` 와 화면이 같이 쓰게 하는 것을 권한다 — 두 벌로 두면 언젠가 갈린다.
> 헬퍼를 만들면 `handler.ts` 의 동작은 그대로여야 하고, 기존 테스트가 그걸 지킨다.
>
> 아래 `buildYearOptions` 의 `birthYear` 인자는 **명리 출생 연도**를 받는 것으로 읽어라.


**Files:**
- Rewrite: `src/app/flow/_lib/to-confirm.ts`
- Modify: `src/app/flow/_lib/to-start-outcome.ts` (문구만)
- Rewrite: `src/app/flow/_components/FlowConfirm.tsx`
- Rewrite: `src/app/flow/page.tsx`
- Test: `src/app/flow/_lib/to-confirm.test.ts`, `to-start-outcome.test.ts`

**Interfaces:**
- Consumes: Task 6 의 `listFlowYears`/`listEntitledSubjects`, Task 11 의 `FLOW_YEAR_SPAN`, `flowYearAt`/`flowYearOf`
- Produces:
  - `interface YearOption { year: number; age: number; tag: "지난" | "올해" | "다가올"; owned: boolean; flowId: string | null }`
  - `buildYearOptions(input): YearOption[]`
  - `type SelectState = { kind: "no_profile" } | { kind: "ready"; profiles: ProfileOption[]; ... }`
  - `formatPeriod(start, end): string` — 그대로

시안 `Saju Yearly Report.dc.html` 을 따른다. 한 화면에서 프로필과 연도를 모두 고른다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/flow/_lib/to-confirm.test.ts` 를 통째로 교체:

```ts
import { describe, expect, it } from "vitest";
import { buildYearOptions, formatPeriod } from "./to-confirm";

const NOW_YEAR = 2026;

function opts(over: Partial<Parameters<typeof buildYearOptions>[0]> = {}) {
  return buildYearOptions({
    currentYear: NOW_YEAR,
    span: 5,
    birthYear: 1993,
    owned: new Map(),
    ...over,
  });
}

describe("buildYearOptions", () => {
  it("현재 ±5년, 11칸을 낸다", () => {
    const years = opts().map((o) => o.year);
    expect(years).toEqual([2021,2022,2023,2024,2025,2026,2027,2028,2029,2030,2031]);
  });

  it("태어나기 전 해는 빼고 낸다", () => {
    // 만 나이가 음수가 되고, 그 해의 대운이 없다
    const years = opts({ birthYear: 2024 }).map((o) => o.year);
    expect(years).toEqual([2024,2025,2026,2027,2028,2029,2030,2031]);
  });

  it("만 나이를 붙인다", () => {
    expect(opts().find((o) => o.year === 2026)?.age).toBe(33);
  });

  it("지난·올해·다가올을 표시한다", () => {
    const byYear = new Map(opts().map((o) => [o.year, o.tag]));
    expect(byYear.get(2025)).toBe("지난");
    expect(byYear.get(2026)).toBe("올해");
    expect(byYear.get(2027)).toBe("다가올");
  });

  it("권한이 있는 해만 owned 다 — 행 존재가 아니다", () => {
    // 행은 공짜로 만들어지고 차감은 생성 자리에서 일어난다. 생성이 한도나
    // 잔액에서 막히면 행만 남고 권한은 없다.
    const owned = new Map([
      [2025, { flowId: "7", entitled: true }],
      [2026, { flowId: "8", entitled: false }],
    ]);
    const byYear = new Map(opts({ owned }).map((o) => [o.year, o]));
    expect(byYear.get(2025)?.owned).toBe(true);
    expect(byYear.get(2026)?.owned).toBe(false);
    // 행이 있으면 flowId 는 준다 — 재구매 시 같은 행으로 수렴한다
    expect(byYear.get(2026)?.flowId).toBe("8");
    expect(byYear.get(2027)?.flowId).toBeNull();
  });
});

describe("formatPeriod", () => {
  it("연도를 감추지 않는다", () => {
    const s = formatPeriod(new Date("2027-02-04T09:00:00Z"), new Date("2028-02-04T15:00:00Z"));
    expect(s).toBe("2027년 2월 초부터 2028년 2월 초까지");
  });
});
```

`to-start-outcome.test.ts` 에서 `"지금의 흐름"` 을 기대하는 단언을 `"한 해의 흐름"` 으로 바꾼다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/app/flow/_lib/`
Expected: FAIL

- [ ] **Step 3: `to-confirm.ts` 를 통째로 교체한다**

```ts
// 선택 화면의 상태. 페이지는 조립만 하고 판정은 여기서 끝낸다.

export interface ProfileOption {
  id: string;
  name: string;
  /** "1993.04.12 · 남 · 09:20" */
  sub: string;
  birthYear: number;
  /** 이 프로필로 권한을 가진 해의 개수 */
  ownedCount: number;
}

export interface YearOption {
  year: number;
  /** 만 나이. 시안의 연도 칸에 붙는다 */
  age: number;
  tag: "지난" | "올해" | "다가올";
  /**
   * ⚠️ 행 존재가 아니라 **권한**이다.
   *
   * 행 존재로 판정하면 "결제 없이 열립니다" 라고 안내한 뒤 실제로 차감된다 —
   * CTA 를 눌러 행은 만들어졌는데 생성이 한도나 잔액에서 막힌 경우다.
   */
  owned: boolean;
  /** 이 해의 flows 행. 없으면 null */
  flowId: string | null;
}

export interface YearOptionsInput {
  /** 지금의 명리 연도. 달력 연도가 아니다 */
  currentYear: number;
  span: number;
  birthYear: number;
  owned: Map<number, { flowId: string; entitled: boolean }>;
}

export function buildYearOptions(input: YearOptionsInput): YearOption[] {
  const out: YearOption[] = [];
  for (let y = input.currentYear - input.span; y <= input.currentYear + input.span; y += 1) {
    // 태어나기 전 해에는 대운이 없고 만 나이가 음수가 된다.
    if (y < input.birthYear) continue;
    const hit = input.owned.get(y);
    out.push({
      year: y,
      age: y - input.birthYear,
      tag: y === input.currentYear ? "올해" : y < input.currentYear ? "지난" : "다가올",
      owned: hit?.entitled ?? false,
      flowId: hit?.flowId ?? null,
    });
  }
  return out;
}

/**
 * "2027년 2월 초부터 2028년 2월 초까지"
 *
 * 연도를 감추지 않는다 — 감추면 사용자가 구매한 범위를 이해하지 못한다. 반대로
 * 입춘의 정확한 시각은 내부 판정에만 쓰고 화면에는 "초" 로 눅인다.
 */
export function formatPeriod(start: Date, end: Date): string {
  const label = (d: Date) => {
    const kst = new Date(d.getTime() + 9 * 3600_000);
    const day = kst.getUTCDate();
    const phase = day <= 10 ? "초" : day <= 20 ? "중순" : "말";
    return `${kst.getUTCFullYear()}년 ${kst.getUTCMonth() + 1}월 ${phase}`;
  };
  return `${label(start)}부터 ${label(end)}까지`;
}
```

- [ ] **Step 4: `to-start-outcome.ts` 의 문구를 고친다**

`case 429` 의 텍스트에서 `"지금의 흐름 생성"` → `"한 해의 흐름 생성"`.

- [ ] **Step 5: `FlowConfirm.tsx` 를 통째로 교체한다**

시안의 구조를 따르되 이 레포의 Tailwind 어휘로 쓴다.

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProfileOption, YearOption } from "../_lib/to-confirm";
import { toStartOutcome, type StartFailure } from "../_lib/to-start-outcome";

export interface FlowConfirmProps {
  profiles: ProfileOption[];
  /** 프로필별 연도 칸. profiles 와 같은 순서다 */
  yearsByProfile: YearOption[][];
  /** 처음 열었을 때 고를 프로필의 인덱스 */
  initialProfile: number;
  /** 지금의 명리 연도 — 기본 선택값이다 */
  currentYear: number;
  ticketPriceLabel: string;
}

export function FlowConfirm(props: FlowConfirmProps) {
  const router = useRouter();
  const [active, setActive] = useState(props.initialProfile);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(props.currentYear);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<StartFailure | null>(null);

  if (props.profiles.length === 0) {
    return (
      <section className="mx-auto max-w-[720px] px-5 py-9">
        <h1 className="mb-1.5 text-xl font-bold tracking-[-0.025em]">한 해의 흐름</h1>
        <p className="mb-5 text-[13.5px] leading-[1.55] text-gray-500">
          먼저 사주 정보를 저장해주세요.
        </p>
        <Link
          href="/funnel?step=name"
          className="block w-full rounded-[14px] bg-accent py-3 text-center text-sm font-bold text-white"
        >
          사주 추가하기
        </Link>
      </section>
    );
  }

  const me = props.profiles[active];
  const years = props.yearsByProfile[active];
  // 프로필을 바꾸면 고른 해가 그 사람의 범위 밖일 수 있다(태어나기 전).
  const selected = years.find((y) => y.year === year) ?? years[years.length - 1];

  async function start() {
    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch("/api/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: me.id, year: selected.year }),
      });
      if (!res.ok) {
        // 402·429·401 모두 실제로 닿는 상태다 — 버튼만 다시 눌리게 두면
        // 사용자는 왜 아무 일도 안 일어나는지 알 방법이 없다.
        setFailure(toStartOutcome(res.status));
        setBusy(false);
        return;
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/flow/${id}`);
    } catch {
      setFailure(toStartOutcome(0));
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-[720px] px-5 py-9">
      <div className="mb-2 text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
        한 해의 흐름
      </div>
      <h1 className="text-[clamp(22px,5vw,28px)] font-bold leading-[1.22] tracking-[-0.04em]">
        어떤 해를 살펴볼까요?
      </h1>
      <p className="mt-2 max-w-[520px] text-[13.5px] leading-[1.55] text-gray-500">
        사주와 연도를 고르면 그 해의 큰 흐름부터 달마다 달라지는 변화까지 정리해 드려요.
      </p>

      {/* 1 · 프로필 */}
      <div className="relative z-20 mt-7">
        <div className="mb-2 text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
          누구의 흐름인가요?
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-[52px] min-w-0 flex-1 items-center gap-3 rounded-[14px] border border-slate-200 bg-white px-3.5 text-left"
          >
            <span className="flex flex-col items-start gap-px min-w-0">
              <span className="text-[15.5px] font-bold leading-tight tracking-[-0.025em]">
                {me.name}
              </span>
              <span className="max-w-[220px] truncate text-[12.5px] leading-tight text-slate-400">
                {me.sub}
              </span>
            </span>
            <span className="ml-auto text-[11px] text-gray-400">▾</span>
          </button>
          <Link
            href="/funnel?step=name"
            className="flex h-[52px] flex-none items-center gap-1.5 rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-gray-700"
          >
            <span className="text-[17px] font-normal leading-none">+</span>추가
          </Link>
        </div>

        {open && (
          <div className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            {props.profiles.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setActive(i);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-3 text-left ${
                  i === active ? "bg-slate-50" : "bg-white"
                }`}
              >
                <span className={`w-4 flex-none text-xs font-bold ${i === active ? "text-accent" : "text-transparent"}`}>
                  ✓
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold tracking-[-0.02em]">{p.name}</span>
                  <span className="mt-px block text-[13px] text-slate-400">{p.sub}</span>
                </span>
                {p.ownedCount > 0 && (
                  <span className="flex-none text-[11.5px] font-semibold text-slate-400">
                    {p.ownedCount}개 보유
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2 · 연도 */}
      <div className="mt-7">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <div className="text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
            어떤 해인가요?
          </div>
          <span className="text-xs text-slate-400">
            {me.ownedCount > 0 ? `구매한 해 ${me.ownedCount}개` : "구매한 해 없음"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {years.map((y) => {
            const on = y.year === selected.year;
            return (
              <button
                key={y.year}
                type="button"
                aria-pressed={on}
                onClick={() => setYear(y.year)}
                className={`relative flex flex-col gap-0.5 rounded-2xl border-[1.5px] px-4 py-3.5 text-left transition-colors ${
                  on
                    ? y.owned
                      ? "border-slate-900 bg-slate-900"
                      : "border-accent bg-slate-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <span
                  className={`mb-0.5 text-[10.5px] font-bold tracking-[0.07em] ${
                    on && y.owned ? "text-white/50" : y.tag === "올해" ? "text-accent" : "text-slate-300"
                  }`}
                >
                  {y.tag}
                </span>
                <span
                  className={`text-[21px] font-bold leading-[1.1] tracking-[-0.04em] tabular-nums ${
                    on && y.owned ? "text-white" : "text-slate-900"
                  }`}
                >
                  {y.year}
                </span>
                <span className={`text-xs ${on && y.owned ? "text-white/60" : "text-slate-400"}`}>
                  만 {y.age}세
                </span>
                {y.owned && (
                  <span
                    aria-label="이미 구매한 해"
                    className={`absolute right-2.5 top-2.5 flex size-[17px] items-center justify-center rounded-full text-[10px] font-bold text-white ${
                      on ? "bg-white/30" : "bg-slate-900"
                    }`}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-slate-400">
          ✓ 이미 구매한 해 · 결제 없이 다시 볼 수 있어요
        </p>
      </div>

      {/* 3 · CTA */}
      <div className="mt-7 flex flex-col gap-4 rounded-[20px] border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 text-xs text-slate-400">
            {me.name} · {selected.year}년
          </div>
          <div className="text-[17px] font-bold tracking-[-0.03em]">
            {selected.owned
              ? `${selected.year}년 흐름 다시 보기`
              : `${selected.year}년 흐름 살펴보기`}
          </div>
          <div className="mt-1 text-[13px] text-gray-500">
            {selected.owned
              ? "이미 구매한 해예요. 결제 없이 열립니다."
              : `이용권 1장 또는 ${props.ticketPriceLabel}`}
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            selected.owned && selected.flowId
              ? router.push(`/flow/${selected.flowId}`)
              : void start()
          }
          className={`flex-none rounded-[14px] px-6 py-3.5 text-[15px] font-bold text-white disabled:opacity-60 ${
            selected.owned ? "bg-slate-900" : "bg-accent"
          }`}
        >
          {busy ? "준비하는 중…" : selected.owned ? "바로 열기" : "흐름 보기"}
        </button>
      </div>

      {failure && (
        <p role="alert" className="mt-3 text-[13px] leading-[1.55] text-red-600">
          {failure.text}
          {failure.action && (
            <>
              {" "}
              <Link
                href={failure.action.href}
                className="font-semibold underline underline-offset-2"
              >
                {failure.action.label}
              </Link>
            </>
          )}
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 6: `page.tsx` 를 통째로 교체한다**

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { listProfiles, type ProfileRow } from "@/lib/profiles/store";
import { flowYearAt } from "@/lib/saju-core";
import { listFlowYears } from "@/lib/flows/store";
import { listEntitledSubjects } from "@/lib/tickets/entitlements";
import { TICKET_PRICE_LABEL } from "@/app/_lib/catalog";
import { FLOW_YEAR_SPAN } from "@/app/api/flows/_lib/handler";
import { AppHeader } from "@/components/AppHeader";
import { resolveDisplayName } from "@/lib/auth/display-name";
import { FlowConfirm } from "./_components/FlowConfirm";
import { buildYearOptions, type ProfileOption } from "./_lib/to-confirm";

export default async function FlowPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/flow");

  const [user, rows] = await Promise.all([getUser(session.userId), listProfiles(session.userId)]);
  const currentYear = flowYearAt(new Date()).year;

  // 권한은 한 번만 읽는다 — 프로필 × 연도 칸마다 물으면 왕복이 수십 번이다.
  const entitled = new Set(await listEntitledSubjects(session.userId, "yearly_flow"));

  const perProfile = await Promise.all(
    rows.map(async (row) => {
      const flows = await listFlowYears(session.userId, row.id);
      const owned = new Map(
        flows.map((f) => [f.flowYear, { flowId: f.id, entitled: entitled.has(f.id) }]),
      );
      const years = buildYearOptions({
        currentYear,
        span: FLOW_YEAR_SPAN,
        birthYear: row.birthYear,
        owned,
      });
      const profile: ProfileOption = {
        id: row.id,
        name: row.name,
        sub: describeProfile(row),
        birthYear: row.birthYear,
        ownedCount: years.filter((y) => y.owned).length,
      };
      return { profile, years };
    }),
  );

  return (
    <div className="min-h-screen bg-white text-slate-900 leading-normal break-keep [overflow-wrap:break-word]">
      <AppHeader displayName={resolveDisplayName(user)} />
      <main>
        <FlowConfirm
          profiles={perProfile.map((p) => p.profile)}
          yearsByProfile={perProfile.map((p) => p.years)}
          initialProfile={primaryIndex(rows, user?.primaryProfileId ?? null)}
          currentYear={currentYear}
          ticketPriceLabel={TICKET_PRICE_LABEL}
        />
      </main>
    </div>
  );
}

/**
 * "나" 로 정한 프로필의 자리. src/app/home/page.tsx 가 users.primary_profile_id 로
 * 같은 값을 고르는 것과 같은 규칙이다.
 *
 * primaryProfileId 가 없거나 가리키는 프로필이 목록에 없으면 첫 줄로 물러선다 —
 * HomeIdentity 의 index 계산과 같은 폴백이다.
 */
function primaryIndex(rows: ProfileRow[], primaryId: string | null): number {
  if (!primaryId) return 0;
  const i = rows.findIndex((r) => r.id === primaryId);
  return i >= 0 ? i : 0;
}

/** "1993.04.12 · 남 · 09:20" — 드롭다운의 보조 줄. */
function describeProfile(row: ProfileRow): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const parts = [
    `${row.birthYear}.${pad(row.birthMonth)}.${pad(row.birthDay)}`,
    row.gender === "male" ? "남" : "여",
    row.birthHour == null ? "시간 모름" : `${pad(row.birthHour)}:${pad(row.birthMinute ?? 0)}`,
  ];
  return parts.join(" · ");
}
```

> ⚠️ `ProfileRow` 의 실제 필드명(`birthYear`/`birthMonth`/`birthHour`/`gender` 등)을
> `src/lib/profiles/store.ts` 에서 확인해 맞출 것. `src/lib/profiles/to-birth-input.ts`
> 가 같은 필드를 읽으므로 그 파일을 보면 정확한 이름이 나온다. 이미 비슷한 요약을
> 만드는 컴포넌트가 있으면 그것을 재사용한다.

- [ ] **Step 7: 테스트와 린트를 확인한다**

Run: `npx vitest run src/app/flow/_lib/`
Expected: PASS

Run: `npx tsc --noEmit 2>&1 | grep "app/flow"`
Expected: `src/app/flow/[id]/` 만 남는다(Task 13)

Run: `npx eslint src/app/flow/page.tsx src/app/flow/_components/FlowConfirm.tsx src/app/flow/_lib/`
Expected: 오류 없음

- [ ] **Step 8: 커밋**

```bash
git add src/app/flow/page.tsx src/app/flow/_components/ src/app/flow/_lib/
git commit -m "feat(flow): 선택 화면에 프로필과 연도를 함께 놓는다

시안(Saju Yearly Report)을 따라 한 화면에서 프로필 드롭다운과 연도 그리드를
모두 다룬다. 앞선 화면에는 프로필을 바꿀 방법이 아예 없어, 기본 프로필이
가족인 사용자가 자기 것을 살 수 없었다. 프로필이 없을 때도 막다른 길이
아니라 추가로 잇는다.

소유 배지는 행 존재가 아니라 권한으로 판정한다 — 행은 공짜로 만들어지고
차감은 생성 자리에서 일어나므로, 생성이 막히면 행만 남고 권한은 없다.

태어나기 전 해는 칸에서 뺀다."
```

---

## Task 13: `/flow/[id]` 리포트 화면

**Files:**
- Create: `src/app/flow/[id]/_lib/current-month.ts`, `current-month.test.ts`
- Delete: `src/app/flow/[id]/_lib/current-segment.ts`, `current-segment.test.ts`
- Rewrite: `src/app/flow/[id]/_lib/to-flow-view.ts`, `to-flow-view.test.ts`
- Create: `src/app/flow/[id]/_components/MonthTimeline.tsx`
- Rewrite: `src/app/flow/[id]/_components/FlowShell.tsx`, `FlowHero.tsx`, `FlowBody.tsx`
- Modify: `src/app/flow/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 4 의 `FlowMonth`, Task 7 의 `FlowInterpretation`, Task 8 의 `buildFlowContext`
- Produces:
  - `currentMonthIndex(months: FlowMonth[], now: Date): number | null`
  - `monthLabel(m: FlowMonth): string` — `"3월"`
  - `monthRange(m: FlowMonth): string` — `"3월 초 ~ 4월 초"`
  - `toFlowView(interpretation: Partial<FlowInterpretation>): FlowSectionView[]`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/flow/[id]/_lib/current-month.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { currentMonthIndex, monthLabel, monthRange } from "./current-month";

const months = Array.from({ length: 12 }, (_, i) => ({
  index: i + 1,
  start: new Date(Date.UTC(2027, 1 + i, 4)).toISOString(),
  end: new Date(Date.UTC(2027, 2 + i, 4)).toISOString(),
  korean: "임인",
  pivot: false,
}));

describe("currentMonthIndex", () => {
  it("지금이 속한 달을 고른다", () => {
    expect(currentMonthIndex(months, new Date("2027-04-20T00:00:00Z"))).toBe(3);
  });

  it("기간 밖이면 null 이다 — 아무 칸도 강조하지 않는다", () => {
    // 지난 해·다가올 해를 열면 강조할 '지금' 이 없다. 마지막 칸으로 물러서면
    // 2021년 리포트에서 12월이 '현재' 로 표시된다.
    expect(currentMonthIndex(months, new Date("2021-06-01T00:00:00Z"))).toBeNull();
    expect(currentMonthIndex(months, new Date("2030-06-01T00:00:00Z"))).toBeNull();
  });

  it("경계에서 앞 칸이 끝나고 뒤 칸이 시작한다", () => {
    const at = new Date(months[1].start);
    expect(currentMonthIndex(months, at)).toBe(2);
  });
});

describe("monthLabel / monthRange", () => {
  it("KST 달력 월로 이름을 붙인다", () => {
    expect(monthLabel(months[1])).toBe("3월");
  });

  it("절기 기준 기간을 보조로 보여준다", () => {
    // 명리 월운은 달력 1일~말일과 일치하지 않는다 — 같다고 오해하면 안 된다
    expect(monthRange(months[1])).toBe("3월 초 ~ 4월 초");
  });
});
```

`to-flow-view.test.ts` 를 새 구조로 바꾼다:

```ts
import { describe, expect, it } from "vitest";
import { toFlowView } from "./to-flow-view";

describe("toFlowView", () => {
  it("없는 섹션은 빼고 낸다 — 부분 생성도 보여준다", () => {
    const out = toFlowView({
      overview: { title: "t", body: "b", keywords: ["가", "나", "다", "라"] },
    });
    expect(out.map((s) => s.key)).toEqual(["overview"]);
  });

  it("선언 순서를 지킨다", () => {
    const out = toFlowView({
      closing: { lead: "l", items: [], closing: "c" },
      overview: { title: "t", body: "b", keywords: [] },
    } as never);
    expect(out[0].key).toBe("overview");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run "src/app/flow/[id]/_lib/"`
Expected: FAIL

- [ ] **Step 3: `current-month.ts` 를 만들고 `current-segment.ts` 를 지운다**

```ts
// 읽는 시점이 속한 달. **화면 강조에만 쓴다.**
//
// 앞선 설계는 읽는 시점으로 저장된 서술을 골랐다. 이제 고르지 않는다 — 본문은
// 12개월 전부이고 시제 중립이라, 언제 열어도 같은 글이 같은 뜻으로 읽힌다.
// 여기서 내는 것은 "지금" 배지를 어디에 붙일지뿐이다.

import type { FlowMonth } from "@/app/api/flows/_lib/pivots";

/**
 * 지금이 속한 달의 index(1‥12). 기간 밖이면 **null**.
 *
 * 앞선 currentSegmentIndex 는 못 찾으면 마지막 칸으로 물러섰다. 여기서 그렇게
 * 하면 2021년 리포트에서 12월이 "현재" 로 표시된다 — 사용자가 지난 해와 다가올
 * 해를 고르는 이상 기간 밖이 정상이다.
 */
export function currentMonthIndex(months: FlowMonth[], now: Date): number | null {
  const t = now.getTime();
  const hit = months.find((m) => t >= Date.parse(m.start) && t < Date.parse(m.end));
  return hit ? hit.index : null;
}

/** 절대 시각을 KST 민간 날짜로 읽는다. */
function kst(iso: string): Date {
  return new Date(Date.parse(iso) + 9 * 3600_000);
}

/** "3월" — 그 달의 대부분을 차지하는 달력 월이다. */
export function monthLabel(m: FlowMonth): string {
  return `${kst(m.start).getUTCMonth() + 1}월`;
}

/**
 * "3월 초 ~ 4월 초" — 보조 표기.
 *
 * 명리 월운은 달력 1일~말일과 일치하지 않는다(§18). 이름만 두면 사용자가 같다고
 * 오해하므로 실제 절기 기준 기간을 함께 보여준다.
 */
export function monthRange(m: FlowMonth): string {
  const phase = (d: Date) => {
    const day = d.getUTCDate();
    return day <= 10 ? "초" : day <= 20 ? "중순" : "말";
  };
  const s = kst(m.start);
  const e = kst(m.end);
  return `${s.getUTCMonth() + 1}월 ${phase(s)} ~ ${e.getUTCMonth() + 1}월 ${phase(e)}`;
}
```

```bash
git rm "src/app/flow/[id]/_lib/current-segment.ts" "src/app/flow/[id]/_lib/current-segment.test.ts"
```

- [ ] **Step 4: `to-flow-view.ts` 를 통째로 교체한다**

```ts
import {
  FLOW_SECTION_KEYS,
  type FlowInterpretation,
  type FlowSectionKey,
} from "@/app/api/flows/_lib/sections";

export interface FlowSectionView {
  key: FlowSectionKey;
  content: FlowInterpretation[FlowSectionKey];
}

/**
 * 저장된 서술 → 화면 모델.
 *
 * 앞선 설계는 읽는 시점의 구간을 골라 냈다. 이제 고를 것이 없다 — 본문이 12개월
 * 전부다. 남은 일은 없는 섹션을 빼고 선언 순서로 세우는 것뿐이다.
 *
 * 없는 섹션을 빼는 이유는 그대로다 — 생성이 일부 실패해도 확보한 섹션은 보여야
 * 한다. 이용권을 쓴 결과다.
 */
export function toFlowView(
  interpretation: Partial<FlowInterpretation>,
): FlowSectionView[] {
  const out: FlowSectionView[] = [];
  for (const key of FLOW_SECTION_KEYS) {
    const content = interpretation[key];
    if (!content) continue;
    out.push({ key, content } as FlowSectionView);
  }
  return out;
}
```

- [ ] **Step 5: `MonthTimeline.tsx` 를 만든다**

```tsx
import type { FlowMonth } from "@/app/api/flows/_lib/pivots";
import type { MonthsContent } from "@/app/api/flows/_lib/sections";
import { monthLabel, monthRange } from "../_lib/current-month";

/**
 * 12개월 타임라인. 이 서비스에서 가장 중요한 콘텐츠다(§17).
 *
 * 세 가지를 화면이 붙인다 — LLM 은 순번만 알고 시점을 쓰지 않는다:
 *   1. 달 이름과 절기 기준 기간 (§18)
 *   2. 변곡점 강조 (§9) — flows.months 의 박제된 플래그가 근거다
 *   3. "지금" 배지 — 선택한 해가 지금의 명리 연도일 때만 (§23)
 */
export function MonthTimeline({
  content,
  months,
  currentIndex,
}: {
  content: MonthsContent;
  months: FlowMonth[];
  /** 지금이 속한 달. 지난 해·다가올 해면 null */
  currentIndex: number | null;
}) {
  const metaOf = new Map(months.map((m) => [m.index, m]));

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {content.months.map((body) => {
        const meta = metaOf.get(body.monthIndex);
        if (!meta) return null;
        const isNow = body.monthIndex === currentIndex;

        return (
          <article
            key={body.monthIndex}
            className={`rounded-2xl border p-4 ${
              meta.pivot ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[15px] font-bold tracking-[-0.02em]">
                {monthLabel(meta)}
              </span>
              <span className="text-[13.5px] font-semibold text-slate-700">{body.title}</span>
              {meta.pivot && (
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10.5px] font-bold text-white">
                  흐름이 바뀌는 달
                </span>
              )}
              {isNow && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-bold text-white">
                  현재
                </span>
              )}
              <span className="ml-auto text-[11.5px] text-slate-400">{monthRange(meta)}</span>
            </div>
            <p className="mt-2 text-[13.5px] leading-[1.65] text-slate-600">{body.body}</p>
          </article>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: `FlowShell` · `FlowHero` · `FlowBody` 를 고친다**

`FlowShell.tsx` — 구간 이야기를 빼고 프로필·연도 줄로 바꾼다:

```tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import type { FlowRow } from "@/lib/flows/store";
import { formatPeriod } from "@/app/flow/_lib/to-confirm";

/**
 * 헤더 + 위치 요약 + 본문 조립. MatchShell 과 같은 이유로 헤더는 즉시 그려져야
 * 한다 — 본문(children)이 <Suspense> 안에서 늦게 도착해도 나가는 길은 남는다.
 *
 * 위치 요약은 LLM 을 기다리지 않는다 — flow.months 와 기간은 발행 시점에 박제된
 * 계산값이라 즉시 알 수 있다.
 *
 * "지났습니다" 같은 안내를 더 이상 하지 않는다. 사용자가 직접 고른 해이므로 지난
 * 해인 것은 실수가 아니라 의도다(§25: 과거 복기가 이 서비스의 절반이다).
 */
export function FlowShell({
  flow,
  profileName,
  displayName,
  children,
}: {
  flow: FlowRow;
  profileName: string;
  /** 헤더 메뉴에 서는 이름. 로그인 필수 화면이라 실제로는 null 이 오지 않는다. */
  displayName: string | null;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-900 leading-normal break-keep [overflow-wrap:break-word]">
      <AppHeader displayName={displayName} />
      <main className="mx-auto max-w-[720px] px-[clamp(20px,5vw,24px)] pb-24 pt-[clamp(36px,7vw,64px)]">
        <section className="text-center">
          <div className="text-[13px] text-slate-500">
            {profileName} · {flow.flowYear}년
          </div>
          <div className="mt-1.5 font-mono text-[13px] text-slate-400">
            {formatPeriod(flow.periodStart, flow.periodEnd)}
          </div>
        </section>
        {children}
        <p className="mt-16 text-center text-[13px] text-slate-400">
          <Link href="/flow" className="font-semibold underline underline-offset-2">
            다른 해도 살펴보기
          </Link>
        </p>
      </main>
    </div>
  );
}
```

`FlowHero.tsx` — 01 의 title 과 keywords 를 세운다:

```tsx
import type { OverviewContent } from "@/app/api/flows/_lib/sections";
import type { FlowSectionView } from "../_lib/to-flow-view";

/**
 * 01(overview) 의 대표 문장과 키워드(§34). LLM 서술이 필요해 <Suspense> 안,
 * FlowBody 와 함께 도착한다.
 *
 * overview 생성이 실패했으면(부분 생성) 대표 문장을 만들 재료가 없다 — 조용히
 * 건너뛴다. 아래 FlowBody 가 확보된 섹션만으로 이어간다.
 */
export function FlowHero({ sections }: { sections: FlowSectionView[] }) {
  const view = sections.find((s) => s.key === "overview");
  if (!view) return null;
  const overview = view.content as OverviewContent;

  return (
    <section className="mt-8 text-center">
      <h1 className="mx-auto max-w-[560px] break-keep text-[clamp(24px,5vw,32px)] font-bold leading-[1.35] tracking-[-0.03em] [text-wrap:balance]">
        {overview.title}
      </h1>
      {overview.keywords.length > 0 && (
        <>
          <div className="mt-6 text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
            올해의 키워드
          </div>
          <div className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-slate-700">
            {overview.keywords.join(" · ")}
          </div>
        </>
      )}
    </section>
  );
}
```

`FlowBody.tsx` — 9섹션을 모양별로 그린다:

```tsx
import Link from "next/link";
import type { FlowMonth } from "@/app/api/flows/_lib/pivots";
import {
  type ClosingContent,
  type FlowSectionKey,
  type ItemsContent,
  type MonthsContent,
  type OverviewContent,
  type PivotsContent,
  type ProseContent,
} from "@/app/api/flows/_lib/sections";
import { SectionHeading } from "@/app/report/_components/SectionHeading";
import { InfoCard } from "@/app/report/_components/InfoCard";
import { NoteCard } from "@/app/report/_components/NoteCard";
import { monthLabel } from "../_lib/current-month";
import type { FlowSectionView } from "../_lib/to-flow-view";
import { MonthTimeline } from "./MonthTimeline";

const SECTION = "mt-[72px]";

/**
 * 01~09 표시 메타. FlowSectionKey 로 색인해 전수 커버리지를 강제한다 —
 * 레지스트리에 키가 하나 늘면 이 객체가 같이 늘지 않는 한 컴파일이 깨진다.
 */
const SECTION_META: Record<FlowSectionKey, { no: string; category: string }> = {
  overview: { no: "01", category: "한 해의 흐름" },
  rising: { no: "02", category: "힘이 실리는 것" },
  straining: { no: "03", category: "부담되는 것" },
  work: { no: "04", category: "일과 선택" },
  relating: { no: "05", category: "관계" },
  money: { no: "06", category: "돈과 현실" },
  months: { no: "07", category: "월별 흐름" },
  pivots: { no: "08", category: "올해의 변곡점" },
  closing: { no: "09", category: "이 해의 포인트" },
};

/**
 * 서술 9섹션 → 화면. interpretation 은 부분 생성 결과일 수 있어
 * (FlowGenerationError.partial) 각 섹션은 자기 키가 없으면 통째로 건너뛴다.
 *
 * 달 이름·기간·변곡점 강조는 전부 화면이 붙인다 — LLM 은 순번만 안다.
 * 04 끝의 /consult, 05 끝의 /match 링크도 같은 이유로 화면이 붙인다(§32).
 */
export function FlowBody({
  sections,
  months,
  currentIndex,
  profileId,
}: {
  sections: FlowSectionView[];
  months: FlowMonth[];
  currentIndex: number | null;
  profileId: string;
}) {
  return (
    <>
      {sections.map((view) => {
        const meta = SECTION_META[view.key];

        if (view.key === "overview") {
          const c = view.content as OverviewContent;
          return (
            <section key={view.key} className={SECTION}>
              <SectionHeading no={meta.no} category={meta.category} title={c.title} />
              <NoteCard>{c.body}</NoteCard>
            </section>
          );
        }

        if (view.key === "months") {
          const c = view.content as MonthsContent;
          return (
            <section key={view.key} className={SECTION}>
              <SectionHeading no={meta.no} category={meta.category} title="이렇게 흘러가요" />
              <NoteCard>{c.lead}</NoteCard>
              <MonthTimeline content={c} months={months} currentIndex={currentIndex} />
            </section>
          );
        }

        if (view.key === "pivots") {
          const c = view.content as PivotsContent;
          const metaOf = new Map(months.map((m) => [m.index, m]));
          return (
            <section key={view.key} className={SECTION}>
              <SectionHeading
                no={meta.no}
                category={meta.category}
                title="흐름이 크게 달라지는 시기"
              />
              <NoteCard>{c.lead}</NoteCard>
              {/* 변곡점이 없으면 lead 하나로 끝난다 — 없는 변화를 만들지 않는다(§21) */}
              {c.pivots.length > 0 && (
                <div className="mt-3 flex flex-col gap-3">
                  {c.pivots.map((p) => {
                    const m = metaOf.get(p.monthIndex);
                    return (
                      <InfoCard
                        key={p.monthIndex}
                        label={m ? `${monthLabel(m)} 무렵` : `${p.monthIndex}번째 달`}
                      >
                        <span className="mb-1 block font-semibold text-slate-800">{p.title}</span>
                        {p.body}
                      </InfoCard>
                    );
                  })}
                </div>
              )}
            </section>
          );
        }

        if (view.key === "closing") {
          const c = view.content as ClosingContent;
          return (
            <section key={view.key} className={SECTION}>
              <SectionHeading no={meta.no} category={meta.category} title="기억할 것" />
              <NoteCard>{c.lead}</NoteCard>
              <div className="mt-3 flex flex-col gap-3">
                {c.items.map((item) => (
                  <InfoCard key={item.title} label={item.title}>
                    {item.body}
                  </InfoCard>
                ))}
              </div>
              <p className="mt-6 text-center text-[15px] font-semibold leading-[1.6] tracking-[-0.02em] text-slate-800">
                {c.closing}
              </p>
            </section>
          );
        }

        if (view.key === "rising" || view.key === "straining") {
          const c = view.content as ItemsContent;
          return (
            <section key={view.key} className={SECTION}>
              <SectionHeading no={meta.no} category={meta.category} title={c.lead} />
              <div className="mt-3 flex flex-col gap-3">
                {c.items.map((item) => (
                  <InfoCard key={item.title} label={item.title}>
                    {item.body}
                  </InfoCard>
                ))}
              </div>
            </section>
          );
        }

        const c = view.content as ProseContent;
        return (
          <section key={view.key} className={SECTION}>
            <SectionHeading no={meta.no} category={meta.category} title={c.lead} />
            <div className="mt-3">
              <InfoCard label={meta.category}>{c.body}</InfoCard>
            </div>
            {view.key === "work" && (
              <p className="mt-5 text-[13.5px] text-slate-500">
                올해 고민 중인 선택이 있다면{" "}
                <Link
                  href={`/consult?profile=${profileId}`}
                  className="font-semibold text-slate-700 underline underline-offset-2"
                >
                  고민상담
                </Link>
                에서 더 구체적으로 이야기해볼 수 있어요.
              </p>
            )}
            {view.key === "relating" && (
              <p className="mt-5 text-[13.5px] text-slate-500">
                마음에 걸리는 사람이 있다면{" "}
                <Link
                  href="/match"
                  className="font-semibold text-slate-700 underline underline-offset-2"
                >
                  궁합
                </Link>
                에서 두 사람의 관계를 더 자세히 볼 수 있어요.
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}
```

- [ ] **Step 7: `page.tsx` 를 고친다**

세 곳만 바뀐다. `currentSegmentIndex` → `currentMonthIndex`, `flow.segments` → `flow.months`, `getFlowSections` 의 `n` → 스키마 컨텍스트, 그리고 `FlowShell`/`FlowBody` 의 props.

```tsx
  const now = new Date();
  // 선택한 해가 지금의 명리 연도가 아니면 null 이다 — 강조할 "지금" 이 없다.
  const currentIndex = currentMonthIndex(flow.months, now);

  const ctx = buildContext(profile, flow);
  if (!ctx) {
    return (
      <FlowShell flow={flow} profileName={profile.name} displayName={displayName}>
        <FlowError />
      </FlowShell>
    );
  }

  return (
    <FlowShell flow={flow} profileName={profile.name} displayName={displayName}>
      <Suspense fallback={<AnalyzingFlow />}>
        <FlowSections flow={flow} userId={session.userId} ctx={ctx} currentIndex={currentIndex} />
      </Suspense>
    </FlowShell>
  );
```

`buildContext` 안의 `buildFlowContext(analysis, flow.flowYear, flow.segments)` 를 `flow.months` 로 바꾼다.

`FlowSections` 안:

```tsx
    ({ interpretation } = await produceFlowSections(flow.id, ctx, {
      generator: gateFlowGeneration(
        chargeFlowGeneration(createFlowGenerator(), userId, flow.id),
        userId,
      ),
      getStored: (flowId, keys) =>
        getFlowSections(flowId, keys, { pivotMonths: ctx.pivotMonths }),
      putStored: putFlowSections,
      sectionKeys: FLOW_SECTION_KEYS,
    }));
```

그리고 마지막 렌더:

```tsx
  const sections = toFlowView(interpretation);
  return (
    <>
      <FlowHero sections={sections} />
      <FlowBody
        sections={sections}
        months={flow.months}
        currentIndex={currentIndex}
        profileId={flow.profileId}
      />
    </>
  );
```

`maxDuration` 주석을 고친다:

```tsx
/**
 * 흐름 하나가 9섹션을 한 번에 생성하고, 그중 07 은 12개월을 한 응답에 담는다 —
 * 궁합(5섹션)보다 무거워 같은 여유를 둔다.
 */
export const maxDuration = 60;
```

- [ ] **Step 8: 테스트·타입·린트를 확인한다**

Run: `npx vitest run "src/app/flow/"`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: 오류 없음 — 여기서 전체가 다시 컴파일된다

Run: `npx eslint "src/app/flow/"`
Expected: 오류 없음

- [ ] **Step 9: 커밋**

```bash
git add "src/app/flow/[id]/"
git commit -m "feat(flow): 리포트를 12개월 타임라인으로 다시 짠다

읽는 시점으로 저장된 서술을 고르던 것을 없앤다 — 본문은 12개월 전부이고
시제 중립이라 언제 열어도 같은 뜻으로 읽힌다. 남은 것은 '지금' 배지뿐이고,
선택한 해가 지금의 명리 연도가 아니면 아예 붙지 않는다. 마지막 칸으로
물러서면 2021년 리포트에서 12월이 '현재' 가 된다.

달 이름 옆에 절기 기준 기간을 함께 보여준다 — 명리 월운이 달력 1일~말일과
같다고 오해하면 안 된다.

'이 흐름은 지났습니다' 안내를 뺀다. 사용자가 직접 고른 해라 지난 해인 것은
실수가 아니라 의도다."
```

---

## Task 14: 이름과 진입점

**Files:**
- Modify: `src/app/_lib/catalog.ts`, `src/app/_lib/catalog.test.ts`
- Modify: `src/app/home/_components/ExploreGrid.tsx`
- Modify: `src/app/api/flows/_lib/gated-generator.test.ts` 등 남은 문구

**Interfaces:**
- Consumes: Task 6 의 `Feature`
- Produces: 없음(문구만)

- [ ] **Step 1: 카탈로그 문구를 고친다**

`src/app/_lib/catalog.ts` 의 `current_flow` 항목을:

```ts
  yearly_flow: {
    title: "한 해의 흐름",
    desc: "궁금한 해를 골라, 그해의 큰 흐름부터 달마다 달라지는 변화까지.",
    href: "/flow",
  },
```

- [ ] **Step 2: 홈 카드를 고친다**

`src/app/home/_components/ExploreGrid.tsx` 에서 리포트 다음 카드의 제목과 설명을 위와 같은 문구로 바꾼다.

- [ ] **Step 3: 남은 옛 이름을 찾아 고친다**

Run: `grep -rn "지금의 흐름" src/ docs/superpowers/plans/ --include=*.ts --include=*.tsx`

나온 곳을 전부 고친다. `docs/superpowers/specs/` 의 옛 스펙은 **그대로 둔다** — 지난 결정의 기록이다.

Run: `grep -rn "current_flow" src/`
Expected: 없음

- [ ] **Step 4: 전체를 확인한다**

Run: `npx vitest run`
Expected: PASS

Run: `npx tsc --noEmit`
Expected: 오류 없음

Run: `npx eslint src/app/flow src/app/api/flows src/lib/flows src/lib/tickets src/lib/saju-core/flow src/app/_lib/catalog.ts src/app/home/_components/ExploreGrid.tsx`
Expected: 오류 없음

> 레포 전체 `npm run lint` 는 이 브랜치를 따기 전부터 빨갛다 — 돌리지 않는다.

- [ ] **Step 5: 커밋**

```bash
git add src/app/_lib/catalog.ts src/app/_lib/catalog.test.ts src/app/home/_components/ExploreGrid.tsx
git commit -m "feat(flow): 서비스 이름을 한 해의 흐름으로 바꾼다

사용자가 5년 전 해도 사게 되면서 '지금' 이 거짓이 됐다."
```

---

## 실행 전 확인

이 계획을 시작하기 전에 사람이 해야 할 일:

1. **마이그레이션 0037~0043 을 개발 DB 에 적용한다.** 계획의 어느 태스크도 DB 명령을 돌리지 않는다 — 개발 DB 가 워크트리 사이에서 공유되어, 서브에이전트가 돌리면 다른 브랜치가 머지 전까지 500 이 된다. Task 6 이 파일을 만든 뒤 적용하면 된다.
2. **0037·0038 이 파괴적이라는 것을 확인한다.** 다른 브랜치가 만들어 둔 테스트 흐름도 함께 사라진다.

## 태스크 순서와 컴파일 상태

Task 3 에서 `segments.ts` 가 사라지면 `src/app/` 아래가 **의도적으로 깨진다.** Task 13 이 끝나야 `npx tsc --noEmit` 이 다시 깨끗해진다. 각 태스크는 자기 테스트만 통과시키고 넘어간다.

| 태스크 | 끝난 뒤 `tsc` 상태 |
| --- | --- |
| 1 | `src/lib/saju-core/` 깨끗 |
| 2 | 위 + `score.ts` 깨끗 |
| 3~5 | `src/app/` 깨져 있음 (의도) |
| 6 | `src/lib/` 전부 깨끗 |
| 7~10 | `api/flows/handler.ts` 만 남음 |
| 11 | `src/app/flow/` 만 남음 |
| 12 | `src/app/flow/[id]/` 만 남음 |
| 13 | **전부 깨끗** |
| 14 | 전부 깨끗 + 전체 테스트 통과 |
