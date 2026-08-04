# 익명 사용자 입력값 보존 설계 문서

**날짜:** 2026-08-04

## 1. 목표

익명 사용자가 퍼널을 끝내면 **입력값을 Upstash Redis에 임시로 남기고, 로그인하는 순간 그것을 프로필 행으로 승격시킨다.**

`docs/issues/backlog.md`의 "리포트 발행 흐름에 남은 고리 §2 익명 사용자의 입력값 보존"을 해소한다. 목표 흐름 **"무료 리포트 → 로그인하면 프로필로 저장 → 결제하면 유료 섹션 추가"** 중 두 번째 고리다.

지금 상태:

- 퍼널 입력은 `FunnelContext` 메모리에만 있다. `/report`로 넘어가는 순간 소실된다.
- 퍼널 완료 시 `POST /api/profiles`를 부르지만 비로그인이면 401을 받고 그냥 넘어간다 — 즉 순서가 **반대**다. 저장되려면 *이미* 로그인돼 있어야 한다.
- `/login`으로 가는 링크가 코드베이스 어디에도 없다. `/home`의 리다이렉트와 OAuth 실패 리다이렉트뿐이다.

## 2. 범위 결정 (확정됨)

| 항목 | 결정 |
| --- | --- |
| 저장소 | **Upstash Redis.** 값은 서버에, 브라우저는 토큰만 쿠키로 나른다 |
| 손잡이 | **httpOnly 쿠키 `draft`.** OAuth 왕복을 넘을 수 있는 유일한 수단 |
| 쓰기 자리 | **`POST /api/profiles` 안에서 세션 유무로 갈린다.** 401은 사라진다 |
| 엔드포인트 이름 | **`/api/profiles` 유지.** 드래프트는 "주인이 아직 없는 프로필"이다 |
| 승격 지점 | **OAuth 콜백.** 로그인 진입이 어디든 승격은 한 군데서만 일어난다 |
| 로그인 진입점 | **기존 CTA("전체 결과 보기")의 행선지를 로그인 여부로 가른다.** 새 UI 없음 |
| 프로필 한도 | **5 → 20으로 상향.** 한도 자체는 남긴다 |

### 비범위 (YAGNI)

- **익명 `/report` 실데이터.** `?profile`이 없으면 지금처럼 `sampleReport`를 렌더한다. 이번 작업은 "입력값이 살아남아 프로필이 된다"까지다. 실데이터 배선은 백로그 §1(`docs/superpowers/specs/2026-08-01-report-real-data-design.md`)이 따로 다룬다.
- **결제 연동.** 로그인 → 리포트까지만 잇고, 결제가 끼어들 자리를 콜백의 행선지 결정 한 줄로 비워둔다(§4).
- **익명 LLM 레이트리밋.** 익명 경로에서 생성이 돌지 않으므로 이번엔 해당 없음. 백로그에 남긴다.
- **프로필 중복 검사.** 같은 생년월일이 두 번 저장되는 것을 막지 않는다 — 현행 퍼널도 막지 않는다.

## 3. 왜 쿠키가 필요한가

Redis는 서버 쪽 저장소라 키가 있어야 값을 되찾는다. 로그인 사용자는 그 키가 `session.userId`지만 익명 사용자에게는 그런 표식이 없다. 그래서 **Redis가 데이터를 갖고, 쿠키가 그 키를 나른다.**

손잡이를 둘 다른 자리를 따져보면:

| 손잡이 | 문제 |
| --- | --- |
| URL 쿼리 | OAuth 왕복을 못 넘는다. 콜백 URL은 provider가 조립한다 |
| localStorage | 콜백은 서버 리다이렉트라 JS가 돌지 않는다 |
| 쿠키 | 왕복을 그대로 넘는다 — `oauth_state`·`oauth_verifier`·`oauth_next`가 이미 이 방식이다 |

값 자체를 서명 쿠키에 넣는 안(백로그가 적어둔 다른 갈래)을 쓰지 않는 것이 Redis를 고른 이유고, 손잡이 쿠키는 그래도 남는다.

## 4. 전체 흐름

```
[익명] 퍼널 완료
  └ POST /api/profiles ──── 세션 없음 ──→ Redis 드래프트 + Set-Cookie(draft)
                                          202 {} → /report
                       └── 세션 있음 ──→ createProfile → 201 {id} → /report?profile=<id>

[익명] /report 에서 "로그인하고 전체 결과 보기"
  └ /login?next=%2Freport → OAuth 왕복
      └ 콜백: upsertUser → promoteDraft
               ├ promoted → 드래프트·쿠키 삭제 → /report?profile=<id>   ← §1 해소로 옮김(아래 문단 참고). §3이 붙으면 체크아웃으로
               ├ limit    → 드래프트·쿠키 유지 → /home?error=limit
               ├ none     → 쿠키 삭제 → 원래 next
               └ failed   → 쿠키 유지 → 원래 next
```

**(2026-08-04 작성 당시)** `promoted` 가 `/report?profile=<id>` 가 아니라 `/home?saved=1` 이었던 이유:
`/report`가 그때는 `?profile`을 무시하고 `sampleReport` 픽스처만 렌더했다(백로그 §1 미구현). 그
상태로 리포트로 보내면 로그인 전후로 화면이 글자 하나 안 바뀌어 로그인의 결과가 보이지 않았다.

**§1 해소로 바뀜.** `/report?profile=<id>`가 실데이터를 렌더하게 됐으므로(`docs/superpowers/plans/2026-08-01-report-real-data.md`), 그 이유가 사라졌다. 승격되면 이제 방금 만든 프로필의
`/report?profile=<id>`로 곧장 보낸다 — 로그인의 결과가 그 자리에서 보인다. §3(결제)이 붙으면
이 갈래가 체크아웃으로 바뀔 수 있다.

**401은 사라진다.** 세션 유무를 아는 유일한 쪽(서버)이 한 번만 판단하고, 퍼널은 상태코드로 행선지만 읽는다.

`next`는 로그인 *전에* 정해지는데 프로필 id는 로그인 *순간에* 생긴다. 그래서 `next=/report?profile=7`을 미리 넣을 수 없고, **최종 행선지는 콜백이 정한다.** 승격이 일어나면 `next`가 무엇이었든 항상 방금 만든 프로필의 `/report?profile=<id>`로 보낸다 — 규칙이 하나라 분기가 없다(위 문단 참고).

## 5. 저장소 — `src/lib/redis.ts`, `src/lib/drafts/store.ts` (신규)

`src/lib/redis.ts`는 `src/lib/db.ts`와 나란한 자리다. 환경 변수가 없으면 모듈 로드 시 throw하고 클라이언트 하나를 export한다.

```ts
export const DRAFT_COOKIE = "draft";
const TTL_SECONDS = 60 * 60 * 24 * 7;   // 7일 — 세션 만료(session.ts MAX_AGE)와 같은 리듬

export function generateDraftToken(): string;              // crypto.randomUUID()
export async function putDraft(token: string, body: CreateProfileBody, client?): Promise<void>;
export async function getDraft(token: string, client?): Promise<CreateProfileBody | null>;
export async function deleteDraft(token: string, client?): Promise<void>;
export function draftCookieOptions();                      // httpOnly, sameSite:lax, path:/, maxAge=TTL
```

- Redis 키는 `draft:<token>`. 값은 `CreateProfileBody` JSON — `profiles` 컬럼과 같은 모양이라 승격이 매핑 없이 끝난다.
- **읽을 때 `createProfileSchema`로 다시 검증한다.** 배포 사이에 스키마가 바뀌면 옛 레코드가 남아 있을 수 있고, 검증 없이 `createProfile`에 넣으면 그것이 DB까지 간다. 파싱 실패는 `null` — 드래프트가 없는 것과 같이 취급한다.
- 토큰 생성은 `crypto.randomUUID()`(계획 Task 1의 지시를 그대로 따름) — 122비트 CSPRNG 이고 추측 대상(사용자 식별자 등과 묶인 값)이 없어 충분하다.
- `client?` 주입은 `profiles/store.ts`의 `SqlClient` 패턴 그대로. 테스트가 실제 Redis에 붙지 않는다.
- 쿠키에는 토큰만 담는다. `sameSite: "lax"`라 OAuth 복귀(top-level GET)에 그대로 실려 온다 — `oauth_state`와 같은 조건이다.

## 6. 엔드포인트 계약 — `POST /api/profiles`

| 상태 | 의미 | 본문 | 부수효과 |
| --- | --- | --- | --- |
| 201 | 프로필 확정 | `{ id }` | `profiles` 행 |
| 202 | 접수·보관 중 | `{}` | Redis 드래프트 + `Set-Cookie: draft` |
| 400 | 입력 오류 | `{ error }` | — |
| 409 | 한도 초과 | `{ error: "limit" }` | — (세션 있을 때만 가능) |
| 500 | 서버 오류 | `{ error }` | — |

`202 Accepted`가 "요청은 받았으나 처리가 완결되지 않았다"는 뜻이므로 "프로필을 만들어달라 → 받았고, 주인이 정해지면 확정한다"가 상태코드로 표현된다. 그래서 엔드포인트 이름은 `profiles` 그대로 정직하다.

`handleCreateProfile`은 순수 함수로 남긴다 — 쿠키를 굽지 않고 토큰만 결과에 실어 보내고, 라우트가 굽는다:

```ts
export interface HandlerDeps {
  userId: string | null;
  create: (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;
  saveDraft: (token: string, body: CreateProfileBody) => Promise<void>;
  newToken: () => string;
  existingToken: string | null;   // 요청에 실려온 draft 쿠키
}

export interface HandlerResult {
  status: number;
  body: { id: string } | Record<string, never> | { error: string };
  draftToken?: string;            // 있으면 라우트가 쿠키를 굽는다
}
```

`existingToken`을 받는 이유: 같은 브라우저가 퍼널을 두 번 돌면 **기존 토큰에 덮어쓴다.** 매번 새로 발급하면 손잡이 없는 레코드가 TTL 동안 Redis에 쌓인다.

`time`·`isLeapMonth` 정합화(현재 `handler.ts`의 두 줄)는 드래프트 경로에도 똑같이 적용한다 — 어긋난 조합을 Redis에도 남기지 않는다.

퍼널(`src/app/funnel/page.tsx`)은 이렇게 된다:

```ts
let dest = "/report";
if (res.status === 201) dest = `/report?profile=${id}`;
else if (res.status === 202) {
  // 드래프트로 보관됨. dest 는 이미 "/report" 이므로 재대입하지 않는다.
} else if (res.status === 409) dest = "/home?error=limit";
else console.error(...);        // 그 밖은 로그만, dest 는 "/report" 그대로
```

## 7. 승격 — `src/lib/drafts/promote.ts` (신규)

콜백 라우트에 로직을 박지 않는다. Next 없이 테스트되는 함수로 뺀다.

```ts
export type PromoteResult =
  | { kind: "none" }                  // 토큰 없음 / 레코드 없음 / 만료 / 스키마 불일치
  | { kind: "promoted"; id: string }
  | { kind: "limit" }                 // 드래프트·쿠키를 남긴다
  | { kind: "failed" };               // 로그만 남기고 로그인은 성공시킨다

export async function promoteDraft(
  token: string | null,
  userId: string,
  deps: PromoteDeps,                  // getDraft / createProfile / deleteDraft
): Promise<PromoteResult>;
```

라우트는 결과를 행선지와 쿠키 조작으로만 옮긴다:

| 결과 | 행선지 | 쿠키 | Redis |
| --- | --- | --- | --- |
| `promoted` | `/report?profile=<id>`(2026-08-04 작성 당시엔 `/home?saved=1` — §1 해소로 옮김) | 삭제 | 삭제 |
| `limit` | `/home?error=limit` | 유지 | 유지 |
| `none` | 원래 `next` | 삭제 | — |
| `failed` | 원래 `next` | 유지 | 유지 |

**승격 실패가 로그인을 막으면 안 된다.** Redis가 죽었든 DB가 튕겼든 세션 쿠키는 이미 발급된 채로 리다이렉트한다 — 사용자는 로그인은 된 상태로 도착하고, 드래프트는 남아 있어 다음 기회가 있다. `promoteDraft`는 throw하지 않는다.

`completeOAuth`의 `CallbackResult`에 `userId`를 추가한다 — `src/lib/auth/callback.ts`에서 `user.id`가 이미 손에 있다. 승격에 필요한 유일한 인증 쪽 변경이다.

## 8. 화면 변경

### `LockedSections` — 로그인 진입점

`isLoggedIn`을 받아 CTA 두 곳(인라인, 스티키 바)의 행선지와 문구를 가른다.

| 상태 | href | 문구 |
| --- | --- | --- |
| 비로그인 | `/login?next=%2Freport` | 로그인하고 전체 결과 보기 |
| 로그인 | `#` (지금 그대로) | 전체 결과 보기 |

`access.isLoggedIn`이 이미 `ReportView`까지 내려와 있어 prop 한 줄이 는다. 새 UI를 만들지 않는 이유: 결제를 하려면 어차피 계정이 필요하므로 "전체 결과 보기"의 첫 단계가 로그인이다. 결제가 붙으면 로그인 쪽 `#`만 체크아웃으로 바뀐다.

`/login?next=`는 이미 provider 라우트까지 그대로 넘어간다(`src/app/login/page.tsx`의 `nextQuery`). 진입점 쪽은 배선만 하면 된다.

### `MAX_PROFILES` 5 → 20

`/home`의 안내 문구 두 줄이 상수를 읽고 있어 저절로 따라간다. `profiles/store.ts`의 "5개 제한" 주석과 `store.test.ts` 문구도 같이 손본다.

한도를 지우지 않는 이유: 프로필 수만큼 무료 섹션 LLM 생성이 돌 수 있고 캐시는 원국 단위라 생년월일이 다르면 히트가 없다. 다만 진짜 방어가 필요한 자리는 개수가 아니라 생성 호출이므로, 20은 정합성 요건이 아니라 여유 있는 UX 가드다.

### `/home?error=limit` 배너

퍼널의 409와 승격 실패가 둘 다 여기로 떨어지는데 지금은 아무 설명이 없다 — 백로그 UX 항목이다. "프로필이 가득 찼어요. 하나를 지우면 새로 저장할 수 있어요." 한 줄.

### `/home?saved=1` 배너

콜백에서 승격이 성공하면 여기로 온다. "프로필이 저장됐어요. 언제든 다시 볼 수 있어요." 한 줄 — 성격이 다르므로(성공 vs 경고) `error=limit` 배너와 색만 다르게(`emerald`) 나란히 둔다.

## 9. 실패·엣지

| 상황 | 결과 |
| --- | --- |
| 쿠키는 있는데 Redis 레코드 만료 | `none` — 쿠키를 지우고 원래 `next`. 조용히 지나간다 |
| Redis 레코드가 현재 스키마에 안 맞음 | `getDraft`가 `null` → 위와 같음 |
| `putDraft` 실패 (Redis 장애) | 500. 퍼널은 "그 밖" 갈래로 `/report`. 리포트를 막지 않는다 — 현행 퍼널의 원칙 그대로 |
| 익명이 퍼널을 두 번 돌림 | 같은 토큰에 덮어쓰기 |
| 이미 로그인한 사람이 또 로그인 | 드래프트가 있으면 승격된다. 의도된 동작 |
| 콜백이 동시에 두 번 (탭 두 개) | 프로필이 둘 생길 수 있다. 현행 퍼널도 중복을 막지 않으므로 새로 생기는 문제가 아니다 — 그대로 둔다 |

**레이트리밋은 이번 범위 밖이다.** 익명 사용자는 여전히 로그인 없이는 실데이터 리포트를 받을 수 없다 —
§1 해소 이후에도 `/report?profile=<id>`는 세션이 없으면 `/login?next=...`로 redirect하고, `?profile`이
없으면 지금처럼 `sampleReport` 픽스처를 렌더한다(`src/app/report/page.tsx`). 즉 익명 LLM 경로는 이
작업으로도 열리지 않았으므로 비싼 호출은 늘지 않는다. 드래프트 쓰기는 값이 작고 TTL이 있다. 방어가
필요한 자리는 생성 호출이고, 백로그에 이미 있다.

## 10. 테스트

| 대상 | 확인 |
| --- | --- |
| `drafts/store.test.ts` (신규) | TTL과 함께 `draft:<token>`에 쓴다 / 없는 키 → `null` / 스키마에 안 맞는 값 → `null` |
| `drafts/promote.test.ts` (신규) | 네 갈래(`none`·`promoted`·`limit`·`failed`) / 어떤 경우에도 throw하지 않는다 |
| `api/profiles/_lib/handler.test.ts` (수정) | 세션 없음 → 202 + `draftToken` / `existingToken` 재사용 / 정합화가 드래프트에도 걸린다 / 세션 있을 때 201·400·409는 그대로 |
| `api/profiles/route.test.ts` (수정) | 202일 때 `Set-Cookie: draft`가 붙는다 |
| `auth/callback.test.ts` (수정) | `CallbackResult`에 `userId`가 실린다 |
| `profiles/store.test.ts` (수정) | 한도 상수 변경 반영 |

Redis에 실제로 붙는 테스트는 만들지 않는다 — `SqlClient` 주입과 같은 방식으로 클라이언트를 목으로 넣는다.

## 11. 파일 목록

```
src/lib/redis.ts                               (신규)
src/lib/drafts/store.ts                        (신규)
src/lib/drafts/store.test.ts                   (신규)
src/lib/drafts/promote.ts                      (신규)
src/lib/drafts/promote.test.ts                 (신규)
src/lib/profiles/store.ts                      (수정: MAX_PROFILES 20)
src/lib/profiles/store.test.ts                 (수정)
src/lib/auth/callback.ts                       (수정: userId 노출)
src/lib/auth/callback.test.ts                  (수정)
src/app/api/profiles/_lib/handler.ts           (수정: 드래프트 갈래)
src/app/api/profiles/_lib/handler.test.ts      (수정)
src/app/api/profiles/route.ts                  (수정: 쿠키 굽기)
src/app/api/profiles/route.test.ts             (수정)
src/app/api/auth/callbacks/[provider]/route.ts (수정: 승격 배선)
src/app/funnel/page.tsx                        (수정: 202/409 분기)
src/app/report/_components/LockedSections.tsx  (수정: CTA 분기)
src/app/report/_components/ReportView.tsx      (수정: isLoggedIn 전달) — 2026-08-04 §1 작업이
                                                이 파일을 ReportShell.tsx + ReportBody.tsx 로 갈랐다
src/app/home/page.tsx                          (수정: error=limit 배너)
.env.example                                   (수정: UPSTASH 두 줄)
docs/issues/backlog.md                         (수정)
```

## 12. 백로그 반영

- **"리포트 발행 흐름에 남은 고리 §2 익명 사용자의 입력값 보존"** — 해소. 항목을 지운다.
- **"UX 다듬기: 프로필 한도 초과(409)로 `/home`으로 돌려보낼 때 설명 없음"** — 해소(§8). 항목을 지운다.
- **"UX 다듬기: 랜딩에서 `/login`으로 가는 링크가 없다"** — 남긴다. `/report` CTA가 진입점 하나를 열지만 랜딩은 그대로다.
- **"§1 `/report` ↔ 생성 파이프라인 배선"** — 남긴다. 이번 작업이 만드는 `?profile=<id>` 행선지의 실제 소비자가 그쪽이다.
- **익명 LLM 레이트리밋** — 남긴다. §1이 익명 경로를 열 때 필요해진다.
