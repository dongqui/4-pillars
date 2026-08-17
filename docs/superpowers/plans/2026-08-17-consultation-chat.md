# 고민상담 (채팅) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인한 사용자가 이용권 1장으로 사주를 아는 상담사와 10턴짜리 채팅 상담을 하고, 지난 상담을 목록에서 다시 볼 수 있게 한다.

**Architecture:** 순수 코어를 `src/lib/consultations/` 에 두고 라우트·페이지는 그걸 호출만 한다. LLM 은 DeepSeek 채팅 어댑터 하나로 빠지고, 응답은 tool 스키마로 말풍선 배열을 강제해 받는다. 이용권은 `TicketPort` 인터페이스 뒤에 있고 구현은 다른 세션 소관이라 지금은 스텁이다.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · zod 4 · Neon serverless (HTTP 드라이버) · vitest 4 · Tailwind 4 · DeepSeek (OpenAI 호환 API)

**설계 문서:** `docs/superpowers/specs/2026-08-17-consultation-chat-design.md`

## Global Constraints

- 이 저장소의 Next.js 는 학습 데이터와 다르다. 코드를 쓰기 전에 `node_modules/next/dist/docs/` 의 관련 가이드를 읽는다 (`AGENTS.md`).
- **마이그레이션 파일 하나에 SQL 문장은 하나만** 담는다. Neon HTTP 드라이버가 한 쿼리에 여러 문장을 거부한다 (`scripts/migrate.mts` 주석).
- SQL 은 반드시 태그드 템플릿으로 쓴다. 문자열 연결로 쿼리를 만들지 않는다 (`src/lib/db.ts`).
- DB 접근 함수는 마지막 인자로 `client: SqlClient = sql` 을 받는다. 테스트가 가짜 클라이언트를 주입하는 통로다 (`src/lib/profiles/store.ts` 패턴).
- 주석과 커밋 메시지는 한국어. 커밋 제목은 `feat(consult): …` / `fix(consult): …` 형식이고 평서형 종결어미로 끝낸다 (예: `…를 추가한다`).
- 사용자에게 보이는 문구는 해요체. 상대를 부르는 호칭("당신", "고객님")은 쓰지 않는다.
- 테스트는 `*.test.ts` 를 소스 옆에 둔다. `*.test.tsx` 는 만들지 않는다 — 저장소에 서버 컴포넌트 테스트 인프라가 없다.
- 각 태스크 끝에서 `npm test` 와 `npm run typecheck` 가 모두 통과해야 한다.
- 상수 값 (스펙에서 그대로 옮긴 것):
  - `DEFAULT_TURN_LIMIT = 10`
  - `MAX_UTTERANCE_CHARS = 1000`
  - `MAX_FREE_CRISIS_TURNS = 3`
  - 말풍선 2~5개, 각 120자 이하
  - 추천질문 정확히 2개 (마지막 턴 0개), 각 30자 이하
  - 제목 20자 이하
  - `CONSULT_MODEL = "deepseek-v4-pro"`
  - 자살예방 상담전화 **109**

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `migrations/0012_consultations.sql` | `consultations` 테이블 |
| `migrations/0013_consultations_user_idx.sql` | 목록 조회 인덱스 |
| `migrations/0014_consultation_messages.sql` | `consultation_messages` 테이블 |
| `migrations/0015_consultation_messages_idx.sql` | 스레드 조회 인덱스 |
| `src/lib/consultations/store.ts` | DB 접근. 컬럼 이름을 아는 유일한 곳 |
| `src/lib/consultations/budget.ts` | 턴 예산·상태 전이 (순수) |
| `src/lib/consultations/input.ts` | 발화 검증 (zod) |
| `src/lib/consultations/schema.ts` | tool 스키마 + 응답 파싱 (순수) |
| `src/lib/consultations/prompt.ts` | 시스템 프롬프트 + 메시지 배치 (순수) |
| `src/lib/consultations/ticket-port.ts` | 이용권 경계. 다른 세션과의 유일한 접점 |
| `src/lib/consultations/model.ts` | `CONSULT_MODEL` 상수 |
| `src/lib/consultations/chat-transport.ts` | DeepSeek 채팅 어댑터 |
| `src/lib/consultations/turn.ts` | 조립 → 호출 → 파싱 한 턴 (주입) |
| `src/lib/consultations/service.ts` | 개설·진행 오케스트레이션 (차감·되돌리기) |
| `src/app/api/consultations/route.ts` | `POST` 개설 · `GET` 목록 |
| `src/app/api/consultations/[id]/messages/route.ts` | `POST` 한 턴 |
| `src/app/consult/page.tsx` | 목록 화면 |
| `src/app/consult/[id]/page.tsx` | 대화방 (서버에서 이력 로드) |
| `src/app/consult/_components/*` | 채팅 UI |
| `src/app/home/_components/ExploreGrid.tsx` | 홈 카드 추가 (수정) |

의존 방향은 한 방향이다: `store`/`budget`/`input`/`schema`/`prompt`/`chat-transport` → `turn` → `service` → 라우트 → 페이지.

---

### Task 1: 마이그레이션과 저장소

**Files:**
- Create: `migrations/0012_consultations.sql`
- Create: `migrations/0013_consultations_user_idx.sql`
- Create: `migrations/0014_consultation_messages.sql`
- Create: `migrations/0015_consultation_messages_idx.sql`
- Create: `src/lib/consultations/store.ts`
- Test: `src/lib/consultations/store.test.ts`

**Interfaces:**
- Consumes: `SqlClient`, `sql` from `@/lib/db`
- Produces: `ConsultationRow`, `MessageRow`, `ConsultationListItem`, `toConsultationRow(r)`, `toMessageRow(r)`, `createConsultation(input, client?)`, `getConsultation(userId, id, client?)`, `listConsultations(userId, client?)`, `listMessages(consultationId, client?)`, `appendMessage(input, client?)`, `commitTurn(input, client?)`

- [ ] **Step 1: 마이그레이션 네 파일을 만든다**

`migrations/0012_consultations.sql`:

```sql
-- 상담 1건 = 이용권 1장 = 이 테이블 한 행.
-- turn_limit 을 상수가 아니라 컬럼에 박는 이유는 purchases.amount 와 같다 —
-- 정책이 12회로 바뀌어도 이미 팔린 상담은 산 조건 그대로 끝나야 한다.
-- profile_id 가 SET NULL 인 이유: 프로필이 지워져도 이미 나눈 대화는 남아야 한다
-- (purchases 의 CASCADE 가 docs/issues/backlog.md 에서 문제로 지적된 것과 같은 건이다).
CREATE TABLE IF NOT EXISTS consultations (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  profile_id   bigint REFERENCES profiles(id) ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  turns_used   int  NOT NULL DEFAULT 0,
  turn_limit   int  NOT NULL DEFAULT 10,
  title        text,
  tokens_in    bigint NOT NULL DEFAULT 0,
  tokens_out   bigint NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz
)
```

`migrations/0013_consultations_user_idx.sql`:

```sql
CREATE INDEX IF NOT EXISTS consultations_user_idx
  ON consultations (user_id, created_at DESC)
```

`migrations/0014_consultation_messages.sql`:

```sql
-- bubbles 를 jsonb 배열로 두는 것은 응답 스키마와 짝이다. LLM 이 말풍선 배열로
-- 답하니 저장도 그 모양 그대로 받고, 화면이 다시 쪼갤 필요가 없다.
-- role='user' 인 행은 bubbles 길이가 항상 1 이고 suggestions 는 NULL 이다.
-- crisis 는 위기 안내로 답한 턴의 표시다 — 이 플래그의 개수가 미차감 한도를 정한다.
CREATE TABLE IF NOT EXISTS consultation_messages (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  consultation_id bigint NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'counselor')),
  bubbles         jsonb NOT NULL,
  suggestions     jsonb,
  crisis          boolean NOT NULL DEFAULT false,
  turn_no         int NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
)
```

`migrations/0015_consultation_messages_idx.sql`:

```sql
CREATE INDEX IF NOT EXISTS consultation_messages_thread_idx
  ON consultation_messages (consultation_id, id)
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/lib/consultations/store.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  toConsultationRow,
  toMessageRow,
  createConsultation,
  getConsultation,
  listConsultations,
  listMessages,
  appendMessage,
  commitTurn,
  type SqlClient,
} from "./store";

/** 호출된 SQL과 바인딩 값을 기록하는 가짜 클라이언트. 응답은 순서대로 꺼내 쓴다. */
function fakeClient(...responses: Record<string, unknown>[][]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(responses[i++] ?? []);
  };
  return { client, calls };
}

const dbConsultation = {
  id: 7,
  user_id: 3,
  profile_id: 12,
  status: "open",
  turns_used: 2,
  turn_limit: 10,
  title: "직장에서의 답답함",
  created_at: "2026-08-17T00:00:00.000Z",
  closed_at: null,
};

const dbMessage = {
  id: 41,
  role: "counselor",
  bubbles: ["첫 마디예요", "두 번째 마디예요"],
  suggestions: ["더 물어볼까요?", "다른 얘기도 해요"],
  crisis: false,
  turn_no: 2,
  created_at: "2026-08-17T00:01:00.000Z",
};

describe("toConsultationRow", () => {
  it("숫자 id 를 문자열로 바꾼다", () => {
    const row = toConsultationRow(dbConsultation);
    expect(row.id).toBe("7");
    expect(row.userId).toBe("3");
    expect(row.profileId).toBe("12");
  });

  it("프로필이 지워진 상담은 profileId 가 null 이다", () => {
    const row = toConsultationRow({ ...dbConsultation, profile_id: null });
    expect(row.profileId).toBeNull();
  });

  it("모르는 status 는 closed 로 본다 — 열린 것으로 잘못 보면 공짜 턴이 열린다", () => {
    const row = toConsultationRow({ ...dbConsultation, status: "weird" });
    expect(row.status).toBe("closed");
  });
});

describe("toMessageRow", () => {
  it("jsonb 배열을 string[] 로 읽는다", () => {
    const row = toMessageRow(dbMessage);
    expect(row.bubbles).toEqual(["첫 마디예요", "두 번째 마디예요"]);
    expect(row.suggestions).toEqual(["더 물어볼까요?", "다른 얘기도 해요"]);
    expect(row.crisis).toBe(false);
  });

  it("드라이버가 jsonb 를 문자열로 주는 경우에도 배열로 읽는다", () => {
    const row = toMessageRow({ ...dbMessage, bubbles: '["하나"]', suggestions: null });
    expect(row.bubbles).toEqual(["하나"]);
    expect(row.suggestions).toBeNull();
  });

  it("배열이 아닌 값이 오면 빈 배열로 떨어뜨린다", () => {
    const row = toMessageRow({ ...dbMessage, bubbles: 42 });
    expect(row.bubbles).toEqual([]);
  });
});

describe("getConsultation", () => {
  it("user_id 로 함께 걸러 남의 상담을 못 읽게 한다", async () => {
    const { client, calls } = fakeClient([dbConsultation]);
    const row = await getConsultation("3", "7", client);
    expect(row?.id).toBe("7");
    expect(calls[0].values).toEqual(["3", "7"]);
    expect(calls[0].sql).toContain("user_id");
  });

  it("없으면 null 이다", async () => {
    const { client } = fakeClient([]);
    expect(await getConsultation("3", "999", client)).toBeNull();
  });
});

describe("listConsultations", () => {
  it("진행 중인 상담을 위로 올리고 마지막 말풍선을 함께 읽는다", async () => {
    const { client, calls } = fakeClient([
      { ...dbConsultation, last_bubbles: ["지금 자리에서 답답한 게…"] },
    ]);
    const rows = await listConsultations("3", client);
    expect(rows[0].lastBubble).toBe("지금 자리에서 답답한 게…");
    expect(calls[0].sql).toContain("status = 'open'");
  });

  it("상담사 답이 아직 없으면 lastBubble 은 null 이다", async () => {
    const { client } = fakeClient([{ ...dbConsultation, last_bubbles: null }]);
    const rows = await listConsultations("3", client);
    expect(rows[0].lastBubble).toBeNull();
  });
});

describe("createConsultation", () => {
  it("만든 행을 돌려준다", async () => {
    const { client, calls } = fakeClient([dbConsultation]);
    const row = await createConsultation(
      { userId: "3", profileId: "12", turnLimit: 10 },
      client,
    );
    expect(row.id).toBe("7");
    expect(calls[0].values).toEqual(["3", "12", 10]);
  });
});

describe("appendMessage", () => {
  it("사용자 발화는 말풍선 하나에 담기고 suggestions 는 null 이다", async () => {
    const { client, calls } = fakeClient([dbMessage]);
    await appendMessage(
      { consultationId: "7", role: "user", bubbles: ["회사가 힘들어요"], turnNo: 3 },
      client,
    );
    expect(calls[0].values[1]).toBe("user");
    expect(calls[0].values[2]).toBe(JSON.stringify(["회사가 힘들어요"]));
    expect(calls[0].values[3]).toBeNull();
  });
});

describe("commitTurn", () => {
  it("턴 수와 토큰을 함께 올리고 상태를 적는다", async () => {
    const { client, calls } = fakeClient([{ ...dbConsultation, turns_used: 3 }]);
    const row = await commitTurn(
      {
        id: "7",
        turnsUsed: 3,
        status: "open",
        title: null,
        tokensIn: 1200,
        tokensOut: 300,
      },
      client,
    );
    expect(row.turnsUsed).toBe(3);
    expect(calls[0].values).toEqual([3, "open", null, 1200, 300, "7"]);
  });

  it("닫는 턴이면 closed_at 을 채운다", async () => {
    const { client, calls } = fakeClient([
      { ...dbConsultation, status: "closed", closed_at: "2026-08-17T00:09:00.000Z" },
    ]);
    const row = await commitTurn(
      { id: "7", turnsUsed: 10, status: "closed", title: null, tokensIn: 1, tokensOut: 1 },
      client,
    );
    expect(row.status).toBe("closed");
    expect(calls[0].sql).toContain("closed_at");
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/lib/consultations/store.test.ts`
Expected: FAIL — `Failed to resolve import "./store"`

- [ ] **Step 4: 저장소를 구현한다**

`src/lib/consultations/store.ts`:

```ts
import { sql as neonSql, type SqlClient } from "@/lib/db";

// 재수출 — 테스트가 가짜 클라이언트를 만들 때 쓴다.
export type { SqlClient };

const sql = neonSql as unknown as SqlClient;

export interface ConsultationRow {
  id: string;
  userId: string;
  /** 프로필이 지워졌으면 null. 이미 나눈 대화는 남는다 */
  profileId: string | null;
  status: "open" | "closed";
  turnsUsed: number;
  turnLimit: number;
  title: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface MessageRow {
  id: string;
  role: "user" | "counselor";
  bubbles: string[];
  /** counselor 만 갖는다. 마지막 턴에는 빈 배열 */
  suggestions: string[] | null;
  crisis: boolean;
  turnNo: number;
  createdAt: string;
}

/** 목록 한 줄. 마지막 상담사 말풍선 한 개를 미리보기로 함께 읽는다 */
export interface ConsultationListItem extends ConsultationRow {
  lastBubble: string | null;
}

/**
 * jsonb 컬럼을 string[] 로 읽는다. 드라이버가 파싱해 주는 경우와 문자열로 주는
 * 경우가 둘 다 있어 양쪽을 받는다. 모양이 다르면 빈 배열로 떨어뜨린다 —
 * 화면에 깨진 값을 흘려보내느니 없는 게 낫다.
 */
function toStringArray(v: unknown): string[] {
  const raw = typeof v === "string" ? safeParse(v) : v;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export function toConsultationRow(r: Record<string, unknown>): ConsultationRow {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    profileId: r.profile_id === null || r.profile_id === undefined ? null : String(r.profile_id),
    // 모르는 값은 closed 로 본다. 열린 것으로 잘못 보면 한도 검사를 통과해
    // 차감 없는 턴이 열린다 — 안전한 쪽으로 넘어진다.
    status: r.status === "open" ? "open" : "closed",
    turnsUsed: Number(r.turns_used),
    turnLimit: Number(r.turn_limit),
    title: typeof r.title === "string" ? r.title : null,
    createdAt: String(r.created_at),
    closedAt: r.closed_at === null || r.closed_at === undefined ? null : String(r.closed_at),
  };
}

export function toMessageRow(r: Record<string, unknown>): MessageRow {
  const suggestions = r.suggestions;
  return {
    id: String(r.id),
    role: r.role === "user" ? "user" : "counselor",
    bubbles: toStringArray(r.bubbles),
    suggestions:
      suggestions === null || suggestions === undefined ? null : toStringArray(suggestions),
    crisis: r.crisis === true,
    turnNo: Number(r.turn_no),
    createdAt: String(r.created_at),
  };
}

export interface CreateConsultationInput {
  userId: string;
  profileId: string | null;
  turnLimit: number;
}

export async function createConsultation(
  input: CreateConsultationInput,
  client: SqlClient = sql,
): Promise<ConsultationRow> {
  const rows = await client`
    INSERT INTO consultations (user_id, profile_id, turn_limit)
    VALUES (${input.userId}::bigint, ${input.profileId}::bigint, ${input.turnLimit})
    RETURNING *
  `;
  return toConsultationRow(rows[0]);
}

/** user_id 로 함께 거른다 — id 만으로는 남의 상담을 조회할 수 없다 */
export async function getConsultation(
  userId: string,
  id: string,
  client: SqlClient = sql,
): Promise<ConsultationRow | null> {
  const rows = await client`
    SELECT * FROM consultations
    WHERE user_id = ${userId}::bigint AND id = ${id}::bigint
  `;
  return rows[0] ? toConsultationRow(rows[0]) : null;
}

export async function listConsultations(
  userId: string,
  client: SqlClient = sql,
): Promise<ConsultationListItem[]> {
  const rows = await client`
    SELECT c.*, (
      SELECT m.bubbles FROM consultation_messages m
      WHERE m.consultation_id = c.id AND m.role = 'counselor'
      ORDER BY m.id DESC LIMIT 1
    ) AS last_bubbles
    FROM consultations c
    WHERE c.user_id = ${userId}::bigint
    ORDER BY (c.status = 'open') DESC, c.created_at DESC
  `;
  return rows.map((r) => ({
    ...toConsultationRow(r),
    lastBubble: toStringArray(r.last_bubbles)[0] ?? null,
  }));
}

export async function listMessages(
  consultationId: string,
  client: SqlClient = sql,
): Promise<MessageRow[]> {
  const rows = await client`
    SELECT * FROM consultation_messages
    WHERE consultation_id = ${consultationId}::bigint
    ORDER BY id
  `;
  return rows.map(toMessageRow);
}

export interface AppendMessageInput {
  consultationId: string;
  role: "user" | "counselor";
  bubbles: string[];
  suggestions?: string[] | null;
  crisis?: boolean;
  turnNo: number;
}

export async function appendMessage(
  input: AppendMessageInput,
  client: SqlClient = sql,
): Promise<MessageRow> {
  // jsonb 는 문자열로 바인딩한다 — 배열을 그대로 넘기면 드라이버가 postgres
  // 배열로 보내 jsonb 컬럼과 타입이 어긋난다.
  const suggestions =
    input.suggestions === undefined || input.suggestions === null
      ? null
      : JSON.stringify(input.suggestions);

  const rows = await client`
    INSERT INTO consultation_messages
      (consultation_id, role, bubbles, suggestions, crisis, turn_no)
    VALUES (
      ${input.consultationId}::bigint,
      ${input.role},
      ${JSON.stringify(input.bubbles)}::jsonb,
      ${suggestions}::jsonb,
      ${input.crisis ?? false},
      ${input.turnNo}
    )
    RETURNING *
  `;
  return toMessageRow(rows[0]);
}

export interface CommitTurnInput {
  id: string;
  turnsUsed: number;
  status: "open" | "closed";
  /** 첫 턴에만 값이 있다. null 이면 기존 제목을 유지한다 */
  title: string | null;
  tokensIn: number;
  tokensOut: number;
}

/** 턴 수·상태·제목·토큰을 한 번에 올린다. 닫는 턴이면 closed_at 도 채운다 */
export async function commitTurn(
  input: CommitTurnInput,
  client: SqlClient = sql,
): Promise<ConsultationRow> {
  const rows = await client`
    UPDATE consultations SET
      turns_used = ${input.turnsUsed},
      status     = ${input.status},
      title      = COALESCE(${input.title}, title),
      tokens_in  = tokens_in + ${input.tokensIn},
      tokens_out = tokens_out + ${input.tokensOut},
      closed_at  = CASE WHEN ${input.status} = 'closed' THEN now() ELSE closed_at END
    WHERE id = ${input.id}::bigint
    RETURNING *
  `;
  return toConsultationRow(rows[0]);
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `npm test -- src/lib/consultations/store.test.ts`
Expected: PASS (14 tests)

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 6: 커밋한다**

```bash
git add migrations/0012_consultations.sql migrations/0013_consultations_user_idx.sql migrations/0014_consultation_messages.sql migrations/0015_consultation_messages_idx.sql src/lib/consultations/store.ts src/lib/consultations/store.test.ts && git commit -m "feat(consult): 상담 테이블과 저장소를 만든다"
```

---

### Task 2: 턴 예산과 상태 전이

**Files:**
- Create: `src/lib/consultations/budget.ts`
- Test: `src/lib/consultations/budget.test.ts`

**Interfaces:**
- Consumes: 없음 (순수)
- Produces: `DEFAULT_TURN_LIMIT`, `MAX_FREE_CRISIS_TURNS`, `TurnState`, `TurnDecision`, `decideTurn(state)`, `nextState(state, opts)`, `countCrisis(messages)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/consultations/budget.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  DEFAULT_TURN_LIMIT,
  MAX_FREE_CRISIS_TURNS,
  decideTurn,
  nextState,
  countCrisis,
} from "./budget";

const open = { turnsUsed: 0, turnLimit: 10, status: "open" as const };

describe("decideTurn", () => {
  it("한 턴도 안 썼으면 열 번 남았고 마지막이 아니다", () => {
    expect(decideTurn(open)).toEqual({ kind: "allowed", remaining: 10, isLast: false });
  });

  it("한 번 남았으면 마지막 턴이다", () => {
    expect(decideTurn({ ...open, turnsUsed: 9 })).toEqual({
      kind: "allowed",
      remaining: 1,
      isLast: true,
    });
  });

  it("한도를 다 쓰면 막는다", () => {
    expect(decideTurn({ ...open, turnsUsed: 10 })).toEqual({ kind: "exhausted" });
  });

  it("한도를 넘긴 값이 저장돼 있어도 막는다", () => {
    expect(decideTurn({ ...open, turnsUsed: 11 })).toEqual({ kind: "exhausted" });
  });

  it("닫힌 상담은 턴이 남아 있어도 막는다", () => {
    expect(decideTurn({ ...open, status: "closed" })).toEqual({ kind: "exhausted" });
  });
});

describe("nextState", () => {
  it("보통 턴은 하나 올라가고 열린 채로 남는다", () => {
    expect(nextState(open, { crisis: false, crisisSoFar: 0 })).toEqual({
      turnsUsed: 1,
      turnLimit: 10,
      status: "open",
    });
  });

  it("마지막 턴을 쓰면 닫힌다", () => {
    expect(nextState({ ...open, turnsUsed: 9 }, { crisis: false, crisisSoFar: 0 })).toEqual({
      turnsUsed: 10,
      turnLimit: 10,
      status: "closed",
    });
  });

  it("위기 턴은 차감하지 않는다 — 위기에 남은 대화 0회를 만나면 안 된다", () => {
    expect(nextState({ ...open, turnsUsed: 4 }, { crisis: true, crisisSoFar: 0 })).toEqual({
      turnsUsed: 4,
      turnLimit: 10,
      status: "open",
    });
  });

  it("무료 위기 턴 한도를 채우면 그 다음부터는 차감한다", () => {
    expect(
      nextState({ ...open, turnsUsed: 4 }, { crisis: true, crisisSoFar: MAX_FREE_CRISIS_TURNS }),
    ).toEqual({ turnsUsed: 5, turnLimit: 10, status: "open" });
  });

  it("한도를 넘긴 위기 턴도 마지막 턴이면 상담을 닫는다", () => {
    expect(
      nextState({ ...open, turnsUsed: 9 }, { crisis: true, crisisSoFar: MAX_FREE_CRISIS_TURNS }),
    ).toEqual({ turnsUsed: 10, turnLimit: 10, status: "closed" });
  });
});

describe("countCrisis", () => {
  it("위기로 표시된 메시지 수를 센다", () => {
    expect(
      countCrisis([
        { crisis: false },
        { crisis: true },
        { crisis: true },
      ]),
    ).toBe(2);
  });

  it("빈 이력은 0 이다", () => {
    expect(countCrisis([])).toBe(0);
  });
});

describe("상수", () => {
  it("스펙이 정한 값이다", () => {
    expect(DEFAULT_TURN_LIMIT).toBe(10);
    expect(MAX_FREE_CRISIS_TURNS).toBe(3);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/lib/consultations/budget.test.ts`
Expected: FAIL — `Failed to resolve import "./budget"`

- [ ] **Step 3: 구현한다**

`src/lib/consultations/budget.ts`:

```ts
// 턴 예산과 상태 전이. 순수 함수만 둔다 — DB 도 LLM 도 모른다.

/** 상담 1건의 기본 턴 수(사용자 발화 기준). 새 상담의 turn_limit 에 박힌다 */
export const DEFAULT_TURN_LIMIT = 10;

/**
 * 한 상담에서 차감 없이 쓸 수 있는 위기 턴 수.
 *
 * 한도가 필요한 이유: 위기 턴을 무제한 미차감으로 두면 모델이 crisis 를 남발하거나
 * 사용자가 그렇게 유도해 무한히 무료 턴을 얻는 길이 열린다. 한도를 넘겨도 안내는
 * 그대로 하되 차감만 정상화한다 — 안내를 끊지 않으면서 구멍만 막는다.
 */
export const MAX_FREE_CRISIS_TURNS = 3;

export interface TurnState {
  turnsUsed: number;
  turnLimit: number;
  status: "open" | "closed";
}

export type TurnDecision =
  | { kind: "allowed"; remaining: number; isLast: boolean }
  | { kind: "exhausted" };

/** 이번 발화를 받아도 되는지, 받는다면 몇 번 남았는지 */
export function decideTurn(state: TurnState): TurnDecision {
  if (state.status === "closed") return { kind: "exhausted" };
  const remaining = state.turnLimit - state.turnsUsed;
  if (remaining <= 0) return { kind: "exhausted" };
  return { kind: "allowed", remaining, isLast: remaining === 1 };
}

export function nextState(
  state: TurnState,
  opts: { crisis: boolean; crisisSoFar: number },
): TurnState {
  const free = opts.crisis && opts.crisisSoFar < MAX_FREE_CRISIS_TURNS;
  const turnsUsed = free ? state.turnsUsed : state.turnsUsed + 1;
  return {
    turnsUsed,
    turnLimit: state.turnLimit,
    status: turnsUsed >= state.turnLimit ? "closed" : "open",
  };
}

/** 저장된 이력에서 위기 턴 수를 센다. MessageRow 의 crisis 만 본다 */
export function countCrisis(messages: { crisis: boolean }[]): number {
  return messages.reduce((n, m) => (m.crisis ? n + 1 : n), 0);
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- src/lib/consultations/budget.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/consultations/budget.ts src/lib/consultations/budget.test.ts && git commit -m "feat(consult): 턴 예산과 상태 전이를 만든다"
```

---

### Task 3: 발화 검증

**Files:**
- Create: `src/lib/consultations/input.ts`
- Test: `src/lib/consultations/input.test.ts`

**Interfaces:**
- Consumes: `zod`
- Produces: `MAX_UTTERANCE_CHARS`, `utteranceSchema`, `UtteranceBody`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/consultations/input.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { MAX_UTTERANCE_CHARS, utteranceSchema } from "./input";

describe("utteranceSchema", () => {
  it("보통 발화를 통과시킨다", () => {
    const r = utteranceSchema.safeParse({ text: "요즘 회사가 너무 힘들어요" });
    expect(r.success).toBe(true);
  });

  it("앞뒤 공백을 지운다", () => {
    const r = utteranceSchema.parse({ text: "  힘들어요  " });
    expect(r.text).toBe("힘들어요");
  });

  it("빈 발화를 거부한다", () => {
    expect(utteranceSchema.safeParse({ text: "" }).success).toBe(false);
  });

  it("공백만 있는 발화를 거부한다 — 다듬은 뒤 검사해야 잡힌다", () => {
    expect(utteranceSchema.safeParse({ text: "   " }).success).toBe(false);
  });

  it("상한을 넘기면 거부한다 — 비용 상한이 여기 걸려 있다", () => {
    const long = "가".repeat(MAX_UTTERANCE_CHARS + 1);
    expect(utteranceSchema.safeParse({ text: long }).success).toBe(false);
  });

  it("상한 딱 맞는 길이는 통과한다", () => {
    const exact = "가".repeat(MAX_UTTERANCE_CHARS);
    expect(utteranceSchema.safeParse({ text: exact }).success).toBe(true);
  });

  it("문자열이 아니면 거부한다", () => {
    expect(utteranceSchema.safeParse({ text: 42 }).success).toBe(false);
  });

  it("상한은 스펙이 정한 1000 자다", () => {
    expect(MAX_UTTERANCE_CHARS).toBe(1000);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/lib/consultations/input.test.ts`
Expected: FAIL — `Failed to resolve import "./input"`

- [ ] **Step 3: 구현한다**

`src/lib/consultations/input.ts`:

```ts
import { z } from "zod";

/**
 * 사용자 발화 한 번의 글자 수 상한.
 *
 * 이 값이 비용 상한의 첫 번째 자물쇠다 — 설계 문서 §5 의 "최악 30원" 계산이
 * 이 숫자를 전제로 서 있다. 클라이언트의 maxlength 는 편의일 뿐이고, 실제
 * 방어선은 서버의 이 검증이다.
 */
export const MAX_UTTERANCE_CHARS = 1000;

/**
 * trim 을 먼저 걸고 길이를 재는 순서가 중요하다. 뒤집으면 공백 1000자가
 * 통과한 뒤 빈 문자열이 되어 LLM 에 아무 말도 없는 턴이 나간다.
 */
export const utteranceSchema = z.object({
  text: z.string().trim().min(1).max(MAX_UTTERANCE_CHARS),
});

export type UtteranceBody = z.infer<typeof utteranceSchema>;
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- src/lib/consultations/input.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/consultations/input.ts src/lib/consultations/input.test.ts && git commit -m "feat(consult): 발화 길이 상한을 서버에서 강제한다"
```

---

### Task 4: 응답 스키마와 파싱

**Files:**
- Create: `src/lib/consultations/schema.ts`
- Test: `src/lib/consultations/schema.test.ts`

**Interfaces:**
- Consumes: `zod`
- Produces: `COUNSEL_TOOL_NAME`, `MIN_BUBBLES`, `MAX_BUBBLES`, `BUBBLE_MAX_CHARS`, `SUGGESTION_MAX_CHARS`, `TITLE_MAX_CHARS`, `SUGGESTION_COUNT`, `MAX_REPLY_TOKENS`, `CounselorReply`, `replyToolSchema(opts)`, `parseReply(raw, opts)`, `fallbackTitle(utterance)`

**결정 (2026-08-17, 리뷰 후 확정):** 개수·필수 강제는 **JSON tool 스키마 쪽에만** 둔다. zod 파싱은 모양이 깨진 응답만 거르고, 사양을 조금 어긴 응답은 통과시킨다.

이유는 `parseReply` 가 던졌을 때의 대가다. 던지면 그 턴은 실패고, 첫 턴이면 `openConsultation` 이 이용권을 되돌리고 상담 개설 자체가 실패한다. 제목 한 줄이나 추천질문 한 개가 모자란 것 때문에 1,000원짜리 상담이 안 열리는 편이, 제목이 비어 있는 편보다 나쁘다. 모델이 사양을 어긴 잡음을 사용자가 치르게 하지 않는다.

그래서:
- `suggestions` 는 온 개수대로 쓴다 (`.min()` 을 걸지 않는다). 화면은 받은 만큼만 칩을 그린다.
- `title` 은 빠질 수 있으므로 `fallbackTitle(utterance)` 로 메운다 — 목록에 "아직 시작하지 않은 상담"으로 뜨는 것은 첫 턴이 **실패한** 상담(`turns_used = 0`)에만 해당해야 하고, 성공한 상담이 그 문구로 뜨면 거짓말이 된다.
- 메우는 자리는 `turn.ts`(Task 8)다 — 발화를 아는 곳이 거기다. `parseReply` 는 응답만 검증한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/consultations/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  COUNSEL_TOOL_NAME,
  MAX_BUBBLES,
  MIN_BUBBLES,
  SUGGESTION_COUNT,
  TITLE_MAX_CHARS,
  fallbackTitle,
  replyToolSchema,
  parseReply,
} from "./schema";

const middle = { first: false, last: false };

function props(opts: { first: boolean; last: boolean }): Record<string, any> {
  return replyToolSchema(opts).properties as Record<string, any>;
}

describe("replyToolSchema", () => {
  it("말풍선 개수를 스키마에 박는다", () => {
    const p = props(middle);
    expect(p.bubbles.minItems).toBe(MIN_BUBBLES);
    expect(p.bubbles.maxItems).toBe(MAX_BUBBLES);
  });

  it("중간 턴은 추천질문을 정확히 두 개 요구한다", () => {
    const p = props(middle);
    expect(p.suggestions.minItems).toBe(SUGGESTION_COUNT);
    expect(p.suggestions.maxItems).toBe(SUGGESTION_COUNT);
  });

  it("마지막 턴은 추천질문을 요구하지 않는다 — 더 물어볼 수 없는데 물으라고 하면 안 된다", () => {
    const p = props({ first: false, last: true });
    expect(p.suggestions.maxItems).toBe(0);
  });

  it("첫 턴에만 제목을 요구한다", () => {
    expect(props({ first: true, last: false }).title).toBeDefined();
    expect(props(middle).title).toBeUndefined();
  });

  it("첫 턴은 title 을 필수로 건다", () => {
    expect(replyToolSchema({ first: true, last: false }).required).toContain("title");
  });

  it("crisis 는 어느 턴에나 있다", () => {
    expect(props(middle).crisis).toBeDefined();
    expect(props({ first: true, last: true }).crisis).toBeDefined();
  });
});

describe("parseReply", () => {
  const good = {
    bubbles: ["첫 마디예요", "두 번째 마디예요"],
    suggestions: ["더 들려주실래요?", "다른 얘기도 할까요?"],
    crisis: false,
  };

  it("계약대로 온 응답을 통과시킨다", () => {
    expect(parseReply(good, middle)).toEqual(good);
  });

  it("첫 턴에는 제목을 함께 읽는다", () => {
    const r = parseReply({ ...good, title: "직장에서의 답답함" }, { first: true, last: false });
    expect(r.title).toBe("직장에서의 답답함");
  });

  it("말풍선이 하나뿐이면 거부한다", () => {
    expect(() => parseReply({ ...good, bubbles: ["하나"] }, middle)).toThrow();
  });

  it("말풍선이 상한을 넘으면 거부한다", () => {
    const many = Array.from({ length: MAX_BUBBLES + 1 }, (_, i) => `말 ${i}`);
    expect(() => parseReply({ ...good, bubbles: many }, middle)).toThrow();
  });

  it("마지막 턴에 추천질문이 오면 버리고 빈 배열로 만든다", () => {
    const r = parseReply(good, { first: false, last: true });
    expect(r.suggestions).toEqual([]);
  });

  it("crisis 가 빠지면 false 로 본다 — 없다고 무료 턴을 주면 안 된다", () => {
    const { crisis, ...noCrisis } = good;
    expect(parseReply(noCrisis, middle).crisis).toBe(false);
  });

  it("tool 이 아닌 값이 오면 거부한다", () => {
    expect(() => parseReply("그냥 텍스트", middle)).toThrow();
  });

  it("도구 이름은 emit_reply 다", () => {
    expect(COUNSEL_TOOL_NAME).toBe("emit_reply");
  });

  it("추천질문이 하나만 와도 통과시킨다 — 칩 하나 때문에 턴을 버리지 않는다", () => {
    const r = parseReply({ ...good, suggestions: ["하나만"] }, middle);
    expect(r.suggestions).toEqual(["하나만"]);
  });

  it("첫 턴에 제목이 없어도 통과시킨다 — 메우는 것은 turn.ts 의 몫이다", () => {
    const r = parseReply(good, { first: true, last: false });
    expect(r.title).toBeUndefined();
  });
});

describe("fallbackTitle", () => {
  it("짧은 발화는 그대로 쓴다", () => {
    expect(fallbackTitle("잠이 안 와요")).toBe("잠이 안 와요");
  });

  it("앞뒤 공백을 지운다", () => {
    expect(fallbackTitle("  힘들어요  ")).toBe("힘들어요");
  });

  it("상한을 넘기면 잘라내고 줄임표를 붙인다", () => {
    const long = "가".repeat(TITLE_MAX_CHARS + 10);
    const title = fallbackTitle(long);
    expect([...title]).toHaveLength(TITLE_MAX_CHARS);
    expect(title.endsWith("…")).toBe(true);
  });

  it("상한 딱 맞는 길이는 줄임표 없이 그대로 쓴다", () => {
    const exact = "가".repeat(TITLE_MAX_CHARS);
    expect(fallbackTitle(exact)).toBe(exact);
  });

  it("서로게이트 쌍을 반으로 자르지 않는다", () => {
    const emoji = "🙂".repeat(TITLE_MAX_CHARS + 5);
    const title = fallbackTitle(emoji);
    expect([...title]).toHaveLength(TITLE_MAX_CHARS);
    expect(title).not.toContain("�");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/lib/consultations/schema.test.ts`
Expected: FAIL — `Failed to resolve import "./schema"`

- [ ] **Step 3: 구현한다**

`src/lib/consultations/schema.ts`:

```ts
// 상담사 응답의 계약. tool 파라미터 스키마(모델에게 주는 것)와 파싱 스키마
// (돌아온 값을 믿기 전에 거는 것) 두 벌을 여기서 함께 관리한다 —
// 두 곳에 나눠 두면 반드시 어긋난다.

import { z } from "zod";

/** 응답을 강제할 tool 이름. 어댑터가 이 이름으로 tool 을 등록한다 */
export const COUNSEL_TOOL_NAME = "emit_reply";

export const MIN_BUBBLES = 2;
export const MAX_BUBBLES = 5;
export const BUBBLE_MAX_CHARS = 120;
export const SUGGESTION_COUNT = 2;
export const SUGGESTION_MAX_CHARS = 30;
export const TITLE_MAX_CHARS = 20;

/**
 * 한 턴 응답의 출력 토큰 상한. 비용 상한의 두 번째 자물쇠다
 * (말풍선 5개 × 120자 + 추천질문 2개 + 제목 ≈ 700자 ≈ 600토큰. 여유를 둔다).
 */
export const MAX_REPLY_TOKENS = 900;

export interface CounselorReply {
  bubbles: string[];
  suggestions: string[];
  title?: string;
  crisis: boolean;
}

export interface ReplyOptions {
  /** 첫 턴이면 제목을 함께 받는다 */
  first: boolean;
  /** 마지막 턴이면 추천질문을 받지 않는다 */
  last: boolean;
}

/**
 * 모델에게 줄 tool 파라미터 스키마. 개수를 여기 박는 것이 유일한 방어선이다 —
 * 프롬프트로 "두 개만 주세요"라고 부탁하면 지켜지지 않는 날이 온다.
 */
export function replyToolSchema(opts: ReplyOptions): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    bubbles: {
      type: "array",
      minItems: MIN_BUBBLES,
      maxItems: MAX_BUBBLES,
      items: { type: "string", maxLength: BUBBLE_MAX_CHARS },
      description: "말풍선 하나는 한 호흡이다. 이어지는 말풍선이 같은 말을 되풀이하지 않는다.",
    },
    suggestions: {
      type: "array",
      minItems: opts.last ? 0 : SUGGESTION_COUNT,
      maxItems: opts.last ? 0 : SUGGESTION_COUNT,
      items: { type: "string", maxLength: SUGGESTION_MAX_CHARS },
      description: opts.last
        ? "마지막 턴이므로 빈 배열로 둔다."
        : "사용자가 이어서 물어볼 만한 짧은 질문 두 개. 사용자의 말투로 쓴다.",
    },
    crisis: {
      type: "boolean",
      description:
        "자해·자살·학대 신호를 읽고 사주 해석 대신 안내로 답했으면 true. 아니면 false.",
    },
  };

  const required = ["bubbles", "suggestions", "crisis"];

  if (opts.first) {
    properties.title = {
      type: "string",
      maxLength: TITLE_MAX_CHARS,
      description: "이 상담을 목록에서 알아볼 짧은 제목. 사용자의 고민을 명사구로 줄인다.",
    };
    required.push("title");
  }

  return { type: "object", properties, required };
}

const replyShape = z.object({
  bubbles: z.array(z.string().trim().min(1)).min(MIN_BUBBLES).max(MAX_BUBBLES),
  suggestions: z.array(z.string().trim().min(1)).max(SUGGESTION_COUNT).default([]),
  title: z.string().trim().min(1).max(TITLE_MAX_CHARS).optional(),
  // 빠지면 false. 없다고 무료 턴을 주면 미차감 한도를 우회하는 길이 된다.
  crisis: z.boolean().default(false),
});

/**
 * 제목이 빠진 첫 턴 응답을 메운다. 사용자 발화 앞부분을 잘라 쓴다.
 *
 * 모델이 title 을 안 주는 것을 실패로 볼 수도 있지만, 그러면 parseReply 가 던지고
 * openConsultation 이 이용권을 되돌려 상담이 아예 안 열린다 — 제목 한 줄 때문에
 * 치를 대가가 아니다. 목록에서 알아볼 수만 있으면 된다.
 */
export function fallbackTitle(utterance: string): string {
  // 스프레드로 자르는 이유: 서로게이트 쌍이 반으로 잘리지 않게
  // (src/app/home/_lib/to-home-entry.ts 의 initialOf 와 같은 이유).
  const chars = [...utterance.trim()];
  return chars.length <= TITLE_MAX_CHARS
    ? chars.join("")
    : `${chars.slice(0, TITLE_MAX_CHARS - 1).join("")}…`;
}

/**
 * 돌아온 tool 인자를 믿기 전에 한 번 거른다. 던지면 그 턴은 실패로 처리되고
 * 차감되지 않는다 — 깨진 응답에 이용권을 쓰게 두지 않는다.
 *
 * 개수·필수 강제는 여기 걸지 않는다 (위 "결정" 참고). 모양이 깨진 응답만 거른다.
 */
export function parseReply(raw: unknown, opts: ReplyOptions): CounselorReply {
  const parsed = replyShape.parse(raw);
  return {
    bubbles: parsed.bubbles,
    // 마지막 턴에 추천질문이 와도 버린다. 스키마로 막았지만 모델이 넘겨도
    // 화면에 "더 물어보세요"가 뜨는 일은 없어야 한다.
    suggestions: opts.last ? [] : parsed.suggestions.slice(0, SUGGESTION_COUNT),
    ...(opts.first && parsed.title ? { title: parsed.title } : {}),
    crisis: parsed.crisis,
  };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- src/lib/consultations/schema.test.ts`
Expected: PASS (15 tests)

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/consultations/schema.ts src/lib/consultations/schema.test.ts && git commit -m "feat(consult): 말풍선 응답을 스키마로 강제한다"
```

---

### Task 5: 시스템 프롬프트와 메시지 배치

**Files:**
- Create: `src/lib/consultations/prompt.ts`
- Test: `src/lib/consultations/prompt.test.ts`

**Interfaces:**
- Consumes: `MessageRow` from `./store`
- Produces: `ChatMessage`, `COUNSELOR_SYSTEM_PROMPT`, `CRISIS_HOTLINE`, `buildTurnMessages(input)`

**주의:** 이 태스크의 테스트 중 "캐시 경계" 항목이 이 기능의 비용 상한을 지킨다. 매 턴 바뀌는 값이 앞쪽 메시지에 새면 prefix 캐시가 깨져 비용이 3배가 된다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/consultations/prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { COUNSELOR_SYSTEM_PROMPT, CRISIS_HOTLINE, buildTurnMessages } from "./prompt";
import type { MessageRow } from "./store";

const facts = "일간: 갑목 · 신강약: 중화";

function msg(over: Partial<MessageRow>): MessageRow {
  return {
    id: "1",
    role: "user",
    bubbles: ["회사가 힘들어요"],
    suggestions: null,
    crisis: false,
    turnNo: 1,
    createdAt: "2026-08-17T00:00:00.000Z",
    ...over,
  };
}

const base = { facts, history: [], utterance: "요즘 잠이 안 와요", remaining: 8, isLast: false };

describe("buildTurnMessages", () => {
  it("시스템 → 사실 블록 → 이번 발화 순으로 세운다", () => {
    const m = buildTurnMessages(base);
    expect(m[0].role).toBe("system");
    expect(m[1].role).toBe("user");
    expect(m[1].content).toContain(facts);
    expect(m[m.length - 1].content).toContain("요즘 잠이 안 와요");
  });

  it("이력의 상담사 말풍선을 assistant 한 덩어리로 잇는다", () => {
    const m = buildTurnMessages({
      ...base,
      history: [
        msg({ role: "user", bubbles: ["첫 고민이에요"] }),
        msg({ id: "2", role: "counselor", bubbles: ["첫 마디", "둘째 마디"] }),
      ],
    });
    const assistant = m.filter((x) => x.role === "assistant");
    expect(assistant).toHaveLength(1);
    expect(assistant[0].content).toBe("첫 마디\n둘째 마디");
  });

  it("남은 턴을 마지막 메시지 꼬리에 붙인다", () => {
    const m = buildTurnMessages({ ...base, remaining: 3 });
    expect(m[m.length - 1].content).toContain("남은 턴: 3");
  });

  // ─── 비용을 지키는 테스트 ───
  it("남은 턴이 달라도 앞쪽 메시지는 글자 하나 안 바뀐다 (prefix 캐시)", () => {
    const a = buildTurnMessages({ ...base, remaining: 9 });
    const b = buildTurnMessages({ ...base, remaining: 2 });
    expect(a.slice(0, -1)).toEqual(b.slice(0, -1));
  });

  it("마지막 턴 지시문도 앞쪽 메시지를 바꾸지 않는다", () => {
    const a = buildTurnMessages({ ...base, isLast: false });
    const b = buildTurnMessages({ ...base, isLast: true });
    expect(a.slice(0, -1)).toEqual(b.slice(0, -1));
  });

  it("시스템 프롬프트에 남은 턴 숫자가 새지 않는다", () => {
    const m = buildTurnMessages({ ...base, remaining: 7 });
    expect(m[0].content).not.toContain("남은 턴");
  });

  it("마지막 턴이면 마무리하라고 시킨다", () => {
    const m = buildTurnMessages({ ...base, isLast: true, remaining: 1 });
    expect(m[m.length - 1].content).toContain("마지막");
  });

  it("마지막 턴이 아니면 마무리 지시문이 없다", () => {
    const m = buildTurnMessages({ ...base, isLast: false });
    expect(m[m.length - 1].content).not.toContain("마지막");
  });
});

describe("COUNSELOR_SYSTEM_PROMPT", () => {
  it("사주 용어를 쓰지 말라고 못박는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("용어");
  });

  it("위기 상황 안내 번호를 담는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain(CRISIS_HOTLINE);
    expect(CRISIS_HOTLINE).toBe("109");
  });

  it("사실 블록 밖 정보를 지어내지 말라고 못박는다", () => {
    expect(COUNSELOR_SYSTEM_PROMPT).toContain("[사실]");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/lib/consultations/prompt.test.ts`
Expected: FAIL — `Failed to resolve import "./prompt"`

- [ ] **Step 3: 구현한다**

`src/lib/consultations/prompt.ts`:

```ts
// 상담 프롬프트 조립.
//
// ⚠️ 캐시 경계가 곧 비용이다.
//   system → [사실] 블록 → 이력 순서는 매 턴 앞에서부터 똑같아야 한다. 매 턴
//   바뀌는 값(남은 턴, 마지막 턴 지시문)을 앞쪽에 한 글자라도 넣으면 prefix
//   캐시가 통째로 깨지고, 설계 §5 의 9원짜리 상담이 30원이 된다.
//   그래서 변하는 것은 전부 **마지막 user 메시지의 꼬리**에만 붙인다.

import type { MessageRow } from "./store";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** 자살예방 상담전화. 문구와 프롬프트가 같이 움직이도록 상수로 둔다 */
export const CRISIS_HOTLINE = "109";

export const COUNSELOR_SYSTEM_PROMPT = `당신은 한국어로 고민을 들어주는 상담사다. 명리 계산은 이미 끝나 있고, 당신은 주어진 [사실] 블록만 근거로 상대의 고민에 답한다.

## 절대 규칙

1. [사실] 블록 밖의 정보를 지어내지 마라. 이름·나이·생년월일·직업·가족관계·지역은 주어지지 않는다. 상대가 말해 준 것만 안다.
2. 단정하지 마라. "반드시", "~하게 된다", "~할 운명이다" 대신 "~한 편이에요", "~하기 쉬워요" 같은 경향으로 쓴다.
3. 길흉을 단정하지 마라. 특정 요소가 적거나 없다는 이유만으로 나쁘다고 쓰지 않는다.
4. 의료·법률·투자·수명·임신에 대한 확정적 조언을 하지 마라.
5. 사주 용어를 쓰지 마라. 일간·십성(비견·식신·정재·편관…)·오행(목화토금수)·천간·지지·간지·원국·신강약·용신·희신·대운·세운 같은 말은 답변에 넣지 않는다. [사실] 블록의 용어는 판단 근거일 뿐, 옮겨 적으라는 뜻이 아니다. 근거는 "타고난 기질이 단단해서", "밀어붙이는 힘이 강한 쪽이라" 처럼 일상어로 푼다.

## 위기 상황

상대의 말에서 자해·자살·학대의 신호가 보이면, 사주 해석으로 답하지 마라. 지금의 감정을 먼저 받아 주고, 자살예방 상담전화 ${CRISIS_HOTLINE}(24시간, 무료)으로 이야기해 볼 것을 권한다. 그리고 crisis 를 true 로 표시한다. 신호가 없으면 crisis 는 false 다.

## 문체

- 해요체로 쓴다. ("~예요", "~해요")
- 상대를 부르는 호칭("당신", "고객님")은 쓰지 않는다. 주어 없이 바로 서술한다.
- 말풍선 하나는 한 호흡이다. 짧게 끊어서 여러 개로 말한다.
- 이어지는 말풍선이 앞의 말을 되풀이하지 않는다.
- 추상적인 덕담 대신 알아볼 수 있는 생활 장면으로 쓴다.
- 명리를 모르는 사람이 사전 없이 한 번에 읽히는 문장으로 쓴다.
- 답의 끝에서는 되묻는다. 상대가 더 말할 자리를 남긴다.

## 출력

- 반드시 주어진 도구를 호출해 답한다. 일반 텍스트로 답하지 마라.
- 스키마에 없는 필드를 추가하지 마라. 마크다운·머리말·코드펜스를 넣지 마라.
- 요청한 항목 개수를 정확히 지켜라.`;

export interface BuildTurnInput {
  /** chartFacts 가 만든 [사실] 블록 본문 */
  facts: string;
  /** 저장된 순서 그대로의 대화 이력 (이번 발화는 포함하지 않는다) */
  history: MessageRow[];
  /** 이번 사용자 발화 */
  utterance: string;
  /** 이번 턴을 포함해 남은 턴 수 */
  remaining: number;
  isLast: boolean;
}

export function buildTurnMessages(input: BuildTurnInput): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: "system", content: COUNSELOR_SYSTEM_PROMPT },
    { role: "user", content: `[사실]\n${input.facts}` },
  ];

  for (const m of input.history) {
    messages.push({
      role: m.role === "user" ? "user" : "assistant",
      // 말풍선을 줄바꿈으로 잇는다. 모델에게는 한 번의 발화였으므로 한 덩어리로 돌려준다.
      content: m.bubbles.join("\n"),
    });
  }

  // 변하는 것은 전부 여기에만. 위 주석 참고.
  const tail = input.isLast
    ? `\n---\n남은 턴: ${input.remaining}\n이번이 마지막 답변이다. 지금까지 나눈 이야기를 정리하고 마무리해라. 되묻지 말고, 추천 질문도 내지 마라.`
    : `\n---\n남은 턴: ${input.remaining}`;

  messages.push({ role: "user", content: `${input.utterance}${tail}` });

  return messages;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- src/lib/consultations/prompt.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/consultations/prompt.ts src/lib/consultations/prompt.test.ts && git commit -m "feat(consult): 상담 프롬프트를 캐시 경계에 맞춰 조립한다"
```

---

### Task 6: 이용권 경계

**Files:**
- Create: `src/lib/consultations/ticket-port.ts`
- Test: `src/lib/consultations/ticket-port.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `TicketPort`, `InsufficientTicketsError`, `stubTicketPort`

**주의:** 이 파일이 다른 세션(이용권 시스템)과의 유일한 접점이다. 이용권 작업이 끝나면 `stubTicketPort` 만 실구현으로 갈아 끼운다. 이 태스크에서 이용권 테이블을 만들지 않는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/consultations/ticket-port.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { InsufficientTicketsError, stubTicketPort } from "./ticket-port";

describe("stubTicketPort", () => {
  it("잔액은 0 을 돌려준다 — 던지면 목록 화면 전체가 500 이 된다", async () => {
    expect(await stubTicketPort.getBalance("3")).toBe(0);
  });

  it("차감은 던진다 — 배선 전에 상담이 공짜로 열리면 안 된다", async () => {
    await expect(stubTicketPort.spend("3", "7")).rejects.toThrow();
  });

  it("되돌리기도 던진다", async () => {
    await expect(stubTicketPort.refund("3", "7")).rejects.toThrow();
  });

  it("차감 실패는 배선 전임을 알아볼 수 있는 메시지를 남긴다", async () => {
    await expect(stubTicketPort.spend("3", "7")).rejects.toThrow(/이용권/);
  });
});

describe("InsufficientTicketsError", () => {
  it("이름으로 구별할 수 있다 — 라우트가 이것만 402 로 바꾼다", () => {
    const e = new InsufficientTicketsError();
    expect(e.name).toBe("InsufficientTicketsError");
    expect(e).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/lib/consultations/ticket-port.test.ts`
Expected: FAIL — `Failed to resolve import "./ticket-port"`

- [ ] **Step 3: 구현한다**

`src/lib/consultations/ticket-port.ts`:

```ts
// 이용권 모듈과의 경계. 이 파일 하나가 다른 세션과의 유일한 접점이다.
//
// 이용권 시스템(구매·잔액·원장)은 별도 작업이고 이 기능의 범위 밖이다. 여기서는
// 고민상담이 필요로 하는 세 가지 동작의 타입만 선언하고, 구현은 그 작업이 끝난 뒤
// stubTicketPort 를 실구현으로 갈아 끼운다.

/** 잔액이 부족할 때. 라우트는 이 에러만 402 로 바꾼다 */
export class InsufficientTicketsError extends Error {
  constructor() {
    super("이용권이 부족합니다");
    this.name = "InsufficientTicketsError";
  }
}

export interface TicketPort {
  getBalance(userId: string): Promise<number>;
  /**
   * 이용권 한 장을 쓴다. 잔액이 없으면 InsufficientTicketsError 를 던진다.
   * consultationId 는 멱등키 자리다 — 어떻게 구현하든 같은 상담에 두 번
   * 차감되지 않게 할 손잡이가 필요하다.
   */
  spend(userId: string, consultationId: string): Promise<void>;
  refund(userId: string, consultationId: string): Promise<void>;
}

/**
 * 배선 전 스텁. 동작이 갈리는 것은 의도된 것이다.
 *
 * - spend/refund 는 **던진다**. 배선 전에 상담이 공짜로 열리면 안 되고,
 *   던져야 그 사실이 즉시 드러난다.
 * - getBalance 는 0 을 돌려준다. 던지면 목록 화면 전체가 500 이 되어
 *   개발 중에 아무것도 볼 수 없다. 대신 이 0 을 화면에 숫자로 표시하지는
 *   않는다 (설계 §4-b) — 스텁의 0 을 "0장"이라고 보여주면 거짓말이 된다.
 */
export const stubTicketPort: TicketPort = {
  getBalance: async () => 0,
  spend: async () => {
    throw new Error("이용권 차감이 아직 배선되지 않았습니다 (ticket-port.ts)");
  },
  refund: async () => {
    throw new Error("이용권 되돌리기가 아직 배선되지 않았습니다 (ticket-port.ts)");
  },
};
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- src/lib/consultations/ticket-port.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/consultations/ticket-port.ts src/lib/consultations/ticket-port.test.ts && git commit -m "feat(consult): 이용권 경계를 타입으로 선언한다"
```

---

### Task 7: DeepSeek 채팅 어댑터

**Files:**
- Create: `src/lib/consultations/model.ts`
- Create: `src/lib/consultations/chat-transport.ts`
- Test: `src/lib/consultations/chat-transport.test.ts`

**Interfaces:**
- Consumes: `ChatMessage` from `./prompt`
- Produces: `CONSULT_MODEL`, `DEEPSEEK_URL`, `ChatRequest`, `ChatUsage`, `ChatResult`, `ChatTransport`, `createDeepSeekChatTransport(opts)`

**주의:** 기존 `src/app/api/saju/_lib/deepseek.ts` 를 고치지 않는다. 그쪽은 `SectionRequest`(system+user 두 메시지)에 묶여 있어 대화 이력을 실을 자리가 없다. 형제 어댑터를 새로 둔다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/consultations/chat-transport.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { CONSULT_MODEL } from "./model";
import { DEEPSEEK_URL, createDeepSeekChatTransport } from "./chat-transport";

const req = {
  model: CONSULT_MODEL,
  messages: [
    { role: "system" as const, content: "규칙" },
    { role: "user" as const, content: "안녕" },
  ],
  toolName: "emit_reply",
  inputSchema: { type: "object", properties: {} },
  maxTokens: 900,
};

function okResponse(args: unknown, usage?: unknown) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(args) } }] } }],
      usage: usage ?? { prompt_tokens: 1200, completion_tokens: 300 },
    }),
    { status: 200 },
  );
}

describe("createDeepSeekChatTransport", () => {
  it("tool 인자를 파싱해 돌려준다", async () => {
    const t = createDeepSeekChatTransport({ apiKey: "k", fetch: async () => okResponse({ a: 1 }) });
    const r = await t(req);
    expect(r.args).toEqual({ a: 1 });
  });

  it("토큰 사용량을 반환값에 담는다 — 상담 행에 누적해야 한다", async () => {
    const t = createDeepSeekChatTransport({ apiKey: "k", fetch: async () => okResponse({}) });
    const r = await t(req);
    expect(r.usage).toEqual({ promptTokens: 1200, completionTokens: 300 });
  });

  it("usage 가 없으면 0 으로 둔다", async () => {
    const t = createDeepSeekChatTransport({
      apiKey: "k",
      fetch: async () => okResponse({}, null),
    });
    const r = await t(req);
    expect(r.usage).toEqual({ promptTokens: 0, completionTokens: 0 });
  });

  it("메시지 배열을 그대로 싣고 tool 을 강제한다", async () => {
    let body: any;
    const t = createDeepSeekChatTransport({
      apiKey: "k",
      fetch: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return okResponse({});
      },
    });
    await t(req);
    expect(body.messages).toHaveLength(2);
    expect(body.tool_choice).toEqual({ type: "function", function: { name: "emit_reply" } });
    expect(body.max_tokens).toBe(900);
  });

  it("thinking 을 끈다 — 켜면 tool_choice 강제가 400 으로 거부된다", async () => {
    let body: any;
    const t = createDeepSeekChatTransport({
      apiKey: "k",
      fetch: async (_url, init) => {
        body = JSON.parse(String(init?.body));
        return okResponse({});
      },
    });
    await t(req);
    expect(body.thinking).toEqual({ type: "disabled" });
  });

  it("HTTP 에러면 던진다", async () => {
    const t = createDeepSeekChatTransport({
      apiKey: "k",
      fetch: async () => new Response("nope", { status: 500 }),
    });
    await expect(t(req)).rejects.toThrow(/500/);
  });

  it("tool 을 안 부르고 텍스트로 답하면 던진다", async () => {
    const t = createDeepSeekChatTransport({
      apiKey: "k",
      fetch: async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "안녕하세요" } }] }), {
          status: 200,
        }),
    });
    await expect(t(req)).rejects.toThrow(/tool/);
  });

  it("tool 인자가 JSON 이 아니면 던진다", async () => {
    const t = createDeepSeekChatTransport({
      apiKey: "k",
      fetch: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { tool_calls: [{ function: { arguments: "{깨진" } }] } }],
          }),
          { status: 200 },
        ),
    });
    await expect(t(req)).rejects.toThrow(/JSON/);
  });

  it("엔드포인트는 DeepSeek chat/completions 다", () => {
    expect(DEEPSEEK_URL).toBe("https://api.deepseek.com/chat/completions");
  });
});

describe("CONSULT_MODEL", () => {
  it("리포트와 따로 움직일 수 있도록 상수로 분리돼 있다", () => {
    expect(CONSULT_MODEL).toBe("deepseek-v4-pro");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/lib/consultations/chat-transport.test.ts`
Expected: FAIL — `Failed to resolve import "./model"`

- [ ] **Step 3: 구현한다**

`src/lib/consultations/model.ts`:

```ts
/**
 * 상담에 쓸 모델. 리포트(src/app/api/saju/_lib/generator.ts 의 MODEL)와 값이
 * 같더라도 상수를 따로 두는 이유는, 둘이 서로 모르게 갈릴 수 있어야 하기
 * 때문이다 — 리포트는 한 번 쓰고 오래 남는 글이고 상담은 짧은 대화 턴이라,
 * 한쪽만 내리고 싶은 날이 온다.
 */
export const CONSULT_MODEL = "deepseek-v4-pro";
```

`src/lib/consultations/chat-transport.ts`:

```ts
// DeepSeek(OpenAI 호환) 채팅 어댑터.
//
// src/app/api/saju/_lib/deepseek.ts 와 형제지만 합치지 않는다. 그쪽은
// SectionRequest(system + user 두 메시지)에 묶여 있어 대화 이력을 실을 자리가
// 없고, 토큰 사용량도 콜백으로만 흘린다. 상담은 메시지 배열이 매 턴 자라고
// 사용량을 상담 행에 누적해야 해서 반환값으로 받아야 한다. 기존 어댑터를
// 일반화하면 리포트 경로를 건드리게 되고, 얻는 것 없이 위험만 진다.

import type { ChatMessage } from "./prompt";

export const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  toolName: string;
  inputSchema: Record<string, unknown>;
  maxTokens: number;
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface ChatResult {
  /** tool 호출 인자. 검증은 호출자가 한다 */
  args: unknown;
  usage: ChatUsage;
}

export type ChatTransport = (req: ChatRequest) => Promise<ChatResult>;

/** 응답에서 실제로 읽는 부분만. 나머지 필드는 알 바 아니다. */
interface ChatCompletion {
  choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
}

export function createDeepSeekChatTransport(opts: {
  apiKey: string;
  /** 테스트에서 주입한다. 기본은 전역 fetch */
  fetch?: typeof fetch;
}): ChatTransport {
  const doFetch = opts.fetch ?? fetch;

  return async (req) => {
    const res = await doFetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        tools: [
          { type: "function", function: { name: req.toolName, parameters: req.inputSchema } },
        ],
        // thinking 모드는 특정 함수 강제를 400 으로 거부한다
        // ("Thinking mode does not support this tool_choice"). 이 파이프라인은
        // 스키마 강제가 유일한 방어선이라 끈다.
        thinking: { type: "disabled" },
        tool_choice: { type: "function", function: { name: req.toolName } },
        // 출력 상한. 비용 상한의 두 번째 자물쇠다.
        max_tokens: req.maxTokens,
      }),
    });

    if (!res.ok) {
      throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
    }

    const json = (await res.json()) as ChatCompletion;

    const usage: ChatUsage = {
      promptTokens: json.usage?.prompt_tokens ?? 0,
      completionTokens: json.usage?.completion_tokens ?? 0,
    };

    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    // tool_choice 로 강제했는데도 본문 텍스트로 답하는 모델이 있다.
    if (typeof args !== "string") {
      throw new Error("DeepSeek 응답에 tool 호출이 없다");
    }

    try {
      return { args: JSON.parse(args), usage };
    } catch {
      throw new Error(`DeepSeek tool arguments 가 JSON 이 아니다: ${args}`);
    }
  };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- src/lib/consultations/chat-transport.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/consultations/model.ts src/lib/consultations/chat-transport.ts src/lib/consultations/chat-transport.test.ts && git commit -m "feat(consult): DeepSeek 채팅 어댑터를 만든다"
```

---

### Task 8: 한 턴 실행

**Files:**
- Create: `src/lib/consultations/turn.ts`
- Test: `src/lib/consultations/turn.test.ts`

**Interfaces:**
- Consumes: `buildTurnMessages` from `./prompt`, `replyToolSchema`/`parseReply`/`fallbackTitle`/`COUNSEL_TOOL_NAME`/`MAX_REPLY_TOKENS` from `./schema`, `ChatTransport` from `./chat-transport`, `MessageRow` from `./store`
- Produces: `RunTurnInput`, `TurnResult`, `runTurn(input, deps)`

**Task 4 의 결정이 여기 걸린다:** 첫 턴 응답에 `title` 이 없으면 `runTurn` 이 `fallbackTitle(input.utterance)` 로 메운다. `parseReply` 는 응답만 검증하고, 발화를 아는 곳은 여기다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/consultations/turn.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { runTurn } from "./turn";
import { COUNSEL_TOOL_NAME, MAX_REPLY_TOKENS } from "./schema";
import type { ChatRequest, ChatTransport } from "./chat-transport";

const reply = {
  bubbles: ["첫 마디예요", "둘째 마디예요"],
  suggestions: ["더 들려주실래요?", "다른 얘기도 할까요?"],
  crisis: false,
};

function fakeTransport(args: unknown = reply) {
  const seen: ChatRequest[] = [];
  const transport: ChatTransport = async (req) => {
    seen.push(req);
    return { args, usage: { promptTokens: 1200, completionTokens: 300 } };
  };
  return { transport, seen };
}

const base = {
  facts: "일간: 갑목",
  history: [],
  utterance: "요즘 잠이 안 와요",
  remaining: 8,
  isLast: false,
  first: false,
};

describe("runTurn", () => {
  it("파싱된 답과 사용량을 함께 돌려준다", async () => {
    const { transport } = fakeTransport();
    const r = await runTurn(base, { transport, model: "m" });
    expect(r.reply.bubbles).toEqual(["첫 마디예요", "둘째 마디예요"]);
    expect(r.usage).toEqual({ promptTokens: 1200, completionTokens: 300 });
  });

  it("tool 이름과 출력 상한을 실어 보낸다", async () => {
    const { transport, seen } = fakeTransport();
    await runTurn(base, { transport, model: "m" });
    expect(seen[0].toolName).toBe(COUNSEL_TOOL_NAME);
    expect(seen[0].maxTokens).toBe(MAX_REPLY_TOKENS);
    expect(seen[0].model).toBe("m");
  });

  it("마지막 턴이면 추천질문 없는 스키마를 보낸다", async () => {
    const { transport, seen } = fakeTransport({ ...reply, suggestions: [] });
    await runTurn({ ...base, isLast: true, remaining: 1 }, { transport, model: "m" });
    const props = seen[0].inputSchema.properties as Record<string, any>;
    expect(props.suggestions.maxItems).toBe(0);
  });

  it("첫 턴이면 제목을 요구하고 받아온다", async () => {
    const { transport, seen } = fakeTransport({ ...reply, title: "잠 못 드는 밤" });
    const r = await runTurn({ ...base, first: true }, { transport, model: "m" });
    expect((seen[0].inputSchema.properties as Record<string, any>).title).toBeDefined();
    expect(r.reply.title).toBe("잠 못 드는 밤");
  });

  it("첫 턴에 제목이 안 오면 발화에서 메운다 — 목록이 '아직 시작하지 않은 상담'으로 거짓말하면 안 된다", async () => {
    const { transport } = fakeTransport(reply);
    const r = await runTurn({ ...base, first: true }, { transport, model: "m" });
    expect(r.reply.title).toBe("요즘 잠이 안 와요");
  });

  it("이후 턴에는 제목을 메우지 않는다 — 기존 제목을 덮어쓰면 안 된다", async () => {
    const { transport } = fakeTransport(reply);
    const r = await runTurn({ ...base, first: false }, { transport, model: "m" });
    expect(r.reply.title).toBeUndefined();
  });

  it("깨진 응답이면 던진다 — 차감 없이 실패해야 한다", async () => {
    const { transport } = fakeTransport({ bubbles: ["하나뿐"] });
    await expect(runTurn(base, { transport, model: "m" })).rejects.toThrow();
  });

  it("transport 가 던지면 그대로 올려보낸다", async () => {
    const transport: ChatTransport = async () => {
      throw new Error("DeepSeek 500");
    };
    await expect(runTurn(base, { transport, model: "m" })).rejects.toThrow(/DeepSeek/);
  });

  it("위기 응답의 crisis 를 그대로 전한다", async () => {
    const { transport } = fakeTransport({ ...reply, crisis: true });
    const r = await runTurn(base, { transport, model: "m" });
    expect(r.reply.crisis).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/lib/consultations/turn.test.ts`
Expected: FAIL — `Failed to resolve import "./turn"`

- [ ] **Step 3: 구현한다**

`src/lib/consultations/turn.ts`:

```ts
// 한 턴: 프롬프트 조립 → LLM 호출 → 응답 파싱. DB 도 이용권도 모른다 —
// 그 둘은 service.ts 가 감싼다.

import { buildTurnMessages } from "./prompt";
import {
  COUNSEL_TOOL_NAME,
  MAX_REPLY_TOKENS,
  fallbackTitle,
  parseReply,
  replyToolSchema,
  type CounselorReply,
} from "./schema";
import type { ChatTransport, ChatUsage } from "./chat-transport";
import type { MessageRow } from "./store";

export interface RunTurnInput {
  facts: string;
  history: MessageRow[];
  utterance: string;
  remaining: number;
  isLast: boolean;
  /** 첫 턴이면 제목을 함께 받는다 */
  first: boolean;
}

export interface TurnResult {
  reply: CounselorReply;
  usage: ChatUsage;
}

export interface TurnDeps {
  transport: ChatTransport;
  model: string;
}

/**
 * 던지면 그 턴은 실패다. 호출자가 차감을 되돌리거나(첫 턴) 그냥 재시도하게
 * 둔다(이후 턴) — 어느 쪽이든 깨진 응답에 턴을 쓰지 않는다.
 */
export async function runTurn(input: RunTurnInput, deps: TurnDeps): Promise<TurnResult> {
  const opts = { first: input.first, last: input.isLast };

  const { args, usage } = await deps.transport({
    model: deps.model,
    messages: buildTurnMessages(input),
    toolName: COUNSEL_TOOL_NAME,
    inputSchema: replyToolSchema(opts),
    maxTokens: MAX_REPLY_TOKENS,
  });

  const reply = parseReply(args, opts);

  // 첫 턴에 제목이 안 왔으면 발화에서 메운다. parseReply 가 던지게 두면 제목 한 줄
  // 때문에 이용권이 되돌려지고 상담이 아예 안 열린다 (Task 4 의 결정 참고).
  if (input.first && !reply.title) {
    return { reply: { ...reply, title: fallbackTitle(input.utterance) }, usage };
  }

  return { reply, usage };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- src/lib/consultations/turn.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/consultations/turn.ts src/lib/consultations/turn.test.ts && git commit -m "feat(consult): 한 턴 실행을 조립한다"
```

---

### Task 9: 개설과 진행 오케스트레이션

**Files:**
- Create: `src/lib/consultations/service.ts`
- Test: `src/lib/consultations/service.test.ts`

**Interfaces:**
- Consumes: 앞선 태스크 전부 (`store`, `budget`, `turn`, `ticket-port`)
- Produces: `ConsultationClosedError`, `ServiceDeps`, `ServiceStore`, `OpenResult`, `AdvanceResult`, `openConsultation(input, deps)`, `advanceConsultation(input, deps)`

**주의:** 차감 순서와 되돌리기가 이 기능에서 돈이 걸린 유일한 지점이다. 테스트를 먼저 읽고 구현한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/consultations/service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { openConsultation, advanceConsultation, ConsultationClosedError } from "./service";
import { InsufficientTicketsError, type TicketPort } from "./ticket-port";
import type { ConsultationRow, MessageRow } from "./store";
import type { ChatTransport } from "./chat-transport";

const consultation: ConsultationRow = {
  id: "7",
  userId: "3",
  profileId: "12",
  status: "open",
  turnsUsed: 0,
  turnLimit: 10,
  title: null,
  createdAt: "2026-08-17T00:00:00.000Z",
  closedAt: null,
};

const reply = {
  bubbles: ["첫 마디예요", "둘째 마디예요"],
  suggestions: ["더 들려주실래요?", "다른 얘기도 할까요?"],
  crisis: false,
};

function fakeTransport(args: unknown = reply): ChatTransport {
  return async () => ({ args, usage: { promptTokens: 1200, completionTokens: 300 } });
}

function fakeTickets(over: Partial<TicketPort> = {}): TicketPort {
  return {
    getBalance: vi.fn(async () => 3),
    spend: vi.fn(async () => {}),
    refund: vi.fn(async () => {}),
    ...over,
  };
}

function fakeStore(over: Record<string, unknown> = {}) {
  return {
    createConsultation: vi.fn(async () => consultation),
    getConsultation: vi.fn(async () => consultation),
    listMessages: vi.fn(async (): Promise<MessageRow[]> => []),
    appendMessage: vi.fn(async () => ({}) as MessageRow),
    commitTurn: vi.fn(async () => ({ ...consultation, turnsUsed: 1 })),
    ...over,
  };
}

function deps(over: Record<string, unknown> = {}) {
  return {
    store: fakeStore(),
    tickets: fakeTickets(),
    transport: fakeTransport(),
    model: "m",
    ...over,
  } as any;
}

const openInput = { userId: "3", profileId: "12", facts: "일간: 갑목", utterance: "잠이 안 와요" };

describe("openConsultation", () => {
  it("행을 먼저 만들고 그 id 로 차감한다 — 멱등키가 있어야 두 번 안 빠진다", async () => {
    const d = deps();
    await openConsultation(openInput, d);
    expect(d.store.createConsultation).toHaveBeenCalled();
    expect(d.tickets.spend).toHaveBeenCalledWith("3", "7");
  });

  it("차감이 실패하면 LLM 을 부르지 않는다", async () => {
    let called = false;
    const d = deps({
      tickets: fakeTickets({
        spend: async () => {
          throw new InsufficientTicketsError();
        },
      }),
      transport: (async () => {
        called = true;
        return { args: reply, usage: { promptTokens: 0, completionTokens: 0 } };
      }) as ChatTransport,
    });
    await expect(openConsultation(openInput, d)).rejects.toThrow(InsufficientTicketsError);
    expect(called).toBe(false);
  });

  it("첫 턴 LLM 이 실패하면 이용권을 되돌린다", async () => {
    const d = deps({
      transport: (async () => {
        throw new Error("DeepSeek 500");
      }) as ChatTransport,
    });
    await expect(openConsultation(openInput, d)).rejects.toThrow(/DeepSeek/);
    expect(d.tickets.refund).toHaveBeenCalledWith("3", "7");
  });

  it("되돌리기까지 실패해도 원래 에러를 올려보낸다 — turns_used=0 행이 증거다", async () => {
    const d = deps({
      transport: (async () => {
        throw new Error("DeepSeek 500");
      }) as ChatTransport,
      tickets: fakeTickets({
        refund: async () => {
          throw new Error("환불 실패");
        },
      }),
    });
    await expect(openConsultation(openInput, d)).rejects.toThrow(/DeepSeek/);
  });

  it("첫 턴에서 받은 제목을 상담에 적는다", async () => {
    const d = deps({ transport: fakeTransport({ ...reply, title: "잠 못 드는 밤" }) });
    await openConsultation(openInput, d);
    expect(d.store.commitTurn).toHaveBeenCalledWith(
      expect.objectContaining({ title: "잠 못 드는 밤", turnsUsed: 1, status: "open" }),
    );
  });

  it("사용자 발화와 상담사 답을 둘 다 남긴다", async () => {
    const d = deps();
    await openConsultation(openInput, d);
    expect(d.store.appendMessage).toHaveBeenCalledTimes(2);
    expect(d.store.appendMessage.mock.calls[0][0].role).toBe("user");
    expect(d.store.appendMessage.mock.calls[1][0].role).toBe("counselor");
  });

  it("토큰 사용량을 상담 행에 누적한다", async () => {
    const d = deps();
    await openConsultation(openInput, d);
    expect(d.store.commitTurn).toHaveBeenCalledWith(
      expect.objectContaining({ tokensIn: 1200, tokensOut: 300 }),
    );
  });
});

describe("advanceConsultation", () => {
  const advInput = { userId: "3", id: "7", facts: "일간: 갑목", utterance: "그래서 고민이에요" };

  it("이용권을 다시 쓰지 않는다 — 상담 1건에 1장이다", async () => {
    const d = deps();
    await advanceConsultation(advInput, d);
    expect(d.tickets.spend).not.toHaveBeenCalled();
  });

  it("없는 상담이면 null 이다", async () => {
    const d = deps({ store: fakeStore({ getConsultation: async () => null }) });
    expect(await advanceConsultation(advInput, d)).toBeNull();
  });

  it("턴을 다 쓴 상담이면 던진다", async () => {
    const d = deps({
      store: fakeStore({
        getConsultation: async () => ({ ...consultation, turnsUsed: 10 }),
      }),
    });
    await expect(advanceConsultation(advInput, d)).rejects.toThrow(ConsultationClosedError);
  });

  it("닫힌 상담이면 던진다", async () => {
    const d = deps({
      store: fakeStore({
        getConsultation: async () => ({ ...consultation, status: "closed" as const }),
      }),
    });
    await expect(advanceConsultation(advInput, d)).rejects.toThrow(ConsultationClosedError);
  });

  it("마지막 턴을 쓰면 상담을 닫는다", async () => {
    const d = deps({
      store: fakeStore({
        getConsultation: async () => ({ ...consultation, turnsUsed: 9 }),
      }),
    });
    await advanceConsultation(advInput, d);
    expect(d.store.commitTurn).toHaveBeenCalledWith(
      expect.objectContaining({ turnsUsed: 10, status: "closed" }),
    );
  });

  it("위기 턴은 차감하지 않는다", async () => {
    const d = deps({
      store: fakeStore({
        getConsultation: async () => ({ ...consultation, turnsUsed: 4 }),
      }),
      transport: fakeTransport({ ...reply, crisis: true }),
    });
    await advanceConsultation(advInput, d);
    expect(d.store.commitTurn).toHaveBeenCalledWith(
      expect.objectContaining({ turnsUsed: 4, status: "open" }),
    );
  });

  it("무료 위기 턴 한도를 채웠으면 위기여도 차감한다", async () => {
    const crisisMsg = {
      id: "1",
      role: "counselor" as const,
      bubbles: ["안내"],
      suggestions: [],
      crisis: true,
      turnNo: 1,
      createdAt: "2026-08-17T00:00:00.000Z",
    };
    const d = deps({
      store: fakeStore({
        getConsultation: async () => ({ ...consultation, turnsUsed: 4 }),
        listMessages: async () => [crisisMsg, crisisMsg, crisisMsg],
      }),
      transport: fakeTransport({ ...reply, crisis: true }),
    });
    await advanceConsultation(advInput, d);
    expect(d.store.commitTurn).toHaveBeenCalledWith(
      expect.objectContaining({ turnsUsed: 5 }),
    );
  });

  it("이후 턴은 제목을 덮어쓰지 않는다", async () => {
    const d = deps();
    await advanceConsultation(advInput, d);
    expect(d.store.commitTurn).toHaveBeenCalledWith(expect.objectContaining({ title: null }));
  });

  it("LLM 이 실패하면 사용자 발화도 남기지 않는다 — 유령 발화가 이력에 남으면 안 된다", async () => {
    const d = deps({
      transport: (async () => {
        throw new Error("DeepSeek 500");
      }) as ChatTransport,
    });
    await expect(advanceConsultation(advInput, d)).rejects.toThrow(/DeepSeek/);
    expect(d.store.appendMessage).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/lib/consultations/service.test.ts`
Expected: FAIL — `Failed to resolve import "./service"`

- [ ] **Step 3: 구현한다**

`src/lib/consultations/service.ts`:

```ts
// 개설·진행 오케스트레이션. 이 파일이 이용권과 DB 와 LLM 을 동시에 아는
// 유일한 자리다. 셋 중 무엇이 언제 실패하는지가 여기서만 결정된다.

import { DEFAULT_TURN_LIMIT, countCrisis, decideTurn, nextState } from "./budget";
import { runTurn } from "./turn";
import type { ChatTransport } from "./chat-transport";
import type { TicketPort } from "./ticket-port";
import type {
  AppendMessageInput,
  CommitTurnInput,
  ConsultationRow,
  CreateConsultationInput,
  MessageRow,
} from "./store";
import type { CounselorReply } from "./schema";

/** 턴을 다 쓴(또는 닫힌) 상담에 더 말을 걸었을 때 */
export class ConsultationClosedError extends Error {
  constructor() {
    super("이 상담은 이미 마무리됐습니다");
    this.name = "ConsultationClosedError";
  }
}

/** service 가 쓰는 저장소 동작만. 테스트가 통째로 가짜를 넣는다 */
export interface ServiceStore {
  createConsultation(input: CreateConsultationInput): Promise<ConsultationRow>;
  getConsultation(userId: string, id: string): Promise<ConsultationRow | null>;
  listMessages(consultationId: string): Promise<MessageRow[]>;
  appendMessage(input: AppendMessageInput): Promise<MessageRow>;
  commitTurn(input: CommitTurnInput): Promise<ConsultationRow>;
}

export interface ServiceDeps {
  store: ServiceStore;
  tickets: TicketPort;
  transport: ChatTransport;
  model: string;
}

export interface OpenResult {
  consultation: ConsultationRow;
  reply: CounselorReply;
}

export type AdvanceResult = OpenResult;

/**
 * 상담 개설 + 첫 턴.
 *
 * 순서가 [행 생성 → 차감 → LLM] 인 이유:
 *  - 행이 먼저여야 consultationId 를 멱등키로 넘길 수 있다.
 *  - 차감이 LLM 보다 먼저여야 한다. 뒤로 미루면 차감 실패 시 이미 답을 준
 *    뒤라 되돌릴 수 없다. 반대 방향(차감 후 LLM 실패)은 되돌릴 수 있다.
 */
export async function openConsultation(
  input: { userId: string; profileId: string | null; facts: string; utterance: string },
  deps: ServiceDeps,
): Promise<OpenResult> {
  const consultation = await deps.store.createConsultation({
    userId: input.userId,
    profileId: input.profileId,
    turnLimit: DEFAULT_TURN_LIMIT,
  });

  await deps.tickets.spend(input.userId, consultation.id);

  let result;
  try {
    result = await runTurn(
      {
        facts: input.facts,
        history: [],
        utterance: input.utterance,
        remaining: consultation.turnLimit,
        isLast: consultation.turnLimit === 1,
        first: true,
      },
      { transport: deps.transport, model: deps.model },
    );
  } catch (e) {
    // 되돌리기까지 실패하면 turns_used=0 인 행이 남는다. 그 행이 곧 증거이므로
    // 별도 보상 로직을 두지 않는다 — 사용자는 그 상담을 이용권 없이 재개한다.
    try {
      await deps.tickets.refund(input.userId, consultation.id);
    } catch (refundError) {
      console.error("[consult] 이용권 되돌리기 실패", consultation.id, refundError);
    }
    throw e;
  }

  const after = await persistTurn(consultation, input.utterance, result, 0, deps);
  return { consultation: after, reply: result.reply };
}

/**
 * 이어지는 턴. 이용권을 다시 쓰지 않는다 — 상담 1건에 1장이다.
 * 없는(또는 남의) 상담이면 null. 턴을 다 썼으면 ConsultationClosedError.
 */
export async function advanceConsultation(
  input: { userId: string; id: string; facts: string; utterance: string },
  deps: ServiceDeps,
): Promise<AdvanceResult | null> {
  const consultation = await deps.store.getConsultation(input.userId, input.id);
  if (!consultation) return null;

  const decision = decideTurn(consultation);
  if (decision.kind === "exhausted") throw new ConsultationClosedError();

  const history = await deps.store.listMessages(consultation.id);

  // LLM 을 먼저 부르고 그 다음에 저장한다. 순서를 뒤집으면 호출이 실패했을 때
  // 답 없는 사용자 발화가 이력에 남아, 다음 턴의 프롬프트가 그 유령을 읽는다.
  const result = await runTurn(
    {
      facts: input.facts,
      history,
      utterance: input.utterance,
      remaining: decision.remaining,
      isLast: decision.isLast,
      first: false,
    },
    { transport: deps.transport, model: deps.model },
  );

  const after = await persistTurn(
    consultation,
    input.utterance,
    result,
    countCrisis(history),
    deps,
  );
  return { consultation: after, reply: result.reply };
}

/** 발화·답변을 남기고 턴 수·상태·제목·토큰을 올린다 */
async function persistTurn(
  consultation: ConsultationRow,
  utterance: string,
  result: { reply: CounselorReply; usage: { promptTokens: number; completionTokens: number } },
  crisisSoFar: number,
  deps: ServiceDeps,
): Promise<ConsultationRow> {
  const state = nextState(consultation, { crisis: result.reply.crisis, crisisSoFar });
  const turnNo = consultation.turnsUsed + 1;

  await deps.store.appendMessage({
    consultationId: consultation.id,
    role: "user",
    bubbles: [utterance],
    suggestions: null,
    turnNo,
  });

  await deps.store.appendMessage({
    consultationId: consultation.id,
    role: "counselor",
    bubbles: result.reply.bubbles,
    suggestions: result.reply.suggestions,
    crisis: result.reply.crisis,
    turnNo,
  });

  return deps.store.commitTurn({
    id: consultation.id,
    turnsUsed: state.turnsUsed,
    status: state.status,
    // 첫 턴에만 값이 있다. store 가 COALESCE 로 기존 제목을 지킨다.
    title: result.reply.title ?? null,
    tokensIn: result.usage.promptTokens,
    tokensOut: result.usage.completionTokens,
  });
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- src/lib/consultations/service.test.ts`
Expected: PASS (17 tests)

Run: `npm test && npm run typecheck`
Expected: 전부 통과

- [ ] **Step 5: 커밋한다**

```bash
git add src/lib/consultations/service.ts src/lib/consultations/service.test.ts && git commit -m "feat(consult): 개설과 진행에 차감·되돌리기를 붙인다"
```

---

### Task 10: API 라우트

**Files:**
- Create: `src/lib/consultations/facts.ts`
- Create: `src/lib/consultations/deps.ts`
- Create: `src/app/api/consultations/route.ts`
- Create: `src/app/api/consultations/[id]/messages/route.ts`
- Test: `src/lib/consultations/facts.test.ts`

**Interfaces:**
- Consumes: `getSession` from `@/lib/auth/session`, `getProfile`/`listProfiles` from `@/lib/profiles/store`, `analyze` from `@/lib/saju-core`, `chartFacts` from `@/app/api/saju/_lib/prompt/facts`, `toBirthInput` from `@/app/report/_lib/to-birth-input`, `openConsultation`/`advanceConsultation` from `../../../lib/consultations/service`
- Produces: `factsForProfile(profile)`, `consultationDeps()`

**주의:** 라우트를 쓰기 전에 `node_modules/next/dist/docs/` 에서 Route Handler 가이드를 읽는다. 특히 동적 세그먼트 `params` 가 Promise 인지 확인한다 (이 저장소의 페이지들은 `searchParams` 를 `await` 한다).

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/consultations/facts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { factsForProfile } from "./facts";
import type { ProfileRow } from "@/lib/profiles/store";

const profile: ProfileRow = {
  id: "12",
  name: "김동진",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1990, month: 10, day: 25 },
  timeKnown: true,
  time: { hour: 15, minute: 20 },
  birthPlace: { country: "KR", regionId: "seoul" },
  trueSolar: true,
  createdAt: "2026-07-31T00:00:00.000Z",
  isPaid: false,
};

describe("factsForProfile", () => {
  it("사실 블록을 만든다", () => {
    const facts = factsForProfile(profile);
    expect(typeof facts).toBe("string");
    expect(facts.length).toBeGreaterThan(0);
  });

  it("이름을 담지 않는다 — 사실 블록에 개인정보가 새면 안 된다", () => {
    expect(factsForProfile(profile)).not.toContain("김동진");
  });

  it("생년을 담지 않는다", () => {
    expect(factsForProfile(profile)).not.toContain("1990");
  });

  it("계산할 수 없는 생년월일이면 null 이다 — 상담 하나 때문에 500 이 되면 안 된다", () => {
    const broken = { ...profile, birth: { year: 1700, month: 1, day: 1 } };
    expect(factsForProfile(broken)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/lib/consultations/facts.test.ts`
Expected: FAIL — `Failed to resolve import "./facts"`

- [ ] **Step 3: facts 와 deps 를 구현한다**

`src/lib/consultations/facts.ts`:

```ts
import { analyze } from "@/lib/saju-core";
import { chartFacts } from "@/app/api/saju/_lib/prompt/facts";
import { toBirthInput } from "@/app/report/_lib/to-birth-input";
import type { ProfileRow } from "@/lib/profiles/store";

/**
 * 프로필 → 상담사가 읽을 [사실] 블록.
 *
 * 리포트의 chart 섹션이 쓰는 것과 같은 블록이다 — 상담사가 리포트와 같은 근거
 * 위에서 말하게 하려는 것이고, 그래서 이름·생년월일 같은 개인정보는 여기 없다.
 *
 * 던지지 않는다. 만세력 범위 밖이거나 존재하지 않는 음력 조합이면 null 이다 —
 * characterOfBirth 와 같은 이유로, 상담 하나 때문에 화면이 500 이 되면 안 된다.
 */
export function factsForProfile(profile: ProfileRow): string | null {
  try {
    return chartFacts(analyze(toBirthInput(profile)));
  } catch (e) {
    console.error("[consult] facts", e instanceof Error ? e.message : e);
    return null;
  }
}
```

`src/lib/consultations/deps.ts`:

```ts
import { createDeepSeekChatTransport } from "./chat-transport";
import { CONSULT_MODEL } from "./model";
import { stubTicketPort } from "./ticket-port";
import {
  appendMessage,
  commitTurn,
  createConsultation,
  getConsultation,
  listMessages,
} from "./store";
import type { ServiceDeps } from "./service";

// 첫 요청에서 만든다. 모듈 로드 시점에 만들면 키가 없는 빌드 환경에서 빌드가 깨진다.
let cached: ServiceDeps | undefined;

export function consultationDeps(): ServiceDeps {
  if (cached) return cached;

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  cached = {
    store: { createConsultation, getConsultation, listMessages, appendMessage, commitTurn },
    // 이용권 배선 전이다. spend 가 던지므로 상담 개설은 아직 실패한다 —
    // 의도된 상태다 (ticket-port.ts 주석 참고).
    tickets: stubTicketPort,
    transport: createDeepSeekChatTransport({ apiKey }),
    model: CONSULT_MODEL,
  };
  return cached;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- src/lib/consultations/facts.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Next.js Route Handler 가이드를 읽는다**

Run: `ls node_modules/next/dist/docs/`
그 중 route handler / dynamic segment 관련 문서를 읽고, 동적 세그먼트 `params` 의 타입(Promise 여부)을 확인한다. 아래 코드는 `params: Promise<{ id: string }>` 를 가정한다 — 가이드와 다르면 가이드를 따른다.

- [ ] **Step 6: 라우트를 구현한다**

`src/app/api/consultations/route.ts`:

```ts
import { getSession } from "@/lib/auth/session";
import { getProfile, listProfiles } from "@/lib/profiles/store";
import { parseProfileParam } from "@/lib/profiles/param";
import { utteranceSchema } from "@/lib/consultations/input";
import { factsForProfile } from "@/lib/consultations/facts";
import { consultationDeps } from "@/lib/consultations/deps";
import { openConsultation } from "@/lib/consultations/service";
import { listConsultations } from "@/lib/consultations/store";
import { InsufficientTicketsError } from "@/lib/consultations/ticket-port";

/** 첫 턴이 LLM 한 번이라 리포트만큼 오래 걸리지는 않지만, pro 모델이라 여유를 둔다 */
export const maxDuration = 60;

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const rows = await listConsultations(session.userId);
  return Response.json({ consultations: rows });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const body = utteranceSchema.safeParse(raw);
  if (!body.success) {
    return Response.json({ error: "질문을 1자 이상 1000자 이하로 입력해 주세요" }, { status: 400 });
  }

  // ?profile 은 홈 카드가 넘기는 값이다. 없거나 남의 것이면 그 계정의 첫 프로필로
  // 물러선다 — 상담을 못 여는 것보다 낫고, getProfile 이 user_id 로 함께 걸러
  // 남의 프로필은 애초에 잡히지 않는다.
  const param = parseProfileParam(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const profile =
    param.kind === "id"
      ? ((await getProfile(session.userId, param.id)) ?? (await listProfiles(session.userId))[0])
      : (await listProfiles(session.userId))[0];

  if (!profile) {
    return Response.json({ error: "먼저 사주 정보를 입력해 주세요" }, { status: 409 });
  }

  const facts = factsForProfile(profile);
  if (!facts) {
    return Response.json({ error: "이 생년월일로는 상담을 열 수 없어요" }, { status: 422 });
  }

  try {
    const result = await openConsultation(
      {
        userId: session.userId,
        profileId: profile.id,
        facts,
        utterance: body.data.text,
      },
      consultationDeps(),
    );
    return Response.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof InsufficientTicketsError) {
      return Response.json({ error: "이용권이 부족해요" }, { status: 402 });
    }
    console.error("[POST /api/consultations]", e);
    return Response.json({ error: "상담을 시작하지 못했어요" }, { status: 500 });
  }
}
```

`src/app/api/consultations/[id]/messages/route.ts`:

```ts
import { getSession } from "@/lib/auth/session";
import { getProfile, listProfiles } from "@/lib/profiles/store";
import { utteranceSchema } from "@/lib/consultations/input";
import { factsForProfile } from "@/lib/consultations/facts";
import { consultationDeps } from "@/lib/consultations/deps";
import { advanceConsultation, ConsultationClosedError } from "@/lib/consultations/service";
import { getConsultation } from "@/lib/consultations/store";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "로그인이 필요합니다" }, { status: 401 });

  const { id } = await params;
  // URL 문자열을 그대로 ::bigint 로 캐스팅하면 DB 에러 → 500 이다. 형식을 먼저 본다.
  if (!/^[1-9]\d*$/.test(id)) {
    return Response.json({ error: "상담을 찾을 수 없어요" }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const body = utteranceSchema.safeParse(raw);
  if (!body.success) {
    return Response.json({ error: "질문을 1자 이상 1000자 이하로 입력해 주세요" }, { status: 400 });
  }

  const consultation = await getConsultation(session.userId, id);
  if (!consultation) return Response.json({ error: "상담을 찾을 수 없어요" }, { status: 404 });

  // 프로필이 지워졌으면 그 계정의 첫 프로필로 이어간다. 남은 이력은 살아 있고,
  // 근거만 현재 프로필에서 다시 세운다.
  const profile =
    (consultation.profileId
      ? await getProfile(session.userId, consultation.profileId)
      : null) ?? (await listProfiles(session.userId))[0];

  if (!profile) {
    return Response.json({ error: "먼저 사주 정보를 입력해 주세요" }, { status: 409 });
  }

  const facts = factsForProfile(profile);
  if (!facts) {
    return Response.json({ error: "이 생년월일로는 상담을 이어갈 수 없어요" }, { status: 422 });
  }

  try {
    const result = await advanceConsultation(
      { userId: session.userId, id, facts, utterance: body.data.text },
      consultationDeps(),
    );
    if (!result) return Response.json({ error: "상담을 찾을 수 없어요" }, { status: 404 });
    return Response.json(result);
  } catch (e) {
    if (e instanceof ConsultationClosedError) {
      return Response.json({ error: "이 상담은 이미 마무리됐어요" }, { status: 409 });
    }
    console.error("[POST /api/consultations/:id/messages]", e);
    return Response.json({ error: "답변을 받지 못했어요" }, { status: 500 });
  }
}
```

- [ ] **Step 7: `.env.example` 에 키를 적는다**

`.env.example` 에 DeepSeek 키 항목이 없으면 아래를 파일 끝에 추가한다 (이미 있으면 건너뛴다):

```
# --- LLM (DeepSeek) ---
DEEPSEEK_API_KEY=            # 리포트 생성과 고민상담이 같은 키를 쓴다
```

- [ ] **Step 8: 타입체크와 전체 테스트**

Run: `npm run typecheck && npm test`
Expected: 전부 통과

- [ ] **Step 9: 커밋한다**

```bash
git add src/lib/consultations/facts.ts src/lib/consultations/facts.test.ts src/lib/consultations/deps.ts src/app/api/consultations .env.example && git commit -m "feat(consult): 상담 개설·진행 API 를 연다"
```

---

### Task 11: 대화방 화면

**Files:**
- Create: `src/app/consult/[id]/page.tsx`
- Create: `src/app/consult/_components/ChatRoom.tsx`
- Create: `src/app/consult/_components/Bubble.tsx`
- Create: `src/app/consult/_components/TypingDots.tsx`
- Create: `src/app/consult/_components/Composer.tsx`
- Create: `src/app/consult/_lib/to-chat-view.ts`
- Test: `src/app/consult/_lib/to-chat-view.test.ts`

**Interfaces:**
- Consumes: `getSession`, `getConsultation`, `listMessages`, `MessageRow`, `MAX_UTTERANCE_CHARS`
- Produces: `ChatTurn`, `toChatView(messages)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/consult/_lib/to-chat-view.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toChatView } from "./to-chat-view";
import type { MessageRow } from "@/lib/consultations/store";

function msg(over: Partial<MessageRow>): MessageRow {
  return {
    id: "1",
    role: "user",
    bubbles: ["안녕하세요"],
    suggestions: null,
    crisis: false,
    turnNo: 1,
    createdAt: "2026-08-17T00:00:00.000Z",
    ...over,
  };
}

describe("toChatView", () => {
  it("저장된 순서 그대로 말풍선을 편다", () => {
    const view = toChatView([
      msg({ role: "user", bubbles: ["고민이 있어요"] }),
      msg({ id: "2", role: "counselor", bubbles: ["첫 마디", "둘째 마디"] }),
    ]);
    expect(view).toHaveLength(2);
    expect(view[0]).toEqual({ key: "1", role: "user", bubbles: ["고민이 있어요"] });
    expect(view[1].bubbles).toEqual(["첫 마디", "둘째 마디"]);
  });

  it("마지막 상담사 답의 추천질문만 살린다 — 지난 턴의 칩이 되살아나면 안 된다", () => {
    const view = toChatView([
      msg({ id: "1", role: "counselor", bubbles: ["옛날 답"], suggestions: ["옛 질문"] }),
      msg({ id: "2", role: "user", bubbles: ["네"] }),
      msg({ id: "3", role: "counselor", bubbles: ["최근 답"], suggestions: ["새 질문"] }),
    ]);
    expect(view[0].suggestions).toBeUndefined();
    expect(view[2].suggestions).toEqual(["새 질문"]);
  });

  it("마지막 답에 추천질문이 없으면(마지막 턴) 비운다", () => {
    const view = toChatView([msg({ id: "1", role: "counselor", bubbles: ["끝"], suggestions: [] })]);
    expect(view[0].suggestions).toBeUndefined();
  });

  it("빈 이력은 빈 배열이다", () => {
    expect(toChatView([])).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/app/consult/_lib/to-chat-view.test.ts`
Expected: FAIL — `Failed to resolve import "./to-chat-view"`

- [ ] **Step 3: 뷰 변환을 구현한다**

`src/app/consult/_lib/to-chat-view.ts`:

```ts
import type { MessageRow } from "@/lib/consultations/store";

/** 화면에 그릴 한 발화. 저장 모양과 그리는 모양을 가르는 자리다 */
export interface ChatTurn {
  key: string;
  role: "user" | "counselor";
  bubbles: string[];
  /** 마지막 상담사 답에만 있다 */
  suggestions?: string[];
}

/**
 * 추천질문은 마지막 상담사 답의 것만 살린다. 지난 턴의 칩을 그대로 두면
 * 이미 흘러간 질문이 화면 아래에 되살아나 지금 대화와 어긋난다.
 */
export function toChatView(messages: MessageRow[]): ChatTurn[] {
  let lastCounselor = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "counselor") {
      lastCounselor = i;
      break;
    }
  }

  return messages.map((m, i) => {
    const suggestions = i === lastCounselor ? (m.suggestions ?? []) : [];
    return {
      key: m.id,
      role: m.role,
      bubbles: m.bubbles,
      ...(suggestions.length > 0 ? { suggestions } : {}),
    };
  });
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- src/app/consult/_lib/to-chat-view.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: 표시 컴포넌트를 만든다**

`src/app/consult/_components/Bubble.tsx`:

```tsx
interface Props {
  role: "user" | "counselor";
  text: string;
  /** 순차 노출 지연(ms). 상담사 말풍선에만 준다 */
  delay?: number;
}

export function Bubble({ role, text, delay = 0 }: Props) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[78%] rounded-[18px] px-[14px] py-2.5 text-[14.5px] leading-[1.55] [text-wrap:pretty] ${
          mine ? "bg-accent text-white" : "bg-slate-100 text-slate-800"
        }`}
        style={delay > 0 ? { animation: `pv-bubble-in 220ms ease-out ${delay}ms both` } : undefined}
      >
        {text}
      </p>
    </div>
  );
}
```

`src/app/consult/_components/TypingDots.tsx`:

```tsx
/**
 * 답을 기다리는 동안의 점 세 개. pro 모델이라 첫 말풍선까지 5~10초 걸리는데,
 * 이게 없으면 화면이 죽은 것처럼 보인다.
 */
export function TypingDots() {
  return (
    <div className="flex justify-start" role="status" aria-label="상담사가 답을 쓰고 있어요">
      <span className="flex items-center gap-1 rounded-[18px] bg-slate-100 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[6px] w-[6px] rounded-full bg-slate-400"
            style={{ animation: `pv-dot 1.2s ease-in-out ${i * 160}ms infinite` }}
          />
        ))}
      </span>
    </div>
  );
}
```

`src/app/globals.css` (또는 이 저장소의 전역 스타일 파일 — `src/app` 아래에서 `@import "tailwindcss"` 가 있는 파일을 찾는다) 끝에 키프레임 두 개를 추가한다:

```css
@keyframes pv-bubble-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: none; }
}

@keyframes pv-dot {
  0%, 60%, 100% { opacity: 0.3; }
  30%           { opacity: 1; }
}
```

- [ ] **Step 6: 입력창을 만든다**

`src/app/consult/_components/Composer.tsx`:

```tsx
"use client";

import { useState } from "react";
import { MAX_UTTERANCE_CHARS } from "@/lib/consultations/input";

interface Props {
  disabled: boolean;
  onSend: (text: string) => void;
}

export function Composer({ disabled, onSend }: Props) {
  const [text, setText] = useState("");
  const trimmed = text.trim();

  function send() {
    if (disabled || trimmed.length === 0) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="flex items-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Shift+Enter 는 줄바꿈. 고민을 여러 줄로 쓰는 사람이 많다.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        // 서버의 zod 검증이 실제 방어선이다. 이건 편의일 뿐이다.
        maxLength={MAX_UTTERANCE_CHARS}
        rows={1}
        disabled={disabled}
        placeholder="질문을 입력하세요"
        aria-label="질문 입력"
        className="max-h-32 flex-1 resize-none rounded-[20px] bg-slate-100 px-4 py-2.5 text-[14.5px] outline-none placeholder:text-slate-400 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={send}
        disabled={disabled || trimmed.length === 0}
        aria-label="보내기"
        className="h-10 w-10 flex-none rounded-full bg-accent text-white transition-opacity disabled:opacity-30"
      >
        ↑
      </button>
    </div>
  );
}
```

- [ ] **Step 7: 대화방을 만든다**

`src/app/consult/_components/ChatRoom.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bubble } from "./Bubble";
import { TypingDots } from "./TypingDots";
import { Composer } from "./Composer";
import type { ChatTurn } from "../_lib/to-chat-view";

/** 상담사 말풍선을 하나씩 띄우는 간격. 사람이 연달아 말하는 리듬을 만든다 */
const BUBBLE_STAGGER_MS = 400;

interface Props {
  consultationId: string;
  initialTurns: ChatTurn[];
  initialRemaining: number;
  initialClosed: boolean;
}

export function ChatRoom({
  consultationId,
  initialTurns,
  initialRemaining,
  initialClosed,
}: Props) {
  const [turns, setTurns] = useState(initialTurns);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [closed, setClosed] = useState(initialClosed);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, pending]);

  const last = turns[turns.length - 1];
  const suggestions = !pending && !closed ? (last?.suggestions ?? []) : [];

  async function send(text: string) {
    setError(null);
    setPending(true);
    // 낙관적으로 내 말풍선을 먼저 붙인다. 실패하면 되돌린다.
    const optimistic: ChatTurn = { key: `pending-${turns.length}`, role: "user", bubbles: [text] };
    setTurns((prev) => [...stripSuggestions(prev), optimistic]);

    try {
      const res = await fetch(`/api/consultations/${consultationId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();

      if (!res.ok) {
        setTurns((prev) => prev.filter((t) => t.key !== optimistic.key));
        setError(typeof json.error === "string" ? json.error : "답변을 받지 못했어요");
        if (res.status === 409) setClosed(true);
        return;
      }

      setTurns((prev) => [
        ...prev,
        {
          key: `counselor-${prev.length}`,
          role: "counselor",
          bubbles: json.reply.bubbles,
          ...(json.reply.suggestions?.length ? { suggestions: json.reply.suggestions } : {}),
        },
      ]);
      setRemaining(json.consultation.turnLimit - json.consultation.turnsUsed);
      setClosed(json.consultation.status === "closed");
    } catch {
      setTurns((prev) => prev.filter((t) => t.key !== optimistic.key));
      setError("연결이 끊겼어요. 다시 시도해 주세요");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[560px] flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <Link href="/consult" aria-label="상담 목록으로" className="text-slate-400">
          ←
        </Link>
        <span className="flex-1 text-[15px] font-bold tracking-[-0.02em]">상담사</span>
        <span className="text-[12.5px] font-bold text-slate-400">
          {closed ? "마무리됨" : `남은 대화 ${remaining}회`}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4">
        {turns.map((t) =>
          t.bubbles.map((text, i) => (
            <Bubble
              key={`${t.key}-${i}`}
              role={t.role}
              text={text}
              // 저장된 이력은 즉시, 방금 온 답만 순차로 띄운다.
              delay={t.role === "counselor" && t.key.startsWith("counselor-") ? i * BUBBLE_STAGGER_MS : 0}
            />
          )),
        )}
        {pending && <TypingDots />}
        {error && (
          <p role="alert" className="px-1 text-[13px] text-amber-700">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {suggestions.length > 0 && (
        <div className="flex gap-2 px-4 pb-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="flex-1 rounded-[14px] border border-slate-200 px-3 py-2 text-left text-[13px] leading-[1.4] text-slate-600"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {closed ? (
        <div className="border-t border-slate-200 px-4 py-5 text-center">
          <p className="mb-3 text-[13.5px] text-gray-500">상담이 마무리됐어요.</p>
          <Link
            href="/consult"
            className="inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white"
          >
            새 상담 시작하기
          </Link>
        </div>
      ) : (
        <Composer disabled={pending} onSend={send} />
      )}
    </div>
  );
}

/** 새 발화를 보내는 순간 지난 추천질문은 사라져야 한다 */
function stripSuggestions(turns: ChatTurn[]): ChatTurn[] {
  return turns.map(({ suggestions, ...rest }) => rest);
}
```

- [ ] **Step 8: 페이지를 만든다**

`src/app/consult/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getConsultation, listMessages } from "@/lib/consultations/store";
import { toChatView } from "../_lib/to-chat-view";
import { ChatRoom } from "../_components/ChatRoom";

export const metadata: Metadata = {
  title: "고민상담 · 프로젝트 사주",
};

export default async function ConsultRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=/consult/${id}`);

  // URL 문자열을 그대로 ::bigint 로 캐스팅하면 DB 에러 → 500 이다.
  if (!/^[1-9]\d*$/.test(id)) notFound();

  // getConsultation 이 user_id 로 함께 거르므로, 없는 상담과 남의 상담을
  // 구분하지 않고 둘 다 notFound 다.
  const consultation = await getConsultation(session.userId, id);
  if (!consultation) notFound();

  const messages = await listMessages(consultation.id);

  return (
    <ChatRoom
      consultationId={consultation.id}
      initialTurns={toChatView(messages)}
      initialRemaining={consultation.turnLimit - consultation.turnsUsed}
      initialClosed={consultation.status === "closed"}
    />
  );
}
```

- [ ] **Step 9: 타입체크와 전체 테스트**

Run: `npm run typecheck && npm test`
Expected: 전부 통과

- [ ] **Step 10: 커밋한다**

```bash
git add src/app/consult && git commit -m "feat(consult): 대화방 화면을 만든다"
```

주의: 전역 CSS 파일도 수정했다면 그 경로를 `git add` 에 함께 넣는다.

---

### Task 12: 상담 목록 화면

**Files:**
- Create: `src/app/consult/page.tsx`
- Create: `src/app/consult/_components/ConsultationList.tsx`
- Create: `src/app/consult/_components/StartConsultation.tsx`
- Create: `src/app/consult/_lib/to-list-entry.ts`
- Test: `src/app/consult/_lib/to-list-entry.test.ts`

**Interfaces:**
- Consumes: `ConsultationListItem` from `@/lib/consultations/store`
- Produces: `ConsultationEntry`, `toListEntry(row, now)`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/consult/_lib/to-list-entry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toListEntry } from "./to-list-entry";
import type { ConsultationListItem } from "@/lib/consultations/store";

const now = new Date("2026-08-17T12:00:00.000Z");

function row(over: Partial<ConsultationListItem> = {}): ConsultationListItem {
  return {
    id: "7",
    userId: "3",
    profileId: "12",
    status: "open",
    turnsUsed: 3,
    turnLimit: 10,
    title: "직장에서의 답답함",
    createdAt: "2026-08-17T02:00:00.000Z",
    closedAt: null,
    lastBubble: "지금 자리에서 답답한 게…",
    ...over,
  };
}

describe("toListEntry", () => {
  it("진행 중이면 몇 번 썼는지 보여준다", () => {
    expect(toListEntry(row(), now).progress).toBe("3/10");
  });

  it("끝난 상담은 완료로 표시한다", () => {
    expect(toListEntry(row({ status: "closed", turnsUsed: 10 }), now).progress).toBe("완료");
  });

  it("제목도 말풍선도 없으면 재개할 수 있는 상담임을 알린다 — 무제로 두면 빈 줄로 보인다", () => {
    const e = toListEntry(row({ title: null, lastBubble: null }), now);
    expect(e.title).toBe("아직 시작하지 않은 상담");
  });

  it("오늘 만든 상담은 오늘로 적는다", () => {
    expect(toListEntry(row({ createdAt: "2026-08-17T02:00:00.000Z" }), now).when).toBe("오늘");
  });

  it("어제 만든 상담은 어제로 적는다", () => {
    expect(toListEntry(row({ createdAt: "2026-08-16T02:00:00.000Z" }), now).when).toBe("어제");
  });

  it("그보다 오래되면 날짜로 적는다", () => {
    expect(toListEntry(row({ createdAt: "2026-08-12T02:00:00.000Z" }), now).when).toBe("8월 12일");
  });

  it("말풍선이 없으면 미리보기를 비운다", () => {
    expect(toListEntry(row({ lastBubble: null }), now).preview).toBe("");
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npm test -- src/app/consult/_lib/to-list-entry.test.ts`
Expected: FAIL — `Failed to resolve import "./to-list-entry"`

- [ ] **Step 3: 구현한다**

`src/app/consult/_lib/to-list-entry.ts`:

```ts
import type { ConsultationListItem } from "@/lib/consultations/store";

export interface ConsultationEntry {
  id: string;
  title: string;
  preview: string;
  /** "3/10" 또는 "완료" */
  progress: string;
  /** "오늘" · "어제" · "8월 12일" */
  when: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** 자정 기준으로 며칠 전인지. 시각 차가 아니라 날짜 차를 센다 */
function daysAgo(then: Date, now: Date): number {
  const a = Date.UTC(then.getUTCFullYear(), then.getUTCMonth(), then.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((b - a) / DAY_MS);
}

/**
 * now 를 인자로 받는 이유: 안에서 new Date() 를 부르면 테스트가 시계에 묶인다.
 * 화면은 렌더 시점의 시각을 넘긴다.
 */
export function toListEntry(row: ConsultationListItem, now: Date): ConsultationEntry {
  const created = new Date(row.createdAt);
  const d = daysAgo(created, now);

  return {
    id: row.id,
    // 첫 턴이 실패한 상담은 제목도 말풍선도 없다. 무제로 두면 목록에서
    // 빈 줄처럼 보이므로 재개할 수 있는 상담임을 알아볼 문구를 준다.
    title: row.title ?? "아직 시작하지 않은 상담",
    preview: row.lastBubble ?? "",
    progress: row.status === "closed" ? "완료" : `${row.turnsUsed}/${row.turnLimit}`,
    when:
      d === 0
        ? "오늘"
        : d === 1
          ? "어제"
          : `${created.getUTCMonth() + 1}월 ${created.getUTCDate()}일`,
  };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- src/app/consult/_lib/to-list-entry.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 시작 화면을 만든다**

`src/app/consult/_components/StartConsultation.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAX_UTTERANCE_CHARS } from "@/lib/consultations/input";

interface Props {
  /** 홈에서 따라온 프로필. 없으면 계정의 첫 프로필로 연다 */
  profileId?: string;
}

export function StartConsultation({ profileId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    const trimmed = text.trim();
    if (trimmed.length === 0 || pending) return;
    setPending(true);
    setError(null);

    try {
      const query = profileId ? `?profile=${encodeURIComponent(profileId)}` : "";
      const res = await fetch(`/api/consultations${query}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "상담을 시작하지 못했어요");
        return;
      }
      router.push(`/consult/${json.consultation.id}`);
    } catch {
      setError("연결이 끊겼어요. 다시 시도해 주세요");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-[18px] border border-dashed border-slate-300 py-4 text-[14.5px] font-bold text-slate-500"
      >
        + 새 상담 시작하기
      </button>
    );
  }

  return (
    <div className="rounded-[18px] border border-slate-200 p-4">
      <p className="mb-3 text-[15px] font-bold tracking-[-0.02em]">무슨 고민이 있으세요?</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_UTTERANCE_CHARS}
        rows={4}
        autoFocus
        aria-label="고민 입력"
        placeholder="편하게 적어 주세요"
        className="w-full resize-none rounded-xl bg-slate-100 px-3.5 py-3 text-[14.5px] leading-[1.55] outline-none placeholder:text-slate-400"
      />
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-amber-700">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={start}
        disabled={pending || text.trim().length === 0}
        className="mt-3 w-full rounded-full bg-accent py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {pending ? "상담사를 부르고 있어요…" : "이용권 1장으로 시작하기"}
      </button>
    </div>
  );
}
```

- [ ] **Step 6: 목록 컴포넌트를 만든다**

`src/app/consult/_components/ConsultationList.tsx`:

```tsx
import Link from "next/link";
import type { ConsultationEntry } from "../_lib/to-list-entry";

export function ConsultationList({ entries }: { entries: ConsultationEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="py-14 text-center text-[14px] text-gray-500">아직 나눈 이야기가 없어요.</p>
    );
  }

  return (
    <ul className="mt-6 divide-y divide-slate-100">
      {entries.map((e) => (
        <li key={e.id}>
          <Link href={`/consult/${e.id}`} className="block py-4">
            <div className="flex items-baseline gap-3">
              <span className="flex-1 truncate text-[15px] font-bold tracking-[-0.02em]">
                {e.title}
              </span>
              <span className="flex-none text-[12.5px] font-bold text-slate-400">
                {e.progress}
              </span>
            </div>
            {e.preview && (
              <p className="mt-1 truncate text-[13.5px] text-gray-500">{e.preview}</p>
            )}
            <p className="mt-1 text-[12px] text-slate-400">{e.when}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 7: 페이지를 만든다**

`src/app/consult/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profiles/store";
import { parseProfileParam, type SearchParams } from "@/lib/profiles/param";
import { listConsultations } from "@/lib/consultations/store";
import { toListEntry } from "./_lib/to-list-entry";
import { ConsultationList } from "./_components/ConsultationList";
import { StartConsultation } from "./_components/StartConsultation";

export const metadata: Metadata = {
  title: "고민상담 · 프로젝트 사주",
};

export default async function ConsultPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  // 상담은 이용권을 쓰는 기능이라 로그인이 필요하다. 카드 자체는 잠그지 않고
  // 여기서 넘긴다 — 로그인 벽에서 흐름을 끊지 않는 피벗 정책과 같은 이유다.
  if (!session) redirect("/login?next=/consult");

  const profiles = await listProfiles(session.userId);
  if (profiles.length === 0) redirect("/funnel?step=name");

  const sp = await searchParams;
  const param = parseProfileParam(sp);
  const profileId = param.kind === "id" ? param.id : profiles[0].id;

  const rows = await listConsultations(session.userId);
  const now = new Date();

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[560px] px-5 py-6">
        {/* 헤더 우측의 "이용권 N장"은 getBalance 가 실제로 배선된 뒤에 켠다.
            스텁이 돌려주는 0 을 "0장"이라고 보여주면 거짓말이 된다. */}
        <h1 className="mb-5 text-[19px] font-bold tracking-[-0.03em]">고민상담</h1>
        <StartConsultation profileId={profileId} />
        <ConsultationList entries={rows.map((r) => toListEntry(r, now))} />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: 타입체크와 전체 테스트**

Run: `npm run typecheck && npm test`
Expected: 전부 통과

- [ ] **Step 9: 커밋한다**

```bash
git add src/app/consult && git commit -m "feat(consult): 상담 목록과 시작 화면을 만든다"
```

---

### Task 13: 홈 카드

**Files:**
- Modify: `src/app/home/_components/ExploreGrid.tsx`
- Modify: `src/app/home/_components/HomeIdentity.tsx:24` (상수 추가), `:225-228` (호출부)

**Interfaces:**
- Consumes: 기존 `ExploreGrid` 의 `CARD`/`EYEBROW`/`TITLE`/`DESC`/`CTA`/`ART` 상수와 `Dot` 컴포넌트
- Produces: 없음 (화면만 바뀐다)

- [ ] **Step 1: `ExploreGrid` 에 상담 카드를 넣는다**

`src/app/home/_components/ExploreGrid.tsx` 의 `Props` 에 필드를 하나 추가한다:

```ts
interface Props {
  /** 저장된 프로필이면 그 리포트로, 아직 계정이 없으면 드래프트 리포트(/report)로 */
  reportHref: string;
  /**
   * 상담 입구. 비로그인이어도 링크를 잠그지 않는다 — /consult 가 로그인으로
   * 넘긴다. 로그인 벽에서 흐름을 끊지 않는 피벗 정책과 같은 이유다.
   */
  consultHref: string;
}
```

그리고 리포트 카드 **바로 다음** 자리에 카드를 넣는다 (궁합은 "준비 중"이라 비활성인데, 유료 전환 동선을 비활성 카드 뒤에 두면 안 된다):

```tsx
<Link href={consultHref} className={CARD}>
  <div className={EYEBROW}>나에게 묻고 싶을 때</div>
  <div className={TITLE}>고민상담</div>
  <p className={DESC}>털어놓고 싶은 이야기, 사주를 아는 상대와 나눠보세요.</p>
  <span className={CTA}>상담 시작하기 →</span>
  <span aria-hidden className={ART}>
    <Dot size={7} style="bg-slate-300" />
    <Dot size={9} style="bg-slate-400" />
    <Dot size={11} style="bg-slate-900" />
  </span>
</Link>
```

- [ ] **Step 2: `HomeIdentity` 에서 `consultHref` 를 넘긴다**

`src/app/home/_components/HomeIdentity.tsx:24` 의 `DRAFT_REPORT_HREF` 바로 아래에 상수를 하나 더 둔다:

```ts
/** 아직 계정이 없는 사람의 상담 입구. /consult 가 로그인 → 퍼널 순으로 넘긴다 */
const DRAFT_CONSULT_HREF = "/consult";
```

그리고 `:225-228` 의 호출부를 이렇게 바꾼다:

```tsx
      <ExploreGrid
        reportHref={
          active.profileId ? `/report?profile=${active.profileId}` : DRAFT_REPORT_HREF
        }
        consultHref={
          active.profileId ? `/consult?profile=${active.profileId}` : DRAFT_CONSULT_HREF
        }
      />
```

- [ ] **Step 3: 타입체크와 전체 테스트**

Run: `npm run typecheck && npm test`
Expected: 전부 통과

- [ ] **Step 4: 홈을 실제로 띄워 확인한다**

`.claude/launch.json` 이 없으면 만든다:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 3000 }
  ]
}
```

`preview_start` 로 `dev` 를 띄우고 `/home` 을 연다. 확인할 것: 카드가 리포트 바로 다음에 있는지, 콘솔에 에러가 없는지, 클릭하면 `/consult` 로 가는지. 모바일 폭(375)에서도 카드가 깨지지 않는지 `resize_window` 로 본다.

- [ ] **Step 5: 커밋한다**

```bash
git add src/app/home .claude/launch.json && git commit -m "feat(consult): 홈에 고민상담 카드를 넣는다"
```

---

## 배선이 남은 것

이 계획을 다 끝내도 **상담은 아직 열리지 않는다.** `stubTicketPort.spend` 가 던지기 때문이고, 이는 의도된 상태다 (배선 전에 상담이 공짜로 열리면 안 된다).

이용권 시스템 작업이 끝나면 할 일은 두 가지다.

1. `src/lib/consultations/deps.ts` 의 `tickets: stubTicketPort` 를 실구현으로 바꾼다.
2. `src/app/consult/page.tsx` 의 주석 자리에 `getBalance` 로 잔액 배지를 켠다.

그 전에 확인할 것: **DeepSeek V4 실단가**. 설계 §5 의 비용 계산은 입력 $0.28/M(캐시 미스)·출력 $0.42/M 을 가정한 값이고 가격표를 직접 본 값이 아니다. 첫 실제 상담 후 `consultations.tokens_in / tokens_out` 을 읽어 가정과 맞는지 본다.
