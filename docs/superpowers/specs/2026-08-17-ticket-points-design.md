# 이용권(포인트) 결제 시스템

> 2026-08-17 · 단건 결제 → 충전식 이용권 전환

## 0. 한 줄

**돈으로 이용권을 사고, 서비스는 이용권으로 연다.** 리포트든 궁합이든 1장씩.

## 1. 배경과 결정

지금은 프로필 하나의 전체 리포트를 9,900원에 단건 결제한다. `purchases` 에 `(profile_id, 'full_report')` 로 `paid` 행이 박히면 리포트가 열린다.

이 구조는 상품이 하나일 때만 성립한다. 궁합·오늘의 운세처럼 가벼운 서비스가 붙으면 서비스마다 결제창을 띄워야 하고, 사용자는 1,000원짜리를 사려고 카드 정보를 다시 꺼낸다.

이용권을 사이에 끼운다. 결제는 충전 한 번, 사용은 클릭 한 번.

### 확정된 결정

| 항목 | 결정 |
|---|---|
| 이용권 단가 | 1장 = 1,000원 |
| 소비 단가 | 모든 서비스 균일 1장 (리포트 포함) |
| 충전 방식 | 고정 패키지 3종 + 묶음 보너스 |
| 재열람 | 한 번 쓰면 영구 열람. 재차감 없음 |
| 기존 결제 | 실사용자 없음 — 단건 경로를 제거한다 |
| 이번 범위 | 이용권 인프라 + 리포트 전환. 궁합 화면은 다음 |

리포트 객단가가 9,900 → 1,000원으로 내려간다. 유료 12섹션 LLM 생성 원가가 그 안에 들어가는지는 확인되지 않았다 — 원국 단위 공유 캐시가 있어 재사용률이 높으면 견디지만, 첫 생성 원가는 별도로 측정해야 한다. 이 문서의 구현과는 독립적이라 설계는 이대로 간다.

## 2. 왜 제약으로 막는가

Neon HTTP 드라이버에는 대화형 트랜잭션이 없다. "잔액을 읽고 → 충분한지 판단하고 → 차감한다" 를 앱에서 세 걸음으로 하면 동시 요청 두 개가 같은 잔액을 읽는다. 두 번째 요청은 없는 돈을 쓴다.

그래서 **잔액이 음수가 될 수 없다는 사실을 앱이 아니라 스키마가 보장한다.** 차감·적립은 전부 CTE 한 문장이고, 동시성 판정은 `CHECK` 와 `UNIQUE` 가 내린다. 앱 코드에는 어길 여지가 남지 않는다.

이건 기존 `markPurchasePaid` 의 조건부 UPDATE(`WHERE status = 'pending'`)와 같은 관용구다 — 웹훅과 완료 API 가 같은 결제를 동시에 확정하러 와도 UPDATE 를 이긴 쪽만 true 를 받는 그 판단을 잔액에도 적용한다.

## 3. 스키마

`scripts/migrate.mts` 는 파일 하나를 prepared statement 하나로 보낸다. **마이그레이션 파일 하나에 SQL 문장은 하나만** 담는다 (0010/0011 이 같은 이유로 갈라져 있다).

### 0012_ticket_wallets.sql

```sql
-- 이용권 잔액. 사용자당 한 행이고 잔액의 유일한 출처다.
--
-- ⚠️ CHECK (balance >= 0) 가 이 테이블의 존재 이유다. Neon HTTP 드라이버에는
-- 대화형 트랜잭션이 없어 "읽고 판단하고 차감"을 앱에서 하면 동시 요청 두 개가
-- 같은 잔액을 읽는다. 차감 UPDATE 가 음수를 만드는 순간 이 제약이 문장 전체를
-- 되돌린다 — 앱 코드가 실수해도 잔액은 새지 않는다.
--
-- 행이 없는 사용자 = 잔액 0 이다. 회원가입 때 미리 만들지 않는다: 충전 적립이
-- INSERT ... ON CONFLICT DO UPDATE 라 첫 충전에서 생기고, 차감 쪽은 행이 없으면
-- NULL >= 1 이 거짓이라 알아서 잔액 부족으로 떨어진다.
CREATE TABLE IF NOT EXISTS ticket_wallets (
  user_id    bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance    int NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 0013_entitlements.sql

```sql
-- 이용권을 써서 얻은 열람 권한. 한 번 생기면 영구다 (재열람 무료).
--
-- feature + subject_key 로 서비스를 일반화한다 — 새 서비스는 테이블을 건드리지
-- 않고 값만 추가한다:
--   전체 리포트 : ('full_report',    프로필 id)
--   궁합        : ('compatibility',  정렬한 두 프로필 id, 예 '12:34')
-- 궁합 키를 정렬하는 이유: (12,34) 와 (34,12) 는 같은 궁합인데 키가 다르면
-- 같은 사용자가 두 번 차감된다.
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

### 0014_entitlements_unique.sql

```sql
-- 같은 사용자가 같은 대상에 두 번 차감되지 않게 막는다.
-- 이 인덱스는 중복 방지이자 멱등 키다: 차감 CTE 의 INSERT 가 여기서 충돌하면
-- ON CONFLICT DO NOTHING 으로 접히고, 뒤따르는 UPDATE 가 EXISTS 로 막혀
-- 차감 자체가 일어나지 않는다 (더블클릭 방어).
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_unique
  ON entitlements (user_id, feature, subject_key);
```

### 0015_ticket_entries.sql

```sql
-- 잔액이 왜 그 값인지 설명하는 원장. delta 양수 = 적립, 음수 = 사용.
--
-- 잔액 계산에는 쓰지 않는다 — 잔액의 출처는 ticket_wallets 하나다. 여기서
-- SUM 을 떠서 잔액으로 쓰면 값이 두 벌이 되고 언젠가 어긋난다 (profiles 에
-- is_paid 를 두지 않은 것과 같은 판단, src/lib/profiles/store.ts).
-- 이 표는 환불·CS·버그 추적을 위한 근거다.
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

`grant`(수기 지급)와 `refund` 는 이번에 쓰는 경로가 없지만 CHECK 목록에 넣어 둔다. 나중에 목록을 넓히려면 제약을 갈아야 하는데, 그 마이그레이션이 필요한 시점은 대개 급한 CS 상황이다.

### 0016_ticket_entries_user_idx.sql

```sql
-- 내 이용권 내역 조회용. purchases_user_idx 와 같은 모양이다.
CREATE INDEX IF NOT EXISTS ticket_entries_user_idx
  ON ticket_entries (user_id, created_at DESC);
```

### 0017_purchases_tickets.sql

```sql
-- 이 결제가 적립할 이용권 장수(보너스 포함). 주문 생성 시점에 서버가 박는다 —
-- amount 와 같은 판단이다. 브라우저가 보내는 값이 아니므로 손댈 수 없고,
-- 확정 시점에 가격표를 다시 읽지 않아 그 사이 가격표가 바뀌어도 산 만큼 받는다.
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS tickets int;
```

### 0018_drop_purchases_paid_unique.sql

```sql
-- (profile_id, product) 유니크는 "프로필당 한 번만 산다"는 단건 상품 전제였다.
-- 이용권은 같은 패키지를 반복 구매한다.
DROP INDEX IF EXISTS purchases_paid_unique;
```

`purchases` 의 나머지는 그대로 쓴다. `profile_id` 는 이제 항상 NULL 이다 — 0007 이 "프로필 단위가 아닌 상품을 같은 테이블에 담기 위해" 열어 둔 자리를 이제 쓴다.

## 4. 가격표 — `src/lib/payments/pricing.ts`

파일을 교체한다. 기존 `FULL_REPORT_PRICE` / `FULL_REPORT_ORDER_NAME` 은 소멸.

```ts
export const TICKET_PACKAGES = [
  { id: "t1",  amount: 1000,  tickets: 1,  bonus: 0 },
  { id: "t5",  amount: 5000,  tickets: 5,  bonus: 1 },
  { id: "t10", amount: 10000, tickets: 10, bonus: 3 },
] as const;

export type TicketPackageId = (typeof TICKET_PACKAGES)[number]["id"];
```

적립 장수는 `tickets + bonus`, 청구 금액은 `amount` 명시값이다. `amount` 를 `tickets * 1000` 으로 계산하지 않는 이유는 기존 `FULL_REPORT_PRICE` 주석과 같다 — 표시용 정가와 실제 청구 금액은 언제든 갈라질 수 있고, 청구 금액은 파생값이 아니라 명시값이어야 한다.

소비 단가는 따로 둔다.

```ts
export const FEATURE_COST = {
  full_report: 1,
  compatibility: 1,
} as const;

export type Feature = keyof typeof FEATURE_COST;
```

`Feature` 를 이 객체의 키로 파생시키는 것이 요점이다. 차감 API 가 `feature: Feature` 를 받으면 오타가 조용한 무료 열람이 되지 않고 컴파일에서 걸린다.

주문명(`orderName`)은 패키지에서 만든다: `이용권 6장`. 기존 판단대로 프로필 이름은 넣지 않는다.

## 5. 충전 흐름 (PG 결제)

포트원 파이프라인은 그대로다. 주문 생성 → 결제창 → 완료 API/웹훅 이중 확정. `confirmPayment` 의 판단(금액 대조, 상태 3분류, 확정 실패 시 재조회)은 손대지 않는다.

바뀌는 것은 두 곳이다.

### 5.1 주문 생성 — `POST /api/payments/orders`

요청이 `{ profileId, method }` 에서 `{ packageId, method }` 로 바뀐다.

사라지는 가드: 프로필 소유 확인, `profile.isPaid` 중복 결제 409. 이용권 충전에는 대상 프로필이 없고 반복 구매가 정상이다.

남는 판단: 로그인 확인(401), `packageId` 를 `TICKET_PACKAGES` 에서 찾기(400), storeId/channel/origin 미설정(503), 행을 먼저 만들고 결제창을 연다는 순서.

`createPendingPurchase` 는 `profileId` 대신 `tickets` 를 받는다.

```ts
{ userId, paymentId, amount, tickets, product: packageId }
```

`redirectUrl` 은 `/checkout/complete?next=<돌아갈 곳>` 이 된다. 지금은 프로필 리포트로 고정돼 있는데, 충전은 리포트가 아닌 곳에서도 시작될 수 있다.

### 5.2 확정 + 적립 — `markPurchasePaid` 교체

```sql
WITH paid AS (
  UPDATE purchases
     SET status = 'paid', paid_at = now(), provider_txn_id = $txn
   WHERE payment_id = $pid AND status = 'pending'
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
SELECT (SELECT balance FROM wallet) AS balance
```

한 문장이라 **"결제는 확정됐는데 적립이 안 됐다" 가 구조적으로 불가능하다.** 확정과 적립 사이에 프로세스가 죽을 틈이 없다.

이중 적립도 막힌다: 웹훅과 완료 API 가 동시에 와도 `status = 'pending'` 조건을 이긴 쪽만 `paid` CTE 에 행을 받는다. 진 쪽은 `paid` 가 비어서 `wallet`/`ledger` 의 `SELECT ... FROM paid` 가 0행이 되고, 적립이 일어나지 않는다. 이는 기존 `markPurchasePaid` 가 "갱신된 행이 있으면 true" 로 하던 판단과 정확히 같으며, 반환값도 그대로 유지한다 — `balance` 가 NULL 이면 false(이미 확정됨)다.

`ConfirmResult` 의 `profileId` 는 사라지고 잔액으로 대체된다.

```ts
export type ConfirmResult =
  | { ok: true; kind: "confirmed" | "already" }
  | { ok: false; kind: ConfirmFailure };
```

`already` 갈래는 `profileId` 를 돌려주려고 재조회하던 것인데, 이제 돌려줄 게 없어 재조회가 단순해진다. 다만 **환불·실패로 내려간 행을 `already` 로 접으면 안 된다**는 판단은 그대로 살린다.

## 6. 사용 흐름 (PG 없음)

`POST /api/tickets/spend` 하나. 요청은 `{ feature: Feature, subjectKey: string }`.

핸들러가 하는 일:

1. 로그인 확인 (401)
2. `feature` 를 `FEATURE_COST` 로 검증하고 단가를 얻는다 (400)
3. **`subjectKey` 의 소유 확인** — feature 마다 규칙이 다르다. `full_report` 는 `getProfile(userId, subjectKey)` 가 null 이 아니어야 한다 (404). 이 단계가 빠지면 남의 프로필에 이용권을 써서 존재 여부를 훑을 수 있다
4. 차감 CTE 실행
5. 결과를 갈래로 접어 응답

### 차감 CTE

```sql
WITH claim AS (
  INSERT INTO entitlements (user_id, feature, subject_key, cost)
  SELECT $u, $f, $s, $c
   WHERE (SELECT balance FROM ticket_wallets WHERE user_id = $u) >= $c
  ON CONFLICT (user_id, feature, subject_key) DO NOTHING
  RETURNING id
), pay AS (
  UPDATE ticket_wallets
     SET balance = balance - $c, updated_at = now()
   WHERE user_id = $u AND EXISTS (SELECT 1 FROM claim)
  RETURNING balance
), ledger AS (
  INSERT INTO ticket_entries (user_id, delta, reason, entitlement_id)
  SELECT $u, -$c, 'spend', id FROM claim
  RETURNING id
)
SELECT (SELECT id FROM claim) AS entitlement_id,
       (SELECT balance FROM pay) AS balance
```

순서가 요점이다. **권한 INSERT 가 먼저고 차감이 뒤다.** 반대로 하면 차감은 됐는데 권한이 UNIQUE 에 걸려 사라지는 경우가 생긴다 — 돈만 없어진다.

네 갈래 모두 제약이 판정한다.

| 상황 | 결과 | 판정 |
|---|---|---|
| 정상 | `entitlement_id` 반환, 잔액 −1 | — |
| 중복 요청(더블클릭·재시도) | UNIQUE 충돌 → `claim` 빈 채로 → `EXISTS` 거짓 → 차감 없음 | `entitlements_unique` |
| 잔액 부족 | 지갑 행이 없거나 `balance >= cost` 거짓 → `claim` 없음 | `WHERE` 게이트 |
| 서로 다른 서비스 동시 사용 | 두 UPDATE 가 행 잠금으로 직렬화 → 두 번째가 음수 → 문장 전체 롤백 | `CHECK (balance >= 0)` |

마지막 줄이 핵심이다. READ COMMITTED 에서 두 번째 UPDATE 는 첫 번째가 커밋된 뒤 갱신된 행에 대해 `balance - cost` 를 다시 계산한다. 결과가 음수면 CHECK 가 터지고, 단일 문장이므로 `entitlements` INSERT 까지 통째로 되돌아간다. 앱은 이 예외를 잡아 "잔액 부족" 으로 접기만 하면 된다.

### 결과 해석

```ts
type SpendResult =
  | { ok: true; kind: "spent" | "already"; balance: number }
  | { ok: false; kind: "insufficient"; balance: number };
```

`entitlement_id` 가 NULL 인 경우는 두 가지고, CTE 결과만으로는 갈리지 않는다. 한 번 더 읽어 가른다.

```sql
SELECT
  (SELECT id      FROM entitlements   WHERE user_id=$u AND feature=$f AND subject_key=$s) AS entitlement_id,
  (SELECT balance FROM ticket_wallets WHERE user_id=$u) AS balance
```

권한 행이 있으면 `already`, 없으면 `insufficient` 다. `balance` 가 NULL(지갑 행 없음)이면 0 으로 접는다.

CHECK 위반 예외(동시 사용으로 잔액이 음수가 된 경우)도 같은 자리에서 잡는다. Postgres 는 이 예외를 SQLSTATE `23514`(check_violation)로 준다 — `ticket_wallets_balance_check` 위반이면 `insufficient` 로 접고, 그 외 예외는 다시 던진다. 모든 예외를 잔액 부족으로 삼키면 DB 장애가 "이용권이 없다"는 안내로 둔갑한다.

`already` 는 실패가 아니다 — 사용자는 열람 권한을 가지고 있고 그게 원하던 결과다. 화면은 `spent` 와 똑같이 처리한다.

## 7. 열람 권한 판정

`profiles/store.ts` 의 `isPaid` 파생을 `purchases` 조인에서 `entitlements` 조인으로 바꾼다. 두 함수(`listProfiles`, `getProfile`)의 LEFT JOIN 만 갈아 끼우면 된다.

```sql
LEFT JOIN entitlements e
  ON e.user_id = p.user_id
 AND e.feature = 'full_report'
 AND e.subject_key = p.id::text
```

파생값으로 두는 판단은 그대로다 — `profiles` 에 컬럼을 두면 권한 테이블과 두 벌이 되어 어긋난다.

`ProfileRow.isPaid` 라는 이름은 이제 사실과 어긋난다(돈을 낸 게 아니라 이용권을 쓴 것이다). `isUnlocked` 로 바꾼다. 읽는 곳은 `report/page.tsx`, `/home` 배지, `checkout` 가드 정도라 범위가 작다.

`report/_lib/access.ts` 의 `?paid=true` 개발용 토글은 그대로 둔다. 프로덕션에서 무시되는 판단도 그대로다.

## 8. 화면

### `/checkout` — 충전 화면

`?profile=<id>` 대신 `?next=<돌아갈 곳>`. 프로필을 읽지 않으므로 `notFound`/소유 확인/`isPaid` 리다이렉트 가드가 전부 빠진다.

`?next` 는 **자기 사이트 내부 경로만 허용한다** (`/` 로 시작하고 `//` 가 아닌 것). 검사 없이 `redirect` 에 넘기면 외부 URL 로 튕기는 오픈 리다이렉트가 된다. 검사에 실패하면 `/home` 으로 접는다.

`OrderSummary` 가 패키지 3종 선택 UI 로 바뀐다. 각 카드는 `장수 + 보너스`, 금액, 장당 단가를 보여준다. `PaymentMethodList`·`StickyPayBar`·`PayButton`·`CheckoutHeader` 는 그대로 산다.

`_lib/to-order.ts`(프로필 → 주문 대상 변환)와 그 테스트는 소멸. `_lib/pricing.ts` 는 패키지 표시 계산으로 내용이 바뀐다.

### `/checkout/complete`

확정 후 `next` 로 복귀한다. 지금은 `?profile` 을 읽어 리포트로 고정 이동하는데, 충전은 어디서든 시작될 수 있다.

### `/report` — 잠긴 섹션 CTA

`LockedSections` 의 CTA 가 `/checkout` 링크에서 버튼으로 바뀐다.

1. `POST /api/tickets/spend { feature: "full_report", subjectKey: profileId }`
2. `ok` (`spent`/`already`) → `router.refresh()`. 서버 컴포넌트가 다시 돌면서 `isUnlocked` 가 true 가 되고 유료 12섹션 생성으로 들어간다
3. `insufficient` → `/checkout?next=/report?profile=<id>` 로 이동

비로그인·드래프트 경로는 지금처럼 로그인으로 먼저 보낸다.

여기서 `router.refresh()` 직후가 이 앱에서 가장 느린 순간이라는 점은 결제 때와 같다 — 유료 12섹션 첫 생성이 `maxDuration = 60` 에 걸릴 수 있다는 기존 위험이 그대로 이어진다. 이번 작업에서 다루지 않는다.

### `/home`

헤더에 잔액 `이용권 N장` 과 충전 링크를 붙인다. 서버 컴포넌트에서 `getBalance(userId)` 로 읽는다 — 행이 없으면 0.

## 9. 파일 배치

```
src/lib/tickets/
  wallet.ts        지갑 읽기·적립 (SQL 소유)
  spend.ts         차감 CTE (SQL 소유)
  spend.test.ts
  features.ts      Feature 타입·FEATURE_COST·subjectKey 규칙
  features.test.ts

src/app/api/tickets/spend/
  route.ts
  _lib/handler.ts       순수 함수 + deps 주입 (기존 API 와 같은 모양)
  _lib/handler.test.ts
```

`src/lib/payments/` 는 PG 결제만 계속 담당한다. 적립은 `confirm.ts` 가 `markPaid` deps 를 통해 부르므로, `payments` 가 `tickets` 를 직접 import 하지 않는다 — 라우트가 둘을 조립한다.

`src/lib/profiles/products.ts`(`PRODUCT_FULL_REPORT`)는 소멸한다. `purchases.product` 에는 이제 패키지 id 가 들어간다.

## 10. 테스트

기존 테스트가 전부 deps 주입 구조라 같은 모양으로 따라간다.

- `orders/_lib/handler.test.ts` — `packageId` 검증, 미지의 패키지 400, 미설정 503, `tickets` 가 서버 상수에서 오는지
- `complete/_lib/handler.test.ts` — 응답이 잔액으로 바뀐 것
- `confirm.test.ts` — 기존 케이스 유지, `profileId` 자리만 교체
- `tickets/spend/_lib/handler.test.ts` — 4갈래, 소유 확인 404, 미지의 feature 400
- `features.test.ts` — 궁합 `subjectKey` 정렬 규칙

**동시성은 단위 테스트로 재현할 수 없다.** 차감·적립 CTE 두 개의 정확성 근거는 테스트가 아니라 스키마 제약(`CHECK`, `UNIQUE`)이다. 그래서 제약을 마이그레이션에서 지우거나 완화하면 방어선이 통째로 사라진다 — 마이그레이션 주석에 그 이유를 남긴다.

## 11. 하지 않는 것

- 궁합 서비스 자체 (화면·해석 콘텐츠). `feature` 값 하나 추가로 붙을 수 있게 인터페이스만 열어 둔다
- 환불·취소 API 연동. `refund` 원장 reason 은 자리만 잡아 둔다
- 이용권 유효기간·만료
- 이용권 내역 화면. 원장은 쌓지만 보여주는 화면은 아직 없다
- 신규 가입 무료 지급. `grant` reason 은 자리만 잡아 둔다
- 리포트 생성 원가 측정 (§1 참조)
