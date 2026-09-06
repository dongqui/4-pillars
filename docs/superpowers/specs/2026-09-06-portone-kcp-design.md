# 포트원 v2 + NHN KCP 결제 전환 설계 문서

**날짜:** 2026-09-06
**선행 작업:** `2026-08-11-portone-payment-design.md`(포트원 최초 연동), `2026-08-12-inicis-easypay-design.md`(이니시스 단일 채널 + 허브형 간편결제). 두 설계는 2026-08-20 커밋 `11483ff` 에서 토스페이먼츠 직결로 대체됐다. 이 문서는 그 구조를 되살리되 채널을 KG이니시스에서 NHN KCP 로 바꾼다.

## 1. 목표

토스페이먼츠 심사가 길어져 결제를 열 수 없다. 포트원 v2 를 다시 붙이고 NHN KCP 채널 하나로 카드·네이버페이·카카오페이·토스페이를 연다. 토스 코드는 걷어낸다 — PG 는 하나만 둔다. 토스 코드는 git 이력(`11483ff` 이후)에 있어 심사가 통과하면 되살릴 수 있다.

## 2. 범위 결정 (확정됨)

| 항목 | 결정 |
| --- | --- |
| PG | **포트원 v2 + NHN KCP 채널 하나.** 토스 직결 코드는 삭제 |
| 수단 | **4개 그대로.** 카드 / 네이버페이 / 카카오페이 / 토스페이 |
| 간편결제 호출 | **허브형 UI 직접 호출.** `payMethod: "EASY_PAY"` + `easyPay.easyPayProvider`. KCP 는 KAKAOPAY·NAVERPAY·TOSSPAY 셋 다 허브형으로 지원한다(SDK `EasyPayProvider.d.ts` 와 KCP v2 연동 문서) |
| 수단 on/off | **`PORTONE_METHODS` 목록 env.** 이니시스 설계와 같다 |
| 확정 경로 | **완료 API(PC) · 모바일 착지 라우트 · 웹훅** 셋이 `confirmPayment` 하나를 공유. 판단은 포트원 조회 API 결과로만. 웹훅이 유일한 복구 경로라 `PORTONE_WEBHOOK_SECRET` 없이는 결제창 자체를 열지 않는다(§6.1) |
| 완료 화면 | **`/checkout/done` 유지.** 세 경로 모두 확정 뒤 여기로 모인다 |
| 복귀 경로 | **`checkout_next` 쿠키 유지.** 토스 때문에 생겼지만 이미 있고 테스트돼 있다. 포트원 redirectUrl 에 쿼리를 실을 수 있지만 바꿀 이유가 없다 |
| 구매자 정보 | **이름 + 이메일만.** 휴대폰은 보내지 않는다 (§8) |
| 주문 ID | **`saju` + uuid 32자(하이픈 제거) = 36자.** KCP 제약 때문 (§7) |
| 스키마 | **변경 없음.** `purchases.provider` 값만 `'portone'` 으로 |

### 비범위 (YAGNI)

- 취소·환불 API. 포트원 콘솔에서 수동. `docs/issues/payment.md` 의 수동 절차가 다시 유효해진다.
- PG 전환 스위치(토스/포트원 동시 유지). 승인 주체가 다른 두 흐름을 같이 들고 갈 이유가 없다.
- 페이코·삼성페이·애플페이 등 KCP 가 지원하는 나머지 간편결제. `PAYMENT_METHOD_IDS` 한 줄이면 된다.
- 결제수단을 `purchases` 에 기록하기.
- 휴대폰 번호 수집 UI. KCP 가 실제로 요구할 때만 별건으로 연다.

## 3. 흐름

```
[브라우저 /checkout]
  POST /api/payments/orders {packageId, method, next}
    → pending 행 생성, checkout_next 쿠키 심기
    ← {storeId, channelKey, paymentId, orderName, totalAmount, currency,
       redirectUrl, customer:{fullName,email}, payMethod(+easyPayProvider)}
  PortOne.requestPayment(...)          # 결제창이 승인까지 끝낸다

  [PC] SDK 가 제자리에서 돌아온다
    res.code 있음 → 실패 배너
    없음 → POST /api/payments/complete {paymentId}
             → 소유 확인 → confirmPayment(조회) → 200
           router.replace(/checkout/done?orderId&next)

  [모바일] 결제창이 redirectUrl 로 페이지를 옮긴다
    GET /checkout/complete?paymentId=…  (실패는 ?code=…)
      → 쿠키에서 next → 세션·소유 확인 → confirmPayment(조회)
      → /checkout/done?orderId&next  (실패는 /checkout?next&error=1)

[포트원 웹훅] POST /api/payments/webhook
  → 서명 검증(@portone/server-sdk) → type === "Transaction.Paid"
  → confirmPayment(조회)
```

토스와 가장 다른 점: **승인을 우리가 부르지 않는다.** 포트원 결제창이 승인까지 끝내므로 서버는 조회만 한다. `approveDeps`/`lookupDeps` 두 갈래는 `confirmDeps` 하나로 접힌다.

## 4. 환경 변수 — 전부 서버 전용

```
# --- 결제 (포트원 v2 + NHN KCP) ---
PORTONE_STORE_ID=                 # 포트원 콘솔 > 상점 ID. 결제창 호출에 쓴다
PORTONE_API_SECRET=               # 콘솔 > API 키. 결제 조회에 쓴다. 브라우저로 절대 내보내지 않는다
PORTONE_WEBHOOK_SECRET=           # 콘솔 > 웹훅 > 시크릿. 없으면 웹훅이 503 으로 닫힌다
PORTONE_CHANNEL_KEY_KCP=          # NHN KCP 채널 하나. 카드·간편결제가 전부 이 키로 열린다
PORTONE_METHODS=                  # 지금 열 수단: card,naver,kakao,toss 중 콤마로 나열. 비우면 결제 화면이 잠긴다
```

`TOSS_CLIENT_KEY`·`TOSS_SECRET_KEY`·`TOSS_METHODS` 는 없어진다. `.env.example` 의 토스 블록(위젯 키 경고 포함)을 통째로 바꾼다. `.env.production.local` 에는 옛 `PORTONE_*` 이름이 남아 있는데 `PORTONE_CHANNEL_KEY_INICIS` 만 `_KCP` 로 바꿔 채우면 된다.

storeId·channelKey 를 `NEXT_PUBLIC_` 으로 두지 않는 이유는 이전 설계와 같다: 서버가 "이 수단은 쓸 수 없다"를 판단하고, 주문 생성 응답이 값을 실어 보낸다.

## 5. 의존성

- 제거: `@tosspayments/tosspayments-sdk`
- 추가: `@portone/browser-sdk@^0.1.9`, `@portone/server-sdk@^0.19.0` (웹훅 서명 검증 전용). 2026-09-06 기준 둘 다 최신이며 8월에 쓰던 버전과 같다.

## 6. 서버 구조

### 6.1 `src/lib/payments/config.ts`

`11483ff^` 판을 되살리고 채널 함수 이름·env 이름만 KCP 로.

```ts
export const PAYMENT_METHOD_IDS = ["card", "naver", "kakao", "toss"] as const;
export type EasyPayProvider = "NAVERPAY" | "KAKAOPAY" | "TOSSPAY";
export type PaymentRequestKind =
  | { payMethod: "CARD" }
  | { payMethod: "EASY_PAY"; easyPayProvider: EasyPayProvider };
export type PaymentChannel = { channelKey: string } & PaymentRequestKind;

getStoreId / getApiSecret / getWebhookSecret / getAppOrigin
getChannelKey   → PORTONE_CHANNEL_KEY_KCP
enabledMethods  → PORTONE_METHODS 를 정규 목록으로 거른다
getChannel(id)  → 채널키 없거나 꺼진 수단이면 null
availableMethods → storeId·apiSecret·channelKey·webhookSecret 넷 다 있어야 enabledMethods
```

### 6.2 `src/lib/payments/portone.ts` (신규, `toss.ts` 삭제)

`GET https://api.portone.io/payments/{paymentId}`, `Authorization: PortOne <secret>`. 응답을 zod 로 좁힌다: `id`, `status`(READY/PAY_PENDING/VIRTUAL_ACCOUNT_ISSUED/PAID/PARTIAL_CANCELLED/CANCELLED/FAILED), `amount.total`, `currency`, `transactionId?`. 시크릿 없으면 `PortOneNotConfiguredError`, 비 2xx 는 `PortOneError(type)`. `fetchImpl`·`env` 주입. 이름은 `@portone/server-sdk` 의 `Payment["status"]` 판별자와 타입으로 맞물려 있다(§6.1 `_statusesMatchSdk`) — 어긋나면 typecheck 가 깨진다.

### 6.3 `src/lib/payments/confirm.ts`

```ts
export interface ConfirmDeps {
  findOrder(paymentId): Promise<PendingOrder | null>;
  lookupPayment(paymentId): Promise<PortOnePayment>;   // 조회만. 상태를 바꾸지 않는다
  markPaid(a: { paymentId; transactionId: string | null }): Promise<boolean>;
  markFailed(paymentId): Promise<void>;
}
```

상태 분류(switch + never 유지):
- `PAID` → paid
- `CANCELLED` · `FAILED` · `PARTIAL_CANCELLED` → dead (행을 failed 로)
- `READY` · `PAY_PENDING` · `VIRTUAL_ACCOUNT_ISSUED` → waiting (행을 건드리지 않는다)

금액 대조는 `payment.amount.total !== order.amount`, 통화는 `"KRW"`. `transactionId` 를 `markPaid` 에 넘긴다. 나머지(이미 paid 면 조기 반환, markPaid false 뒤 재조회)는 지금 그대로.

### 6.4 `src/lib/payments/deps.ts`

`confirmDeps` 하나. `lookupPayment: (id) => getPayment(id)`. `approveDeps`/`lookupDeps` 삭제.

### 6.5 `src/lib/payments/order-id.ts`

```ts
export const PAYMENT_ID_PREFIX = "saju";
export function newPaymentId(): string {
  return PAYMENT_ID_PREFIX + crypto.randomUUID().replaceAll("-", "");
}
```

§7 참조. 테스트는 "영문·숫자만 36자" 를 검사한다.

### 6.6 `src/lib/payments/order.ts`

```ts
export interface OrderBase {
  storeId: string;
  channelKey: string;
  paymentId: string;
  orderName: string;
  totalAmount: number;
  currency: "CURRENCY_KRW";
  redirectUrl: string;              // <APP_ORIGIN>/checkout/complete
  customer: { fullName: string; email: string };
}
export type OrderResponse = OrderBase & PaymentRequestKind;
```

`CHECKOUT_NEXT_COOKIE`·`CHECKOUT_NEXT_MAX_AGE` 는 그대로.

### 6.7 `src/lib/payments/store.ts`

`createPendingPurchase` 의 provider 를 `'portone'` 으로. 주석의 "토스" 표현을 포트원으로. 그 외 변경 없음.

### 6.8 라우트

| 경로 | 변경 |
| --- | --- |
| `POST /api/payments/orders` | deps 가 `getStoreId`·`getChannel`·`getAppOrigin`·`getBuyer`·`createPending`. 셋 중 하나라도 없으면 503. 이메일 없으면 409(지금 그대로). 응답은 §6.6 |
| `POST /api/payments/complete` | **복원.** `{paymentId}` → 401/400 → 소유 확인(없는 주문과 남의 주문을 구분하지 않음, 404) → `confirmPayment` → 200 `{ok:true}` / 실패 kind 별 402·404. `PortOneNotConfiguredError` 는 503 |
| `GET /checkout/complete` | 라우트 핸들러 유지. 쿼리를 `?paymentId`(진행) / `?code`(실패)로 바꾸고, 금액 대조 블록과 `approveDeps` 호출을 없앤다. `confirmPayment(paymentId, confirmDeps)` → `/checkout/done?orderId&next` |
| `POST /api/payments/webhook` | **서명 검증 복원.** 시크릿 없으면 503. `request.text()` 원문 + 헤더를 `PortOne.Webhook.verify` 에. 본문 `{type, data:{paymentId}}`, `Transaction.Paid` 만 확정. 상태코드 규칙(200/400/500)은 지금과 같다 |

완료 API 응답에서 잔액을 뺀 이유: 이제 완료 화면(`/checkout/done`)이 DB 에서 직접 읽는다. 응답에 실으면 읽는 곳이 둘이 된다.

## 7. KCP 제약이 주는 변경

포트원 KCP v2 문서: "paymentId 파라미터 내 한글, 특수문자 미지원", "KCP 의 경우 최대 40자까지 허용", "orderName 최대 100바이트".

- 지금 `saju-<uuid>` 는 41자이고 하이픈이 들어간다 → §6.5 로 바꾼다. 기존 DB 행의 옛 형식은 그대로 둔다(조회는 문자열 일치라 형식이 섞여도 문제없다).
- `packageOrderName` 결과가 100바이트를 넘지 않는지 테스트로 못박는다(한글 3바이트 기준).

## 8. 구매자 정보

`customer: { fullName, email }` 만 보낸다. 이니시스는 문서상 선택이던 휴대폰을 실제로 요구해 PG 를 바꾼 전력이 있다. KCP 문서(v2 연동 가이드, SDK 파라미터)는 `phoneNumber?` 를 선택으로 표기하고 상품권·휴대폰 결제에만 `shop_user_id` 를 필수로 둔다 — 우리는 둘 다 쓰지 않는다.

그래도 구현 뒤 **KCP 테스트 채널로 카드 결제창과 간편결제 창을 실제로 한 번씩 띄워** 확인한다(§10). 여기서 휴대폰을 요구하면 이 작업은 "결제창이 열리지 않는다" 를 결과로 남기고, 휴대폰 입력 UI 는 별건으로 연다.

## 9. 화면·문서

- `src/app/checkout/_hooks/use-payment.ts`: `@portone/browser-sdk/v2` 의 `requestPayment`. `payMethod` 로 좁혀 `easyPay.easyPayProvider` 를 붙인다. PC 는 완료 API 뒤 `router.replace('/checkout/done?…')`.
- `OrderSummary.tsx`: "PortOne 보안 결제 · NHN KCP".
- `_lib/methods.ts`: 카드 desc "NHN KCP 국내 카드결제" 는 넣지 않는다 — "국내 카드결제" 그대로. PG 이름은 요약 한 곳에만.
- `(legal)/privacy`, `(legal)/terms`: 결제대행사 표기를 "PortOne 및 연동 결제대행사(NHN KCP 등)" 로.
- `.env.example`, `docs/issues/payment.md`(포트원 기준 수동 환불·리컨실 절차가 다시 맞다, 날짜와 채널 이름만 갱신).

## 10. 테스트

vitest:
- `config.test.ts`: `11483ff^` 판을 되살려 env 이름만 KCP 로. availableMethods 가 셋 다 요구함, enabledMethods 필터·순서·중복.
- `portone.test.ts`: 복원. 헤더 형식, URL 인코딩, 스키마 좁힘, 모르는 status 는 던짐, 시크릿 없으면 네트워크 전에 던짐.
- `confirm.test.ts`: 포트원 status 7종 분류, `amount.total` 대조, transactionId 전달.
- `order-id.test.ts`: 접두사, 36자, `/^[a-z0-9]+$/`.
- `pricing.test.ts`: orderName ≤ 100바이트.
- `orders/_lib/handler.test.ts`: 응답 모양(§6.6), 503 조건, 409 이메일, cookie next.
- `complete/_lib/handler.test.ts`: 복원(잔액 대신 `{ok:true}`).
- `webhook/_lib/handler.test.ts`: `11483ff^` 판 복원 — 검증이 파싱보다 먼저, Transaction.Paid 외 200, 상태코드.

수동(테스트 채널, `.env.local`):
1. `/checkout` 에서 카드 → KCP 결제창이 뜨고 구매자 정보 오류 없이 인증까지 진행되는지.
2. 카카오페이 → 카카오페이 창이 직접 열리는지(수단 선택 화면이 아니라).
3. 결제창 닫기 → 배너에 실패 문구.
4. 웹훅: 포트원 콘솔 테스트 발송으로 서명 검증이 통과하는지.

## 11. 작업 순서

1. 의존성 교체, `.env.example`.
2. `config.ts` + 테스트.
3. `order-id.ts` + 테스트, `pricing.test.ts` 바이트 검사.
4. `portone.ts` + 테스트, `toss.ts` 삭제.
5. `confirm.ts`·`deps.ts` + 테스트.
6. `order.ts`, 주문 생성 핸들러·라우트 + 테스트.
7. 완료 API 복원 + 테스트.
8. `/checkout/complete` 라우트, 웹훅 핸들러·라우트 + 테스트.
9. `use-payment.ts`, 화면 문구, 법적 페이지, `store.ts` provider.
10. `docs/issues/payment.md`, typecheck·lint·전체 테스트.
11. 테스트 채널 수동 확인(§10).
