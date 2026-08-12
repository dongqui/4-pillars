# KG이니시스 단일 채널 + 간편결제 UI 직접 호출 설계 문서

**날짜:** 2026-08-12
**선행 작업:** `2026-08-11-portone-payment-design.md` — 결제 연동은 이미 붙었고, 여기서는 수단↔채널 구조만 바꾼다.

## 1. 목표

카드·네이버페이·카카오페이·토스페이를 **KG이니시스 채널 하나**로 처리한다. 간편결제사마다 채널을 따로 파지 않고, 포트원의 간편결제 UI 직접 호출(`payMethod: "EASY_PAY"` + `easyPay.easyPayProvider`)을 쓴다.

선행 설계는 "수단별 채널키 3개"를 전제했다(`2026-08-11-portone-payment-design.md` §2). 그 전제가 여기서 뒤집힌다.

## 2. 범위 결정 (확정됨)

| 항목 | 결정 |
| --- | --- |
| 채널 | **KG이니시스 하나.** env `PORTONE_CHANNEL_KEY_INICIS` |
| 수단 | **4개.** 카드 / 네이버페이 / 카카오페이 / 토스페이 — 토스페이 신규 추가 |
| 간편결제 호출 | **UI 직접 호출.** `payMethod: "EASY_PAY"` + `easyPay.easyPayProvider` |
| 수단 on/off | **`PORTONE_METHODS` 목록 env.** 제휴 계약이 순차적으로 열리는 상황을 배포 없이 반영한다 |
| 스키마 | **변경 없음.** `purchases`에 결제수단 컬럼이 없다 |

### 비범위 (YAGNI)

- 페이코·L페이 등 이니시스가 지원하는 나머지 간편결제. 필요해지면 `PAYMENT_METHOD_IDS`에 한 줄 더한다.
- 수단별 PG 분산(예: 네이버페이만 직계약). 지금 요구가 정반대다.
- 결제수단을 `purchases`에 기록하기. 쓰는 곳이 없다.
- 계약 상태를 코드가 자동 판별하는 장치. 사람이 `PORTONE_METHODS`를 고친다.

## 3. 근거

`@portone/browser-sdk` 0.1.9의 `EasyPayProvider`(`dist/v2/entity/EasyPayProvider.d.ts`)가 `NAVERPAY`·`KAKAOPAY`·`TOSSPAY` 모두에 KG이니시스를 지원 PG로 명시한다. 요청 타입은 `PaymentRequestUnion`(`dist/v2/request/PaymentRequestUnion.d.ts:32`)에서 `payMethod`로 갈라지며, `EASY_PAY`일 때 `easyPay?: PaymentRequestUnionEasyPay`를 받는다.

제휴 계약은 아직 전이다. 그래서 "채널키가 있으면 그 수단을 켠다"는 지금 판정은 쓸 수 없다 — 채널키 하나가 네 수단을 동시에 켜 버린다. 채널과 수단을 별개의 축으로 나눈다.

## 4. 설정 계층

### 4.1 env

```
PORTONE_CHANNEL_KEY_INICIS=       # KG이니시스 채널 하나. 카드·간편결제가 전부 이걸 쓴다
PORTONE_METHODS=                  # 지금 열 수단: card,naver,kakao,toss 중 콤마로 나열
```

기존 `PORTONE_CHANNEL_KEY_CARD` / `_NAVERPAY` / `_KAKAOPAY` 세 개는 없어진다. 값이 채워진 적이 없어 마이그레이션 부담이 없다.

`PORTONE_STORE_ID`·`PORTONE_API_SECRET`·`PORTONE_WEBHOOK_SECRET`·`APP_ORIGIN`은 그대로다.

`.env.example`, `.env.local`(테스트), `.env.production.local`(실 결제) 세 파일의 결제 블록을 같이 고친다.

### 4.2 `src/lib/payments/config.ts`

수단→채널키 매핑(`CHANNELS`)이 수단→요청 형태 매핑으로 바뀐다.

```ts
export const PAYMENT_METHOD_IDS = ["card", "naver", "kakao", "toss"] as const;
export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

export type EasyPayProvider = "NAVERPAY" | "KAKAOPAY" | "TOSSPAY";

/** 수단이 결정하는 것은 요청의 판별자뿐이다. 채널키는 여기 없다. */
export type PaymentRequestKind =
  | { payMethod: "CARD" }
  | { payMethod: "EASY_PAY"; easyPayProvider: EasyPayProvider };

const REQUESTS: Record<PaymentMethodId, PaymentRequestKind> = {
  card:  { payMethod: "CARD" },
  naver: { payMethod: "EASY_PAY", easyPayProvider: "NAVERPAY" },
  kakao: { payMethod: "EASY_PAY", easyPayProvider: "KAKAOPAY" },
  toss:  { payMethod: "EASY_PAY", easyPayProvider: "TOSSPAY" },
};

export type PaymentChannel = { channelKey: string } & PaymentRequestKind;
```

`Record<PaymentMethodId, …>`인 이유는 지금과 같다 — 수단을 배열에 추가하고 매핑을 빠뜨리면 컴파일이 막힌다. 값 쪽을 유니온으로 둬서 `EASY_PAY`에 provider를 빠뜨린 항목도 함께 막힌다.

`OrderResponse`(§5.1)는 `PaymentRequestKind`를 그대로 재사용한다. 서버가 고른 조합과 브라우저가 보내는 조합이 같은 타입이라 어긋날 수 없다.

기존 `PortOnePayMethod` 타입은 `PaymentRequestKind`에 흡수되어 사라진다. 이 타입을 import 하던 `order.ts`도 같이 정리한다.

**공개 함수**

| 함수 | 반환 | 설명 |
| --- | --- | --- |
| `getChannelKey(env?)` | `string \| null` | `PORTONE_CHANNEL_KEY_INICIS` |
| `enabledMethods(env?)` | `PaymentMethodId[]` | `PORTONE_METHODS` 파싱 결과 |
| `getChannel(id, env?)` | `PaymentChannel \| null` | 채널키가 없거나 수단이 꺼져 있으면 `null` |
| `availableMethods(env?)` | `PaymentMethodId[]` | 화면에 낼 수단 |
| `getStoreId` / `getApiSecret` / `getWebhookSecret` / `getAppOrigin` | 변경 없음 | |

`getChannel`이 활성 여부까지 보는 이유: 이 함수가 주문 생성의 관문(`handler.ts:59`)이다. 꺼진 수단을 화면에서만 숨기고 여기서 통과시키면, API를 직접 두드려 꺼진 수단으로 결제창을 열 수 있다.

**`PORTONE_METHODS` 파싱 규칙**

1. 콤마로 자르고 각 조각을 `trim` + 소문자화해 집합으로 만든다.
2. 정규 목록 `PAYMENT_METHOD_IDS`를 그 집합으로 거른다 — env 문자열을 `PaymentMethodId`로 캐스팅하지 않고, 아는 수단 쪽에서 걸러 낸다. `kakaopay` 같은 오타는 어느 id 와도 만나지 못해 그대로 사라진다. 예외를 던지지 않는 이유: env 오타 하나로 `/checkout`이 500이 되는 대신, 그 수단만 빠지고 화면은 정직하게 잠긴다.
3. 같은 방식으로 중복이 접히고, 결과 순서는 항상 `PAYMENT_METHOD_IDS` 순서다 — 화면 순서가 env 작성 순서에 흔들리면 안 된다.
4. **미설정·빈 문자열·전부 걸러진 경우는 빈 배열이다.** 전부 켜지 않는다. 계약 전이고, env를 빠뜨렸을 때 결제창이 열리는 것보다 잠기는 쪽이 안전하다. 빈 문자열을 미설정으로 접는 기존 `read()`의 판단과 같은 방향이다.

**`availableMethods` 판정 순서**

```
storeId 없음 → []          상점 없이는 결제창이 열리지 않는다
apiSecret 없음 → []        확정 못 할 결제를 열 수는 없다 (선행 설계 §7)
channelKey 없음 → []       채널 없이는 어느 수단도 못 연다
그 외 → enabledMethods(env)
```

앞 세 줄은 지금 로직 그대로이고, 마지막 줄만 "채널키가 있는 수단"에서 "켜진 수단"으로 바뀐다.

**교체할 주석.** `config.ts:62-66`의 "간편결제에 easyPayProvider를 따로 넘기지 않는다 — 채널키가 이미 어느 PG인지 결정한다"는 이 설계에서 거짓이 된다. 채널을 합치면 채널키가 수단을 결정하지 못한다. 새 판단으로 교체한다.

## 5. 주문 생성 → 결제창

### 5.1 `src/lib/payments/order.ts`

`payMethod`와 `easyPayProvider`를 각각 선택 필드로 두면 "`EASY_PAY`인데 provider가 없는" 조합이 타입상 가능해진다. 판별 유니온으로 막는다.

```ts
interface OrderBase {
  paymentId: string;
  storeId: string;
  channelKey: string;
  orderName: string;
  totalAmount: number;
  currency: "CURRENCY_KRW";
  redirectUrl: string;
}

export type OrderResponse = OrderBase & PaymentRequestKind;
```

`PaymentRequestKind`는 §4.2에서 `config.ts`가 소유하고 여기서 재사용한다. `handler.ts`는 `getChannel`이 준 값을 그대로 펼치므로 조합을 다시 만들 일이 없다.

### 5.2 `src/app/api/payments/orders/_lib/handler.ts`

응답 조립에서 `payMethod: channel.payMethod` 한 줄이 `...channel` 펼치기로 바뀐다 — 채널키와 판별자를 한 덩이로 넘겨, 두 값을 따로 옮기다 어긋나는 일을 없앤다. 세션·소유·미결제 확인과 503 분기(`handler.ts:58-64`)는 그대로다. 꺼진 수단은 `getChannel`이 `null`을 주므로 기존 503 경로로 막힌다.

### 5.3 `src/app/checkout/_hooks/use-payment.ts`

`PaymentRequest`가 `payMethod`로 갈라지는 유니온이라, 공통 객체에 `easyPay`를 스프레드로 얹으면 타입이 좁혀지지 않는다. `OrderResponse`의 판별자로 두 갈래를 나눈다.

```ts
const base = {
  storeId: order.storeId,
  channelKey: order.channelKey,
  paymentId: order.paymentId,
  orderName: order.orderName,
  totalAmount: order.totalAmount,
  currency: order.currency,
  redirectUrl: order.redirectUrl,
};

const res =
  order.payMethod === "EASY_PAY"
    ? await PortOne.requestPayment({
        ...base,
        payMethod: "EASY_PAY",
        easyPay: { easyPayProvider: order.easyPayProvider },
      })
    : await PortOne.requestPayment({ ...base, payMethod: "CARD" });
```

`order.payMethod`로 좁히면 `easyPayProvider`가 존재함이 타입으로 보장되므로 캐스팅도, 옵셔널 처리도 없다. `res.code` 검사부터 리포트 리다이렉트까지 이후 흐름은 손대지 않는다.

## 6. 화면

`src/app/checkout/_lib/methods.ts`의 `PAYMENT_METHODS`에 토스페이를 더한다. 순서는 카드 → 네이버페이 → 카카오페이 → 토스페이.

```ts
{
  id: "toss",
  name: "토스페이",
  desc: "토스 앱에서 간편 결제",
  logo: "toss",
  logoClass: "bg-[#0064FF] text-white",
  note: "결제하기를 누르면 토스페이 창이 열립니다. 인증을 완료하면 이 화면으로 돌아옵니다.",
}
```

`CheckoutView`·`PaymentMethodList`는 서버가 거른 목록을 그대로 받으므로 변경이 없다. 수단이 하나도 없을 때 "결제를 준비 중입니다"로 잠그는 분기(`CheckoutView.tsx:52-65`)가 계약 전 상태를 그대로 표현한다.

카드 항목의 설명 "KG이니시스 국내 카드결제"는 그대로 둔다.

## 7. 테스트

**`src/lib/payments/config.test.ts`** — 기존 픽스처의 채널키 3개를 `PORTONE_CHANNEL_KEY_INICIS` + `PORTONE_METHODS`로 교체하고 아래를 덮는다.

| 검사 | 기대 |
| --- | --- |
| `getChannel("card")` | `{ channelKey, payMethod: "CARD" }` — `easyPayProvider` 없음 |
| `getChannel("kakao")` / `("toss")` / `("naver")` | `payMethod: "EASY_PAY"` + 각 provider |
| 채널키 없음 / 공백만 | `null` |
| 꺼진 수단 | `null` |
| `PORTONE_METHODS` 미설정·빈 문자열 | `availableMethods` 빈 배열 |
| `" Card , KAKAO "` | `["card", "kakao"]` — trim·소문자화 |
| `"card,kakaopay"` | `["card"]` — 오타는 버린다 |
| `"kakao,card,kakao"` | `["card", "kakao"]` — 중복 접기, 화면 순서 유지 |
| `storeId` / `apiSecret` / 채널키 각각 없음 | 빈 배열 |

**`src/app/api/payments/orders/_lib/handler.test.ts`**

- 간편결제 수단 요청 → 응답에 `easyPayProvider`가 실린다
- 카드 요청 → `easyPayProvider`가 없다
- 꺼진 수단 요청 → 503 `"결제를 준비 중입니다"`

**수동 스모크 (계약·키 확보 후)** — 이니시스 테스트 채널키를 넣고 `/checkout`에서 수단별로 결제창이 뜨는지, 모바일 리다이렉트가 `/checkout/complete`로 돌아오는지 확인한다. 자동 테스트 대상이 아니다.

## 8. 배포 시 확인

- 포트원 콘솔에서 이니시스 채널에 간편결제 3사 제휴가 켜졌는지 확인한 뒤에만 `PORTONE_METHODS`에 해당 수단을 추가한다. 계약 없이 켜면 결제창에서 실패한다.
- 프로덕션은 실 결제 채널키를, 로컬은 테스트 채널키를 쓴다. 파일 분리는 `.env.local` / `.env.production.local`이고, Vercel 배포 시에는 대시보드 환경변수에 같은 키를 등록한다.
