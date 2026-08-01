# 리포트 실데이터 배선 (`/report`) 설계 문서

**날짜:** 2026-08-01

## 1. 목표

`/report`가 픽스처(`sampleReport`) 대신 **저장된 프로필로 실제 사주를 계산하고 DeepSeek 해석을 받아** 렌더하게 만든다.

지금 상태:

- `POST /api/saju`(DeepSeek 생성 + DB 캐시)는 완성돼 있지만 **앱 어디서도 호출하지 않는다.**
- `toReportContent(analysis, interpretation, meta, year)` 매핑 레이어와 `toChartEvidence`는 이미 있고 테스트도 있다.
- `/report`는 `?profile=<id>`를 무시하고 `sampleReport`만 렌더한다.

즉 계산·생성·매핑 조각은 다 있고, **이들을 잇는 배선만 없다.** 이번 작업이 그 고리를 닫는다.

`docs/issues/backlog.md`의 "`/report` 실데이터 배선 때 처리" 항목 중 `session.userId` 필터를 여기서 해결한다.

## 2. 범위 결정 (확정됨)

| 항목 | 결정 |
| --- | --- |
| 생성 트리거 위치 | **`/report` 서버 컴포넌트에서 직접.** HTTP 왕복 없이 `_lib`을 호출한다. `/api/saju`는 그대로 유지하고 생성 로직만 공유한다. |
| 대기 UI | **Suspense 스트리밍.** 셸(헤더)은 즉시, 본문은 fallback으로 덮는다. |
| 유료 섹션 | **`access.isPaid ? SECTION_KEYS : FREE_SECTION_KEYS`.** 결제가 붙으면 그대로 산다. |
| 프로필 접근 | **`session.userId`로 반드시 함께 필터.** 없음/남의 것은 둘 다 `notFound()`. |
| 실패 처리 | **전면 실패만 에러 화면.** `overview`가 없으면 에러, 일부만 빠지면 있는 것만 렌더. |
| 07 `environment` | **그대로 빈 칸 허용.** 레지스트리에 없는 섹션이라 유료 화면에서 07만 안 보인다. |

### 비범위 (YAGNI)

- **익명(비로그인) 실데이터.** `?profile`이 없으면 지금처럼 `sampleReport`를 렌더한다. `SajuAnalysis`는 전부 `BirthInput`에서 파생되고 DB에 남는 건 해석 텍스트뿐이라(`chart_key`는 4기둥+성별 캐시 키일 뿐 원국을 복원하지 못한다), 익명 리포트를 그리려면 생년월일 입력을 쿠키든 테이블이든 어딘가 새로 남겨야 한다. "실데이터 배선"과 "익명 세션 설계"를 한 번에 풀지 않는다.
- **07 `environment` 섹션 신설.** `AxisRow.pos`가 0–100 숫자인데 시스템 프롬프트가 LLM의 숫자 생성을 금지한다 — 축 위치는 `analysis`에서 계산하고 LLM은 서술만 쓰는 설계가 따로 필요하다. 백로그에 남긴다.
- **섹션 번호 체계 통일.** 화면(히어로 + 01–04 + 잠금 8개)과 레지스트리(12개 중 무료 5개)가 `environment` 하나만큼 어긋난 채로 둔다. 위 항목과 같이 움직인다.
- **익명 LLM 호출 레이트리밋.** 익명 경로가 없으므로 이번엔 해당 없음.
- **결제 연동.** `?paid=true` 개발 토글을 그대로 쓴다.

## 3. 데이터 흐름

```
/report?profile=<id>
  ├ getSession()                    ─ 비로그인인데 profile 있음 → /login?next=<인코딩된 현재 경로>
  ├ id 형식 검증 (/^\d+$/)          ─ ::bigint 캐스팅 전에 막는다
  ├ getProfile(session.userId, id)  ─ 없음 / 남의 것 → 둘 다 notFound()
  ├ [셸 즉시 렌더] ReportShell (헤더)
  └ <Suspense fallback={<AnalyzingReport name={profile.name} />}>
       toBirthInput(profile) → analyze() → produceSections() → toReportContent()
     </Suspense>

/report (profile 없음) → ReportShell + ReportBody(sampleReport)   ← 지금 동작 유지
```

`getProfile`은 인덱스 조회라 빠르다. 그래서 Suspense **밖**에 두고 — fallback이 사용자 이름을 쓸 수 있고, 존재하지 않는 프로필에 대해 스켈레톤을 먼저 보여주는 일도 없다.

로그인 후 복귀 경로는 `next` 쿼리로 넘긴다. `/report?profile=5`처럼 자체 쿼리가 있으므로 **반드시 `encodeURIComponent`로 감싼다** — 날것으로 붙이면 `?profile=5`가 `/login`의 파라미터로 파싱된다. 받는 쪽 `safeNext`(`src/lib/auth/oauth.ts`)의 오픈 리다이렉트 방어는 그대로 통과한다(같은 origin의 절대 경로).

## 4. 생성 로직 추출 — `src/app/api/saju/_lib/produce.ts` (신규)

`/report`가 `handleSaju(raw: unknown, deps)`를 부르려면 이미 검증된 `ProfileRow`를 다시 요청 본문 모양으로 되말아야 한다. 대신 **캐시 조회 → 없는 것만 생성 → 검증 → 저장** 부분을 함수로 뽑는다.

```ts
/** 생성기(LLM) 호출 실패. DB 오류와 구분해야 호출자가 다르게 대응한다. */
export class GenerationError extends Error {}

export interface ProduceDeps {
  generator: InterpretationGenerator;
  getCached: (chartKey: string, keys: SectionKey[]) => Promise<CachedSections>;
  putCached: (record: CacheRecord) => Promise<void>;
  getLuckCached: (luckKey: string, keys: SectionKey[]) => Promise<CachedSections>;
  putLuckSections: (luckKey: string, sections: SectionWrite[], model: string) => Promise<void>;
  sectionKeys: SectionKey[];
  year: number;
}

export async function produceSections(
  analysis: SajuAnalysis,
  deps: ProduceDeps,
): Promise<{ interpretation: Partial<Interpretation>; cached: boolean }>;
```

옮기는 범위는 현재 `handleSaju`의 3~5단계 **그대로**다 — 저장소별 캐시 분기(`splitByStorage`), `missing`만 생성, 섹션 단위 zod 검증 후 실패분 폐기, 검증 통과분만 멱등 저장.

에러 규약:

- 생성기 호출 실패 → `GenerationError`를 던진다.
- DB 오류 → 그대로 전파한다 (라우트에서 500, 리포트에서 에러 화면).

호출자는 이렇게 얇아진다:

| 호출자 | 동작 |
| --- | --- |
| `handleSaju` | `parseRequest` → `analyze` → `produceSections` → 상태코드 매핑. `GenerationError`를 잡아 502. |
| `/report` | `getProfile` → `toBirthInput` → `analyze` → `produceSections` → `toReportContent`. `GenerationError`를 잡고 캐시에 있던 것만 가지고 진행(§7). |

**순수 리팩터링이다.** 기존 `src/app/api/saju/_lib/handler.test.ts`가 수정 없이 통과해야 한다. 통과하지 않으면 동작이 바뀐 것이므로 되돌린다.

## 5. 프로필 조회 — `src/lib/profiles/store.ts` (수정)

```ts
export async function getProfile(
  userId: string,
  id: string,
  client?: SqlClient,
): Promise<ProfileRow | null>;
```

`listProfiles`와 같은 `LEFT JOIN purchases`로 `isPaid`를 파생한다.

```sql
SELECT p.*, (pu.id IS NOT NULL) AS is_paid
FROM profiles p
LEFT JOIN purchases pu
  ON pu.profile_id = p.id
 AND pu.product = ${PRODUCT_FULL_REPORT}
 AND pu.status = 'paid'
WHERE p.id = ${id}::bigint AND p.user_id = ${userId}::bigint
```

**`user_id` 조건이 이 함수의 존재 이유다.** `profiles.id`는 순번 `bigint`라 URL에 노출된다 — id만으로 조회하면 쿼리 파라미터를 증가시켜 남의 생년월일을 읽을 수 있다 (`docs/issues/backlog.md` 경고 항목).

**id 형식 검증**은 호출 전에 한다. URL에서 온 문자열을 그대로 `::bigint`로 캐스팅하면 `"abc"` 하나에 DB 에러가 나 500으로 떨어진다. `/^\d+$/`가 아니면 DB를 건드리지 않고 `notFound()`.

검증은 `src/app/report/_lib/access.ts`에 순수 함수로 둔다 — 이미 `searchParams`를 읽는 유일한 자리다(`getReportAccess`, `first`).

```ts
/** ?profile 이 순번 id 형태일 때만 문자열로, 아니면 null. */
export function parseProfileId(searchParams: SearchParams): string | null;
```

## 6. 뷰 조립 — `src/app/report/_lib/`

### `to-birth-input.ts` (신규)

```ts
export function toBirthInput(profile: ProfileRow): BirthInput;
```

퍼널의 동명 함수(`src/app/funnel/_lib/toBirthInput.ts`, `FunnelData` 기준)와 나란한 자리다. 이쪽은 저장된 행 기준.

- `time`이 `null`이면 `hour`/`minute`을 `undefined`로 (시주 없음).
- `calendar === "lunar"`일 때만 `isLeapMonth`를 넘긴다.
- 경도: `birthPlace`가 있으면 `findRegion(country, regionId)?.lon`, 없으면 `undefined`.
  `BirthInput.longitude` 주석이 "기본 127, 서울"이라 `undefined`가 안전한 기본값이다. 퍼널은 브라우저 로케일로 국가 기본값을 골랐지만 서버에는 그 정보가 없고, 저장된 프로필에도 남아 있지 않다.
- `applyTimeCorrection: profile.trueSolar`.

### `to-meta.ts` (신규)

```ts
export function toReportMeta(profile: ProfileRow, chart: Chart): { name: string; birthLine: string };
```

`birthLine` 포맷은 픽스처를 따른다: `"양력 1990.02.20 04:30 · 갑자일주"`.

- 달력 표기 — `profile.calendar`에서 (`"양력"` / `"음력"`).
- 날짜·시각 — `chart.solar` (음력 입력이면 환산된 양력이 들어 있다).
- 시간 모름 — 시각 부분을 뺀다: `"양력 1990.02.20 · 갑자일주"`.
- 일주 — `chart.day.korean + "일주"`.

### `regions.ts` 이동

`src/app/funnel/_lib/regions.ts` → `src/lib/regions.ts`.

리포트가 서버에서 경도를 풀어야 하므로 더 이상 퍼널 전용이 아니다. `report/_lib` → `funnel/_lib` 역방향 import보다 공용 자리로 옮기는 쪽이 맞다. 순수 데이터 + 순수 함수라 이동은 기계적이고, import는 6곳이다:

```
src/app/funnel/_lib/toBirthInput.ts
src/app/funnel/_lib/locale.ts
src/app/funnel/_lib/regions.test.ts          → src/lib/regions.test.ts 로 같이 이동
src/app/funnel/_context/FunnelContext.tsx
src/app/funnel/_components/steps/ReviewStep.tsx
src/app/funnel/_components/steps/BirthPlaceStep.tsx
```

## 7. 실패 처리

| 상황 | 결과 |
| --- | --- |
| `analyze()` throw (저장된 값이 계산 불가) | 에러 화면 |
| `GenerationError` 후 `overview` 없음 | 에러 화면 |
| DB 오류 | 전파. `error.tsx`를 새로 만들지 않고 Next 기본 에러 처리에 맡긴다 |
| `overview`는 있고 일부 섹션만 빠짐 | 있는 것만 렌더 |
| 07 `environment` | 항상 빈 칸 |

**판정 기준은 `overview`의 유무 하나다.** `overview`가 없으면 히어로(헤드라인·요약·키워드)가 통째로 비어 리포트라 부를 것이 없다. 있으면 나머지가 얼마나 빠졌든 보여준다 — 빠진 섹션은 다음 방문에 `missing`으로 다시 잡혀 저절로 채워진다(`handleSaju`가 이미 그렇게 설계돼 있다).

에러 화면은 `ReportShell` 안에 렌더한다 — 헤더는 남아 있어야 사용자가 `/home`으로 나갈 수 있다. 문구는 "리포트를 만들지 못했어요" + 다시 시도(같은 URL 링크).

## 8. 컴포넌트 — `src/app/report/_components/`

### `ReportView` 분해

현재 `ReportView`는 래퍼 div + 헤더 + `<main>` 전체를 한 컴포넌트가 쥐고 있다. 헤더가 Suspense 밖에 있어야 스트리밍이 의미가 있으므로 둘로 가른다.

```ts
// 래퍼 div + ReportHeader. children 을 <main> 안에 넣는다.
export function ReportShell({ showHomeLink, children }: { showHomeLink: boolean; children: ReactNode })

// 지금 ReportView 의 <main> 내용물 그대로 (히어로 ~ 잠금/유료 섹션)
export function ReportBody({ content, access }: { content: ReportContent; access: ReportAccess })
```

픽스처 경로와 실데이터 경로가 같은 두 조각을 쓴다.

### `AnalyzingReport.tsx` (신규)

Suspense fallback. 퍼널의 `AnalyzingScreen`을 재사용하지 않는다 — 그쪽 문구는 "사주를 계산하고 있어요 / 만세력 환산 · 오행 분석 중"인데, 여기서 실제로 오래 걸리는 단계는 만세력이 아니라 **LLM 해석 생성**이다. 진행 중이 아닌 것을 진행 중이라 말하지 않는다.

`<main>` 안에 들어가므로 `min-h-screen` 대신 본문 높이에 맞춘다.

### `ReportError.tsx` (신규)

§7의 에러 화면. 마찬가지로 `<main>` 안에 들어간다.

## 9. 페이지 — `src/app/report/page.tsx` (수정)

```ts
export const maxDuration = 60;
```

`/api/saju/route.ts`가 무료 5섹션 병렬 기준으로 잡아둔 값과 같다. **유료 12섹션(`?paid=true`)은 `daeunOutlook`이 가장 느려 60초를 넘길 수 있다** — 결제를 붙일 때 이 값을 다시 본다. 지금은 개발 토글로만 열리므로 60으로 둔다.

`year`는 `new Date().getFullYear()` — `/api/saju/route.ts`와 같다.

## 10. 테스트

| 대상 | 확인 내용 |
| --- | --- |
| `store.test.ts` (profiles) | `getProfile`이 `user_id`를 쿼리에 포함하는지 — 남의 id로 조회 시 `null` (백로그 경고 회귀 테스트) |
| `access.test.ts` | `parseProfileId` — `"abc"`, `"1 OR 1=1"`, `""`, 배열 파라미터 → `null`. `"12"` → `"12"` |
| `to-birth-input.test.ts` | `birthPlace` 유/무(경도 `undefined` 확인), 음력+윤달, 시간 모름(`hour`/`minute` `undefined`), `trueSolar` 전달 |
| `to-meta.test.ts` | 양력/음력 표기, 시간 모름일 때 시각 생략, 일주 표기, 음력 입력이 양력으로 환산되는지 |
| `produce.test.ts` | 캐시 히트/미스, 생성기 실패 시 `GenerationError`, DB 오류는 전파 |
| `handler.test.ts` (기존) | **수정 없이 통과.** 리팩터링이 동작을 바꾸지 않았다는 증거 |
| `regions.test.ts` | 이동만. 내용 변경 없음 |

DB에 실제로 붙는 테스트는 만들지 않는다 — 기존 `store.test.ts`들과 같이 목 `SqlClient`만 쓴다.

## 11. 파일 목록

```
src/app/api/saju/_lib/produce.ts                    (신규)
src/app/api/saju/_lib/produce.test.ts               (신규)
src/app/api/saju/_lib/handler.ts                    (수정: produceSections 호출로 축소)
src/lib/profiles/store.ts                           (수정: getProfile 추가)
src/lib/profiles/store.test.ts                      (수정)
src/lib/regions.ts                                  (이동: funnel/_lib/regions.ts)
src/lib/regions.test.ts                             (이동)
src/app/funnel/_lib/toBirthInput.ts                 (수정: import 경로)
src/app/funnel/_lib/locale.ts                       (수정: import 경로)
src/app/funnel/_context/FunnelContext.tsx           (수정: import 경로)
src/app/funnel/_components/steps/ReviewStep.tsx     (수정: import 경로)
src/app/funnel/_components/steps/BirthPlaceStep.tsx (수정: import 경로)
src/app/report/page.tsx                             (수정: 실데이터 배선)
src/app/report/_lib/access.ts                       (수정: parseProfileId 추가)
src/app/report/_lib/access.test.ts                  (수정)
src/app/report/_lib/to-birth-input.ts               (신규)
src/app/report/_lib/to-birth-input.test.ts          (신규)
src/app/report/_lib/to-meta.ts                      (신규)
src/app/report/_lib/to-meta.test.ts                 (신규)
src/app/report/_components/ReportView.tsx           (수정: ReportShell + ReportBody 로 분해)
src/app/report/_components/AnalyzingReport.tsx      (신규)
src/app/report/_components/ReportError.tsx          (신규)
docs/issues/backlog.md                              (수정: 해결 항목 정리)
```

## 12. 백로그 반영

`docs/issues/backlog.md`의 "`/report` 실데이터 배선 때 처리" 두 항목 중:

- **`session.userId` 필터** — 이번에 해결(§5). 항목을 지운다.
- **섹션 수 모델 두 벌** — 이번 범위 밖(§2 비범위). 항목을 남기되, `environment`가 유료 화면에서 빈 칸으로 남아 있다는 현재 증상을 함께 적는다.
