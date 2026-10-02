# 이용권 부분 환불 설계

2026-10-02. 카드사 심사 통과 뒤 환불 기능을 연다. 유저가 지원 모달에서 환불 가능한 결제를
고르면 그 자리에서 포트원 취소까지 끝난다 — 운영자 승인 단계가 없다.

## 배경과 결정

지갑(`ticket_wallets.balance`)은 합산 잔액이라 "어느 결제의 이용권이 쓰였는가" 가 원장에 없다.
부분 환불을 하려면 이 귀속 규칙이 필요하고, 그 숫자가 모달에 "환불 가능한 이용권" 으로 보인다.

사용자가 정한 것:

| 결정 | 선택 |
| --- | --- |
| 귀속 | 결제별 잔여를 기록한다. 소비는 **가장 오래된 결제부터**(FIFO) |
| 환불액 | `결제액 − 쓴 장수 × 1,000`, 최소 0. 보너스 장수는 돈으로 돌려주지 않는다 |
| 처리 주체 | 즉시 자동. 어드민 화면 없음 |
| 불가 건 표시 | 가능한 건만 목록에. 없으면 정책 문구만 |

전제(코드에서 확인):
- 모든 기능의 단가가 1장(`FEATURE_COST`)이라 소비 1건 = 결제 1건 귀속이다.
- `ticket_entries.reason='grant'` 와 `src/lib/tickets/refund.ts`(`refundTicket`, 기능 단위 되돌림)는
  호출처가 없다. 지갑의 모든 장수는 결제에서 왔다.
- 결제 수단은 카드·간편결제뿐이라 환불 계좌를 받지 않는다 — PG 가 원결제로 되돌린다.

## 데이터

### 마이그레이션 0056 — `purchases` 에 환불 컬럼

```sql
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS remaining        int,
  ADD COLUMN IF NOT EXISTS refund_amount    int,
  ADD COLUMN IF NOT EXISTS refunded_at      timestamptz,
  ADD COLUMN IF NOT EXISTS refund_failed_at timestamptz;
```

- `remaining`: 이 결제에서 아직 안 쓴 장수. `paid` 가 아닌 행은 NULL.
- `refund_amount`·`refunded_at`: 환불 실행 때 채운다. `status='refunded'` 와 함께 간다.
- `refund_failed_at`: DB 차감은 끝났는데 포트원 취소가 실패한 시각. 운영자가 수동 취소한다.

한 파일에 SQL 문장 하나(`migrations/README.md`). ADD COLUMN 넷은 한 ALTER 다.

### 마이그레이션 0057 — `remaining` 백필

유저별로 **최근 결제부터** 현재 잔액을 채운다(FIFO 로 썼다고 보면 옛 결제가 먼저 비었다).
한 문장: 유저별 `paid` 결제를 `paid_at DESC` 로 누적합을 내고, `remaining = LEAST(tickets, GREATEST(0, balance − 앞선 누적))`.
잔액이 결제 합계보다 큰 유저(수기 지급 등)는 초과분이 어느 결제에도 안 붙는다 — 환불 대상이 아니므로 맞다.

### 소비 — `spendTicket` CTE 에 한 단계

`claim` 이 생겼을 때만 그 유저의 `status='paid' AND remaining > 0` 중 `paid_at` 가장 오래된 한 행을 `remaining − 1`.

```sql
), attributed AS (
  UPDATE purchases SET remaining = remaining - 1
   WHERE id = (
     SELECT id FROM purchases
      WHERE user_id = ${userId}::bigint AND status = 'paid' AND remaining > 0
        AND EXISTS (SELECT 1 FROM claim)
      ORDER BY paid_at, id LIMIT 1
   )
  RETURNING id
)
```

지갑 잔액 ≥ 결제 잔여 합이 항상 유지된다(백필 초과분만큼 잔액이 클 수 있다).
귀속할 결제가 없어도(초과분 소비) 소비는 성공한다 — `attributed` 가 비는 것은 오류가 아니다.

### 적립 — `confirmPurchaseAndCredit`

`paid` CTE 의 UPDATE 에 `remaining = tickets` 를 더한다.

## 규칙 (순수 함수, `src/lib/payments/refund.ts`)

```ts
export const REFUND_WINDOW_DAYS = 7;
export const USED_TICKET_PRICE = 1000;

export function refundAmount(p: { amount: number; tickets: number; remaining: number }): number {
  const used = p.tickets - p.remaining;
  return Math.max(0, p.amount - used * USED_TICKET_PRICE);
}

/** 목록·실행이 같은 답을 보게 조건을 한 곳에 둔다. */
export function isRefundable(p: { status: string; paidAt: Date | null; remaining: number | null; ... }, now: Date): boolean
```

조건: `status='paid'` · `paid_at` 이 `now − 7일` 이후 · `remaining > 0` · `refundAmount > 0`.
`tickets` 는 보너스 포함 적립 장수(`creditedTickets`)다 — `purchases.tickets` 가 그 값이다.

예: 6장 5,000원(5+보너스1)에서 2장 사용 → 쓴 2장 × 1,000 = 2,000 → **3,000원**, 남은 4장 전부 회수.
13장 10,000원에서 10장 사용 → 0원 → 목록에서 빠진다.

## 실행 — `executeRefund(purchaseId, userId, now)`

CTE 한 문장(적립의 역). Neon HTTP 에 대화형 트랜잭션이 없어 세 테이블을 한 문장에 묶는다.

```sql
WITH target AS (
  UPDATE purchases
     SET status = 'refunded', refunded_at = now(), refund_amount = ${amount}
   WHERE id = ${purchaseId}::bigint AND user_id = ${userId}::bigint
     AND status = 'paid' AND remaining > 0
     AND paid_at >= ${windowStart}
  RETURNING id, user_id, remaining, payment_id
), wallet AS (
  UPDATE ticket_wallets w SET balance = w.balance - t.remaining, updated_at = now()
    FROM target t WHERE w.user_id = t.user_id
  RETURNING balance
), ledger AS (
  INSERT INTO ticket_entries (user_id, delta, reason, purchase_id)
  SELECT user_id, -remaining, 'refund', id FROM target
  RETURNING id
)
SELECT t.payment_id, t.remaining FROM target t
```

- `amount` 는 실행 직전 서버가 다시 읽어 계산한다. 클라이언트 값은 받지 않는다.
- 0행이면 "환불할 수 없는 결제" — 남의 것·7일 경과·이미 환불·전부 사용을 가르지 않는다.
- 동시 요청 두 개는 `status='paid'` 조건으로 한쪽만 통과한다. 0053 의 열린-요청 유니크 인덱스는 더 쓰지 않는다.
- 지갑 잔액이 음수가 되는 경우(백필 뒤 잔액 < 잔여 합)는 `ticket_wallets_balance_check` 로 문장 전체가 롤백된다 — 유저에게는 실패로, 로그로 남긴다.

그 다음 포트원 취소. 실패해도 **DB 를 되돌리지 않는다**: `refund_failed_at` 을 찍고 운영자 메일에 실패를 표시한다.
"돈은 안 나갔는데 이용권이 사라진" 상태는 운영자가 포트원 콘솔에서 취소를 마저 하면 맞춰진다.
반대("돈은 나갔는데 이용권이 남은")는 유저가 그 이용권을 더 써 버릴 수 있어 되돌리기 어렵다.

## 포트원 — `cancelPayment` (`src/lib/payments/portone.ts`)

`POST /payments/{paymentId}/cancel`, 본문 `{ reason, amount? }`. 인증(`PortOne <secret>`)·에러 처리는 `getPayment` 과 같다.
전액(`amount === purchase.amount`)이면 `amount` 를 생략한다. `PAYMENT_ALREADY_CANCELLED` 는 성공으로 본다 — 재시도 안전.
`fetchImpl`·`env` 주입은 기존 함수와 같은 방식.

## API

### `GET /api/support/options?kind=refund`

`listPurchaseOptions` 를 바꾼다. 응답 항목: `{ purchaseId, title, sub, remaining, refundAmount, createdAt }`.
서버가 `isRefundable` 로 거른 것만 내려온다. `requested` 는 없어진다. `balance` 는 유지.

### `POST /api/refunds` (신규)

본문 `{ purchaseId: string, reason: RefundReason, body?: string }`.
1. 세션 없으면 401.
2. 결제 행 조회 → `isRefundable` 아니면 409 `{ error: "환불할 수 없는 결제예요" }`.
3. `executeRefund` → 0행이면 409(위와 같은 문구).
4. `cancelPayment` → 실패 시 `refund_failed_at` 기록, 운영자 메일에 `[실패]` 표시. 유저 응답은 아래와 같되 `pending: true`.
5. `support_tickets` 에 `kind='refund', status='resolved', purchase_id, refund_reason, body, admin_note='자동 환불 N원'` 기록(실패면 `status='open'`, `admin_note='포트원 취소 실패 — 콘솔에서 수동 취소'`). 기존 `mailer` 로 운영자 메일.
6. 응답 `{ amount, pending }`.

기존 `POST /api/support` 의 `kind: "refund"` 갈래와 `REFUND_REASONS` 검증은 새 라우트로 옮긴다.
`support_tickets` 의 `refund` CHECK(purchase_id·reason 필수)는 그대로 맞는다.

## 모달 (`src/components/support/SupportDialog.tsx` 환불 탭)

- 상단 정책 2줄: "결제일로부터 7일 이내, 사용하지 않은 이용권만 환불돼요." / "쓴 장수는 장당 1,000원으로 계산하고, 보너스 장수는 환불되지 않아요."
- 목록 한 줄: 제목 `이용권 6장 · 5,000원`, 부제 `남은 4장 → 3,000원 환불`, 오른쪽 결제일.
- 비었을 때: "지금 환불 가능한 이용권이 없어요" (정책 문구는 위에 그대로).
- 사유 선택·자유 입력은 유지. 사유는 필수.
- 제출 버튼 문구: `{amount}원 환불받기`. 결과 화면: "{amount}원이 결제하신 수단으로 돌아가요. 카드사에 따라 3~7일 걸려요." `pending` 이면 "환불을 접수했어요. 처리에 시간이 걸릴 수 있어요."
- 제출은 `POST /api/refunds`.

## 건드리지 않는 것

- `src/lib/tickets/refund.ts`(`refundTicket`): 기능 단위 되돌림, 호출처 없음. 이름이 겹치지만 이번 범위 밖.
- 약관 제5조 문구: 이미 "회사 귀책 전액 환불" 과 결제 화면의 "7일 내 미사용분 환불" 이 있다. 바꾸지 않는다.
- `users.role`: 자동 환불이라 쓰지 않는다.

## 테스트

- `refund.ts` 순수 함수: 경계값(7일 정각, 0원, 보너스 묶음, remaining=tickets 전액).
- `spendTicket` CTE: 가장 오래된 `paid` 결제의 `remaining` 이 준다는 SQL 바인딩 검사(기존 패턴).
- `executeRefund`: 0행 → 환불 불가, 성공 시 `payment_id`·`remaining` 반환.
- `cancelPayment`: 전액이면 `amount` 생략, 이미 취소는 성공, 그 외 에러는 `PortOneError`.
- `POST /api/refunds`: 401 · 409 · 성공 · 포트원 실패 분기(`pending`, 티켓 `open`).
- 모달: 빈 목록 문구, 버튼 금액, `pending` 결과 문구.
- 로컬 끝단: 테스트 채널로 1,000원 결제 → 환불 → 포트원 콘솔에서 취소 확인 → 지갑 0장.
