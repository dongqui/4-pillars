# 홈에서 마지막으로 고른 프로필을 기본값으로 — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 셀렉터에서 고른 프로필을 계정의 "나"(`users.primary_profile_id`)로 승격해, 다음에 홈에 들어오면 그 프로필이 잡혀 있게 한다.

**Architecture:** 새 컬럼도 마이그레이션도 없다. 기존 `users.primary_profile_id` 의 뜻을 "계정의 첫 저장 프로필"에서 "홈에서 마지막으로 고른 사람"으로 넓힌다. 레포의 3단(얇은 `route.ts` + 순수 `_lib/handler.ts` + `lib/*` store)을 그대로 따라 `POST /api/profiles/[id]/primary` 를 더하고, 홈 셀렉터가 줄을 고를 때 결과를 보지 않고 쏜다.

**Tech Stack:** Next.js 16.2.10 (App Router), TypeScript, Postgres(neon, 태그드 템플릿 SQL), vitest(environment: `node`), Tailwind.

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-08-25-home-profile-default-memory-design.md`
- 새 컬럼·마이그레이션 없음. `users.primary_profile_id` 를 그대로 쓴다.
- `setPrimaryProfileIfUnset` 은 **건드리지 않는다** — 첫 저장 프로필을 자동으로 정하는 초기값 역할로 계속 산다.
- 궁합 화면의 "나" 칸(`match/_components/MatchForm.tsx`)은 **건드리지 않는다** — 거기서 바꿔도 승격하지 않는다.
- 홈 목록 순서(`created_at DESC`)를 바꾸지 않는다. 고른 것을 맨 위로 올리지 않는다.
- 커밋 메시지는 레포 관례를 따른다: 한국어, `type(scope): 명령형 한 줄`.
- 테스트 환경이 `node` 라 클라이언트 컴포넌트는 렌더하지 않는다. 테스트는 순수 함수와 store 에만 붙인다.
- 모든 커밋 메시지 끝에 다음 줄을 붙인다:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## 파일 구조

| 파일 | 책임 |
|---|---|
| `src/lib/auth/users.ts` (수정) | `setPrimaryProfile` — 소유권·`kind='saved'` 를 WHERE 안에 건 덮어쓰기 UPDATE |
| `src/lib/auth/users.test.ts` (수정) | 위 함수의 WHERE 절과 반환값 |
| `src/app/api/profiles/[id]/primary/_lib/handler.ts` (신규) | 순수 핸들러 — 401/400/404/200 판정만. DB·세션을 모른다 |
| `src/app/api/profiles/[id]/primary/_lib/handler.test.ts` (신규) | 네 갈래 |
| `src/app/api/profiles/[id]/primary/route.ts` (신규) | 세션을 읽어 핸들러에 주입하고 상태코드를 굽는다 |
| `src/app/home/page.tsx` (수정) | 이미 읽는 `user.primaryProfileId` 를 셀렉터에 내려보낸다 |
| `src/app/home/_components/HomeIdentity.tsx` (수정) | 초기 선택 줄 + 고를 때 승격 + 삭제 후 승격 |
| `migrations/0029_users_primary_profile.sql` (주석만) | 넓어진 뜻을 적는다 |
| `src/lib/profiles/store.ts` (주석만) | 같은 축을 가리키는 ⚠️ 블록을 새 뜻으로 |

---

### Task 1: `setPrimaryProfile` — 덮어쓰되 남의 것·temp 는 못 받는 UPDATE

**Files:**
- Modify: `src/lib/auth/users.ts` (`UserProfile.primaryProfileId` 독스트링 ~line 55-63, 파일 끝에 함수 추가)
- Test: `src/lib/auth/users.test.ts` (파일 끝에 describe 추가)

**Interfaces:**
- Consumes: `SqlClient` (from `@/lib/db`, 이미 `users.ts` 가 재수출한다), `sql` 기본 클라이언트
- Produces: `setPrimaryProfile(userId: string, profileId: string, client?: SqlClient): Promise<boolean>` — 갱신된 행이 있으면 `true`

**배경 (읽고 시작할 것):**
- `src/lib/auth/users.ts` 의 `setPrimaryProfileIfUnset` — 같은 컬럼을 쓰지만 **덮어쓰지 않는** 형제 함수다. 지우지 말 것.
- `src/lib/profiles/store.ts` 의 `deleteProfile` — `SqlClient` 는 `rowCount` 를 주지 않는다. 영향 행 수를 알려면 `RETURNING id` 를 붙이고 `rows.length` 를 본다. 같은 수법을 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/auth/users.test.ts` 맨 위 import 에 `setPrimaryProfile` 을 더한다:

```ts
import { upsertUser, getUser, setPrimaryProfileIfUnset, setPrimaryProfile, type SqlClient } from "./users";
```

파일 끝에 붙인다:

```ts
describe("setPrimaryProfile", () => {
  // 소유권과 종류를 WHERE 안에 두는 것이 이 함수의 존재 이유다. profiles.id 는 순번
  // bigint 라 URL 에 노출된다 — 밖에서 검사하면 번호를 올려가며 남의 프로필을 자기
  // "나" 로 박을 수 있다.
  it("소유자와 kind='saved' 를 WHERE 안에서 함께 건다", async () => {
    const { client, calls } = fakeClient([{ id: 7 }]);
    await setPrimaryProfile("7", "42", client);

    expect(calls[0].sql).toContain("UPDATE users SET primary_profile_id");
    expect(calls[0].sql).toContain("EXISTS");
    expect(calls[0].sql).toContain("p.user_id =");
    expect(calls[0].sql).toContain("p.kind = 'saved'");
    expect(calls[0].values).toEqual(["42", "7", "42", "7"]);
  });

  // 형제 함수(setPrimaryProfileIfUnset)와 갈리는 지점이다. 홈에서 고를 때마다
  // 바뀌어야 하므로 IS NULL 로 잠그면 안 된다.
  it("이미 정해져 있어도 덮어쓴다 — IS NULL 조건이 없다", async () => {
    const { client, calls } = fakeClient([{ id: 7 }]);
    await setPrimaryProfile("7", "42", client);

    expect(calls[0].sql).not.toContain("primary_profile_id IS NULL");
  });

  // 남의 프로필, 없는 프로필, 목록에 서지 않는 temp 가 모두 이 한 갈래로 온다 —
  // 호출자는 셋을 가르지 않고 404 로 접는다.
  it("갱신된 행이 없으면 false", async () => {
    const { client } = fakeClient([]);
    expect(await setPrimaryProfile("7", "42", client)).toBe(false);
  });

  it("갱신됐으면 true", async () => {
    const { client } = fakeClient([{ id: 7 }]);
    expect(await setPrimaryProfile("7", "42", client)).toBe(true);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run src/lib/auth/users.test.ts
```

Expected: FAIL — `setPrimaryProfile` 이 `./users` 에서 export 되지 않아 import 단계에서 깨진다.

- [ ] **Step 3: 구현한다**

`src/lib/auth/users.ts` 파일 끝(`setPrimaryProfileIfUnset` 아래)에 붙인다:

```ts
/**
 * 홈에서 고른 프로필을 계정의 "나" 로 정한다. 형제 함수 `setPrimaryProfileIfUnset`
 * 과 달리 이미 정해진 값을 덮어쓴다 — 홈 셀렉터를 넘길 때마다 따라와야 한다.
 *
 * 두 조건을 WHERE 안에 두는 것이 이 함수의 존재 이유다:
 *  - `p.user_id`: profiles.id 는 순번 bigint 라 URL 에 노출된다. 밖에서 검사하면
 *    번호를 올려가며 남의 프로필을 자기 "나" 로 박을 수 있다.
 *  - `p.kind = 'saved'`: 궁합에서 저장하지 않고 만든 즉석 상대('temp')는 어느
 *    목록에도 서지 않는다. "나" 가 될 수 있으면 홈에 보이지도 않는 사람이 지도의
 *    중심에 선다.
 *
 * SqlClient 는 rowCount 를 주지 않아 RETURNING 으로 영향 행을 센다(deleteProfile 과 같다).
 * false 는 "없거나 · 남의 것이거나 · temp" 셋 중 하나다 — 호출자는 가르지 않고 404 로 접는다.
 */
export async function setPrimaryProfile(
  userId: string,
  profileId: string,
  client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    UPDATE users SET primary_profile_id = ${profileId}::bigint
     WHERE id = ${userId}::bigint
       AND EXISTS (
         SELECT 1 FROM profiles p
          WHERE p.id = ${profileId}::bigint
            AND p.user_id = ${userId}::bigint
            AND p.kind = 'saved'
       )
    RETURNING id
  `;
  return rows.length > 0;
}
```

- [ ] **Step 4: 독스트링의 옛 뜻을 고친다**

같은 파일 `UserProfile.primaryProfileId` 위 블록을 통째로 바꾼다.

찾을 것:

```ts
  /**
   * "나" 인 프로필. 아직 정해지지 않았거나 그 프로필이 지워졌으면 null
   * (0029 의 ON DELETE SET NULL).
   *
   * 소비하는 쪽은 null 을 실패가 아니라 "아직 모른다" 로 읽고 가장 오래된 저장
   * 프로필로 물러선다 — 계정이 생기기 전에 만들어진 행들이 여기 해당한다.
   */
```

바꿀 것:

```ts
  /**
   * "나" 인 프로필 — 홈 셀렉터에서 **마지막으로 고른 사람**이다. 아직 아무것도 고른
   * 적이 없으면 계정의 첫 저장 프로필이고(setPrimaryProfileIfUnset), 그 프로필이
   * 지워졌으면 null 이다 (0029 의 ON DELETE SET NULL).
   *
   * 소비하는 쪽은 null 을 실패가 아니라 "아직 모른다" 로 읽고 가장 오래된 저장
   * 프로필로 물러선다 — 계정이 생기기 전에 만들어진 행들이 여기 해당한다.
   */
```

- [ ] **Step 5: 통과를 확인한다**

```bash
npx vitest run src/lib/auth/users.test.ts
```

Expected: PASS — `setPrimaryProfile` 4개 포함 전부 초록.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/auth/users.ts src/lib/auth/users.test.ts && git commit -F - <<'MSG'
feat(profiles): 고른 프로필을 나로 정하는 UPDATE 를 더한다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 2: 순수 핸들러 — 401 / 400 / 404 / 200

**Files:**
- Create: `src/app/api/profiles/[id]/primary/_lib/handler.ts`
- Test: `src/app/api/profiles/[id]/primary/_lib/handler.test.ts`

**Interfaces:**
- Consumes: `parseProfileParam` (from `@/lib/profiles/param`), Task 1 의 `setPrimaryProfile` 과 **같은 모양의** 주입 함수 `(userId: string, id: string) => Promise<boolean>`
- Produces: `handleSetPrimary(id: string, d: SetPrimaryDeps): Promise<SetPrimaryResult>`, `SetPrimaryDeps { userId: string | null; setPrimary(userId: string, id: string): Promise<boolean> }`, `SetPrimaryResult { status: number; body: { primary: true } | { error: string } }`

**배경 (읽고 시작할 것):**
- `src/app/api/profiles/[id]/_lib/handler.ts` 와 그 테스트 — 이 태스크는 그 파일의 쌍둥이다. 판정 순서(세션 → id 형식 → store)와 문구를 그대로 맞춘다.
- `parseProfileParam` 은 `?profile` 용 파서지만 순번 id 규칙이 한 곳에 있어야 해서 라우트 파라미터도 이걸 통과시킨다. 인자 모양은 `{ profile: id }` 다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/profiles/[id]/primary/_lib/handler.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { handleSetPrimary } from "./handler";

describe("handleSetPrimary", () => {
  it("비로그인은 401", async () => {
    const r = await handleSetPrimary("1", { userId: null, setPrimary: async () => true });
    expect(r.status).toBe(401);
  });

  it("id 형식이 어긋나면 400 — ::bigint 캐스팅까지 가지 않는다", async () => {
    const r = await handleSetPrimary("abc", { userId: "1", setPrimary: async () => true });
    expect(r.status).toBe(400);
  });

  // 남의 것 · 없는 것 · 목록에 서지 않는 temp 가 한 갈래로 온다. 401/404 를 가르면
  // id 를 올려가며 어느 번호가 존재하는지 훑을 수 있다(handleDeleteProfile 과 같은 판단).
  it("store 가 false 면 404", async () => {
    const r = await handleSetPrimary("2", { userId: "1", setPrimary: async () => false });
    expect(r.status).toBe(404);
  });

  it("정했으면 200", async () => {
    const seen: string[][] = [];
    const r = await handleSetPrimary("2", {
      userId: "1",
      setPrimary: async (userId, id) => {
        seen.push([userId, id]);
        return true;
      },
    });
    expect(r).toEqual({ status: 200, body: { primary: true } });
    // 세션의 userId 를 그대로 넘긴다 — 소유권 검사는 store 의 WHERE 절이다.
    expect(seen).toEqual([["1", "2"]]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run "src/app/api/profiles/[id]/primary/_lib/handler.test.ts"
```

Expected: FAIL — `./handler` 를 찾지 못한다.

- [ ] **Step 3: 구현한다**

`src/app/api/profiles/[id]/primary/_lib/handler.ts`:

```ts
import { parseProfileParam } from "@/lib/profiles/param";

export interface SetPrimaryDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  /** 정해졌으면 true. 소유권과 kind='saved' 는 store 의 WHERE 절이 본다 */
  setPrimary(userId: string, id: string): Promise<boolean>;
}

export interface SetPrimaryResult {
  status: number;
  body: { primary: true } | { error: string };
}

/**
 * 홈에서 고른 프로필을 계정의 "나" 로 정한다.
 *
 * 없는 프로필 · 남의 프로필 · 목록에 서지 않는 temp 를 404 하나로 합친다 —
 * 401/404 를 가르면 id 를 하나씩 올려가며 어느 번호가 존재하는지 훑을 수 있다
 * (handleDeleteProfile 과 같은 판단).
 *
 * 이미 그 사람이 "나" 인 경우도 200 이다. 결과 상태가 같으니 되돌릴 것이 없고,
 * 부르는 쪽(셀렉터)은 응답을 보지 않는다.
 */
export async function handleSetPrimary(
  id: string,
  d: SetPrimaryDeps,
): Promise<SetPrimaryResult> {
  if (d.userId === null) return { status: 401, body: { error: "로그인이 필요합니다" } };
  // URL 문자열을 그대로 ::bigint 로 캐스팅하면 DB 에러 → 500 이다.
  const param = parseProfileParam({ profile: id });
  if (param.kind !== "id") return { status: 400, body: { error: "요청을 확인해 주세요" } };

  if (!(await d.setPrimary(d.userId, param.id))) {
    return { status: 404, body: { error: "프로필을 찾을 수 없습니다" } };
  }
  return { status: 200, body: { primary: true } };
}
```

- [ ] **Step 4: 통과를 확인한다**

```bash
npx vitest run "src/app/api/profiles/[id]/primary/_lib/handler.test.ts"
```

Expected: PASS — 4개 초록.

- [ ] **Step 5: 커밋**

```bash
git add "src/app/api/profiles/[id]/primary/_lib" && git commit -F - <<'MSG'
feat(api): 나로 정하기 요청의 판정을 순수 핸들러로 세운다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 3: `POST /api/profiles/[id]/primary` 라우트

**Files:**
- Create: `src/app/api/profiles/[id]/primary/route.ts`

**Interfaces:**
- Consumes: Task 2 의 `handleSetPrimary`, Task 1 의 `setPrimaryProfile`, `getSession` (from `@/lib/auth/session`)
- Produces: `POST /api/profiles/<id>/primary` — 본문 없음. 200 `{ primary: true }`

**배경 (읽고 시작할 것):**
- `src/app/api/profiles/[id]/route.ts` — 본문 없는 요청의 기존 모양. 이 파일은 그 쌍둥이다.
- Next 16 의 라우트 컨텍스트 계약: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` 의 `context` 절. `params` 는 **Promise** 이고 `await` 해야 한다. 레포의 기존 DELETE 라우트가 이미 이 모양이니 그대로 따른다.

- [ ] **Step 1: 라우트를 쓴다**

`src/app/api/profiles/[id]/primary/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { setPrimaryProfile } from "@/lib/auth/users";
import { handleSetPrimary } from "./_lib/handler";

// 본문이 없는 요청이라 형제 DELETE 라우트처럼 body-parse 단계를 두지 않는다.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();

  try {
    const result = await handleSetPrimary(id, {
      userId: session?.userId ?? null,
      setPrimary: setPrimaryProfile,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/profiles/:id/primary]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
```

- [ ] **Step 2: 타입과 린트를 통과하는지 본다**

```bash
npm run typecheck
```

Expected: 에러 없음.

```bash
npm run lint
```

Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add "src/app/api/profiles/[id]/primary/route.ts" && git commit -F - <<'MSG'
feat(api): 프로필 하나를 나로 정하는 라우트를 연다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

### Task 4: 홈 셀렉터가 기억하고 승격한다

**Files:**
- Modify: `src/app/home/page.tsx`
- Modify: `src/app/home/_components/HomeIdentity.tsx`
- Modify: `migrations/0029_users_primary_profile.sql` (주석만)
- Modify: `src/lib/profiles/store.ts` (주석만, `ProfileKind` 위 블록)

**Interfaces:**
- Consumes: Task 3 의 `POST /api/profiles/<id>/primary`, `UserProfile.primaryProfileId`
- Produces: `HomeIdentity` 의 새 prop `primaryProfileId: string | null`

**배경 (읽고 시작할 것):**
- `src/app/home/_components/HomeIdentity.tsx` — 셀렉터·캐릭터 카드·탐색 그리드가 한 컴포넌트에 있고, `index` 하나가 셋을 동시에 움직인다.
- `src/app/home/_components/DeleteProfileDialog.tsx` 의 `remove()` — `router.refresh()` 를 부른 **직후** `onDeleted()` 를 부른다. 그 순간 `entries` prop 은 아직 낡았다(지운 줄이 그대로 있다). Step 4 가 이걸 다룬다.
- `src/app/home/_lib/to-home-entry.ts` — 드래프트 줄은 `profileId === null` 이다. 승격할 행이 없다.

- [ ] **Step 1: 서버가 마지막 선택을 내려보낸다**

`src/app/home/page.tsx` 에서 세 군데를 고친다.

(a) 상태 변수 선언부. 찾을 것:

```ts
  let displayName: string | null = null;
  let balance: number | null = null;
  let entries: HomeEntry[] = [];
  let canAdd = true;
```

바꿀 것:

```ts
  let displayName: string | null = null;
  let balance: number | null = null;
  let entries: HomeEntry[] = [];
  let canAdd = true;
  /** 마지막으로 고른 프로필. 비로그인이거나 아직 아무것도 고르지 않았으면 null */
  let primaryProfileId: string | null = null;
```

(b) 세션 갈래 안. 찾을 것:

```ts
    displayName = resolveDisplayName(user);
```

바꿀 것:

```ts
    displayName = resolveDisplayName(user);
    primaryProfileId = user?.primaryProfileId ?? null;
```

(c) 렌더. 찾을 것:

```tsx
        <HomeIdentity entries={entries} canAdd={canAdd} />
```

바꿀 것:

```tsx
        <HomeIdentity
          entries={entries}
          canAdd={canAdd}
          primaryProfileId={primaryProfileId}
        />
```

- [ ] **Step 2: 셀렉터가 그 줄로 시작한다**

`src/app/home/_components/HomeIdentity.tsx`.

(a) Props 에 한 줄. 찾을 것:

```ts
interface Props {
  entries: HomeEntry[];
  /** 프로필을 더 만들 수 있는지 — 한도에 닿으면 추가 버튼을 잠근다 */
  canAdd: boolean;
}
```

바꿀 것:

```ts
interface Props {
  entries: HomeEntry[];
  /** 프로필을 더 만들 수 있는지 — 한도에 닿으면 추가 버튼을 잠근다 */
  canAdd: boolean;
  /**
   * 지난번에 고른 프로필(users.primary_profile_id). 비로그인이거나 아직 아무것도
   * 고르지 않았으면 null — 그때는 첫 줄로 물러선다.
   */
  primaryProfileId: string | null;
}
```

(b) 시그니처. 찾을 것:

```ts
export function HomeIdentity({ entries, canAdd }: Props) {
```

바꿀 것:

```ts
export function HomeIdentity({ entries, canAdd, primaryProfileId }: Props) {
```

(c) 초기 index. 찾을 것:

```ts
  const [index, setIndex] = useState(0);
```

바꿀 것:

```ts
  // 서버가 준 것은 index 가 아니라 id 다 — index 는 목록이 한 줄이라도 바뀌는 순간
  // 다른 사람을 가리키는 숫자가 되고, 서버와 클라가 같은 목록을 본다는 가정이
  // 어디에도 적히지 않는다. 못 찾으면(지워졌거나 드래프트뿐이면) 첫 줄이다.
  const [index, setIndex] = useState(() => {
    if (primaryProfileId === null) return 0;
    const i = entries.findIndex((e) => e.profileId === primaryProfileId);
    return i === -1 ? 0 : i;
  });
```

- [ ] **Step 3: 고르면 승격한다**

같은 파일. `const active = entries[...]` 줄 **위에** 함수를 하나 세운다. 찾을 것:

```ts
  const active = entries[Math.min(index, entries.length - 1)];
```

바꿀 것:

```ts
  /**
   * 고른 줄을 계정의 "나" 로 올린다 — 다음에 홈에 들어오면 이 줄이 잡혀 있고,
   * 지도·상담 주체·궁합의 "나" 도 같은 사람을 본다.
   *
   * 결과를 보지 않는다. 화면은 이미 넘어갔고 실패해도 잃는 것은 "다음 방문의
   * 기본값" 하나뿐인데, 성공했을 때 아무 표시도 없는 동작에 실패할 때만 빨간 줄을
   * 띄우면 사용자는 자기가 무엇을 잘못했는지 찾게 된다.
   *
   * 아직 계정에 저장되지 않은 드래프트는 올릴 행이 없다 — 그냥 돌아간다.
   */
  function promote(profileId: string | null) {
    if (profileId === null) return;
    void fetch(`/api/profiles/${profileId}/primary`, { method: "POST" }).catch(() => {});
  }

  const active = entries[Math.min(index, entries.length - 1)];
```

이어서 줄을 고르는 버튼의 onClick 을 고친다. 찾을 것:

```tsx
                        onClick={() => {
                          setIndex(i);
                          setOpen(false);
                        }}
```

바꿀 것:

```tsx
                        onClick={() => {
                          // 보고 있던 줄을 다시 누른 것이면 바뀐 것이 없다 — 쏘지 않는다.
                          if (i !== index) {
                            setIndex(i);
                            promote(entry.profileId);
                          }
                          setOpen(false);
                        }}
```

- [ ] **Step 4: 삭제 후에도 화면과 DB 를 맞춘다**

같은 파일의 `DeleteProfileDialog` 의 `onDeleted`. 찾을 것:

```tsx
          onDeleted={() => {
            // 지운 줄이 보고 있던 줄보다 위였으면 목록이 한 칸씩 당겨진다 — 같이 당긴다.
            // 보고 있던 줄 자신을 지웠으면 그 자리로 올라오는 다음 줄을 그대로 본다.
            const removed = target.index;
            setIndex((cur) => (removed < cur ? cur - 1 : cur));
            setTarget(null);
            setOpen(false);
          }}
```

바꿀 것:

```tsx
          onDeleted={() => {
            // 지운 줄이 보고 있던 줄보다 위였으면 목록이 한 칸씩 당겨진다 — 같이 당긴다.
            // 보고 있던 줄 자신을 지웠으면 그 자리로 올라오는 다음 줄을 그대로 본다.
            const removed = target.index;

            // ⚠️ 착지한 줄을 entries 에서 그대로 읽으면 안 된다. 다이얼로그는
            // router.refresh() 를 부른 직후 이 콜백을 부르는데 새 목록은 아직 오지
            // 않았다 — 지금 entries 에는 방금 지운 줄이 그대로 있다.
            const rest = entries.filter((_, i) => i !== removed);
            const landing = Math.min(removed < index ? index - 1 : index, rest.length - 1);
            // 지운 것이 "나" 였으면 FK 가 null 로 만든다(0029 의 ON DELETE SET NULL).
            // 화면은 다음 줄에 착지해 있는데 DB 는 null 이라 어긋난다 — 다시 맞춘다.
            // 아무것도 안 남았으면 rest[-1] 이 undefined 라 promote 가 그냥 돌아간다.
            promote(rest[landing]?.profileId ?? null);

            setIndex((cur) => (removed < cur ? cur - 1 : cur));
            setTarget(null);
            setOpen(false);
          }}
```

- [ ] **Step 5: 축의 뜻을 새로 적는다**

(a) `migrations/0029_users_primary_profile.sql` 의 주석 끝(`ALTER TABLE` 문 **위**)에 문단 하나를 더한다. 찾을 것:

```sql
-- ON DELETE SET NULL: 프로필이 지워지면 나를 잃을 뿐 계정은 살아 있어야 한다.
-- 소비하는 쪽은 null 을 "아직 정해지지 않음" 으로 읽고 가장 오래된 저장 프로필로 물러선다.
```

바꿀 것:

```sql
-- ON DELETE SET NULL: 프로필이 지워지면 나를 잃을 뿐 계정은 살아 있어야 한다.
-- 소비하는 쪽은 null 을 "아직 정해지지 않음" 으로 읽고 가장 오래된 저장 프로필로 물러선다.
--
-- (2026-08-25) 뜻이 넓어졌다. 홈 셀렉터에서 프로필을 고르면 이 값이 그 사람으로 바뀐다 --
-- "계정의 첫 저장 프로필" 이 아니라 "홈에서 마지막으로 고른 사람" 이다. 지도·상담 주체·
-- 궁합의 "나" 가 모두 이것을 읽으므로 홈에서 넘기면 세 곳이 같이 따라온다. 승격은 홈에서만
-- 일어난다 — 궁합의 "나" 칸은 그 화면 안에서만 살고 끝난다.
```

(b) `src/lib/profiles/store.ts` 의 `ProfileKind` 위 블록. 찾을 것:

```ts
 * ⚠️ "누가 나인가" 는 여기 없다. 계정당 하나뿐인 사실이라 users.primary_profile_id
 * 가 답한다. 예전에는 kind='self' 가 그 대역을 겸했는데, self 가 20개까지 있을 수
 * 있어 대역이 되지 못했다 — 상담과 지도가 서로 반대인 휴리스틱으로 때우고 있었다.
```

바꿀 것:

```ts
 * ⚠️ "누가 나인가" 는 여기 없다. 계정당 하나뿐인 사실이라 users.primary_profile_id
 * 가 답한다 — 홈 셀렉터에서 마지막으로 고른 사람이다. 예전에는 kind='self' 가 그
 * 대역을 겸했는데, self 가 20개까지 있을 수 있어 대역이 되지 못했다 — 상담과 지도가
 * 서로 반대인 휴리스틱으로 때우고 있었다.
```

- [ ] **Step 6: 전체 수트와 타입을 돌린다**

```bash
npm test
```

Expected: PASS — 기존 테스트가 하나도 깨지지 않는다.

```bash
npm run typecheck
```

Expected: 에러 없음. (`HomeIdentity` 를 부르는 곳은 `home/page.tsx` 하나뿐이다 — 새 prop 을 안 넘긴 호출자가 있으면 여기서 잡힌다.)

```bash
npm run lint
```

Expected: 에러 없음.

- [ ] **Step 7: 브라우저에서 확인한다**

`.claude/launch.json` 의 dev 서버를 띄우고 `/home` 을 연다(로그인 + 프로필 2개 이상 필요).

1. 두 번째 줄을 고른다 → 네트워크 탭에 `POST /api/profiles/<id>/primary` 가 **200** 으로 뜬다.
2. 새로고침한다 → 방금 고른 줄에 체크(✓)가 있고 캐릭터 카드도 그 사람이다.
3. `/match` 로 간다 → "나" 칸이 같은 사람이다.
4. 보고 있던 프로필을 지운다 → 다음 줄로 착지하고 `POST …/primary` 가 한 번 더 200 으로 나간다. 새로고침해도 그 줄이다.
5. 콘솔에 에러가 없다.

- [ ] **Step 8: 커밋**

```bash
git add src/app/home/page.tsx src/app/home/_components/HomeIdentity.tsx migrations/0029_users_primary_profile.sql src/lib/profiles/store.ts && git commit -F - <<'MSG'
feat(home): 마지막으로 고른 프로필을 기억해 셀렉터가 그 줄로 연다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```
