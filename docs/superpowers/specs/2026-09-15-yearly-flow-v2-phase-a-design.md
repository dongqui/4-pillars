# 한 해의 흐름 v2 — 1단계(A) 설계

작성일: 2026-09-15 (검토 반영 2026-09-16)
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
| **공개본의 검토 여부** | 검토 통과한 7섹션만 공개 | **A 는 미검토 draft 를 발행한다.** 스키마·참조 검증만 통과한 본문이 `published_payload` 에 들어간다 | 검토 루프가 B 다. 그래서 A 의 플래그는 **내부·실측 계정에서만** 켠다. B 는 `review_payload IS NULL` 을 "미검토 발행" 의 정의로 삼아 A 시기 행을 구분한다(§5) |
| 연애 선택지 | 4개(single·dating·partnered·unspecified) | **6개** — 시안의 썸·복잡해요를 살린다 | 시안이 먼저 확정됐다. 프롬프트 enum 과 취급 규칙을 6개로 넓힌다(§4) |
| 직업 선택지 | 9개(other 포함) | **8개** — 가사·돌봄은 넣고 `other` 는 뺀다 | `other`(여기에 해당하지 않아요)는 프롬프트 취급이 unspecified 와 같다. 분석용 구분밖에 안 되고 시안에도 없다 |
| 세 번째 질문 | mainConcern 있음 | **있음** — 시안에 칩 한 줄을 추가한다 | 출력의 `focusDomain` 과 월별 강조를 사용자 입력으로 받는 유일한 자리 |
| `reference` | 클라이언트가 보내고 서버가 대조, 입춘 경계 불일치면 거절 | **서버가 파생**, 클라이언트는 문구만 바꿔 보여준다 | 클라이언트가 안 보내면 대조할 것도, 불일치 시나리오도 없다 |
| 답변 필수 여부 | 건너뛰기 가능 | 세 줄 **모두 골라야** 제출. "말하고 싶지 않아요" 가 곧 unspecified | 시안의 동작. 안 물어본 것(옛 흐름)과 답하지 않은 것을 구분하려는 원안의 의도는 값으로 보존된다 |
| 시트 순서 | 상황 → 구매 확인 | **결제 시트 → 상황 시트** (시안) | 원안이 이 순서를 요구한 이유(답변이 저장·사용된다는 안내를 구매 전에)는 상황 시트 안의 안내 한 줄로 채운다 |
| pending 이 있는데 다른 답으로 재요청 | 409 | **아직 과금·모델 호출 전(`admitted_at IS NULL`)이면 답을 갈아끼운다.** 그 뒤면 409 | 한도·잔액에 걸려 선택 화면으로 돌아온 사용자가 답을 바꿔 다시 내는 것이 정상 경로다. 409 로 막으면 "이미 만드는 중" 이라는 거짓말이 된다. 갈아끼움은 조건부 UPDATE 하나라 경쟁에 안전하다(§5) |
| UI 문구 | 원안 §7 의 합니다체 문자열 | **해요체.** 원안 문자열은 뜻만 따른다 | 시안과 기존 화면 전부가 해요체다 |
| 상황 저장 위치 | revision 의 `context_snapshot` | **같음.** 2026-09-14 커밋의 `flows.situation` 컬럼과 v1 `[상황]` 블록은 **걷어낸다** | 상황은 revision 의 속성이다. 두 곳에 있으면 어느 쪽이 진짜인지 규칙이 또 필요하다. v1 프롬프트는 원안대로 건드리지 않는다 |
| A 의 실행 위치 | phase API(`advance`) | **v1 과 같이 `flow/[id]/page.tsx` 의 Suspense 안**에서 단일 호출 | A 는 호출이 한 번이라 60초 예산 안이다. B 가 phase API 로 옮기며 이 경로를 지운다(50줄 안팎) |

플래그가 꺼졌을 때의 동작(§10)은 원안 §9 와 **같다** — 새 진입만 막고, 이미 시작한 revision 은 완료·재시도가 된다.

## 2. 어제(2026-09-14) 커밋 `2c8c169` 과의 관계

브랜치 `feat/flow-situation` 에만 있고 main 에 없다. 마이그레이션도 안 돌렸다. **히스토리를 고쳐 쓰지 않고 위에 커밋을 얹어** 되돌린다.

| 어제 | 이번 |
|---|---|
| `src/lib/flows/situation.ts` (+test) | `src/lib/flows/context.ts` (+test)로 대체. 삭제 |
| `migrations/0045_flows_situation.sql` | 삭제. 0045~0048 을 revision 용으로 새로 쓴다(§5) |
| `flows.situation` 컬럼, `FlowRow.situation`, `CreateFlowInput.situation` | 삭제 |
| `buildFlowContext(…, situation)` 4번째 인자, `flowFacts` 의 `[상황]` 블록 | 삭제. v1 facts 는 커밋 전 모양으로 |
| `handler.ts` 의 `situation` 필드 | `context` 필드로 대체(§6) |
| `FlowConfirm` 의 `SituationModal`(칩 2줄) | `SituationSheet`(칩 3줄 + 문구 분기 + 안내 줄), `v2Enabled` 일 때만(§9) |

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

export const CAREER = valuesOf(CAREER_OPTIONS);          // readonly ["employed", …]
export const RELATIONSHIP = valuesOf(RELATIONSHIP_OPTIONS);
export const CONCERN = valuesOf(CONCERN_OPTIONS);
export type Career = (typeof CAREER)[number];
export type Relationship = (typeof RELATIONSHIP)[number];
export type Concern = (typeof CONCERN)[number];
```

`valuesOf` 는 어제 `situation.ts` 의 것과 같다(배열에서 enum 파생). 저장되는 것은 `value`, 라벨은 화면과 프롬프트 문서가 각자 표에서 꺼내 쓴다.

### 클라이언트가 보내는 것

```ts
export const contextAnswerSchema = z.object({
  career: z.enum(CAREER),
  relationship: z.enum(RELATIONSHIP),
  mainConcern: z.enum(CONCERN),
}).strict();
export type ContextAnswer = z.infer<typeof contextAnswerSchema>;

/** 시트의 제출 버튼이 열리는 조건. 셋 다 골랐을 때만 ContextAnswer 다. */
export function isContextComplete(
  partial: { career: Career | null; relationship: Relationship | null; mainConcern: Concern | null },
): partial is ContextAnswer;
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
- 던지는 경우가 없다 — 대조할 클라이언트 값이 없기 때문이다.

### 스냅샷 → 모델 입력의 키 이름

프롬프트 문서 §3 의 `personalContext` 는 `careerSituation`·`relationshipSituation` 이고, 시스템·user 프롬프트 본문이 그 이름을 직접 부른다. 스냅샷은 짧은 이름(`career`·`relationship`)을 쓰고, **`input.ts` 가 매핑한다**(§7). 프롬프트 문서의 키 이름은 바꾸지 않는다.

### 화면 제목

```ts
export function careerTitle(c: Career): "직업운" | "학업운" | "취업·진로운" | "일과 활동";
// employed·freelance·business → 직업운, student → 학업운, preparing → 취업·진로운, 나머지 → 일과 활동
```

## 4. 프롬프트 문서에 추가하는 규칙

`docs/prompts/2026-09-14-yearly-fortune-v2-prompts.md` 를 코드와 함께 고친다. `promptBundleVersion = 1` 은 그대로(아직 운영에 나간 적 없다).

- §3 `careerSituation` 에서 `other` 제거, `relationshipSituation` 을 6개로.
- §5 `careerSituation 적용` 의 "other 또는 unspecified:" 줄을 "unspecified:" 로.
- §5 `relationshipSituation 적용` 에 두 줄 추가:
  - `crushing`: 진행 중인 새 만남으로 다룬다. 서로의 마음을 확인하는 속도·표현·거리. 사귀게 된다고도, 흐지부지된다고도 결론을 몰지 않는다.
  - `complicated`: 관계 상태를 단정하지 않는다. 새 만남·현재 관계 어느 쪽도 전제하지 말고 unspecified 처럼 조건부로 쓰되, "지금 정리가 필요한 관계가 있을 수 있다" 는 사실은 예시 선택에 쓸 수 있다.
- §8 검토 코드 `context_mismatch` 의 예에 "crushing 에게 배우자를 전제, complicated 에게 특정 상대를 전제" 를 덧붙인다.
- §6 스키마 제약에 "monthLinks 의 달 중복 금지는 **한 섹션 안** 기준" 을 명시한다(네 분야가 같은 달을 가리켜도 된다).
- 문체 예시(§7)는 그대로 — 예시 3종의 상황이 새 값을 쓰지 않는다.

## 5. 저장 — revision

### 마이그레이션

`migrations/README.md` 규칙(파일 하나에 문장 하나, 번호는 0045 부터)을 따른다. 어제의 `0045_flows_situation.sql` 은 삭제한다.

- `0045_flow_report_revisions.sql` — 테이블 생성. 원안 §6 의 컬럼 **전부**를 처음부터 만든다. A 가 안 쓰는 컬럼(`working_payload`·`review_payload`·`lease_token`·`lease_expires_at`)은 nullable 로 비워 둔다 — B 에서 ALTER 를 또 하지 않으려고. 컬럼 주석에 `review_payload IS NULL` = 미검토 발행(A 시기), `failure_code` 정의역은 §8 의 코드 5개임을 적는다.
  - `phase text NOT NULL CHECK (phase IN ('draft','review','repair','review_repaired','complete','failed'))`
  - `format_version integer NOT NULL DEFAULT 2`, `prompt_bundle_version integer NOT NULL`
  - `idempotency_key text NOT NULL`, `request_hash text NOT NULL`
  - `context_snapshot jsonb NOT NULL`, `input_snapshot jsonb NOT NULL`, `months_snapshot jsonb NOT NULL`
  - `admitted_at timestamptz` — **A 에서 쓴다.** 이용권 차감이 끝난 시각. 이 값이 있으면 답을 갈아끼울 수 없다(§6).
  - `flow_id bigint NOT NULL REFERENCES flows(id) ON DELETE CASCADE`
- `0046_flow_report_revisions_pending_unique.sql` — `CREATE UNIQUE INDEX flow_report_revisions_pending_unique ON flow_report_revisions (flow_id) WHERE phase NOT IN ('complete','failed')`. 한 flow 에 미완성 시도 하나.
- `0047_flow_report_revisions_key_unique.sql` — `UNIQUE (flow_id, idempotency_key)`.
- `0048_flows_active_revision.sql` — `ALTER TABLE flows ADD COLUMN active_revision_id bigint REFERENCES flow_report_revisions(id) ON DELETE SET NULL`.
- README 의 "다음 번호" 를 0049 로.

프로필·계정 삭제는 기존 연쇄(`profiles → flows`)에 `flows → flow_report_revisions` CASCADE 가 이어지므로 추가 작업이 없다. `flows.active_revision_id` 의 SET NULL 은 revision 을 직접 지우는 경우(운영 수동 정리)에만 의미가 있다.

### 저장소 — `src/lib/flows/revisions.ts`

기존 `SqlClient`(태그 템플릿, 문장 하나) 계약 안에서 쓴다. 테스트는 `store.test.ts` 의 `fakeSql` 방식.

```ts
export type RevisionPhase = "draft" | "review" | "repair" | "review_repaired" | "complete" | "failed";

export interface FlowRevisionRow {
  id: string; flowId: string;
  formatVersion: number; promptBundleVersion: number;
  idempotencyKey: string; requestHash: string;
  contextSnapshot: ContextSnapshot;
  inputSnapshot: FlowGenerationInput;
  monthsSnapshot: FlowMonth[];
  phase: RevisionPhase;
  publishedPayload: FlowReportV2 | null;
  validationErrors: unknown | null;
  model: string | null; usageSummary: unknown | null; failureCode: string | null;
  admittedAt: Date | null;
  createdAt: Date; updatedAt: Date; publishedAt: Date | null;
}
```

jsonb 읽기(`toRevisionRow`): 스냅샷 세 컬럼과 `published_payload` 는 `flows/store.ts` 의 `toMonths` 방식 — 문자열이면 `JSON.parse`, 모양이 아니면 **던진다**(화면이 `.sections` 를 전제로 한다). `validation_errors`·`usage_summary` 는 파싱 실패 시 null. 드라이버가 jsonb 를 파싱된 값으로도 문자열로도 주는 것은 이 레포가 두 곳에서 이미 다루는 사실이다.

```ts
export interface PendingRevisionInput {
  promptBundleVersion: number; idempotencyKey: string; requestHash: string;
  contextSnapshot: ContextSnapshot; inputSnapshot: FlowGenerationInput; monthsSnapshot: FlowMonth[];
}

/**
 * pending 을 만들거나, 같은 입력의 pending 으로 수렴하거나, 아직 과금 전인 pending 의 답을 갈아끼운다.
 *
 *  1. INSERT INTO flow_report_revisions (…)
 *       SELECT … FROM flows
 *        WHERE id = $flowId AND active_revision_id IS NULL
 *          AND NOT EXISTS (SELECT 1 FROM flow_sections WHERE flow_id = flows.id)
 *        FOR UPDATE
 *     ON CONFLICT (flow_id) WHERE phase NOT IN ('complete','failed') DO NOTHING
 *     RETURNING *
 *     — 발행된 flow·v1 본문이 있는 flow 에는 넣지 않는다. FOR UPDATE 가 publishRevision 의
 *       UPDATE flows 와 직렬화되어, active 확인과 INSERT 사이의 틈이 없다.
 *     1행이면 { kind: "created", revision }.
 *  2. 0행이면 pending 을 SELECT. 없으면 { kind: "none" } — 발행됐거나 v1 이거나 방금 닫혔다.
 *     POST /api/flows 는 이 경우에도 { id } 를 돌려준다(500 이 아니다).
 *  3. pending.request_hash === requestHash 면 { kind: "same", revision }.
 *  4. 다르면 UPDATE … SET context_snapshot, input_snapshot, months_snapshot, request_hash, updated_at = now()
 *       WHERE id = pending.id AND phase = 'draft' AND admitted_at IS NULL RETURNING *
 *     1행이면 { kind: "replaced", revision }, 0행이면 { kind: "busy" } — 이미 과금·생성 중.
 */
export function upsertPendingRevision(flowId, input): Promise<
  | { kind: "created" | "same" | "replaced"; revision: FlowRevisionRow }
  | { kind: "none" }
  | { kind: "busy" }
>;

export function findPendingRevision(flowId): Promise<FlowRevisionRow | null>;
export function findLatestRevision(flowId): Promise<FlowRevisionRow | null>;   // created_at DESC LIMIT 1
export function getActiveRevision(flowId): Promise<FlowRevisionRow | null>;
//  SELECT r.* FROM flows f JOIN flow_report_revisions r ON r.id = f.active_revision_id AND r.flow_id = f.id WHERE f.id = $1

/** 과금이 끝났음을 박제하고, 그 시점의 스냅샷을 돌려준다. 이후 upsert 의 4번은 이 행을 못 건드린다. */
export function admitRevision(revisionId): Promise<FlowRevisionRow | null>;
//  UPDATE … SET admitted_at = COALESCE(admitted_at, now()) WHERE id = $1 AND phase = 'draft' RETURNING *
//  ⚠️ 생성기는 페이지가 먼저 읽어 둔 pending 이 아니라 **이 RETURNING 값**의 input_snapshot 으로 돌린다.
//     그래야 "읽은 뒤 갈아끼워진" 답으로 생성하는 일이 없다.

export function publishRevision(revisionId, flowId, { payload, model, usage }): Promise<boolean>;
//  WITH r AS (UPDATE flow_report_revisions SET phase='complete', published_payload=…, model=…, usage_summary=…,
//             published_at=now(), updated_at=now()
//             WHERE id=$1 AND flow_id=$2 AND phase='draft' RETURNING id, flow_id)
//  UPDATE flows SET active_revision_id = r.id FROM r WHERE flows.id = r.flow_id RETURNING flows.id
//  문장 하나라 원자적이다. 0행이면 false — 다른 요청이 먼저 끝냈거나(complete/failed) 없다.

export function failRevision(revisionId, { failureCode, validationErrors, model, usage }): Promise<boolean>;
//  UPDATE … SET phase='failed', … WHERE id=$1 AND phase='draft'. 0행이면 false.
```

### request_hash — `src/lib/flows/request-hash.ts`

`sha256(stableStringify({ flowYear, context: { career, relationship, mainConcern, reference }, evidence, months, calcVersion: FLOW_CALC_VERSION, promptBundleVersion }))`.

- `stableStringify` = 키를 재귀적으로 사전순 정렬한 `JSON.stringify`(배열 순서 유지). 레포에 없어서 이 파일에 둔다. `crypto.createHash("sha256")` hex.
- **`asOf` 는 어디에도 안 들어간다** — `inputSnapshot` 통째가 아니라 위 필드를 열거한다. `inputSnapshot.personalContext.asOf` 가 섞이면 같은 답으로 두 번 요청해도 해시가 달라져 컬럼의 존재 이유가 사라진다.
- `FLOW_CALC_VERSION = 1` 은 `v2/facts.ts` 의 상수 — 절기·PIVOT_THRESHOLD·라벨 경계가 바뀔 때 올린다.
- `idempotency_key` 는 A 에선 서버가 `crypto.randomUUID()` 로 만든다. B 가 클라이언트 `requestId` 로 바꿀 때 컬럼은 그대로다.

### flows 와의 관계

- `flows` 의 `(profile_id, flow_year)` 유일성과 flowId, 이용권 단위(`subjectKey = flowId`)는 그대로.
- **months 의 출처는 항상 저장된 `flows.months`** 다. 새로 계산한 값은 flow 행을 처음 INSERT 할 때만 쓴다. 수렴한 기존 행에서는 저장된 pivot 이 화면(`MonthTimeline`)의 강조와 같은 값이어야 근거와 화면이 안 어긋난다. 그래서 `findOrCreateFlow` 의 반환을 `{ row: FlowRow; created: boolean }` 으로 바꾼다(`RETURNING *`, 충돌 시 `SELECT *`). 기존 호출자·테스트를 함께 고친다.
- flow 는 있는데 revision 이 없는 상태(두 INSERT 사이에서 죽음, 또는 플래그 전에 만들고 한 번도 안 연 v1 흐름)는 **v1 로 간다**(§9). 별도 복구 경로가 없다 — v1 은 열람 시점에 섹션을 만드니 그 자체로 정상 경로다.

## 6. API

### `POST /api/flows` (기존, 확장)

```ts
Input = z.object({ profileId, year, context: contextAnswerSchema.optional() }).strict()

interface CreateFlowDeps {            // 기존 필드에 추가
  v2Enabled: boolean;                 // route.ts 가 flowReportV2Enabled() 를 넣는다. 테스트는 값을 직접 준다
  findOrCreate(userId, input): Promise<{ row: FlowRow; created: boolean }>;
  hasAnyFlowSections(flowId): Promise<boolean>;
  upsertPendingRevision(flowId, input): Promise<UpsertResult>;
  randomUUID(): string;               // 테스트 고정용
}
```

- `v2Enabled === false`: `context` 가 오면 400 `{ error: "flow_v2_disabled" }`. 없으면 지금과 똑같이 v1 flow 만 만든다.
- `v2Enabled === true`: 기존 검증(연도 범위·접근·프로필·출생 전 연도) 뒤
  1. `{ row, created } = findOrCreate(...)` — 지금과 같음(`situation` 없음).
  2. `created === false` 이고 `hasAnyFlowSections(row.id)` 면 **pending 을 만들지 않고** `{ id }` 200. v1 구매본이 있는 flow 다 — 업그레이드는 B.
  3. `relation = yearRelationOf(year, now)`, `snapshot = normalizeFlowContext(context, { relation, now })`.
  4. `evidence = buildFlowEvidence(analysis, year, row.months)`, `input = buildFlowGenerationInput({ flowYear: year, relation, snapshot, evidence, months: row.months })`.
  5. `upsertPendingRevision(row.id, { …, requestHash: requestHashOf(...), idempotencyKey: randomUUID() })`.
     - `created`·`same`·`replaced`·`none` → `{ id: row.id }` 를 `created(flow) ? 201 : 200` 으로. `none` 은 발행됐거나 방금 닫힌 것이라 페이지가 알아서 그린다.
     - `busy` → 409 `{ error: "flow_v2_pending_busy" }`. 시트 문구: "이미 만들고 있는 리포트가 있어요. 잠시 뒤 결과 화면에서 확인해 주세요." + 결과 화면 링크.
- 응답 모양 `{ id }` 는 지금과 같다. 클라이언트는 `/flow/[id]` 로 간다.
- context 없이 플래그만 켜진 요청(옛 클라이언트)도 **v2** 다 — 플래그가 상품 버전을 정하고, 답변 유무는 스냅샷 값만 정한다.

### `POST /api/flows/[id]/revisions` (신규, A 는 재시도 전용)

순수 핸들러 `src/app/api/flows/[id]/revisions/_lib/handler.ts` 의 `handleRetryRevision({ userId, flowId }, deps)`. 본문은 `{}` 만(strict). 플래그를 **보지 않는다** — 이미 이용권을 낸 사용자의 재시도 경로다.

1. 세션 없음 → 401. `getFlow(userId, id)` 없음 → 404(페이지의 `notFound` 와 같은 판단).
2. `getActiveRevision` 있음 → 409 `{ error: "flow_v2_not_applicable" }` (이미 발행됨).
3. `findPendingRevision` 있음 → 200 `{ revisionId }`.
4. `findLatestRevision` 이 `failed` → 그 `context_snapshot`·`input_snapshot`·`months_snapshot`·`prompt_bundle_version`·`request_hash` 를 베껴 `upsertPendingRevision` → 201 `{ revisionId }`. (`none` 이 나오면 그 사이 v1 섹션이 생긴 것 — 409.)
5. 그 외(revision 없음 = v1 흐름) → 409 `{ error: "flow_v2_not_applicable" }`. 업그레이드는 B.
6. LLM 호출·과금 없음. 생성은 페이지가 한다.

B 가 이 endpoint 에 `{ context, requestId }` 를 얹는다. 경로 이름을 원안과 맞춘 이유다.

### `GET` 상태 조회 endpoint 는 A 에 없다

원안의 `GET …/revisions/[revisionId]` 는 진행 클라이언트(B)를 위한 것이다. A 는 서버 렌더 한 번으로 끝난다.

## 7. 근거·프롬프트·스키마 — `src/app/api/flows/_lib/v2/`

| 파일 | 내보내는 것 | 비고 |
|---|---|---|
| `facts.ts` | `FLOW_CALC_VERSION`, `Evidence`, `EvidenceFact`, `buildFlowEvidence(analysis, flowYear, months): Evidence` | v1 `prompt/facts.ts` 의 라벨 함수(`supportLabel`·`frictionLabel`·`deltaPhrase`·`distributionLabel`·`daeunPhaseOf`)를 **export 해서 재사용**한다. 복사하지 않는다. `month-scores.ts` 의 `groupOf` 도 export 한다(지금은 비공개) |
| `input.ts` | `FlowGenerationInput`, `buildFlowGenerationInput({ flowYear, relation, snapshot, evidence, months }): FlowGenerationInput` | `personalContext = { reference, careerSituation: snapshot.career, relationshipSituation: snapshot.relationship, mainConcern, asOf }`. `request.careerTitle = careerTitle(snapshot.career)`, `request.promptBundleVersion = PROMPT_BUNDLE_VERSION` |
| `schema.ts` | `flowReportV2Schema`, `FlowReportV2`, `flowReportToolSchema()` | 프롬프트 문서 §6 의 제약을 Zod 에(아래 분담표). `z.toJSONSchema` 결과에서 **`$schema` 키를 지운** 객체를 돌려준다(v1 `derive.ts` 와 같은 처리 — v2 는 `{ content }` 래핑이 없어 안 지우면 그대로 DeepSeek 로 나간다). `.refine` 제약은 JSON Schema 에 안 실리므로 프롬프트 문장이 보완한다 |
| `references.ts` | `validateReferences(report, evidence): string[]` | availableFactIds 포함 여부만. 빈 배열이면 통과 |
| `prompts.ts` | `PROMPT_BUNDLE_VERSION = 1`, `FLOW_REPORT_TOOL_NAME = "emit_flow_report"`, `FLOW_REPORT_SYSTEM_V2`, `buildFlowReportUserV2(input): string` | 프롬프트 문서 §4·§5·§7 을 그대로. 입력은 `[입력 데이터]` 다음 줄에 `JSON.stringify(input, null, 2)` 로만. 문서의 조립 설명 문구("서버에서 직렬화한 …", "선택된 예시 JSON")는 실제 문자열에 남지 않는다 |
| `presentation.ts` | `PublicFlowReportV2`, `toPublicFlowReportV2(report, { careerTitle, reference }): PublicFlowReportV2` | 공개 필드만 **명시적으로 골라** 새 객체. spread 뒤 delete 금지 |
| `generator.ts` | `GenerateResult`, `generateFlowReportV2(input, transport): Promise<GenerateResult>`, `createFlowReportTransport(env)` | §8 |
| `__fixtures__/reports.ts` | `makeEvidenceFixture()`, `makeValidFlowReportFixture()` | 7섹션·12개월·`makeEvidenceFixture` 의 실제 ID |

### 검증 책임 분담

| 자리 | 검사 |
|---|---|
| Zod (`schema.ts`) | 모든 string 은 `.trim()` 뒤 길이(JS `length`) · enum · 개수 · `months.items` 12개·monthIndex 유일·오름차순 · `basisRefs` 1~6·중복 금지 · `monthLinks` 0~2·**섹션 안** 달 중복 금지 · `closing.items` 3 · `sourceKeys` 1~2·중복 금지·`closing` 은 enum 에서 제외 · strict |
| `references.ts` | 모든 `basisRefs` ⊆ `evidence.availableFactIds` (evidence 가 있어야 하는 유일한 검사) |

### 공개 DTO

```ts
export interface PublicFlowReportV2 {
  careerTitle: string;                       // 화면이 붙일 02 제목. 03~05 는 화면 상수(재물운·연애운·대인운)
  reference: ContextReference;               // "정보 기준" 표시용
  sections: {
    overview: { headline: string; body: string };
    career: PublicDomain; money: PublicDomain; romance: PublicDomain; relationships: PublicDomain;
    months: { lead: string; items: { monthIndex: number; headline: string; focusDomain: FocusDomain; body: string; action: string }[] };
    closing: { items: { title: string; body: string }[] };
  };
}
interface PublicDomain { headline: string; opportunity: string; caution: string; action: string; monthLinks: { monthIndex: number; note: string }[] }
```

`interpretation`·`basisRefs`·`sourceKeys` 는 없다. 테스트가 부재를 확인한다.

### evidence 의 사실 ID

| kind | id | value 타입 |
|---|---|---|
| natal | `natal.dayMaster`, `natal.strength`, `natal.elements`, `natal.yongsin` | 각각 `"癸 (水·陰)"` 같은 문자열, 신강약 문자열, `{ 木: "많음", … }` 객체, `{ yongsin, huisin }` 객체. **성별은 넣지 않는다**(프롬프트가 성별로 역할을 정하지 말라고 한다) |
| annual | `annual.pillar`, `annual.stemGroup`, `annual.branchGroup`, `annual.support`, `annual.friction` | 간지 한글, `TenGodGroup`, `TenGodGroup`, 라벨 문자열, 라벨 문자열 |
| cycle | `cycle.daeun`, `cycle.daeunPhase`, `cycle.daeunSwitch`(전환 있을 때만) | 간지, `"초반"|"중반"|"후반"`, `{ before, after }` |
| aggregate | `aggregate.monthlyObservedGroups` | `TenGodGroup[]` — v1 `year.tenGods`. **"관측된 그룹의 합집합"** 으로만 명명 |
| change | `change.pivotMonths` | `number[]` — `[]` 이면 빈 배열 그대로. 줄을 빼지 않는다 |
| month | `month.NN.support`, `.friction`, `.groups`, `.groupsChanged`(변화 있을 때만), `.interactions`(있을 때만), `.samhap`(true 일 때만), `.vsPrev`(첫 달 제외) | 라벨, 라벨, `TenGodGroup[]`, 문자열, `string[]`, `true`, 문자열. NN 은 두 자리(01‥12). `months[].factIds` 는 그 달의 ID 만 |

`availableFactIds` 와 `pivotMonths` 는 `facts`·`months` 에서 파생한다.

## 8. 생성 — 단일 호출

### 전송

```ts
export function createFlowReportTransport(env): { send: DeepSeekTransport; takeUsage(): unknown }
```

`createDeepSeekTransport({ apiKey, model: MODEL, retries: 0, timeoutMs: 45_000, onUsage })` 를 감싸고, `onUsage` 로 받은 마지막 값을 `takeUsage()` 가 돌려준다. `DeepSeekSectionRequest.key` 는 고정값 `"report"`. v1 의 `PromptedFlowGenerator`(SECTION_ATTEMPTS=2)는 쓰지 않는다. 한 시도 = HTTP 요청 한 번.

`src/app/api/saju/_lib/deepseek.ts` 에서 `DeepSeekTimeoutError`·`DeepSeekHttpError` 를 **export** 한다(지금은 모듈 안에만 있다). 리포트·궁합 쪽 소비자는 영향이 없다.

### 결과

```ts
export type GenerateResult =
  | { ok: true; report: FlowReportV2; usage: unknown }
  | { ok: false; code: "transport" | "timeout" | "http" | "schema" | "references"; errors: unknown; usage: unknown };
```

- 응답은 `unknown` 으로 받는다. v1 의 `unwrapContent`(`content` 필드 꺼내기)를 쓰지 않는다 — tool 인자 자체가 report 다.
- `timeout` = `DeepSeekTimeoutError`, `http` = `DeepSeekHttpError`(`errors: { status }`), `transport` = 그 밖의 throw. **`errors` 에는 `name`·`status` 만 담는다.** `message` 와 응답 본문은 담지 않는다 — DeepSeek 오류 message 에는 모델이 낸 본문 전체가 실릴 수 있다.
- `schema` → Zod 이슈 목록(`{ path, message }[]`), `references` → 빠진 ID 목록. 둘 다 `validation_errors` 에 저장.
- **교정 호출은 없다**(B). `failure_code` 컬럼의 정의역은 위 다섯 코드다.

### 실행 — `src/app/flow/[id]/_lib/run-flow-report-v2.ts`

```ts
export interface RunFlowReportV2Deps {
  checkLimit(userId): Promise<boolean>;                     // checkFlowLimit
  spend(a: { userId; feature: "yearly_flow"; subjectKey }): Promise<SpendResult>;   // spendTicket
  admit(revisionId): Promise<FlowRevisionRow | null>;
  generate(input: FlowGenerationInput): Promise<GenerateResult>;
  publish(...): Promise<boolean>; fail(...): Promise<boolean>;
  getActive(flowId): Promise<FlowRevisionRow | null>;
}
export type RunOutcome =
  | { kind: "rate_limited" } | { kind: "out_of_tickets" }
  | { kind: "published"; revision: FlowRevisionRow }
  | { kind: "failed"; code: GenerateResult["code"] | "gone" };

export function runFlowReportV2(userId, flowId, pendingId, deps): Promise<RunOutcome>;
```

순서(v1 `gateFlowGeneration`/`chargeFlowGeneration` 의 근거를 주석으로 옮긴다 — 그 래퍼는 섹션 단위 `FlowGenerator` 를 감싸므로 그대로 못 쓴다):

1. 한도 — `checkLimit`. false 면 `rate_limited`. 모델을 부르기 전이다.
2. 권한·차감 — `spend`. `entitlements_unique` 가 재차감을 막는다(`kind: "already"` 도 ok). 잔액 부족이면 `out_of_tickets`.
3. `admit(pendingId)` — null 이면(그 사이 닫힘) `getActive` 를 읽어 있으면 `published`, 없으면 `failed("gone")`. **생성 입력은 admit 이 돌려준 행의 `inputSnapshot`** 이다.
4. `generate`.
5. 성공 → `publish`. true 면 `published`. false 면 `getActive` — 있으면 `published`(다른 탭이 먼저 발행), 없으면 `failed("gone")`(다른 탭이 먼저 failed 로 닫음. 성공 결과는 버린다 — 재시도가 새 pending 을 만든다).
6. 실패 → `fail`. 반환값과 무관하게 `getActive` 를 한 번 읽어 있으면 `published`(다른 탭이 먼저 발행), 없으면 `failed(code)`.

`createFlowReportTransport` 가 던지는 경우(`DEEP_SEEK_API_KEY` 없음)와 DB 예외는 revision 을 건드리지 않고 페이지의 catch 가 기존 `FlowError` 를 그린다(v1 과 같은 처리).

두 탭이 같은 pending 을 동시에 돌리면 모델 호출은 두 번 나가지만 발행은 한 번이다. A 는 이걸 받아들인다(v1 도 같은 창이 있다). lease 는 B.

로그: revision ID·outcome·code·소요 ms·usage 만. 본문·입력·출생정보는 남기지 않는다. 페이지의 catch 도 `console.error(e)` 로 오류 객체를 통째로 찍지 않고 `e.name` 만 남긴다.

## 9. UI

### 선택 화면 — `src/app/flow/_components/FlowConfirm.tsx`

- prop `v2Enabled: boolean` 추가. `flow/page.tsx` 가 `flowReportV2Enabled()` 를 읽어 넘긴다.
- 꺼져 있으면 지금(어제 이전)과 같다: 결제 시트 "이용권으로 열기" 가 곧 `POST /api/flows`(context 없음).
- 켜져 있으면 결제 시트 확정 → `SituationSheet`(**export** 한다 — 단독 렌더 테스트용):
  - 칩 3줄: 현재 직업(8) · 연애 상태(6) · 가장 궁금한 것(5). 옵션은 `context.ts` 에서.
  - 부제 문구는 `YearOption.tag === "지난"` 이면 "선택한 해가 시작될 무렵의 상황을 알려주세요. 기억이 정확하지 않아도 괜찮아요." 아니면 "지금의 상황을 기준으로 설명을 맞춰요. 그해 내내 같은 상황이라고 보진 않아요."
  - 안내 한 줄(작은 글씨): "답변은 이 리포트를 쓰는 데만 쓰이고, 리포트와 함께 저장돼요."
  - `isContextComplete` 가 true 일 때만 "리포트 만들기" 가 열린다. 요청은 여기서 한 번 — `{ profileId, year, context }`.
  - 시트는 `key={`${profileId}-${year}`}` 로 마운트되어 프로필·연도가 바뀌면 답이 남지 않는다.
  - 실패 문구(402·429·401·**409 busy**)는 이 시트 안에.

### 결과 화면 — `src/app/flow/[id]/page.tsx`

분기를 순수 함수로 뺀다 — `src/app/flow/[id]/_lib/resolve-flow-route.ts`:

```ts
export type FlowRoute = "v2:published" | "v1" | "v2:generate" | "v2:failed";
export function resolveFlowRoute(s: {
  active: FlowRevisionRow | null;
  hasV1Sections: boolean;       // hasAnyFlowSections — flow_sections 행 존재 여부. 검증된 have 가 아니다(낡은 schema_version 행만 남은 v1 흐름도 v1 이다)
  pending: FlowRevisionRow | null;
  latest: FlowRevisionRow | null;
}): FlowRoute;
```

1. `active` → `v2:published`
2. `hasV1Sections` → `v1` (원안 §6 "legacy 먼저". 남은 pending 이 있어도 v1 본문이 이긴다)
3. `pending` → `v2:generate`
4. `latest?.phase === "failed"` → `v2:failed`
5. 그 외 → `v1` — revision 이 없는 flow 다. 지금의 v1 경로가 첫 열람에 섹션을 만든다.

**플래그는 입력이 아니다.** 플래그를 꺼도 1·3·4 는 그대로 동작한다(§10).

`hasAnyFlowSections(flowId)` 는 `src/app/api/flows/_lib/store.ts` 에 `SELECT 1 FROM flow_sections WHERE flow_id = $1 LIMIT 1` 로 둔다.

### v2 렌더 — `src/app/flow/[id]/_components/`

섹션 메타(순서·번호·제목)는 `src/app/flow/[id]/_lib/v2-sections.ts` 상수 하나:

| 키 | 번호 | 제목 |
|---|---|---|
| overview | 01 | 총운 |
| career | 02 | `careerTitle`(직업운·학업운·취업·진로운·일과 활동) |
| money | 03 | 재물운 |
| romance | 04 | 연애운 |
| relationships | 05 | 대인운 |
| months | 06 | 월별 운세 |
| closing | 07 | 이 해를 잘 보내는 법 |

- `FlowHeroV2`: 프로필·해·기간(`FlowChrome` 재사용) + overview.headline.
- `FlowBodyV2`(props: `PublicFlowReportV2`, `months: FlowMonth[]`, `currentIndex`, `profileId`):
  - overview.body (headline 반복 없음)
  - 4개 `DomainCard`(제목 → headline → 기회 / 주의할 점 / 이렇게 해보세요 → monthLinks 는 `#month-NN` 앵커 + `monthRange`(current-month.ts)의 기간 표기). 기본 펼침.
  - `MonthTimelineV2`(신규 — 기존 `MonthTimeline` 은 v1 `MonthsContent` 타입에 묶여 있어 재사용 불가). `monthLabel`·`monthRange`·`currentIndex` 와 변곡점/현재 배지 마크업만 재사용. 각 카드 `id="month-NN"`, focusDomain 뱃지.
  - pivot 없음: "큰 전환점으로 따로 표시한 달은 없어요. 달마다 주의할 점은 아래에서 확인하세요."
  - closing: 항목 3개만.
  - 하단 고정 문구 1회: "사주를 바탕으로 한 해석이에요. 실제 선택은 현재 상황과 확인 가능한 정보를 함께 살펴 결정해 주세요."
  - 정보 기준 표시: `reference` 가 `current_baseline` → "지금 상황을 참고했어요", `selected_year_start` → "선택한 해 초의 상황을 참고했어요", `unspecified` → 표시 없음.
  - CTA 3종은 화면 코드: career → `/consult?profile=…` "내 상황 더 이야기하기", romance → `/match` "궁합 보기", relationships → `/map` "관계 지도 보기". 기존 링크의 로그인·next 처리 그대로.
- `FlowErrorV2`(props: `{ flowId }`): "운세를 완성하지 못했어요. 다시 시도해 주세요. 이미 사용한 이용권은 다시 차감되지 않아요." + 재시도 버튼(`POST /api/flows/[id]/revisions` → 2xx 면 `router.refresh()`, 409 면 "이미 완성된 리포트가 있어요" 안내 후 refresh, 그 외 "잠시 후 다시 시도해 주세요").
- `AnalyzingFlow` 의 v2 fallback 문구: "선택한 해의 운세를 정리하고 있어요."
- v1 `FlowBody` 의 무-변곡점 문구를 위와 같은 중립 문구로 바꾼다. 저장된 v1 본문은 손대지 않는다.
- 공개 DTO 는 `toPublicFlowReportV2` 결과만 클라이언트 컴포넌트로 내려간다. 서버 컴포넌트가 `FlowReportV2` 전체를 props 로 넘기지 않는다(넘기면 RSC 페이로드에 실린다).

## 10. 플래그

`src/lib/flows/v2-flag.ts`: `export const flowReportV2Enabled = () => process.env.FLOW_REPORT_V2_ENABLED === "true"`. `.env.example` 에 주석과 함께 추가(기본 없음 = 꺼짐).

플래그는 **새 진입**만 정한다:
- 켜짐: 신규 `POST /api/flows` 는 전부 v2(§6). 선택 화면에 상황 시트.
- 꺼짐: `context` 400, 시트 없음, 새 pending 을 만들지 않는다.
- 플래그와 무관: 발행된 v2 는 계속 읽힌다. 남은 pending 은 페이지가 끝까지 돌린다. failed 는 재시도 endpoint 로 새 pending 을 만들 수 있다(§6). 이용권을 이미 낸 사용자가 막다른 길에 갇히지 않는다(원안 §9).

## 11. 테스트

| 모듈 | 고정하는 것 |
|---|---|
| `context.test.ts` | 미응답 → unspecified/overall/unspecified · past+답변 → selected_year_start · present/future+답변 → current_baseline · 둘 다 unspecified(mainConcern 만 답함 포함) → unspecified · careerTitle 매핑 · `isContextComplete` · strict(reference/asOf 거부) |
| `request-hash.test.ts` | 키 순서만 다른 두 객체 → 같은 해시 · `now` 만 다른 두 스냅샷 → 같은 해시 · 답 하나 다르면 다른 해시 |
| `v2/facts.test.ts` | ID 유일·months 12·pivot 일치·`change.pivotMonths=[]` 존재·`monthlyObservedGroups` 이름·성별 부재·`annual.stemGroup` 이 `monthScores` 의 그룹 정의와 같은 함수(`groupOf`)로 나옴 |
| `v2/schema.test.ts` | fixture 통과 · 길이 경계(공백 포함 trim) · months 12·유일·오름차순 · basisRefs 중복 거부 · monthLinks 섹션 내 중복 거부 · closing 3 · sourceKeys=closing 거부 · 추가 필드 거부 · `flowReportToolSchema()` 에 `$schema` 없음 |
| `v2/references.test.ts` | 없는 ID → 오류 목록, 전부 있으면 빈 배열 |
| `v2/prompts.test.ts` | `[입력 데이터]` 다음이 `JSON.stringify(input, null, 2)` 와 같음 · 입력 JSON 에 `careerSituation`/`relationshipSituation` 키 있음 · 예시 3종 포함 · "서버에서 직렬화한"·"선택된 예시 JSON" 문자열 없음 |
| `v2/presentation.test.ts` | 내부 필드(`interpretation`·`basisRefs`·`sourceKeys`) 부재 · careerTitle·reference 반영 |
| `v2/generator.test.ts` | 성공/timeout/http/transport/schema/references 여섯 결과 · transport 1회 호출 · `content` 언랩 안 함 · **오류 `errors` 에 message·본문 없음**(JSON 아닌 tool 인자로 실패시킨 경우) · usage 회수 |
| `revisions.test.ts` | upsert 의 created/same/replaced/busy/none 다섯 결과 · publish 조건(phase=draft·flow_id 일치)·0행 false · fail 은 draft 만 · admit 이 RETURNING 행을 돌려줌 · jsonb 문자열 행 파싱 |
| `handler.test.ts` | 플래그 꺼짐+context→400 · 켜짐+context 없음→pending(unspecified 스냅샷) · 켜짐+context→snapshot 배선 · **수렴한 기존 행은 `row.months` 로 스냅샷** · v1 섹션 있는 flow → pending 안 만듦 · busy→409 · 기존 v1 테스트 유지 |
| `revisions handler` | 401/404 · active→409 · pending→200 · failed→새 pending(스냅샷 복사) 201 · v1→409 · 본문 strict |
| `run-flow-report-v2.test.ts` | 한도→권한→admit→모델 순서 · 각 단계 실패에서 뒤가 안 불림 · admit null→active 재조회 · publish false & active 있음→published · publish false & active 없음→failed(gone) · fail 뒤 active 있음→published · 생성 입력이 admit 반환 행의 것 |
| `resolve-flow-route.test.ts` | 5규칙 + "낡은 schema_version 행만 있는 v1 흐름 → v1"(hasV1Sections 가 행 존재 기준임을 통해) |
| `FlowConfirm.test.tsx` / `SituationSheet.test.tsx` | `renderToStaticMarkup` 기준(레포의 .tsx 테스트 방식 — jsdom·testing-library 를 들이지 않는다): 플래그별 시트 마크업 유무 · `tag="지난"` 문구 · 안내 줄 · 초기 상태에서 버튼 disabled. 클릭 상호작용은 `isContextComplete` 순수 함수 테스트로 대신한다 |
| `FlowBodyV2.test.tsx` | 7섹션 번호·제목 순서(`v2-sections.ts` 문자열) · careerTitle 별 02 제목 · `#month-NN` 앵커 · 무-변곡점 문구 · CTA 경로 · reference 별 정보 기준 문구 |

수동·실측(A 완료 보고에 남긴다):
- 개발 DB 에 0045~0048 적용(공유 DB 라 **적용 전 확인**을 받는다 — 전부 additive).
- 플래그 켜고 실제 DeepSeek 로 3~5개 프로필·연도 생성: 소요 시간, 검증 통과율, `validation_errors` 의 종류, `usage_summary`. 이 숫자가 B 의 설계 입력이다.
- `npm run typecheck`, `npm run lint`(이번 변경 파일만 0 error), `npx vitest run`, `npm run build`.

## 12. 리스크

- **미검토 본문이 노출된다.** A 의 발행본은 검토 루프를 거치지 않았다. 플래그는 내부·실측 계정에서만 켠다(§1).
- **DeepSeek 가 7섹션+12개월 strict tool 응답을 45초 안에 내는가.** 모른다. A 의 실측이 답한다. 안 되면 B 에서 분할 호출(일관성 손실)이나 모델 교체를 검토한다 — 이 문서는 어느 쪽도 정하지 않는다.
- 글자수 제약(JS `length`)이 한국어에 빡빡하면 `schema` 실패가 잦다. 실패는 이용권을 안 깎지만 시간당 한도를 먹는다. 실측에서 실패 분포를 보고 제약을 조정한다(프롬프트 문서와 함께).
- 두 탭 경쟁에서 성공한 생성 하나가 버려질 수 있다(§8 5번). 드물고, 재시도로 복구된다. lease 가 B 에서 닫는다.
- v1 페이지가 섹션을 만드는 사이에 같은 flow 로 `POST /api/flows` 가 오면 pending 이 하나 고아로 남을 수 있다(NOT EXISTS 검사와 v1 저장 사이). 읽기에는 영향이 없고(§9 2번), B 의 "다시 보기" 가 그 flow 에서 409 를 만나면 운영이 pending 을 failed 로 닫는다.

## 13. B 로 미루는 것(다시 적어 둔다)

검토(`review_flow_report`)·교정 루프, lease·`advance` phase API·`GET` 상태 조회·`FlowGenerationProgress`, 클라이언트 `requestId`/idempotency, "상황 바꿔 다시 보기"·기존 v1 구매자 업그레이드, 회귀 문장 평가 체크리스트, `usage_summary` 기반 원가 보고.
