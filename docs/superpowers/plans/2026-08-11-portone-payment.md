# 포트원 v2 결제 연동 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/checkout`의 결제하기 버튼을 포트원 v2 실결제에 잇는다. 결제가 끝나면 `purchases`에 `status='paid'` 행이 생기고 리포트의 잠긴 8섹션이 열린다.

**Architecture:** 금액은 서버만 안다 — 주문 생성 API가 `FULL_REPORT_PRICE.total`로 `pending` 행을 만들고, 확정 시 **그 행의 `amount`** 와 포트원 조회 결과를 대조한다. 완료 API와 웹훅이 `confirmPayment` 하나를 공유하며, `UPDATE … WHERE status='pending'`의 갱신 행 수로 멱등성을 얻는다. env가 비면 화면이 잠기되 타입체크·테스트는 통과한다.

**Tech Stack:** Next.js 16.2.10 (App Router), React 19, TypeScript strict, zod 4, Neon serverless (태그드 템플릿 SQL), vitest, `@portone/browser-sdk`, `@portone/server-sdk`

**설계 문서:** `docs/superpowers/specs/2026-08-11-portone-payment-design.md` — 판단 근거는 전부 여기 있다.

## Global Constraints

- **주석과 커밋 메시지는 한국어.** 기존 코드 전부가 그렇다. 커밋 제목은 `type(scope): 평서형 한국어 한 줄` (예: `feat(payments): 확정 로직을 완료 API 와 웹훅이 공유한다`).
- **주석은 "무엇"이 아니라 "왜"를 적는다.** 기존 코드의 주석 밀도를 보고 맞춘다 — 판단이 갈릴 수 있었던 자리에만 붙인다.
- **`process.env`를 직접 읽지 않는다.** `src/lib/payments/config.ts`의 함수만 읽고, 그 함수들은 `env` 인자를 받아 테스트가 `process.env`를 건드리지 않게 한다.
- **env 부재는 예외가 아니라 값이다.** 키가 없어도 `npm run typecheck`와 `npm test`가 통과해야 한다. import 시점에 throw 하지 않는다.
- **SQL은 반드시 태그드 템플릿.** 문자열 연결 금지 (`src/lib/db.ts` 주석 참조).
- **마이그레이션 파일 하나에 SQL 문장 하나.** `scripts/migrate.mts` 가 파일 전체를 `sql.query()` 한 번으로 실행하고, Neon HTTP 드라이버는 다중 문장을 거부한다.
- **DB 함수는 마지막 인자로 `client: SqlClient = sql`을 받는다.** 테스트가 가짜 클라이언트를 주입한다.
- **라우트는 얇게.** `route.ts`는 파싱·세션·응답 조립만, 로직은 `_lib/handler.ts`에 주입식으로 둔다 (`src/app/api/profiles` 참조).
- **`src/lib`은 `src/app`을 import 하지 않는다.** 반대 방향만 허용. 공유가 필요하면 `src/lib`으로 옮기고 원래 자리에서 재수출한다 (`src/lib/profiles/param.ts`가 만든 선례).
- **통화는 KRW 고정.** 포트원 요청은 `"CURRENCY_KRW"`, 조회 응답 대조는 `"KRW"` — **문자열이 다르다.**
- **상품 문자열은 `PRODUCT_FULL_REPORT`** (`src/lib/profiles/products.ts`). 리터럴 금지.
- 검증 명령: `npm test`, `npm run typecheck`, `npm run lint`.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `migrations/0010_purchases_payment_id.sql` | `payment_id` 컬럼 |
| `migrations/0011_purchases_payment_id_unique.sql` | 그 컬럼의 부분 유니크 인덱스 |
| `src/lib/db.ts` (수정) | `SqlClient` 타입의 새 거처 |
| `src/lib/payments/store.ts` | `purchases` 행 CRUD. 컬럼 이름을 아는 유일한 곳 |
| `src/lib/payments/config.ts` | env → 상점/채널/시크릿. `PaymentMethodId` 소유 |
| `src/lib/payments/pricing.ts` | `FULL_REPORT_PRICE`, `FULL_REPORT_ORDER_NAME` |
| `src/lib/payments/order-id.ts` | `paymentId` 발급 |
| `src/lib/payments/portone.ts` | 포트원 REST 클라이언트 (fetch + zod) |
| `src/lib/payments/confirm.ts` | ★ 확정 로직. 완료 API·웹훅 공유 |
| `src/lib/payments/deps.ts` | 프로덕션 확정 의존성 조합 (세 라우트가 공유) |
| `src/app/api/payments/orders/{route,_lib/handler}.ts` | 주문 생성 |
| `src/app/api/payments/complete/{route,_lib/handler}.ts` | 브라우저발 확정 |
| `src/app/api/payments/webhook/{route,_lib/handler}.ts` | 포트원발 확정 |
| `src/app/checkout/_hooks/use-payment.ts` | 주문 → 결제창 → 완료 |
| `src/app/checkout/complete/page.tsx` | 모바일 리다이렉트 착지점 |

---

## Task 1: 스키마와 `purchases` 행 CRUD

**Files:**
- Create: `migrations/0010_purchases_payment_id.sql`
- Create: `migrations/0011_purchases_payment_id_unique.sql`
- Create: `src/lib/payments/store.ts`
- Create: `src/lib/payments/store.test.ts`
- Modify: `src/lib/db.ts` (`SqlClient` 타입 추가)
- Modify: `src/lib/profiles/store.ts:4-11` (`SqlClient` 정의 → import + 재수출)

**Interfaces:**
- Consumes: `PRODUCT_FULL_REPORT` (`@/lib/profiles/products`)
- Produces: `PendingOrder`, `PurchaseStatus`, `createPendingPurchase`, `findOrderByPaymentId`, `markPurchasePaid`, `markPurchaseFailed`, `toPendingOrder`. `SqlClient`는 이제 `@/lib/db`에서 온다 (`@/lib/profiles/store`에서도 계속 나온다).

`SqlClient`를 옮기는 이유: 지금 `src/lib/profiles/store.ts`에 정의돼 있어서 `payments/store.ts`가 프로필 모듈을 import 하게 된다. 두 저장소가 서로를 몰라야 한다. `src/lib/profiles/param.ts`가 같은 이유로 만들어진 선례다.

- [ ] **Step 1: 마이그레이션 파일 두 개를 쓴다**

⚠️ **파일 하나에 SQL 문장 하나.** `scripts/migrate.mts` 가 파일 전체를 `sql.query()` 한 번으로 실행하는데, Neon HTTP 드라이버는 prepared statement 에 여러 문장을 넣지 못한다. 기존 0001~0009 가 전부 단일 문장이라 지금까지 드러나지 않았을 뿐이다.

`migrations/0010_purchases_payment_id.sql`:

```sql
-- 고객사가 발급하는 주문 ID (포트원 v2 paymentId). 완료 API 와 웹훅이 이걸로 행을 찾는다.
-- provider_txn_id 와 다르다: 그쪽은 포트원이 발급하는 거래 ID(transactionId)다.
-- 포트원 웹훅은 transactionId 가 아니라 paymentId 로 오기 때문에 이 컬럼이 없으면
-- 웹훅이 어느 행을 확정해야 하는지 알 수 없다.
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_id text;
```

`migrations/0011_purchases_payment_id_unique.sql`:

```sql
-- 같은 주문 ID 로 행이 둘 생기지 않게 막는다.
-- 부분 인덱스인 이유: 이 컬럼이 붙기 전 행과 PG 를 거치지 않는 행(수기 지급 등)은 NULL 이다.
CREATE UNIQUE INDEX IF NOT EXISTS purchases_payment_id_unique
  ON purchases (payment_id) WHERE payment_id IS NOT NULL;
```

- [ ] **Step 2: `SqlClient`를 `db.ts`로 옮긴다**

`src/lib/db.ts` 끝에 추가:

```ts
/**
 * 태그드 템플릿 SQL 클라이언트(주입 가능). 기본은 위의 공유 neon 클라이언트.
 * 저장소 모듈들이 서로를 import 하지 않도록 여기 둔다.
 */
export type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;
```

`src/lib/profiles/store.ts`의 1–11행을 이렇게 바꾼다 (기존 `type SqlClient` 블록을 지우고 재수출):

```ts
import { sql as neonSql, type SqlClient } from "@/lib/db";
import { PRODUCT_FULL_REPORT } from "./products";

// 재수출 — store.test.ts 를 비롯한 기존 import 경로를 깨지 않는다.
export type { SqlClient };

const sql = neonSql as unknown as SqlClient;
```

- [ ] **Step 3: 옮긴 것만으로 아무것도 깨지지 않는지 확인한다**

Run: `npm test && npm run typecheck`
Expected: 전부 PASS. 이 단계는 순수 이동이라 동작이 하나도 변하면 안 된다.

- [ ] **Step 4: 실패하는 테스트를 쓴다**

`src/lib/payments/store.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { SqlClient } from "@/lib/db";
import {
  createPendingPurchase,
  findOrderByPaymentId,
  markPurchaseFailed,
  markPurchasePaid,
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
  profile_id: 3,
  amount: 9900,
  status: "pending",
};

describe("toPendingOrder", () => {
  it("bigint 컬럼을 문자열로 접는다 — JS number 는 bigint 를 담지 못한다", () => {
    expect(toPendingOrder(dbRow)).toEqual({
      paymentId: "saju-abc",
      userId: "7",
      profileId: "3",
      amount: 9900,
      status: "pending",
    });
  });

  it("모르는 status 는 failed 로 접는다 — 모르는 값을 pending 으로 두면 재확정 대상이 된다", () => {
    expect(toPendingOrder({ ...dbRow, status: "weird" }).status).toBe("failed");
  });
});

describe("createPendingPurchase", () => {
  it("product 는 상수를, status 는 pending 을, provider 는 portone 을 박는다", async () => {
    const { client, calls } = fakeClient([]);
    await createPendingPurchase(
      { userId: "7", profileId: "3", paymentId: "saju-abc", amount: 9900 },
      client,
    );
    expect(calls[0].sql).toContain("INSERT INTO purchases");
    expect(calls[0].values).toEqual(["7", "3", "full_report", 9900, "saju-abc"]);
    expect(calls[0].sql).toContain("'pending'");
    expect(calls[0].sql).toContain("'portone'");
  });
});

describe("findOrderByPaymentId", () => {
  it("행이 없으면 null", async () => {
    const { client } = fakeClient([]);
    expect(await findOrderByPaymentId("saju-none", client)).toBeNull();
  });

  it("payment_id 로 찾는다", async () => {
    const { client, calls } = fakeClient([[dbRow]]);
    const order = await findOrderByPaymentId("saju-abc", client);
    expect(order?.profileId).toBe("3");
    expect(calls[0].values).toEqual(["saju-abc"]);
  });
});

describe("markPurchasePaid", () => {
  it("갱신된 행이 있으면 true", async () => {
    const { client, calls } = fakeClient([[{ id: 1 }]]);
    expect(await markPurchasePaid({ paymentId: "saju-abc", transactionId: "tx-1" }, client)).toBe(
      true,
    );
    // status='pending' 조건이 빠지면 이미 확정된 행을 다시 뒤집어 멱등성이 깨진다.
    expect(calls[0].sql).toContain("status = 'pending'");
    expect(calls[0].values).toEqual(["tx-1", "saju-abc"]);
  });

  it("갱신된 행이 없으면 false — 그 사이 다른 경로가 먼저 확정했다는 뜻", async () => {
    const { client } = fakeClient([[]]);
    expect(await markPurchasePaid({ paymentId: "saju-abc", transactionId: null }, client)).toBe(
      false,
    );
  });
});

describe("markPurchaseFailed", () => {
  it("pending 인 행만 내린다 — 이미 확정된 결제를 실패로 뒤집지 않는다", async () => {
    const { client, calls } = fakeClient([[]]);
    await markPurchaseFailed("saju-abc", client);
    expect(calls[0].sql).toContain("status = 'failed'");
    expect(calls[0].sql).toContain("status = 'pending'");
  });
});
```

- [ ] **Step 5: 실패를 확인한다**

Run: `npm test -- src/lib/payments/store.test.ts`
Expected: FAIL — `Failed to resolve import "./store"`

- [ ] **Step 6: 구현한다**

`src/lib/payments/store.ts`:

```ts
import { sql as neonSql, type SqlClient } from "@/lib/db";
import { PRODUCT_FULL_REPORT } from "@/lib/profiles/products";

const sql = neonSql as unknown as SqlClient;

/** purchases.status CHECK 제약과 같은 집합이다. */
export type PurchaseStatus = "pending" | "paid" | "refunded" | "failed";

const STATUSES: readonly string[] = ["pending", "paid", "refunded", "failed"];

/** 확정 로직이 보는 주문 한 건. */
export interface PendingOrder {
  paymentId: string;
  userId: string;
  profileId: string;
  /** 주문 생성 시점에 서버가 박아 둔 청구 금액. 포트원 조회 결과와 대조하는 기준이다. */
  amount: number;
  status: PurchaseStatus;
}

/**
 * DB 행 → PendingOrder. 컬럼 이름을 아는 유일한 곳이다.
 * user_id/profile_id 를 문자열로 접는 이유: bigint 라 JS number 로 받으면 큰 값에서
 * 정밀도가 깨진다 (toProfileRow 와 같은 판단).
 */
export function toPendingOrder(r: Record<string, unknown>): PendingOrder {
  const status = String(r.status);
  return {
    paymentId: String(r.payment_id),
    userId: String(r.user_id),
    profileId: String(r.profile_id),
    amount: Number(r.amount),
    // 모르는 값을 pending 으로 두면 확정 로직이 재확정을 시도한다. 막다른 쪽으로 접는다.
    status: (STATUSES.includes(status) ? status : "failed") as PurchaseStatus,
  };
}

/**
 * 결제 시작 시점의 pending 행. 재시도할 때마다 새로 만든다 —
 * 0008 의 부분 유니크 인덱스가 paid 에만 걸려 있어 pending 은 여러 개여도 되고,
 * 재시도 이력이 남는 편이 디버깅에 낫다 (0007 주석 참조).
 */
export async function createPendingPurchase(
  input: { userId: string; profileId: string; paymentId: string; amount: number },
  client: SqlClient = sql,
): Promise<void> {
  await client`
    INSERT INTO purchases (
      user_id, profile_id, product, amount, currency, status, provider, payment_id
    ) VALUES (
      ${input.userId}::bigint, ${input.profileId}::bigint, ${PRODUCT_FULL_REPORT},
      ${input.amount}, 'KRW', 'pending', 'portone', ${input.paymentId}
    )
  `;
}

export async function findOrderByPaymentId(
  paymentId: string,
  client: SqlClient = sql,
): Promise<PendingOrder | null> {
  const rows = await client`
    SELECT payment_id, user_id, profile_id, amount, status
    FROM purchases WHERE payment_id = ${paymentId}
  `;
  const row = rows[0];
  return row ? toPendingOrder(row) : null;
}

/**
 * 결제 확정. 갱신된 행이 있으면 true.
 *
 * ⚠️ `status = 'pending'` 조건이 이 함수의 존재 이유다. 완료 API 와 웹훅이 같은
 * 결제 건을 동시에 확정하러 와도 UPDATE 를 이긴 쪽만 true 를 받는다 —
 * 진 쪽은 실패가 아니라 "이미 확정됨"이다 (confirm.ts 참조).
 */
export async function markPurchasePaid(
  a: { paymentId: string; transactionId: string | null },
  client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    UPDATE purchases
       SET status = 'paid', paid_at = now(), provider_txn_id = ${a.transactionId}
     WHERE payment_id = ${a.paymentId} AND status = 'pending'
    RETURNING id
  `;
  return rows.length > 0;
}

/** 금액·통화가 어긋났거나 포트원이 실패로 끝낸 주문을 내린다. */
export async function markPurchaseFailed(
  paymentId: string,
  client: SqlClient = sql,
): Promise<void> {
  await client`
    UPDATE purchases SET status = 'failed'
     WHERE payment_id = ${paymentId} AND status = 'pending'
  `;
}
```

- [ ] **Step 7: 통과를 확인한다**

Run: `npm test -- src/lib/payments/store.test.ts && npm run typecheck`
Expected: 전부 PASS

- [ ] **Step 8: 마이그레이션을 적용한다**

Run: `npm run db:migrate`
Expected: `applying 0010_…` `applying 0011_…` 다음 `done (2 applied, 9 skipped)`

DB 연결이 안 되면 멈추고 보고한다. 마이그레이션 없이 다음 태스크로 넘어가면 나중에 런타임에서만 터진다.

- [ ] **Step 9: 커밋**

```bash
git add migrations/0010_purchases_payment_id.sql migrations/0011_purchases_payment_id_unique.sql \
        src/lib/payments/store.ts src/lib/payments/store.test.ts src/lib/db.ts src/lib/profiles/store.ts
git commit -m "feat(payments): 웹훅이 찾을 payment_id 컬럼과 purchases CRUD 를 만든다"
```

---

## Task 2: env → 채널 설정

**Files:**
- Create: `src/lib/payments/config.ts`
- Create: `src/lib/payments/config.test.ts`
- Modify: `src/app/checkout/_lib/methods.ts:1` (`PaymentMethodId` 정의 → 재수출)

**Interfaces:**
- Consumes: 없음
- Produces: `PaymentMethodId`, `PAYMENT_METHOD_IDS`, `PortOnePayMethod`, `PaymentChannel`, `getStoreId`, `getChannel`, `availableMethods`, `getApiSecret`, `getWebhookSecret`, `getAppOrigin`

`PaymentMethodId`를 여기로 옮기는 이유: `src/lib`이 `src/app/checkout/_lib`을 import 하면 의존 방향이 뒤집힌다. `methods.ts`는 재수출만 남긴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/payments/config.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { availableMethods, getChannel, getStoreId } from "./config";

const full = {
  PORTONE_STORE_ID: "store-1",
  PORTONE_CHANNEL_KEY_CARD: "ch-card",
  PORTONE_CHANNEL_KEY_NAVERPAY: "ch-naver",
  PORTONE_CHANNEL_KEY_KAKAOPAY: "ch-kakao",
} as NodeJS.ProcessEnv;

describe("getChannel", () => {
  it("카드는 CARD, 간편결제는 EASY_PAY 로 짝지어진다", () => {
    expect(getChannel("card", full)).toEqual({ channelKey: "ch-card", payMethod: "CARD" });
    expect(getChannel("naver", full)).toEqual({ channelKey: "ch-naver", payMethod: "EASY_PAY" });
    expect(getChannel("kakao", full)).toEqual({ channelKey: "ch-kakao", payMethod: "EASY_PAY" });
  });

  it("키가 없으면 null", () => {
    expect(getChannel("card", {} as NodeJS.ProcessEnv)).toBeNull();
  });

  it("공백만 있는 키는 없는 것으로 친다 — .env 의 빈 줄이 채널로 살아나면 안 된다", () => {
    expect(getChannel("card", { ...full, PORTONE_CHANNEL_KEY_CARD: "   " })).toBeNull();
  });
});

describe("availableMethods", () => {
  it("설정된 수단만 화면 순서대로 돌려준다", () => {
    expect(availableMethods(full)).toEqual(["card", "naver", "kakao"]);
    expect(availableMethods({ ...full, PORTONE_CHANNEL_KEY_NAVERPAY: "" })).toEqual([
      "card",
      "kakao",
    ]);
  });

  it("아무것도 없으면 빈 배열", () => {
    expect(availableMethods({} as NodeJS.ProcessEnv)).toEqual([]);
  });

  it("storeId 가 없으면 채널이 다 있어도 빈 배열 — 상점 없이는 결제창이 열리지 않는다", () => {
    expect(availableMethods({ ...full, PORTONE_STORE_ID: "" })).toEqual([]);
  });
});

describe("getStoreId", () => {
  it("없으면 null (빈 문자열이 아니다)", () => {
    expect(getStoreId({} as NodeJS.ProcessEnv)).toBeNull();
    expect(getStoreId(full)).toBe("store-1");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- src/lib/payments/config.test.ts`
Expected: FAIL — `Failed to resolve import "./config"`

- [ ] **Step 3: 구현한다**

`src/lib/payments/config.ts`:

```ts
/**
 * 포트원 설정을 읽는 유일한 곳. process.env 를 다른 곳에서 읽지 않는다.
 *
 * 모든 함수가 env 를 인자로 받는 이유: 테스트가 process.env 를 건드리지 않고
 * 조합을 검사할 수 있다. 그리고 부재를 예외가 아니라 null 로 다뤄서, 키가 하나도
 * 없는 상태에서도 typecheck 와 테스트가 통과한다.
 *
 * storeId·channelKey 를 NEXT_PUBLIC_ 으로 두지 않는 이유:
 *  1. NEXT_PUBLIC_ 은 빌드타임에 번들로 인라인돼 키 교체마다 재빌드가 필요하다.
 *  2. "이 수단은 키가 없다"는 판단을 서버가 해야 한다. 브라우저에 빈 문자열을
 *     내려 보내면 키 없는 수단이 화면에 남았다가 결제창에서 실패한다.
 * 대신 /checkout 이 availableMethods() 로 거르고, 주문 생성 응답이 값을 실어 보낸다.
 */

/**
 * 순서가 곧 화면 순서다 (PAYMENT_METHODS 와 같은 순서를 유지한다).
 * 타입을 배열에서 파생시키는 이유: 수단을 추가할 때 배열과 유니온을 따로 고치면
 * 한쪽만 고쳐도 컴파일이 통과해 조용히 어긋난다. 여기 한 줄만 고치면 된다.
 * zod 스키마도 이 배열을 그대로 받으므로 런타임 검증까지 같이 따라온다.
 */
export const PAYMENT_METHOD_IDS = ["card", "naver", "kakao"] as const;

export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

/** 포트원 requestPayment 의 payMethod. 지금 쓰는 두 가지만 둔다. */
export type PortOnePayMethod = "CARD" | "EASY_PAY";

export interface PaymentChannel {
  channelKey: string;
  payMethod: PortOnePayMethod;
}

const CHANNELS: Record<PaymentMethodId, { env: string; payMethod: PortOnePayMethod }> = {
  card: { env: "PORTONE_CHANNEL_KEY_CARD", payMethod: "CARD" },
  naver: { env: "PORTONE_CHANNEL_KEY_NAVERPAY", payMethod: "EASY_PAY" },
  kakao: { env: "PORTONE_CHANNEL_KEY_KAKAOPAY", payMethod: "EASY_PAY" },
};

/** 빈 문자열·공백은 미설정으로 친다 — .env 의 `KEY=` 한 줄이 값으로 살아나면 안 된다. */
function read(env: NodeJS.ProcessEnv, name: string): string | null {
  const v = env[name]?.trim();
  return v ? v : null;
}

export function getStoreId(env: NodeJS.ProcessEnv = process.env): string | null {
  return read(env, "PORTONE_STORE_ID");
}

export function getApiSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  return read(env, "PORTONE_API_SECRET");
}

export function getWebhookSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  return read(env, "PORTONE_WEBHOOK_SECRET");
}

/** 모바일 리다이렉트 주소를 조립하는 데 쓴다. 소셜 로그인이 쓰는 값과 같다. */
export function getAppOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  return read(env, "APP_ORIGIN")?.replace(/\/$/, "") ?? null;
}

/**
 * 간편결제에 easyPayProvider 를 따로 넘기지 않는다 — 채널키가 이미 어느 PG 인지
 * 결정한다. 실결제에서 결제창이 열리지 않으면 easyPay 옵션을 추가한다
 * (설계 문서 §11 의 확인 항목).
 */
export function getChannel(
  id: PaymentMethodId,
  env: NodeJS.ProcessEnv = process.env,
): PaymentChannel | null {
  const spec = CHANNELS[id];
  const channelKey = read(env, spec.env);
  return channelKey ? { channelKey, payMethod: spec.payMethod } : null;
}

/** 실제로 결제를 걸 수 있는 수단만. 상점 ID 가 없으면 채널이 다 있어도 아무것도 못 한다. */
export function availableMethods(env: NodeJS.ProcessEnv = process.env): PaymentMethodId[] {
  if (!getStoreId(env)) return [];
  return PAYMENT_METHOD_IDS.filter((id) => getChannel(id, env) !== null);
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- src/lib/payments/config.test.ts`
Expected: PASS (12개)

- [ ] **Step 5: `methods.ts`가 타입을 재수출하게 바꾼다**

`src/app/checkout/_lib/methods.ts`의 첫 줄 `export type PaymentMethodId = "card" | "naver" | "kakao";`를 지우고 그 자리에:

```ts
// 타입은 src/lib/payments/config.ts 가 소유한다 — 서버(채널 매핑)와 화면이 같은
// 집합을 봐야 하고, src/lib 이 이 폴더를 import 할 수는 없다.
import type { PaymentMethodId } from "@/lib/payments/config";
export type { PaymentMethodId };
```

- [ ] **Step 6: 아무것도 깨지지 않았는지 확인한다**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 전부 PASS. `PaymentMethodId`를 `../_lib/methods`에서 가져다 쓰는 기존 컴포넌트들이 그대로 동작해야 한다.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/payments/config.ts src/lib/payments/config.test.ts src/app/checkout/_lib/methods.ts
git commit -m "feat(payments): 결제수단을 포트원 채널에 짝짓고 미설정 수단을 걸러낸다"
```

---

## Task 3: 가격 상수 이동 · 주문 ID · 포트원 REST 클라이언트

**Files:**
- Create: `src/lib/payments/pricing.ts`
- Create: `src/lib/payments/order-id.ts`
- Create: `src/lib/payments/order-id.test.ts`
- Create: `src/lib/payments/portone.ts`
- Create: `src/lib/payments/portone.test.ts`
- Modify: `src/app/checkout/_lib/pricing.ts` (상수 정의 → 재수출)

**Interfaces:**
- Consumes: `getApiSecret` (Task 2)
- Produces: `FULL_REPORT_PRICE`, `FULL_REPORT_ORDER_NAME`, `newPaymentId`, `PAYMENT_ID_PREFIX`, `PortOnePayment`, `PortOneError`, `PortOneNotConfiguredError`, `getPayment`

가격 상수를 옮기는 이유: 주문 생성 API가 청구 금액을 알아야 하는데, `src/app/api/...`가 `src/app/checkout/_lib/`을 import 하면 한 라우트가 다른 라우트의 내부를 들여다보게 된다. `param.ts`가 같은 이유로 옮겨졌다. 포맷 함수(`formatKrw`)는 화면 관심사라 그대로 둔다.

- [ ] **Step 1: 가격 상수를 옮긴다**

`src/lib/payments/pricing.ts` (신규):

```ts
/**
 * 전체 리포트 가격. 주문 생성 API 가 이 값으로 청구 금액을 박고, 화면은 읽기만 한다 —
 * 두 곳에 숫자를 적어 두면 반드시 어긋난다.
 *
 * total 을 list - discount 로 계산하지 않고 따로 적는 이유: 표시용 정가·할인과
 * 실제 청구 금액은 언제든 갈라질 수 있고(프로모션, 반올림), 청구 금액은
 * 파생값이 아니라 명시값이어야 한다.
 */
export const FULL_REPORT_PRICE = {
  /** 정가 */
  list: 19900,
  /** 첫 리포트 할인 */
  discount: 10000,
  /** 실제 청구 금액 */
  total: 9900,
} as const;

/**
 * 결제창·카드 명세서·포트원 콘솔에 뜨는 상품명.
 * 프로필 이름을 넣지 않는다 — 명세서에 타인의 이름이 남을 이유가 없다.
 */
export const FULL_REPORT_ORDER_NAME = "사주 전체 리포트";
```

`src/app/checkout/_lib/pricing.ts`에서 `FULL_REPORT_PRICE` 블록(주석 포함)을 지우고 맨 위에:

```ts
// 상수는 src/lib/payments/pricing.ts 가 소유한다 — 주문 생성 API 가 같은 값으로
// 청구 금액을 박아야 하는데, src/lib 이 이 폴더를 import 할 수는 없다.
// 포맷 함수는 화면 관심사라 여기 남는다.
import { FULL_REPORT_PRICE } from "@/lib/payments/pricing";
export { FULL_REPORT_PRICE };
```

- [ ] **Step 2: 이동만으로 아무것도 깨지지 않는지 확인한다**

Run: `npm test -- src/app/checkout && npm run typecheck`
Expected: PASS. `pricing.test.ts`는 손대지 않았는데도 통과해야 한다.

- [ ] **Step 3: `order-id` 실패 테스트를 쓴다**

`src/lib/payments/order-id.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PAYMENT_ID_PREFIX, newPaymentId } from "./order-id";

describe("newPaymentId", () => {
  it("포트원 콘솔에서 우리 주문임을 알아보게 접두사를 붙인다", () => {
    expect(newPaymentId().startsWith(PAYMENT_ID_PREFIX)).toBe(true);
  });

  it("부를 때마다 다르다 — 같은 ID 를 두 번 쓰면 두 번째 결제가 거부된다", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newPaymentId()));
    expect(ids.size).toBe(100);
  });

  it("영문·숫자·하이픈만 쓴다 — URL 경로에 그대로 들어가는 값이다", () => {
    expect(newPaymentId()).toMatch(/^[a-z0-9-]+$/);
  });
});
```

- [ ] **Step 4: 실패를 확인한다**

Run: `npm test -- src/lib/payments/order-id.test.ts`
Expected: FAIL — `Failed to resolve import "./order-id"`

- [ ] **Step 5: `order-id`를 구현한다**

`src/lib/payments/order-id.ts`:

```ts
/** 포트원 콘솔과 로그에서 우리 주문임을 한눈에 알아보게 붙인다. */
export const PAYMENT_ID_PREFIX = "saju-";

/**
 * 고객사 발급 주문 ID. 예: saju-3f0c1a9e-….
 * 클라이언트가 만들지 않는다 — 주문 ID 와 청구 금액이 한 곳(주문 생성 API)에서
 * 같이 정해져야 확정 시 대조할 기준이 생긴다.
 */
export function newPaymentId(): string {
  return `${PAYMENT_ID_PREFIX}${crypto.randomUUID()}`;
}
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npm test -- src/lib/payments/order-id.test.ts`
Expected: PASS (3개)

- [ ] **Step 7: `portone` 실패 테스트를 쓴다**

`src/lib/payments/portone.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PortOneError, PortOneNotConfiguredError, getPayment } from "./portone";

const env = { PORTONE_API_SECRET: "secret-1" } as NodeJS.ProcessEnv;

const paid = {
  id: "saju-abc",
  status: "PAID",
  amount: { total: 9900, paid: 9900 },
  currency: "KRW",
  transactionId: "tx-1",
};

/** 한 번 호출되고 준비된 응답을 돌려주는 가짜 fetch. 요청 인자를 기록한다. */
function fakeFetch(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetchImpl = (async (url: string | URL | Request, opts?: RequestInit) => {
    calls.push({
      url: String(url),
      headers: (opts?.headers ?? {}) as Record<string, string>,
    });
    return {
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => body,
    } as Response;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe("getPayment", () => {
  it("Authorization 헤더는 `PortOne <secret>` 형태다 — Bearer 가 아니다", async () => {
    const { fetchImpl, calls } = fakeFetch(paid);
    await getPayment("saju-abc", { fetchImpl, env });
    expect(calls[0].headers.Authorization).toBe("PortOne secret-1");
  });

  it("paymentId 를 URL 인코딩해 경로에 넣는다", async () => {
    const { fetchImpl, calls } = fakeFetch(paid);
    await getPayment("saju/abc", { fetchImpl, env });
    expect(calls[0].url).toBe("https://api.portone.io/payments/saju%2Fabc");
  });

  it("응답을 스키마로 좁혀 돌려준다", async () => {
    const { fetchImpl } = fakeFetch({ ...paid, 모르는필드: 1 });
    const p = await getPayment("saju-abc", { fetchImpl, env });
    expect(p.status).toBe("PAID");
    expect(p.amount.total).toBe(9900);
    expect(p.transactionId).toBe("tx-1");
  });

  it("모르는 status 는 던진다 — 모르는 상태를 결제 완료로 오해하는 것보다 실패가 낫다", async () => {
    const { fetchImpl } = fakeFetch({ ...paid, status: "NEW_STATUS" });
    await expect(getPayment("saju-abc", { fetchImpl, env })).rejects.toThrow();
  });

  it("비 2xx 는 포트원 에러 본문을 읽어 PortOneError 로 던진다", async () => {
    const { fetchImpl } = fakeFetch(
      { type: "PaymentNotFoundError", message: "결제 건이 없습니다" },
      { ok: false, status: 404 },
    );
    await expect(getPayment("saju-none", { fetchImpl, env })).rejects.toThrow(PortOneError);
  });

  it("시크릿이 없으면 네트워크를 타기 전에 던진다", async () => {
    const { fetchImpl, calls } = fakeFetch(paid);
    await expect(
      getPayment("saju-abc", { fetchImpl, env: {} as NodeJS.ProcessEnv }),
    ).rejects.toThrow(PortOneNotConfiguredError);
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 8: 실패를 확인한다**

Run: `npm test -- src/lib/payments/portone.test.ts`
Expected: FAIL — `Failed to resolve import "./portone"`

- [ ] **Step 9: `portone`을 구현한다**

`src/lib/payments/portone.ts`:

```ts
import { z } from "zod";
import { getApiSecret } from "./config";

export const PORTONE_API_BASE = "https://api.portone.io";

/**
 * 결제 조회 응답 중 우리가 쓰는 부분만. 전부 받지 않는 이유: 포트원이 필드를
 * 늘려도 흔들리지 않고, 우리가 무엇에 기대고 있는지가 이 스키마에 다 적힌다.
 */
export const paymentSchema = z.object({
  id: z.string(),
  status: z.enum([
    "READY",
    "PENDING",
    "VIRTUAL_ACCOUNT_ISSUED",
    "PAID",
    "PARTIALLY_CANCELLED",
    "CANCELLED",
    "FAILED",
  ]),
  amount: z.object({ total: z.number(), paid: z.number().optional() }),
  currency: z.string(),
  transactionId: z.string().nullish(),
});

export type PortOnePayment = z.infer<typeof paymentSchema>;

export class PortOneError extends Error {
  readonly type: string | undefined;
  constructor(message: string, type?: string) {
    super(message);
    this.name = "PortOneError";
    this.type = type;
  }
}

/** 키가 없는 상태. 호출자는 이걸 503 으로 옮긴다 (장애가 아니라 미설정이다). */
export class PortOneNotConfiguredError extends Error {
  constructor() {
    super("PORTONE_API_SECRET 이 설정되지 않았습니다");
    this.name = "PortOneNotConfiguredError";
  }
}

/**
 * GET /payments/{paymentId}.
 * fetchImpl·env 를 주입받는 이유: 테스트가 네트워크와 process.env 를 건드리지 않는다.
 */
export async function getPayment(
  paymentId: string,
  opts: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv } = {},
): Promise<PortOnePayment> {
  const secret = getApiSecret(opts.env);
  if (!secret) throw new PortOneNotConfiguredError();

  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    // Bearer 가 아니라 `PortOne <secret>` 이다. 포트원 v2 의 고유 형식.
    headers: { Authorization: `PortOne ${secret}` },
  });

  // 에러 응답도 본문이 JSON 이 아닐 수 있다(게이트웨이 오류 등). 파싱 실패를 삼킨다.
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const e = body as { type?: string; message?: string } | null;
    throw new PortOneError(e?.message ?? `포트원 결제 조회 실패 (HTTP ${res.status})`, e?.type);
  }
  return paymentSchema.parse(body);
}
```

- [ ] **Step 10: 통과를 확인한다**

Run: `npm test -- src/lib/payments && npm run typecheck && npm run lint`
Expected: 전부 PASS

- [ ] **Step 11: 커밋**

```bash
git add src/lib/payments/pricing.ts src/lib/payments/order-id.ts src/lib/payments/order-id.test.ts \
        src/lib/payments/portone.ts src/lib/payments/portone.test.ts src/app/checkout/_lib/pricing.ts
git commit -m "feat(payments): 포트원 결제 조회를 zod 로 좁혀 받고 주문 ID 를 발급한다"
```

---

## Task 4: 확정 로직 ★

**Files:**
- Create: `src/lib/payments/confirm.ts`
- Create: `src/lib/payments/confirm.test.ts`

**Interfaces:**
- Consumes: `PendingOrder` (Task 1), `PortOnePayment` (Task 3)
- Produces: `ConfirmDeps`, `ConfirmResult`, `ConfirmFailure`, `confirmPayment`

여기가 결제의 심장이다. 완료 API와 웹훅이 이 함수 하나만 부른다. 소유 확인은 **하지 않는다** — 웹훅에는 세션이 없다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/payments/confirm.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { confirmPayment, type ConfirmDeps } from "./confirm";
import type { PendingOrder } from "./store";
import type { PortOnePayment } from "./portone";

const order: PendingOrder = {
  paymentId: "saju-abc",
  userId: "7",
  profileId: "3",
  amount: 9900,
  status: "pending",
};

const paid: PortOnePayment = {
  id: "saju-abc",
  status: "PAID",
  amount: { total: 9900, paid: 9900 },
  currency: "KRW",
  transactionId: "tx-1",
};

function deps(over: Partial<ConfirmDeps> = {}): ConfirmDeps {
  return {
    findOrder: vi.fn(async () => order),
    lookupPayment: vi.fn(async () => paid),
    markPaid: vi.fn(async () => true),
    markFailed: vi.fn(async () => {}),
    ...over,
  };
}

describe("confirmPayment", () => {
  it("주문이 없으면 not_found — 포트원을 부르지 않는다", async () => {
    const d = deps({ findOrder: vi.fn(async () => null) });
    expect(await confirmPayment("saju-none", d)).toEqual({ ok: false, kind: "not_found" });
    expect(d.lookupPayment).not.toHaveBeenCalled();
  });

  it("이미 paid 인 주문은 포트원을 다시 부르지 않고 already", async () => {
    const d = deps({ findOrder: vi.fn(async () => ({ ...order, status: "paid" as const })) });
    expect(await confirmPayment("saju-abc", d)).toEqual({
      ok: true,
      kind: "already",
      profileId: "3",
    });
    expect(d.lookupPayment).not.toHaveBeenCalled();
  });

  it("정상 결제는 confirmed + transactionId 를 넘긴다", async () => {
    const d = deps();
    expect(await confirmPayment("saju-abc", d)).toEqual({
      ok: true,
      kind: "confirmed",
      profileId: "3",
    });
    expect(d.markPaid).toHaveBeenCalledWith({ paymentId: "saju-abc", transactionId: "tx-1" });
  });

  it("markPaid 가 false 면 실패가 아니라 already — 그 사이 다른 경로가 먼저 확정했다", async () => {
    const d = deps({ markPaid: vi.fn(async () => false) });
    expect(await confirmPayment("saju-abc", d)).toEqual({
      ok: true,
      kind: "already",
      profileId: "3",
    });
    expect(d.markFailed).not.toHaveBeenCalled();
  });

  it("FAILED / CANCELLED 는 not_paid 이고 행을 내린다", async () => {
    for (const status of ["FAILED", "CANCELLED"] as const) {
      const d = deps({ lookupPayment: vi.fn(async () => ({ ...paid, status })) });
      expect(await confirmPayment("saju-abc", d)).toEqual({ ok: false, kind: "not_paid" });
      expect(d.markFailed).toHaveBeenCalledWith("saju-abc");
    }
  });

  it("READY / PENDING 은 not_paid 지만 행을 건드리지 않는다 — 웹훅이 뒤이어 확정할 수 있다", async () => {
    for (const status of ["READY", "PENDING", "VIRTUAL_ACCOUNT_ISSUED"] as const) {
      const d = deps({ lookupPayment: vi.fn(async () => ({ ...paid, status })) });
      expect(await confirmPayment("saju-abc", d)).toEqual({ ok: false, kind: "not_paid" });
      expect(d.markFailed).not.toHaveBeenCalled();
      expect(d.markPaid).not.toHaveBeenCalled();
    }
  });

  it("금액이 다르면 amount_mismatch — 확정하지 않고 행을 내린다", async () => {
    const d = deps({ lookupPayment: vi.fn(async () => ({ ...paid, amount: { total: 100 } })) });
    expect(await confirmPayment("saju-abc", d)).toEqual({ ok: false, kind: "amount_mismatch" });
    expect(d.markPaid).not.toHaveBeenCalled();
    expect(d.markFailed).toHaveBeenCalledWith("saju-abc");
  });

  it("통화가 다르면 currency_mismatch", async () => {
    const d = deps({ lookupPayment: vi.fn(async () => ({ ...paid, currency: "JPY" })) });
    expect(await confirmPayment("saju-abc", d)).toEqual({ ok: false, kind: "currency_mismatch" });
    expect(d.markPaid).not.toHaveBeenCalled();
  });

  it("포트원 조회가 던지면 그대로 올린다 — 일시 장애를 미결제로 접지 않는다", async () => {
    const d = deps({
      lookupPayment: vi.fn(async () => {
        throw new Error("network");
      }),
    });
    await expect(confirmPayment("saju-abc", d)).rejects.toThrow("network");
    expect(d.markFailed).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- src/lib/payments/confirm.test.ts`
Expected: FAIL — `Failed to resolve import "./confirm"`

- [ ] **Step 3: 구현한다**

`src/lib/payments/confirm.ts`:

```ts
import type { PortOnePayment } from "./portone";
import type { PendingOrder } from "./store";

export type ConfirmFailure = "not_found" | "not_paid" | "amount_mismatch" | "currency_mismatch";

export type ConfirmResult =
  | { ok: true; kind: "confirmed" | "already"; profileId: string }
  | { ok: false; kind: ConfirmFailure };

export interface ConfirmDeps {
  findOrder(paymentId: string): Promise<PendingOrder | null>;
  lookupPayment(paymentId: string): Promise<PortOnePayment>;
  /** 갱신된 행이 있으면 true. false 는 이미 다른 경로가 확정했다는 뜻이다. */
  markPaid(a: { paymentId: string; transactionId: string | null }): Promise<boolean>;
  markFailed(paymentId: string): Promise<void>;
}

/** 더 이상 결제가 될 수 없는 상태. 행을 내린다. */
const DEAD: ReadonlySet<PortOnePayment["status"]> = new Set(["FAILED", "CANCELLED"]);

/**
 * 결제 확정. 완료 API 와 웹훅이 공유하는 유일한 경로다.
 *
 * 소유 확인을 하지 않는 이유: 웹훅에는 세션이 없다. 호출자(완료 API 핸들러)가
 * 먼저 주문의 userId 를 세션과 대조하고 나서 이 함수를 부른다.
 *
 * 금액 대조의 기준은 포트원이 아니라 order.amount 다 — 주문 생성 시점에 서버가
 * 박아 둔 값이라 브라우저가 손댈 수 없다.
 */
export async function confirmPayment(
  paymentId: string,
  d: ConfirmDeps,
): Promise<ConfirmResult> {
  const order = await d.findOrder(paymentId);
  if (order === null) return { ok: false, kind: "not_found" };

  // 이미 확정된 주문에 포트원을 다시 부르지 않는다 — 웹훅과 완료 API 가 겹칠 때
  // 같은 결제 건을 두 번 조회할 이유가 없다.
  if (order.status === "paid") return { ok: true, kind: "already", profileId: order.profileId };

  // 여기서 던지는 예외는 삼키지 않는다. 일시 장애를 "미결제"로 접으면 돈은 받고
  // 리포트는 안 열린 채 조용히 끝난다 — 호출자가 5xx 로 올려 재시도를 유도해야 한다.
  const payment = await d.lookupPayment(paymentId);

  if (DEAD.has(payment.status)) {
    await d.markFailed(paymentId);
    return { ok: false, kind: "not_paid" };
  }

  // READY/PENDING/VIRTUAL_ACCOUNT_ISSUED 는 아직 결제가 아니지만 죽지도 않았다.
  // 행을 건드리지 않고 물러난다 — 웹훅이 뒤이어 도착하면 그때 확정된다.
  if (payment.status !== "PAID") return { ok: false, kind: "not_paid" };

  if (payment.currency !== "KRW") {
    await d.markFailed(paymentId);
    return { ok: false, kind: "currency_mismatch" };
  }

  // 돈은 받았는데 금액이 다른 상태다. 자동 취소는 하지 않는다 — 취소 API 연동은
  // 이 작업 범위 밖이라 백로그에 있다. 행을 내리고 로그로 남긴다.
  if (payment.amount.total !== order.amount) {
    console.error(
      `[confirmPayment] 금액 불일치 paymentId=${paymentId} 주문=${order.amount} 결제=${payment.amount.total}`,
    );
    await d.markFailed(paymentId);
    return { ok: false, kind: "amount_mismatch" };
  }

  const flipped = await d.markPaid({
    paymentId,
    transactionId: payment.transactionId ?? null,
  });
  // false 는 실패가 아니다 — 그 사이 다른 경로가 먼저 UPDATE 를 이겼다는 뜻이다.
  // 이 한 줄이 완료 API 와 웹훅의 동시 도착을 멱등하게 만든다.
  return { ok: true, kind: flipped ? "confirmed" : "already", profileId: order.profileId };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- src/lib/payments/confirm.test.ts && npm run typecheck`
Expected: PASS (9개)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/payments/confirm.ts src/lib/payments/confirm.test.ts
git commit -m "feat(payments): 완료 API 와 웹훅이 공유할 멱등 확정 로직을 만든다"
```

---

## Task 5: `POST /api/payments/orders`

**Files:**
- Create: `src/app/api/payments/orders/_lib/handler.ts`
- Create: `src/app/api/payments/orders/_lib/handler.test.ts`
- Create: `src/app/api/payments/orders/route.ts`

**Interfaces:**
- Consumes: `PaymentMethodId`/`PaymentChannel`/`PortOnePayMethod`/`getStoreId`/`getChannel`/`getAppOrigin` (Task 2), `FULL_REPORT_PRICE`/`FULL_REPORT_ORDER_NAME` (Task 3), `newPaymentId` (Task 3), `createPendingPurchase` (Task 1), `parseProfileParam` (`@/lib/profiles/param`), `getProfile` (`@/lib/profiles/store`), `getSession` (`@/lib/auth/session`)
- Produces: `CreateOrderDeps`, `OrderResponse`, `handleCreateOrder`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/payments/orders/_lib/handler.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { handleCreateOrder, type CreateOrderDeps } from "./handler";

function deps(over: Partial<CreateOrderDeps> = {}): CreateOrderDeps {
  return {
    userId: "7",
    getProfile: vi.fn(async () => ({ id: "3", isPaid: false })),
    getStoreId: () => "store-1",
    getChannel: () => ({ channelKey: "ch-card", payMethod: "CARD" as const }),
    getAppOrigin: () => "https://saju.example",
    newPaymentId: () => "saju-fixed",
    createPending: vi.fn(async () => {}),
    ...over,
  };
}

const body = { profileId: "3", method: "card" };

describe("handleCreateOrder", () => {
  it("성공하면 결제창에 넘길 값을 한 번에 돌려준다", async () => {
    const d = deps();
    const r = await handleCreateOrder(body, d);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      paymentId: "saju-fixed",
      storeId: "store-1",
      channelKey: "ch-card",
      payMethod: "CARD",
      orderName: "사주 전체 리포트",
      totalAmount: 9900,
      currency: "CURRENCY_KRW",
      redirectUrl: "https://saju.example/checkout/complete?profile=3",
    });
  });

  it("청구 금액은 요청이 아니라 서버 상수에서 온다", async () => {
    const d = deps();
    // 본문에 금액을 실어 보내도 무시된다 — 스키마에 그런 필드가 없다.
    await handleCreateOrder({ ...body, totalAmount: 100 }, d);
    expect(d.createPending).toHaveBeenCalledWith({
      userId: "7",
      profileId: "3",
      paymentId: "saju-fixed",
      amount: 9900,
    });
  });

  it("비로그인은 401 이고 행을 만들지 않는다", async () => {
    const d = deps({ userId: null });
    expect((await handleCreateOrder(body, d)).status).toBe(401);
    expect(d.createPending).not.toHaveBeenCalled();
  });

  it("없는/남의 프로필은 404", async () => {
    const d = deps({ getProfile: vi.fn(async () => null) });
    expect((await handleCreateOrder(body, d)).status).toBe(404);
  });

  it("이미 결제한 프로필은 409 — 이중 결제를 결제창 열기 전에 막는다", async () => {
    const d = deps({ getProfile: vi.fn(async () => ({ id: "3", isPaid: true })) });
    const r = await handleCreateOrder(body, d);
    expect(r.status).toBe(409);
    expect(d.createPending).not.toHaveBeenCalled();
  });

  it("본문이 스키마에 맞지 않으면 400", async () => {
    const d = deps();
    for (const bad of [null, {}, { profileId: "3" }, { profileId: "3", method: "toss" }]) {
      expect((await handleCreateOrder(bad, d)).status).toBe(400);
    }
  });

  it("profileId 가 순번 id 형태가 아니면 400 — ::bigint 캐스팅에 닿기 전에 막는다", async () => {
    const d = deps();
    for (const bad of ["0", "007", "abc", "-1", "9999999999999999999"]) {
      expect((await handleCreateOrder({ profileId: bad, method: "card" }, d)).status).toBe(400);
    }
  });

  it("채널키가 없으면 503 — 장애가 아니라 미설정이다", async () => {
    const d = deps({ getChannel: () => null });
    expect((await handleCreateOrder(body, d)).status).toBe(503);
  });

  it("상점 ID 나 APP_ORIGIN 이 없어도 503", async () => {
    expect((await handleCreateOrder(body, deps({ getStoreId: () => null }))).status).toBe(503);
    expect((await handleCreateOrder(body, deps({ getAppOrigin: () => null }))).status).toBe(503);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- src/app/api/payments/orders`
Expected: FAIL — `Failed to resolve import "./handler"`

- [ ] **Step 3: 핸들러를 구현한다**

`src/app/api/payments/orders/_lib/handler.ts`:

```ts
import { z } from "zod";
import {
  PAYMENT_METHOD_IDS,
  type PaymentChannel,
  type PaymentMethodId,
  type PortOnePayMethod,
} from "@/lib/payments/config";
import { FULL_REPORT_ORDER_NAME, FULL_REPORT_PRICE } from "@/lib/payments/pricing";
import { parseProfileParam } from "@/lib/profiles/param";

// 금액을 받는 필드가 없는 것이 이 스키마의 요점이다 — 청구 금액은 서버 상수에서만 온다.
// method 는 config 의 배열을 그대로 받는다: 수단이 늘면 스키마도 같이 넓어진다.
const createOrderSchema = z.object({
  profileId: z.string(),
  method: z.enum(PAYMENT_METHOD_IDS),
});

/** 브라우저가 requestPayment 에 그대로 펼쳐 넣는 값들. */
export interface OrderResponse {
  paymentId: string;
  storeId: string;
  channelKey: string;
  payMethod: PortOnePayMethod;
  orderName: string;
  totalAmount: number;
  /** 포트원 요청용 통화 코드. 조회 응답의 "KRW" 와 문자열이 다르다. */
  currency: "CURRENCY_KRW";
  redirectUrl: string;
}

export interface CreateOrderDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  getProfile(userId: string, id: string): Promise<{ id: string; isPaid: boolean } | null>;
  getStoreId(): string | null;
  getChannel(id: PaymentMethodId): PaymentChannel | null;
  getAppOrigin(): string | null;
  newPaymentId(): string;
  createPending(i: {
    userId: string;
    profileId: string;
    paymentId: string;
    amount: number;
  }): Promise<void>;
}

export interface CreateOrderResult {
  status: number;
  body: OrderResponse | { error: string };
}

export async function handleCreateOrder(
  raw: unknown,
  d: CreateOrderDeps,
): Promise<CreateOrderResult> {
  const parsed = createOrderSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "요청을 확인해 주세요" } };

  // ?profile 과 같은 형식 검사를 재사용한다 — 검증 없이 넘기면 ::bigint 캐스팅이
  // DB 에러로 터져 400 이어야 할 것이 500 이 된다.
  const param = parseProfileParam({ profile: parsed.data.profileId });
  if (param.kind !== "id") return { status: 400, body: { error: "요청을 확인해 주세요" } };

  if (d.userId === null) return { status: 401, body: { error: "로그인이 필요합니다" } };

  const profile = await d.getProfile(d.userId, param.id);
  // 없는 프로필과 남의 프로필을 구분하지 않는다 — 구분하면 id 로 존재 여부를 훑을 수 있다.
  if (profile === null) return { status: 404, body: { error: "프로필을 찾을 수 없습니다" } };
  if (profile.isPaid) return { status: 409, body: { error: "이미 결제한 리포트입니다" } };

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
    profileId: profile.id,
    paymentId,
    amount: FULL_REPORT_PRICE.total,
  });

  return {
    status: 200,
    body: {
      paymentId,
      storeId,
      channelKey: channel.channelKey,
      payMethod: channel.payMethod,
      orderName: FULL_REPORT_ORDER_NAME,
      totalAmount: FULL_REPORT_PRICE.total,
      currency: "CURRENCY_KRW",
      // 모바일은 결제창이 페이지를 떠난다. 돌아올 자리를 여기서 정한다.
      redirectUrl: `${origin}/checkout/complete?profile=${profile.id}`,
    },
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- src/app/api/payments/orders`
Expected: PASS (9개)

- [ ] **Step 5: 라우트를 붙인다**

`src/app/api/payments/orders/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getAppOrigin, getChannel, getStoreId } from "@/lib/payments/config";
import { newPaymentId } from "@/lib/payments/order-id";
import { createPendingPurchase } from "@/lib/payments/store";
import { getProfile } from "@/lib/profiles/store";
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
      getProfile,
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

- [ ] **Step 6: 전체 검증**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 전부 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/payments/orders
git commit -m "feat(payments): 주문 생성 API 가 청구 금액을 서버에서만 정한다"
```

---

## Task 6: `POST /api/payments/complete`

**Files:**
- Create: `src/lib/payments/deps.ts`
- Create: `src/app/api/payments/complete/_lib/handler.ts`
- Create: `src/app/api/payments/complete/_lib/handler.test.ts`
- Create: `src/app/api/payments/complete/route.ts`

**Interfaces:**
- Consumes: `confirmPayment`/`ConfirmDeps`/`ConfirmResult` (Task 4), `findOrderByPaymentId`/`markPurchasePaid`/`markPurchaseFailed` (Task 1), `getPayment`/`PortOneNotConfiguredError` (Task 3)
- Produces: `CompleteDeps`, `handleComplete`, `confirmDeps` (`@/lib/payments/deps` — Task 7·9 가 같은 조합을 쓴다)

소유 확인이 이 핸들러의 몫이다. 먼저 `findOrder`로 주문을 읽어 세션과 대조하고, 통과한 뒤에 `confirmPayment`를 부른다. `confirmPayment` 안에서 같은 행을 한 번 더 읽는 것은 의도한 것이다 — 확정 함수가 호출자의 사전 조회에 기대지 않아야 웹훅에서도 그대로 쓸 수 있다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/payments/complete/_lib/handler.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { handleComplete, type CompleteDeps } from "./handler";
import type { PendingOrder } from "@/lib/payments/store";

const order: PendingOrder = {
  paymentId: "saju-abc",
  userId: "7",
  profileId: "3",
  amount: 9900,
  status: "pending",
};

function deps(over: Partial<CompleteDeps> = {}): CompleteDeps {
  return {
    userId: "7",
    findOrder: vi.fn(async () => order),
    confirm: vi.fn(async () => ({ ok: true as const, kind: "confirmed" as const, profileId: "3" })),
    ...over,
  };
}

const body = { paymentId: "saju-abc" };

describe("handleComplete", () => {
  it("확정되면 200 과 profileId — 클라이언트가 갈 곳을 응답에서 읽는다", async () => {
    expect(await handleComplete(body, deps())).toEqual({
      status: 200,
      body: { profileId: "3" },
    });
  });

  it("already 도 200 — 웹훅이 먼저 확정한 경우다", async () => {
    const d = deps({
      confirm: vi.fn(async () => ({ ok: true as const, kind: "already" as const, profileId: "3" })),
    });
    expect((await handleComplete(body, d)).status).toBe(200);
  });

  it("본문에 paymentId 가 없으면 400", async () => {
    for (const bad of [null, {}, { paymentId: 1 }, { paymentId: "" }]) {
      expect((await handleComplete(bad, deps())).status).toBe(400);
    }
  });

  it("비로그인은 401", async () => {
    expect((await handleComplete(body, deps({ userId: null }))).status).toBe(401);
  });

  it("남의 주문은 404 이고 확정을 시도조차 하지 않는다", async () => {
    const d = deps({ findOrder: vi.fn(async () => ({ ...order, userId: "99" })) });
    expect((await handleComplete(body, d)).status).toBe(404);
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it("없는 주문도 404 — 남의 주문과 구분하지 않는다", async () => {
    const d = deps({ findOrder: vi.fn(async () => null) });
    expect((await handleComplete(body, d)).status).toBe(404);
  });

  it("확정 실패는 402 와 kind 를 함께 돌려준다", async () => {
    for (const kind of ["not_paid", "amount_mismatch", "currency_mismatch"] as const) {
      const d = deps({ confirm: vi.fn(async () => ({ ok: false as const, kind })) });
      const r = await handleComplete(body, d);
      expect(r.status).toBe(402);
      expect(r.body).toMatchObject({ kind });
    }
  });

  it("확정 단계의 not_found 는 404 로 옮긴다", async () => {
    const d = deps({
      confirm: vi.fn(async () => ({ ok: false as const, kind: "not_found" as const })),
    });
    expect((await handleComplete(body, d)).status).toBe(404);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npm test -- src/app/api/payments/complete`
Expected: FAIL — `Failed to resolve import "./handler"`

- [ ] **Step 3: 핸들러를 구현한다**

`src/app/api/payments/complete/_lib/handler.ts`:

```ts
import { z } from "zod";
import type { ConfirmResult } from "@/lib/payments/confirm";
import type { PendingOrder } from "@/lib/payments/store";

const completeSchema = z.object({ paymentId: z.string().min(1) });

export interface CompleteDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  findOrder(paymentId: string): Promise<PendingOrder | null>;
  confirm(paymentId: string): Promise<ConfirmResult>;
}

export interface CompleteResult {
  status: number;
  body: { profileId: string } | { error: string; kind?: string };
}

/** 확정 실패 사유 → 상태코드. not_found 만 404 고 나머지는 결제 자체의 문제(402)다. */
const FAILURE_STATUS: Record<string, number> = {
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
  if (result.ok) return { status: 200, body: { profileId: result.profileId } };

  return {
    status: FAILURE_STATUS[result.kind] ?? 402,
    body: { error: "결제를 확인하지 못했습니다", kind: result.kind },
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npm test -- src/app/api/payments/complete`
Expected: PASS (8개)

- [ ] **Step 5: 실제 의존성 조합을 한 곳에 모은다**

`src/lib/payments/deps.ts`:

```ts
import type { ConfirmDeps } from "./confirm";
import { getPayment } from "./portone";
import { findOrderByPaymentId, markPurchaseFailed, markPurchasePaid } from "./store";

/**
 * 프로덕션 확정 의존성. 완료 API·웹훅·모바일 착지 페이지 셋이 같은 조합을 쓴다.
 *
 * route.ts 가 아니라 여기 두는 이유: Next.js 는 route 파일이 HTTP 메서드와 정해진
 * 설정값 외의 것을 export 하면 빌드에서 거부한다. 세 곳이 공유하는 값은 lib 에 있어야 한다.
 */
export const confirmDeps: ConfirmDeps = {
  findOrder: (paymentId) => findOrderByPaymentId(paymentId),
  lookupPayment: (paymentId) => getPayment(paymentId),
  markPaid: (a) => markPurchasePaid(a),
  markFailed: (paymentId) => markPurchaseFailed(paymentId),
};
```

- [ ] **Step 6: 라우트를 붙인다**

`src/app/api/payments/complete/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { confirmPayment } from "@/lib/payments/confirm";
import { confirmDeps } from "@/lib/payments/deps";
import { PortOneNotConfiguredError } from "@/lib/payments/portone";
import { findOrderByPaymentId } from "@/lib/payments/store";
import { handleComplete } from "./_lib/handler";

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleComplete(raw, {
      userId: session?.userId ?? null,
      findOrder: (paymentId) => findOrderByPaymentId(paymentId),
      confirm: (paymentId) => confirmPayment(paymentId, confirmDeps),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    // 키 미설정은 장애가 아니라 준비 안 됨이다. 500 으로 흘리면 원인이 로그에 묻힌다.
    if (e instanceof PortOneNotConfiguredError) {
      return NextResponse.json({ error: "결제를 준비 중입니다" }, { status: 503 });
    }
    console.error("[POST /api/payments/complete]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
```

- [ ] **Step 7: 전체 검증**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 전부 PASS. `build` 를 여기서 한 번 도는 이유는 route 파일의 export 제약을 지금 확인하기 위해서다.

- [ ] **Step 8: 커밋**

```bash
git add src/lib/payments/deps.ts src/app/api/payments/complete
git commit -m "feat(payments): 완료 API 가 소유를 확인하고 결제를 확정한다"
```

---

## Task 7: `POST /api/payments/webhook`

**Files:**
- Create: `src/app/api/payments/webhook/_lib/handler.ts`
- Create: `src/app/api/payments/webhook/_lib/handler.test.ts`
- Create: `src/app/api/payments/webhook/route.ts`
- Modify: `package.json` (`@portone/server-sdk` 추가)

**Interfaces:**
- Consumes: `confirmPayment` (Task 4), `confirmDeps` (Task 6, `@/app/api/payments/complete/route`에서 export)
- Produces: `WebhookDeps`, `handleWebhook`

- [ ] **Step 1: 서버 SDK 를 설치하고 export 모양을 확인한다**

Run: `npm install @portone/server-sdk`

그다음 실제 export 를 확인한다:

Run: `node -e "console.log(Object.keys(require('@portone/server-sdk')))"`

`Webhook` 이 나오면 아래 코드 그대로 쓴다. 이름이 다르면 `node_modules/@portone/server-sdk/dist/index.d.ts`를 읽고 **route.ts 의 import 만** 맞춘다 — 핸들러는 `verify` 함수를 주입받으므로 영향이 없다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/app/api/payments/webhook/_lib/handler.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { handleWebhook, type WebhookDeps } from "./handler";

const paidBody = JSON.stringify({
  type: "Transaction.Paid",
  timestamp: "2026-08-11T00:00:00.000Z",
  data: { storeId: "store-1", paymentId: "saju-abc", transactionId: "tx-1" },
});

function deps(over: Partial<WebhookDeps> = {}): WebhookDeps {
  return {
    verify: vi.fn(async () => {}),
    confirm: vi.fn(async () => ({ ok: true as const, kind: "confirmed" as const, profileId: "3" })),
    ...over,
  };
}

const headers = { "webhook-id": "msg-1" };

describe("handleWebhook", () => {
  it("Transaction.Paid 를 확정으로 넘기고 200", async () => {
    const d = deps();
    expect((await handleWebhook(paidBody, headers, d)).status).toBe(200);
    expect(d.confirm).toHaveBeenCalledWith("saju-abc");
  });

  it("서명 검증이 던지면 400 이고 확정하지 않는다 — 위조된 결제 완료를 막는 유일한 문", async () => {
    const d = deps({
      verify: vi.fn(async () => {
        throw new Error("bad signature");
      }),
    });
    expect((await handleWebhook(paidBody, headers, d)).status).toBe(400);
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it("검증은 파싱 전에 한다 — 원문에 서명이 걸려 있다", async () => {
    const order: string[] = [];
    const d = deps({
      verify: vi.fn(async () => {
        order.push("verify");
      }),
      confirm: vi.fn(async () => {
        order.push("confirm");
        return { ok: true as const, kind: "confirmed" as const, profileId: "3" };
      }),
    });
    await handleWebhook(paidBody, headers, d);
    expect(order).toEqual(["verify", "confirm"]);
  });

  it("Paid 가 아닌 이벤트는 200 으로 흘려보낸다", async () => {
    const d = deps();
    const body = JSON.stringify({
      type: "Transaction.Ready",
      data: { paymentId: "saju-abc" },
    });
    expect((await handleWebhook(body, headers, d)).status).toBe(200);
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it("본문이 JSON 이 아니거나 모양이 다르면 400", async () => {
    for (const bad of ["not json", "{}", '{"type":"Transaction.Paid"}']) {
      expect((await handleWebhook(bad, headers, deps())).status).toBe(400);
    }
  });

  it("not_found / 불일치는 200 — 재시도해도 결과가 같다", async () => {
    for (const kind of ["not_found", "amount_mismatch", "currency_mismatch"] as const) {
      const d = deps({ confirm: vi.fn(async () => ({ ok: false as const, kind })) });
      expect((await handleWebhook(paidBody, headers, d)).status).toBe(200);
    }
  });

  it("not_paid 는 200 — 아직 결제 전일 뿐이고 다음 웹훅이 온다", async () => {
    const d = deps({
      confirm: vi.fn(async () => ({ ok: false as const, kind: "not_paid" as const })),
    });
    expect((await handleWebhook(paidBody, headers, d)).status).toBe(200);
  });

  it("확정이 던지면 500 — 포트원의 재시도를 유도한다", async () => {
    const d = deps({
      confirm: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    expect((await handleWebhook(paidBody, headers, d)).status).toBe(500);
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npm test -- src/app/api/payments/webhook`
Expected: FAIL — `Failed to resolve import "./handler"`

- [ ] **Step 4: 핸들러를 구현한다**

`src/app/api/payments/webhook/_lib/handler.ts`:

```ts
import { z } from "zod";
import type { ConfirmResult } from "@/lib/payments/confirm";

/**
 * 포트원 웹훅 본문 중 우리가 쓰는 부분. type 은 여러 가지가 오지만
 * Transaction.Paid 만 확정으로 이어진다.
 */
const webhookSchema = z.object({
  type: z.string(),
  data: z.object({ paymentId: z.string().min(1) }),
});

export interface WebhookDeps {
  /** 검증 실패 시 던진다. 서명 계산은 포트원 SDK 에 맡긴다. */
  verify(rawBody: string, headers: Record<string, string>): Promise<void>;
  confirm(paymentId: string): Promise<ConfirmResult>;
}

export interface WebhookResult {
  status: number;
  body: { ok: boolean; reason?: string };
}

const PAID_EVENT = "Transaction.Paid";

/**
 * 포트원발 결제 확정.
 *
 * 상태코드가 곧 재시도 지시다:
 *  - 200: 더 볼 것 없음 (확정됐거나, 재시도해도 결과가 같음)
 *  - 400: 우리가 받아들일 수 없는 요청 (서명 실패·모양 불일치)
 *  - 500: 일시 장애. 포트원이 다시 보내주기를 바란다
 *
 * rawBody 를 문자열로 받는 이유: 서명은 파싱된 JSON 이 아니라 원문에 걸려 있다.
 * 라우트에서 request.json() 을 먼저 부르면 검증이 반드시 실패한다.
 */
export async function handleWebhook(
  rawBody: string,
  headers: Record<string, string>,
  d: WebhookDeps,
): Promise<WebhookResult> {
  // 파싱보다 먼저 검증한다 — 위조된 본문을 해석할 이유가 없다.
  try {
    await d.verify(rawBody, headers);
  } catch (e) {
    console.error("[webhook] 서명 검증 실패", e instanceof Error ? e.message : e);
    return { status: 400, body: { ok: false, reason: "invalid_signature" } };
  }

  let parsed;
  try {
    parsed = webhookSchema.safeParse(JSON.parse(rawBody));
  } catch {
    return { status: 400, body: { ok: false, reason: "invalid_body" } };
  }
  if (!parsed.success) return { status: 400, body: { ok: false, reason: "invalid_body" } };

  // 결제 완료 외의 이벤트도 같은 URL 로 온다. 조용히 200 으로 받는다.
  if (parsed.data.type !== PAID_EVENT) return { status: 200, body: { ok: true } };

  const paymentId = parsed.data.data.paymentId;
  try {
    const result = await d.confirm(paymentId);
    if (result.ok) return { status: 200, body: { ok: true } };
    // 재시도해도 결과가 같은 사유들이다. 200 으로 닫아 재시도 폭주를 막고 로그로 남긴다.
    console.error(`[webhook] 확정 실패 paymentId=${paymentId} kind=${result.kind}`);
    return { status: 200, body: { ok: false, reason: result.kind } };
  } catch (e) {
    // 조회 장애·DB 장애. 다시 보내달라는 뜻으로 5xx 를 준다.
    console.error("[webhook] 확정 중 예외", e);
    return { status: 500, body: { ok: false, reason: "confirm_error" } };
  }
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npm test -- src/app/api/payments/webhook`
Expected: PASS (8개)

- [ ] **Step 6: 라우트를 붙인다**

`src/app/api/payments/webhook/route.ts`:

```ts
import { NextResponse } from "next/server";
import * as PortOne from "@portone/server-sdk";
import { confirmPayment } from "@/lib/payments/confirm";
import { getWebhookSecret } from "@/lib/payments/config";
import { confirmDeps } from "@/lib/payments/deps";
import { handleWebhook } from "./_lib/handler";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = getWebhookSecret();
  // 시크릿 없이 200 을 주면 검증 없이 받아들이는 것과 같다. 아예 닫는다.
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  // ⚠️ json() 이 아니라 text() 다. 서명은 원문 문자열에 걸려 있다.
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers);

  const result = await handleWebhook(rawBody, headers, {
    verify: async (body, hs) => {
      await PortOne.Webhook.verify(secret, body, hs);
    },
    confirm: (paymentId) => confirmPayment(paymentId, confirmDeps),
  });

  return NextResponse.json(result.body, { status: result.status });
}
```

- [ ] **Step 7: 전체 검증**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 전부 PASS

`@portone/server-sdk` 의 타입 오류가 나면 Step 1에서 확인한 실제 export 이름으로 import 만 고친다.

- [ ] **Step 8: 커밋**

```bash
git add src/app/api/payments/webhook package.json package-lock.json
git commit -m "feat(payments): 웹훅이 서명을 검증하고 같은 확정 로직을 부른다"
```

---

## Task 8: 결제 시작 (클라이언트)

**Files:**
- Create: `src/app/checkout/_hooks/use-payment.ts`
- Modify: `src/app/checkout/page.tsx`
- Modify: `src/app/checkout/_components/CheckoutView.tsx`
- Modify: `src/app/checkout/_components/PaymentMethodList.tsx`
- Modify: `src/app/checkout/_components/OrderSummary.tsx`
- Modify: `src/app/checkout/_components/StickyPayBar.tsx`
- Modify: `src/app/checkout/_components/PayButton.tsx`
- Modify: `package.json` (`@portone/browser-sdk` 추가)

**Interfaces:**
- Consumes: `availableMethods` (Task 2), `POST /api/payments/orders` (Task 5), `POST /api/payments/complete` (Task 6), `PAYMENT_METHODS` (`../_lib/methods`)
- Produces: `usePayment` — `{ pay, status, error }`

이 태스크는 UI라 vitest 로 다루지 않는다(프로젝트에 컴포넌트 테스트 설정이 없다). Step 9의 수동 확인이 검증이다.

- [ ] **Step 1: 브라우저 SDK 를 설치한다**

Run: `npm install @portone/browser-sdk`

- [ ] **Step 2: 결제 훅을 만든다**

`src/app/checkout/_hooks/use-payment.ts`:

```ts
"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import * as PortOne from "@portone/browser-sdk/v2";
import type { PaymentMethodId } from "../_lib/methods";

export type PaymentStatus = "idle" | "pending";

interface OrderResponse {
  paymentId: string;
  storeId: string;
  channelKey: string;
  payMethod: string;
  orderName: string;
  totalAmount: number;
  currency: string;
  redirectUrl: string;
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message ?? "결제를 진행하지 못했습니다");
  }
  return data;
}

/**
 * 결제 시작. 주문 생성 → 결제창 → 완료 확정 → 리포트.
 *
 * 금액·상품명을 여기서 만들지 않는다 — 전부 주문 생성 응답에서 온다.
 * 브라우저가 정할 수 있는 값은 "어느 프로필을 어느 수단으로" 뿐이다.
 */
export function usePayment(profileId: string) {
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const pay = useCallback(
    async (method: PaymentMethodId) => {
      setStatus("pending");
      setError(null);
      try {
        const order = (await postJson("/api/payments/orders", {
          profileId,
          method,
        })) as OrderResponse;

        const res = await PortOne.requestPayment({
          storeId: order.storeId,
          channelKey: order.channelKey,
          paymentId: order.paymentId,
          orderName: order.orderName,
          totalAmount: order.totalAmount,
          currency: order.currency as never,
          payMethod: order.payMethod as never,
          redirectUrl: order.redirectUrl,
        });

        // 모바일은 여기까지 오지 않는다 — 결제창이 페이지를 떠났고,
        // 돌아올 때는 /checkout/complete 가 받는다.
        // code 가 있으면 실패다. 사용자가 결제창을 닫아도 이 갈래로 온다.
        if (res?.code != null) throw new Error(res.message ?? "결제가 취소되었습니다");

        await postJson("/api/payments/complete", { paymentId: order.paymentId });
        // replace 인 이유: 뒤로 가기로 결제 화면에 돌아오면 이미 결제된 프로필이라
        // /checkout 가드가 다시 리포트로 튕긴다 — 히스토리에 남길 이유가 없다.
        router.replace(`/report?profile=${profileId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "결제를 진행하지 못했습니다");
        setStatus("idle");
      }
    },
    [profileId, router],
  );

  return { pay, status, error };
}
```

- [ ] **Step 3: `PayButton` 이 실제로 눌리게 한다**

`src/app/checkout/_components/PayButton.tsx` 전체를 교체:

```tsx
"use client";

/**
 * 결제 시작 버튼. 인라인(데스크톱)과 하단 고정 바(모바일) 두 곳에서 쓴다.
 * onClick 이 붙는 자리가 여기 하나뿐이도록 두 곳이 이 컴포넌트를 공유한다.
 */
export function PayButton({
  agreed,
  pending,
  label,
  onPay,
  className = "",
}: {
  agreed: boolean;
  /** 결제 진행 중. 두 번 눌러 주문이 두 개 생기는 것을 막는다. */
  pending: boolean;
  label: string;
  onPay: () => void;
  className?: string;
}) {
  const enabled = agreed && !pending;
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onPay}
      className={`rounded-[14px] py-4 text-base font-bold tracking-[-0.01em] transition-opacity ${
        enabled
          ? "cursor-pointer bg-accent text-white hover:opacity-[.92]"
          : "cursor-not-allowed bg-slate-100 text-slate-400"
      } ${className}`}
    >
      {pending ? "결제 중…" : label}
    </button>
  );
}
```

- [ ] **Step 4: `OrderSummary` 와 `StickyPayBar` 가 값을 내려보내게 한다**

`src/app/checkout/_components/OrderSummary.tsx` — 시그니처를 바꾼다 (본문 JSX 는 아래 두 곳만 손댄다):

```tsx
export function OrderSummary({
  target,
  agreed,
  pending,
  onToggleAgree,
  onPay,
}: {
  target: OrderTarget;
  agreed: boolean;
  pending: boolean;
  onToggleAgree: () => void;
  onPay: () => void;
}) {
```

그리고 파일 아래쪽 `<PayButton …/>` 호출을 통째로 교체:

```tsx
        {/* 모바일에서는 하단 고정 바가 같은 역할을 한다 — 버튼이 둘 보이지 않게 여기서 숨긴다. */}
        <PayButton
          agreed={agreed}
          pending={pending}
          onPay={onPay}
          label={`${formatKrw(FULL_REPORT_PRICE.total)} 결제하기`}
          className="hidden w-full shadow-[0_12px_24px_-12px_rgba(37,99,235,.7)] disabled:shadow-none sm:block"
        />
```

`src/app/checkout/_components/StickyPayBar.tsx` — 시그니처를 바꾼다:

```tsx
export function StickyPayBar({
  agreed,
  pending,
  onPay,
}: {
  agreed: boolean;
  pending: boolean;
  onPay: () => void;
}) {
```

그리고 그 안의 `<PayButton …/>` 호출을 교체:

```tsx
        <PayButton
          agreed={agreed}
          pending={pending}
          onPay={onPay}
          label="결제하기"
          className="flex-1"
        />
```

- [ ] **Step 5: `PaymentMethodList` 가 걸러진 목록을 받게 한다**

`src/app/checkout/_components/PaymentMethodList.tsx`의 import 와 시그니처를 바꾼다:

```tsx
"use client";
import type { PaymentMethod, PaymentMethodId } from "../_lib/methods";

export function PaymentMethodList({
  methods,
  selected,
  onSelect,
}: {
  /** 서버가 채널키를 확인해 거른 목록. 여기서 다시 거르지 않는다. */
  methods: PaymentMethod[];
  selected: PaymentMethodId;
  onSelect: (id: PaymentMethodId) => void;
}) {
  const note = methods.find((m) => m.id === selected)?.note ?? "";
```

본문의 `PAYMENT_METHODS.map(` 을 `methods.map(` 으로 바꾼다. 나머지 JSX 는 그대로다.

- [ ] **Step 6: `CheckoutView` 가 훅을 소유하게 한다**

`src/app/checkout/_components/CheckoutView.tsx`:

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { PAYMENT_METHODS, type PaymentMethodId } from "../_lib/methods";
import type { OrderTarget } from "../_lib/to-order";
import { usePayment } from "../_hooks/use-payment";
import { PaymentMethodList } from "./PaymentMethodList";
import { OrderSummary } from "./OrderSummary";
import { StickyPayBar } from "./StickyPayBar";
```

props 에 `available: PaymentMethodId[]` 를 추가하고 컴포넌트 본문 맨 위에:

```tsx
  // 화면 순서는 PAYMENT_METHODS 가, 사용 가능 여부는 서버가 정한다.
  const methods = PAYMENT_METHODS.filter((m) => available.includes(m.id));
  const [method, setMethod] = useState<PaymentMethodId>(methods[0]?.id ?? "card");
  const [agreed, setAgreed] = useState(false);
  const { pay, status, error } = usePayment(profileId);
  const pending = status === "pending";
  const ready = methods.length > 0;
```

`<PaymentMethodList …>` 자리를 이렇게 바꾼다:

```tsx
            {ready ? (
              <PaymentMethodList methods={methods} selected={method} onSelect={setMethod} />
            ) : (
              // 키가 없으면 정직하게 잠근다 — 빈 목록을 보여주고 버튼만 살려 두면
              // 사용자는 눌러 보고 나서야 안 된다는 걸 안다.
              <section className="rounded-[20px] border border-slate-200 bg-white px-4 py-8 text-center shadow-[0_1px_3px_rgba(17,24,39,.04)] sm:p-10">
                <p className="m-0 text-[15px] font-semibold tracking-[-0.01em]">
                  결제를 준비 중입니다
                </p>
                <p className="mt-2 mb-0 text-[13.5px] leading-[1.6] text-slate-400">
                  곧 결제 수단을 열어 드릴게요. 조금만 기다려 주세요.
                </p>
              </section>
            )}
```

`<OrderSummary …/>` 와 `<StickyPayBar …/>` 호출을 각각 교체한다. `agreed` 자리에 `agreed && ready` 를 넘기는 것이 요점이다 — 수단이 하나도 없으면 약관에 동의해도 결제할 수 없다:

```tsx
            <OrderSummary
              target={target}
              agreed={agreed && ready}
              pending={pending}
              onToggleAgree={() => setAgreed((v) => !v)}
              onPay={() => pay(method)}
            />
```

```tsx
      <StickyPayBar agreed={agreed && ready} pending={pending} onPay={() => pay(method)} />
```

에러 문구는 `<StickyPayBar>` 바로 앞에 둔다:

```tsx
      {error && (
        <p
          role="alert"
          className="mx-auto mb-4 w-full max-w-[1040px] px-4 text-[13.5px] font-semibold text-red-600 sm:px-6"
        >
          {error}
        </p>
      )}
```

- [ ] **Step 7: `page.tsx` 가 사용 가능 수단을 계산해 내려보낸다**

`src/app/checkout/page.tsx`에 import 를 추가하고:

```ts
import { availableMethods } from "@/lib/payments/config";
```

`<CheckoutView …>` 호출을 바꾼다:

```tsx
      <CheckoutView
        profileId={profile.id}
        target={toOrderTarget(profile)}
        available={availableMethods()}
      />
```

- [ ] **Step 8: 검증**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 전부 PASS

- [ ] **Step 9: 화면을 눈으로 확인한다**

Run: `npm run dev`

`.env.local` 에 포트원 키가 없는 상태에서 로그인 후 `/checkout?profile=<본인 프로필 id>` 를 연다.
Expected: 결제수단 목록 자리에 "결제를 준비 중입니다" 카드가 뜨고, 약관에 동의해도 결제 버튼이 잠겨 있다. 콘솔에 에러가 없다.

`PORTONE_STORE_ID` 와 `PORTONE_CHANNEL_KEY_CARD` 에 아무 문자열이나 넣고 서버를 재시작하면 카드 항목 하나만 뜨고 버튼이 살아나야 한다 (누르면 포트원이 키를 거절하므로 에러 문구가 뜬다 — 그것이 정상이다). 확인 뒤 값을 다시 비운다.

- [ ] **Step 10: 커밋**

```bash
git add src/app/checkout package.json package-lock.json
git commit -m "feat(checkout): 결제하기 버튼을 포트원 결제창에 잇는다"
```

---

## Task 9: 모바일 리다이렉트 착지점

**Files:**
- Create: `src/app/checkout/complete/page.tsx`

**Interfaces:**
- Consumes: `confirmPayment`/`confirmDeps` (Task 4·6), `findOrderByPaymentId` (Task 1), `parseProfileParam`/`first` (`@/lib/profiles/param`), `getSession` (`@/lib/auth/session`)
- Produces: 없음 (라우트)

주문 생성 API가 `redirectUrl`로 지정한 자리다. 모바일 결제창은 페이지를 떠나므로 `usePayment`의 뒷부분이 실행되지 않는다 — 여기가 대신 확정한다. 서버 컴포넌트라 확정 후 곧바로 `redirect()` 할 수 있다.

- [ ] **Step 1: 페이지를 만든다**

`src/app/checkout/complete/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { confirmPayment } from "@/lib/payments/confirm";
import { confirmDeps } from "@/lib/payments/deps";
import { findOrderByPaymentId } from "@/lib/payments/store";
import { first, parseProfileParam, type SearchParams } from "@/lib/profiles/param";

/**
 * 모바일 결제창이 돌아오는 자리. 포트원이 ?paymentId·?code·?message 를 붙여 보낸다.
 *
 * 서버 컴포넌트인 이유: 확정과 이동을 한 번에 끝낼 수 있다. 클라이언트로 만들면
 * 빈 화면을 그린 뒤 fetch 하고 다시 이동해서, 사용자가 흰 화면을 두 번 본다.
 */
export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const param = parseProfileParam(params);
  // 결제 화면으로 돌아갈 때 필요한 값이다. 없으면 홈으로 보낼 수밖에 없다.
  const backTo = param.kind === "id" ? `/checkout?profile=${param.id}` : "/home";

  // 포트원이 실패를 code 로 알려준다. 확정을 시도할 이유가 없다.
  const code = first(params.code);
  if (code) redirect(`${backTo}${backTo.includes("?") ? "&" : "?"}error=1`);

  const paymentId = first(params.paymentId);
  if (!paymentId) redirect(backTo);

  const session = await getSession();
  if (session === null) redirect(`/login?next=${encodeURIComponent(backTo)}`);

  // 남의 주문을 확정해 주지 않는다. 완료 API 핸들러와 같은 판단이다.
  const order = await findOrderByPaymentId(paymentId);
  if (order === null || order.userId !== session.userId) redirect(backTo);

  let ok = false;
  try {
    const result = await confirmPayment(paymentId, confirmDeps);
    ok = result.ok;
  } catch (e) {
    // 여기서 실패해도 웹훅이 뒤이어 확정한다. 사용자를 결제 화면으로 돌려보내면
    // /checkout 가드가 isPaid 를 다시 읽어 이미 확정됐다면 리포트로 보낸다.
    console.error("[/checkout/complete] 확정 실패", e);
  }

  redirect(ok ? `/report?profile=${order.profileId}` : backTo);
}
```

- [ ] **Step 2: 검증**

Run: `npm run typecheck && npm run lint && npm test`
Expected: 전부 PASS

- [ ] **Step 3: 라우트가 뜨는지 확인한다**

Run: `npm run dev` 후 브라우저에서 `/checkout/complete` 를 연다.
Expected: 파라미터가 없으므로 `/home` 으로 리다이렉트된다. 500 이 아니다.

- [ ] **Step 4: 커밋**

```bash
git add src/app/checkout/complete
git commit -m "feat(checkout): 모바일 결제창이 돌아올 자리를 만든다"
```

---

## Task 10: 환경 변수 문서화와 이슈 갱신

**Files:**
- Modify: `.env.example`
- Modify: `docs/issues/payment.md`
- Modify: `docs/issues/backlog.md`

- [ ] **Step 1: `.env.example` 에 결제 블록을 추가한다**

파일 끝(익명 드래프트 저장소 블록 다음)에:

```
# --- 결제 (포트원 v2) ---
# 값이 없으면 /checkout 이 "결제를 준비 중입니다"로 잠긴다. 타입체크·테스트는 그대로 통과한다.
# NEXT_PUBLIC_ 을 쓰지 않는 이유는 src/lib/payments/config.ts 주석 참조.
PORTONE_STORE_ID=                 # 콘솔 > 상점 정보. store-xxxxxxxx-…
PORTONE_API_SECRET=               # 콘솔 > API Keys > V2 API Secret. 브라우저로 절대 내보내지 않는다
PORTONE_WEBHOOK_SECRET=           # 콘솔 > 웹훅 > 시크릿. 엔드포인트는 <APP_ORIGIN>/api/payments/webhook
PORTONE_CHANNEL_KEY_CARD=         # KG이니시스 카드 채널
PORTONE_CHANNEL_KEY_NAVERPAY=     # 네이버페이 채널
PORTONE_CHANNEL_KEY_KAKAOPAY=     # 카카오페이 채널
```

- [ ] **Step 2: `docs/issues/payment.md` 를 갱신한다**

`## ⬜ ISSUE-014` 를 `## ✅ ISSUE-014` 로 바꾸고 본문을 교체:

```markdown
## ✅ ISSUE-014. 결제 연동 (단건 구매)

포트원 v2. 설계: `docs/superpowers/specs/2026-08-11-portone-payment-design.md`.

- 주문 생성 → 결제창 → 완료 API·웹훅 이중 확정. 금액은 `purchases.amount` 로만 대조한다.
- `purchases.payment_id` (마이그레이션 0010) 로 웹훅이 행을 찾는다.
- 환불·취소 API 는 범위 밖. 당분간 포트원 콘솔에서 수동으로 한다.
- **키를 채운 뒤 첫 실결제에서 확인할 것**은 설계 문서 §11 에 있다.
```

- [ ] **Step 3: 백로그에 자동 취소를 기록한다**

`docs/issues/backlog.md` 를 읽고 기존 항목의 형식을 그대로 따라 한 건 추가한다. 내용:

> **금액 불일치 결제 자동 취소.** `confirmPayment` 는 포트원 조회 금액이 주문 금액과 다르면 `purchases` 를 `failed` 로 내리고 로그만 남긴다 — 돈은 받은 상태다. 포트원 취소 API 를 붙여 자동 환불해야 한다. 현재는 콘솔에서 수동 처리.

- [ ] **Step 4: 최종 검증**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: 전부 PASS. `build` 까지 도는지 확인한다 — 새 라우트 5개가 처음으로 프로덕션 빌드를 탄다.

- [ ] **Step 5: 커밋**

```bash
git add .env.example docs/issues/payment.md docs/issues/backlog.md
git commit -m "docs(payments): 포트원 env 를 예시에 적고 ISSUE-014 를 닫는다"
```

---

## 완료 조건

- [ ] `npm test` `npm run typecheck` `npm run lint` `npm run build` 전부 통과
- [ ] 포트원 키가 하나도 없는 상태에서 `/checkout` 이 "결제를 준비 중입니다"로 잠긴다
- [ ] `migrations/0010`·`0011` 이 적용돼 있다 (`SELECT payment_id FROM purchases LIMIT 1` 이 에러 없이 돈다)
- [ ] 설계 문서 §11 의 확인 항목 4개가 `docs/issues/payment.md` 에서 추적된다
