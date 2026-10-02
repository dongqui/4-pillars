# 고객 문의 메뉴 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 헤더 ⋯ 메뉴에 오류 문의·피드백·환불 요청을 추가하고, 문의를 `support_tickets` 에 저장한 뒤 Resend 로 운영 메일에 알린다. 어드민의 토대(`users.role`, `requireAdmin`)를 깐다.

**Architecture:** 순수 타입·포맷은 `src/lib/support/types.ts`(클라이언트도 import), DB 는 `store.ts`, 메일은 `mail.ts`(조립)·`mailer.ts`(Resend). API 는 기존 컨벤션대로 얇은 `route.ts` + 의존성을 주입받는 `_lib/handler.ts`. UI 는 `src/components/support/SupportDialog.tsx` 하나를 `AppMenu` 가 띄운다.

**Tech Stack:** Next 16.2 (App Router), React 19.2, Tailwind 4, zod 4, Neon HTTP (`SqlClient` 태그드 템플릿), Upstash Redis, Resend, vitest 4 (node 환경).

**Spec:** `docs/superpowers/specs/2026-10-02-support-menu-design.md`

## Global Constraints

- 메뉴는 **추가만** 한다 — `AppMenu` 의 이름 줄·로그아웃은 그대로 둔다. 세 항목은 로그인(`displayName !== null`)일 때만.
- 받는 주소: `SUPPORT_MAIL_TO=projectn.contact@gmail.com`. 키 이름: `RESEND_API_KEY`, `SUPPORT_MAIL_FROM`, `SUPPORT_MAIL_TO`. **실제 키 값은 어떤 파일에도 쓰지 않는다.**
- 키가 비면 메일만 건너뛴다(경고 로그). 문의 저장·201 응답은 그대로.
- 메일 실패는 응답을 바꾸지 않는다 — 저장이 먼저, 메일은 그다음 best-effort.
- `provider='admin'` 은 권한이 아니다. 어드민 판정은 오직 `users.role = 'admin'`.
- 마이그레이션 파일 하나 = SQL 문장 하나 (Neon HTTP 드라이버 제약). 번호는 0050~0054.
- 오류 메시지는 한국어, 500 은 `{ error: "서버 오류가 발생했습니다" }`.
- 모달 문구는 시안 그대로(스펙 §2 표).
- bigint id 는 문자열로 다루고 `${id}::bigint` 로 바인딩.
- 테스트: `npx vitest run <path>`. 전체 확인: `npm test`, `npm run typecheck`, `npm run lint`.

## Review Focus

1. **남의 항목 id 를 보내는 요청** — 다른 사용자의 `purchaseId`·`target.ref` 는 404 여야 하고 DB 에 아무것도 남지 않아야 한다. → Task 4 handler 테스트.
2. **환불 버튼 연타·동시 요청** — 같은 결제 건에 열린 환불 요청이 두 개 생기면 안 된다. 앱 검사(`requested`)와 DB 부분 유니크 인덱스 양쪽. INSERT 가 충돌로 null 을 돌려주면 409. → Task 2 store 테스트, Task 4 handler 테스트.
3. **공백만 입력한 본문** — `"   "` 은 빈 본문으로 취급돼 error·feedback 에서 400 이어야 한다(클라이언트 `canSubmit` 도 같은 판단). → Task 1 `canSubmit` 테스트, Task 4 handler 테스트.
4. **지워진 프로필·상담에 걸린 이용권** — 조인 대상이 사라져도 목록이 깨지지 않고 "삭제된 항목" 으로 나와야 한다. → Task 2 `toServiceOption` 테스트.
5. **이메일 없는 계정(옛 가입자)** — `reply_email` 은 null, 메일에 replyTo 가 빠지고 본문에 "(없음)" 이 적혀야 한다. → Task 3 `composeSupportMail` 테스트.

---

### Task 1: 마이그레이션 + 공용 타입·포맷

**Files:**
- Create: `migrations/0050_support_tickets.sql`
- Create: `migrations/0051_support_tickets_status_idx.sql`
- Create: `migrations/0052_support_tickets_user_idx.sql`
- Create: `migrations/0053_support_tickets_refund_open_unique.sql`
- Create: `migrations/0054_users_role.sql`
- Create: `src/lib/support/types.ts`
- Test: `src/lib/support/types.test.ts`

**Interfaces:**
- Produces (모두 `@/lib/support/types` 에서 export):
  - `SUPPORT_KINDS`, `type SupportKind = "error" | "feedback" | "refund"`
  - `TARGET_KINDS`, `type TargetKind`
  - `REFUND_REASONS`, `type RefundReason`
  - `BODY_MAX = 4000`
  - `interface ServiceTarget { kind: TargetKind; ref: string | null }`
  - `interface ServiceOption { target: ServiceTarget; title: string; sub: string; createdAt: string | null }`
  - `interface PurchaseOption { purchaseId: string; paymentId: string; title: string; sub: string; createdAt: string; requested: boolean }`
  - `type SupportOptions = { kind: "error"; items: ServiceOption[] } | { kind: "refund"; items: PurchaseOption[]; balance: number }`
  - `OTHER_OPTION: ServiceOption`
  - `serviceKey(t: ServiceTarget): string`
  - `optionLabel(o: { title: string; sub: string }): string`
  - `formatOptionDate(iso: string | null, now: Date): string`
  - `canSubmit(kind: SupportKind, s: { pick: string | null; reason: RefundReason | null; text: string }): boolean`

- [ ] **Step 1: 마이그레이션 다섯 개를 쓴다**

`migrations/0050_support_tickets.sql`:

```sql
-- migrations/0050_support_tickets.sql
-- 헤더 ⋯ 메뉴의 오류 문의 · 피드백 · 환불 요청. 메일 알림과 별개로 여기 남는 것이 원본이다 —
-- 메일은 놓칠 수 있고, 어드민 받은편지함은 이 테이블을 읽는다.
--
-- target_label 을 박제하는 이유: 프로필·상담이 나중에 지워지거나 이름이 바뀌어도
-- "그때 무엇에 대해 문의했나" 는 바뀌면 안 된다.
-- reply_email 도 같은 이유로 보낸 시점의 users.email 을 복사한다.
--
-- refund_reason 에 CHECK 를 걸지 않는다: 사유 문구는 카피라 바뀔 수 있다.
-- 검증은 src/lib/support/types.ts 의 REFUND_REASONS(zod enum) 가 한다.
--
-- purchase_id 가 CASCADE 인 이유: 아래 refund CHECK 가 purchase_id 를 요구한다.
-- SET NULL 이면 결제 행이 지워질 때 그 CHECK 에 걸려 삭제 자체가 실패한다.
-- 결제 행은 사용자째 지워질 때만 사라지므로 잃는 것이 없다.
CREATE TABLE IF NOT EXISTS support_tickets (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('error', 'feedback', 'refund')),
  target_kind   text CHECK (target_kind IN ('full_report', 'compatibility', 'consultation', 'yearly_flow', 'map', 'other')),
  target_ref    text,
  target_label  text,
  purchase_id   bigint REFERENCES purchases(id) ON DELETE CASCADE,
  refund_reason text,
  body          text NOT NULL DEFAULT '',
  reply_email   text,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  admin_note    text,
  resolved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_tickets_error_target CHECK (kind <> 'error' OR target_kind IS NOT NULL),
  CONSTRAINT support_tickets_refund_purchase CHECK (kind <> 'refund' OR (purchase_id IS NOT NULL AND refund_reason IS NOT NULL))
)
```

`migrations/0051_support_tickets_status_idx.sql`:

```sql
-- migrations/0051_support_tickets_status_idx.sql
-- 어드민 받은편지함: "열린 것부터, 최신순".
CREATE INDEX IF NOT EXISTS support_tickets_status_created_idx
  ON support_tickets (status, created_at DESC)
```

`migrations/0052_support_tickets_user_idx.sql`:

```sql
-- migrations/0052_support_tickets_user_idx.sql
-- 사용자별 조회(어드민 상세의 "이 사람의 다른 문의") 와 user 삭제 CASCADE 용.
CREATE INDEX IF NOT EXISTS support_tickets_user_idx
  ON support_tickets (user_id, created_at DESC)
```

`migrations/0053_support_tickets_refund_open_unique.sql`:

```sql
-- migrations/0053_support_tickets_refund_open_unique.sql
-- 한 결제 건에 열린 환불 요청은 하나뿐이다.
--
-- ⚠️ 앱도 같은 검사를 하지만(목록의 "요청됨") Neon HTTP 에는 트랜잭션이 없어
-- 연타·동시 요청 두 개가 그 검사를 함께 통과할 수 있다. 이 인덱스가 최후 방어선이다 —
-- INSERT ... ON CONFLICT DO NOTHING 이 여기서 접히고, 앱은 그걸 409 로 돌려준다.
-- 처리가 끝나 status 가 'resolved' 가 되면 같은 결제 건으로 다시 요청할 수 있다.
CREATE UNIQUE INDEX IF NOT EXISTS support_tickets_refund_open_unique
  ON support_tickets (purchase_id)
  WHERE kind = 'refund' AND status = 'open'
```

`migrations/0054_users_role.sql`:

```sql
-- migrations/0054_users_role.sql
-- 관리자 권한. 어드민 화면은 이 컬럼만 본다(src/lib/auth/admin.ts).
--
-- ⚠️ users.provider = 'admin'(0049) 과 무관하다. 그건 PG 심사용 임시 로그인의 "로그인 방식" 이고
-- 비밀번호가 카드사 담당자들에게 공유된다. 그 계정이 관리자가 되면 안 된다.
--
-- 관리자 지정은 운영 DB 에서 손으로 한다:
--   UPDATE users SET role = 'admin' WHERE id = <내 id>;
-- 기본값이 있는 컬럼 추가라 개발 DB 를 같이 쓰는 다른 브랜치의 코드는 그대로 돈다.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'))
```

- [ ] **Step 2: 실패하는 테스트를 쓴다** — `src/lib/support/types.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { canSubmit, formatOptionDate, optionLabel, serviceKey } from "./types";

describe("formatOptionDate", () => {
  // 2026-10-02 10:00 KST
  const now = new Date("2026-10-02T01:00:00Z");

  it("같은 KST 날짜면 오늘", () => {
    expect(formatOptionDate("2026-10-01T15:30:00Z", now)).toBe("오늘"); // 10-02 00:30 KST
  });

  it("KST 로 하루 전이면 어제 — UTC 로는 같은 날이어도", () => {
    expect(formatOptionDate("2026-10-01T14:59:00Z", now)).toBe("어제"); // 10-01 23:59 KST
  });

  it("그보다 전이면 M월 D일", () => {
    expect(formatOptionDate("2026-09-24T03:00:00Z", now)).toBe("9월 24일");
  });

  it("날짜가 없으면 빈 문자열 — '기타' 줄", () => {
    expect(formatOptionDate(null, now)).toBe("");
  });
});

describe("canSubmit", () => {
  const empty = { pick: null, reason: null, text: "" };

  it("오류 문의는 항목과 설명이 둘 다 있어야 한다", () => {
    expect(canSubmit("error", { ...empty, pick: "map:3" })).toBe(false);
    expect(canSubmit("error", { ...empty, text: "안 열려요" })).toBe(false);
    expect(canSubmit("error", { ...empty, pick: "map:3", text: "안 열려요" })).toBe(true);
  });

  it("공백만 있는 설명은 빈 설명이다", () => {
    expect(canSubmit("error", { ...empty, pick: "map:3", text: "  \n " })).toBe(false);
    expect(canSubmit("feedback", { ...empty, text: "   " })).toBe(false);
  });

  it("피드백은 내용만 있으면 된다", () => {
    expect(canSubmit("feedback", { ...empty, text: "좋아요" })).toBe(true);
  });

  it("환불은 결제 건과 사유가 있어야 하고 설명은 선택이다", () => {
    expect(canSubmit("refund", { ...empty, pick: "9" })).toBe(false);
    expect(canSubmit("refund", { ...empty, reason: "기타" })).toBe(false);
    expect(canSubmit("refund", { ...empty, pick: "9", reason: "기타" })).toBe(true);
  });
});

describe("serviceKey / optionLabel", () => {
  it("ref 가 없는 '기타' 도 고유한 키를 갖는다", () => {
    expect(serviceKey({ kind: "other", ref: null })).toBe("other:");
    expect(serviceKey({ kind: "map", ref: "3" })).toBe("map:3");
  });

  it("라벨은 제목 · 부제", () => {
    expect(optionLabel({ title: "궁합", sub: "동진 × 민수" })).toBe("궁합 · 동진 × 민수");
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx vitest run src/lib/support/types.test.ts`
Expected: FAIL — `Failed to resolve import "./types"`

- [ ] **Step 4: 구현한다** — `src/lib/support/types.ts`

```ts
/**
 * 고객 문의(오류 · 피드백 · 환불) 의 공용 타입과 순수 함수.
 *
 * 클라이언트(SupportDialog)와 서버(store · handler)가 같이 import 한다 — 그래서 여기에는
 * db·redis 처럼 서버에서만 도는 것을 들이지 않는다.
 *
 * 배열에서 타입을 파생시키는 이유는 TICKET_PACKAGE_IDS 와 같다: 배열과 유니온을 따로
 * 적으면 한쪽만 고쳐도 컴파일이 통과해 zod 검증과 타입이 조용히 어긋난다.
 */
export const SUPPORT_KINDS = ["error", "feedback", "refund"] as const;
export type SupportKind = (typeof SUPPORT_KINDS)[number];

/** support_tickets.target_kind 의 CHECK 와 같은 목록이다(0050). */
export const TARGET_KINDS = [
  "full_report",
  "compatibility",
  "consultation",
  "yearly_flow",
  "map",
  "other",
] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

/** 시안의 칩 문구 그대로. DB 에는 CHECK 가 없다 — 이 목록이 유일한 검증이다. */
export const REFUND_REASONS = [
  "실수로 결제했어요",
  "결과가 나오지 않아요",
  "내용이 기대와 달라요",
  "기타",
] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

export const BODY_MAX = 4000;

export interface ServiceTarget {
  kind: TargetKind;
  /** "기타" 만 null 이다. */
  ref: string | null;
}

/** 오류 문의의 "문제가 생긴 서비스" 한 줄. */
export interface ServiceOption {
  target: ServiceTarget;
  title: string;
  sub: string;
  /** ISO 문자열. "기타" 는 null. */
  createdAt: string | null;
}

/** 환불 요청의 "결제 내역" 한 줄. */
export interface PurchaseOption {
  purchaseId: string;
  paymentId: string;
  title: string;
  sub: string;
  createdAt: string;
  /** 이미 열린 환불 요청이 있다 — 고를 수 없다. */
  requested: boolean;
}

export type SupportOptions =
  | { kind: "error"; items: ServiceOption[] }
  | { kind: "refund"; items: PurchaseOption[]; balance: number };

export const OTHER_OPTION: ServiceOption = {
  target: { kind: "other", ref: null },
  title: "기타",
  sub: "목록에 없는 문제예요",
  createdAt: null,
};

export function serviceKey(t: ServiceTarget): string {
  return `${t.kind}:${t.ref ?? ""}`;
}

export function optionLabel(o: { title: string; sub: string }): string {
  return `${o.title} · ${o.sub}`;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** KST 기준 자정의 epoch ms. 사용자가 보는 "오늘" 은 서버 시간대가 아니라 한국 날짜다. */
function kstDay(d: Date): { start: number; month: number; date: number } {
  const k = new Date(d.getTime() + KST_OFFSET_MS);
  return {
    start: Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()),
    month: k.getUTCMonth() + 1,
    date: k.getUTCDate(),
  };
}

/** 목록 오른쪽 메타: 오늘 / 어제 / M월 D일. */
export function formatOptionDate(iso: string | null, now: Date): string {
  if (iso === null) return "";
  const a = kstDay(new Date(iso));
  const b = kstDay(now);
  const diff = Math.round((b.start - a.start) / DAY_MS);
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  return `${a.month}월 ${a.date}일`;
}

/**
 * 보내기 버튼 활성 조건 — 시안의 `ready` 그대로. 서버 검증(handler 의 zod)과 같은 판단이어야
 * 한다: 버튼은 켜졌는데 400 이 오면 사용자는 무엇이 틀렸는지 알 길이 없다.
 */
export function canSubmit(
  kind: SupportKind,
  s: { pick: string | null; reason: RefundReason | null; text: string },
): boolean {
  const hasText = s.text.trim().length > 0;
  if (kind === "error") return s.pick !== null && hasText;
  if (kind === "refund") return s.pick !== null && s.reason !== null;
  return hasText;
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/lib/support/types.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 6: 커밋**

```bash
git add migrations/0050_support_tickets.sql migrations/0051_support_tickets_status_idx.sql migrations/0052_support_tickets_user_idx.sql migrations/0053_support_tickets_refund_open_unique.sql migrations/0054_users_role.sql src/lib/support/types.ts src/lib/support/types.test.ts
git commit -m "feat(support): support_tickets·users.role 마이그레이션과 공용 타입"
```

---

### Task 2: 저장소 — 목록 조회와 INSERT

**Files:**
- Create: `src/lib/support/store.ts`
- Test: `src/lib/support/store.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `ServiceOption`, `PurchaseOption`, `OTHER_OPTION`, `SupportKind`, `TargetKind`, `RefundReason`. `@/lib/db` 의 `sql`, `SqlClient`. `@/lib/payments/pricing` 의 `TICKET_PACKAGE_IDS`, `getPackage`, `creditedTickets`.
- Produces:
  - `OPTION_LIMIT = 30`
  - `toServiceOption(r: Record<string, unknown>): ServiceOption | null`
  - `toPurchaseOption(r: Record<string, unknown>): PurchaseOption`
  - `listServiceOptions(userId: string, client?: SqlClient): Promise<ServiceOption[]>` — 맨 끝이 항상 `OTHER_OPTION`
  - `listPurchaseOptions(userId: string, client?: SqlClient): Promise<PurchaseOption[]>`
  - `interface NewSupportTicket { userId: string; kind: SupportKind; targetKind: TargetKind | null; targetRef: string | null; targetLabel: string | null; purchaseId: string | null; refundReason: RefundReason | null; body: string; replyEmail: string | null }`
  - `insertSupportTicket(t: NewSupportTicket, client?: SqlClient): Promise<{ id: string; createdAt: string } | null>` — 열린 환불 요청과 충돌하면 null

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `src/lib/support/store.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { SqlClient } from "@/lib/db";
import { OTHER_OPTION } from "./types";
import {
  OPTION_LIMIT,
  insertSupportTicket,
  listPurchaseOptions,
  listServiceOptions,
  toPurchaseOption,
  toServiceOption,
} from "./store";

function recorder(results: Record<string, unknown>[][]) {
  const queries: string[] = [];
  const params: unknown[][] = [];
  let i = 0;
  const client = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    queries.push(strings.join("?"));
    params.push(values);
    return Promise.resolve(results[i++] ?? []);
  }) as unknown as SqlClient;
  return { client, queries, params };
}

const T = "2026-10-01T03:00:00.000Z";

describe("toServiceOption", () => {
  it("리포트는 프로필 이름", () => {
    expect(
      toServiceOption({ feature: "full_report", subject_key: "12", created_at: T, profile_name: "엄마" }),
    ).toEqual({ target: { kind: "full_report", ref: "12" }, title: "리포트", sub: "엄마", createdAt: T });
  });

  it("궁합은 두 사람 이름", () => {
    const o = toServiceOption({
      feature: "compatibility", subject_key: "5", created_at: T,
      subject_name: "동진", counterpart_name: "민수",
    });
    expect(o?.title).toBe("궁합");
    expect(o?.sub).toBe("동진 × 민수");
  });

  it("상담은 제목, 제목이 없으면 '제목 없는 상담'", () => {
    expect(
      toServiceOption({ feature: "consultation", subject_key: "8", created_at: T, consult_id: 8, consult_title: "이직 고민" })?.sub,
    ).toBe("이직 고민");
    expect(
      toServiceOption({ feature: "consultation", subject_key: "8", created_at: T, consult_id: 8, consult_title: null })?.sub,
    ).toBe("제목 없는 상담");
  });

  it("한 해의 흐름은 연도를 제목에", () => {
    const o = toServiceOption({
      feature: "yearly_flow", subject_key: "3", created_at: T, flow_year: 2026, flow_profile_name: "동진",
    });
    expect(o?.title).toBe("2026 한 해의 흐름");
    expect(o?.sub).toBe("동진");
  });

  it("조인 대상이 지워졌으면 '삭제된 항목' — 목록을 깨지 않는다", () => {
    expect(toServiceOption({ feature: "full_report", subject_key: "12", created_at: T, profile_name: null })?.sub).toBe("삭제된 항목");
    expect(toServiceOption({ feature: "compatibility", subject_key: "5", created_at: T, subject_name: null, counterpart_name: null })?.sub).toBe("삭제된 항목");
    expect(toServiceOption({ feature: "consultation", subject_key: "8", created_at: T, consult_id: null, consult_title: null })?.sub).toBe("삭제된 항목");
    const flow = toServiceOption({ feature: "yearly_flow", subject_key: "3", created_at: T, flow_year: null, flow_profile_name: null });
    expect(flow?.title).toBe("한 해의 흐름");
    expect(flow?.sub).toBe("삭제된 항목");
  });

  it("모르는 feature 는 버린다", () => {
    expect(toServiceOption({ feature: "something_new", subject_key: "1", created_at: T })).toBeNull();
  });

  it("Date 로 온 created_at 도 ISO 문자열로 접는다", () => {
    const o = toServiceOption({ feature: "full_report", subject_key: "1", created_at: new Date(T), profile_name: "나" });
    expect(o?.createdAt).toBe(T);
  });
});

describe("listServiceOptions", () => {
  it("이용권 기록과 관계 지도를 최신순으로 섞고 '기타' 를 끝에 붙인다", async () => {
    const { client, params } = recorder([
      [
        { feature: "full_report", subject_key: "12", created_at: "2026-09-24T00:00:00.000Z", profile_name: "엄마" },
        { feature: "yearly_flow", subject_key: "3", created_at: "2026-10-02T00:00:00.000Z", flow_year: 2026, flow_profile_name: "동진" },
      ],
      [{ id: 4, center_name: "동진", created_at: "2026-09-28T00:00:00.000Z" }],
    ]);
    const list = await listServiceOptions("7", client);
    expect(list.map((o) => o.title)).toEqual(["2026 한 해의 흐름", "관계 지도", "리포트", "기타"]);
    expect(list[1].target).toEqual({ kind: "map", ref: "4" });
    expect(list.at(-1)).toEqual(OTHER_OPTION);
    expect(params[0]).toContain("7");
    expect(params[1]).toContain("7");
  });

  it("OPTION_LIMIT 개로 자른 뒤 '기타' 를 붙인다", async () => {
    const rows = Array.from({ length: OPTION_LIMIT + 5 }, (_, i) => ({
      feature: "full_report", subject_key: String(i), created_at: T, profile_name: "나",
    }));
    const { client } = recorder([rows, []]);
    const list = await listServiceOptions("7", client);
    expect(list).toHaveLength(OPTION_LIMIT + 1);
    expect(list.at(-1)).toEqual(OTHER_OPTION);
  });
});

describe("toPurchaseOption", () => {
  it("적립 장수(보너스 포함)와 금액을 적는다 — 카드 명세서의 주문명과 같다", () => {
    expect(
      toPurchaseOption({
        id: 9, payment_id: "saju-abc", product: "t5", amount: 5000, tickets: 6,
        paid_at: T, created_at: "2026-09-30T00:00:00.000Z", requested: false,
      }),
    ).toEqual({
      purchaseId: "9", paymentId: "saju-abc", title: "이용권 6장", sub: "5,000원", createdAt: T, requested: false,
    });
  });

  it("tickets 가 비어 있는 옛 행은 패키지 표에서 장수를 얻는다", () => {
    const o = toPurchaseOption({
      id: 9, payment_id: "p", product: "t10", amount: 10000, tickets: null,
      paid_at: null, created_at: T, requested: true,
    });
    expect(o.title).toBe("이용권 13장");
    expect(o.createdAt).toBe(T);
    expect(o.requested).toBe(true);
  });

  it("모르는 상품이면 장수 없이 '이용권'", () => {
    const o = toPurchaseOption({
      id: 9, payment_id: "p", product: "legacy", amount: 1000, tickets: null,
      paid_at: T, created_at: T, requested: false,
    });
    expect(o.title).toBe("이용권");
  });
});

describe("listPurchaseOptions", () => {
  it("이 사용자의 paid 건만 묻는다", async () => {
    const { client, queries, params } = recorder([[]]);
    await listPurchaseOptions("7", client);
    expect(queries[0]).toContain("status = 'paid'");
    expect(params[0]).toContain("7");
  });
});

describe("insertSupportTicket", () => {
  const base = {
    userId: "7", kind: "refund" as const, targetKind: null, targetRef: null,
    targetLabel: "이용권 6장 · 5,000원", purchaseId: "9", refundReason: "기타" as const,
    body: "", replyEmail: "a@b.c",
  };

  it("새 행의 id 를 돌려준다", async () => {
    const { client, queries } = recorder([[{ id: 1, created_at: T }]]);
    expect(await insertSupportTicket(base, client)).toEqual({ id: "1", createdAt: T });
    expect(queries[0]).toContain("ON CONFLICT DO NOTHING");
  });

  it("열린 환불 요청과 부딪혀 아무것도 안 돌아오면 null", async () => {
    const { client } = recorder([[]]);
    expect(await insertSupportTicket(base, client)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/support/store.test.ts`
Expected: FAIL — `Failed to resolve import "./store"`

- [ ] **Step 3: 구현한다** — `src/lib/support/store.ts`

```ts
import { sql as neonSql, type SqlClient } from "@/lib/db";
import {
  TICKET_PACKAGE_IDS,
  creditedTickets,
  getPackage,
  type TicketPackageId,
} from "@/lib/payments/pricing";
import {
  OTHER_OPTION,
  type PurchaseOption,
  type RefundReason,
  type ServiceOption,
  type SupportKind,
  type TargetKind,
} from "./types";

export type { SqlClient };

const sql = neonSql as unknown as SqlClient;

/**
 * 목록 상한. 이용권 기록은 계정이 계속 쌓는 행이라 언젠가 모달이 무거워진다.
 * 오래된 건은 "기타" 로 문의하면 된다 — 페이지네이션을 둘 만한 목록이 아니다.
 */
export const OPTION_LIMIT = 30;

const DELETED = "삭제된 항목";

/** neon 이 timestamptz 를 문자열로도 Date 로도 줄 수 있어 한 곳에서 ISO 로 접는다. */
function toIso(v: unknown): string {
  return (v instanceof Date ? v : new Date(String(v))).toISOString();
}

const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

/**
 * entitlements 한 행 + 조인된 이름들 → 목록 한 줄. 모르는 feature 는 null —
 * 새 서비스가 생겨도 이 모달이 깨지지 않고, 그 서비스는 "기타" 로 문의된다.
 */
export function toServiceOption(r: Record<string, unknown>): ServiceOption | null {
  const ref = String(r.subject_key);
  const createdAt = toIso(r.created_at);
  switch (r.feature) {
    case "full_report":
      return { target: { kind: "full_report", ref }, title: "리포트", sub: text(r.profile_name) ?? DELETED, createdAt };
    case "compatibility": {
      const a = text(r.subject_name);
      const b = text(r.counterpart_name);
      return { target: { kind: "compatibility", ref }, title: "궁합", sub: a && b ? `${a} × ${b}` : DELETED, createdAt };
    }
    case "consultation":
      return {
        target: { kind: "consultation", ref },
        title: "상담",
        sub: r.consult_id == null ? DELETED : (text(r.consult_title) ?? "제목 없는 상담"),
        createdAt,
      };
    case "yearly_flow":
      return {
        target: { kind: "yearly_flow", ref },
        title: r.flow_year == null ? "한 해의 흐름" : `${Number(r.flow_year)} 한 해의 흐름`,
        sub: text(r.flow_profile_name) ?? DELETED,
        createdAt,
      };
    default:
      return null;
  }
}

/**
 * 오류 문의의 "문제가 생긴 서비스". 이용권을 쓴 기록(entitlements)과 무료인 관계 지도(maps)를
 * 최신순으로 섞고 끝에 "기타" 를 붙인다.
 *
 * subject_key 는 text 라 각 테이블의 id 를 ::text 로 맞춰 조인한다(profiles/store.ts 와 같은 방식).
 * 조인마다 user_id 를 같이 거는 이유: subject_key 는 FK 가 아니어서, 이론상 남의 행 id 와
 * 겹칠 수 있다 — 남의 이름이 내 목록에 찍히면 안 된다.
 *
 * 궁합의 subject_key 는 지금은 match id 다. 초기 설계(0013 주석)의 '12:34' 형식 행이 남아
 * 있다면 조인이 비어 "삭제된 항목" 으로 보인다 — 문의는 여전히 가능하다.
 */
export async function listServiceOptions(userId: string, client: SqlClient = sql): Promise<ServiceOption[]> {
  const [entRows, mapRows] = await Promise.all([
    client`
      SELECT e.feature, e.subject_key, e.created_at,
             p.name  AS profile_name,
             sp.name AS subject_name, cp.name AS counterpart_name,
             c.id    AS consult_id, c.title AS consult_title,
             f.flow_year, fp.name AS flow_profile_name
        FROM entitlements e
        LEFT JOIN profiles p
               ON e.feature = 'full_report' AND p.id::text = e.subject_key AND p.user_id = e.user_id
        LEFT JOIN matches m
               ON e.feature = 'compatibility' AND m.id::text = e.subject_key AND m.user_id = e.user_id
        LEFT JOIN profiles sp ON sp.id = m.subject_profile_id
        LEFT JOIN profiles cp ON cp.id = m.counterpart_profile_id
        LEFT JOIN consultations c
               ON e.feature = 'consultation' AND c.id::text = e.subject_key AND c.user_id = e.user_id
        LEFT JOIN flows f
               ON e.feature = 'yearly_flow' AND f.id::text = e.subject_key AND f.user_id = e.user_id
        LEFT JOIN profiles fp ON fp.id = f.profile_id
       WHERE e.user_id = ${userId}::bigint
       ORDER BY e.created_at DESC
       LIMIT ${OPTION_LIMIT}
    `,
    client`
      SELECT id, center_name, created_at
        FROM maps
       WHERE owner_user_id = ${userId}::bigint
    `,
  ]);

  const items: ServiceOption[] = [
    ...entRows.map(toServiceOption).filter((o): o is ServiceOption => o !== null),
    ...mapRows.map((r) => ({
      target: { kind: "map" as const, ref: String(r.id) },
      title: "관계 지도",
      sub: String(r.center_name),
      createdAt: toIso(r.created_at),
    })),
  ];
  // createdAt 은 모두 ISO(UTC) 라 문자열 비교가 곧 시간 비교다.
  items.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  return [...items.slice(0, OPTION_LIMIT), OTHER_OPTION];
}

function isPackageId(v: string): v is TicketPackageId {
  return (TICKET_PACKAGE_IDS as readonly string[]).includes(v);
}

/**
 * purchases 한 행 → 결제 내역 한 줄. 장수는 보너스를 포함한 적립 장수다 —
 * 카드 명세서의 주문명(packageOrderName)과 같은 숫자여야 사용자가 맞춰 볼 수 있다.
 */
export function toPurchaseOption(r: Record<string, unknown>): PurchaseOption {
  const product = String(r.product);
  const tickets =
    r.tickets != null ? Number(r.tickets) : isPackageId(product) ? creditedTickets(getPackage(product)) : null;
  return {
    purchaseId: String(r.id),
    paymentId: String(r.payment_id ?? ""),
    title: tickets === null ? "이용권" : `이용권 ${tickets}장`,
    sub: `${Number(r.amount).toLocaleString("ko-KR")}원`,
    createdAt: toIso(r.paid_at ?? r.created_at),
    requested: r.requested === true,
  };
}

/** 환불 요청의 "결제 내역": 이 사용자의 paid 결제, 최신순. 열린 환불 요청이 있으면 requested. */
export async function listPurchaseOptions(userId: string, client: SqlClient = sql): Promise<PurchaseOption[]> {
  const rows = await client`
    SELECT p.id, p.payment_id, p.product, p.amount, p.tickets, p.paid_at, p.created_at,
           EXISTS (
             SELECT 1 FROM support_tickets t
              WHERE t.purchase_id = p.id AND t.kind = 'refund' AND t.status = 'open'
           ) AS requested
      FROM purchases p
     WHERE p.user_id = ${userId}::bigint
       AND p.status = 'paid'
     ORDER BY COALESCE(p.paid_at, p.created_at) DESC
     LIMIT ${OPTION_LIMIT}
  `;
  return rows.map(toPurchaseOption);
}

export interface NewSupportTicket {
  userId: string;
  kind: SupportKind;
  targetKind: TargetKind | null;
  targetRef: string | null;
  /** 보낸 시점의 표시 문구. 서버가 목록을 다시 읽어 만든다 — 클라이언트 문구는 믿지 않는다. */
  targetLabel: string | null;
  purchaseId: string | null;
  refundReason: RefundReason | null;
  body: string;
  replyEmail: string | null;
}

/**
 * 문의 한 건 저장. 같은 결제 건에 열린 환불 요청이 이미 있으면 0053 의 부분 유니크 인덱스에
 * 걸려 ON CONFLICT DO NOTHING 으로 접히고 null 을 돌려준다(호출자가 409 로 바꾼다).
 */
export async function insertSupportTicket(
  t: NewSupportTicket,
  client: SqlClient = sql,
): Promise<{ id: string; createdAt: string } | null> {
  const rows = await client`
    INSERT INTO support_tickets
      (user_id, kind, target_kind, target_ref, target_label, purchase_id, refund_reason, body, reply_email)
    VALUES (
      ${t.userId}::bigint, ${t.kind}, ${t.targetKind}, ${t.targetRef}, ${t.targetLabel},
      ${t.purchaseId}::bigint, ${t.refundReason}, ${t.body}, ${t.replyEmail}
    )
    ON CONFLICT DO NOTHING
    RETURNING id, created_at
  `;
  const row = rows[0];
  return row ? { id: String(row.id), createdAt: toIso(row.created_at) } : null;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/support/store.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/support/store.ts src/lib/support/store.test.ts
git commit -m "feat(support): 이용 서비스·결제 내역 목록과 문의 저장"
```

---

### Task 3: 알림 메일 — 조립과 Resend 어댑터

**Files:**
- Modify: `package.json` / `package-lock.json` (`npm install resend`)
- Modify: `.env.example` (끝에 블록 추가)
- Create: `src/lib/support/mail.ts`
- Create: `src/lib/support/mailer.ts`
- Test: `src/lib/support/mail.test.ts`
- Test: `src/lib/support/mailer.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `SupportKind`, `RefundReason`.
- Produces:
  - `interface SupportMail { subject: string; text: string; replyTo: string | null }`
  - `interface SupportMailInput { ticketId: string; createdAt: string; kind: SupportKind; userId: string; userName: string; email: string | null; targetLabel: string | null; paymentId: string | null; refundReason: RefundReason | null; body: string }`
  - `composeSupportMail(i: SupportMailInput): SupportMail`
  - `interface Mailer { send(m: SupportMail): Promise<void> }`
  - `createSupportMailer(env?: Record<string, string | undefined>): Mailer | null`

- [ ] **Step 1: resend 를 설치하고 env 항목을 추가한다**

Run: `npm install resend`

설치 뒤 `node_modules/resend/dist/index.d.ts` 에서 `emails.send` 의 옵션 이름이 `replyTo`(camelCase)이고 반환이 `{ data, error }` 인지 확인한다(v4 이상은 그렇다). 다르면 Step 4 의 코드를 그 이름에 맞춘다.

`.env.example` 맨 끝에 덧붙인다:

```
# --- 고객 문의 메일 (Resend) ---
# 헤더 ⋯ 메뉴의 오류 문의 · 피드백 · 환불 요청이 접수되면 SUPPORT_MAIL_TO 로 알림을 보낸다.
# 셋 중 하나라도 비면 문의는 DB(support_tickets)에만 쌓이고 메일은 건너뛴다.
# FROM 은 Resend 에서 인증한 도메인의 주소여야 한다(예: 사주 <support@도메인>).
RESEND_API_KEY=
SUPPORT_MAIL_FROM=
SUPPORT_MAIL_TO=projectn.contact@gmail.com
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/lib/support/mail.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { composeSupportMail, type SupportMailInput } from "./mail";

const base: SupportMailInput = {
  ticketId: "42",
  createdAt: "2026-10-02T01:05:00.000Z",
  kind: "error",
  userId: "7",
  userName: "동진",
  email: "dj@example.com",
  targetLabel: "궁합 · 동진 × 민수",
  paymentId: null,
  refundReason: null,
  body: "결과가 안 열려요",
};

describe("composeSupportMail", () => {
  it("제목은 [종류] 대상 — 이름", () => {
    expect(composeSupportMail(base).subject).toBe("[오류 문의] 궁합 · 동진 × 민수 — 동진");
  });

  it("피드백은 대상이 없어 [종류] 이름", () => {
    expect(composeSupportMail({ ...base, kind: "feedback", targetLabel: null }).subject).toBe("[피드백] 동진");
  });

  it("본문에 문의 번호·사용자·대상·내용·KST 시각이 들어간다", () => {
    const { text } = composeSupportMail(base);
    expect(text).toContain("#42");
    expect(text).toContain("사용자 7");
    expect(text).toContain("dj@example.com");
    expect(text).toContain("궁합 · 동진 × 민수");
    expect(text).toContain("결과가 안 열려요");
    expect(text).toContain("10:05"); // 01:05Z = 10:05 KST
  });

  it("환불은 결제 id 와 사유를 적는다", () => {
    const { subject, text } = composeSupportMail({
      ...base, kind: "refund", targetLabel: "이용권 6장 · 5,000원",
      paymentId: "saju-abc", refundReason: "실수로 결제했어요", body: "",
    });
    expect(subject).toBe("[환불 요청] 이용권 6장 · 5,000원 — 동진");
    expect(text).toContain("saju-abc");
    expect(text).toContain("실수로 결제했어요");
    expect(text).toContain("(내용 없음)");
  });

  it("이메일이 없으면 replyTo 를 빼고 본문에 (없음) 이라 적는다", () => {
    const mail = composeSupportMail({ ...base, email: null });
    expect(mail.replyTo).toBeNull();
    expect(mail.text).toContain("이메일: (없음)");
  });

  it("이메일이 있으면 replyTo 로 — 받은 메일에서 바로 답장한다", () => {
    expect(composeSupportMail(base).replyTo).toBe("dj@example.com");
  });
});
```

`src/lib/support/mailer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSupportMailer } from "./mailer";

describe("createSupportMailer", () => {
  const full = { RESEND_API_KEY: "test-key", SUPPORT_MAIL_FROM: "a@b.c", SUPPORT_MAIL_TO: "d@e.f" };

  it("세 값이 다 있으면 메일러를 만든다", () => {
    expect(createSupportMailer(full)).not.toBeNull();
  });

  it.each(["RESEND_API_KEY", "SUPPORT_MAIL_FROM", "SUPPORT_MAIL_TO"] as const)(
    "%s 가 비면 null — 메일만 건너뛴다",
    (k) => {
      expect(createSupportMailer({ ...full, [k]: "" })).toBeNull();
    },
  );
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx vitest run src/lib/support/mail.test.ts src/lib/support/mailer.test.ts`
Expected: FAIL — `Failed to resolve import "./mail"` / `"./mailer"`

- [ ] **Step 4: 구현한다**

`src/lib/support/mail.ts`:

```ts
import type { RefundReason, SupportKind } from "./types";

export interface SupportMail {
  subject: string;
  text: string;
  /** 사용자 이메일. 없으면 null — 옛 가입자는 이메일이 비어 있을 수 있다. */
  replyTo: string | null;
}

export interface SupportMailInput {
  ticketId: string;
  createdAt: string;
  kind: SupportKind;
  userId: string;
  userName: string;
  email: string | null;
  targetLabel: string | null;
  paymentId: string | null;
  refundReason: RefundReason | null;
  body: string;
}

const KIND_LABEL: Record<SupportKind, string> = {
  error: "오류 문의",
  feedback: "피드백",
  refund: "환불 요청",
};

const KST = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * 운영 메일 한 통. 텍스트만 보낸다 — 받는 사람은 우리뿐이고, HTML 은 사용자가 쓴 본문을
 * 이스케이프해야 하는 부담만 늘린다.
 */
export function composeSupportMail(i: SupportMailInput): SupportMail {
  const head = `[${KIND_LABEL[i.kind]}]`;
  const subject = i.targetLabel ? `${head} ${i.targetLabel} — ${i.userName}` : `${head} ${i.userName}`;

  const lines = [
    `문의 #${i.ticketId} · ${KST.format(new Date(i.createdAt))} (KST)`,
    "",
    `사용자 ${i.userId} · ${i.userName}`,
    `이메일: ${i.email ?? "(없음)"}`,
  ];
  if (i.targetLabel) lines.push(`대상: ${i.targetLabel}`);
  if (i.paymentId) lines.push(`결제 ID: ${i.paymentId}`);
  if (i.refundReason) lines.push(`환불 사유: ${i.refundReason}`);
  lines.push("", "─ 내용 ─", i.body.trim() === "" ? "(내용 없음)" : i.body);

  return { subject, text: lines.join("\n"), replyTo: i.email };
}
```

`src/lib/support/mailer.ts`:

```ts
import { Resend } from "resend";
import type { SupportMail } from "./mail";

export interface Mailer {
  send(m: SupportMail): Promise<void>;
}

/**
 * 운영 알림 메일러. 키·보내는 곳·받는 곳 중 하나라도 비면 null 을 돌려준다 —
 * 호출자는 메일만 건너뛰고 문의 저장은 그대로 한다(결제처럼 기능을 잠그지 않는다).
 *
 * env 를 인자로 받는 이유: 테스트가 process.env 를 건드리지 않고 분기를 확인한다.
 */
export function createSupportMailer(
  env: Record<string, string | undefined> = process.env,
): Mailer | null {
  const key = env.RESEND_API_KEY;
  const from = env.SUPPORT_MAIL_FROM;
  const to = env.SUPPORT_MAIL_TO;
  if (!key || !from || !to) return null;

  const resend = new Resend(key);
  return {
    async send(m) {
      // resend 는 API 오류를 throw 하지 않고 { error } 로 돌려준다 — 여기서 던져야
      // 호출자의 catch 가 로그를 남긴다.
      const { error } = await resend.emails.send({
        from,
        to,
        subject: m.subject,
        text: m.text,
        ...(m.replyTo ? { replyTo: m.replyTo } : {}),
      });
      if (error) throw new Error(`resend: ${error.name}: ${error.message}`);
    },
  };
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/lib/support/mail.test.ts src/lib/support/mailer.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json .env.example src/lib/support/mail.ts src/lib/support/mailer.ts src/lib/support/mail.test.ts src/lib/support/mailer.test.ts
git commit -m "feat(support): Resend 알림 메일 조립과 어댑터"
```

---

### Task 4: API — 레이트리밋, 문의 접수, 목록 조회

**Files:**
- Create: `src/lib/support/rate-limit.ts`
- Test: `src/lib/support/rate-limit.test.ts`
- Create: `src/app/api/support/_lib/handler.ts`
- Test: `src/app/api/support/_lib/handler.test.ts`
- Create: `src/app/api/support/route.ts`
- Create: `src/app/api/support/options/route.ts`

**Interfaces:**
- Consumes: Task 1 타입·`optionLabel`·`BODY_MAX`·`REFUND_REASONS`·`TARGET_KINDS`, Task 2 `listServiceOptions`·`listPurchaseOptions`·`insertSupportTicket`·`NewSupportTicket`, Task 3 `composeSupportMail`·`Mailer`·`createSupportMailer`. `getSession` (`@/lib/auth/session`), `getUser` (`@/lib/auth/users`), `resolveDisplayName` (`@/lib/auth/display-name`), `getBalance` (`@/lib/tickets/wallet`), `redis` (`@/lib/redis`).
- Produces:
  - `SUPPORT_LIMIT = 5`, `checkSupportLimit(userId: string, client?: RateLimitClient): Promise<boolean>`
  - `handleCreateSupportTicket(raw: unknown, d: CreateSupportDeps): Promise<{ status: number; body: { id: string } | { error: string } }>`
  - `handleSupportOptions(kind: string | null, d: SupportOptionsDeps): Promise<{ status: number; body: SupportOptions | { error: string } }>`
  - `POST /api/support` → 201 `{ id }` / 400 / 401 / 404 / 409 / 429 / 500
  - `GET /api/support/options?kind=error|refund` → 200 `SupportOptions` / 400 / 401 / 500

- [ ] **Step 1: 레이트리밋 테스트를 쓴다** — `src/lib/support/rate-limit.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { SUPPORT_LIMIT, checkSupportLimit } from "./rate-limit";

function fakeClient(n: number | Error) {
  return {
    incr: vi.fn(async () => {
      if (n instanceof Error) throw n;
      return n;
    }),
    expire: vi.fn(async () => 1),
  };
}

describe("checkSupportLimit", () => {
  it("한도 안이면 true, 키는 사용자별", async () => {
    const c = fakeClient(SUPPORT_LIMIT);
    expect(await checkSupportLimit("7", c)).toBe(true);
    expect(c.incr).toHaveBeenCalledWith("support:user:7");
  });

  it("한도를 넘으면 false", async () => {
    expect(await checkSupportLimit("7", fakeClient(SUPPORT_LIMIT + 1))).toBe(false);
  });

  it("Redis 가 죽으면 열어 둔다 — 문의 창구가 닫히면 안 된다", async () => {
    expect(await checkSupportLimit("7", fakeClient(new Error("down")))).toBe(true);
  });
});
```

- [ ] **Step 2: 실패를 확인하고 구현한다**

Run: `npx vitest run src/lib/support/rate-limit.test.ts` → FAIL (`./rate-limit` 없음)

`src/lib/support/rate-limit.ts`:

```ts
import { redis } from "@/lib/redis";
import type { RateLimitClient } from "@/lib/reports/rate-limit";

/**
 * 문의 연타 방어: 사용자당 10분에 5건.
 *
 * 구조는 reports/rate-limit.ts 와 같다(고정 윈도 incr + expire NX). 실패 처리는 반대다 —
 * **incr 실패는 열어 둔다(fail-open).** 문의는 LLM 호출처럼 비용이 새는 경로가 아니고,
 * Redis 장애 때 "오류 문의" 까지 막히면 사용자가 장애를 알릴 길이 없어진다.
 * 로그인 사용자만 오므로 열어 둬도 남용 범위가 계정 단위로 묶인다.
 */
export const SUPPORT_LIMIT = 5;

const WINDOW_SECONDS = 10 * 60;

export async function checkSupportLimit(
  userId: string,
  client: RateLimitClient = redis,
): Promise<boolean> {
  const key = `support:user:${userId}`;
  let n: number;
  try {
    n = await client.incr(key);
  } catch (err) {
    console.error("[checkSupportLimit] Redis error, allowing:", err instanceof Error ? err.message : err);
    return true;
  }
  try {
    await client.expire(key, WINDOW_SECONDS, "NX");
  } catch (err) {
    console.warn("[checkSupportLimit] Expire error (non-fatal):", err instanceof Error ? err.message : err);
  }
  return n <= SUPPORT_LIMIT;
}
```

Run: `npx vitest run src/lib/support/rate-limit.test.ts` → PASS

- [ ] **Step 3: 핸들러 테스트를 쓴다** — `src/app/api/support/_lib/handler.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import type { PurchaseOption, ServiceOption } from "@/lib/support/types";
import { OTHER_OPTION } from "@/lib/support/types";
import {
  handleCreateSupportTicket,
  handleSupportOptions,
  type CreateSupportDeps,
  type SupportOptionsDeps,
} from "./handler";

const T = "2026-10-02T01:00:00.000Z";

const services: ServiceOption[] = [
  { target: { kind: "compatibility", ref: "5" }, title: "궁합", sub: "동진 × 민수", createdAt: T },
  OTHER_OPTION,
];

const purchases: PurchaseOption[] = [
  { purchaseId: "9", paymentId: "saju-abc", title: "이용권 6장", sub: "5,000원", createdAt: T, requested: false },
  { purchaseId: "10", paymentId: "saju-def", title: "이용권 1장", sub: "1,000원", createdAt: T, requested: true },
];

function deps(over: Partial<CreateSupportDeps> = {}) {
  const d: CreateSupportDeps = {
    userId: "7",
    checkLimit: vi.fn(async () => true),
    getUser: vi.fn(async () => ({ displayName: "동진", email: "dj@example.com" })),
    listServiceOptions: vi.fn(async () => services),
    listPurchaseOptions: vi.fn(async () => purchases),
    insertTicket: vi.fn(async () => ({ id: "42", createdAt: T })),
    mailer: { send: vi.fn(async () => {}) },
    ...over,
  };
  return d;
}

describe("handleCreateSupportTicket", () => {
  it("비로그인은 401", async () => {
    const d = deps({ userId: null });
    expect((await handleCreateSupportTicket({ kind: "feedback", body: "hi" }, d)).status).toBe(401);
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: "nope", body: "x" }],
    [{ kind: "feedback", body: "   " }],
    [{ kind: "feedback", body: "x".repeat(4001) }],
    [{ kind: "error", target: { kind: "map", ref: "3" }, body: "" }],
    [{ kind: "error", target: { kind: "bogus", ref: "3" }, body: "x" }],
    [{ kind: "refund", purchaseId: "9", reason: "그냥요" }],
    [{ kind: "refund", purchaseId: "abc", reason: "기타" }],
  ])("형식이 틀리면 400: %j", async (raw) => {
    const d = deps();
    expect((await handleCreateSupportTicket(raw, d)).status).toBe(400);
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it("한도를 넘으면 429", async () => {
    const d = deps({ checkLimit: vi.fn(async () => false) });
    expect((await handleCreateSupportTicket({ kind: "feedback", body: "hi" }, d)).status).toBe(429);
  });

  it("피드백 — 저장하고 메일을 보내고 201", async () => {
    const d = deps();
    const r = await handleCreateSupportTicket({ kind: "feedback", body: "  좋아요  " }, d);
    expect(r).toEqual({ status: 201, body: { id: "42" } });
    expect(d.insertTicket).toHaveBeenCalledWith({
      userId: "7", kind: "feedback", targetKind: null, targetRef: null, targetLabel: null,
      purchaseId: null, refundReason: null, body: "좋아요", replyEmail: "dj@example.com",
    });
    expect(d.mailer!.send).toHaveBeenCalledOnce();
  });

  it("오류 문의 — 라벨은 서버가 목록에서 다시 만든다", async () => {
    const d = deps();
    const r = await handleCreateSupportTicket(
      { kind: "error", target: { kind: "compatibility", ref: "5" }, body: "안 열려요", label: "조작된 문구" },
      d,
    );
    expect(r.status).toBe(201);
    expect(d.insertTicket).toHaveBeenCalledWith(
      expect.objectContaining({ targetKind: "compatibility", targetRef: "5", targetLabel: "궁합 · 동진 × 민수" }),
    );
  });

  it("오류 문의 '기타' 는 목록을 읽지 않는다", async () => {
    const d = deps();
    const r = await handleCreateSupportTicket({ kind: "error", target: { kind: "other", ref: null }, body: "그 외" }, d);
    expect(r.status).toBe(201);
    expect(d.listServiceOptions).not.toHaveBeenCalled();
    expect(d.insertTicket).toHaveBeenCalledWith(
      expect.objectContaining({ targetKind: "other", targetRef: null, targetLabel: "기타" }),
    );
  });

  it("내 목록에 없는 대상은 404 — 남의 id 다", async () => {
    const d = deps();
    const r = await handleCreateSupportTicket({ kind: "error", target: { kind: "compatibility", ref: "999" }, body: "x" }, d);
    expect(r.status).toBe(404);
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it("환불 — 결제 건 라벨과 사유를 저장한다", async () => {
    const d = deps();
    const r = await handleCreateSupportTicket({ kind: "refund", purchaseId: "9", reason: "실수로 결제했어요" }, d);
    expect(r.status).toBe(201);
    expect(d.insertTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "refund", purchaseId: "9", refundReason: "실수로 결제했어요",
        targetLabel: "이용권 6장 · 5,000원", body: "",
      }),
    );
  });

  it("내 결제가 아니면 404", async () => {
    const d = deps();
    expect((await handleCreateSupportTicket({ kind: "refund", purchaseId: "77", reason: "기타" }, d)).status).toBe(404);
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it("이미 열린 환불 요청이 있으면 409", async () => {
    const d = deps();
    expect((await handleCreateSupportTicket({ kind: "refund", purchaseId: "10", reason: "기타" }, d)).status).toBe(409);
    expect(d.insertTicket).not.toHaveBeenCalled();
  });

  it("동시 요청이 앱 검사를 통과해도 INSERT 충돌이면 409, 메일은 안 보낸다", async () => {
    const d = deps({ insertTicket: vi.fn(async () => null) });
    expect((await handleCreateSupportTicket({ kind: "refund", purchaseId: "9", reason: "기타" }, d)).status).toBe(409);
    expect(d.mailer!.send).not.toHaveBeenCalled();
  });

  it("메일이 실패해도 201 — 저장이 원본이다", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps({ mailer: { send: vi.fn(async () => { throw new Error("resend down"); }) } });
    expect((await handleCreateSupportTicket({ kind: "feedback", body: "hi" }, d)).status).toBe(201);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("메일러가 없으면(키 미설정) 건너뛰고 201", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = deps({ mailer: null });
    expect((await handleCreateSupportTicket({ kind: "feedback", body: "hi" }, d)).status).toBe(201);
    warn.mockRestore();
  });

  it("사용자 행이 없으면 401", async () => {
    const d = deps({ getUser: vi.fn(async () => null) });
    expect((await handleCreateSupportTicket({ kind: "feedback", body: "hi" }, d)).status).toBe(401);
  });
});

describe("handleSupportOptions", () => {
  function od(over: Partial<SupportOptionsDeps> = {}): SupportOptionsDeps {
    return {
      userId: "7",
      listServiceOptions: vi.fn(async () => services),
      listPurchaseOptions: vi.fn(async () => purchases),
      getBalance: vi.fn(async () => 3),
      ...over,
    };
  }

  it("비로그인 401", async () => {
    expect((await handleSupportOptions("error", od({ userId: null }))).status).toBe(401);
  });

  it("모르는 kind 는 400 — feedback 도 목록이 없다", async () => {
    expect((await handleSupportOptions("feedback", od())).status).toBe(400);
    expect((await handleSupportOptions(null, od())).status).toBe(400);
  });

  it("error 는 서비스 목록", async () => {
    expect(await handleSupportOptions("error", od())).toEqual({
      status: 200, body: { kind: "error", items: services },
    });
  });

  it("refund 는 결제 목록과 잔여 이용권", async () => {
    expect(await handleSupportOptions("refund", od())).toEqual({
      status: 200, body: { kind: "refund", items: purchases, balance: 3 },
    });
  });
});
```

- [ ] **Step 4: 실패를 확인한다**

Run: `npx vitest run src/app/api/support/_lib/handler.test.ts`
Expected: FAIL — `Failed to resolve import "./handler"`

- [ ] **Step 5: 핸들러를 구현한다** — `src/app/api/support/_lib/handler.ts`

```ts
import { z } from "zod";
import { composeSupportMail } from "@/lib/support/mail";
import type { Mailer } from "@/lib/support/mailer";
import type { NewSupportTicket } from "@/lib/support/store";
import {
  BODY_MAX,
  REFUND_REASONS,
  TARGET_KINDS,
  optionLabel,
  type PurchaseOption,
  type ServiceOption,
  type SupportOptions,
} from "@/lib/support/types";

// trim 을 먼저 하는 이유: 공백만 있는 본문은 빈 본문이다(클라이언트 canSubmit 과 같은 판단).
const bodyText = z.string().trim().max(BODY_MAX);

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("error"),
    target: z.object({
      kind: z.enum(TARGET_KINDS),
      ref: z.string().min(1).max(64).nullable(),
    }),
    body: bodyText.min(1),
  }),
  z.object({ kind: z.literal("feedback"), body: bodyText.min(1) }),
  z.object({
    kind: z.literal("refund"),
    purchaseId: z.string().regex(/^\d+$/),
    reason: z.enum(REFUND_REASONS),
    body: bodyText.default(""),
  }),
]);

export interface CreateSupportDeps {
  userId: string | null;
  checkLimit(userId: string): Promise<boolean>;
  getUser(userId: string): Promise<{ displayName: string | null; email: string | null } | null>;
  listServiceOptions(userId: string): Promise<ServiceOption[]>;
  listPurchaseOptions(userId: string): Promise<PurchaseOption[]>;
  insertTicket(t: NewSupportTicket): Promise<{ id: string; createdAt: string } | null>;
  /** null 이면 메일 설정이 비어 있다 — 저장만 한다. */
  mailer: Mailer | null;
}

type Result = { status: number; body: { id: string } | { error: string } };

const BAD = { status: 400, body: { error: "요청을 확인해 주세요" } } as const;
const DUPLICATE = { status: 409, body: { error: "이미 접수된 환불 요청이 있어요" } } as const;

export async function handleCreateSupportTicket(raw: unknown, d: CreateSupportDeps): Promise<Result> {
  if (!d.userId) return { status: 401, body: { error: "로그인이 필요합니다" } };
  const userId = d.userId;

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return BAD;
  const input = parsed.data;

  if (!(await d.checkLimit(userId))) {
    return { status: 429, body: { error: "잠시 후 다시 시도해 주세요" } };
  }

  const user = await d.getUser(userId);
  if (!user) return { status: 401, body: { error: "로그인이 필요합니다" } };

  const ticket: NewSupportTicket = {
    userId,
    kind: input.kind,
    targetKind: null,
    targetRef: null,
    targetLabel: null,
    purchaseId: null,
    refundReason: null,
    body: input.body,
    replyEmail: user.email,
  };
  let paymentId: string | null = null;

  if (input.kind === "error") {
    const { kind, ref } = input.target;
    ticket.targetKind = kind;
    if (kind === "other") {
      ticket.targetLabel = "기타";
    } else {
      // 클라이언트가 보낸 대상이 정말 이 사용자의 것인지, 목록을 다시 읽어 확인한다.
      // 없는 것과 남의 것을 구분하지 않는다 — 구분하면 id 로 존재 여부를 훑을 수 있다.
      const found = (await d.listServiceOptions(userId)).find(
        (o) => o.target.kind === kind && o.target.ref === ref,
      );
      if (!found) return { status: 404, body: { error: "항목을 찾을 수 없습니다" } };
      ticket.targetRef = ref;
      ticket.targetLabel = optionLabel(found);
    }
  } else if (input.kind === "refund") {
    const found = (await d.listPurchaseOptions(userId)).find((p) => p.purchaseId === input.purchaseId);
    if (!found) return { status: 404, body: { error: "결제 내역을 찾을 수 없습니다" } };
    if (found.requested) return DUPLICATE;
    ticket.purchaseId = found.purchaseId;
    ticket.refundReason = input.reason;
    ticket.targetLabel = optionLabel(found);
    paymentId = found.paymentId;
  }

  const saved = await d.insertTicket(ticket);
  // 앱 검사(requested)를 동시 요청 두 개가 함께 통과한 경우 — 0053 의 인덱스가 하나를 막았다.
  if (!saved) return DUPLICATE;

  if (!d.mailer) {
    console.warn("[support] 메일 설정이 비어 있어 알림을 건너뜁니다", saved.id);
  } else {
    try {
      await d.mailer.send(
        composeSupportMail({
          ticketId: saved.id,
          createdAt: saved.createdAt,
          kind: ticket.kind,
          userId,
          userName: user.displayName ?? "이름 없음",
          email: user.email,
          targetLabel: ticket.targetLabel,
          paymentId,
          refundReason: ticket.refundReason,
          body: ticket.body,
        }),
      );
    } catch (e) {
      // 문의는 이미 저장됐다. 메일 실패로 사용자에게 오류를 보이면 다시 보내 중복만 생긴다.
      console.error("[support] 알림 메일 실패", saved.id, e);
    }
  }

  return { status: 201, body: { id: saved.id } };
}

export interface SupportOptionsDeps {
  userId: string | null;
  listServiceOptions(userId: string): Promise<ServiceOption[]>;
  listPurchaseOptions(userId: string): Promise<PurchaseOption[]>;
  getBalance(userId: string): Promise<number>;
}

export async function handleSupportOptions(
  kind: string | null,
  d: SupportOptionsDeps,
): Promise<{ status: number; body: SupportOptions | { error: string } }> {
  if (!d.userId) return { status: 401, body: { error: "로그인이 필요합니다" } };
  if (kind === "error") {
    return { status: 200, body: { kind: "error", items: await d.listServiceOptions(d.userId) } };
  }
  if (kind === "refund") {
    const [items, balance] = await Promise.all([d.listPurchaseOptions(d.userId), d.getBalance(d.userId)]);
    return { status: 200, body: { kind: "refund", items, balance } };
  }
  return BAD;
}
```

- [ ] **Step 6: 통과를 확인한다**

Run: `npx vitest run src/app/api/support/_lib/handler.test.ts`
Expected: PASS

- [ ] **Step 7: 라우트 두 개를 쓴다**

`src/app/api/support/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { createSupportMailer } from "@/lib/support/mailer";
import { checkSupportLimit } from "@/lib/support/rate-limit";
import { insertSupportTicket, listPurchaseOptions, listServiceOptions } from "@/lib/support/store";
import { handleCreateSupportTicket } from "./_lib/handler";

export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleCreateSupportTicket(raw, {
      userId: session?.userId ?? null,
      checkLimit: checkSupportLimit,
      getUser,
      listServiceOptions,
      listPurchaseOptions,
      insertTicket: insertSupportTicket,
      mailer: createSupportMailer(),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/support]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
```

`src/app/api/support/options/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listPurchaseOptions, listServiceOptions } from "@/lib/support/store";
import { getBalance } from "@/lib/tickets/wallet";
import { handleSupportOptions } from "../_lib/handler";

export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind");
  const session = await getSession();

  try {
    const result = await handleSupportOptions(kind, {
      userId: session?.userId ?? null,
      listServiceOptions,
      listPurchaseOptions,
      getBalance,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[GET /api/support/options]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
```

- [ ] **Step 8: 타입체크**

Run: `npm run typecheck`
Expected: 오류 없음. `getUser` 가 `UserProfile | null` 을 돌려주므로 `CreateSupportDeps.getUser` 에 그대로 맞는다.

- [ ] **Step 9: 커밋**

```bash
git add src/lib/support/rate-limit.ts src/lib/support/rate-limit.test.ts src/app/api/support
git commit -m "feat(support): 문의 접수·목록 API 와 사용자별 레이트리밋"
```

---

### Task 5: 어드민 토대 — `requireAdmin`

**Files:**
- Create: `src/lib/auth/admin.ts`
- Test: `src/lib/auth/admin.test.ts`

**Interfaces:**
- Consumes: `getSession`, `SessionPayload` (`@/lib/auth/session`), `sql`/`SqlClient` (`@/lib/db`). Task 1 의 0054 마이그레이션(`users.role`).
- Produces:
  - `USER_ROLES = ["user", "admin"] as const`, `type UserRole`
  - `getUserRole(userId: string, client?: SqlClient): Promise<UserRole | null>`
  - `requireAdmin(deps?: { getSession(): Promise<SessionPayload | null>; getUserRole(userId: string): Promise<UserRole | null> }): Promise<{ userId: string } | null>`

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `src/lib/auth/admin.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import type { SqlClient } from "@/lib/db";
import { getUserRole, requireAdmin } from "./admin";

describe("requireAdmin", () => {
  it("세션이 없으면 null", async () => {
    const getUserRole = vi.fn();
    expect(await requireAdmin({ getSession: async () => null, getUserRole })).toBeNull();
    expect(getUserRole).not.toHaveBeenCalled();
  });

  it("role 이 user 면 null", async () => {
    expect(
      await requireAdmin({ getSession: async () => ({ userId: "7", provider: "google" }), getUserRole: async () => "user" }),
    ).toBeNull();
  });

  it("provider 가 'admin'(심사용 로그인)이어도 role 이 user 면 null", async () => {
    expect(
      await requireAdmin({ getSession: async () => ({ userId: "8", provider: "admin" }), getUserRole: async () => "user" }),
    ).toBeNull();
  });

  it("role 이 admin 이면 userId", async () => {
    expect(
      await requireAdmin({ getSession: async () => ({ userId: "7", provider: "kakao" }), getUserRole: async () => "admin" }),
    ).toEqual({ userId: "7" });
  });
});

describe("getUserRole", () => {
  const client = (rows: Record<string, unknown>[]) =>
    (async () => rows) as unknown as SqlClient;

  it("모르는 값·없는 행은 null 로 접는다 — 권한은 확실할 때만", async () => {
    expect(await getUserRole("7", client([{ role: "admin" }]))).toBe("admin");
    expect(await getUserRole("7", client([{ role: "superuser" }]))).toBeNull();
    expect(await getUserRole("7", client([]))).toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/auth/admin.test.ts`
Expected: FAIL — `Failed to resolve import "./admin"`

- [ ] **Step 3: 구현한다** — `src/lib/auth/admin.ts`

```ts
import { sql as neonSql, type SqlClient } from "@/lib/db";
import { getSession, type SessionPayload } from "./session";

const sql = neonSql as unknown as SqlClient;

/** users.role 의 CHECK 와 같은 목록이다(0054). */
export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export async function getUserRole(userId: string, client: SqlClient = sql): Promise<UserRole | null> {
  const rows = await client`SELECT role FROM users WHERE id = ${userId}::bigint`;
  const role = rows[0]?.role;
  return (USER_ROLES as readonly unknown[]).includes(role) ? (role as UserRole) : null;
}

interface AdminDeps {
  getSession(): Promise<SessionPayload | null>;
  getUserRole(userId: string): Promise<UserRole | null>;
}

/**
 * 어드민 화면·API 의 문지기. 관리자면 { userId }, 아니면 null.
 *
 * ⚠️ 세션의 provider 를 보지 않는다. provider = 'admin' 은 PG 심사용 임시 로그인의
 * "로그인 방식" 이고(0049, review-login.ts) 비밀번호가 외부에 공유된다. 권한은 오직
 * users.role 이다 — 세션에 role 을 싣지 않고 매번 DB 를 읽는 것도 같은 이유다:
 * 권한을 회수하면 7일짜리 세션이 끝나기를 기다리지 않고 바로 막혀야 한다.
 */
export async function requireAdmin(
  deps: AdminDeps = { getSession, getUserRole: (id) => getUserRole(id) },
): Promise<{ userId: string } | null> {
  const session = await deps.getSession();
  if (!session) return null;
  return (await deps.getUserRole(session.userId)) === "admin" ? { userId: session.userId } : null;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/auth/admin.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/auth/admin.ts src/lib/auth/admin.test.ts
git commit -m "feat(auth): users.role 기반 requireAdmin — 심사용 provider 와 분리"
```

---

### Task 6: UI — `SupportDialog` 와 메뉴 연결

**Files:**
- Create: `src/components/support/SupportDialog.tsx`
- Modify: `src/components/AppMenu.tsx`

**Interfaces:**
- Consumes: Task 1 의 `SupportKind`, `SupportOptions`, `ServiceTarget`, `RefundReason`, `REFUND_REASONS`, `canSubmit`, `formatOptionDate`, `serviceKey`. Task 4 의 `GET /api/support/options`, `POST /api/support`.
- Produces: `SupportDialog({ kind, onClose }: { kind: SupportKind; onClose: () => void })`

- [ ] **Step 1: `SupportDialog` 를 쓴다** — `src/components/support/SupportDialog.tsx`

```tsx
"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  BODY_MAX,
  REFUND_REASONS,
  canSubmit,
  formatOptionDate,
  serviceKey,
  type RefundReason,
  type ServiceTarget,
  type SupportKind,
  type SupportOptions,
} from "@/lib/support/types";

interface Copy {
  title: string;
  desc: string;
  picker: string | null;
  textLabel: string;
  placeholder: string;
  submit: string;
  sentTitle: string;
  sentDesc: string;
}

/** 시안(Saju Home.dc.html) 문구 그대로. */
const COPY: Record<SupportKind, Copy> = {
  error: {
    title: "오류 문의",
    desc: "문제가 생긴 서비스를 고르고 상황을 알려주세요.",
    picker: "문제가 생긴 서비스",
    textLabel: "자세한 설명",
    placeholder: "어떤 화면에서 어떤 문제가 있었는지 적어주세요.",
    submit: "문의 보내기",
    sentTitle: "문의가 접수되었어요",
    sentDesc: "확인 후 가입하신 이메일로 답변드릴게요.",
  },
  feedback: {
    title: "피드백 보내기",
    desc: "좋았던 점, 아쉬운 점 무엇이든 들려주세요.",
    picker: null,
    textLabel: "내용",
    placeholder: "자유롭게 적어주세요.",
    submit: "피드백 보내기",
    sentTitle: "피드백 고마워요",
    sentDesc: "보내주신 의견은 서비스 개선에 참고할게요.",
  },
  refund: {
    title: "환불 요청",
    desc: "환불받을 결제 내역을 선택해 주세요.",
    picker: "결제 내역",
    textLabel: "추가 설명 (선택)",
    placeholder: "필요하면 상황을 덧붙여 주세요.",
    submit: "환불 요청하기",
    sentTitle: "환불 요청이 접수되었어요",
    sentDesc: "영업일 기준 3일 안에 처리 결과를 알려드릴게요.",
  },
};

interface Row {
  key: string;
  title: string;
  sub: string;
  meta: string;
  disabled: boolean;
  target?: ServiceTarget;
}

type Loaded =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; rows: Row[]; balance: number | null };

/** 응답 → 화면 줄. 날짜 메타를 여기서(받는 순간) 계산해 렌더를 순수하게 둔다. */
function toRows(o: SupportOptions, now: Date): { rows: Row[]; balance: number | null } {
  if (o.kind === "error") {
    return {
      rows: o.items.map((it) => ({
        key: serviceKey(it.target),
        title: it.title,
        sub: it.sub,
        meta: formatOptionDate(it.createdAt, now),
        disabled: false,
        target: it.target,
      })),
      balance: null,
    };
  }
  return {
    rows: o.items.map((it) => ({
      key: it.purchaseId,
      title: it.title,
      sub: it.sub,
      meta: it.requested ? "요청됨" : formatOptionDate(it.createdAt, now),
      disabled: it.requested,
    })),
    balance: o.balance,
  };
}

const FAIL = "보내지 못했어요. 잠시 후 다시 시도해 주세요.";

/**
 * 헤더 ⋯ 메뉴의 오류 문의 · 피드백 · 환불 요청 모달. 열려 있는 동안만 마운트한다.
 *
 * <dialog>.showModal() 을 쓰는 이유는 LeaveConfirmDialog 와 같다(top layer, 포커스 트랩, Esc).
 * 760px 미만은 아래에서 올라오는 시트, 이상은 가운데 카드 — 시안의 mobile 분기와 같은 경계다.
 */
export function SupportDialog({ kind, onClose }: { kind: SupportKind; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const copy = COPY[kind];

  const [loaded, setLoaded] = useState<Loaded>(
    kind === "feedback" ? { status: "ready", rows: [], balance: null } : { status: "loading" },
  );
  const [attempt, setAttempt] = useState(0);
  const [pick, setPick] = useState<string | null>(null);
  const [reason, setReason] = useState<RefundReason | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    if (kind === "feedback") return;
    let cancelled = false;
    fetch(`/api/support/options?kind=${kind}`)
      .then((r) => (r.ok ? (r.json() as Promise<SupportOptions>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!cancelled) setLoaded({ status: "ready", ...toRows(data, new Date()) });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ status: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [kind, attempt]);

  function close() {
    if (!sending) onClose();
  }

  const rows = loaded.status === "ready" ? loaded.rows : [];
  const ready = canSubmit(kind, { pick, reason, text }) && !sending;

  async function submit() {
    if (!ready) return;
    const row = rows.find((r) => r.key === pick);
    const payload =
      kind === "error"
        ? { kind, target: row?.target, body: text }
        : kind === "refund"
          ? { kind, purchaseId: pick, reason, body: text }
          : { kind, body: text };

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSent(true);
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? FAIL);
    } catch {
      setError(FAIL);
    } finally {
      setSending(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        // Esc. 기본 동작에 맡기면 DOM 만 닫히고 부모 상태는 열린 채로 남는다.
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      // 기본: 하단 시트. 760px 이상: 가운데 카드. preflight 가 지운 margin:auto 를 되돌린다.
      className="mx-0 mb-0 mt-auto max-h-[92vh] w-full max-w-none overflow-y-auto rounded-t-[22px] bg-white px-5 pb-6 pt-[22px] text-slate-900 shadow-[0_-20px_60px_-20px_rgba(15,23,42,.35)] backdrop:bg-slate-900/45 backdrop:backdrop-blur-[2px] min-[760px]:m-auto min-[760px]:max-h-[88vh] min-[760px]:max-w-[460px] min-[760px]:rounded-[22px] min-[760px]:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-[20px] font-bold leading-[1.3] tracking-[-0.04em]">
            {copy.title}
          </h2>
          <p id={descId} className="mt-[5px] text-[13.5px] text-slate-500 [text-wrap:pretty]">
            {copy.desc}
          </p>
        </div>
        <button
          type="button"
          aria-label="닫기"
          onClick={close}
          className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-full bg-slate-100 text-[15px] text-slate-500 hover:bg-slate-200"
        >
          ✕
        </button>
      </div>

      {sent ? (
        <div className="pb-2 pt-[34px] text-center" role="status">
          <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-[20px] font-bold text-accent">
            ✓
          </div>
          <div className="text-[17px] font-bold tracking-[-0.03em]">{copy.sentTitle}</div>
          <div className="mt-1.5 text-[13.5px] text-slate-500">{copy.sentDesc}</div>
          <button
            type="button"
            onClick={onClose}
            className="mt-[26px] w-full cursor-pointer rounded-[14px] bg-slate-900 py-[15px] text-[15px] font-bold text-white"
          >
            확인
          </button>
        </div>
      ) : (
        <>
          {copy.picker && (
            <div className="mt-[22px]">
              <div className="mb-[9px] flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-bold text-slate-700">{copy.picker}</span>
                {loaded.status === "ready" && loaded.balance !== null && (
                  <span className="text-[12.5px] text-slate-400">지금 남은 이용권 {loaded.balance}장</span>
                )}
              </div>

              {loaded.status === "loading" && (
                <div className="flex flex-col gap-[7px]" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-[62px] animate-pulse rounded-[14px] bg-slate-100" />
                  ))}
                </div>
              )}

              {loaded.status === "failed" && (
                <div className="rounded-[14px] border border-slate-200 px-4 py-5 text-center text-[13.5px] text-slate-500">
                  목록을 불러오지 못했어요.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setLoaded({ status: "loading" });
                      setAttempt((n) => n + 1);
                    }}
                    className="cursor-pointer font-semibold text-accent"
                  >
                    다시 시도
                  </button>
                </div>
              )}

              {loaded.status === "ready" && rows.length === 0 && (
                <div className="rounded-[14px] border border-slate-200 px-4 py-5 text-center text-[13.5px] text-slate-500">
                  환불할 결제 내역이 없어요
                </div>
              )}

              {loaded.status === "ready" && rows.length > 0 && (
                <div role="radiogroup" aria-label={copy.picker} className="flex max-h-[252px] flex-col gap-[7px] overflow-y-auto">
                  {rows.map((r) => {
                    const on = pick === r.key;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={r.disabled}
                        onClick={() => setPick(r.key)}
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] px-3.5 py-3 text-left transition-colors disabled:cursor-default disabled:opacity-50 ${
                          on ? "border-accent bg-[#F5F8FF]" : "border-slate-200 bg-white"
                        }`}
                      >
                        <span
                          className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-[1.5px] ${
                            on ? "border-accent" : "border-slate-300"
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${on ? "bg-accent" : "bg-transparent"}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px] font-semibold tracking-[-0.02em] text-slate-900">{r.title}</span>
                          <span className="mt-0.5 block truncate text-[12.5px] text-slate-400">{r.sub}</span>
                        </span>
                        <span className="flex-none whitespace-nowrap text-[12.5px] text-slate-400">{r.meta}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {kind === "refund" && (
            <div className="mt-5">
              <div className="mb-[9px] text-[12.5px] font-bold text-slate-700">환불 사유</div>
              <div role="radiogroup" aria-label="환불 사유" className="flex flex-wrap gap-[7px]">
                {REFUND_REASONS.map((label) => {
                  const on = reason === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setReason(label)}
                      className={`cursor-pointer rounded-full border-[1.5px] px-3.5 py-[9px] text-[13.5px] font-semibold tracking-[-0.01em] transition-colors ${
                        on ? "border-accent bg-[#F5F8FF] text-accent-700" : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label className="mt-5 block">
            <span className="mb-[9px] block text-[12.5px] font-bold text-slate-700">{copy.textLabel}</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={copy.placeholder}
              rows={5}
              maxLength={BODY_MAX}
              className="block w-full resize-y rounded-[14px] border-[1.5px] border-slate-200 bg-slate-50 px-3.5 py-[13px] text-[14.5px] leading-[1.55] text-slate-900 outline-none focus:border-accent focus:bg-white"
            />
          </label>

          {error && (
            <p role="alert" className="mt-3 text-[13px] text-red-600">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            className="mt-[22px] w-full cursor-pointer rounded-[14px] bg-accent py-[15px] text-[15px] font-bold text-white transition-colors disabled:cursor-default disabled:bg-slate-300"
          >
            {sending ? "보내는 중…" : copy.submit}
          </button>
        </>
      )}
    </dialog>
  );
}
```

- [ ] **Step 2: `AppMenu` 에 세 항목을 추가한다** — `src/components/AppMenu.tsx`

import 에 추가:

```tsx
import { SupportDialog } from "@/components/support/SupportDialog";
import type { SupportKind } from "@/lib/support/types";
```

컴포넌트 위(모듈 수준)에 추가:

```tsx
/** 시안의 메뉴 순서 그대로. 로그인 상태에서만 보인다 — 문의는 계정에 묶여야 답장할 곳이 생긴다. */
const SUPPORT_ITEMS: { kind: SupportKind; label: string }[] = [
  { kind: "error", label: "오류 문의" },
  { kind: "feedback", label: "피드백 보내기" },
  { kind: "refund", label: "환불 요청" },
];
```

`const [open, setOpen] = useState(false);` 아래에 추가:

```tsx
  const [support, setSupport] = useState<SupportKind | null>(null);
```

로그인 갈래(`) : (` 뒤의 `<>`)를 다음으로 바꾼다 — 이름 줄 위에 세 항목과 구분선을 넣고, 이름·로그아웃은 그대로 둔다:

```tsx
            <>
              {SUPPORT_ITEMS.map((it) => (
                <button
                  key={it.kind}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    setSupport(it.kind);
                  }}
                  className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  {it.label}
                </button>
              ))}
              <div className="my-1.5 border-t border-slate-100" role="separator" />
              <p className="truncate px-4 pb-1.5 pt-1 text-[12.5px] text-slate-400">
                {displayName}님
              </p>
              {/* 로그아웃은 POST 전용 라우트라 링크가 아니라 폼이어야 한다. */}
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  role="menuitem"
                  className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm font-medium text-slate-500 hover:bg-slate-50"
                >
                  로그아웃
                </button>
              </form>
            </>
```

바깥 `<div ref={wrapRef} ...>` 의 닫는 태그 직전(`{open && (...)}` 다음)에 추가:

```tsx
      {support !== null && <SupportDialog kind={support} onClose={() => setSupport(null)} />}
```

- [ ] **Step 3: 정적 검사**

Run: `npm run typecheck && npm run lint`
Expected: 오류 없음. lint 가 `react-hooks/set-state-in-effect` 를 지적하면 — 이 구현은 effect 본문에서 동기 setState 를 하지 않는다(promise 콜백에서만). 다른 지적이 나오면 그 규칙 이름을 보고 고친다.

- [ ] **Step 4: 커밋**

```bash
git add src/components/support/SupportDialog.tsx src/components/AppMenu.tsx
git commit -m "feat(support): 헤더 메뉴에 오류 문의·피드백·환불 요청 모달"
```

---

### Task 7: 마이그레이션 적용과 브라우저 확인

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트·타입·린트**

Run: `npm test && npm run typecheck && npm run lint`
Expected: 모두 통과.

- [ ] **Step 2: 개발 DB 에 마이그레이션을 적용한다**

이 워크트리에는 `.env.local` 이 없다. 메인 체크아웃의 `.env.local` 을 워크트리로 복사한다(커밋 금지 — `.gitignore` 대상인지 `git check-ignore .env.local` 로 확인). 0050~0054 는 새 테이블과 기본값 있는 컬럼 추가뿐이라 개발 DB 를 같이 쓰는 다른 브랜치를 깨지 않는다.

Run: `npm run db:migrate`
Expected: `applying 0050_support_tickets.sql` … `applying 0054_users_role.sql`, `done (5 applied, …)`

- [ ] **Step 3: dev 서버로 확인한다**

워크트리에서 dev 서버를 띄운다(메모리: preview_start 는 다른 체크아웃을 띄울 수 있다 — Bash `npx next dev -p 3100` 를 background 로). 로그인 상태에서 `/home` 을 열고:

1. ⋯ → 오류 문의·피드백 보내기·환불 요청·구분선·이름·로그아웃 순서로 보인다.
2. 오류 문의: 목록에 이용한 서비스 + "기타". 항목만 고르면 버튼 회색, 설명까지 쓰면 파랑. 보내면 ✓ 완료 화면.
3. 환불 요청: 결제 내역 + "지금 남은 이용권 N장". 같은 건으로 두 번째 요청 시 목록에 "요청됨", 고를 수 없다.
4. 피드백: 공백만 쓰면 버튼이 꺼져 있다.
5. 모바일 폭(375)에서 하단 시트, 데스크톱에서 가운데 카드. Esc·백드롭 클릭으로 닫힌다.
6. 로그아웃 상태에서는 세 항목이 없다.

`RESEND_API_KEY` 가 비어 있으면 서버 로그에 `[support] 메일 설정이 비어 있어 알림을 건너뜁니다` 가 찍히고 201 이 오는지 본다. DB 에 `support_tickets` 행이 생겼는지 확인한다.

- [ ] **Step 4: 남은 일을 사용자에게 알린다**

- `.env.local`·호스팅 환경변수에 `RESEND_API_KEY`, `SUPPORT_MAIL_FROM` 채우기 (Resend 도메인 인증 필요)
- 운영 DB 에 `npm run db:migrate` (0050~0054)
- 본인 계정 `UPDATE users SET role = 'admin' WHERE id = …`
```
