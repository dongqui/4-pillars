# 포트원 v2 + NHN KCP 결제 전환 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 토스페이먼츠 직결 코드를 걷어내고 포트원 v2 + NHN KCP 채널로 카드·네이버페이·카카오페이·토스페이 결제를 연다.

**Architecture:** 2026-08-20 커밋 `11483ff` 직전의 포트원 구조를 되살린다 — 포트원 결제창이 승인까지 끝내고, 서버는 조회 API 로 확인만 한다. 완료 API(PC)·모바일 착지 라우트·서명 검증 웹훅 세 경로가 `confirmPayment` 하나를 공유한다. 그 뒤에 들어온 `/checkout/done` 완료 화면과 `checkout_next` 쿠키는 그대로 쓴다. 채널은 이니시스 대신 KCP 이고, KCP 의 paymentId 제약(영숫자 40자) 때문에 주문 ID 형식이 바뀐다.

**Tech Stack:** Next.js 16 (App Router, route handlers), `@portone/browser-sdk@^0.1.9`, `@portone/server-sdk@^0.19.0`(웹훅 서명 검증만), zod 4, vitest 4, Neon serverless SQL.

**스펙:** `docs/superpowers/specs/2026-09-06-portone-kcp-design.md`

## Global Constraints

- env 이름: `PORTONE_STORE_ID`, `PORTONE_API_SECRET`, `PORTONE_WEBHOOK_SECRET`, `PORTONE_CHANNEL_KEY_KCP`, `PORTONE_METHODS`. `TOSS_*` 는 전부 사라진다.
- 결제수단 id 는 `card`, `naver`, `kakao`, `toss` 네 개, 이 순서.
- 포트원 요청 판별자: `{ payMethod: "CARD" } | { payMethod: "EASY_PAY"; easyPayProvider: "NAVERPAY" | "KAKAOPAY" | "TOSSPAY" }`.
- 주문 ID: `"saju"` + uuid 에서 하이픈을 뺀 32자 = 36자, `/^[a-z0-9]+$/`. KCP 제약: 영문·숫자만, 최대 40자.
- orderName 은 100바이트 이하(UTF-8).
- 구매자 정보는 `customer: { fullName, email }` 만. 휴대폰은 보내지 않는다.
- `purchases.provider` 값은 `'portone'`.
- 포트원 API: `GET https://api.portone.io/payments/{paymentId}`, 헤더 `Authorization: PortOne <PORTONE_API_SECRET>`. 요청 통화 리터럴은 `"CURRENCY_KRW"`, 조회 응답 통화는 `"KRW"`.
- 웹훅: 시크릿 없으면 503. `request.text()` 원문으로 검증. `type === "Transaction.Paid"` 만 확정.
- 명령은 PowerShell 에서 실행한다. `npx vitest run <경로>` 로 파일 단위 실행.
- 커밋 메시지는 한국어 현재형(예: `feat(payments): …한다`), 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- 중간 태스크에서는 해당 태스크의 테스트 파일만 돌린다. 전체 수트·typecheck 는 Task 9 끝에서 처음으로 초록이 된다(그 전에는 다른 파일이 아직 옛 이름을 참조한다).
- 실제 `.env.local`·`.env.production.local` 은 커밋되지 않는다. 계획은 `.env.example` 만 고친다.

---

## 파일 지도

| 파일 | 처리 | 책임 |
| --- | --- | --- |
| `package.json` | 수정 | 토스 SDK 제거, 포트원 SDK 둘 추가 |
| `.env.example` | 수정 | 결제 블록을 포트원+KCP 로 |
| `src/lib/payments/config.ts` (+test) | 교체 | env 읽기, 수단→채널 매핑 |
| `src/lib/payments/portone.ts` (+test) | 신규 | 결제 조회 API 클라이언트 |
| `src/lib/payments/toss.ts` (+test) | 삭제 | — |
| `src/lib/payments/confirm.ts` (+test) | 수정 | 포트원 상태 분류로 확정 |
| `src/lib/payments/deps.ts` | 교체 | `confirmDeps` 하나 |
| `src/lib/payments/order-id.ts` (+test) | 수정 | KCP 제약을 지키는 주문 ID |
| `src/lib/payments/pricing.test.ts` | 수정 | orderName 바이트 검사 추가 |
| `src/lib/payments/order.ts` | 교체 | 주문 생성 응답 타입 |
| `src/lib/payments/store.ts` (+test) | 수정 | provider 값 |
| `src/app/api/payments/orders/_lib/handler.ts` (+test), `route.ts` | 수정 | 주문 생성 |
| `src/app/api/payments/complete/_lib/handler.ts` (+test), `route.ts` | 신규 | PC 완료 API |
| `src/app/checkout/complete/route.ts` | 수정 | 모바일 착지 |
| `src/app/api/payments/webhook/_lib/handler.ts` (+test), `route.ts` | 교체 | 서명 검증 웹훅 |
| `src/app/checkout/_hooks/use-payment.ts` | 교체 | 포트원 SDK 호출 |
| `src/app/checkout/_components/OrderSummary.tsx`, `_lib/methods.ts`, `(legal)/*`, `src/lib/auth/callback.ts` | 수정 | 문구·주석 |
| `docs/issues/payment.md` | 수정 | 운영 절차 |

---

### Task 1: 의존성 교체와 `.env.example`

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `.env.example:18-40`

**Interfaces:**
- Produces: `@portone/browser-sdk/v2` 의 `requestPayment`(Task 9), `@portone/server-sdk` 의 `Webhook.verify`(Task 8).

- [ ] **Step 1: 토스 SDK 를 빼고 포트원 SDK 를 넣는다**

```powershell
npm uninstall @tosspayments/tosspayments-sdk
npm install @portone/browser-sdk@^0.1.9 @portone/server-sdk@^0.19.0
```

- [ ] **Step 2: 설치를 확인한다**

Run: `npm ls @portone/browser-sdk @portone/server-sdk @tosspayments/tosspayments-sdk`
Expected: 포트원 둘은 버전이 찍히고, 토스는 `(empty)` 또는 목록에 없다.

- [ ] **Step 3: `.env.example` 의 결제 블록(18~40행, `# --- 결제 (토스페이먼츠) ---` 부터 `# 웹훅 엔드포인트는 …` 까지)을 아래로 바꾼다**

```
# --- 결제 (포트원 v2 + NHN KCP) ---
# 테스트/프로덕션 구분:
#   .env.local             개발(`npm run dev`) — 포트원 콘솔의 KCP "테스트" 채널키
#   .env.production.local  프로덕션(`npm run build`/`start`) — "실연동" 채널키. .env.local 을 덮는다
#   배포 시                 호스팅 환경변수(Vercel 등)에 같은 키를 등록한다. .env* 는 커밋되지 않는다
# 상점 ID·API 시크릿은 테스트/실연동이 같고, 채널키가 테스트/실연동을 가른다.
# 값이 없으면 /checkout 이 "결제를 준비 중입니다"로 잠긴다. 타입체크·테스트는 그대로 통과한다.
# NEXT_PUBLIC_ 을 쓰지 않는 이유는 src/lib/payments/config.ts 주석 참조.
#
# 2026-09-06: 토스페이먼츠 심사가 길어져 포트원으로 돌아왔다. 옛 TOSS_* 는 전부 없어졌다 —
# 옛 이름만 채워 둔 환경은 새 키를 못 읽어 조용히 "결제를 준비 중입니다"로 잠긴다.
# 채널은 KG이니시스가 아니라 NHN KCP 다(이니시스는 구매자 휴대폰을 요구해 8월에 버렸다).
PORTONE_STORE_ID=                 # 포트원 콘솔 > 상점 ID. 결제창 호출에 쓴다
PORTONE_API_SECRET=               # 콘솔 > API 키 > V2 API Secret. 결제 조회에 쓴다. 브라우저로 절대 내보내지 않는다
PORTONE_WEBHOOK_SECRET=           # 콘솔 > 웹훅 > 시크릿. 없으면 웹훅이 503 으로 닫힌다
PORTONE_CHANNEL_KEY_KCP=          # NHN KCP 채널 하나. 카드·간편결제가 전부 이 키로 열린다
PORTONE_METHODS=                  # 지금 열 수단: card,naver,kakao,toss 중 콤마로 나열. 비우면 결제 화면이 잠긴다
# 웹훅 엔드포인트는 콘솔에 <APP_ORIGIN>/api/payments/webhook 으로 등록한다 (V2, Transaction.Paid)
```

- [ ] **Step 4: 커밋**

```powershell
git add package.json package-lock.json .env.example
git commit -m @'
chore(payments): 토스 SDK 를 빼고 포트원 SDK 를 다시 넣는다

토스페이먼츠 심사가 길어져 포트원 v2 + NHN KCP 로 돌아간다.
설계: docs/superpowers/specs/2026-09-06-portone-kcp-design.md

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
'@
```

---

### Task 2: `config.ts` — 포트원 env 와 KCP 채널 매핑

**Files:**
- Modify: `src/lib/payments/config.ts` (전체 교체)
- Modify: `src/lib/payments/config.test.ts` (전체 교체)

**Interfaces:**
- Produces:
  - `PAYMENT_METHOD_IDS`, `PaymentMethodId`, `EasyPayProvider`
  - `PaymentRequestKind = { payMethod: "CARD" } | { payMethod: "EASY_PAY"; easyPayProvider: EasyPayProvider }`
  - `PaymentChannel = { channelKey: string } & PaymentRequestKind`
  - `getStoreId(env?)`, `getApiSecret(env?)`, `getWebhookSecret(env?)`, `getAppOrigin(env?)`, `getChannelKey(env?)`: `string | null`
  - `enabledMethods(env?)`, `availableMethods(env?)`: `PaymentMethodId[]`
  - `getChannel(id, env?)`: `PaymentChannel | null`

- [ ] **Step 1: 실패하는 테스트를 쓴다 — `src/lib/payments/config.test.ts` 전체를 아래로 교체**

```ts
import { describe, it, expect } from "vitest";
import {
  availableMethods,
  enabledMethods,
  getChannel,
  getChannelKey,
  getStoreId,
  PAYMENT_METHOD_IDS,
} from "./config";

const full = {
  PORTONE_STORE_ID: "store-1",
  PORTONE_API_SECRET: "secret-1",
  PORTONE_CHANNEL_KEY_KCP: "ch-kcp",
  PORTONE_METHODS: "card,naver,kakao,toss",
} as unknown as NodeJS.ProcessEnv;

const none = {} as unknown as NodeJS.ProcessEnv;

describe("getChannel", () => {
  it("카드는 CARD 하나로, 간편결제는 EASY_PAY + provider 로 짝지어진다", () => {
    expect(getChannel("card", full)).toEqual({ channelKey: "ch-kcp", payMethod: "CARD" });
    expect(getChannel("naver", full)).toEqual({
      channelKey: "ch-kcp",
      payMethod: "EASY_PAY",
      easyPayProvider: "NAVERPAY",
    });
    expect(getChannel("kakao", full)).toEqual({
      channelKey: "ch-kcp",
      payMethod: "EASY_PAY",
      easyPayProvider: "KAKAOPAY",
    });
    expect(getChannel("toss", full)).toEqual({
      channelKey: "ch-kcp",
      payMethod: "EASY_PAY",
      easyPayProvider: "TOSSPAY",
    });
  });

  it("네 수단이 같은 채널키를 쓴다 — KCP 채널 하나가 전부를 연다", () => {
    const keys = PAYMENT_METHOD_IDS.map((id) => getChannel(id, full)?.channelKey);
    expect(new Set(keys)).toEqual(new Set(["ch-kcp"]));
  });

  it("채널키가 없으면 null", () => {
    expect(getChannel("card", none)).toBeNull();
    expect(getChannel("card", { ...full, PORTONE_CHANNEL_KEY_KCP: "" })).toBeNull();
  });

  it("공백만 있는 채널키는 없는 것으로 친다 — .env 의 빈 줄이 채널로 살아나면 안 된다", () => {
    expect(getChannel("card", { ...full, PORTONE_CHANNEL_KEY_KCP: "   " })).toBeNull();
  });

  it("옛 이니시스 이름은 읽지 않는다 — 옛 env 만 채운 환경은 조용히 잠겨야 한다", () => {
    const stale = { ...full, PORTONE_CHANNEL_KEY_KCP: "", PORTONE_CHANNEL_KEY_INICIS: "ch-inicis" };
    expect(getChannel("card", stale)).toBeNull();
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
    expect(availableMethods({ ...full, PORTONE_CHANNEL_KEY_KCP: "" })).toEqual([]);
  });
});

describe("getChannelKey / getStoreId", () => {
  it("없으면 null (빈 문자열이 아니다)", () => {
    expect(getChannelKey(none)).toBeNull();
    expect(getChannelKey(full)).toBe("ch-kcp");
    expect(getStoreId(none)).toBeNull();
    expect(getStoreId(full)).toBe("store-1");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/payments/config.test.ts`
Expected: FAIL — `getChannel`, `getStoreId` 등이 export 되지 않는다.

- [ ] **Step 3: `src/lib/payments/config.ts` 전체를 아래로 교체**

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

/** 포트원 간편결제 허브형 호출에 넘기는 제휴사 코드. KCP 는 셋 다 허브형으로 지원한다. */
export type EasyPayProvider = "NAVERPAY" | "KAKAOPAY" | "TOSSPAY";

/**
 * 수단이 결정하는 것은 포트원 요청의 판별자뿐이다. 채널키는 여기 없다 —
 * NHN KCP 채널 하나가 네 수단을 전부 연다.
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

/** 결제 조회 API 를 부르는 키. 브라우저로 절대 내보내지 않는다. */
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

/** NHN KCP 채널 하나. 카드도 간편결제도 이 키로 연다. */
export function getChannelKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return read(env, "PORTONE_CHANNEL_KEY_KCP");
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

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/payments/config.test.ts`
Expected: PASS (17 tests)

- [ ] **Step 5: 커밋**

```powershell
git add src/lib/payments/config.ts src/lib/payments/config.test.ts
git commit -m @'
feat(payments): 설정을 포트원 env 로 되돌리고 채널을 NHN KCP 로 짝짓는다

카드는 CARD, 간편결제 셋은 EASY_PAY + easyPayProvider 로 KCP 채널
하나를 탄다. 옛 이니시스 채널 이름은 읽지 않는다.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
'@
```

---

### Task 3: `portone.ts` — 결제 조회 클라이언트, `toss.ts` 삭제

**Files:**
- Create: `src/lib/payments/portone.ts`
- Create: `src/lib/payments/portone.test.ts`
- Delete: `src/lib/payments/toss.ts`, `src/lib/payments/toss.test.ts`

**Interfaces:**
- Consumes: `getApiSecret(env)` (Task 2)
- Produces:
  - `PORTONE_API_BASE = "https://api.portone.io"`
  - `paymentSchema`, `PortOnePayment = { id: string; status: "READY"|"PENDING"|"VIRTUAL_ACCOUNT_ISSUED"|"PAID"|"PARTIALLY_CANCELLED"|"CANCELLED"|"FAILED"; amount: { total: number; paid?: number }; currency: string; transactionId?: string | null }`
  - `class PortOneError extends Error { type?: string }`, `class PortOneNotConfiguredError extends Error`
  - `getPayment(paymentId: string, opts?: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv }): Promise<PortOnePayment>`

- [ ] **Step 1: 실패하는 테스트 — `src/lib/payments/portone.test.ts` 생성**

```ts
import { describe, it, expect } from "vitest";
import { PortOneError, PortOneNotConfiguredError, getPayment } from "./portone";

const env = { PORTONE_API_SECRET: "secret-1" } as unknown as NodeJS.ProcessEnv;

const paid = {
  id: "sajuabc",
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
    await getPayment("sajuabc", { fetchImpl, env });
    expect(calls[0].headers.Authorization).toBe("PortOne secret-1");
  });

  it("paymentId 를 URL 인코딩해 경로에 넣는다", async () => {
    const { fetchImpl, calls } = fakeFetch(paid);
    await getPayment("saju/abc", { fetchImpl, env });
    expect(calls[0].url).toBe("https://api.portone.io/payments/saju%2Fabc");
  });

  it("응답을 스키마로 좁혀 돌려준다", async () => {
    const { fetchImpl } = fakeFetch({ ...paid, 모르는필드: 1 });
    const p = await getPayment("sajuabc", { fetchImpl, env });
    expect(p.status).toBe("PAID");
    expect(p.amount.total).toBe(9900);
    expect(p.transactionId).toBe("tx-1");
  });

  it("모르는 status 는 던진다 — 모르는 상태를 결제 완료로 오해하는 것보다 실패가 낫다", async () => {
    const { fetchImpl } = fakeFetch({ ...paid, status: "NEW_STATUS" });
    await expect(getPayment("sajuabc", { fetchImpl, env })).rejects.toThrow();
  });

  it("비 2xx 는 포트원 에러 본문을 읽어 PortOneError 로 던진다", async () => {
    const { fetchImpl } = fakeFetch(
      { type: "PaymentNotFoundError", message: "결제 건이 없습니다" },
      { ok: false, status: 404 },
    );
    await expect(getPayment("sajunone", { fetchImpl, env })).rejects.toThrow(PortOneError);
  });

  it("시크릿이 없으면 네트워크를 타기 전에 던진다", async () => {
    const { fetchImpl, calls } = fakeFetch(paid);
    await expect(
      getPayment("sajuabc", { fetchImpl, env: {} as unknown as NodeJS.ProcessEnv }),
    ).rejects.toThrow(PortOneNotConfiguredError);
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/payments/portone.test.ts`
Expected: FAIL — `./portone` 모듈을 찾을 수 없다.

- [ ] **Step 3: `src/lib/payments/portone.ts` 생성**

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
  /** PG 거래 ID. 우리 purchases.provider_txn_id 에 남겨 두면 포트원 콘솔에서 되짚을 수 있다. */
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
 * GET /payments/{paymentId} — 결제 조회. 상태를 바꾸지 않는다.
 *
 * 승인 API 가 없는 이유: 포트원 v2 결제창은 승인까지 끝내고 돌아온다.
 * 우리는 "정말 PAID 인지, 금액이 맞는지"만 여기서 확인한다.
 *
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

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/payments/portone.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 토스 클라이언트를 지운다**

```powershell
git rm src/lib/payments/toss.ts src/lib/payments/toss.test.ts
```

- [ ] **Step 6: 커밋**

```powershell
git add src/lib/payments/portone.ts src/lib/payments/portone.test.ts
git commit -m @'
feat(payments): 포트원 결제 조회 클라이언트를 되살리고 토스 클라이언트를 지운다

포트원 결제창은 승인까지 끝내므로 서버에는 조회만 남는다.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
'@
```

---

### Task 4: `confirm.ts` 와 `deps.ts` — 포트원 상태로 확정

**Files:**
- Modify: `src/lib/payments/confirm.ts` (전체 교체)
- Modify: `src/lib/payments/confirm.test.ts` (전체 교체)
- Modify: `src/lib/payments/deps.ts` (전체 교체)

**Interfaces:**
- Consumes: `PortOnePayment`, `getPayment` (Task 3); `findOrderByPaymentId`, `markPurchaseFailed`, `PendingOrder` (`store.ts`, 변경 없음); `confirmPurchaseAndCredit` (`@/lib/tickets/wallet`, 변경 없음)
- Produces:
  - `ConfirmFailure`, `ConfirmResult` (변경 없음)
  - `ConfirmDeps = { findOrder; lookupPayment(paymentId): Promise<PortOnePayment>; markPaid; markFailed }`
  - `confirmPayment(paymentId, deps): Promise<ConfirmResult>`
  - `confirmDeps: ConfirmDeps` (deps.ts)

- [ ] **Step 1: 실패하는 테스트 — `src/lib/payments/confirm.test.ts` 전체 교체**

```ts
import { describe, it, expect, vi } from "vitest";
import { confirmPayment, type ConfirmDeps } from "./confirm";
import type { PendingOrder } from "./store";
import type { PortOnePayment } from "./portone";

const order: PendingOrder = {
  paymentId: "sajuabc",
  userId: "7",
  amount: 5000,
  status: "pending",
};

const paid: PortOnePayment = {
  id: "sajuabc",
  status: "PAID",
  amount: { total: 5000, paid: 5000 },
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
    expect(await confirmPayment("sajunone", d)).toEqual({ ok: false, kind: "not_found" });
    expect(d.lookupPayment).not.toHaveBeenCalled();
  });

  it("이미 paid 인 주문은 포트원을 다시 부르지 않고 already", async () => {
    const d = deps({ findOrder: vi.fn(async () => ({ ...order, status: "paid" as const })) });
    expect(await confirmPayment("sajuabc", d)).toEqual({ ok: true, kind: "already" });
    expect(d.lookupPayment).not.toHaveBeenCalled();
  });

  it("정상 결제는 confirmed + transactionId 를 넘긴다", async () => {
    const d = deps();
    expect(await confirmPayment("sajuabc", d)).toEqual({ ok: true, kind: "confirmed" });
    expect(d.markPaid).toHaveBeenCalledWith({ paymentId: "sajuabc", transactionId: "tx-1" });
  });

  it("markPaid 가 false 면 다시 읽어 확인한다 — 그 사이 다른 경로가 먼저 확정했으면 already", async () => {
    const findOrder = vi
      .fn<ConfirmDeps["findOrder"]>()
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce({ ...order, status: "paid" });
    const d = deps({ findOrder, markPaid: vi.fn(async () => false) });
    expect(await confirmPayment("sajuabc", d)).toEqual({ ok: true, kind: "already" });
    expect(d.markFailed).not.toHaveBeenCalled();
  });

  it("markPaid 가 false 이고 다시 읽은 행이 failed/refunded 면 already 가 아니라 not_paid", async () => {
    for (const status of ["failed", "refunded"] as const) {
      const findOrder = vi
        .fn<ConfirmDeps["findOrder"]>()
        .mockResolvedValueOnce(order)
        .mockResolvedValueOnce({ ...order, status });
      const d = deps({ findOrder, markPaid: vi.fn(async () => false) });
      expect(await confirmPayment("sajuabc", d)).toEqual({ ok: false, kind: "not_paid" });
    }
  });

  it("markPaid 가 false 이고 다시 읽었더니 행이 사라졌으면 not_paid", async () => {
    const findOrder = vi
      .fn<ConfirmDeps["findOrder"]>()
      .mockResolvedValueOnce(order)
      .mockResolvedValueOnce(null);
    const d = deps({ findOrder, markPaid: vi.fn(async () => false) });
    expect(await confirmPayment("sajuabc", d)).toEqual({ ok: false, kind: "not_paid" });
  });

  it("FAILED / CANCELLED / PARTIALLY_CANCELLED 는 not_paid 이고 행을 내린다", async () => {
    for (const status of ["FAILED", "CANCELLED", "PARTIALLY_CANCELLED"] as const) {
      const d = deps({ lookupPayment: vi.fn(async () => ({ ...paid, status })) });
      expect(await confirmPayment("sajuabc", d)).toEqual({ ok: false, kind: "not_paid" });
      expect(d.markFailed).toHaveBeenCalledWith("sajuabc");
      expect(d.markPaid).not.toHaveBeenCalled();
    }
  });

  it("READY / PENDING / VIRTUAL_ACCOUNT_ISSUED 는 not_paid 지만 행을 건드리지 않는다 — 웹훅이 뒤이어 확정할 수 있다", async () => {
    for (const status of ["READY", "PENDING", "VIRTUAL_ACCOUNT_ISSUED"] as const) {
      const d = deps({ lookupPayment: vi.fn(async () => ({ ...paid, status })) });
      expect(await confirmPayment("sajuabc", d)).toEqual({ ok: false, kind: "not_paid" });
      expect(d.markFailed).not.toHaveBeenCalled();
      expect(d.markPaid).not.toHaveBeenCalled();
    }
  });

  it("금액이 다르면 amount_mismatch — 확정하지 않고 행을 내린다", async () => {
    const d = deps({ lookupPayment: vi.fn(async () => ({ ...paid, amount: { total: 100 } })) });
    expect(await confirmPayment("sajuabc", d)).toEqual({ ok: false, kind: "amount_mismatch" });
    expect(d.markPaid).not.toHaveBeenCalled();
    expect(d.markFailed).toHaveBeenCalledWith("sajuabc");
  });

  it("통화가 다르면 currency_mismatch", async () => {
    const d = deps({ lookupPayment: vi.fn(async () => ({ ...paid, currency: "JPY" })) });
    expect(await confirmPayment("sajuabc", d)).toEqual({ ok: false, kind: "currency_mismatch" });
    expect(d.markPaid).not.toHaveBeenCalled();
    expect(d.markFailed).toHaveBeenCalledWith("sajuabc");
  });

  it("transactionId 가 없으면 markPaid 에 null 로 넘긴다", async () => {
    const d = deps({
      lookupPayment: vi.fn(async () => ({ ...paid, transactionId: undefined })),
    });
    await confirmPayment("sajuabc", d);
    expect(d.markPaid).toHaveBeenCalledWith({ paymentId: "sajuabc", transactionId: null });
  });

  it("포트원 조회가 던지면 그대로 올린다 — 일시 장애를 미결제로 접지 않는다", async () => {
    const d = deps({
      lookupPayment: vi.fn(async () => {
        throw new Error("network");
      }),
    });
    await expect(confirmPayment("sajuabc", d)).rejects.toThrow("network");
    expect(d.markFailed).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/payments/confirm.test.ts`
Expected: FAIL — `resolvePayment is not a function` 류(지금 confirm.ts 는 `resolvePayment` 를 부른다).

- [ ] **Step 3: `src/lib/payments/confirm.ts` 전체 교체**

```ts
import type { PortOnePayment } from "./portone";
import type { PendingOrder } from "./store";

export type ConfirmFailure = "not_found" | "not_paid" | "amount_mismatch" | "currency_mismatch";

export type ConfirmResult =
  | { ok: true; kind: "confirmed" | "already" }
  | { ok: false; kind: ConfirmFailure };

export interface ConfirmDeps {
  findOrder(paymentId: string): Promise<PendingOrder | null>;
  /**
   * 포트원 조회 API. 읽기만 한다 — 포트원 결제창이 승인까지 끝내므로 서버가
   * 상태를 바꾸는 호출은 없다. 완료 API·모바일 착지·웹훅이 전부 같은 구현을 쓴다.
   */
  lookupPayment(paymentId: string): Promise<PortOnePayment>;
  /**
   * 갱신된 행이 있으면 true. false 는 이미 다른 경로가 확정했다는 뜻이다.
   * 프로덕션 구현(deps.ts)은 확정과 이용권 적립을 한 문장으로 처리한다 —
   * 이 함수가 true 를 돌려줬다는 것은 적립까지 끝났다는 뜻이다.
   */
  markPaid(a: { paymentId: string; transactionId: string | null }): Promise<boolean>;
  markFailed(paymentId: string): Promise<void>;
}

type StatusClass = "paid" | "dead" | "waiting";

/**
 * 포트원 결제 상태를 세 갈래로 접는다.
 *
 * switch + never 로 쓰는 이유: 포트원이 status 를 하나 추가하면 여기서 컴파일이
 * 깨진다. 모르는 상태가 조용히 "아직 결제 전"으로 흘러가 행을 영원히 pending 으로
 * 남기는 것보다, 빌드가 멈춰서 사람이 판단하는 편이 낫다.
 */
function classify(status: PortOnePayment["status"]): StatusClass {
  switch (status) {
    case "PAID":
      return "paid";
    case "FAILED":
    case "CANCELLED":
    // 부분 취소는 돈이 잡혔다가 일부 돌아간 상태다. 단건 디지털 상품에 이 상태가
    // 나왔다면 정상 결제가 아니므로 행을 내린다 — 그대로 두면 아무도 확정하지 않아
    // 행이 영원히 pending 으로 남는다.
    case "PARTIALLY_CANCELLED":
      return "dead";
    // 아직 결제가 아니지만 죽지도 않았다. 행을 건드리지 않고 물러난다 —
    // 웹훅이 뒤이어 도착하면 그때 확정된다.
    case "READY":
    case "PENDING":
    case "VIRTUAL_ACCOUNT_ISSUED":
      return "waiting";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

/**
 * 결제 확정. 완료 API·모바일 착지 라우트·웹훅이 공유하는 유일한 경로다.
 *
 * 소유 확인을 하지 않는 이유: 웹훅에는 세션이 없다. 호출자(완료 API·착지 라우트)가
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
  if (order.status === "paid") return { ok: true, kind: "already" };

  // 여기서 던지는 예외는 삼키지 않는다. 일시 장애를 "미결제"로 접으면 돈은 받고
  // 이용권은 안 들어온 채 조용히 끝난다 — 호출자가 5xx 로 올려 재시도를 유도해야 한다.
  const payment = await d.lookupPayment(paymentId);

  const statusClass = classify(payment.status);
  if (statusClass === "dead") {
    await d.markFailed(paymentId);
    return { ok: false, kind: "not_paid" };
  }
  if (statusClass === "waiting") return { ok: false, kind: "not_paid" };

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
  if (flipped) return { ok: true, kind: "confirmed" };

  // false 는 "pending 이 아니었다"만 뜻한다 — paid 일 수도, refunded/failed 일 수도 있다.
  // 다시 읽어 확인한다: 다른 경로가 먼저 확정했으면 already 지만, 환불되거나 실패로
  // 내려간 행을 already 로 돌려주면 결제되지 않은 주문이 이용권을 지급받는다.
  const after = await d.findOrder(paymentId);
  if (after?.status === "paid") return { ok: true, kind: "already" };
  return { ok: false, kind: "not_paid" };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/payments/confirm.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: `src/lib/payments/deps.ts` 전체 교체**

```ts
import type { ConfirmDeps } from "./confirm";
import { getPayment } from "./portone";
import { findOrderByPaymentId, markPurchaseFailed } from "./store";
import { confirmPurchaseAndCredit } from "@/lib/tickets/wallet";

/**
 * 프로덕션 확정 의존성. 완료 API·모바일 착지 라우트·웹훅 셋이 같은 조합을 쓴다.
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

- [ ] **Step 6: 커밋**

```powershell
git add src/lib/payments/confirm.ts src/lib/payments/confirm.test.ts src/lib/payments/deps.ts
git commit -m @'
feat(payments): 확정 로직이 포트원 조회 결과로 판단한다

승인 갈래(approveDeps)가 사라지고 조회 하나(confirmDeps)만 남는다.
PAID 만 확정, FAILED/CANCELLED/PARTIALLY_CANCELLED 는 행을 내리고,
READY/PENDING/VIRTUAL_ACCOUNT_ISSUED 는 웹훅을 기다린다.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
'@
```

---

### Task 5: 주문 ID 형식 — KCP 제약(영숫자 40자)

**Files:**
- Modify: `src/lib/payments/order-id.ts` (전체 교체)
- Modify: `src/lib/payments/order-id.test.ts` (전체 교체)
- Modify: `src/lib/payments/pricing.test.ts` (테스트 하나 추가)

**Interfaces:**
- Produces: `PAYMENT_ID_PREFIX = "saju"`, `newPaymentId(): string` (36자, `/^[a-z0-9]+$/`)

- [ ] **Step 1: 실패하는 테스트 — `src/lib/payments/order-id.test.ts` 전체 교체**

```ts
import { describe, it, expect } from "vitest";
import { PAYMENT_ID_PREFIX, newPaymentId } from "./order-id";

describe("newPaymentId", () => {
  it("포트원 콘솔에서 우리 주문임을 알아보게 접두사를 붙인다", () => {
    expect(newPaymentId().startsWith(PAYMENT_ID_PREFIX)).toBe(true);
  });

  it("부를 때마다 다르다 — 같은 ID 를 두 번 쓰면 KCP 가 두 번째 결제를 거부한다", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newPaymentId()));
    expect(ids.size).toBe(100);
  });

  it("영문 소문자·숫자만 쓴다 — KCP 는 paymentId 에 특수문자(하이픈 포함)를 받지 않는다", () => {
    for (let i = 0; i < 20; i++) expect(newPaymentId()).toMatch(/^[a-z0-9]+$/);
  });

  it("40자를 넘지 않는다 — KCP 의 paymentId 상한이다. 접두사 4 + uuid 32 = 36", () => {
    expect(newPaymentId()).toHaveLength(36);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/payments/order-id.test.ts`
Expected: FAIL — 하이픈 때문에 정규식이 안 맞고 길이가 41 이다.

- [ ] **Step 3: `src/lib/payments/order-id.ts` 전체 교체**

```ts
/** 포트원 콘솔과 로그에서 우리 주문임을 한눈에 알아보게 붙인다. */
export const PAYMENT_ID_PREFIX = "saju";

/**
 * 고객사 발급 주문 ID. 예: saju3f0c1a9e….
 * 클라이언트가 만들지 않는다 — 주문 ID 와 청구 금액이 한 곳(주문 생성 API)에서
 * 같이 정해져야 확정 시 대조할 기준이 생긴다.
 *
 * uuid 의 하이픈을 빼는 이유: NHN KCP 는 paymentId 에 영문·숫자만, 최대 40자를
 * 허용한다. `saju-` + uuid 는 41자에 하이픈이 네 개라 두 규칙을 다 어겼다.
 * 빼면 4 + 32 = 36자다. 옛 형식(saju-…)의 기존 행은 그대로 둔다 — 조회는 문자열
 * 일치라 형식이 섞여도 문제없다.
 */
export function newPaymentId(): string {
  return PAYMENT_ID_PREFIX + crypto.randomUUID().replaceAll("-", "");
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/payments/order-id.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: `src/lib/payments/pricing.test.ts` 의 마지막 `describe` 뒤에 아래 블록을 추가**

```ts
describe("packageOrderName", () => {
  it("100바이트를 넘지 않는다 — NHN KCP 의 orderName 상한이다 (한글은 3바이트)", () => {
    for (const p of listPackages()) {
      expect(Buffer.byteLength(packageOrderName(p), "utf8")).toBeLessThanOrEqual(100);
    }
  });
});
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run src/lib/payments/pricing.test.ts`
Expected: PASS

- [ ] **Step 7: 커밋**

```powershell
git add src/lib/payments/order-id.ts src/lib/payments/order-id.test.ts src/lib/payments/pricing.test.ts
git commit -m @'
feat(payments): 주문 ID 를 KCP 제약에 맞춰 영숫자 36자로 만든다

KCP 는 paymentId 에 특수문자를 받지 않고 40자까지만 허용한다.
saju-<uuid> 는 41자에 하이픈이 있어 둘 다 어겼다.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
'@
```

---

### Task 6: 주문 생성 — 응답을 포트원 요청 모양으로

**Files:**
- Modify: `src/lib/payments/order.ts` (전체 교체)
- Modify: `src/app/api/payments/orders/_lib/handler.ts` (전체 교체)
- Modify: `src/app/api/payments/orders/_lib/handler.test.ts` (전체 교체)
- Modify: `src/app/api/payments/orders/route.ts` (전체 교체)

**Interfaces:**
- Consumes: `PaymentChannel`, `PaymentMethodId`, `PAYMENT_METHOD_IDS`, `getStoreId`, `getChannel`, `getAppOrigin` (Task 2); `newPaymentId` (Task 5); `resolveDisplayName` (`@/lib/auth/display-name`), `getUser` (`@/lib/auth/users`), `safeNextPath` (`@/lib/nav/next-param`), `createPendingPurchase` (`store.ts`) — 전부 기존.
- Produces:
  - `OrderBase = { storeId; channelKey; paymentId; orderName; totalAmount: number; currency: "CURRENCY_KRW"; redirectUrl; customer: { fullName: string; email: string } }`
  - `OrderResponse = OrderBase & PaymentRequestKind`
  - `CHECKOUT_NEXT_COOKIE`, `CHECKOUT_NEXT_MAX_AGE` (변경 없음)
  - `CreateOrderDeps`, `CreateOrderResult`, `handleCreateOrder(raw, deps)`

- [ ] **Step 1: 실패하는 테스트 — `src/app/api/payments/orders/_lib/handler.test.ts` 전체 교체**

```ts
import { describe, it, expect, vi } from "vitest";
import { handleCreateOrder, type CreateOrderDeps } from "./handler";

function deps(over: Partial<CreateOrderDeps> = {}): CreateOrderDeps {
  return {
    userId: "7",
    getStoreId: () => "store-1",
    getChannel: () => ({ channelKey: "ch-kcp", payMethod: "CARD" }),
    getAppOrigin: () => "https://saju.example",
    newPaymentId: () => "sajuabc",
    getBuyer: async () => ({ displayName: "김동진", email: "buyer@example.com" }),
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
      paymentId: "sajuabc",
      product: "t5",
      amount: 5000,
      tickets: 6,
    });
  });

  it("응답 금액은 pending 행에 박은 금액과 같다 — 갈라지면 확정에서 금액 불일치가 난다", async () => {
    const r = await handleCreateOrder(body, deps());
    expect(r.body).toMatchObject({
      storeId: "store-1",
      channelKey: "ch-kcp",
      paymentId: "sajuabc",
      payMethod: "CARD",
      orderName: "이용권 6장",
      totalAmount: 5000,
      currency: "CURRENCY_KRW",
    });
  });

  it("paymentId 는 pending 행의 paymentId 와 같은 값이다 — 확정 때 이 값으로 대조한다", async () => {
    let pending: { paymentId: string } | null = null;
    const r = await handleCreateOrder(
      body,
      deps({
        createPending: async (i) => {
          pending = i;
        },
      }),
    );
    expect((r.body as { paymentId: string }).paymentId).toBe(pending!.paymentId);
  });

  it("구매자는 이름과 이메일만 싣는다 — 휴대폰은 받은 적이 없어 보내지 않는다", async () => {
    const r = await handleCreateOrder(body, deps());
    expect(r.body).toMatchObject({
      customer: { fullName: "김동진", email: "buyer@example.com" },
    });
    expect((r.body as { customer: object }).customer).not.toHaveProperty("phoneNumber");
  });

  it("표시 이름이 없어도 빈 이름을 내보내지 않는다 — 소셜 제공자가 이름을 안 줄 수 있다", async () => {
    for (const displayName of [null, "", "   "]) {
      const r = await handleCreateOrder(
        body,
        deps({ getBuyer: async () => ({ displayName, email: "buyer@example.com" }) }),
      );
      expect(r.body).toMatchObject({ customer: { fullName: "회원" } });
    }
  });

  it("이메일이 없으면 409 — 이름과 달리 대체값을 지어내지 않는다, pending 행도 만들지 않는다", async () => {
    for (const buyer of [
      null,
      { displayName: "김동진", email: null },
      { displayName: "김동진", email: "  " },
    ]) {
      const createPending = vi.fn(async () => {});
      const r = await handleCreateOrder(body, deps({ getBuyer: async () => buyer, createPending }));
      expect(r.status).toBe(409);
      expect(r.body).toEqual({ error: "이메일 정보가 없습니다. 다시 로그인해 주세요" });
      expect(createPending).not.toHaveBeenCalled();
    }
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

  it("결제 설정이 없으면 503 — 장애가 아니라 미설정이다, pending 행도 만들지 않는다", async () => {
    for (const over of [
      { getStoreId: () => null },
      { getChannel: () => null },
      { getAppOrigin: () => null },
    ] as Partial<CreateOrderDeps>[]) {
      const createPending = vi.fn(async () => {});
      const r = await handleCreateOrder(body, deps({ ...over, createPending }));
      expect(r.status).toBe(503);
      expect(createPending).not.toHaveBeenCalled();
    }
  });

  it("모바일 착지 주소는 쿼리 없이 나간다 — 포트원이 paymentId/code 를 붙이고, 복귀 경로는 쿠키다", async () => {
    const r = await handleCreateOrder(body, deps());
    expect(r.body).toMatchObject({ redirectUrl: "https://saju.example/checkout/complete" });
  });

  it("복귀 경로는 착지 주소가 아니라 next 로 따로 나간다 — 라우트가 쿠키로 심는다", async () => {
    const r = await handleCreateOrder({ ...body, next: "/report?profile=3" }, deps());
    expect(r.next).toBe("/report?profile=3");
    expect(JSON.stringify(r.body)).not.toContain("profile=3");
  });

  it("외부 URL 을 next 로 보내면 홈으로 접는다 — 오픈 리다이렉트를 막는다", async () => {
    const r = await handleCreateOrder({ ...body, next: "https://evil.example" }, deps());
    expect(r.next).toBe("/home");
  });

  it("간편결제는 채널이 준 조합을 그대로 싣는다 — 쪼개면 어긋난 조합이 나간다", async () => {
    const r = await handleCreateOrder(
      { packageId: "t10", method: "toss" },
      deps({
        getChannel: () => ({
          channelKey: "ch-kcp",
          payMethod: "EASY_PAY",
          easyPayProvider: "TOSSPAY",
        }),
      }),
    );
    expect(r.body).toMatchObject({
      channelKey: "ch-kcp",
      payMethod: "EASY_PAY",
      easyPayProvider: "TOSSPAY",
      orderName: "이용권 13장",
      totalAmount: 10000,
    });
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/payments/orders/_lib/handler.test.ts`
Expected: FAIL — `d.getClientKey is not a function`.

- [ ] **Step 3: `src/lib/payments/order.ts` 전체 교체**

```ts
import type { PaymentRequestKind } from "./config";

/**
 * 주문 생성 API 응답 타입은 여기서 소유한다 — API 라우트(`_lib/handler.ts`)와
 * 결제 화면(`checkout/_hooks/use-payment.ts`)이 같은 모양을 봐야 하는데,
 * 어느 한쪽의 폴더에 두면 다른 쪽이 그 폴더 내부(`_lib`)를 들여다보게 된다.
 *
 * 브라우저가 포트원 requestPayment 에 그대로 펼쳐 넣는 값들.
 */
export interface OrderBase {
  /** 결제창을 여는 값들. 서버가 실어 보낸다 — config.ts 주석 참조. */
  storeId: string;
  channelKey: string;
  /** 우리가 발급한 주문 ID. purchases.payment_id 와 같은 값이고 포트원의 paymentId 다. */
  paymentId: string;
  orderName: string;
  totalAmount: number;
  /** 포트원 요청용 통화 코드. 조회 응답의 "KRW" 와 문자열이 다르다. */
  currency: "CURRENCY_KRW";
  /** 모바일에서 결제창이 돌아올 자리. 포트원이 paymentId·code·message 를 쿼리로 붙인다. */
  redirectUrl: string;
  /**
   * 결제창에 찍히는 구매자. 휴대폰은 없다 — 소셜 로그인이 주지 않아 받아 낼 자리가
   * 없고, KCP 문서상 선택 항목이다. 이메일은 영수증과 결제 문의 대응에 필요하다.
   */
  customer: { fullName: string; email: string };
}

/**
 * 결제수단 부분은 config 의 PaymentRequestKind 를 그대로 쓴다 — 서버가 고른 조합과
 * 브라우저가 보내는 조합이 같은 타입이라 둘이 어긋날 수 없다.
 */
export type OrderResponse = OrderBase & PaymentRequestKind;

/**
 * 결제 후 돌아갈 자리를 담는 쿠키. 주문 생성이 심고, 착지 라우트가 읽고 지운다.
 *
 * redirectUrl 쿼리가 아니라 쿠키인 이유: 토스 시절 successUrl 에 쿼리를 실을 수 없어
 * 생겼고, 포트원으로 돌아오면서도 그대로 둔다 — 이미 있고 테스트돼 있으며, 착지
 * 라우트가 주소창의 next 를 다시 검사할 일이 없어진다.
 * sameSite=lax 로 충분하다 — 결제창에서 돌아오는 것은 top-level GET 이동이다.
 */
export const CHECKOUT_NEXT_COOKIE = "checkout_next";

/** 결제창에 머무는 시간까지만 살면 된다. 지나면 착지 라우트가 /home 으로 접는다. */
export const CHECKOUT_NEXT_MAX_AGE = 60 * 30; // 30분
```

- [ ] **Step 4: `src/app/api/payments/orders/_lib/handler.ts` 전체 교체**

```ts
import { z } from "zod";
import {
  PAYMENT_METHOD_IDS,
  type PaymentChannel,
  type PaymentMethodId,
} from "@/lib/payments/config";
import {
  TICKET_PACKAGE_IDS,
  creditedTickets,
  getPackage,
  packageOrderName,
} from "@/lib/payments/pricing";
import type { OrderResponse } from "@/lib/payments/order";
import { resolveDisplayName } from "@/lib/auth/display-name";
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
  /** 결제창에 넘길 구매자. 행이 없거나 필드가 비어 있을 수 있다. */
  getBuyer(userId: string): Promise<{ displayName: string | null; email: string | null } | null>;
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
  /**
   * 결제 후 돌아갈 자리. 200 일 때만 실린다.
   *
   * 응답 본문이 아니라 따로 내보내는 이유: 라우트가 이 값을 쿠키로 심는다
   * (order.ts 의 CHECKOUT_NEXT_COOKIE 주석 참조).
   */
  next?: string;
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

  const buyer = await d.getBuyer(d.userId);

  // 이메일에는 대체값이 없다. 이름과 달리 아무 값이나 채우면 영수증이 아무 데도
  // 가지 않는다. 로그인이 이메일을 요구하게 됐으니(MissingEmailError) 비어 있는 것은
  // 그 규칙 이전에 가입한 행뿐이다 — 다시 로그인하면 채워진다.
  const email = buyer?.email?.trim();
  if (!email) {
    return { status: 409, body: { error: "이메일 정보가 없습니다. 다시 로그인해 주세요" } };
  }

  // 이름은 헤더에 쓰는 표시 이름을 그대로 쓴다 — 별도로 입력받지 않는다.
  // resolveDisplayName 을 거치는 이유: 빈 이름을 결제창에 넘기지 않기 위해서다.
  const fullName = resolveDisplayName({ displayName: buyer?.displayName ?? null });

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
    next,
    body: {
      storeId,
      paymentId,
      // 채널키와 판별자를 한 덩이로 넘긴다 — 따로 옮기면 payMethod 와
      // easyPayProvider 가 어긋난 조합을 만들 수 있다.
      ...channel,
      orderName: packageOrderName(pkg),
      totalAmount: pkg.amount,
      currency: "CURRENCY_KRW",
      // 모바일은 결제창이 페이지를 떠난다. 돌아올 자리를 여기서 정한다.
      // 쿼리는 싣지 않는다 — 포트원이 자기 쿼리를 붙이고, 복귀 경로는 쿠키로 간다.
      redirectUrl: `${origin}/checkout/complete`,
      customer: { fullName, email },
    },
  };
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/app/api/payments/orders/_lib/handler.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 6: `src/app/api/payments/orders/route.ts` 전체 교체**

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { getAppOrigin, getChannel, getStoreId } from "@/lib/payments/config";
import { newPaymentId } from "@/lib/payments/order-id";
import { CHECKOUT_NEXT_COOKIE, CHECKOUT_NEXT_MAX_AGE } from "@/lib/payments/order";
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
      getBuyer: (userId) => getUser(userId),
      createPending: (i) => createPendingPurchase(i),
    });

    const res = NextResponse.json(result.body, { status: result.status });
    // 복귀 경로는 응답이 아니라 쿠키로 나간다 (order.ts 의 CHECKOUT_NEXT_COOKIE 주석 참조).
    if (result.next !== undefined) {
      res.cookies.set(CHECKOUT_NEXT_COOKIE, result.next, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: CHECKOUT_NEXT_MAX_AGE,
      });
    }
    return res;
  } catch (e) {
    console.error("[POST /api/payments/orders]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
```

- [ ] **Step 7: 커밋**

```powershell
git add src/lib/payments/order.ts src/app/api/payments/orders
git commit -m @'
feat(payments): 주문 생성이 포트원 결제창 파라미터를 응답한다

storeId·channelKey·paymentId·customer 를 싣고 redirectUrl 은 쿼리 없이
나간다. 복귀 경로는 checkout_next 쿠키가 그대로 맡는다.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
'@
```

---

### Task 7: 완료 API — PC 결제창이 돌아온 뒤 확정

**Files:**
- Create: `src/app/api/payments/complete/_lib/handler.ts`
- Create: `src/app/api/payments/complete/_lib/handler.test.ts`
- Create: `src/app/api/payments/complete/route.ts`

**Interfaces:**
- Consumes: `confirmPayment`, `ConfirmResult`, `ConfirmFailure` (Task 4); `confirmDeps` (Task 4); `PortOneNotConfiguredError` (Task 3); `findOrderByPaymentId`, `PendingOrder` (`store.ts`); `getSession` (`@/lib/auth/session`)
- Produces: `POST /api/payments/complete` — 요청 `{ paymentId }`, 응답 200 `{ ok: true }` / 4xx `{ error, kind? }` / 503 `{ error }`. Task 9 의 훅이 부른다.

- [ ] **Step 1: 실패하는 테스트 — `src/app/api/payments/complete/_lib/handler.test.ts` 생성**

```ts
import { describe, it, expect, vi } from "vitest";
import { handleComplete, type CompleteDeps } from "./handler";

const order = {
  paymentId: "sajuabc",
  userId: "7",
  amount: 5000,
  status: "pending" as const,
};

function deps(over: Partial<CompleteDeps> = {}): CompleteDeps {
  return {
    userId: "7",
    findOrder: vi.fn(async () => order),
    confirm: vi.fn(async () => ({ ok: true as const, kind: "confirmed" as const })),
    ...over,
  };
}

const body = { paymentId: "sajuabc" };

describe("handleComplete", () => {
  it("확정되면 200 — 장수와 잔액은 싣지 않는다, 완료 화면이 DB 에서 직접 읽는다", async () => {
    expect(await handleComplete(body, deps())).toEqual({ status: 200, body: { ok: true } });
  });

  it("이미 확정된 주문도 200 — 웹훅이 먼저 도착한 정상 경로다", async () => {
    const r = await handleComplete(
      body,
      deps({ confirm: vi.fn(async () => ({ ok: true as const, kind: "already" as const })) }),
    );
    expect(r).toEqual({ status: 200, body: { ok: true } });
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
    await handleComplete(
      body,
      deps({ confirm, findOrder: vi.fn(async () => ({ ...order, userId: "9" })) }),
    );
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

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/payments/complete/_lib/handler.test.ts`
Expected: FAIL — `./handler` 모듈을 찾을 수 없다.

- [ ] **Step 3: `src/app/api/payments/complete/_lib/handler.ts` 생성**

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
}

export interface CompleteResult {
  status: number;
  body: { ok: true } | { error: string; kind?: string };
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

/**
 * PC 결제창이 제자리에서 돌아온 뒤 브라우저가 부르는 확정.
 *
 * 응답에 장수·잔액을 싣지 않는 이유: 완료 화면(/checkout/done)이 주문 행과 지갑에서
 * 직접 읽는다. 여기서도 실으면 같은 숫자를 읽는 곳이 둘이 된다.
 */
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
  if (result.ok) return { status: 200, body: { ok: true } };

  return {
    status: FAILURE_STATUS[result.kind],
    body: { error: "결제를 확인하지 못했습니다", kind: result.kind },
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/api/payments/complete/_lib/handler.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: `src/app/api/payments/complete/route.ts` 생성**

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

- [ ] **Step 6: 커밋**

```powershell
git add src/app/api/payments/complete
git commit -m @'
feat(payments): PC 결제창이 돌아온 뒤 부를 완료 API 를 되살린다

소유를 확인하고 포트원 조회로 확정한다. 장수·잔액은 싣지 않는다 —
완료 화면이 DB 에서 직접 읽는다.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
'@
```

---

### Task 8: 모바일 착지 라우트와 서명 검증 웹훅

**Files:**
- Modify: `src/app/checkout/complete/route.ts` (전체 교체)
- Modify: `src/app/api/payments/webhook/_lib/handler.ts` (전체 교체)
- Modify: `src/app/api/payments/webhook/_lib/handler.test.ts` (전체 교체)
- Modify: `src/app/api/payments/webhook/route.ts` (전체 교체)

**Interfaces:**
- Consumes: `confirmPayment`, `confirmDeps` (Task 4); `getWebhookSecret` (Task 2); `CHECKOUT_NEXT_COOKIE` (Task 6); `PortOne.Webhook.verify(secret, body, headers)` from `@portone/server-sdk` (Task 1)
- Produces:
  - `GET /checkout/complete?paymentId=…` 또는 `?code=…` → 302
  - `handleWebhook(rawBody: string, headers: Record<string,string>, deps: WebhookDeps): Promise<WebhookResult>`, `WebhookDeps = { verify(rawBody, headers): Promise<void>; confirm(paymentId): Promise<ConfirmResult> }`

- [ ] **Step 1: 실패하는 테스트 — `src/app/api/payments/webhook/_lib/handler.test.ts` 전체 교체**

```ts
import { describe, it, expect, vi } from "vitest";
import { handleWebhook, type WebhookDeps } from "./handler";

const paidBody = JSON.stringify({
  type: "Transaction.Paid",
  timestamp: "2026-09-06T00:00:00.000Z",
  data: { storeId: "store-1", paymentId: "sajuabc", transactionId: "tx-1" },
});

function deps(over: Partial<WebhookDeps> = {}): WebhookDeps {
  return {
    verify: vi.fn(async () => {}),
    confirm: vi.fn(async () => ({ ok: true as const, kind: "confirmed" as const })),
    ...over,
  };
}

const headers = { "webhook-id": "msg-1" };

describe("handleWebhook", () => {
  it("Transaction.Paid 를 확정으로 넘기고 200", async () => {
    const d = deps();
    expect((await handleWebhook(paidBody, headers, d)).status).toBe(200);
    expect(d.confirm).toHaveBeenCalledWith("sajuabc");
  });

  it("서명 검증이 던지면 400 이고 확정하지 않는다 — 위조된 결제 완료를 막는 유일한 문", async () => {
    const d = deps({
      verify: vi.fn(async () => {
        throw new Error("bad signature");
      }),
    });
    const r = await handleWebhook(paidBody, headers, d);
    expect(r).toEqual({ status: 400, body: { ok: false, reason: "invalid_signature" } });
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
        return { ok: true as const, kind: "confirmed" as const };
      }),
    });
    await handleWebhook(paidBody, headers, d);
    expect(order).toEqual(["verify", "confirm"]);
  });

  it("서명이 틀리면 본문이 깨져 있어도 invalid_signature 다 — 검증이 파싱보다 먼저라는 증거", async () => {
    // confirm 순서 테스트는 confirm 이 파싱 뒤에 오므로 JSON.parse 를 verify 앞으로
    // 옮겨도 통과해 버린다. 이 테스트는 파싱 자체가 verify 실패를 가리지 못하게 막는다 —
    // 본문을 깨뜨려서, 파싱이 먼저 일어났다면 reason 이 invalid_body 로 바뀌게 만든다.
    const d = deps({
      verify: vi.fn(async () => {
        throw new Error("bad signature");
      }),
    });
    const r = await handleWebhook("not json", headers, d);
    expect(r).toEqual({ status: 400, body: { ok: false, reason: "invalid_signature" } });
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it("Paid 가 아닌 이벤트는 200 으로 흘려보낸다", async () => {
    const d = deps();
    const body = JSON.stringify({
      type: "Transaction.Ready",
      data: { paymentId: "sajuabc" },
    });
    expect((await handleWebhook(body, headers, d)).status).toBe(200);
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it("본문이 JSON 이 아니거나 모양이 다르면 400 과 invalid_body", async () => {
    for (const bad of ["not json", "{}", '{"type":"Transaction.Paid"}']) {
      const r = await handleWebhook(bad, headers, deps());
      expect(r).toEqual({ status: 400, body: { ok: false, reason: "invalid_body" } });
    }
  });

  it("not_found / 불일치는 200 — 재시도해도 결과가 같고 reason 에 사유가 실린다", async () => {
    for (const kind of ["not_found", "amount_mismatch", "currency_mismatch"] as const) {
      const d = deps({ confirm: vi.fn(async () => ({ ok: false as const, kind })) });
      const r = await handleWebhook(paidBody, headers, d);
      expect(r).toEqual({ status: 200, body: { ok: false, reason: kind } });
    }
  });

  it("not_paid 는 200 — 아직 결제 전일 뿐이고 다음 웹훅이 온다", async () => {
    const d = deps({
      confirm: vi.fn(async () => ({ ok: false as const, kind: "not_paid" as const })),
    });
    const r = await handleWebhook(paidBody, headers, d);
    expect(r).toEqual({ status: 200, body: { ok: false, reason: "not_paid" } });
  });

  it("확정이 던지면 500 과 confirm_error — 포트원의 재시도를 유도한다", async () => {
    const d = deps({
      confirm: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    const r = await handleWebhook(paidBody, headers, d);
    expect(r).toEqual({ status: 500, body: { ok: false, reason: "confirm_error" } });
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/payments/webhook/_lib/handler.test.ts`
Expected: FAIL — 지금 핸들러는 인자가 둘이고 `eventType` 을 본다.

- [ ] **Step 3: `src/app/api/payments/webhook/_lib/handler.ts` 전체 교체**

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
    // not_paid 는 가상계좌 발급·결제 대기 같은 정상 경로에서도 나온다(confirmPayment 의
    // waiting 갈래) — error 로 찍으면 평상시에도 로그가 쌓여 진짜 이상 신호인
    // amount_mismatch/currency_mismatch 가 묻힌다. 재시도해도 결과가 같다는 점은 같으므로
    // 200 으로 닫는 것은 공통이고, 로그 레벨만 가른다.
    if (result.kind === "not_paid") {
      console.warn(`[webhook] 아직 결제 전 paymentId=${paymentId}`);
    } else {
      console.error(`[webhook] 확정 실패 paymentId=${paymentId} kind=${result.kind}`);
    }
    return { status: 200, body: { ok: false, reason: result.kind } };
  } catch (e) {
    // 조회 장애·DB 장애. 다시 보내달라는 뜻으로 5xx 를 준다.
    console.error("[webhook] 확정 중 예외", e);
    return { status: 500, body: { ok: false, reason: "confirm_error" } };
  }
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/api/payments/webhook/_lib/handler.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: `src/app/api/payments/webhook/route.ts` 전체 교체**

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

- [ ] **Step 6: `src/app/checkout/complete/route.ts` 전체 교체**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { confirmPayment } from "@/lib/payments/confirm";
import { confirmDeps } from "@/lib/payments/deps";
import { CHECKOUT_NEXT_COOKIE } from "@/lib/payments/order";
import { findOrderByPaymentId } from "@/lib/payments/store";
import { safeNextPath } from "@/lib/nav/next-param";

/** backTo 에 이미 쿼리가 있으면 &, 없으면 ? 로 이어 붙인다 — 실패 리다이렉트가 공유한다. */
function withErrorMarker(backTo: string): string {
  return `${backTo}${backTo.includes("?") ? "&" : "?"}error=1`;
}

/**
 * 모바일 결제창이 돌아오는 자리. 포트원이 ?paymentId(진행) 또는 ?code·?message(실패)를
 * 붙여 보낸다. 복귀 경로는 쿠키에서 읽는다. 확정이 끝나면 완료 화면(/checkout/done)으로,
 * 실패하면 충전 화면으로 되돌린다.
 *
 * 페이지가 아니라 라우트 핸들러인 이유:
 *  1. 이 자리는 화면을 그린 적이 없다 — 확정하고 곧장 옮긴다.
 *  2. 쓰고 버려야 할 쿠키(checkout_next)를 지워야 하는데, 서버 컴포넌트 렌더 중에는
 *     쿠키를 지울 수 없다(Next 문서: .delete 는 Server Function·Route Handler 에서만).
 *
 * 승인을 부르지 않는다 — 포트원 결제창이 이미 승인까지 끝냈다. 여기서는 조회로
 * "정말 PAID 인지, 금액이 맞는지"만 확인한다. PC 는 이 자리를 지나지 않고
 * /api/payments/complete 로 같은 확인을 한다.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams;

  // ⚠️ 쿠키 값도 다시 safeNextPath 에 통과시킨다. 주소창으로 이 자리에 직접 닿을 수
  // 있고, 쿠키는 우리가 심었다는 보장이 브라우저 쪽에 없다.
  const next = safeNextPath(req.cookies.get(CHECKOUT_NEXT_COOKIE)?.value);
  // 실패하면 충전 화면으로 되돌린다 — 복귀 경로는 그대로 들고 간다.
  const backTo = `/checkout?next=${encodeURIComponent(next)}`;

  /** 어디로 가든 쓰고 버릴 쿠키는 여기서 지운다. */
  const go = (path: string): NextResponse => {
    const res = NextResponse.redirect(new URL(path, req.nextUrl.origin));
    res.cookies.delete(CHECKOUT_NEXT_COOKIE);
    return res;
  };

  // 포트원이 실패를 code 로 알려준다. 확정을 시도할 이유가 없다.
  if (q.get("code")) return go(withErrorMarker(backTo));

  const paymentId = q.get("paymentId");
  // 포트원은 정상적으로 돌아올 때 code(실패) 아니면 paymentId(진행) 를 반드시
  // 싣는다 — 둘 다 없이 여기 닿는 건 결제를 시도한 적 없는 방문(주소 직접 입력·
  // 북마크)뿐이다. 시도하지 않은 사용자에게 오류 배너를 띄우지 않는다.
  if (!paymentId) return go(backTo);

  const session = await getSession();
  if (session === null) return go(`/login?next=${encodeURIComponent(backTo)}`);

  // 남의 주문을 확정해 주지 않는다. 없는 주문과 남의 주문을 구분하지 않는다:
  // 구분하면 paymentId 로 존재 여부를 훑을 수 있다.
  const order = await findOrderByPaymentId(paymentId);
  if (order === null || order.userId !== session.userId) return go(withErrorMarker(backTo));

  let ok = false;
  try {
    const result = await confirmPayment(paymentId, confirmDeps);
    ok = result.ok;
  } catch (e) {
    // 조회 장애면 웹훅이 뒤이어 확정한다. 사용자를 충전 화면으로 돌려보내면
    // 잔액이 이미 올라가 있는 경우 화면이 그 값을 보여준다.
    console.error("[/checkout/complete] 확정 실패", e);
  }

  if (!ok) return go(withErrorMarker(backTo));

  // 곧장 next 로 보내지 않고 완료 화면을 한 번 거친다 — 결제창에서 튕겨 나오자마자
  // 원래 화면이 뜨면 무엇이 늘었는지 알 자리가 없다. 그 화면이 2.6초 뒤 next 로 옮긴다.
  // orderId 만 넘기고 장수는 넘기지 않는다: 화면이 DB 에서 직접 읽는다.
  const q2 = new URLSearchParams({ orderId: paymentId, next });
  return go(`/checkout/done?${q2}`);
}
```

- [ ] **Step 7: 커밋**

```powershell
git add src/app/checkout/complete/route.ts src/app/api/payments/webhook
git commit -m @'
feat(payments): 모바일 착지가 조회로 확정하고 웹훅이 서명을 다시 검증한다

포트원은 ?paymentId 로 돌아오고 승인은 결제창이 끝냈으므로 착지에서
금액 쿼리 대조와 승인 호출이 사라진다. 웹훅은 시크릿 없이는 503 이고
원문을 포트원 SDK 로 검증한 뒤에야 파싱한다.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
'@
```

---

### Task 9: 브라우저 훅, 화면 문구, provider 값, 남은 토스 흔적

**Files:**
- Modify: `src/app/checkout/_hooks/use-payment.ts` (전체 교체)
- Modify: `src/app/checkout/_components/OrderSummary.tsx:107`
- Modify: `src/app/checkout/_lib/methods.ts:1-2` (주석)
- Modify: `src/app/(legal)/privacy/page.tsx:47`, `src/app/(legal)/terms/page.tsx:35`
- Modify: `src/lib/payments/store.ts` (provider 값·주석), `src/lib/payments/store.test.ts:54`
- Modify: `src/lib/auth/callback.ts:9` (주석)

**Interfaces:**
- Consumes: `OrderResponse` (Task 6); `POST /api/payments/orders`, `POST /api/payments/complete` (Task 6·7); `@portone/browser-sdk/v2` `requestPayment` (Task 1)
- Produces: `usePayment(next): { pay(packageId, method), status, error }` — `CheckoutView.tsx` 가 그대로 쓴다(변경 없음).

- [ ] **Step 1: `src/lib/payments/store.test.ts` 54행의 기대값을 바꾼다**

```ts
    expect(calls[0].sql).toContain("'portone'");
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/payments/store.test.ts`
Expected: FAIL — SQL 에 `'tosspayments'` 가 들어 있다.

- [ ] **Step 3: `src/lib/payments/store.ts` 를 고친다**

`createPendingPurchase` 의 INSERT 값 `'tosspayments'` 를 `'portone'` 으로:

```ts
      ${input.amount}, ${input.tickets}, 'KRW', 'pending', 'portone', ${input.paymentId}
```

`PendingOrder.amount` 주석을 `/** 주문 생성 시점에 서버가 박아 둔 청구 금액. 포트원 조회 결과와 대조하는 기준이다. */` 로, `markPurchaseFailed` 주석을 `/** 금액·통화가 어긋났거나 포트원이 실패로 끝낸 주문을 내린다. */` 로 바꾼다.

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/payments/store.test.ts`
Expected: PASS

- [ ] **Step 5: `src/app/checkout/_hooks/use-payment.ts` 전체 교체**

```ts
"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import * as PortOne from "@portone/browser-sdk/v2";
import type { PaymentMethodId } from "../_lib/methods";
import type { TicketPackageId } from "../_lib/pricing";
import type { OrderResponse } from "@/lib/payments/order";

export type PaymentStatus = "idle" | "pending";

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
 * 결제 시작. 주문 생성 → 결제창 → 완료 확정 → 완료 화면.
 *
 * 금액·상품명을 여기서 만들지 않는다 — 전부 주문 생성 응답에서 온다.
 * 브라우저가 정할 수 있는 값은 "어느 패키지를 어느 수단으로" 뿐이다.
 *
 * 완료 API 를 브라우저가 불러도 되는 이유: 포트원 결제창이 승인까지 끝냈다.
 * 사용자가 그 사이 창을 닫아도 돈은 이미 잡혔고, 웹훅이 뒤이어 확정한다.
 * (토스 시절엔 승인이 서버 몫이라 이 자리에 확정 호출을 둘 수 없었다.)
 */
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

        // 공통 값과 판별자를 나눈다 — 우리 OrderResponse 가 payMethod 로 갈라지는
        // 판별 유니온이라 이걸 좁혀서 쓴다. SDK 의 PaymentRequest 타입은
        // easyPay 를 옵셔널로 받을 뿐이라, 스프레드만으로는 provider 누락을 잡아 주지 않는다.
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
          customer: order.customer,
        };

        // 간편결제는 허브형으로 직접 연다 — 채널이 KCP 하나뿐이라
        // 어느 간편결제인지는 easyPayProvider 만이 결정한다.
        const res =
          order.payMethod === "EASY_PAY"
            ? await PortOne.requestPayment({
                ...base,
                payMethod: "EASY_PAY",
                easyPay: { easyPayProvider: order.easyPayProvider },
              })
            : await PortOne.requestPayment({ ...base, payMethod: "CARD" });

        // 모바일은 여기까지 오지 않는다 — 결제창이 페이지를 떠났고,
        // 돌아올 때는 /checkout/complete 가 받는다.
        // code 가 있으면 실패다. 사용자가 결제창을 닫아도 이 갈래로 온다.
        if (res?.code != null) throw new Error(res.message ?? "결제가 취소되었습니다");

        await postJson("/api/payments/complete", { paymentId: order.paymentId });
        // 모바일 착지와 같은 완료 화면으로 모은다. replace 인 이유: 뒤로 가기로 충전
        // 화면에 돌아와도 이미 충전이 끝나 있어 히스토리에 남길 이유가 없다.
        const q = new URLSearchParams({ orderId: order.paymentId, next });
        router.replace(`/checkout/done?${q}`);
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

- [ ] **Step 6: 문구·주석을 바꾼다**

`src/app/checkout/_components/OrderSummary.tsx` 107행:
```tsx
          PortOne 보안 결제 · NHN KCP
```

`src/app/checkout/_lib/methods.ts` 는 손대지 않는다 — 주석이 이미 PG 중립("config.ts 의 PaymentRequestKind 와 짝지어진다")이고 `id: "toss"` 는 토스페이 수단이라 남는 것이 맞다.

`src/app/(legal)/privacy/page.tsx` 47행:
```tsx
        <li>PortOne 및 연동 결제대행사(NHN KCP 등): 결제·환불 처리</li>
```

`src/app/(legal)/terms/page.tsx` 35행의 `결제대행사(토스페이먼츠` 를 `결제대행사(PortOne 및` 로 바꾼다. 36행이 `연동 PG)를 통한 …` 로 시작하므로 이어 읽으면 "PortOne 및 연동 PG" 가 된다.

`src/lib/auth/callback.ts` 9행:
```ts
 * 포트원·KCP 는 구매자 이메일을 필수로 요구하지 않는다. 그래도 막는 이유는
```

- [ ] **Step 7: 전체 검증을 돌린다 — 여기서 처음으로 전부 초록이어야 한다**

Run: `npm run typecheck`
Expected: 오류 0.

Run: `npm run lint`
Expected: 오류 0.

Run: `npm test`
Expected: 전부 PASS. 토스 관련 파일이 하나도 남아 있지 않다.

Run: `git grep -n -E "tosspayments|TOSS_|paymentKey|approvePayment|approveDeps|lookupDeps|flowMode|successUrl|failUrl" -- src`
Expected: 결과 없음. (수단 id `toss` 와 `TOSSPAY` 는 토스페이 간편결제라 남는 것이 맞고, 위 패턴은 토스페이먼츠 직결 시절에만 있던 이름들이다.)

- [ ] **Step 8: 커밋**

```powershell
git add src/app/checkout src/app/(legal) src/lib/payments/store.ts src/lib/payments/store.test.ts src/lib/auth/callback.ts
git commit -m @'
feat(checkout): 결제창을 포트원 SDK 로 열고 완료 화면으로 모은다

PC 는 완료 API 뒤 /checkout/done 으로, 모바일은 착지 라우트가 같은
곳으로 보낸다. 화면과 약관의 결제대행사 표기를 PortOne · NHN KCP 로,
purchases.provider 를 portone 으로 바꾼다.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
'@
```

---

### Task 10: 운영 문서

**Files:**
- Modify: `docs/issues/payment.md` (ISSUE-014 절)

- [ ] **Step 1: `docs/issues/payment.md` 의 `## ✅ ISSUE-014.` 제목 바로 아래 두 문단(`포트원 v2. 설계: …` 부터 `- **키를 채운 뒤 첫 실결제에서 확인할 것**은 설계 문서 §11 에 있다.` 까지)을 아래로 교체**

```markdown
포트원 v2 + **NHN KCP 채널 하나**(카드·네이버페이·카카오페이·토스페이). 설계: `docs/superpowers/specs/2026-09-06-portone-kcp-design.md`.

이력: 2026-08-11 포트원 최초 연동 → 08-12 KG이니시스 단일 채널 → 08-20 이니시스가 구매자 휴대폰을 요구해 토스페이먼츠 직결로 교체 → **2026-09-06 토스 심사 지연으로 포트원 + KCP 로 복귀.** 토스 코드는 커밋 `11483ff`~`0386ba1` 사이에 있다.

- 주문 생성 → 결제창(포트원이 승인까지) → 완료 API(PC) / 착지 라우트(모바일) / 웹훅 삼중 확정. 판단은 언제나 포트원 조회 API 결과다. 금액은 `purchases.amount` 로만 대조한다.
- 노출 수단은 `PORTONE_METHODS` env 가 정한다. 간편결제는 포트원 콘솔의 KCP 채널에 제휴가 켜진 뒤에만 켠다 — 계약 없이 켜면 화면에는 뜨고 결제창에서 실패한다.
- 주문 ID 는 `saju` + 32자(하이픈 없는 uuid). KCP 가 영숫자 40자만 받는다. 옛 `saju-…` 행은 그대로다.
- 구매자 정보는 이름·이메일만 보낸다. 휴대폰은 없다 — KCP 가 실제로 요구하면 입력 UI 는 별건.
- 환불·취소 API 는 범위 밖. 당분간 포트원 콘솔에서 수동으로 한다(아래).
```

- [ ] **Step 2: 같은 파일의 "환불 처리 (수동)" 절 첫 문단에서 `Transaction.Cancelled` 웹훅 설명은 그대로 두고, SQL 의 주석 `<포트원 paymentId>` 도 그대로 둔다(포트원 기준이라 다시 맞다). 변경 없음을 확인만 한다.**

- [ ] **Step 3: 커밋**

```powershell
git add docs/issues/payment.md
git commit -m @'
docs(payments): 결제 이슈 문서를 포트원 + KCP 기준으로 되돌린다

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
'@
```

---

### Task 11: KCP 테스트 채널로 결제창 수동 확인

이 태스크는 코드를 바꾸지 않는다. 사람이 포트원 콘솔에서 KCP 테스트 채널을 만들고 `.env.local` 을 채운 뒤에만 할 수 있다.

**사전 조건 (사용자가 한다):** 포트원 콘솔 > 결제 연동 > 채널 추가 > NHN KCP(V2), 테스트 모드. `.env.local` 에 `PORTONE_STORE_ID`, `PORTONE_API_SECRET`, `PORTONE_WEBHOOK_SECRET`, `PORTONE_CHANNEL_KEY_KCP`, `PORTONE_METHODS=card,kakao`, `APP_ORIGIN=http://localhost:3000`.

- [ ] **Step 1: dev 서버를 띄운다** — `.claude/launch.json` 의 dev 항목으로 `preview_start`. 로그인 뒤 `/checkout?next=/home` 을 연다.

- [ ] **Step 2: 카드.** 카드 → 동의 → 결제하기. 확인:
  - KCP 결제창이 뜬다(수단 선택 화면이 아니라 카드 화면).
  - 구매자 정보 오류(이름·연락처 누락 등)가 뜨지 않는다. **뜨면 여기서 멈추고 오류 문구를 그대로 기록한다** — 휴대폰 입력 UI 는 별건이다.
  - 테스트 카드로 인증 → 페이지가 `/checkout/done` 을 지나 `/home` 으로 옮기고 잔액이 올라간다.
  - `preview_logs` 에 `[confirmPayment]`·`[/checkout/complete]` 오류가 없다.

- [ ] **Step 3: 카카오페이.** 카카오페이 → 결제하기. 확인: 카카오페이 창이 직접 열린다(KCP 수단 선택 화면이 아니라).

- [ ] **Step 4: 취소.** 결제창을 닫는다. 확인: 충전 화면에 실패 배너, 잔액 변화 없음, DB 행은 `pending`(다음 주문에서 새 행).

- [ ] **Step 5: 웹훅.** 포트원 콘솔 > 웹훅 > 테스트 발송을 로컬 터널(예: `cloudflared tunnel --url http://localhost:3000`) 주소로 보낸다. 확인: 서명 검증이 통과해 400 `invalid_signature` 가 아니라 200(모르는 paymentId 면 `not_found`)이 온다.

- [ ] **Step 6: 결과를 `docs/issues/payment.md` ISSUE-014 절 끝에 한 줄로 남긴다** (예: `2026-09-XX KCP 테스트 채널로 카드·카카오페이 결제창 확인. 휴대폰 없이 통과.`) 후 커밋.

```powershell
git add docs/issues/payment.md
git commit -m @'
docs(payments): KCP 테스트 채널 확인 결과를 남긴다

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
'@
```
