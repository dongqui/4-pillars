# 포트원 v2 결제 연동 설계 문서

**날짜:** 2026-08-11
**이슈:** ISSUE-014 (결제 연동, 단건 구매)
**선행 작업:** `2026-08-05-checkout-page-design.md` — 화면은 이미 있고 결제 호출 자리만 비어 있다.

## 1. 목표

`/checkout`의 결제하기 버튼을 실제 결제에 잇는다. 결제가 끝나면 `purchases`에 `status='paid'` 행이 생기고, 이미 있는 `profiles` LEFT JOIN이 그 행을 읽어 리포트의 잠긴 8섹션이 열린다.

## 2. 범위 결정 (확정됨)

| 항목 | 결정 |
| --- | --- |
| 깊이 | **실동작 전부.** 포트원 REST 호출·금액 대조·행 확정까지 구현한다. env만 비어 있다. |
| 확정 경로 | **완료 API + 웹훅 둘 다.** 포트원 권장 구조. 두 경로가 확정 함수 하나를 공유한다. |
| 결제수단 | **수단별 채널키 3개.** 카드(KG이니시스) / 네이버페이 / 카카오페이. |
| 키 노출 | **전부 서버 전용 env.** `NEXT_PUBLIC_`을 쓰지 않는다 (§5). |
| 로케일 | **KR만.** 통화는 KRW 고정. |

### 비범위 (YAGNI)

- 환불·취소 API. 화면의 환불 안내는 문구일 뿐이고, 실제 환불은 당분간 포트원 콘솔에서 수동으로 한다.
- 가상계좌·정기결제·빌링키. 상품이 단건 하나다.
- 결제 내역 화면. `purchases`에 행은 쌓이지만 보여줄 곳은 아직 없다.
- 금액 불일치 시 자동 취소 (§7.3에 백로그로 기록).
- 재시도로 쌓인 `pending` 행 청소. 유해하지 않다 (§4).

## 3. 흐름

```
[클라] 결제하기 클릭
  │
  ├─ POST /api/payments/orders   { profileId, method }
  │    서버: 세션·소유·미결제 확인 → paymentId 발급
  │          purchases(status='pending', payment_id=…) 삽입
  │    응답: { paymentId, storeId, channelKey, payMethod, orderName, totalAmount, redirectUrl }
  │
  ├─ PortOne.requestPayment(…)   결제창 (PC: 레이어 / 모바일: 리다이렉트)
  │
  ├─ POST /api/payments/complete { paymentId }
  │    서버: GET api.portone.io/payments/{id} → status·금액·통화 대조
  │          purchases → status='paid'
  │
  └─ /report?profile=…

[포트원 서버] POST /api/payments/webhook
     Transaction.Paid → 같은 확정 함수
```

**금액은 클라이언트가 정하지 못한다.** 주문 생성 API가 `FULL_REPORT_PRICE.total`을 읽어 행을 만들고, 확정 시 그 **행의 `amount`** 와 포트원 조회 결과를 대조한다. 요청 본문에 금액을 받는 자리가 아예 없다.

**모바일 리다이렉트.** 대부분의 모바일 환경은 결제창이 페이지를 떠난다. `redirectUrl`로 지정한 `/checkout/complete`가 착지점이고, 포트원이 `paymentId`·`code`·`message`를 쿼리로 붙여 준다. 이 페이지가 완료 API를 호출한 뒤 리포트로 보낸다. PC 레이어 결제도 같은 완료 API를 부르므로 확정 로직은 한 벌이다.

## 4. 스키마 변경

포트원 v2는 ID가 둘이다 — 고객사가 발급하는 `paymentId`(주문 ID)와 포트원이 발급하는 `transactionId`(거래 ID). **웹훅은 `paymentId`로 온다**. 지금 `purchases`에는 `provider_txn_id` 하나뿐이라 웹훅이 행을 찾을 수 없다.

```sql
-- migrations/0010_purchases_payment_id.sql
-- 고객사가 발급하는 주문 ID (포트원 v2 paymentId). 웹훅과 완료 API가 이걸로 행을 찾는다.
-- provider_txn_id 와 다르다: 그쪽은 포트원이 발급하는 거래 ID(transactionId)다.
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_id text;

-- 부분 인덱스인 이유: 이 컬럼이 붙기 전 행과, PG 를 거치지 않는 행(수기 지급 등)은 NULL 이다.
CREATE UNIQUE INDEX IF NOT EXISTS purchases_payment_id_unique
  ON purchases (payment_id) WHERE payment_id IS NOT NULL;
```

기존 `purchases_paid_unique` (`(profile_id, product) WHERE status='paid'`)는 그대로 둔다. 완료 API와 웹훅이 동시에 도착해도 한 행만 `paid`가 되게 하는 최후 방어선이다.

**`pending` 행은 재시도마다 쌓인다.** 결제를 세 번 시도하면 `pending` 세 개에 `paid` 하나가 남는다. `0008` 인덱스가 `paid`에만 걸려 있어 의도한 동작이고(0007 주석에도 그렇게 적혀 있다), 재시도 이력이 남는 편이 디버깅에 낫다.

## 5. 환경 변수 — 전부 서버 전용

```
# --- 결제 (포트원 v2) ---
PORTONE_STORE_ID=                 # 콘솔 > 상점 정보. store-xxxxxxxx-…
PORTONE_API_SECRET=               # 콘솔 > API Keys > V2 API Secret. 절대 브라우저로 내보내지 않는다
PORTONE_WEBHOOK_SECRET=           # 콘솔 > 웹훅 > 시크릿
PORTONE_CHANNEL_KEY_CARD=         # KG이니시스 카드 채널
PORTONE_CHANNEL_KEY_NAVERPAY=     # 네이버페이 채널
PORTONE_CHANNEL_KEY_KAKAOPAY=     # 카카오페이 채널
```

`storeId`·`channelKey`는 브라우저가 보게 되는 값이지만 **`NEXT_PUBLIC_`으로 두지 않는다.** 이유 둘:

1. `NEXT_PUBLIC_`은 빌드타임에 번들로 인라인된다. 채널을 하나 추가하거나 키를 교체할 때마다 재빌드가 필요하다.
2. "이 수단은 아직 키가 없다"는 판단을 서버가 해야 한다. 브라우저에 빈 문자열을 내려 보내고 클라이언트가 분기하면, 키 없는 수단이 화면에 남았다가 결제창에서 실패한다.

대신 `/checkout` 서버 컴포넌트가 설정된 채널만 골라 내려주고, 주문 생성 응답이 `storeId`·`channelKey`를 실어 보낸다. `.env.example`에도 위 블록을 추가한다.

### 키가 없을 때

| 지점 | 동작 |
| --- | --- |
| `/checkout` 렌더 | 설정된 수단만 목록에 뜬다. 0개면 목록 자리에 "결제 준비 중입니다" 안내가 뜨고 결제 버튼이 잠긴다 |
| `POST /api/payments/orders` | 요청된 수단의 채널키가 없으면 503 |
| `POST /api/payments/complete` | `PORTONE_API_SECRET`이 없으면 503 |
| `POST /api/payments/webhook` | `PORTONE_WEBHOOK_SECRET`이 없으면 503 |
| `npm run typecheck` / `test` | **전부 통과한다.** env를 읽는 코드가 부재를 값으로 다루지 예외로 다루지 않는다 |

이것이 "껍데기만"의 정확한 의미다: 코드는 완성돼 있고, 키가 없으면 화면이 정직하게 잠긴다.

## 6. 의존성

| 용도 | 선택 | 이유 |
| --- | --- | --- |
| 결제창 | `@portone/browser-sdk` | 결제창은 직접 열 수 없다. `import * as PortOne from "@portone/browser-sdk/v2"` |
| 결제 조회 | 직접 `fetch` + zod | 엔드포인트 하나에 쓰는 필드 넷. 코드베이스가 이미 zod로 외부 경계를 검증한다(`saju/_lib`). 응답 스키마를 우리가 소유하면 포트원이 필드를 늘려도 흔들리지 않는다 |
| 웹훅 서명 검증 | `@portone/server-sdk` | HMAC 서명 검증은 손으로 짜지 않는다 — 틀리면 위조된 결제 완료를 받는다. Node 20+ 필요 |

`@portone/server-sdk`는 `Webhook.verify`만 쓴다. 결제 조회까지 SDK로 넘기지 않는 이유는 위 표의 두 번째 줄과 같다.

## 7. 서버 구조

```
src/lib/payments/
  config.ts     env 읽기, 수단↔채널 매핑, 사용 가능 수단 판정
  portone.ts    포트원 REST 클라이언트 (fetch + zod)
  order-id.ts   paymentId 발급
  store.ts      purchases 행 CRUD
  confirm.ts    ★ 확정 로직 — 완료 API·웹훅이 공유
src/app/api/payments/orders/{route.ts,_lib/handler.ts}
src/app/api/payments/complete/{route.ts,_lib/handler.ts}
src/app/api/payments/webhook/route.ts
```

`route.ts`는 얇은 껍데기, `_lib/handler.ts`가 주입식 순수 로직 — `src/app/api/profiles`와 같은 결이다.

### 7.1 `config.ts`

```ts
export interface PaymentChannel {
  channelKey: string;
  /** 포트원 requestPayment 의 payMethod */
  payMethod: "CARD" | "EASY_PAY";
}

/** 설정된 수단만 돌려준다. 키 없는 수단은 목록에서 빠진다. */
export function availableMethods(env?: NodeJS.ProcessEnv): PaymentMethodId[];
export function getChannel(id: PaymentMethodId, env?): PaymentChannel | null;
export function getStoreId(env?): string | null;
```

수단↔채널 매핑:

| `PaymentMethodId` | env | `payMethod` |
| --- | --- | --- |
| `card` | `PORTONE_CHANNEL_KEY_CARD` | `CARD` |
| `naver` | `PORTONE_CHANNEL_KEY_NAVERPAY` | `EASY_PAY` |
| `kakao` | `PORTONE_CHANNEL_KEY_KAKAOPAY` | `EASY_PAY` |

간편결제는 `easyPayProvider`를 따로 넘기지 않는다 — 채널키가 이미 어느 PG인지 결정한다. **연동 시 확인이 필요한 가정이고**, 콘솔에서 실제 채널을 만든 뒤 결제창이 열리지 않으면 `easyPay: { easyPayProvider }`를 추가한다.

`env`를 인자로 받는 이유: 테스트가 `process.env`를 건드리지 않고 조합을 검사할 수 있다. 기본값은 `process.env`.

### 7.2 `portone.ts`

```ts
const PaymentSchema = z.object({
  id: z.string(),
  status: z.enum(["READY","PENDING","VIRTUAL_ACCOUNT_ISSUED","PAID",
                  "PARTIALLY_CANCELLED","CANCELLED","FAILED"]),
  amount: z.object({ total: z.number(), paid: z.number().optional() }),
  currency: z.string(),
  transactionId: z.string().nullish(),
});

/** GET https://api.portone.io/payments/{paymentId} */
export async function getPayment(paymentId: string): Promise<PortOnePayment>;
```

- 헤더: `Authorization: PortOne ${PORTONE_API_SECRET}`
- `paymentId`는 `encodeURIComponent`로 감싼다
- 비 2xx는 포트원 에러 형태(`{ type, message }`)를 읽어 `PortOneError`로 던진다
- `status`에 모르는 값이 오면 zod가 던진다 — **모르는 상태를 결제 완료로 오해하는 것보다 실패가 낫다**

### 7.3 `confirm.ts` — 확정 로직

완료 API와 웹훅이 공유하는 유일한 확정 경로.

```ts
export interface PendingOrder {
  paymentId: string;
  userId: string;
  profileId: string;
  /** 주문 생성 시점에 서버가 박아 둔 청구 금액. 대조의 기준이다. */
  amount: number;
  status: "pending" | "paid" | "refunded" | "failed";
}

export type ConfirmResult =
  | { ok: true; kind: "confirmed" | "already"; profileId: string }
  | { ok: false; kind: "not_found" | "not_paid" | "amount_mismatch" | "currency_mismatch" };

export interface ConfirmDeps {
  findOrder(paymentId: string): Promise<PendingOrder | null>;
  lookupPayment(paymentId: string): Promise<PortOnePayment>;
  /** UPDATE … WHERE payment_id=$1 AND status='pending'. 갱신된 행이 있으면 true */
  markPaid(a: { paymentId: string; transactionId: string | null }): Promise<boolean>;
  markFailed(paymentId: string): Promise<void>;
}

export async function confirmPayment(paymentId: string, d: ConfirmDeps): Promise<ConfirmResult>;
```

판정 순서:

| 조건 | 결과 | 행 처리 |
| --- | --- | --- |
| 행이 없다 | `not_found` | — |
| 행이 이미 `paid` | `already` | — (포트원 조회를 생략한다) |
| `status`가 **종결**(`FAILED`/`CANCELLED`/`PARTIALLY_CANCELLED`) | `not_paid` | `failed` |
| `status`가 **대기**(`READY`/`PENDING`/`VIRTUAL_ACCOUNT_ISSUED`) | `not_paid` | 그대로 (웹훅이 뒤이어 확정할 수 있다) |
| `currency !== 'KRW'` | `currency_mismatch` | `failed` |
| `amount.total !== 행의 amount` | `amount_mismatch` | `failed` |
| 전부 통과, `markPaid`가 행을 뒤집음 | `confirmed` | `paid` |
| 전부 통과, `markPaid`가 `false` + 다시 읽은 행이 `paid` | `already` | — |
| 전부 통과, `markPaid`가 `false` + 그 외 | `not_paid` | — |

**상태 분류는 `switch` + `never` 로 닫는다.** 포트원이 status를 하나 추가하면 컴파일이 깨진다 — 모르는 상태가 조용히 "아직 결제 전"으로 흘러가 행을 영원히 `pending`으로 남기는 것보다, 빌드가 멈춰 사람이 판단하는 편이 낫다. `PARTIALLY_CANCELLED`를 종결로 넣은 이유가 그 실패의 실례다: 돈이 잡혔다가 일부 돌아간 상태인데, 대기로 분류하면 웹훅이 몇 번을 와도 같은 판정만 되풀이하고 행은 끝내 확정되지 않는다.

마지막 세 줄이 갈리는 이유: `markPaid`는 `WHERE status='pending'`이라 `false`가 **"paid였다"가 아니라 "pending이 아니었다"만 증명한다.** `refunded`·`failed` 행도 `false`를 낸다. 그래서 `false`일 때 행을 한 번 더 읽어, `paid`일 때만 `already`(=리포트를 연다)로 돌려준다. **이 갈래가 두 경로 동시 도착을 멱등하게 만들면서, 환불된 주문이 리포트를 여는 길은 막는다.**

`amount_mismatch`는 돈은 받았는데 금액이 다른 상태다. 행을 `failed`로 내리고 `console.error`로 남기지만 **자동 취소는 하지 않는다** — 취소 API 연동은 이 작업 범위 밖이다. `docs/issues/backlog.md`에 "금액 불일치 결제 자동 취소"를 기록한다.

### 7.4 라우트

| 라우트 | 상황 | 응답 |
| --- | --- | --- |
| `POST /api/payments/orders` | 본문이 JSON이 아니거나 스키마 불일치 | 400 |
| | 비로그인 | 401 |
| | 없는/남의 프로필 | 404 |
| | 이미 결제됨 | 409 |
| | 채널키 미설정 | 503 |
| | 성공 | 200 + 주문 |
| `POST /api/payments/complete` | `paymentId` 없음 | 400 |
| | 비로그인 | 401 |
| | 주문이 없거나 **남의 주문** | 404 |
| | `not_paid` / `*_mismatch` | 402 + `kind` |
| | `confirmed` / `already` | 200 `{ profileId }` |
| `POST /api/payments/webhook` | 서명 검증 실패 | 400 |
| | `type !== "Transaction.Paid"` | 200 (무시) |
| | `not_found` / `*_mismatch` | 200 — 재시도해도 결과가 같다 |
| | 조회 실패·예외 | 500 — 포트원의 재시도를 유도한다 |
| | 확정 | 200 |

소유 확인은 `confirmPayment`가 아니라 **완료 API 핸들러**가 한다. 웹훅에는 세션이 없어서 확정 함수가 소유를 알 필요도, 알 수도 없다. 핸들러가 먼저 `findOrder`로 행을 읽어 `userId`를 세션과 비교하고(불일치·부재 모두 404 — 구분하면 `paymentId`로 존재 여부를 훑을 수 있다), 통과한 뒤에 `confirmPayment`를 부른다. `confirmPayment` 안에서 같은 행을 한 번 더 읽는 것은 의도한 것이다 — 확정 함수가 호출자의 사전 조회에 기대지 않아야 웹훅에서도 그대로 쓸 수 있다.

웹훅 라우트는 `await request.text()`로 **원문 본문**을 읽는다. `Webhook.verify`는 파싱된 JSON이 아니라 원문 문자열에 서명을 맞춘다 — `request.json()`을 먼저 부르면 검증이 반드시 실패한다.

### 7.5 `order-id.ts`

```ts
/** 예: saju-3f0c1a9e-…  콘솔에서 우리 주문임을 알아보게 접두사를 붙인다. */
export function newPaymentId(): string {
  return `saju-${crypto.randomUUID()}`;
}
```

`orderName`은 `"사주 전체 리포트"` 고정. 프로필 이름을 넣지 않는다 — 카드 명세서와 포트원 콘솔에 타인의 이름이 남을 이유가 없다.

## 8. 클라이언트 변경

| 파일 | 변경 |
| --- | --- |
| `checkout/page.tsx` | `availableMethods()`를 계산해 `CheckoutView`에 내려준다 |
| `checkout/_lib/methods.ts` | `PAYMENT_METHODS`를 `availableMethods()` 결과로 거르는 헬퍼 추가. 타입은 그대로 |
| `checkout/_hooks/use-payment.ts` (신규) | 주문 생성 → `requestPayment` → 완료 API → 이동. `status: "idle" \| "pending" \| "error"` |
| `checkout/_components/CheckoutView.tsx` | 훅을 소유하고 `onPay`·`status`·에러 문구를 두 버튼에 내려준다. 수단 0개면 안내 카드 |
| `checkout/_components/PayButton.tsx` | `onClick`·`disabled`(결제 중)·라벨 전환("결제 중…") |
| `checkout/complete/page.tsx` (신규) | 모바일 리다이렉트 착지점 |

`use-payment.ts` 골자:

```ts
const order = await postJson("/api/payments/orders", { profileId, method });
const res = await PortOne.requestPayment({
  storeId: order.storeId,
  channelKey: order.channelKey,
  paymentId: order.paymentId,
  orderName: order.orderName,
  totalAmount: order.totalAmount,
  currency: "CURRENCY_KRW",
  payMethod: order.payMethod,
  redirectUrl: order.redirectUrl,
});
// 모바일은 여기까지 오지 않는다 — 이미 페이지를 떠났다.
if (res?.code != null) throw new PaymentError(res.message);
await postJson("/api/payments/complete", { paymentId: order.paymentId });
router.replace(`/report?profile=${profileId}`);
```

`res?.code != null`이 실패 판정이다. 사용자가 결제창을 닫아도 여기로 온다.

### `/checkout/complete`

포트원이 `?paymentId=…&code=…&message=…`를 붙여 돌려보낸다. 서버 컴포넌트로 만들고 `code`가 있으면 `/checkout?profile=…&error=…`로 되돌린다. 없으면 완료 API를 호출한 뒤 `/report`로 `redirect()`한다. 화면은 "결제를 확인하고 있습니다" 한 줄이면 충분하다 — 서버에서 확정하고 리다이렉트하므로 사용자가 오래 볼 화면이 아니다.

`redirectUrl`은 `APP_ORIGIN`으로 조립한다. 이미 소셜 로그인이 같은 값을 쓰고 있다.

## 9. 테스트

| 파일 | 검사 |
| --- | --- |
| `payments/confirm.test.ts` | 판정 표 7줄 전부. 특히 `markPaid → false`가 `already`가 되는지, 금액 불일치가 `failed`로 내려가는지 |
| `payments/config.test.ts` | env 조합별 `availableMethods` (0개/일부/전부), 수단↔`payMethod` 매핑 |
| `payments/portone.test.ts` | zod 파싱, 모르는 `status`에서 던지는지, 비 2xx 에러 변환, `Authorization` 헤더 형태 |
| `payments/order-id.test.ts` | 접두사와 유일성 |
| `api/payments/orders/_lib/handler.test.ts` | 401·404·409·503, 성공 시 삽입 인자의 금액이 `FULL_REPORT_PRICE.total`인지 |
| `api/payments/complete/_lib/handler.test.ts` | 남의 주문 404, `kind`별 상태코드 |

`fetch`와 DB는 기존 테스트들처럼 주입한다(`src/lib/profiles/store.test.ts`의 `fakeClient` 결). 실제 포트원 호출은 하지 않는다.

## 10. 작업 순서

1. 마이그레이션 `0010` + `store.ts` (행 CRUD)
2. `config.ts` / `order-id.ts` / `portone.ts`
3. `confirm.ts` — 여기까지가 결제의 심장이고 테스트도 여기 몰린다
4. 라우트 3종
5. 클라이언트(훅·버튼·`/checkout/complete`)
6. `.env.example`, `docs/issues/payment.md` 상태 갱신, 백로그 1건 추가

## 11. 연동 시 확인할 가정

키를 채운 뒤 첫 실결제에서 확인해야 하는 것들. 코드는 다 있지만 문서만으로는 확정할 수 없었다.

- 간편결제 채널에 `easyPayProvider` 없이 `payMethod: "EASY_PAY"`만으로 결제창이 열리는가 (§7.1)
- `paymentId` 길이 제한에 `saju-{uuid}`(41자)가 걸리지 않는가
- 웹훅 헤더 이름 (`webhook-*` / `svix-*`) — `Webhook.verify`가 흡수하지만 실패 시 로그로 확인
- 모바일 리다이렉트 쿼리 파라미터 이름 (`code`/`message`)
