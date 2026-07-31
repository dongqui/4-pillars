# 로그인 홈 — 저장된 프로필 (`/home`) 설계 문서

**날짜:** 2026-07-31
**디자인 출처:** Claude Design 프로젝트 `사주` — `Saju My Profiles.dc.html`. 로컬 사본: `design/project/`.

## 1. 목표

로그인한 사용자가 접속했을 때 처음 보는 화면을 만든다. 저장된 사주 프로필 목록을 보여주고, 각 프로필의 리포트로 들어가거나 새 프로필을 추가할 수 있다.

프로필이라는 개념 자체가 지금 코드베이스에 없으므로, 이번 작업에서 **DB 테이블(`profiles`, `purchases`)과 저장 배선까지 함께 만든다.**

## 2. 범위 결정 (확정됨)

| 항목 | 결정 |
| --- | --- |
| 데이터 깊이 | **DB까지.** `profiles` 테이블 신설 + 조회/생성 쿼리 + 퍼널 완료 시 저장. |
| 경로 | **`/home` 신설.** 로그인 후 기본 행선을 `/`에서 `/home`으로 변경. 랜딩 `/`는 비로그인 방문자용으로 그대로 둔다. |
| 프로필 추가 UI | **퍼널 재사용.** "새 프로필 추가" → `/funnel?step=name`. 모달·별도 폼을 만들지 않는다. |
| 유료 상태 판정 | **`purchases` 테이블 신설.** 리포트 외 상품도 담을 수 있게 `product` 컬럼으로 일반화. |
| 관계 칩 | **제거.** 퍼널에 관계 입력이 없고, 넣기 위해 퍼널을 늘리지 않기로 함. |
| 리포트 연결 | **`/report?profile=<id>` 로 보내기만.** `/report`가 그 id로 실제 사주를 계산·조회해 렌더하는 배선은 이번 범위 밖. |
| accent 색 | **기존 토큰 유지** (`--color-accent` = `#2563eb`). 디자인의 인디고 `#4F46E5`는 따르지 않는다 — 랜딩·퍼널·로그인과 색을 통일한다. |

### 비범위 (YAGNI)

- 실제 결제/PG 연동. `purchases`는 테이블과 조회 경로만 만들고, 행을 넣는 코드는 없다 (결제 붙기 전까지 모든 프로필이 "무료 리포트"로 보인다).
- `/report`의 실데이터 배선 — 지금대로 fixture를 렌더한다.
- 프로필 수정·삭제. 이번엔 목록/생성만.
- 헤더 사용자 칩의 드롭다운 메뉴 — 로그아웃 단일 동작으로 둔다.

## 3. 라우트

| 파일 | 변경 |
| --- | --- |
| `src/app/home/page.tsx` (신규) | 서버 컴포넌트. `getSession()`이 없으면 `redirect("/login?next=/home")`. |
| `src/lib/auth/oauth.ts` | `safeNext`의 기본값을 `"/"` → `"/home"`으로 변경. |
| `src/lib/auth/oauth.test.ts` | 위 기본값 변경에 맞춰 기존 케이스 수정 (`safeNext(null, origin) === "/home"`). |

오픈 리다이렉트 방어 동작(외부 origin·`//`·개행 차단)은 그대로다. 차단 시 fallback 값만 `/home`으로 바뀐다.

로그아웃(`/api/auth/logout`)은 지금대로 `/`로 보낸다 — 로그아웃한 사용자에게는 랜딩이 맞다.

## 4. DB

### `migrations/0005_profiles.sql`

퍼널이 수집하는 **원본 입력**을 그대로 보관한다. 계산된 원국(4기둥)을 저장하지 않는 이유: `saju-core`가 바뀌면 원국은 다시 계산하면 되지만, 사용자가 입력한 생년월일시는 복구할 수 없다. 원국은 파생값이다.

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  gender          text NOT NULL CHECK (gender IN ('male', 'female')),
  calendar        text NOT NULL DEFAULT 'solar' CHECK (calendar IN ('solar', 'lunar')),
  is_leap_month   boolean NOT NULL DEFAULT false,
  birth_year      int NOT NULL,
  birth_month     int NOT NULL,
  birth_day       int NOT NULL,
  time_known      boolean NOT NULL DEFAULT true,
  birth_hour      int,          -- time_known=false 면 NULL
  birth_minute    int,
  birth_country   text,         -- 출생지 스킵 시 NULL → 국가 기본 경도 사용
  birth_region_id text,
  true_solar      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_user_created_idx ON profiles (user_id, created_at DESC);
```

컬럼은 `FunnelData`(`src/app/funnel/_context/FunnelContext.tsx`)와 1:1로 대응한다. `birthPlace: { country, regionId }`만 두 컬럼으로 펴진다.

### `migrations/0006_purchases.sql`

"지금은 리포트 하나지만 나중에는 다른 서비스도 제공할 수 있다"는 요구에 맞춰, 상품을 `product` 문자열로 일반화한다.

```sql
CREATE TABLE IF NOT EXISTS purchases (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id       bigint REFERENCES profiles(id) ON DELETE CASCADE,
  product          text NOT NULL,
  amount           int NOT NULL,
  currency         text NOT NULL DEFAULT 'KRW',
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'paid', 'refunded', 'failed')),
  provider         text,        -- PG사 식별자. 결제 연동 시 채운다.
  provider_txn_id  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  paid_at          timestamptz
);

-- 같은 프로필의 같은 상품을 두 번 결제 완료로 만들 수 없다.
-- 부분 인덱스라 pending/failed 행은 여러 개 남을 수 있다 (결제 재시도).
CREATE UNIQUE INDEX IF NOT EXISTS purchases_paid_unique
  ON purchases (profile_id, product) WHERE status = 'paid';

CREATE INDEX IF NOT EXISTS purchases_user_idx ON purchases (user_id, created_at DESC);
```

`profile_id`가 NULL 허용인 이유: 프로필 단위가 아닌 상품(구독 등)을 나중에 같은 테이블에 담기 위해서다.

**상품 식별자 상수**는 `src/lib/profiles/products.ts`에 둔다:

```ts
export const PRODUCT_FULL_REPORT = "full_report";
```

## 5. 데이터 계층 — `src/lib/profiles/store.ts`

`src/lib/auth/users.ts`와 같은 **주입형 `SqlClient`** 패턴을 따른다 (기본값은 공유 neon 클라이언트, 테스트에서는 목 주입).

```ts
export const MAX_PROFILES = 5;

/** DB 행 그대로. 뷰 변환은 하지 않는다. */
export interface ProfileRow {
  id: string;
  name: string;
  gender: "male" | "female";
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
  birth: { year: number; month: number; day: number };
  timeKnown: boolean;
  time: { hour: number; minute: number } | null;
  birthPlace: { country: string; regionId: string } | null;
  trueSolar: boolean;
  createdAt: string;
  /** purchases 조인에서 파생. 결제 미구현이라 현재는 항상 false. */
  isPaid: boolean;
}

export type CreateProfileInput = Omit<ProfileRow, "id" | "createdAt" | "isPaid">;

export async function listProfiles(userId: string, client?: SqlClient): Promise<ProfileRow[]>;
export async function countProfiles(userId: string, client?: SqlClient): Promise<number>;
export async function createProfile(
  userId: string,
  input: CreateProfileInput,
  client?: SqlClient,
): Promise<{ id: string }>;
```

- `listProfiles` — `profiles LEFT JOIN purchases ON (profile_id, product='full_report', status='paid')`로 `isPaid`를 파생한다. 정렬은 `created_at DESC`.
- `createProfile` — 삽입 전 `countProfiles`로 검사하고 `MAX_PROFILES` 이상이면 `ProfileLimitError`를 던진다. 앱 레벨 검사라 동시 요청에서는 6개가 들어갈 수 있지만, 5개 제한은 UX 가드일 뿐 정합성 요건이 아니라 트랜잭션을 걸지 않는다.

## 6. 뷰모델 — `src/app/home/_lib/to-profile-card.ts`

DB 행을 카드가 필요로 하는 형태로만 줄이는 **순수 함수**. 테스트 대상.

```ts
export interface ProfileCard {
  id: string;
  name: string;
  initial: string;        // name 첫 글자
  birthLabel: string;     // "1990.10.25 · 오후 3시 20분" | "1990.10.25 · 시간 모름"
  isPaid: boolean;
  openedSections: number; // 무료 5 / 유료 12
  totalSections: number;  // 12
  reportHref: string;     // /report?profile=<id>
}

export function toProfileCard(row: ProfileRow): ProfileCard;
export function countCaption(cards: ProfileCard[]): string;  // "3개 · 전체 리포트 1개"
```

섹션 개수는 **`SECTIONS` 레지스트리**(`src/app/api/saju/_lib/sections/registry.ts`)에서 파생한다 — `Object.values(SECTIONS).filter(s => s.tier === "free").length`. 디자인의 "12개 중 4개"는 하드코딩된 값이었고, 실제 레지스트리는 총 12개 / 무료 5개(`overview`, `personality`, `outerVsInner`, `strengths`, `cautions`)라서 화면에는 **"12개 중 5개 열림"**이 나온다. 나중에 섹션을 추가해도 문구가 자동으로 따라간다.

음력 프로필의 `birthLabel`은 `"1990.10.25 (음력) · ..."`로 표기한다 — 양력만 표시하면 사용자가 자기 입력을 알아보지 못한다.

## 7. UI — `src/app/home/`

디자인을 Tailwind v4로 옮긴다. accent는 기존 토큰(`bg-accent`, `text-accent`, `bg-accent-soft`).

| 컴포넌트 | 내용 |
| --- | --- |
| `page.tsx` | 서버 컴포넌트. 세션 확인 → `listProfiles` → `toProfileCard` → 렌더. |
| `_components/HomeHeader.tsx` | sticky 헤더. 좌측 로고("사" + "사주"), 우측 사용자 칩. |
| `_components/ProfileCard.tsx` | 좌측 컬러 스트라이프 + 아바타 + 이름/생일 + 진행 바 + CTA. |
| `_components/AddProfileButton.tsx` | 점선 테두리 `Link` → `/funnel?step=name`. |
| `_components/EmptyState.tsx` | 프로필 0개일 때. |

### 디자인과 달라지는 점

1. **관계 칩 제거** — 상태 칩("전체 리포트" / "무료 리포트")만 남는다. 따라서 디자인의 "나" 검은 칩도 없다.
2. **빈 상태 신규** — 디자인에는 없다. 로그인 직후 첫 화면이라 대부분의 신규 사용자는 프로필이 0개다. 목록 자리에 안내 문구("아직 저장된 프로필이 없어요 / 생년월일시를 입력하면 사주 리포트를 만들어 드려요")와 점선 추가 버튼을 중앙에 배치한다. 상단의 범례(전체/무료 리포트 dot)와 하단 안내 문구는 이때 감춘다 — 가리킬 대상이 없다.
3. **사용자 칩 동작** — 디자인은 동작이 없다. `/api/auth/logout`으로 가는 링크로 만들고 "로그아웃"을 명시한다. 동작 없는 버튼을 두지 않는다.
4. **5개 도달 시** — 추가 버튼을 비활성 스타일로 바꾸고 하단 문구를 "프로필 5개를 모두 사용했어요"로 교체한다.

## 8. 퍼널 → 저장 배선

### `POST /api/profiles` (신규)

```
요청  : FunnelData 를 zod 로 검증한 형태
201   : { id }
401   : 세션 없음
409   : { error: "limit" } — 5개 초과
400   : 검증 실패
```

로직은 `src/app/api/profiles/_lib/handler.ts`에 순수 함수로 두고 route는 얇게 감싼다 — `src/app/api/saju/`가 쓰는 구조와 같다.

### `src/app/funnel/page.tsx` 변경

지금은 `analyzing` 상태에서 2.2초 후 무조건 `/report`로 push한다. 이걸 실제 저장으로 바꾼다:

```
분석 시작 → POST /api/profiles
  201 → /report?profile=<id>
  401 → /report            (비로그인은 지금 동작 유지: 저장 없이 리포트만)
  409 → /home              (한도 초과 — 목록으로 돌려보낸다)
  그 외 → /report          (저장 실패로 사용자를 막지 않는다)
```

`AnalyzingScreen`은 응답이 올 때까지 유지되므로, 기존의 고정 2.2초 타이머는 "최소 노출 시간"으로 바꾼다 — 응답이 빨리 와도 화면이 번쩍이지 않게.

## 9. 테스트

| 대상 | 확인 내용 |
| --- | --- |
| `to-profile-card.test.ts` | 이니셜, 시간 모름/오전·오후 포맷, 음력 표기, 무료/유료 섹션 수, `countCaption` |
| `store.test.ts` (profiles) | 목 `SqlClient`로 `listProfiles`의 `isPaid` 파생, `createProfile`의 5개 제한 거부 |
| `handler.test.ts` (profiles API) | 비로그인 401, 한도 초과 409, 검증 실패 400, 정상 201 |
| `oauth.test.ts` | `safeNext` 기본값이 `/home`으로 바뀐 것, 오픈 리다이렉트 방어는 유지 |

DB에 실제로 붙는 테스트는 만들지 않는다 — 기존 `store.test.ts`들과 같이 목 클라이언트만 쓴다.

## 10. 파일 목록

```
migrations/0005_profiles.sql                        (신규)
migrations/0006_purchases.sql                       (신규)
src/lib/profiles/products.ts                        (신규)
src/lib/profiles/store.ts                           (신규)
src/lib/profiles/store.test.ts                      (신규)
src/app/home/page.tsx                               (신규)
src/app/home/_lib/to-profile-card.ts                (신규)
src/app/home/_lib/to-profile-card.test.ts           (신규)
src/app/home/_components/HomeHeader.tsx             (신규)
src/app/home/_components/ProfileCard.tsx            (신규)
src/app/home/_components/AddProfileButton.tsx       (신규)
src/app/home/_components/EmptyState.tsx             (신규)
src/app/api/profiles/route.ts                       (신규)
src/app/api/profiles/_lib/handler.ts                (신규)
src/app/api/profiles/_lib/handler.test.ts           (신규)
src/app/api/profiles/_lib/input.ts                  (신규, zod 스키마)
src/lib/auth/oauth.ts                               (수정: safeNext 기본값)
src/lib/auth/oauth.test.ts                          (수정)
src/app/funnel/page.tsx                             (수정: 저장 배선)
```
