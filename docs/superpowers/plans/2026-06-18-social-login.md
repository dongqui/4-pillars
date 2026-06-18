# 간편 로그인 구현 계획 (Line / Kakao / Google / Apple)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Line·Kakao·Google·Apple 소셜 간편 로그인을 api(OAuth+세션) + web(공용 모달)로 구현한다.

**Architecture:** `apps/api`(Hono)가 4개 provider의 Authorization Code+PKCE 플로우를 직접 처리하고, 부모 도메인 httpOnly 세션 쿠키(opaque 토큰 + `sessions` 테이블)를 발급한다. 계정/세션 로직은 repo 포트를 주입받아 in-memory fake로 단위 테스트하고, Drizzle 구현이 실제 Supabase Postgres에 연결한다. 프론트는 `packages/ui`의 presentational `LoginModal`을 kr-web·jp-web이 공유한다.

**Tech Stack:** Hono, Drizzle ORM, postgres.js, jose(Apple client_secret 서명), Zod, Vitest, React 19, React Router 7, Tailwind.

## Global Constraints

- 범위: 소셜 간편 로그인만. 이메일/비번 로그인·회원가입 폼·결제·수동 계정 연결 UI·리프레시 토큰 회전은 **구현하지 않는다**.
- provider 이름은 정확히: `'google' | 'apple' | 'kakao' | 'line'`.
- 이메일 자동 연결은 `emailVerified === true`일 때만 한다. 미검증/없음이면 신규 유저 생성.
- 세션은 opaque 랜덤 토큰 + `sessions` 테이블. 쿠키는 httpOnly·Secure(prod)·SameSite=Lax, `Domain`은 `SESSION_COOKIE_DOMAIN`.
- 워크스페이스 패키지는 `./src/index.ts`를 직접 export한다(빌드 산출물 아님). 상대 import는 `.js` 확장자 사용(기존 ui 패키지 관례).
- 실제 키 값은 미정 — 코드는 env에서 읽고 `.env.example`에 자리만 둔다.
- 테스트 러너는 Vitest (`vitest run`), saju-core와 동일.

---

### Task 1: api 테스트 셋업 + DB 의존성 + Drizzle 스키마/클라이언트

**Files:**
- Modify: `apps/api/package.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/client.ts`
- Create: `apps/api/drizzle.config.ts`
- Test: `apps/api/src/db/schema.test.ts`

**Interfaces:**
- Produces:
  - `users`, `authIdentities`, `sessions` Drizzle 테이블 (from `src/db/schema.ts`)
  - `type ProviderName = 'google' | 'apple' | 'kakao' | 'line'` (from `src/db/schema.ts`)
  - `getDb(): PostgresJsDatabase<typeof schema>` (from `src/db/client.ts`, lazy 싱글턴)

- [ ] **Step 1: 의존성 추가**

`apps/api/package.json`의 `dependencies`에 추가:

```json
    "drizzle-orm": "^0.36.4",
    "postgres": "^3.4.5",
    "jose": "^5.9.6",
    "zod": "^3.23.8"
```

`devDependencies`에 추가:

```json
    "drizzle-kit": "^0.28.1",
    "vitest": "^2.1.8"
```

`scripts`에 추가:

```json
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
```

그다음 루트에서 `pnpm install` 실행.

- [ ] **Step 2: vitest 설정**

`apps/api/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: 스키마 실패 테스트 작성**

`apps/api/src/db/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { authIdentities, sessions, users } from "./schema.js";
import { getTableConfig } from "drizzle-orm/pg-core";

describe("auth schema", () => {
  it("users 테이블에 email/name/locale 컬럼이 있다", () => {
    const cols = getTableConfig(users).columns.map((c) => c.name);
    expect(cols).toEqual(
      expect.arrayContaining(["id", "email", "name", "locale", "created_at", "updated_at"]),
    );
  });

  it("auth_identities는 (provider, provider_user_id) 유니크 제약을 가진다", () => {
    const { uniqueConstraints } = getTableConfig(authIdentities);
    const cols = uniqueConstraints.flatMap((u) => u.columns.map((c) => c.name));
    expect(cols).toEqual(expect.arrayContaining(["provider", "provider_user_id"]));
  });

  it("sessions는 token 유니크 컬럼을 가진다", () => {
    const tokenCol = getTableConfig(sessions).columns.find((c) => c.name === "token");
    expect(tokenCol?.isUnique).toBe(true);
  });
});
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `pnpm --filter api exec vitest run src/db/schema.test.ts`
Expected: FAIL — `Cannot find module './schema.js'`

- [ ] **Step 5: 스키마 구현**

`apps/api/src/db/schema.ts`:

```ts
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export type ProviderName = "google" | "apple" | "kakao" | "line";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email"),
  name: text("name"),
  locale: text("locale"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    email: text("email"),
    emailVerified: boolean("email_verified").default(false).notNull(),
    rawProfile: jsonb("raw_profile"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    providerIdentity: unique("provider_identity").on(t.provider, t.providerUserId),
  }),
);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `pnpm --filter api exec vitest run src/db/schema.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 7: db 클라이언트 + drizzle 설정 작성**

`apps/api/src/db/client.ts`:

```ts
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

let db: PostgresJsDatabase<typeof schema> | undefined;

/** 지연 초기화된 Drizzle 클라이언트 싱글턴. */
export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    db = drizzle(postgres(url, { prepare: false }), { schema });
  }
  return db;
}
```

`apps/api/drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
```

- [ ] **Step 8: 타입체크 + 커밋**

Run: `pnpm --filter api typecheck`
Expected: 에러 없음

```bash
git add apps/api/package.json apps/api/vitest.config.ts apps/api/drizzle.config.ts apps/api/src/db pnpm-lock.yaml
git commit -m "feat(api): Drizzle 스키마(users/auth_identities/sessions) + db 클라이언트"
```

---

### Task 2: PKCE / state / nonce 헬퍼

**Files:**
- Create: `apps/api/src/auth/pkce.ts`
- Test: `apps/api/src/auth/pkce.test.ts`

**Interfaces:**
- Produces (from `src/auth/pkce.ts`):
  - `randomToken(bytes?: number): string` — base64url 랜덤 문자열
  - `generateState(): string`
  - `generateNonce(): string`
  - `createPkcePair(): { verifier: string; challenge: string }` — `challenge = base64url(sha256(verifier))`

- [ ] **Step 1: 실패 테스트 작성**

`apps/api/src/auth/pkce.test.ts`:

```ts
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPkcePair, generateNonce, generateState, randomToken } from "./pkce.js";

const b64url = (buf: Buffer) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("pkce", () => {
  it("randomToken은 매번 다른 base64url 문자열을 만든다", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("createPkcePair의 challenge는 verifier의 sha256 base64url이다", () => {
    const { verifier, challenge } = createPkcePair();
    const expected = b64url(createHash("sha256").update(verifier).digest());
    expect(challenge).toEqual(expected);
  });

  it("state와 nonce는 비어있지 않다", () => {
    expect(generateState().length).toBeGreaterThan(10);
    expect(generateNonce().length).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter api exec vitest run src/auth/pkce.test.ts`
Expected: FAIL — `Cannot find module './pkce.js'`

- [ ] **Step 3: 구현**

`apps/api/src/auth/pkce.ts`:

```ts
import { createHash, randomBytes } from "node:crypto";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url 인코딩된 암호학적 랜덤 토큰. */
export function randomToken(bytes = 32): string {
  return base64url(randomBytes(bytes));
}

export function generateState(): string {
  return randomToken(32);
}

export function generateNonce(): string {
  return randomToken(16);
}

/** PKCE verifier/challenge 쌍 (S256). */
export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomToken(48);
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter api exec vitest run src/auth/pkce.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/auth/pkce.ts apps/api/src/auth/pkce.test.ts
git commit -m "feat(api): PKCE/state/nonce 헬퍼"
```

---

### Task 3: 공통 타입 + 계정 연결 로직 (resolveUser)

**Files:**
- Create: `apps/api/src/auth/types.ts`
- Create: `apps/api/src/auth/account.ts`
- Test: `apps/api/src/auth/account.test.ts`

**Interfaces:**
- Produces (from `src/auth/types.ts`):
  ```ts
  import type { ProviderName } from "../db/schema.js";
  export type { ProviderName };
  export interface NormalizedProfile {
    providerUserId: string;
    email: string | null;
    emailVerified: boolean;
    name: string | null;
    raw: unknown;
  }
  export interface TokenResponse { accessToken: string; idToken?: string; raw: unknown; }
  export interface AuthorizeArgs { state: string; codeChallenge: string; nonce: string; }
  export interface OAuthProvider {
    name: ProviderName;
    buildAuthorizeUrl(args: AuthorizeArgs): string;
    exchangeCode(args: { code: string; codeVerifier: string }): Promise<TokenResponse>;
    fetchProfile(tokens: TokenResponse): Promise<NormalizedProfile>;
  }
  ```
- Produces (from `src/auth/account.ts`):
  ```ts
  export interface AuthRepo {
    findIdentity(provider: ProviderName, providerUserId: string): Promise<{ userId: string } | null>;
    findUserByEmail(email: string): Promise<{ id: string } | null>;
    createUser(input: { email: string | null; name: string | null; locale: string | null }): Promise<{ id: string }>;
    createIdentity(input: { userId: string; provider: ProviderName; providerUserId: string; email: string | null; emailVerified: boolean; rawProfile: unknown }): Promise<void>;
    getUserById(id: string): Promise<{ id: string; email: string | null; name: string | null; locale: string | null } | null>;
  }
  export function resolveUser(repo: AuthRepo, args: { provider: ProviderName; profile: NormalizedProfile; locale: string | null }): Promise<{ userId: string; created: boolean }>;
  ```

- [ ] **Step 1: 타입 파일 작성**

`apps/api/src/auth/types.ts` — 위 Interfaces의 `types.ts` 블록 내용을 그대로 작성한다.

- [ ] **Step 2: 실패 테스트 작성**

`apps/api/src/auth/account.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import type { AuthRepo } from "./account.js";
import { resolveUser } from "./account.js";
import type { NormalizedProfile, ProviderName } from "./types.js";

// 간단한 in-memory fake repo
function makeFakeRepo() {
  const users = new Map<string, { id: string; email: string | null; name: string | null; locale: string | null }>();
  const identities: { provider: ProviderName; providerUserId: string; userId: string }[] = [];
  let seq = 0;
  const repo: AuthRepo = {
    async findIdentity(provider, providerUserId) {
      const found = identities.find((i) => i.provider === provider && i.providerUserId === providerUserId);
      return found ? { userId: found.userId } : null;
    },
    async findUserByEmail(email) {
      for (const u of users.values()) if (u.email === email) return { id: u.id };
      return null;
    },
    async createUser(input) {
      const id = `u${++seq}`;
      users.set(id, { id, ...input });
      return { id };
    },
    async createIdentity(input) {
      identities.push({ provider: input.provider, providerUserId: input.providerUserId, userId: input.userId });
    },
    async getUserById(id) {
      return users.get(id) ?? null;
    },
  };
  return { repo, users, identities };
}

const profile = (over: Partial<NormalizedProfile> = {}): NormalizedProfile => ({
  providerUserId: "p123",
  email: "a@example.com",
  emailVerified: true,
  name: "Alice",
  raw: {},
  ...over,
});

describe("resolveUser", () => {
  let fake: ReturnType<typeof makeFakeRepo>;
  beforeEach(() => {
    fake = makeFakeRepo();
  });

  it("기존 identity가 있으면 그 유저로 로그인한다", async () => {
    const u = await fake.repo.createUser({ email: "a@example.com", name: "A", locale: "ko" });
    await fake.repo.createIdentity({ userId: u.id, provider: "google", providerUserId: "p123", email: "a@example.com", emailVerified: true, rawProfile: {} });
    const res = await resolveUser(fake.repo, { provider: "google", profile: profile(), locale: "ko" });
    expect(res).toEqual({ userId: u.id, created: false });
  });

  it("검증된 이메일이 같으면 기존 유저에 identity를 연결한다", async () => {
    const u = await fake.repo.createUser({ email: "a@example.com", name: "A", locale: "ko" });
    const res = await resolveUser(fake.repo, { provider: "kakao", profile: profile(), locale: "ko" });
    expect(res).toEqual({ userId: u.id, created: false });
    expect(fake.identities).toHaveLength(1);
  });

  it("이메일이 미검증이면 자동 연결하지 않고 새 유저를 만든다", async () => {
    await fake.repo.createUser({ email: "a@example.com", name: "A", locale: "ko" });
    const res = await resolveUser(fake.repo, { provider: "kakao", profile: profile({ emailVerified: false }), locale: "ko" });
    expect(res.created).toBe(true);
    expect(fake.users.size).toBe(2);
  });

  it("이메일이 없으면 새 유저를 만든다", async () => {
    const res = await resolveUser(fake.repo, { provider: "line", profile: profile({ email: null, emailVerified: false }), locale: "ja" });
    expect(res.created).toBe(true);
    expect(fake.users.size).toBe(1);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm --filter api exec vitest run src/auth/account.test.ts`
Expected: FAIL — `Cannot find module './account.js'`

- [ ] **Step 4: 구현**

`apps/api/src/auth/account.ts`:

```ts
import type { NormalizedProfile, ProviderName } from "./types.js";

export interface AuthRepo {
  findIdentity(provider: ProviderName, providerUserId: string): Promise<{ userId: string } | null>;
  findUserByEmail(email: string): Promise<{ id: string } | null>;
  createUser(input: { email: string | null; name: string | null; locale: string | null }): Promise<{ id: string }>;
  createIdentity(input: {
    userId: string;
    provider: ProviderName;
    providerUserId: string;
    email: string | null;
    emailVerified: boolean;
    rawProfile: unknown;
  }): Promise<void>;
  getUserById(id: string): Promise<{ id: string; email: string | null; name: string | null; locale: string | null } | null>;
}

/**
 * provider 프로필을 유저에 매핑한다.
 * 1) 기존 identity → 그 유저
 * 2) 검증된 이메일이 기존 유저와 일치 → identity 연결
 * 3) 그 외 → 새 유저 + identity 생성
 */
export async function resolveUser(
  repo: AuthRepo,
  args: { provider: ProviderName; profile: NormalizedProfile; locale: string | null },
): Promise<{ userId: string; created: boolean }> {
  const { provider, profile, locale } = args;

  const existing = await repo.findIdentity(provider, profile.providerUserId);
  if (existing) return { userId: existing.userId, created: false };

  let userId: string;
  let created: boolean;

  const linkable =
    profile.email !== null && profile.emailVerified
      ? await repo.findUserByEmail(profile.email)
      : null;

  if (linkable) {
    userId = linkable.id;
    created = false;
  } else {
    const u = await repo.createUser({ email: profile.email, name: profile.name, locale });
    userId = u.id;
    created = true;
  }

  await repo.createIdentity({
    userId,
    provider,
    providerUserId: profile.providerUserId,
    email: profile.email,
    emailVerified: profile.emailVerified,
    rawProfile: profile.raw,
  });

  return { userId, created };
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter api exec vitest run src/auth/account.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: 커밋**

```bash
git add apps/api/src/auth/types.ts apps/api/src/auth/account.ts apps/api/src/auth/account.test.ts
git commit -m "feat(api): 공통 auth 타입 + 계정 연결 로직(resolveUser)"
```

---

### Task 4: 세션 발급/조회/철회 로직

**Files:**
- Create: `apps/api/src/auth/session.ts`
- Test: `apps/api/src/auth/session.test.ts`

**Interfaces:**
- Produces (from `src/auth/session.ts`):
  ```ts
  export interface SessionRepo {
    createSession(input: { token: string; userId: string; expiresAt: Date }): Promise<void>;
    findSession(token: string): Promise<{ userId: string; expiresAt: Date; revokedAt: Date | null } | null>;
    revokeSession(token: string, revokedAt: Date): Promise<void>;
  }
  export const SESSION_TTL_MS: number; // 30일
  export function issueSession(repo: SessionRepo, userId: string, now?: Date): Promise<{ token: string; expiresAt: Date }>;
  export function getSessionUser(repo: SessionRepo, token: string, now?: Date): Promise<{ userId: string } | null>;
  export function endSession(repo: SessionRepo, token: string, now?: Date): Promise<void>;
  ```

- [ ] **Step 1: 실패 테스트 작성**

`apps/api/src/auth/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SessionRepo } from "./session.js";
import { endSession, getSessionUser, issueSession } from "./session.js";

function makeFakeRepo() {
  const rows = new Map<string, { userId: string; expiresAt: Date; revokedAt: Date | null }>();
  const repo: SessionRepo = {
    async createSession({ token, userId, expiresAt }) {
      rows.set(token, { userId, expiresAt, revokedAt: null });
    },
    async findSession(token) {
      return rows.get(token) ?? null;
    },
    async revokeSession(token, revokedAt) {
      const r = rows.get(token);
      if (r) r.revokedAt = revokedAt;
    },
  };
  return { repo, rows };
}

describe("session", () => {
  it("issueSession은 토큰을 만들고 저장한다", async () => {
    const { repo, rows } = makeFakeRepo();
    const now = new Date("2026-06-18T00:00:00Z");
    const { token, expiresAt } = await issueSession(repo, "u1", now);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    expect(rows.get(token)?.userId).toBe("u1");
  });

  it("유효 세션은 userId를 반환한다", async () => {
    const { repo } = makeFakeRepo();
    const now = new Date("2026-06-18T00:00:00Z");
    const { token } = await issueSession(repo, "u1", now);
    expect(await getSessionUser(repo, token, now)).toEqual({ userId: "u1" });
  });

  it("만료된 세션은 null을 반환한다", async () => {
    const { repo } = makeFakeRepo();
    const now = new Date("2026-06-18T00:00:00Z");
    const { token, expiresAt } = await issueSession(repo, "u1", now);
    const later = new Date(expiresAt.getTime() + 1000);
    expect(await getSessionUser(repo, token, later)).toBeNull();
  });

  it("철회된 세션은 null을 반환한다", async () => {
    const { repo } = makeFakeRepo();
    const now = new Date("2026-06-18T00:00:00Z");
    const { token } = await issueSession(repo, "u1", now);
    await endSession(repo, token, now);
    expect(await getSessionUser(repo, token, now)).toBeNull();
  });

  it("없는 토큰은 null을 반환한다", async () => {
    const { repo } = makeFakeRepo();
    expect(await getSessionUser(repo, "nope")).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter api exec vitest run src/auth/session.test.ts`
Expected: FAIL — `Cannot find module './session.js'`

- [ ] **Step 3: 구현**

`apps/api/src/auth/session.ts`:

```ts
import { randomToken } from "./pkce.js";

export interface SessionRepo {
  createSession(input: { token: string; userId: string; expiresAt: Date }): Promise<void>;
  findSession(token: string): Promise<{ userId: string; expiresAt: Date; revokedAt: Date | null } | null>;
  revokeSession(token: string, revokedAt: Date): Promise<void>;
}

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function issueSession(
  repo: SessionRepo,
  userId: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(48);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await repo.createSession({ token, userId, expiresAt });
  return { token, expiresAt };
}

export async function getSessionUser(
  repo: SessionRepo,
  token: string,
  now: Date = new Date(),
): Promise<{ userId: string } | null> {
  const row = await repo.findSession(token);
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() <= now.getTime()) return null;
  return { userId: row.userId };
}

export async function endSession(
  repo: SessionRepo,
  token: string,
  now: Date = new Date(),
): Promise<void> {
  await repo.revokeSession(token, now);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter api exec vitest run src/auth/session.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/auth/session.ts apps/api/src/auth/session.test.ts
git commit -m "feat(api): 세션 발급/조회/철회 로직"
```

---

### Task 5: provider HTTP 헬퍼 (postForm / getJson / decodeJwtPayload)

**Files:**
- Create: `apps/api/src/auth/providers/http.ts`
- Test: `apps/api/src/auth/providers/http.test.ts`

**Interfaces:**
- Produces (from `src/auth/providers/http.ts`):
  - `postForm(url: string, params: Record<string, string>, headers?: Record<string, string>): Promise<any>`
  - `getJson(url: string, headers?: Record<string, string>): Promise<any>`
  - `decodeJwtPayload(jwt: string): any` — 서명 검증 없이 payload 디코드 (토큰은 token endpoint에서 TLS로 직접 수신했으므로 MVP에서 신뢰)

- [ ] **Step 1: 실패 테스트 작성**

`apps/api/src/auth/providers/http.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decodeJwtPayload } from "./http.js";

describe("decodeJwtPayload", () => {
  it("JWT payload를 디코드한다", () => {
    const payload = { sub: "123", email: "a@b.com" };
    const b64 = (o: unknown) =>
      Buffer.from(JSON.stringify(o)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const jwt = `${b64({ alg: "none" })}.${b64(payload)}.sig`;
    expect(decodeJwtPayload(jwt)).toEqual(payload);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter api exec vitest run src/auth/providers/http.test.ts`
Expected: FAIL — `Cannot find module './http.js'`

- [ ] **Step 3: 구현**

`apps/api/src/auth/providers/http.ts`:

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function postForm(
  url: string,
  params: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", ...headers },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) throw new Error(`token endpoint ${url} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers } });
  if (!res.ok) throw new Error(`userinfo ${url} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** 서명 검증 없이 JWT payload만 디코드한다. */
export function decodeJwtPayload(jwt: string): any {
  const part = jwt.split(".")[1];
  if (!part) throw new Error("invalid jwt");
  const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter api exec vitest run src/auth/providers/http.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/auth/providers/http.ts apps/api/src/auth/providers/http.test.ts
git commit -m "feat(api): provider HTTP/JWT 헬퍼"
```

---

### Task 6: Google provider

**Files:**
- Create: `apps/api/src/auth/providers/google.ts`
- Test: `apps/api/src/auth/providers/google.test.ts`

**Interfaces:**
- Consumes: `OAuthProvider`, `ProviderConfig` 형태 `{ clientId; clientSecret; redirectUri }`; `decodeJwtPayload`, `postForm`, `getJson`.
- Produces: `createGoogleProvider(config: { clientId: string; clientSecret: string; redirectUri: string }): OAuthProvider`

- [ ] **Step 1: 실패 테스트 작성**

`apps/api/src/auth/providers/google.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { createGoogleProvider } from "./google.js";

const config = { clientId: "cid", clientSecret: "secret", redirectUri: "https://api.x/auth/google/callback" };

afterEach(() => vi.restoreAllMocks());

describe("google provider", () => {
  it("authorize URL에 client_id, redirect_uri, S256, state를 포함한다", () => {
    const p = createGoogleProvider(config);
    const url = new URL(p.buildAuthorizeUrl({ state: "st", codeChallenge: "ch", nonce: "no" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("scope")).toContain("email");
  });

  it("fetchProfile은 id_token에서 정규화된 프로필을 만든다", async () => {
    const p = createGoogleProvider(config);
    const b64 = (o: unknown) =>
      Buffer.from(JSON.stringify(o)).toString("base64url");
    const idToken = `h.${b64({ sub: "g1", email: "a@b.com", email_verified: true, name: "Al" })}.s`;
    const profile = await p.fetchProfile({ accessToken: "x", idToken, raw: {} });
    expect(profile).toMatchObject({ providerUserId: "g1", email: "a@b.com", emailVerified: true, name: "Al" });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter api exec vitest run src/auth/providers/google.test.ts`
Expected: FAIL — `Cannot find module './google.js'`

- [ ] **Step 3: 구현**

`apps/api/src/auth/providers/google.ts`:

```ts
import type { OAuthProvider, TokenResponse } from "../types.js";
import { decodeJwtPayload, postForm } from "./http.js";

export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";

export function createGoogleProvider(config: ProviderConfig): OAuthProvider {
  return {
    name: "google",
    buildAuthorizeUrl({ state, codeChallenge, nonce }) {
      const q = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      return `${AUTHORIZE}?${q.toString()}`;
    },
    async exchangeCode({ code, codeVerifier }): Promise<TokenResponse> {
      const data = await postForm(TOKEN, {
        grant_type: "authorization_code",
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
      });
      return { accessToken: data.access_token, idToken: data.id_token, raw: data };
    },
    async fetchProfile(tokens) {
      const claims = decodeJwtPayload(tokens.idToken ?? "");
      return {
        providerUserId: String(claims.sub),
        email: claims.email ?? null,
        emailVerified: Boolean(claims.email_verified),
        name: claims.name ?? null,
        raw: claims,
      };
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter api exec vitest run src/auth/providers/google.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/auth/providers/google.ts apps/api/src/auth/providers/google.test.ts
git commit -m "feat(api): Google OAuth provider"
```

---

### Task 7: Line provider

**Files:**
- Create: `apps/api/src/auth/providers/line.ts`
- Test: `apps/api/src/auth/providers/line.test.ts`

**Interfaces:**
- Consumes: `OAuthProvider`, `ProviderConfig` (from `./google.js`), `decodeJwtPayload`, `postForm`.
- Produces: `createLineProvider(config: ProviderConfig): OAuthProvider`

- [ ] **Step 1: 실패 테스트 작성**

`apps/api/src/auth/providers/line.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createLineProvider } from "./line.js";

const config = { clientId: "cid", clientSecret: "secret", redirectUri: "https://api.x/auth/line/callback" };

describe("line provider", () => {
  it("authorize URL은 LINE 엔드포인트 + openid email scope를 사용한다", () => {
    const p = createLineProvider(config);
    const url = new URL(p.buildAuthorizeUrl({ state: "st", codeChallenge: "ch", nonce: "no" }));
    expect(url.origin + url.pathname).toBe("https://access.line.me/oauth2/v2.1/authorize");
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("nonce")).toBe("no");
  });

  it("fetchProfile은 id_token claims에서 프로필을 만든다", async () => {
    const p = createLineProvider(config);
    const idToken = `h.${Buffer.from(JSON.stringify({ sub: "L1", email: "a@b.com", name: "Lee" })).toString("base64url")}.s`;
    const profile = await p.fetchProfile({ accessToken: "x", idToken, raw: {} });
    expect(profile).toMatchObject({ providerUserId: "L1", email: "a@b.com", emailVerified: true, name: "Lee" });
  });
});
```

> 참고: LINE은 email claim을 채널 승인 시에만 내려주며, 내려준 이메일은 검증된 것으로 간주한다(`emailVerified = email !== null`).

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter api exec vitest run src/auth/providers/line.test.ts`
Expected: FAIL — `Cannot find module './line.js'`

- [ ] **Step 3: 구현**

`apps/api/src/auth/providers/line.ts`:

```ts
import type { OAuthProvider, TokenResponse } from "../types.js";
import type { ProviderConfig } from "./google.js";
import { decodeJwtPayload, postForm } from "./http.js";

const AUTHORIZE = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN = "https://api.line.me/oauth2/v2.1/token";

export function createLineProvider(config: ProviderConfig): OAuthProvider {
  return {
    name: "line",
    buildAuthorizeUrl({ state, codeChallenge, nonce }) {
      const q = new URLSearchParams({
        response_type: "code",
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: "openid profile email",
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      return `${AUTHORIZE}?${q.toString()}`;
    },
    async exchangeCode({ code, codeVerifier }): Promise<TokenResponse> {
      const data = await postForm(TOKEN, {
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code_verifier: codeVerifier,
      });
      return { accessToken: data.access_token, idToken: data.id_token, raw: data };
    },
    async fetchProfile(tokens) {
      const claims = decodeJwtPayload(tokens.idToken ?? "");
      const email = claims.email ?? null;
      return {
        providerUserId: String(claims.sub),
        email,
        emailVerified: email !== null,
        name: claims.name ?? null,
        raw: claims,
      };
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter api exec vitest run src/auth/providers/line.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/auth/providers/line.ts apps/api/src/auth/providers/line.test.ts
git commit -m "feat(api): LINE OAuth provider"
```

---

### Task 8: Kakao provider

**Files:**
- Create: `apps/api/src/auth/providers/kakao.ts`
- Test: `apps/api/src/auth/providers/kakao.test.ts`

**Interfaces:**
- Consumes: `OAuthProvider`, `ProviderConfig` (from `./google.js`), `postForm`, `getJson`.
- Produces: `createKakaoProvider(config: ProviderConfig): OAuthProvider`

- [ ] **Step 1: 실패 테스트 작성**

`apps/api/src/auth/providers/kakao.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createKakaoProvider } from "./kakao.js";
import * as http from "./http.js";

const config = { clientId: "cid", clientSecret: "secret", redirectUri: "https://api.x/auth/kakao/callback" };

afterEach(() => vi.restoreAllMocks());

describe("kakao provider", () => {
  it("authorize URL은 kauth 엔드포인트를 사용한다", () => {
    const p = createKakaoProvider(config);
    const url = new URL(p.buildAuthorizeUrl({ state: "st", codeChallenge: "ch", nonce: "no" }));
    expect(url.origin + url.pathname).toBe("https://kauth.kakao.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("state")).toBe("st");
  });

  it("fetchProfile은 /v2/user/me 응답을 정규화한다 (is_email_verified 반영)", async () => {
    const p = createKakaoProvider(config);
    vi.spyOn(http, "getJson").mockResolvedValue({
      id: 777,
      kakao_account: { email: "a@b.com", is_email_verified: true, profile: { nickname: "Kim" } },
    });
    const profile = await p.fetchProfile({ accessToken: "tok", raw: {} });
    expect(profile).toMatchObject({ providerUserId: "777", email: "a@b.com", emailVerified: true, name: "Kim" });
  });

  it("이메일 미동의 시 email은 null, emailVerified는 false", async () => {
    const p = createKakaoProvider(config);
    vi.spyOn(http, "getJson").mockResolvedValue({ id: 1, kakao_account: { profile: { nickname: "K" } } });
    const profile = await p.fetchProfile({ accessToken: "tok", raw: {} });
    expect(profile.email).toBeNull();
    expect(profile.emailVerified).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter api exec vitest run src/auth/providers/kakao.test.ts`
Expected: FAIL — `Cannot find module './kakao.js'`

- [ ] **Step 3: 구현**

`apps/api/src/auth/providers/kakao.ts`:

```ts
import type { OAuthProvider, TokenResponse } from "../types.js";
import type { ProviderConfig } from "./google.js";
import { getJson, postForm } from "./http.js";

const AUTHORIZE = "https://kauth.kakao.com/oauth/authorize";
const TOKEN = "https://kauth.kakao.com/oauth/token";
const USERINFO = "https://kapi.kakao.com/v2/user/me";

export function createKakaoProvider(config: ProviderConfig): OAuthProvider {
  return {
    name: "kakao",
    buildAuthorizeUrl({ state, codeChallenge }) {
      const q = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: "account_email profile_nickname",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      return `${AUTHORIZE}?${q.toString()}`;
    },
    async exchangeCode({ code, codeVerifier }): Promise<TokenResponse> {
      const data = await postForm(TOKEN, {
        grant_type: "authorization_code",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
        code_verifier: codeVerifier,
      });
      return { accessToken: data.access_token, idToken: data.id_token, raw: data };
    },
    async fetchProfile(tokens) {
      const data = await getJson(USERINFO, { Authorization: `Bearer ${tokens.accessToken}` });
      const account = data.kakao_account ?? {};
      const email = account.email ?? null;
      return {
        providerUserId: String(data.id),
        email,
        emailVerified: email !== null && account.is_email_verified === true,
        name: account.profile?.nickname ?? null,
        raw: data,
      };
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter api exec vitest run src/auth/providers/kakao.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/auth/providers/kakao.ts apps/api/src/auth/providers/kakao.test.ts
git commit -m "feat(api): Kakao OAuth provider"
```

---

### Task 9: Apple provider (client_secret JWT 서명)

**Files:**
- Create: `apps/api/src/auth/providers/apple.ts`
- Test: `apps/api/src/auth/providers/apple.test.ts`

**Interfaces:**
- Consumes: `OAuthProvider`, `decodeJwtPayload`, `postForm`; `jose`의 `SignJWT`, `importPKCS8`.
- Produces: `createAppleProvider(config: { clientId: string; teamId: string; keyId: string; privateKey: string; redirectUri: string }): OAuthProvider`

- [ ] **Step 1: 실패 테스트 작성**

`apps/api/src/auth/providers/apple.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createAppleProvider } from "./apple.js";

const config = {
  clientId: "com.x.app",
  teamId: "TEAM123",
  keyId: "KEY123",
  // 테스트용 ES256 PKCS8 (실제 비밀 아님)
  privateKey:
    "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgevZzL1gdAFr88hb2\nOF/2NxApJCzGCEDdfSp6VQO30hyhRANCAAQRWz+jn65BtOMvdyHKcvjBeBSDZH2r\n1RTwjmYSi9R/zpBnuQ4EiMnCqfMPWiZqB4QdbAd0E7oH50VpuZ1P087G\n-----END PRIVATE KEY-----",
  redirectUri: "https://api.x/auth/apple/callback",
};

describe("apple provider", () => {
  it("authorize URL은 appleid 엔드포인트 + response_mode=form_post를 쓴다", () => {
    const p = createAppleProvider(config);
    const url = new URL(p.buildAuthorizeUrl({ state: "st", codeChallenge: "ch", nonce: "no" }));
    expect(url.origin + url.pathname).toBe("https://appleid.apple.com/auth/authorize");
    expect(url.searchParams.get("response_mode")).toBe("form_post");
    expect(url.searchParams.get("scope")).toContain("email");
    expect(url.searchParams.get("state")).toBe("st");
  });

  it("fetchProfile은 id_token claims에서 프로필을 만든다", async () => {
    const p = createAppleProvider(config);
    const idToken = `h.${Buffer.from(JSON.stringify({ sub: "A1", email: "a@b.com", email_verified: "true" })).toString("base64url")}.s`;
    const profile = await p.fetchProfile({ accessToken: "x", idToken, raw: {} });
    expect(profile).toMatchObject({ providerUserId: "A1", email: "a@b.com", emailVerified: true });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter api exec vitest run src/auth/providers/apple.test.ts`
Expected: FAIL — `Cannot find module './apple.js'`

- [ ] **Step 3: 구현**

`apps/api/src/auth/providers/apple.ts`:

```ts
import { SignJWT, importPKCS8 } from "jose";
import type { OAuthProvider, TokenResponse } from "../types.js";
import { decodeJwtPayload, postForm } from "./http.js";

export interface AppleConfig {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
  redirectUri: string;
}

const AUTHORIZE = "https://appleid.apple.com/auth/authorize";
const TOKEN = "https://appleid.apple.com/auth/token";

async function buildClientSecret(config: AppleConfig): Promise<string> {
  const key = await importPKCS8(config.privateKey, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .setAudience("https://appleid.apple.com")
    .setSubject(config.clientId)
    .sign(key);
}

export function createAppleProvider(config: AppleConfig): OAuthProvider {
  return {
    name: "apple",
    buildAuthorizeUrl({ state, codeChallenge, nonce }) {
      const q = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        response_mode: "form_post",
        scope: "name email",
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      return `${AUTHORIZE}?${q.toString()}`;
    },
    async exchangeCode({ code, codeVerifier }): Promise<TokenResponse> {
      const clientSecret = await buildClientSecret(config);
      const data = await postForm(TOKEN, {
        grant_type: "authorization_code",
        code,
        client_id: config.clientId,
        client_secret: clientSecret,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
      });
      return { accessToken: data.access_token, idToken: data.id_token, raw: data };
    },
    async fetchProfile(tokens) {
      const claims = decodeJwtPayload(tokens.idToken ?? "");
      return {
        providerUserId: String(claims.sub),
        email: claims.email ?? null,
        // Apple은 email_verified를 문자열 "true"/불리언 둘 다로 보낼 수 있다
        emailVerified: claims.email_verified === true || claims.email_verified === "true",
        name: null, // name은 최초 form_post 바디에서만 옴 (라우트에서 별도 처리)
        raw: claims,
      };
    },
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter api exec vitest run src/auth/providers/apple.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/auth/providers/apple.ts apps/api/src/auth/providers/apple.test.ts
git commit -m "feat(api): Apple OAuth provider (client_secret JWT)"
```

---

### Task 10: 설정 로더 + provider 레지스트리

**Files:**
- Create: `apps/api/src/config.ts`
- Create: `apps/api/src/auth/providers/index.ts`
- Create: `apps/api/.env.example`
- Test: `apps/api/src/config.test.ts`

**Interfaces:**
- Produces (from `src/config.ts`):
  ```ts
  export interface AppConfig {
    sessionCookieName: string;
    sessionCookieDomain: string;
    secureCookies: boolean;
    webOrigins: string[];
    defaultRedirect: string;
  }
  export function loadConfig(env?: NodeJS.ProcessEnv): AppConfig;
  ```
- Produces (from `src/auth/providers/index.ts`):
  - `buildProviders(env?: NodeJS.ProcessEnv): Record<ProviderName, OAuthProvider>`

- [ ] **Step 1: 실패 테스트 작성**

`apps/api/src/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("WEB_ORIGINS를 콤마로 분리한다", () => {
    const cfg = loadConfig({
      SESSION_COOKIE_DOMAIN: ".example.com",
      WEB_ORIGINS: "https://kr.example.com,https://jp.example.com",
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);
    expect(cfg.webOrigins).toEqual(["https://kr.example.com", "https://jp.example.com"]);
    expect(cfg.secureCookies).toBe(true);
    expect(cfg.sessionCookieDomain).toBe(".example.com");
  });

  it("개발 환경에서는 secureCookies가 false다", () => {
    const cfg = loadConfig({ WEB_ORIGINS: "http://localhost:3000", NODE_ENV: "development" } as NodeJS.ProcessEnv);
    expect(cfg.secureCookies).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter api exec vitest run src/config.test.ts`
Expected: FAIL — `Cannot find module './config.js'`

- [ ] **Step 3: 구현**

`apps/api/src/config.ts`:

```ts
export interface AppConfig {
  sessionCookieName: string;
  sessionCookieDomain: string;
  secureCookies: boolean;
  webOrigins: string[];
  defaultRedirect: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const webOrigins = (env.WEB_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    sessionCookieName: env.SESSION_COOKIE_NAME ?? "sid",
    sessionCookieDomain: env.SESSION_COOKIE_DOMAIN ?? "",
    secureCookies: env.NODE_ENV === "production",
    webOrigins,
    defaultRedirect: env.DEFAULT_REDIRECT ?? webOrigins[0] ?? "http://localhost:3000",
  };
}
```

`apps/api/src/auth/providers/index.ts`:

```ts
import type { ProviderName } from "../../db/schema.js";
import type { OAuthProvider } from "../types.js";
import { createAppleProvider } from "./apple.js";
import { createGoogleProvider } from "./google.js";
import { createKakaoProvider } from "./kakao.js";
import { createLineProvider } from "./line.js";

export function buildProviders(env: NodeJS.ProcessEnv = process.env): Record<ProviderName, OAuthProvider> {
  return {
    google: createGoogleProvider({
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
      redirectUri: env.GOOGLE_REDIRECT_URI ?? "",
    }),
    kakao: createKakaoProvider({
      clientId: env.KAKAO_CLIENT_ID ?? "",
      clientSecret: env.KAKAO_CLIENT_SECRET ?? "",
      redirectUri: env.KAKAO_REDIRECT_URI ?? "",
    }),
    line: createLineProvider({
      clientId: env.LINE_CLIENT_ID ?? "",
      clientSecret: env.LINE_CLIENT_SECRET ?? "",
      redirectUri: env.LINE_REDIRECT_URI ?? "",
    }),
    apple: createAppleProvider({
      clientId: env.APPLE_CLIENT_ID ?? "",
      teamId: env.APPLE_TEAM_ID ?? "",
      keyId: env.APPLE_KEY_ID ?? "",
      privateKey: (env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
      redirectUri: env.APPLE_REDIRECT_URI ?? "",
    }),
  };
}
```

`apps/api/.env.example`:

```
DATABASE_URL=
NODE_ENV=development
SESSION_COOKIE_NAME=sid
SESSION_COOKIE_DOMAIN=.example.com
WEB_ORIGINS=http://localhost:3000,http://localhost:3001
DEFAULT_REDIRECT=http://localhost:3000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
KAKAO_REDIRECT_URI=

LINE_CLIENT_ID=
LINE_CLIENT_SECRET=
LINE_REDIRECT_URI=

APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
APPLE_REDIRECT_URI=
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter api exec vitest run src/config.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add apps/api/src/config.ts apps/api/src/config.test.ts apps/api/src/auth/providers/index.ts apps/api/.env.example
git commit -m "feat(api): 설정 로더 + provider 레지스트리 + .env.example"
```

---

### Task 11: Drizzle 기반 repo 구현 (DbAuthRepo / DbSessionRepo)

**Files:**
- Create: `apps/api/src/db/repo.ts`

**Interfaces:**
- Consumes: `AuthRepo` (from `../auth/account.js`), `SessionRepo` (from `../auth/session.js`), `getDb`, schema 테이블.
- Produces:
  - `createDbAuthRepo(db = getDb()): AuthRepo`
  - `createDbSessionRepo(db = getDb()): SessionRepo`

> 이 태스크는 실제 DB 연결이 필요한 통합 코드라 단위 테스트 대신 타입체크로 검증한다. 포트 인터페이스(AuthRepo/SessionRepo)는 Task 3·4에서 이미 fake로 테스트됨.

- [ ] **Step 1: 구현**

`apps/api/src/db/repo.ts`:

```ts
import { and, eq } from "drizzle-orm";
import type { AuthRepo } from "../auth/account.js";
import type { SessionRepo } from "../auth/session.js";
import { getDb } from "./client.js";
import { authIdentities, sessions, users } from "./schema.js";

type Db = ReturnType<typeof getDb>;

export function createDbAuthRepo(db: Db = getDb()): AuthRepo {
  return {
    async findIdentity(provider, providerUserId) {
      const [row] = await db
        .select({ userId: authIdentities.userId })
        .from(authIdentities)
        .where(and(eq(authIdentities.provider, provider), eq(authIdentities.providerUserId, providerUserId)))
        .limit(1);
      return row ?? null;
    },
    async findUserByEmail(email) {
      const [row] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      return row ?? null;
    },
    async createUser(input) {
      const [row] = await db.insert(users).values(input).returning({ id: users.id });
      return row;
    },
    async createIdentity(input) {
      await db.insert(authIdentities).values({
        userId: input.userId,
        provider: input.provider,
        providerUserId: input.providerUserId,
        email: input.email,
        emailVerified: input.emailVerified,
        rawProfile: input.rawProfile,
      });
    },
    async getUserById(id) {
      const [row] = await db
        .select({ id: users.id, email: users.email, name: users.name, locale: users.locale })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return row ?? null;
    },
  };
}

export function createDbSessionRepo(db: Db = getDb()): SessionRepo {
  return {
    async createSession(input) {
      await db.insert(sessions).values(input);
    },
    async findSession(token) {
      const [row] = await db
        .select({ userId: sessions.userId, expiresAt: sessions.expiresAt, revokedAt: sessions.revokedAt })
        .from(sessions)
        .where(eq(sessions.token, token))
        .limit(1);
      return row ?? null;
    },
    async revokeSession(token, revokedAt) {
      await db.update(sessions).set({ revokedAt }).where(eq(sessions.token, token));
    },
  };
}
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `pnpm --filter api typecheck`
Expected: 에러 없음

```bash
git add apps/api/src/db/repo.ts
git commit -m "feat(api): Drizzle 기반 AuthRepo/SessionRepo 구현"
```

---

### Task 12: Hono 인증 라우트 (start/callback/me/logout)

**Files:**
- Create: `apps/api/src/auth/routes.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/src/auth/routes.test.ts`

**Interfaces:**
- Consumes: `OAuthProvider`, `AuthRepo`, `SessionRepo`, `AppConfig`, `resolveUser`, `issueSession`, `getSessionUser`, `endSession`, `generateState`, `generateNonce`, `createPkcePair`.
- Produces:
  ```ts
  export interface AuthDeps {
    providers: Record<ProviderName, OAuthProvider>;
    authRepo: AuthRepo;
    sessionRepo: SessionRepo;
    config: AppConfig;
    now?: () => Date;
  }
  export function createAuthRoutes(deps: AuthDeps): Hono;
  ```

라우트:
- `GET /:provider/start?redirect=URL` — provider 검증, redirect를 webOrigins로 검증, state/pkce/nonce 생성 후 임시 쿠키(`oauth_tx`, httpOnly, path `/auth`, 600초)에 저장, authorize URL로 302.
- `GET|POST /:provider/callback` — `oauth_tx` 쿠키 읽어 state 일치 검증, code 교환, 프로필 조회, `resolveUser`, `issueSession`, 세션 쿠키 설정, `oauth_tx` 삭제, 저장된 redirect로 302.
- `GET /me` — 세션 쿠키 → `getSessionUser` → `authRepo.getUserById` → JSON, 없으면 401.
- `POST /logout` — `endSession` + 세션 쿠키 삭제.

- [ ] **Step 1: 실패 테스트 작성**

`apps/api/src/auth/routes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createAuthRoutes, type AuthDeps } from "./routes.js";
import type { AuthRepo } from "./account.js";
import type { SessionRepo } from "./session.js";
import type { OAuthProvider } from "./types.js";

function fakeProvider(name: OAuthProvider["name"]): OAuthProvider {
  return {
    name,
    buildAuthorizeUrl: ({ state }) => `https://provider.test/authorize?state=${state}`,
    exchangeCode: async () => ({ accessToken: "at", idToken: "it", raw: {} }),
    fetchProfile: async () => ({ providerUserId: "p1", email: "a@b.com", emailVerified: true, name: "A", raw: {} }),
  };
}

function fakeDeps(): AuthDeps {
  const sessionRows = new Map<string, { userId: string; expiresAt: Date; revokedAt: Date | null }>();
  const authRepo: AuthRepo = {
    findIdentity: async () => ({ userId: "u1" }),
    findUserByEmail: async () => null,
    createUser: async () => ({ id: "u1" }),
    createIdentity: async () => {},
    getUserById: async (id) => ({ id, email: "a@b.com", name: "A", locale: "ko" }),
  };
  const sessionRepo: SessionRepo = {
    createSession: async ({ token, userId, expiresAt }) => void sessionRows.set(token, { userId, expiresAt, revokedAt: null }),
    findSession: async (t) => sessionRows.get(t) ?? null,
    revokeSession: async (t, at) => { const r = sessionRows.get(t); if (r) r.revokedAt = at; },
  };
  return {
    providers: { google: fakeProvider("google"), kakao: fakeProvider("kakao"), line: fakeProvider("line"), apple: fakeProvider("apple") },
    authRepo,
    sessionRepo,
    config: {
      sessionCookieName: "sid",
      sessionCookieDomain: "",
      secureCookies: false,
      webOrigins: ["http://localhost:3000"],
      defaultRedirect: "http://localhost:3000",
    },
  };
}

describe("auth routes", () => {
  it("start는 authorize URL로 302 리다이렉트하고 oauth_tx 쿠키를 세팅한다", async () => {
    const app = createAuthRoutes(fakeDeps());
    const res = await app.request("/google/start?redirect=http://localhost:3000/welcome");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("https://provider.test/authorize");
    expect(res.headers.get("set-cookie")).toContain("oauth_tx=");
  });

  it("허용되지 않은 redirect는 400을 반환한다", async () => {
    const app = createAuthRoutes(fakeDeps());
    const res = await app.request("/google/start?redirect=https://evil.com");
    expect(res.status).toBe(400);
  });

  it("알 수 없는 provider는 404를 반환한다", async () => {
    const app = createAuthRoutes(fakeDeps());
    const res = await app.request("/twitter/start?redirect=http://localhost:3000");
    expect(res.status).toBe(404);
  });

  it("me는 세션 쿠키가 없으면 401을 반환한다", async () => {
    const app = createAuthRoutes(fakeDeps());
    const res = await app.request("/me");
    expect(res.status).toBe(401);
  });

  it("callback은 state 불일치 시 400을 반환한다", async () => {
    const app = createAuthRoutes(fakeDeps());
    const res = await app.request("/google/callback?code=c&state=mismatch", {
      headers: { cookie: "oauth_tx=" + encodeURIComponent(JSON.stringify({ state: "real", verifier: "v", nonce: "n", redirect: "http://localhost:3000" })) },
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter api exec vitest run src/auth/routes.test.ts`
Expected: FAIL — `Cannot find module './routes.js'`

- [ ] **Step 3: 구현**

`apps/api/src/auth/routes.ts`:

```ts
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { ProviderName } from "../db/schema.js";
import type { AppConfig } from "../config.js";
import { resolveUser, type AuthRepo } from "./account.js";
import { createPkcePair, generateNonce, generateState } from "./pkce.js";
import { endSession, getSessionUser, issueSession, type SessionRepo } from "./session.js";
import type { OAuthProvider } from "./types.js";

export interface AuthDeps {
  providers: Record<ProviderName, OAuthProvider>;
  authRepo: AuthRepo;
  sessionRepo: SessionRepo;
  config: AppConfig;
  now?: () => Date;
}

const TX_COOKIE = "oauth_tx";

interface TxState {
  state: string;
  verifier: string;
  nonce: string;
  redirect: string;
}

function isProviderName(deps: AuthDeps, name: string): name is ProviderName {
  return Object.prototype.hasOwnProperty.call(deps.providers, name);
}

export function createAuthRoutes(deps: AuthDeps): Hono {
  const app = new Hono();
  const now = deps.now ?? (() => new Date());
  const { config } = deps;

  const cookieBase = {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "Lax" as const,
    ...(config.sessionCookieDomain ? { domain: config.sessionCookieDomain } : {}),
  };

  app.get("/:provider/start", (c) => {
    const provider = c.req.param("provider");
    if (!isProviderName(deps, provider)) return c.json({ error: "unknown provider" }, 404);

    const redirect = c.req.query("redirect") ?? config.defaultRedirect;
    if (!config.webOrigins.some((o) => redirect.startsWith(o))) {
      return c.json({ error: "invalid redirect" }, 400);
    }

    const state = generateState();
    const nonce = generateNonce();
    const { verifier, challenge } = createPkcePair();
    const tx: TxState = { state, verifier, nonce, redirect };

    setCookie(c, TX_COOKIE, JSON.stringify(tx), {
      httpOnly: true,
      secure: config.secureCookies,
      sameSite: "Lax",
      path: "/auth",
      maxAge: 600,
    });

    const url = deps.providers[provider].buildAuthorizeUrl({ state, codeChallenge: challenge, nonce });
    return c.redirect(url, 302);
  });

  const handleCallback = async (c: Parameters<Parameters<Hono["get"]>[1]>[0]) => {
    const provider = c.req.param("provider");
    if (!isProviderName(deps, provider)) return c.json({ error: "unknown provider" }, 404);

    const raw = getCookie(c, TX_COOKIE);
    if (!raw) return c.json({ error: "missing tx" }, 400);
    let tx: TxState;
    try {
      tx = JSON.parse(raw) as TxState;
    } catch {
      return c.json({ error: "bad tx" }, 400);
    }

    const incomingState = c.req.query("state") ?? (await safeFormValue(c, "state"));
    const code = c.req.query("code") ?? (await safeFormValue(c, "code"));
    if (!incomingState || incomingState !== tx.state) return c.json({ error: "state mismatch" }, 400);
    if (!code) return c.json({ error: "missing code" }, 400);

    const p = deps.providers[provider];
    const tokens = await p.exchangeCode({ code, codeVerifier: tx.verifier });
    const profile = await p.fetchProfile(tokens);

    const { userId } = await resolveUser(deps.authRepo, { provider, profile, locale: null });
    const { token, expiresAt } = await issueSession(deps.sessionRepo, userId, now());

    deleteCookie(c, TX_COOKIE, { path: "/auth" });
    setCookie(c, config.sessionCookieName, token, {
      ...cookieBase,
      path: "/",
      expires: expiresAt,
    });

    return c.redirect(tx.redirect, 302);
  };

  app.get("/:provider/callback", handleCallback);
  app.post("/:provider/callback", handleCallback);

  app.get("/me", async (c) => {
    const token = getCookie(c, config.sessionCookieName);
    if (!token) return c.json({ error: "unauthenticated" }, 401);
    const session = await getSessionUser(deps.sessionRepo, token, now());
    if (!session) return c.json({ error: "unauthenticated" }, 401);
    const user = await deps.authRepo.getUserById(session.userId);
    if (!user) return c.json({ error: "unauthenticated" }, 401);
    return c.json({ user });
  });

  app.post("/logout", async (c) => {
    const token = getCookie(c, config.sessionCookieName);
    if (token) await endSession(deps.sessionRepo, token, now());
    deleteCookie(c, config.sessionCookieName, {
      path: "/",
      ...(config.sessionCookieDomain ? { domain: config.sessionCookieDomain } : {}),
    });
    return c.json({ ok: true });
  });

  return app;
}

async function safeFormValue(
  c: { req: { parseBody: () => Promise<Record<string, unknown>> } },
  key: string,
): Promise<string | undefined> {
  try {
    const body = await c.req.parseBody();
    const v = body[key];
    return typeof v === "string" ? v : undefined;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter api exec vitest run src/auth/routes.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: index.ts에 마운트 + CORS**

`apps/api/src/index.ts` 전체를 다음으로 교체:

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "./config.js";
import { createAuthRoutes } from "./auth/routes.js";
import { buildProviders } from "./auth/providers/index.js";
import { createDbAuthRepo, createDbSessionRepo } from "./db/repo.js";

const config = loadConfig();
const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => (config.webOrigins.includes(origin) ? origin : config.webOrigins[0] ?? origin),
    credentials: true,
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.route(
  "/auth",
  createAuthRoutes({
    providers: buildProviders(),
    authRepo: createDbAuthRepo(),
    sessionRepo: createDbSessionRepo(),
    config,
  }),
);

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`api listening on http://localhost:${info.port}`);
});

export default app;
```

- [ ] **Step 6: 전체 테스트 + 타입체크 + 커밋**

Run: `pnpm --filter api exec vitest run` → 전부 PASS
Run: `pnpm --filter api typecheck` → 에러 없음

```bash
git add apps/api/src/auth/routes.ts apps/api/src/auth/routes.test.ts apps/api/src/index.ts
git commit -m "feat(api): Hono 인증 라우트(start/callback/me/logout) + CORS 마운트"
```

---

### Task 13: 공용 인증 URL 헬퍼 (packages/ui)

**Files:**
- Modify: `packages/ui/package.json`
- Create: `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/auth/buildAuthUrl.ts`
- Test: `packages/ui/src/auth/buildAuthUrl.test.ts`

**Interfaces:**
- Produces (from `packages/ui/src/auth/buildAuthUrl.ts`):
  - `type AuthProviderName = 'google' | 'apple' | 'kakao' | 'line'`
  - `buildAuthUrl(args: { apiBaseUrl: string; provider: AuthProviderName; returnUrl: string }): string`
  - `PROVIDER_ORDER: readonly AuthProviderName[]`

- [ ] **Step 1: 의존성/스크립트 추가**

`packages/ui/package.json`의 `devDependencies`에 `"vitest": "^2.1.8"` 추가, `scripts`에 `"test": "vitest run"` 추가. 루트에서 `pnpm install`.

`packages/ui/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { environment: "node", include: ["src/**/*.test.ts"] } });
```

- [ ] **Step 2: 실패 테스트 작성**

`packages/ui/src/auth/buildAuthUrl.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildAuthUrl, PROVIDER_ORDER } from "./buildAuthUrl.js";

describe("buildAuthUrl", () => {
  it("api start 엔드포인트로 returnUrl을 인코딩해 붙인다", () => {
    const url = buildAuthUrl({
      apiBaseUrl: "https://api.example.com",
      provider: "google",
      returnUrl: "https://kr.example.com/welcome?x=1",
    });
    expect(url).toBe(
      "https://api.example.com/auth/google/start?redirect=https%3A%2F%2Fkr.example.com%2Fwelcome%3Fx%3D1",
    );
  });

  it("apiBaseUrl 끝의 슬래시를 정규화한다", () => {
    const url = buildAuthUrl({ apiBaseUrl: "https://api.example.com/", provider: "line", returnUrl: "https://x.com" });
    expect(url.startsWith("https://api.example.com/auth/line/start")).toBe(true);
  });

  it("4개 provider를 정해진 순서로 노출한다", () => {
    expect(PROVIDER_ORDER).toEqual(["kakao", "line", "google", "apple"]);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm --filter @4-pillars/ui exec vitest run src/auth/buildAuthUrl.test.ts`
Expected: FAIL — `Cannot find module './buildAuthUrl.js'`

- [ ] **Step 4: 구현**

`packages/ui/src/auth/buildAuthUrl.ts`:

```ts
export type AuthProviderName = "google" | "apple" | "kakao" | "line";

export const PROVIDER_ORDER: readonly AuthProviderName[] = ["kakao", "line", "google", "apple"];

export function buildAuthUrl(args: {
  apiBaseUrl: string;
  provider: AuthProviderName;
  returnUrl: string;
}): string {
  const base = args.apiBaseUrl.replace(/\/+$/, "");
  return `${base}/auth/${args.provider}/start?redirect=${encodeURIComponent(args.returnUrl)}`;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm --filter @4-pillars/ui exec vitest run src/auth/buildAuthUrl.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: 커밋**

```bash
git add packages/ui/package.json packages/ui/vitest.config.ts packages/ui/src/auth pnpm-lock.yaml
git commit -m "feat(ui): 소셜 로그인 URL 헬퍼 buildAuthUrl"
```

---

### Task 14: 공용 LoginModal 컴포넌트 (packages/ui)

**Files:**
- Create: `packages/ui/src/auth/LoginModal.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `buildAuthUrl`, `PROVIDER_ORDER`, `AuthProviderName`.
- Produces (exported from `@4-pillars/ui`):
  ```ts
  export interface LoginModalProps {
    open: boolean;
    onClose: () => void;
    apiBaseUrl: string;
    returnUrl: string;
    labels?: Partial<Record<AuthProviderName, string>>;
    title?: string;
  }
  export function LoginModal(props: LoginModalProps): JSX.Element | null;
  ```

> presentational. UI는 최소 형태(인라인 스타일, 추후 다듬음). 로직(URL 생성)은 Task 13에서 테스트됨.

- [ ] **Step 1: 컴포넌트 작성**

`packages/ui/src/auth/LoginModal.tsx`:

```tsx
import { type AuthProviderName, PROVIDER_ORDER, buildAuthUrl } from "./buildAuthUrl.js";

export interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  apiBaseUrl: string;
  returnUrl: string;
  labels?: Partial<Record<AuthProviderName, string>>;
  title?: string;
}

const DEFAULT_LABELS: Record<AuthProviderName, string> = {
  kakao: "카카오로 시작하기",
  line: "LINE으로 시작하기",
  google: "Google로 시작하기",
  apple: "Apple로 시작하기",
};

/** 소셜 간편 로그인 모달 (presentational, UI 미완성 스텁). */
export function LoginModal({
  open,
  onClose,
  apiBaseUrl,
  returnUrl,
  labels,
  title = "로그인",
}: LoginModalProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", padding: 24, borderRadius: 8, minWidth: 280, display: "flex", flexDirection: "column", gap: 8 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
        {PROVIDER_ORDER.map((provider) => (
          <a
            key={provider}
            href={buildAuthUrl({ apiBaseUrl, provider, returnUrl })}
            data-provider={provider}
            style={{ display: "block", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6, textAlign: "center", textDecoration: "none", color: "#111" }}
          >
            {labels?.[provider] ?? DEFAULT_LABELS[provider]}
          </a>
        ))}
        <button type="button" onClick={onClose} style={{ marginTop: 8, background: "none", border: "none", color: "#888" }}>
          닫기
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: export 추가**

`packages/ui/src/index.ts`에 추가:

```ts
export { LoginModal } from "./auth/LoginModal.js";
export type { LoginModalProps } from "./auth/LoginModal.js";
export { buildAuthUrl, PROVIDER_ORDER } from "./auth/buildAuthUrl.js";
export type { AuthProviderName } from "./auth/buildAuthUrl.js";
```

- [ ] **Step 3: 타입체크 + 커밋**

Run: `pnpm --filter @4-pillars/ui typecheck`
Expected: 에러 없음

```bash
git add packages/ui/src/auth/LoginModal.tsx packages/ui/src/index.ts
git commit -m "feat(ui): 공용 LoginModal 컴포넌트"
```

---

### Task 15: kr-web 연결 (로그인 상태 + 모달)

**Files:**
- Create: `apps/kr-web/app/lib/auth.ts`
- Create: `apps/kr-web/app/routes/login.tsx`
- Modify: `apps/kr-web/app/routes.ts`

**Interfaces:**
- Consumes: `LoginModal` (from `@4-pillars/ui`).
- Produces: `/login` 라우트 (모달 표시), `fetchMe` 헬퍼.

> env 접근: React Router(Vite)에서 `import.meta.env.VITE_API_BASE_URL` 사용. dev 기본값 `http://localhost:3001`.

- [ ] **Step 1: auth 헬퍼 작성**

`apps/kr-web/app/lib/auth.ts`:

```ts
export interface MeResponse {
  user: { id: string; email: string | null; name: string | null; locale: string | null };
}

export const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3001";

/** 현재 로그인 유저 조회. 미인증이면 null. */
export async function fetchMe(): Promise<MeResponse["user"] | null> {
  const res = await fetch(`${apiBaseUrl}/auth/me`, { credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json()) as MeResponse;
  return data.user;
}
```

- [ ] **Step 2: login 라우트 작성**

`apps/kr-web/app/routes/login.tsx`:

```tsx
import { useState } from "react";
import { LoginModal } from "@4-pillars/ui";
import { apiBaseUrl } from "../lib/auth";

export default function Login() {
  const [open, setOpen] = useState(true);
  const returnUrl = typeof window !== "undefined" ? window.location.origin + "/" : "/";
  return (
    <main style={{ padding: 24 }}>
      <button type="button" onClick={() => setOpen(true)}>
        로그인 열기
      </button>
      <LoginModal
        open={open}
        onClose={() => setOpen(false)}
        apiBaseUrl={apiBaseUrl}
        returnUrl={returnUrl}
      />
    </main>
  );
}
```

- [ ] **Step 3: 라우트 등록**

`apps/kr-web/app/routes.ts`를 다음으로 교체:

```ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
] satisfies RouteConfig;
```

- [ ] **Step 4: 타입체크 + 커밋**

Run: `pnpm --filter kr-web typecheck`
Expected: 에러 없음 (react-router typegen 포함)

```bash
git add apps/kr-web/app/lib/auth.ts apps/kr-web/app/routes/login.tsx apps/kr-web/app/routes.ts
git commit -m "feat(kr-web): 로그인 모달 라우트 + auth 헬퍼"
```

---

### Task 16: jp-web 연결 (로그인 상태 + 모달)

**Files:**
- Create: `apps/jp-web/app/lib/auth.ts`
- Create: `apps/jp-web/app/routes/login.tsx`
- Modify: `apps/jp-web/app/routes.ts`

**Interfaces:**
- Consumes: `LoginModal` (from `@4-pillars/ui`).
- Produces: `/login` 라우트 (일본어 라벨), `fetchMe` 헬퍼.

- [ ] **Step 1: auth 헬퍼 작성**

`apps/jp-web/app/lib/auth.ts` — Task 15 Step 1과 동일 내용:

```ts
export interface MeResponse {
  user: { id: string; email: string | null; name: string | null; locale: string | null };
}

export const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3001";

export async function fetchMe(): Promise<MeResponse["user"] | null> {
  const res = await fetch(`${apiBaseUrl}/auth/me`, { credentials: "include" });
  if (!res.ok) return null;
  const data = (await res.json()) as MeResponse;
  return data.user;
}
```

- [ ] **Step 2: login 라우트 작성 (일본어 라벨)**

`apps/jp-web/app/routes/login.tsx`:

```tsx
import { useState } from "react";
import { LoginModal } from "@4-pillars/ui";
import { apiBaseUrl } from "../lib/auth";

export default function Login() {
  const [open, setOpen] = useState(true);
  const returnUrl = typeof window !== "undefined" ? window.location.origin + "/" : "/";
  return (
    <main style={{ padding: 24 }}>
      <button type="button" onClick={() => setOpen(true)}>
        ログインを開く
      </button>
      <LoginModal
        open={open}
        onClose={() => setOpen(false)}
        apiBaseUrl={apiBaseUrl}
        returnUrl={returnUrl}
        title="ログイン"
        labels={{
          kakao: "Kakaoで始める",
          line: "LINEで始める",
          google: "Googleで始める",
          apple: "Appleで始める",
        }}
      />
    </main>
  );
}
```

- [ ] **Step 3: 라우트 등록**

`apps/jp-web/app/routes.ts`를 다음으로 교체:

```ts
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
] satisfies RouteConfig;
```

- [ ] **Step 4: 타입체크 + 커밋**

Run: `pnpm --filter jp-web typecheck`
Expected: 에러 없음

```bash
git add apps/jp-web/app/lib/auth.ts apps/jp-web/app/routes/login.tsx apps/jp-web/app/routes.ts
git commit -m "feat(jp-web): 로그인 모달 라우트 + auth 헬퍼"
```

---

### Task 17: 마이그레이션 생성 + 전체 검증

**Files:**
- Create: `apps/api/drizzle/*` (생성물)

- [ ] **Step 1: 마이그레이션 SQL 생성**

Run: `pnpm --filter api db:generate`
Expected: `apps/api/drizzle/`에 `users`/`auth_identities`/`sessions` 생성 SQL이 만들어짐. (`DATABASE_URL` 없이도 generate는 동작)

> 실제 적용(`db:migrate`)은 Supabase `DATABASE_URL`을 받은 후 수행한다 — 이 계획 범위 밖.

- [ ] **Step 2: 모노레포 전체 테스트 + 타입체크**

Run: `pnpm -w test`
Expected: api, ui, saju-core 테스트 전부 PASS

Run: `pnpm -w typecheck`
Expected: 모든 패키지 에러 없음

> 참고: 루트 `package.json`에 `"test": "turbo run test"` 스크립트가 없으면 추가한다.

- [ ] **Step 3: 커밋**

```bash
git add apps/api/drizzle package.json
git commit -m "chore(api): 초기 auth 스키마 마이그레이션 생성"
```

---

## Self-Review

**1. Spec coverage:**
- §1 결정 요약 → 전 태스크에 반영 ✓
- §2 인증 플로우(start/callback/me/logout, state·PKCE·nonce, 임시 tx 쿠키) → Task 12 ✓
- §3 백엔드(라우트, provider 어댑터, 세션 미들웨어 격 getSessionUser, CORS, Zod) → Task 6-9, 12 ✓ (참고: 명시적 Hono 미들웨어 대신 `/me`에서 `getSessionUser` 사용 — 보호 라우트가 아직 없어 미들웨어 불필요, YAGNI)
- §4 계정 연결 규칙 → Task 3 `resolveUser` + 테스트 4종 ✓
- §5 DB 스키마 → Task 1 + Task 17 마이그레이션 ✓
- §6 프론트(공용 LoginModal + 양 앱 연결) → Task 13-16 ✓
- §7 설정/.env.example → Task 10 ✓
- §8 테스트(state/PKCE, 연결 규칙, 세션, provider 정규화 모킹) → Task 2,3,4,6-9 ✓

**2. Placeholder scan:** "TODO/TBD/적절히 처리" 없음. 모든 코드 스텝에 완전한 코드 포함. Apple `name`은 의도적으로 null(주석으로 사유 명시) — 플레이스홀더 아님.

**3. Type consistency:** `ProviderName`은 schema.ts에서 정의, types.ts가 재export, ui는 동일 리터럴의 `AuthProviderName` 별도 정의(패키지 경계 분리). `NormalizedProfile`/`TokenResponse`/`OAuthProvider` 시그니처는 Task 3 정의를 Task 6-9·12가 일관 사용. `AuthRepo`/`SessionRepo` 메서드명(`findIdentity`/`createUser`/`createIdentity`/`getUserById`/`findUserByEmail`, `createSession`/`findSession`/`revokeSession`)은 Task 3·4 정의와 Task 11·12 구현/사용이 일치. `buildAuthUrl`/`PROVIDER_ORDER`는 Task 13 정의와 Task 14 사용 일치.

**참고 사항(Zod):** 설계 §3는 Zod 검증을 언급하나, 현재 callback 파라미터는 단순 string 2개(code/state)라 라우트 내 직접 검증으로 충분하다. Zod 의존성은 Task 1에서 설치만 해두고, 입력이 복잡해질 때 도입한다(YAGNI). 이 일탈은 의도적임.
