# 리포트 실데이터 배선 (`/report`) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/report`가 픽스처 대신 저장된 프로필로 실제 사주를 계산하고 DeepSeek 해석을 받아 렌더하게 만든다.

**Architecture:** `/report` 서버 컴포넌트가 프로필을 조회하고(셸 즉시 렌더), 계산·생성·매핑은 `<Suspense>` 안에서 돈다. 생성 로직은 `handleSaju`에서 `produceSections`로 추출해 `/api/saju`와 `/report`가 한 벌을 공유한다. HTTP 왕복은 없다.

**Tech Stack:** Next.js 16.2.10 (App Router, 서버 컴포넌트), React 19.2.4, TypeScript, zod 4, vitest 4, Neon(Postgres), Tailwind v4.

**설계 문서:** `docs/superpowers/specs/2026-08-01-report-real-data-design.md`

## Global Constraints

- **이 Next.js는 훈련 데이터의 Next.js가 아니다** (`AGENTS.md`). 코드를 쓰기 전에 `node_modules/next/dist/docs/` 의 해당 가이드를 읽는다. 각 Task에 읽을 파일을 지정해 두었다.
- 주석·커밋 메시지·UI 문구는 **한국어**. 기존 파일의 주석 밀도와 톤을 따른다 — "왜"를 적고 "무엇"은 적지 않는다.
- 테스트는 `vitest`. DB에 실제로 붙는 테스트는 만들지 않는다 — 주입형 `SqlClient` 목만 쓴다 (`src/lib/profiles/store.test.ts` 패턴).
- 검증 명령: `npm run typecheck`, `npm test`, `npm run lint`. 커밋 전에 세 개 다 통과해야 한다.
- `git commit` 메시지 끝에 아래 두 줄을 붙인다:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_012NsoCxUmhB3Lv5duP8kuep
  ```
- 이번 작업의 **비범위**: 익명(비로그인) 실데이터, `environment`(07) 섹션 신설, 섹션 번호 체계 통일, 결제 연동. 손대지 않는다.
- 위 커밋 트레일러 중 `Claude-Session` 줄은 이 계획을 쓴 세션의 것이다. 지금은 `Co-Authored-By` 한 줄만 붙인다.

## 선행 작업 반영 (2026-08-04에 추가)

이 계획은 2026-08-01에 쓰였고, 그 뒤 **익명 사용자 입력값 보존**(`docs/superpowers/plans/2026-08-04-anonymous-draft.md`)이 머지됐다. 겹치는 파일은 없지만 고리가 두 개 생겼다.

1. **`LockedSections`에 `isLoggedIn`이 필수 prop으로 생겼다.** Task 7이 `ReportView`를 `ReportShell`/`ReportBody`로 쪼갤 때 이 prop 전달이 사라지면 안 된다 — 비로그인 CTA가 `/login?next=%2Freport`로 가는 것이 익명 → 로그인 → 프로필 승격 파이프의 **유일한 입구**다. Task 7의 코드에 반영해 뒀다.

2. **이 작업이 끝나면 OAuth 콜백의 승격 행선지를 되돌려야 한다.** 지금 `src/app/api/auth/callbacks/[provider]/route.ts`는 승격 성공 시 `/home?saved=1`로 보낸다 — `/report`가 아직 픽스처를 렌더해서 로그인 전후로 화면이 안 바뀌기 때문이다. **이 계획이 `?profile=<id>`를 실제로 소비하게 되는 순간 그 이유가 사라진다.** 마지막 Task로 행선지를 `/report?profile=<id>`로 바꾸고, `docs/superpowers/specs/2026-08-04-anonymous-draft-design.md` §4·§7과 `docs/issues/backlog.md`의 해당 서술도 같이 고친다. 콜백 라우트 테스트(`route.test.ts`)의 `promoted` 갈래 기대값도 함께 바뀐다.

`createProfileSchema`는 `src/app/api/profiles/_lib/input.ts`에서 **`src/lib/profiles/input.ts`로 옮겨졌다.** 이 계획은 그 파일을 건드리지 않지만, 경로를 기억해 두면 헤매지 않는다.

---

### Task 1: `parseProfileParam` — `?profile` 파싱

`?profile` 값이 순번 id 형태일 때만 통과시킨다. URL에서 온 문자열을 그대로 `::bigint`로 캐스팅하면 `"abc"` 하나에 DB 에러가 나 500으로 떨어진다.

세 갈래인 이유: "파라미터 없음"(→ 픽스처 데모)과 "형식이 틀림"(→ `notFound`)의 행선지가 다르다. 잘못된 `?profile=abc`를 데모로 떨어뜨리면 사용자는 남의 리포트를 보고 있다고 오해한다.

**Files:**
- Modify: `src/app/report/_lib/access.ts`
- Test: `src/app/report/_lib/access.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 Task)
- Produces:
  ```ts
  export type SearchParams = Record<string, string | string[] | undefined>;
  export type ProfileParam =
    | { kind: "absent" }
    | { kind: "invalid" }
    | { kind: "id"; id: string };
  export function parseProfileParam(searchParams: SearchParams): ProfileParam;
  ```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/report/_lib/access.test.ts` 의 import 줄을 바꾸고, 파일 끝에 describe 를 추가한다.

```ts
// 1번째 줄의 import 를 이렇게 바꾼다
import { getReportAccess, parseProfileParam } from "./access";
```

```ts
// 파일 맨 끝에 추가
describe("parseProfileParam", () => {
  it("파라미터가 없으면 absent — 픽스처 데모로 간다", () => {
    expect(parseProfileParam({})).toEqual({ kind: "absent" });
  });

  it("순번 id 는 문자열 그대로 통과", () => {
    expect(parseProfileParam({ profile: "12" })).toEqual({ kind: "id", id: "12" });
  });

  it("배열 쿼리값도 첫 값으로 처리", () => {
    expect(parseProfileParam({ profile: ["7", "8"] })).toEqual({ kind: "id", id: "7" });
  });

  // ::bigint 캐스팅 전에 막지 않으면 잘못된 값 하나가 DB 에러 → 500 이 된다.
  it.each(["abc", "1 OR 1=1", "", "-1", "1.5", "1e3", " 12"])(
    "%o 는 invalid — DB 를 건드리지 않는다",
    (raw) => {
      expect(parseProfileParam({ profile: raw })).toEqual({ kind: "invalid" });
    },
  );
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/report/_lib/access.test.ts`
Expected: FAIL — `parseProfileParam is not a function` (또는 import 에러)

- [ ] **Step 3: 최소 구현**

`src/app/report/_lib/access.ts` 의 기존 `type SearchParams` 선언에 `export` 를 붙이고, 파일 끝에 추가한다.

```ts
// 기존 11번째 줄을 export 한다 — page.tsx 가 같은 타입을 쓴다.
export type SearchParams = Record<string, string | string[] | undefined>;
```

```ts
// 파일 맨 끝에 추가
/**
 * ?profile 해석.
 *  - absent  : 파라미터 없음 → 픽스처 데모
 *  - invalid : 있지만 순번 id 형태가 아님 → notFound
 * 둘을 가르는 이유: 잘못된 값을 데모로 떨어뜨리면 사용자는 남의 리포트를 보고 있다고 오해한다.
 * 형식 검사를 여기서 하는 이유: URL 문자열을 그대로 ::bigint 로 캐스팅하면 DB 에러 → 500 이다.
 */
export type ProfileParam =
  | { kind: "absent" }
  | { kind: "invalid" }
  | { kind: "id"; id: string };

export function parseProfileParam(searchParams: SearchParams): ProfileParam {
  const raw = first(searchParams.profile);
  if (raw === undefined) return { kind: "absent" };
  return /^\d+$/.test(raw) ? { kind: "id", id: raw } : { kind: "invalid" };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/report/_lib/access.test.ts`
Expected: PASS (기존 `getReportAccess` 5개 + 새 케이스 전부)

- [ ] **Step 5: 커밋**

```bash
git add src/app/report/_lib/access.ts src/app/report/_lib/access.test.ts
git commit -m "$(cat <<'EOF'
feat(report): ?profile 파라미터 파싱 추가

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012NsoCxUmhB3Lv5duP8kuep
EOF
)"
```

---

### Task 2: `getProfile` — 프로필 단건 조회

`profiles.id` 는 순번 `bigint` 라 URL에 노출된다. **`user_id` 를 함께 필터하지 않으면 쿼리 파라미터를 증가시켜 남의 생년월일을 읽을 수 있다** (`docs/issues/backlog.md` 경고 항목). 이 Task의 존재 이유가 그 조건 하나다.

**Files:**
- Modify: `src/lib/profiles/store.ts`
- Test: `src/lib/profiles/store.test.ts`

**Interfaces:**
- Consumes: 기존 `ProfileRow`, `toProfileRow`, `SqlClient`, `PRODUCT_FULL_REPORT`
- Produces:
  ```ts
  export async function getProfile(
    userId: string,
    id: string,
    client?: SqlClient,
  ): Promise<ProfileRow | null>;
  ```

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/profiles/store.test.ts` 의 import 목록에 `getProfile` 을 추가하고, 파일 끝에 describe 를 추가한다.

```ts
// import 목록에 추가 (알파벳 순: createProfile 다음, listProfiles 앞)
  getProfile,
```

```ts
// 파일 맨 끝에 추가
describe("getProfile", () => {
  it("행이 있으면 ProfileRow 로 접는다", async () => {
    const { client, calls } = fakeClient([{ ...dbRow, is_paid: true }]);
    const row = await getProfile("7", "3", client);

    expect(row?.id).toBe("3");
    expect(row?.isPaid).toBe(true);
    expect(calls[0].sql).toContain("LEFT JOIN purchases");
  });

  // id 만으로 찾으면 쿼리 파라미터를 증가시켜 남의 생년월일을 읽을 수 있다.
  // 이 회귀를 여기서 잡는다.
  it("user_id 를 함께 필터한다", async () => {
    const { client, calls } = fakeClient([]);
    await getProfile("7", "3", client);

    expect(calls[0].sql).toContain("p.user_id");
    // 바인딩 순서는 템플릿에 나타난 순서다 — product(JOIN 조건) → id → user_id.
    expect(calls[0].values).toEqual(["full_report", "3", "7"]);
  });

  it("행이 없으면 null — 없는 프로필과 남의 프로필을 구분하지 않는다", async () => {
    const { client } = fakeClient([]);
    expect(await getProfile("7", "3", client)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/profiles/store.test.ts`
Expected: FAIL — `getProfile` export 없음

- [ ] **Step 3: 최소 구현**

`src/lib/profiles/store.ts` 의 `listProfiles` 바로 아래에 추가한다.

```ts
/**
 * 내 프로필 하나. isPaid 파생은 listProfiles 와 같다.
 *
 * ⚠️ user_id 조건이 이 함수의 존재 이유다. profiles.id 는 순번 bigint 라
 * URL(/report?profile=<id>)에 노출된다 — id 만으로 찾으면 파라미터를 증가시켜
 * 남의 생년월일을 읽을 수 있다.
 *
 * id 는 호출자가 형식을 검증해 넘긴다(parseProfileParam). 검증 없이 오면
 * ::bigint 캐스팅에서 DB 에러가 난다.
 */
export async function getProfile(
  userId: string,
  id: string,
  client: SqlClient = sql,
): Promise<ProfileRow | null> {
  const rows = await client`
    SELECT p.*, (pu.id IS NOT NULL) AS is_paid
    FROM profiles p
    LEFT JOIN purchases pu
      ON pu.profile_id = p.id
     AND pu.product = ${PRODUCT_FULL_REPORT}
     AND pu.status = 'paid'
    WHERE p.id = ${id}::bigint AND p.user_id = ${userId}::bigint
  `;
  const row = rows[0];
  return row ? toProfileRow(row) : null;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/profiles/store.test.ts`
Expected: PASS (기존 케이스 포함 전부)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/profiles/store.ts src/lib/profiles/store.test.ts
git commit -m "$(cat <<'EOF'
feat(profiles): 프로필 단건 조회 추가 (user_id 필터 필수)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012NsoCxUmhB3Lv5duP8kuep
EOF
)"
```

---

### Task 3: `regions.ts` 를 공용 자리로 이동

리포트가 서버에서 경도를 풀어야 하므로 더 이상 퍼널 전용이 아니다. `report/_lib` → `funnel/_lib` 역방향 import 를 만들지 않으려고 옮긴다. **순수 이동이다 — 파일 내용은 한 글자도 바꾸지 않는다.**

**Files:**
- Move: `src/app/funnel/_lib/regions.ts` → `src/lib/regions.ts`
- Move: `src/app/funnel/_lib/regions.test.ts` → `src/lib/regions.test.ts`
- Modify: `src/app/funnel/_lib/toBirthInput.ts`
- Modify: `src/app/funnel/_lib/locale.ts`
- Modify: `src/app/funnel/_context/FunnelContext.tsx`
- Modify: `src/app/funnel/_components/steps/ReviewStep.tsx`
- Modify: `src/app/funnel/_components/steps/BirthPlaceStep.tsx`

**Interfaces:**
- Consumes: 없음
- Produces: `@/lib/regions` 에서 `Country`, `Region`, `KR_REGIONS`, `JP_REGIONS`, `DEFAULT_REGION_ID`, `getRegions`, `findRegion`, `resolveLongitude` (이름·시그니처 전부 그대로)

- [ ] **Step 1: 파일을 옮긴다**

```bash
git mv src/app/funnel/_lib/regions.ts src/lib/regions.ts
git mv src/app/funnel/_lib/regions.test.ts src/lib/regions.test.ts
```

`src/lib/regions.test.ts` 의 `from "./regions"` 는 그대로 둔다 — 같이 옮겼으므로 상대 경로가 여전히 맞는다.

- [ ] **Step 2: 깨진 import 를 확인한다**

Run: `npm run typecheck`
Expected: FAIL — 아래 5개 파일에서 `Cannot find module './regions'` / `'../_lib/regions'` / `'../../_lib/regions'`

- [ ] **Step 3: import 경로 5곳을 고친다**

| 파일 | 기존 | 변경 |
| --- | --- | --- |
| `src/app/funnel/_lib/toBirthInput.ts` | `from "./regions"` | `from "@/lib/regions"` |
| `src/app/funnel/_lib/locale.ts` | `from "./regions"` | `from "@/lib/regions"` |
| `src/app/funnel/_context/FunnelContext.tsx` | `from "../_lib/regions"` | `from "@/lib/regions"` |
| `src/app/funnel/_components/steps/ReviewStep.tsx` | `from "../../_lib/regions"` | `from "@/lib/regions"` |
| `src/app/funnel/_components/steps/BirthPlaceStep.tsx` | `from "../../_lib/regions"` | `from "@/lib/regions"` |

각 줄에서 경로 문자열만 바꾼다. import 하는 이름들은 건드리지 않는다.

- [ ] **Step 4: 이동이 동작을 바꾸지 않았음을 확인한다**

Run: `npm run typecheck && npm test && npm run lint`
Expected: 전부 PASS. `regions.test.ts` 를 포함해 기존 테스트가 **수정 없이** 통과해야 한다 — 하나라도 깨지면 순수 이동이 아니었다는 뜻이므로 되돌린다.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(regions): 지역 데이터를 공용 lib 으로 이동

리포트가 서버에서 경도를 풀어야 해 더 이상 퍼널 전용이 아니다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012NsoCxUmhB3Lv5duP8kuep
EOF
)"
```

---

### Task 4: `toBirthInput(profile)` — 저장된 프로필 → 계산 입력

퍼널의 동명 함수(`src/app/funnel/_lib/toBirthInput.ts`, `FunnelData` 기준)와 나란한 자리다. 이쪽은 DB 행 기준.

**Files:**
- Create: `src/app/report/_lib/to-birth-input.ts`
- Test: `src/app/report/_lib/to-birth-input.test.ts`

**Interfaces:**
- Consumes: `ProfileRow` (Task 2 의 `getProfile` 이 돌려주는 타입), `@/lib/regions` 의 `findRegion` / `Country` (Task 3)
- Produces: `export function toBirthInput(profile: ProfileRow): BirthInput;`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// src/app/report/_lib/to-birth-input.test.ts
import { describe, it, expect } from "vitest";
import type { ProfileRow } from "@/lib/profiles/store";
import { toBirthInput } from "./to-birth-input";

const base: ProfileRow = {
  id: "3",
  name: "홍길동",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1990, month: 2, day: 20 },
  timeKnown: true,
  time: { hour: 4, minute: 30 },
  birthPlace: { country: "KR", regionId: "busan" },
  trueSolar: true,
  createdAt: "2026-07-31T00:00:00.000Z",
  isPaid: false,
};

describe("toBirthInput", () => {
  it("생년월일·성별·달력을 그대로 옮긴다", () => {
    expect(toBirthInput(base)).toMatchObject({
      year: 1990,
      month: 2,
      day: 20,
      hour: 4,
      minute: 30,
      calendar: "solar",
      gender: "male",
    });
  });

  it("출생지가 있으면 그 지역 대표 경도를 쓴다", () => {
    // 부산 = 129.08 (src/lib/regions.ts)
    expect(toBirthInput(base).longitude).toBe(129.08);
  });

  // 퍼널은 브라우저 로케일로 국가 기본값을 골랐지만 서버에는 그 정보가 없고
  // 저장된 프로필에도 남아 있지 않다. saju-core 기본값(127, 서울)에 맡긴다.
  it("출생지를 건너뛴 프로필은 longitude 를 넘기지 않는다", () => {
    expect(toBirthInput({ ...base, birthPlace: null }).longitude).toBeUndefined();
  });

  it("모르는 지역·국가면 longitude 를 넘기지 않는다", () => {
    expect(
      toBirthInput({ ...base, birthPlace: { country: "KR", regionId: "atlantis" } }).longitude,
    ).toBeUndefined();
    expect(
      toBirthInput({ ...base, birthPlace: { country: "US", regionId: "hawaii" } }).longitude,
    ).toBeUndefined();
  });

  it("시간을 모르면 hour·minute 이 undefined — 시주가 생기지 않는다", () => {
    const input = toBirthInput({ ...base, timeKnown: false, time: null });
    expect(input.hour).toBeUndefined();
    expect(input.minute).toBeUndefined();
  });

  it("음력일 때만 isLeapMonth 를 넘긴다", () => {
    expect(toBirthInput({ ...base, calendar: "lunar", isLeapMonth: true }).isLeapMonth).toBe(true);
    expect(toBirthInput({ ...base, calendar: "solar", isLeapMonth: true }).isLeapMonth).toBeUndefined();
  });

  it("trueSolar 를 applyTimeCorrection 으로 넘긴다", () => {
    expect(toBirthInput(base).applyTimeCorrection).toBe(true);
    expect(toBirthInput({ ...base, trueSolar: false }).applyTimeCorrection).toBe(false);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/report/_lib/to-birth-input.test.ts`
Expected: FAIL — `Cannot find module './to-birth-input'`

- [ ] **Step 3: 최소 구현**

```ts
// src/app/report/_lib/to-birth-input.ts
import type { BirthInput } from "@/lib/saju-core";
import type { ProfileRow } from "@/lib/profiles/store";
import { findRegion, type Country } from "@/lib/regions";

/** ProfileRow.birthPlace.country 는 DB 에서 온 string 이라 좁혀서 쓴다. */
function toCountry(v: string): Country | null {
  return v === "KR" || v === "JP" ? v : null;
}

/**
 * 저장된 프로필을 사주 계산 입력으로 되돌린다.
 * 퍼널의 toBirthInput(FunnelData 기준)과 나란한 자리 — 이쪽은 DB 행 기준이다.
 */
export function toBirthInput(profile: ProfileRow): BirthInput {
  const { birth, time, birthPlace } = profile;
  const country = birthPlace ? toCountry(birthPlace.country) : null;

  return {
    year: birth.year,
    month: birth.month,
    day: birth.day,
    hour: time?.hour,
    minute: time?.minute,
    calendar: profile.calendar,
    isLeapMonth: profile.calendar === "lunar" ? profile.isLeapMonth : undefined,
    gender: profile.gender,
    // 출생지를 건너뛴(또는 모르는 지역인) 프로필은 경도를 남기지 않는다 —
    // saju-core 가 기본값 127(서울)을 쓴다. 퍼널은 브라우저 로케일로 국가
    // 기본값을 골랐지만 서버에는 그 정보가 없다.
    longitude: country && birthPlace
      ? findRegion(country, birthPlace.regionId)?.lon
      : undefined,
    applyTimeCorrection: profile.trueSolar,
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/report/_lib/to-birth-input.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/app/report/_lib/to-birth-input.ts src/app/report/_lib/to-birth-input.test.ts
git commit -m "$(cat <<'EOF'
feat(report): 저장된 프로필을 사주 계산 입력으로 되돌린다

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012NsoCxUmhB3Lv5duP8kuep
EOF
)"
```

---

### Task 5: `toReportMeta` — 히어로 상단 한 줄

`"양력 1990.02.20 04:30 · 갑자일주"`.

**날짜는 `profile.birth`(사용자가 입력한 그대로)에서 온다. `chart.solar` 를 쓰면 안 된다** — 음력 입력은 거기서 양력으로 환산돼 있어서 `"음력"` 라벨에 환산된 양력 날짜가 붙는다. `/home` 카드도 입력값을 보여주므로 두 화면이 같은 날짜를 말하게 된다. `chart` 를 받는 이유는 일주(`chart.day.korean`) 하나다.

**Files:**
- Create: `src/app/report/_lib/to-meta.ts`
- Test: `src/app/report/_lib/to-meta.test.ts`

**Interfaces:**
- Consumes: `ProfileRow`, `Chart` (`@/lib/saju-core`)
- Produces: `export function toReportMeta(profile: ProfileRow, chart: Chart): { name: string; birthLine: string };`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// src/app/report/_lib/to-meta.test.ts
import { describe, it, expect } from "vitest";
import { analyze } from "@/lib/saju-core";
import type { ProfileRow } from "@/lib/profiles/store";
import { toReportMeta } from "./to-meta";

const base: ProfileRow = {
  id: "3",
  name: "홍길동",
  gender: "male",
  calendar: "solar",
  isLeapMonth: false,
  birth: { year: 1990, month: 2, day: 20 },
  timeKnown: true,
  time: { hour: 4, minute: 30 },
  birthPlace: { country: "KR", regionId: "seoul" },
  trueSolar: true,
  createdAt: "2026-07-31T00:00:00.000Z",
  isPaid: false,
};

const chart = analyze({
  year: 1990, month: 2, day: 20, hour: 4, minute: 30, gender: "male",
}).chart;

// 일주는 만세력 계산 결과다 — 여기 값을 손으로 박으면 saju-core 를 테스트하게 된다.
const ilju = `${chart.day.korean}일주`;

describe("toReportMeta", () => {
  it("이름은 그대로 옮긴다", () => {
    expect(toReportMeta(base, chart).name).toBe("홍길동");
  });

  it("양력·날짜·시각·일주를 한 줄로", () => {
    expect(toReportMeta(base, chart).birthLine).toBe(`양력 1990.02.20 04:30 · ${ilju}`);
  });

  it("월·일·시·분을 두 자리로 채운다", () => {
    const p = { ...base, birth: { year: 2001, month: 3, day: 5 }, time: { hour: 9, minute: 7 } };
    expect(toReportMeta(p, chart).birthLine).toBe(`양력 2001.03.05 09:07 · ${ilju}`);
  });

  // 환산된 양력을 "음력"이라 적으면 사용자가 자기 입력을 알아보지 못한다.
  it("음력은 사용자가 입력한 음력 날짜를 그대로 쓴다", () => {
    const p = { ...base, calendar: "lunar" as const, birth: { year: 1963, month: 4, day: 12 } };
    expect(toReportMeta(p, chart).birthLine).toBe(`음력 1963.04.12 04:30 · ${ilju}`);
  });

  it("윤달을 표기한다", () => {
    const p = {
      ...base,
      calendar: "lunar" as const,
      isLeapMonth: true,
      birth: { year: 1963, month: 4, day: 12 },
    };
    expect(toReportMeta(p, chart).birthLine).toBe(`음력 1963.04.12 윤달 04:30 · ${ilju}`);
  });

  // 00:00 으로 적으면 자시 출생으로 읽힌다.
  it("시간을 모르면 시각을 뺀다", () => {
    const p = { ...base, timeKnown: false, time: null };
    expect(toReportMeta(p, chart).birthLine).toBe(`양력 1990.02.20 · ${ilju}`);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/report/_lib/to-meta.test.ts`
Expected: FAIL — `Cannot find module './to-meta'`

- [ ] **Step 3: 최소 구현**

```ts
// src/app/report/_lib/to-meta.ts
import type { Chart } from "@/lib/saju-core";
import type { ProfileRow } from "@/lib/profiles/store";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 히어로 상단 한 줄. "양력 1990.02.20 04:30 · 갑자일주"
 *
 * 날짜는 chart.solar 가 아니라 profile.birth 에서 온다 — 음력 입력은 chart 에서
 * 양력으로 환산돼 있어서, 그걸 쓰면 "음력" 라벨에 환산된 양력 날짜가 붙는다.
 * /home 카드도 입력값을 보여주므로 두 화면이 같은 날짜를 말해야 한다.
 * chart 를 받는 이유는 일주 하나다.
 */
export function toReportMeta(
  profile: ProfileRow,
  chart: Chart,
): { name: string; birthLine: string } {
  const { year, month, day } = profile.birth;
  const isLunar = profile.calendar === "lunar";
  const calendar = isLunar ? "음력" : "양력";
  const leap = isLunar && profile.isLeapMonth ? " 윤달" : "";
  // 시각을 00:00 으로 적으면 자시 출생으로 읽힌다. 모르면 통째로 뺀다.
  const time = profile.time ? ` ${pad(profile.time.hour)}:${pad(profile.time.minute)}` : "";

  return {
    name: profile.name,
    birthLine: `${calendar} ${year}.${pad(month)}.${pad(day)}${leap}${time} · ${chart.day.korean}일주`,
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/report/_lib/to-meta.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/app/report/_lib/to-meta.ts src/app/report/_lib/to-meta.test.ts
git commit -m "$(cat <<'EOF'
feat(report): 히어로 생년월일 한 줄 조립

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012NsoCxUmhB3Lv5duP8kuep
EOF
)"
```

---

### Task 6: `produceSections` 추출

`/report` 가 `handleSaju(raw: unknown, deps)` 를 부르려면 이미 검증된 `ProfileRow` 를 다시 요청 본문 모양으로 되말아야 한다. 대신 **캐시 조회 → 없는 것만 생성 → 검증 → 저장** 부분을 함수로 뽑는다.

**순수 리팩터링이다. 기존 `handler.test.ts` 가 수정 없이 통과해야 한다.**

**Files:**
- Create: `src/app/api/saju/_lib/produce.ts`
- Create: `src/app/api/saju/_lib/produce.test.ts`
- Modify: `src/app/api/saju/_lib/handler.ts`
- Unchanged (증거로 쓴다): `src/app/api/saju/_lib/handler.test.ts`

**Interfaces:**
- Consumes: 기존 `chartKey` / `luckKey` / `pillarsJson`, `store` 의 `toSectionWrites` · `CachedSections` · `CacheRecord` · `SectionWrite`, `sections` 의 `assign` · `isSectionKey` · `parseSectionContent` · `sectionStorage`
- Produces:
  ```ts
  export class GenerationError extends Error {
    readonly partial: Partial<Interpretation>;
  }
  export interface ProduceDeps {
    generator: InterpretationGenerator;
    getCached: (chartKey: string, keys: SectionKey[]) => Promise<CachedSections>;
    putCached: (record: CacheRecord) => Promise<void>;
    getLuckCached: (luckKey: string, keys: SectionKey[]) => Promise<CachedSections>;
    putLuckSections: (luckKey: string, sections: SectionWrite[], model: string) => Promise<void>;
    sectionKeys: SectionKey[];
    year: number;
  }
  export async function produceSections(
    analysis: SajuAnalysis,
    deps: ProduceDeps,
  ): Promise<{ interpretation: Partial<Interpretation>; cached: boolean }>;
  ```
  그리고 `handler.ts` 는 `export type HandlerDeps = ProduceDeps;` 로 기존 이름을 유지한다 (`handler.test.ts` 가 import 한다).

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// src/app/api/saju/_lib/produce.test.ts
import { describe, it, expect, vi } from "vitest";
import { analyze } from "@/lib/saju-core";
import { StubGenerator } from "./generate";
import { GenerationError, produceSections, type ProduceDeps } from "./produce";

const analysis = analyze({
  year: 1990, month: 5, day: 15, hour: 10, gender: "male",
});

const overview = { headline: "캐시", summary: "캐시된 요약", keywords: ["a", "b", "c"] };
const empty = { have: {}, missing: [] as never[] };

function deps(over: Partial<ProduceDeps> = {}): ProduceDeps {
  return {
    generator: new StubGenerator(),
    getCached: vi.fn().mockResolvedValue({ have: {}, missing: ["overview"] }),
    putCached: vi.fn().mockResolvedValue(undefined),
    getLuckCached: vi.fn().mockResolvedValue(empty),
    putLuckSections: vi.fn().mockResolvedValue(undefined),
    sectionKeys: ["overview"],
    year: 2026,
    ...over,
  };
}

describe("produceSections", () => {
  it("캐시 HIT: 생성기·저장 호출 없이 cached=true", async () => {
    const d = deps({
      getCached: vi.fn().mockResolvedValue({ have: { overview }, missing: [] }),
      generator: { model: "stub", generateSections: vi.fn() },
    });
    const res = await produceSections(analysis, d);

    expect(res).toEqual({ interpretation: { overview }, cached: true });
    expect(d.generator.generateSections).not.toHaveBeenCalled();
    expect(d.putCached).not.toHaveBeenCalled();
  });

  it("캐시 MISS: 없는 섹션만 생성해 저장하고 cached=false", async () => {
    const d = deps();
    const res = await produceSections(analysis, d);

    expect(res.cached).toBe(false);
    expect(res.interpretation.overview).toBeDefined();
    expect(d.putCached).toHaveBeenCalledOnce();
  });

  it("luck 섹션은 luck 저장소로 간다", async () => {
    const d = deps({
      sectionKeys: ["yearlyLuck"],
      getCached: vi.fn().mockResolvedValue(empty),
      getLuckCached: vi.fn().mockResolvedValue({ have: {}, missing: ["yearlyLuck"] }),
    });
    await produceSections(analysis, d);

    expect(d.putLuckSections).toHaveBeenCalledOnce();
    expect(d.putCached).not.toHaveBeenCalled();
  });

  // /report 가 "캐시에 있던 것만이라도 보여준다"를 하려면 실패 시점의 캐시가 필요하다.
  it("생성기가 실패하면 GenerationError 를 던지고, 캐시에서 읽은 섹션을 partial 로 싣는다", async () => {
    const d = deps({
      sectionKeys: ["overview", "personality"],
      getCached: vi.fn().mockResolvedValue({ have: { overview }, missing: ["personality"] }),
      generator: {
        model: "stub",
        generateSections: vi.fn().mockRejectedValue(new Error("LLM down")),
      },
    });

    // .catch(e => e) 로 받는다 — rejects.toBeInstanceOf 만 쓰면 partial 을 못 본다.
    const err = await produceSections(analysis, d).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GenerationError);
    expect((err as GenerationError).partial).toEqual({ overview });
    expect(d.putCached).not.toHaveBeenCalled();
  });

  // DB 오류는 GenerationError 가 아니다 — 호출자가 502 와 500 을 갈라야 한다.
  it("캐시 조회가 실패하면 그대로 전파한다", async () => {
    const d = deps({ getCached: vi.fn().mockRejectedValue(new Error("db down")) });

    await expect(produceSections(analysis, d)).rejects.toThrow("db down");
    await expect(produceSections(analysis, d)).rejects.not.toBeInstanceOf(GenerationError);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/produce.test.ts`
Expected: FAIL — `Cannot find module './produce'`

- [ ] **Step 3: `produce.ts` 를 만든다**

`handler.ts` 의 3~5단계를 **동작을 바꾸지 않고** 옮긴다.

```ts
// src/app/api/saju/_lib/produce.ts
import type { SajuAnalysis } from "@/lib/saju-core";
import { chartKey, luckKey, pillarsJson } from "./key";
import { toSectionWrites, type CachedSections, type CacheRecord, type SectionWrite } from "./store";
import {
  assign,
  isSectionKey,
  parseSectionContent,
  sectionStorage,
  type Interpretation,
  type SectionKey,
} from "./sections";
import type { InterpretationGenerator } from "./types";

/**
 * 생성기(LLM) 호출 실패. DB 오류와 구분해야 호출자가 다르게 대응한다
 * (라우트는 502, 리포트는 캐시된 것만으로 계속).
 *
 * partial 은 실패 직전 캐시에서 읽어둔 섹션들이다. 이걸 싣지 않으면 호출자가
 * 이미 확보한 해석까지 통째로 잃는다.
 */
export class GenerationError extends Error {
  constructor(
    cause: unknown,
    readonly partial: Partial<Interpretation>,
  ) {
    super("해석 생성에 실패했습니다", { cause });
    this.name = "GenerationError";
  }
}

export interface ProduceDeps {
  generator: InterpretationGenerator;
  getCached: (chartKey: string, keys: SectionKey[]) => Promise<CachedSections>;
  putCached: (record: CacheRecord) => Promise<void>;
  getLuckCached: (luckKey: string, keys: SectionKey[]) => Promise<CachedSections>;
  putLuckSections: (luckKey: string, sections: SectionWrite[], model: string) => Promise<void>;
  /** 요청할 섹션. 무료/유료 결정은 호출자 몫이다. */
  sectionKeys: SectionKey[];
  /** 세운·대운의 기준 연도 */
  year: number;
}

const splitByStorage = (keys: SectionKey[]) => ({
  chart: keys.filter((k) => sectionStorage(k) === "chart"),
  luck: keys.filter((k) => sectionStorage(k) === "luck"),
});

/**
 * 해석 섹션을 확보한다: 캐시에 있는 건 그대로, 없는 것만 생성·검증·저장.
 * 입력 파싱도 상태 코드 매핑도 하지 않는다 — 그건 호출자 몫이다.
 */
export async function produceSections(
  analysis: SajuAnalysis,
  deps: ProduceDeps,
): Promise<{ interpretation: Partial<Interpretation>; cached: boolean }> {
  // 저장소가 갈리므로 두 곳을 함께 본다 (DB 오류는 상위로 전파)
  const wanted = splitByStorage(deps.sectionKeys);
  const cKey = chartKey(analysis.chart);
  const lKey = luckKey(analysis, deps.year);
  const [chartCache, luckCache] = await Promise.all([
    deps.getCached(cKey, wanted.chart),
    deps.getLuckCached(lKey, wanted.luck),
  ]);

  const interpretation: Partial<Interpretation> = { ...chartCache.have, ...luckCache.have };
  const missing = [...chartCache.missing, ...luckCache.missing];

  if (missing.length === 0) return { interpretation, cached: true };

  // 없는 섹션만 생성. 생성기가 일부를 빠뜨려도 나머지로 진행한다
  // (섹션 단위 실패는 다음 요청에서 missing 으로 다시 잡힌다).
  let generated: Partial<Interpretation>;
  try {
    generated = await deps.generator.generateSections(analysis, missing, { year: deps.year });
  } catch (e) {
    throw new GenerationError(e, interpretation);
  }

  // 생성기가 반환한 값은 무엇이든 여기서 한 번 걸러야 한다 — 이 결과가 응답과
  // 저장 양쪽에 그대로 쓰이므로, 한쪽에서만 검증하면 다른 쪽은 새는 채로 남는다.
  //  - missing 에 없는 키는 버린다: 요청하지 않은 섹션이 섞이거나
  //    이미 검증된 캐시 값을 덮어쓰지 않게 한다.
  //  - 자기 스키마에 안 맞는 값은 버리고 warn: 어댑터의 규율에 기대지 않고
  //    여기서 막는다. 떨어진 섹션은 다음 요청에서 다시 시도된다.
  const validated: Partial<Interpretation> = {};
  for (const key of missing) {
    const raw = generated[key];
    if (raw === undefined) continue;
    const parsed = parseSectionContent(key, raw);
    if (parsed === null) {
      console.warn(`[produceSections] 섹션 검증 실패, 건너뜀: ${key}`);
      continue;
    }
    assign(validated, key, parsed);
  }
  Object.assign(interpretation, validated);

  // 저장 (멱등) — 검증까지 통과한 것만, 저장소별로 나눠서
  const produced = splitByStorage(Object.keys(validated).filter(isSectionKey));
  const chartProduced = Object.fromEntries(
    produced.chart.map((k) => [k, validated[k]]),
  ) as Partial<Interpretation>;

  if (produced.chart.length > 0) {
    await deps.putCached({
      chartKey: cKey,
      gender: analysis.chart.gender,
      pillars: pillarsJson(analysis.chart),
      interpretation: chartProduced,
      model: deps.generator.model,
    });
  }
  if (produced.luck.length > 0) {
    await deps.putLuckSections(
      lKey,
      toSectionWrites(Object.fromEntries(produced.luck.map((k) => [k, validated[k]]))),
      deps.generator.model,
    );
  }

  return { interpretation, cached: false };
}
```

- [ ] **Step 4: 새 테스트가 통과하는지 확인한다**

Run: `npx vitest run src/app/api/saju/_lib/produce.test.ts`
Expected: PASS

- [ ] **Step 5: `handler.ts` 를 축소한다**

파일 전체를 아래로 교체한다.

```ts
// src/app/api/saju/_lib/handler.ts
import { analyze } from "@/lib/saju-core";
import { parseRequest, ValidationError } from "./input";
import { GenerationError, produceSections, type ProduceDeps } from "./produce";
import type { ErrorResponse, SajuResponse } from "./types";

/** 생성에 필요한 것과 같다. 이름은 기존 호출부·테스트가 쓰던 것을 유지한다. */
export type HandlerDeps = ProduceDeps;

export interface HandlerResult {
  status: number;
  body: SajuResponse | ErrorResponse;
}

export async function handleSaju(raw: unknown, deps: HandlerDeps): Promise<HandlerResult> {
  // 1. 입력 검증
  let parsed;
  try {
    parsed = parseRequest(raw);
  } catch (e) {
    if (e instanceof ValidationError) return { status: 400, body: { error: e.message } };
    throw e;
  }

  // 2. 만세력 계산 (결정적)
  let analysis;
  try {
    analysis = analyze(parsed.input);
  } catch (e) {
    console.error("[handleSaju] 원국 계산 실패", e);
    return { status: 422, body: { error: "생년월일시를 확인해 주세요" } };
  }

  // 3. 해석 확보. 생성 실패는 502 — 캐시된 일부가 있어도 API 는 부분 응답을 하지 않는다
  //    (화면과 달리 호출자가 무엇을 받을지 모른다). DB 오류는 전파해 500 이 된다.
  let produced;
  try {
    produced = await produceSections(analysis, deps);
  } catch (e) {
    if (e instanceof GenerationError) return { status: 502, body: { error: e.message } };
    throw e;
  }

  return {
    status: 200,
    body: {
      name: parsed.name,
      analysis,
      interpretation: produced.interpretation,
      cached: produced.cached,
    },
  };
}
```

- [ ] **Step 6: 기존 테스트가 수정 없이 통과하는지 확인한다**

Run: `npx vitest run src/app/api/saju/ && npm run typecheck && npm run lint`
Expected: PASS — 특히 `handler.test.ts` 15개가 **한 줄도 고치지 않고** 통과해야 한다. 하나라도 깨지면 리팩터링이 동작을 바꾼 것이므로 되돌린다.

> 참고: 섹션 검증 실패 시 `console.warn` 접두사가 `[handleSaju]` → `[produceSections]` 로 바뀐다. `handler.test.ts` 는 `expect.stringContaining("overview")` 로만 검사하므로 영향이 없다.

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/saju/_lib/produce.ts src/app/api/saju/_lib/produce.test.ts src/app/api/saju/_lib/handler.ts
git commit -m "$(cat <<'EOF'
refactor(saju): 해석 확보 로직을 produceSections 로 추출

/report 가 HTTP 왕복 없이 같은 경로를 쓰게 하려는 준비. handler.test.ts 는
수정 없이 통과한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012NsoCxUmhB3Lv5duP8kuep
EOF
)"
```

---

### Task 7: `ReportView` 를 셸과 본문으로 분해

헤더가 `<Suspense>` **밖**에 있어야 스트리밍이 의미가 있다. 지금은 래퍼 div + 헤더 + `<main>` 을 한 컴포넌트가 쥐고 있다.

**화면은 바뀌지 않는다** — 마크업을 두 파일로 가르기만 한다.

**Files:**
- Create: `src/app/report/_components/ReportShell.tsx`
- Create: `src/app/report/_components/ReportBody.tsx`
- Delete: `src/app/report/_components/ReportView.tsx`
- Modify: `src/app/report/page.tsx`

**Interfaces:**
- Consumes: 기존 섹션 컴포넌트들 (`ReportHero`, `PersonalitySection` …), `lockedSections`
- Produces:
  ```ts
  export function ReportShell(props: { showHomeLink: boolean; children: React.ReactNode }): JSX.Element;
  export function ReportBody(props: { content: ReportContent; access: ReportAccess }): JSX.Element;
  ```

- [ ] **Step 1: `ReportShell.tsx` 를 만든다**

```tsx
// src/app/report/_components/ReportShell.tsx
import type { ReactNode } from "react";
import { ReportHeader } from "./ReportHeader";

/**
 * 헤더까지의 껍데기. 본문을 children 으로 받는 이유는 스트리밍이다 —
 * 본문이 <Suspense> 안에서 늦게 도착해도 헤더는 즉시 그려져야 한다.
 * 에러 화면·대기 화면도 이 안에 들어간다(헤더가 있어야 /home 으로 나갈 수 있다).
 */
export function ReportShell({
  showHomeLink,
  children,
}: {
  showHomeLink: boolean;
  children: ReactNode;
}) {
  return (
    <div className="bg-white min-h-screen text-slate-900 leading-normal break-keep [overflow-wrap:break-word]">
      <ReportHeader showHomeLink={showHomeLink} />
      <main className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] pt-[clamp(36px,7vw,64px)] pb-24">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: `ReportBody.tsx` 를 만든다**

`ReportView.tsx` 의 `<main>` 안쪽 내용물을 그대로 옮긴다.

```tsx
// src/app/report/_components/ReportBody.tsx
import type { ReportContent } from "../_lib/report-content";
import type { ReportAccess } from "../_lib/access";
import { lockedSections } from "../_lib/report-content.fixture";
import { ReportHero } from "./ReportHero";
import { PersonalitySection } from "./PersonalitySection";
import { OuterInnerSection } from "./OuterInnerSection";
import { StrengthsSection } from "./StrengthsSection";
import { CautionsSection } from "./CautionsSection";
import { LockedSections } from "./LockedSections";
import { EmotionSection } from "./EmotionSection";
import { RelatingSection } from "./RelatingSection";
import { EnvironmentSection } from "./EnvironmentSection";
import { LoveSection } from "./LoveSection";
import { CompatibilitySection } from "./CompatibilitySection";
import { WealthSection } from "./WealthSection";
import { YearlyLuckSection } from "./YearlyLuckSection";
import { DaeunSection } from "./DaeunSection";

export function ReportBody({
  content,
  access,
}: {
  content: ReportContent;
  access: ReportAccess;
}) {
  return (
    <>
      <ReportHero meta={content.meta} headline={content.headline} summary={content.summary} keywords={content.keywords} />
      <PersonalitySection items={content.personality} evidence={content.evidence} />
      <OuterInnerSection data={content.outerVsInner} />
      <StrengthsSection items={content.strengths} />
      <CautionsSection cautions={content.cautions} tip={content.cautionTip} />
      {access.isPaid ? (
        <>
          {content.emotion && <EmotionSection items={content.emotion} />}
          {content.relating && <RelatingSection rows={content.relating} />}
          {/* environment(07)는 해석 레지스트리에 없어 실데이터에서는 늘 비어 있다 (백로그). */}
          {content.environment && (
            <EnvironmentSection
              axes={content.environment.axes}
              summary={content.environment.summary}
              emphasis={content.environment.emphasis}
            />
          )}
          {content.love && <LoveSection items={content.love} />}
          {content.compatibility && (
            <CompatibilitySection
              good={content.compatibility.good}
              clash={content.compatibility.clash}
            />
          )}
          {content.wealth && (
            <WealthSection
              points={content.wealth.points}
              summary={content.wealth.summary}
              emphasis={content.wealth.emphasis}
            />
          )}
          {content.yearlyLuck && <YearlyLuckSection rows={content.yearlyLuck} />}
          {content.daeunOutlook && (
            <DaeunSection
              rows={content.daeunOutlook.rows}
              summary={content.daeunOutlook.summary}
              emphasis={content.daeunOutlook.emphasis}
            />
          )}
        </>
      ) : (
        // isLoggedIn 은 2026-08-04 익명 드래프트 작업이 더한 필수 prop 이다.
        // 비로그인이면 CTA 가 /login?next=%2Freport 로 간다 — 빠뜨리면 승격 입구가 닫힌다.
        <LockedSections sections={lockedSections} isLoggedIn={access.isLoggedIn} />
      )}
    </>
  );
}
```

- [ ] **Step 3: `ReportView.tsx` 를 지우고 `page.tsx` 를 두 조각으로 바꾼다**

```bash
git rm src/app/report/_components/ReportView.tsx
```

`src/app/report/page.tsx` 의 `ReportView` import 와 return 을 교체한다 (나머지는 그대로).

```tsx
import { ReportShell } from "./_components/ReportShell";
import { ReportBody } from "./_components/ReportBody";
```

```tsx
  return (
    <ReportShell showHomeLink={session !== null}>
      <ReportBody content={sampleReport} access={access} />
    </ReportShell>
  );
```

- [ ] **Step 4: 화면이 그대로인지 확인한다**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS

Run: `npm run dev` 후 브라우저에서 `http://localhost:3000/report` 와 `http://localhost:3000/report?paid=true` 를 연다.
Expected: 분해 전과 **시각적으로 동일**. 헤더, 히어로, 01–04, 잠금 목록(또는 유료 섹션)이 전부 그대로.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(report): ReportView 를 셸과 본문으로 분해

헤더가 Suspense 밖에 있어야 본문을 스트리밍할 수 있다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012NsoCxUmhB3Lv5duP8kuep
EOF
)"
```

---

### Task 8: `/report` 실데이터 배선

앞의 일곱 조각을 잇는다. 대기 화면과 에러 화면도 여기서 만든다 — 이 페이지 말고 쓸 곳이 없다.

**읽을 것 (코드 쓰기 전):**
- `node_modules/next/dist/docs/01-app/02-guides/streaming.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`

확인해 둔 것:
- `notFound()` 는 `return` 없이 호출한다 (반환 타입이 `never`).
- `redirect()` 는 예외를 던지므로 `try` 블록 **밖**에서 호출한다.
- `/report` 는 쿠키·`searchParams` 를 읽어 동적 페이지다. Next 16 은 동적 페이지를 `loading.js` 가 있을 때만 프리페치한다 — **`loading.tsx` 를 만들지 않는다.** 만들면 `/home` 링크에 마우스만 올려도 LLM 생성이 돌 수 있고, fallback 이 `profile.name` 을 받을 수도 없다.
- `unstable_instant` 는 `cacheComponents` 를 켠 프로젝트용이다. `next.config.ts` 가 비어 있으므로 해당 없다.

**Files:**
- Create: `src/app/report/_components/AnalyzingReport.tsx`
- Create: `src/app/report/_components/ReportError.tsx`
- Modify: `src/app/report/page.tsx`

**Interfaces:**
- Consumes: `parseProfileParam` (T1), `getProfile` (T2), `toBirthInput` (T4), `toReportMeta` (T5), `produceSections` · `GenerationError` (T6), `ReportShell` · `ReportBody` (T7), 기존 `toReportContent` · `getReportAccess` · `sampleReport`
- Produces: 없음 (최종 소비자)

- [ ] **Step 1: 대기 화면을 만든다**

퍼널의 `AnalyzingScreen` 을 재사용하지 않는다 — 그쪽 문구는 "만세력 환산 · 오행 분석 중"인데, 여기서 실제로 오래 걸리는 단계는 만세력이 아니라 LLM 해석 생성이다. 진행 중이 아닌 것을 진행 중이라 말하지 않는다.

```tsx
// src/app/report/_components/AnalyzingReport.tsx
/**
 * 리포트 본문 Suspense fallback. <main> 안에 들어가므로 min-h-screen 을 쓰지 않는다.
 * 퍼널의 AnalyzingScreen 과 문구가 다른 이유: 여기서 오래 걸리는 건 만세력이 아니라
 * LLM 해석 생성이다.
 */
export function AnalyzingReport({ name }: { name: string }) {
  const who = name.trim();
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-[clamp(80px,20vw,160px)] text-center"
    >
      <div className="w-[60px] h-[60px] rounded-full border-[3px] border-slate-200 border-t-accent animate-spin" />
      <div className="text-[22px] font-bold mt-[30px] tracking-tight">리포트를 쓰고 있어요</div>
      <div className="text-[15px] text-slate-500 mt-2">
        {who ? `${who}님의 ` : ""}원국을 읽고 해석을 작성하는 중이에요
      </div>
      <div className="text-[13px] text-slate-400 mt-5">
        처음 한 번만 조금 걸려요. 다음부터는 바로 열려요.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 에러 화면을 만든다**

```tsx
// src/app/report/_components/ReportError.tsx
/**
 * 해석을 하나도 확보하지 못했을 때. <main> 안에 들어간다 —
 * 헤더는 남아 있어야 사용자가 /home 으로 나갈 수 있다.
 *
 * 다시 시도는 <a> 다. <Link> 로 같은 URL 을 누르면 클라이언트 라우터가
 * 이동으로 보지 않아 아무 일도 일어나지 않는다.
 */
export function ReportError({ retryHref }: { retryHref: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-[clamp(80px,20vw,160px)] text-center">
      <div className="text-[22px] font-bold tracking-tight">리포트를 만들지 못했어요</div>
      <p className="text-[15px] text-slate-500 mt-3 max-w-[380px]">
        해석을 쓰는 중에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.
      </p>
      <a
        href={retryHref}
        className="mt-7 rounded-xl bg-accent px-5 py-[11px] text-[14.5px] font-semibold text-white hover:opacity-90"
      >
        다시 시도
      </a>
    </div>
  );
}
```

- [ ] **Step 3: `page.tsx` 를 교체한다**

```tsx
// src/app/report/page.tsx
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { analyze } from "@/lib/saju-core";
import { getSession } from "@/lib/auth/session";
import { getProfile, type ProfileRow } from "@/lib/profiles/store";
import { createGenerator } from "@/app/api/saju/_lib/generator";
import { GenerationError, produceSections } from "@/app/api/saju/_lib/produce";
import { getCached, putCached } from "@/app/api/saju/_lib/store";
import { getLuckCached, putLuckSections } from "@/app/api/saju/_lib/store-luck";
import { FREE_SECTION_KEYS, SECTION_KEYS, type Interpretation } from "@/app/api/saju/_lib/sections";
import type { InterpretationGenerator } from "@/app/api/saju/_lib/types";
import { getReportAccess, parseProfileParam, type ReportAccess } from "./_lib/access";
import { toBirthInput } from "./_lib/to-birth-input";
import { toReportMeta } from "./_lib/to-meta";
import { toReportContent } from "./_lib/to-report-content";
import { sampleReport } from "./_lib/report-content.fixture";
import { ReportShell } from "./_components/ReportShell";
import { ReportBody } from "./_components/ReportBody";
import { AnalyzingReport } from "./_components/AnalyzingReport";
import { ReportError } from "./_components/ReportError";

/**
 * 캐시 미스면 섹션마다 LLM 을 병렬로 부른다 — /api/saju/route.ts 와 같은 값.
 * 유료 12섹션(?paid=true)은 daeunOutlook 이 느려 이 값을 넘길 수 있다.
 * 결제를 붙일 때 다시 본다.
 */
export const maxDuration = 60;

// 첫 요청에서 만든다. 모듈 로드 시점에 만들면 키가 없는 빌드 환경에서 빌드가 깨진다.
let generatorCache: InterpretationGenerator | undefined;
const generator = (): InterpretationGenerator => (generatorCache ??= createGenerator());

/** 계산·생성·조립. 여기만 느리므로 이 컴포넌트만 <Suspense> 안에 둔다. */
async function ProfileReport({
  profile,
  access,
}: {
  profile: ProfileRow;
  access: ReportAccess;
}) {
  const retryHref = `/report?profile=${profile.id}${access.isPaid ? "&paid=true" : ""}`;

  let analysis;
  try {
    analysis = analyze(toBirthInput(profile));
  } catch (e) {
    console.error("[/report] 원국 계산 실패", e);
    return <ReportError retryHref={retryHref} />;
  }

  const year = new Date().getFullYear();
  let interpretation: Partial<Interpretation>;
  try {
    ({ interpretation } = await produceSections(analysis, {
      generator: generator(),
      getCached,
      putCached,
      getLuckCached,
      putLuckSections,
      sectionKeys: access.isPaid ? SECTION_KEYS : FREE_SECTION_KEYS,
      year,
    }));
  } catch (e) {
    // 생성 실패면 캐시에 있던 것만으로 계속한다. DB 오류는 전파해 Next 기본 처리에 맡긴다.
    if (!(e instanceof GenerationError)) throw e;
    console.error("[/report] 해석 생성 실패", e);
    interpretation = e.partial;
  }

  // overview 가 없으면 히어로가 통째로 비어 리포트라 부를 것이 없다.
  // 그 외에는 확보한 섹션만 보여준다 — 빠진 섹션은 다음 방문에 missing 으로 다시 잡힌다.
  if (!interpretation.overview) return <ReportError retryHref={retryHref} />;

  const content = toReportContent(
    analysis,
    interpretation,
    toReportMeta(profile, analysis.chart),
    year,
  );
  return <ReportBody content={content} access={access} />;
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await getSession();
  const access = getReportAccess(sp, session);
  const param = parseProfileParam(sp);

  // ?profile=abc 처럼 형태가 틀린 값을 데모로 떨어뜨리면 사용자는 남의 리포트를
  // 보고 있다고 오해한다.
  if (param.kind === "invalid") notFound();

  // 프로필이 없으면 지금까지처럼 픽스처 데모. 익명 실데이터는 이번 범위 밖이다.
  if (param.kind === "absent") {
    return (
      <ReportShell showHomeLink={session !== null}>
        <ReportBody content={sampleReport} access={access} />
      </ReportShell>
    );
  }

  if (session === null) {
    redirect(`/login?next=${encodeURIComponent(`/report?profile=${param.id}`)}`);
  }

  const profile = await getProfile(session.userId, param.id);
  // 없는 프로필과 남의 프로필을 구분하지 않는다 — 구분하면 id 로 존재 여부를 훑을 수 있다.
  if (profile === null) notFound();

  // 결제한 프로필이면 유료 섹션을 연다. 지금은 purchases 에 행을 넣는 코드가 없어
  // 늘 false 지만, /home 카드가 같은 값으로 "전체 리포트" 배지를 띄우므로
  // 두 화면이 어긋나지 않게 여기서도 읽는다.
  const profileAccess: ReportAccess = {
    ...access,
    isPaid: access.isPaid || profile.isPaid,
  };

  return (
    <ReportShell showHomeLink>
      <Suspense fallback={<AnalyzingReport name={profile.name} />}>
        <ProfileReport profile={profile} access={profileAccess} />
      </Suspense>
    </ReportShell>
  );
}
```

- [ ] **Step 4: 정적 검사**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS

- [ ] **Step 5: 실제로 돌려서 확인한다**

`npm run dev` 후 아래를 순서대로 확인한다. **DeepSeek 키(`.env.local`)가 있어야 한다.**

| # | 경로 | 기대 |
| --- | --- | --- |
| 1 | `/report` | 픽스처 데모. 분해 전과 동일 |
| 2 | `/report?profile=abc` | 404 |
| 3 | 로그아웃 상태로 `/report?profile=1` | `/login` 으로 이동 |
| 4 | 로그인 후 `/home` → "무료 리포트 보기" | 헤더가 먼저 뜨고 "리포트를 쓰고 있어요" → 실제 이름·생년월일·해석으로 교체 |
| 5 | 같은 링크 다시 클릭 | 캐시 히트라 대기 화면 없이 즉시 |
| 6 | 남의 프로필 id (`?profile=` 를 다른 숫자로) | 404 |
| 7 | 4번 화면의 히어로 | 이름과 `"양력 …· ○○일주"` 가 내가 입력한 값과 맞는지 |

4번에서 생성이 실제로 일어났는지는 서버 콘솔의 DeepSeek 호출 로그와, 두 번째 방문이 즉시 뜨는 것(5번)으로 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(report): 저장된 프로필로 실제 리포트를 렌더한다

/report?profile=<id> 가 프로필을 조회해 원국을 계산하고 DeepSeek 해석을
붙인다. 셸을 먼저 보내고 본문은 Suspense 로 스트리밍한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012NsoCxUmhB3Lv5duP8kuep
EOF
)"
```

---

### Task 9: 백로그 정리

`docs/issues/backlog.md` 의 "`/report` 실데이터 배선 때 처리" 두 항목 중 하나는 해결됐고, 하나는 남았다. 남은 항목에는 이번에 드러난 증상을 덧붙인다.

**Files:**
- Modify: `docs/issues/backlog.md`

**Interfaces:**
- Consumes: 없음
- Produces: 없음

- [ ] **Step 1: 해당 절을 교체한다**

`**\`/report\` 실데이터 배선 때 처리**` 절 전체(두 개의 불릿)를 아래로 바꾼다.

```markdown
**섹션 체계 정리 (`/report` 배선 후 남은 것)**

- 섹션 수 모델이 두 벌이다. 레지스트리는 12개 중 무료 5개인데, `/report` 화면은 무료 4개(01–04) + 잠금 8개(05–12)로 번호를 매긴다. `overview`는 레지스트리에 있지만 화면에선 번호 없는 히어로이고, `environment`(화면 07)는 레지스트리에 없다. **그래서 유료 리포트에서 07 칸이 항상 비어 있다** — 잠금 목록에서 본 항목 하나를 결제 후에도 못 받는다.
- `environment`를 살리려면 `AxisRow.pos`(0–100)를 누가 만드느냐부터 정해야 한다. 시스템 프롬프트가 LLM 의 숫자 생성을 금지하므로, 축 위치는 `analysis`에서 계산하고 LLM 은 서술만 쓰는 설계가 필요하다.
```

(`reportHref`가 순번 id를 노출한다는 항목은 지운다 — `getProfile`이 `user_id`로 함께 필터하고, `parseProfileParam`이 형식을 막는다.)

- [ ] **Step 2: 남은 내용이 맞는지 확인한다**

Run: `git diff docs/issues/backlog.md`
Expected: `session.userId` 경고 불릿만 사라지고, 섹션 수 불릿은 증상 문장이 붙은 채로 남는다. 다른 절(`결제 붙이기 전에 처리`, `UX 다듬기`)은 그대로.

- [ ] **Step 3: 전체 검증**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: 전부 PASS

- [ ] **Step 4: 커밋**

```bash
git add docs/issues/backlog.md
git commit -m "$(cat <<'EOF'
docs(backlog): /report 배선으로 해결된 항목 정리

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012NsoCxUmhB3Lv5duP8kuep
EOF
)"
```

---

## 자체 검토 결과

스펙 대비 커버리지를 확인했다.

| 스펙 절 | 담당 Task |
| --- | --- |
| §3 데이터 흐름 | T8 |
| §4 `produceSections` 추출 | T6 |
| §5 `getProfile` + id 검증 | T2, T1 |
| §6 `toBirthInput` / `toReportMeta` / `regions` 이동 | T4, T5, T3 |
| §7 실패 처리 | T6 (`GenerationError.partial`), T8 (분기) |
| §8 컴포넌트 분해 · 대기 · 에러 화면 | T7, T8 |
| §9 `maxDuration` · `loading.tsx` 미생성 | T8 |
| §10 테스트 | 각 Task Step 1 |
| §12 백로그 반영 | T9 |

스펙에서 계획으로 옮기며 바로잡은 것:

- **`toReportMeta` 의 날짜 출처.** 스펙 초안은 `chart.solar` 를 쓰라고 했는데, 그러면 음력 입력이 환산된 양력 날짜에 `"음력"` 라벨이 붙는다. `profile.birth`(입력값 그대로)로 바꾸고 스펙도 고쳤다.
- **`parseProfileId` → `parseProfileParam`.** `string | null` 로는 "파라미터 없음"(픽스처)과 "형식 오류"(404)를 가를 수 없었다.
- **`GenerationError` 가 `partial` 을 싣는다.** 스펙 §7의 "캐시에 있던 것만이라도 보여준다"가 원래 시그니처로는 불가능했다 — 캐시 조회 결과가 함수 안에 갇힌다.
- **`access.isPaid` 에 `profile.isPaid` 를 OR 로 더했다.** 스펙은 `?paid=true` 토글만 말했는데, 그러면 `/home` 이 `purchases` 조인으로 "전체 리포트" 배지를 띄운 프로필이 `/report` 에서는 잠금으로 보인다. 결제 연동이 아니라 이미 조회한 플래그를 읽는 것뿐이라 T8 에 넣었다.
