# 소셜 로그인 구현 계획 (Google / LINE / Kakao)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google·LINE·Kakao 소셜 로그인을 커스텀 OAuth(Authorization Code + PKCE)로 구현하고, stateless JWT 세션 쿠키를 발급해 리포트 게이팅 seam(`access.ts`)과 연결한다.

**Architecture:** 로직은 전부 `src/lib/auth/` 아래 순수·주입가능 모듈로 두고(providers/oauth/session/users/callback), route handler는 `cookies()`·`fetch`·`NextResponse`만 조립하는 얇은 어댑터로 유지한다. 이 코드베이스의 기존 패턴(`_lib` 함수에 `SqlClient`/의존성 주입, route는 얇게 — `api/saju` 참고)을 그대로 따른다.

**Tech Stack:** Next.js 16.2.10 App Router(route handler), React 19, jose(JWT), Neon serverless Postgres(raw SQL), Vitest, Tailwind v4.

## Global Constraints

- Next.js 16: `middleware` → `proxy.ts`(이번 범위에서 proxy 미도입). `cookies()`·route `params`·page `searchParams`는 **모두 async(Promise)** — 반드시 `await`.
- route handler는 기본 Node.js 런타임. jose 호환.
- DB 접근은 raw SQL 태그드 템플릿만. 문자열 concat 금지(`src/lib/db.ts` 주석).
- 테스트는 모듈 mock이 아니라 **의존성 주입**(fake `SqlClient`, fake `fetch`)으로 작성. 기존 `store.test.ts` 패턴 준수.
- import alias: `@/` → `src/`.
- 커밋 메시지 말미:
  ```
  Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
  ```
- provider id는 `"google" | "line" | "kakao"` 세 개만. Apple은 범위 밖.
- redirect URI 형식: `{APP_ORIGIN}/api/auth/callbacks/{provider}` (콘솔 등록값과 정확히 일치해야 함).

---

## Task 1: 셋업 — jose 설치, users 마이그레이션, env 항목

**Files:**
- Modify: `package.json` (jose 의존성 추가 — npm이 처리)
- Create: `migrations/0002_users.sql`
- Create: `.env.example`
- Modify: `.env.local` (없으면 생성, 항목만 추가 — **커밋하지 않음**)

**Interfaces:**
- Produces: `users` 테이블(스키마 아래), env 키(`AUTH_SESSION_SECRET`, `APP_ORIGIN`, `{GOOGLE,LINE,KAKAO}_CLIENT_ID/SECRET`).

- [ ] **Step 1: jose 설치**

Run:
```bash
npm install jose
```
Expected: `package.json` dependencies에 `jose` 추가, 에러 없음.

- [ ] **Step 2: users 마이그레이션 파일 작성**

Create `migrations/0002_users.sql`:
```sql
CREATE TABLE IF NOT EXISTS users (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider          text NOT NULL,
  provider_user_id  text NOT NULL,
  email             text,
  display_name      text,
  avatar_url        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_login_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_user_id)
);
```

- [ ] **Step 3: .env.example 작성**

Create `.env.example`:
```
# --- Auth (소셜 로그인) ---
AUTH_SESSION_SECRET=          # 세션 JWT 서명 키. openssl rand -base64 32
APP_ORIGIN=                   # 예: http://localhost:3000 (redirect_uri 조립용, 끝 슬래시 없이)

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

LINE_CLIENT_ID=               # LINE Login channel ID
LINE_CLIENT_SECRET=           # LINE channel secret

KAKAO_CLIENT_ID=              # 카카오 REST API 키
KAKAO_CLIENT_SECRET=          # (선택) 카카오 client secret 사용 시
```

- [ ] **Step 4: .env.local에 동일 키 추가**

`.env.local`이 있으면 위 블록을 **append**(기존 `DATABASE_URL` 등 보존). 없으면 생성.
`.gitignore`에 `.env.local`이 포함돼 있는지 확인(없으면 `.gitignore`에 `.env.local` 추가). `.env.local`은 커밋하지 않는다.

- [ ] **Step 5: 마이그레이션 실행**

Run:
```bash
npm run db:migrate
```
Expected: `applying 0002_users.sql` 출력 후 `done (1 applied, 1 skipped)`.
(DATABASE_URL 미설정으로 실패하면, `.env.local`에 Neon 접속정보가 채워진 뒤 재실행하도록 안내하고 이 스텝은 보류 표시.)

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json migrations/0002_users.sql .env.example .gitignore
git commit -m "feat(auth): jose 의존성·users 테이블·env 스캐폴딩"
```
(`.env.local`은 스테이징하지 않는다.)

---

## Task 2: providers.ts — provider 설정 레지스트리 + 프로필 매퍼

**Files:**
- Create: `src/lib/auth/providers.ts`
- Test: `src/lib/auth/providers.test.ts`

**Interfaces:**
- Produces:
  - `type ProviderId = "google" | "line" | "kakao"`
  - `interface OAuthProfile { providerUserId: string; email?: string; displayName?: string; avatarUrl?: string }`
  - `interface TokenResponse { access_token: string; id_token?: string; [k: string]: unknown }`
  - `type FetchLike = typeof fetch`
  - `interface ProviderConfig { id: ProviderId; authorizeUrl: string; tokenUrl: string; scope: string; clientIdEnv: string; clientSecretEnv: string; extraAuthParams?: Record<string,string>; fetchProfile(token: TokenResponse, fetchImpl: FetchLike): Promise<OAuthProfile> }`
  - `const PROVIDERS: Record<ProviderId, ProviderConfig>`
  - `function getProvider(id: string): ProviderConfig | null`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/auth/providers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getProvider, PROVIDERS, type FetchLike } from "./providers";

function fakeFetch(json: unknown, ok = true): FetchLike {
  return (async () => ({ ok, status: ok ? 200 : 500, json: async () => json })) as unknown as FetchLike;
}

// LINE id_token: 서명 검증 없이 payload만 디코딩하므로 JWT 형태이면 충분
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64(payload)}.`;
}

describe("getProvider", () => {
  it("알 수 없는 provider는 null", () => {
    expect(getProvider("apple")).toBeNull();
    expect(getProvider("")).toBeNull();
  });
  it("google/line/kakao는 설정 반환", () => {
    expect(getProvider("google")?.id).toBe("google");
    expect(getProvider("line")?.id).toBe("line");
    expect(getProvider("kakao")?.id).toBe("kakao");
  });
});

describe("fetchProfile", () => {
  it("google: userinfo 응답을 정규화", async () => {
    const fetchImpl = fakeFetch({ sub: "g-1", email: "a@g.com", name: "지민", picture: "http://img/a" });
    const p = await PROVIDERS.google.fetchProfile({ access_token: "t" }, fetchImpl);
    expect(p).toEqual({ providerUserId: "g-1", email: "a@g.com", displayName: "지민", avatarUrl: "http://img/a" });
  });
  it("kakao: kakao_account 중첩을 정규화", async () => {
    const fetchImpl = fakeFetch({ id: 12345, kakao_account: { email: "k@k.com", profile: { nickname: "카톡", profile_image_url: "http://img/k" } } });
    const p = await PROVIDERS.kakao.fetchProfile({ access_token: "t" }, fetchImpl);
    expect(p).toEqual({ providerUserId: "12345", email: "k@k.com", displayName: "카톡", avatarUrl: "http://img/k" });
  });
  it("line: id_token 클레임을 정규화", async () => {
    const id_token = makeJwt({ sub: "l-9", name: "라인", email: "l@l.com", picture: "http://img/l" });
    const p = await PROVIDERS.line.fetchProfile({ access_token: "t", id_token }, (() => { throw new Error("no fetch"); }) as unknown as FetchLike);
    expect(p).toEqual({ providerUserId: "l-9", email: "l@l.com", displayName: "라인", avatarUrl: "http://img/l" });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/auth/providers.test.ts`
Expected: FAIL — `Cannot find module './providers'`.

- [ ] **Step 3: 구현 작성**

Create `src/lib/auth/providers.ts`:
```ts
import { decodeJwt } from "jose";

export type ProviderId = "google" | "line" | "kakao";

export interface OAuthProfile {
  providerUserId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface TokenResponse {
  access_token: string;
  id_token?: string;
  [k: string]: unknown;
}

export type FetchLike = typeof fetch;

export interface ProviderConfig {
  id: ProviderId;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  extraAuthParams?: Record<string, string>;
  fetchProfile(token: TokenResponse, fetchImpl: FetchLike): Promise<OAuthProfile>;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  google: {
    id: "google",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    async fetchProfile(token, fetchImpl) {
      const res = await fetchImpl("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!res.ok) throw new Error(`google userinfo failed: ${res.status}`);
      const d = (await res.json()) as Record<string, unknown>;
      return {
        providerUserId: String(d.sub),
        email: str(d.email),
        displayName: str(d.name),
        avatarUrl: str(d.picture),
      };
    },
  },
  line: {
    id: "line",
    authorizeUrl: "https://access.line.me/oauth2/v2.1/authorize",
    tokenUrl: "https://api.line.me/oauth2/v2.1/token",
    scope: "openid profile email",
    clientIdEnv: "LINE_CLIENT_ID",
    clientSecretEnv: "LINE_CLIENT_SECRET",
    // LINE은 token 응답의 id_token(JWT)에 sub/name/email/picture가 담김.
    // MVP에서는 서명 검증 없이 payload만 디코딩(토큰은 TLS로 직접 받은 신뢰 채널).
    async fetchProfile(token) {
      if (!token.id_token) throw new Error("line id_token missing");
      const claims = decodeJwt(token.id_token);
      return {
        providerUserId: String(claims.sub),
        email: str(claims.email),
        displayName: str(claims.name),
        avatarUrl: str((claims as Record<string, unknown>).picture),
      };
    },
  },
  kakao: {
    id: "kakao",
    authorizeUrl: "https://kauth.kakao.com/oauth/authorize",
    tokenUrl: "https://kauth.kakao.com/oauth/token",
    scope: "profile_nickname account_email",
    clientIdEnv: "KAKAO_CLIENT_ID",
    clientSecretEnv: "KAKAO_CLIENT_SECRET",
    async fetchProfile(token, fetchImpl) {
      const res = await fetchImpl("https://kapi.kakao.com/v2/user/me", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!res.ok) throw new Error(`kakao user/me failed: ${res.status}`);
      const d = (await res.json()) as Record<string, unknown>;
      const acc = (d.kakao_account ?? {}) as Record<string, unknown>;
      const prof = (acc.profile ?? {}) as Record<string, unknown>;
      return {
        providerUserId: String(d.id),
        email: str(acc.email),
        displayName: str(prof.nickname),
        avatarUrl: str(prof.profile_image_url),
      };
    },
  },
};

export function getProvider(id: string): ProviderConfig | null {
  return (PROVIDERS as Record<string, ProviderConfig>)[id] ?? null;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/auth/providers.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/auth/providers.ts src/lib/auth/providers.test.ts
git commit -m "feat(auth): provider 레지스트리·프로필 매퍼"
```

---

## Task 3: oauth.ts — PKCE/state/authorize URL/토큰 교환/next 검증

**Files:**
- Create: `src/lib/auth/oauth.ts`
- Test: `src/lib/auth/oauth.test.ts`

**Interfaces:**
- Consumes: `ProviderConfig`, `TokenResponse`, `FetchLike` (from `./providers`).
- Produces:
  - `function generateState(): string`
  - `function generateCodeVerifier(): string`
  - `function codeChallengeS256(verifier: string): Promise<string>`
  - `function buildAuthorizeUrl(p: ProviderConfig, o: { clientId: string; redirectUri: string; state: string; codeChallenge: string }): string`
  - `function exchangeCode(p: ProviderConfig, o: { code: string; clientId: string; clientSecret: string; redirectUri: string; codeVerifier: string }, fetchImpl: FetchLike): Promise<TokenResponse>`
  - `function safeNext(next: string | null | undefined): string`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/auth/oauth.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  generateState,
  generateCodeVerifier,
  codeChallengeS256,
  buildAuthorizeUrl,
  exchangeCode,
  safeNext,
} from "./oauth";
import { PROVIDERS, type FetchLike } from "./providers";

describe("PKCE/state 생성", () => {
  it("code_verifier는 43자 base64url", () => {
    const v = generateCodeVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it("state는 base64url 문자열", () => {
    expect(generateState()).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it("S256 challenge는 RFC 7636 벡터와 일치", async () => {
    const c = await codeChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(c).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("buildAuthorizeUrl", () => {
  it("필수 파라미터를 포함", () => {
    const url = new URL(
      buildAuthorizeUrl(PROVIDERS.google, {
        clientId: "cid",
        redirectUri: "http://localhost:3000/api/auth/callbacks/google",
        state: "st",
        codeChallenge: "ch",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/callbacks/google");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("exchangeCode", () => {
  it("form-encoded로 토큰 교환하고 응답 반환", async () => {
    const calls: { url: string; body: string }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) });
      return { ok: true, status: 200, json: async () => ({ access_token: "AT", id_token: "IT" }) };
    }) as unknown as FetchLike;

    const token = await exchangeCode(
      PROVIDERS.kakao,
      { code: "C", clientId: "cid", clientSecret: "sec", redirectUri: "http://x/cb", codeVerifier: "ver" },
      fetchImpl,
    );
    expect(token.access_token).toBe("AT");
    expect(calls[0].url).toBe("https://kauth.kakao.com/oauth/token");
    const body = new URLSearchParams(calls[0].body);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("C");
    expect(body.get("code_verifier")).toBe("ver");
    expect(body.get("client_secret")).toBe("sec");
  });
  it("client_secret이 빈 문자열이면 생략", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      calls.push(String(init.body));
      return { ok: true, status: 200, json: async () => ({ access_token: "AT" }) };
    }) as unknown as FetchLike;
    await exchangeCode(
      PROVIDERS.google,
      { code: "C", clientId: "cid", clientSecret: "", redirectUri: "http://x/cb", codeVerifier: "ver" },
      fetchImpl,
    );
    expect(new URLSearchParams(calls[0]).has("client_secret")).toBe(false);
  });
  it("non-ok 응답이면 throw", async () => {
    const fetchImpl = (async () => ({ ok: false, status: 400, json: async () => ({}) })) as unknown as FetchLike;
    await expect(
      exchangeCode(PROVIDERS.line, { code: "C", clientId: "c", clientSecret: "s", redirectUri: "r", codeVerifier: "v" }, fetchImpl),
    ).rejects.toThrow();
  });
});

describe("safeNext (오픈 리다이렉트 방어)", () => {
  it("내부 경로는 통과", () => {
    expect(safeNext("/report")).toBe("/report");
    expect(safeNext("/report?paid=true")).toBe("/report?paid=true");
  });
  it("외부/프로토콜상대/역슬래시/빈값은 /로", () => {
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("report")).toBe("/");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/auth/oauth.test.ts`
Expected: FAIL — `Cannot find module './oauth'`.

- [ ] **Step 3: 구현 작성**

Create `src/lib/auth/oauth.ts`:
```ts
import type { ProviderConfig, TokenResponse, FetchLike } from "./providers";

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes); // 32바이트 → 43자 base64url
}

export async function codeChallengeS256(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64url(new Uint8Array(digest));
}

export function buildAuthorizeUrl(
  p: ProviderConfig,
  o: { clientId: string; redirectUri: string; state: string; codeChallenge: string },
): string {
  const url = new URL(p.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", o.clientId);
  url.searchParams.set("redirect_uri", o.redirectUri);
  url.searchParams.set("scope", p.scope);
  url.searchParams.set("state", o.state);
  url.searchParams.set("code_challenge", o.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  for (const [k, v] of Object.entries(p.extraAuthParams ?? {})) url.searchParams.set(k, v);
  return url.toString();
}

export async function exchangeCode(
  p: ProviderConfig,
  o: { code: string; clientId: string; clientSecret: string; redirectUri: string; codeVerifier: string },
  fetchImpl: FetchLike,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: o.code,
    redirect_uri: o.redirectUri,
    client_id: o.clientId,
    code_verifier: o.codeVerifier,
  });
  if (o.clientSecret) body.set("client_secret", o.clientSecret);

  const res = await fetchImpl(p.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  if (!res.ok) throw new Error(`token exchange failed: ${p.id} ${res.status}`);
  return (await res.json()) as TokenResponse;
}

/** next는 내부 절대경로만 허용(오픈 리다이렉트 방어). 그 외엔 "/". */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  if (next.startsWith("/\\")) return "/";
  return next;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/auth/oauth.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/auth/oauth.ts src/lib/auth/oauth.test.ts
git commit -m "feat(auth): PKCE·state·authorize URL·토큰교환·next 검증"
```

---

## Task 4: session.ts — JWT 인코딩/디코딩 + 세션 쿠키 헬퍼

**Files:**
- Create: `src/lib/auth/session.ts`
- Test: `src/lib/auth/session.test.ts`

**Interfaces:**
- Produces:
  - `interface SessionPayload { userId: string; provider: string }`
  - `function encodeSession(payload: SessionPayload): Promise<string>`
  - `function decodeSession(token: string | undefined): Promise<SessionPayload | null>`
  - `const SESSION_COOKIE = "session"`
  - `function sessionCookieOptions(): { httpOnly: true; secure: boolean; sameSite: "lax"; path: "/"; maxAge: number }`
  - `function getSession(): Promise<SessionPayload | null>` (reads cookie via `next/headers`)
  - `function clearSessionCookie(): Promise<void>`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/auth/session.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT } from "jose";
import { encodeSession, decodeSession } from "./session";

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = "test-secret-test-secret-test-secret-01";
});

const secret = () => new TextEncoder().encode(process.env.AUTH_SESSION_SECRET);

describe("session encode/decode", () => {
  it("라운드트립", async () => {
    const token = await encodeSession({ userId: "42", provider: "google" });
    expect(await decodeSession(token)).toEqual({ userId: "42", provider: "google" });
  });
  it("undefined 토큰은 null", async () => {
    expect(await decodeSession(undefined)).toBeNull();
  });
  it("변조 토큰은 null", async () => {
    const token = await encodeSession({ userId: "42", provider: "google" });
    expect(await decodeSession(token + "x")).toBeNull();
  });
  it("만료 토큰은 null", async () => {
    const expired = await new SignJWT({ userId: "1", provider: "google" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret());
    expect(await decodeSession(expired)).toBeNull();
  });
  it("필수 클레임 없으면 null", async () => {
    const bad = await new SignJWT({ foo: "bar" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(secret());
    expect(await decodeSession(bad)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/auth/session.test.ts`
Expected: FAIL — `Cannot find module './session'`.

- [ ] **Step 3: 구현 작성**

Create `src/lib/auth/session.ts`:
```ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export interface SessionPayload {
  userId: string;
  provider: string;
}

const ALG = "HS256";
export const SESSION_COOKIE = "session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7일

function key(): Uint8Array {
  const s = process.env.AUTH_SESSION_SECRET;
  if (!s) throw new Error("AUTH_SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function encodeSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, provider: payload.provider })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());
}

export async function decodeSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: [ALG] });
    if (typeof payload.userId !== "string" || typeof payload.provider !== "string") return null;
    return { userId: payload.userId, provider: payload.provider };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/auth/session.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/auth/session.ts src/lib/auth/session.test.ts
git commit -m "feat(auth): 세션 JWT 인코딩/디코딩·쿠키 헬퍼"
```

---

## Task 5: users.ts — upsertUser

**Files:**
- Create: `src/lib/auth/users.ts`
- Test: `src/lib/auth/users.test.ts`

**Interfaces:**
- Consumes: `sql` (from `@/lib/db`).
- Produces:
  - `type SqlClient = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>`
  - `interface UpsertUserInput { provider: string; providerUserId: string; email?: string; displayName?: string; avatarUrl?: string }`
  - `function upsertUser(input: UpsertUserInput, client?: SqlClient): Promise<{ id: string }>`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/auth/users.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { upsertUser, type SqlClient } from "./users";

function fakeClient(rows: Record<string, unknown>[]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(rows);
  };
  return { client, calls };
}

describe("upsertUser", () => {
  it("ON CONFLICT UPSERT를 실행하고 id를 문자열로 반환", async () => {
    const { client, calls } = fakeClient([{ id: 7 }]);
    const result = await upsertUser(
      { provider: "google", providerUserId: "g-1", email: "a@g.com", displayName: "지민", avatarUrl: "http://img" },
      client,
    );
    expect(result).toEqual({ id: "7" });
    expect(calls[0].sql).toContain("INSERT INTO users");
    expect(calls[0].sql).toContain("ON CONFLICT (provider, provider_user_id) DO UPDATE");
    expect(calls[0].values).toEqual(["google", "g-1", "a@g.com", "지민", "http://img"]);
  });
  it("선택 필드는 null로 바인딩", async () => {
    const { client, calls } = fakeClient([{ id: 9 }]);
    await upsertUser({ provider: "kakao", providerUserId: "k-2" }, client);
    expect(calls[0].values).toEqual(["kakao", "k-2", null, null, null]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/auth/users.test.ts`
Expected: FAIL — `Cannot find module './users'`.

- [ ] **Step 3: 구현 작성**

Create `src/lib/auth/users.ts`:
```ts
import { sql as neonSql } from "@/lib/db";

/** 태그드 템플릿 SQL 클라이언트(주입 가능). 기본은 공유 neon 클라이언트. */
export type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

const sql = neonSql as unknown as SqlClient;

export interface UpsertUserInput {
  provider: string;
  providerUserId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
}

/** (provider, provider_user_id) 기준 upsert. 존재하면 프로필·last_login_at 갱신. id 반환. */
export async function upsertUser(
  input: UpsertUserInput,
  client: SqlClient = sql,
): Promise<{ id: string }> {
  const rows = await client`
    INSERT INTO users (provider, provider_user_id, email, display_name, avatar_url, last_login_at)
    VALUES (
      ${input.provider},
      ${input.providerUserId},
      ${input.email ?? null},
      ${input.displayName ?? null},
      ${input.avatarUrl ?? null},
      now()
    )
    ON CONFLICT (provider, provider_user_id) DO UPDATE SET
      email         = EXCLUDED.email,
      display_name  = EXCLUDED.display_name,
      avatar_url    = EXCLUDED.avatar_url,
      last_login_at = now()
    RETURNING id
  `;
  const row = rows[0] as { id: string | number } | undefined;
  if (!row) throw new Error("upsertUser: no row returned");
  return { id: String(row.id) };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/auth/users.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/auth/users.ts src/lib/auth/users.test.ts
git commit -m "feat(auth): upsertUser (raw SQL)"
```

---

## Task 6: callback.ts — completeOAuth 오케스트레이션

**Files:**
- Create: `src/lib/auth/callback.ts`
- Test: `src/lib/auth/callback.test.ts`

**Interfaces:**
- Consumes: `ProviderConfig`(from `./providers`), `exchangeCode`·`safeNext`(from `./oauth`), `encodeSession`(from `./session`), `UpsertUserInput`(from `./users`), `FetchLike`(from `./providers`).
- Produces:
  - `interface CallbackParams { code: string | null; state: string | null; storedState: string | null; codeVerifier: string | null; next: string | null }`
  - `interface CallbackDeps { fetchImpl: FetchLike; upsert: (i: UpsertUserInput) => Promise<{ id: string }>; clientId: string; clientSecret: string; redirectUri: string }`
  - `interface CallbackResult { redirectTo: string; sessionToken: string; provider: ProviderId }`
  - `function completeOAuth(p: ProviderConfig, params: CallbackParams, deps: CallbackDeps): Promise<CallbackResult>`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/lib/auth/callback.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { completeOAuth } from "./callback";
import { decodeSession } from "./session";
import { PROVIDERS, type FetchLike } from "./providers";

beforeAll(() => {
  process.env.AUTH_SESSION_SECRET = "test-secret-test-secret-test-secret-01";
});

// google 플로우: token 엔드포인트 → userinfo 엔드포인트 순으로 응답
function googleFetch(): FetchLike {
  return (async (url: string) => {
    if (url === "https://oauth2.googleapis.com/token") {
      return { ok: true, status: 200, json: async () => ({ access_token: "AT" }) };
    }
    if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
      return { ok: true, status: 200, json: async () => ({ sub: "g-1", email: "a@g.com", name: "지민" }) };
    }
    throw new Error(`unexpected url ${url}`);
  }) as unknown as FetchLike;
}

const baseParams = {
  code: "CODE",
  state: "S",
  storedState: "S",
  codeVerifier: "V",
  next: "/report",
};

function deps(fetchImpl: FetchLike) {
  const upserts: unknown[] = [];
  return {
    upserts,
    deps: {
      fetchImpl,
      upsert: async (i: unknown) => {
        upserts.push(i);
        return { id: "42" };
      },
      clientId: "cid",
      clientSecret: "sec",
      redirectUri: "http://localhost:3000/api/auth/callbacks/google",
    },
  };
}

describe("completeOAuth", () => {
  it("정상 플로우: upsert 후 세션 발급, next로 리다이렉트", async () => {
    const { deps: d, upserts } = deps(googleFetch());
    const result = await completeOAuth(PROVIDERS.google, baseParams, d);
    expect(result.provider).toBe("google");
    expect(result.redirectTo).toBe("/report");
    expect(upserts[0]).toEqual({ provider: "google", providerUserId: "g-1", email: "a@g.com", displayName: "지민", avatarUrl: undefined });
    expect(await decodeSession(result.sessionToken)).toEqual({ userId: "42", provider: "google" });
  });
  it("state 불일치면 throw", async () => {
    const { deps: d } = deps(googleFetch());
    await expect(completeOAuth(PROVIDERS.google, { ...baseParams, storedState: "OTHER" }, d)).rejects.toThrow();
  });
  it("code 없으면 throw", async () => {
    const { deps: d } = deps(googleFetch());
    await expect(completeOAuth(PROVIDERS.google, { ...baseParams, code: null }, d)).rejects.toThrow();
  });
  it("외부 next는 /로 정규화", async () => {
    const { deps: d } = deps(googleFetch());
    const result = await completeOAuth(PROVIDERS.google, { ...baseParams, next: "https://evil.com" }, d);
    expect(result.redirectTo).toBe("/");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/lib/auth/callback.test.ts`
Expected: FAIL — `Cannot find module './callback'`.

- [ ] **Step 3: 구현 작성**

Create `src/lib/auth/callback.ts`:
```ts
import type { ProviderConfig, ProviderId, FetchLike } from "./providers";
import type { UpsertUserInput } from "./users";
import { exchangeCode, safeNext } from "./oauth";
import { encodeSession } from "./session";

export interface CallbackParams {
  code: string | null;
  state: string | null;
  storedState: string | null;
  codeVerifier: string | null;
  next: string | null;
}

export interface CallbackDeps {
  fetchImpl: FetchLike;
  upsert: (input: UpsertUserInput) => Promise<{ id: string }>;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface CallbackResult {
  redirectTo: string;
  sessionToken: string;
  provider: ProviderId;
}

export async function completeOAuth(
  p: ProviderConfig,
  params: CallbackParams,
  deps: CallbackDeps,
): Promise<CallbackResult> {
  if (!params.code) throw new Error("oauth callback: missing code");
  if (!params.state || !params.storedState || params.state !== params.storedState) {
    throw new Error("oauth callback: state mismatch");
  }
  if (!params.codeVerifier) throw new Error("oauth callback: missing code_verifier");

  const token = await exchangeCode(
    p,
    {
      code: params.code,
      clientId: deps.clientId,
      clientSecret: deps.clientSecret,
      redirectUri: deps.redirectUri,
      codeVerifier: params.codeVerifier,
    },
    deps.fetchImpl,
  );

  const profile = await p.fetchProfile(token, deps.fetchImpl);
  const user = await deps.upsert({
    provider: p.id,
    providerUserId: profile.providerUserId,
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  });

  const sessionToken = await encodeSession({ userId: user.id, provider: p.id });
  return { redirectTo: safeNext(params.next), sessionToken, provider: p.id };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/lib/auth/callback.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
git add src/lib/auth/callback.ts src/lib/auth/callback.test.ts
git commit -m "feat(auth): completeOAuth 콜백 오케스트레이션"
```

---

## Task 7: Route handlers — login / callback / logout

**Files:**
- Create: `src/app/api/auth/login/[provider]/route.ts`
- Create: `src/app/api/auth/callbacks/[provider]/route.ts`
- Create: `src/app/api/auth/logout/route.ts`

**Interfaces:**
- Consumes: `getProvider`(providers), oauth 헬퍼, `completeOAuth`(callback), `upsertUser`(users), `SESSION_COOKIE`·`sessionCookieOptions`(session).
- Produces: HTTP 엔드포인트. (얇은 어댑터 — 로직은 Task 2~6에서 테스트 완료. 검증은 typecheck·build·수동 스모크.)

> 참고: route `params`는 Promise. `RouteContext` 전역 타입 대신 `{ params: Promise<{ provider: string }> }`로 직접 타이핑(typegen 의존 회피).

- [ ] **Step 1: login 시작 핸들러 작성**

Create `src/app/api/auth/login/[provider]/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getProvider } from "@/lib/auth/providers";
import { generateState, generateCodeVerifier, codeChallengeS256, buildAuthorizeUrl } from "@/lib/auth/oauth";

const TX_MAX_AGE = 600; // 10분

function txCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TX_MAX_AGE,
  };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return new NextResponse("unknown provider", { status: 404 });

  const clientId = process.env[provider.clientIdEnv];
  const origin = process.env.APP_ORIGIN;
  if (!clientId || !origin) return new NextResponse("auth not configured", { status: 500 });

  const redirectUri = `${origin}/api/auth/callbacks/${provider.id}`;
  const state = generateState();
  const verifier = generateCodeVerifier();
  const challenge = await codeChallengeS256(verifier);
  const next = req.nextUrl.searchParams.get("next") ?? "/";

  const authorizeUrl = buildAuthorizeUrl(provider, { clientId, redirectUri, state, codeChallenge: challenge });
  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set("oauth_state", state, txCookieOptions());
  res.cookies.set("oauth_verifier", verifier, txCookieOptions());
  res.cookies.set("oauth_next", next, txCookieOptions());
  return res;
}
```

- [ ] **Step 2: callback 핸들러 작성**

Create `src/app/api/auth/callbacks/[provider]/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { getProvider } from "@/lib/auth/providers";
import { completeOAuth } from "@/lib/auth/callback";
import { upsertUser } from "@/lib/auth/users";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

const LAST_PROVIDER_MAX_AGE = 60 * 60 * 24 * 180; // 180일

export async function GET(req: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await ctx.params;
  const provider = getProvider(id);
  if (!provider) return new NextResponse("unknown provider", { status: 404 });

  const clientId = process.env[provider.clientIdEnv];
  const clientSecret = process.env[provider.clientSecretEnv] ?? "";
  const origin = process.env.APP_ORIGIN;
  if (!clientId || !origin) return new NextResponse("auth not configured", { status: 500 });

  const redirectUri = `${origin}/api/auth/callbacks/${provider.id}`;
  const params = {
    code: req.nextUrl.searchParams.get("code"),
    state: req.nextUrl.searchParams.get("state"),
    storedState: req.cookies.get("oauth_state")?.value ?? null,
    codeVerifier: req.cookies.get("oauth_verifier")?.value ?? null,
    next: req.cookies.get("oauth_next")?.value ?? null,
  };

  try {
    const result = await completeOAuth(provider, params, {
      fetchImpl: fetch,
      upsert: upsertUser,
      clientId,
      clientSecret,
      redirectUri,
    });
    const res = NextResponse.redirect(new URL(result.redirectTo, origin));
    res.cookies.set(SESSION_COOKIE, result.sessionToken, sessionCookieOptions());
    res.cookies.set("last_provider", result.provider, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: LAST_PROVIDER_MAX_AGE,
    });
    res.cookies.delete("oauth_state");
    res.cookies.delete("oauth_verifier");
    res.cookies.delete("oauth_next");
    return res;
  } catch (e) {
    console.error("[oauth callback]", e);
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }
}
```

- [ ] **Step 3: logout 핸들러 작성**

Create `src/app/api/auth/logout/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
```

- [ ] **Step 4: 타입체크·빌드로 검증**

Run:
```bash
npm run typecheck && npm run lint
```
Expected: 에러 없음.

> 수동 스모크(값 채운 뒤): `npm run dev` → `/login` 진입 → 각 버튼 클릭 → provider 동의 → `/api/auth/callbacks/{provider}`가 세션 쿠키 설정 후 `next`로 복귀하는지 확인. 이 스텝은 자동 테스트 대상이 아니며, env·콘솔 등록 완료 후 사용자와 함께 확인.

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/auth
git commit -m "feat(auth): login·callback·logout route handler"
```

---

## Task 8: 로그인 페이지 (디자인 목업 → React)

**Files:**
- Create: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `last_provider` 쿠키(`next/headers`), page `searchParams`(Promise).
- Produces: `/login` 라우트. 버튼은 `/api/auth/login/{provider}?next=...` 링크.

> `design/project/Saju Login.dc.html` 디자인 기준. Apple 버튼은 이번 범위 밖이라 제외. Kakao·LINE·Google 3개만 렌더. `showLastLogin` 대신 `last_provider` 쿠키로 실제 배지 표시.

- [ ] **Step 1: 로그인 페이지 작성**

Create `src/app/login/page.tsx`:
```tsx
import Link from "next/link";
import { cookies } from "next/headers";

type ProviderId = "kakao" | "line" | "google";

const PROVIDERS: { id: ProviderId; label: string; className: string; icon: React.ReactNode }[] = [
  {
    id: "kakao",
    label: "카카오로 계속하기",
    className: "bg-[#FEE500] text-black/85 hover:brightness-[.97]",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <path fill="#191919" d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.65l-.95 3.5c-.08.31.27.56.54.38l4.18-2.77c.51.05 1.03.08 1.57.08 5.52 0 10-3.54 10-7.9S17.52 3 12 3z" />
      </svg>
    ),
  },
  {
    id: "line",
    label: "LINE으로 계속하기",
    className: "bg-[#06C755] text-white hover:brightness-[.96]",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <path fill="#fff" d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.65l-.95 3.5c-.08.31.27.56.54.38l4.18-2.77c.51.05 1.03.08 1.57.08 5.52 0 10-3.54 10-7.9S17.52 3 12 3z" />
      </svg>
    ),
  },
  {
    id: "google",
    label: "Google로 계속하기",
    className: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    icon: (
      <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
    ),
  },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const lastProvider = (await cookies()).get("last_provider")?.value;
  const nextQuery = next ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-slate-900 text-[15px] font-semibold text-white">
            사
          </div>
          <span className="text-base font-semibold tracking-tight">사주</span>
        </div>
        <Link href="/" className="text-sm font-medium text-slate-400 hover:text-slate-600">
          ← 돌아가기
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 pb-20 sm:px-8">
        <div className="w-full max-w-[380px] text-center">
          <h1 className="mb-2.5 text-2xl font-bold leading-snug tracking-tight [word-break:keep-all] sm:text-[28px]">
            사주에 오신 걸 환영해요
          </h1>
          <p className="mb-9 text-[15px] text-slate-400 [word-break:keep-all]">
            간편 로그인으로 3초 만에 시작하세요.
            <br />
            처음이라면 자동으로 가입돼요.
          </p>

          <div className="flex flex-col gap-2.5">
            {PROVIDERS.map((p) => (
              <a
                key={p.id}
                href={`/api/auth/login/${p.id}${nextQuery}`}
                className={`relative flex h-[52px] items-center justify-center rounded-[14px] text-[15px] font-semibold transition ${p.className}`}
              >
                <span className="absolute left-[18px] flex">{p.icon}</span>
                {p.label}
                {lastProvider === p.id && (
                  <span className="absolute right-3.5 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-white">
                    최근 로그인
                  </span>
                )}
              </a>
            ))}
          </div>

          <p className="mt-7 text-[12.5px] leading-[1.7] text-slate-400 [word-break:keep-all]">
            계속하면 사주의{" "}
            <a href="#" className="text-slate-500 underline">
              이용약관
            </a>{" "}
            및{" "}
            <a href="#" className="text-slate-500 underline">
              개인정보 처리방침
            </a>
            에 동의하는 것으로 간주됩니다.
          </p>
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-[12.5px] text-slate-300">
            🔒 입력하신 출생 정보는 안전하게 보관돼요
          </p>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: 타입체크·렌더 검증**

Run:
```bash
npm run typecheck
```
Expected: 에러 없음.
(선택) `npm run dev` 후 `/login` 진입해 3개 버튼이 디자인대로 보이는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/login/page.tsx
git commit -m "feat(auth): 로그인 페이지 (Kakao/LINE/Google)"
```

---

## Task 9: access.ts 세션 연동 (report 게이팅 seam)

**Files:**
- Modify: `src/app/report/_lib/access.ts`
- Modify: `src/app/report/_lib/access.test.ts`

**Interfaces:**
- Consumes: `SessionPayload`(from `@/lib/auth/session`).
- Produces (변경): `function getReportAccess(searchParams: SearchParams, session: SessionPayload | null): ReportAccess`
  - `isLoggedIn` = `session !== null || isPaid`
  - `isPaid` = `?paid=true` (결제 붙기 전 개발용 토글 유지)
  - `?login=true` 토글은 제거(실제 세션이 대체).
- 호출부(report/page)는 `getSession()`으로 세션을 읽어 인자로 주입. (async는 페이지에서만; `getReportAccess`는 순수 함수로 유지 → `next/headers` mock 없이 테스트 가능.)

- [ ] **Step 1: 테스트를 새 시그니처로 갱신**

Replace `src/app/report/_lib/access.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getReportAccess } from "./access";
import type { SessionPayload } from "@/lib/auth/session";

const session: SessionPayload = { userId: "1", provider: "google" };

describe("getReportAccess", () => {
  it("세션 없고 미결제면 비로그인·미결제", () => {
    expect(getReportAccess({}, null)).toEqual({ isLoggedIn: false, isPaid: false });
  });
  it("세션 있으면 로그인·미결제", () => {
    expect(getReportAccess({}, session)).toEqual({ isLoggedIn: true, isPaid: false });
  });
  it("?paid=true 는 로그인+결제 (세션 없어도 개발 토글)", () => {
    expect(getReportAccess({ paid: "true" }, null)).toEqual({ isLoggedIn: true, isPaid: true });
  });
  it("배열 쿼리값도 첫 값으로 처리", () => {
    expect(getReportAccess({ paid: ["true", "false"] }, null)).toEqual({ isLoggedIn: true, isPaid: true });
  });
  it("paid가 true가 아니면 결제 무시", () => {
    expect(getReportAccess({ paid: "1" }, null)).toEqual({ isLoggedIn: false, isPaid: false });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/app/report/_lib/access.test.ts`
Expected: FAIL — 인자 개수/`isLoggedIn` 불일치.

- [ ] **Step 3: access.ts 갱신**

Replace `src/app/report/_lib/access.ts`:
```ts
// 리포트 접근 권한. isLoggedIn은 실제 세션으로, isPaid는 결제 미구현이라 개발용 쿼리 토글 유지.
// 향후 결제 조회가 붙는 지점.

import type { SessionPayload } from "@/lib/auth/session";

export interface ReportAccess {
  isLoggedIn: boolean;
  isPaid: boolean;
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function getReportAccess(
  searchParams: SearchParams,
  session: SessionPayload | null,
): ReportAccess {
  const isPaid = first(searchParams.paid) === "true";
  const isLoggedIn = session !== null || isPaid;
  return { isLoggedIn, isPaid };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/app/report/_lib/access.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: 전체 스위트·타입체크**

Run:
```bash
npm run test && npm run typecheck
```
Expected: 전부 PASS, 타입 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add src/app/report/_lib/access.ts src/app/report/_lib/access.test.ts
git commit -m "feat(auth): report 게이팅을 세션 기반으로 (access seam)"
```

---

## Self-Review 결과

**Spec coverage:**
- 커스텀 OAuth(PKCE+state) → Task 3, 6, 7 ✅
- Stateless JWT 세션(jose) → Task 4 ✅
- 단일 users 테이블 → Task 1, 5 ✅
- 로그인 후 next 복귀(내부 경로만) → Task 3(safeNext), 6, 7 ✅
- 최근 로그인 배지 → Task 7(last_provider 쿠키 설정), 8(배지 렌더) ✅
- env 항목 → Task 1 ✅
- provider별 설정/프로필 → Task 2 ✅
- access.ts seam → Task 9 ✅
- 로그인 페이지(디자인) → Task 8 ✅
- 테스트(네트워크 mock) → Task 2~6, 9 ✅

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. 값이 빈 env는 사용자가 채우는 설계상 의도(placeholder 아님).

**Type consistency:** `SessionPayload`, `OAuthProfile`, `TokenResponse`, `ProviderConfig`, `CallbackParams/Deps/Result`, `UpsertUserInput`, `SqlClient` 시그니처가 정의 태스크(2·4·5·6)와 소비 태스크(6·7·9)에서 일치. `upsert` 반환 `{ id: string }`, `completeOAuth` 반환 `{ redirectTo, sessionToken, provider }` 일관.

**설계 대비 조정 1건:** spec은 `getReportAccess`를 async로 언급했으나, 코드베이스 DI 테스트 패턴에 맞춰 **세션을 인자로 받는 순수 함수**로 구현(async는 호출 페이지에서 `getSession()`). 테스트 용이성·일관성 개선.
