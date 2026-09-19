# PG 카드사 심사용 아이디·비밀번호 로그인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 간편 로그인만 있는 사이트에, 카드사 심사 담당자가 아이디·비밀번호로 들어올 수 있는 임시 입구를 `/login` 에 연다. 심사가 끝나면 환경변수만 지워도 즉시 닫힌다.

**Architecture:** 자격은 DB 가 아니라 환경변수 셋(`REVIEW_LOGIN_ID` · `REVIEW_LOGIN_PASSWORD` · `REVIEW_LOGIN_EMAIL`)에 둔다. 셋이 다 있어야 기능이 켜지고, 그 판단은 `reviewLoginConfig()` 한 곳에서만 한다. 로그인에 성공하면 기존 `upsertUser` 로 `provider = "review"` 행을 만들고 기존 세션 JWT 를 그대로 굽는다 — 스키마 변경·마이그레이션 없음. 기존 OAuth 콜백 라우트는 건드리지 않는다(임시 코드가 "파일 4개 삭제 + 로그인 페이지 블록 1개 삭제" 로 걷히게).

> **정정 (2026-09-18, 실행 중):** "마이그레이션 없음" 전제가 틀렸다 — `0002_users.sql` 에 `CHECK (provider IN ('google','line','kakao'))` 가 있어 로그인 성공 갈래가 500 이었다(끝까지 돌려 보는 Step 6 에서 드러났다). 결정: `0049_users_provider_admin.sql` 로 CHECK 를 넓히고, 값은 `"review"` 가 아니라 **`"admin"`** 을 쓴다(나중에 운영 계정에도 쓸 자리). 아래 본문의 `provider = "review"` 와 "DB 마이그레이션 금지" 는 이 정정으로 대체된다. `'admin'` 은 로그인 방식일 뿐 **권한이 아니다.**

**Tech Stack:** Next.js 16.2.10 App Router(Route Handler, Server Component), jose(기존 세션), `node:crypto`(`timingSafeEqual`), vitest.

## Global Constraints

- **AGENTS.md:** 이 Next.js 는 학습 데이터와 다를 수 있다. Route Handler·`formData()`·`NextResponse.redirect` 를 쓰기 전에 `node_modules/next/dist/docs/01-app/` 의 해당 문서를 읽는다.
- **DB 마이그레이션 금지.** 워크트리들이 개발 DB 를 공유한다. 이 작업은 `users` 의 기존 컬럼만 쓴다.
- **기존 파일 수정은 둘뿐:** `src/app/login/page.tsx`, `.env.example`. `src/app/api/auth/callbacks/[provider]/route.ts` 와 `src/lib/auth/*.ts` 기존 파일은 수정하지 않는다.
- 라우트 경로는 `/api/auth/review-login` 이다. `/api/auth/login/review` 로 두지 않는다 — `login/[provider]` 동적 세그먼트와 겹쳐, 정적 세그먼트 우선 규칙에 기대게 된다.
- `provider` 값은 정확히 `"review"`, 표시 이름은 정확히 `"심사용 계정"`, 실패 쿼리는 정확히 `error=review`.
- 실제 심사용 비밀번호를 코드·테스트·커밋·`.env.example`·**이 문서를 포함한 어떤 추적 파일에도** 쓰지 않는다. 테스트와 로컬 검증은 아래에 적힌 더미 값을 쓴다.
- 주석·커밋 메시지는 한국어, 기존 코드의 주석 밀도와 문체를 따른다. 커밋 형식: `feat(auth): …`.
- 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- 작업은 워크트리에서 한다(main 에 consult 쪽 미커밋 변경이 있다). 워크트리에는 `.env.local` 이 없으므로 main 체크아웃에서 복사한다.

---

### Task 1: 자격 설정과 검증 — `src/lib/auth/review-login.ts`

**Files:**
- Create: `src/lib/auth/review-login.ts`
- Test: `src/lib/auth/review-login.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `export const REVIEW_PROVIDER = "review"`
  - `export const REVIEW_DISPLAY_NAME = "심사용 계정"`
  - `export interface ReviewLoginConfig { id: string; password: string; email: string }`
  - `export function reviewLoginConfig(): ReviewLoginConfig | null` — env 셋 중 하나라도 비면 `null`
  - `export function verifyReviewLogin(config: ReviewLoginConfig, id: string, password: string): boolean`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/auth/review-login.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { reviewLoginConfig, verifyReviewLogin } from "./review-login";

const CONFIG = { id: "pgreview", password: "dummy-Pass#1", email: "guest@example.com" };

describe("reviewLoginConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("셋이 다 있으면 설정을 돌려준다", () => {
    vi.stubEnv("REVIEW_LOGIN_ID", "pgreview");
    vi.stubEnv("REVIEW_LOGIN_PASSWORD", "dummy-Pass#1");
    vi.stubEnv("REVIEW_LOGIN_EMAIL", "guest@example.com");
    expect(reviewLoginConfig()).toEqual(CONFIG);
  });

  // 심사가 끝나면 env 를 지워 닫는다 — 하나만 지워도 닫혀야 실수로 반쯤 열린 상태가 없다.
  it.each(["REVIEW_LOGIN_ID", "REVIEW_LOGIN_PASSWORD", "REVIEW_LOGIN_EMAIL"])(
    "%s 가 비면 null — 기능이 꺼진다",
    (missing) => {
      vi.stubEnv("REVIEW_LOGIN_ID", "pgreview");
      vi.stubEnv("REVIEW_LOGIN_PASSWORD", "dummy-Pass#1");
      vi.stubEnv("REVIEW_LOGIN_EMAIL", "guest@example.com");
      vi.stubEnv(missing, "");
      expect(reviewLoginConfig()).toBeNull();
    },
  );

  it("아이디·이메일의 앞뒤 공백은 걷어낸다 — 호스팅 콘솔에 붙여 넣다 딸려 온 공백", () => {
    vi.stubEnv("REVIEW_LOGIN_ID", " pgreview ");
    vi.stubEnv("REVIEW_LOGIN_PASSWORD", "dummy-Pass#1");
    vi.stubEnv("REVIEW_LOGIN_EMAIL", " guest@example.com ");
    expect(reviewLoginConfig()).toEqual(CONFIG);
  });
});

describe("verifyReviewLogin", () => {
  it("아이디·비밀번호가 둘 다 맞으면 true", () => {
    expect(verifyReviewLogin(CONFIG, "pgreview", "dummy-Pass#1")).toBe(true);
  });

  it("담당자가 아이디 뒤에 공백을 붙여 넣어도 통과한다", () => {
    expect(verifyReviewLogin(CONFIG, "pgreview ", "dummy-Pass#1")).toBe(true);
  });

  it("비밀번호는 공백까지 그대로 비교한다", () => {
    expect(verifyReviewLogin(CONFIG, "pgreview", "dummy-Pass#1 ")).toBe(false);
  });

  it("비밀번호가 틀리면 false", () => {
    expect(verifyReviewLogin(CONFIG, "pgreview", "dummy-Pass#2")).toBe(false);
  });

  it("아이디가 틀리면 false", () => {
    expect(verifyReviewLogin(CONFIG, "admin", "dummy-Pass#1")).toBe(false);
  });

  it("길이가 다른 입력에도 throw 하지 않는다 — timingSafeEqual 은 길이가 다르면 던진다", () => {
    expect(verifyReviewLogin(CONFIG, "p", "")).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/lib/auth/review-login.test.ts`
Expected: FAIL — `Failed to resolve import "./review-login"`

- [ ] **Step 3: 구현한다**

`src/lib/auth/review-login.ts`:

```ts
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * PG 카드사 심사용 임시 로그인.
 *
 * 우리는 간편 로그인만 있는데, 카드사 심사는 담당자가 들어올 수 있는 아이디·비밀번호를
 * 요구한다. 그 계정 하나를 위해 비밀번호 가입 체계를 들이지 않고, 자격을 환경변수에 둔다.
 * 셋 중 하나라도 비면 기능 전체가 꺼진다 — 심사가 끝나면 env 를 지우는 것으로 닫는다.
 *
 * ⚠️ 임시 코드다. 걷어낼 때: 이 파일 · review-login.test.ts · api/auth/review-login/ ·
 * login/page.tsx 의 심사용 블록 · .env.example 의 REVIEW_LOGIN_* 를 함께 지운다.
 */

/** users.provider 에 들어가는 값. 소셜 제공자 id("kakao"·"google")와 겹치지 않는다. */
export const REVIEW_PROVIDER = "review";

export const REVIEW_DISPLAY_NAME = "심사용 계정";

export interface ReviewLoginConfig {
  id: string;
  password: string;
  /** 결제창에 구매자 이메일로 넘어간다. 로그인이 이메일을 요구하는 규칙(MissingEmailError)과 같은 이유. */
  email: string;
}

/** "켜짐/꺼짐" 의 유일한 출처. 페이지와 라우트가 같은 답을 보게 여기서만 env 를 읽는다. */
export function reviewLoginConfig(): ReviewLoginConfig | null {
  const id = process.env.REVIEW_LOGIN_ID?.trim();
  const password = process.env.REVIEW_LOGIN_PASSWORD;
  const email = process.env.REVIEW_LOGIN_EMAIL?.trim();
  if (!id || !password || !email) return null;
  return { id, password, email };
}

/** 해시한 뒤 비교한다 — timingSafeEqual 은 길이가 다르면 던지고, 길이 자체도 새면 안 된다. */
function sameString(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function verifyReviewLogin(config: ReviewLoginConfig, id: string, password: string): boolean {
  // 둘 다 계산한 뒤 합친다 — && 로 바로 이으면 아이디가 틀릴 때만 빨리 끝난다.
  const idOk = sameString(id.trim(), config.id);
  const passwordOk = sameString(password, config.password);
  return idOk && passwordOk;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx vitest run src/lib/auth/review-login.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/auth/review-login.ts src/lib/auth/review-login.test.ts
git commit -m "feat(auth): 카드사 심사용 로그인의 자격 설정과 검증을 둔다"
```

---

### Task 2: 로그인 라우트 — `POST /api/auth/review-login`

**Files:**
- Create: `src/app/api/auth/review-login/route.ts`
- Test: `src/app/api/auth/review-login/route.test.ts`

**먼저 읽을 것:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (Route Handler, `request.formData()`), 그리고 참고 구현인 `src/app/api/auth/callbacks/[provider]/route.ts` — 성공 뒤의 흐름(드래프트 승격 → 행선지 → 쿠키)을 그대로 따른다.

**Interfaces:**
- Consumes (Task 1): `reviewLoginConfig()`, `verifyReviewLogin(config, id, password)`, `REVIEW_PROVIDER`, `REVIEW_DISPLAY_NAME`
- Consumes (기존):
  - `upsertUser(input: UpsertUserInput): Promise<{ id: string }>`, `setPrimaryProfileIfUnset` — `@/lib/auth/users`
  - `encodeSession({ userId, provider }): Promise<string>`, `SESSION_COOKIE`, `sessionCookieOptions()` — `@/lib/auth/session`
  - `safeNext(next: string | null | undefined, origin: string): string` — `@/lib/auth/oauth`
  - `promoteDraft(token, userId, deps): Promise<PromoteResult>` — `@/lib/drafts/promote`
  - `DRAFT_COOKIE`, `getDraft`, `deleteDraft` — `@/lib/drafts/store`; `createProfile` — `@/lib/profiles/store`
- Produces: `POST` 핸들러. 폼 필드 이름은 정확히 `id`, `password`, `next`. Task 3 의 폼이 이 이름을 쓴다.

**동작 표:**

| 상황 | 응답 |
|---|---|
| `reviewLoginConfig()` 가 `null` | 404 |
| `APP_ORIGIN` 없음 | 500 `auth not configured` |
| `Origin` 헤더가 있고 `APP_ORIGIN` 과 다름 | 403 |
| 자격 불일치 | 303 → `/login?error=review` (`next` 가 있었으면 `&next=…` 로 보존). 쿠키 없음 |
| 성공 | 303 → 행선지. `session` 쿠키. `last_provider` 쿠키는 **심지 않는다** |

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/auth/review-login/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// 이 테스트는 자격 검증 → upsert → 세션 쿠키 → 행선지의 배선만 본다. DB 와 드래프트 저장소는 감춘다.
const upsertUser = vi.fn();
vi.mock("@/lib/auth/users", () => ({
  upsertUser: (...a: unknown[]) => upsertUser(...a),
  setPrimaryProfileIfUnset: vi.fn(),
}));

const promoteDraft = vi.fn();
vi.mock("@/lib/drafts/promote", () => ({
  promoteDraft: (...a: unknown[]) => promoteDraft(...a),
}));

import { POST } from "./route";
import { decodeSession } from "@/lib/auth/session";

const ORIGIN = "http://localhost:3000";
const GOOD = { id: "pgreview", password: "dummy-Pass#1" };

function loginRequest(
  fields: Record<string, string>,
  opts: { cookie?: string; origin?: string } = {},
): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
  };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.origin) headers.origin = opts.origin;
  return new NextRequest(`${ORIGIN}/api/auth/review-login`, {
    method: "POST",
    headers,
    body: new URLSearchParams(fields).toString(),
  });
}

describe("POST /api/auth/review-login", () => {
  beforeEach(() => {
    vi.stubEnv("APP_ORIGIN", ORIGIN);
    vi.stubEnv("AUTH_SESSION_SECRET", "test-secret-test-secret-test-secret");
    vi.stubEnv("REVIEW_LOGIN_ID", "pgreview");
    vi.stubEnv("REVIEW_LOGIN_PASSWORD", "dummy-Pass#1");
    vi.stubEnv("REVIEW_LOGIN_EMAIL", "guest@example.com");
    upsertUser.mockReset().mockResolvedValue({ id: "9" });
    promoteDraft.mockReset().mockResolvedValue({ kind: "none" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // 심사가 끝나 env 를 지우면, 코드를 걷기 전이라도 입구는 닫혀 있어야 한다.
  it("env 가 없으면 404 — 맞는 자격을 보내도 아무 일도 하지 않는다", async () => {
    vi.stubEnv("REVIEW_LOGIN_PASSWORD", "");
    const res = await POST(loginRequest(GOOD));
    expect(res.status).toBe(404);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it("비밀번호가 틀리면 /login?error=review 로 보내고 세션을 굽지 않는다", async () => {
    const res = await POST(loginRequest({ ...GOOD, password: "nope" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login?error=review`);
    expect(res.cookies.get("session")).toBeUndefined();
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it("틀렸을 때 next 를 잃지 않는다 — 다시 입력하면 원래 가려던 곳으로 간다", async () => {
    const res = await POST(loginRequest({ ...GOOD, password: "nope", next: "/checkout" }));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login?error=review&next=%2Fcheckout`);
  });

  it("필드가 빠진 요청도 같은 실패로 접는다", async () => {
    const res = await POST(loginRequest({ id: "pgreview" }));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login?error=review`);
  });

  it("맞으면 provider=review 로 upsert 하고 세션 쿠키를 굽는다", async () => {
    const res = await POST(loginRequest(GOOD));

    expect(upsertUser).toHaveBeenCalledWith({
      provider: "review",
      providerUserId: "pgreview",
      email: "guest@example.com",
      displayName: "심사용 계정",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/home`);
    expect(await decodeSession(res.cookies.get("session")?.value)).toEqual({
      userId: "9",
      provider: "review",
    });
  });

  // /login 은 last_provider 로 "최근 로그인" 배지를 단다. review 에는 달 버튼이 없다.
  it("last_provider 쿠키는 심지 않는다", async () => {
    const res = await POST(loginRequest(GOOD));
    expect(res.cookies.get("last_provider")).toBeUndefined();
  });

  it("내부 next 는 따르고, 외부 URL 은 /home 으로 접는다 — 오픈 리다이렉트 방어", async () => {
    const inner = await POST(loginRequest({ ...GOOD, next: "/checkout?plan=yearly" }));
    expect(inner.headers.get("location")).toBe(`${ORIGIN}/checkout?plan=yearly`);

    const outer = await POST(loginRequest({ ...GOOD, next: "https://evil.example" }));
    expect(outer.headers.get("location")).toBe(`${ORIGIN}/home`);
  });

  // 담당자가 생년월일부터 넣고 로그인해도 소셜 로그인과 똑같이 리포트로 이어져야 한다.
  it("드래프트가 승격되면 /report?profile=<id> 로 보내고 draft 쿠키를 지운다", async () => {
    promoteDraft.mockResolvedValue({ kind: "promoted", id: "42" });
    const res = await POST(loginRequest(GOOD, { cookie: "draft=tok-1" }));

    expect(promoteDraft).toHaveBeenCalledWith("tok-1", "9", expect.anything());
    expect(res.headers.get("location")).toBe(`${ORIGIN}/report?profile=42`);
    expect(res.cookies.get("draft")?.value).toBe("");
  });

  it("한도 초과면 /home?error=limit 로 보내고 draft 쿠키를 남긴다", async () => {
    promoteDraft.mockResolvedValue({ kind: "limit" });
    const res = await POST(loginRequest(GOOD, { cookie: "draft=tok-1" }));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/home?error=limit`);
    expect(res.cookies.get("draft")).toBeUndefined();
  });

  // 비밀번호가 담당자들 사이에 도는 공용 계정이다. 남의 사이트가 방문자를 이 계정으로
  // 로그인시켜 놓으면, 그 사람이 넣은 생년월일을 비밀번호를 아는 누구나 본다.
  it("다른 출처에서 온 폼은 403", async () => {
    const res = await POST(loginRequest(GOOD, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(upsertUser).not.toHaveBeenCalled();
  });

  it("같은 출처의 Origin 헤더는 통과한다", async () => {
    const res = await POST(loginRequest(GOOD, { origin: ORIGIN }));
    expect(res.status).toBe(303);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run src/app/api/auth/review-login/route.test.ts`
Expected: FAIL — `Failed to resolve import "./route"`

- [ ] **Step 3: 구현한다**

`src/app/api/auth/review-login/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import {
  REVIEW_DISPLAY_NAME,
  REVIEW_PROVIDER,
  reviewLoginConfig,
  verifyReviewLogin,
} from "@/lib/auth/review-login";
import { safeNext } from "@/lib/auth/oauth";
import { setPrimaryProfileIfUnset, upsertUser } from "@/lib/auth/users";
import { SESSION_COOKIE, encodeSession, sessionCookieOptions } from "@/lib/auth/session";
import { createProfile } from "@/lib/profiles/store";
import { DRAFT_COOKIE, deleteDraft, getDraft } from "@/lib/drafts/store";
import { promoteDraft } from "@/lib/drafts/promote";

/**
 * 카드사 심사용 임시 로그인 (lib/auth/review-login.ts 참조).
 *
 * 성공 뒤의 흐름(드래프트 승격 → 행선지 → 쿠키)은 callbacks/[provider]/route.ts 와 같다.
 * 공통 함수로 뽑지 않고 겹쳐 둔 것은 의도다 — 이 파일은 심사가 끝나면 통째로 지운다.
 */
export async function POST(req: NextRequest) {
  const config = reviewLoginConfig();
  if (!config) return new NextResponse("not found", { status: 404 });

  const origin = process.env.APP_ORIGIN?.replace(/\/$/, "");
  if (!origin) return new NextResponse("auth not configured", { status: 500 });

  // 공용 계정이라 로그인 CSRF 가 실제 피해로 이어진다 — 남이 심어 준 세션에서 넣은
  // 생년월일을 비밀번호를 아는 누구나 본다. 브라우저는 POST 에 Origin 을 붙인다.
  const requestOrigin = req.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const form = await req.formData();
  const id = form.get("id");
  const password = form.get("password");
  const nextField = form.get("next");
  const next = typeof nextField === "string" && nextField ? nextField : null;

  if (
    typeof id !== "string" ||
    typeof password !== "string" ||
    !verifyReviewLogin(config, id, password)
  ) {
    const keepNext = next ? `&next=${encodeURIComponent(next)}` : "";
    // POST 의 응답이므로 303 — 307 이면 브라우저가 /login 에 POST 를 다시 보낸다.
    return NextResponse.redirect(new URL(`/login?error=review${keepNext}`, origin), 303);
  }

  const user = await upsertUser({
    provider: REVIEW_PROVIDER,
    providerUserId: config.id,
    email: config.email,
    displayName: REVIEW_DISPLAY_NAME,
  });

  const promoted = await promoteDraft(req.cookies.get(DRAFT_COOKIE)?.value ?? null, user.id, {
    getDraft,
    createProfile,
    deleteDraft,
    setPrimaryIfUnset: setPrimaryProfileIfUnset,
  });

  const redirectTo =
    promoted.kind === "promoted"
      ? `/report?profile=${promoted.id}`
      : promoted.kind === "limit"
        ? "/home?error=limit"
        : safeNext(next, origin);

  const res = NextResponse.redirect(new URL(redirectTo, origin), 303);
  res.cookies.set(
    SESSION_COOKIE,
    await encodeSession({ userId: user.id, provider: REVIEW_PROVIDER }),
    sessionCookieOptions(),
  );
  // limit·failed 는 드래프트를 남긴다 — 손잡이를 지우면 다시 시도할 방법이 없다.
  if (promoted.kind === "promoted" || promoted.kind === "none") {
    res.cookies.delete(DRAFT_COOKIE);
  }
  return res;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx vitest run src/app/api/auth/review-login/route.test.ts`
Expected: PASS (11 tests)

`formData()` 가 테스트 환경에서 본문을 못 읽어 실패하면, 구현을 바꾸기 전에 `route.md` 문서의 FormData 절을 다시 확인한다. 테스트의 `content-type` 헤더가 빠졌을 때 나는 증상이다.

- [ ] **Step 5: 전체 검사**

Run: `npm run typecheck && npm run lint && npm test`
Expected: 전부 통과. 기존 테스트 개수가 줄지 않는다.

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/auth/review-login
git commit -m "feat(auth): 심사용 아이디·비밀번호 로그인 라우트를 연다"
```

---

### Task 3: `/login` 에 폼을 노출하고 끝까지 확인한다

**Files:**
- Modify: `src/app/login/page.tsx` (import 추가, `searchParams` 아래 한 줄, `error` 블록 하나, 소셜 버튼 `</div>` 뒤에 폼 블록)
- Modify: `.env.example` (`KAKAO_CLIENT_SECRET` 줄 아래, `# --- 익명 드래프트 저장소 ---` 위)

**Interfaces:**
- Consumes (Task 1): `reviewLoginConfig()` — `null` 이면 폼을 렌더하지 않는다
- Consumes (Task 2): `POST /api/auth/review-login`, 폼 필드 `id` · `password` · `next`

- [ ] **Step 1: `page.tsx` — import 와 설정 읽기**

파일 맨 위 import 에 추가:

```tsx
import { reviewLoginConfig } from "@/lib/auth/review-login";
```

`const nextQuery = …` 줄 바로 아래에 추가:

```tsx
  // 카드사 심사 기간에만 켜진다(REVIEW_LOGIN_*). 꺼져 있으면 아래 폼이 통째로 없다.
  const reviewLoginOn = reviewLoginConfig() !== null;
```

- [ ] **Step 2: `page.tsx` — 실패 안내**

`{error === "email" && ( … )}` 블록 바로 아래에 추가:

```tsx
          {error === "review" && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-[13px] text-red-600">
              아이디 또는 비밀번호가 맞지 않아요.
            </p>
          )}
```

- [ ] **Step 3: `page.tsx` — 폼 블록**

소셜 버튼을 감싼 `<div className="flex flex-col gap-2.5"> … </div>` 가 닫힌 바로 뒤, 약관 `<p className="mt-7 …">` 앞에 추가:

```tsx
          {/* ⚠️ 임시 — PG 카드사 심사용. 심사가 끝나면 lib/auth/review-login.ts 의 목록대로 걷는다. */}
          {reviewLoginOn && (
            <form method="post" action="/api/auth/review-login" className="mt-7 text-left">
              <div className="mb-5 flex items-center gap-3 text-[12px] text-slate-300">
                <span className="h-px flex-1 bg-slate-200" />
                또는
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              {next && <input type="hidden" name="next" value={next} />}
              <div className="flex flex-col gap-2.5">
                <input
                  name="id"
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  placeholder="아이디"
                  aria-label="아이디"
                  className="h-[52px] rounded-[14px] border border-slate-200 bg-white px-4 text-[15px] text-slate-700 outline-none placeholder:text-slate-300 focus:border-slate-400"
                />
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="비밀번호"
                  aria-label="비밀번호"
                  className="h-[52px] rounded-[14px] border border-slate-200 bg-white px-4 text-[15px] text-slate-700 outline-none placeholder:text-slate-300 focus:border-slate-400"
                />
                <button
                  type="submit"
                  className="h-[52px] rounded-[14px] bg-slate-900 text-[15px] font-semibold text-white transition hover:bg-slate-800"
                >
                  로그인
                </button>
              </div>
            </form>
          )}
```

- [ ] **Step 4: `.env.example`**

`KAKAO_CLIENT_SECRET=` 줄과 `# --- 익명 드래프트 저장소 ---` 사이에 추가:

```
# --- PG 카드사 심사용 임시 로그인 ---
# 셋이 다 있어야 /login 에 아이디·비밀번호 폼이 뜬다. 하나라도 비면 폼도 라우트(404)도 닫힌다.
# 심사가 끝나면 값을 지우고, 코드는 src/lib/auth/review-login.ts 의 목록대로 걷는다.
# ⚠️ .env* 파일에서는 # 이 주석을 연다 — 비밀번호에 # 이 있으면 반드시 따옴표로 감싼다.
REVIEW_LOGIN_ID=
REVIEW_LOGIN_PASSWORD=       # 예: "abc#123" (따옴표 포함)
REVIEW_LOGIN_EMAIL=          # 결제창에 구매자 이메일로 넘어간다
```

- [ ] **Step 5: 검사**

Run: `npm run typecheck && npm run lint && npm test`
Expected: 전부 통과

- [ ] **Step 6: 브라우저에서 끝까지 확인한다**

워크트리의 `.env.local` 에 **더미 값**을 넣는다(실제 심사용 비밀번호를 쓰지 않는다). `#` 과 따옴표 처리까지 함께 확인된다:

```
REVIEW_LOGIN_ID=pgreview
REVIEW_LOGIN_PASSWORD="local-Pass#1"
REVIEW_LOGIN_EMAIL=guest@example.com
```

워크트리에서 `npx next dev -p 3100` 을 Bash 백그라운드로 띄운다(`preview_start` 는 다른 체크아웃을 띄울 수 있다). `.env.local` 의 `APP_ORIGIN` 이 `http://localhost:3100` 과 다르면 Origin 검사에 걸려 403 이 난다 — 이 검증 동안만 `APP_ORIGIN=http://localhost:3100` 으로 맞춘다.

확인 목록:
1. `/login` — 소셜 버튼 아래 "또는" 구분선과 폼이 보인다. 모바일 폭(375)에서 가로 스크롤이 없다.
2. 틀린 비밀번호 → `/login?error=review`, 빨간 안내가 뜬다.
3. `pgreview` / `local-Pass#1` → `/home` 으로 가고 헤더에 "심사용 계정" 이 보인다.
4. `/login?next=%2Fcheckout` 에서 로그인 → `/checkout` 에 닿고, 결제 화면이 구매자 이메일 없음으로 막히지 않는다.
5. 로그아웃 뒤 `/login` 에 "최근 로그인" 배지가 어느 버튼에도 새로 붙지 않았다.
6. `.env.local` 에서 `REVIEW_LOGIN_PASSWORD` 줄을 지우고 dev 서버를 다시 띄운다 → `/login` 에 폼이 없고, `curl -i -X POST http://localhost:3100/api/auth/review-login` 이 404 다.

확인이 끝나면 `.env.local` 의 `APP_ORIGIN` 을 되돌리고 dev 서버를 내린다.

- [ ] **Step 7: 커밋**

```bash
git add src/app/login/page.tsx .env.example
git commit -m "feat(login): 심사 기간 동안 아이디·비밀번호 폼을 노출한다"
```

---

## 배포 (사람이 한다)

**먼저 운영 DB 에 0049 를 적용한다** — 안 하면 운영에서 로그인 성공 갈래가 500 이다. 제약을 넓히기만 하므로 코드 배포보다 앞서 돌려도 안전하다. (개발 DB 에는 2026-09-18 적용 완료.)

그다음 호스팅 환경변수(Production)에 등록한 뒤 재배포한다. 호스팅 콘솔에서는 따옴표 없이 값만 넣는다.

| 키 | 값 |
|---|---|
| `REVIEW_LOGIN_ID` | `pgreview` |
| `REVIEW_LOGIN_PASSWORD` | 사용자가 정한 심사용 비밀번호 |
| `REVIEW_LOGIN_EMAIL` | `guest01@projectn.com` |

- `REVIEW_LOGIN_ID` 는 한 번 정하면 바꾸지 않는다 — `users` 행이 `(provider, provider_user_id)` 로 묶여 있어, 바꾸면 새 행이 생기고 담당자가 저장한 프로필은 옛 행에 남는다.
- 카드사에는 **`APP_ORIGIN` 과 정확히 같은 호스트**의 `/login` 주소를 준다(www/apex, `*.vercel.app` 가 아니라).

배포 뒤 운영 도메인의 `/login` 에서 실제 자격으로 한 번 로그인해 본 다음 카드사에 전달한다.

## 철거 (심사 통과 뒤)

1. 호스팅 환경변수 `REVIEW_LOGIN_*` 셋을 지우고 재배포 — 이 시점에 폼이 사라지고 라우트가 404 가 된다.
2. 코드 삭제 커밋: `src/lib/auth/review-login.ts` · `review-login.test.ts` · `src/app/api/auth/review-login/` · `login/page.tsx` 의 import·`reviewLoginOn`·`error === "review"` 블록·폼 블록 · `.env.example` 의 `REVIEW_LOGIN_*` 절.
3. `0049` 마이그레이션과 CHECK 의 `'admin'` 은 남긴다. `users` 의 `provider = 'admin'` 행도 남겨도 무해하다. 지우려면 결제 기록이 그 행을 참조하는지 먼저 본다.
