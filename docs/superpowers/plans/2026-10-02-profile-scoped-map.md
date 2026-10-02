# 프로필당 관계 지도 · 프로필 소프트 삭제 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관계 지도와 고민상담 목록을 계정이 아니라 프로필에 묶고, 프로필 삭제를 소프트 삭제로 바꾼다.

**Architecture:** `maps` 에 `profile_id` 를 더하고 유니크 키를 `owner_user_id` 에서 `profile_id` 로 옮긴다(`flows_unique` 와 같은 모양). `profiles` 에 `deleted_at` 을 더해 삭제를 소프트로 바꾸고, 지워진 행을 거르는 책임은 전부 `profiles/store.ts` 안에 둔다 — 호출부는 아무것도 안 고친다. 상담은 컬럼이 이미 있으므로 `listConsultations` 에 `profile_id` 조건 하나를 더한다.

**Tech Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Vitest · Neon serverless Postgres(HTTP 드라이버) · Tailwind v4.

**Spec:** [2026-10-02-profile-scoped-map-design.md](../specs/2026-10-02-profile-scoped-map-design.md)

## Global Constraints

- **마이그레이션 파일 하나에 SQL 문장은 하나만 담는다.** Neon HTTP 드라이버가 한 쿼리에 문장 여러 개를 거부하고, `scripts/migrate.mts` 가 파일 전체를 한 번의 prepared statement 로 보낸다. `ALTER` 와 `CREATE INDEX` 는 반드시 파일을 나눈다.
- **마이그레이션 파일명은 `NNNN_<snake_case>.sql`.** 현재 마지막은 `0049_users_provider_admin.sql` 이므로 `0050` 부터 쓴다.
- **워크트리들이 같은 개발 DB 를 공유한다.** `npm run db:migrate` 를 돌리는 순간 머지 전까지 다른 브랜치의 `/consult`·`/map` 이 500 을 맞을 수 있다. 돌리기 전에 그 사실을 말하고 돌린다.
- **Next.js 코드를 고치기 전에 `node_modules/next/dist/docs/` 의 해당 가이드를 읽는다**(루트 `AGENTS.md`). 이 저장소의 Next.js 는 학습 데이터와 다르다.
- DB 를 쓰는 store 테스트는 **실제 DB 에 붙지 않는다.** `fakeClient` 로 SQL 문자열과 바인딩 값만 검사한다(`src/lib/profiles/store.test.ts:18` 패턴).
- 검증 명령: `npx vitest run` · `npx tsc --noEmit` · `npx eslint src`.
- 커밋 메시지는 한국어로, 마지막 줄에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- `entitlements` 는 어떤 경우에도 안 지운다. 지금 `deleteProfile` 이 안 지우는 것과 같다.

## Review Focus

1. **`/map?profile=` 에 내 것이 아닌 id** — 남의 프로필, `temp` 프로필, 소프트 삭제된 프로필, 숫자가 아닌 값. 전부 404 가 아니라 **내 primary 지도로** 떨어져야 한다. (Task 7)
2. **이미 산 리포트의 프로필이 지워진 경우** — `/flow/[id]`·`/match/[id]` 가 `if (!profile) notFound()` 라, 읽기용 조회가 지워진 행을 못 보면 돈 주고 산 리포트가 404 가 된다. (Task 4)
3. **소프트 삭제된 프로필로 새 상담·새 흐름·새 궁합을 여는 경우** — `getProfile` 이 막아야 한다. 안 막으면 지워진 사람으로 이용권이 나간다. (Task 3)
4. **백필이 안 된 `maps` 행(`profile_id IS NULL`)** — primary 가 없는 계정의 옛 지도다. 유니크 인덱스를 깨지 않아야 하고(Postgres 는 NULL 을 서로 다른 값으로 본다), 공유 링크로는 계속 열려야 한다. (Task 5)
5. **`profile_id IS NULL` 인 옛 상담** — 어느 프로필 목록에도 서지 않아야 한다. 조건을 `profile_id` 하나로만 걸면 남의 행이 섞일 틈이 생기므로 `user_id` 를 함께 건다. (Task 8)

---

### Task 1: profiles 에 deleted_at 컬럼

**Files:**
- Create: `migrations/0050_profiles_deleted_at.sql`
- Create: `migrations/0051_profiles_user_live_idx.sql`

**Interfaces:**
- Consumes: 없음
- Produces: `profiles.deleted_at timestamptz NULL`. Task 2·3·4 가 이 컬럼을 읽고 쓴다.

- [ ] **Step 1: 컬럼 마이그레이션을 쓴다**

`migrations/0050_profiles_deleted_at.sql`:

```sql
-- 프로필 삭제를 소프트 삭제로 바꾼다.
--
-- 진짜 DELETE 를 쓸 수 없는 이유가 둘이다. maps 가 profiles 를 참조하게 되면서
-- (0052) 삭제가 이미 뿌린 공유 링크를 깨고, 지금도 flows·matches 의 CASCADE 가
-- 돌아 **돈 주고 산 흐름 리포트와 본 궁합이 같이 사라진다**. store.ts 의
-- deleteProfile 이 entitlements 를 "환불·CS 가 봐야 하는 기록" 이라며 일부러
-- 남기는 것과 같은 판단이 그 둘에는 걸려 있지 않았다.
--
-- boolean 이 아니라 timestamptz 인 이유: 나중에 고아를 치울 때 "언제 지워진
-- 것부터" 를 봐야 한다. 불리언이면 그 질문에 답할 수 없어 청소가 전부 아니면
-- 아무것도가 된다.
--
-- CASCADE 는 그대로 둔다. 소프트 삭제가 걸린 뒤로 평소에는 안 돌고, 유예 기간이
-- 지난 행을 진짜 지울 때만 돈다 — 그때는 흐름·궁합·지도가 같이 사라지는 것이 맞다.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz
```

- [ ] **Step 2: 인덱스 마이그레이션을 쓴다 (별도 파일)**

`migrations/0051_profiles_user_live_idx.sql`:

```sql
-- 살아 있는 프로필 조회(listProfiles·countProfiles)가 대부분이라 부분 인덱스로 받친다.
-- 0050 과 파일을 나눈 것은 Neon HTTP 드라이버가 한 쿼리에 문장 여러 개를 거부하기
-- 때문이다 — migrate.mts 가 파일 전체를 한 번의 prepared statement 로 보낸다.
CREATE INDEX IF NOT EXISTS profiles_user_live ON profiles(user_id) WHERE deleted_at IS NULL
```

- [ ] **Step 3: 개발 DB 에 적용한다**

다른 워크트리가 같은 DB 를 본다는 것을 사람에게 먼저 말한 뒤:

```bash
npm run db:migrate
```

Expected: `applying 0050_profiles_deleted_at.sql` / `applying 0051_profiles_user_live_idx.sql` 두 줄이 보이고 에러가 없다.

- [ ] **Step 4: 커밋**

```bash
git add migrations/0050_profiles_deleted_at.sql migrations/0051_profiles_user_live_idx.sql
git commit -m "$(cat <<'EOF'
feat(profiles): 소프트 삭제용 deleted_at 컬럼을 더한다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: deleteProfile 을 소프트 삭제로

**Files:**
- Modify: `src/lib/profiles/store.ts` (`deleteProfile`, 파일 끝)
- Test: `src/lib/profiles/store.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `profiles.deleted_at`
- Produces: `deleteProfile(userId: string, id: string, client?: SqlClient): Promise<boolean>` — 시그니처는 그대로다. 호출부(`src/app/api/profiles/[id]/route.ts:17`)는 안 고친다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/profiles/store.test.ts` 의 기존 `deleteProfile` 테스트 둘을 아래로 **교체**한다:

```ts
  it("deleteProfile 은 행을 지우지 않고 deleted_at 을 찍는다", async () => {
    const { client, calls } = fakeClient([{ id: 2 }]);
    expect(await deleteProfile("1", "2", client)).toBe(true);

    expect(calls[0].sql).toContain("UPDATE profiles");
    expect(calls[0].sql).toContain("deleted_at = now()");
    expect(calls[0].sql).not.toContain("DELETE FROM");
  });

  // user_id 조건이 없으면 URL 의 순번 id 를 하나씩 올려가며 남의 프로필을 지울 수 있다.
  it("deleteProfile 은 user_id 를 함께 필터한다", async () => {
    const { client, calls } = fakeClient([{ id: 2 }]);
    expect(await deleteProfile("1", "2", client)).toBe(true);

    expect(calls[0].sql).toContain("user_id =");
    // 바인딩 순서는 템플릿에 나타난 순서다 — id → user_id.
    expect(calls[0].values).toEqual(["2", "1"]);
  });

  // 핸들러가 "이미 지워진 프로필에 한 번 더 오면 404" 를 약속한다. 그 404 는 이
  // 조건이 RETURNING 을 비우는 데서 나온다.
  it("deleteProfile 은 이미 지워진 행을 다시 지우지 않는다", async () => {
    const { client, calls } = fakeClient([]);
    expect(await deleteProfile("1", "2", client)).toBe(false);

    expect(calls[0].sql).toContain("deleted_at IS NULL");
  });
```

설계 §7 은 "프로필을 지운 뒤에도 flows·matches 행이 남는다"는 테스트를 적어 두었다. 이 저장소의 store 테스트는 `fakeClient` 로 SQL 문자열만 검사하므로 진짜 CASCADE 동작은 단위 테스트로 못 잡는다. 대신 위의 `not.toContain("DELETE FROM")` 이 같은 것을 기계적으로 보장한다 — **DELETE 를 안 보내면 CASCADE 가 돌 수 없다.** 그 사실을 테스트 주석에 적어 둔 것이 그 요구의 구현이다.

- [ ] **Step 2: 테스트가 실패하는지 본다**

```bash
npx vitest run src/lib/profiles/store.test.ts
```

Expected: FAIL — `expected '… DELETE FROM profiles …' to contain 'UPDATE profiles'`

- [ ] **Step 3: 구현한다**

`src/lib/profiles/store.ts` 의 `deleteProfile` 본문을 바꾸고, 바로 위 docstring 에 문단을 하나 더한다:

```ts
/**
 * 내 프로필 하나를 지운다 — 행을 지우지 않고 deleted_at 을 찍는다.
 *
 * 진짜 DELETE 를 쓰지 않는 이유는 0050_profiles_deleted_at.sql 에 적혀 있다:
 * maps 가 profiles 를 참조하므로 삭제가 공유 링크를 깨고, flows·matches 의
 * CASCADE 가 산 리포트까지 지운다.
 *
 * `deleted_at IS NULL` 조건이 핵심이다. 이미 지운 것을 또 지우면 RETURNING 이
 * 비고 false 가 나가, 핸들러가 지금처럼 404 를 돌려준다 — "이미 지워진 프로필에
 * 한 번 더 오는 경우도 404" 라는 handleDeleteProfile 의 약속이 그대로 산다.
 *
 * entitlements 는 함께 지우지 않는다. subject_key 가 text 라 FK 가 없고, id 는
 * IDENTITY 라 재사용되지 않으니 남은 행이 다른 프로필을 여는 일은 없다. 반대로
 * 지우면 "이때 이용권 몇 장을 냈는가" 라는 결제 사실이 사라진다 — 환불·CS 가 봐야
 * 하는 기록이라 프로필보다 오래 남아야 한다.
 */
export async function deleteProfile(
  userId: string,
  id: string,
  client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    UPDATE profiles SET deleted_at = now()
     WHERE id = ${id}::bigint AND user_id = ${userId}::bigint
       AND deleted_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

```bash
npx vitest run src/lib/profiles/store.test.ts
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/profiles/store.ts src/lib/profiles/store.test.ts
git commit -m "$(cat <<'EOF'
feat(profiles): 프로필 삭제를 소프트 삭제로 바꾼다

산 흐름 리포트와 본 궁합이 프로필 삭제의 CASCADE 로 사라지던 것을 멈춘다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 읽기 함수가 지워진 프로필을 안 돌려준다

**Files:**
- Modify: `src/lib/profiles/store.ts` (`listProfiles`, `getProfile`, `countProfiles`)
- Test: `src/lib/profiles/store.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `profiles.deleted_at`
- Produces: 세 함수의 시그니처는 그대로. 호출부 서른 곳이 자동으로 지워진 프로필을 못 본다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/profiles/store.test.ts` 의 `describe("listProfiles")`, `describe("getProfile")`, `describe("countProfiles")` 각각에 한 줄씩 더한다:

```ts
  // 지워진 프로필이 셀렉터에 다시 서면 안 된다. 조건을 호출부마다 적지 않고
  // store 안에 두는 이유가 이것이다 — 서른 곳 중 한 곳이 빠지면 그 한 곳이 샌다.
  it("listProfiles 는 지워진 프로필을 뺀다", async () => {
    const { client, calls } = fakeClient([]);
    await listProfiles("1", client);
    expect(calls[0].sql).toContain("deleted_at IS NULL");
  });

  it("getProfile 은 지워진 프로필을 뺀다", async () => {
    const { client, calls } = fakeClient([]);
    await getProfile("1", "2", client);
    expect(calls[0].sql).toContain("deleted_at IS NULL");
  });

  // MAX_PROFILES 20 이 지운 사람까지 세면, 스무 명을 지운 계정이 한 명도 더 못 만든다.
  it("countProfiles 는 지워진 프로필을 안 센다", async () => {
    const { client, calls } = fakeClient([{ n: 2 }]);
    await countProfiles("1", "saved", client);
    expect(calls[0].sql).toContain("deleted_at IS NULL");
  });
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

```bash
npx vitest run src/lib/profiles/store.test.ts
```

Expected: FAIL × 3 — `expected '… WHERE p.user_id = ? AND p.kind = ?…' to contain 'deleted_at IS NULL'`

- [ ] **Step 3: 구현한다**

세 쿼리의 `WHERE` 에 조건을 더한다.

`listProfiles`:

```ts
    WHERE p.user_id = ${userId}::bigint AND p.kind = 'saved'
      AND p.deleted_at IS NULL
    ORDER BY p.created_at DESC
```

`getProfile`:

```ts
    WHERE p.id = ${id}::bigint AND p.user_id = ${userId}::bigint
      AND p.deleted_at IS NULL
```

`countProfiles`:

```ts
    WHERE user_id = ${userId}::bigint AND kind = ${kind}
      AND deleted_at IS NULL
```

`getProfile` 의 docstring 끝에 한 문단을 더한다:

```
 * 지워진 프로필은 안 돌려준다 — 이 함수는 **새로 무언가를 여는** 자리(새 상담,
 * 새 흐름, 새 궁합)가 쓰는 길이고, 지워진 사람으로 이용권이 나가면 안 된다.
 * 이미 만들어진 산출물의 주인을 읽는 세 곳은 getProfileById 를 쓴다.
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

```bash
npx vitest run src/lib/profiles/store.test.ts
```

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/profiles/store.ts src/lib/profiles/store.test.ts
git commit -m "$(cat <<'EOF'
feat(profiles): 지워진 프로필을 목록·조회·카운트에서 뺀다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: getProfileById — 산 물건을 읽는 세 곳

**Files:**
- Modify: `src/lib/profiles/store.ts` (`getProfile` 바로 아래에 추가)
- Modify: `src/app/flow/[id]/page.tsx:72-73`
- Modify: `src/app/match/[id]/page.tsx:77-79`
- Modify: `src/app/api/consultations/[id]/messages/route.ts:49-52`
- Test: `src/lib/profiles/store.test.ts`

**Interfaces:**
- Consumes: Task 3 의 `getProfile`(지워진 것 제외)
- Produces: `getProfileById(userId: string, id: string, client?: SqlClient): Promise<ProfileRow | null>` — `getProfile` 과 같되 `deleted_at` 을 안 본다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
describe("getProfileById", () => {
  // 이미 산 리포트의 주인을 읽는 자리다. 여기까지 지워진 행을 가리면 프로필을
  // 지운 순간 /flow/[id] 와 /match/[id] 가 notFound 로 떨어져, 돈 주고 산 물건이
  // 사라진다.
  it("지워진 프로필도 돌려준다", async () => {
    const { client, calls } = fakeClient([{ ...dbRow, is_unlocked: false }]);
    expect(await getProfileById("1", "2", client)).not.toBeNull();
    expect(calls[0].sql).not.toContain("deleted_at");
  });

  // getProfile 과 같은 이유로 user_id 를 함께 건다 — id 만으로 찾으면 파라미터를
  // 올려가며 남의 생년월일을 읽을 수 있다.
  it("user_id 를 함께 필터한다", async () => {
    const { client, calls } = fakeClient([]);
    expect(await getProfileById("1", "2", client)).toBeNull();
    expect(calls[0].sql).toContain("user_id =");
    expect(calls[0].values).toEqual(["2", "1"]);
  });
});
```

import 줄에 `getProfileById` 를 더한다.

- [ ] **Step 2: 테스트가 실패하는지 본다**

```bash
npx vitest run src/lib/profiles/store.test.ts
```

Expected: FAIL — `getProfileById is not a function` 또는 import 에러

- [ ] **Step 3: 구현한다**

`src/lib/profiles/store.ts` 의 `getProfile` 바로 아래:

```ts
/**
 * id 로 프로필 하나 — **지워진 것도 포함한다.**
 *
 * getProfile 과 갈리는 유일한 축이 그것이다. 이 함수를 쓰는 곳은 셋뿐이고 전부
 * **이미 만들어진 산출물의 주인**을 읽는다: /flow/[id], /match/[id], 상담 메시지.
 * 그 셋은 `if (!profile) notFound()` 라, getProfile 을 쓰면 프로필을 지운 순간
 * 돈 주고 산 리포트가 404 가 된다.
 *
 * 새로 무언가를 여는 자리에서는 절대 쓰지 않는다 — 지워진 사람으로 이용권이
 * 나가면 안 된다. 그 자리는 getProfile 이다.
 *
 * user_id 조건은 getProfile 과 같은 이유로 남는다: profiles.id 는 순번 bigint 라
 * URL 에 노출되고, id 만으로 찾으면 남의 생년월일을 읽을 수 있다.
 */
export async function getProfileById(
  userId: string,
  id: string,
  client: SqlClient = sql,
): Promise<ProfileRow | null> {
  const rows = await client`
    SELECT p.*, (e.id IS NOT NULL) AS is_unlocked
    FROM profiles p
    LEFT JOIN entitlements e
      ON e.user_id = p.user_id
     AND e.feature = 'full_report'
     AND e.subject_key = p.id::text
    WHERE p.id = ${id}::bigint AND p.user_id = ${userId}::bigint
  `;
  const row = rows[0];
  return row ? toProfileRow(row) : null;
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

```bash
npx vitest run src/lib/profiles/store.test.ts
```

Expected: PASS

- [ ] **Step 5: 세 호출부를 바꾼다**

`src/app/flow/[id]/page.tsx` — import 와 호출을 `getProfileById` 로:

```tsx
  const [profile, user] = await Promise.all([
    // 지워진 프로필도 읽는다 — 이미 산 리포트가 삭제로 404 가 되면 안 된다.
    getProfileById(session.userId, flow.profileId),
    getUser(session.userId),
  ]);
```

`src/app/match/[id]/page.tsx`:

```tsx
  const [subject, counterpart, user] = await Promise.all([
    // 지워진 프로필도 읽는다 — 이미 본 궁합이 삭제로 404 가 되면 안 된다.
    getProfileById(session.userId, match.subjectProfileId),
    getProfileById(session.userId, match.counterpartProfileId),
    getUser(session.userId),
  ]);
```

`src/app/api/consultations/[id]/messages/route.ts`:

```ts
  // 지워진 프로필이어도 그 사람의 원국으로 이어간다 — 나눈 이력의 근거가
  // 중간에 다른 사람으로 바뀌면 안 된다. 계정에 프로필이 하나도 없을 때만
  // 물러선다.
  const profile =
    (consultation.profileId
      ? await getProfileById(session.userId, consultation.profileId)
      : null) ?? (await defaultConsultationSubject(session.userId));
```

- [ ] **Step 6: 전체 검증**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src
```

Expected: 전부 통과

- [ ] **Step 7: 커밋**

```bash
git add src/lib/profiles/store.ts src/lib/profiles/store.test.ts "src/app/flow/[id]/page.tsx" "src/app/match/[id]/page.tsx" "src/app/api/consultations/[id]/messages/route.ts"
git commit -m "$(cat <<'EOF'
feat(profiles): 산 리포트는 지워진 프로필로도 열리게 한다

getProfileById 를 더해 /flow/[id] · /match/[id] · 상담 메시지 셋만 쓴다.
새로 여는 자리는 getProfile 그대로라 지워진 사람으로 이용권이 나가지 않는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: maps 에 profile_id — 컬럼 · 백필 · 유니크 교체

**Files:**
- Create: `migrations/0052_maps_profile.sql`
- Create: `migrations/0053_maps_profile_backfill.sql`
- Create: `migrations/0054_drop_maps_owner_idx.sql`
- Create: `migrations/0055_maps_profile_unique.sql`

**Interfaces:**
- Consumes: Task 1 의 `profiles.deleted_at`(없어도 되지만 순서상 뒤)
- Produces: `maps.profile_id bigint NULL REFERENCES profiles(id) ON DELETE CASCADE`, 유니크 인덱스 `maps_profile ON maps(profile_id)`. Task 6 이 `ON CONFLICT (profile_id)` 로 이것을 겨냥한다.

⚠️ **Task 6 과 함께 배포돼야 한다.** `maps_owner_user` 가 사라지는 순간 `createMap` 의 `ON CONFLICT (owner_user_id)` 는 없는 인덱스를 겨냥한다.

- [ ] **Step 1: 컬럼**

`migrations/0052_maps_profile.sql`:

```sql
-- 관계 지도를 계정당 하나에서 프로필당 하나로 옮긴다.
--
-- owner_user_id 는 남긴다. 지도에 올라온 사람을 지울 권한이 소유자에게만 있고
-- (api/maps/[share]/people/[id]), 그 검사는 프로필이 아니라 계정으로 한다 —
-- 프로필을 거쳐 계정을 찾는 조인을 매 요청에 더할 이유가 없다.
--
-- ON DELETE CASCADE 가 평소에 도는 일은 없다. 프로필 삭제가 소프트 삭제로
-- 바뀌었으므로(0050), 이 CASCADE 는 유예 기간이 지난 행을 치울 때만 돈다 —
-- 그때는 그 프로필의 지도도 같이 사라지는 것이 맞다.
--
-- NULL 을 허용하는 이유는 백필(0053)이 primary_profile_id 가 없는 계정의
-- 지도를 채울 수 없기 때문이다. 그 행은 공유 링크로는 계속 열리고(/map/[share]
-- 는 share_id 로만 찾는다) /map 진입에서만 안 잡힌다.
ALTER TABLE maps ADD COLUMN IF NOT EXISTS profile_id bigint REFERENCES profiles(id) ON DELETE CASCADE
```

- [ ] **Step 2: 백필**

`migrations/0053_maps_profile_backfill.sql`:

```sql
-- 이미 있는 지도를 그 계정의 "나"(users.primary_profile_id)에 붙인다.
-- primary 가 없는 계정의 지도는 NULL 로 남는다 — 0055 의 유니크 인덱스는
-- Postgres 가 NULL 을 서로 다른 값으로 보므로 그 행이 여럿이어도 막지 않는다.
UPDATE maps m
   SET profile_id = u.primary_profile_id
  FROM users u
 WHERE u.id = m.owner_user_id
   AND m.profile_id IS NULL
   AND u.primary_profile_id IS NOT NULL
```

- [ ] **Step 3: 옛 유니크 인덱스 제거**

`migrations/0054_drop_maps_owner_idx.sql`:

```sql
-- 계정당 하나를 박던 인덱스. 프로필당 하나(0055)로 옮긴다.
-- createMap 의 ON CONFLICT 대상이 여기서 저쪽으로 바뀌므로, store.ts 변경과
-- 같은 배포에 들어가야 한다.
DROP INDEX IF EXISTS maps_owner_user
```

- [ ] **Step 4: 새 유니크 인덱스**

`migrations/0055_maps_profile_unique.sql`:

```sql
-- 프로필당 지도 하나. flows_unique 가 user_id 를 뺀 것과 같은 이유로 여기도
-- owner_user_id 를 넣지 않는다 — 프로필이 이미 한 사용자에 속하므로, 넣으면
-- 같은 프로필의 지도가 사용자별로 여럿인 상태가 표현 가능해져 유니크가 뜻을 잃는다.
CREATE UNIQUE INDEX IF NOT EXISTS maps_profile ON maps(profile_id)
```

- [ ] **Step 5: 개발 DB 에 적용하고 결과를 확인한다**

```bash
npm run db:migrate
```

Expected: `0052`~`0055` 네 줄이 applying 으로 찍히고 에러가 없다.

- [ ] **Step 6: 백필 결과를 눈으로 본다**

`scripts/_tmp-check.mts` 를 만들어 돌리고 지운다:

```ts
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!);
console.log(JSON.stringify(await sql`
  SELECT m.id, m.owner_user_id, m.profile_id, m.center_name,
         (SELECT count(*)::int FROM map_people p WHERE p.map_id = m.id) AS people
  FROM maps m ORDER BY m.id`));
```

```bash
npx tsx --env-file=.env.local scripts/_tmp-check.mts; rm -f scripts/_tmp-check.mts
```

Expected: 지도 1번이 `profile_id: "2"`(김동진), `people: 24`. 설계 문서 부록과 같다.

같은 스크립트에 한 줄을 더해 NULL 행이 유니크를 안 깨는지도 본다 — 개발 DB 에는 지금 NULL 행이 안 생기지만(계정 1 의 primary 가 2 다), 운영에는 생길 수 있다:

```ts
console.log("null profile_id:", JSON.stringify(await sql`
  SELECT count(*)::int AS n FROM maps WHERE profile_id IS NULL`));
```

Expected: `n: 0`. 0 이 아니면 그 행들이 공유 링크로 열리는지 직접 확인한다 — `/map/<share_id>` 는 `share_id` 로만 찾으므로 열려야 한다.

- [ ] **Step 7: 커밋**

```bash
git add migrations/0052_maps_profile.sql migrations/0053_maps_profile_backfill.sql migrations/0054_drop_maps_owner_idx.sql migrations/0055_maps_profile_unique.sql
git commit -m "$(cat <<'EOF'
feat(map): 지도의 유니크 키를 계정에서 프로필로 옮긴다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: maps store — getMapByProfile · createMap(profileId)

**Files:**
- Modify: `src/lib/maps/types.ts` (`MapRow` 에 `profileId`)
- Modify: `src/lib/maps/store.ts` (`toMapRow`, `getMapByOwner` → `getMapByProfile`, `createMap`)
- Test: `src/lib/maps/store.test.ts`

**Interfaces:**
- Consumes: Task 5 의 `maps.profile_id`, 인덱스 `maps_profile`
- Produces:
  - `MapRow.profileId: string | null`
  - `getMapByProfile(profileId: string, client?: SqlClient): Promise<MapRow | null>`
  - `createMap(userId: string, profileId: string, center: BirthLite & { name: string }, client?: SqlClient): Promise<MapRow>`
  - `getMapByOwner` 는 **없어진다.** 유일한 호출부가 `src/app/map/page.tsx` 이고 Task 7 이 그것을 고친다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/maps/store.test.ts` 의 `mapDbRow` 에 `profile_id: 5` 를 더하고, `describe("toMapRow")` 의 기대값에 `profileId: "5"` 를 더한 뒤 아래를 추가한다. import 줄에서 `createMap` 옆에 `getMapByProfile` 을 더한다:

```ts
describe("getMapByProfile", () => {
  it("프로필로 찾는다", async () => {
    const { client, calls } = fakeClient([mapDbRow]);
    const row = await getMapByProfile("5", client);

    expect(row?.id).toBe("7");
    expect(calls[0].sql).toContain("profile_id =");
    expect(calls[0].values).toEqual(["5"]);
  });

  it("없으면 null", async () => {
    const { client } = fakeClient([]);
    expect(await getMapByProfile("5", client)).toBeNull();
  });
});

describe("createMap", () => {
  // /map 진입이 GET 이라 멱등해야 한다. 흔한 경로는 "이미 있는 지도" 이므로
  // 먼저 읽고, 있으면 INSERT 를 아예 안 보낸다.
  it("이미 있으면 그것을 돌려주고 INSERT 를 보내지 않는다", async () => {
    const { client, calls } = fakeClient([mapDbRow]);
    const row = await createMap("3", "5", { name: "김동진", year: 1990, month: 10, day: 25, calendar: "solar", isLeapMonth: false }, client);

    expect(row.id).toBe("7");
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).not.toContain("INSERT");
  });

  // 유니크가 profile_id 로 옮겨졌다(0055). owner_user_id 를 겨냥하면 없는
  // 인덱스를 가리켜 런타임에 터진다.
  it("ON CONFLICT 가 profile_id 를 겨냥한다", async () => {
    const { client, calls } = fakeClient([], [], [mapDbRow]);
    await createMap("3", "5", { name: "김동진", year: 1990, month: 10, day: 25, calendar: "solar", isLeapMonth: false }, client);

    expect(calls[1].sql).toContain("INSERT INTO maps");
    expect(calls[1].sql).toContain("ON CONFLICT (profile_id)");
    expect(calls[1].values).toContain("5");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

```bash
npx vitest run src/lib/maps/store.test.ts
```

Expected: FAIL — `getMapByProfile is not a function`

- [ ] **Step 3: 구현한다**

`src/lib/maps/types.ts` 의 `MapRow` 에:

```ts
  /** 이 지도의 주인 프로필. 백필이 못 채운 옛 행은 null — /map 진입에서 안 잡히고
   *  공유 링크로만 열린다. */
  profileId: string | null;
```

`src/lib/maps/store.ts` 의 `toMapRow` 반환값에:

```ts
    profileId: r.profile_id == null ? null : String(r.profile_id),
```

`getMapByOwner` 를 아래로 **교체**한다:

```ts
/**
 * 프로필의 지도. 계정이 아니라 프로필이 소유 단위다(설계 §2) — 홈에서 사람을
 * 바꾸면 지도도 바뀌어야 한다.
 *
 * owner_user_id 로 찾지 않는 이유가 그것이고, 조건에 함께 걸지도 않는다:
 * maps_profile 유니크가 프로필당 한 행을 보장하고 프로필은 이미 한 사용자에
 * 속하므로, 계정 조건은 같은 사실을 두 번 묻는 것이다.
 */
export async function getMapByProfile(
  profileId: string,
  client: SqlClient = sql,
): Promise<MapRow | null> {
  const rows = await client`SELECT * FROM maps WHERE profile_id = ${profileId}::bigint`;
  const row = rows[0];
  return row ? toMapRow(row) : null;
}
```

`createMap` 을 바꾼다 — 기존 docstring 은 그대로 두고 시그니처와 본문만:

```ts
export async function createMap(
  userId: string,
  profileId: string,
  center: BirthLite & { name: string },
  client: SqlClient = sql,
): Promise<MapRow> {
  const existing = await getMapByProfile(profileId, client);
  if (existing) return existing;

  const shareId = crypto.randomUUID();
  await client`
    INSERT INTO maps (
      share_id, owner_user_id, profile_id, center_name,
      center_calendar, center_is_leap_month,
      center_birth_year, center_birth_month, center_birth_day
    ) VALUES (
      ${shareId}, ${userId}::bigint, ${profileId}::bigint, ${center.name},
      ${center.calendar}, ${center.isLeapMonth},
      ${center.year}, ${center.month}, ${center.day}
    )
    ON CONFLICT (profile_id) DO NOTHING
  `;

  // 동시 요청이 먼저 넣었으면 위 INSERT 가 아무 일도 하지 않는다 — 그때도 여기서
  // 그 행을 읽어 온다. 이것이 이 함수가 멱등한 방식이다.
  const row = await getMapByProfile(profileId, client);
  if (!row) throw new Error("createMap: 삽입 후에도 지도를 찾지 못했다");
  return row;
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

```bash
npx vitest run src/lib/maps/store.test.ts
```

Expected: PASS. `npx tsc --noEmit` 은 아직 **실패한다** — `src/app/map/page.tsx` 가 사라진 `getMapByOwner` 를 import 한다. Task 7 이 고친다.

- [ ] **Step 5: 커밋 (Task 7 과 묶어 커밋하므로 여기서는 안 한다)**

타입 검사가 깨진 상태라 커밋하지 않는다. Task 7 의 마지막 커밋에 함께 들어간다.

---

### Task 7: /map 진입이 프로필을 고른다

**Files:**
- Create: `src/app/map/_lib/pick-map-profile.ts`
- Create: `src/app/map/_lib/pick-map-profile.test.ts`
- Modify: `src/app/map/page.tsx`

**Interfaces:**
- Consumes: Task 6 의 `getMapByProfile`·`createMap(userId, profileId, center)`, 기존 `pickMapCenter`(`src/app/map/_lib/to-map-people.ts:82`), 기존 `parseProfileParam`(`src/lib/profiles/param.ts`)
- Produces: `pickMapProfile<T extends { id: string }>(opts): T | null` — 순수 함수다. 페이지가 테스트되지 않으므로 고르는 규칙만 떼어 여기서 잠근다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/map/_lib/pick-map-profile.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickMapProfile } from "./pick-map-profile";

// 일주가 서는 생년월일(만세력 1900~2050 안)과 안 서는 것(2200년).
const ok = (id: string) => ({ id, birth: { year: 1990, month: 10, day: 25 }, calendar: "solar" as const, isLeapMonth: false });
const bad = (id: string) => ({ id, birth: { year: 2200, month: 1, day: 1 }, calendar: "solar" as const, isLeapMonth: false });
const toBirth = (p: ReturnType<typeof ok>) => ({ ...p.birth, calendar: p.calendar, isLeapMonth: p.isLeapMonth });

describe("pickMapProfile", () => {
  it("요청한 id 가 목록에 있으면 그것을 고른다", () => {
    const list = [ok("7"), ok("2")];
    expect(pickMapProfile({ asked: "7", primaryId: "2", profiles: list, toBirth })?.id).toBe("7");
  });

  // 남의 프로필, temp 프로필, 지워진 프로필은 전부 listProfiles 결과에 없다 —
  // 세 경우가 여기서 한 갈래로 합쳐진다. 404 로 끊지 않고 내 지도로 보낸다.
  it("요청한 id 가 목록에 없으면 primary 로 떨어진다", () => {
    const list = [ok("7"), ok("2")];
    expect(pickMapProfile({ asked: "999", primaryId: "2", profiles: list, toBirth })?.id).toBe("2");
  });

  it("asked 가 없으면 primary", () => {
    const list = [ok("7"), ok("2")];
    expect(pickMapProfile({ asked: null, primaryId: "2", profiles: list, toBirth })?.id).toBe("2");
  });

  // primary 의 생년월일로 일주가 안 서면 지도를 세울 수 없다. 영구 404 가 되는
  // 지도를 만들어 두면 되돌릴 방법이 없으므로, 중심이 실제로 서는 프로필로 간다.
  it("primary 의 중심이 안 서면 중심이 서는 프로필로 물러선다", () => {
    const list = [ok("7"), bad("2")];
    expect(pickMapProfile({ asked: null, primaryId: "2", profiles: list, toBirth })?.id).toBe("7");
  });

  // listProfiles 는 최신순이라 가장 오래된 것이 마지막이다. 퍼널을 처음 끝냈을 때
  // 만들어진 것이 그 계정의 첫 프로필이고, 그게 나일 확률이 가장 높다.
  it("물러설 때는 가장 오래된 것부터 본다", () => {
    const list = [ok("9"), ok("7")];
    expect(pickMapProfile({ asked: null, primaryId: null, profiles: list, toBirth })?.id).toBe("7");
  });

  it("하나도 중심이 안 서면 null", () => {
    expect(pickMapProfile({ asked: null, primaryId: null, profiles: [bad("2")], toBirth })).toBeNull();
  });

  it("목록이 비면 null", () => {
    expect(pickMapProfile({ asked: null, primaryId: null, profiles: [], toBirth })).toBeNull();
  });

  // 요청한 id 의 중심이 안 서면 그 프로필로는 지도를 만들 수 없다 — primary 로 간다.
  it("요청한 id 의 중심이 안 서면 primary 로 떨어진다", () => {
    const list = [bad("7"), ok("2")];
    expect(pickMapProfile({ asked: "7", primaryId: "2", profiles: list, toBirth })?.id).toBe("2");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

```bash
npx vitest run src/app/map/_lib/pick-map-profile.test.ts
```

Expected: FAIL — `Cannot find module './pick-map-profile'`

- [ ] **Step 3: 구현한다**

`src/app/map/_lib/pick-map-profile.ts`:

```ts
import type { BirthLite } from "@/lib/maps/types";
import { pickMapCenter } from "./to-map-people";

/**
 * 어느 프로필의 지도를 열 것인가.
 *
 * 페이지(`map/page.tsx`)가 아니라 여기 있는 이유는 테스트다 — 라우트 컴포넌트는
 * 세션·DB 를 끌고 와서 단위 테스트가 안 되는데, 고르는 규칙 자체는 순수하다.
 *
 * 세 번 물러선다: 요청한 프로필 → primary → 중심이 서는 가장 오래된 프로필.
 * 어느 단계든 **중심이 실제로 서는지**(일주가 세워지는지)를 함께 본다. 중심이
 * 안 서는 프로필로 지도를 만들면 /map/[share] 가 영구 404 가 되고, 그 뒤로는
 * 지도가 이미 있으므로 다시 들어와도 같은 404 다 — 지도를 고치거나 지우는 길이
 * 아직 없어서 DB 를 손으로 지워야 풀린다.
 *
 * `profiles` 는 listProfiles 의 결과, 즉 **홈에서 고를 수 있는 사람들**이다
 * (kind='saved' 이고 안 지워진 것). 남의 id·temp·지워진 id 가 asked 로 와도
 * 목록에 없으므로 한 갈래로 합쳐져 primary 로 떨어진다.
 *
 * ⚠️ 입력은 **최신순**이다(listProfiles 의 ORDER BY created_at DESC). 그래서
 * 가장 오래된 것은 배열의 끝이고, pickMapCenter 가 뒤에서부터 훑는다.
 */
export function pickMapProfile<T extends { id: string }>({
  asked,
  primaryId,
  profiles,
  toBirth,
}: {
  /** ?profile 로 들어온 id. 없거나 형식이 틀리면 null */
  asked: string | null;
  /** users.primary_profile_id */
  primaryId: string | null;
  /** listProfiles 결과 — 최신순 */
  profiles: readonly T[];
  toBirth: (p: T) => BirthLite;
}): T | null {
  const wanted = asked === null ? [] : profiles.filter((p) => p.id === asked);
  const primary = primaryId === null ? [] : profiles.filter((p) => p.id === primaryId);
  return (
    pickMapCenter(wanted, toBirth) ??
    pickMapCenter(primary, toBirth) ??
    pickMapCenter(profiles, toBirth)
  );
}
```

- [ ] **Step 4: 테스트가 통과하는지 본다**

```bash
npx vitest run src/app/map/_lib/pick-map-profile.test.ts
```

Expected: PASS

- [ ] **Step 5: 페이지를 배선한다**

`src/app/map/page.tsx` 를 통째로 바꾼다:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profiles/store";
import { getUser } from "@/lib/auth/users";
import { parseProfileParam, type SearchParams } from "@/lib/profiles/param";
import { createMap, getMapByProfile } from "@/lib/maps/store";
import { pickMapProfile } from "./_lib/pick-map-profile";

/**
 * 내 지도로 보내는 문. 렌더하는 것이 없다.
 *
 * GET 이 행을 만드는 것이 걸리지만, maps_profile 유니크 인덱스와 createMap 의
 * 읽기-삽입-읽기 덕에 멱등하다. 새로고침해도 지도가 늘지 않는다.
 *
 * 지도는 프로필을 만들 때가 아니라 **여기 들어올 때** 생긴다. 프로필 20개를
 * 저장했다고 빈 지도 20개와 쓰이지 않을 공유 링크 20개를 미리 만들어 둘 이유가
 * 없고, 그중에는 중심이 안 서는 것도 섞인다.
 */
export default async function MapEntryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login?next=/map");

  // 프로필을 먼저 확정하고 그 다음에 지도를 찾는다. 예전에는 getMapByOwner 가
  // 맨 앞에 있어 프로필을 아예 안 보고 끝났고, 그래서 홈에서 사람을 바꿔도
  // 같은 지도가 열렸다.
  const [profiles, user, sp] = await Promise.all([
    listProfiles(session.userId),
    getUser(session.userId),
    searchParams,
  ]);

  // invalid 를 absent 와 같이 다룬다 — 지도는 리포트와 달리 "남의 것을 보고
  // 있다" 는 오해가 생길 화면이 아니라, 404 로 끊는 것보다 내 지도로 보내는
  // 편이 낫다.
  const param = parseProfileParam(sp);
  const mine = pickMapProfile({
    asked: param.kind === "id" ? param.id : null,
    primaryId: user?.primaryProfileId ?? null,
    profiles,
    toBirth: (p) => ({
      year: p.birth.year,
      month: p.birth.month,
      day: p.birth.day,
      calendar: p.calendar,
      isLeapMonth: p.isLeapMonth,
    }),
  });

  // 하나도 중심이 안 서면 프로필이 아예 없는 것과 같은 상황이다 — 여기 있는
  // 것으로는 지도를 세울 수 없다. 그러니 같은 곳으로 보낸다.
  if (!mine) redirect("/funnel?step=name");

  const existing = await getMapByProfile(mine.id);
  if (existing) redirect(`/map/${existing.shareId}`);

  const map = await createMap(session.userId, mine.id, {
    name: mine.name,
    year: mine.birth.year,
    month: mine.birth.month,
    day: mine.birth.day,
    calendar: mine.calendar,
    isLeapMonth: mine.isLeapMonth,
  });

  redirect(`/map/${map.shareId}`);
}
```

- [ ] **Step 6: 전체 검증**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src
```

Expected: 전부 통과. Task 6 에서 깨져 있던 타입 검사가 여기서 풀린다.

- [ ] **Step 7: 브라우저로 확인한다**

`preview_start` 로 `saju-dev` 를 띄우고:

1. `/map` → 김동진 지도(사람 24명)
2. `/map?profile=7` → 백상현 지도, 비어 있음, share_id 가 1번과 다르다
3. `/map?profile=6` → 곽희경은 `temp` 라 목록에 없다 → 김동진 지도로 떨어진다
4. `/map?profile=999` → 김동진 지도로 떨어진다
5. 1번을 새로고침 → share_id 가 안 바뀐다(멱등)

Step 6 의 쿼리를 다시 돌려 지도가 둘이 되었고 각각 다른 `profile_id` 를 갖는지 본다.

- [ ] **Step 8: 커밋 (Task 6 과 함께)**

```bash
git add src/lib/maps/types.ts src/lib/maps/store.ts src/lib/maps/store.test.ts src/app/map/_lib/pick-map-profile.ts src/app/map/_lib/pick-map-profile.test.ts src/app/map/page.tsx
git commit -m "$(cat <<'EOF'
feat(map): 지도를 프로필당 하나로 만든다

/map 이 프로필을 먼저 확정하고 그 프로필의 지도를 찾는다. 홈에서 고를 수 있는
프로필(saved, 안 지워진 것)만 지도를 갖고, 지도는 들어올 때 만들어진다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 상담 목록을 프로필로 거른다

**Files:**
- Modify: `src/lib/consultations/store.ts:142` (`listConsultations`)
- Modify: `src/app/consult/page.tsx`
- Test: `src/lib/consultations/store.test.ts`

**Interfaces:**
- Consumes: 없음 — `consultations.profile_id` 는 0012 부터 있다
- Produces: `listConsultations(userId: string, profileId: string, client?: SqlClient): Promise<ConsultationListItem[]>`

- [ ] **Step 1: 기존 호출 셋을 고치고 새 테스트를 쓴다**

`src/lib/consultations/store.test.ts:123` 의 `describe("listConsultations")` 안에 이미 호출이 셋 있다(`:128`, `:135`, `:141`). 전부 `listConsultations("3", client)` 라 인자가 하나 늘면 `client` 가 `profileId` 자리에 들어간다. 셋을 `listConsultations("3", "12", client)` 로 바꾼다 — `12` 는 같은 파일의 `dbConsultation.profile_id` 값이다.

그 describe 블록 끝에 둘을 더한다:

```ts
  // 프로필을 바꿔도 같은 목록이 서던 것이 이 변경의 이유다.
  it("프로필로 거른다", async () => {
    const { client, calls } = fakeClient([]);
    await listConsultations("3", "12", client);

    expect(calls[0].sql).toContain("c.profile_id =");
    expect(calls[0].values).toEqual(["3", "12"]);
  });

  // profile_id 는 NULL 일 수 있다(옛 행, 그리고 0012 의 ON DELETE SET NULL 이
  // 돈 행). 조건을 profile_id 하나로만 걸면 그 틈으로 남의 행이 섞인다.
  it("user_id 조건을 함께 남긴다", async () => {
    const { client, calls } = fakeClient([]);
    await listConsultations("3", "12", client);

    expect(calls[0].sql).toContain("c.user_id =");
  });
```

- [ ] **Step 2: 테스트가 실패하는지 본다**

```bash
npx vitest run src/lib/consultations/store.test.ts
```

Expected: FAIL — `expected [ '3' ] to deeply equal [ '3', '12' ]`

- [ ] **Step 3: 구현한다**

`src/lib/consultations/store.ts` 의 `listConsultations`:

```ts
/**
 * 한 프로필의 상담 목록.
 *
 * profileId 를 받는 이유: 예전에는 user_id 로만 걸러, 홈에서 사람을 바꿔도 계정의
 * 모든 상담이 한 줄에 섰다. 상담은 그 사람의 원국을 근거로 하는 대화라 사람이
 * 바뀌면 목록도 바뀌어야 한다.
 *
 * user_id 조건을 빼지 않는다 — profile_id 는 NULL 일 수 있고(옛 행, 그리고 0012 의
 * ON DELETE SET NULL 이 돈 행) 조건이 하나면 그 틈으로 남의 행이 섞인다. 두 조건을
 * 다 걸면 NULL 인 행은 어느 목록에도 서지 않는다.
 */
export async function listConsultations(
  userId: string,
  profileId: string,
  client: SqlClient = sql,
): Promise<ConsultationListItem[]> {
  const rows = await client`
    SELECT c.*, (
      SELECT m.bubbles FROM consultation_messages m
      WHERE m.consultation_id = c.id AND m.role = 'counselor'
      ORDER BY m.id DESC LIMIT 1
    ) AS last_bubbles
    FROM consultations c
    WHERE c.user_id = ${userId}::bigint
      AND c.profile_id = ${profileId}::bigint
      -- 이용권이 안 쓰였고 한 턴도 안 나눈 행은 아무도 값을 치르지 않았고 아무도
      -- 쓰지 않은 죽은 행이다. "아직 시작하지 않은 상담"으로 보여주면 클릭해도
      -- ConsultationClosedError 만 돌아오는 막다른 길로 사용자를 보내는 셈이다.
      AND NOT (c.ticket_spent = false AND c.turns_used = 0)
    ORDER BY (c.status = 'open') DESC, c.created_at DESC
  `;
```

(아래 `return rows.map(...)` 는 그대로.)

- [ ] **Step 4: 테스트가 통과하는지 본다**

```bash
npx vitest run src/lib/consultations/store.test.ts
```

Expected: PASS

- [ ] **Step 5: /consult 를 배선한다**

`src/app/consult/page.tsx` 에서 `listConsultations` 호출이 `profileId` 계산보다 **아래**에 있어야 한다. 지금 `Promise.all` 안에 있으므로 그 배열에서 빼내 뒤로 옮긴다:

```tsx
  const people = profiles.map(toPersonOption);
  const profileId = people.some((p) => p.id === asked) ? asked : people[0].id;

  // listConsultations 가 profileId 를 받으므로 위 계산 뒤여야 한다 — 화면이
  // 보여주는 사람과 목록이 같은 사람이어야 한다는 이 파일의 원칙 그대로다.
  const [rows, balance, user] = await Promise.all([
    listConsultations(session.userId, profileId),
    getBalance(session.userId),
    getUser(session.userId),
  ]);
```

- [ ] **Step 6: 전체 검증**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src
```

Expected: 전부 통과

- [ ] **Step 7: 브라우저로 확인한다**

`/consult` 와 `/consult?profile=7` 을 열어 목록이 다른지 본다. 개발 DB 의 상담 2건은 둘 다 `profile_id` 가 있으므로, 그 프로필에서만 보여야 한다.

- [ ] **Step 8: 커밋**

```bash
git add src/lib/consultations/store.ts src/lib/consultations/store.test.ts src/app/consult/page.tsx
git commit -m "$(cat <<'EOF'
feat(consult): 상담 목록을 프로필로 거른다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## 마지막 확인

- [ ] `npx vitest run` — 전부 통과
- [ ] `npx tsc --noEmit` — 깨끗
- [ ] `npx eslint src` — 깨끗
- [ ] `grep -rn "getMapByOwner\|maps_owner_user" src/ migrations/` — `migrations/0021`·`0054` 두 곳(역사)만 남는다
- [ ] 브라우저: 프로필 둘을 오가며 `/map` 과 `/consult` 가 각각 다른 것을 보여준다
- [ ] 설계 문서 §8 미결 2·3·4 는 이 계획의 범위가 아니다 — 그대로 남긴다
