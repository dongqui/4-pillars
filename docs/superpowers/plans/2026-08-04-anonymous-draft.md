# 익명 사용자 입력값 보존 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 익명 사용자가 퍼널을 끝내면 입력값을 Upstash Redis에 임시로 남기고, 로그인하는 순간 그것을 프로필 행으로 승격시킨다.

**Architecture:** `POST /api/profiles`가 세션 유무로 갈린다 — 있으면 DB 행(201), 없으면 Redis 드래프트 + `httpOnly` 쿠키(202). 401은 사라진다. 쿠키는 Redis 키 하나만 나르고, OAuth 콜백이 그 키로 드래프트를 집어 `createProfile`에 넣은 뒤 리포트로 보낸다.

**Tech Stack:** Next.js 16.2.10 (App Router), React 19.2.4, TypeScript, zod 4, vitest 4, Neon(Postgres), `@upstash/redis` 1.38 (이미 설치됨), Tailwind v4.

**설계 문서:** `docs/superpowers/specs/2026-08-04-anonymous-draft-design.md`

## Global Constraints

- **이 Next.js는 훈련 데이터의 Next.js가 아니다** (`AGENTS.md`). 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 해당 가이드를 읽는다. 각 Task에 읽을 파일을 지정해 두었다.
- 주석·커밋 메시지·UI 문구는 **한국어**. 기존 파일의 주석 밀도와 톤을 따른다 — "왜"를 적고 "무엇"은 적지 않는다.
- 테스트는 `vitest`. 실제 Redis·DB에 붙는 테스트는 만들지 않는다 — 주입형 클라이언트 목만 쓴다 (`src/lib/profiles/store.test.ts` 패턴).
- 검증 명령: `npm run typecheck`, `npm test`, `npm run lint`. 커밋 전에 세 개 다 통과해야 한다.
- 환경 변수 `UPSTASH_REDIS_REST_URL`·`UPSTASH_REDIS_REST_TOKEN`은 `.env.local`에 이미 들어 있다. 값을 로그로 찍지 않는다.
- `git commit` 메시지 끝에 아래 한 줄을 붙인다:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```
- 이번 작업의 **비범위**: 익명 `/report` 실데이터, 결제 연동, 익명 LLM 레이트리밋, 프로필 중복 검사. 손대지 않는다.

---

### Task 1: 드래프트 저장소

Redis는 서버 쪽 저장소라 키가 있어야 값을 되찾는다. 익명 사용자는 `session.userId` 같은 표식이 없으므로 **Redis가 데이터를 갖고 쿠키가 그 키를 나른다.** 이 Task는 그 저장소를 만든다.

`createProfileSchema`를 `src/lib/profiles/input.ts`로 옮기는 이유: 이제 API 라우트와 `src/lib/drafts`가 둘 다 쓴다. `src/lib`가 `src/app`을 import하면 의존 방향이 뒤집힌다.

**Files:**
- Create: `src/lib/redis.ts`
- Create: `src/lib/profiles/input.ts` (이동: `src/app/api/profiles/_lib/input.ts`)
- Delete: `src/app/api/profiles/_lib/input.ts`
- Create: `src/lib/drafts/store.ts`
- Test: `src/lib/drafts/store.test.ts`
- Modify: `src/app/api/profiles/_lib/handler.ts` (import 경로만)
- Modify: `src/app/funnel/_lib/toProfileBody.ts` (import 경로만)
- Modify: `vitest.config.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: 없음 (첫 Task)
- Produces:
  ```ts
  // src/lib/redis.ts
  export const redis: Redis;

  // src/lib/profiles/input.ts  (기존 내용 그대로 이동)
  export const createProfileSchema: z.ZodObject<...>;
  export type CreateProfileBody = z.infer<typeof createProfileSchema>;

  // src/lib/drafts/store.ts
  export const DRAFT_COOKIE = "draft";
  export interface DraftClient {
    set(key: string, value: unknown, opts: { ex: number }): Promise<unknown>;
    get(key: string): Promise<unknown>;
    del(key: string): Promise<unknown>;
  }
  export function generateDraftToken(): string;
  export function putDraft(token: string, body: CreateProfileBody, c?: DraftClient): Promise<void>;
  export function getDraft(token: string, c?: DraftClient): Promise<CreateProfileBody | null>;
  export function deleteDraft(token: string, c?: DraftClient): Promise<void>;
  export function draftCookieOptions(): {
    httpOnly: true; secure: boolean; sameSite: "lax"; path: string; maxAge: number;
  };
  ```

- [ ] **Step 1: 스키마 파일을 옮긴다**

`src/app/api/profiles/_lib/input.ts`의 내용을 그대로 `src/lib/profiles/input.ts`로 옮기고 원본을 지운다. 파일 상단 주석만 아래로 바꾼다 (드래프트도 같은 스키마를 쓰게 됐으므로):

```ts
/**
 * POST /api/profiles 본문. 퍼널의 FunnelData 를 그대로 옮긴 모양이다.
 * 익명 드래프트(src/lib/drafts/store.ts)도 이 스키마로 검증한 값을 저장한다 —
 * Redis 에 들어가는 모양과 DB 에 들어가는 모양이 갈라지지 않게 한 벌만 둔다.
 *
 * saju API 의 parseRequest(수동 검증)와 달리 zod 를 쓰는 이유: 중첩 객체가 많고
 * 기본값이 필요해서, 손으로 쓰면 길이만 늘어난다.
 */
```

import 경로 두 곳을 고친다:

```ts
// src/app/api/profiles/_lib/handler.ts
import { createProfileSchema } from "@/lib/profiles/input";

// src/app/funnel/_lib/toProfileBody.ts
import type { CreateProfileBody } from "@/lib/profiles/input";
```

- [ ] **Step 2: 이동이 아무것도 깨지 않았는지 확인**

```bash
npm run typecheck && npm test
```

Expected: 전부 통과. 순수 이동이라 동작이 바뀌면 안 된다.

- [ ] **Step 3: Redis 클라이언트를 만든다**

`src/lib/redis.ts` — `src/lib/db.ts`와 나란한 자리다:

```ts
import { Redis } from "@upstash/redis";

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN is not set. .env.local 을 확인한다.",
  );
}

/**
 * Upstash Redis (REST 드라이버).
 *
 * db.ts 와 같은 이유로 모듈 로드 시점에 환경 변수를 확인한다 — 요청 중에
 * 조용히 실패하면 어떤 입력이 사라졌는지 알 길이 없다.
 */
export const redis = Redis.fromEnv();
```

- [ ] **Step 4: 테스트가 Redis 환경 변수를 갖게 한다**

`vitest.config.ts`의 `test.env`에 두 줄을 더한다. `drafts/store.ts`가 `redis.ts`를 import하므로 값이 없으면 테스트가 로드 단계에서 죽는다. 실제 연결은 하지 않는다 — 주입형 목만 쓴다.

```ts
    env: {
      // db.ts가 import 시점에 DATABASE_URL을 요구. 테스트는 가짜 client를 주입하므로 실제 연결 안 함.
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      // redis.ts도 같은 이유. 마찬가지로 실제 호출은 목으로 막는다.
      UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    },
```

- [ ] **Step 5: 실패하는 테스트를 쓴다**

`src/lib/drafts/store.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  deleteDraft,
  generateDraftToken,
  getDraft,
  putDraft,
  type DraftClient,
} from "./store";

const validBody = {
  name: "김동진",
  gender: "male" as const,
  calendar: "solar" as const,
  isLeapMonth: false,
  birth: { year: 1990, month: 10, day: 25 },
  timeKnown: true,
  time: { hour: 15, minute: 20 },
  birthPlace: { country: "KR" as const, regionId: "seoul" },
  trueSolar: true,
};

/** 호출된 연산과 키를 기록하는 가짜 Redis. 값은 메모리에 담는다. */
function fakeClient() {
  const store = new Map<string, unknown>();
  const calls: { op: string; key: string; opts?: unknown }[] = [];
  const client: DraftClient = {
    async set(key, value, opts) {
      calls.push({ op: "set", key, opts });
      store.set(key, value);
      return "OK";
    },
    async get(key) {
      calls.push({ op: "get", key });
      return store.has(key) ? store.get(key) : null;
    },
    async del(key) {
      calls.push({ op: "del", key });
      store.delete(key);
      return 1;
    },
  };
  return { client, calls, store };
}

describe("드래프트 저장소", () => {
  it("draft:<token> 키에 7일 TTL 로 쓴다", async () => {
    const { client, calls } = fakeClient();
    await putDraft("tok", validBody, client);
    expect(calls[0]).toEqual({ op: "set", key: "draft:tok", opts: { ex: 60 * 60 * 24 * 7 } });
  });

  it("넣은 값을 그대로 돌려준다", async () => {
    const { client } = fakeClient();
    await putDraft("tok", validBody, client);
    expect(await getDraft("tok", client)).toEqual(validBody);
  });

  it("없는 토큰은 null", async () => {
    const { client } = fakeClient();
    expect(await getDraft("없는토큰", client)).toBeNull();
  });

  // 배포 사이에 스키마가 바뀌면 옛 레코드가 남아 있을 수 있다. 검증 없이 통과시키면
  // 그 값이 그대로 DB 까지 간다.
  it("현재 스키마에 안 맞는 레코드는 null", async () => {
    const { client, store } = fakeClient();
    store.set("draft:tok", { name: "김동진" });
    expect(await getDraft("tok", client)).toBeNull();
  });

  it("deleteDraft 는 키를 지운다", async () => {
    const { client, store } = fakeClient();
    await putDraft("tok", validBody, client);
    await deleteDraft("tok", client);
    expect(store.has("draft:tok")).toBe(false);
  });

  it("토큰은 호출마다 다르다", () => {
    expect(generateDraftToken()).not.toBe(generateDraftToken());
  });
});
```

- [ ] **Step 6: 테스트가 실패하는지 확인**

```bash
npm test -- src/lib/drafts/store.test.ts
```

Expected: FAIL — `Failed to resolve import "./store"`.

- [ ] **Step 7: 저장소를 구현한다**

`src/lib/drafts/store.ts`:

```ts
import { createProfileSchema, type CreateProfileBody } from "@/lib/profiles/input";
import { redis } from "@/lib/redis";

/**
 * 익명 입력의 손잡이를 나르는 쿠키. 값이 아니라 Redis 키 하나만 담는다.
 *
 * 쿠키를 쓰는 이유는 OAuth 왕복 때문이다 — 콜백 URL 은 provider 가 조립하므로
 * 쿼리 파라미터는 못 넘고, 콜백은 서버 리다이렉트라 localStorage 도 못 읽는다.
 * oauth_state / oauth_verifier 가 이미 같은 방식으로 값을 나른다.
 */
export const DRAFT_COOKIE = "draft";

/** 세션 만료(session.ts MAX_AGE)와 같은 7일. 더 길게 두면 주인 없는 생년월일이 남는다. */
const TTL_SECONDS = 60 * 60 * 24 * 7;

/** 주입 가능한 최소 Redis 인터페이스. 테스트가 실제 Redis 에 붙지 않게 한다. */
export interface DraftClient {
  set(key: string, value: unknown, opts: { ex: number }): Promise<unknown>;
  get(key: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

const defaultClient: DraftClient = redis;

function draftKey(token: string): string {
  return `draft:${token}`;
}

export function generateDraftToken(): string {
  return crypto.randomUUID();
}

export async function putDraft(
  token: string,
  body: CreateProfileBody,
  client: DraftClient = defaultClient,
): Promise<void> {
  await client.set(draftKey(token), body, { ex: TTL_SECONDS });
}

/**
 * 읽을 때 다시 검증한다 — 배포 사이에 스키마가 바뀌면 옛 모양의 레코드가
 * TTL 동안 남아 있고, 그대로 createProfile 에 넣으면 DB 까지 간다.
 * 검증 실패는 드래프트가 없는 것과 같이 취급한다.
 */
export async function getDraft(
  token: string,
  client: DraftClient = defaultClient,
): Promise<CreateProfileBody | null> {
  const raw = await client.get(draftKey(token));
  if (raw === null || raw === undefined) return null;
  const parsed = createProfileSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export async function deleteDraft(
  token: string,
  client: DraftClient = defaultClient,
): Promise<void> {
  await client.del(draftKey(token));
}

export function draftCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TTL_SECONDS,
  };
}
```

- [ ] **Step 8: 테스트가 통과하는지 확인**

```bash
npm test -- src/lib/drafts/store.test.ts && npm run typecheck && npm run lint
```

Expected: 전부 PASS.

- [ ] **Step 9: `.env.example`에 두 줄을 더한다**

파일 끝에 붙인다:

```
# --- 익명 드래프트 저장소 ---
UPSTASH_REDIS_REST_URL=       # Upstash 콘솔 > Database > REST API
UPSTASH_REDIS_REST_TOKEN=
```

- [ ] **Step 10: 커밋**

```bash
git add src/lib/redis.ts src/lib/drafts src/lib/profiles/input.ts src/app/api/profiles/_lib/input.ts src/app/api/profiles/_lib/handler.ts src/app/funnel/_lib/toProfileBody.ts vitest.config.ts .env.example
git commit -m "$(cat <<'EOF'
feat(drafts): 익명 입력을 담는 Redis 드래프트 저장소

createProfileSchema 를 src/lib/profiles/input.ts 로 옮겨 API 라우트와
드래프트 저장소가 한 벌을 공유하게 했다. 읽을 때 다시 검증해 옛 스키마의
레코드가 DB 까지 흘러가지 않게 한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 핸들러의 드래프트 갈래

`handleCreateProfile`이 세션 유무로 갈린다. 401을 없애는 것이 핵심이다 — 세션 유무를 아는 유일한 쪽(서버)이 한 번만 판단하고, 클라이언트는 상태코드로 행선지만 읽는다.

검증이 세션 확인보다 **앞으로** 온다. 두 갈래가 같은 정합화(`time`·`isLeapMonth`)를 거쳐야 하고, 어긋난 조합을 Redis에도 남기지 않기 위해서다.

**Files:**
- Modify: `src/app/api/profiles/_lib/handler.ts`
- Test: `src/app/api/profiles/_lib/handler.test.ts`

**Interfaces:**
- Consumes: `CreateProfileBody` (Task 1, `@/lib/profiles/input`)
- Produces:
  ```ts
  export interface HandlerDeps {
    userId: string | null;
    create: (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;
    saveDraft: (token: string, body: CreateProfileBody) => Promise<void>;
    newToken: () => string;
    existingToken: string | null;
  }
  export interface HandlerResult {
    status: number;
    body: { id: string } | Record<string, never> | { error: string };
    draftToken?: string;
  }
  export function handleCreateProfile(raw: unknown, deps: HandlerDeps): Promise<HandlerResult>;
  ```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/profiles/_lib/handler.test.ts`에서 기존 `"세션이 없으면 401 이고 저장을 시도하지 않는다"` 테스트를 지우고, 파일 상단의 목 헬퍼와 아래 테스트들을 더한다. 나머지 기존 테스트(201·400·정합화·409·throw)는 `deps`에 새 필드가 생기므로 **전부 `baseDeps()`를 쓰도록 고친다.**

```ts
import { describe, it, expect, vi } from "vitest";
import { ProfileLimitError, type CreateProfileInput } from "@/lib/profiles/store";
import type { CreateProfileBody } from "@/lib/profiles/input";
import { handleCreateProfile } from "./handler";

const validBody = {
  name: "김동진",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1990, month: 10, day: 25 },
  timeKnown: true,
  time: { hour: 15, minute: 20 },
  birthPlace: { country: "KR", regionId: "seoul" },
  trueSolar: true,
};

type Create = (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;
type SaveDraft = (token: string, body: CreateProfileBody) => Promise<void>;

/**
 * 제네릭으로 타입을 박아야 mock.calls[0][1] 이 좁혀진다 —
 * vi.fn(async () => ...) 로 두면 인자가 0개인 목이라 [1] 인덱싱이 타입 오류가 난다.
 */
const okCreate = () => vi.fn<Create>(async () => ({ id: "42" }));
const okSaveDraft = () => vi.fn<SaveDraft>(async () => {});

function baseDeps(over: Partial<Parameters<typeof handleCreateProfile>[1]> = {}) {
  return {
    userId: "7" as string | null,
    create: okCreate(),
    saveDraft: okSaveDraft(),
    newToken: () => "새토큰",
    existingToken: null as string | null,
    ...over,
  };
}

describe("handleCreateProfile", () => {
  it("세션이 없으면 202 와 새 드래프트 토큰, DB 저장은 하지 않는다", async () => {
    const create = okCreate();
    const saveDraft = okSaveDraft();
    const res = await handleCreateProfile(
      validBody,
      baseDeps({ userId: null, create, saveDraft }),
    );
    expect(res.status).toBe(202);
    expect(res.draftToken).toBe("새토큰");
    expect(create).not.toHaveBeenCalled();
    expect(saveDraft).toHaveBeenCalledWith("새토큰", expect.objectContaining({ name: "김동진" }));
  });

  // 매번 새로 발급하면 손잡이 없는 레코드가 TTL 동안 Redis 에 쌓인다.
  it("이미 드래프트 쿠키가 있으면 그 토큰에 덮어쓴다", async () => {
    const saveDraft = okSaveDraft();
    const res = await handleCreateProfile(
      validBody,
      baseDeps({ userId: null, saveDraft, existingToken: "이전토큰" }),
    );
    expect(res.draftToken).toBe("이전토큰");
    expect(saveDraft.mock.calls[0][0]).toBe("이전토큰");
  });

  it("드래프트에도 정합화가 걸린다 (시간 모름 → time 버림)", async () => {
    const saveDraft = okSaveDraft();
    await handleCreateProfile(
      { ...validBody, timeKnown: false },
      baseDeps({ userId: null, saveDraft }),
    );
    expect(saveDraft.mock.calls[0][1].time).toBeNull();
  });

  it("비로그인이어도 본문이 틀리면 400 이고 드래프트를 남기지 않는다", async () => {
    const saveDraft = okSaveDraft();
    const res = await handleCreateProfile(null, baseDeps({ userId: null, saveDraft }));
    expect(res.status).toBe(400);
    expect(saveDraft).not.toHaveBeenCalled();
  });
});
```

기존 테스트는 예를 들어 이렇게 고친다:

```ts
  it("정상 입력이면 201 과 id", async () => {
    const create = okCreate();
    const res = await handleCreateProfile(validBody, baseDeps({ create }));
    expect(res).toEqual({ status: 201, body: { id: "42" } });
    expect(create).toHaveBeenCalledWith("7", expect.objectContaining({ name: "김동진" }));
  });
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npm test -- src/app/api/profiles/_lib/handler.test.ts
```

Expected: FAIL — 202를 기대한 자리에서 401이 온다.

- [ ] **Step 3: 핸들러를 구현한다**

`src/app/api/profiles/_lib/handler.ts` 전체를 아래로 바꾼다:

```ts
import { ProfileLimitError, type CreateProfileInput } from "@/lib/profiles/store";
import { createProfileSchema, type CreateProfileBody } from "@/lib/profiles/input";

export interface HandlerDeps {
  /** 세션이 없으면 null */
  userId: string | null;
  create: (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;
  /** 로그인 전 입력을 임시로 맡아둔다 */
  saveDraft: (token: string, body: CreateProfileBody) => Promise<void>;
  newToken: () => string;
  /** 요청에 실려온 draft 쿠키. 있으면 그 자리에 덮어쓴다 */
  existingToken: string | null;
}

export interface HandlerResult {
  status: number;
  body: { id: string } | Record<string, never> | { error: string };
  /** 있으면 라우트가 쿠키를 굽는다 */
  draftToken?: string;
}

export async function handleCreateProfile(
  raw: unknown,
  deps: HandlerDeps,
): Promise<HandlerResult> {
  const parsed = createProfileSchema.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "입력을 확인해 주세요" } };

  const d = parsed.data;
  // 서로 어긋난 조합은 여기서 정리한다 — 어긋난 값이 DB 든 Redis 든 남으면
  // 나중에 어느 쪽이 진실인지 알 수 없다. 두 갈래가 같은 값을 받게 검증 뒤에 둔다.
  const body: CreateProfileBody = {
    ...d,
    time: d.timeKnown ? d.time : null,
    isLeapMonth: d.calendar === "lunar" ? d.isLeapMonth : false,
  };

  // 주인이 아직 없다. 값은 Redis 가 갖고 손잡이만 쿠키로 돌려준다.
  // 202 는 에러가 아니라 "받았고, 주인이 정해지면 확정한다"는 뜻이다.
  if (!deps.userId) {
    const token = deps.existingToken ?? deps.newToken();
    await deps.saveDraft(token, body);
    return { status: 202, body: {}, draftToken: token };
  }

  try {
    const { id } = await deps.create(deps.userId, body);
    return { status: 201, body: { id } };
  } catch (e) {
    // 한도 초과는 클라이언트가 분기해야 하는 정상 응답이다. 나머지는 500 으로 흘린다.
    if (e instanceof ProfileLimitError) return { status: 409, body: { error: "limit" } };
    throw e;
  }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
npm test -- src/app/api/profiles/_lib/handler.test.ts && npm run typecheck
```

Expected: PASS. (`route.test.ts`는 아직 깨져 있다 — Task 3에서 고친다.)

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/profiles/_lib/handler.ts src/app/api/profiles/_lib/handler.test.ts
git commit -m "$(cat <<'EOF'
feat(profiles): 비로그인 요청을 401 대신 드래프트로 접수

세션이 없으면 202 와 드래프트 토큰을 돌려준다. 검증과 정합화를 세션 확인보다
앞에 두어 DB 경로와 Redis 경로가 같은 값을 받게 했다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 라우트가 쿠키를 굽고 퍼널이 행선지를 읽는다

핸들러는 순수하게 두고 쿠키는 라우트가 굽는다. 쿠키를 읽고 쓰려면 `Request`/`Response` 대신 `NextRequest`/`NextResponse`가 필요하다 — 손으로 `cookie` 헤더를 파싱하지 않는다.

**읽을 문서:** `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/next-request.md`, `.../next-response.md`, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`

**Files:**
- Modify: `src/app/api/profiles/route.ts`
- Test: `src/app/api/profiles/route.test.ts`
- Modify: `src/app/funnel/page.tsx`

**Interfaces:**
- Consumes: `handleCreateProfile`·`HandlerResult` (Task 2), `DRAFT_COOKIE`·`draftCookieOptions`·`generateDraftToken`·`putDraft` (Task 1)
- Produces: `POST /api/profiles` — 201 `{id}` / 202 `{}` + `Set-Cookie: draft` / 400 / 409 / 500

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/profiles/route.test.ts`를 아래로 바꾼다. 드래프트 모듈은 `importOriginal`로 감싼다 — `draftCookieOptions`·`generateDraftToken`은 진짜를 쓰고 `putDraft`만 목으로 막아 실제 Redis 호출을 없앤다.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getSession: (...a: unknown[]) => getSession(...a),
}));

const createProfile = vi.fn();
// importOriginal 로 감싸는 이유: ProfileLimitError 는 handler.ts 가 instanceof 로 분기하는
// 실제 클래스여야 한다 — 통째로 목으로 바꾸면 다른 클래스가 되어 409 분기가 깨진다.
vi.mock("@/lib/profiles/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profiles/store")>()),
  createProfile: (...a: unknown[]) => createProfile(...a),
}));

const putDraft = vi.fn();
vi.mock("@/lib/drafts/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/drafts/store")>()),
  putDraft: (...a: unknown[]) => putDraft(...a),
}));

import { POST } from "./route";

const validBody = {
  name: "김동진",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1990, month: 10, day: 25 },
  timeKnown: true,
  time: { hour: 15, minute: 20 },
  birthPlace: { country: "KR", regionId: "seoul" },
  trueSolar: true,
};

function post(body: unknown, cookie?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new NextRequest("http://localhost/api/profiles", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/profiles", () => {
  beforeEach(() => {
    getSession.mockReset();
    createProfile.mockReset();
    putDraft.mockReset();
    putDraft.mockResolvedValue(undefined);
  });

  // 이 한 줄(session?.userId ?? null)이 profiles 테이블 전체의 테넌트 경계다 —
  // handler.test.ts는 "userId를 받으면 어떻게 되는가"만 증명하지, route.ts가
  // 실제 세션에서 그 userId를 제대로 꺼내는지는 증명하지 않는다.
  it("세션의 userId가 그대로 createProfile 로 전달된다", async () => {
    getSession.mockResolvedValue({ userId: "7", provider: "google" });
    createProfile.mockResolvedValue({ id: "42" });

    const res = await POST(post(validBody));

    expect(res.status).toBe(201);
    expect(createProfile).toHaveBeenCalledWith("7", expect.anything());
  });

  it("세션이 없으면 202 와 draft 쿠키를 굽고 createProfile 을 부르지 않는다", async () => {
    getSession.mockResolvedValue(null);

    const res = await POST(post(validBody));

    expect(res.status).toBe(202);
    expect(createProfile).not.toHaveBeenCalled();
    const cookie = res.cookies.get("draft");
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(putDraft).toHaveBeenCalledWith(cookie?.value, expect.objectContaining({ name: "김동진" }));
  });

  it("요청에 draft 쿠키가 있으면 그 토큰을 다시 쓴다", async () => {
    getSession.mockResolvedValue(null);

    const res = await POST(post(validBody, "draft=이전토큰"));

    expect(res.cookies.get("draft")?.value).toBe("이전토큰");
    expect(putDraft.mock.calls[0][0]).toBe("이전토큰");
  });

  it("로그인 상태면 draft 쿠키를 굽지 않는다", async () => {
    getSession.mockResolvedValue({ userId: "7", provider: "google" });
    createProfile.mockResolvedValue({ id: "42" });

    const res = await POST(post(validBody));

    expect(res.cookies.get("draft")).toBeUndefined();
  });

  it("본문이 JSON이 아니면 400", async () => {
    getSession.mockResolvedValue({ userId: "7", provider: "google" });

    const res = await POST(post("not json{"));

    expect(res.status).toBe(400);
    expect(createProfile).not.toHaveBeenCalled();
  });

  it("createProfile 이 한도 초과가 아닌 오류를 던지면 500", async () => {
    getSession.mockResolvedValue({ userId: "7", provider: "google" });
    createProfile.mockRejectedValue(new Error("db down"));

    const res = await POST(post(validBody));

    expect(res.status).toBe(500);
  });

  it("putDraft 가 실패하면 500 이고 쿠키를 굽지 않는다", async () => {
    getSession.mockResolvedValue(null);
    putDraft.mockRejectedValue(new Error("redis down"));

    const res = await POST(post(validBody));

    expect(res.status).toBe(500);
    expect(res.cookies.get("draft")).toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npm test -- src/app/api/profiles/route.test.ts
```

Expected: FAIL — 202 대신 401이 오고, `res.cookies`가 없다.

- [ ] **Step 3: 라우트를 구현한다**

`src/app/api/profiles/route.ts` 전체를 바꾼다:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createProfile } from "@/lib/profiles/store";
import {
  DRAFT_COOKIE,
  draftCookieOptions,
  generateDraftToken,
  putDraft,
} from "@/lib/drafts/store";
import { handleCreateProfile } from "./_lib/handler";

// 반환 타입이 NextResponse 인 이유: Response 로 좁히면 쿠키를 굽지도, 테스트에서
// res.cookies 로 확인하지도 못한다.
export async function POST(request: NextRequest): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleCreateProfile(raw, {
      userId: session?.userId ?? null,
      create: createProfile,
      saveDraft: putDraft,
      newToken: generateDraftToken,
      existingToken: request.cookies.get(DRAFT_COOKIE)?.value ?? null,
    });

    const res = NextResponse.json(result.body, { status: result.status });
    // 핸들러는 쿠키를 모른다 — 토큰만 받아 여기서 굽는다.
    if (result.draftToken) {
      res.cookies.set(DRAFT_COOKIE, result.draftToken, draftCookieOptions());
    }
    return res;
  } catch (e) {
    console.error("[POST /api/profiles]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
npm test -- src/app/api/profiles/route.test.ts && npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: 퍼널이 새 상태코드를 읽게 한다**

`src/app/funnel/page.tsx`의 `fetch` 뒤 분기(현재 `if (res.status === 201) ... else if (409) ... else if (res.status !== 401)`)를 아래로 바꾼다:

```ts
        if (res.status === 201) {
          const { id } = (await res.json()) as { id: string };
          dest = `/report?profile=${id}`;
        } else if (res.status === 202) {
          // 비로그인. 입력은 드래프트로 보관됐고 로그인하는 순간 프로필이 된다.
          dest = "/report";
        } else if (res.status === 409) {
          // 프로필 한도 초과 — 목록에서 정리하게 돌려보낸다.
          dest = "/home?error=limit";
        } else {
          // 저장이 조용히 사라지는 것이므로 최소한 로그로는 남긴다.
          console.error(`[POST /api/profiles] unexpected status ${res.status}`);
        }
```

바로 위 주석의 "401(비로그인)은 의도된 무저장 경로" 문장도 지운다 — 더 이상 401이 나오지 않는다.

- [ ] **Step 6: 전체 검증**

```bash
npm run typecheck && npm test && npm run lint
```

Expected: 전부 PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/profiles/route.ts src/app/api/profiles/route.test.ts src/app/funnel/page.tsx
git commit -m "$(cat <<'EOF'
feat(profiles): 202 응답에 draft 쿠키를 굽고 퍼널이 행선지를 읽는다

쿠키를 읽고 쓰기 위해 라우트를 NextRequest/NextResponse 로 옮겼다.
퍼널에서 401 분기가 사라지고 202(보관됨) / 409(한도)로 갈린다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `promoteDraft`

콜백 라우트에 로직을 박지 않는다. Next 없이 테스트되는 함수로 뺀다.

가장 중요한 규약: **승격 실패가 로그인을 막으면 안 된다.** 이 함수는 어떤 경우에도 throw하지 않고, 호출자는 결과를 행선지와 쿠키 조작으로만 옮긴다.

**Files:**
- Create: `src/lib/drafts/promote.ts`
- Test: `src/lib/drafts/promote.test.ts`

**Interfaces:**
- Consumes: `CreateProfileBody` (Task 1), `ProfileLimitError`·`CreateProfileInput` (`@/lib/profiles/store`)
- Produces:
  ```ts
  export type PromoteResult =
    | { kind: "none" }
    | { kind: "promoted"; id: string }
    | { kind: "limit" }
    | { kind: "failed" };

  export interface PromoteDeps {
    getDraft: (token: string) => Promise<CreateProfileBody | null>;
    createProfile: (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;
    deleteDraft: (token: string) => Promise<void>;
  }

  export function promoteDraft(
    token: string | null,
    userId: string,
    deps: PromoteDeps,
  ): Promise<PromoteResult>;
  ```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/drafts/promote.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { ProfileLimitError, type CreateProfileInput } from "@/lib/profiles/store";
import type { CreateProfileBody } from "@/lib/profiles/input";
import { promoteDraft } from "./promote";

const draft: CreateProfileBody = {
  name: "김동진",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1990, month: 10, day: 25 },
  timeKnown: true,
  time: { hour: 15, minute: 20 },
  birthPlace: { country: "KR", regionId: "seoul" },
  trueSolar: true,
};

type Create = (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;

function deps(over: Partial<Parameters<typeof promoteDraft>[2]> = {}) {
  return {
    getDraft: vi.fn(async () => draft),
    createProfile: vi.fn<Create>(async () => ({ id: "42" })),
    deleteDraft: vi.fn(async () => {}),
    ...over,
  };
}

describe("promoteDraft", () => {
  it("토큰이 없으면 none 이고 아무것도 부르지 않는다", async () => {
    const d = deps();
    expect(await promoteDraft(null, "7", d)).toEqual({ kind: "none" });
    expect(d.getDraft).not.toHaveBeenCalled();
  });

  it("레코드가 없으면 none", async () => {
    const d = deps({ getDraft: vi.fn(async () => null) });
    expect(await promoteDraft("tok", "7", d)).toEqual({ kind: "none" });
    expect(d.createProfile).not.toHaveBeenCalled();
  });

  it("성공하면 프로필을 만들고 드래프트를 지운다", async () => {
    const d = deps();
    expect(await promoteDraft("tok", "7", d)).toEqual({ kind: "promoted", id: "42" });
    expect(d.createProfile).toHaveBeenCalledWith("7", draft);
    expect(d.deleteDraft).toHaveBeenCalledWith("tok");
  });

  it("한도 초과는 limit — 드래프트를 지우지 않는다", async () => {
    const d = deps({
      createProfile: vi.fn<Create>(async () => {
        throw new ProfileLimitError();
      }),
    });
    expect(await promoteDraft("tok", "7", d)).toEqual({ kind: "limit" });
    expect(d.deleteDraft).not.toHaveBeenCalled();
  });

  // 로그인은 이미 성공한 뒤다. 여기서 throw 하면 세션 쿠키를 굽지 못하고 로그인 자체가 깨진다.
  it("DB 오류는 failed 로 삼키고 throw 하지 않는다", async () => {
    const d = deps({
      createProfile: vi.fn<Create>(async () => {
        throw new Error("db down");
      }),
    });
    expect(await promoteDraft("tok", "7", d)).toEqual({ kind: "failed" });
  });

  // 행은 이미 생겼다. 삭제 실패로 promoted 를 뒤집으면 다음 로그인에 중복 프로필이 생긴다.
  it("드래프트 삭제가 실패해도 promoted 다", async () => {
    const d = deps({
      deleteDraft: vi.fn(async () => {
        throw new Error("redis down");
      }),
    });
    expect(await promoteDraft("tok", "7", d)).toEqual({ kind: "promoted", id: "42" });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npm test -- src/lib/drafts/promote.test.ts
```

Expected: FAIL — `Failed to resolve import "./promote"`.

- [ ] **Step 3: 구현한다**

`src/lib/drafts/promote.ts`:

```ts
import { ProfileLimitError, type CreateProfileInput } from "@/lib/profiles/store";
import type { CreateProfileBody } from "@/lib/profiles/input";

export type PromoteResult =
  /** 토큰 없음 / 레코드 없음 / 만료 / 스키마 불일치 — 승격할 것이 없다 */
  | { kind: "none" }
  | { kind: "promoted"; id: string }
  /** 한도 초과. 드래프트를 남겨 사용자가 자리를 비운 뒤 다시 시도할 수 있게 한다 */
  | { kind: "limit" }
  /** 그 밖의 실패. 로그인은 성공시킨다 */
  | { kind: "failed" };

export interface PromoteDeps {
  getDraft: (token: string) => Promise<CreateProfileBody | null>;
  createProfile: (userId: string, input: CreateProfileInput) => Promise<{ id: string }>;
  deleteDraft: (token: string) => Promise<void>;
}

/**
 * 익명 드래프트를 프로필 행으로 올린다.
 *
 * 절대 throw 하지 않는다 — 호출 시점에 세션 쿠키는 아직 응답에 실리지 않았고,
 * 여기서 예외가 새면 승격 실패가 로그인 실패로 번진다. 실패해도 드래프트는
 * 남으므로 다음 기회가 있다.
 */
export async function promoteDraft(
  token: string | null,
  userId: string,
  deps: PromoteDeps,
): Promise<PromoteResult> {
  if (!token) return { kind: "none" };

  try {
    const draft = await deps.getDraft(token);
    if (!draft) return { kind: "none" };

    const { id } = await deps.createProfile(userId, draft);

    // 삭제 실패가 성공을 뒤집지 않게 따로 감싼다 — 행은 이미 생겼고,
    // 여기서 failed 를 돌려주면 쿠키가 남아 다음 로그인에 중복 프로필이 생긴다.
    try {
      await deps.deleteDraft(token);
    } catch (e) {
      console.error("[promoteDraft] deleteDraft", e instanceof Error ? e.message : e);
    }

    return { kind: "promoted", id };
  } catch (e) {
    if (e instanceof ProfileLimitError) return { kind: "limit" };
    console.error("[promoteDraft]", e instanceof Error ? e.message : e);
    return { kind: "failed" };
  }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
npm test -- src/lib/drafts/promote.test.ts && npm run typecheck && npm run lint
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/drafts/promote.ts src/lib/drafts/promote.test.ts
git commit -m "$(cat <<'EOF'
feat(drafts): 드래프트를 프로필로 승격하는 promoteDraft

네 갈래(none/promoted/limit/failed)로 결과만 돌려주고 throw 하지 않는다 —
승격 실패가 로그인 실패로 번지지 않게 한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: OAuth 콜백에 승격을 배선한다

`next`는 로그인 *전에* 정해지는데 프로필 id는 로그인 *순간에* 생긴다. 그래서 최종 행선지는 콜백이 정한다. 승격이 일어나면 `next`가 무엇이었든 리포트로 보낸다 — 방금 만들어진 것을 보여주는 게 사용자가 기대하는 결과다.

**읽을 문서:** `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/next-response.md` (`cookies.set` / `cookies.delete` / `redirect`)

**Files:**
- Modify: `src/lib/auth/callback.ts`
- Test: `src/lib/auth/callback.test.ts`
- Modify: `src/app/api/auth/callbacks/[provider]/route.ts`

**Interfaces:**
- Consumes: `promoteDraft`·`PromoteResult` (Task 4), `DRAFT_COOKIE`·`getDraft`·`deleteDraft` (Task 1)
- Produces: `CallbackResult`에 `userId: string` 추가

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/auth/callback.test.ts`의 "정상 플로우" 테스트에 한 줄을 더한다:

```ts
    expect(result.userId).toBe("42");
```

승격은 `user.id`를 필요로 하는데 지금 `CallbackResult`는 그것을 밖으로 내보내지 않는다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npm test -- src/lib/auth/callback.test.ts
```

Expected: FAIL — `undefined`가 `"42"`와 다르다.

- [ ] **Step 3: `userId`를 내보낸다**

`src/lib/auth/callback.ts`:

```ts
export interface CallbackResult {
  redirectTo: string;
  sessionToken: string;
  provider: ProviderId;
  /** 드래프트 승격에 필요하다 — 콜백 라우트가 이 id 로 프로필을 만든다 */
  userId: string;
}
```

`completeOAuth`의 return을 고친다:

```ts
  return {
    redirectTo: safeNext(params.next, deps.origin),
    sessionToken,
    provider: p.id,
    userId: user.id,
  };
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
npm test -- src/lib/auth/callback.test.ts && npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: 콜백 라우트에 승격을 배선한다**

`src/app/api/auth/callbacks/[provider]/route.ts` — import를 더한다:

```ts
import { createProfile } from "@/lib/profiles/store";
import { DRAFT_COOKIE, deleteDraft, getDraft } from "@/lib/drafts/store";
import { promoteDraft } from "@/lib/drafts/promote";
```

`try` 블록 안, `completeOAuth` 호출 뒤의 `const res = ...` 자리를 아래로 바꾼다:

```ts
    const promoted = await promoteDraft(
      req.cookies.get(DRAFT_COOKIE)?.value ?? null,
      result.userId,
      { getDraft, createProfile, deleteDraft },
    );

    // 프로필 id 는 지금 막 생겼으므로 next 에 미리 담을 수 없었다 — 행선지는 여기서 정한다.
    // 결제가 붙으면 promoted 갈래가 체크아웃으로 바뀌고, 그 뒤에 리포트로 이어진다.
    const redirectTo =
      promoted.kind === "promoted"
        ? `/report?profile=${promoted.id}`
        : promoted.kind === "limit"
          ? "/home?error=limit"
          : result.redirectTo;

    const res = NextResponse.redirect(new URL(redirectTo, origin));
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
    // limit·failed 는 드래프트를 남긴다 — 손잡이를 지우면 다시 시도할 방법이 없다.
    if (promoted.kind === "promoted" || promoted.kind === "none") {
      res.cookies.delete(DRAFT_COOKIE);
    }
    return res;
```

`catch` 블록은 손대지 않는다 — OAuth 자체가 실패하면 승격할 세션도 없다.

- [ ] **Step 6: 전체 검증**

```bash
npm run typecheck && npm test && npm run lint
```

Expected: 전부 PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/auth/callback.ts src/lib/auth/callback.test.ts "src/app/api/auth/callbacks/[provider]/route.ts"
git commit -m "$(cat <<'EOF'
feat(auth): 콜백에서 익명 드래프트를 프로필로 승격

프로필 id 가 로그인 순간에 생기므로 최종 행선지를 콜백이 정한다.
승격되면 /report?profile=<id>, 한도 초과면 /home?error=limit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `/report`의 로그인 진입점

`/login`으로 가는 링크가 코드베이스에 없다. 파이프를 다 만들어도 입구가 없으면 승격이 일어나지 않는다.

새 UI를 만들지 않는다 — 결제를 하려면 어차피 계정이 필요하므로 "전체 결과 보기"의 첫 단계가 로그인이다. 지금 두 버튼 다 `href="#"`이라 아무 데도 가지 않는다.

**Files:**
- Modify: `src/app/report/_components/LockedSections.tsx`
- Modify: `src/app/report/_components/ReportView.tsx:74`

**Interfaces:**
- Consumes: `ReportAccess.isLoggedIn` (`src/app/report/_lib/access.ts`, 기존)
- Produces: `LockedSections({ sections, isLoggedIn })`

- [ ] **Step 1: `LockedSections`가 행선지를 가르게 한다**

`src/app/report/_components/LockedSections.tsx` — 시그니처와 두 앵커를 바꾼다:

```tsx
export function LockedSections({
  sections,
  isLoggedIn,
}: {
  sections: LockedSectionMeta[];
  isLoggedIn: boolean;
}) {
```

`useEffect` 아래, `return` 앞에 두 줄을 더한다:

```tsx
  // 결제하려면 계정이 있어야 한다. 비로그인에게는 이 버튼의 첫 단계가 로그인이고,
  // 로그인하는 순간 퍼널에서 맡겨둔 드래프트가 프로필로 승격된다.
  const ctaHref = isLoggedIn ? "#" : `/login?next=${encodeURIComponent("/report")}`;
  const ctaLabel = isLoggedIn ? "전체 결과 보기" : "로그인하고 전체 결과 보기";
```

인라인 앵커(`ref={inlineRef}`)와 스티키 바 앵커 둘 다 `href={ctaHref}`, 본문을 `{ctaLabel}`로 바꾼다. 클래스는 그대로 둔다.

- [ ] **Step 2: `ReportView`가 값을 내려보낸다**

`src/app/report/_components/ReportView.tsx:74`:

```tsx
          <LockedSections sections={lockedSections} isLoggedIn={access.isLoggedIn} />
```

- [ ] **Step 3: 검증**

```bash
npm run typecheck && npm run lint && npm test
```

Expected: 전부 PASS.

- [ ] **Step 4: 눈으로 확인한다**

```bash
npm run dev
```

`http://localhost:3000/report`(비로그인)에서 잠금 섹션 아래 버튼이 "로그인하고 전체 결과 보기"이고 클릭하면 `/login?next=%2Freport`로 가는지, 스크롤 시 뜨는 하단 고정 바도 같은지 확인한다. 로그인 상태(`/home`을 거쳐 로그인 후 `/report`)에서는 문구가 "전체 결과 보기"로 돌아오는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add src/app/report/_components/LockedSections.tsx src/app/report/_components/ReportView.tsx
git commit -m "$(cat <<'EOF'
feat(report): 비로그인 CTA 를 로그인으로 보낸다

전체 결과 보기의 첫 단계가 로그인이다 — 결제하려면 계정이 필요하고,
로그인하는 순간 맡겨둔 드래프트가 프로필이 된다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 한도 상향, `/home` 배너, 백로그 정리

퍼널의 409와 승격의 `limit`이 둘 다 `/home?error=limit`으로 떨어지는데 지금은 아무 설명이 없다.

한도를 지우지 않고 20으로 올리는 이유: 프로필 수만큼 무료 섹션 LLM 생성이 돌 수 있고 캐시는 원국 단위라 생년월일이 다르면 히트가 없다. 다만 진짜 방어가 필요한 자리는 개수가 아니라 생성 호출이므로, 20은 정합성 요건이 아니라 여유 있는 UX 가드다.

**읽을 문서:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` (`searchParams`가 Promise 인 점)

**Files:**
- Modify: `src/lib/profiles/store.ts:13`, `:113`
- Modify: `src/lib/profiles/store.test.ts:109` (주석)
- Modify: `src/app/home/page.tsx`
- Modify: `docs/issues/backlog.md`

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (상수·문구 변경)

- [ ] **Step 1: 한도를 올린다**

`src/lib/profiles/store.ts`:

```ts
/** 한 계정이 저장할 수 있는 프로필 수. 화면 문구와 같이 움직인다. */
export const MAX_PROFILES = 20;
```

같은 파일의 `createProfile` 주석에서 "5개 제한은 UX 가드일 뿐"을 아래로 바꾼다:

```ts
 * 트랜잭션을 걸지 않는 이유: 개수 한도는 UX 가드일 뿐 정합성 요건이 아니다.
 * 실제 비용 방어는 개수가 아니라 LLM 생성 호출에 걸어야 한다.
```

`src/lib/profiles/store.test.ts`의 "5개 한도가" 주석도 "개수 한도가"로 고친다. 테스트는 `MAX_PROFILES`를 상수로 참조하므로 코드 변경은 없다.

- [ ] **Step 2: 테스트가 여전히 통과하는지 확인**

```bash
npm test -- src/lib/profiles/store.test.ts
```

Expected: PASS. 상수를 참조하는 테스트라 값이 바뀌어도 통과해야 한다.

- [ ] **Step 3: `/home`에 배너를 단다**

`src/app/home/page.tsx` — 시그니처에 `searchParams`를 더한다:

```tsx
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login?next=/home");
```

`<main ...>` 여는 태그 바로 다음 줄에 배너를 넣는다:

```tsx
        {error === "limit" && (
          // 퍼널의 409 와 로그인 시 드래프트 승격 실패가 둘 다 여기로 온다.
          // 설명 없이 목록만 보여주면 사용자는 왜 돌아왔는지 모른다.
          <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-[13.5px] text-amber-700">
            프로필이 가득 찼어요. 하나를 지우면 새로 저장할 수 있어요.
          </p>
        )}
```

- [ ] **Step 4: 검증**

```bash
npm run typecheck && npm test && npm run lint
```

Expected: 전부 PASS.

- [ ] **Step 5: 눈으로 확인한다**

```bash
npm run dev
```

로그인 상태로 `http://localhost:3000/home?error=limit`을 열어 배너가 목록 위에 뜨는지, `?error=limit` 없이 열면 안 뜨는지 확인한다. 하단 안내 문구가 "프로필은 최대 20개까지"로 바뀌었는지도 본다.

- [ ] **Step 6: 백로그를 정리한다**

`docs/issues/backlog.md`에서:

1. "UX 다듬기"의 첫 항목(`프로필 한도 초과(409)로 퍼널에서 /home으로 돌려보낼 때 아무 설명이 없다. ?error=limit + 배너.`)을 지운다.
2. "리포트 발행 흐름에 남은 고리"의 **2번 항목 전체**(`**2. 익명 사용자의 입력값 보존 — 미설계. 여기가 실제 갈림길이다**` 부터 그 아래 "결정할 것: ..." 문단까지)를 아래로 바꾼다:

```markdown
**2. ~~익명 사용자의 입력값 보존~~ — 2026-08-04 해소**

`POST /api/profiles`가 세션 유무로 갈린다 — 없으면 Upstash Redis 드래프트 + `draft` 쿠키(202), OAuth 콜백이 그 손잡이로 프로필을 만들고 `/report?profile=<id>`로 보낸다. `/report`의 "전체 결과 보기"가 비로그인일 때 `/login?next=/report`로 가는 입구다.

- 설계: `docs/superpowers/specs/2026-08-04-anonymous-draft-design.md`
- 남은 것: 익명 LLM 호출 레이트리밋. 아래 3번과 §1이 익명 생성 경로를 열 때 필요해진다.
```

3. 1번 항목의 설명에 한 줄을 더한다 — 이번 작업이 만든 행선지의 소비자가 그쪽이라는 사실:

```markdown
- 콜백이 승격 후 `/report?profile=<id>`로 보내므로, 이 배선이 붙기 전까지 승격된 사용자도 픽스처를 본다.
```

- [ ] **Step 7: 커밋**

```bash
git add src/lib/profiles/store.ts src/lib/profiles/store.test.ts src/app/home/page.tsx docs/issues/backlog.md
git commit -m "$(cat <<'EOF'
feat(home): 프로필 한도 20 상향과 error=limit 배너

퍼널의 409 와 드래프트 승격 실패가 둘 다 /home?error=limit 으로 오는데
설명이 없었다. 한도는 정합성 요건이 아니므로 여유 있게 올린다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## 전체 흐름 수동 검증

모든 Task가 끝난 뒤 한 번 돌린다. 자동 테스트가 덮지 못하는 부분(OAuth 왕복, 쿠키 전달)이 여기 있다.

- [ ] `npm run dev`로 띄운다.
- [ ] 로그아웃 상태(브라우저 개발자 도구 > Application > Cookies에서 `session` 삭제)로 `/funnel`을 처음부터 끝까지 완료한다.
- [ ] 개발자 도구에서 `POST /api/profiles` 응답이 **202**이고 `Set-Cookie: draft=...; HttpOnly`가 붙었는지 확인한다.
- [ ] Upstash 콘솔에서 `draft:<토큰>` 키가 생겼고 TTL이 약 7일인지 확인한다.
- [ ] `/report`의 "로그인하고 전체 결과 보기"를 눌러 로그인한다.
- [ ] 콜백 뒤 `/report?profile=<숫자>`로 도착하는지, `draft` 쿠키가 사라졌는지, Upstash에서 키가 지워졌는지 확인한다.
- [ ] `/home`에 방금 만든 프로필이 목록에 있는지 확인한다.
- [ ] 로그인 상태로 `/funnel`을 다시 완료하면 응답이 **201**이고 `draft` 쿠키가 굽히지 않는지 확인한다.
