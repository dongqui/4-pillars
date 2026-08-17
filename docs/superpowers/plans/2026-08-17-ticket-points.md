# 이용권(포인트) 결제 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로필 단건 결제(9,900원)를 걷어내고, 돈으로 이용권을 충전해 서비스마다 1장씩 쓰는 구조로 바꾼다.

**Architecture:** 잔액은 `ticket_wallets` 한 행이 소유하고 `CHECK (balance >= 0)` 가 지킨다. 열람 권한은 `entitlements(user_id, feature, subject_key)` 의 UNIQUE 가 지킨다. Neon HTTP 드라이버에는 대화형 트랜잭션이 없으므로 **적립과 차감은 각각 CTE 한 문장**이고, 동시성 판정은 앱이 아니라 제약이 내린다. 포트원 결제 파이프라인(주문 생성 → 결제창 → 완료 API/웹훅 이중 확정)은 그대로 재사용한다.

**Tech Stack:** Next.js 16.2.10 (App Router, 서버 컴포넌트), React 19, TypeScript, Neon serverless Postgres (HTTP 드라이버), zod 4, PortOne v2, Vitest 4, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-08-17-ticket-points-design.md`

## Global Constraints

- **마이그레이션 파일 하나에 SQL 문장은 하나만.** `scripts/migrate.mts` 는 파일 전체를 prepared statement 하나로 보내고, Neon HTTP 드라이버는 한 쿼리에 여러 문장을 담는 것을 거부한다.
- **주석은 한국어로, "왜"를 적는다.** 이 저장소의 기존 주석 밀도와 어조를 따른다. "무엇"은 코드가 이미 말한다.
- **금액·장수는 서버 상수에서만 온다.** 요청 스키마에 금액·장수 필드를 두지 않는다.
- **`src/lib/**` 은 `src/app/**` 을 import 하지 않는다.** 반대 방향만 허용한다.
- **없는 대상과 남의 대상을 구분하지 않는다.** 둘 다 404. 구분하면 id 로 존재 여부를 훑을 수 있다.
- **DB 컬럼 이름을 아는 곳은 store 모듈 하나뿐이다.** 핸들러·화면은 도메인 타입만 본다.
- **bigint 컬럼은 JS 문자열로 접는다.** `Number` 로 받으면 큰 값에서 정밀도가 깨진다.
- 테스트: `npx vitest run <경로>`. 전체는 `npm test`. 타입 검사 `npm run typecheck`, 린트 `npm run lint`.
- 커밋 메시지는 한국어 본문에 `feat(...)`/`refactor(...)`/`test(...)` 접두사. 기존 로그 형식을 따른다.

---

## File Structure

**새로 만드는 것**

| 경로 | 책임 |
|---|---|
| `migrations/0012_ticket_wallets.sql` ~ `0018_drop_purchases_paid_unique.sql` | 스키마 (7개 파일, 각 1문장) |
| `src/lib/tickets/features.ts` | 이용권을 쓰는 서비스 목록·단가·`subject_key` 규칙 |
| `src/lib/tickets/wallet.ts` | 잔액 읽기 + 결제 확정·적립 CTE (SQL 소유) |
| `src/lib/tickets/spend.ts` | 차감 CTE + 결과 해석 (SQL 소유) |
| `src/lib/nav/next-param.ts` | `?next` 복귀 경로 검증 (오픈 리다이렉트 방지) |
| `src/app/api/tickets/spend/route.ts` + `_lib/handler.ts` | 차감 API |
| `src/app/checkout/_components/PackagePicker.tsx` | 충전 패키지 3장 선택 UI |
| `src/app/report/_hooks/use-unlock.ts` | 리포트 열기(차감) 클라이언트 훅 |

**바꾸는 것**

| 경로 | 무엇이 |
|---|---|
| `src/lib/payments/pricing.ts` | 단건 가격표 → 충전 패키지표 |
| `src/lib/payments/store.ts` | `PendingOrder.profileId` 제거, `tickets` 추가, `markPurchasePaid` 이관 |
| `src/lib/payments/confirm.ts` | `ConfirmResult` 에서 `profileId` 제거 |
| `src/lib/payments/deps.ts` | `markPaid` 를 적립 CTE 로 배선 |
| `src/lib/profiles/store.ts` | `isPaid`(purchases 조인) → `isUnlocked`(entitlements 조인) |
| `src/app/api/payments/orders/_lib/handler.ts` + `route.ts` | `profileId` → `packageId` + `next` |
| `src/app/api/payments/complete/_lib/handler.ts` | 응답 `profileId` → `balance` |
| `src/app/checkout/page.tsx`, `_components/*`, `_hooks/use-payment.ts`, `_lib/pricing.ts` | 충전 화면으로 |
| `src/app/checkout/complete/page.tsx` | `?profile` → `?next` |
| `src/app/report/_lib/access.ts`, `page.tsx`, `_components/ReportBody.tsx`, `_components/LockedSections.tsx` | `isPaid` → `isUnlocked`, CTA 를 차감 버튼으로 |
| `src/app/home/page.tsx`, `_components/HomeHeader.tsx` | 잔액 표시 |

**지우는 것**

- `src/lib/profiles/products.ts` (+ `PRODUCT_FULL_REPORT`)
- `src/app/checkout/_lib/to-order.ts`, `to-order.test.ts`

---

## Task 1: 스키마 마이그레이션

**Files:**
- Create: `migrations/0012_ticket_wallets.sql`
- Create: `migrations/0013_entitlements.sql`
- Create: `migrations/0014_entitlements_unique.sql`
- Create: `migrations/0015_ticket_entries.sql`
- Create: `migrations/0016_ticket_entries_user_idx.sql`
- Create: `migrations/0017_purchases_tickets.sql`
- Create: `migrations/0018_drop_purchases_paid_unique.sql`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: 테이블 `ticket_wallets(user_id, balance, updated_at)`, `entitlements(id, user_id, feature, subject_key, cost, created_at)`, `ticket_entries(id, user_id, delta, reason, purchase_id, entitlement_id, created_at)`, 컬럼 `purchases.tickets int`

이 태스크에는 단위 테스트가 없다. SQL 스키마는 vitest 로 검증할 수 없고, 검증은 실제 마이그레이션 실행이다.

- [ ] **Step 1: `migrations/0012_ticket_wallets.sql` 작성**

```sql
-- 이용권 잔액. 사용자당 한 행이고 잔액의 유일한 출처다.
--
-- ⚠️ CHECK (balance >= 0) 가 이 테이블의 존재 이유다. Neon HTTP 드라이버에는
-- 대화형 트랜잭션이 없어 "읽고 판단하고 차감"을 앱에서 하면 동시 요청 두 개가
-- 같은 잔액을 읽는다. 차감 UPDATE 가 음수를 만드는 순간 이 제약이 문장 전체를
-- 되돌린다 — 앱 코드가 실수해도 잔액은 새지 않는다.
-- 이 제약을 지우거나 완화하면 동시성 방어선이 통째로 사라진다.
--
-- 행이 없는 사용자 = 잔액 0 이다. 회원가입 때 미리 만들지 않는다: 적립이
-- INSERT ... ON CONFLICT DO UPDATE 라 첫 충전에서 생기고, 차감 쪽은 행이 없으면
-- NULL >= 1 이 거짓이라 알아서 잔액 부족으로 떨어진다.
CREATE TABLE IF NOT EXISTS ticket_wallets (
  user_id    bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance    int NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: `migrations/0013_entitlements.sql` 작성**

```sql
-- 이용권을 써서 얻은 열람 권한. 한 번 생기면 영구다 (재열람은 무료).
--
-- feature + subject_key 로 서비스를 일반화한다 — 새 서비스는 테이블을 건드리지
-- 않고 값만 추가한다:
--   전체 리포트 : ('full_report',   프로필 id)
--   궁합        : ('compatibility', 정렬한 두 프로필 id, 예 '12:34')
--
-- cost 를 박아 두는 이유: 가격표는 바뀌지만 "이때 몇 장을 냈는가"는 사실이다.
-- 환불·CS 때 현재 가격표로 역산하면 과거 건이 틀린다.
CREATE TABLE IF NOT EXISTS entitlements (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature     text NOT NULL,
  subject_key text NOT NULL,
  cost        int NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 3: `migrations/0014_entitlements_unique.sql` 작성**

```sql
-- 같은 사용자가 같은 대상에 두 번 차감되지 않게 막는다.
--
-- ⚠️ 이 인덱스는 중복 방지이자 멱등 키다. 차감 CTE 의 INSERT 가 여기서 충돌하면
-- ON CONFLICT DO NOTHING 으로 접히고, 뒤따르는 차감 UPDATE 가 EXISTS 에 막혀
-- 아예 일어나지 않는다 — 더블클릭·재시도 방어가 전부 이 인덱스에 걸려 있다.
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_unique
  ON entitlements (user_id, feature, subject_key);
```

- [ ] **Step 4: `migrations/0015_ticket_entries.sql` 작성**

```sql
-- 잔액이 왜 그 값인지 설명하는 원장. delta 양수 = 적립, 음수 = 사용.
--
-- 잔액 계산에는 쓰지 않는다 — 잔액의 출처는 ticket_wallets 하나다. 여기서
-- SUM 을 떠서 잔액으로 쓰면 값이 두 벌이 되어 언젠가 어긋난다 (profiles 에
-- is_paid 컬럼을 두지 않은 것과 같은 판단, src/lib/profiles/store.ts).
--
-- grant(수기 지급)·refund 는 지금 쓰는 경로가 없지만 CHECK 목록에 미리 넣는다.
-- 목록을 넓히려면 마이그레이션이 필요한데, 그게 필요한 시점은 대개 급한 CS 상황이다.
--
-- FK 가 ON DELETE SET NULL 인 이유: 원장은 지워지면 안 된다. 참조 대상이
-- 사라져도 "언제 몇 장이 움직였다"는 남아야 한다.
CREATE TABLE IF NOT EXISTS ticket_entries (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta          int NOT NULL CHECK (delta <> 0),
  reason         text NOT NULL CHECK (reason IN ('purchase','spend','grant','refund')),
  purchase_id    bigint REFERENCES purchases(id) ON DELETE SET NULL,
  entitlement_id bigint REFERENCES entitlements(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
```

- [ ] **Step 5: `migrations/0016_ticket_entries_user_idx.sql` 작성**

```sql
-- 내 이용권 내역 조회용. purchases_user_idx 와 같은 모양이다.
CREATE INDEX IF NOT EXISTS ticket_entries_user_idx
  ON ticket_entries (user_id, created_at DESC);
```

- [ ] **Step 6: `migrations/0017_purchases_tickets.sql` 작성**

```sql
-- 이 결제가 적립할 이용권 장수(보너스 포함). 주문 생성 시점에 서버가 박는다 —
-- amount 와 같은 판단이다. 브라우저가 보내는 값이 아니라 손댈 수 없고, 확정
-- 시점에 가격표를 다시 읽지 않아 그 사이 가격표가 바뀌어도 산 만큼 받는다.
--
-- NOT NULL 을 걸지 않는 이유: 이 컬럼이 붙기 전 행과 PG 를 거치지 않는 행(수기
-- 지급 등)은 NULL 이다. 적립 CTE 는 NULL 을 만나면 balance NOT NULL 위반으로
-- 터진다 — 조용히 0장 적립되는 것보다 낫다.
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS tickets int;
```

- [ ] **Step 7: `migrations/0018_drop_purchases_paid_unique.sql` 작성**

```sql
-- (profile_id, product) 유니크는 "프로필당 한 번만 산다"는 단건 상품 전제였다.
-- 이용권은 같은 패키지를 반복 구매한다. profile_id 는 이제 항상 NULL 이다 —
-- 0007 이 "프로필 단위가 아닌 상품을 같은 테이블에 담기 위해" 열어 둔 자리를 쓴다.
DROP INDEX IF EXISTS purchases_paid_unique;
```

- [ ] **Step 8: 마이그레이션 실행**

```bash
npm run db:migrate
```

Expected: `applying 0012_ticket_wallets.sql` 부터 `applying 0018_drop_purchases_paid_unique.sql` 까지 7줄과 `done (7 applied, 11 skipped)`.

에러가 나면 그 파일에 문장이 둘 이상 들어갔거나 참조 테이블 순서가 틀린 것이다. `0015` 는 `0013`(entitlements)과 `purchases` 를 참조하므로 반드시 그 뒤여야 한다.

- [ ] **Step 9: 커밋**

```bash
git add migrations/
git commit -m "feat(tickets): 이용권 지갑·권한·원장 스키마"
```

---

## Task 2: 충전 패키지 가격표

**Files:**
- Modify: `src/lib/payments/pricing.ts` (전체 교체)
- Test: `src/lib/payments/pricing.test.ts` (새 파일)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `TICKET_PACKAGE_IDS: readonly ["t1", "t5", "t10"]`
  - `type TicketPackageId = "t1" | "t5" | "t10"`
  - `interface TicketPackage { id: TicketPackageId; amount: number; tickets: number; bonus: number }`
  - `getPackage(id: TicketPackageId): TicketPackage`
  - `listPackages(): TicketPackage[]`
  - `creditedTickets(p: TicketPackage): number`
  - `packageOrderName(p: TicketPackage): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/payments/pricing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  TICKET_PACKAGE_IDS,
  creditedTickets,
  getPackage,
  listPackages,
  packageOrderName,
} from "./pricing";

describe("TICKET_PACKAGES", () => {
  it("listPackages 는 TICKET_PACKAGE_IDS 순서를 그대로 낸다 — 화면 순서가 여기서 정해진다", () => {
    expect(listPackages().map((p) => p.id)).toEqual([...TICKET_PACKAGE_IDS]);
  });

  it("모든 패키지의 청구 금액과 기본 장수가 양수다", () => {
    for (const p of listPackages()) {
      expect(p.amount).toBeGreaterThan(0);
      expect(p.tickets).toBeGreaterThan(0);
      expect(p.bonus).toBeGreaterThanOrEqual(0);
    }
  });

  it("장수가 많은 패키지일수록 장당 단가가 싸다 — 묶음 유인이 사라지면 표가 잘못된 것이다", () => {
    const perTicket = listPackages().map((p) => p.amount / creditedTickets(p));
    for (let i = 1; i < perTicket.length; i++) {
      expect(perTicket[i]).toBeLessThan(perTicket[i - 1]);
    }
  });
});

describe("creditedTickets", () => {
  it("기본 + 보너스", () => {
    expect(creditedTickets(getPackage("t5"))).toBe(6);
    expect(creditedTickets(getPackage("t10"))).toBe(13);
    expect(creditedTickets(getPackage("t1"))).toBe(1);
  });
});

describe("packageOrderName", () => {
  it("적립 장수를 쓴다 — 카드 명세서에 실제로 받는 장수가 찍혀야 한다", () => {
    expect(packageOrderName(getPackage("t5"))).toBe("이용권 6장");
  });

  it("프로필 이름을 넣지 않는다 — 명세서에 타인의 이름이 남을 이유가 없다", () => {
    for (const p of listPackages()) {
      expect(packageOrderName(p)).toMatch(/^이용권 \d+장$/);
    }
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/lib/payments/pricing.test.ts
```

Expected: FAIL — `getPackage`, `listPackages` 등이 `./pricing` 에 없다는 import 에러.

- [ ] **Step 3: `src/lib/payments/pricing.ts` 를 통째로 교체한다**

```ts
/**
 * 이용권 충전 패키지. 주문 생성 API 가 이 표에서 청구 금액과 적립 장수를 박고,
 * 화면은 읽기만 한다 — 두 곳에 숫자를 적어 두면 반드시 어긋난다.
 *
 * amount 를 tickets × 1000 으로 계산하지 않는 이유: 표시용 단가와 실제 청구 금액은
 * 언제든 갈라질 수 있고(프로모션, 반올림), 청구 금액은 파생값이 아니라 명시값이어야
 * 한다. 반대로 적립 장수는 파생값이라 creditedTickets 한 곳에서만 더한다.
 */

/**
 * 순서가 곧 화면 순서다. 타입을 배열에서 파생시키는 이유는 PAYMENT_METHOD_IDS 와
 * 같다 — 배열과 유니온을 따로 적으면 한쪽만 고쳐도 컴파일이 통과해 조용히 어긋난다.
 */
export const TICKET_PACKAGE_IDS = ["t1", "t5", "t10"] as const;

export type TicketPackageId = (typeof TICKET_PACKAGE_IDS)[number];

export interface TicketPackage {
  id: TicketPackageId;
  /** 실제 청구 금액(원). 명시값이다. */
  amount: number;
  /** 기본 장수 */
  tickets: number;
  /** 묶음 보너스. 화면이 "+N장 더"를 그릴 수 있게 따로 둔다. */
  bonus: number;
}

/**
 * Record 인 이유: id 를 추가하면 여기서 컴파일이 깨진다. 배열로 두면 항목 하나를
 * 빠뜨려도 통과하고, 그 패키지는 런타임에 undefined 로 나타난다.
 */
const PACKAGES: Record<TicketPackageId, Omit<TicketPackage, "id">> = {
  t1: { amount: 1000, tickets: 1, bonus: 0 },
  t5: { amount: 5000, tickets: 5, bonus: 1 },
  t10: { amount: 10000, tickets: 10, bonus: 3 },
};

export function getPackage(id: TicketPackageId): TicketPackage {
  return { id, ...PACKAGES[id] };
}

/** 화면 순서대로. */
export function listPackages(): TicketPackage[] {
  return TICKET_PACKAGE_IDS.map(getPackage);
}

/** 실제로 지갑에 들어가는 장수. 적립·표시·주문명이 전부 이 함수를 지난다. */
export function creditedTickets(p: TicketPackage): number {
  return p.tickets + p.bonus;
}

/**
 * 결제창·카드 명세서·포트원 콘솔에 뜨는 상품명.
 * 프로필 이름을 넣지 않는 기존 판단을 잇는다 — 명세서에 타인의 이름이 남을 이유가 없다.
 */
export function packageOrderName(p: TicketPackage): string {
  return `이용권 ${creditedTickets(p)}장`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/payments/pricing.test.ts
```

Expected: PASS (8 tests).

이 시점에 `npm run typecheck` 는 아직 깨진다 — `FULL_REPORT_PRICE` 를 쓰는 곳이 남아 있다. Task 8·13 에서 정리된다.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/payments/pricing.ts src/lib/payments/pricing.test.ts
git commit -m "feat(tickets): 단건 가격표를 충전 패키지표로 바꾼다"
```

---

## Task 3: 서비스 목록과 단가

**Files:**
- Create: `src/lib/tickets/features.ts`
- Test: `src/lib/tickets/features.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `FEATURE_IDS: readonly ["full_report", "compatibility"]`
  - `type Feature = "full_report" | "compatibility"`
  - `FEATURE_COST: Record<Feature, number>`
  - `pairKey(a: string, b: string): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/tickets/features.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { FEATURE_COST, FEATURE_IDS, pairKey } from "./features";

describe("FEATURE_COST", () => {
  it("모든 서비스에 단가가 있다 — 빠진 서비스는 조용한 무료 열람이 된다", () => {
    for (const id of FEATURE_IDS) {
      expect(FEATURE_COST[id]).toBeGreaterThan(0);
    }
  });

  it("지금은 전부 1장 균일이다", () => {
    expect(FEATURE_COST.full_report).toBe(1);
    expect(FEATURE_COST.compatibility).toBe(1);
  });
});

describe("pairKey", () => {
  it("순서를 뒤집어도 같은 키다 — 다르면 같은 궁합에 두 번 차감된다", () => {
    expect(pairKey("12", "34")).toBe(pairKey("34", "12"));
  });

  it("숫자 크기로 정렬한다 — 문자열 정렬이면 '10' < '9' 라 같은 쌍이 갈린다", () => {
    expect(pairKey("9", "10")).toBe("9:10");
    expect(pairKey("10", "9")).toBe("9:10");
  });

  it("같은 id 두 개도 안정적으로 접는다", () => {
    expect(pairKey("7", "7")).toBe("7:7");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/lib/tickets/features.test.ts
```

Expected: FAIL — `Failed to resolve import "./features"`.

- [ ] **Step 3: `src/lib/tickets/features.ts` 를 만든다**

```ts
/**
 * 이용권을 쓰는 서비스와 단가. 새 서비스는 여기 두 줄로 추가된다 —
 * FEATURE_IDS 에 id 하나, FEATURE_COST 에 단가 하나.
 *
 * Feature 를 배열에서 파생시키는 것이 요점이다. 차감 API 가 문자열을 그대로 받으면
 * 오타가 조용한 무료 열람이 된다 — 타입으로 막으면 그 오타는 컴파일에서 걸린다.
 *
 * 값은 entitlements.feature 컬럼에 그대로 들어간다. 한 번 나간 값은 사용자의
 * 열람 권한이므로 이름을 바꾸려면 마이그레이션이 필요하다.
 */
export const FEATURE_IDS = ["full_report", "compatibility"] as const;

export type Feature = (typeof FEATURE_IDS)[number];

/** Record 라 서비스를 추가하면 단가를 빠뜨릴 수 없다 — 여기서 컴파일이 깨진다. */
export const FEATURE_COST: Record<Feature, number> = {
  full_report: 1,
  compatibility: 1,
};

/**
 * 궁합처럼 두 사람이 대상인 서비스의 subject_key.
 *
 * 정렬하는 이유: (12,34) 와 (34,12) 는 같은 궁합인데 키가 다르면 같은 사용자가
 * 두 번 차감된다. 프로필 id 는 순번 bigint 라 문자열 정렬은 "10" < "9" 로
 * 어긋난다 — BigInt 로 비교한다.
 *
 * 호출자가 형식을 검증해 넘긴다(parseProfileParam). 검증 없이 오면 BigInt() 가 던진다.
 */
export function pairKey(a: string, b: string): string {
  return BigInt(a) <= BigInt(b) ? `${a}:${b}` : `${b}:${a}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/tickets/features.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/tickets/features.ts src/lib/tickets/features.test.ts
git commit -m "feat(tickets): 이용권을 쓰는 서비스 목록과 단가"
```

---

## Task 4: 복귀 경로 검증

**Files:**
- Create: `src/lib/nav/next-param.ts`
- Test: `src/lib/nav/next-param.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `DEFAULT_NEXT: "/home"`, `safeNextPath(raw: string | undefined | null): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/nav/next-param.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_NEXT, safeNextPath } from "./next-param";

describe("safeNextPath", () => {
  it("내부 절대 경로는 그대로 통과한다", () => {
    expect(safeNextPath("/report?profile=3")).toBe("/report?profile=3");
    expect(safeNextPath("/home")).toBe("/home");
  });

  it("없으면 기본값", () => {
    expect(safeNextPath(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNextPath(null)).toBe(DEFAULT_NEXT);
    expect(safeNextPath("")).toBe(DEFAULT_NEXT);
  });

  it("외부 URL 은 기본값으로 접는다 — 통과시키면 오픈 리다이렉트다", () => {
    expect(safeNextPath("https://evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("http://evil.example")).toBe(DEFAULT_NEXT);
  });

  it("스킴 상대 URL 을 막는다 — 브라우저는 //evil.example 를 외부로 읽는다", () => {
    expect(safeNextPath("//evil.example")).toBe(DEFAULT_NEXT);
  });

  it("백슬래시 변형을 막는다 — 일부 브라우저가 /\\ 를 // 로 정규화한다", () => {
    expect(safeNextPath("/\\evil.example")).toBe(DEFAULT_NEXT);
  });

  it("제어문자가 섞인 값을 막는다 — 개행으로 검사를 우회할 수 있다", () => {
    expect(safeNextPath("/\nhttps://evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("/re\tport")).toBe(DEFAULT_NEXT);
  });

  it("상대 경로도 막는다 — 어느 화면 기준인지 알 수 없다", () => {
    expect(safeNextPath("report")).toBe(DEFAULT_NEXT);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/lib/nav/next-param.test.ts
```

Expected: FAIL — `Failed to resolve import "./next-param"`.

- [ ] **Step 3: `src/lib/nav/next-param.ts` 를 만든다**

```ts
/**
 * ?next 로 받은 복귀 경로를 안전한 값으로 접는다.
 *
 * ⚠️ 검사 없이 redirect() 나 router.replace() 에 넘기면 오픈 리다이렉트다.
 * /checkout?next=https://evil.example 한 줄로, 우리 도메인에서 출발해 결제까지
 * 마친 사용자를 남의 사이트에 떨어뜨릴 수 있다.
 *
 * 거절이 아니라 기본값으로 접는 이유: 이 값은 사용자가 적은 것이 아니라 우리 화면이
 * 붙인 것이다. 이상한 값이 왔다면 버그거나 공격인데, 어느 쪽이든 사용자에게
 * 오류 화면을 보여줄 이유는 없다 — 홈으로 보낸다.
 */
export const DEFAULT_NEXT = "/home";

export function safeNextPath(raw: string | undefined | null): string {
  if (typeof raw !== "string") return DEFAULT_NEXT;
  // 개행·탭이 섞이면 이후 검사를 우회하거나 헤더를 오염시킬 수 있다.
  if ([...raw].some((c) => c.charCodeAt(0) < 0x20)) return DEFAULT_NEXT;
  if (!raw.startsWith("/")) return DEFAULT_NEXT;
  // "//evil.example" 는 스킴 상대 URL, "/\evil.example" 는 그 브라우저별 변형이다.
  if (raw.startsWith("//") || raw.startsWith("/\\")) return DEFAULT_NEXT;
  return raw;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/nav/next-param.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/nav/next-param.ts src/lib/nav/next-param.test.ts
git commit -m "feat(nav): ?next 복귀 경로를 내부 경로로만 접는다"
```

---

## Task 5: 지갑 — 잔액 읽기와 확정·적립 CTE

**Files:**
- Create: `src/lib/tickets/wallet.ts`
- Test: `src/lib/tickets/wallet.test.ts`

**Interfaces:**
- Consumes: `SqlClient` (`@/lib/db`)
- Produces:
  - `getBalance(userId: string, client?: SqlClient): Promise<number>`
  - `confirmPurchaseAndCredit(a: { paymentId: string; transactionId: string | null }, client?: SqlClient): Promise<boolean>`

`confirmPurchaseAndCredit` 는 기존 `markPurchasePaid` 의 자리를 그대로 받는다 — 반환값의 뜻도 같다(`false` = "pending 이 아니었다").

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/tickets/wallet.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { SqlClient } from "@/lib/db";
import { confirmPurchaseAndCredit, getBalance } from "./wallet";

/** 호출된 SQL 과 바인딩 값을 기록하는 가짜 클라이언트. payments/store.test.ts 와 같은 모양. */
function fakeClient(...responses: Record<string, unknown>[][]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(responses[i++] ?? []);
  };
  return { client, calls };
}

describe("getBalance", () => {
  it("행이 있으면 그 값", async () => {
    const { client, calls } = fakeClient([{ balance: 6 }]);
    expect(await getBalance("7", client)).toBe(6);
    expect(calls[0].values).toEqual(["7"]);
  });

  it("행이 없으면 0 — 회원가입 때 지갑을 만들지 않는다", async () => {
    const { client } = fakeClient([]);
    expect(await getBalance("7", client)).toBe(0);
  });
});

describe("confirmPurchaseAndCredit", () => {
  it("확정과 적립이 한 문장이다 — 나뉘면 돈은 받고 이용권이 없는 행이 남는다", async () => {
    const { client, calls } = fakeClient([{ balance: 6 }]);
    await confirmPurchaseAndCredit({ paymentId: "saju-abc", transactionId: "tx-1" }, client);

    expect(calls).toHaveLength(1);
    const { sql } = calls[0];
    expect(sql).toContain("UPDATE purchases");
    expect(sql).toContain("INSERT INTO ticket_wallets");
    expect(sql).toContain("INSERT INTO ticket_entries");
  });

  it("status='pending' 조건이 이중 적립을 막는다", async () => {
    const { client, calls } = fakeClient([{ balance: 6 }]);
    await confirmPurchaseAndCredit({ paymentId: "saju-abc", transactionId: "tx-1" }, client);
    expect(calls[0].sql).toContain("status = 'pending'");
  });

  it("적립 장수는 purchases.tickets 에서 온다 — 확정 시점에 가격표를 다시 읽지 않는다", async () => {
    const { client, calls } = fakeClient([{ balance: 6 }]);
    await confirmPurchaseAndCredit({ paymentId: "saju-abc", transactionId: "tx-1" }, client);
    // 바인딩 값은 거래 id 와 결제 id 둘뿐이다. 장수가 인자로 들어오면 브라우저발 값이 섞일 수 있다.
    expect(calls[0].values).toEqual(["tx-1", "saju-abc"]);
  });

  it("원장은 지갑과 같은 문장에서 쌓인다 — reason 은 purchase", async () => {
    const { client, calls } = fakeClient([{ balance: 6 }]);
    await confirmPurchaseAndCredit({ paymentId: "saju-abc", transactionId: null }, client);
    expect(calls[0].sql).toContain("'purchase'");
  });

  it("갱신된 행이 있으면 true", async () => {
    const { client } = fakeClient([{ balance: 6 }]);
    expect(
      await confirmPurchaseAndCredit({ paymentId: "saju-abc", transactionId: "tx-1" }, client),
    ).toBe(true);
  });

  it("갱신된 행이 없으면 false — 그 사이 다른 경로가 먼저 확정했다는 뜻", async () => {
    const { client } = fakeClient([]);
    expect(
      await confirmPurchaseAndCredit({ paymentId: "saju-abc", transactionId: null }, client),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/lib/tickets/wallet.test.ts
```

Expected: FAIL — `Failed to resolve import "./wallet"`.

- [ ] **Step 3: `src/lib/tickets/wallet.ts` 를 만든다**

```ts
import { sql as neonSql, type SqlClient } from "@/lib/db";

const sql = neonSql as unknown as SqlClient;

/**
 * 지갑 잔액. 행이 없으면 0 이다 — 회원가입 때 지갑을 만들지 않는 판단(0012 주석)의
 * 반대편이라, 여기서 없음을 0 으로 접어야 화면이 특수 케이스를 몰라도 된다.
 */
export async function getBalance(userId: string, client: SqlClient = sql): Promise<number> {
  const rows = await client`
    SELECT balance FROM ticket_wallets WHERE user_id = ${userId}::bigint
  `;
  return Number(rows[0]?.balance ?? 0);
}

/**
 * 결제 확정 + 이용권 적립. 갱신된 행이 있으면 true.
 * 기존 markPurchasePaid 의 자리를 그대로 받는다 — false 는 "pending 이 아니었다"는
 * 뜻이고, 그게 paid 인지 refunded 인지는 호출자(confirmPayment)가 다시 읽어 가린다.
 *
 * ⚠️ CTE 한 문장인 것이 이 함수의 존재 이유다. Neon HTTP 드라이버에는 대화형
 * 트랜잭션이 없어, 확정과 적립을 두 문장으로 나누면 그 사이에 프로세스가 죽었을 때
 * 돈은 받고 이용권은 없는 행이 남는다. 한 문장은 암묵적 트랜잭션이라 그 틈이 없다.
 *
 * 이중 적립도 여기서 막힌다: 완료 API 와 웹훅이 동시에 와도 status='pending' 조건을
 * 이긴 쪽만 paid 에 행을 받고, 진 쪽은 paid 가 비어 뒤따르는 SELECT ... FROM paid 가
 * 0행이 된다 — 지갑도 원장도 건드리지 않는다.
 *
 * 적립 장수를 인자가 아니라 purchases.tickets 에서 읽는 이유: 주문 생성 시점에
 * 서버가 박아 둔 값이라 브라우저가 손댈 수 없고, 확정 시점에 가격표가 바뀌어 있어도
 * 사용자는 산 만큼 받는다.
 *
 * tickets 가 NULL 인 행(수기 지급 등)을 만나면 balance NOT NULL 위반으로 던진다.
 * 조용히 0장 적립되어 "결제는 됐는데 이용권이 없다"로 나타나는 것보다 낫다.
 */
export async function confirmPurchaseAndCredit(
  a: { paymentId: string; transactionId: string | null },
  client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    WITH paid AS (
      UPDATE purchases
         SET status = 'paid', paid_at = now(), provider_txn_id = ${a.transactionId}
       WHERE payment_id = ${a.paymentId} AND status = 'pending'
      RETURNING id, user_id, tickets
    ), wallet AS (
      INSERT INTO ticket_wallets (user_id, balance)
      SELECT user_id, tickets FROM paid
      ON CONFLICT (user_id) DO UPDATE
        SET balance = ticket_wallets.balance + EXCLUDED.balance,
            updated_at = now()
      RETURNING balance
    ), ledger AS (
      INSERT INTO ticket_entries (user_id, delta, reason, purchase_id)
      SELECT user_id, tickets, 'purchase', id FROM paid
      RETURNING id
    )
    SELECT balance FROM wallet
  `;
  return rows.length > 0;
}
```

`ledger` 를 본 쿼리가 읽지 않아도 실행된다 — Postgres 는 WITH 안의 데이터 변경 문장을 참조 여부와 무관하게 정확히 한 번 끝까지 실행한다.

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/tickets/wallet.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/tickets/wallet.ts src/lib/tickets/wallet.test.ts
git commit -m "feat(tickets): 결제 확정과 이용권 적립을 한 문장으로 묶는다"
```

---

## Task 6: purchases 저장소 재정의

**Files:**
- Modify: `src/lib/payments/store.ts`
- Test: `src/lib/payments/store.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `interface PendingOrder { paymentId: string; userId: string; amount: number; status: PurchaseStatus }` (`profileId` 제거)
  - `createPendingPurchase(input: { userId: string; paymentId: string; product: string; amount: number; tickets: number }, client?): Promise<void>`
  - `findOrderByPaymentId(paymentId: string, client?): Promise<PendingOrder | null>` (변경 없음)
  - `markPurchaseFailed(paymentId: string, client?): Promise<void>` (변경 없음)
  - `markPurchasePaid` 는 **사라진다** — Task 5 의 `confirmPurchaseAndCredit` 로 대체

- [ ] **Step 1: 테스트를 새 모양으로 고친다**

`src/lib/payments/store.test.ts` 에서 `markPurchasePaid` 를 import 와 describe 블록에서 통째로 지우고, 나머지를 아래로 바꾼다.

```ts
import { describe, it, expect } from "vitest";
import type { SqlClient } from "@/lib/db";
import {
  createPendingPurchase,
  findOrderByPaymentId,
  markPurchaseFailed,
  toPendingOrder,
} from "./store";

/** 호출된 SQL 과 바인딩 값을 기록하는 가짜 클라이언트. 응답은 순서대로 꺼내 쓴다. */
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
  payment_id: "saju-abc",
  user_id: 7,
  amount: 5000,
  status: "pending",
};

describe("toPendingOrder", () => {
  it("bigint 컬럼을 문자열로 접는다 — JS number 는 bigint 를 담지 못한다", () => {
    expect(toPendingOrder(dbRow)).toEqual({
      paymentId: "saju-abc",
      userId: "7",
      amount: 5000,
      status: "pending",
    });
  });

  it("모르는 status 는 failed 로 접는다 — 모르는 값을 pending 으로 두면 재확정 대상이 된다", () => {
    expect(toPendingOrder({ ...dbRow, status: "weird" }).status).toBe("failed");
  });
});

describe("createPendingPurchase", () => {
  it("상품·금액·장수를 호출자가 넘긴 값 그대로 박는다", async () => {
    const { client, calls } = fakeClient([]);
    await createPendingPurchase(
      { userId: "7", paymentId: "saju-abc", product: "t5", amount: 5000, tickets: 6 },
      client,
    );
    expect(calls[0].sql).toContain("INSERT INTO purchases");
    expect(calls[0].values).toEqual(["7", "t5", 5000, 6, "saju-abc"]);
    expect(calls[0].sql).toContain("'pending'");
    expect(calls[0].sql).toContain("'portone'");
  });

  it("profile_id 를 쓰지 않는다 — 이용권 충전에는 대상 프로필이 없다", async () => {
    const { client, calls } = fakeClient([]);
    await createPendingPurchase(
      { userId: "7", paymentId: "saju-abc", product: "t1", amount: 1000, tickets: 1 },
      client,
    );
    expect(calls[0].sql).not.toContain("profile_id");
  });
});

describe("findOrderByPaymentId", () => {
  it("행이 없으면 null", async () => {
    const { client } = fakeClient([]);
    expect(await findOrderByPaymentId("saju-none", client)).toBeNull();
  });

  it("payment_id 로 찾는다", async () => {
    const { client, calls } = fakeClient([dbRow]);
    const order = await findOrderByPaymentId("saju-abc", client);
    expect(order?.userId).toBe("7");
    expect(calls[0].values).toEqual(["saju-abc"]);
  });
});

describe("markPurchaseFailed", () => {
  it("pending 인 행만 내린다 — 이미 확정된 결제를 실패로 뒤집지 않는다", async () => {
    const { client, calls } = fakeClient([]);
    await markPurchaseFailed("saju-abc", client);
    expect(calls[0].sql).toContain("status = 'failed'");
    expect(calls[0].sql).toContain("status = 'pending'");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/lib/payments/store.test.ts
```

Expected: FAIL — `createPendingPurchase` 가 `profileId` 를 요구한다는 타입/런타임 불일치, `toPendingOrder` 결과에 `profileId: "undefined"` 가 섞여 `toEqual` 실패.

- [ ] **Step 3: `src/lib/payments/store.ts` 를 고친다**

`import { PRODUCT_FULL_REPORT } ...` 줄을 지우고, 아래 세 곳을 바꾼다.

```ts
/** 확정 로직이 보는 주문 한 건. */
export interface PendingOrder {
  paymentId: string;
  userId: string;
  /** 주문 생성 시점에 서버가 박아 둔 청구 금액. 포트원 조회 결과와 대조하는 기준이다. */
  amount: number;
  status: PurchaseStatus;
}

/**
 * DB 행 → PendingOrder. 컬럼 이름을 아는 유일한 곳이다.
 * user_id 를 문자열로 접는 이유: bigint 라 JS number 로 받으면 큰 값에서
 * 정밀도가 깨진다 (toProfileRow 와 같은 판단).
 *
 * 적립 장수(tickets)는 여기 없다 — 적립은 confirmPurchaseAndCredit 이 DB 안에서
 * 직접 읽는다. 값을 앱까지 올렸다 내리면 그 사이에 손댈 자리가 생긴다.
 */
export function toPendingOrder(r: Record<string, unknown>): PendingOrder {
  const status = String(r.status);
  return {
    paymentId: String(r.payment_id),
    userId: String(r.user_id),
    amount: Number(r.amount),
    // 모르는 값을 pending 으로 두면 확정 로직이 재확정을 시도한다. 막다른 쪽으로 접는다.
    status: (STATUSES.includes(status) ? status : "failed") as PurchaseStatus,
  };
}

/**
 * 결제 시작 시점의 pending 행. 재시도할 때마다 새로 만든다 —
 * 재시도 이력이 남는 편이 디버깅에 낫다 (0007 주석 참조).
 *
 * profile_id 를 쓰지 않는다: 이용권 충전에는 대상 프로필이 없다. 0007 이
 * NULL 허용으로 열어 둔 자리를 그대로 비워 둔다.
 *
 * product·amount·tickets 를 호출자가 넘기는 이유: 가격표를 아는 곳은 주문 생성
 * 핸들러 하나여야 한다. 여기서 다시 읽으면 표를 아는 곳이 둘이 된다.
 */
export async function createPendingPurchase(
  input: { userId: string; paymentId: string; product: string; amount: number; tickets: number },
  client: SqlClient = sql,
): Promise<void> {
  await client`
    INSERT INTO purchases (
      user_id, product, amount, tickets, currency, status, provider, payment_id
    ) VALUES (
      ${input.userId}::bigint, ${input.product},
      ${input.amount}, ${input.tickets}, 'KRW', 'pending', 'portone', ${input.paymentId}
    )
  `;
}

export async function findOrderByPaymentId(
  paymentId: string,
  client: SqlClient = sql,
): Promise<PendingOrder | null> {
  const rows = await client`
    SELECT payment_id, user_id, amount, status
    FROM purchases WHERE payment_id = ${paymentId}
  `;
  const row = rows[0];
  return row ? toPendingOrder(row) : null;
}
```

그리고 `markPurchasePaid` 함수를 통째로 지운다. `markPurchaseFailed` 는 그대로 둔다.

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/payments/store.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/payments/store.ts src/lib/payments/store.test.ts
git commit -m "refactor(payments): 주문에서 프로필을 떼고 적립 장수를 붙인다"
```

---

## Task 7: 확정 로직에서 프로필을 떼고 적립을 배선한다

**Files:**
- Modify: `src/lib/payments/confirm.ts`
- Modify: `src/lib/payments/deps.ts`
- Test: `src/lib/payments/confirm.test.ts`

**Interfaces:**
- Consumes: `confirmPurchaseAndCredit` (Task 5), `PendingOrder` (Task 6)
- Produces: `type ConfirmResult = { ok: true; kind: "confirmed" | "already" } | { ok: false; kind: ConfirmFailure }`

`ConfirmDeps` 와 `classify` 는 그대로다. 금액 대조·상태 3분류·확정 실패 시 재조회 판단도 손대지 않는다.

- [ ] **Step 1: 테스트를 새 모양으로 고친다**

`src/lib/payments/confirm.test.ts` 에서 픽스처의 `profileId: "3"` 줄을 지우고, 성공 단언 4곳을 바꾼다.

- 주문 픽스처: `{ paymentId: "saju-abc", userId: "7", amount: 5000, status: "pending" }`
- `expect(result).toEqual({ ok: true, kind: "confirmed", profileId: "3" })` → `expect(result).toEqual({ ok: true, kind: "confirmed" })`
- `already` 단언 두 곳도 같은 방식으로 `profileId` 제거

그리고 다음 테스트를 추가한다.

```ts
it("markPaid 가 false 여도 다시 읽어 paid 면 already — 다른 경로가 먼저 확정한 경우", async () => {
  let reads = 0;
  const result = await confirmPayment("saju-abc", {
    ...deps(),
    findOrder: async () => ({
      paymentId: "saju-abc",
      userId: "7",
      amount: 5000,
      status: reads++ === 0 ? "pending" : "paid",
    }),
    markPaid: async () => false,
  });
  expect(result).toEqual({ ok: true, kind: "already" });
});

it("markPaid 가 false 이고 다시 읽어도 paid 가 아니면 not_paid — 환불된 행이 리포트를 열면 안 된다", async () => {
  let reads = 0;
  const result = await confirmPayment("saju-abc", {
    ...deps(),
    findOrder: async () => ({
      paymentId: "saju-abc",
      userId: "7",
      amount: 5000,
      status: reads++ === 0 ? "pending" : "refunded",
    }),
    markPaid: async () => false,
  });
  expect(result).toEqual({ ok: false, kind: "not_paid" });
});
```

기존 파일의 `deps()` 헬퍼 이름이 다르면 그 이름을 쓴다. 픽스처 금액은 파일 전체에서 `5000` 으로 통일하고, 포트원 조회 응답의 `amount.total` 도 같은 값으로 맞춘다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/lib/payments/confirm.test.ts
```

Expected: FAIL — `ConfirmResult` 에 `profileId` 가 남아 있어 `toEqual` 이 어긋난다.

- [ ] **Step 3: `src/lib/payments/confirm.ts` 를 고친다**

```ts
export type ConfirmResult =
  | { ok: true; kind: "confirmed" | "already" }
  | { ok: false; kind: ConfirmFailure };
```

본문에서 `profileId` 를 실어 보내던 네 곳을 바꾼다.

```ts
  if (order.status === "paid") return { ok: true, kind: "already" };
```

```ts
  const flipped = await d.markPaid({
    paymentId,
    transactionId: payment.transactionId ?? null,
  });
  if (flipped) return { ok: true, kind: "confirmed" };

  // false 는 "pending 이 아니었다"만 뜻한다 — paid 일 수도, refunded/failed 일 수도 있다.
  // 다시 읽어 확인한다: 다른 경로가 먼저 확정했으면 already 지만, 환불되거나 실패로
  // 내려간 행을 already 로 돌려주면 결제되지 않은 주문이 이용권을 지급받는다.
  const after = await d.findOrder(paymentId);
  if (after?.status === "paid") return { ok: true, kind: "already" };
  return { ok: false, kind: "not_paid" };
```

`ConfirmDeps.markPaid` 의 주석에 한 줄 덧붙인다.

```ts
  /**
   * 갱신된 행이 있으면 true. false 는 이미 다른 경로가 확정했다는 뜻이다.
   * 프로덕션 구현(deps.ts)은 확정과 이용권 적립을 한 문장으로 처리한다 —
   * 이 함수가 true 를 돌려줬다는 것은 적립까지 끝났다는 뜻이다.
   */
  markPaid(a: { paymentId: string; transactionId: string | null }): Promise<boolean>;
```

- [ ] **Step 4: `src/lib/payments/deps.ts` 를 고친다**

```ts
import type { ConfirmDeps } from "./confirm";
import { getPayment } from "./portone";
import { findOrderByPaymentId, markPurchaseFailed } from "./store";
import { confirmPurchaseAndCredit } from "@/lib/tickets/wallet";

/**
 * 프로덕션 확정 의존성. 완료 API·웹훅·모바일 착지 페이지 셋이 같은 조합을 쓴다.
 *
 * route.ts 가 아니라 여기 두는 이유: Next.js 는 route 파일이 HTTP 메서드와 정해진
 * 설정값 외의 것을 export 하면 빌드에서 거부한다. 세 곳이 공유하는 값은 lib 에 있어야 한다.
 *
 * payments 와 tickets 를 잇는 유일한 지점이기도 하다 — confirm.ts 는 이용권을
 * 모르고, wallet.ts 는 포트원을 모른다. 조립은 여기서만 한다.
 */
export const confirmDeps: ConfirmDeps = {
  findOrder: (paymentId) => findOrderByPaymentId(paymentId),
  lookupPayment: (paymentId) => getPayment(paymentId),
  markPaid: (a) => confirmPurchaseAndCredit(a),
  markFailed: (paymentId) => markPurchaseFailed(paymentId),
};
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run src/lib/payments/confirm.test.ts
```

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/payments/confirm.ts src/lib/payments/confirm.test.ts src/lib/payments/deps.ts
git commit -m "refactor(payments): 확정 결과에서 프로필을 떼고 적립을 배선한다"
```

---

## Task 8: 주문 생성 API — 패키지 충전

**Files:**
- Modify: `src/app/api/payments/orders/_lib/handler.ts`
- Modify: `src/app/api/payments/orders/route.ts`
- Test: `src/app/api/payments/orders/_lib/handler.test.ts`

**Interfaces:**
- Consumes: `TICKET_PACKAGE_IDS`, `getPackage`, `creditedTickets`, `packageOrderName` (Task 2), `safeNextPath` (Task 4), `createPendingPurchase` (Task 6)
- Produces:
  - 요청 `{ packageId: TicketPackageId; method: PaymentMethodId; next?: string }`
  - `CreateOrderDeps` 에서 `getProfile` 제거, `createPending` 시그니처 변경
  - 응답 `OrderResponse` 는 모양 그대로 (`redirectUrl` 값만 바뀐다)

- [ ] **Step 1: 테스트를 새 모양으로 고친다**

`src/app/api/payments/orders/_lib/handler.test.ts` 를 통째로 아래로 바꾼다.

```ts
import { describe, it, expect, vi } from "vitest";
import { handleCreateOrder, type CreateOrderDeps } from "./handler";

function deps(over: Partial<CreateOrderDeps> = {}): CreateOrderDeps {
  return {
    userId: "7",
    getStoreId: () => "store-1",
    getChannel: () => ({ channelKey: "ch-1", payMethod: "CARD" }),
    getAppOrigin: () => "https://saju.example",
    newPaymentId: () => "saju-abc",
    createPending: vi.fn(async () => {}),
    ...over,
  };
}

const body = { packageId: "t5", method: "card" };

describe("handleCreateOrder", () => {
  it("금액과 장수를 서버 가격표에서 박는다 — 요청에는 그 필드가 아예 없다", async () => {
    const createPending = vi.fn(async () => {});
    const r = await handleCreateOrder(body, deps({ createPending }));

    expect(r.status).toBe(200);
    expect(createPending).toHaveBeenCalledWith({
      userId: "7",
      paymentId: "saju-abc",
      product: "t5",
      amount: 5000,
      tickets: 6,
    });
  });

  it("응답 금액은 pending 행에 박은 금액과 같다 — 갈라지면 확정에서 금액 불일치가 난다", async () => {
    const r = await handleCreateOrder(body, deps());
    expect(r.body).toMatchObject({
      paymentId: "saju-abc",
      storeId: "store-1",
      channelKey: "ch-1",
      payMethod: "CARD",
      orderName: "이용권 6장",
      totalAmount: 5000,
      currency: "CURRENCY_KRW",
    });
  });

  it("로그인하지 않았으면 401", async () => {
    const r = await handleCreateOrder(body, deps({ userId: null }));
    expect(r.status).toBe(401);
  });

  it("요청 모양이 어긋나면 400", async () => {
    const d = deps();
    for (const bad of [
      null,
      {},
      { packageId: "t5" },
      { packageId: "t99", method: "card" },
      { packageId: "t5", method: "paypal" },
    ]) {
      expect((await handleCreateOrder(bad, d)).status).toBe(400);
    }
  });

  it("검증에 걸리면 pending 행을 만들지 않는다", async () => {
    const createPending = vi.fn(async () => {});
    await handleCreateOrder({ packageId: "t99", method: "card" }, deps({ createPending }));
    await handleCreateOrder(body, deps({ createPending, userId: null }));
    expect(createPending).not.toHaveBeenCalled();
  });

  it("결제 설정이 없으면 503 — 장애가 아니라 미설정이다", async () => {
    for (const over of [
      { getStoreId: () => null },
      { getChannel: () => null },
      { getAppOrigin: () => null },
    ] as Partial<CreateOrderDeps>[]) {
      const r = await handleCreateOrder(body, deps(over));
      expect(r.status).toBe(503);
    }
  });

  it("복귀 경로를 redirectUrl 에 싣는다", async () => {
    const r = await handleCreateOrder({ ...body, next: "/report?profile=3" }, deps());
    expect(r.body).toMatchObject({
      redirectUrl: `https://saju.example/checkout/complete?next=${encodeURIComponent("/report?profile=3")}`,
    });
  });

  it("외부 URL 을 next 로 보내면 홈으로 접는다 — 오픈 리다이렉트를 막는다", async () => {
    const r = await handleCreateOrder({ ...body, next: "https://evil.example" }, deps());
    expect(r.body).toMatchObject({
      redirectUrl: `https://saju.example/checkout/complete?next=${encodeURIComponent("/home")}`,
    });
  });

  it("간편결제는 채널이 준 판별자를 그대로 싣는다 — 쪼개면 어긋난 조합이 나간다", async () => {
    const r = await handleCreateOrder(
      { packageId: "t10", method: "toss" },
      deps({
        getChannel: () => ({
          channelKey: "ch-1",
          payMethod: "EASY_PAY",
          easyPayProvider: "TOSSPAY",
        }),
      }),
    );
    expect(r.body).toMatchObject({
      payMethod: "EASY_PAY",
      easyPayProvider: "TOSSPAY",
      orderName: "이용권 13장",
      totalAmount: 10000,
    });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/app/api/payments/orders/_lib/handler.test.ts
```

Expected: FAIL — `deps()` 에 `getProfile` 이 없어 타입이 어긋나고, `packageId` 를 스키마가 모른다.

- [ ] **Step 3: `src/app/api/payments/orders/_lib/handler.ts` 를 고친다**

```ts
import { z } from "zod";
import { PAYMENT_METHOD_IDS, type PaymentChannel, type PaymentMethodId } from "@/lib/payments/config";
import {
  TICKET_PACKAGE_IDS,
  creditedTickets,
  getPackage,
  packageOrderName,
} from "@/lib/payments/pricing";
import type { OrderResponse } from "@/lib/payments/order";
import { safeNextPath } from "@/lib/nav/next-param";

// 타입은 src/lib/payments/order.ts 가 소유한다 — 여기서는 재수출만 해서
// 기존 import 경로(`_lib/handler`)를 깨지 않는다.
export type { OrderResponse };

// 금액과 장수를 받는 필드가 없는 것이 이 스키마의 요점이다 — 둘 다 서버 가격표에서만 온다.
// packageId·method 는 각자의 상수 배열을 그대로 받는다: 목록이 늘면 스키마도 같이 넓어진다.
// next 는 문자열로 받되 값은 믿지 않는다 (safeNextPath).
const createOrderSchema = z.object({
  packageId: z.enum(TICKET_PACKAGE_IDS),
  method: z.enum(PAYMENT_METHOD_IDS),
  next: z.string().optional(),
});

export interface CreateOrderDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  getStoreId(): string | null;
  getChannel(id: PaymentMethodId): PaymentChannel | null;
  getAppOrigin(): string | null;
  newPaymentId(): string;
  createPending(i: {
    userId: string;
    paymentId: string;
    product: string;
    amount: number;
    tickets: number;
  }): Promise<void>;
}

export interface CreateOrderResult {
  status: number;
  body: OrderResponse | { error: string };
}

/**
 * 이용권 충전 주문 생성.
 *
 * 프로필 소유 확인과 중복 결제 가드가 없는 것은 누락이 아니다 — 충전에는 대상
 * 프로필이 없고, 같은 패키지를 몇 번이든 다시 사는 것이 정상이다.
 */
export async function handleCreateOrder(
  raw: unknown,
  d: CreateOrderDeps,
): Promise<CreateOrderResult> {
  const parsed = createOrderSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "요청을 확인해 주세요" } };

  if (d.userId === null) return { status: 401, body: { error: "로그인이 필요합니다" } };

  const pkg = getPackage(parsed.data.packageId);
  const storeId = d.getStoreId();
  const channel = d.getChannel(parsed.data.method);
  const origin = d.getAppOrigin();
  // 셋 중 하나라도 없으면 결제창을 열 수 없다. 장애가 아니라 미설정이라 503 이다.
  if (!storeId || !channel || !origin) {
    return { status: 503, body: { error: "결제를 준비 중입니다" } };
  }

  const paymentId = d.newPaymentId();
  // 행을 먼저 만들고 결제창을 연다 — 순서가 반대면 결제는 됐는데 대조할 주문이 없다.
  await d.createPending({
    userId: d.userId,
    paymentId,
    product: pkg.id,
    amount: pkg.amount,
    tickets: creditedTickets(pkg),
  });

  const next = safeNextPath(parsed.data.next);

  return {
    status: 200,
    body: {
      paymentId,
      storeId,
      // 채널키와 판별자를 한 덩이로 넘긴다 — 따로 옮기면 payMethod 와
      // easyPayProvider 가 어긋난 조합을 만들 수 있다.
      ...channel,
      orderName: packageOrderName(pkg),
      totalAmount: pkg.amount,
      currency: "CURRENCY_KRW",
      // 모바일은 결제창이 페이지를 떠난다. 돌아올 자리를 여기서 정한다.
      // next 는 이미 safeNextPath 를 지났다 — 착지 페이지가 다시 검사하지만,
      // 검증된 값만 내보내는 편이 두 곳의 판단이 어긋날 여지를 줄인다.
      redirectUrl: `${origin}/checkout/complete?next=${encodeURIComponent(next)}`,
    },
  };
}
```

- [ ] **Step 4: `src/app/api/payments/orders/route.ts` 를 고친다**

`getProfile` import 와 deps 항목을 지운다.

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAppOrigin, getChannel, getStoreId } from "@/lib/payments/config";
import { newPaymentId } from "@/lib/payments/order-id";
import { createPendingPurchase } from "@/lib/payments/store";
import { handleCreateOrder } from "./_lib/handler";

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleCreateOrder(raw, {
      userId: session?.userId ?? null,
      getStoreId: () => getStoreId(),
      getChannel: (id) => getChannel(id),
      getAppOrigin: () => getAppOrigin(),
      newPaymentId,
      createPending: (i) => createPendingPurchase(i),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/payments/orders]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run src/app/api/payments/orders/_lib/handler.test.ts
```

Expected: PASS (9 tests).

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/payments/orders/
git commit -m "feat(payments): 주문 생성을 이용권 패키지 충전으로 바꾼다"
```

---

## Task 9: 완료 API와 모바일 착지 페이지

**Files:**
- Modify: `src/app/api/payments/complete/_lib/handler.ts`
- Modify: `src/app/checkout/complete/page.tsx`
- Test: `src/app/api/payments/complete/_lib/handler.test.ts`
- Test: `src/app/api/payments/webhook/_lib/handler.test.ts` (픽스처만)

**Interfaces:**
- Consumes: `ConfirmResult` (Task 7), `getBalance` (Task 5), `safeNextPath` (Task 4)
- Produces:
  - `CompleteDeps` 에 `getBalance(userId: string): Promise<number>` 추가
  - 응답 `{ balance: number }`

- [ ] **Step 1: 테스트를 새 모양으로 고친다**

`src/app/api/payments/complete/_lib/handler.test.ts` 를 아래로 바꾼다.

```ts
import { describe, it, expect, vi } from "vitest";
import { handleComplete, type CompleteDeps } from "./handler";

const order = {
  paymentId: "saju-abc",
  userId: "7",
  amount: 5000,
  status: "pending" as const,
};

function deps(over: Partial<CompleteDeps> = {}): CompleteDeps {
  return {
    userId: "7",
    findOrder: vi.fn(async () => order),
    confirm: vi.fn(async () => ({ ok: true as const, kind: "confirmed" as const })),
    getBalance: vi.fn(async () => 6),
    ...over,
  };
}

const body = { paymentId: "saju-abc" };

describe("handleComplete", () => {
  it("확정되면 200 과 잔액 — 화면이 충전 결과를 응답에서 읽는다", async () => {
    expect(await handleComplete(body, deps())).toEqual({
      status: 200,
      body: { balance: 6 },
    });
  });

  it("이미 확정된 주문도 200 — 웹훅이 먼저 도착한 정상 경로다", async () => {
    const r = await handleComplete(
      body,
      deps({ confirm: vi.fn(async () => ({ ok: true as const, kind: "already" as const })) }),
    );
    expect(r).toEqual({ status: 200, body: { balance: 6 } });
  });

  it("로그인하지 않았으면 401", async () => {
    expect((await handleComplete(body, deps({ userId: null }))).status).toBe(401);
  });

  it("요청 모양이 어긋나면 400", async () => {
    const d = deps();
    for (const bad of [null, {}, { paymentId: "" }]) {
      expect((await handleComplete(bad, d)).status).toBe(400);
    }
  });

  it("없는 주문과 남의 주문을 구분하지 않는다 — 구분하면 paymentId 로 훑을 수 있다", async () => {
    const missing = await handleComplete(body, deps({ findOrder: vi.fn(async () => null) }));
    const others = await handleComplete(
      body,
      deps({ findOrder: vi.fn(async () => ({ ...order, userId: "9" })) }),
    );
    expect(missing.status).toBe(404);
    expect(others).toEqual(missing);
  });

  it("남의 주문이면 확정을 시도하지도 않는다", async () => {
    const confirm = vi.fn(async () => ({ ok: true as const, kind: "confirmed" as const }));
    await handleComplete(body, deps({ confirm, findOrder: vi.fn(async () => ({ ...order, userId: "9" })) }));
    expect(confirm).not.toHaveBeenCalled();
  });

  it("확정 실패는 종류마다 상태코드가 다르다", async () => {
    const cases = [
      ["not_found", 404],
      ["not_paid", 402],
      ["amount_mismatch", 402],
      ["currency_mismatch", 402],
    ] as const;
    for (const [kind, status] of cases) {
      const r = await handleComplete(
        body,
        deps({ confirm: vi.fn(async () => ({ ok: false as const, kind })) }),
      );
      expect(r.status).toBe(status);
      expect(r.body).toMatchObject({ kind });
    }
  });
});
```

`src/app/api/payments/webhook/_lib/handler.test.ts` 에서는 `profileId: "3"` 만 지운다 — 웹훅 핸들러 자체는 `ConfirmResult.ok` 와 `kind` 만 보므로 로직 변경이 없다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/app/api/payments/complete/_lib/handler.test.ts src/app/api/payments/webhook/_lib/handler.test.ts
```

Expected: FAIL — `CompleteDeps` 에 `getBalance` 가 없고, 응답이 `{ profileId }` 다.

- [ ] **Step 3: `src/app/api/payments/complete/_lib/handler.ts` 를 고친다**

```ts
import { z } from "zod";
import type { ConfirmFailure, ConfirmResult } from "@/lib/payments/confirm";
import type { PendingOrder } from "@/lib/payments/store";

const completeSchema = z.object({ paymentId: z.string().min(1) });

export interface CompleteDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  findOrder(paymentId: string): Promise<PendingOrder | null>;
  confirm(paymentId: string): Promise<ConfirmResult>;
  /** 확정 뒤의 잔액. 화면이 충전 결과를 응답 한 번으로 읽게 한다. */
  getBalance(userId: string): Promise<number>;
}

export interface CompleteResult {
  status: number;
  body: { balance: number } | { error: string; kind?: string };
}

// ConfirmFailure 로 키를 두는 이유: confirm.ts 에 kind 가 하나 추가됐는데 여기를
// 안 고치면, Record<string, number> 였을 때는 ?? 402 로 조용히 넘어갔다.
// 여기서도 컴파일이 깨지게 해 confirm.ts 의 never 전수 검사와 같은 효과를 낸다.
const FAILURE_STATUS: Record<ConfirmFailure, number> = {
  not_found: 404,
  not_paid: 402,
  amount_mismatch: 402,
  currency_mismatch: 402,
};

export async function handleComplete(raw: unknown, d: CompleteDeps): Promise<CompleteResult> {
  const parsed = completeSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "요청을 확인해 주세요" } };
  if (d.userId === null) return { status: 401, body: { error: "로그인이 필요합니다" } };

  const { paymentId } = parsed.data;

  // 소유 확인은 여기서 한다 — confirmPayment 는 웹훅과 공유하는 함수라 세션을 모른다.
  // 없는 주문과 남의 주문을 구분하지 않는다: 구분하면 paymentId 로 존재 여부를 훑을 수 있다.
  const order = await d.findOrder(paymentId);
  if (order === null || order.userId !== d.userId) {
    return { status: 404, body: { error: "주문을 찾을 수 없습니다" } };
  }

  const result = await d.confirm(paymentId);
  // 잔액은 확정 뒤에 읽는다 — 적립이 확정과 한 문장이라 여기서 읽으면 이미 반영돼 있다.
  if (result.ok) return { status: 200, body: { balance: await d.getBalance(d.userId) } };

  return {
    status: FAILURE_STATUS[result.kind],
    body: { error: "결제를 확인하지 못했습니다", kind: result.kind },
  };
}
```

- [ ] **Step 4: `src/app/api/payments/complete/route.ts` 에 `getBalance` 를 배선한다**

`import { getBalance } from "@/lib/tickets/wallet";` 를 추가하고 deps 에 한 줄 넣는다.

```ts
      getBalance: (userId) => getBalance(userId),
```

- [ ] **Step 5: `src/app/checkout/complete/page.tsx` 를 고친다**

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { confirmPayment } from "@/lib/payments/confirm";
import { confirmDeps } from "@/lib/payments/deps";
import { findOrderByPaymentId } from "@/lib/payments/store";
import { safeNextPath } from "@/lib/nav/next-param";
import { first, type SearchParams } from "@/lib/profiles/param";

/** backTo 에 이미 쿼리가 있으면 &, 없으면 ? 로 이어 붙인다 — 실패 리다이렉트가 공유한다. */
function withErrorMarker(backTo: string): string {
  return `${backTo}${backTo.includes("?") ? "&" : "?"}error=1`;
}

/**
 * 모바일 결제창이 돌아오는 자리. 포트원이 ?paymentId·?code·?message 를 붙여 보낸다.
 * ?next 는 우리가 redirectUrl 에 실어 보낸 복귀 경로다.
 *
 * 서버 컴포넌트인 이유: 확정과 이동을 한 번에 끝낼 수 있다. 클라이언트로 만들면
 * 빈 화면을 그린 뒤 fetch 하고 다시 이동해서, 사용자가 흰 화면을 두 번 본다.
 *
 * ⚠️ next 를 여기서 다시 safeNextPath 에 통과시킨다. 주소창으로 이 페이지에 직접
 * 닿을 수 있으므로, 주문 생성에서 한 번 걸렀다는 사실을 믿을 수 없다.
 */
export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const next = safeNextPath(first(params.next));
  // 실패하면 충전 화면으로 되돌린다 — 복귀 경로는 그대로 들고 간다.
  const backTo = `/checkout?next=${encodeURIComponent(next)}`;

  // 포트원이 실패를 code 로 알려준다. 확정을 시도할 이유가 없다.
  const code = first(params.code);
  if (code) redirect(withErrorMarker(backTo));

  const paymentId = first(params.paymentId);
  // 포트원은 정상적으로 돌아올 때 code(실패) 아니면 paymentId(진행) 를 반드시
  // 싣는다 — 둘 다 없이 여기 닿는 건 결제를 시도한 적 없는 방문(주소 직접 입력·
  // 북마크)뿐이다. 시도하지 않은 사용자에게 오류 배너를 띄우지 않는다.
  if (!paymentId) redirect(backTo);

  const session = await getSession();
  if (session === null) redirect(`/login?next=${encodeURIComponent(backTo)}`);

  // 남의 주문을 확정해 주지 않는다. 완료 API 핸들러와 같은 판단이다.
  const order = await findOrderByPaymentId(paymentId);
  if (order === null || order.userId !== session.userId) redirect(withErrorMarker(backTo));

  let ok = false;
  // ⚠️ redirect() 는 예외를 던져서 동작한다. try 안에는 confirmPayment 만 두고
  // redirect 는 반드시 밖에서 부른다 — 안에 두면 이 catch 가 그 예외를 삼켜서,
  // 결제가 성공해도 사용자가 빈 화면에 남는다.
  try {
    const result = await confirmPayment(paymentId, confirmDeps);
    ok = result.ok;
  } catch (e) {
    // 여기서 실패해도 웹훅이 뒤이어 확정한다. 사용자를 충전 화면으로 돌려보내면
    // 잔액이 이미 올라가 있는 경우 화면이 그 값을 보여준다.
    console.error("[/checkout/complete] 확정 실패", e);
  }

  redirect(ok ? next : withErrorMarker(backTo));
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npx vitest run src/app/api/payments/
```

Expected: PASS (orders·complete·webhook 세 핸들러 전부).

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/payments/complete/ src/app/api/payments/webhook/ src/app/checkout/complete/
git commit -m "feat(payments): 완료 응답을 잔액으로 바꾸고 복귀 경로를 싣는다"
```

---

## Task 10: 차감 CTE

**Files:**
- Create: `src/lib/tickets/spend.ts`
- Test: `src/lib/tickets/spend.test.ts`

**Interfaces:**
- Consumes: `Feature` (Task 3), `SqlClient`
- Produces:
  - `type SpendResult = { ok: true; kind: "spent" | "already"; balance: number } | { ok: false; kind: "insufficient"; balance: number }`
  - `spendTicket(a: { userId: string; feature: Feature; subjectKey: string; cost: number }, client?: SqlClient): Promise<SpendResult>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/tickets/spend.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { SqlClient } from "@/lib/db";
import { spendTicket } from "./spend";

function fakeClient(...responses: (Record<string, unknown>[] | Error)[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    const r = responses[i++];
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve(r ?? []);
  };
  return { client, calls };
}

/** Postgres CHECK 위반. 23514 = check_violation. */
function checkViolation(constraint = "ticket_wallets_balance_check") {
  return Object.assign(
    new Error(`new row for relation "ticket_wallets" violates check constraint "${constraint}"`),
    { code: "23514", constraint },
  );
}

const input = { userId: "7", feature: "full_report" as const, subjectKey: "3", cost: 1 };

describe("spendTicket", () => {
  it("권한이 생기면 spent 와 차감된 잔액", async () => {
    const { client, calls } = fakeClient([{ entitlement_id: 11, balance: 5 }]);
    expect(await spendTicket(input, client)).toEqual({ ok: true, kind: "spent", balance: 5 });
    // 한 문장이어야 한다 — 나뉘면 차감과 권한 부여 사이에 프로세스가 죽을 틈이 생긴다.
    expect(calls).toHaveLength(1);
  });

  it("권한 INSERT 가 차감 UPDATE 보다 먼저다 — 반대면 돈만 없어지는 경우가 생긴다", async () => {
    const { client, calls } = fakeClient([{ entitlement_id: 11, balance: 5 }]);
    await spendTicket(input, client);
    const { sql } = calls[0];
    expect(sql.indexOf("INSERT INTO entitlements")).toBeLessThan(sql.indexOf("UPDATE ticket_wallets"));
  });

  it("중복 요청은 UNIQUE 에 막혀 차감 없이 already 가 된다", async () => {
    const { client, calls } = fakeClient(
      [{ entitlement_id: null, balance: null }],
      [{ entitlement_id: 11, balance: 5 }],
    );
    expect(await spendTicket(input, client)).toEqual({ ok: true, kind: "already", balance: 5 });
    expect(calls[0].sql).toContain("ON CONFLICT");
    expect(calls[0].sql).toContain("DO NOTHING");
  });

  it("잔액이 모자라면 insufficient", async () => {
    const { client } = fakeClient(
      [{ entitlement_id: null, balance: null }],
      [{ entitlement_id: null, balance: 0 }],
    );
    expect(await spendTicket(input, client)).toEqual({
      ok: false,
      kind: "insufficient",
      balance: 0,
    });
  });

  it("지갑 행이 아예 없어도 잔액 0 으로 접는다", async () => {
    const { client } = fakeClient(
      [{ entitlement_id: null, balance: null }],
      [{ entitlement_id: null, balance: null }],
    );
    expect(await spendTicket(input, client)).toEqual({
      ok: false,
      kind: "insufficient",
      balance: 0,
    });
  });

  it("동시 사용으로 CHECK 가 터지면 insufficient — 문장 전체가 롤백돼 권한도 없다", async () => {
    const { client } = fakeClient(checkViolation(), [{ entitlement_id: null, balance: 0 }]);
    expect(await spendTicket(input, client)).toEqual({
      ok: false,
      kind: "insufficient",
      balance: 0,
    });
  });

  it("다른 제약 위반은 다시 던진다 — 전부 삼키면 DB 장애가 잔액 부족으로 둔갑한다", async () => {
    const { client } = fakeClient(checkViolation("ticket_entries_delta_check"));
    await expect(spendTicket(input, client)).rejects.toThrow();
  });

  it("CHECK 가 아닌 예외도 다시 던진다", async () => {
    const { client } = fakeClient(new Error("connection reset"));
    await expect(spendTicket(input, client)).rejects.toThrow("connection reset");
  });

  it("원장에 음수 delta 와 reason='spend' 를 남긴다", async () => {
    const { client, calls } = fakeClient([{ entitlement_id: 11, balance: 5 }]);
    await spendTicket({ ...input, cost: 2 }, client);
    expect(calls[0].sql).toContain("INSERT INTO ticket_entries");
    expect(calls[0].sql).toContain("'spend'");
    expect(calls[0].values).toContain(-2);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/lib/tickets/spend.test.ts
```

Expected: FAIL — `Failed to resolve import "./spend"`.

- [ ] **Step 3: `src/lib/tickets/spend.ts` 를 만든다**

```ts
import { sql as neonSql, type SqlClient } from "@/lib/db";
import type { Feature } from "./features";

const sql = neonSql as unknown as SqlClient;

export type SpendResult =
  | { ok: true; kind: "spent" | "already"; balance: number }
  | { ok: false; kind: "insufficient"; balance: number };

interface SpendInput {
  userId: string;
  feature: Feature;
  subjectKey: string;
  cost: number;
}

/** Postgres 가 0012 의 인라인 CHECK 에 자동으로 붙이는 제약 이름. */
const BALANCE_CHECK = "ticket_wallets_balance_check";

/**
 * 잔액 CHECK 위반인지 가린다. 23514 = check_violation.
 *
 * constraint 필드를 드라이버가 채워 줄 때도 있고 아닐 때도 있어 메시지로 물러선다.
 * 제약 이름까지 확인하는 이유: ticket_entries 의 delta CHECK 도 같은 코드로 오는데,
 * 그건 우리 버그(0장 차감)라 잔액 부족으로 삼키면 안 된다.
 */
function isBalanceCheckViolation(e: unknown): boolean {
  if (typeof e !== "object" || e === null) return false;
  const err = e as { code?: unknown; constraint?: unknown; message?: unknown };
  if (err.code !== "23514") return false;
  if (typeof err.constraint === "string") return err.constraint === BALANCE_CHECK;
  return typeof err.message === "string" && err.message.includes(BALANCE_CHECK);
}

/**
 * 이용권 1건 차감 + 열람 권한 부여.
 *
 * ⚠️ CTE 한 문장인 것과 그 안의 순서가 이 함수의 전부다.
 *
 * 권한 INSERT 가 먼저고 차감 UPDATE 가 뒤다. 반대로 하면 차감은 됐는데 권한이
 * UNIQUE 에 걸려 사라지는 경우가 생긴다 — 사용자는 이용권만 잃는다.
 *
 * 네 갈래 모두 앱이 아니라 제약이 판정한다:
 *  - 정상        : 권한이 생기고 잔액이 준다
 *  - 중복 요청   : entitlements_unique 충돌 → claim 이 비고 → EXISTS 가 거짓 → 차감 없음
 *  - 잔액 부족   : 지갑 행이 없거나 balance >= cost 가 거짓 → claim 자체가 안 생김
 *  - 동시 사용   : 두 UPDATE 가 행 잠금으로 직렬화되어 두 번째가 음수 → CHECK 가
 *                  문장 전체를 롤백 (권한 INSERT 까지 되돌아간다)
 *
 * 단위 테스트로는 동시성을 재현할 수 없다. 정확성의 근거는 이 코드가 아니라
 * 0012 의 CHECK 와 0014 의 UNIQUE 다 — 둘을 지우면 방어선이 통째로 사라진다.
 */
export async function spendTicket(
  a: SpendInput,
  client: SqlClient = sql,
): Promise<SpendResult> {
  try {
    const rows = await client`
      WITH claim AS (
        INSERT INTO entitlements (user_id, feature, subject_key, cost)
        SELECT ${a.userId}::bigint, ${a.feature}, ${a.subjectKey}, ${a.cost}
         WHERE (SELECT balance FROM ticket_wallets WHERE user_id = ${a.userId}::bigint) >= ${a.cost}
        ON CONFLICT (user_id, feature, subject_key) DO NOTHING
        RETURNING id
      ), pay AS (
        UPDATE ticket_wallets
           SET balance = balance - ${a.cost}, updated_at = now()
         WHERE user_id = ${a.userId}::bigint AND EXISTS (SELECT 1 FROM claim)
        RETURNING balance
      ), ledger AS (
        INSERT INTO ticket_entries (user_id, delta, reason, entitlement_id)
        SELECT ${a.userId}::bigint, ${-a.cost}, 'spend', id FROM claim
        RETURNING id
      )
      SELECT (SELECT id FROM claim) AS entitlement_id,
             (SELECT balance FROM pay) AS balance
    `;
    const row = rows[0];
    if (row?.entitlement_id != null) {
      return { ok: true, kind: "spent", balance: Number(row.balance ?? 0) };
    }
  } catch (e) {
    // 동시 사용으로 문장 전체가 롤백됐다. 아래 재조회가 실제 상태를 알려준다.
    if (!isBalanceCheckViolation(e)) throw e;
  }

  return await settle(a, client);
}

/**
 * 권한이 안 생긴 두 경우(이미 보유 / 잔액 부족)를 가른다.
 * CTE 결과만으로는 갈리지 않는다 — 둘 다 entitlement_id 가 NULL 이다.
 */
async function settle(a: SpendInput, client: SqlClient): Promise<SpendResult> {
  const rows = await client`
    SELECT
      (SELECT id FROM entitlements
        WHERE user_id = ${a.userId}::bigint
          AND feature = ${a.feature}
          AND subject_key = ${a.subjectKey}) AS entitlement_id,
      (SELECT balance FROM ticket_wallets WHERE user_id = ${a.userId}::bigint) AS balance
  `;
  const row = rows[0];
  const balance = Number(row?.balance ?? 0);
  return row?.entitlement_id != null
    ? { ok: true, kind: "already", balance }
    : { ok: false, kind: "insufficient", balance };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/tickets/spend.test.ts
```

Expected: PASS (9 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/tickets/spend.ts src/lib/tickets/spend.test.ts
git commit -m "feat(tickets): 차감과 권한 부여를 한 문장으로 묶는다"
```

---

## Task 11: 차감 API

**Files:**
- Create: `src/app/api/tickets/spend/_lib/handler.ts`
- Create: `src/app/api/tickets/spend/_lib/handler.test.ts`
- Create: `src/app/api/tickets/spend/route.ts`

**Interfaces:**
- Consumes: `FEATURE_IDS`, `FEATURE_COST`, `Feature` (Task 3), `SpendResult`, `spendTicket` (Task 10), `getProfile` (`@/lib/profiles/store`), `parseProfileParam` (`@/lib/profiles/param`)
- Produces:
  - `SpendDeps { userId: string | null; ownsSubject(...): Promise<boolean>; spend(...): Promise<SpendResult> }`
  - `handleSpend(raw: unknown, d: SpendDeps): Promise<SpendApiResult>`
  - `POST /api/tickets/spend` — 요청 `{ feature, subjectKey }`, 응답 `{ kind, balance }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/tickets/spend/_lib/handler.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { handleSpend, type SpendDeps } from "./handler";

function deps(over: Partial<SpendDeps> = {}): SpendDeps {
  return {
    userId: "7",
    ownsSubject: vi.fn(async () => true),
    spend: vi.fn(async () => ({ ok: true as const, kind: "spent" as const, balance: 5 })),
    ...over,
  };
}

const body = { feature: "full_report", subjectKey: "3" };

describe("handleSpend", () => {
  it("차감되면 200 과 잔액", async () => {
    expect(await handleSpend(body, deps())).toEqual({
      status: 200,
      body: { kind: "spent", balance: 5 },
    });
  });

  it("이미 열려 있으면 200 — 실패가 아니라 원하던 결과다", async () => {
    const r = await handleSpend(
      body,
      deps({ spend: vi.fn(async () => ({ ok: true as const, kind: "already" as const, balance: 5 })) }),
    );
    expect(r).toEqual({ status: 200, body: { kind: "already", balance: 5 } });
  });

  it("잔액이 모자라면 402 — 화면이 이 코드를 보고 충전으로 보낸다", async () => {
    const r = await handleSpend(
      body,
      deps({
        spend: vi.fn(async () => ({ ok: false as const, kind: "insufficient" as const, balance: 0 })),
      }),
    );
    expect(r).toEqual({ status: 402, body: { kind: "insufficient", balance: 0 } });
  });

  it("로그인하지 않았으면 401", async () => {
    expect((await handleSpend(body, deps({ userId: null }))).status).toBe(401);
  });

  it("요청 모양이 어긋나면 400", async () => {
    const d = deps();
    for (const bad of [
      null,
      {},
      { feature: "full_report" },
      { feature: "unknown_service", subjectKey: "3" },
      { feature: "full_report", subjectKey: "" },
    ]) {
      expect((await handleSpend(bad, d)).status).toBe(400);
    }
  });

  it("남의 대상이면 404 — 없는 대상과 구분하지 않는다", async () => {
    const r = await handleSpend(body, deps({ ownsSubject: vi.fn(async () => false) }));
    expect(r.status).toBe(404);
  });

  it("소유하지 않았으면 차감을 시도하지도 않는다", async () => {
    const spend = vi.fn(async () => ({ ok: true as const, kind: "spent" as const, balance: 5 }));
    await handleSpend(body, deps({ spend, ownsSubject: vi.fn(async () => false) }));
    expect(spend).not.toHaveBeenCalled();
  });

  it("단가는 서버 표에서 온다 — 요청에 cost 필드가 없다", async () => {
    const spend = vi.fn(async () => ({ ok: true as const, kind: "spent" as const, balance: 5 }));
    await handleSpend({ ...body, cost: 0 }, deps({ spend }));
    expect(spend).toHaveBeenCalledWith({
      userId: "7",
      feature: "full_report",
      subjectKey: "3",
      cost: 1,
    });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/app/api/tickets/spend/_lib/handler.test.ts
```

Expected: FAIL — `Failed to resolve import "./handler"`.

- [ ] **Step 3: `src/app/api/tickets/spend/_lib/handler.ts` 를 만든다**

```ts
import { z } from "zod";
import { FEATURE_COST, FEATURE_IDS, type Feature } from "@/lib/tickets/features";
import type { SpendResult } from "@/lib/tickets/spend";

// cost 를 받는 필드가 없는 것이 이 스키마의 요점이다 — 단가는 서버 표에서만 온다.
// feature 를 z.enum 으로 받으면 모르는 값이 여기서 400 으로 끊긴다.
const spendSchema = z.object({
  feature: z.enum(FEATURE_IDS),
  subjectKey: z.string().min(1),
});

export interface SpendDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  /** feature 마다 대상 소유 규칙이 다르다. 없는 대상도 false 다. */
  ownsSubject(userId: string, feature: Feature, subjectKey: string): Promise<boolean>;
  spend(a: {
    userId: string;
    feature: Feature;
    subjectKey: string;
    cost: number;
  }): Promise<SpendResult>;
}

export interface SpendApiResult {
  status: number;
  body: { kind: SpendResult["kind"]; balance: number } | { error: string };
}

export async function handleSpend(raw: unknown, d: SpendDeps): Promise<SpendApiResult> {
  const parsed = spendSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "요청을 확인해 주세요" } };
  if (d.userId === null) return { status: 401, body: { error: "로그인이 필요합니다" } };

  const { feature, subjectKey } = parsed.data;

  // ⚠️ 소유 확인이 이 핸들러의 존재 이유다. 빼면 남의 프로필 id 에 이용권을 써서
  // 존재 여부를 훑을 수 있고, 열람 권한이 남의 사주에 붙는다.
  // 없는 대상과 남의 대상을 구분하지 않는다 — 구분하면 id 로 훑을 수 있다.
  if (!(await d.ownsSubject(d.userId, feature, subjectKey))) {
    return { status: 404, body: { error: "대상을 찾을 수 없습니다" } };
  }

  const result = await d.spend({
    userId: d.userId,
    feature,
    subjectKey,
    cost: FEATURE_COST[feature],
  });

  // 402 는 완료 API 가 미결제에 쓰는 코드와 같다 — "돈이 더 필요하다"는 뜻이 같다.
  return {
    status: result.ok ? 200 : 402,
    body: { kind: result.kind, balance: result.balance },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/app/api/tickets/spend/_lib/handler.test.ts
```

Expected: PASS (8 tests).

- [ ] **Step 5: `src/app/api/tickets/spend/route.ts` 를 만든다**

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { parseProfileParam } from "@/lib/profiles/param";
import { getProfile } from "@/lib/profiles/store";
import type { Feature } from "@/lib/tickets/features";
import { spendTicket } from "@/lib/tickets/spend";
import { handleSpend } from "./_lib/handler";

/**
 * feature 별 대상 소유 규칙.
 *
 * switch + never 로 쓰는 이유: FEATURE_IDS 에 서비스를 추가하면 여기서 컴파일이
 * 깨진다. 규칙을 빠뜨린 서비스가 조용히 통과하면 소유 확인 없이 차감된다.
 */
async function ownsSubject(
  userId: string,
  feature: Feature,
  subjectKey: string,
): Promise<boolean> {
  switch (feature) {
    case "full_report": {
      // 검증 없이 넘기면 ::bigint 캐스팅이 DB 에러로 터져 404 여야 할 것이 500 이 된다.
      const param = parseProfileParam({ profile: subjectKey });
      if (param.kind !== "id") return false;
      return (await getProfile(userId, param.id)) !== null;
    }
    case "compatibility":
      // 궁합 화면이 아직 없다. 열어 두면 소유 확인 규칙이 없는 채로 차감된다 — 닫는다.
      // 화면을 만들 때 pairKey 의 두 프로필을 각각 소유 확인하는 규칙으로 바꾼다.
      return false;
    default: {
      const exhaustive: never = feature;
      return exhaustive;
    }
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleSpend(raw, {
      userId: session?.userId ?? null,
      ownsSubject,
      spend: (a) => spendTicket(a),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/tickets/spend]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
```

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/tickets/
git commit -m "feat(tickets): 이용권 차감 API"
```

---

## Task 12: 열람 권한 판정을 entitlements 로 옮긴다

**Files:**
- Modify: `src/lib/profiles/store.ts`
- Test: `src/lib/profiles/store.test.ts`
- Modify (픽스처만): `src/app/home/_lib/to-home-entry.test.ts`, `src/app/report/_lib/to-birth-input.test.ts`, `src/app/report/_lib/to-meta.test.ts`

**Interfaces:**
- Consumes: 없음 (SQL 만 바뀐다)
- Produces: `ProfileRow.isPaid` → `ProfileRow.isUnlocked`

`ProfileRow.isPaid` 라는 이름은 이제 사실과 어긋난다 — 돈을 낸 것이 아니라 이용권을 쓴 것이다.

- [ ] **Step 1: 테스트를 새 모양으로 고친다**

`src/lib/profiles/store.test.ts` 에서 `isPaid` 를 `isUnlocked` 로 바꾸고, 조인 검증을 아래로 바꾼다.

```ts
it("권한이 조인되면 isUnlocked 가 true", async () => {
  const { client } = fakeClient([{ ...profileDbRow, is_unlocked: true }]);
  const rows = await listProfiles("7", client);
  expect(rows[0].isUnlocked).toBe(true);
});

it("purchases 가 아니라 entitlements 를 조인한다 — 권한의 출처는 이용권 사용이다", async () => {
  const { client, calls } = fakeClient([]);
  await listProfiles("7", client);
  expect(calls[0].sql).toContain("LEFT JOIN entitlements");
  expect(calls[0].sql).not.toContain("purchases");
  expect(calls[0].sql).toContain("'full_report'");
});

it("subject_key 는 프로필 id 를 문자열로 맞춘 값이다 — text 컬럼과 bigint 를 그냥 비교하면 터진다", async () => {
  const { client, calls } = fakeClient([]);
  await listProfiles("7", client);
  expect(calls[0].sql).toContain("p.id::text");
});
```

`getProfile` 쪽 단언(`row?.isPaid`)도 `row?.isUnlocked` 로 바꾼다. 기존 픽스처 상수 이름이 다르면 그 이름을 쓴다.

나머지 세 테스트 파일에서는 `ProfileRow` 픽스처의 `isPaid: false` 를 `isUnlocked: false` 로 바꾸기만 한다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/lib/profiles/store.test.ts
```

Expected: FAIL — `isUnlocked` 가 `ProfileRow` 에 없다.

- [ ] **Step 3: `src/lib/profiles/store.ts` 를 고친다**

`import { PRODUCT_FULL_REPORT } from "./products";` 를 지운다. 네 곳을 바꾼다.

```ts
export interface ProfileRow {
  // ... (나머지 필드는 그대로)
  /** entitlements 조인에서 파생 — 이 프로필의 전체 리포트에 이용권을 쓴 적이 있으면 true. */
  isUnlocked: boolean;
}

export type CreateProfileInput = Omit<ProfileRow, "id" | "createdAt" | "isUnlocked">;
```

`toProfileRow` 의 마지막 줄:

```ts
    isUnlocked: r.is_unlocked === true,
```

`listProfiles` 와 `getProfile` 의 조인을 바꾼다. 두 함수 모두 같은 모양이다.

```ts
/**
 * 내 프로필을 최신순으로. 열람 권한은 entitlements 를 LEFT JOIN 해 파생한다 —
 * profiles 에 컬럼을 두면 권한 테이블과 두 벌이 되어 어긋난다.
 *
 * subject_key 가 text 라 p.id 를 ::text 로 맞춘다. 반대로 subject_key 를
 * ::bigint 로 캐스팅하면 궁합의 '12:34' 같은 키에서 터진다.
 */
export async function listProfiles(
  userId: string,
  client: SqlClient = sql,
): Promise<ProfileRow[]> {
  const rows = await client`
    SELECT p.*, (e.id IS NOT NULL) AS is_unlocked
    FROM profiles p
    LEFT JOIN entitlements e
      ON e.user_id = p.user_id
     AND e.feature = 'full_report'
     AND e.subject_key = p.id::text
    WHERE p.user_id = ${userId}::bigint
    ORDER BY p.created_at DESC
  `;
  return rows.map(toProfileRow);
}
```

`getProfile` 도 같은 조인으로 바꾸고, `WHERE p.id = ${id}::bigint AND p.user_id = ${userId}::bigint` 와 그 위의 ⚠️ 주석은 그대로 둔다. 함수 주석 첫 줄만 `isUnlocked 파생은 listProfiles 와 같다.` 로 바꾼다.

`feature` 값을 리터럴로 적는 이유를 한 줄 남긴다 — `@/lib/tickets/features` 를 import 하면 profiles 가 tickets 에 의존하게 되고, 이 값은 DB 에 이미 나간 문자열이라 상수를 따라 움직여서는 안 된다.

- [ ] **Step 4: 픽스처 세 파일을 고친다**

`src/app/home/_lib/to-home-entry.test.ts`, `src/app/report/_lib/to-birth-input.test.ts`, `src/app/report/_lib/to-meta.test.ts` 에서 `isPaid: false` → `isUnlocked: false`.

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run src/lib/profiles/ src/app/home/_lib/ src/app/report/_lib/
```

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/profiles/ src/app/home/_lib/to-home-entry.test.ts src/app/report/_lib/to-birth-input.test.ts src/app/report/_lib/to-meta.test.ts
git commit -m "refactor(profiles): 열람 권한을 purchases 대신 entitlements 에서 읽는다"
```

---

## Task 13: 충전 화면

**Files:**
- Modify: `src/app/checkout/page.tsx`
- Modify: `src/app/checkout/_lib/pricing.ts`
- Modify: `src/app/checkout/_lib/pricing.test.ts`
- Create: `src/app/checkout/_components/PackagePicker.tsx`
- Modify: `src/app/checkout/_components/CheckoutView.tsx`
- Modify: `src/app/checkout/_components/OrderSummary.tsx`
- Modify: `src/app/checkout/_components/StickyPayBar.tsx`
- Modify: `src/app/checkout/_hooks/use-payment.ts`

**Interfaces:**
- Consumes: `listPackages`, `creditedTickets`, `TicketPackage`, `TicketPackageId` (Task 2), `safeNextPath` (Task 4), `getBalance` (Task 5)
- Produces: `usePayment(next: string)` → `pay(packageId: TicketPackageId, method: PaymentMethodId)`

- [ ] **Step 1: `_lib/pricing.ts` 의 재수출을 바꾸고 테스트를 고친다**

`src/app/checkout/_lib/pricing.ts`:

```ts
// 상수는 src/lib/payments/pricing.ts 가 소유한다 — 주문 생성 API 가 같은 값으로
// 청구 금액을 박아야 하는데, src/lib 이 이 폴더를 import 할 수는 없다.
// 포맷 함수는 화면 관심사라 여기 남는다.
export { creditedTickets, listPackages, type TicketPackage, type TicketPackageId } from "@/lib/payments/pricing";

/**
 * 1234567 → "₩1,234,567".
 * Intl 대신 직접 끊는 이유: toLocaleString 은 런타임 ICU 유무에 따라 구분자가
 * 달라져 서버와 브라우저가 다른 문자열을 낸다(하이드레이션 불일치).
 */
export function formatKrw(won: number): string {
  return `₩${Math.round(won).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/** 장당 단가 한 줄. "장당 ₩769" — 소수점을 버려 두 패키지가 같은 값으로 보이지 않게 반올림한다. */
export function formatPerTicket(amount: number, tickets: number): string {
  return `장당 ${formatKrw(Math.round(amount / tickets))}`;
}
```

`formatKrwDiscount` 는 쓰는 곳이 사라지므로 지운다.

`src/app/checkout/_lib/pricing.test.ts` 에서 `FULL_REPORT_PRICE` describe 블록과 `formatKrwDiscount` 테스트를 지우고, 아래를 넣는다. `formatKrw` 기존 테스트는 그대로 둔다.

```ts
describe("formatPerTicket", () => {
  it("장당 단가를 반올림해 보여준다", () => {
    expect(formatPerTicket(10000, 13)).toBe("장당 ₩769");
    expect(formatPerTicket(1000, 1)).toBe("장당 ₩1,000");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/app/checkout/_lib/pricing.test.ts
```

Expected: FAIL — `formatPerTicket` 이 없다.

- [ ] **Step 3: 위 `_lib/pricing.ts` 를 적용하고 테스트를 통과시킨다**

```bash
npx vitest run src/app/checkout/_lib/pricing.test.ts
```

Expected: PASS.

- [ ] **Step 4: `_components/PackagePicker.tsx` 를 만든다**

```tsx
"use client";
import { creditedTickets, formatKrw, formatPerTicket, type TicketPackage, type TicketPackageId } from "../_lib/pricing";

/**
 * 충전 패키지 선택. PaymentMethodList 와 같은 라디오 그룹 모양이라 키보드 동작이 같다.
 *
 * 보너스를 별도 배지로 빼는 이유: "6장"만 보이면 5,000원에 6장이라는 이득이 안 읽힌다.
 */
export function PackagePicker({
  packages,
  selected,
  onSelect,
}: {
  packages: TicketPackage[];
  selected: TicketPackageId;
  onSelect: (id: TicketPackageId) => void;
}) {
  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(17,24,39,.04)] sm:p-6">
      <h2 className="m-0 mb-4 text-[15px] font-bold tracking-[-0.01em]">충전할 이용권</h2>
      <div role="radiogroup" aria-label="충전 패키지" className="flex flex-col gap-2.5">
        {packages.map((p) => {
          const total = creditedTickets(p);
          const active = p.id === selected;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(p.id)}
              className={`flex items-center justify-between gap-3 rounded-[14px] border-[1.5px] px-4 py-3.5 text-left transition-colors ${
                active ? "border-accent bg-accent/5" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[15.5px] font-bold tracking-[-0.01em]">이용권 {total}장</span>
                  {p.bonus > 0 && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11.5px] font-bold text-accent">
                      +{p.bonus}장 더
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[13px] text-slate-400">
                  {formatPerTicket(p.amount, total)}
                </span>
              </span>
              <span className="flex-none text-[15px] font-bold">{formatKrw(p.amount)}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3.5 mb-0 text-[12.5px] leading-[1.6] text-slate-400 [text-wrap:pretty]">
        이용권 1장으로 리포트 한 편을 열 수 있어요. 한 번 연 리포트는 계속 볼 수 있어요.
      </p>
    </section>
  );
}
```

- [ ] **Step 5: `_components/OrderSummary.tsx` 를 충전 요약으로 바꾼다**

`target`/`OrderTarget` 을 없애고 선택한 패키지를 받는다. 결제 대상 아바타 블록과 정가·할인 두 줄을 지우고 아래로 바꾼다. 약관 동의 블록, `PayButton`, `LockGlyph` 줄은 그대로 둔다.

```tsx
"use client";
import { creditedTickets, formatKrw, type TicketPackage } from "../_lib/pricing";
import { LockGlyph } from "./LockGlyph";
import { PayButton } from "./PayButton";

export function OrderSummary({
  pkg,
  balance,
  agreed,
  canPay,
  pending,
  onToggleAgree,
  onPay,
}: {
  pkg: TicketPackage;
  /** 충전 전 잔액. 충전 뒤 얼마가 되는지 보여 주려고 받는다. */
  balance: number;
  agreed: boolean;
  canPay: boolean;
  pending: boolean;
  onToggleAgree: () => void;
  onPay: () => void;
}) {
  const credited = creditedTickets(pkg);

  return (
    <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_3px_rgba(17,24,39,.04)]">
      <div className="px-[18px] pt-5 pb-[18px] sm:px-6 sm:pt-[22px] sm:pb-5">
        <h2 className="m-0 mb-4 text-[15px] font-bold tracking-[-0.01em]">주문 내역</h2>

        <div className="flex flex-col gap-2.5 border-b border-slate-100 pb-[18px]">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">이용권 {pkg.tickets}장</span>
            <span className="font-semibold">{formatKrw(pkg.amount)}</span>
          </div>
          {pkg.bonus > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">묶음 보너스</span>
              <span className="font-semibold text-accent">+{pkg.bonus}장</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">충전 후 잔액</span>
            <span className="font-semibold">{balance + credited}장</span>
          </div>
        </div>

        <div className="flex items-baseline justify-between pt-[18px]">
          <span className="text-[15px] font-bold">최종 결제 금액</span>
          <span className="text-2xl font-bold tracking-[-0.03em]">{formatKrw(pkg.amount)}</span>
        </div>
      </div>

      {/* 이하 약관 동의 블록·PayButton·LockGlyph 줄은 기존 그대로.
          PayButton 의 label 만 아래로 바꾼다. */}
    </div>
  );
}
```

`PayButton` 의 `label` 을 바꾼다.

```tsx
          label={`${formatKrw(pkg.amount)} 결제하기`}
```

환불 안내 문구도 충전에 맞게 바꾼다 — `CheckoutView` 의 `<aside>` 안:

```tsx
            <p className="mt-3.5 mr-1 ml-1 text-[12.5px] leading-[1.6] text-slate-300 [text-wrap:pretty]">
              사용하지 않은 이용권은 결제일로부터 7일 내 전액 환불 가능합니다. 이미 사용한
              이용권은 환불되지 않습니다.
            </p>
```

- [ ] **Step 6: `_components/StickyPayBar.tsx` 에서 가격을 props 로 받는다**

`FULL_REPORT_PRICE` import 를 지우고 `amount: number` prop 을 받아 `{formatKrw(amount)}` 로 쓴다. 나머지 마크업은 그대로.

- [ ] **Step 7: `_hooks/use-payment.ts` 를 고친다**

시그니처와 요청 본문, 성공 후 이동만 바뀐다. 결제창 호출부(판별 유니온 분기)는 그대로 둔다.

```ts
export function usePayment(next: string) {
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const pay = useCallback(
    async (packageId: TicketPackageId, method: PaymentMethodId) => {
      setStatus("pending");
      setError(null);
      try {
        const order = (await postJson("/api/payments/orders", {
          packageId,
          method,
          next,
        })) as OrderResponse;

        // ... 결제창 호출부는 기존 그대로 ...

        await postJson("/api/payments/complete", { paymentId: order.paymentId });
        // replace 인 이유: 뒤로 가기로 충전 화면에 돌아와도 이미 충전이 끝나 있어
        // 히스토리에 남길 이유가 없다.
        router.replace(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "결제를 진행하지 못했습니다");
        setStatus("idle");
      }
    },
    [next, router],
  );

  return { pay, status, error };
}
```

`import type { TicketPackageId } from "../_lib/pricing";` 를 추가하고, 주석 첫 줄을 `결제 시작. 주문 생성 → 결제창 → 완료 확정 → 원래 자리.` 로 바꾼다.

- [ ] **Step 8: `_components/CheckoutView.tsx` 를 고친다**

`profileId`/`target` 을 `next`/`balance`/`packages` 로 바꾸고, 패키지 선택 상태를 추가한다.

```tsx
export function CheckoutView({
  next,
  balance,
  packages,
  available,
}: {
  next: string;
  balance: number;
  packages: TicketPackage[];
  available: PaymentMethodId[];
}) {
  const methods = PAYMENT_METHODS.filter((m) => available.includes(m.id));
  const [method, setMethod] = useState<PaymentMethodId>(methods[0]?.id ?? "card");
  // 기본 선택은 가운데 패키지다 — 첫 항목을 고르면 가장 싼 것만 팔린다.
  const [packageId, setPackageId] = useState<TicketPackageId>(
    packages[Math.floor(packages.length / 2)]?.id ?? packages[0].id,
  );
  const [agreed, setAgreed] = useState(false);
  const { pay, status, error } = usePayment(next);
  const pending = status === "pending";
  const ready = methods.length > 0;

  const pkg = packages.find((p) => p.id === packageId) ?? packages[0];
  // ...
}
```

머리말 블록에서 뒤로 가기 링크와 제목을 바꾼다.

```tsx
          <Link
            href={next}
            className="mb-3 inline-block text-[13.5px] font-semibold text-slate-400 hover:text-slate-600"
          >
            ← 돌아가기
          </Link>
          <h1 className="m-0 text-[clamp(24px,5vw,34px)] font-bold tracking-[-0.035em]">
            이용권 충전
          </h1>
          <p className="mt-2 mb-0 text-[14px] text-slate-400">지금 {balance}장 있어요</p>
```

왼쪽 칼럼에 `PackagePicker` 를 `PaymentMethodList` 위에 넣고, `OrderSummary` 와 `StickyPayBar` 에 새 props 를 넘긴다.

```tsx
          <div className="flex flex-col gap-5">
            <PackagePicker packages={packages} selected={packageId} onSelect={setPackageId} />
            {ready ? (
              <PaymentMethodList methods={methods} selected={method} onSelect={setMethod} />
            ) : (
              /* 미설정 안내 블록은 기존 그대로 */
            )}
          </div>
```

```tsx
            <OrderSummary
              pkg={pkg}
              balance={balance}
              agreed={agreed}
              canPay={agreed && ready}
              pending={pending}
              onToggleAgree={() => setAgreed((v) => !v)}
              onPay={() => pay(packageId, method)}
            />
```

```tsx
      <StickyPayBar
        amount={pkg.amount}
        agreed={agreed && ready}
        pending={pending}
        onPay={() => pay(packageId, method)}
      />
```

`import type { OrderTarget } from "../_lib/to-order";` 를 지우고 `import { PackagePicker } from "./PackagePicker";`, `import type { TicketPackage, TicketPackageId } from "../_lib/pricing";` 를 넣는다.

- [ ] **Step 9: `src/app/checkout/page.tsx` 를 고친다**

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { availableMethods } from "@/lib/payments/config";
import { listPackages } from "@/lib/payments/pricing";
import { safeNextPath } from "@/lib/nav/next-param";
import { first, type SearchParams } from "@/lib/profiles/param";
import { getBalance } from "@/lib/tickets/wallet";
import { CheckoutHeader } from "./_components/CheckoutHeader";
import { CheckoutView } from "./_components/CheckoutView";

/**
 * 이용권 충전 화면.
 *
 * 프로필을 읽지 않는다 — 충전에는 대상이 없다. 단건 결제 시절의 소유 확인·중복
 * 결제 가드가 사라진 것은 누락이 아니라 상품이 바뀐 결과다.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const next = safeNextPath(first(sp.next));

  const session = await getSession();
  if (session === null) {
    redirect(`/login?next=${encodeURIComponent(`/checkout?next=${encodeURIComponent(next)}`)}`);
  }

  const balance = await getBalance(session.userId);

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <CheckoutHeader />
      <CheckoutView
        next={next}
        balance={balance}
        packages={listPackages()}
        available={availableMethods()}
      />
    </div>
  );
}
```

- [ ] **Step 10: 타입 검사와 테스트**

```bash
npm run typecheck
```

Expected: `to-order.ts` 를 아직 지우지 않았다면 그 파일이 `ProfileRow.isPaid` 를 참조해 에러가 난다. 그 외에 `checkout/` 안에서 에러가 없어야 한다. `to-order` 관련 에러는 Task 16 에서 파일과 함께 사라진다.

```bash
npx vitest run src/app/checkout/
```

Expected: `pricing.test.ts` PASS. `to-order.test.ts` 는 아직 남아 있고 통과한다.

- [ ] **Step 11: 커밋**

```bash
git add src/app/checkout/
git commit -m "feat(checkout): 리포트 결제 화면을 이용권 충전 화면으로 바꾼다"
```

---

## Task 14: 리포트 잠금 해제 CTA

**Files:**
- Modify: `src/app/report/_lib/access.ts`
- Modify: `src/app/report/_lib/access.test.ts`
- Modify: `src/app/report/page.tsx`
- Modify: `src/app/report/_components/ReportBody.tsx`
- Create: `src/app/report/_hooks/use-unlock.ts`
- Modify: `src/app/report/_components/LockedSections.tsx`

**Interfaces:**
- Consumes: `POST /api/tickets/spend` (Task 11), `ProfileRow.isUnlocked` (Task 12)
- Produces: `ReportAccess { isLoggedIn: boolean; isUnlocked: boolean }`, `useUnlock(profileId?: string)`

- [ ] **Step 1: `access.test.ts` 의 `isPaid` 를 `isUnlocked` 로 바꾼다**

기존 7개 단언에서 키 이름만 바꾼다. `?paid=true` 토글 자체(개발용, 프로덕션 무시)는 그대로 둔다 — 쿼리 파라미터 이름은 URL 계약이라 함께 바꾸면 기존 개발 링크가 조용히 죽는다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/app/report/_lib/access.test.ts
```

Expected: FAIL — 결과 객체 키가 `isPaid` 다.

- [ ] **Step 3: `src/app/report/_lib/access.ts` 를 고친다**

```ts
// 리포트 접근 권한. isLoggedIn 은 실제 세션으로 정해진다. isUnlocked 는 여기서는
// 여전히 ?paid=true 개발용 쿼리 토글이고(프로덕션에서는 무시) — 실제 열람 권한은
// page.tsx 가 이 값에 profile.isUnlocked(entitlements 조인, src/lib/profiles/store.ts)를
// OR 해서 최종 판단한다.
//
// ?paid 라는 파라미터 이름은 그대로 둔다 — URL 계약이라 바꾸면 기존 개발 링크가 죽는다.

export interface ReportAccess {
  isLoggedIn: boolean;
  isUnlocked: boolean;
}

export function getReportAccess(
  searchParams: SearchParams,
  session: SessionPayload | null,
): ReportAccess {
  // ?paid=true는 개발용 토글이다. 프로덕션에서 열어 두면 로그인한 아무나 이걸 붙여
  // 유료 8섹션을 실제로 생성시킬 수 있고, 그 결과가 원국 단위 공유 캐시에 영구
  // 저장돼 이용권 없이도 유료 리포트가 공짜가 된다 — 프로덕션에서는 무시한다.
  const isUnlocked = process.env.NODE_ENV !== "production" && first(searchParams.paid) === "true";
  const isLoggedIn = session !== null || isUnlocked;
  return { isLoggedIn, isUnlocked };
}
```

- [ ] **Step 4: `page.tsx` 와 `ReportBody.tsx` 의 참조를 바꾼다**

`src/app/report/page.tsx`:

```ts
      sectionKeys: access.isUnlocked ? SECTION_KEYS : FREE_SECTION_KEYS,
```

```ts
  // 이용권을 쓴 프로필이면 유료 섹션을 연다. profile.isUnlocked 는 entitlements 조인에서 온다.
  const profileAccess: ReportAccess = {
    ...access,
    isUnlocked: access.isUnlocked || profile.isUnlocked,
  };
```

58번째 줄 근처 주석의 `profile.isPaid(purchases 조인)` 도 `profile.isUnlocked(entitlements 조인)` 로 고친다.

`src/app/report/_components/ReportBody.tsx`: `access.isPaid` → `access.isUnlocked`.

- [ ] **Step 5: `src/app/report/_hooks/use-unlock.ts` 를 만든다**

```ts
"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

export type UnlockStatus = "idle" | "pending";

/**
 * 이용권으로 전체 리포트를 연다.
 *
 * 성공 뒤 router.refresh() 를 부르는 이유: 유료 섹션 생성은 서버 컴포넌트가 한다.
 * 여기서 화면 상태만 바꾸면 잠금만 풀리고 내용이 비어 있다.
 *
 * ⚠️ refresh 직후가 이 앱에서 가장 느린 순간이다 — 유료 12섹션 첫 생성이 통째로
 * 그 요청에 걸린다(report/page.tsx 의 maxDuration 주석 참조). 화면은 그동안
 * pending 을 유지해 사용자가 버튼을 다시 누르지 않게 한다. 다시 눌러도 권한
 * UNIQUE 가 이중 차감을 막지만, 응답을 두 번 기다리게 할 이유는 없다.
 */
export function useUnlock(profileId: string | undefined) {
  const router = useRouter();
  const [status, setStatus] = useState<UnlockStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const unlock = useCallback(async () => {
    if (!profileId) return;
    setStatus("pending");
    setError(null);
    try {
      const res = await fetch("/api/tickets/spend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: "full_report", subjectKey: profileId }),
      });

      // 402 는 잔액 부족이다. 충전하고 돌아올 자리를 넘긴다.
      if (res.status === 402) {
        router.push(
          `/checkout?next=${encodeURIComponent(`/report?profile=${profileId}`)}`,
        );
        return;
      }
      if (!res.ok) throw new Error("리포트를 열지 못했습니다");

      // 200 은 spent 와 already 둘 다다. 화면이 할 일은 같다 — 다시 그린다.
      router.refresh();
      // pending 을 풀지 않는다: refresh 가 끝나면 이 컴포넌트 자체가 사라진다.
    } catch (e) {
      setError(e instanceof Error ? e.message : "리포트를 열지 못했습니다");
      setStatus("idle");
    }
  }, [profileId, router]);

  return { unlock, status, error };
}
```

- [ ] **Step 6: `src/app/report/_components/LockedSections.tsx` 를 고친다**

CTA 를 링크에서 버튼으로 바꾼다. 스크롤 감시(`inlineRef`, `showBar`)와 잠긴 섹션 목록 마크업은 그대로 둔다.

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import type { LockedSectionMeta } from "../_lib/report-content";
import { useUnlock } from "../_hooks/use-unlock";

export function LockedSections({
  sections,
  isLoggedIn,
  profileId,
}: {
  sections: LockedSectionMeta[];
  isLoggedIn: boolean;
  /** 픽스처 데모에는 없다. 없으면 열 대상이 없어 CTA 가 제자리에 머문다. */
  profileId?: string;
}) {
  const inlineRef = useRef<HTMLDivElement>(null);
  const [showBar, setShowBar] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      let show = window.scrollY > 500;
      const el = inlineRef.current;
      if (show && el && el.getBoundingClientRect().top < window.innerHeight) show = false;
      setShowBar((prev) => (prev !== show ? show : prev));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const { unlock, status, error } = useUnlock(profileId);
  const pending = status === "pending";

  // 이용권을 쓰려면 계정이 있어야 한다. 비로그인에게는 이 버튼의 첫 단계가 로그인이고,
  // 로그인하는 순간 퍼널에서 맡겨둔 드래프트가 프로필로 승격된다.
  // 로그인했는데 profileId 가 없는 경우는 픽스처 데모뿐이다 — 열 대상이 없으니 그대로 둔다.
  const loginHref = `/login?next=${encodeURIComponent("/report")}`;
  const label = pending
    ? "여는 중이에요…"
    : isLoggedIn
      ? "이용권 1장으로 전체 보기"
      : "로그인하고 전체 결과 보기";

  const CTA_CLASS =
    "block w-full max-w-[360px] text-base font-semibold text-white bg-accent py-4 rounded-[14px] shadow-[0_8px_20px_rgba(37,99,235,.28)] text-center hover:bg-accent-700 disabled:opacity-60";

  // 비로그인은 링크, 로그인은 버튼이다 — 링크로 두면 차감이 GET 이 되고,
  // 버튼으로 두면 비로그인이 로그인 화면으로 못 간다.
  const cta = !isLoggedIn ? (
    <a href={loginHref} className={CTA_CLASS}>
      {label}
    </a>
  ) : (
    <button type="button" onClick={unlock} disabled={pending || !profileId} className={CTA_CLASS}>
      {label}
    </button>
  );

  return (
    <>
      <section className="mt-[72px] flex flex-col gap-3">
        {/* 잠긴 섹션 목록은 기존 그대로 */}
        <div ref={inlineRef} className="mt-5 text-center flex flex-col items-center gap-3.5">
          <p className="text-[15px] text-slate-500 m-0 [text-wrap:pretty]">
            나머지 결과가 궁금하신가요?
          </p>
          {cta}
          {error && (
            <p role="alert" className="m-0 text-[13.5px] font-semibold text-red-600">
              {error}
            </p>
          )}
        </div>
      </section>
      {showBar && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-[clamp(20px,5vw,24px)] pt-7 pb-[18px] bg-gradient-to-b from-transparent to-white to-[55%] pointer-events-none">
          <div className="max-w-[720px] mx-auto flex justify-center [&>*]:pointer-events-auto">
            {cta}
          </div>
        </div>
      )}
    </>
  );
}
```

`inlineRef` 가 `HTMLAnchorElement` 에서 `HTMLDivElement` 로 바뀐 것에 주의한다 — CTA 가 링크일 수도 버튼일 수도 있어 감싸는 `div` 를 기준으로 잡는다.

- [ ] **Step 7: 테스트와 타입 검사**

```bash
npx vitest run src/app/report/
```

Expected: PASS.

```bash
npm run typecheck
```

Expected: `to-order.ts` 관련 에러만 남는다 (Task 16 에서 해소).

- [ ] **Step 8: 커밋**

```bash
git add src/app/report/
git commit -m "feat(report): 잠긴 섹션을 이용권으로 연다"
```

---

## Task 15: 홈에 잔액 표시

**Files:**
- Modify: `src/app/home/page.tsx`
- Modify: `src/app/home/_components/HomeHeader.tsx`

**Interfaces:**
- Consumes: `getBalance` (Task 5)
- Produces: `HomeHeader({ displayName, balance })` — `balance: number | null` (null = 비로그인)

- [ ] **Step 1: `HomeHeader.tsx` 를 고친다**

```tsx
import Link from "next/link";
import { AppBrand } from "@/components/AppBrand";
import { HomeMenu } from "./HomeMenu";

export function HomeHeader({
  displayName,
  balance,
}: {
  displayName: string | null;
  /** 비로그인이면 null — 잔액이 0 인 것과 다르다. */
  balance: number | null;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-[14px]">
      <div className="mx-auto flex h-14 max-w-[780px] items-center justify-between gap-3 px-5 md:px-8">
        <AppBrand href="/home" size="xs" />
        <div className="flex items-center gap-2.5">
          {balance !== null && (
            // 0장일 때도 보여준다 — 없다는 사실이 곧 충전 유인이다.
            <Link
              href="/checkout?next=/home"
              className="rounded-full bg-slate-100 px-3 py-1.5 text-[12.5px] font-bold text-slate-600 hover:bg-slate-200"
            >
              이용권 {balance}장
            </Link>
          )}
          <HomeMenu displayName={displayName} />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: `src/app/home/page.tsx` 를 고친다**

`import { getBalance } from "@/lib/tickets/wallet";` 를 추가하고, 세션 블록과 렌더를 바꾼다.

```tsx
  let displayName: string | null = null;
  let balance: number | null = null;
  let entries: HomeEntry[] = [];
  let canAdd = true;

  if (session) {
    const [user, rows, tickets] = await Promise.all([
      getUser(session.userId),
      listProfiles(session.userId),
      getBalance(session.userId),
    ]);
    displayName = resolveDisplayName(user);
    entries = rows.map(toHomeEntry);
    canAdd = rows.length < MAX_PROFILES;
    balance = tickets;
  }
```

```tsx
      <HomeHeader displayName={displayName} balance={balance} />
```

- [ ] **Step 3: 타입 검사**

```bash
npm run typecheck
```

Expected: `to-order.ts` 관련 에러만 남는다.

- [ ] **Step 4: 커밋**

```bash
git add src/app/home/
git commit -m "feat(home): 헤더에 이용권 잔액을 보여준다"
```

---

## Task 16: 단건 결제 잔재 제거와 전체 검증

**Files:**
- Delete: `src/lib/profiles/products.ts`
- Delete: `src/app/checkout/_lib/to-order.ts`
- Delete: `src/app/checkout/_lib/to-order.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (정리)

- [ ] **Step 1: 죽은 파일을 지운다**

```bash
git rm src/lib/profiles/products.ts src/app/checkout/_lib/to-order.ts src/app/checkout/_lib/to-order.test.ts
```

- [ ] **Step 2: 남은 참조를 훑는다**

```bash
git grep -n "PRODUCT_FULL_REPORT\|FULL_REPORT_PRICE\|FULL_REPORT_ORDER_NAME\|toOrderTarget\|OrderTarget\|markPurchasePaid\|isPaid" -- src
```

Expected: **아무것도 안 나온다.** 나오는 것이 있으면 그 파일을 고친다. `report/_lib/access.ts` 의 `?paid=true` 파라미터 이름과 그 주석은 `isPaid` 라는 식별자가 아니므로 이 검색에 걸리지 않는다.

- [ ] **Step 3: 전체 테스트**

```bash
npm test
```

Expected: 전부 PASS. 실패하면 그 테스트가 가리키는 파일을 고친다 — 이 시점에 남는 실패는 대부분 `ProfileRow` 픽스처의 `isPaid` 잔재다.

- [ ] **Step 4: 타입 검사**

```bash
npm run typecheck
```

Expected: 에러 0.

- [ ] **Step 5: 린트**

```bash
npm run lint
```

Expected: 에러 0.

- [ ] **Step 6: 빌드**

```bash
npm run build
```

Expected: 성공. `/api/tickets/spend` 가 라우트 목록에 나타난다.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "refactor(payments): 단건 결제 잔재를 걷어낸다"
```

---

## Task 17: 브라우저에서 흐름 확인

**Files:** 없음 (검증만)

**Interfaces:**
- Consumes: Task 1~16 전부

단위 테스트로는 CTE 두 개와 화면 전환을 검증할 수 없다. 실제로 돌려 본다.

- [ ] **Step 1: `.claude/launch.json` 이 없으면 만든다**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

- [ ] **Step 2: 개발 서버를 띄우고 `/home` 을 연다**

preview_start 로 `dev` 를 시작한다. Bash 로 서버를 띄우지 않는다.

Expected: 로그인 상태면 헤더에 `이용권 0장` 칩이 보인다.

- [ ] **Step 3: 충전 화면을 확인한다**

`/checkout?next=/home` 으로 이동.

Expected: 패키지 3장이 보이고 가운데(`이용권 6장`, `+1장 더`)가 기본 선택돼 있다. 주문 요약의 "충전 후 잔액"이 `6장`.

- [ ] **Step 4: 오픈 리다이렉트가 막히는지 확인한다**

`/checkout?next=https://example.com` 으로 이동한 뒤 "← 돌아가기" 링크의 `href` 를 read_page 로 읽는다.

Expected: `/home`. `https://example.com` 이면 Task 4 배선이 빠진 것이다.

- [ ] **Step 5: 잔액 0 에서 리포트 열기를 시도한다**

프로필 리포트(`/report?profile=<id>`)로 가서 "이용권 1장으로 전체 보기" 를 누른다.

Expected: `/checkout?next=%2Freport%3Fprofile%3D<id>` 로 이동한다. 콘솔에 에러가 없다.

- [ ] **Step 6: 콘솔과 서버 로그를 확인한다**

read_console_messages 와 preview_logs 로 에러를 훑는다.

Expected: 에러 없음. 결제 키가 없는 환경이면 충전 화면에 "결제를 준비 중입니다" 블록이 뜨는 것이 정상이다.

- [ ] **Step 7: 결과를 스크린샷으로 남긴다**

충전 화면과 리포트 CTA 를 각각 찍는다.

- [ ] **Step 8: 실제 결제까지 확인한다 (포트원 테스트 키가 있을 때만)**

키가 없으면 이 단계를 건너뛰고 그 사실을 보고한다.

1. 충전 화면에서 `이용권 6장` 을 고르고 결제
2. 완료 후 `next` 로 돌아오는지
3. `/home` 헤더 칩이 `이용권 6장` 인지
4. 리포트에서 "이용권 1장으로 전체 보기" → 유료 섹션이 열리고 칩이 `5장` 이 되는지
5. 같은 리포트를 다시 열어도 잔액이 그대로인지 (영구 열람)

DB 로 직접 확인할 수 있으면 `ticket_entries` 에 `purchase` 1행, `spend` 1행이 있고 `ticket_wallets.balance` 가 5인지 본다.

---

## Self-Review

**스펙 커버리지**

| 스펙 절 | 태스크 |
|---|---|
| §3 스키마 (0012~0018) | Task 1 |
| §4 가격표·FEATURE_COST | Task 2, 3 |
| §5.1 주문 생성 | Task 8 |
| §5.2 확정 + 적립 CTE | Task 5, 7 |
| §6 차감 CTE·결과 해석 | Task 10, 11 |
| §7 열람 권한 판정 | Task 12 |
| §8 화면 (checkout / complete / report / home) | Task 9, 13, 14, 15 |
| §9 파일 배치 | Task 5, 10, 11 |
| §10 테스트 | 각 태스크에 포함 |
| §11 하지 않는 것 | 해당 없음 |

**스펙과 어긋난 곳 두 군데** — 계획이 맞고 스펙이 틀렸다.

1. 스펙 §7 은 "`/home` 배지"가 `isPaid` 를 읽는다고 적었지만, 실제로 홈에는 그런 배지가 없다(`to-home-entry.ts` 는 `isPaid` 를 쓰지 않는다). Task 12 는 픽스처만 고치고, Task 15 가 배지 대신 잔액 칩을 새로 넣는다.
2. 스펙 §9 는 "라우트가 payments 와 tickets 를 조립한다"고 적었지만, 조립 지점은 이미 존재하는 `src/lib/payments/deps.ts` 다(완료 API·웹훅·모바일 착지 페이지 셋이 공유하므로 라우트에 둘 수 없다). Task 7 이 거기서 배선한다.

**타입 일관성 확인**

- `ProfileRow.isUnlocked` (Task 12) ↔ `report/page.tsx`, `ReportBody` (Task 14) — 이름 일치
- `ReportAccess.isUnlocked` (Task 14) ↔ `ReportBody.access.isUnlocked` — 일치
- `confirmPurchaseAndCredit` (Task 5) ↔ `ConfirmDeps.markPaid` 반환 `Promise<boolean>` (Task 7) — 시그니처 일치
- `createPending` 인자 `{ userId, paymentId, product, amount, tickets }` (Task 8) ↔ `createPendingPurchase` (Task 6) — 일치
- `SpendResult` (Task 10) ↔ `SpendDeps.spend` (Task 11) — 일치
- `usePayment(next)` / `pay(packageId, method)` (Task 13) ↔ `OrderResponse` (변경 없음) — 일치
- `safeNextPath` (Task 4) ↔ Task 8·9·13 사용처 — 일치

**중간 단계에서 typecheck 가 깨지는 구간**: Task 2 부터 Task 16 까지 `to-order.ts` 와 일부 픽스처가 옛 이름을 참조한다. 각 태스크의 검증은 해당 테스트 파일만 돌리고, 전체 `npm run typecheck` 통과는 Task 16 에서 확인한다. 이건 의도된 것이다 — 이름 변경을 한 커밋에 몰면 리뷰할 수 없는 크기가 된다.
