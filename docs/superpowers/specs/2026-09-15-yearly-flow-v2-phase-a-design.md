# 한 해의 흐름 v2 — 1단계(A) 설계

작성일: 2026-09-15
상태: 승인된 설계. 구현 플랜은 이 문서에서 나온다.
함께 읽을 문서:
- 플랜 원안 — [2026-09-14-yearly-fortune-v2-handoff.md](../plans/2026-09-14-yearly-fortune-v2-handoff.md)
- 프롬프트 전문 — [2026-09-14-yearly-fortune-v2-prompts.md](../../prompts/2026-09-14-yearly-fortune-v2-prompts.md)
- 시안 — Claude Design `Saju Yearly Report.dc.html` 의 두 번째 시트("지금 상황을 알려주세요")

## 0. 이 문서가 정하는 것

플랜 원안(Task 1~7)을 **두 단계로 자르고**, 1단계(A)의 범위·계약·파일 배치를 확정한다.
원안과 어긋나는 결정은 §1 에 이유와 함께 적는다. 원안이 이미 정한 것(프롬프트 규칙,
출력 스키마 제약, UI 기준, 보존 원칙)은 여기서 반복하지 않고 참조한다.

- **A(이 문서):** 입력 계약 + v2 근거·프롬프트·스키마 + 단일 생성(draft 한 번, 플래그 뒤) + v2 읽기 UI.
- **B(별도 문서):** 검토·교정 루프, lease·phase API·진행 클라이언트, 기존 v1 구매자의 "새 구성으로 다시 보기", 회귀 문장 평가.

A 만으로 실제 문장 품질과 지연을 잴 수 있다. B 의 모양(분할 호출인지, 모델 교체인지,
단계 API 가 정말 필요한지)은 A 의 실측을 보고 정한다.

## 1. 원안과 다르게 정한 것

| 주제 | 원안 | 이 문서 | 이유 |
|---|---|---|---|
| 범위 | Task 1~7 한 번에 | A/B 두 단계 | A 가 끝나야 B 의 핵심 가정(45초 안에 전체 초안)을 검증할 수 있다 |
| 연애 선택지 | 4개(single·dating·partnered·unspecified) | **6개** — 시안의 썸·복잡해요를 살린다 | 시안이 먼저 확정됐다. 프롬프트 enum 과 취급 규칙을 6개로 넓힌다(§4) |
| 직업 선택지 | 9개(other 포함) | **8개** — 가사·돌봄은 넣고 `other` 는 뺀다 | `other`(여기에 해당하지 않아요)는 프롬프트 취급이 unspecified 와 같다. 분석용 구분밖에 안 되고 시안에도 없다 |
| 세 번째 질문 | mainConcern 있음 | **있음** — 시안에 칩 한 줄을 추가한다 | 출력의 `focusDomain` 과 월별 강조를 사용자 입력으로 받는 유일한 자리 |
| `reference` | 클라이언트가 보내고 서버가 대조, 입춘 경계 불일치면 거절 | **서버가 파생**, 클라이언트는 문구만 바꿔 보여준다 | 클라이언트가 안 보내면 대조할 것도, 불일치 시나리오도 없다 |
| 답변 필수 여부 | 건너뛰기 가능 | 세 줄 **모두 골라야** 제출. "말하고 싶지 않아요" 가 곧 unspecified | 시안의 동작. 안 물어본 것(옛 흐름)과 답하지 않은 것을 구분하려는 원안의 의도는 값으로 보존된다 |
| 시트 순서 | 상황 → 구매 확인 | **결제 시트 → 상황 시트** (시안) | 원안이 이 순서를 요구한 이유(답변이 저장·사용된다는 안내를 구매 전에)는 상황 시트 안의 안내 한 줄로 채운다 |
| 상황 저장 위치 | revision 의 `context_snapshot` | **같음.** 2026-09-14 커밋의 `flows.situation` 컬럼과 v1 `[상황]` 블록은 **걷어낸다** | 상황은 revision 의 속성이다. 두 곳에 있으면 어느 쪽이 진짜인지 규칙이 또 필요하다. v1 프롬프트는 원안대로 건드리지 않는다 |
| A 의 실행 위치 | phase API(`advance`) | **v1 과 같이 `flow/[id]/page.tsx` 의 Suspense 안**에서 단일 호출 | A 는 호출이 한 번이라 60초 예산 안이다. B 가 phase API 로 옮기며 이 경로를 지운다(50줄 안팎) |

## 2. 어제(2026-09-14) 커밋 `2c8c169` 과의 관계

브랜치 `feat/flow-situation` 에만 있고 main 에 없다. 마이그레이션도 안 돌렸다. **히스토리를 고쳐 쓰지 않고 위에 커밋을 얹어** 되돌린다.

| 어제 | 이번 |
|---|---|
| `src/lib/flows/situation.ts` (+test) | `src/lib/flows/context.ts` (+test)로 대체. 삭제 |
| `migrations/0045_flows_situation.sql` | 삭제. 0045~0047 을 revision 용으로 새로 쓴다(§5) |
| `flows.situation` 컬럼, `FlowRow.situation`, `CreateFlowInput.situation` | 삭제 |
| `buildFlowContext(…, situation)` 4번째 인자, `flowFacts` 의 `[상황]` 블록 | 삭제. v1 facts 는 커밋 전 모양으로 |
| `handler.ts` 의 `situation` 필드 | `context` 필드로 대체(§6) |
| `FlowConfirm` 의 `SituationModal`(칩 2줄) | 칩 3줄 + 문구 분기 + 안내 줄, `v2Enabled` 일 때만(§9) |

## 3. 입력 계약 — `src/lib/flows/context.ts`

클라이언트·API·프롬프트가 같은 정의역을 보는 유일한 출처. DB·환경변수를 import 하지 않는 순수 모듈.

### 선택지

```ts
export const CAREER_OPTIONS = [
  { value: "employed",     label: "직장인" },
  { value: "freelance",    label: "프리랜서" },
  { value: "business",     label: "자영업 · 사업" },
  { value: "student",      label: "학생" },
  { value: "preparing",    label: "취업 · 진로 준비 중" },
  { value: "taking_break", label: "잠시 쉬는 중" },
  { value: "home_care",    label: "가사 · 돌봄" },
  { value: "unspecified",  label: "말하고 싶지 않아요" },
] as const;

export const RELATIONSHIP_OPTIONS = [
  { value: "single",      label: "솔로" },
  { value: "crushing",    label: "썸" },
  { value: "dating",      label: "연애 중" },
  { value: "partnered",   label: "기혼 · 파트너" },
  { value: "complicated", label: "복잡해요" },
  { value: "unspecified", label: "말하고 싶지 않아요" },
] as const;

export const CONCERN_OPTIONS = [
  { value: "career",        label: "일" },
  { value: "money",         label: "돈" },
  { value: "romance",       label: "연애" },
  { value: "relationships", label: "대인관계" },
  { value: "overall",       label: "전체" },
] as const;
```

enum 은 배열에서 파생한다(어제 `situation.ts` 의 `valuesOf` 와 같은 방식). 저장되는 것은 `value`, 라벨은 화면과 프롬프트 문서가 각자 표에서 꺼내 쓴다.

### 클라이언트가 보내는 것

```ts
export const contextAnswerSchema = z.object({
  career: z.enum(CAREER),
  relationship: z.enum(RELATIONSHIP),
  mainConcern: z.enum(CONCERN),
}).strict();
export type ContextAnswer = z.infer<typeof contextAnswerSchema>;
```

세 필드 모두 필수다 — 시트가 세 줄을 다 골라야 열리므로 부분 응답은 정상 경로에서 나오지 않는다. `reference`·`asOf` 는 받지 않는다(strict 라 보내면 400).

### 서버가 만드는 것

```ts
export type YearRelation = "past" | "present" | "future";
export type ContextReference = "selected_year_start" | "current_baseline" | "unspecified";

export interface ContextSnapshot {
  career: Career;
  relationship: Relationship;
  mainConcern: Concern;
  reference: ContextReference;
  asOf: string; // ISO, 서버 시각
}

export function yearRelationOf(flowYear: number, now: Date): YearRelation;
// flowYearAt(now).year 와 비교. 클라이언트의 지난/올해/다가올 태그와 같은 출처(saju-core).

export function normalizeFlowContext(
  answer: ContextAnswer | undefined,
  opts: { relation: YearRelation; now: Date },
): ContextSnapshot;
```

규칙:
- `answer` 가 없으면 career·relationship = `unspecified`, mainConcern = `overall`, reference = `unspecified`.
- career 또는 relationship 이 `unspecified` 가 아니면 reference = `relation === "past" ? "selected_year_start" : "current_baseline"`. 둘 다 unspecified 면(mainConcern 만 답해도) `unspecified`.
- asOf = `opts.now.toISOString()`.

### 화면 제목

```ts
export function careerTitle(c: Career): "직업운" | "학업운" | "취업·진로운" | "일과 활동";
// employed·freelance·business → 직업운, student → 학업운, preparing → 취업·진로운, 나머지 → 일과 활동
```

## 4. 프롬프트 문서에 추가하는 규칙

`docs/prompts/2026-09-14-yearly-fortune-v2-prompts.md` 를 코드와 함께 고친다. `promptBundleVersion = 1` 은 그대로(아직 운영에 나간 적 없다).

- §3 `careerSituation` 에서 `other` 제거, `relationshipSituation` 을 6개로.
- §5 `relationshipSituation 적용` 에 두 줄 추가:
  - `crushing`: 진행 중인 새 만남으로 다룬다. 서로의 마음을 확인하는 속도·표현·거리. 사귀게 된다고도, 흐지부지된다고도 결론을 몰지 않는다.
  - `complicated`: 관계 상태를 단정하지 않는다. 새 만남·현재 관계 어느 쪽도 전제하지 말고 unspecified 처럼 조건부로 쓰되, "지금 정리가 필요한 관계가 있을 수 있다" 는 사실은 예시 선택에 쓸 수 있다.
- §8 검토 코드 `context_mismatch` 의 예에 "crushing 에게 배우자를 전제, complicated 에게 특정 상대를 전제" 를 덧붙인다.
- 문체 예시(§7)는 그대로 — 예시 3종의 상황이 새 값을 쓰지 않는다.

## 5. 저장 — revision

### 마이그레이션

`migrations/README.md` 규칙(파일 하나에 문장 하나, 번호는 0045 부터)을 따른다. 어제의 `0045_flows_situation.sql` 은 삭제한다.

- `0045_flow_report_revisions.sql` — 테이블 생성. 원안 §6 의 컬럼 **전부**를 처음부터 만든다. A 가 안 쓰는 컬럼(`working_payload`·`review_payload`·`lease_*`·`admitted_at`)은 nullable 로 비워 둔다 — B 에서 ALTER 를 또 하지 않으려고.
  - `phase text NOT NULL CHECK (phase IN ('draft','review','repair','review_repaired','complete','failed'))`
  - `format_version integer NOT NULL DEFAULT 2`, `prompt_bundle_version integer NOT NULL`
  - `idempotency_key text NOT NULL`, `request_hash text NOT NULL`
  - `context_snapshot jsonb NOT NULL`, `input_snapshot jsonb NOT NULL`, `months_snapshot jsonb NOT NULL`
  - `flow_id bigint NOT NULL REFERENCES flows(id) ON DELETE CASCADE`
- `0046_flow_report_revisions_pending_unique.sql` — `CREATE UNIQUE INDEX … ON flow_report_revisions (flow_id) WHERE phase NOT IN ('complete','failed')`. 한 flow 에 미완성 시도 하나.
- `0047_flow_report_revisions_flow_unique.sql` — `UNIQUE (flow_id, idempotency_key)`.
- `0048_flows_active_revision.sql` — `ALTER TABLE flows ADD COLUMN active_revision_id bigint REFERENCES flow_report_revisions(id) ON DELETE SET NULL`.
- README 의 "다음 번호" 를 0049 로.

### 저장소 — `src/lib/flows/revisions.ts`

기존 `SqlClient`(태그 템플릿, 문장 하나) 계약 안에서 쓴다. 테스트는 `store.test.ts` 의 `fakeSql` 방식.

```ts
export interface FlowRevisionRow { id; flowId; formatVersion; promptBundleVersion; idempotencyKey; requestHash;
  contextSnapshot: ContextSnapshot; inputSnapshot: FlowGenerationInput; monthsSnapshot: FlowMonth[];
  phase: RevisionPhase; publishedPayload: FlowReportV2 | null; validationErrors: unknown | null;
  model: string | null; usageSummary: unknown | null; failureCode: string | null;
  createdAt; updatedAt; publishedAt: Date | null }

createPendingRevision(flowId, input): Promise<{ revision; created: boolean }>
//  INSERT … ON CONFLICT (flow_id) WHERE phase NOT IN ('complete','failed') DO NOTHING RETURNING *
//  충돌하면 기존 pending 을 SELECT 해 돌려준다(findOrCreateFlow 와 같은 모양). 되찾지 못하면 던진다.
findPendingRevision(flowId)
findLatestRevision(flowId)          // 실패 재시도가 스냅샷을 베낄 원본
getActiveRevision(flowId)           // flows.active_revision_id JOIN, revision.flow_id = flows.id 조건 포함
publishRevision(revisionId, flowId, { payload, model, usage }): Promise<boolean>
//  WITH r AS (UPDATE flow_report_revisions SET phase='complete', published_payload=…, published_at=now(), updated_at=now()
//             WHERE id=$1 AND flow_id=$2 AND phase='draft' RETURNING id, flow_id)
//  UPDATE flows SET active_revision_id = r.id FROM r WHERE flows.id = r.flow_id RETURNING flows.id
//  문장 하나라 원자적이다. 0행이면 false — 다른 요청이 먼저 끝냈거나 이미 failed 다.
failRevision(revisionId, { failureCode, validationErrors }): Promise<boolean>   // WHERE phase='draft'
```

`request_hash` = sha256(canonical JSON of { flowYear, contextSnapshot 에서 asOf 를 뺀 것, inputSnapshot, FLOW_CALC_VERSION, promptBundleVersion }). `FLOW_CALC_VERSION = 1` 은 `v2/facts.ts` 의 상수 — 절기·PIVOT_THRESHOLD·라벨 경계가 바뀔 때 올린다.

`idempotency_key` 는 A 에선 서버가 `crypto.randomUUID()` 로 만든다. B 가 클라이언트 `requestId` 로 바꿀 때 컬럼은 그대로다.

### flows 와의 관계

- `flows` 의 `(profile_id, flow_year)` 유일성과 flowId, 이용권 단위(`subjectKey = flowId`)는 그대로.
- `POST /api/flows` 가 flow 행을 만들거나 찾은 **다음** pending revision 을 만든다(§6). 두 INSERT 가 별 문장이라 사이에서 죽으면 "flow 는 있는데 revision 이 없는" 상태가 생길 수 있다 — 그 flow 를 열면 v1 경로로 떨어지지 않도록, **읽기 쪽이 "revision 이 하나도 없고 flow_sections 도 없는 flow" 를 v2 실패 화면(재시도)으로 다룬다**(§8). 재시도 endpoint 가 pending 을 다시 만든다.
- 같은 (profile, year) 재요청은 기존 flow 로 수렴하고, pending 이 있으면 그것을 돌려주며, 기존 revision 의 context 를 덮지 않는다.

## 6. API

### `POST /api/flows` (기존, 확장)

```ts
Input = z.object({ profileId, year, context: contextAnswerSchema.optional() }).strict()
```

- 플래그(§10)가 꺼져 있으면: `context` 가 오면 400 `{ error: "flow_v2_disabled" }`. 없으면 지금과 똑같이 v1 flow 만 만든다.
- 켜져 있으면: 기존 검증(연도 범위·접근·프로필·출생 전 연도) 뒤
  1. `findOrCreateFlow` (지금과 같음, `situation` 없음)
  2. `relation = yearRelationOf(year, now)`, `snapshot = normalizeFlowContext(context, { relation, now })`
  3. `evidence = buildFlowEvidence(analysis, year, months)`, `input = buildFlowGenerationInput(...)`
  4. `createPendingRevision(flowId, { snapshot, input, months, requestHash, idempotencyKey, promptBundleVersion })`
  5. `{ id: flowId }` 를 201/200 으로 — 응답 모양은 지금과 같다. 클라이언트는 `/flow/[id]` 로 간다.
- context 없이 플래그만 켜진 요청(옛 클라이언트)도 **v2** 다 — 플래그가 상품 버전을 정하고, 답변 유무는 스냅샷 값만 정한다.
- 이미 active revision 이 있는 flow(발행 완료)에 다시 POST 하면 pending 을 만들지 않고 `{ id }` 만 돌려준다. "상황 바꿔 다시 보기" 는 B.

### `POST /api/flows/[id]/revisions` (신규, A 는 최소 의미)

본문 `{}`. 소유권(`getFlow(userId, id)`) 확인 뒤:
- pending 이 있으면 200 `{ revisionId }`.
- 최신 revision 이 `failed` 면 그 `context_snapshot`·`input_snapshot`·`months_snapshot` 을 베껴 새 pending 을 만들고 201.
- revision 이 하나도 없고 flow_sections 도 없으면(§5 의 반쪽 상태) 스냅샷을 새로 계산해 pending 을 만들고 201. 이때 context 는 `normalizeFlowContext(undefined, …)`.
- 그 외(v1 흐름, active 가 있고 실패도 없음)는 409 `{ error: "flow_v2_not_applicable" }`. 업그레이드는 B.
- LLM 호출·과금 없음. 생성은 페이지가 한다.

B 가 이 endpoint 에 `{ context, requestId }` 를 얹는다. 경로 이름을 원안과 맞춘 이유다.

### `GET` 상태 조회 endpoint 는 A 에 없다

원안의 `GET …/revisions/[revisionId]` 는 진행 클라이언트(B)를 위한 것이다. A 는 서버 렌더 한 번으로 끝난다.

## 7. 근거·프롬프트·스키마 — `src/app/api/flows/_lib/v2/`

| 파일 | 내보내는 것 | 비고 |
|---|---|---|
| `facts.ts` | `FLOW_CALC_VERSION`, `buildFlowEvidence(analysis, flowYear, months): Evidence` | v1 `prompt/facts.ts` 의 라벨 함수(`supportLabel`·`frictionLabel`·`deltaPhrase`·`distributionLabel`·`daeunPhaseOf`)를 **export 해서 재사용**한다. 복사하지 않는다 |
| `input.ts` | `buildFlowGenerationInput({ flowYear, relation, snapshot, evidence, months }): FlowGenerationInput` | `request.careerTitle` 은 `careerTitle(snapshot.career)` |
| `schema.ts` | `flowReportV2Schema`, `FlowReportV2`, `flowReportToolSchema()` | `z.toJSONSchema` (v1 `derive.ts` 와 같은 변환기). 원안 §6 의 길이·개수 제약을 Zod 에 |
| `references.ts` | `validateReferences(report, evidence): string[]` | basisRefs ⊆ availableFactIds, monthLinks 달 중복, closing.sourceKeys 자기 참조. 빈 배열이면 통과 |
| `prompts.ts` | `FLOW_REPORT_SYSTEM_V2`, `buildFlowReportUserV2(input): string`, `FLOW_REPORT_TOOL_NAME = "emit_flow_report"` | 프롬프트 문서 §4·§5·§7 을 그대로. 입력은 `JSON.stringify(input, null, 2)` 로만 |
| `presentation.ts` | `toPublicFlowReportV2(report, { careerTitle }): PublicFlowReportV2` | 공개 필드만 **명시적으로 골라** 새 객체. spread 뒤 delete 금지. 테스트가 `interpretation`·`basisRefs`·`sourceKeys` 부재를 확인 |
| `generator.ts` | `generateFlowReportV2(input, transport): Promise<GenerateResult>`, `createFlowReportTransport(env)` | §8 |
| `__fixtures__/reports.ts` | `makeValidFlowReportFixture()`, `makeEvidenceFixture()` | 7섹션·12개월·실제 근거 ID |

### evidence 의 사실 ID (안정적인 이름)

| kind | id | value |
|---|---|---|
| natal | `natal.dayMaster`, `natal.strength`, `natal.elements`, `natal.yongsin` | v1 `[연간]` 앞 네 줄과 같은 라벨 |
| annual | `annual.pillar`, `annual.stemGroup`, `annual.branchGroup`, `annual.support`, `annual.friction` | 간지 한글, 천간·지지의 십성 그룹(`month-scores` 가 쓰는 `groupOf` 재사용), 연평균 라벨 |
| cycle | `cycle.daeun`, `cycle.daeunPhase`, `cycle.daeunSwitch`(전환 있을 때만) | v1 과 같은 값. 라벨에 "여러 해에 걸쳐 유지" 표시는 프롬프트 §4 가 맡는다 |
| aggregate | `aggregate.monthlyObservedGroups` | v1 `year.tenGods`. **"관측된 그룹의 합집합"** 으로만 명명 |
| change | `change.pivotMonths` | `[]` 이면 빈 배열 그대로 — 줄을 빼지 않는다 |
| month | `month.NN.support`, `.friction`, `.groups`, `.groupsChanged`(변화 있을 때만), `.interactions`(있을 때만), `.samhap`(true 일 때만), `.vsPrev`(첫 달 제외) | NN 은 두 자리(01‥12). `months[].factIds` 는 그 달의 ID 만 |

`availableFactIds` 와 `pivotMonths` 는 `facts`·`months` 에서 파생한다. 테스트가 ID 유일성, `months` 12개·순번 일치·pivot 일치, `pivotMonths=[]` 인 해에도 `change.pivotMonths` 가 있음을 고정한다.

## 8. 생성 — 단일 호출

### 전송

`createFlowReportTransport(env)` = `createDeepSeekTransport({ apiKey, model: MODEL, retries: 0, timeoutMs: 45_000, onUsage })`. v1 의 `PromptedFlowGenerator`(SECTION_ATTEMPTS=2)는 쓰지 않는다. 한 시도 = HTTP 요청 한 번.

`onUsage` 로 받은 값을 `usage_summary` 에 넣는다. 전송이 usage 를 안 주면 null.

### 결과

```ts
type GenerateResult =
  | { ok: true; report: FlowReportV2; usage: unknown }
  | { ok: false; code: "transport" | "timeout" | "schema" | "references"; errors: unknown };
```

- 응답은 `unknown` 으로 받는다. v1 의 `unwrapContent`(`content` 필드 꺼내기)를 쓰지 않는다 — tool 인자 자체가 report 다.
- `schema` → Zod 실패(이슈 목록), `references` → `validateReferences` 의 오류 목록. 둘 다 `validation_errors` 에 저장하고 `failed`. **교정 호출은 없다**(B).
- 로그에는 revision ID·code·소요 ms·usage 만. 본문·입력·출생정보는 남기지 않는다.

### 실행 자리 — `src/app/flow/[id]/page.tsx`

v1 의 `FlowSections` 와 나란히 `FlowReportV2Sections` 를 `<Suspense>` 안에 둔다. 순서:

1. 한도 — `checkFlowLimit(userId)`. 걸리면 `FlowRateLimited`(기존).
2. 권한·차감 — `spendTicket({ userId, feature: "yearly_flow", subjectKey: flowId })`. `entitlements_unique` 가 재차감을 막는다(v1 `chargeFlowGeneration` 과 같은 근거). 잔액 부족이면 `FlowOutOfTickets`(기존).
3. 모델 — `generateFlowReportV2`.
4. 성공 → `publishRevision`. false(다른 탭이 먼저 끝냄)면 `getActiveRevision` 을 다시 읽어 그것을 그린다.
5. 실패 → `failRevision`, `FlowErrorV2`(재시도 버튼).

v1 의 `gateFlowGeneration`/`chargeFlowGeneration` 은 `FlowGenerator` 인터페이스(섹션 단위)를 감싸므로 그대로 못 쓴다. **순서(한도→권한→모델)와 근거를 같은 자리에 주석으로 옮기고**, 순수 함수 `runFlowReportV2({ revision, deps })` 로 빼서 "한도 초과에서 모델이 안 불린다", "차감 실패에서 모델이 안 불린다", "발행이 false 면 active 를 다시 읽는다" 를 테스트한다.

두 탭이 같은 pending 을 동시에 돌리면 모델 호출은 두 번 나가지만 발행은 한 번이다. A 는 이걸 받아들인다(v1 도 같은 창이 있다). lease 는 B.

## 9. UI

### 선택 화면 — `src/app/flow/_components/FlowConfirm.tsx`

- prop `v2Enabled: boolean` 추가. `flow/page.tsx` 가 플래그를 읽어 넘긴다.
- 꺼져 있으면 지금(어제 이전)과 같다: 결제 시트 "이용권으로 열기" 가 곧 `POST /api/flows`.
- 켜져 있으면 결제 시트 확정 → `SituationSheet`(어제의 `SituationModal` 을 고쳐 씀):
  - 칩 3줄: 현재 직업(8) · 연애 상태(6) · 가장 궁금한 것(5). 옵션은 `context.ts` 에서.
  - 부제 문구는 연도 관계로 분기. `YearOption.tag` 가 "지난" 이면 "선택한 해가 시작될 무렵의 상황을 알려주세요. 기억이 정확하지 않아도 괜찮아요." 아니면 "지금의 상황을 기준으로 설명을 맞춰요. 그해 내내 같은 상황이라고 보진 않아요."
  - 안내 한 줄(작은 글씨): "답변은 이 리포트를 쓰는 데만 쓰이고, 리포트와 함께 저장돼요."
  - 세 줄 다 골라야 "리포트 만들기" 가 열린다. 요청은 여기서 한 번 — `{ profileId, year, context }`.
  - 시트는 열릴 때마다 새로 마운트되므로 프로필·연도를 바꾸면 답이 남지 않는다(테스트로 고정).
  - 실패 문구(402·429·401)는 어제와 같이 이 시트 안에.

### 결과 화면 — `src/app/flow/[id]/page.tsx`

분기를 순수 함수로 뺀다: `resolveFlowRoute({ flow, active, pending, latest, hasV1Sections }): "v2:published" | "v2:generate" | "v2:failed" | "v1"`.

1. `active` 가 있으면 → `v2:published`
2. `pending` 이 있으면 → `v2:generate`
3. `latest` 가 `failed` 면 → `v2:failed`
4. revision 이 하나도 없고 v1 섹션도 없고 `created_at` 이 플래그 도입 이후… 는 **판별하지 않는다.** 대신: revision 이 없고 `flow_sections` 도 없으면 → `v2:failed` 로 다루되 화면 문구는 "준비하지 못했어요. 다시 시도해 주세요"(재시도 endpoint 가 §6 의 세 번째 규칙으로 pending 을 만든다). v1 흐름은 열람 시점에 항상 섹션이 생기므로 이 조건에 안 걸린다. 단, v1 흐름을 만들고 **한 번도 안 연** 사용자는 여기 걸린다 → 재시도 endpoint 가 v2 pending 을 만들어 v2 로 간다. 플래그가 켜진 뒤라면 그게 맞는 결과다. 플래그가 꺼져 있으면 재시도 endpoint 도 400 `flow_v2_disabled` 를 주고, 페이지는 v1 경로로 간다.
5. 그 외 → `v1` (지금 그대로)

`hasV1Sections` 는 `getFlowSections(flowId, FLOW_SECTION_KEYS)` 의 `have` 가 비어 있지 않은지로 본다.

### v2 렌더 — `src/app/flow/[id]/_components/`

- `FlowHeroV2`: 프로필·해·기간(`FlowChrome` 재사용) + overview.headline.
- `FlowBodyV2`: 원안 §7 그대로 —
  - overview.body (headline 반복 없음)
  - 4개 `DomainCard`(제목은 `careerTitle` 등 화면이 붙임 → headline → 기회 / 주의할 점 / 이렇게 해보세요 → monthLinks 는 `#month-NN` 앵커 + `flow.months` 의 기간 표기). 기본 펼침.
  - months: 기존 `MonthTimeline` 의 기간 표기·현재 달 강조를 재사용하되 v2 텍스트 구조(headline·body·action·focusDomain 뱃지)를 받는 변형이 필요하면 `MonthTimelineV2` 로 분리. 각 카드에 `id="month-NN"`.
  - pivot 없음: "큰 전환점으로 따로 표시한 달은 없어요. 달마다 주의할 점은 아래에서 확인하세요."
  - closing: 항목 3개만.
  - 하단 고정 문구 1회: "사주를 바탕으로 한 해석이에요. 실제 선택은 현재 상황과 확인 가능한 정보를 함께 살펴 결정해 주세요."
  - 정보 기준 표시: reference 에 따라 "지금 상황을 참고했어요" / "선택한 해 초의 상황을 참고했어요" / (unspecified 면 표시 없음).
  - CTA 3종은 화면 코드: career → `/consult?profile=…` "내 상황 더 이야기하기", romance → `/match` "궁합 보기", relationships → `/map` "관계 지도 보기". 기존 링크의 로그인·next 처리 그대로.
- `FlowErrorV2`: 문구 "운세를 완성하지 못했어요. 다시 시도해 주세요. 이미 사용한 이용권은 다시 차감되지 않아요." + 재시도 버튼(`POST /api/flows/[id]/revisions` → `router.refresh()`).
- v1 `FlowBody` 의 무-변곡점 문구를 위와 같은 중립 문구로 바꾼다. 저장된 v1 본문은 손대지 않는다.
- 공개 DTO 는 `toPublicFlowReportV2` 결과만 클라이언트 컴포넌트로 내려간다. 서버 컴포넌트가 `FlowReportV2` 전체를 props 로 넘기지 않는다(넘기면 RSC 페이로드에 실린다).

## 10. 플래그

`src/lib/flows/v2-flag.ts`: `export const flowReportV2Enabled = () => process.env.FLOW_REPORT_V2_ENABLED === "true"`. `.env.example` 에 주석과 함께 추가(기본 없음 = 꺼짐).

- 켜짐: 신규 `POST /api/flows` 는 전부 v2(§6). 선택 화면에 상황 시트. 재시도 endpoint 동작.
- 꺼짐: `context` 400, 시트 없음, 재시도 endpoint 400. **이미 발행된 v2 revision 은 계속 읽힌다**(`resolveFlowRoute` 의 1번 규칙은 플래그를 안 본다). pending 상태로 남은 revision 은 플래그가 꺼져 있으면 생성하지 않고 `v2:failed` 화면(재시도 400 이므로 문구를 "지금은 새 구성을 만들 수 없어요" 로).

## 11. 테스트

| 모듈 | 고정하는 것 |
|---|---|
| `context.test.ts` | 원안 Task 1 의 세 테스트(정규화·과거 연도·제목) + reference 파생 규칙 4경우 + strict 거부 |
| `v2/facts.test.ts` | ID 유일·months 12·pivot 일치·`change.pivotMonths=[]` 존재·`monthlyObservedGroups` 이름 |
| `v2/schema.test.ts` | fixture 통과, 길이 경계, months 12·유일·오름차순, closing 3, 추가 필드 거부 |
| `v2/references.test.ts` | 없는 ID·monthLinks 중복·sourceKeys=closing 거부 |
| `v2/prompts.test.ts` | 입력 JSON 이 그대로 실림, 예시 3종 포함, 치환용 자리표시자(`{{`·`[TODO`) 없음 |
| `v2/presentation.test.ts` | 내부 필드 부재, careerTitle 반영 |
| `v2/generator.test.ts` | 성공/timeout/schema/references 네 결과, transport 1회 호출, `content` 언랩 안 함 |
| `revisions.test.ts` | pending 충돌 수렴, publish 의 조건(phase=draft, flow_id 일치), 0행 false, fail 은 draft 만 |
| `handler.test.ts` | 플래그 꺼짐+context→400, 켜짐+context 없음→v2 pending, 켜짐+context→snapshot 배선, 기존 v1 테스트 유지 |
| `revisions route` | 소유권, failed→새 pending(스냅샷 복사), 반쪽 flow→새 계산, v1→409 |
| `run-flow-report-v2.test.ts` | 한도→권한→모델 순서, 각 단계 실패에서 뒤가 안 불림, publish false→active 재조회 |
| `resolve-flow-route.test.ts` | 5경우 |
| `FlowConfirm.test.tsx` | 플래그별 시트 유무, 세 줄 다 골라야 활성, 프로필/연도 변경 시 초기화, 지난 해 문구 |
| `to-public`/`FlowBodyV2.test.tsx` | 7섹션 순서·상황별 제목·앵커·무-변곡점 문구·CTA 경로 |

수동·실측(A 완료 보고에 남긴다):
- 개발 DB 에 0045~0048 적용(공유 DB 라 **적용 전 확인**을 받는다 — 전부 additive).
- 플래그 켜고 실제 DeepSeek 로 3~5개 프로필·연도 생성: 소요 시간, 검증 통과율, `validation_errors` 의 종류. 이 숫자가 B 의 설계 입력이다.
- `npm run typecheck`, `npm run lint`(이번 변경 파일만 0 error), `npx vitest run`, `npm run build`.

## 12. 리스크

- **DeepSeek 가 7섹션+12개월 strict tool 응답을 45초 안에 내는가.** 모른다. A 의 실측이 답한다. 안 되면 B 에서 분할 호출(일관성 손실)이나 모델 교체를 검토한다 — 이 문서는 어느 쪽도 정하지 않는다.
- 글자수 제약(JS `length`)이 한국어에 빡빡하면 `schema` 실패가 잦다. 실패는 이용권을 안 깎지만 시간당 한도를 먹는다. 실측에서 실패 분포를 보고 제약을 조정한다(프롬프트 문서와 함께).
- v1 흐름을 만들고 한 번도 안 연 사용자가 플래그 켜진 뒤 열면 v2 로 간다(§9 4번). 의도된 동작이지만 알고 있어야 한다.

## 13. B 로 미루는 것(다시 적어 둔다)

검토(`review_flow_report`)·교정 루프, lease·`advance` phase API·`GET` 상태 조회·`FlowGenerationProgress`, 클라이언트 `requestId`/idempotency, "상황 바꿔 다시 보기"·기존 v1 구매자 업그레이드, 회귀 문장 평가 체크리스트, `usage_summary` 기반 원가 보고.
