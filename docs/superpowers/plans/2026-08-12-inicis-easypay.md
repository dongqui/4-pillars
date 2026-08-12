# KG이니시스 단일 채널 + 간편결제 UI 직접 호출 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카드·네이버페이·카카오페이·토스페이를 KG이니시스 채널 하나로 처리하고, 노출 수단을 `PORTONE_METHODS` env로 켜고 끈다.

**Architecture:** 수단마다 채널키를 두던 구조를 버린다. 채널키는 `PORTONE_CHANNEL_KEY_INICIS` 하나이고, 수단이 결정하는 것은 포트원 요청의 판별자(`payMethod`, 간편결제면 `easyPayProvider`)뿐이다. 이 판별자 조합을 `config.ts`가 판별 유니온으로 소유하고, 주문 응답과 브라우저 호출이 같은 타입을 재사용해 "EASY_PAY인데 provider가 없는" 조합을 타입 단계에서 막는다.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, zod 4, vitest, `@portone/browser-sdk` 0.1.9

**설계 문서:** `docs/superpowers/specs/2026-08-12-inicis-easypay-design.md` — 판단 근거는 전부 여기 있다.

## Global Constraints

- 결제 관련 env를 읽는 곳은 `src/lib/payments/config.ts` **하나뿐이다.** 다른 파일에서 `process.env`로 포트원 값을 읽지 않는다.
- 모든 config 함수는 `env: NodeJS.ProcessEnv`를 인자로 받고 기본값이 `process.env`다. 테스트가 `process.env`를 건드리지 않는다.
- env 부재는 예외가 아니라 `null`/빈 배열이다. 키가 하나도 없어도 `npm run typecheck`와 `npm run test`가 통과해야 한다.
- 포트원 키에 `NEXT_PUBLIC_`을 쓰지 않는다.
- 공백만 있는 env 값은 미설정으로 친다.
- 주석·커밋 메시지·UI 문구는 한국어. 기존 파일의 주석 밀도와 어투를 따른다.
- `.env.local`과 `.env.production.local`은 **커밋하지 않는다** (`.gitignore`의 `.env*`). `.env.example`만 커밋 대상이다.
- 검증 명령: `npm run test`, `npm run typecheck`, `npm run lint`

---

### Task 1: 채널 통합, 수단 스위치, 결제창 호출 분기

`config.ts`의 타입이 바뀌면 `order.ts`·`handler.ts`·`use-payment.ts`가 같이 안 고쳐지고는 컴파일이 안 된다. `payMethod`가 판별자 없는 `"CARD" | "EASY_PAY"`로 넓어지는 순간 SDK 호출이 타입 에러가 나므로, 네 파일이 한 단위다.

**Files:**
- Modify: `src/lib/payments/config.ts` (전면 교체)
- Modify: `src/lib/payments/order.ts`
- Modify: `src/app/api/payments/orders/_lib/handler.ts:75-88`
- Modify: `src/app/checkout/_hooks/use-payment.ts:45-56`
- Test: `src/lib/payments/config.test.ts` (전면 교체)
- Test: `src/app/api/payments/orders/_lib/handler.test.ts`
- Modify: `.env.example`, `.env.local`, `.env.production.local`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `PAYMENT_METHOD_IDS: readonly ["card", "naver", "kakao", "toss"]`
  - `type PaymentMethodId = "card" | "naver" | "kakao" | "toss"`
  - `type EasyPayProvider = "NAVERPAY" | "KAKAOPAY" | "TOSSPAY"`
  - `type PaymentRequestKind = { payMethod: "CARD" } | { payMethod: "EASY_PAY"; easyPayProvider: EasyPayProvider }`
  - `type PaymentChannel = { channelKey: string } & PaymentRequestKind`
  - `type OrderResponse = OrderBase & PaymentRequestKind`
  - `getChannelKey(env?): string | null`
  - `enabledMethods(env?): PaymentMethodId[]`
  - `getChannel(id: PaymentMethodId, env?): PaymentChannel | null`
  - `availableMethods(env?): PaymentMethodId[]`
  - `getStoreId` / `getApiSecret` / `getWebhookSecret` / `getAppOrigin` — 시그니처 변경 없음
  - **삭제됨:** `PortOnePayMethod` 타입

- [ ] **Step 1: 실패하는 config 테스트를 쓴다**

`src/lib/payments/config.test.ts` 전체를 아래로 교체한다. 기존 픽스처의 채널키 3개가 사라지고 `PORTONE_CHANNEL_KEY_INICIS` + `PORTONE_METHODS`로 바뀐다.

```ts
import { describe, it, expect } from "vitest";
import {
  availableMethods,
  enabledMethods,
  getChannel,
  getChannelKey,
  getStoreId,
} from "./config";

const full = {
  PORTONE_STORE_ID: "store-1",
  PORTONE_API_SECRET: "secret-1",
  PORTONE_CHANNEL_KEY_INICIS: "ch-inicis",
  PORTONE_METHODS: "card,naver,kakao,toss",
} as unknown as NodeJS.ProcessEnv;

const none = {} as unknown as NodeJS.ProcessEnv;

describe("getChannel", () => {
  it("카드는 CARD 하나로, 간편결제는 EASY_PAY + provider 로 짝지어진다", () => {
    expect(getChannel("card", full)).toEqual({ channelKey: "ch-inicis", payMethod: "CARD" });
    expect(getChannel("naver", full)).toEqual({
      channelKey: "ch-inicis",
      payMethod: "EASY_PAY",
      easyPayProvider: "NAVERPAY",
    });
    expect(getChannel("kakao", full)).toEqual({
      channelKey: "ch-inicis",
      payMethod: "EASY_PAY",
      easyPayProvider: "KAKAOPAY",
    });
    expect(getChannel("toss", full)).toEqual({
      channelKey: "ch-inicis",
      payMethod: "EASY_PAY",
      easyPayProvider: "TOSSPAY",
    });
  });

  it("네 수단이 같은 채널키를 쓴다 — 이니시스 채널 하나가 전부를 연다", () => {
    const keys = ["card", "naver", "kakao", "toss"].map(
      (id) => getChannel(id as "card", full)?.channelKey,
    );
    expect(new Set(keys)).toEqual(new Set(["ch-inicis"]));
  });

  it("채널키가 없으면 null", () => {
    expect(getChannel("card", none)).toBeNull();
    expect(getChannel("card", { ...full, PORTONE_CHANNEL_KEY_INICIS: "" })).toBeNull();
  });

  it("공백만 있는 채널키는 없는 것으로 친다 — .env 의 빈 줄이 채널로 살아나면 안 된다", () => {
    expect(getChannel("card", { ...full, PORTONE_CHANNEL_KEY_INICIS: "   " })).toBeNull();
  });

  it("꺼진 수단은 채널키가 있어도 null — 화면에서만 숨기면 API 를 직접 두드릴 수 있다", () => {
    const onlyCard = { ...full, PORTONE_METHODS: "card" };
    expect(getChannel("card", onlyCard)).not.toBeNull();
    expect(getChannel("kakao", onlyCard)).toBeNull();
  });
});

describe("enabledMethods", () => {
  it("미설정·빈 문자열이면 아무것도 켜지 않는다 — 빠뜨린 env 로 결제창이 열리면 안 된다", () => {
    expect(enabledMethods(none)).toEqual([]);
    expect(enabledMethods({ ...full, PORTONE_METHODS: "" })).toEqual([]);
    expect(enabledMethods({ ...full, PORTONE_METHODS: "   " })).toEqual([]);
  });

  it("공백과 대소문자를 흡수한다", () => {
    expect(enabledMethods({ ...full, PORTONE_METHODS: " Card , KAKAO " })).toEqual([
      "card",
      "kakao",
    ]);
  });

  it("모르는 값은 버린다 — 오타가 다른 수단을 켜지 않는다", () => {
    expect(enabledMethods({ ...full, PORTONE_METHODS: "card,kakaopay" })).toEqual(["card"]);
    expect(enabledMethods({ ...full, PORTONE_METHODS: "paypal" })).toEqual([]);
  });

  it("중복을 접고 화면 순서를 지킨다 — env 작성 순서에 흔들리지 않는다", () => {
    expect(enabledMethods({ ...full, PORTONE_METHODS: "kakao,card,kakao" })).toEqual([
      "card",
      "kakao",
    ]);
    expect(enabledMethods({ ...full, PORTONE_METHODS: "toss,naver" })).toEqual(["naver", "toss"]);
  });
});

describe("availableMethods", () => {
  it("켜진 수단만 화면 순서대로 돌려준다", () => {
    expect(availableMethods(full)).toEqual(["card", "naver", "kakao", "toss"]);
    expect(availableMethods({ ...full, PORTONE_METHODS: "card,toss" })).toEqual(["card", "toss"]);
  });

  it("아무것도 없으면 빈 배열", () => {
    expect(availableMethods(none)).toEqual([]);
  });

  it("storeId 가 없으면 빈 배열 — 상점 없이는 결제창이 열리지 않는다", () => {
    expect(availableMethods({ ...full, PORTONE_STORE_ID: "" })).toEqual([]);
  });

  it("API 시크릿이 없으면 빈 배열 — 확정 못 할 결제를 열 수는 없다", () => {
    expect(availableMethods({ ...full, PORTONE_API_SECRET: "" })).toEqual([]);
  });

  it("채널키가 없으면 빈 배열 — 켠 수단이 있어도 열 채널이 없다", () => {
    expect(availableMethods({ ...full, PORTONE_CHANNEL_KEY_INICIS: "" })).toEqual([]);
  });
});

describe("getChannelKey / getStoreId", () => {
  it("없으면 null (빈 문자열이 아니다)", () => {
    expect(getChannelKey(none)).toBeNull();
    expect(getChannelKey(full)).toBe("ch-inicis");
    expect(getStoreId(none)).toBeNull();
    expect(getStoreId(full)).toBe("store-1");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/lib/payments/config.test.ts`
Expected: FAIL — `enabledMethods`·`getChannelKey`가 export 되지 않아 import 에러

- [ ] **Step 3: `config.ts` 를 교체한다**

`src/lib/payments/config.ts` 전체를 아래로 바꾼다. 파일 상단 주석 블록에서 `NEXT_PUBLIC_` 관련 설명(1-13행)은 그대로 살리고, 채널 관련 문장만 새 구조에 맞춘다.

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
 *  2. "이 수단은 쓸 수 없다"는 판단을 서버가 해야 한다. 브라우저에 빈 문자열을
 *     내려 보내면 못 쓰는 수단이 화면에 남았다가 결제창에서 실패한다.
 * 대신 /checkout 이 availableMethods() 로 거르고, 주문 생성 응답이 값을 실어 보낸다.
 */

/**
 * 순서가 곧 화면 순서다 (PAYMENT_METHODS 와 같은 순서를 유지한다).
 * 타입을 배열에서 파생시키는 이유: 수단을 추가할 때 배열과 유니온을 따로 고치면
 * 한쪽만 고쳐도 컴파일이 통과해 조용히 어긋난다. 여기 한 줄만 고치면 된다.
 */
export const PAYMENT_METHOD_IDS = ["card", "naver", "kakao", "toss"] as const;

export type PaymentMethodId = (typeof PAYMENT_METHOD_IDS)[number];

/** 포트원 간편결제 UI 직접 호출에 넘기는 제휴사 코드. */
export type EasyPayProvider = "NAVERPAY" | "KAKAOPAY" | "TOSSPAY";

/**
 * 수단이 결정하는 것은 포트원 요청의 판별자뿐이다. 채널키는 여기 없다 —
 * KG이니시스 채널 하나가 네 수단을 전부 연다.
 *
 * 판별 유니온인 이유: payMethod 와 easyPayProvider 를 각각 선택 필드로 두면
 * "EASY_PAY 인데 provider 가 없는" 조합이 타입상 살아남는다. 그 조합은
 * 결제창을 수단 선택 화면으로 열어 버려서, 사용자가 고른 수단과 다른 결제가 된다.
 */
export type PaymentRequestKind =
  | { payMethod: "CARD" }
  | { payMethod: "EASY_PAY"; easyPayProvider: EasyPayProvider };

const REQUESTS: Record<PaymentMethodId, PaymentRequestKind> = {
  card: { payMethod: "CARD" },
  naver: { payMethod: "EASY_PAY", easyPayProvider: "NAVERPAY" },
  kakao: { payMethod: "EASY_PAY", easyPayProvider: "KAKAOPAY" },
  toss: { payMethod: "EASY_PAY", easyPayProvider: "TOSSPAY" },
};

export type PaymentChannel = { channelKey: string } & PaymentRequestKind;

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

/** KG이니시스 채널 하나. 카드도 간편결제도 이 키로 연다. */
export function getChannelKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return read(env, "PORTONE_CHANNEL_KEY_INICIS");
}

/**
 * 지금 열어 둔 수단. 간편결제 제휴 계약이 하나씩 열리므로 배포가 아니라 env 로 켠다.
 *
 * 정규 목록(PAYMENT_METHOD_IDS)을 env 집합으로 거르는 방식이라 캐스팅이 없다:
 * 모르는 값은 어느 id 와도 만나지 못해 그대로 사라지고, 중복은 접히고,
 * 결과 순서는 항상 화면 순서다 — env 를 어떤 순서로 적든 화면이 흔들리지 않는다.
 *
 * 미설정이면 빈 배열이다. 전부 켜지 않는다 — env 를 빠뜨렸을 때 결제창이 열리는
 * 것보다 화면이 잠기는 쪽이 안전하다.
 */
export function enabledMethods(env: NodeJS.ProcessEnv = process.env): PaymentMethodId[] {
  const raw = read(env, "PORTONE_METHODS");
  if (!raw) return [];
  const wanted = new Set(raw.split(",").map((s) => s.trim().toLowerCase()));
  return PAYMENT_METHOD_IDS.filter((id) => wanted.has(id));
}

/**
 * 주문 생성의 관문이다. 꺼진 수단을 화면에서만 숨기고 여기서 통과시키면
 * API 를 직접 두드려 열 수 있다.
 */
export function getChannel(
  id: PaymentMethodId,
  env: NodeJS.ProcessEnv = process.env,
): PaymentChannel | null {
  const channelKey = getChannelKey(env);
  if (!channelKey) return null;
  if (!enabledMethods(env).includes(id)) return null;
  return { channelKey, ...REQUESTS[id] };
}

/**
 * 실제로 결제를 걸 수 있는 수단만.
 *
 * API 시크릿도 같이 본다 — 채널키만으로는 결제창을 열고 돈을 받을 수는 있지만,
 * confirmPayment 가 getPayment 를 부를 때 시크릿이 없으면 거기서
 * PortOneNotConfiguredError 로 막힌다. 결제창은 열렸는데 확정할 수 없는 상태로
 * 화면을 켜 두면 고객 돈은 잡히고 완료 API 는 503, 행은 pending 에 갇힌다.
 * 확정 자격이 없으면 애초에 결제창을 열지 않는다.
 */
export function availableMethods(env: NodeJS.ProcessEnv = process.env): PaymentMethodId[] {
  if (!getStoreId(env) || !getApiSecret(env) || !getChannelKey(env)) return [];
  return enabledMethods(env);
}
```

- [ ] **Step 4: config 테스트가 통과하는지 확인한다**

Run: `npx vitest run src/lib/payments/config.test.ts`
Expected: PASS (전부)

- [ ] **Step 5: `order.ts` 의 응답 타입을 판별 유니온으로 바꾼다**

`src/lib/payments/order.ts` 전체를 아래로 바꾼다. `PortOnePayMethod` import가 사라지고 `PaymentRequestKind`가 들어온다.

```ts
import type { PaymentRequestKind } from "./config";

/**
 * 주문 생성 API 응답 타입은 여기서 소유한다 — API 라우트(`_lib/handler.ts`)와
 * 결제 화면(`checkout/_hooks/use-payment.ts`)이 같은 모양을 봐야 하는데,
 * 어느 한쪽의 폴더에 두면 다른 쪽이 그 폴더 내부(`_lib`)를 들여다보게 된다.
 *
 * 브라우저가 requestPayment 에 그대로 펼쳐 넣는 값들.
 */
interface OrderBase {
  paymentId: string;
  storeId: string;
  channelKey: string;
  orderName: string;
  totalAmount: number;
  /** 포트원 요청용 통화 코드. 조회 응답의 "KRW" 와 문자열이 다르다. */
  currency: "CURRENCY_KRW";
  redirectUrl: string;
}

/**
 * 결제수단 부분은 config 의 PaymentRequestKind 를 그대로 쓴다 — 서버가 고른 조합과
 * 브라우저가 보내는 조합이 같은 타입이라 둘이 어긋날 수 없다.
 */
export type OrderResponse = OrderBase & PaymentRequestKind;
```

- [ ] **Step 6: `handler.ts` 가 채널을 통째로 펼치게 한다**

`src/app/api/payments/orders/_lib/handler.ts:75-88`의 반환 블록에서 `channelKey`·`payMethod` 두 줄을 `...channel` 한 줄로 바꾼다. 나머지 검증 흐름은 손대지 않는다.

```ts
  return {
    status: 200,
    body: {
      paymentId,
      storeId,
      // 채널키와 판별자를 한 덩이로 넘긴다 — 따로 옮기면 payMethod 와
      // easyPayProvider 가 어긋난 조합을 만들 수 있다.
      ...channel,
      orderName: FULL_REPORT_ORDER_NAME,
      totalAmount: FULL_REPORT_PRICE.total,
      currency: "CURRENCY_KRW",
      // 모바일은 결제창이 페이지를 떠난다. 돌아올 자리를 여기서 정한다.
      redirectUrl: `${origin}/checkout/complete?profile=${profile.id}`,
    },
  };
```

- [ ] **Step 7: `handler.test.ts` 를 고친다**

두 군데를 고치고 두 개를 더한다.

먼저 `src/app/api/payments/orders/_lib/handler.test.ts:69`의 잘못된 본문 목록에서 `method: "toss"` 를 뺀다. **토스는 이제 정식 수단이라 400 이 아니다.** 대신 지원하지 않는 값을 쓴다.

```ts
  it("본문이 스키마에 맞지 않으면 400", async () => {
    const d = deps();
    for (const bad of [null, {}, { profileId: "3" }, { profileId: "3", method: "paypal" }]) {
      expect((await handleCreateOrder(bad, d)).status).toBe(400);
    }
  });
```

그리고 파일 끝의 `describe` 안에 아래 두 테스트를 더한다.

```ts
  it("간편결제 수단은 easyPayProvider 까지 실어 보낸다", async () => {
    const d = deps({
      getChannel: () => ({
        channelKey: "ch-inicis",
        payMethod: "EASY_PAY" as const,
        easyPayProvider: "TOSSPAY" as const,
      }),
    });
    const r = await handleCreateOrder({ profileId: "3", method: "toss" }, d);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      channelKey: "ch-inicis",
      payMethod: "EASY_PAY",
      easyPayProvider: "TOSSPAY",
    });
  });

  it("카드는 easyPayProvider 를 싣지 않는다 — 브라우저가 카드창을 연다", async () => {
    const r = await handleCreateOrder(body, deps());
    expect(r.body).not.toHaveProperty("easyPayProvider");
  });
```

- [ ] **Step 8: 결제창 호출을 두 갈래로 나눈다**

`src/app/checkout/_hooks/use-payment.ts:45-56`의 `PortOne.requestPayment(...)` 호출을 아래로 바꾼다.

```ts
        // 공통 값과 판별자를 나눈다 — PaymentRequest 가 payMethod 로 갈라지는
        // 유니온이라, 공통 객체에 easyPay 를 스프레드로 얹으면 타입이 좁혀지지 않는다.
        const base = {
          storeId: order.storeId,
          channelKey: order.channelKey,
          paymentId: order.paymentId,
          orderName: order.orderName,
          totalAmount: order.totalAmount,
          // OrderResponse(src/lib/payments/order.ts)의 currency 가 이미 PortOne SDK 가
          // 받는 리터럴 집합의 부분집합이라 캐스팅이 필요 없다.
          currency: order.currency,
          redirectUrl: order.redirectUrl,
        };

        // 간편결제는 UI 를 직접 호출한다 — 채널이 KG이니시스 하나뿐이라
        // 어느 간편결제인지는 easyPayProvider 만이 결정한다.
        const res =
          order.payMethod === "EASY_PAY"
            ? await PortOne.requestPayment({
                ...base,
                payMethod: "EASY_PAY",
                easyPay: { easyPayProvider: order.easyPayProvider },
              })
            : await PortOne.requestPayment({ ...base, payMethod: "CARD" });
```

`order.payMethod`로 좁히면 `order.easyPayProvider`가 존재함이 타입으로 보장된다. 이후 `res?.code` 검사부터 리포트 리다이렉트까지는 그대로 둔다.

- [ ] **Step 9: 테스트와 타입을 전부 확인한다**

Run: `npm run test`
Expected: PASS (전부)

Run: `npm run typecheck`
Expected: 에러 없음

Run: `npm run lint`
Expected: 에러 없음

- [ ] **Step 10: env 파일 세 개의 결제 블록을 바꾼다**

`.env.example`의 결제 블록에서 `PORTONE_CHANNEL_KEY_CARD` / `_NAVERPAY` / `_KAKAOPAY` 세 줄을 지우고 아래 두 줄을 넣는다. 그 위의 테스트/프로덕션 구분 주석은 그대로 둔다.

```
PORTONE_CHANNEL_KEY_INICIS=       # KG이니시스 채널 하나. 카드·간편결제가 전부 이걸 쓴다
PORTONE_METHODS=                  # 지금 열 수단: card,naver,kakao,toss 중 콤마로 나열. 비우면 결제 화면이 잠긴다
```

`.env.local`과 `.env.production.local`에도 같은 교체를 한다. 두 파일은 커밋하지 않는다.

- [ ] **Step 11: 커밋**

```bash
git add src/lib/payments/config.ts src/lib/payments/config.test.ts src/lib/payments/order.ts \
  src/app/api/payments/orders/_lib/handler.ts src/app/api/payments/orders/_lib/handler.test.ts \
  src/app/checkout/_hooks/use-payment.ts .env.example
git commit -m "feat(payments): 이니시스 채널 하나로 네 수단을 열고 노출은 env 가 정한다" \
  -m "수단별 채널키 대신 채널키 하나 + easyPayProvider 판별 유니온으로 바꾼다. 토스페이가 수단에 들어온다."
```

(`.env.local`·`.env.production.local`은 스테이징하지 않는다.)

---

### Task 2: 화면 — 토스페이 항목

**Files:**
- Modify: `src/app/checkout/_lib/methods.ts`

**Interfaces:**
- Consumes: Task 1의 `PaymentMethodId`에 추가된 `"toss"`
- Produces: `PAYMENT_METHODS` 배열에 `id: "toss"` 항목. `CheckoutView`·`PaymentMethodList`는 이 배열을 그대로 읽으므로 변경이 없다.

이 파일은 화면 상수라 단위 테스트가 없다. 검증은 `npm run typecheck` + `npm run lint` + 개발 서버 육안 확인이다.

- [ ] **Step 1: `methods.ts` 에 토스페이를 더한다**

`src/app/checkout/_lib/methods.ts`의 `PAYMENT_METHODS` 배열 끝(카카오페이 다음)에 아래 항목을 더한다. 다른 항목은 손대지 않는다.

```ts
  {
    id: "toss",
    name: "토스페이",
    desc: "토스 앱에서 간편 결제",
    logo: "toss",
    logoClass: "bg-[#0064FF] text-white",
    note: "결제하기를 누르면 토스페이 창이 열립니다. 인증을 완료하면 이 화면으로 돌아옵니다.",
  },
```

배열 위의 주석("순서가 곧 화면 순서다…")도 그대로 둔다.

- [ ] **Step 2: 타입·린트·테스트를 전부 돌린다**

Run: `npm run typecheck`
Expected: 에러 없음

Run: `npm run lint`
Expected: 에러 없음

Run: `npm run test`
Expected: PASS (전부)

- [ ] **Step 3: 화면을 눈으로 확인한다**

`.env.local`의 `PORTONE_METHODS`에 임시로 `card,naver,kakao,toss`를 넣고 `PORTONE_STORE_ID`·`PORTONE_API_SECRET`·`PORTONE_CHANNEL_KEY_INICIS`에 아무 문자열이나 채운 뒤:

Run: `npm run dev`
확인: 로그인 상태로 `/checkout?profile=<본인 프로필 id>` 진입 → 결제 수단이 카드·네이버페이·카카오페이·토스페이 네 개로 뜨고, 토스페이를 고르면 아래 안내문이 토스 문구로 바뀐다.

그다음 `PORTONE_METHODS=card`로 줄이고 새로고침 → 카드 하나만 남는지 확인한다. `PORTONE_METHODS`를 비우면 "결제를 준비 중입니다"로 잠기는지 확인한다.

확인이 끝나면 **임시로 넣은 값을 도로 비운다.** 실제 키가 아니면 결제창은 열리지 않으므로 결제하기 버튼까지 누를 필요는 없다.

- [ ] **Step 4: 커밋**

```bash
git add src/app/checkout/_lib/methods.ts
git commit -m "feat(checkout): 결제 수단에 토스페이를 더한다"
```

---

### Task 3: 문서 정리와 최종 검증

**Files:**
- Modify: `docs/superpowers/specs/2026-08-11-portone-payment-design.md:17`
- Modify: `docs/issues/payment.md`

**Interfaces:**
- Consumes: Task 1·2의 결과
- Produces: 없음 (문서만)

- [ ] **Step 1: 선행 설계 문서의 뒤집힌 전제를 표시한다**

`docs/superpowers/specs/2026-08-11-portone-payment-design.md`의 §2 표에서 결제수단 행을 아래로 바꾼다. 문서를 통째로 고치지 않고 이 한 줄만 손댄다 — 그 문서는 당시의 판단 기록이다.

```markdown
| 결제수단 | ~~수단별 채널키 3개~~ → **KG이니시스 채널 1개 + 간편결제 UI 직접 호출.** 2026-08-12 `2026-08-12-inicis-easypay-design.md` 에서 뒤집혔다. |
```

- [ ] **Step 2: 이슈 문서에 현재 구성을 적는다**

`docs/issues/payment.md:7`(ISSUE-014 의 설계 링크 줄) 바로 아래에 한 줄을 더한다. 그 아래 불릿 목록과 환불·리컨실리에이션 절은 손대지 않는다.

```markdown
포트원 v2. 설계: `docs/superpowers/specs/2026-08-11-portone-payment-design.md`.
2026-08-12 수단 구성이 KG이니시스 채널 하나(카드·네이버페이·카카오페이·토스페이)로 바뀌었다. 노출 수단은 `PORTONE_METHODS` env 가 정한다: `docs/superpowers/specs/2026-08-12-inicis-easypay-design.md`.
```

- [ ] **Step 3: 전체 검증**

Run: `npm run test`
Expected: PASS (전부)

Run: `npm run typecheck`
Expected: 에러 없음

Run: `npm run lint`
Expected: 에러 없음

Run: `git status --short`
Expected: `.env.local`·`.env.production.local`이 커밋되지 않은 상태로 남아 있고(추적되지 않음), 그 외 변경은 전부 커밋돼 있다.

- [ ] **Step 4: 커밋**

```bash
git add docs/superpowers/specs/2026-08-11-portone-payment-design.md docs/issues/payment.md
git commit -m "docs(payments): 수단 구성이 이니시스 단일 채널로 바뀐 것을 기록한다"
```

---

## 남는 일 (이 계획의 범위 밖)

- **제휴 계약.** 포트원 콘솔에서 이니시스 채널에 카카오페이·토스페이·네이버페이 제휴가 켜지기 전에는 `PORTONE_METHODS`에 해당 수단을 넣지 않는다. 계약 없이 켜면 결제창에서 실패한다.
- **실키 스모크.** 테스트 채널키를 받은 뒤 수단별로 결제창이 실제로 뜨는지, 모바일에서 `/checkout/complete`로 돌아오는지 확인한다. 자동 테스트로 덮을 수 없는 부분이다.
- **프로덕션 env 등록.** Vercel 대시보드에 `PORTONE_CHANNEL_KEY_INICIS`·`PORTONE_METHODS`를 포함한 런타임 env를 등록한다.
