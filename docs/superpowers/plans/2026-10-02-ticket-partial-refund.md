# 이용권 부분 환불 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유저가 지원 모달에서 환불 가능한 결제를 고르면 그 자리에서 포트원 취소까지 끝나는 부분 환불을 연다.

**Architecture:** `purchases.remaining` 에 결제별 미사용 장수를 두고, 소비는 가장 오래된 결제부터(FIFO) 깎는다. 환불액은 순수 함수(`결제액 − 쓴 장수 × 1,000`)가 정하고, 목록과 실행이 같은 `isRefundable` 을 본다. 실행은 적립의 역인 CTE 한 문장(결제 refunded → 지갑 차감 → 원장) 뒤 포트원 취소 호출이며, 취소 실패 시 DB 를 되돌리지 않고 `refund_failed_at` 을 남긴다.

**Tech Stack:** Next.js 16 App Router(Route Handler, `after`), Neon HTTP(대화형 트랜잭션 없음 → CTE 한 문장), zod, vitest, 포트원 V2 REST(`POST /payments/{id}/cancel`).

**Spec:** `docs/superpowers/specs/2026-10-02-ticket-partial-refund-design.md`

## Global Constraints

- **AGENTS.md:** 이 Next.js 는 학습 데이터와 다를 수 있다. Route Handler 를 쓰기 전에 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` 를 읽는다.
- **마이그레이션 파일 하나에 SQL 문장 하나.** Neon HTTP 드라이버가 한 쿼리에 여러 문장을 거부한다(`migrations/README.md`). `ALTER TABLE ... ADD COLUMN a, ADD COLUMN b` 는 한 문장이다.
- **`npm run db:migrate` 를 구현자가 돌리지 않는다.** 개발 DB 는 워크트리들이 공유한다 — 컨트롤러가 적용한다.
- **상수는 정확히:** `REFUND_WINDOW_DAYS = 7`, `USED_TICKET_PRICE = 1000`. 환불액 = `max(0, amount − (tickets − remaining) × 1000)`.
- **환불 가능 조건:** `status = 'paid'` · `paid_at ≥ now − 7일` · `remaining > 0` · 환불액 > 0. `remaining` 이 NULL 이면 0 으로 본다.
- **문구는 정확히:** 정책 1 "결제일로부터 7일 이내, 사용하지 않은 이용권만 환불돼요." · 정책 2 "쓴 장수는 장당 1,000원으로 계산하고, 보너스 장수는 환불되지 않아요." · 빈 목록 "지금 환불 가능한 이용권이 없어요" · 거절 "환불할 수 없는 결제예요" · 버튼 `{amount}원 환불받기` · 완료 "{amount}원이 결제하신 수단으로 돌아가요. 카드사에 따라 3~7일 걸려요." · 보류 "환불을 접수했어요. 처리에 시간이 걸릴 수 있어요."
- 라우트 경로는 `/api/refunds`. 요청 본문 `{ purchaseId, reason, body? }`, 응답 `{ amount, pending }`.
- 클라이언트가 보낸 금액을 **절대 쓰지 않는다** — 서버가 행을 다시 읽어 계산한다.
- `src/lib/tickets/refund.ts`(기능 단위 되돌림)는 건드리지 않는다. 새 코드는 `src/lib/payments/refund*.ts`.
- 주석·커밋 메시지는 한국어, 기존 코드의 주석 밀도와 문체(왜를 적는다)를 따른다. 커밋 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- 실제 자격(포트원 시크릿 등)을 어떤 파일에도 적지 않는다. 테스트는 더미 값.

## Review Focus

- **7일 경계:** 결제 정확히 7일 전(같은 시각)은 환불 가능해야 한다 — `paidAt >= now − 7d` (이상). Task 2 테스트가 고정한다.
- **백필 전 옛 결제:** `remaining` NULL 인 `paid` 행은 환불 불가로 보여야 하고, 목록 SQL 과 `isRefundable` 둘 다 NULL 을 0 으로 접어야 한다. Task 2·Task 6 테스트.
- **전액 vs 부분 취소:** 환불액 = 결제액이면 포트원에 `amount` 를 보내지 않는다(전액 취소). 부분이면 보낸다. Task 5·Task 7 테스트.
- **더블 클릭:** 같은 결제에 두 요청이 겹치면 두 번째는 `status='paid'` 조건에 걸려 0행 → 409. 라우트가 500 이 아니라 409 를 돌려준다. Task 7 테스트. 모달은 `sending` 동안 버튼을 잠근다.
- **잔액 CHECK 롤백:** 지갑 잔액 < remaining 인 비정상 행에서 `executeRefund` 가 `ticket_wallets_balance_check` 로 던진다. 핸들러는 포트원을 부르지 않고 티켓도 남기지 않으며, 라우트가 500 으로 옮긴다. Task 7 테스트.

---

### Task 1: 마이그레이션 0056·0057 — 결제별 잔여와 환불 컬럼

**Files:**
- Create: `migrations/0056_purchases_refund_columns.sql`
- Create: `migrations/0057_purchases_remaining_backfill.sql`
- Modify: `migrations/README.md` (마지막 줄 "다음 번호는 0049 부터다." → "다음 번호는 0058 부터다.")

**Interfaces:**
- Produces: `purchases.remaining int NULL`, `purchases.refund_amount int NULL`, `purchases.refunded_at timestamptz NULL`, `purchases.refund_failed_at timestamptz NULL`. 이후 모든 태스크가 이 컬럼 이름을 그대로 쓴다.

- [ ] **Step 1: 0056 — 컬럼 넷을 한 ALTER 로**

`migrations/0056_purchases_refund_columns.sql`:

```sql
-- migrations/0056_purchases_refund_columns.sql
-- 이용권 부분 환불(docs/superpowers/specs/2026-10-02-ticket-partial-refund-design.md).
--
-- remaining: 이 결제에서 아직 안 쓴 장수. 지갑(ticket_wallets.balance)은 합산이라
--   "어느 결제의 이용권이 쓰였나" 가 없었다 — 소비가 가장 오래된 결제부터 여기를 깎는다.
--   paid 가 아닌 행은 NULL. 적립(confirmPurchaseAndCredit)이 tickets 로 채운다.
-- refund_amount·refunded_at: 환불 실행 때 status='refunded' 와 함께 채운다.
-- refund_failed_at: DB 차감은 끝났는데 포트원 취소가 실패한 시각. 운영자가 콘솔에서 수동 취소한다.
--
-- ADD COLUMN 넷을 한 ALTER 에 담는다 — Neon HTTP 드라이버는 한 쿼리에 여러 문장을 거부한다.
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS remaining        int,
  ADD COLUMN IF NOT EXISTS refund_amount    int,
  ADD COLUMN IF NOT EXISTS refunded_at      timestamptz,
  ADD COLUMN IF NOT EXISTS refund_failed_at timestamptz;
```

- [ ] **Step 2: 0057 — 백필**

유저별로 **최근 결제부터** 현재 잔액을 채운다. FIFO 로 썼다면 옛 결제가 먼저 비었으므로, 남은 잔액은 최근 결제에 붙는다. 잔액이 결제 합계보다 크면(수기 지급 등) 초과분은 어느 결제에도 붙지 않는다 — 환불 대상이 아니므로 맞다.

`migrations/0057_purchases_remaining_backfill.sql`:

```sql
-- migrations/0057_purchases_remaining_backfill.sql
-- 0056 의 remaining 을 기존 paid 결제에 채운다. 소비는 FIFO 로 봤으므로 옛 결제가 먼저 비었다 —
-- 현재 잔액을 최근 결제부터 채워 넣는다(ahead = 이 결제보다 최근인 결제들의 장수 합).
-- 잔액이 결제 합계보다 큰 유저(수기 지급)는 초과분이 어느 결제에도 안 붙는다. 환불 대상이 아니다.
-- 이미 remaining 이 있는 행(이 마이그레이션 뒤 적립된 행)은 건드리지 않는다.
UPDATE purchases p
   SET remaining = LEAST(
         COALESCE(p.tickets, 0),
         GREATEST(0, COALESCE(w.balance, 0) - q.ahead)
       )
  FROM (
         SELECT id,
                COALESCE(SUM(COALESCE(tickets, 0)) OVER (
                  PARTITION BY user_id
                  ORDER BY COALESCE(paid_at, created_at) DESC, id DESC
                  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                ), 0) AS ahead
           FROM purchases
          WHERE status = 'paid'
       ) q
  LEFT JOIN ticket_wallets w ON w.user_id = p.user_id
 WHERE p.id = q.id
   AND p.status = 'paid'
   AND p.remaining IS NULL;
```

- [ ] **Step 3: README 의 다음 번호**

`migrations/README.md` 마지막 줄 `**다음 번호는 0049 부터다.**` 를 `**다음 번호는 0058 부터다.**` 로 바꾼다.

- [ ] **Step 4: SQL 을 로컬 Postgres 없이 검증한다**

`npm run db:migrate` 는 돌리지 않는다. 대신 파일 둘 다 세미콜론으로 끝나는 문장이 **하나**인지 확인한다:

Run: `grep -c ";" migrations/0056_purchases_refund_columns.sql migrations/0057_purchases_remaining_backfill.sql`
Expected: 각 파일 `1`

- [ ] **Step 5: 커밋**

```bash
git add migrations/0056_purchases_refund_columns.sql migrations/0057_purchases_remaining_backfill.sql migrations/README.md
git commit -m "feat(db): purchases 에 결제별 잔여·환불 컬럼을 두고 기존 결제를 백필한다"
```

---

### Task 2: 환불 규칙 — `src/lib/payments/refund.ts` (순수 함수)

**Files:**
- Create: `src/lib/payments/refund.ts`
- Test: `src/lib/payments/refund.test.ts`

**Interfaces:**
- Produces:
  - `export const REFUND_WINDOW_DAYS = 7`
  - `export const USED_TICKET_PRICE = 1000`
  - `export interface RefundablePurchase { status: string; amount: number; tickets: number | null; remaining: number | null; paidAt: Date | null }`
  - `export function refundAmount(p: { amount: number; tickets: number | null; remaining: number | null }): number`
  - `export function refundWindowStart(now: Date): Date` — `now − 7일`
  - `export function isRefundable(p: RefundablePurchase, now: Date): boolean`

- [ ] **Step 1: 실패하는 테스트**

`src/lib/payments/refund.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isRefundable, refundAmount, refundWindowStart } from "./refund";

const NOW = new Date("2026-10-02T09:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("refundAmount", () => {
  it("쓴 장수를 장당 1,000원으로 뺀다 — 6장 5,000원에서 2장 쓰면 3,000원", () => {
    expect(refundAmount({ amount: 5000, tickets: 6, remaining: 4 })).toBe(3000);
  });

  it("한 장도 안 썼으면 전액", () => {
    expect(refundAmount({ amount: 5000, tickets: 6, remaining: 6 })).toBe(5000);
  });

  // 묶음 할인·보너스는 "다 쓰는 조건" 이다 — 쓴 만큼 정가로 치면 환불액이 0 이 될 수 있다.
  it("정가로 친 사용액이 결제액을 넘으면 0 — 13장 10,000원에서 10장 사용", () => {
    expect(refundAmount({ amount: 10000, tickets: 13, remaining: 3 })).toBe(0);
  });

  it("remaining 이 NULL(백필 전)이면 0 으로 본다", () => {
    expect(refundAmount({ amount: 1000, tickets: 1, remaining: null })).toBe(0);
  });

  it("tickets 가 NULL(옛 행)이면 0 으로 본다 — 음수 사용량이 생기면 안 된다", () => {
    expect(refundAmount({ amount: 1000, tickets: null, remaining: null })).toBe(0);
  });
});

describe("refundWindowStart", () => {
  it("지금에서 7일 전", () => {
    expect(refundWindowStart(NOW).getTime()).toBe(NOW.getTime() - 7 * DAY);
  });
});

describe("isRefundable", () => {
  const base = { status: "paid", amount: 5000, tickets: 6, remaining: 4, paidAt: new Date(NOW.getTime() - DAY) };

  it("paid · 7일 이내 · 남은 장수 있음 · 환불액 > 0 이면 true", () => {
    expect(isRefundable(base, NOW)).toBe(true);
  });

  it("정확히 7일 전은 아직 가능하다 — 경계는 포함", () => {
    expect(isRefundable({ ...base, paidAt: new Date(NOW.getTime() - 7 * DAY) }, NOW)).toBe(true);
  });

  it("7일에서 1ms 지나면 불가", () => {
    expect(isRefundable({ ...base, paidAt: new Date(NOW.getTime() - 7 * DAY - 1) }, NOW)).toBe(false);
  });

  it("이미 환불된 행은 불가", () => {
    expect(isRefundable({ ...base, status: "refunded" }, NOW)).toBe(false);
  });

  it("남은 장수가 0 이면 불가", () => {
    expect(isRefundable({ ...base, remaining: 0 }, NOW)).toBe(false);
  });

  it("남은 장수는 있어도 환불액이 0 이면 불가", () => {
    expect(isRefundable({ ...base, amount: 10000, tickets: 13, remaining: 3 }, NOW)).toBe(false);
  });

  it("remaining NULL(백필 전)·paid_at NULL 은 불가", () => {
    expect(isRefundable({ ...base, remaining: null }, NOW)).toBe(false);
    expect(isRefundable({ ...base, paidAt: null }, NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/payments/refund.test.ts`
Expected: FAIL — `Failed to resolve import "./refund"`

- [ ] **Step 3: 구현**

`src/lib/payments/refund.ts`:

```ts
/**
 * 이용권 부분 환불의 규칙. 순수 함수만 — 목록(listPurchaseOptions)과 실행(executeRefund)이
 * 같은 답을 보게 조건을 여기 한 곳에 둔다. DB·fetch 는 refund-store.ts 와 portone.ts 에 있다.
 *
 * 환불액 = 결제액 − 쓴 장수 × 정가. 묶음 할인과 보너스는 "다 쓰는 조건" 이라 쓴 만큼은
 * 정가로 친다. 그래서 남은 장수가 있어도 환불액이 0 이 될 수 있고, 그 결제는 목록에서 빠진다.
 */

export const REFUND_WINDOW_DAYS = 7;
export const USED_TICKET_PRICE = 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RefundablePurchase {
  status: string;
  amount: number;
  /** 적립 장수(보너스 포함). 옛 행은 NULL 일 수 있다. */
  tickets: number | null;
  /** 아직 안 쓴 장수. 0057 백필 전 행은 NULL — 환불 불가로 본다. */
  remaining: number | null;
  paidAt: Date | null;
}

export function refundAmount(p: { amount: number; tickets: number | null; remaining: number | null }): number {
  const tickets = p.tickets ?? 0;
  const remaining = p.remaining ?? 0;
  // tickets 가 NULL 이면 사용량이 음수가 되어 결제액보다 큰 환불이 나온다 — 0 으로 접는다.
  const used = Math.max(0, tickets - remaining);
  return Math.max(0, p.amount - used * USED_TICKET_PRICE);
}

export function refundWindowStart(now: Date): Date {
  return new Date(now.getTime() - REFUND_WINDOW_DAYS * DAY_MS);
}

export function isRefundable(p: RefundablePurchase, now: Date): boolean {
  if (p.status !== "paid") return false;
  if (p.paidAt === null) return false;
  if (p.paidAt.getTime() < refundWindowStart(now).getTime()) return false;
  if ((p.remaining ?? 0) <= 0) return false;
  return refundAmount(p) > 0;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/payments/refund.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/payments/refund.ts src/lib/payments/refund.test.ts
git commit -m "feat(payments): 환불액과 환불 가능 조건을 순수 함수로 둔다"
```

---

### Task 3: 적립·소비가 `remaining` 을 유지한다

**Files:**
- Modify: `src/lib/tickets/wallet.ts` (`confirmPurchaseAndCredit` 의 `paid` CTE)
- Modify: `src/lib/tickets/spend.ts` (`spendTicket` CTE 에 `attributed` 단계)
- Test: `src/lib/tickets/wallet.test.ts`, `src/lib/tickets/spend.test.ts`

**Interfaces:**
- Consumes: 없음(Task 1 의 컬럼 이름 `remaining`)
- Produces: 지갑 잔액 ≥ 결제 `remaining` 합이 유지된다. 외부 시그니처 변화 없음.

- [ ] **Step 1: 실패하는 테스트 — 적립**

`src/lib/tickets/wallet.test.ts` 의 `describe("confirmPurchaseAndCredit")` 블록 안, "적립 장수는 purchases.tickets 에서 온다" 테스트 뒤에 추가. 그 파일 1~15행의 가짜 클라이언트 헬퍼 이름을 먼저 확인하고 그 이름을 쓴다(아래는 `fakeClient` 로 가정):

```ts
  it("확정하면서 remaining 을 tickets 로 채운다 — 환불 가능 장수의 출발점", async () => {
    const { client, calls } = fakeClient([{ balance: 6 }]);
    await confirmPurchaseAndCredit({ paymentId: "saju-abc", transactionId: "tx-1" }, client);
    expect(calls[0].sql).toContain("remaining = tickets");
  });
```

- [ ] **Step 2: 실패하는 테스트 — 소비**

`src/lib/tickets/spend.test.ts` 의 `describe("spendTicket")` 블록 끝, 마지막 `it` 뒤에 추가:

```ts
  // 지갑은 합산이라 어느 결제가 쓰였는지 모른다 — 가장 오래된 paid 결제의 remaining 을 깎아
  // 환불 가능 장수를 결제별로 남긴다. 귀속할 결제가 없어도(수기 지급분) 소비는 성공한다.
  it("가장 오래된 paid 결제의 remaining 을 1 깎는다 — claim 이 생겼을 때만", async () => {
    const { client, calls } = fakeClient([{ entitlement_id: 11, balance: 5 }]);
    await spendTicket(input, client);
    const { sql } = calls[0];
    expect(sql).toContain("UPDATE purchases SET remaining = remaining - 1");
    expect(sql).toContain("status = 'paid' AND remaining > 0");
    expect(sql).toContain("ORDER BY paid_at, id LIMIT 1");
    expect(sql).toContain("AND EXISTS (SELECT 1 FROM claim)");
    expect(calls).toHaveLength(1);
  });
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/tickets/wallet.test.ts src/lib/tickets/spend.test.ts`
Expected: FAIL 2개 — 두 새 테스트가 `toContain` 에서 실패

- [ ] **Step 4: 적립 구현**

`src/lib/tickets/wallet.ts` 의 `confirmPurchaseAndCredit` 에서 `paid` CTE 의 `SET` 절을 바꾼다:

```ts
    WITH paid AS (
      UPDATE purchases
         SET status = 'paid', paid_at = now(), provider_txn_id = ${a.transactionId},
             remaining = tickets
       WHERE payment_id = ${a.paymentId} AND status = 'pending'
      RETURNING id, user_id, tickets
    ), wallet AS (
```

함수 머리 주석 끝에 한 문단 덧붙인다:

```
 * remaining = tickets 도 같은 문장에서 쓴다 — 적립 장수와 "아직 안 쓴 장수" 가 어긋난 채
 * 시작하면 환불 가능 장수가 처음부터 틀린다.
```

- [ ] **Step 5: 소비 구현**

`src/lib/tickets/spend.ts` 의 `spendTicket` CTE 에서 `ledger AS (...)` 다음, `SELECT (SELECT id FROM claim)` 앞에 단계를 넣는다:

```ts
      ), ledger AS (
        INSERT INTO ticket_entries (user_id, delta, reason, entitlement_id)
        SELECT ${a.userId}::bigint, ${-cost}, 'spend', id FROM claim
        RETURNING id
      ), attributed AS (
        UPDATE purchases SET remaining = remaining - 1
         WHERE id = (
           SELECT id FROM purchases
            WHERE user_id = ${a.userId}::bigint AND status = 'paid' AND remaining > 0
              AND EXISTS (SELECT 1 FROM claim)
            ORDER BY paid_at, id LIMIT 1
         )
        RETURNING id
      )
      SELECT (SELECT id FROM claim) AS entitlement_id,
             (SELECT balance FROM pay) AS balance
```

함수 머리 주석(`cost 를 파라미터로 받지 않고` 문단 뒤)에 덧붙인다:

```
 * attributed 가 결제별 잔여(purchases.remaining)를 FIFO 로 깎는다 — 환불 가능 장수의 출처다.
 * `- 1` 을 cost 로 쓰지 않는 이유: 모든 기능이 1장이라(FEATURE_COST) 소비 1건은 결제 1건에
 * 붙는다. 단가가 2 이상인 기능이 생기면 한 소비가 두 결제에 걸칠 수 있어 이 단계를 다시 짜야
 * 한다 — 그때 이 주석이 서 있다.
 * 귀속할 결제가 없어도(백필 때 결제에 안 붙은 수기 지급분) attributed 가 비는 것은 오류가
 * 아니다 — 소비는 claim·pay 가 정한다.
```

- [ ] **Step 6: 통과 확인**

Run: `npx vitest run src/lib/tickets`
Expected: 전부 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/lib/tickets/wallet.ts src/lib/tickets/wallet.test.ts src/lib/tickets/spend.ts src/lib/tickets/spend.test.ts
git commit -m "feat(tickets): 적립이 remaining 을 채우고 소비가 가장 오래된 결제부터 깎는다"
```

---

### Task 4: 환불 실행 — `src/lib/payments/refund-store.ts`

**Files:**
- Create: `src/lib/payments/refund-store.ts`
- Test: `src/lib/payments/refund-store.test.ts`

**Interfaces:**
- Consumes (Task 2): `RefundablePurchase`, `refundWindowStart(now)`
- Produces:
  - `export interface RefundCandidate extends RefundablePurchase { purchaseId: string; userId: string; paymentId: string }`
  - `export function toRefundCandidate(r: Record<string, unknown>): RefundCandidate`
  - `export async function findRefundCandidate(purchaseId: string, userId: string, client?): Promise<RefundCandidate | null>`
  - `export async function executeRefund(a: { purchaseId: string; userId: string; amount: number; now: Date }, client?): Promise<{ paymentId: string; remaining: number } | null>` — 0행이면 `null`
  - `export async function markRefundFailed(purchaseId: string, client?): Promise<void>`

- [ ] **Step 1: 실패하는 테스트**

`src/lib/payments/refund-store.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { SqlClient } from "@/lib/db";
import { executeRefund, findRefundCandidate, markRefundFailed, toRefundCandidate } from "./refund-store";

function fakeClient(...responses: Record<string, unknown>[][]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(responses[i++] ?? []);
  };
  return { client, calls };
}

const NOW = new Date("2026-10-02T09:00:00.000Z");

describe("toRefundCandidate", () => {
  it("행을 숫자·Date 로 접는다 — bigint 는 문자열, timestamptz 는 Date", () => {
    expect(
      toRefundCandidate({
        id: 9, user_id: 7, payment_id: "saju-abc", status: "paid", amount: 5000, tickets: 6,
        remaining: 4, paid_at: "2026-10-01T09:00:00.000Z",
      }),
    ).toEqual({
      purchaseId: "9", userId: "7", paymentId: "saju-abc", status: "paid", amount: 5000, tickets: 6,
      remaining: 4, paidAt: new Date("2026-10-01T09:00:00.000Z"),
    });
  });

  it("remaining·tickets·paid_at 이 NULL 이면 null 로 둔다 — 규칙 함수가 불가로 접는다", () => {
    const c = toRefundCandidate({ id: 9, user_id: 7, payment_id: "p", status: "paid", amount: 1000, tickets: null, remaining: null, paid_at: null });
    expect(c.tickets).toBeNull();
    expect(c.remaining).toBeNull();
    expect(c.paidAt).toBeNull();
  });
});

describe("findRefundCandidate", () => {
  it("id 와 user_id 를 함께 건다 — purchases.id 는 순번이라 남의 결제를 훑을 수 있다", async () => {
    const { client, calls } = fakeClient([]);
    expect(await findRefundCandidate("9", "7", client)).toBeNull();
    expect(calls[0].sql).toContain("WHERE id = ?::bigint AND user_id = ?::bigint");
    expect(calls[0].values).toEqual(["9", "7"]);
  });
});

describe("executeRefund", () => {
  const input = { purchaseId: "9", userId: "7", amount: 3000, now: NOW };

  it("한 문장이다 — 결제·지갑·원장이 나뉘면 돈은 돌려주고 이용권은 남는 틈이 생긴다", async () => {
    const { client, calls } = fakeClient([{ payment_id: "saju-abc", remaining: 4 }]);
    expect(await executeRefund(input, client)).toEqual({ paymentId: "saju-abc", remaining: 4 });
    expect(calls).toHaveLength(1);
  });

  it("status='paid' AND remaining > 0 AND paid_at >= 창 시작 을 WHERE 에 건다 — 동시 요청은 한쪽만 통과", async () => {
    const { client, calls } = fakeClient([{ payment_id: "p", remaining: 1 }]);
    await executeRefund(input, client);
    const { sql, values } = calls[0];
    expect(sql).toContain("status = 'paid' AND remaining > 0");
    expect(sql).toContain("paid_at >= ?");
    expect(values).toContainEqual(new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000));
  });

  it("환불액을 refund_amount 에 쓰고 status 를 refunded 로 바꾼다", async () => {
    const { client, calls } = fakeClient([{ payment_id: "p", remaining: 1 }]);
    await executeRefund(input, client);
    expect(calls[0].sql).toContain("SET status = 'refunded', refunded_at = now(), refund_amount = ?");
    expect(calls[0].values).toContain(3000);
  });

  it("지갑은 remaining 만큼 깎고 원장은 -remaining 을 'refund' 로 남긴다", async () => {
    const { client, calls } = fakeClient([{ payment_id: "p", remaining: 1 }]);
    await executeRefund(input, client);
    expect(calls[0].sql).toContain("SET balance = w.balance - t.remaining");
    expect(calls[0].sql).toContain("SELECT user_id, -remaining, 'refund', id FROM target");
  });

  it("0행이면 null — 남의 것·7일 경과·이미 환불·전부 사용을 가르지 않는다", async () => {
    const { client } = fakeClient([]);
    expect(await executeRefund(input, client)).toBeNull();
  });
});

describe("markRefundFailed", () => {
  it("refund_failed_at 만 찍는다 — status 는 refunded 그대로(운영자가 콘솔에서 마저 취소한다)", async () => {
    const { client, calls } = fakeClient([]);
    await markRefundFailed("9", client);
    expect(calls[0].sql).toContain("SET refund_failed_at = now()");
    expect(calls[0].sql).not.toContain("status");
    expect(calls[0].values).toEqual(["9"]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/payments/refund-store.test.ts`
Expected: FAIL — `Failed to resolve import "./refund-store"`

- [ ] **Step 3: 구현**

`src/lib/payments/refund-store.ts`:

```ts
import { sql as neonSql, type SqlClient } from "@/lib/db";
import { refundWindowStart, type RefundablePurchase } from "./refund";

const sql = neonSql as unknown as SqlClient;

export interface RefundCandidate extends RefundablePurchase {
  purchaseId: string;
  userId: string;
  paymentId: string;
}

/** DB 행 → RefundCandidate. 컬럼 이름을 아는 유일한 곳이다. bigint 는 문자열로(toPendingOrder 와 같은 판단). */
export function toRefundCandidate(r: Record<string, unknown>): RefundCandidate {
  return {
    purchaseId: String(r.id),
    userId: String(r.user_id),
    paymentId: String(r.payment_id ?? ""),
    status: String(r.status),
    amount: Number(r.amount),
    tickets: r.tickets == null ? null : Number(r.tickets),
    remaining: r.remaining == null ? null : Number(r.remaining),
    paidAt: r.paid_at == null ? null : new Date(r.paid_at as string | Date),
  };
}

/**
 * 환불 실행 직전에 행을 다시 읽는다 — 클라이언트가 보낸 금액은 받지 않고 여기서 계산한다.
 * user_id 를 함께 거는 이유: purchases.id 는 순번 bigint 라 번호를 올려 가며 남의 결제를 훑을 수 있다.
 */
export async function findRefundCandidate(
  purchaseId: string,
  userId: string,
  client: SqlClient = sql,
): Promise<RefundCandidate | null> {
  const rows = await client`
    SELECT id, user_id, payment_id, status, amount, tickets, remaining, paid_at
      FROM purchases
     WHERE id = ${purchaseId}::bigint AND user_id = ${userId}::bigint
  `;
  const row = rows[0];
  return row ? toRefundCandidate(row) : null;
}

/**
 * 환불 실행. 적립(confirmPurchaseAndCredit)의 정확한 역이다.
 *
 * ⚠️ CTE 한 문장인 이유는 적립과 같다 — Neon HTTP 드라이버에 대화형 트랜잭션이 없어 세 테이블을
 * 나누면 그 사이에 프로세스가 죽었을 때 "돈은 돌려줬는데 이용권은 남은" 상태가 생긴다.
 *
 * WHERE 가 곧 환불 가능 조건이다(isRefundable 과 같은 셋). 동시 요청 두 개는 status='paid'
 * 조건으로 한쪽만 통과한다. 0행은 실패가 아니라 "환불할 수 없는 결제" — 남의 것·7일 경과·
 * 이미 환불·전부 사용을 가르지 않는다(가르면 id 로 존재 여부를 훑을 수 있다).
 *
 * 지갑 잔액이 remaining 보다 작은 비정상 행(백필 뒤 잔액이 바뀐 경우)은 0012 의 balance CHECK 가
 * 문장 전체를 롤백한다 — 호출자에게 예외로 나간다.
 *
 * 환불액(amount)은 호출자가 findRefundCandidate 로 읽은 행에서 refundAmount 로 계산한 값이다.
 * 여기서 다시 계산하지 않는 이유: SQL 안에서 가격 규칙을 또 적으면 규칙을 아는 곳이 둘이 된다.
 */
export async function executeRefund(
  a: { purchaseId: string; userId: string; amount: number; now: Date },
  client: SqlClient = sql,
): Promise<{ paymentId: string; remaining: number } | null> {
  const rows = await client`
    WITH target AS (
      UPDATE purchases
         SET status = 'refunded', refunded_at = now(), refund_amount = ${a.amount}
       WHERE id = ${a.purchaseId}::bigint AND user_id = ${a.userId}::bigint
         AND status = 'paid' AND remaining > 0
         AND paid_at >= ${refundWindowStart(a.now)}
      RETURNING id, user_id, remaining, payment_id
    ), wallet AS (
      UPDATE ticket_wallets w
         SET balance = w.balance - t.remaining, updated_at = now()
        FROM target t
       WHERE w.user_id = t.user_id
      RETURNING w.balance
    ), ledger AS (
      INSERT INTO ticket_entries (user_id, delta, reason, purchase_id)
      SELECT user_id, -remaining, 'refund', id FROM target
      RETURNING id
    )
    SELECT t.payment_id, t.remaining FROM target t
  `;
  const row = rows[0];
  if (!row) return null;
  return { paymentId: String(row.payment_id), remaining: Number(row.remaining) };
}

/**
 * 포트원 취소가 실패한 시각. status 는 refunded 그대로 둔다 — DB 차감은 끝났고, 운영자가 콘솔에서
 * 취소를 마저 하면 맞춰진다. 되돌리지 않는 이유는 설계 문서의 "실행" 절 참고.
 */
export async function markRefundFailed(purchaseId: string, client: SqlClient = sql): Promise<void> {
  await client`
    UPDATE purchases SET refund_failed_at = now() WHERE id = ${purchaseId}::bigint
  `;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/payments/refund-store.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/payments/refund-store.ts src/lib/payments/refund-store.test.ts
git commit -m "feat(payments): 환불 실행을 적립의 역인 CTE 한 문장으로 둔다"
```

---

### Task 5: 포트원 취소 — `cancelPayment`

**Files:**
- Modify: `src/lib/payments/portone.ts` (파일 끝에 추가)
- Test: `src/lib/payments/portone.test.ts` (파일 끝에 describe 추가)

**Interfaces:**
- Produces: `export async function cancelPayment(paymentId: string, o: { reason: string; amount?: number }, opts?: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv }): Promise<void>` — 이미 취소된 결제(`PAYMENT_ALREADY_CANCELLED`)는 성공. 그 외 실패는 `PortOneError`. 시크릿 없으면 `PortOneNotConfiguredError`.

- [ ] **Step 1: 실패하는 테스트**

`src/lib/payments/portone.test.ts` 파일 끝에 추가. 그 파일의 `fakeFetch` 는 `body` 를 기록하지 않으므로 이 describe 용 헬퍼를 둔다. `cancelPayment` 는 파일 맨 위 기존 import 줄에 합친다:

```ts
/** cancelPayment 용 — 요청 본문까지 기록한다. */
function fakePost(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const calls: { url: string; method: string | undefined; headers: Record<string, string>; body: unknown }[] = [];
  const fetchImpl = (async (url: string | URL | Request, opts?: RequestInit) => {
    calls.push({
      url: String(url),
      method: opts?.method,
      headers: (opts?.headers ?? {}) as Record<string, string>,
      body: typeof opts?.body === "string" ? JSON.parse(opts.body) : null,
    });
    return { ok: init.ok ?? true, status: init.status ?? 200, json: async () => body } as Response;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe("cancelPayment", () => {
  it("POST /payments/{id}/cancel 에 PortOne 인증과 JSON 본문", async () => {
    const { fetchImpl, calls } = fakePost({ cancellation: { status: "SUCCEEDED" } });
    await cancelPayment("saju/abc", { reason: "실수로 결제했어요", amount: 3000 }, { fetchImpl, env });
    expect(calls[0].url).toBe("https://api.portone.io/payments/saju%2Fabc/cancel");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers.Authorization).toBe("PortOne secret-1");
    expect(calls[0].headers["Content-Type"]).toBe("application/json");
    expect(calls[0].body).toEqual({ reason: "실수로 결제했어요", amount: 3000 });
  });

  // 전액이면 amount 를 보내지 않는다 — 포트원은 amount 없는 요청을 전액 취소로 본다.
  it("amount 가 없으면 본문에도 없다 — 전액 취소", async () => {
    const { fetchImpl, calls } = fakePost({ cancellation: { status: "SUCCEEDED" } });
    await cancelPayment("p", { reason: "기타" }, { fetchImpl, env });
    expect(calls[0].body).toEqual({ reason: "기타" });
  });

  it("이미 취소된 결제는 성공으로 본다 — 재시도 안전", async () => {
    const { fetchImpl } = fakePost({ type: "PAYMENT_ALREADY_CANCELLED", message: "already" }, { ok: false, status: 409 });
    await expect(cancelPayment("p", { reason: "기타" }, { fetchImpl, env })).resolves.toBeUndefined();
  });

  it("그 외 실패는 PortOneError 에 type 을 싣는다", async () => {
    const { fetchImpl } = fakePost({ type: "PAYMENT_NOT_FOUND", message: "없음" }, { ok: false, status: 404 });
    await expect(cancelPayment("p", { reason: "기타" }, { fetchImpl, env })).rejects.toMatchObject({
      name: "PortOneError", type: "PAYMENT_NOT_FOUND",
    });
  });

  it("시크릿이 없으면 PortOneNotConfiguredError — fetch 를 부르지 않는다", async () => {
    const { fetchImpl, calls } = fakePost({});
    await expect(
      cancelPayment("p", { reason: "기타" }, { fetchImpl, env: {} as NodeJS.ProcessEnv }),
    ).rejects.toBeInstanceOf(PortOneNotConfiguredError);
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/payments/portone.test.ts`
Expected: FAIL — `cancelPayment` is not exported

- [ ] **Step 3: 구현**

`src/lib/payments/portone.ts` 파일 끝에 추가:

```ts
/** 포트원이 이미 취소된 결제에 돌려주는 type. 우리에겐 성공이다 — 재시도 때 두 번 취소되지 않는다. */
const ALREADY_CANCELLED = "PAYMENT_ALREADY_CANCELLED";

/**
 * POST /payments/{paymentId}/cancel — 결제 취소(환불).
 *
 * amount 를 생략하면 포트원은 전액 취소로 본다. 부분 환불만 amount 를 싣는다.
 * 호출 전에 우리 DB 는 이미 refunded 다(executeRefund). 여기서 실패하면 호출자가
 * refund_failed_at 을 찍고 운영자에게 알린다 — 되돌리지 않는다(설계 문서 "실행" 절).
 */
export async function cancelPayment(
  paymentId: string,
  o: { reason: string; amount?: number },
  opts: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {},
): Promise<void> {
  const secret = getApiSecret(opts.env);
  if (!secret) throw new PortOneNotConfiguredError();

  const body: { reason: string; amount?: number } = { reason: o.reason };
  if (o.amount !== undefined) body.amount = o.amount;

  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`, {
    method: "POST",
    headers: { Authorization: `PortOne ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data: unknown = await res.json().catch(() => null);
  if (res.ok) return;

  const e = data as { type?: string; message?: string } | null;
  if (e?.type === ALREADY_CANCELLED) return;
  throw new PortOneError(e?.message ?? `포트원 결제 취소 실패 (HTTP ${res.status})`, e?.type);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/payments/portone.test.ts`
Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/payments/portone.ts src/lib/payments/portone.test.ts
git commit -m "feat(payments): 포트원 결제 취소 호출을 둔다 — 이미 취소된 건은 성공"
```

---

### Task 6: 환불 목록이 "환불 가능한 결제" 만 내려준다

**Files:**
- Modify: `src/lib/support/types.ts` (`PurchaseOption`)
- Modify: `src/lib/support/store.ts` (`toPurchaseOption`, `listPurchaseOptions`)
- Modify: `src/app/api/support/_lib/handler.ts` (`bodySchema` 의 refund 갈래와 `handleCreateSupportTicket` 의 refund 분기 제거, `CreateSupportDeps.listPurchaseOptions` 제거)
- Modify: `src/app/api/support/route.ts` (`listPurchaseOptions` 주입 제거)
- Modify: `src/components/support/SupportDialog.tsx` (`requested` 참조 두 줄만 — typecheck 를 위해)
- Test: `src/lib/support/store.test.ts`, `src/app/api/support/_lib/handler.test.ts`

**Interfaces:**
- Consumes (Task 2): `isRefundable`, `refundAmount`, `refundWindowStart`
- Produces:
  - `PurchaseOption` = `{ purchaseId: string; paymentId: string; title: string; sub: string; remaining: number; refundAmount: number; createdAt: string }` — `requested` 는 없어진다
  - `listPurchaseOptions(userId, client?, now = new Date())` 는 환불 가능한 건만 돌려준다
  - `handleSupportOptions` 응답 모양은 그대로(`{ kind: "refund", items, balance }`)
  - `POST /api/support` 는 더 이상 `kind: "refund"` 를 받지 않는다(400)

- [ ] **Step 1: 실패하는 테스트 — store**

`src/lib/support/store.test.ts` 의 `describe("toPurchaseOption")` 과 `describe("listPurchaseOptions")` 블록을 통째로 아래로 바꾼다. `recorder` 는 그 파일이 이미 쓰는 헬퍼다(1~26행에서 시그니처를 확인한다; `[[]]` 는 첫 쿼리 응답):

```ts
describe("toPurchaseOption", () => {
  it("적립 장수·금액에 남은 장수와 환불액을 더한다 — 6장 5,000원에서 2장 쓰면 3,000원", () => {
    expect(
      toPurchaseOption({
        id: 9, payment_id: "saju-abc", product: "t5", amount: 5000, tickets: 6, remaining: 4,
        paid_at: T, created_at: "2026-09-30T00:00:00.000Z",
      }),
    ).toEqual({
      purchaseId: "9", paymentId: "saju-abc", title: "이용권 6장", sub: "5,000원",
      remaining: 4, refundAmount: 3000, createdAt: T,
    });
  });

  it("tickets 가 비어 있는 옛 행은 패키지 표에서 장수를 얻는다 — 표시용이다", () => {
    const o = toPurchaseOption({
      id: 9, payment_id: "p", product: "t10", amount: 10000, tickets: null, remaining: 13,
      paid_at: null, created_at: T,
    });
    expect(o.title).toBe("이용권 13장");
    expect(o.createdAt).toBe(T);
  });

  it("모르는 상품이면 장수 없이 '이용권'", () => {
    const o = toPurchaseOption({
      id: 9, payment_id: "p", product: "legacy", amount: 1000, tickets: null, remaining: 1,
      paid_at: T, created_at: T,
    });
    expect(o.title).toBe("이용권");
  });
});

describe("listPurchaseOptions", () => {
  const NOW = new Date("2026-10-02T09:00:00.000Z");
  const DAY = 24 * 60 * 60 * 1000;
  const row = (over: Record<string, unknown>) => ({
    id: 9, payment_id: "p", product: "t5", amount: 5000, tickets: 6, remaining: 4, status: "paid",
    paid_at: new Date(NOW.getTime() - DAY).toISOString(), created_at: T, ...over,
  });

  it("paid · remaining > 0 · 7일 이내를 SQL 에서 거른다", async () => {
    const { client, queries, params } = recorder([[]]);
    await listPurchaseOptions("7", client, NOW);
    expect(queries[0]).toContain("status = 'paid'");
    expect(queries[0]).toContain("remaining > 0");
    expect(queries[0]).toContain("paid_at >= ?");
    expect(params[0]).toContain("7");
    expect(params[0]).toContainEqual(new Date(NOW.getTime() - 7 * DAY));
  });

  // 남은 장수는 있어도 쓴 장수를 정가로 치면 0 원인 결제가 있다 — SQL 이 모르는 규칙이라 앱에서 거른다.
  it("환불액이 0 인 건은 빼고 돌려준다", async () => {
    const { client } = recorder([[row({ id: 1, amount: 10000, tickets: 13, remaining: 3 }), row({ id: 2 })]]);
    const items = await listPurchaseOptions("7", client, NOW);
    expect(items.map((i) => i.purchaseId)).toEqual(["2"]);
  });

  it("tickets 가 NULL 인 옛 행은 뺀다 — 장수를 확신할 수 없는 결제는 환불하지 않는다", async () => {
    const { client } = recorder([[row({ id: 1, tickets: null, remaining: 1 })]]);
    expect(await listPurchaseOptions("7", client, NOW)).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패하는 테스트 — handler**

`src/app/api/support/_lib/handler.test.ts`:
- `purchases` 픽스처를 새 모양으로 바꾼다:

```ts
const purchases: PurchaseOption[] = [
  { purchaseId: "9", paymentId: "saju-abc", title: "이용권 6장", sub: "5,000원", remaining: 4, refundAmount: 3000, createdAt: T },
];
```

- `deps()` 에서 `listPurchaseOptions` 줄을 지운다.
- `describe("handleCreateSupportTicket")` 안의 환불 테스트 넷("환불 — 결제 건 라벨과 사유를 저장한다", "내 결제가 아니면 404", "이미 열린 환불 요청이 있으면 409", "동시 요청이 앱 검사를 통과해도 INSERT 충돌이면 409, 메일은 안 보낸다")을 지우고 아래 둘로 바꾼다:

```ts
  // 환불은 POST /api/refunds 가 그 자리에서 실행한다 — 여기로 오면 옛 클라이언트다.
  it("refund 는 더 받지 않는다 — 400", async () => {
    const d = deps();
    const r = await handleCreateSupportTicket({ kind: "refund", purchaseId: "9", reason: "기타" }, d);
    expect(r.status).toBe(400);
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it("INSERT 가 아무것도 돌려주지 않으면 409, 메일은 안 보낸다", async () => {
    const d = deps({ insertTicket: vi.fn(async () => null) });
    expect((await handleCreateSupportTicket({ kind: "feedback", body: "좋아요" }, d)).status).toBe(409);
    expect(d.mailer!.send).not.toHaveBeenCalled();
  });
```

- 그 밖에 `kind: "refund"` 로 호출하는 테스트가 남아 있으면(`it.each` 의 잘못된 본문 목록은 그대로 둔다 — 여전히 400 이다) `{ kind: "feedback", body: "좋아요" }` 로 바꾼다.

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/lib/support src/app/api/support`
Expected: FAIL — `toPurchaseOption` 결과에 `requested` 가 있고 `remaining`·`refundAmount` 가 없다; handler 가 refund 를 201 로 받는다

- [ ] **Step 4: types.ts**

`src/lib/support/types.ts` 의 `PurchaseOption` 을 바꾼다:

```ts
/** 환불 요청의 "환불 가능한 결제" 한 줄. 서버가 isRefundable 로 거른 것만 내려온다. */
export interface PurchaseOption {
  purchaseId: string;
  paymentId: string;
  title: string;
  sub: string;
  /** 아직 안 쓴 장수 — 전부 회수된다. */
  remaining: number;
  /** 지금 환불받을 금액(원). 서버가 계산한 표시용이다 — 실행 때 다시 계산한다. */
  refundAmount: number;
  createdAt: string;
}
```

- [ ] **Step 5: store.ts**

`src/lib/support/store.ts`:
- import 에 `import { isRefundable, refundAmount, refundWindowStart } from "@/lib/payments/refund";` 를 더한다.
- `toPurchaseOption` 을 바꾼다:

```ts
export function toPurchaseOption(r: Record<string, unknown>): PurchaseOption {
  const product = String(r.product);
  const tickets =
    r.tickets != null ? Number(r.tickets) : isPackageId(product) ? creditedTickets(getPackage(product)) : null;
  const remaining = r.remaining == null ? 0 : Number(r.remaining);
  return {
    purchaseId: String(r.id),
    paymentId: String(r.payment_id ?? ""),
    title: tickets === null ? "이용권" : `이용권 ${tickets}장`,
    sub: `${Number(r.amount).toLocaleString("ko-KR")}원`,
    remaining,
    refundAmount: refundAmount({ amount: Number(r.amount), tickets, remaining }),
    createdAt: toIso(r.paid_at ?? r.created_at),
  };
}
```

- `listPurchaseOptions` 를 바꾼다:

```ts
/**
 * 환불 요청의 "환불 가능한 결제": paid · 남은 장수 있음 · 7일 이내를 SQL 로 거르고,
 * 환불액 0 원(쓴 장수를 정가로 치면 결제액을 넘는 묶음)은 앱에서 뺀다 — 가격 규칙은 refund.ts 가
 * 유일한 출처라 SQL 에 다시 적지 않는다. 실행(POST /api/refunds)도 같은 isRefundable 을 본다.
 *
 * tickets 가 NULL 인 옛 행은 isRefundable 이 뺀다(환불액 0) — 장수를 확신할 수 없는 결제는
 * 환불하지 않는다. toPurchaseOption 의 패키지 표 폴백은 표시용일 뿐이다.
 */
export async function listPurchaseOptions(
  userId: string,
  client: SqlClient = sql,
  now: Date = new Date(),
): Promise<PurchaseOption[]> {
  const rows = await client`
    SELECT p.id, p.payment_id, p.product, p.amount, p.tickets, p.remaining, p.status, p.paid_at, p.created_at
      FROM purchases p
     WHERE p.user_id = ${userId}::bigint
       AND p.status = 'paid'
       AND p.remaining > 0
       AND p.paid_at >= ${refundWindowStart(now)}
     ORDER BY p.paid_at DESC
     LIMIT ${OPTION_LIMIT}
  `;
  return rows
    .filter((r) =>
      isRefundable(
        {
          status: String(r.status),
          amount: Number(r.amount),
          tickets: r.tickets == null ? null : Number(r.tickets),
          remaining: r.remaining == null ? null : Number(r.remaining),
          paidAt: r.paid_at == null ? null : new Date(r.paid_at as string | Date),
        },
        now,
      ),
    )
    .map(toPurchaseOption);
}
```

- [ ] **Step 6: handler.ts · route.ts · SupportDialog.tsx**

`src/app/api/support/_lib/handler.ts`:
- `bodySchema` 의 세 번째 멤버(`kind: z.literal("refund")` 객체)를 지운다.
- import 에서 `REFUND_REASONS` 와 `PurchaseOption` 중 더 이상 안 쓰는 것을 지운다(`PurchaseOption` 은 `SupportOptionsDeps` 가 아직 쓴다).
- `CreateSupportDeps` 에서 `listPurchaseOptions` 를 지운다.
- `handleCreateSupportTicket` 에서 `let paymentId: string | null = null;` 을 `const paymentId: string | null = null;` 로 바꾸고, `} else if (input.kind === "refund") { ... }` 블록을 지운다.
- `DUPLICATE` 와 `if (!saved) return DUPLICATE;` 는 남긴다(`insertTicket` 이 null 을 돌려주는 계약은 그대로다). 그 위 주석을 `// INSERT 가 아무것도 돌려주지 않은 경우. 환불 티켓은 /api/refunds 가 넣는다.` 로 고친다.
- `SupportOptionsDeps.listPurchaseOptions` 와 `handleSupportOptions` 는 그대로 둔다.

`src/app/api/support/route.ts` 에서 `listPurchaseOptions` import 와 주입을 지운다.

`src/components/support/SupportDialog.tsx` 의 `toRows` refund 갈래에서 `meta: it.requested ? "요청됨" : formatOptionDate(it.createdAt, now)` → `meta: formatOptionDate(it.createdAt, now)`, `disabled: it.requested` → `disabled: false`. (Task 8 이 이 파일을 다시 손본다 — 여기서는 typecheck 만 통과시킨다.)

- [ ] **Step 7: 통과 확인**

Run: `npx vitest run src/lib/support src/app/api/support` 그리고 `npm run typecheck`
Expected: 전부 PASS

- [ ] **Step 8: 커밋**

```bash
git add src/lib/support/types.ts src/lib/support/store.ts src/lib/support/store.test.ts src/app/api/support/_lib/handler.ts src/app/api/support/_lib/handler.test.ts src/app/api/support/route.ts src/components/support/SupportDialog.tsx
git commit -m "feat(support): 환불 목록이 환불 가능한 결제와 환불액만 내려준다"
```

---

### Task 7: `POST /api/refunds`

**Files:**
- Create: `src/app/api/refunds/_lib/handler.ts`
- Create: `src/app/api/refunds/route.ts`
- Modify: `src/lib/support/store.ts` (`NewSupportTicket` 에 `status`·`adminNote`, `insertSupportTicket`)
- Modify: `src/lib/support/mail.ts` (`refundAmount`·`refundFailed`)
- Test: `src/app/api/refunds/_lib/handler.test.ts`, `src/lib/support/store.test.ts`, `src/lib/support/mail.test.ts`

**먼저 읽을 것:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`, 그리고 같은 모양의 `src/app/api/support/route.ts`(`after` 로 메일을 미루는 방식).

**Interfaces:**
- Consumes: Task 2 `isRefundable`·`refundAmount`; Task 4 `RefundCandidate`·`findRefundCandidate`·`executeRefund`·`markRefundFailed`; Task 5 `cancelPayment`·`PortOneError`·`PortOneNotConfiguredError`; 기존 `insertSupportTicket`·`composeSupportMail`·`Mailer`·`checkSupportLimit`·`getUser`·`optionLabel`·`REFUND_REASONS`·`BODY_MAX`
- Produces: `handleRefund(raw: unknown, d: RefundDeps): Promise<{ status: number; body: { amount: number; pending: boolean } | { error: string } }>`

**동작 표:**

| 상황 | 응답 |
|---|---|
| 비로그인 / 사용자 행 없음 | 401 |
| 본문이 스키마에 안 맞음 | 400 `요청을 확인해 주세요` |
| 한도 초과(`checkLimit` false) | 429 |
| 후보 없음 / `isRefundable` false / `executeRefund` 0행 | 409 `환불할 수 없는 결제예요` |
| `executeRefund` 가 던짐(잔액 CHECK 등) | 예외 그대로 → 라우트 500. 포트원 안 부름, 티켓 안 넣음 |
| 포트원 `PortOneNotConfiguredError` | `markFailed` 뒤 예외 그대로 → 라우트 503 |
| 포트원 그 외 실패 | 200 `{ amount, pending: true }`, `markFailed`, 티켓 `status: "open"`, 메일 제목 `[환불 실패]` |
| 성공 | 200 `{ amount, pending: false }`, 티켓 `status: "resolved"`, 메일 `[환불 요청]` |

- [ ] **Step 1: 실패하는 테스트 — handler**

`src/app/api/refunds/_lib/handler.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { PortOneError, PortOneNotConfiguredError } from "@/lib/payments/portone";
import type { RefundCandidate } from "@/lib/payments/refund-store";
import { handleRefund, type RefundDeps } from "./handler";

const NOW = new Date("2026-10-02T09:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const candidate: RefundCandidate = {
  purchaseId: "9", userId: "7", paymentId: "saju-abc", status: "paid", amount: 5000, tickets: 6,
  remaining: 4, paidAt: new Date(NOW.getTime() - DAY),
};

let deferred: (() => Promise<void>)[] = [];
const runDeferred = () => Promise.all(deferred.splice(0).map((t) => t()));

function deps(over: Partial<RefundDeps> = {}): RefundDeps {
  deferred = [];
  return {
    userId: "7",
    now: NOW,
    checkLimit: vi.fn(async () => true),
    getUser: vi.fn(async () => ({ displayName: "동진", email: "dj@example.com" })),
    findCandidate: vi.fn(async () => candidate),
    execute: vi.fn(async () => ({ paymentId: "saju-abc", remaining: 4 })),
    cancel: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    insertTicket: vi.fn(async () => ({ id: "42", createdAt: NOW.toISOString() })),
    mailer: { send: vi.fn(async () => {}) },
    defer: (task) => {
      deferred.push(task);
    },
    ...over,
  };
}

const body = { purchaseId: "9", reason: "실수로 결제했어요" };

describe("handleRefund", () => {
  it("비로그인은 401", async () => {
    expect((await handleRefund(body, deps({ userId: null }))).status).toBe(401);
  });

  it.each([
    [{}],
    [{ purchaseId: "abc", reason: "기타" }],
    [{ purchaseId: "9", reason: "그냥요" }],
    [{ purchaseId: "9" }],
  ])("본문이 틀리면 400 — %j", async (raw) => {
    const d = deps();
    expect((await handleRefund(raw, d)).status).toBe(400);
    expect(d.execute).not.toHaveBeenCalled();
  });

  it("한도를 넘으면 429", async () => {
    expect((await handleRefund(body, deps({ checkLimit: vi.fn(async () => false) }))).status).toBe(429);
  });

  it("후보가 없으면 409 — 남의 결제와 없는 결제를 가르지 않는다", async () => {
    const d = deps({ findCandidate: vi.fn(async () => null) });
    expect(await handleRefund(body, d)).toEqual({ status: 409, body: { error: "환불할 수 없는 결제예요" } });
    expect(d.execute).not.toHaveBeenCalled();
  });

  it("7일이 지났으면 409 — 목록이 걸렀어도 실행 직전에 다시 본다", async () => {
    const d = deps({ findCandidate: vi.fn(async () => ({ ...candidate, paidAt: new Date(NOW.getTime() - 8 * DAY) })) });
    expect((await handleRefund(body, d)).status).toBe(409);
    expect(d.execute).not.toHaveBeenCalled();
  });

  it("환불액은 서버가 계산한다 — 6장 5,000원에서 2장 쓰면 3,000원을 execute 에 넘긴다", async () => {
    const d = deps();
    const r = await handleRefund({ ...body, amount: 999999 }, d);
    expect(r).toEqual({ status: 200, body: { amount: 3000, pending: false } });
    expect(d.execute).toHaveBeenCalledWith({ purchaseId: "9", userId: "7", amount: 3000, now: NOW });
  });

  it("부분 환불이면 포트원에 amount 를 보내고, 전액이면 보내지 않는다", async () => {
    const partial = deps();
    await handleRefund(body, partial);
    expect(partial.cancel).toHaveBeenCalledWith("saju-abc", { reason: "실수로 결제했어요", amount: 3000 });

    const full = deps({ findCandidate: vi.fn(async () => ({ ...candidate, remaining: 6 })) });
    await handleRefund(body, full);
    expect(full.cancel).toHaveBeenCalledWith("saju-abc", { reason: "실수로 결제했어요" });
  });

  it("execute 가 0행이면 409 — 더블 클릭의 두 번째 요청. 포트원을 부르지 않는다", async () => {
    const d = deps({ execute: vi.fn(async () => null) });
    expect((await handleRefund(body, d)).status).toBe(409);
    expect(d.cancel).not.toHaveBeenCalled();
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it("execute 가 던지면(잔액 CHECK 롤백) 예외가 그대로 나간다 — 라우트가 500 으로 옮긴다. 포트원·티켓 없음", async () => {
    const d = deps({
      execute: vi.fn(async () => {
        throw new Error("check");
      }),
    });
    await expect(handleRefund(body, d)).rejects.toThrow("check");
    expect(d.cancel).not.toHaveBeenCalled();
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it("성공하면 resolved 티켓을 남기고 메일은 응답 뒤에 보낸다", async () => {
    const d = deps();
    await handleRefund({ ...body, body: "두 번 눌렀어요" }, d);
    expect(d.insertTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "7", kind: "refund", purchaseId: "9", refundReason: "실수로 결제했어요",
        targetLabel: "이용권 6장 · 5,000원", body: "두 번 눌렀어요", replyEmail: "dj@example.com",
        status: "resolved", adminNote: "자동 환불 3,000원",
      }),
    );
    expect(d.mailer!.send).not.toHaveBeenCalled();
    await runDeferred();
    expect(d.mailer!.send).toHaveBeenCalledTimes(1);
    const mail = (d.mailer!.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { subject: string; text: string };
    expect(mail.subject).toContain("[환불 요청]");
    expect(mail.text).toContain("환불액: 3,000원");
  });

  // DB 는 이미 refunded 다. 되돌리지 않고 운영자가 콘솔에서 마저 취소한다 — 설계 문서 "실행" 절.
  it("포트원이 실패하면 pending=true, refund_failed_at 을 찍고 open 티켓과 [환불 실패] 메일", async () => {
    const d = deps({
      cancel: vi.fn(async () => {
        throw new PortOneError("pg down", "PG_PROVIDER");
      }),
    });
    expect(await handleRefund(body, d)).toEqual({ status: 200, body: { amount: 3000, pending: true } });
    expect(d.markFailed).toHaveBeenCalledWith("9");
    expect(d.insertTicket).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open", adminNote: "포트원 취소 실패(PG_PROVIDER: pg down) — 콘솔에서 수동 취소" }),
    );
    await runDeferred();
    const mail = (d.mailer!.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as { subject: string };
    expect(mail.subject).toContain("[환불 실패]");
  });

  it("시크릿 미설정은 실패 기록 뒤 그대로 던진다 — 라우트가 503 으로 옮긴다", async () => {
    const d = deps({
      cancel: vi.fn(async () => {
        throw new PortOneNotConfiguredError();
      }),
    });
    await expect(handleRefund(body, d)).rejects.toBeInstanceOf(PortOneNotConfiguredError);
    expect(d.markFailed).toHaveBeenCalledWith("9");
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it("메일러가 없으면 건너뛰고 200", async () => {
    expect((await handleRefund(body, deps({ mailer: null }))).status).toBe(200);
  });
});
```

- [ ] **Step 2: 실패하는 테스트 — store·mail**

`src/lib/support/store.test.ts` 의 `describe("insertSupportTicket")` 에 하나 더한다(그 describe 의 픽스처 이름은 `base` 다):

```ts
  it("status 를 안 주면 open, resolved 면 resolved_at 도 같이 찍는다", async () => {
    const { client, queries, params } = recorder([[{ id: 1, created_at: T }]]);
    await insertSupportTicket({ ...base, status: "resolved", adminNote: "자동 환불 3,000원" }, client);
    expect(queries[0]).toContain("resolved_at");
    expect(params[0]).toContain("resolved");
    expect(params[0]).toContain("자동 환불 3,000원");
  });
```

`src/lib/support/mail.test.ts` 에 둘 더한다(그 파일의 `base` 픽스처를 쓴다):

```ts
  it("환불액을 적는다", () => {
    const { text } = composeSupportMail({ ...base, kind: "refund", refundReason: "기타", refundAmount: 3000, body: "" });
    expect(text).toContain("환불액: 3,000원");
  });

  it("포트원 실패는 제목이 [환불 실패] 고 수동 취소 안내가 있다", () => {
    const { subject, text } = composeSupportMail({
      ...base, kind: "refund", refundReason: "기타", refundAmount: 3000, refundFailed: true, body: "",
    });
    expect(subject).toContain("[환불 실패]");
    expect(text).toContain("수동 취소");
  });
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/app/api/refunds src/lib/support`
Expected: FAIL — `./handler` 없음; store 테스트는 `resolved_at` 미포함; mail 테스트는 `환불액` 미포함

- [ ] **Step 4: `insertSupportTicket` 이 status·admin_note 를 받게 한다**

`src/lib/support/store.ts` 의 `NewSupportTicket` 에 두 필드를 더한다:

```ts
  /** 자동 환불은 넣는 즉시 처리 끝이다 — 'resolved' 로 넣고 admin_note 에 금액을 남긴다. 기본 'open'. */
  status?: "open" | "resolved";
  adminNote?: string | null;
```

`insertSupportTicket` 의 INSERT 를 바꾼다:

```ts
  const status = t.status ?? "open";
  const rows = await client`
    INSERT INTO support_tickets
      (user_id, kind, target_kind, target_ref, target_label, purchase_id, refund_reason, body, reply_email,
       status, admin_note, resolved_at)
    VALUES (
      ${t.userId}::bigint, ${t.kind}, ${t.targetKind}, ${t.targetRef}, ${t.targetLabel},
      ${t.purchaseId}::bigint, ${t.refundReason}, ${t.body}, ${t.replyEmail},
      ${status}, ${t.adminNote ?? null},
      CASE WHEN ${status} = 'resolved' THEN now() ELSE NULL END
    )
    ON CONFLICT DO NOTHING
    RETURNING id, created_at
  `;
```

- [ ] **Step 5: 메일에 환불액·실패를 싣는다**

`src/lib/support/mail.ts`:
- `SupportMailInput` 에 `refundAmount?: number | null;` 과 `refundFailed?: boolean;` 을 더한다.
- `composeSupportMail` 에서 `const head = ...` 를 바꾼다:

```ts
  const head = i.kind === "refund" && i.refundFailed ? "[환불 실패]" : `[${KIND_LABEL[i.kind]}]`;
```

- `if (i.refundReason) lines.push(...)` 다음에:

```ts
  if (i.refundAmount != null) lines.push(`환불액: ${i.refundAmount.toLocaleString("ko-KR")}원`);
  if (i.refundFailed) lines.push("⚠️ 포트원 취소 실패 — DB 는 refunded 다. 콘솔에서 수동 취소할 것.");
```

- [ ] **Step 6: handler 구현**

`src/app/api/refunds/_lib/handler.ts`:

```ts
import { z } from "zod";
import { PortOneNotConfiguredError } from "@/lib/payments/portone";
import { isRefundable, refundAmount } from "@/lib/payments/refund";
import type { RefundCandidate } from "@/lib/payments/refund-store";
import { composeSupportMail } from "@/lib/support/mail";
import type { Mailer } from "@/lib/support/mailer";
import type { NewSupportTicket } from "@/lib/support/store";
import { BODY_MAX, REFUND_REASONS, optionLabel } from "@/lib/support/types";

const bodySchema = z.object({
  purchaseId: z.string().regex(/^\d+$/),
  reason: z.enum(REFUND_REASONS),
  body: z.string().trim().max(BODY_MAX).default(""),
});

export interface RefundDeps {
  userId: string | null;
  now: Date;
  checkLimit(userId: string): Promise<boolean>;
  getUser(userId: string): Promise<{ displayName: string | null; email: string | null } | null>;
  findCandidate(purchaseId: string, userId: string): Promise<RefundCandidate | null>;
  execute(a: { purchaseId: string; userId: string; amount: number; now: Date }): Promise<{ paymentId: string; remaining: number } | null>;
  cancel(paymentId: string, o: { reason: string; amount?: number }): Promise<void>;
  markFailed(purchaseId: string): Promise<void>;
  insertTicket(t: NewSupportTicket): Promise<{ id: string; createdAt: string } | null>;
  mailer: Mailer | null;
  /** 응답 뒤로 미룰 일(next/server 의 after). 메일을 여기로 미루는 이유는 support 핸들러와 같다. */
  defer(task: () => Promise<void>): void;
}

type Result = { status: number; body: { amount: number; pending: boolean } | { error: string } };

const BAD = { status: 400, body: { error: "요청을 확인해 주세요" } } as const;
const NOT_REFUNDABLE = { status: 409, body: { error: "환불할 수 없는 결제예요" } } as const;

/** 목록(toPurchaseOption)과 같은 "이용권 N장 · M원" — 티켓·메일의 대상 라벨. */
function candidateLabel(c: RefundCandidate): string {
  return optionLabel({
    title: c.tickets === null ? "이용권" : `이용권 ${c.tickets}장`,
    sub: `${c.amount.toLocaleString("ko-KR")}원`,
  });
}

/**
 * 환불을 그 자리에서 끝낸다: 규칙 검사 → DB 차감(한 문장) → 포트원 취소 → 기록·메일.
 *
 * 포트원 실패를 DB 롤백으로 돌리지 않는다 — "돈은 안 나갔는데 이용권이 사라진" 상태는 운영자가
 * 콘솔에서 취소를 마저 하면 맞춰지지만, 반대("돈은 나갔는데 이용권이 남은")는 유저가 그 이용권을
 * 더 써 버릴 수 있어 되돌리기 어렵다. 유저에게는 pending 으로 "접수" 를 알린다.
 *
 * execute 가 던지는 경우(잔액 CHECK 롤백)는 잡지 않는다 — DB 가 바뀌지 않았으니 포트원도 티켓도
 * 없어야 하고, 라우트가 500 으로 옮긴다. 시크릿 미설정(PortOneNotConfiguredError)은 실패 기록만
 * 남기고 다시 던진다 — 라우트가 503 으로 옮긴다.
 */
export async function handleRefund(raw: unknown, d: RefundDeps): Promise<Result> {
  if (!d.userId) return { status: 401, body: { error: "로그인이 필요합니다" } };
  const userId = d.userId;

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return BAD;
  const input = parsed.data;

  if (!(await d.checkLimit(userId))) return { status: 429, body: { error: "잠시 후 다시 시도해 주세요" } };

  const user = await d.getUser(userId);
  if (!user) return { status: 401, body: { error: "로그인이 필요합니다" } };

  // 목록이 걸렀어도 실행 직전에 다시 본다 — 그 사이 7일이 지났거나 이용권을 썼을 수 있다.
  // 클라이언트가 보낸 금액은 받지 않는다(스키마에 없다). 여기서 읽은 행으로 계산한다.
  const c = await d.findCandidate(input.purchaseId, userId);
  if (!c || !isRefundable(c, d.now)) return NOT_REFUNDABLE;
  const amount = refundAmount(c);

  const done = await d.execute({ purchaseId: c.purchaseId, userId, amount, now: d.now });
  if (!done) return NOT_REFUNDABLE;

  // 전액이면 amount 를 생략한다 — 포트원은 amount 없는 요청을 전액 취소로 본다.
  const cancelArgs: { reason: string; amount?: number } =
    amount === c.amount ? { reason: input.reason } : { reason: input.reason, amount };

  let failure: string | null = null;
  try {
    await d.cancel(done.paymentId, cancelArgs);
  } catch (e) {
    await d.markFailed(c.purchaseId);
    if (e instanceof PortOneNotConfiguredError) throw e;
    const type = e instanceof Error && "type" in e && typeof e.type === "string" ? e.type : "unknown";
    const message = e instanceof Error ? e.message : String(e);
    failure = `${type}: ${message}`;
    console.error("[refund] 포트원 취소 실패", c.purchaseId, done.paymentId, failure);
  }

  const ticket: NewSupportTicket = {
    userId,
    kind: "refund",
    targetKind: null,
    targetRef: null,
    targetLabel: candidateLabel(c),
    purchaseId: c.purchaseId,
    refundReason: input.reason,
    body: input.body,
    replyEmail: user.email,
    status: failure ? "open" : "resolved",
    adminNote: failure
      ? `포트원 취소 실패(${failure}) — 콘솔에서 수동 취소`
      : `자동 환불 ${amount.toLocaleString("ko-KR")}원`,
  };
  const saved = await d.insertTicket(ticket);

  const mailer = d.mailer;
  if (!mailer) {
    console.warn("[refund] 메일 설정이 비어 있어 알림을 건너뜁니다", c.purchaseId);
  } else {
    const mail = composeSupportMail({
      ticketId: saved?.id ?? "-",
      createdAt: saved?.createdAt ?? d.now.toISOString(),
      kind: "refund",
      userId,
      userName: user.displayName ?? "이름 없음",
      email: user.email,
      targetLabel: ticket.targetLabel,
      paymentId: done.paymentId,
      refundReason: input.reason,
      refundAmount: amount,
      refundFailed: failure !== null,
      body: input.body,
    });
    d.defer(async () => {
      try {
        await mailer.send(mail);
      } catch (e) {
        console.error("[refund] 알림 메일 실패", c.purchaseId, e);
      }
    });
  }

  return { status: 200, body: { amount, pending: failure !== null } };
}
```

- [ ] **Step 7: route 구현**

`src/app/api/refunds/route.ts`:

```ts
import { NextResponse, after } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { PortOneNotConfiguredError, cancelPayment } from "@/lib/payments/portone";
import { executeRefund, findRefundCandidate, markRefundFailed } from "@/lib/payments/refund-store";
import { createSupportMailer } from "@/lib/support/mailer";
import { checkSupportLimit } from "@/lib/support/rate-limit";
import { insertSupportTicket } from "@/lib/support/store";
import { handleRefund } from "./_lib/handler";

/**
 * 이용권 부분 환불. 지원 모달의 "환불 요청" 이 여기로 온다 — 접수가 아니라 실행이다.
 * 포트원 시크릿이 없으면 503 — 결제창을 열 수 없는 환경과 같은 판단(availableMethods).
 */
export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleRefund(raw, {
      userId: session?.userId ?? null,
      now: new Date(),
      checkLimit: checkSupportLimit,
      getUser,
      findCandidate: findRefundCandidate,
      execute: executeRefund,
      cancel: (paymentId, o) => cancelPayment(paymentId, o),
      markFailed: markRefundFailed,
      insertTicket: insertSupportTicket,
      mailer: createSupportMailer(),
      defer: after,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    if (e instanceof PortOneNotConfiguredError) {
      return NextResponse.json({ error: "지금은 환불을 처리할 수 없어요" }, { status: 503 });
    }
    console.error("[POST /api/refunds]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
```

- [ ] **Step 8: 통과 확인**

Run: `npx vitest run src/app/api/refunds src/lib/support` 그리고 `npm run typecheck && npm run lint`
Expected: 전부 PASS, lint 에러 0

- [ ] **Step 9: 커밋**

```bash
git add src/app/api/refunds src/lib/support/store.ts src/lib/support/store.test.ts src/lib/support/mail.ts src/lib/support/mail.test.ts
git commit -m "feat(refunds): POST /api/refunds — 규칙 검사·DB 차감·포트원 취소를 그 자리에서 끝낸다"
```

---

### Task 8: 모달 — 정책·환불액·즉시 환불

**Files:**
- Modify: `src/lib/support/types.ts` (문구 상수·함수)
- Modify: `src/components/support/SupportDialog.tsx`
- Test: `src/lib/support/types.test.ts`

**Interfaces:**
- Consumes: Task 6 `PurchaseOption { remaining, refundAmount }`; Task 7 `POST /api/refunds` → `{ amount, pending }`
- Produces: `REFUND_POLICY: readonly [string, string]`, `refundButtonLabel(amount: number | null): string`, `refundSentDesc(amount: number, pending: boolean): string`

이 컴포넌트에는 테스트가 없다(`src/components/support/` 에 `backdrop.test.ts` 뿐). 순수 함수로 뽑을 수 있는 문구는 `types.ts` 에 두고 테스트한다.

- [ ] **Step 1: 실패하는 테스트 — 문구 함수**

`src/lib/support/types.test.ts` 끝에 추가(import 는 파일 머리의 기존 import 에 합친다):

```ts
describe("환불 문구", () => {
  it("정책 두 줄", () => {
    expect(REFUND_POLICY).toEqual([
      "결제일로부터 7일 이내, 사용하지 않은 이용권만 환불돼요.",
      "쓴 장수는 장당 1,000원으로 계산하고, 보너스 장수는 환불되지 않아요.",
    ]);
  });

  it("버튼은 고른 결제의 환불액 — 안 골랐으면 금액 없이", () => {
    expect(refundButtonLabel(3000)).toBe("3,000원 환불받기");
    expect(refundButtonLabel(null)).toBe("환불받기");
  });

  it("완료 문구는 금액과 수단, 보류면 접수 안내", () => {
    expect(refundSentDesc(3000, false)).toBe("3,000원이 결제하신 수단으로 돌아가요. 카드사에 따라 3~7일 걸려요.");
    expect(refundSentDesc(3000, true)).toBe("환불을 접수했어요. 처리에 시간이 걸릴 수 있어요.");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/lib/support/types.test.ts`
Expected: FAIL — 세 export 가 없다

- [ ] **Step 3: 문구 함수 구현**

`src/lib/support/types.ts` 끝에 추가:

```ts
/** 환불 탭 상단 정책. 결제 화면(CheckoutView)의 안내와 같은 규칙을 말한다. */
export const REFUND_POLICY = [
  "결제일로부터 7일 이내, 사용하지 않은 이용권만 환불돼요.",
  "쓴 장수는 장당 1,000원으로 계산하고, 보너스 장수는 환불되지 않아요.",
] as const;

export function refundButtonLabel(amount: number | null): string {
  return amount === null ? "환불받기" : `${amount.toLocaleString("ko-KR")}원 환불받기`;
}

/** pending 은 포트원 취소가 실패해 운영자가 마저 처리하는 경우 — 유저에게는 "접수" 로 보인다. */
export function refundSentDesc(amount: number, pending: boolean): string {
  if (pending) return "환불을 접수했어요. 처리에 시간이 걸릴 수 있어요.";
  return `${amount.toLocaleString("ko-KR")}원이 결제하신 수단으로 돌아가요. 카드사에 따라 3~7일 걸려요.`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/lib/support/types.test.ts`
Expected: PASS

- [ ] **Step 5: 모달 수정**

`src/components/support/SupportDialog.tsx`:

(a) import 에 `REFUND_POLICY, refundButtonLabel, refundSentDesc` 를 더한다.

(b) `COPY.refund` 를 바꾼다:

```ts
  refund: {
    title: "이용권 환불",
    desc: "환불받을 결제를 골라 주세요.",
    picker: "환불 가능한 이용권",
    textLabel: "추가 설명 (선택)",
    placeholder: "필요하면 상황을 덧붙여 주세요.",
    submit: "환불받기",
    sentTitle: "환불이 완료됐어요",
    sentDesc: "",
  },
```

(c) `Row` 에 `amount?: number` 를 더하고, `toRows` 의 refund 갈래를 바꾼다:

```ts
  return {
    rows: o.items.map((it) => ({
      key: it.purchaseId,
      title: it.title,
      sub: `남은 ${it.remaining}장 → ${it.refundAmount.toLocaleString("ko-KR")}원 환불`,
      meta: formatOptionDate(it.createdAt, now),
      disabled: false,
      amount: it.refundAmount,
    })),
    balance: o.balance,
  };
```

(d) 상태에 `const [result, setResult] = useState<{ amount: number; pending: boolean } | null>(null);` 를 더한다.

(e) `submit()` 을 바꾼다 — refund 는 다른 주소로, 응답을 `result` 에 담는다:

```ts
  async function submit() {
    if (!ready) return;
    const row = rows.find((r) => r.key === pick);
    const isRefund = kind === "refund";
    const url = isRefund ? "/api/refunds" : "/api/support";
    const payload = isRefund
      ? { purchaseId: pick, reason, body: text }
      : kind === "error"
        ? { kind, target: row?.target, body: text }
        : { kind, body: text };

    setSending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        if (isRefund) setResult((await res.json()) as { amount: number; pending: boolean });
        setSent(true);
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? FAIL);
    } catch {
      setError(FAIL);
    } finally {
      setSending(false);
    }
  }
```

(f) 완료 화면의 제목과 설명을 바꾼다:

```tsx
          <div className="text-[17px] font-bold tracking-[-0.03em]">
            {kind === "refund" && result?.pending ? "환불을 접수했어요" : copy.sentTitle}
          </div>
          <div className="mt-1.5 text-[13.5px] text-slate-500">
            {kind === "refund" && result ? refundSentDesc(result.amount, result.pending) : copy.sentDesc}
          </div>
```

(g) 환불 탭 상단, `{copy.picker && (` 블록 **앞**에 정책 박스를 넣는다:

```tsx
          {kind === "refund" && (
            <ul className="mt-[18px] rounded-[14px] bg-slate-50 px-4 py-3 text-[12.5px] leading-[1.6] text-slate-600 [word-break:keep-all]">
              {REFUND_POLICY.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
```

(h) 빈 목록 문구 `환불할 결제 내역이 없어요` → `지금 환불 가능한 이용권이 없어요`.

(i) 제출 버튼 문구를 바꾼다:

```tsx
            {sending
              ? "보내는 중…"
              : kind === "refund"
                ? refundButtonLabel(rows.find((r) => r.key === pick)?.amount ?? null)
                : copy.submit}
```

(j) `sending` 중에는 이미 `ready` 가 false 라 버튼이 잠긴다 — 더블 클릭 방어는 그대로 둔다.

- [ ] **Step 6: 검사**

Run: `npm run typecheck && npm run lint && npm test`
Expected: 전부 통과

- [ ] **Step 7: 커밋**

```bash
git add src/components/support/SupportDialog.tsx src/lib/support/types.ts src/lib/support/types.test.ts
git commit -m "feat(support): 환불 탭이 정책과 환불 가능한 이용권·환불액을 보여주고 그 자리에서 환불한다"
```

---

### Task 9: 끝단 검증 (컨트롤러가 한다)

**Files:** 없음(코드 변경 없음)

- [ ] **Step 1: 개발 DB 에 0056·0057 적용**

Run: `npm run db:migrate`
Expected: `applying 0056_… / applying 0057_… / done (2 applied, …)`

- [ ] **Step 2: 백필 결과 확인**

개발 DB 에서(Neon 콘솔 SQL 편집기):

```sql
SELECT p.user_id, SUM(p.remaining) AS rem, w.balance
  FROM purchases p JOIN ticket_wallets w ON w.user_id = p.user_id
 WHERE p.status = 'paid'
 GROUP BY p.user_id, w.balance
HAVING SUM(p.remaining) > w.balance;
```

Expected: 0행(잔여 합이 잔액을 넘는 유저가 없다)

- [ ] **Step 3: 브라우저 — 테스트 채널로 결제 → 환불**

1. 아무 계정으로 `/checkout` 에서 1,000원 결제(테스트 채널). 지갑 +1.
2. 헤더 메뉴 → 환불 요청. 정책 2줄, 목록에 `이용권 1장 · 1,000원 / 남은 1장 → 1,000원 환불`, 버튼 `1,000원 환불받기`.
3. 사유 고르고 환불. 완료 문구 "1,000원이 결제하신 수단으로 돌아가요…". 지갑 0장.
4. 포트원 콘솔 → 결제 내역에서 그 건이 **취소** 상태.
5. 다시 환불 요청 열기 → "지금 환불 가능한 이용권이 없어요".
6. 부분: 6장 묶음 5,000원 결제 → 리포트 하나 열어 1장 사용 → 환불 목록에 `남은 5장 → 4,000원 환불` → 환불 → 콘솔에서 부분 취소 4,000원 확인, 지갑 0장.
7. `support_tickets` 에 `kind='refund', status='resolved', admin_note='자동 환불 4,000원'` 행.

- [ ] **Step 4: 운영 반영 메모**

운영 DB 에 0056·0057 을 코드 배포 **전에** 적용한다(컬럼 추가는 안전). 백필은 운영 지갑 상태에서 한 번만 돈다.
