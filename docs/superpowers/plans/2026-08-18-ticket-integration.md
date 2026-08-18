# 이용권 게이트 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** main 을 병합하고, main 이 비워 둔 세 자리(`ticket-port.ts`, `matches/access.ts`, `consult/page.tsx`)에 이용권을 끼워 궁합과 상담이 실제로 동작하게 한다.

**Architecture:** `tickets` 모듈은 어떤 기능도 모른 채로 남고, 각 기능이 자기 `feature` id 를 들고 `spendTicket` 을 부른다. 새로 만드는 `refundTicket` 은 차감의 정확한 역이며 같은 이유로 CTE 한 문장이다 — Neon HTTP 드라이버에 대화형 트랜잭션이 없어, 정확성을 앱 코드가 아니라 스키마 제약이 책임진다.

**Tech Stack:** Next.js 16 (App Router, 서버 컴포넌트), React 19, TypeScript, Neon serverless Postgres (HTTP 드라이버), Upstash Redis (한도), zod 4, Vitest 4.

**Spec:** `docs/superpowers/specs/2026-08-18-ticket-integration-design.md`

## Global Constraints

- **차감·적립·되돌리기는 각각 CTE 한 문장이다.** Neon HTTP 드라이버에는 대화형 트랜잭션이 없다. 여러 문장으로 쪼개면 그 사이에 프로세스가 죽었을 때 반쪽 상태가 남는다. 배경은 `docs/issues/db-transactions.md`.
- **단가는 서버 상수에서만 온다.** 요청 스키마에 cost 필드를 두지 않는다.
- **DB 컬럼 이름을 아는 곳은 store 모듈뿐이다.** 핸들러·화면은 도메인 타입만 본다.
- **bigint 컬럼은 JS 문자열로 접는다.** `Number` 로 받으면 큰 값에서 정밀도가 깨진다.
- **`src/lib/**` 은 `src/app/**` 을 import 하지 않는다.** 반대 방향만 허용한다.
- **`tickets` 는 `matches`·`consultations` 를 모른다.** 의존은 항상 기능 → tickets 방향이다.
- **주석은 한국어로, "왜"를 적는다.** 이 저장소의 기존 밀도와 어조를 따른다.
- 테스트: `npx vitest run <경로>`. 전체는 `npm test`. 타입 검사 `npm run typecheck`, 린트 `npm run lint`.
- 커밋 메시지는 한국어 본문에 `feat(...)`/`refactor(...)`/`fix(...)`/`docs(...)` 접두사.
- **DB 명령을 실행하지 않는다.** `.env.local` 이 살아있는 DB 를 가리킨다. 이 계획에는 새 마이그레이션이 없다.

---

## File Structure

**새로 만드는 것**

| 경로 | 책임 |
|---|---|
| `src/lib/tickets/refund.ts` | 되돌리기 CTE (SQL 소유) |
| `src/lib/tickets/refund.test.ts` | |
| `src/lib/matches/tickets.ts` | `MatchTicketsError` — 잔액 부족을 생성기 밖으로 던지는 신호 |
| `migrations/README.md` | 0012–0015 번호 중복의 내력 |

**바꾸는 것**

| 경로 | 무엇이 |
|---|---|
| `src/lib/profiles/store.ts` 외 5개 | 병합 충돌 해소 (Task 1) |
| `src/lib/tickets/features.ts` | `consultation` 추가, `pairKey` 삭제 |
| `src/app/api/tickets/spend/route.ts` | `ownsSubject` 에 `consultation` 케이스 |
| `src/lib/consultations/deps.ts` | `stubTicketPort` → 실구현 |
| `src/app/consult/page.tsx` | 잔액 칩을 켠다 |
| `src/lib/matches/access.ts` | 잔액 확인 추가 |
| `src/lib/matches/rate-limit.ts` | 한도 5 → 60 |
| `src/app/api/matches/_lib/gated-generator.ts` | 차감 래퍼 추가 |
| `src/app/match/[id]/page.tsx` | 잔액 부족 갈래 |

**지우는 것**

- `pairKey` 와 그 테스트 (`src/lib/tickets/features.ts`, `features.test.ts`)

---

## Task 1: main 병합

**Files:**
- Modify (충돌): `src/lib/profiles/store.ts`, `src/lib/profiles/store.test.ts`, `src/app/home/page.tsx`, `src/app/home/_lib/to-home-entry.test.ts`, `src/app/report/_lib/to-meta.test.ts`, `src/lib/profiles/to-birth-input.test.ts`
- Delete (충돌 해소로): `src/app/checkout/_lib/to-order.test.ts`
- Create: `migrations/README.md`

**Interfaces:**
- Consumes: 없음
- Produces: `ProfileRow` 에 `kind: ProfileKind` 와 `isUnlocked: boolean` 이 **둘 다** 있는 상태. `listProfiles(userId, kind, client?)`, `getProfile(userId, id, client?)`, `countProfiles(userId, kind, client?)`.

이 태스크는 병합 하나로 커밋 하나다. 반쯤 해소된 트리는 테스트할 수 없으므로 쪼개지 않는다.

- [ ] **Step 1: 병합을 시작한다**

```bash
git merge main
```

Expected: `CONFLICT` 6건. `git status` 로 목록을 확인한다.

- [ ] **Step 2: `src/lib/profiles/store.ts` 를 해소한다**

main 이 더한 것을 **전부 살린다**: `MAX_COUNTERPARTS`, `CounterpartLimitError`, `ProfileKind`, `ProfileRow.kind`, `listProfiles`/`countProfiles` 의 `kind` 파라미터, `createProfile` 의 `kind` 삽입.

우리가 바꾼 것도 **전부 살린다**: `isPaid` → `isUnlocked`, `purchases` 조인 → `entitlements` 조인.

`import { PRODUCT_FULL_REPORT } from "./products";` 는 지운다 — 그 파일은 우리 쪽에서 이미 삭제했다.

`ProfileRow` 의 최종 모양:

```ts
export interface ProfileRow {
  // ... 나머지 필드는 main 그대로 ...
  /** entitlements 조인에서 파생 — 이 프로필의 전체 리포트에 이용권을 쓴 적이 있으면 true. */
  isUnlocked: boolean;
  /** 'other' 는 궁합 상대로 들어온 사람이다. 홈·프로필 목록은 'self' 만 본다. */
  kind: ProfileKind;
}

export type CreateProfileInput = Omit<ProfileRow, "id" | "createdAt" | "isUnlocked">;
```

`toProfileRow` 의 마지막 두 줄:

```ts
    isUnlocked: r.is_unlocked === true,
    kind: r.kind === "other" ? "other" : "self",
```

`listProfiles` 의 두 갈래 SQL 은 조인만 갈아 끼운다 (`kind === "all"` 갈래와 그렇지 않은 갈래 모두):

```sql
    SELECT p.*, (e.id IS NOT NULL) AS is_unlocked
    FROM profiles p
    LEFT JOIN entitlements e
      ON e.user_id = p.user_id
     AND e.feature = 'full_report'
     AND e.subject_key = p.id::text
    WHERE p.user_id = ${userId}::bigint
```

`kind` 로 거르는 갈래는 `WHERE` 끝에 `AND p.kind = ${kind}` 가 붙는다.

`getProfile` 도 같은 조인으로 바꾸고 `WHERE p.id = ${id}::bigint AND p.user_id = ${userId}::bigint` 와 그 위의 ⚠️ 주석은 그대로 둔다.

`'full_report'` 를 리터럴로 적는 이유 주석(우리 쪽에서 쓴 것)을 한 벌만 남긴다 — main 병합 전 우리 코드에는 두 함수에 같은 블록이 중복돼 있었다. 이번에 한 곳으로 줄인다.

- [ ] **Step 3: 나머지 다섯 파일을 해소한다**

- `src/app/home/page.tsx` — main 의 `listProfiles(session.userId, "self")` 호출과 우리의 `getBalance` + 잔액 칩을 둘 다 살린다. `getBalance` 는 main 이 넓힌 `Promise.all` 안에 넣는다.
- `src/lib/profiles/store.test.ts` — 양쪽 단언을 둘 다 살린다. main 의 `kind` 필터 테스트와 우리의 `entitlements` 조인 테스트가 같이 있어야 한다.
- `src/app/home/_lib/to-home-entry.test.ts`, `src/app/report/_lib/to-meta.test.ts`, `src/lib/profiles/to-birth-input.test.ts` — `ProfileRow` 픽스처에 `isUnlocked: false` 와 `kind: "self"` 를 **둘 다** 넣는다.
- `src/app/checkout/_lib/to-order.test.ts` — **삭제한다.** main 이 픽스처를 수정했지만 그 테스트가 검사하던 `to-order.ts` 는 우리 쪽에서 이미 지웠다.

```bash
git rm src/app/checkout/_lib/to-order.test.ts
```

- [ ] **Step 4: `migrations/README.md` 를 만든다**

```markdown
# 마이그레이션

`scripts/migrate.mts` 가 `migrations/*.sql` 을 **파일명 순서로** 실행하고, 적용 여부를
`schema_migrations` 에 파일명으로 기록한다. 파일 하나에 SQL 문장은 하나만 담는다 —
Neon HTTP 드라이버가 한 쿼리에 문장을 여러 개 담는 것을 거부한다.

## 0012–0015 번호가 겹친다

이용권 시스템과 궁합 기능이 병렬로 개발되면서 두 브랜치가 같은 번호를 썼다.

| 번호 | 궁합 쪽 | 이용권 쪽 |
| --- | --- | --- |
| 0012 | `profiles_kind` | `ticket_wallets` |
| 0013 | `matches` | `entitlements` |
| 0014 | `matches_unique` | `entitlements_unique` |
| 0015 | `match_sections` | `ticket_entries` |

**이름을 바꾸지 않는다.** `schema_migrations` 가 파일명으로 추적하므로 개명하면 이미
적용된 마이그레이션이 미적용으로 보여 재실행되거나 추적이 깨진다. 서로 다른 테이블을
건드리므로 파일명 정렬 순서로 실행해도 의존 관계가 어긋나지 않는다.

**다음 번호는 0020 부터다.**
```

- [ ] **Step 5: 전체 테스트**

```bash
npm test
```

Expected: 전부 PASS. 실패하면 그 테스트가 가리키는 파일의 충돌 해소가 덜 된 것이다.

- [ ] **Step 6: 타입 검사와 린트**

```bash
npm run typecheck
```

Expected: 에러 0.

```bash
npm run lint
```

Expected: 에러 0. (`ReviewStep.tsx` 의 경고 2건은 이 브랜치 이전부터 있던 것이다.)

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "merge: main 의 궁합·상담과 이용권 시스템을 합친다"
```

---

## Task 2: refundTicket

**Files:**
- Create: `src/lib/tickets/refund.ts`
- Test: `src/lib/tickets/refund.test.ts`

**Interfaces:**
- Consumes: `Feature` (`@/lib/tickets/features`), `SqlClient` (`@/lib/db`)
- Produces:
  - `type RefundResult = { ok: true; kind: "refunded"; balance: number } | { ok: true; kind: "nothing_to_refund"; balance: number }`
  - `refundTicket(a: { userId: string; feature: Feature; subjectKey: string }, client?: SqlClient): Promise<RefundResult>`

**TDD 필수.** 실패하는 테스트 먼저, RED 확인, 구현, GREEN 확인.

이 테스트는 DB 를 치지 않는다. `src/lib/tickets/spend.test.ts` 의 가짜 태그드 템플릿 클라이언트와 같은 모양이다 — 먼저 그 파일을 읽고 패턴을 맞춘다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/tickets/refund.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { SqlClient } from "@/lib/db";
import { refundTicket } from "./refund";

function fakeClient(...responses: Record<string, unknown>[][]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(responses[i++] ?? []);
  };
  return { client, calls };
}

const input = { userId: "7", feature: "consultation" as const, subjectKey: "42" };

describe("refundTicket", () => {
  it("권한이 지워지면 refunded 와 복구된 잔액", async () => {
    const { client, calls } = fakeClient([{ revoked_id: 11, balance: 3 }]);
    expect(await refundTicket(input, client)).toEqual({
      ok: true,
      kind: "refunded",
      balance: 3,
    });
    // 한 문장이어야 한다 — 나뉘면 권한 삭제와 잔액 복구 사이에 프로세스가 죽을 틈이 생긴다.
    expect(calls).toHaveLength(1);
  });

  it("되돌릴 권한이 없으면 nothing_to_refund — 실패가 아니다", async () => {
    const { client } = fakeClient([{ revoked_id: null, balance: 2 }]);
    expect(await refundTicket(input, client)).toEqual({
      ok: true,
      kind: "nothing_to_refund",
      balance: 2,
    });
  });

  it("지갑 행이 없으면 잔액 0 으로 접는다", async () => {
    const { client } = fakeClient([{ revoked_id: null, balance: null }]);
    expect(await refundTicket(input, client)).toEqual({
      ok: true,
      kind: "nothing_to_refund",
      balance: 0,
    });
  });

  it("DELETE ... RETURNING 이 멱등 키다 — 두 번째 호출은 지울 행이 없어 잔액이 오르지 않는다", async () => {
    const { client, calls } = fakeClient([{ revoked_id: 11, balance: 3 }]);
    await refundTicket(input, client);
    const { sql } = calls[0];
    expect(sql).toContain("DELETE FROM entitlements");
    expect(sql).toContain("RETURNING id, cost");
    // 이 EXISTS 가 없으면 되돌릴 것이 없어도 잔액이 오른다.
    expect(sql).toContain("EXISTS (SELECT 1 FROM revoked)");
  });

  it("되돌리는 장수는 지워진 행의 cost 에서 온다 — 바인딩 값이 아니다", async () => {
    const { client, calls } = fakeClient([{ revoked_id: 11, balance: 3 }]);
    await refundTicket(input, client);
    // 가격표가 바뀌어도 "이때 몇 장을 냈는가"는 그 행이 안다.
    expect(calls[0].sql).toContain("(SELECT cost FROM revoked)");
    // 바인딩되는 값은 사용자·feature·대상 셋뿐이다. 장수가 인자로 들어오면 안 된다.
    expect(calls[0].values).toEqual(["7", "consultation", "42", "7", "7"]);
  });

  it("원장에 양수 delta 와 reason='refund' 를 남긴다", async () => {
    const { client, calls } = fakeClient([{ revoked_id: 11, balance: 3 }]);
    await refundTicket(input, client);
    expect(calls[0].sql).toContain("INSERT INTO ticket_entries");
    expect(calls[0].sql).toContain("'refund'");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/lib/tickets/refund.test.ts
```

Expected: FAIL — `Failed to resolve import "./refund"`.

- [ ] **Step 3: `src/lib/tickets/refund.ts` 를 만든다**

```ts
import { sql as neonSql, type SqlClient } from "@/lib/db";
import type { Feature } from "./features";

const sql = neonSql as unknown as SqlClient;

export type RefundResult =
  | { ok: true; kind: "refunded"; balance: number }
  | { ok: true; kind: "nothing_to_refund"; balance: number };

interface RefundInput {
  userId: string;
  feature: Feature;
  subjectKey: string;
}

/**
 * 차감을 되돌린다. spendTicket 의 정확한 역이다.
 *
 * ⚠️ CTE 한 문장인 이유는 차감과 같다 — Neon HTTP 드라이버에 대화형 트랜잭션이 없어,
 * 권한 삭제와 잔액 복구를 두 문장으로 나누면 그 사이에 프로세스가 죽었을 때
 * "권한은 사라졌는데 돈은 안 돌아온" 상태가 남는다.
 *
 * 멱등성은 DELETE ... RETURNING 이 준다. 두 번 불러도 두 번째는 지울 행이 없어
 * revoked 가 비고, EXISTS 가 거짓이라 잔액이 오르지 않는다 —
 * 차감의 ON CONFLICT DO NOTHING 과 정확히 대칭이다.
 *
 * 되돌리는 장수를 FEATURE_COST 가 아니라 지워진 행의 cost 에서 읽는 이유:
 * 가격표는 바뀌지만 "이때 몇 장을 냈는가"는 사실이다. 단가가 오른 뒤 옛 건을
 * 되돌리면서 현재 가격표를 쓰면 더 많이 돌려주게 된다.
 *
 * 원장의 entitlement_id 는 NULL 이다 — 참조하려던 행을 방금 지웠다.
 * reason='refund' 와 양수 delta 가 그 자체로 식별자다.
 *
 * ok: false 갈래가 없다. 없는 권한을 되돌리는 것은 실패가 아니라 이미 되돌아간
 * 상태이고, 호출자가 원하던 결과다. 실제 장애는 예외로 나간다.
 */
export async function refundTicket(
  a: RefundInput,
  client: SqlClient = sql,
): Promise<RefundResult> {
  const rows = await client`
    WITH revoked AS (
      DELETE FROM entitlements
       WHERE user_id = ${a.userId}::bigint
         AND feature = ${a.feature}
         AND subject_key = ${a.subjectKey}
      RETURNING id, cost
    ), back AS (
      UPDATE ticket_wallets
         SET balance = balance + (SELECT cost FROM revoked), updated_at = now()
       WHERE user_id = ${a.userId}::bigint AND EXISTS (SELECT 1 FROM revoked)
      RETURNING balance
    ), ledger AS (
      INSERT INTO ticket_entries (user_id, delta, reason)
      SELECT ${a.userId}::bigint, cost, 'refund' FROM revoked
      RETURNING id
    )
    SELECT (SELECT id FROM revoked) AS revoked_id,
           COALESCE(
             (SELECT balance FROM back),
             (SELECT balance FROM ticket_wallets WHERE user_id = ${a.userId}::bigint)
           ) AS balance
  `;
  const row = rows[0];
  // COALESCE 가 필요한 이유: 되돌릴 것이 없으면 back 이 비어 잔액이 NULL 이다.
  // 그때는 아무것도 바뀌지 않았으므로 지갑을 그대로 읽어도 옳은 값이라,
  // 차감 쪽처럼 두 번째 쿼리를 보낼 이유가 없다.
  const balance = Number(row?.balance ?? 0);
  return row?.revoked_id != null
    ? { ok: true, kind: "refunded", balance }
    : { ok: true, kind: "nothing_to_refund", balance };
}
```

> **참고(리뷰에서 발견, 구현 뒤 기록):** 위 참고 SQL 의 `ledger` CTE 는
> `SELECT ${a.userId}::bigint, cost, 'refund' FROM revoked` 로 `user_id` 를
> 다시 바인딩한다 — 이대로면 이 쿼리 한 문장에 바인딩값이 6개(userId, feature,
> subjectKey, userId, userId, userId) 들어가는데, 바로 아래 Step 4 가 참조하는
> `refund.test.ts` 는 `calls[0].values` 를 5개짜리 배열로 기대한다
> (`["7", "consultation", "42", "7", "7"]`). 이 문서를 문자 그대로 옮기면 테스트를
> 통과할 수 없다.
>
> 실제 구현(`src/lib/tickets/refund.ts`)은 `revoked` 의 `RETURNING` 을
> `id, cost, user_id` 로 넓히고, `ledger` 는 그 `user_id` 를 그대로 셀렉트해
> 다섯 번째 바인딩을 없앴다 — 부수 효과로 원장 행이 "방금 지워진 그 권한 행"에
> 증명 가능하게 묶이는 쪽이 되어 더 낫다(자세한 이유는 refund.ts 의 주석 참고).
> 코드를 이 문서에 맞춰 "고치지" 말 것 — 이 문서 쪽이 틀렸다.

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/tickets/refund.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/tickets/refund.ts src/lib/tickets/refund.test.ts
git commit -m "feat(tickets): 차감을 되돌리는 CTE"
```

---

## Task 3: feature 목록 정리

**Files:**
- Modify: `src/lib/tickets/features.ts`
- Modify: `src/lib/tickets/features.test.ts`
- Modify: `src/app/api/tickets/spend/route.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `FEATURE_IDS = ["full_report", "compatibility", "consultation"]`, `Feature` 유니온에 `"consultation"` 포함, `FEATURE_COST` 셋 다 1. `pairKey` 는 **사라진다**.

**TDD 필수** — 테스트를 먼저 고쳐 실패시키고, 그 다음 구현.

- [ ] **Step 1: 테스트를 고친다**

`src/lib/tickets/features.test.ts` 에서 `pairKey` 를 import 와 describe 블록에서 통째로 지우고, `FEATURE_COST` 테스트에 `consultation` 을 더한다.

```ts
import { describe, it, expect } from "vitest";
import { FEATURE_COST, FEATURE_IDS } from "./features";

describe("FEATURE_COST", () => {
  it("모든 서비스에 단가가 있다 — 빠진 서비스는 조용한 무료 열람이 된다", () => {
    for (const id of FEATURE_IDS) {
      expect(FEATURE_COST[id]).toBeGreaterThan(0);
    }
  });

  it("지금은 전부 1장 균일이다", () => {
    expect(FEATURE_COST.full_report).toBe(1);
    expect(FEATURE_COST.compatibility).toBe(1);
    expect(FEATURE_COST.consultation).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/lib/tickets/features.test.ts
```

Expected: FAIL — `FEATURE_COST.consultation` 이 `undefined` 라 `toBe(1)` 이 어긋난다.

- [ ] **Step 3: `src/lib/tickets/features.ts` 를 고친다**

`FEATURE_IDS` 에 `"consultation"` 을 더하고 `FEATURE_COST` 에 단가를 더한다.

```ts
export const FEATURE_IDS = ["full_report", "compatibility", "consultation"] as const;

export type Feature = (typeof FEATURE_IDS)[number];

/** Record 라 서비스를 추가하면 단가를 빠뜨릴 수 없다 — 여기서 컴파일이 깨진다. */
export const FEATURE_COST: Record<Feature, number> = {
  full_report: 1,
  compatibility: 1,
  consultation: 1,
};
```

`pairKey` 함수와 그 주석을 **통째로 지운다.** 궁합 권한은 정렬된 두 프로필 id 가 아니라 `matches` 행 하나에 붙는다 — `matches_unique` 가 `(subject_profile_id, counterpart_profile_id, relation_type, subject_role, counterpart_role)` 이라 관계 유형까지 단위에 들어가는데, `pairKey` 는 그걸 무시해 단위가 더 굵다. 남겨 두면 두 벌의 규칙이 된다.

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/tickets/features.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: `ownsSubject` 에 `consultation` 케이스를 더한다**

`src/app/api/tickets/spend/route.ts` 의 `switch` 가 `never` 전수 검사 때문에 컴파일이 깨져 있다. `compatibility` 바로 아래에 케이스를 더한다.

```ts
    case "compatibility":
    case "consultation":
      // 이 둘은 HTTP 로 차감되지 않는다. 궁합은 /match/[id] 렌더 중 생성기 안에서,
      // 상담은 POST /api/consultations 처리 중 openConsultation 안에서 차감된다 —
      // 둘 다 서버 내부 경로라 이 엔드포인트를 지난 적이 없다.
      //
      // 소유 확인이 없는 것이 아니라 다른 곳에서 이미 한다: findOrCreateMatch 와
      // createConsultation 이 user_id 로 행을 만들고 조회한다. 여기를 열면 그
      // 확인을 우회하는 두 번째 문이 생긴다.
      return false;
```

기존 `compatibility` 케이스의 주석은 이 새 주석으로 대체한다 — "화면이 아직 없다"는 더 이상 사실이 아니다.

- [ ] **Step 6: 차감 API 테스트가 여전히 통과하는지 확인**

```bash
npx vitest run src/app/api/tickets/spend/ src/lib/tickets/
```

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/tickets/features.ts src/lib/tickets/features.test.ts src/app/api/tickets/spend/route.ts
git commit -m "feat(tickets): 상담을 feature 목록에 더하고 pairKey 를 걷어낸다"
```

---

## Task 4: 상담 배선

**Files:**
- Modify: `src/lib/consultations/deps.ts`
- Create: `src/lib/consultations/deps.test.ts`
- Modify: `src/app/consult/page.tsx`

**Interfaces:**
- Consumes: `getBalance` (`@/lib/tickets/wallet`), `spendTicket` (`@/lib/tickets/spend`), `refundTicket` (Task 2), `TicketPort`·`InsufficientTicketsError` (`./ticket-port`)
- Produces: `consultationDeps()` 가 실제 이용권 포트를 실은 `ServiceDeps` 를 돌려준다. 시그니처는 그대로다.

**`TicketPort` 인터페이스와 `InsufficientTicketsError` 는 건드리지 않는다.** main 의 `service.ts`·`route.ts`·테스트가 전부 그 모양에 의존한다. 구현만 갈아 끼운다.

먼저 `src/lib/consultations/ticket-port.ts` 와 `src/lib/consultations/service.ts` 의 `openConsultation` 을 읽는다 — 어댑터가 왜 던져야 하는지가 거기 있다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/consultations/deps.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { InsufficientTicketsError } from "./ticket-port";
import { makeTicketPort } from "./deps";

describe("makeTicketPort", () => {
  it("잔액을 그대로 위임한다", async () => {
    const port = makeTicketPort({
      getBalance: vi.fn(async () => 6),
      spend: vi.fn(),
      refund: vi.fn(),
    });
    expect(await port.getBalance("7")).toBe(6);
  });

  it("차감이 성사되면 조용히 지나간다", async () => {
    const spend = vi.fn(async () => ({ ok: true as const, kind: "spent" as const, balance: 5 }));
    const port = makeTicketPort({ getBalance: vi.fn(), spend, refund: vi.fn() });
    await expect(port.spend("7", "42")).resolves.toBeUndefined();
    // 상담 1건이 차감 단위다 — consultationId 가 그대로 멱등 키가 된다.
    expect(spend).toHaveBeenCalledWith({
      userId: "7",
      feature: "consultation",
      subjectKey: "42",
    });
  });

  it("이미 차감된 상담을 다시 열어도 던지지 않는다 — already 는 성공이다", async () => {
    const port = makeTicketPort({
      getBalance: vi.fn(),
      spend: vi.fn(async () => ({ ok: true as const, kind: "already" as const, balance: 5 })),
      refund: vi.fn(),
    });
    await expect(port.spend("7", "42")).resolves.toBeUndefined();
  });

  it("잔액이 부족하면 InsufficientTicketsError 를 던진다 — 라우트가 이 에러만 402 로 바꾼다", async () => {
    const port = makeTicketPort({
      getBalance: vi.fn(),
      spend: vi.fn(async () => ({ ok: false as const, kind: "insufficient" as const, balance: 0 })),
      refund: vi.fn(),
    });
    await expect(port.spend("7", "42")).rejects.toBeInstanceOf(InsufficientTicketsError);
  });

  it("되돌리기를 위임한다", async () => {
    const refund = vi.fn(async () => ({
      ok: true as const,
      kind: "refunded" as const,
      balance: 6,
    }));
    const port = makeTicketPort({ getBalance: vi.fn(), spend: vi.fn(), refund });
    await port.refund("7", "42");
    expect(refund).toHaveBeenCalledWith({
      userId: "7",
      feature: "consultation",
      subjectKey: "42",
    });
  });

  it("되돌릴 것이 없어도 던지지 않는다 — 이미 되돌아간 상태다", async () => {
    const port = makeTicketPort({
      getBalance: vi.fn(),
      spend: vi.fn(),
      refund: vi.fn(async () => ({
        ok: true as const,
        kind: "nothing_to_refund" as const,
        balance: 6,
      })),
    });
    await expect(port.refund("7", "42")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/lib/consultations/deps.test.ts
```

Expected: FAIL — `makeTicketPort` 가 `./deps` 에 없다.

- [ ] **Step 3: `src/lib/consultations/deps.ts` 를 고친다**

`stubTicketPort` import 를 지우고, 주입 가능한 팩토리와 프로덕션 배선을 더한다.

```ts
import { getBalance } from "@/lib/tickets/wallet";
import { refundTicket } from "@/lib/tickets/refund";
import { spendTicket } from "@/lib/tickets/spend";
import { InsufficientTicketsError, type TicketPort } from "./ticket-port";

/**
 * 이용권 모듈과 상담 사이의 어댑터.
 *
 * 존재 이유는 에러 변환 하나다. spendTicket 은 결과를 돌려주지만 service.ts 의
 * openConsultation 은 spend 가 **던지는 것**에 의존해 흐름을 짠다 — 던지면
 * setTicketSpent(true) 에 닿지 않아 값을 치르지 않은 상담이 목록에 뜨지 않는다.
 * 라우트도 InsufficientTicketsError 만 402 로 바꾼다.
 *
 * deps 를 주입받는 이유: 이 변환이 실제로 일어나는지 DB 없이 테스트하려면
 * 안쪽 세 함수를 갈아 끼울 수 있어야 한다.
 */
export interface TicketDeps {
  getBalance: typeof getBalance;
  spend: typeof spendTicket;
  refund: typeof refundTicket;
}

const FEATURE = "consultation" as const;

export function makeTicketPort(d: TicketDeps): TicketPort {
  return {
    getBalance: (userId) => d.getBalance(userId),

    // consultationId 가 그대로 subject_key 다 — 상담 1건이 차감 단위이므로
    // entitlements_unique 가 같은 상담에 두 번 차감되는 것을 막는다.
    // already 는 성공이다: 이미 값을 치른 상담을 다시 여는 것뿐이다.
    spend: async (userId, consultationId) => {
      const r = await d.spend({ userId, feature: FEATURE, subjectKey: consultationId });
      if (!r.ok) throw new InsufficientTicketsError();
    },

    // nothing_to_refund 를 삼킨다 — "되돌릴 것이 없다"는 실패가 아니라
    // 이미 되돌아간 상태다. 실제 장애는 refundTicket 이 예외로 올린다.
    refund: async (userId, consultationId) => {
      await d.refund({ userId, feature: FEATURE, subjectKey: consultationId });
    },
  };
}

const liveTicketPort = makeTicketPort({
  getBalance,
  spend: spendTicket,
  refund: refundTicket,
});
```

`consultationDeps()` 안의 `tickets: stubTicketPort,` 를 `tickets: liveTicketPort,` 로 바꾸고, 그 위의 "이용권 배선 전이다" 주석을 지운다.

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/consultations/
```

Expected: PASS. `deps.test.ts` 6개와 기존 상담 테스트 전부.

- [ ] **Step 5: 잔액 칩을 켠다**

`src/app/consult/page.tsx` 의 "헤더 우측의 이용권 N장은 getBalance 가 실제로 배선된 뒤에 켠다" 주석 자리에 실제 칩을 넣는다. `src/app/home/_components/HomeHeader.tsx` 의 칩을 그대로 따르되, 이 페이지는 로그인을 요구하므로 `balance: number | null` 의 null 갈래가 필요 없다.

서버 컴포넌트에서 `getBalance(session.userId)` 를 읽어 넘긴다. 0장일 때도 보여준다 — 없다는 사실이 곧 충전 유인이다.

- [ ] **Step 6: 타입 검사**

```bash
npm run typecheck
```

Expected: 에러 0.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/consultations/ src/app/consult/
git commit -m "feat(consult): 스텁을 실제 이용권 배선으로 갈아 끼운다"
```

---

## Task 5: 궁합 잔액 확인과 한도 상향

**Files:**
- Modify: `src/lib/matches/access.ts`
- Modify: `src/lib/matches/access.test.ts`
- Modify: `src/lib/matches/rate-limit.ts`

**Interfaces:**
- Consumes: `getBalance` (`@/lib/tickets/wallet`), `FEATURE_COST` (`@/lib/tickets/features`)
- Produces: `MatchAccess` 의 `reason` 에 `"insufficient_tickets"` 추가. `MatchAccessDeps` 에 `getBalance(userId: string): Promise<number>` 추가.

**여기서는 차감하지 않는다.** 그 파일의 기존 주석이 이유를 이미 적어 두었다 — 같은 쌍·같은 관계를 다시 제출하면 `matches_unique` 로 기존 행에 수렴해 LLM 을 한 번도 부르지 않는데, 만들기에서 차감하면 그 요청이 이용권을 먹는다. 잔액 확인은 여기서, 차감은 Task 6 의 생성 자리에서다.

- [ ] **Step 1: 테스트를 더한다**

`src/lib/matches/access.test.ts` 를 먼저 읽고 기존 헬퍼 이름을 그대로 쓴다. 기존 deps 에 `getBalance` 를 더하고(기본값은 충분한 잔액), 아래 테스트를 더한다.

```ts
it("잔액이 없으면 insufficient_tickets", async () => {
  const r = await canCreateMatch("7", {
    peekLimit: async () => true,
    getBalance: async () => 0,
  });
  expect(r).toEqual({ ok: false, reason: "insufficient_tickets" });
});

it("잔액이 1장이면 통과한다", async () => {
  const r = await canCreateMatch("7", {
    peekLimit: async () => true,
    getBalance: async () => 1,
  });
  expect(r).toEqual({ ok: true });
});

it("확인만 하고 차감하지 않는다 — 차감은 생성하는 자리에서다", async () => {
  const getBalance = vi.fn(async () => 3);
  await canCreateMatch("7", { peekLimit: async () => true, getBalance });
  // 잔액을 읽기만 했는지는 호출 횟수로 본다. 이 파일은 spendTicket 을 import 하지 않는다.
  expect(getBalance).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/lib/matches/access.test.ts
```

Expected: FAIL — `MatchAccessDeps` 에 `getBalance` 가 없어 타입이 어긋나고, `insufficient_tickets` 를 아무도 돌려주지 않는다.

- [ ] **Step 3: `src/lib/matches/access.ts` 를 고친다**

```ts
import { getBalance } from "@/lib/tickets/wallet";
import { FEATURE_COST } from "@/lib/tickets/features";
import { peekMatchLimit } from "./rate-limit";

export type MatchAccess =
  | { ok: true }
  | { ok: false; reason: "unauthenticated" | "rate_limited" | "insufficient_tickets" };

export interface MatchAccessDeps {
  /** 세지 않고 보는 쪽만 주입한다 — 이름이 곧 계약이다 */
  peekLimit(userId: string): Promise<boolean>;
  /** 잔액도 읽기만 한다. 차감은 생성기 자리(gated-generator.ts)에서 한다 */
  getBalance(userId: string): Promise<number>;
}

const defaultDeps: MatchAccessDeps = {
  peekLimit: (id) => peekMatchLimit(id),
  getBalance: (id) => getBalance(id),
};

export async function canCreateMatch(
  userId: string | null,
  deps: MatchAccessDeps = defaultDeps,
): Promise<MatchAccess> {
  if (userId === null) return { ok: false, reason: "unauthenticated" };
  if (!(await deps.peekLimit(userId))) return { ok: false, reason: "rate_limited" };
  // 한도 뒤에 두는 이유: 한도 확인은 Redis 한 번이고 잔액은 DB 한 번이라 싼 쪽이 먼저다.
  // 한도가 사고용 숫자로 올라간 뒤로 rate_limited 가 먼저 걸릴 일은 사실상 없다.
  if ((await deps.getBalance(userId)) < FEATURE_COST.compatibility) {
    return { ok: false, reason: "insufficient_tickets" };
  }
  return { ok: true };
}
```

파일 상단의 "⚠️ 이용권 게이트가 들어올 자리다" 주석 문단을 지금 사실에 맞게 고친다 — 게이트가 들어왔고, 여기는 확인만 하며 차감은 생성 자리에서 한다는 기존 설명은 그대로 살린다.

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/matches/access.test.ts
```

Expected: PASS.

- [ ] **Step 5: 호출부가 새 reason 을 다루는지 확인한다**

`canCreateMatch` 를 부르는 곳(`src/app/api/matches/_lib/handler.ts`)이 `reason` 을 상태코드로 바꾸는 자리를 찾는다. `insufficient_tickets` 는 **402** 다 — 리포트 차감 API 가 잔액 부족에 쓰는 코드와 같다. `rate_limited` 가 쓰는 코드(429일 것이다)와 갈라야 한다. 한도는 기다리면 풀리지만 잔액 부족은 사용자가 할 일이 있다.

`Record<MatchAccess reason, number>` 형태로 매핑돼 있으면 키를 더하는 것으로 컴파일이 이끌어 준다. `if/else` 라면 갈래를 더하고, 그 자리에 테스트가 있으면 같이 더한다.

- [ ] **Step 6: 한도를 올린다**

`src/lib/matches/rate-limit.ts` 의 `MATCH_HOURLY_LIMIT` 을 5 에서 60 으로 바꾸고, 문서 주석의 "이용권 게이트가 붙기 전까지 이 카운터가 유일한 방어선이다" 문장을 아래로 대체한다.

```ts
/**
 * ... (앞부분 유지) ...
 *
 * 이용권이 붙은 뒤로 이 카운터는 매출을 제한하는 장치가 아니다 — 돈을 내고 쓰는
 * 사용자를 막을 이유가 없다. 남은 쓸모는 **돈이 걸리지 않은 경로**다:
 * ticket_entries.reason 의 grant(수기·프로모션 지급)로 이용권이 잘못 풀리거나,
 * 차감 게이트 자체에 버그가 생기면 막을 것이 없다.
 *
 * 그래서 숫자는 "정상 사용자를 세는" 값이 아니라 "사고만 걸리는" 값이다. 가장 큰
 * 충전 패키지가 13장이므로 한 번 충전한 사용자는 60 에 닿을 수 없다.
 */
export const MATCH_HOURLY_LIMIT = 60;
```

`MATCH_HOURLY_LIMIT` 을 단언하는 테스트가 있으면 같이 고친다.

- [ ] **Step 7: 관련 테스트 전체**

```bash
npx vitest run src/lib/matches/ src/app/api/matches/
```

Expected: PASS.

- [ ] **Step 8: 커밋**

```bash
git add src/lib/matches/ src/app/api/matches/
git commit -m "feat(match): 만들기에서 잔액을 확인하고 한도를 사고용으로 올린다"
```

---

## Task 6: 궁합 차감

**Files:**
- Create: `src/lib/matches/tickets.ts`
- Modify: `src/app/api/matches/_lib/gated-generator.ts`
- Modify: `src/app/api/matches/_lib/gated-generator.test.ts`
- Modify: `src/app/match/[id]/page.tsx`

**Interfaces:**
- Consumes: `spendTicket`·`SpendResult` (`@/lib/tickets/spend`), `MatchGenerator` (`./generator`)
- Produces:
  - `MatchTicketsError` (`@/lib/matches/tickets`)
  - `spendOnMatchGeneration(inner: MatchGenerator, a: { userId: string; matchId: string; spend?: ... }): MatchGenerator`
  - `isMatchOutOfTickets(e: unknown): boolean`

먼저 `src/app/api/matches/_lib/gated-generator.ts` 를 읽는다. 이 태스크는 그 파일의 `gateMatchGeneration` 과 `isMatchRateLimited` 를 **그대로 따라 만드는 것**이다 — 같은 자리, 같은 모양, 같은 이유.

- [ ] **Step 1: 에러 타입을 만든다**

`src/lib/matches/tickets.ts`:

```ts
/**
 * 궁합 생성에 쓸 이용권이 없다.
 *
 * MatchRateLimitError 와 나란한 타입이다. 둘을 가르는 이유는 사용자에게 할 말이
 * 다르기 때문이다 — 한도는 기다리면 풀리지만 잔액 부족은 충전해야 한다.
 *
 * consultations 의 InsufficientTicketsError 와 합치지 않는다. 합치면 matches 가
 * consultations 를 import 하게 되는데 둘은 서로 모르는 기능이고, 각자의 화면이
 * 각자의 에러를 다룬다.
 */
export class MatchTicketsError extends Error {
  constructor() {
    super("궁합을 볼 이용권이 부족합니다");
    this.name = "MatchTicketsError";
  }
}
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/app/api/matches/_lib/gated-generator.test.ts` 를 먼저 읽고 기존 `gateMatchGeneration` 테스트의 모양(가짜 `MatchGenerator` 를 어떻게 만드는지)을 그대로 쓴다. 아래를 더한다.

```ts
describe("spendOnMatchGeneration", () => {
  it("차감이 성사되면 안쪽 생성기를 부른다", async () => {
    const inner = fakeGenerator();
    const spend = vi.fn(async () => ({ ok: true as const, kind: "spent" as const, balance: 5 }));
    const gated = spendOnMatchGeneration(inner, { userId: "7", matchId: "42", spend });

    await gated.generateSections(CTX, ["chemistry"]);

    expect(spend).toHaveBeenCalledWith({
      userId: "7",
      feature: "compatibility",
      subjectKey: "42",
    });
    expect(inner.calls).toHaveLength(1);
  });

  it("이미 차감된 궁합을 다시 열면 공짜다 — already 도 통과시킨다", async () => {
    const inner = fakeGenerator();
    const gated = spendOnMatchGeneration(inner, {
      userId: "7",
      matchId: "42",
      spend: async () => ({ ok: true as const, kind: "already" as const, balance: 5 }),
    });
    await gated.generateSections(CTX, ["chemistry"]);
    expect(inner.calls).toHaveLength(1);
  });

  it("잔액이 없으면 던지고 안쪽 생성기를 부르지 않는다", async () => {
    const inner = fakeGenerator();
    const gated = spendOnMatchGeneration(inner, {
      userId: "7",
      matchId: "42",
      spend: async () => ({ ok: false as const, kind: "insufficient" as const, balance: 0 }),
    });

    await expect(gated.generateSections(CTX, ["chemistry"])).rejects.toBeInstanceOf(
      MatchTicketsError,
    );
    // 여기서 순서가 뒤집히면 게이트는 "비용을 막는 것"이 아니라 "비용을 쓴 뒤 보고하는 것"이 된다.
    expect(inner.calls).toHaveLength(0);
  });

  it("model 은 안쪽 것을 그대로 넘긴다 — DB 에 기록되는 값이라 래퍼가 바꾸면 안 된다", () => {
    const inner = fakeGenerator();
    const gated = spendOnMatchGeneration(inner, { userId: "7", matchId: "42", spend: vi.fn() });
    expect(gated.model).toBe(inner.model);
  });
});

describe("isMatchOutOfTickets", () => {
  it("직접 던진 것과 cause 에 감싸인 것을 둘 다 잡는다", () => {
    expect(isMatchOutOfTickets(new MatchTicketsError())).toBe(true);
    expect(isMatchOutOfTickets(new Error("wrapped", { cause: new MatchTicketsError() }))).toBe(true);
  });

  it("한도 초과와 섞이지 않는다", () => {
    expect(isMatchOutOfTickets(new MatchRateLimitError())).toBe(false);
    expect(isMatchRateLimited(new MatchTicketsError())).toBe(false);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

```bash
npx vitest run src/app/api/matches/_lib/gated-generator.test.ts
```

Expected: FAIL — `spendOnMatchGeneration` 과 `isMatchOutOfTickets` 가 없다.

- [ ] **Step 4: 래퍼를 만든다**

`src/app/api/matches/_lib/gated-generator.ts` 에 더한다.

```ts
import { MatchTicketsError } from "@/lib/matches/tickets";
import { spendTicket } from "@/lib/tickets/spend";

/**
 * 이용권을 씌운 궁합 생성기.
 *
 * 게이트를 생성기 자리에 두는 이유는 gateMatchGeneration 과 같다 —
 * produceMatchSections 는 저장소에 없는 섹션이 있을 때만 생성기를 부르므로,
 * 이 자리에 두면 실제로 비용이 드는 순간에만 차감된다. 이미 다 저장된 궁합을
 * 다시 여는 것은 생성기에 닿지 않아 공짜다.
 *
 * subjectKey 가 matchId 인 것이 요점이다. matches_unique 가
 * (두 프로필, 관계 유형, 두 역할) 로 잡혀 있어 같은 궁합은 항상 같은 행이고,
 * entitlements_unique 가 그 행에 두 번 차감되는 것을 막는다.
 *
 * 생성이 실패해도 되돌리지 않는다 — 권한 행이 남아 재시도가 공짜이기 때문이다.
 * (상담은 반대다: 그쪽은 상담 1건이 죽으면 되돌린다. service.ts 참조)
 */
export function spendOnMatchGeneration(
  inner: MatchGenerator,
  a: {
    userId: string;
    matchId: string;
    spend?: (i: {
      userId: string;
      feature: "compatibility";
      subjectKey: string;
    }) => Promise<{ ok: boolean }>;
  },
): MatchGenerator {
  const spend = a.spend ?? spendTicket;
  return {
    model: inner.model,
    async generateSections(ctx, keys) {
      // 던지기 전에 inner 를 부르지 않는다 — 순서가 뒤집히면 이용권을 쓰기 전에
      // LLM 을 부르게 되어 게이트가 아무것도 막지 못한다.
      const r = await spend({ userId: a.userId, feature: "compatibility", subjectKey: a.matchId });
      if (!r.ok) throw new MatchTicketsError();
      return inner.generateSections(ctx, keys);
    },
  };
}

/**
 * produceMatchSections 가 생성기 예외를 MatchGenerationError 로 감싸며 원인을
 * cause 에 넣는다. isMatchRateLimited 와 같은 이유로 갈라낸다.
 */
export function isMatchOutOfTickets(e: unknown): boolean {
  if (e instanceof MatchTicketsError) return true;
  return e instanceof Error && e.cause instanceof MatchTicketsError;
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run src/app/api/matches/_lib/gated-generator.test.ts
```

Expected: PASS.

- [ ] **Step 6: `/match/[id]` 에 배선하고 갈래를 더한다**

`src/app/match/[id]/page.tsx` 의 `MatchSections` 에서 생성기 조립을 바꾼다. 한도가 바깥, 이용권이 안쪽이다 — 한도 확인은 Redis 한 번이고 차감은 DB 쓰기라, 싼 쪽이 먼저 막아야 한다.

```tsx
      generator: gateMatchGeneration(
        spendOnMatchGeneration(createMatchGenerator(), { userId, matchId }),
        userId,
      ),
```

catch 블록에 갈래를 더한다. `rateLimited` 와 나란한 지역 변수를 두고, 기존 `rateLimited` 처리와 같은 자리에서 가른다.

```tsx
  let outOfTickets = false;
  // ... catch 안, isMatchRateLimited 검사 옆 ...
      if (isMatchRateLimited(e)) rateLimited = true;
      else if (isMatchOutOfTickets(e)) outOfTickets = true;
      else console.error("[/match/[id]] 해석 생성 실패", e);
```

그리고 보여줄 것이 하나도 없을 때의 갈래에 잔액 부족을 더한다.

```tsx
  if (Object.keys(interpretation).length === 0) {
    if (outOfTickets) return <MatchOutOfTickets matchId={matchId} />;
    return rateLimited ? <MatchRateLimited /> : <MatchError />;
  }
```

- [ ] **Step 7: 잔액 부족 화면을 만든다**

`src/app/match/[id]/_components/MatchOutOfTickets.tsx` (기존 `MatchRateLimited` 와 같은 폴더·같은 모양). 한도 초과 화면과 **다른 화면**이어야 한다 — 한도는 기다리면 풀리지만 잔액 부족은 사용자가 할 일이 있다.

충전으로 보내되 제자리로 돌아오게 한다:

```tsx
href={`/checkout?next=${encodeURIComponent(`/match/${matchId}`)}`}
```

문구는 "이용권이 부족해요" + "충전하고 이어서 보기" 정도로, 기존 `MatchRateLimited` 의 어조를 따른다.

이 상태는 정상 경로에서 잘 나오지 않는다 — 만들기에서 `canCreateMatch` 가 이미 잔액을 확인하기 때문이다. 그 사이에 다른 탭에서 이용권을 썼거나 링크를 직접 열었을 때 나온다. 주석으로 남긴다.

- [ ] **Step 8: 관련 테스트와 타입 검사**

```bash
npx vitest run src/app/api/matches/ src/lib/matches/
npm run typecheck
```

Expected: PASS / 에러 0.

- [ ] **Step 9: 커밋**

```bash
git add src/lib/matches/tickets.ts src/app/api/matches/ src/app/match/
git commit -m "feat(match): 생성하는 자리에서 이용권을 차감한다"
```

---

## Task 7: 전체 검증

**Files:** 없음 (검증만)

**Interfaces:**
- Consumes: Task 1~6 전부

- [ ] **Step 1: 남은 참조를 훑는다**

```bash
git grep -n "pairKey\|stubTicketPort\|PRODUCT_FULL_REPORT\|isPaid" -- src
```

Expected: **아무것도 안 나온다.** `stubTicketPort` 는 `ticket-port.ts` 의 정의 자체가 남을 수 있다 — 그건 지우지 말고(테스트가 쓸 수 있다) `deps.ts` 가 더 이상 쓰지 않는지만 확인한다.

- [ ] **Step 2: 전체 테스트**

```bash
npm test
```

Expected: 전부 PASS.

- [ ] **Step 3: 타입 검사**

```bash
npm run typecheck
```

Expected: 에러 0.

- [ ] **Step 4: 린트**

```bash
npm run lint
```

Expected: 에러 0. `ReviewStep.tsx` 의 경고 2건은 이 작업 이전부터 있던 것이다.

- [ ] **Step 5: 빌드**

```bash
npm run build
```

Expected: 성공. 라우트 목록에 `/api/tickets/spend`, `/api/matches`, `/api/consultations`, `/match/[id]`, `/consult` 가 모두 있어야 한다.

- [ ] **Step 6: 커밋**

앞 태스크들이 이미 커밋했으므로 보통 커밋할 것이 없다. 검증 중에 고친 것이 있으면 그것만 커밋한다.

---

## Self-Review

**스펙 커버리지**

| 스펙 절 | 태스크 |
|---|---|
| §2 병합, 마이그레이션 번호, `pairKey` 삭제 | Task 1, Task 3 |
| §3 refund CTE, `RefundResult`, COALESCE | Task 2 |
| §4.1 feature 목록 | Task 3 |
| §4.2 `ownsSubject` 닫기 | Task 3 |
| §4.3 궁합 (잔액 확인 / 차감 / 실패 화면) | Task 5, Task 6 |
| §4.4 상담 어댑터, 잔액 칩 | Task 4 |
| §4.5 한도 상향 | Task 5 |
| §5 테스트 | 각 태스크에 포함 |
| §6 하지 않는 것 | 해당 없음 |

**타입 일관성 확인**

- `RefundResult` (Task 2) ↔ `TicketDeps.refund` (Task 4) — `refundTicket` 의 반환 타입 일치
- `SpendResult` (기존) ↔ `TicketDeps.spend` (Task 4) ↔ `spendOnMatchGeneration` 의 `spend` (Task 6) — 셋 다 `{ ok: boolean }` 이상을 요구하지 않음
- `Feature` 에 `"consultation"` (Task 3) ↔ `makeTicketPort` 의 `FEATURE` 상수 (Task 4) — Task 3 이 먼저 와야 Task 4 가 컴파일된다
- `MatchAccessDeps.getBalance` (Task 5) ↔ `getBalance(userId: string): Promise<number>` (기존 `wallet.ts`) — 일치
- `MatchTicketsError` (Task 6 Step 1) ↔ `isMatchOutOfTickets` (Task 6 Step 4) ↔ 페이지 (Task 6 Step 6) — 일치

**순서 의존**

Task 3(feature 목록) 없이는 Task 4·6 이 컴파일되지 않는다. Task 2(refund) 없이는 Task 4 가 컴파일되지 않는다. Task 1(병합) 없이는 나머지 전부가 main 의 파일을 찾지 못한다. 순서대로 실행한다.

**계획이 열어 둔 것**

Task 5 Step 5 는 `canCreateMatch` 호출부의 상태코드 매핑 모양을 단정하지 않는다 — 그 파일을 아직 읽지 않았기 때문이다. 대신 요구(잔액 부족은 402, 한도와 갈라야 함)와 확인 방법을 적었다. 구현자가 파일을 열어 판단한다.

Task 4 Step 5 와 Task 6 Step 7 은 화면 문구·마크업을 단정하지 않고 따라야 할 기존 컴포넌트(`HomeHeader` 의 칩, `MatchRateLimited`)를 지목한다. 이 저장소의 화면은 테스트가 없고 형태가 이웃 컴포넌트에서 오므로, 코드를 베껴 적기보다 이웃을 따르게 하는 편이 정확하다.
