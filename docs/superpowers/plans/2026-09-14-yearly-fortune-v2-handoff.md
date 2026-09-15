# 한 해의 흐름 v2 — Claude Code Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan. Steps use checkbox syntax for tracking.

**Goal:** 연간 운세를 사용자가 궁금한 일·돈·연애·대인관계 중심으로 바꾸고, 생활 상황에 맞는 직접적인 문장과 일관된 월별 풀이를 제공한다.

**Architecture:** 기존 성향 리포트와 연간 v1을 보존한다. 연간 v2는 선택적 상황 입력 → 계산 근거 스냅샷 → 전체 7섹션 생성 → 별도 검토 → 필요 시 한 번 교정 → 완성본 발행 구조다. 생성·검토는 요청을 나눠 실행하지만 미검토 본문을 부분 공개하지 않는다.

**Tech Stack:** 현재 저장소의 Next.js App Router, TypeScript, React, Zod, Vitest, PostgreSQL 저장소, 기존 LLM 전송 어댑터. 이 문서는 새 ORM·인증·모델 공급자·작업 큐 도입을 요구하지 않는다.

**Spec:** [교체용 프롬프트 전문](../../prompts/2026-09-14-yearly-fortune-v2-prompts.md)

작성일: 2026-09-14  
상태: 구현을 위한 제안 문서. 이 문서 작성 시 운영 프롬프트·UI·데이터는 변경하지 않았다. 실제 LLM 결과 품질·지연·원가는 아직 검증하지 않았다.

## Claude Code에게 전달할 요청

이 문서와 연결된 프롬프트 전문을 읽고 연간 운세 /flow를 개편해 주세요. 현재 코드와 달라진 부분은 먼저 확인하고, 테스트를 먼저 추가하면서 아래 작업을 순서대로 구현해 주세요.

주요 목표는 “더 세게 단정하기”가 아니라 “무엇이 유리하고 무엇을 조심해야 하는지 구체적으로 답하기”입니다. 어려운 사주 용어는 본문에 노출하지 않습니다. 기존 구매 리포트와 이용권을 보존하고, 프롬프트만 바꿔 캐시 전체를 재생성하는 방식은 쓰지 마세요.

로컬 구현·검증까지 진행하되 운영 DB 변경, 실제 사용자 리포트 일괄 재생성, 배포와 비용이 드는 실제 LLM 평가는 별도 승인 없이 실행하지 마세요.

## Global Constraints

- 대상은 연간 상품 /flow 및 /api/flows다. /report의 13섹션 재편과 /match의 생성 프롬프트는 변경하지 않는다.
- 과거에 작성된 yearly-flow 설계의 삭제·초기화 지시는 이번 개편의 요구사항이 아니다. 기존 flows, flow_sections, entitlements를 지우지 않는다.
- 루트 AGENTS.md와 실제 작업 디렉터리를 확인한다. 대화에 남아 있는 삭제된 .claude/worktrees 경로를 그대로 사용하지 않는다.
- Next.js 코드를 수정하기 전 설치된 node_modules/next/dist/docs의 관련 Route Handlers·폼 문서를 읽는다.
- 기존 미커밋 변경과 관련 없는 실패를 보존한다. 이 문서의 테스트 명령은 실행 권한이나 운영 DB 접근 승인을 뜻하지 않는다.
- 현재 명리 연도 ±5년, 출생 전 연도 제한, 프로필 소유권, 로그인, 이용권 정책의 기본 단위는 유지한다.
- 공개본은 같은 revision의 검토된 7섹션 전체다. 새 본문과 옛 본문을 한 리포트에 섞지 않는다.
- 사주 계산 결과와 사용자가 제공한 생활 상황은 분리한다. 바라는 결과에 맞춰 운세를 좋게 바꾸지 않는다.
- 명리 해석은 미래 사건의 보증이 아니다. 투자·질병·사고·임신·이혼·채용을 확정하는 내용은 발행하지 않는다.
- 임의 샘플 운세를 실제 고객 결과로 쓰거나, 실패를 빈 본문·가짜 성공으로 숨기지 않는다.

## 1. 제품 범위와 섹션

고정 순서:

1. 총운 — 이 해의 가장 중요한 기회와 주의점은 무엇인가?
2. 직업운 — 일·공부·준비에서 무엇이 성과로 이어지고 무엇이 막는가?
3. 재물운 — 돈과 연결된 활동·지출·관리에서 무엇을 살펴야 하는가?
4. 연애운 — 새로운 만남 또는 현재 관계에서 무엇을 기대하고 주의할까?
5. 대인운 — 연애 이외의 관계에서 어떤 연결이 도움이 되고 어디서 소모되는가?
6. 월별 운세 — 분야별 해석이 달마다 어떻게 달라지는가?
7. 이 해를 잘 보내는 법 — 앞의 풀이에서 고른 실천 세 가지.

rising과 straining은 분야별 “기회 / 주의할 점”에 흡수한다. work는 career로, relating은 romance와 relationships로 나눈다. money는 돈에 대한 태도 설명에만 제한하지 않는다.

건강운·별도 학업운·사주 근거 상세 패널·새 궁합 분석은 이번 범위에 넣지 않는다. 학업은 career 상황 분기로 제공한다. 세분화된 진로 목표나 연애 목표 질문은 첫 버전 사용성을 본 뒤 추가할 수 있지만 이번 입력 계약에는 넣지 않는다.

현재 고객 조사가 있는 것처럼 설명하지 않는다. 이 구성은 서비스 컨셉과 사용자의 문제 제기에서 세운 제품 가설이다.

## 2. 추가 정보 수집 — 문구와 동작
-> 이부분은 ui가 이미 추가되어있음. 아래는 참고만 하셈. 가사, 돌봄은 추가해도 될듯.

### 화면 위치와 공통 안내

신규 연도 선택 → “추가정보 UI” → 기존 구매 확인 → 생성 순서다.

### 질문 1 — 일·활동 상황, 선택

- 조직에서 일하고 있어요 → employed
- 프리랜서로 일해요 → freelance
- 사업을 운영해요 → business
- 학생이에요 → student
- 취업·진로를 준비해요 → preparing
- 잠시 쉬고 있어요 → taking_break
- 가사·돌봄에 집중해요 → home_care
- 여기에 해당하지 않아요 → other
- 잘 모르거나 답하지 않을래요 → unspecified

화면 제목 매핑:

- employed / freelance / business → 직업운
- student → 학업운
- preparing → 취업·진로운
- taking_break / home_care / other / unspecified → 일과 활동

내부 키는 모두 career다. UI 제목과 생성 입력의 careerTitle은 동일한 매핑 함수에서 나온다.

### 질문 2 — 연애·파트너 관계, 선택

- 현재 연애 중이 아니에요 → single
- 연애 중이에요 → dating
- 배우자 또는 오래 함께하는 파트너가 있어요 → partnered
- 잘 모르거나 답하지 않을래요 → unspecified

혼인신고·동거·자녀·상대 성별은 별도로 추정하지 않는다. single이라고 새 만남을 원한다고 단정하지 않는다. 관계 상태를 밝히지 않으면 새 만남과 현재 관계를 조건부로 설명한다.


### 어떤 시점의 정보인가

- 과거 연도: “선택한 해가 시작될 무렵의 상황을 알려주세요. 기억나지 않으면 건너뛰어도 괜찮아요.” reference=selected_year_start.
- 현재·미래 연도: “지금의 상황을 기준으로 설명을 맞춥니다. 그해 내내 같은 상황이라고 가정하지는 않아요.” reference=current_baseline.
- 직업·연애를 모두 unspecified로 두면 reference=unspecified. 관심 분야만 답해도 동일하다.
- asOf는 서버가 받는 시각이며, selected_year_start에서는 “응답한 시각”이지 “그해 초의 정확한 날짜”가 아니다.
- UI의 과거·현재 판정과 서버 판정이 입춘 경계를 사이에 두고 바뀌면 제출을 거절하고 질문을 갱신한다. 현재 상황을 과거 기준 응답으로 조용히 바꾸지 않는다.
- 프로필·연도를 바꾸면 보내지 않은 답을 초기화한다. 다른 사람의 답이 이어 붙지 않게 한다.

첫 버전에서 회사·직무명·소득·자산·부채·질병·성적·연애 사연 같은 자유 텍스트는 받지 않는다. profile의 영구 성향 필드로 저장하지 않고 해당 결과 revision의 상황 스냅샷에만 넣는다. 답변은 결과 작성에 사용해 저장되므로 구매 확인 전에 이 용도를 안내한다.

## 3. 현재 코드에서 확인된 문제

2026-09-14 로컬 소스 기준이다. 구현 시작 시 변경 여부를 다시 확인한다.

- src/app/api/flows/_lib/prompt/system.ts: 성향 리포트 프롬프트를 상속한다. v2는 별도 시스템을 사용해야 한다.
- src/app/api/flows/_lib/generator.ts: 섹션별 독립 요청이다. 문체 규칙만 바꿔서는 분야·월 사이에 결론이 갈리는 문제가 남는다.
- src/app/api/flows/_lib/prompt/facts.ts: year.tenGods는 12개월에서 관측된 그룹의 합집합이다. 이를 “두드러지는 힘”으로 전달하면 강도 정보로 오독할 수 있다.
- src/app/flow/[id]/_components/FlowBody.tsx: pivot이 없으면 “흐름이 크게 꺾이는 달 없이 한 방향이 길게 이어져요”라는 문구를 UI가 붙인다. 모델 프롬프트만 고쳐서는 이 모순을 없앨 수 없다.
- src/app/api/flows/_lib/store.ts: 버전이 다른 섹션은 없는 것으로 취급해 다시 생성한다. 기존 registry 버전을 일괄 올리는 방식은 구매본 보존 요건을 깨뜨린다.
- src/app/api/flows/_lib/handler.ts: 현재 입력은 profileId와 year만 받는 strict 스키마다. 폼만 추가하면 서버에서 거절된다.
- src/lib/flows/store.ts: 같은 profileId·flowYear는 같은 flowId다. 상황을 추가해도 이 이용권 단위는 유지해야 한다.
- src/app/flow/[id]/page.tsx: 현재 생성은 읽는 페이지 안에서 일어나며 maxDuration=60이다. 전체 생성·검토·교정을 한 HTTP 요청으로 직렬 연결하지 않는다.
- 기존 전송 어댑터와 섹션 생성기 양쪽에 재시도가 있다. v2에서 이를 겹쳐 쓰면 문서상의 호출 상한과 실제 호출 수가 달라진다.

## 4. 확정할 입력·출력 계약

### 사용자 요청

src/lib/flows/context.ts에 아래 스키마와 normalizeFlowContext 함수를 새로 만든다. 기존 함수로 착각하지 않는다.

~~~ts
import { z } from "zod";

export const CareerSituationSchema = z.enum([
  "employed", "freelance", "business", "student", "preparing",
  "taking_break", "home_care", "other", "unspecified",
]);
export const RelationshipSituationSchema = z.enum([
  "single", "dating", "partnered", "unspecified",
]);
export const MainConcernSchema = z.enum([
  "career", "money", "romance", "relationships", "overall",
]);
export const ContextAnswerSchema = z.object({
  careerSituation: CareerSituationSchema.optional(),
  relationshipSituation: RelationshipSituationSchema.optional(),
  mainConcern: MainConcernSchema.optional(),
  reference: z.enum([
    "selected_year_start", "current_baseline", "unspecified",
  ]).optional(),
}).strict();

export type ContextAnswer = z.infer<typeof ContextAnswerSchema>;
export interface ContextSnapshot {
  careerSituation: z.infer<typeof CareerSituationSchema>;
  relationshipSituation: z.infer<typeof RelationshipSituationSchema>;
  mainConcern: z.infer<typeof MainConcernSchema>;
  reference: "selected_year_start" | "current_baseline" | "unspecified";
  asOf: string;
}
~~~

normalizeFlowContext(raw: unknown, options: { relation: "past" | "present" | "future"; now: Date }): ContextSnapshot

- undefined는 빈 답과 동일. 알 수 없는 필드, null, 잘못된 enum은 거부한다.
- 누락된 상황을 unspecified, 관심을 overall로 정규화한다.
- 유효한 상황 답이 하나라도 있으면 reference를 필수로 받고, 과거에는 selected_year_start, 나머지에는 current_baseline인지 검증한다. 다르면 ContextReferenceMismatchError.
- 둘 다 unspecified면 reference를 unspecified로 정규화한다.
- asOf는 options.now.toISOString(). 클라이언트의 asOf는 strict 검증으로 거부한다.
- 현재 명리 연도와 비교하는 relation은 서버에서 계산한다. 클라이언트가 사주 근거나 연도 분류를 정하지 않는다.

신규 생성 POST /api/flows에 선택적 context를 추가한다. 기존 {profileId, year} 요청도 성공해야 한다. 소유권 및 연도 검증 후 상황을 정규화한다. 기존 권한이 있는 flow의 재열람·업그레이드에서 잔여 이용권이 0이라는 이유만으로 402를 반환하지 않도록 access 경로를 분리해 테스트한다.

같은 flow가 이미 있으면 단순 POST 재시도로 입력을 덮어쓰지 않는다. 기존 결과를 반환한다. 사용자가 명시적으로 “상황을 바꿔 다시 보기”를 선택했을 때만 새 revision을 만든다.

### 모델 입력

FlowGenerationInput의 request / personalContext / evidence 구조는 프롬프트 문서 §3을 따른다.

evidence 계약:

- facts[].id는 중복 없는 서버 생성 문자열.
- kind는 natal, annual, cycle, aggregate, month, change 중 하나.
- value는 계산 모듈에서 만든 문자열·숫자·불리언 또는 그 배열을 담은 직렬화 가능한 객체다. 사용자 자유 텍스트를 섞지 않는다.
- monthIndex는 월 근거면 1..12, 나머지는 null.
- availableFactIds는 facts에서 파생한다. 별도 저장 원본으로 관리하지 않는다.
- months는 저장된 flow.months와 같은 순번·pivot 값의 12개 항목. factIds는 실제 근거를 참조한다.
- pivotMonths 역시 months에서 파생한다.
- 원국은 배경, 선택한 해의 간지와 작용은 annual, 대운은 cycle, 연평균·관측 그룹은 aggregate로 구분한다.
- ID 예시는 annual.stem, aggregate.monthlyGroupUnion, month.01.support처럼 안정적인 이름을 쓴다. 모든 예시 ID를 무조건 만들지 말고 실제 계산한 항목만 넣는다.
- 월 순번은 절기 월이다. 달력 표기와 기간은 모델에 만들게 하지 않는다.

year.tenGods의 의미를 바꾸지 않고 v2 facts에서 monthlyObservedGroups로 명확히 명명한다. “강함”이나 “우세”로 라벨링하지 않는다. 선택 연도 자체의 천간·지지 그룹은 month-scores.ts가 쓰는 기존 오행·그룹 계산을 재사용해 별도 사실로 추가한다. 새 길흉 점수나 가중치를 발명하지 않는다.

### 모델 출력과 공개 뷰

FlowReportV2와 FlowReviewV2는 프롬프트 문서 §6·§8의 계약을 그대로 구현한다.

- formatVersion=2는 저장 형식 버전이다.
- promptBundleVersion=1은 첫 v2 프롬프트 묶음 버전이다. 둘을 혼동하지 않는다.
- 도구 JSON Schema는 Zod의 구조 제약에서 파생한다. 참조 ID의 존재, 월 순서, 리뷰 경로 등의 런타임 검증을 별도로 유지한다.
- 내부 interpretation, basisRefs, sourceKeys, 검토 결과는 브라우저 응답에 보내지 않는다. CSS로 숨기는 것으로 대체하지 않는다.
- toPublicFlowReportV2는 공개 텍스트만 명시적으로 선택한 새 객체를 반환한다. 전체 report에 spread를 한 뒤 일부 키를 삭제하는 방식은 쓰지 않는다.

## 5. 생성·검토와 실행 시간

### 한 번의 시도

보통 전체 생성 → 검토 두 번의 모델 호출이다. 품질 문제가 있으면 전체 교정 → 재검토를 추가해 최대 네 번이다.

- draft: emit_flow_report로 전체 7섹션 생성.
- 구조·ID 검증에 실패하면 검증 오류를 저장하고 review 대신 repair로 이동.
- review: 같은 입력과 전체 draft를 주고 review_flow_report 실행.
- pass면 발행. revise면 repair로 이동.
- repair: 최대 한 번, 전체 응답을 교정.
- repair가 구조 검증을 통과하면 review_repaired를 실행.
- 재검토도 pass일 때만 발행. 다시 revise거나 잘못된 검토 응답이면 failed.

전송 실패·타임아웃·파싱 불능·tool 누락은 해당 시도를 failed로 끝낸다. 검토를 못 했다는 이유로 교정하거나 통과시키지 않는다.

v2 전송은 retries=0으로 만들고 기존 PromptedFlowGenerator의 SECTION_ATTEMPTS를 사용하지 않는다. 이로써 실제 HTTP 모델 요청도 한 시도 최대 네 번이다. 사용자 재시도는 별도의 시도이며 한도 적용과 로그에서 구분한다. 나중에 전송 재시도를 넣으면 이 상한·시간 예산·테스트를 함께 수정해야 한다.

### 단계별 HTTP 요청

현재 페이지의 60초 실행 예산을 유지하는 초기 구현안:

- POST /api/flows/[id]/revisions: 소유권 확인, 상황 검증, 새 pending revision 확보. LLM 호출 없음.
- POST /api/flows/[id]/revisions/[revisionId]/advance: 정확히 한 phase의 LLM 호출과 결과 저장.
- GET /api/flows/[id]/revisions/[revisionId]: 상태 조회 전용. 비용 발생·생성 없음.
- advance 본문은 { expectedPhase, requestId }를 받는다. 요청한 단계와 현재 단계가 다르면 현재 상태만 반환하고 다음 모델 호출을 몰래 실행하지 않는다. expectedPhase는 draft/review/repair/review_repaired만 허용하고 requestId는 UUID로 검증한다.
- 브라우저의 FlowGenerationProgress가 성공 응답을 받은 뒤 다음 단계를 요청한다. 같은 단계 재전송은 서버의 잠금·상태 비교로 중복 생성하지 않는다.
- 실행 중인 단계가 있으면 상태만 조회한다. 다른 탭이 같은 운세를 봐도 중복 호출하지 않는다.
- 페이지를 떠나면 이미 서버에 전달된 한 단계는 끝날 수 있지만 새 단계를 브라우저가 계속 시작하지 않는다. 다시 열었을 때 저장된 단계에서 이어간다.
- 응답 이후 실행이 보장되지 않는 임의의 Promise, setTimeout, 메모리 큐를 백그라운드 작업으로 사용하지 않는다.

advance route는 maxDuration=60, 모델 단일 시도 timeoutMs=45_000을 초기값으로 둔다. 남은 시간은 인증·저장·발행을 위한 여유다. 이 시간 안에 전체 초안이 생성되는지는 실제 모델 평가로 확인해야 한다. 불충분하면 출력 분량·모델·실행 환경을 검토한 뒤 출시를 보류한다. 운영 플랫폼 한도를 확인하지 않고 maxDuration 숫자만 늘려 해결했다고 하지 않는다.

리뷰 단계에 생성 시스템의 전체 규칙도 전달한다. 섹션 지시문만 전달하면 문체·시간·금지 규칙 일부가 검토에서 사라진다.

## 6. 저장·구매본·동시성 정책

아래는 이번 개편에 추천하는 정책이다. 기존 코드가 이미 제공한다고 가정하지 않는다.

### 보존과 이용권

- flows의 profile_id·flow_year 유일성과 flowId를 유지한다.
- 기존 flow_sections의 키·버전·내용은 보존한다. v1 registry와 렌더러를 수정해 저장된 본문을 못 읽게 하지 않는다.
- 신규 사용자는 v2로 만들고, 기존 구매자는 기존 결과를 그대로 읽는다.
- 기존 구매자가 직접 “새 구성으로 다시 보기”를 누르면 v2 revision을 만든다. 같은 flowId의 기존 yearly_flow 권한을 재사용하고 이용권을 다시 차감하지 않는다.
- v2 사용자가 상황을 바꾸거나 실패를 재시도할 때도 같은 flowId 권한을 사용한다. 실제 새 생성 시 기존 시간당 한도는 적용한다.
- 한도 확인 → 권한 확인/필요 시 이용권 차감 → 모델 호출 순서를 지킨다. 단계마다 다시 과금하거나 한도를 네 번 올리지 않는다.
- 신규 시도의 첫 draft 실행에서 한 번만 한도·과금을 처리한다. 외부 한도 카운터와 DB 기록 사이의 장애는 자동 재시도로 복구하지 않고 실패 처리하며, 동일 이용권의 중복 차감은 기존 entitlement 유일성으로 막는다. DB의 실행권을 확보한 요청만 이 작업을 한다. 이어지는 검토·교정에는 다시 적용하지 않는다.
- 생성 실패 시 권한은 남는다. 재시도 가능 여부와 이용권 재차감 없음 안내를 보여준다.
- 단순 재열람, 같은 단계 중복 요청, 같은 idempotencyKey 요청은 새 생성으로 세지 않는다.

### 추가 저장 구조

migrations/0045_flow_report_revisions.sql을 새로 만든다. 구현 시 0045가 이미 사용 중이면 가장 큰 번호 다음으로 조정하고 실제 파일명을 완료 보고서에 남긴다. 과거 migration을 편집하거나 이 문서 작성 단계에서 실행하지 않는다.

flow_report_revisions의 필수 정보:

- id bigint identity, flow_id bigint FK → flows ON DELETE CASCADE.
- format_version=2, prompt_bundle_version 양의 정수.
- idempotency_key 문자열: 같은 flow 안에서 유일. 동일 키·다른 입력은 409로 거절하며 같은 결과로 위장하지 않는다.
- request_hash 문자열: 정규화한 입력·계산 버전·프롬프트 버전의 서버 해시. 공개 토큰·인증 수단으로 쓰지 않는다.
- context_snapshot jsonb, input_snapshot jsonb, months_snapshot jsonb.
- phase: draft / review / repair / review_repaired / complete / failed.
- working_payload jsonb nullable, review_payload jsonb nullable, validation_errors jsonb nullable.
- published_payload jsonb nullable: 검토 통과한 전체 FlowReportV2만 저장.
- model 문자열, usage_summary jsonb, failure_code 문자열 nullable.
- lease_token 문자열 nullable, lease_expires_at 시각 nullable. admitted_at nullable로 첫 단계 한도·권한 처리 완료를 기록한다.
- created_at, updated_at, published_at nullable.

flows에 active_revision_id nullable FK를 추가한다. 조회 시 revision.flow_id와 flow.id의 일치도 확인한다. 다른 flow의 결과를 연결할 수 없도록 publish 쿼리에 이 조건을 강제한다.

새로 만든 flow는 draft revision 존재 여부로 v2 생성 경로를 찾는다. 기존 flow에 pending 업그레이드가 있어도 active_revision_id가 없으면 저장된 legacy 결과를 먼저 보여준다. 아무 공개본도 없는 신규 flow만 생성 진행 화면을 보여준다.

months_snapshot은 해당 flow의 보존된 월·기간·pivot을 복사한다. v2 evidence는 이를 기준으로 만들고 입력 스냅샷에 당시 계산 결과를 고정한다. 읽는 시점에 새 계산으로 본문 의미를 바꾸지 않는다.

request_hash에는 asOf의 밀리초처럼 매번 달라지는 값을 그대로 넣지 않는다. 선택 연도, 정규화한 상황과 reference, 생성용 근거, 계산·프롬프트 버전으로 만든다. asOf 자체는 스냅샷에 보존한다. 동일 요청 재전송 식별은 별도의 idempotency_key가 책임진다.

### 잠금과 발행

한 flow에 동시에 미완성 시도 하나만 허용한다. phase가 complete/failed가 아닌 행에 대한 부분 유일 인덱스로 보장한다. active revision은 새 pending 시도와 별개로 유지한다.

- pending revision 확보는 원자적으로 실행한다. 같은 정규화 입력의 미완성 시도가 있으면 그 상태를 반환한다.
- 다른 상황으로 새 시도를 요청했는데 미완성 시도가 있으면 409로 안내한다. 기존 입력을 바꾸거나 모델 요청을 늘리지 않는다.
- phase 실행권은 DB 조건부 UPDATE로 확보하며 90초 lease와 무작위 token을 쓴다. 네트워크 모델 호출 중 DB 트랜잭션을 열어두지 않는다.
- 결과 저장은 revisionId + expectedPhase + leaseToken이 모두 맞을 때만 가능하다.
- lease가 만료된 시도는 실패 상태로 정리하고 사용자 재시도를 요구한다. 이전 호출의 성공 여부가 불명확한 상태에서 같은 단계를 자동 재호출하지 않는다.
- review 통과 처리, published_payload 저장, phase=complete, flows.active_revision_id 변경은 원자적 SQL/트랜잭션으로 처리한다.
- 기존 공유 SqlClient는 태그 템플릿 단일 쿼리 인터페이스다. 일반 Pool처럼 BEGIN을 여러 HTTP 요청에 흩어 쓰지 않는다. 이 계약을 유지한 단일 조건부 SQL 또는 명시적 저장소 트랜잭션 어댑터를 사용하고 테스트한다.
- 발행 실패나 교정 실패 시 active_revision_id는 그대로다. 직전 공개본을 계속 표시한다.
- 로그에는 전체 상황·본문·출생정보 대신 revision ID, phase, 오류 코드, 소요 시간, 토큰 집계를 남긴다.
- 프로필·계정 삭제의 기존 연쇄 삭제 경로에 새 revision도 포함한다. 이 답변을 공용 분석 이벤트나 다른 상품의 자동 입력으로 재사용하지 않는다.

## 7. UI 기준

기존 FlowShell·SectionHeading·NoteCard·InfoCard의 색상·여백·글자 크기를 재사용한다. 스크린샷의 이모지와 자극적인 “잭팟” 문구를 복사하지 않는다.

- 상단: 프로필, 선택한 해, 기존 계산 기간, 총운 headline.
- 본문 총운: 상단과 같은 headline을 반복하지 않고 body를 이어서 보여준다.
- 02~05: 분야명 → 결론 headline → “기회”, “주의할 점”, “이렇게 해보세요”.
- 연간 분야 네 개는 기본 펼침으로 시작한다. 짧게 쓴 내용을 또 클릭하게 만들지 않는다.
- monthLinks는 해당 월 카드로 가는 작은 링크다. UI가 flow.months에서 날짜·월 표기를 붙인다.
- 월별 12개는 현재 MonthTimeline의 기간 표기와 강조 규칙을 재사용한다. 새 텍스트 구조만 연결한다.
- pivot이 없는 경우 v2에서는 “큰 전환점으로 따로 표시한 달은 없습니다. 달마다 주의할 점은 아래에서 확인하세요.”로 표시한다. “한 방향이 길게 이어진다”는 문구를 사용하지 않는다.
- 월 순번 1을 1월이라고 표시하지 않는다. 표시한 기간과 현재 달 강조는 기존 절기 경계 함수를 유지한다.
- 마무리는 행동 세 개만 보여준다. 새 예언·새 CTA를 모델에게 생성시키지 않는다.
- 하단에 한 번: “사주를 바탕으로 한 해석입니다. 실제 선택은 현재 상황과 확인 가능한 정보를 함께 살펴 결정해 주세요.”
- 정보 기준은 “현재 상황을 참고했어요” 또는 “선택한 해 초의 상황을 참고했어요”로 간단히 표시한다. 전체 답 공개는 본인 소유 결과 화면에 한정한다.

CTA는 화면 코드에서 관리한다.

- career: 기존 /consult?profile=... 경로를 유지한 “내 상황 더 이야기하기”.
- romance: /match로 “궁합 보기”.
- relationships: /map으로 “관계 지도 보기”.
- 기존 목적지의 로그인 처리와 next 복귀를 유지한다. /report의 관계 지도·궁합 CTA는 이 작업에서 다시 변경하지 않는다.

진행·실패 문구:

- draft: “선택한 해의 운세를 정리하고 있어요.”
- review / repair / review_repaired: “내용이 서로 맞는지 확인하고 있어요.”
- 실패, 공개본 없음: “운세를 완성하지 못했어요. 다시 시도해 주세요. 이미 사용한 이용권은 다시 차감되지 않아요.”
- 실패, 공개본 있음: “새 내용을 완성하지 못해 이전 결과를 보여드려요.”
- 한도·잔액 부족은 기존 제품의 구분된 안내를 사용한다.

## 8. 구현 작업 순서

아래 새 파일명과 함수명은 구현 목표다. 아직 존재하는 API라고 가정하지 않는다.

### Task 1 — 상황 입력 계약

Create:

- src/lib/flows/context.ts
- src/lib/flows/context.test.ts

Steps:

- [ ] §4의 enum·정규화·careerTitle 매핑을 테스트로 먼저 정의한다.
- [ ] 건너뛰기, 부분 응답, 잘못된 enum, reference 불일치, 서버 asOf 검증을 구현한다.
- [ ] 프런트와 서버가 공유할 순수 모듈로 유지하고 DB·비밀 환경변수를 import하지 않는다.
- [ ] npx vitest run src/lib/flows/context.test.ts를 실행한다.

첫 회귀 테스트 예시:

~~~ts
import { describe, expect, it } from "vitest";
import { normalizeFlowContext, careerTitle } from "./context";

describe("normalizeFlowContext", () => {
  it("미응답을 개인 이력으로 채우지 않는다", () => {
    expect(normalizeFlowContext(undefined, {
      relation: "present",
      now: new Date("2026-09-14T00:00:00.000Z"),
    })).toEqual({
      careerSituation: "unspecified",
      relationshipSituation: "unspecified",
      mainConcern: "overall",
      reference: "unspecified",
      asOf: "2026-09-14T00:00:00.000Z",
    });
  });

  it("현재 상황을 과거 연도 초의 상태로 바꾸지 않는다", () => {
    expect(() => normalizeFlowContext({
      careerSituation: "student",
      reference: "current_baseline",
    }, {
      relation: "past",
      now: new Date("2026-09-14T00:00:00.000Z"),
    })).toThrow();
  });

  it("상황 제목은 하나의 매핑을 쓴다", () => {
    expect(careerTitle("student")).toBe("학업운");
    expect(careerTitle("preparing")).toBe("취업·진로운");
    expect(careerTitle("unspecified")).toBe("일과 활동");
  });
});
~~~

### Task 2 — 근거 스냅샷과 버전 분리

Create:

- src/app/api/flows/_lib/v2/facts.ts
- src/app/api/flows/_lib/v2/facts.test.ts
- src/app/api/flows/_lib/v2/input.ts
- src/app/api/flows/_lib/v2/presentation.ts

Read/reuse:

- src/app/api/flows/_lib/prompt/facts.ts
- src/app/api/flows/_lib/month-scores.ts
- src/app/api/flows/_lib/pivots.ts
- src/lib/saju-core의 기존 연도·간지·오행 계산

Steps:

- [ ] buildFlowGenerationInput의 출력형과 근거 ID 유일성 테스트를 작성한다.
- [ ] 월 그룹 합집합이 강도 필드가 아님을 테스트로 고정한다.
- [ ] 실제 연간 간지의 그룹을 별도 사실로 넣고, 대운 단계만으로 총운을 정하지 않도록 라벨을 분리한다.
- [ ] pivotMonths=[]와 월별 부담이 공존하는 fixture를 만든다.
- [ ] 저장된 월 순번·기간·pivot과 evidence가 일치하는지 검증한다.
- [ ] 기존 v1 registry와 생성기를 유지한 채 v2를 별도 경로로 추가한다.

### Task 3 — 프롬프트·출력·검증

Create:

- src/app/api/flows/_lib/v2/schema.ts
- src/app/api/flows/_lib/v2/schema.test.ts
- src/app/api/flows/_lib/v2/references.ts
- src/app/api/flows/_lib/v2/references.test.ts
- src/app/api/flows/_lib/v2/prompts.ts
- src/app/api/flows/_lib/v2/prompts.test.ts
- src/app/api/flows/_lib/v2/__fixtures__/reports.ts

Steps:

- [ ] 프롬프트 문서 §6·§8을 Zod로 구현한다. shape와 런타임 참조 검증을 나눈다.
- [ ] emit_flow_report와 review_flow_report의 tool schema를 이 Zod에서 파생한다.
- [ ] 생성 시스템, 전체 user, 검토 시스템/user, 교정 user 전문과 세 문체 예시를 구현한다.
- [ ] 리뷰에는 생성 시스템 규칙과 섹션 규칙을 모두 전달하고 예시는 제외한다.
- [ ] 사용자 상황은 JSON 직렬화로만 넣고 설명용 치환 문구가 실제 요청에 남지 않는지 테스트한다.
- [ ] 근거 없는 ID, 중복 월, 누락 섹션, 추가 필드, 가짜 리뷰 경로를 거부하는 테스트를 작성한다.
- [ ] basisRefs의 존재 검사와 실제 의미 검토를 같은 것으로 취급하지 않는다.
- [ ] unknown·student·single 등 전용 fixture를 만들되 사주 해석의 객관적 정확성을 fixture 통과로 주장하지 않는다.

리뷰 paths는 draft 루트 기준 JSON Pointer로 통일한다. 예: /sections/career/caution, /sections/months/items/0/body. 배열 index는 JSON 배열 기준 0부터이며 monthIndex 값 1..12와 다르다. 실제로 존재하지 않는 경로를 거부한다.

### Task 4 — 단계 실행기와 오류 상한

Create:

- src/app/api/flows/_lib/v2/generator.ts
- src/app/api/flows/_lib/v2/generator.test.ts
- src/app/api/flows/_lib/v2/validation.ts
- src/app/api/flows/_lib/v2/validation.test.ts

Steps:

- [ ] draft/review/repair/review_repaired 상태 전이를 먼저 테스트한다.
- [ ] 한 단계당 transport 한 번, retries=0, timeoutMs=45_000으로 전송 어댑터를 구성한다.
- [ ] 모델 출력은 unknown으로 받고 검증 이전 타입 단언으로 신뢰하지 않는다. v2는 응답 자체가 FlowReportV2이므로 기존 unwrapContent로 content 필드를 꺼내지 않는다.
- [ ] 형식 오류는 한 번 교정 가능, 전송 실패·리뷰 파싱 오류는 실패라는 분기를 구현한다.
- [ ] 교정 후 다시 문제가 있으면 실패하고 추가 교정을 호출하지 않음을 검증한다.
- [ ] 성공 리뷰가 해당 draft와 동일 input_snapshot에 묶였는지 확인한다. 이전 리뷰로 새 draft를 발행하지 않는다.
- [ ] 사용량과 단계 시간은 남기되 전체 입력·본문을 오류 로그에 남기지 않는다.

새 검증 함수 계약:

validateReviewForDraft(raw: unknown, draft: FlowReportV2): FlowReviewV2

다음 테스트는 __fixtures__/reports.ts에 구현할 makeValidFlowReportFixture()를 사용한다. 이 fixture는 7섹션·12개월·실제 테스트용 근거 ID를 포함하며 기본 스키마와 참조 검증을 통과해야 한다.

~~~ts
import { expect, it } from "vitest";
import { validateReviewForDraft } from "./validation";
import { makeValidFlowReportFixture } from "./__fixtures__/reports";

it("pass라고 적혀 있어도 문제가 남은 리뷰를 통과시키지 않는다", () => {
  const draft = makeValidFlowReportFixture();
  expect(() => validateReviewForDraft({
    verdict: "pass",
    issues: [{
      code: "scope_missing",
      paths: ["/sections/career/caution"],
      description: "초안 작성과 마무리의 범위 구분이 없습니다.",
      correction: "유리한 과정과 부담되는 과정을 구분합니다.",
    }],
  }, draft)).toThrow();
});

it("실제 본문을 가리키지 않는 리뷰를 신뢰하지 않는다", () => {
  const draft = makeValidFlowReportFixture();
  expect(() => validateReviewForDraft({
    verdict: "revise",
    issues: [{
      code: "contradiction",
      paths: ["/sections/not-a-section"],
      description: "존재하지 않는 경로입니다.",
      correction: "실제 경로에서만 문제를 보고합니다.",
    }],
  }, draft)).toThrow();
});
~~~

### Task 5 — revision 저장과 API

Create:

- migrations/0045_flow_report_revisions.sql
- src/lib/flows/revisions.ts
- src/lib/flows/revisions.test.ts
- src/app/api/flows/_lib/v2/advance.ts
- src/app/api/flows/_lib/v2/advance.test.ts
- src/app/api/flows/[id]/revisions/route.ts
- src/app/api/flows/[id]/revisions/[revisionId]/route.ts
- src/app/api/flows/[id]/revisions/[revisionId]/advance/route.ts

Modify:

- src/lib/flows/store.ts 및 store.test.ts
- src/app/api/flows/_lib/handler.ts 및 handler.test.ts
- src/app/api/flows/route.ts

Steps:

- [ ] §6의 스냅샷·idempotency·lease·공개본 분리를 구현한다.
- [ ] 신규 flow와 초기 revision 확보가 중간 실패로 누락되지 않도록 원자화하거나 안전한 복구 경로를 테스트한다.
- [ ] 기존 flow POST 재시도에서는 상황을 덮어쓰지 않는다. explicit revision endpoint에서만 변경한다.
- [ ] 모든 조회·실행에 session.userId, flow 소유권, revision.flow_id 검사를 넣는다.
- [ ] 사용자 ID·모델명·근거·phase 결과를 클라이언트 입력에서 신뢰하지 않는다.
- [ ] state GET은 서버 계산·LLM·과금을 실행하지 않는다. private/no-store 응답으로 사용자 간 공유 캐시를 막는다.
- [ ] draft 시작권을 얻은 요청만 한도→권한→모델 순으로 처리하고 이후 단계는 중복 과금하지 않는다.
- [ ] 같은 requestId/expectedPhase, 두 탭, 다른 입력 중복, lease 만료를 테스트한다.
- [ ] 검토 실패·DB 발행 실패에서 기존 active_revision_id가 유지됨을 테스트한다.
- [ ] 새 revision 테이블을 추가할 뿐 과거 저장본·권한 행을 삭제하는 SQL이 없는지 확인한다.
- [ ] 테스트용 저장소에서 migration·제약·원자적 발행을 검증한다. 운영 DB 연결이면 중단하고 테스트 환경 승인을 받는다.

### Task 6 — 입력 UI·읽기 UI

Create:

- src/app/flow/_components/FlowContextStep.tsx
- src/app/flow/_components/FlowContextStep.test.tsx
- src/app/flow/[id]/_components/FlowBodyV2.tsx
- src/app/flow/[id]/_components/FlowBodyV2.test.tsx
- src/app/flow/[id]/_components/FlowGenerationProgress.tsx
- src/app/flow/[id]/_lib/to-public-flow-v2.ts
- src/app/flow/[id]/_lib/to-public-flow-v2.test.ts

Modify:

- src/app/flow/_components/FlowConfirm.tsx
- src/app/flow/[id]/page.tsx
- src/app/flow/[id]/_components/FlowBody.tsx (no-pivot 안내 문구만)
- 필요하면 src/app/flow/[id]/_components/MonthTimeline.tsx

Steps:

- [ ] §2의 선택 질문·건너뛰기·기준 시점 안내를 구현한다.
- [ ] 프로필/연도 변경 시 입력과 구매 확인 대상을 함께 초기화한다.
- [ ] 기존 구매 연도 클릭은 기존 결과로 이동하고 입력을 강요하지 않는다.
- [ ] 신규 생성 또는 explicit 업그레이드에서만 단계 실행 컴포넌트를 활성화한다.
- [ ] legacy와 v2 렌더러를 분기한다. 기존 FlowBody/FlowHero가 새 스키마를 강제 파싱하지 않게 한다.
- [ ] v2 공개 DTO에서 interpretation/basisRefs/sourceKeys/검토 결과가 제거되었는지 테스트한다.
- [ ] 7섹션 순서, 상황별 제목, 월 순번과 기간, CTA 경로, 빈 pivot 문구를 테스트한다.
- [ ] no-pivot에 관한 기존 UI 문구도 안전한 중립 문구로 바꾼다. 저장된 v1 본문은 재작성하지 않는다.
- [ ] 폼 라벨·키보드 이동·버튼 비활성·중복 제출 방지·진행 안내를 확인한다.
- [ ] 360px 모바일과 데스크톱에서 기존 제품의 여백·카드·폰트와 이어지는지 확인한다.

### Task 7 — 회귀·실제 문장 평가·출시 차단 조건

Create:

- docs/evals/2026-09-14-yearly-fortune-v2-checklist.md

Steps:

- [ ] npx vitest run src/app/api/flows src/app/flow src/lib/flows를 실행한다.
- [ ] npm run typecheck, npm run lint, npm test를 실행한다. 기존 실패와 이번 변경 실패를 구분해 보고한다.
- [ ] 허용된 개발 환경에서 npm run build를 확인한다.
- [ ] 실제 모델 평가 전 모델·샘플 수·요청 상한·예상 비용 범위를 보고하고 승인된 범위에서 실행한다.
- [ ] 정상·불리·중립 근거, pivot 없음/있음, 과거/현재/미래, 직장인/학생/준비/휴식/미응답, single/dating/partnered/미응답이 포함되게 사례를 고른다.
- [ ] 각 사례를 별도 생성으로 두 번 읽고 방향이 뒤집히는지 수동 확인한다. 완전히 같은 문장일 필요는 없다.
- [ ] 같은 근거에 상황만 변경한 쌍을 확인한다. 예시가 달라져도 사주 방향이 사용자 희망에 맞춰 반전되면 실패다.
- [ ] 아래 필수 회귀 문장 검사를 결과와 함께 남긴다.
- [ ] 기존 구매분 유지, 추가 차감 없음, 개인정보 미노출, 원자적 발행 테스트가 실패하면 출시하지 않는다.
- [ ] 전체 초안이 45초 안에 안정적으로 생성되지 않거나 품질 리뷰가 반복 실패하면 출시를 보류하고 측정 결과를 보고한다.

필수 회귀 문장:

- “초안·시안으로 표현하기 수월하다”와 “동시 진행 시 마무리가 부담이다”는 범위 설명이 있으면 허용.
- 같은 시점·작업을 두고 “끝까지 완성한다”와 “끝까지 하기 어렵다”가 조건 없이 공존하면 불허.
- pivot=[]인데 “한 해 내내 같은 방향” 또는 “힘든 달이 없다”를 자동 생성하면 불허.
- 학생에게 “직장 상사의 평가”, unknown에게 “배우자와의 갈등”을 실제 상황처럼 쓰면 불허.
- single에게 결혼 상대 출현, money에 입금·수익 확정, 월별에 채용·퇴사 날짜를 제시하면 불허.
- 분야별 연결 달과 해당 월 본문이 같은 활동에 상반된 조언을 하면 불허.
- 마무리에 앞에서 다루지 않은 새로운 운세나 조언을 추가하면 불허.
- 저장된 draft가 리뷰를 통과하지 않았는데 화면 일부라도 노출되면 불허.

## 9. 출시와 되돌리기

FLOW_REPORT_V2_ENABLED 서버 플래그를 신규 생성·업그레이드 진입에만 적용한다. 기본값은 false로 두고 검증 후 활성화한다.

- additive migration → v1/v2 동시 읽기 가능한 코드 → 테스트·샘플 평가 → 신규 생성 활성화 순서다.
- 플래그를 꺼도 이미 구매·발행한 v2는 계속 읽을 수 있어야 한다.
- 플래그가 꺼졌을 때 새 v2 생성·새 업그레이드만 막고, 이미 시작한 pending revision의 안전한 완료·재시도 경로를 유지한다.
- 문제가 생기면 신규 진입을 끈다. 기존 데이터를 지우거나 직전 스키마로 강제 변환하지 않는다.
- 이미 v2가 발행된 후 v1만 읽는 과거 코드로 무조건 롤백하지 않는다. 양쪽을 읽는 호환 코드를 유지한다.
- 기존 사용자 전체 업그레이드와 이용권 정책 변경은 별도 제품 결정이다. 이번 배포에서 자동 실행하지 않는다.

## 10. 구현 완료 보고서에 반드시 남길 것

- 구현된 7섹션, 입력 질문, 생략 시 실제 동작.
- 생성·검토·교정 프롬프트의 실제 코드 위치와 promptBundleVersion.
- 기존 구매본/권한 보존 방식, 실제 migration 파일명, 테스트 DB 검증 여부.
- 적용한 모델과 단계별 시간·호출 상한, 실제 샘플 평가 결과.
- 실행한 테스트와 통과/실패 수. 실행하지 않은 항목은 미실행이라고 쓴다.
- 본문 모순·불필요한 전문용어·상황 추정·월별 불일치 사례의 수정 전후.
- 변경하지 않은 범위와 출시 전에 남은 조건.

프롬프트의 참조 ID와 별도 리뷰는 문장 품질을 높이는 장치다. 이 구현을 “사주의 사실성 검증”이나 “모순 완전 제거”라고 설명하지 않는다.

