# 로그인 홈 — 저장된 프로필 (`/home`) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인한 사용자가 처음 보는 화면(`/home`)에서 저장된 사주 프로필 목록을 보고, 리포트로 들어가거나 새 프로필을 추가할 수 있게 한다.

**Architecture:** `profiles`·`purchases` 테이블을 신설하고, 주입형 `SqlClient` 저장소(`src/lib/profiles/store.ts`)로 감싼다. `/home`은 서버 컴포넌트에서 세션 → 목록 조회 → 순수 뷰모델 변환(`to-profile-card.ts`) → 렌더까지 한 번에 처리한다. 프로필 생성은 `POST /api/profiles`가 담당하고, 퍼널의 분석 화면이 이를 호출한다.

**Tech Stack:** Next.js 16 App Router (서버 컴포넌트), React 19, Tailwind CSS v4, zod v4, `@neondatabase/serverless`, vitest

**설계 문서:** `docs/superpowers/specs/2026-07-31-home-profiles-design.md`

### 설계 문서에서 늘어난 것 (계획 단계에서 발견)

| 추가 | 왜 |
| --- | --- |
| 마이그레이션 파일 2개 → 5개 | `migrate.mts`가 파일당 statement 하나만 실행한다. `CREATE INDEX`를 같은 파일에 둘 수 없다. |
| `getUser()` (`src/lib/auth/users.ts`) | 헤더가 "김동진님"을 표시해야 하는데 세션에는 `userId`밖에 없다. |
| `toProfileBody()` (`src/app/funnel/_lib/`) | 퍼널 `FunnelData` → API 본문 변환. 순수 함수로 빼야 테스트가 된다. |
| 로그아웃 라우트 303 수정 | `NextResponse.redirect` 기본값 307은 POST를 `/`로 다시 보내 405가 난다. 헤더의 로그아웃이 이 라우트의 첫 사용처다. |

## Global Constraints

- **Next.js 16.2.10.** 학습 데이터와 API가 다를 수 있다. 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 관련 가이드를 읽는다 (`AGENTS.md` 규칙).
- **마이그레이션 파일 하나에 SQL statement 하나.** `scripts/migrate.mts`가 파일당 `sql.query()`를 한 번 호출하는데, neon HTTP 드라이버는 다중 statement를 지원하지 않는다. `CREATE TABLE`과 `CREATE INDEX`는 반드시 별도 파일로 나눈다 (`migrations/0003_*.sql` 상단 주석 참조).
- **accent 색은 기존 토큰 사용.** `bg-accent`, `text-accent`, `bg-accent-soft`, `border-accent`. `src/app/globals.css`의 `--color-accent`는 `#2563eb`다. 디자인 파일의 인디고 `#4F46E5`를 하드코딩하지 않는다.
- **주입형 `SqlClient` 패턴.** 새 DB 함수는 `src/lib/auth/users.ts`처럼 마지막 인자로 `client: SqlClient = sql`을 받는다. 테스트는 가짜 클라이언트를 주입하고, 실제 DB에 붙지 않는다.
- **user_id 바인딩은 `${userId}::bigint`.** 세션의 `userId`는 문자열이고 DB 컬럼은 `bigint`다.
- **주석은 한국어.** 기존 코드와 같이 "왜"를 적는다 — "무엇"은 코드가 이미 말한다.
- **테스트 실행:** `npx vitest run <경로>`. 전체는 `npm test`. 타입 검사는 `npm run typecheck`.

## File Structure

| 파일 | 책임 |
| --- | --- |
| `migrations/0005_profiles.sql` ~ `0009_purchases_user_idx.sql` | 스키마. statement 하나당 파일 하나. |
| `src/lib/profiles/products.ts` | `purchases.product` 상수. |
| `src/lib/profiles/store.ts` | `profiles` 조회/생성 + `purchases` 조인으로 `isPaid` 파생. 화면을 모른다. |
| `src/lib/auth/users.ts` | (수정) 헤더에 쓸 `getUser(id)` 추가. |
| `src/app/home/_lib/to-profile-card.ts` | DB 행 → 카드 뷰모델. 순수 함수. DB도 React도 모른다. |
| `src/app/home/_components/*` | 표현만. 계산은 뷰모델이 끝낸 상태로 받는다. |
| `src/app/home/page.tsx` | 조립: 세션 가드 → 조회 → 변환 → 렌더. |
| `src/app/api/profiles/_lib/input.ts` | 요청 본문 zod 스키마. |
| `src/app/api/profiles/_lib/handler.ts` | 순수 핸들러. 세션·DB를 주입받는다. |
| `src/app/api/profiles/route.ts` | 얇은 어댑터. |
| `src/app/funnel/_lib/toProfileBody.ts` | `FunnelData` → API 본문. 순수 함수. |

---

### Task 1: 마이그레이션 — `profiles` / `purchases`

**Files:**
- Create: `migrations/0005_profiles.sql`
- Create: `migrations/0006_profiles_user_idx.sql`
- Create: `migrations/0007_purchases.sql`
- Create: `migrations/0008_purchases_paid_unique.sql`
- Create: `migrations/0009_purchases_user_idx.sql`

**Interfaces:**
- Produces: 테이블 `profiles`(컬럼: `id, user_id, name, gender, calendar, is_leap_month, birth_year, birth_month, birth_day, time_known, birth_hour, birth_minute, birth_country, birth_region_id, true_solar, created_at`), 테이블 `purchases`(컬럼: `id, user_id, profile_id, product, amount, currency, status, provider, provider_txn_id, created_at, paid_at`). Task 2가 이 컬럼 이름에 의존한다.

- [ ] **Step 1: `migrations/0005_profiles.sql` 작성**

```sql
-- 퍼널이 수집한 원본 입력을 그대로 보관한다.
-- 계산된 원국(4기둥)을 저장하지 않는 이유: saju-core 가 바뀌면 원국은 다시 계산하면
-- 되지만, 사용자가 입력한 생년월일시는 복구할 수 없다. 원국은 파생값이다.
-- 컬럼은 src/app/funnel/_context/FunnelContext.tsx 의 FunnelData 와 1:1 로 대응한다
-- (birthPlace 만 country/region_id 두 컬럼으로 펴진다).
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
  birth_hour      int,
  birth_minute    int,
  birth_country   text,
  birth_region_id text,
  true_solar      boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: `migrations/0006_profiles_user_idx.sql` 작성**

```sql
-- /home 의 유일한 조회 패턴: 내 프로필을 최신순으로.
CREATE INDEX IF NOT EXISTS profiles_user_created_idx ON profiles (user_id, created_at DESC);
```

- [ ] **Step 3: `migrations/0007_purchases.sql` 작성**

```sql
-- 결제 내역. 지금 상품은 리포트 하나지만 product 문자열로 일반화해 두었다.
-- profile_id 가 NULL 허용인 이유: 프로필 단위가 아닌 상품(구독 등)을 같은 테이블에 담기 위해서.
-- provider/provider_txn_id 는 PG사 연동이 붙는 자리다 (지금은 비어 있다).
CREATE TABLE IF NOT EXISTS purchases (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id       bigint REFERENCES profiles(id) ON DELETE CASCADE,
  product          text NOT NULL,
  amount           int NOT NULL,
  currency         text NOT NULL DEFAULT 'KRW',
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'paid', 'refunded', 'failed')),
  provider         text,
  provider_txn_id  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  paid_at          timestamptz
);
```

- [ ] **Step 4: `migrations/0008_purchases_paid_unique.sql` 작성**

```sql
-- 같은 프로필의 같은 상품을 두 번 결제 완료로 만들 수 없다.
-- 부분 인덱스라 pending/failed 행은 여러 개 남을 수 있다 (결제 재시도).
CREATE UNIQUE INDEX IF NOT EXISTS purchases_paid_unique
  ON purchases (profile_id, product) WHERE status = 'paid';
```

- [ ] **Step 5: `migrations/0009_purchases_user_idx.sql` 작성**

```sql
CREATE INDEX IF NOT EXISTS purchases_user_idx ON purchases (user_id, created_at DESC);
```

- [ ] **Step 6: 마이그레이션 적용**

Run: `npm run db:migrate`
Expected: `applying 0005_profiles.sql` … `applying 0009_purchases_user_idx.sql`, 마지막 줄 `done (5 applied, 4 skipped)`

`DATABASE_URL`이 없어 실패하면 멈추고 사용자에게 알린다 — SQL을 우회하지 말 것.

- [ ] **Step 7: 커밋**

```bash
git add migrations/
git commit -m "feat(db): 프로필·결제 테이블 추가"
```

---

### Task 2: 프로필 저장소 — `src/lib/profiles/`

**Files:**
- Create: `src/lib/profiles/products.ts`
- Create: `src/lib/profiles/store.ts`
- Create: `src/lib/profiles/store.test.ts`
- Modify: `src/lib/auth/users.ts` (파일 끝에 `getUser` 추가)
- Modify: `src/lib/auth/users.test.ts` (파일 끝에 `getUser` 테스트 추가)

**Interfaces:**
- Consumes: Task 1의 `profiles`·`purchases` 컬럼 이름.
- Produces:
  - `PRODUCT_FULL_REPORT: string`
  - `MAX_PROFILES: number` (= 5)
  - `class ProfileLimitError extends Error`
  - `interface ProfileRow { id, name, gender, calendar, isLeapMonth, birth: {year,month,day}, timeKnown, time: {hour,minute}|null, birthPlace: {country,regionId}|null, trueSolar, createdAt, isPaid }`
  - `type CreateProfileInput = Omit<ProfileRow, "id" | "createdAt" | "isPaid">`
  - `toProfileRow(r: Record<string, unknown>): ProfileRow`
  - `listProfiles(userId: string, client?: SqlClient): Promise<ProfileRow[]>`
  - `countProfiles(userId: string, client?: SqlClient): Promise<number>`
  - `createProfile(userId: string, input: CreateProfileInput, client?: SqlClient): Promise<{ id: string }>`
  - `getUser(id: string, client?: SqlClient): Promise<{ id: string; displayName: string | null } | null>` (from `@/lib/auth/users`)

- [ ] **Step 1: `src/lib/profiles/products.ts` 작성**

```ts
/**
 * purchases.product 값. 상품이 늘면 여기에 추가한다.
 * 문자열을 여기저기 흩뿌리지 않으려고 상수로 둔다 — 오타가 조용한 미결제로 나타난다.
 */
export const PRODUCT_FULL_REPORT = "full_report";
```

- [ ] **Step 2: 실패하는 테스트 작성 — `src/lib/profiles/store.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import {
  MAX_PROFILES,
  ProfileLimitError,
  countProfiles,
  createProfile,
  listProfiles,
  toProfileRow,
  type CreateProfileInput,
  type SqlClient,
} from "./store";

/** 호출된 SQL과 바인딩 값을 기록하는 가짜 클라이언트. 응답은 순서대로 꺼내 쓴다. */
function fakeClient(...responses: Record<string, unknown>[][]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(responses[i++] ?? []);
  };
  return { client, calls };
}

const dbRow = {
  id: 3,
  name: "김동진",
  gender: "male",
  calendar: "solar",
  is_leap_month: false,
  birth_year: 1990,
  birth_month: 10,
  birth_day: 25,
  time_known: true,
  birth_hour: 15,
  birth_minute: 20,
  birth_country: "KR",
  birth_region_id: "seoul",
  true_solar: true,
  created_at: "2026-07-31T00:00:00.000Z",
  is_paid: false,
};

const newProfile: CreateProfileInput = {
  name: "이정숙",
  gender: "female",
  calendar: "lunar",
  isLeapMonth: true,
  birth: { year: 1963, month: 4, day: 12 },
  timeKnown: false,
  time: null,
  birthPlace: null,
  trueSolar: true,
};

describe("toProfileRow", () => {
  it("스네이크 케이스 컬럼을 뷰가 쓰는 모양으로 접는다", () => {
    expect(toProfileRow(dbRow)).toEqual({
      id: "3",
      name: "김동진",
      gender: "male",
      calendar: "solar",
      isLeapMonth: false,
      birth: { year: 1990, month: 10, day: 25 },
      timeKnown: true,
      time: { hour: 15, minute: 20 },
      birthPlace: { country: "KR", regionId: "seoul" },
      trueSolar: true,
      createdAt: "2026-07-31T00:00:00.000Z",
      isPaid: false,
    });
  });

  it("time_known 이 false 면 시각 컬럼이 남아 있어도 time 은 null", () => {
    const row = toProfileRow({ ...dbRow, time_known: false });
    expect(row.timeKnown).toBe(false);
    expect(row.time).toBeNull();
  });

  it("출생지를 건너뛴 행은 birthPlace 가 null", () => {
    const row = toProfileRow({ ...dbRow, birth_country: null, birth_region_id: null });
    expect(row.birthPlace).toBeNull();
  });
});

describe("listProfiles", () => {
  it("결제된 상품이 조인되면 isPaid 가 true", async () => {
    const { client, calls } = fakeClient([{ ...dbRow, is_paid: true }]);
    const rows = await listProfiles("7", client);

    expect(rows).toHaveLength(1);
    expect(rows[0].isPaid).toBe(true);
    expect(calls[0].sql).toContain("LEFT JOIN purchases");
    expect(calls[0].sql).toContain("ORDER BY p.created_at DESC");
    // 바인딩 순서는 템플릿에 나타난 순서다 — product 가 JOIN 조건이라 user_id 보다 앞선다.
    expect(calls[0].values).toEqual(["full_report", "7"]);
  });

  it("프로필이 없으면 빈 배열", async () => {
    const { client } = fakeClient([]);
    expect(await listProfiles("7", client)).toEqual([]);
  });
});

describe("countProfiles", () => {
  it("count 결과를 숫자로 반환", async () => {
    const { client, calls } = fakeClient([{ n: 2 }]);
    expect(await countProfiles("7", client)).toBe(2);
    expect(calls[0].sql).toContain("FROM profiles");
  });
});

describe("createProfile", () => {
  it("한도 미만이면 INSERT 하고 id 를 문자열로 반환", async () => {
    const { client, calls } = fakeClient([{ n: 1 }], [{ id: 42 }]);
    expect(await createProfile("7", newProfile, client)).toEqual({ id: "42" });

    expect(calls[1].sql).toContain("INSERT INTO profiles");
    // 시간을 모르는 프로필은 시각 컬럼이 null 로 들어간다
    expect(calls[1].values).toContain(null);
    expect(calls[1].values[1]).toBe("이정숙");
  });

  it("한도에 도달하면 ProfileLimitError 를 던지고 INSERT 하지 않는다", async () => {
    const { client, calls } = fakeClient([{ n: MAX_PROFILES }]);
    await expect(createProfile("7", newProfile, client)).rejects.toBeInstanceOf(ProfileLimitError);
    expect(calls).toHaveLength(1);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/profiles/store.test.ts`
Expected: FAIL — `Failed to resolve import "./store"`

- [ ] **Step 4: `src/lib/profiles/store.ts` 구현**

```ts
import { sql as neonSql } from "@/lib/db";
import { PRODUCT_FULL_REPORT } from "./products";

/** 태그드 템플릿 SQL 클라이언트(주입 가능). 기본은 공유 neon 클라이언트. */
export type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

const sql = neonSql as unknown as SqlClient;

/** 한 계정이 저장할 수 있는 프로필 수. 화면 문구와 같이 움직인다. */
export const MAX_PROFILES = 5;

export class ProfileLimitError extends Error {
  constructor() {
    super(`프로필은 최대 ${MAX_PROFILES}개까지 저장할 수 있습니다`);
    this.name = "ProfileLimitError";
  }
}

export interface ProfileRow {
  id: string;
  name: string;
  gender: "male" | "female";
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
  birth: { year: number; month: number; day: number };
  timeKnown: boolean;
  /** timeKnown 이 false 면 항상 null */
  time: { hour: number; minute: number } | null;
  /** 출생지를 건너뛰면 null (국가 기본 경도를 쓴다) */
  birthPlace: { country: string; regionId: string } | null;
  trueSolar: boolean;
  createdAt: string;
  /** purchases 조인에서 파생. 결제 미구현이라 현재는 항상 false. */
  isPaid: boolean;
}

export type CreateProfileInput = Omit<ProfileRow, "id" | "createdAt" | "isPaid">;

/**
 * DB 행 → ProfileRow. 컬럼 이름을 아는 유일한 곳이다.
 * time_known 이 false 면 시각 컬럼이 남아 있어도 버린다 — 두 필드가 어긋난 값을
 * 화면까지 흘려보내지 않는다.
 */
export function toProfileRow(r: Record<string, unknown>): ProfileRow {
  const timeKnown = r.time_known === true;
  const hour = r.birth_hour;
  const minute = r.birth_minute;
  const country = r.birth_country;
  const regionId = r.birth_region_id;

  return {
    id: String(r.id),
    name: String(r.name),
    gender: r.gender === "female" ? "female" : "male",
    calendar: r.calendar === "lunar" ? "lunar" : "solar",
    isLeapMonth: r.is_leap_month === true,
    birth: {
      year: Number(r.birth_year),
      month: Number(r.birth_month),
      day: Number(r.birth_day),
    },
    timeKnown,
    time:
      timeKnown && typeof hour === "number" && typeof minute === "number"
        ? { hour, minute }
        : null,
    birthPlace:
      typeof country === "string" && typeof regionId === "string"
        ? { country, regionId }
        : null,
    trueSolar: r.true_solar === true,
    createdAt: String(r.created_at),
    isPaid: r.is_paid === true,
  };
}

/**
 * 내 프로필을 최신순으로. 결제 여부는 purchases 를 LEFT JOIN 해 파생한다 —
 * profiles 에 is_paid 를 두면 결제 테이블과 두 벌이 되어 어긋난다.
 */
export async function listProfiles(
  userId: string,
  client: SqlClient = sql,
): Promise<ProfileRow[]> {
  const rows = await client`
    SELECT p.*, (pu.id IS NOT NULL) AS is_paid
    FROM profiles p
    LEFT JOIN purchases pu
      ON pu.profile_id = p.id
     AND pu.product = ${PRODUCT_FULL_REPORT}
     AND pu.status = 'paid'
    WHERE p.user_id = ${userId}::bigint
    ORDER BY p.created_at DESC
  `;
  return rows.map(toProfileRow);
}

export async function countProfiles(
  userId: string,
  client: SqlClient = sql,
): Promise<number> {
  const rows = await client`
    SELECT count(*)::int AS n FROM profiles WHERE user_id = ${userId}::bigint
  `;
  return Number(rows[0]?.n ?? 0);
}

/**
 * 프로필 생성. 한도 검사는 앱 레벨이라 동시 요청에서는 한 개쯤 더 들어갈 수 있다.
 * 트랜잭션을 걸지 않는 이유: 5개 제한은 UX 가드일 뿐 정합성 요건이 아니다.
 */
export async function createProfile(
  userId: string,
  input: CreateProfileInput,
  client: SqlClient = sql,
): Promise<{ id: string }> {
  const count = await countProfiles(userId, client);
  if (count >= MAX_PROFILES) throw new ProfileLimitError();

  const rows = await client`
    INSERT INTO profiles (
      user_id, name, gender, calendar, is_leap_month,
      birth_year, birth_month, birth_day,
      time_known, birth_hour, birth_minute,
      birth_country, birth_region_id, true_solar
    ) VALUES (
      ${userId}::bigint, ${input.name}, ${input.gender}, ${input.calendar}, ${input.isLeapMonth},
      ${input.birth.year}, ${input.birth.month}, ${input.birth.day},
      ${input.timeKnown}, ${input.time?.hour ?? null}, ${input.time?.minute ?? null},
      ${input.birthPlace?.country ?? null}, ${input.birthPlace?.regionId ?? null}, ${input.trueSolar}
    )
    RETURNING id
  `;
  const row = rows[0] as { id: string | number } | undefined;
  if (!row) throw new Error("createProfile: no row returned");
  return { id: String(row.id) };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/lib/profiles/store.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 6: `getUser` 실패 테스트 추가 — `src/lib/auth/users.test.ts` 끝에 추가**

파일 맨 위 import 를 `import { upsertUser, getUser, type SqlClient } from "./users";` 로 바꾸고, 파일 끝에 추가:

```ts
describe("getUser", () => {
  it("id로 조회해 표시 이름을 반환", async () => {
    const { client, calls } = fakeClient([{ id: 7, display_name: "김동진" }]);
    expect(await getUser("7", client)).toEqual({ id: "7", displayName: "김동진" });
    expect(calls[0].sql).toContain("FROM users");
    expect(calls[0].values).toEqual(["7"]);
  });

  it("행이 없으면 null", async () => {
    const { client } = fakeClient([]);
    expect(await getUser("99", client)).toBeNull();
  });

  it("표시 이름이 비어 있으면 displayName은 null", async () => {
    const { client } = fakeClient([{ id: 7, display_name: null }]);
    expect(await getUser("7", client)).toEqual({ id: "7", displayName: null });
  });
});
```

- [ ] **Step 7: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/auth/users.test.ts`
Expected: FAIL — `getUser is not a function` 또는 import 오류

- [ ] **Step 8: `src/lib/auth/users.ts` 끝에 `getUser` 추가**

```ts
export interface UserProfile {
  id: string;
  /** 소셜 제공자가 이름을 안 줄 수 있어 null 을 허용한다. */
  displayName: string | null;
}

/** 헤더에 표시할 최소 정보만 읽는다. 세션에는 userId 밖에 없다. */
export async function getUser(
  id: string,
  client: SqlClient = sql,
): Promise<UserProfile | null> {
  const rows = await client`
    SELECT id, display_name FROM users WHERE id = ${id}::bigint
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    displayName: typeof row.display_name === "string" ? row.display_name : null,
  };
}
```

- [ ] **Step 9: 테스트 통과 확인**

Run: `npx vitest run src/lib/auth/users.test.ts src/lib/profiles/store.test.ts`
Expected: PASS

- [ ] **Step 10: 커밋**

```bash
git add src/lib/profiles src/lib/auth/users.ts src/lib/auth/users.test.ts
git commit -m "feat(profiles): 프로필 조회·생성 저장소와 사용자 조회 추가"
```

---

### Task 3: 카드 뷰모델 — `src/app/home/_lib/to-profile-card.ts`

**Files:**
- Create: `src/app/home/_lib/to-profile-card.ts`
- Create: `src/app/home/_lib/to-profile-card.test.ts`

**Interfaces:**
- Consumes: `ProfileRow` (Task 2), `SECTION_KEYS`·`FREE_SECTION_KEYS` (`@/app/api/saju/_lib/sections`).
- Produces:
  - `TOTAL_SECTIONS: number`, `FREE_SECTIONS: number`
  - `interface ProfileCard { id, name, initial, birthLabel, isPaid, openedSections, totalSections, reportHref }`
  - `toProfileCard(row: ProfileRow): ProfileCard`
  - `countCaption(cards: ProfileCard[]): string`

- [ ] **Step 1: 실패하는 테스트 작성 — `src/app/home/_lib/to-profile-card.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import type { ProfileRow } from "@/lib/profiles/store";
import {
  FREE_SECTIONS,
  TOTAL_SECTIONS,
  countCaption,
  toProfileCard,
} from "./to-profile-card";

const base: ProfileRow = {
  id: "3",
  name: "김동진",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1990, month: 10, day: 25 },
  timeKnown: true,
  time: { hour: 15, minute: 20 },
  birthPlace: { country: "KR", regionId: "seoul" },
  trueSolar: true,
  createdAt: "2026-07-31T00:00:00.000Z",
  isPaid: false,
};

describe("섹션 개수", () => {
  // 레지스트리에서 파생되므로 하드코딩이 아니다. 이 테스트는 티어가 실수로
  // 바뀌었을 때(무료 섹션을 유료로 돌리는 등) 알아채기 위한 핀이다.
  it("현재 레지스트리는 총 12개 / 무료 5개", () => {
    expect(TOTAL_SECTIONS).toBe(12);
    expect(FREE_SECTIONS).toBe(5);
  });
});

describe("toProfileCard", () => {
  it("이니셜은 이름 첫 글자", () => {
    expect(toProfileCard(base).initial).toBe("김");
  });

  it("오후 시각을 12시간제로 표기", () => {
    expect(toProfileCard(base).birthLabel).toBe("1990.10.25 · 오후 3시 20분");
  });

  it("자정은 오전 12시", () => {
    const card = toProfileCard({ ...base, time: { hour: 0, minute: 5 } });
    expect(card.birthLabel).toBe("1990.10.25 · 오전 12시 5분");
  });

  it("정오는 오후 12시", () => {
    const card = toProfileCard({ ...base, time: { hour: 12, minute: 0 } });
    expect(card.birthLabel).toBe("1990.10.25 · 오후 12시 0분");
  });

  it("시간을 모르면 시각 자리에 안내를 넣는다", () => {
    const card = toProfileCard({ ...base, timeKnown: false, time: null });
    expect(card.birthLabel).toBe("1990.10.25 · 시간 모름");
  });

  it("음력 프로필은 입력한 날짜에 (음력)을 붙인다", () => {
    const card = toProfileCard({ ...base, calendar: "lunar" });
    expect(card.birthLabel).toBe("1990.10.25 (음력) · 오후 3시 20분");
  });

  it("월/일을 두 자리로 채운다", () => {
    const card = toProfileCard({ ...base, birth: { year: 1963, month: 4, day: 2 } });
    expect(card.birthLabel).toContain("1963.04.02");
  });

  it("미결제는 무료 섹션만 열린다", () => {
    const card = toProfileCard(base);
    expect(card.isPaid).toBe(false);
    expect(card.openedSections).toBe(FREE_SECTIONS);
    expect(card.totalSections).toBe(TOTAL_SECTIONS);
  });

  it("결제 완료는 전체 섹션이 열린다", () => {
    const card = toProfileCard({ ...base, isPaid: true });
    expect(card.openedSections).toBe(TOTAL_SECTIONS);
  });

  it("리포트 링크에 프로필 id를 붙인다", () => {
    expect(toProfileCard(base).reportHref).toBe("/report?profile=3");
  });
});

describe("countCaption", () => {
  it("전체 개수와 결제된 개수를 함께 센다", () => {
    const cards = [
      toProfileCard(base),
      toProfileCard({ ...base, id: "4", isPaid: true }),
      toProfileCard({ ...base, id: "5", isPaid: true }),
    ];
    expect(countCaption(cards)).toBe("3개 · 전체 리포트 2개");
  });

  it("비어 있으면 0개", () => {
    expect(countCaption([])).toBe("0개 · 전체 리포트 0개");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/home/_lib/to-profile-card.test.ts`
Expected: FAIL — `Failed to resolve import "./to-profile-card"`

- [ ] **Step 3: `src/app/home/_lib/to-profile-card.ts` 구현**

```ts
import { FREE_SECTION_KEYS, SECTION_KEYS } from "@/app/api/saju/_lib/sections";
import type { ProfileRow } from "@/lib/profiles/store";

/**
 * 화면 문구의 숫자는 섹션 레지스트리에서 파생한다 — 섹션을 추가하거나 티어를
 * 바꿔도 "12개 중 5개 열림"이 저절로 따라간다.
 */
export const TOTAL_SECTIONS = SECTION_KEYS.length;
export const FREE_SECTIONS = FREE_SECTION_KEYS.length;

export interface ProfileCard {
  id: string;
  name: string;
  /** 아바타에 넣을 이름 첫 글자 */
  initial: string;
  /** "1990.10.25 · 오후 3시 20분" */
  birthLabel: string;
  isPaid: boolean;
  openedSections: number;
  totalSections: number;
  reportHref: string;
}

/** 0시 → "오전 12시", 12시 → "오후 12시". */
function timeLabel(hour: number, minute: number): string {
  const meridiem = hour < 12 ? "오전" : "오후";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${meridiem} ${h12}시 ${minute}분`;
}

export function toProfileCard(row: ProfileRow): ProfileCard {
  const { year, month, day } = row.birth;
  const date = `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
  // 음력을 표시하지 않으면 사용자가 자기가 입력한 날짜를 알아보지 못한다.
  const calendar = row.calendar === "lunar" ? " (음력)" : "";
  const time = row.time ? timeLabel(row.time.hour, row.time.minute) : "시간 모름";

  return {
    id: row.id,
    name: row.name,
    // 스프레드로 자르는 이유: 이모지·한자 확장 같은 서로게이트 쌍이 반으로 잘리지 않게.
    initial: [...row.name][0] ?? "?",
    birthLabel: `${date}${calendar} · ${time}`,
    isPaid: row.isPaid,
    openedSections: row.isPaid ? TOTAL_SECTIONS : FREE_SECTIONS,
    totalSections: TOTAL_SECTIONS,
    reportHref: `/report?profile=${row.id}`,
  };
}

export function countCaption(cards: ProfileCard[]): string {
  const paid = cards.filter((c) => c.isPaid).length;
  return `${cards.length}개 · 전체 리포트 ${paid}개`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/app/home/_lib/to-profile-card.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/app/home/_lib
git commit -m "feat(home): 프로필 카드 뷰모델 추가"
```

---

### Task 4: 프로필 생성 API — `POST /api/profiles`

**Files:**
- Create: `src/app/api/profiles/_lib/input.ts`
- Create: `src/app/api/profiles/_lib/handler.ts`
- Create: `src/app/api/profiles/_lib/handler.test.ts`
- Create: `src/app/api/profiles/route.ts`

**Interfaces:**
- Consumes: `CreateProfileInput`, `ProfileLimitError`, `createProfile` (Task 2), `getSession` (`@/lib/auth/session`).
- Produces:
  - `createProfileSchema` (zod), `type CreateProfileBody = z.infer<typeof createProfileSchema>` — Task 6이 이 타입을 쓴다.
  - `handleCreateProfile(raw: unknown, deps: { userId: string | null; create: (userId: string, input: CreateProfileInput) => Promise<{ id: string }> }): Promise<{ status: number; body: { id: string } | { error: string } }>`
  - 라우트 계약: `201 {id}` / `400 {error}` / `401 {error}` / `409 {error:"limit"}`

- [ ] **Step 1: `src/app/api/profiles/_lib/input.ts` 작성**

```ts
import { z } from "zod";

/**
 * POST /api/profiles 본문. 퍼널의 FunnelData 를 그대로 옮긴 모양이다.
 * saju API 의 parseRequest(수동 검증)와 달리 zod 를 쓰는 이유: 중첩 객체가 많고
 * 기본값이 필요해서, 손으로 쓰면 길이만 늘어난다.
 */
export const createProfileSchema = z.object({
  name: z.string().trim().min(1).max(20),
  gender: z.enum(["male", "female"]),
  calendar: z.enum(["solar", "lunar"]).default("solar"),
  isLeapMonth: z.boolean().default(false),
  birth: z.object({
    year: z.number().int().min(1900).max(2200),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }),
  timeKnown: z.boolean().default(true),
  time: z
    .object({
      hour: z.number().int().min(0).max(23),
      minute: z.number().int().min(0).max(59),
    })
    .nullable()
    .default(null),
  birthPlace: z
    .object({
      country: z.enum(["KR", "JP"]),
      regionId: z.string().min(1),
    })
    .nullable()
    .default(null),
  trueSolar: z.boolean().default(true),
});

export type CreateProfileBody = z.infer<typeof createProfileSchema>;
```

- [ ] **Step 2: 실패하는 테스트 작성 — `src/app/api/profiles/_lib/handler.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { ProfileLimitError, type CreateProfileInput } from "@/lib/profiles/store";
import { handleCreateProfile } from "./handler";

const validBody = {
  name: "김동진",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1990, month: 10, day: 25 },
  timeKnown: true,
  time: { hour: 15, minute: 20 },
  birthPlace: { country: "KR", regionId: "seoul" },
  trueSolar: true,
};

type Create = (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;

/**
 * 제네릭으로 타입을 박아야 mock.calls[0][1] 이 CreateProfileInput 으로 좁혀진다 —
 * vi.fn(async () => ...) 로 두면 인자가 0개인 목이라 [1] 인덱싱이 타입 오류가 난다.
 */
const okCreate = () => vi.fn<Create>(async () => ({ id: "42" }));

describe("handleCreateProfile", () => {
  it("세션이 없으면 401 이고 저장을 시도하지 않는다", async () => {
    const create = okCreate();
    const res = await handleCreateProfile(validBody, { userId: null, create });
    expect(res.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("정상 입력이면 201 과 id", async () => {
    const create = okCreate();
    const res = await handleCreateProfile(validBody, { userId: "7", create });
    expect(res).toEqual({ status: 201, body: { id: "42" } });
    expect(create).toHaveBeenCalledWith("7", expect.objectContaining({ name: "김동진" }));
  });

  it("본문이 객체가 아니면 400", async () => {
    const res = await handleCreateProfile(null, { userId: "7", create: okCreate() });
    expect(res.status).toBe(400);
  });

  it("이름이 비면 400", async () => {
    const res = await handleCreateProfile(
      { ...validBody, name: "   " },
      { userId: "7", create: okCreate() },
    );
    expect(res.status).toBe(400);
  });

  it("범위를 벗어난 생년은 400", async () => {
    const res = await handleCreateProfile(
      { ...validBody, birth: { year: 1800, month: 1, day: 1 } },
      { userId: "7", create: okCreate() },
    );
    expect(res.status).toBe(400);
  });

  it("시간을 모른다고 하면 time 을 버리고 저장한다", async () => {
    const create = okCreate();
    await handleCreateProfile(
      { ...validBody, timeKnown: false },
      { userId: "7", create },
    );
    expect(create.mock.calls[0][1].time).toBeNull();
  });

  it("양력이면 윤달 표시를 버린다", async () => {
    const create = okCreate();
    await handleCreateProfile(
      { ...validBody, calendar: "solar", isLeapMonth: true },
      { userId: "7", create },
    );
    expect(create.mock.calls[0][1].isLeapMonth).toBe(false);
  });

  it("한도를 넘으면 409", async () => {
    const create = vi.fn<Create>(async () => {
      throw new ProfileLimitError();
    });
    const res = await handleCreateProfile(validBody, { userId: "7", create });
    expect(res).toEqual({ status: 409, body: { error: "limit" } });
  });

  it("그 밖의 저장 오류는 상위로 던진다", async () => {
    const create = vi.fn<Create>(async () => {
      throw new Error("db down");
    });
    await expect(
      handleCreateProfile(validBody, { userId: "7", create }),
    ).rejects.toThrow("db down");
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/api/profiles/_lib/handler.test.ts`
Expected: FAIL — `Failed to resolve import "./handler"`

- [ ] **Step 4: `src/app/api/profiles/_lib/handler.ts` 구현**

```ts
import { ProfileLimitError, type CreateProfileInput } from "@/lib/profiles/store";
import { createProfileSchema } from "./input";

export interface HandlerDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  create: (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;
}

export interface HandlerResult {
  status: number;
  body: { id: string } | { error: string };
}

export async function handleCreateProfile(
  raw: unknown,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  if (!deps.userId) return { status: 401, body: { error: "로그인이 필요합니다" } };

  const parsed = createProfileSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "입력을 확인해 주세요" } };

  const d = parsed.data;
  const input: CreateProfileInput = {
    ...d,
    // 서로 어긋난 조합은 여기서 정리한다 — 어긋난 행이 DB 에 남으면
    // 나중에 어느 쪽이 진실인지 알 수 없다.
    time: d.timeKnown ? d.time : null,
    isLeapMonth: d.calendar === "lunar" ? d.isLeapMonth : false,
  };

  try {
    const { id } = await deps.create(deps.userId, input);
    return { status: 201, body: { id } };
  } catch (e) {
    // 한도 초과는 클라이언트가 분기해야 하는 정상 응답이다. 나머지는 500 으로 흘린다.
    if (e instanceof ProfileLimitError) return { status: 409, body: { error: "limit" } };
    throw e;
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/app/api/profiles/_lib/handler.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 6: `src/app/api/profiles/route.ts` 작성**

`src/app/api/saju/route.ts`와 같은 구조 — 라우트는 세션·DB를 주입하고 상태 코드만 옮긴다.

```ts
import { getSession } from "@/lib/auth/session";
import { createProfile } from "@/lib/profiles/store";
import { handleCreateProfile } from "./_lib/handler";

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleCreateProfile(raw, {
      userId: session?.userId ?? null,
      create: createProfile,
    });
    return Response.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/profiles]", e);
    return Response.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
```

- [ ] **Step 7: 타입 검사**

Run: `npm run typecheck`
Expected: 오류 없음

- [ ] **Step 8: 커밋**

```bash
git add src/app/api/profiles
git commit -m "feat(api): 프로필 생성 엔드포인트 추가"
```

---

### Task 5: 로그인 후 기본 행선을 `/home`으로

**Files:**
- Modify: `src/lib/auth/oauth.ts:66-76`
- Modify: `src/lib/auth/oauth.test.ts:89-108`

**Interfaces:**
- Produces: `safeNext(next, origin)`의 fallback 이 `"/home"`. 시그니처 변화 없음.

- [ ] **Step 1: 테스트를 먼저 고친다 — `src/lib/auth/oauth.test.ts`의 `describe("safeNext ...")` 블록**

`"/"`를 기대하던 케이스를 `"/home"`으로 바꾸고, 기본값 케이스에 의도를 적는다:

```ts
describe("safeNext (오픈 리다이렉트 방어)", () => {
  const origin = "https://app.example.com";

  it("내부 경로는 그대로 통과", () => {
    expect(safeNext("/report", origin)).toBe("/report");
    expect(safeNext("/report?paid=true", origin)).toBe("/report?paid=true");
  });

  it("외부 origin 은 기본 행선으로 떨군다", () => {
    expect(safeNext("https://evil.com", origin)).toBe("/home");
    expect(safeNext("//evil.com", origin)).toBe("/home");
    expect(safeNext("/\\evil.com", origin)).toBe("/home");
  });

  it("next 가 없으면 로그인 홈으로 보낸다", () => {
    expect(safeNext(null, origin)).toBe("/home");
    expect(safeNext(undefined, origin)).toBe("/home");
  });

  it("상대 경로는 앞에 슬래시를 붙여 통과", () => {
    expect(safeNext("report", origin)).toBe("/report");
  });

  it("개행이 섞여도 origin 을 벗어나지 않는다", () => {
    expect(new URL(safeNext("/\n/evil.com", origin), origin).origin).toBe(origin);
  });
});
```

기존 블록에 `origin` 상수가 이미 선언돼 있다면 중복 선언하지 말고 재사용한다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/lib/auth/oauth.test.ts`
Expected: FAIL — `expected '/' to be '/home'`

- [ ] **Step 3: `src/lib/auth/oauth.ts`의 `safeNext` 수정**

```ts
/** 로그인 후 기본 행선. 로그인한 사용자에게는 랜딩이 아니라 프로필 목록이 맞다. */
const DEFAULT_NEXT = "/home";

/** next는 앱 origin 내부 경로만 허용(오픈 리다이렉트 방어). 그 외엔 DEFAULT_NEXT. */
export function safeNext(next: string | null | undefined, origin: string): string {
  if (!next) return DEFAULT_NEXT;
  try {
    const u = new URL(next, origin);
    if (u.origin !== origin) return DEFAULT_NEXT;
    return u.pathname + u.search + u.hash;
  } catch {
    return DEFAULT_NEXT;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/auth/oauth.test.ts src/lib/auth/callback.test.ts`
Expected: PASS. `callback.test.ts`가 `redirectTo`로 `"/"`를 기대하고 있으면 그것도 `"/home"`으로 고친다.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/auth/oauth.ts src/lib/auth/oauth.test.ts src/lib/auth/callback.test.ts
git commit -m "feat(auth): 로그인 후 기본 행선을 /home 으로 변경"
```

---

### Task 6: `/home` 화면

**Files:**
- Create: `src/app/home/_components/HomeHeader.tsx`
- Create: `src/app/home/_components/ProfileCard.tsx`
- Create: `src/app/home/_components/AddProfileButton.tsx`
- Create: `src/app/home/_components/EmptyState.tsx`
- Create: `src/app/home/page.tsx`
- Modify: `src/app/api/auth/logout/route.ts:5`

**Interfaces:**
- Consumes: `listProfiles`·`MAX_PROFILES` (Task 2), `getUser` (Task 2), `toProfileCard`·`countCaption`·`ProfileCard` 타입 (Task 3), `getSession` (`@/lib/auth/session`).
- Produces: 라우트 `/home`.

**참고:** 디자인 원본은 `design/project/Saju My Profiles.dc.html`. 인라인 style을 Tailwind 유틸리티로 옮긴 것이고, 설계 문서 §7에 적은 네 가지(관계 칩 제거 / 빈 상태 추가 / 사용자 칩 옆 로그아웃 / 5개 도달 처리)만 다르다.

- [ ] **Step 1: 로그아웃 리다이렉트를 303으로 고친다**

`NextResponse.redirect`의 기본 상태는 307이라 브라우저가 `/`로 POST를 다시 보낸다 — 페이지 라우트는 POST를 받지 않아 405가 난다. 303(See Other)은 재요청을 GET으로 바꾼다. `src/app/api/auth/logout/route.ts` 5번째 줄:

```ts
  // 303: 폼 POST 를 GET 으로 바꿔 랜딩을 열게 한다 (기본값 307 은 POST 를 다시 보낸다).
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin), 303);
```

- [ ] **Step 2: `src/app/home/_components/HomeHeader.tsx` 작성**

```tsx
export function HomeHeader({ displayName }: { displayName: string }) {
  const initial = [...displayName][0] ?? "?";

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/[0.82] backdrop-blur-[14px]">
      <div className="mx-auto flex h-16 max-w-[880px] items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-slate-900 text-sm font-semibold text-white">
            사
          </div>
          <span className="text-[15.5px] font-semibold tracking-[-0.02em]">사주</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white py-[5px] pl-[5px] pr-[13px] text-sm font-semibold text-slate-900">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-accent-soft text-[12.5px] font-bold text-accent">
              {initial}
            </span>
            {displayName}님
          </div>
          {/* 로그아웃은 POST 전용 라우트라 링크가 아니라 폼이어야 한다. */}
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="cursor-pointer text-[13px] font-medium text-slate-400 hover:text-slate-600"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: `src/app/home/_components/ProfileCard.tsx` 작성**

```tsx
import Link from "next/link";
import type { ProfileCard as ProfileCardVM } from "../_lib/to-profile-card";

export function ProfileCard({ card }: { card: ProfileCardVM }) {
  const { isPaid } = card;
  const progress = Math.round((card.openedSections / card.totalSections) * 100);

  return (
    <div
      className={`relative overflow-hidden rounded-[20px] border bg-white ${
        isPaid
          ? "border-accent/25 shadow-[0_10px_26px_-18px_rgba(37,99,235,0.5)]"
          : "border-slate-200 shadow-[0_1px_3px_rgba(17,24,39,0.04)]"
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${isPaid ? "bg-accent" : "bg-slate-200"}`} />

      <div className="flex flex-wrap items-center gap-[18px] px-6 py-[22px]">
        <div
          className={`ml-1.5 flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full text-[19px] font-bold ${
            isPaid ? "bg-accent-soft text-accent" : "bg-slate-100 text-slate-400"
          }`}
        >
          {card.initial}
        </div>

        <div className="min-w-[190px] flex-1">
          <span
            className={`mb-[5px] inline-flex items-center rounded-full px-[9px] py-[3px] text-xs font-bold ${
              isPaid
                ? "bg-accent-soft text-accent"
                : "border border-slate-200 bg-white text-slate-400"
            }`}
          >
            {isPaid ? "전체 리포트" : "무료 리포트"}
          </span>

          <div className="text-[19px] font-bold leading-[1.25] tracking-[-0.02em]">
            {card.name}
          </div>
          <div className="mt-[3px] text-sm text-slate-400">{card.birthLabel}</div>

          <div className="mt-3 flex max-w-[280px] items-center gap-2.5">
            <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${isPaid ? "bg-accent" : "bg-slate-300"}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span
              className={`whitespace-nowrap text-[12.5px] font-semibold ${
                isPaid ? "text-accent" : "text-slate-400"
              }`}
            >
              {isPaid
                ? `${card.totalSections}개 섹션 전체`
                : `${card.totalSections}개 중 ${card.openedSections}개 열림`}
            </span>
          </div>
        </div>

        <div className="flex min-w-[150px] flex-col items-stretch gap-2">
          <Link
            href={card.reportHref}
            className={`whitespace-nowrap rounded-xl px-5 py-[11px] text-center text-[14.5px] font-semibold ${
              isPaid
                ? "bg-accent text-white hover:opacity-90"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {isPaid ? "리포트 보기" : "무료 리포트 보기"}
          </Link>
          {!isPaid && (
            // 결제가 아직 없으므로 리포트 안의 결제 CTA 로 넘긴다.
            <Link
              href={card.reportHref}
              className="whitespace-nowrap px-0.5 text-center text-[13.5px] font-semibold text-accent hover:underline"
            >
              전체 리포트 열기 · ₩9,900
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `src/app/home/_components/AddProfileButton.tsx` 작성**

```tsx
import Link from "next/link";

const SHELL =
  "flex w-full items-center justify-center gap-2.5 rounded-[20px] border-[1.5px] border-dashed bg-white p-[22px] text-[15px] font-semibold";

function Plus() {
  return (
    <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border-[1.5px] border-current text-[17px] font-normal leading-none">
      +
    </span>
  );
}

export function AddProfileButton({ disabled }: { disabled: boolean }) {
  if (disabled) {
    return (
      <div className={`${SHELL} border-slate-200 text-slate-300`} aria-disabled>
        <Plus />
        새 프로필 추가
      </div>
    );
  }

  return (
    <Link
      href="/funnel?step=name"
      className={`${SHELL} border-slate-300 text-slate-500 hover:border-accent hover:text-accent`}
    >
      <Plus />
      새 프로필 추가
    </Link>
  );
}
```

- [ ] **Step 5: `src/app/home/_components/EmptyState.tsx` 작성**

```tsx
/**
 * 디자인에는 없는 화면. 로그인 직후 첫 방문자는 대부분 프로필이 0개라
 * 목록만 비워 두면 무엇을 해야 하는지 알 수 없다.
 */
export function EmptyState() {
  return (
    <div className="pb-2 pt-6 text-center">
      <p className="mb-1.5 text-[17px] font-bold tracking-[-0.02em]">
        아직 저장된 프로필이 없어요
      </p>
      <p className="text-sm text-slate-400 [word-break:keep-all]">
        생년월일시를 입력하면 사주 리포트를 만들어 드려요.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: `src/app/home/page.tsx` 작성**

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { MAX_PROFILES, listProfiles } from "@/lib/profiles/store";
import { countCaption, toProfileCard } from "./_lib/to-profile-card";
import { HomeHeader } from "./_components/HomeHeader";
import { ProfileCard } from "./_components/ProfileCard";
import { AddProfileButton } from "./_components/AddProfileButton";
import { EmptyState } from "./_components/EmptyState";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/home");

  const [user, rows] = await Promise.all([
    getUser(session.userId),
    listProfiles(session.userId),
  ]);
  const cards = rows.map(toProfileCard);
  const isFull = cards.length >= MAX_PROFILES;
  // 소셜 제공자가 이름을 주지 않는 경우가 있다.
  const displayName = user?.displayName?.trim() || "회원";

  return (
    <div className="min-h-screen flex-1 bg-slate-50">
      <HomeHeader displayName={displayName} />

      <main className="mx-auto max-w-[880px] px-6 pb-24 pt-[clamp(36px,6vw,64px)]">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="mb-2 text-[clamp(26px,4vw,34px)] font-bold tracking-[-0.035em]">
              저장된 프로필
            </h1>
            <p className="text-[15px] text-slate-400">{countCaption(cards)}</p>
          </div>

          {cards.length > 0 && (
            <div className="flex items-center gap-2.5 text-[13px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" />
                전체 리포트
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                무료 리포트
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          {cards.length === 0 ? (
            <EmptyState />
          ) : (
            cards.map((card) => <ProfileCard key={card.id} card={card} />)
          )}
          <AddProfileButton disabled={isFull} />
        </div>

        <p className="mt-[22px] text-[13px] text-slate-400 [text-wrap:pretty]">
          {isFull
            ? `프로필 ${MAX_PROFILES}개를 모두 사용했어요. 결제한 리포트는 계정에 계속 보관됩니다.`
            : `프로필은 최대 ${MAX_PROFILES}개까지 저장할 수 있어요. 결제한 리포트는 계정에 계속 보관됩니다.`}
        </p>
      </main>
    </div>
  );
}
```

- [ ] **Step 7: 타입 검사와 린트**

Run: `npm run typecheck && npm run lint`
Expected: 오류 없음

- [ ] **Step 8: 빌드로 라우트 생성 확인**

Run: `npm run build`
Expected: 성공. 라우트 목록에 `/home`과 `/api/profiles`가 나온다.

- [ ] **Step 9: 커밋**

```bash
git add src/app/home src/app/api/auth/logout/route.ts
git commit -m "feat(home): 저장된 프로필 화면 추가"
```

---

### Task 7: 퍼널 완료 시 프로필 저장

**Files:**
- Create: `src/app/funnel/_lib/toProfileBody.ts`
- Create: `src/app/funnel/_lib/toProfileBody.test.ts`
- Modify: `src/app/funnel/page.tsx:41-46` (분석 완료 effect)

**Interfaces:**
- Consumes: `FunnelData` (`../_context/FunnelContext`), `CreateProfileBody` (Task 4), `POST /api/profiles` 계약 (Task 4).
- Produces: `toProfileBody(data: FunnelData): CreateProfileBody`

- [ ] **Step 1: 실패하는 테스트 작성 — `src/app/funnel/_lib/toProfileBody.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import type { FunnelData } from "../_context/FunnelContext";
import { toProfileBody } from "./toProfileBody";

const full: FunnelData = {
  name: "  김동진  ",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { y: 1990, m: 10, d: 25 },
  timeKnown: true,
  time: { h: 15, m: 20 },
  birthPlace: { country: "KR", regionId: "seoul" },
  trueSolar: true,
};

describe("toProfileBody", () => {
  it("퍼널 입력을 API 본문 모양으로 옮긴다", () => {
    expect(toProfileBody(full)).toEqual({
      name: "김동진",
      gender: "male",
      calendar: "solar",
      isLeapMonth: false,
      birth: { year: 1990, month: 10, day: 25 },
      timeKnown: true,
      time: { hour: 15, minute: 20 },
      birthPlace: { country: "KR", regionId: "seoul" },
      trueSolar: true,
    });
  });

  it("시간을 건너뛰면 time 은 null", () => {
    const body = toProfileBody({ ...full, timeKnown: false, time: null });
    expect(body.timeKnown).toBe(false);
    expect(body.time).toBeNull();
  });

  it("timeKnown 이 true 라도 값이 없으면 null", () => {
    expect(toProfileBody({ ...full, time: null }).time).toBeNull();
  });

  it("양력이면 윤달 표시를 버린다", () => {
    expect(toProfileBody({ ...full, isLeapMonth: true }).isLeapMonth).toBe(false);
  });

  it("음력이면 윤달 표시를 유지한다", () => {
    const body = toProfileBody({ ...full, calendar: "lunar", isLeapMonth: true });
    expect(body.isLeapMonth).toBe(true);
  });

  it("출생지를 건너뛰면 null", () => {
    expect(toProfileBody({ ...full, birthPlace: null }).birthPlace).toBeNull();
  });

  it("생년월일이나 성별이 없으면 던진다", () => {
    expect(() => toProfileBody({ ...full, birth: null })).toThrow();
    expect(() => toProfileBody({ ...full, gender: null })).toThrow();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npx vitest run src/app/funnel/_lib/toProfileBody.test.ts`
Expected: FAIL — `Failed to resolve import "./toProfileBody"`

- [ ] **Step 3: `src/app/funnel/_lib/toProfileBody.ts` 구현**

```ts
import type { CreateProfileBody } from "@/app/api/profiles/_lib/input";
import type { FunnelData } from "../_context/FunnelContext";

/**
 * 퍼널 입력을 POST /api/profiles 본문으로 변환한다.
 * toBirthInput 과 나란한 자리 — 그쪽은 사주 계산용(경도로 접힌다), 이쪽은 저장용
 * (출생지를 그대로 남겨 나중에 다시 계산할 수 있게 한다).
 */
export function toProfileBody(data: FunnelData): CreateProfileBody {
  if (!data.birth || !data.gender) {
    throw new Error("생년월일·성별이 필요합니다");
  }
  const hasTime = data.timeKnown && data.time !== null;

  return {
    name: data.name.trim(),
    gender: data.gender,
    calendar: data.calendar,
    isLeapMonth: data.calendar === "lunar" ? data.isLeapMonth : false,
    birth: { year: data.birth.y, month: data.birth.m, day: data.birth.d },
    timeKnown: data.timeKnown,
    time: hasTime ? { hour: data.time!.h, minute: data.time!.m } : null,
    birthPlace: data.birthPlace
      ? { country: data.birthPlace.country, regionId: data.birthPlace.regionId }
      : null,
    trueSolar: data.trueSolar,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/app/funnel/_lib/toProfileBody.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: `src/app/funnel/page.tsx`의 분석 완료 effect 교체**

import 에 `import { toProfileBody } from "./_lib/toProfileBody";` 를 추가하고, 41–46번째 줄의 effect 를 아래로 바꾼다:

```tsx
  // 분석 완료 → 프로필 저장 후 리포트로.
  // 저장에 실패해도 사용자를 막지 않는다 — 리포트는 입력만으로 볼 수 있다.
  useEffect(() => {
    if (!analyzing) return;
    let cancelled = false;

    // 응답이 빨리 와도 분석 화면이 번쩍이지 않게 최소 노출 시간을 둔다.
    const minDelay = new Promise((r) => setTimeout(r, 2200));

    void (async () => {
      let dest = "/report";
      try {
        const res = await fetch("/api/profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(toProfileBody(data)),
        });
        if (res.status === 201) {
          const { id } = (await res.json()) as { id: string };
          dest = `/report?profile=${id}`;
        } else if (res.status === 409) {
          // 프로필 한도 초과 — 목록에서 정리하게 돌려보낸다.
          dest = "/home";
        }
        // 401(비로그인)과 그 밖의 오류는 저장 없이 리포트만 보여준다.
      } catch {
        // 네트워크 오류도 마찬가지.
      }
      await minDelay;
      if (!cancelled) router.push(dest);
    })();

    return () => {
      cancelled = true;
    };
  }, [analyzing, data, router]);
```

- [ ] **Step 6: 전체 테스트와 타입 검사**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 모두 통과

- [ ] **Step 7: 실제 앱에서 확인**

Run: `npm run dev`

확인 순서:
1. 비로그인으로 `/home` → `/login?next=/home` 으로 튕기는가
2. 로그인 → `/home` 으로 오는가, 프로필 0개면 빈 상태가 보이는가
3. "새 프로필 추가" → 퍼널 → 완료 → `/report?profile=<id>` 로 오는가
4. `/home` 으로 돌아오면 카드가 보이고 "1개 · 전체 리포트 0개", "12개 중 5개 열림" 인가
5. 로그아웃 버튼이 랜딩으로 보내는가 (405 가 아니라)

- [ ] **Step 8: 커밋**

```bash
git add src/app/funnel
git commit -m "feat(funnel): 분석 완료 시 프로필 저장하고 리포트로 이동"
```

---

## 완료 확인

- [ ] `npm test` — 전부 통과
- [ ] `npm run typecheck` — 오류 없음
- [ ] `npm run lint` — 오류 없음
- [ ] `npm run build` — 성공, `/home`·`/api/profiles` 라우트 존재
- [ ] Task 7 Step 7의 수동 확인 5개 항목 통과
