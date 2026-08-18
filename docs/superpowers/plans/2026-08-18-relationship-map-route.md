# 관계 지도 map 라우트 이전과 공유 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/lab/relationship-world` mock 스파이크를 `/map` 실서비스 라우트로 올리고, 지도마다 공유 링크를 주어 링크를 받은 누구나 로그인 없이 자기 생년월일을 추가할 수 있게 한다.

**Architecture:** 지도는 `maps` / `map_people` 두 테이블에 생년월일 원본으로 저장된다. 관계(Role × Feature)는 저장하지 않고 매 렌더마다 `saju-core` 의 `getRelation(내 일주, 상대 일주)` 으로 계산한다 — 원국은 파생값이라는 기존 규칙(`0005_profiles.sql`)을 따른다. 지도 생성은 로그인한 사용자만, 열람과 추가는 링크를 가진 누구나, 삭제는 소유자만이다.

**Tech Stack:** Next.js 16.2.10 App Router · React 19.2.4 · TypeScript strict · Tailwind 4 · vitest 4 (`environment: "node"`) · neon serverless postgres · zod · three 0.185.1 / @react-three/fiber 9.7.0 / drei 10.7.8

**설계 문서:** `docs/superpowers/specs/2026-08-18-relationship-map-route-design.md` — 숫자의 근거(50명 상한, 지수 시간 측정, 일주 독립성)가 전부 거기 있다.

## Global Constraints

- **`src/app/map/_lib/` 와 `src/app/map/_data/` 는 three 를 import 하지 않는다.** 이 라우트의 vitest 는 `environment: "node"` 라 React 컴포넌트를 테스트할 수 없다. 규칙은 전부 순수 모듈로 내려 node 테스트로 잠근다.
- **`MAX_MAP_PEOPLE = 50`** — 지도당 인원 상한.
- **생년월일 검증: 이름 1~20자, 연 1900~현재 연도, 월 1~12, 일 1~31, `calendar` ∈ {solar, lunar}, `isLeapMonth` boolean.** 연도 하한 1900 은 `src/lib/profiles/input.ts:17`, 상한을 현재 연도로 두는 것은 `src/app/match/_lib/to-counterpart.ts:53` 을 따른다.
- **`share_id` 는 `crypto.randomUUID()`.** `maps.id` 는 연속 bigint 라 공개 URL 에 쓰면 남의 지도를 훑을 수 있다.
- **시각·성별·출생지는 받지도 저장하지도 않는다.** 지도는 일주만 쓰고, 일주는 그 셋과 무관하다(설계 §1.1).
- **`SPREAD`·`STATE_RADIUS`·색 체계·카메라 상수는 건드리지 않는다.** 15구역 설계가 정한 값이다.
- **SQL 은 태그드 템플릿으로만 쓴다.** 문자열 조립 금지(`src/lib/db.ts` 주석).
- **`AGENTS.md`: 이 Next.js 는 학습 데이터와 다르다.** 라우트·메타데이터·라우트 핸들러를 쓰기 전에 해당 문서를 읽는다:
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
  - `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md`
- **커밋 메시지는 한국어.** 기존 이력을 따른다. 각 커밋 끝에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **전체 테스트는 `npm test`.** 베이스라인은 120 파일 / 1267 테스트 통과다.

## 파일 구조

| 경로 | 책임 |
|---|---|
| `migrations/0020_maps.sql` | `maps` 테이블 |
| `migrations/0021_map_people.sql` | `map_people` 테이블 |
| `src/lib/maps/types.ts` | `BirthLite`·`MapRow`·`MapPersonRow`. DB 도 zod 도 import 하지 않아 순수 모듈이 안전하게 쓴다 |
| `src/lib/maps/input.ts` | 추가 요청 본문 zod 스키마. 컬럼도 SQL 도 모른다 |
| `src/lib/maps/store.ts` | 컬럼 이름을 아는 유일한 곳. `profiles/store.ts` 와 같은 형태 |
| `src/app/map/_data/person.ts` | `MapPerson`·`MapCenter` 타입. 생년월일을 담지 않아 클라이언트로 내려도 안전하다 |
| `src/app/map/_lib/to-map-people.ts` | 생년월일 → Role·Feature. 순수 함수, node 테스트 |
| `src/app/map/_lib/layout.ts` | (기존) `positionFor` 지수 시간 제거 |
| `src/app/map/page.tsx` | 로그인 확인 → 내 지도로 리다이렉트 |
| `src/app/map/[share]/page.tsx` | 공개 렌더. 서버에서 사람 목록을 계산해 내려준다 |
| `src/app/map/_components/MapShell.tsx` | 기존 `WorldShell` 의 새 이름. 상태 조율 |
| `src/app/map/_components/AddPersonSheet.tsx` | 이름·생년월일 입력 시트 |
| `src/app/map/_components/MapHeader.tsx` | 접히는 헤더바 + 공유 버튼 |
| `src/app/api/maps/[share]/people/route.ts` | POST — 누구나 |
| `src/app/api/maps/[share]/people/[id]/route.ts` | DELETE — 소유자만 |

---

### Task 1: `positionFor` 의 지수 시간을 없앤다

지금 `positionFor(role, feature, n)` 은 앞선 인덱스를 재귀로 다시 계산해 T(n) ≈ 2^n 이다(한 소구역 20명에 4.7초). mock 의 가장 붐빈 칸이 4명이라 지금까지 드러나지 않았고, "누구나 추가" 가 그 전제를 깬다. **좌표는 한 톨도 바뀌면 안 된다** — 샘플링 순서를 그대로 두고 재귀만 순회로 바꾼다.

**Files:**
- Modify: `src/app/lab/relationship-world/_lib/layout.ts:243-279`
- Test: `src/app/lab/relationship-world/_lib/layout.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `placeSubRegion(role: RelationRole, feature: Feature, count: number): Vec3[]` — 한 소구역에 `count` 명을 배치한 좌표 배열. `positionFor(role, feature, i)` 는 `placeSubRegion(role, feature, i + 1)[i]` 와 항상 같다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/lab/relationship-world/_lib/layout.test.ts` 맨 아래에 추가한다. 기존 테스트는 한 줄도 고치지 않는다 — 그 통과 자체가 "좌표가 안 바뀌었다"의 증거다.

```ts
describe("placeSubRegion", () => {
  it("positionFor 와 좌표가 정확히 같다", () => {
    for (const role of ROLE_ORDER) {
      for (const feature of ["none", "yukhap", "chung"] as Feature[]) {
        const batch = placeSubRegion(role, feature, 10);
        for (let i = 0; i < 10; i++) {
          expect(batch[i]).toEqual(positionFor(role, feature, i));
        }
      }
    }
  });

  // 재귀 회귀 방지. 고치기 전에는 한 소구역 20명이 4.7초였다(설계 §1.2).
  // 넉넉히 200ms 를 둔다 — CI 가 느려도 지수와 다항의 차이는 이 문턱에서 갈린다.
  it("50명을 200ms 안에 배치한다", () => {
    const t = performance.now();
    placeSubRegion("fill", "none", 50);
    expect(performance.now() - t).toBeLessThan(200);
  });

  // 상한 50명의 근거(설계 §1.3). 기본 칸 8명까지는 두 사람이 한 점으로
  // 읽히지 않아야 한다 — 문턱은 코어 지름(0.075 * 2)의 2배인 0.30 월드다.
  it("기본 칸 8명이 코어 지름 2배 이상 떨어진다", () => {
    const pts = placeSubRegion("fill", "none", 8);
    let min = Infinity;
    for (let i = 0; i < pts.length; i++) {
      for (let j = 0; j < i; j++) {
        min = Math.min(min, Math.hypot(
          pts[i][0] - pts[j][0], pts[i][1] - pts[j][1], pts[i][2] - pts[j][2],
        ));
      }
    }
    expect(min).toBeGreaterThanOrEqual(0.3);
  });
});
```

파일 상단 import 에 `placeSubRegion` 을 더하고, `ROLE_ORDER` 와 `Feature` 가 아직 import 되어 있지 않으면 `../_data/roles` 에서 가져온다.

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run src/app/lab/relationship-world/_lib/layout.test.ts
```

기대: `placeSubRegion is not a function` (또는 import 해결 실패).

- [ ] **Step 3: 구현한다**

`layout.ts` 의 `positionFor` 를 통째로 아래로 바꾼다. 위에 붙어 있던 JSDoc 은 **재귀를 설명하는 문단만** 새 내용으로 갈아끼운다.

```ts
/**
 * 한 소구역(role × feature)에 count 명을 배치한다.
 *
 * 앞서 놓은 사람들과 MIN_SEPARATION 이상 떨어지지 않으면 시드를 바꿔 다시 뽑는다.
 * MAX_ATTEMPTS 를 다 써도 못 찾으면 마지막 후보를 그대로 쓴다 — 이 함수는 항상 끝나야 한다.
 *
 * 예전에는 positionFor 가 "앞선 사람들" 을 자기 자신을 다시 불러 구했다. 순수
 * 함수라 상태 없이 계산된다는 것이 근거였고, 가장 붐빈 칸이 4명인 mock 에서는
 * 실제로 문제가 없었다. 하지만 그 재귀는 T(n) ≈ 2^n 이라 한 소구역 20명에서
 * 4.7초가 걸린다(설계 문서 §1.2 의 실측표). 지도에 누구나 추가할 수 있게 되면서
 * 그 전제가 깨졌으므로, 같은 샘플링 순서를 유지한 채 순회로 편다.
 */
export function placeSubRegion(
  role: RelationRole,
  feature: Feature,
  count: number,
): Vec3[] {
  const placed: Vec3[] = [];

  for (let i = 0; i < count; i++) {
    const farEnough = (p: Vec3) => placed.every((o) => dist3(p, o) >= MIN_SEPARATION);

    let candidate = sampleCandidate(role, feature, i, 0);
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !farEnough(candidate); attempt++) {
      candidate = sampleCandidate(role, feature, i, attempt);
    }
    placed.push(candidate);
  }

  return placed;
}

/**
 * 사람 한 명의 좌표.
 *
 * indexInSubRegion 은 **(role, feature) 쌍 안에서** 0부터 센다. Role 안 전체
 * 순번으로 세면 한 사람이 빠졌을 때 같은 소구역의 다른 사람들이 전부 자리를 옮긴다.
 *
 * 여러 명을 놓을 때는 이걸 반복해 부르지 말고 placeSubRegion 을 한 번 불러라 —
 * 이 함수는 index+1 명을 매번 처음부터 다시 배치한다.
 */
export function positionFor(
  role: RelationRole,
  feature: Feature,
  indexInSubRegion: number,
): Vec3 {
  return placeSubRegion(role, feature, indexInSubRegion + 1)[indexInSubRegion];
}
```

그리고 `placePeople` 이 칸마다 한 번씩만 배치하도록 바꾼다.

```ts
export function placePeople(people: readonly Placeable[]): Map<string, Vec3> {
  // 칸별로 몇 명인지 먼저 세고, 칸마다 placeSubRegion 을 딱 한 번 부른다.
  // 사람마다 positionFor 를 부르면 같은 칸을 인원수만큼 다시 배치하게 된다.
  const order = new Map<string, string[]>();
  for (const person of people) {
    const key = `${person.role}/${person.feature}`;
    const ids = order.get(key);
    if (ids) ids.push(person.id);
    else order.set(key, [person.id]);
  }

  const out = new Map<string, Vec3>();
  for (const [key, ids] of order) {
    const [role, feature] = key.split("/") as [RelationRole, Feature];
    const points = placeSubRegion(role, feature, ids.length);
    ids.forEach((id, i) => out.set(id, points[i]));
  }

  return out;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
npx vitest run src/app/lab/relationship-world/_lib/
```

기대: PASS. **기존 `layout.test.ts` 의 테스트가 하나도 실패하지 않아야 한다** — 실패하면 좌표가 바뀐 것이고, 그건 이 태스크의 실패다.

- [ ] **Step 5: 전체 수트를 돌린다**

```bash
npm test
```

기대: 120 파일 / 1267 + 3 테스트 통과.

- [ ] **Step 6: 커밋**

```bash
git add src/app/lab/relationship-world/_lib/layout.ts src/app/lab/relationship-world/_lib/layout.test.ts
git commit -m "$(cat <<'EOF'
fix(lab): 배치의 지수 시간 재귀를 순회로 편다

positionFor 가 앞선 인덱스를 재귀로 다시 계산해 한 소구역 20명에 4.7초가
걸렸다. mock 의 가장 붐빈 칸이 4명이라 드러나지 않았을 뿐이다. 샘플링
순서를 그대로 둔 채 순회로 펴서 좌표는 한 톨도 바뀌지 않는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 라우트를 `lab` 에서 `map` 으로 옮긴다

파일을 옮기기만 한다. 동작은 그대로다 — 이 태스크가 끝나면 `/map` 이 mock 20명을 예전과 똑같이 그린다.

**Files:**
- Move: `src/app/lab/relationship-world/*` → `src/app/map/*`
- Delete: `src/app/lab/` (빈 디렉터리)
- Modify: `src/app/map/page.tsx` (제목 문구)

**Interfaces:**
- Consumes: Task 1 의 `placeSubRegion`
- Produces: `src/app/map/` 아래의 모든 경로. 이후 태스크가 참조한다

- [ ] **Step 1: 옮긴다**

```bash
git mv src/app/lab/relationship-world src/app/map
rmdir src/app/lab
```

내부 import 는 전부 상대경로(`../_lib/layout`, `../_data/roles`)라 수정할 것이 없다.

- [ ] **Step 2: `lab` 을 가리키는 곳이 남았는지 확인한다**

```bash
grep -rn "lab/relationship-world\|app/lab" src/ docs/ --include='*.ts' --include='*.tsx' --include='*.md'
```

기대: `docs/superpowers/` 아래 설계 문서 두 개만 나온다(과거 기록이므로 고치지 않는다). `src/` 에서 나오면 그 파일을 고친다.

- [ ] **Step 3: 페이지 제목을 제품 문구로 바꾼다**

`src/app/map/page.tsx`:

```tsx
export const metadata: Metadata = {
  title: "관계 지도",
  // 링크를 아는 사람만 보는 것이 전제다. 검색에 잡히면 그 전제가 깨진다.
  robots: { index: false, follow: false },
};
```

- [ ] **Step 4: 타입과 테스트와 빌드를 확인한다**

```bash
npx tsc --noEmit
npm test
npm run build
```

기대: tsc 통과, 테스트 통과, 빌드 결과에 `○ /map` 이 있고 `/lab/relationship-world` 는 없다.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: 관계 지도를 lab 스파이크에서 map 라우트로 옮긴다

파일 위치와 제목만 바뀐다. 내부 import 가 전부 상대경로라 수정할 것이 없다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 생년월일 → 관계 계산 (순수 모듈)

지도의 두뇌다. 생년월일에서 일주를 세우고 중심과의 관계를 Role × Feature 로 접는다. **three 도 DB 도 모른다** — node 테스트로 전부 잠근다.

**Files:**
- Create: `src/lib/maps/types.ts`
- Create: `src/app/map/_data/person.ts`
- Create: `src/app/map/_lib/to-map-people.ts`
- Test: `src/app/map/_lib/to-map-people.test.ts`

**Interfaces:**
- Consumes: `src/app/map/_data/roles.ts` 의 `RelationRole`·`Feature`
- Produces:
  - `type BirthLite = { year, month, day, calendar: "solar"|"lunar", isLeapMonth: boolean }` — **Task 4 의 `store.ts` 가 이 타입을 import 해 쓴다.** 같은 모양을 두 곳에 적지 않기 위해 `src/lib/maps/types.ts` 에 한 벌만 둔다
  - `type MapRow = { id, shareId, ownerUserId, center: BirthLite & { name }, createdAt }`
  - `type MapPersonRow = BirthLite & { id, name }`
  - `type MapPerson = { id, name, pillarKey, sceneName, role, feature, sameDayPillar }`
  - `type MapCenter = { name, pillarKey, sceneName }`
  - `dayPillarOf(birth: BirthLite): DayPillarInput | null`
  - `centerOf(name: string, birth: BirthLite): MapCenter | null`
  - `toMapPerson(centerDay: DayPillarInput, row: MapPersonRow): MapPerson | null`

- [ ] **Step 1a: 행 타입을 만든다**

`src/lib/maps/types.ts` — **DB 도 zod 도 import 하지 않는다.** Task 4 의 `store.ts` 와 이 태스크의 순수 모듈이 같은 타입을 쓰되, 순수 모듈 쪽에서 `store.ts` 를 거쳐 `@/lib/db` 가 딸려오지 않게 갈라 둔다.

```ts
/** 지도가 받는 생년월일 전부. 시각·성별·출생지는 일주에 영향이 없어 받지 않는다. */
export interface BirthLite {
  year: number;
  month: number;
  day: number;
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
}

export interface MapRow {
  id: string;
  /** 공개 URL 에 쓰는 값. id 는 연속 정수라 절대 노출하지 않는다. */
  shareId: string;
  ownerUserId: string;
  center: BirthLite & { name: string };
  createdAt: string;
}

export interface MapPersonRow extends BirthLite {
  id: string;
  name: string;
}
```

- [ ] **Step 1b: 화면 타입을 만든다**

`src/app/map/_data/person.ts` — `roles.ts` 의 타입 외에 아무것도 import 하지 않는다. 클라이언트 컴포넌트가 이 타입을 쓰므로 런타임 의존성이 새면 안 된다. **생년월일을 담지 않는다** — 화면이 쓰지 않고, 남의 지도에서 남의 생일이 읽혀서도 안 된다.

```ts
import type { Feature, RelationRole } from "./roles";

/** 지도 위의 사람 하나. 생년월일은 담지 않는다 — 화면이 쓰지 않고, 남의 지도에 노출되어서도 안 된다. */
export type MapPerson = {
  readonly id: string;
  readonly name: string;
  /** 일주 한글 간지 (예: "경오") */
  readonly pillarKey: string;
  /** 일주 캐릭터의 장면명 (예: "한낮의 무쇠") */
  readonly sceneName: string;
  readonly role: RelationRole;
  readonly feature: Feature;
  /**
   * 일주가 통째로 같은가. saju-core 의 배지는 육합·충·동일일주 셋인데 지도의
   * Feature 는 셋(기본·六合·沖)뿐이라 동일일주가 갈 자리가 없다. 배치는 기본으로
   * 접고 이 사실만 따로 실어 상세 시트가 말한다.
   */
  readonly sameDayPillar: boolean;
};

/** 지도의 중심. 관계가 없으므로 role·feature 가 없다. */
export type MapCenter = {
  readonly name: string;
  readonly pillarKey: string;
  readonly sceneName: string;
};
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/app/map/_lib/to-map-people.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildPillars } from "@/lib/saju-core";
import type { BirthLite, MapPersonRow } from "@/lib/maps/types";
import { centerOf, dayPillarOf, toMapPerson } from "./to-map-people";

const BASE = { year: 1990, month: 5, day: 15 } as const;

function solar(year: number, month: number, day: number): BirthLite {
  return { year, month, day, calendar: "solar", isLeapMonth: false };
}

/** 기준일에서 n 일 뒤. 일주는 하루에 한 칸씩 도므로 60일이면 60갑자를 한 바퀴 돈다. */
function shift(n: number): BirthLite {
  const d = new Date(Date.UTC(BASE.year, BASE.month - 1, BASE.day + n));
  return solar(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function row(id: string, birth: BirthLite): MapPersonRow {
  return { id, name: `p${id}`, ...birth };
}

/** 일지가 branch 인 첫 날. 지지는 12일마다 돌아오므로 60일 안에 반드시 있다. */
function firstWithBranch(branch: string): BirthLite {
  for (let n = 0; n < 60; n++) {
    const b = shift(n);
    if (buildPillars(b).day.branch === branch) return b;
  }
  throw new Error(`일지 ${branch} 를 60일 안에서 못 찾았다`);
}

// 1990-5-15 은 경진(庚辰)이다 — 브레인스토밍에서 실측했다.
// 일간 경은 금(金)·양(陽)이고, 일지 진(辰)의 육합은 유(酉), 충은 술(戌)이다
// (src/lib/saju-core/data/branches.ts 의 BRANCH_HAP·BRANCH_CHUNG).
const CENTER = dayPillarOf(solar(BASE.year, BASE.month, BASE.day))!;

describe("dayPillarOf", () => {
  it("양력 생년월일에서 일주를 세운다", () => {
    expect(CENTER).toEqual({ stem: "경", branch: "진" });
  });

  it("음력을 양력으로 옮겨 세운다", () => {
    // 만세력 실측: 음력 1990-2-30 은 양력 1990-3-26 이고 일주는 경인이다
    const lunar: BirthLite = { year: 1990, month: 2, day: 30, calendar: "lunar", isLeapMonth: false };
    expect(dayPillarOf(lunar)).toEqual({ stem: "경", branch: "인" });
  });

  it("없는 날짜면 null", () => {
    // 만세력이 "Invalid solar date" 로 던진다. 던지지 않고 null 로 접는 것이
    // 이 함수의 존재 이유다 — 한 명 때문에 지도 전체가 500 이 되면 안 된다.
    expect(dayPillarOf(solar(1990, 2, 31))).toBeNull();
  });

  it("만세력 지원 범위(1900~2050) 밖이면 null", () => {
    expect(dayPillarOf(solar(1899, 1, 1))).toBeNull();
  });

  it("없는 윤달이면 null", () => {
    const bad: BirthLite = { year: 1990, month: 2, day: 1, calendar: "lunar", isLeapMonth: true };
    expect(dayPillarOf(bad)).toBeNull();
  });
});

describe("toMapPerson", () => {
  it("60일을 돌면 다섯 Role 이 모두 나온다", () => {
    const roles = new Set<string>();
    for (let n = 0; n < 60; n++) {
      const person = toMapPerson(CENTER, row(String(n), shift(n)));
      if (person) roles.add(person.role);
    }
    expect(roles).toEqual(new Set(["fill", "beside", "express", "move", "refine"]));
  });

  it("일지가 육합(유)이면 feature 가 yukhap", () => {
    const person = toMapPerson(CENTER, row("h", firstWithBranch("유")))!;
    expect(person.feature).toBe("yukhap");
  });

  it("일지가 충(술)이면 feature 가 chung", () => {
    const person = toMapPerson(CENTER, row("c", firstWithBranch("술")))!;
    expect(person.feature).toBe("chung");
  });

  it("그 밖의 일지는 feature 가 none", () => {
    const person = toMapPerson(CENTER, row("n", firstWithBranch("자")))!;
    expect(person.feature).toBe("none");
  });

  it("일주가 통째로 같으면 feature 는 none 이고 sameDayPillar 가 true", () => {
    // 동일일주는 saju-core 의 네 번째 배지라 Feature 셋 중 갈 자리가 없다.
    // 배치는 기본으로 접고 사실만 따로 싣는다.
    const person = toMapPerson(CENTER, row("s", solar(BASE.year, BASE.month, BASE.day)))!;
    expect(person.feature).toBe("none");
    expect(person.sameDayPillar).toBe(true);
  });

  it("육합·충인 사람의 sameDayPillar 는 false", () => {
    expect(toMapPerson(CENTER, row("h", firstWithBranch("유")))!.sameDayPillar).toBe(false);
  });

  it("일주 캐릭터의 간지와 장면명을 싣는다", () => {
    const person = toMapPerson(CENTER, row("x", solar(BASE.year, BASE.month, BASE.day)))!;
    expect(person.pillarKey).toBe("경진");
    expect(person.sceneName.length).toBeGreaterThan(0);
  });

  it("id 와 name 을 그대로 옮긴다", () => {
    const person = toMapPerson(CENTER, { id: "42", name: "민수", ...shift(1) })!;
    expect(person.id).toBe("42");
    expect(person.name).toBe("민수");
  });

  it("없는 날짜면 null", () => {
    expect(toMapPerson(CENTER, row("bad", solar(1990, 2, 31)))).toBeNull();
  });
});

describe("centerOf", () => {
  it("이름과 일주 캐릭터를 담는다", () => {
    const center = centerOf("김동진", solar(BASE.year, BASE.month, BASE.day));
    expect(center).toEqual({
      name: "김동진",
      pillarKey: "경진",
      sceneName: expect.any(String),
    });
  });

  it("없는 날짜면 null", () => {
    expect(centerOf("김동진", solar(1990, 2, 31))).toBeNull();
  });
});
```

> 구현자에게: 기대값 `경진`·육합 `유`·충 `술`·음력 1990-2-30 → 일주 `경인`·지원 범위 `1900~2050` 은 전부 실제로 돌려서 확인한 값이다. 테스트가 이것들과 다르게 나오면 **구현을 의심하라** — 기대값을 고치지 마라.

- [ ] **Step 3: 실패를 확인한다**

```bash
npx vitest run src/app/map/_lib/to-map-people.test.ts
```

기대: FAIL — `to-map-people` 모듈이 없다.

- [ ] **Step 4: 구현한다**

`src/app/map/_lib/to-map-people.ts`:

```ts
/**
 * 생년월일 → 지도 위의 자리.
 *
 * 지도가 쓰는 것은 일주(日柱) 하나뿐이다. 일주는 출생 시각·경도·진태양시 보정과
 * 무관하다 — 396개 날짜 × (시각 5종 + 경도 3종 + 보정 on/off) 에서 달라진 경우가
 * 0이었다(설계 문서 §1.1). 그래서 이 모듈이 받는 것은 연·월·일과 양/음력뿐이다.
 *
 * three 도 DB 도 import 하지 않는다. 이 라우트의 테스트는 node 환경이라
 * 화면 코드를 테스트할 수 없고, 규칙은 전부 여기 같은 순수 모듈로 내려온다.
 */
import {
  buildPillars,
  characterOf,
  getRelation,
  type DayPillarInput,
  type RelationBadge,
  type RelationKind,
} from "@/lib/saju-core";
import type { BirthLite, MapPersonRow } from "@/lib/maps/types";
import type { Feature, RelationRole } from "../_data/roles";
import type { MapCenter, MapPerson } from "../_data/person";

/**
 * 관계 5분류 → 지도의 5구역. 명리 용어를 그대로 옮긴 것이라 임의 매핑이 아니다.
 * 생아=인성, 비아=비겁, 아생=식상, 아극=재성, 극아=관성.
 */
const ROLE_OF: Record<RelationKind, RelationRole> = {
  생아: "fill",
  비아: "beside",
  아생: "express",
  아극: "move",
  극아: "refine",
};

/**
 * 배지 → 소구역. 동일일주가 여기 없는 것은 의도다 — 六合 도 沖 도 아니므로
 * 기본으로 접고, 그 사실은 MapPerson.sameDayPillar 로 따로 나른다.
 */
const FEATURE_OF: Partial<Record<RelationBadge, Feature>> = {
  육합: "yukhap",
  충: "chung",
};

/**
 * 일주를 세운다. 만세력이 못 세우는 값이면 null.
 *
 * 던지는 경우가 여럿이다(실측): 없는 양력 날짜("Invalid solar date"), 없는 월,
 * 없는 윤달("Invalid lunar date ... (leap)"), 그리고 지원 범위 1900~2050 밖.
 * 전부 같이 null 로 접는다 — 사용자가 폼에 친 값이라, 지도 한 명이 계산되지
 * 않는다고 지도 전체가 500 이 되면 안 된다. 호출부가 걸러낸다.
 */
export function dayPillarOf(birth: BirthLite): DayPillarInput | null {
  try {
    const pillars = buildPillars({
      year: birth.year,
      month: birth.month,
      day: birth.day,
      calendar: birth.calendar,
      isLeapMonth: birth.isLeapMonth,
    });
    return { stem: pillars.day.stem, branch: pillars.day.branch };
  } catch {
    return null;
  }
}

/** 지도의 중심. 관계가 없으므로 일주 캐릭터만 담는다. */
export function centerOf(name: string, birth: BirthLite): MapCenter | null {
  const day = dayPillarOf(birth);
  if (!day) return null;
  const character = characterOf(day.stem, day.branch);
  return { name, pillarKey: character.key, sceneName: character.scene.name };
}

/** 중심의 일주를 기준으로 한 사람의 자리를 정한다. */
export function toMapPerson(
  centerDay: DayPillarInput,
  row: MapPersonRow,
): MapPerson | null {
  const day = dayPillarOf(row);
  if (!day) return null;

  const relation = getRelation(centerDay, day);
  const character = characterOf(day.stem, day.branch);
  const badge = relation.badges[0];

  return {
    id: row.id,
    name: row.name,
    pillarKey: character.key,
    sceneName: character.scene.name,
    role: ROLE_OF[relation.kind],
    feature: (badge && FEATURE_OF[badge]) ?? "none",
    sameDayPillar: badge === "동일일주",
  };
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
npx vitest run src/app/map/_lib/to-map-people.test.ts
```

기대: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/maps/types.ts src/app/map/_data/person.ts src/app/map/_lib/to-map-people.ts src/app/map/_lib/to-map-people.test.ts
git commit -m "$(cat <<'EOF'
feat(map): 생년월일에서 관계 5구역과 소구역을 계산한다

saju-core 의 getRelation 이 내는 5분류와 배지를 지도의 Role x Feature 로
접는다. 동일일주는 六合 도 沖 도 아니라 기본으로 접고 사실만 따로 싣는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 테이블과 저장소

**Files:**
- Create: `migrations/0020_maps.sql`
- Create: `migrations/0021_map_people.sql`
- Create: `src/lib/maps/input.ts`
- Create: `src/lib/maps/store.ts`
- Test: `src/lib/maps/input.test.ts`, `src/lib/maps/store.test.ts`

**Interfaces:**
- Consumes: `src/lib/db.ts` 의 `sql`·`SqlClient`, Task 3 의 `src/lib/maps/types.ts` (`BirthLite`·`MapRow`·`MapPersonRow`)
- Produces:
  - `MAX_MAP_PEOPLE = 50`, `MapPeopleLimitError`, `DuplicatePersonError`
  - `toMapRow(r) → MapRow`, `toMapPersonRow(r) → MapPersonRow`
  - `getMapByShareId(shareId, client?) → MapRow | null`
  - `getMapByOwner(userId, client?) → MapRow | null`
  - `createMap(userId, center: { name } & BirthLite, client?) → MapRow`
  - `listMapPeople(mapId, client?) → MapPersonRow[]`
  - `addMapPerson(mapId, person: { name } & BirthLite, client?) → MapPersonRow`
  - `deleteMapPerson(mapId, personId, client?) → boolean`
  - `addPersonSchema` (zod), `type AddPersonBody`

- [ ] **Step 1: 마이그레이션 두 개를 쓴다**

`migrations/0020_maps.sql`:

```sql
-- 관계 지도. 사용자당 하나다.
--
-- share_id 가 PK 와 별도인 이유: maps.id 는 bigint IDENTITY 라 연속 정수다.
-- 공개 URL 에 그대로 쓰면 /map/1, /map/2 를 훑어 남의 지도를 전부 열 수 있다.
--
-- 중심 생년월일을 profiles 참조가 아니라 복사하는 이유: 소유자가 프로필을
-- 지웠을 때 이미 뿌린 공유 링크가 깨지면 안 된다. 지도는 자기 완결적인
-- 스냅샷이다. 원국이 아니라 생년월일을 담는 것은 0005_profiles.sql 이
-- 정한 규칙을 따른다("원국은 파생값이다").
CREATE TABLE IF NOT EXISTS maps (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  share_id       text NOT NULL UNIQUE,
  owner_user_id  bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  center_name    text NOT NULL,
  center_calendar      text NOT NULL DEFAULT 'solar' CHECK (center_calendar IN ('solar', 'lunar')),
  center_is_leap_month boolean NOT NULL DEFAULT false,
  center_birth_year    int NOT NULL,
  center_birth_month   int NOT NULL,
  center_birth_day     int NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS maps_owner_user ON maps(owner_user_id);
```

`migrations/0021_map_people.sql`:

```sql
-- 지도에 올라온 사람. 링크를 가진 누구나 추가할 수 있다.
--
-- 시각·성별·출생지 컬럼이 없는 것은 의도다. 지도는 일주만 쓰고, 일주는 그
-- 셋과 무관하다. 나중에 이 사람의 전체 리포트가 필요해지면 컬럼 14개를
-- 복제하는 것이 아니라 profiles 로 승격하고 여기엔 profile_id 하나만 붙인다
-- (0012_profiles_kind.sql 이 같은 판단을 적어뒀다).
CREATE TABLE IF NOT EXISTS map_people (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  map_id        bigint NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  name          text NOT NULL,
  calendar      text NOT NULL DEFAULT 'solar' CHECK (calendar IN ('solar', 'lunar')),
  is_leap_month boolean NOT NULL DEFAULT false,
  birth_year    int NOT NULL,
  birth_month   int NOT NULL,
  birth_day     int NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS map_people_map ON map_people(map_id, created_at);

-- 더블탭·새로고침 재전송으로 같은 사람이 두 번 들어가는 것을 DB 층에서 막는다.
CREATE UNIQUE INDEX IF NOT EXISTS map_people_dedupe
  ON map_people(map_id, name, birth_year, birth_month, birth_day, calendar, is_leap_month);
```

- [ ] **Step 2: 입력 스키마의 실패 테스트를 쓴다**

`src/lib/maps/input.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { addPersonSchema } from "./input";

const ok = { name: "민수", birth: { year: 1990, month: 5, day: 15 } };

describe("addPersonSchema", () => {
  it("이름과 생년월일만으로 통과하고 기본값이 채워진다", () => {
    const parsed = addPersonSchema.parse(ok);
    expect(parsed).toEqual({
      name: "민수",
      birth: { year: 1990, month: 5, day: 15 },
      calendar: "solar",
      isLeapMonth: false,
    });
  });

  it("이름 앞뒤 공백을 자른다", () => {
    expect(addPersonSchema.parse({ ...ok, name: "  민수  " }).name).toBe("민수");
  });

  it("빈 이름과 21자 이름을 거절한다", () => {
    expect(addPersonSchema.safeParse({ ...ok, name: "  " }).success).toBe(false);
    expect(addPersonSchema.safeParse({ ...ok, name: "가".repeat(21) }).success).toBe(false);
  });

  it("1900년 이전과 내년을 거절한다", () => {
    const next = new Date().getFullYear() + 1;
    expect(addPersonSchema.safeParse({ ...ok, birth: { year: 1899, month: 1, day: 1 } }).success).toBe(false);
    expect(addPersonSchema.safeParse({ ...ok, birth: { year: next, month: 1, day: 1 } }).success).toBe(false);
  });

  it("월·일 범위를 거절한다", () => {
    expect(addPersonSchema.safeParse({ ...ok, birth: { year: 1990, month: 13, day: 1 } }).success).toBe(false);
    expect(addPersonSchema.safeParse({ ...ok, birth: { year: 1990, month: 1, day: 32 } }).success).toBe(false);
  });

  it("시각·성별·출생지를 받아도 결과에 담지 않는다", () => {
    const parsed = addPersonSchema.parse({ ...ok, gender: "male", time: { hour: 3, minute: 0 } });
    expect(parsed).not.toHaveProperty("gender");
    expect(parsed).not.toHaveProperty("time");
  });
});
```

- [ ] **Step 3: 입력 스키마를 구현한다**

`src/lib/maps/input.ts`:

```ts
import { z } from "zod";

/**
 * POST /api/maps/[share]/people 본문.
 *
 * profiles/input.ts 와 달리 성별·시각·출생지가 없다. 지도는 일주만 쓰고 일주는
 * 그 셋과 무관하므로(설계 §1.1), 안 쓰는 개인정보는 받지 않는다. zod 는 모르는
 * 키를 조용히 버리므로 누가 gender 를 보내도 저장까지 가지 않는다.
 *
 * 연도 상한이 2200 이 아니라 현재인 이유: 지도에 올라오는 사람은 이미 태어난
 * 사람이다(match/_lib/to-counterpart.ts:53 과 같은 판단). 하한 1900 은
 * profiles/input.ts:17 과 같다.
 *
 * 월·일은 범위만 본다. 2월 31일 같은 값은 여기를 통과하고 만세력이 걸러낸다
 * (to-map-people.ts 의 null) — 윤년·음력 규칙을 zod 에 두 벌로 적지 않는다.
 */
export const addPersonSchema = z.object({
  name: z.string().trim().min(1).max(20),
  calendar: z.enum(["solar", "lunar"]).default("solar"),
  isLeapMonth: z.boolean().default(false),
  birth: z.object({
    year: z.number().int().min(1900).max(new Date().getFullYear()),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }),
});

export type AddPersonBody = z.infer<typeof addPersonSchema>;
```

- [ ] **Step 4: 저장소의 실패 테스트를 쓴다**

`src/lib/maps/store.test.ts`. 가짜 SqlClient 는 `src/lib/profiles/store.test.ts:18` 의 것을 그대로 따른다.

```ts
import { describe, it, expect } from "vitest";
import {
  DuplicatePersonError,
  MAX_MAP_PEOPLE,
  MapPeopleLimitError,
  addMapPerson,
  createMap,
  deleteMapPerson,
  getMapByShareId,
  listMapPeople,
  toMapPersonRow,
  toMapRow,
  type SqlClient,
} from "./store";

function fakeClient(...responses: Record<string, unknown>[][]) {
  const calls: { sql: string; values: unknown[] }[] = [];
  let i = 0;
  const client: SqlClient = (strings, ...values) => {
    calls.push({ sql: strings.join("?"), values });
    return Promise.resolve(responses[i++] ?? []);
  };
  return { client, calls };
}

const mapDbRow = {
  id: 7,
  share_id: "0f4b0a5e-1111-4222-8333-444455556666",
  owner_user_id: 3,
  center_name: "김동진",
  center_calendar: "solar",
  center_is_leap_month: false,
  center_birth_year: 1990,
  center_birth_month: 10,
  center_birth_day: 25,
  created_at: "2026-08-18T00:00:00.000Z",
};

const personDbRow = {
  id: 11,
  name: "민수",
  calendar: "lunar",
  is_leap_month: true,
  birth_year: 1991,
  birth_month: 3,
  birth_day: 2,
};

describe("toMapRow", () => {
  it("컬럼을 카멜케이스 구조로 옮긴다", () => {
    expect(toMapRow(mapDbRow)).toEqual({
      id: "7",
      shareId: "0f4b0a5e-1111-4222-8333-444455556666",
      ownerUserId: "3",
      center: {
        name: "김동진",
        year: 1990, month: 10, day: 25,
        calendar: "solar", isLeapMonth: false,
      },
      createdAt: "2026-08-18T00:00:00.000Z",
    });
  });
});

describe("toMapPersonRow", () => {
  it("컬럼을 카멜케이스 구조로 옮긴다", () => {
    expect(toMapPersonRow(personDbRow)).toEqual({
      id: "11", name: "민수",
      year: 1991, month: 3, day: 2,
      calendar: "lunar", isLeapMonth: true,
    });
  });
});

describe("getMapByShareId", () => {
  it("없으면 null", async () => {
    const { client } = fakeClient([]);
    expect(await getMapByShareId("nope", client)).toBeNull();
  });
});

describe("createMap", () => {
  it("이미 있으면 INSERT 하지 않고 그대로 돌려준다", async () => {
    const { client, calls } = fakeClient([mapDbRow]);
    const row = await createMap("3", {
      name: "김동진", year: 1990, month: 10, day: 25,
      calendar: "solar", isLeapMonth: false,
    }, client);
    expect(row.id).toBe("7");
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain("SELECT");
  });

  it("없으면 INSERT 하고 다시 읽어 돌려준다", async () => {
    const { client, calls } = fakeClient([], [], [mapDbRow]);
    const row = await createMap("3", {
      name: "김동진", year: 1990, month: 10, day: 25,
      calendar: "solar", isLeapMonth: false,
    }, client);
    expect(row.id).toBe("7");
    expect(calls).toHaveLength(3);
    expect(calls[1].sql).toContain("INSERT INTO maps");
    // share_id 는 UUID 로 만든다 — 연속 정수 PK 를 URL 에 노출하지 않기 위해서다
    expect(calls[1].values[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

describe("listMapPeople", () => {
  it("행을 변환해 돌려준다", async () => {
    const { client } = fakeClient([personDbRow]);
    expect(await listMapPeople("7", client)).toHaveLength(1);
  });
});

describe("addMapPerson", () => {
  const person = {
    name: "민수", year: 1991, month: 3, day: 2,
    calendar: "lunar" as const, isLeapMonth: true,
  };

  it("한도에 다다르면 MapPeopleLimitError", async () => {
    const { client } = fakeClient([{ n: MAX_MAP_PEOPLE }]);
    await expect(addMapPerson("7", person, client)).rejects.toBeInstanceOf(MapPeopleLimitError);
  });

  it("중복이면 DuplicatePersonError", async () => {
    // count 는 여유가 있는데 INSERT 가 아무 행도 돌려주지 않는다 = 유니크 인덱스 충돌
    const { client } = fakeClient([{ n: 3 }], []);
    await expect(addMapPerson("7", person, client)).rejects.toBeInstanceOf(DuplicatePersonError);
  });

  it("성공하면 저장된 행을 돌려준다", async () => {
    const { client } = fakeClient([{ n: 3 }], [personDbRow]);
    expect((await addMapPerson("7", person, client)).id).toBe("11");
  });
});

describe("deleteMapPerson", () => {
  it("지운 행이 없으면 false", async () => {
    const { client } = fakeClient([]);
    expect(await deleteMapPerson("7", "11", client)).toBe(false);
  });

  it("map_id 를 함께 조건에 넣는다", async () => {
    const { client, calls } = fakeClient([{ id: 11 }]);
    expect(await deleteMapPerson("7", "11", client)).toBe(true);
    expect(calls[0].sql).toContain("map_id");
  });
});
```

- [ ] **Step 5: 실패를 확인한다**

```bash
npx vitest run src/lib/maps/
```

기대: FAIL — 모듈이 없다.

- [ ] **Step 6: 저장소를 구현한다**

`src/lib/maps/store.ts`:

```ts
import { sql as neonSql, type SqlClient } from "@/lib/db";
import type { BirthLite, MapPersonRow, MapRow } from "./types";

// 타입은 types.ts 가 소유한다 — 순수 모듈(to-map-people.ts)이 같은 타입을 쓰면서
// 이 파일을 거쳐 @/lib/db 를 끌고 오지 않게 하기 위해서다. 호출부 편의를 위해
// 여기서 다시 내보낸다.
export type { BirthLite, MapPersonRow, MapRow, SqlClient };

const sql = neonSql as unknown as SqlClient;

/**
 * 지도당 인원 상한.
 *
 * 임의의 숫자가 아니라 배치의 기하학에서 나온 값이다(설계 §1.3). 기본 소구역은
 * 8명까지 최소 이웃거리 10px 을 유지하고 그 다음부터 무너진다(코어 지름 4.9px).
 * 사람의 10/12 가 기본 상태이고 Role 5개로 갈리므로 칸당 ≈ N/6 이고, 8을
 * 대입하면 N ≈ 48 이다. 올리려면 §1.3 의 측정을 다시 해야 한다.
 */
export const MAX_MAP_PEOPLE = 50;

export class MapPeopleLimitError extends Error {
  constructor() {
    super(`한 지도에는 최대 ${MAX_MAP_PEOPLE}명까지 추가할 수 있습니다`);
    this.name = "MapPeopleLimitError";
  }
}

/** 같은 이름·생년월일이 이미 있다. 유니크 인덱스 map_people_dedupe 가 낸다. */
export class DuplicatePersonError extends Error {
  constructor() {
    super("이미 지도에 있는 사람입니다");
    this.name = "DuplicatePersonError";
  }
}

function calendarOf(v: unknown): "solar" | "lunar" {
  return v === "lunar" ? "lunar" : "solar";
}

/** DB 행 → MapRow. 컬럼 이름을 아는 유일한 곳이다. */
export function toMapRow(r: Record<string, unknown>): MapRow {
  return {
    id: String(r.id),
    shareId: String(r.share_id),
    ownerUserId: String(r.owner_user_id),
    center: {
      name: String(r.center_name),
      year: Number(r.center_birth_year),
      month: Number(r.center_birth_month),
      day: Number(r.center_birth_day),
      calendar: calendarOf(r.center_calendar),
      isLeapMonth: r.center_is_leap_month === true,
    },
    createdAt: String(r.created_at),
  };
}

export function toMapPersonRow(r: Record<string, unknown>): MapPersonRow {
  return {
    id: String(r.id),
    name: String(r.name),
    year: Number(r.birth_year),
    month: Number(r.birth_month),
    day: Number(r.birth_day),
    calendar: calendarOf(r.calendar),
    isLeapMonth: r.is_leap_month === true,
  };
}

/**
 * 공개 링크로 지도를 찾는다. 소유자 조건이 없다 — 링크를 아는 누구나 본다.
 * 그 안전은 share_id 가 추측 불가능하다는 데서만 온다.
 */
export async function getMapByShareId(
  shareId: string,
  client: SqlClient = sql,
): Promise<MapRow | null> {
  const rows = await client`SELECT * FROM maps WHERE share_id = ${shareId}`;
  const row = rows[0];
  return row ? toMapRow(row) : null;
}

export async function getMapByOwner(
  userId: string,
  client: SqlClient = sql,
): Promise<MapRow | null> {
  const rows = await client`SELECT * FROM maps WHERE owner_user_id = ${userId}::bigint`;
  const row = rows[0];
  return row ? toMapRow(row) : null;
}

/**
 * 지도를 만든다. 이미 있으면 그것을 돌려준다 — /map 진입이 GET 이라 멱등해야 한다.
 *
 * ON CONFLICT DO NOTHING 만으로는 안 된다: 충돌하면 RETURNING 이 빈 결과라 돌려줄
 * 행이 없다. DO UPDATE 로 자기 자신을 갱신해 RETURNING 을 채우는 방법도 있지만,
 * /map 진입은 대부분 "이미 있는 지도" 라 흔한 경로가 읽기 전용이어야 한다.
 * 그래서 먼저 읽고, 없을 때만 넣고, 넣은 뒤 다시 읽는다.
 */
export async function createMap(
  userId: string,
  center: BirthLite & { name: string },
  client: SqlClient = sql,
): Promise<MapRow> {
  const existing = await getMapByOwner(userId, client);
  if (existing) return existing;

  const shareId = crypto.randomUUID();
  await client`
    INSERT INTO maps (
      share_id, owner_user_id, center_name,
      center_calendar, center_is_leap_month,
      center_birth_year, center_birth_month, center_birth_day
    ) VALUES (
      ${shareId}, ${userId}::bigint, ${center.name},
      ${center.calendar}, ${center.isLeapMonth},
      ${center.year}, ${center.month}, ${center.day}
    )
    ON CONFLICT (owner_user_id) DO NOTHING
  `;

  // 동시 요청이 먼저 넣었으면 위 INSERT 가 아무 일도 하지 않는다 — 그때도 여기서
  // 그 행을 읽어 온다. 이것이 이 함수가 멱등한 방식이다.
  const row = await getMapByOwner(userId, client);
  if (!row) throw new Error("createMap: 삽입 후에도 지도를 찾지 못했다");
  return row;
}

export async function listMapPeople(
  mapId: string,
  client: SqlClient = sql,
): Promise<MapPersonRow[]> {
  const rows = await client`
    SELECT * FROM map_people WHERE map_id = ${mapId}::bigint ORDER BY created_at ASC
  `;
  return rows.map(toMapPersonRow);
}

export async function countMapPeople(
  mapId: string,
  client: SqlClient = sql,
): Promise<number> {
  const rows = await client`
    SELECT count(*)::int AS n FROM map_people WHERE map_id = ${mapId}::bigint
  `;
  return Number(rows[0]?.n ?? 0);
}

/**
 * 사람을 더한다. 한도 검사는 앱 레벨이라 동시 요청에서 한 명쯤 더 들어갈 수 있다 —
 * profiles/store.ts 의 createProfile 과 같은 판단이다(개수 한도는 UX 가드다).
 *
 * 중복은 반대로 DB 가 막는다. 유니크 인덱스에 걸리면 ON CONFLICT DO NOTHING 이
 * 빈 RETURNING 을 주고, 그것이 곧 "이미 있다" 다.
 */
export async function addMapPerson(
  mapId: string,
  person: BirthLite & { name: string },
  client: SqlClient = sql,
): Promise<MapPersonRow> {
  const count = await countMapPeople(mapId, client);
  if (count >= MAX_MAP_PEOPLE) throw new MapPeopleLimitError();

  const rows = await client`
    INSERT INTO map_people (
      map_id, name, calendar, is_leap_month, birth_year, birth_month, birth_day
    ) VALUES (
      ${mapId}::bigint, ${person.name}, ${person.calendar}, ${person.isLeapMonth},
      ${person.year}, ${person.month}, ${person.day}
    )
    ON CONFLICT DO NOTHING
    RETURNING *
  `;
  const row = rows[0];
  if (!row) throw new DuplicatePersonError();
  return toMapPersonRow(row);
}

/**
 * 사람을 지운다. 지운 행이 없으면 false.
 *
 * ⚠️ map_id 조건이 이 함수의 존재 이유다. map_people.id 는 순번 bigint 라, id 만으로
 * 지우면 다른 지도의 사람을 지울 수 있다 — profiles/store.ts 의 getProfile 이
 * user_id 를 함께 거는 것과 같은 이유다.
 */
export async function deleteMapPerson(
  mapId: string,
  personId: string,
  client: SqlClient = sql,
): Promise<boolean> {
  const rows = await client`
    DELETE FROM map_people
    WHERE id = ${personId}::bigint AND map_id = ${mapId}::bigint
    RETURNING id
  `;
  return rows.length > 0;
}
```

- [ ] **Step 7: 테스트가 통과하는지 확인한다**

```bash
npx vitest run src/lib/maps/
npx tsc --noEmit
```

기대: PASS.

- [ ] **Step 8: 마이그레이션을 적용한다**

```bash
npm run db:migrate
```

기대: `0020_maps.sql`, `0021_map_people.sql` 적용됨. `.env.local` 이 없어 실패하면 그대로 보고하고 다음 단계로 간다 — 코드는 마이그레이션 없이도 컴파일된다.

- [ ] **Step 9: 커밋**

```bash
git add migrations/0020_maps.sql migrations/0021_map_people.sql src/lib/maps/
git commit -m "$(cat <<'EOF'
feat(map): maps / map_people 테이블과 저장소

공개 URL 은 연속 정수 PK 가 아니라 share_id(UUID)를 쓴다. 중심 생년월일은
profiles 를 참조하지 않고 복사해, 프로필을 지워도 공유 링크가 살아 있다.
중복 추가는 유니크 인덱스가 막고 50명 상한은 앱이 본다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 추가·삭제 API

**Files:**
- Create: `src/app/api/maps/[share]/people/route.ts`
- Create: `src/app/api/maps/[share]/people/[id]/route.ts`
- Test: `src/app/api/maps/_lib/handler.ts`, `src/app/api/maps/_lib/handler.test.ts`

라우트 핸들러 자체는 node 테스트로 잡기 번거로우니, `src/app/api/profiles/route.ts` 가 `_lib/handler.ts` 에 판단을 내려두는 패턴을 그대로 따른다 — 핸들러는 순수 함수라 테스트가 되고, 라우트는 쿠키·세션·JSON 파싱만 한다.

**Interfaces:**
- Consumes: Task 4 의 저장소 전부, `addPersonSchema`
- Produces:
  - `handleAddPerson(raw: unknown, deps) → { status: number; body: unknown }`
  - `handleDeletePerson(deps) → { status: number; body: unknown }`

- [ ] **Step 1: 핸들러의 실패 테스트를 쓴다**

`src/app/api/maps/_lib/handler.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DuplicatePersonError, MapPeopleLimitError } from "@/lib/maps/store";
import { handleAddPerson, handleDeletePerson } from "./handler";

const map = {
  id: "7", shareId: "s", ownerUserId: "3",
  center: { name: "나", year: 1990, month: 10, day: 25, calendar: "solar" as const, isLeapMonth: false },
  createdAt: "2026-08-18T00:00:00.000Z",
};
const body = { name: "민수", birth: { year: 1991, month: 3, day: 2 } };
const added = { id: "11", name: "민수", year: 1991, month: 3, day: 2, calendar: "solar" as const, isLeapMonth: false };

describe("handleAddPerson", () => {
  it("없는 지도면 404", async () => {
    const r = await handleAddPerson(body, { findMap: async () => null, add: async () => added });
    expect(r.status).toBe(404);
  });

  it("본문이 스키마에 안 맞으면 400", async () => {
    const r = await handleAddPerson({ name: "" }, { findMap: async () => map, add: async () => added });
    expect(r.status).toBe(400);
  });

  it("만세력이 못 세우는 날짜면 400", async () => {
    const r = await handleAddPerson(
      { name: "민수", birth: { year: 1991, month: 2, day: 31 } },
      { findMap: async () => map, add: async () => added },
    );
    expect(r.status).toBe(400);
  });

  it("한도를 넘으면 409", async () => {
    const r = await handleAddPerson(body, {
      findMap: async () => map,
      add: async () => { throw new MapPeopleLimitError(); },
    });
    expect(r.status).toBe(409);
  });

  it("중복이면 409", async () => {
    const r = await handleAddPerson(body, {
      findMap: async () => map,
      add: async () => { throw new DuplicatePersonError(); },
    });
    expect(r.status).toBe(409);
  });

  it("성공하면 201 과 지도 위의 자리를 돌려준다", async () => {
    const r = await handleAddPerson(body, { findMap: async () => map, add: async () => added });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ person: { id: "11", name: "민수" } });
    // 생년월일은 응답에 담지 않는다 — 남의 지도에서 남의 생일을 읽을 수 있게 된다
    expect(JSON.stringify(r.body)).not.toContain("1991");
  });

  // 로그인은 필요 없다. 이 규칙이 "누구나 추가" 의 전부라 테스트로 박아둔다.
  it("세션이 없어도 추가된다", async () => {
    const r = await handleAddPerson(body, { findMap: async () => map, add: async () => added });
    expect(r.status).toBe(201);
  });
});

describe("handleDeletePerson", () => {
  it("없는 지도면 404", async () => {
    const r = await handleDeletePerson({
      findMap: async () => null, userId: "3", personId: "11", remove: async () => true,
    });
    expect(r.status).toBe(404);
  });

  it("비로그인은 403", async () => {
    const r = await handleDeletePerson({
      findMap: async () => map, userId: null, personId: "11", remove: async () => true,
    });
    expect(r.status).toBe(403);
  });

  it("소유자가 아니면 403", async () => {
    const r = await handleDeletePerson({
      findMap: async () => map, userId: "99", personId: "11", remove: async () => true,
    });
    expect(r.status).toBe(403);
  });

  it("소유자면 지운다", async () => {
    const r = await handleDeletePerson({
      findMap: async () => map, userId: "3", personId: "11", remove: async () => true,
    });
    expect(r.status).toBe(200);
  });

  it("이미 없으면 404", async () => {
    const r = await handleDeletePerson({
      findMap: async () => map, userId: "3", personId: "11", remove: async () => false,
    });
    expect(r.status).toBe(404);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run src/app/api/maps/
```

기대: FAIL — 모듈이 없다.

- [ ] **Step 3: 핸들러를 구현한다**

`src/app/api/maps/_lib/handler.ts`:

```ts
import { addPersonSchema } from "@/lib/maps/input";
import {
  DuplicatePersonError,
  MapPeopleLimitError,
  type BirthLite,
  type MapPersonRow,
  type MapRow,
} from "@/lib/maps/store";
import { dayPillarOf, toMapPerson } from "@/app/map/_lib/to-map-people";

export interface AddDeps {
  findMap: () => Promise<MapRow | null>;
  add: (mapId: string, person: BirthLite & { name: string }) => Promise<MapPersonRow>;
}

export interface HandlerResult {
  status: number;
  body: unknown;
}

/**
 * 사람 추가. **로그인을 보지 않는다** — 링크를 가진 누구나 추가할 수 있다는 것이
 * 이 기능의 전부다.
 *
 * 응답에 생년월일을 담지 않는다. 담으면 남의 지도를 연 사람이 거기 있는 모든
 * 사람의 생일을 읽게 된다. 화면이 쓰는 것은 이름·일주·구역뿐이다.
 */
export async function handleAddPerson(raw: unknown, deps: AddDeps): Promise<HandlerResult> {
  const map = await deps.findMap();
  if (!map) return { status: 404, body: { error: "지도를 찾을 수 없습니다" } };

  const parsed = addPersonSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 400, body: { error: "이름과 생년월일을 확인해 주세요" } };
  }

  const input = {
    name: parsed.data.name,
    year: parsed.data.birth.year,
    month: parsed.data.birth.month,
    day: parsed.data.birth.day,
    calendar: parsed.data.calendar,
    isLeapMonth: parsed.data.isLeapMonth,
  };

  // 스키마는 범위만 본다. 2월 31일이나 없는 윤달은 여기서 걸린다 — 저장한 뒤
  // 화면에서 조용히 사라지는 것보다 지금 거절하는 편이 낫다.
  const centerDay = dayPillarOf(map.center);
  if (!centerDay || !dayPillarOf(input)) {
    return { status: 400, body: { error: "실제로 있는 날짜인지 확인해 주세요" } };
  }

  try {
    const row = await deps.add(map.id, input);
    const person = toMapPerson(centerDay, row);
    if (!person) return { status: 400, body: { error: "실제로 있는 날짜인지 확인해 주세요" } };
    return { status: 201, body: { person } };
  } catch (e) {
    if (e instanceof MapPeopleLimitError) return { status: 409, body: { error: e.message } };
    if (e instanceof DuplicatePersonError) return { status: 409, body: { error: e.message } };
    throw e;
  }
}

export interface DeleteDeps {
  findMap: () => Promise<MapRow | null>;
  /** 세션이 없으면 null */
  userId: string | null;
  personId: string;
  remove: (mapId: string, personId: string) => Promise<boolean>;
}

/**
 * 사람 삭제. 소유자만이다 — 누구나 추가할 수 있으니 지울 수 있는 사람이 있어야 한다.
 *
 * 비소유자에게 404 가 아니라 403 을 준다. profiles 의 getProfile 이 404 로 접는
 * 것은 id 를 증가시켜 남의 것을 훑는 것을 막기 위해서인데, 여기서는 요청자가
 * share_id 를 이미 알고 그 지도를 보고 있으므로 존재는 이미 알려진 사실이다.
 */
export async function handleDeletePerson(deps: DeleteDeps): Promise<HandlerResult> {
  const map = await deps.findMap();
  if (!map) return { status: 404, body: { error: "지도를 찾을 수 없습니다" } };
  if (deps.userId === null || deps.userId !== map.ownerUserId) {
    return { status: 403, body: { error: "지도 주인만 지울 수 있습니다" } };
  }

  const removed = await deps.remove(map.id, deps.personId);
  if (!removed) return { status: 404, body: { error: "이미 지워진 사람입니다" } };
  return { status: 200, body: { ok: true } };
}
```

- [ ] **Step 4: 라우트 둘을 붙인다**

먼저 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` 와 `dynamic-routes.md` 를 읽는다. 이 버전에서 `params` 는 Promise 다(`src/app/api/auth/callbacks/[provider]/route.ts:13` 이 같은 모양을 쓴다).

`src/app/api/maps/[share]/people/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { addMapPerson, getMapByShareId } from "@/lib/maps/store";
import { handleAddPerson } from "../../_lib/handler";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ share: string }> },
): Promise<NextResponse> {
  const { share } = await ctx.params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 본문이 유효한 JSON이 아닙니다" }, { status: 400 });
  }

  try {
    const result = await handleAddPerson(raw, {
      findMap: () => getMapByShareId(share),
      add: addMapPerson,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[POST /api/maps/[share]/people]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
```

`src/app/api/maps/[share]/people/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { deleteMapPerson, getMapByShareId } from "@/lib/maps/store";
import { handleDeletePerson } from "../../../_lib/handler";

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ share: string; id: string }> },
): Promise<NextResponse> {
  const { share, id } = await ctx.params;

  // ::bigint 캐스팅에서 DB 에러가 나지 않도록 형식을 먼저 본다
  // (profiles/param.ts 가 같은 이유로 존재한다).
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }

  const session = await getSession();

  try {
    const result = await handleDeletePerson({
      findMap: () => getMapByShareId(share),
      userId: session?.userId ?? null,
      personId: id,
      remove: deleteMapPerson,
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (e) {
    console.error("[DELETE /api/maps/[share]/people/[id]]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
```

- [ ] **Step 5: 확인한다**

```bash
npx vitest run src/app/api/maps/
npx tsc --noEmit
npm run build
```

기대: 전부 통과. 빌드 결과에 `ƒ /api/maps/[share]/people` 와 `ƒ /api/maps/[share]/people/[id]` 가 있다.

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/maps/
git commit -m "$(cat <<'EOF'
feat(map): 사람 추가·삭제 API

추가는 로그인을 보지 않는다 — 링크를 가진 누구나 할 수 있다는 것이 이 기능의
전부다. 삭제는 소유자만이다. 응답에 생년월일을 담지 않아, 남의 지도를 연
사람이 거기 있는 사람들의 생일을 읽지 못한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 화면을 실데이터로 배선한다

`World.tsx` 가 모듈 상수 `FRIENDS` 를 직접 import 하던 것을 props 로 바꾼다. 이 태스크가 끝나도 화면에는 여전히 mock 이 보인다 — `page.tsx` 가 mock 을 넘기기 때문이다. 데이터 출처는 Task 7 이 바꾼다.

**Files:**
- Modify: `src/app/map/_components/World.tsx`
- Modify: `src/app/map/_components/WorldShell.tsx` → `MapShell.tsx` 로 이름 변경
- Modify: `src/app/map/_components/SelfCore.tsx`
- Modify: `src/app/map/_components/PersonMarker.tsx`
- Modify: `src/app/map/_components/PersonSheet.tsx`
- Modify: `src/app/map/_components/PeopleList.tsx`
- Modify: `src/app/map/page.tsx`

**Interfaces:**
- Consumes: Task 3 의 `MapPerson`·`MapCenter`
- Produces: `<MapShell people={MapPerson[]} center={MapCenter} isOwner={boolean} shareId={string} />`

- [ ] **Step 1: 타입을 갈아끼운다**

`PersonMarker.tsx`, `PersonSheet.tsx`, `PeopleList.tsx` 에서 `import type { MockPerson } from "../_data/mock-people"` 를 `import type { MapPerson } from "../_data/person"` 로 바꾸고, 본문의 `MockPerson` 을 전부 `MapPerson` 으로 바꾼다.

`PeopleList.tsx` 는 `FRIENDS` 를 직접 import 하고 있다. props 로 바꾼다:

```tsx
export function PeopleList({
  people,
  open,
  onToggle,
  selectedId,
  onSelect,
  isOwner,
  onDelete,
}: {
  people: readonly MapPerson[];
  open: boolean;
  onToggle: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 소유자만 삭제 버튼을 본다. 누구나 추가할 수 있으니 지울 사람이 있어야 한다. */
  isOwner: boolean;
  onDelete: (id: string) => void;
}) {
  const byRole = ROLE_ORDER.map((role) => ({
    role,
    people: people.filter((p) => p.role === role),
  }));
  // ... 이하 기존 렌더. 각 행 오른쪽에 isOwner 일 때만 삭제 버튼을 붙인다.
```

삭제 버튼은 행의 오른쪽 끝에 둔다:

```tsx
{isOwner && (
  <button
    type="button"
    aria-label={`${person.name} 지우기`}
    onClick={(e) => {
      // 행 전체가 선택 버튼이다 — 삭제가 선택으로 새면 지우자마자 시트가 열린다.
      e.stopPropagation();
      onDelete(person.id);
    }}
    className="ml-auto shrink-0 rounded-lg px-2 py-1 text-[12px] text-slate-500 hover:bg-white/10 hover:text-slate-300"
  >
    지우기
  </button>
)}
```

- [ ] **Step 2: `PersonSheet` 에 동일일주 문구를 더한다**

`FEATURE_NOTE` 를 렌더하는 자리 바로 아래에 붙인다:

```tsx
{shown.sameDayPillar && (
  // 六合 도 沖 도 아니라 배치로는 말할 수 없는 사실이다. 여기서만 말한다.
  <p className="mt-1 text-[13px] text-slate-500">일주가 통째로 같아요.</p>
)}
```

- [ ] **Step 3: `SelfCore` 가 중심을 props 로 받게 한다**

```tsx
import type { MapCenter } from "../_data/person";

export function SelfCore({ center }: { center: MapCenter }) {
  // ... 기존 렌더에서 SELF.name 을 center.name 으로 바꾼다
```

`_data/mock-people` 의 `SELF` import 를 지운다.

- [ ] **Step 4: `World` 가 목록을 props 로 받게 한다**

`World.tsx` 의 `import { FRIENDS } from "../_data/mock-people"` 를 지우고, props 를 더한다:

```tsx
export function World({
  people,
  center,
  selectedId,
  onSelect,
  mode,
  resetSignal,
}: {
  people: readonly MapPerson[];
  center: MapCenter;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  mode: CameraMode;
  resetSignal: number;
}) {
  const placed = useMemo(() => placePeople(people), [people]);
  const targets = useMemo(() => people.map((p) => placed.get(p.id)!), [people, placed]);
  const roles = useMemo(() => people.map((p) => p.role), [people]);
  const counts = useMemo(
    () =>
      Object.fromEntries(
        ROLE_ORDER.map((role) => [
          role,
          Object.fromEntries(
            (["none", "yukhap", "chung"] as Feature[]).map((feature) => [
              feature,
              people.filter((p) => p.role === role && p.feature === feature).length,
            ]),
          ),
        ]),
      ) as Record<RelationRole, Record<Feature, number>>,
    [people],
  );
  const selected = people.find((p) => p.id === selectedId) ?? null;
  // ... 이하 기존 렌더. FRIENDS.map → people.map, <SelfCore /> → <SelfCore center={center} />
```

- [ ] **Step 5: `WorldShell` 을 `MapShell` 로 바꾼다**

```bash
git mv src/app/map/_components/WorldShell.tsx src/app/map/_components/MapShell.tsx
```

컴포넌트 이름과 props 를 바꾼다:

```tsx
export function MapShell({
  people,
  center,
  isOwner,
  shareId,
}: {
  people: readonly MapPerson[];
  center: MapCenter;
  isOwner: boolean;
  shareId: string;
}) {
  const selected = people.find((p) => p.id === selectedId) ?? null;
```

기존 본문에서 바꿀 곳은 넷이다:

1. `const selected = FRIENDS.find(...)` → `people.find(...)`
2. `<World ... />` 에 `people={people} center={center}` 를 더한다
3. `<PeopleList ... />` 에 `people={people} isOwner={isOwner} onDelete={handleDelete}` 를 더한다
4. `<PersonSheet person={selected} .../>` 는 그대로 둔다 — 타입만 `MapPerson` 으로 바뀐다
```

삭제는 API 를 부르고 `router.refresh()` 로 서버 데이터를 다시 읽는다:

```tsx
const router = useRouter();

async function handleDelete(id: string) {
  const res = await fetch(`/api/maps/${shareId}/people/${id}`, { method: "DELETE" });
  if (!res.ok) return;
  // 서버 컴포넌트가 목록의 진실이다. 로컬 상태로 낙관적 갱신을 하면 두 벌이 된다.
  if (selectedId === id) setSelectedId(null);
  router.refresh();
}
```

`shareId` 는 아직 안 쓰는 자리가 있어도 좋다 — Task 8·9 가 쓴다.

- [ ] **Step 6: `page.tsx` 가 mock 을 넘기게 임시 배선한다**

Task 7 이 이 파일을 대체한다. 지금은 컴파일과 육안 확인만 되면 된다.

```tsx
import type { Metadata } from "next";
import { FRIENDS, SELF } from "./_data/mock-people";
import { MapShell } from "./_components/MapShell";

export const metadata: Metadata = {
  title: "관계 지도",
  robots: { index: false, follow: false },
};

// TASK 7 이 이 파일을 리다이렉트 전용 서버 컴포넌트로 대체한다.
export default function MapPage() {
  return (
    <MapShell
      people={FRIENDS.map((p) => ({ ...p, sameDayPillar: false }))}
      center={{ name: SELF.name, pillarKey: SELF.pillarKey, sceneName: SELF.sceneName }}
      isOwner
      shareId="preview"
    />
  );
}
```

- [ ] **Step 7: 확인한다**

```bash
npx tsc --noEmit
npm test
npm run build
```

기대: 전부 통과. `_lib`/`_data` 테스트가 하나도 안 깨져야 한다 — `mock-people.ts` 는 손대지 않았다.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(map): 사람 목록과 중심을 props 로 받는다

World 가 모듈 상수 FRIENDS 를 직접 import 하던 것을 끊는다. WorldShell 은
MapShell 이 되고 소유자에게 삭제 버튼을 준다. 데이터 출처는 아직 mock 이다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `/map` 과 `/map/[share]` 페이지

**Files:**
- Rewrite: `src/app/map/page.tsx`
- Create: `src/app/map/[share]/page.tsx`
- Move: `src/app/map/layout.tsx` (그대로 둔다 — 두 페이지가 같은 다크 배경을 쓴다)

**Interfaces:**
- Consumes: Task 3 의 `centerOf`·`toMapPerson`, Task 4 의 저장소, Task 6 의 `MapShell`
- Produces: `/map/<share_id>` 공개 URL

- [ ] **Step 1: `/map` 을 리다이렉트 전용으로 바꾼다**

먼저 `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` 를 읽는다.

`src/app/map/page.tsx` 를 통째로 아래로 바꾼다:

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listProfiles } from "@/lib/profiles/store";
import { createMap, getMapByOwner } from "@/lib/maps/store";

/**
 * 내 지도로 보내는 문. 렌더하는 것이 없다.
 *
 * GET 이 행을 만드는 것이 걸리지만, maps_owner_user 유니크 인덱스와 createMap 의
 * 읽기-삽입-읽기 덕에 멱등하다. 새로고침해도 지도가 늘지 않는다.
 */
export default async function MapEntryPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/map");

  const existing = await getMapByOwner(session.userId);
  if (existing) redirect(`/map/${existing.shareId}`);

  // "가장 먼저 만든 것" 이 임의 선택이 아닌 이유: 퍼널을 통과하며 만든 본인 사주가
  // 그 자리이고, 드래프트 승격도 첫 행이 되므로 로그인 전후가 같은 사람을 가리킨다.
  const profiles = await listProfiles(session.userId, "self");
  const mine = profiles[profiles.length - 1]; // listProfiles 는 최신순이다
  if (!mine) redirect("/funnel?step=name");

  const map = await createMap(session.userId, {
    name: mine.name,
    year: mine.birth.year,
    month: mine.birth.month,
    day: mine.birth.day,
    calendar: mine.calendar,
    isLeapMonth: mine.isLeapMonth,
  });

  redirect(`/map/${map.shareId}`);
}
```

> 구현자에게: `listProfiles` 는 `ORDER BY created_at DESC` 다(`src/lib/profiles/store.ts` 참고). 그래서 "가장 먼저 만든 것" 은 배열의 **마지막** 원소다. 위 코드가 그렇게 되어 있는지 반드시 확인하라 — 여기가 뒤집히면 self 프로필이 여러 개인 사용자의 지도 중심이 엉뚱한 사람이 된다.

- [ ] **Step 2: 공개 페이지를 만든다**

`src/app/map/[share]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getMapByShareId, listMapPeople } from "@/lib/maps/store";
import { centerOf, dayPillarOf, toMapPerson } from "../_lib/to-map-people";
import { MapShell } from "../_components/MapShell";

type Params = { params: Promise<{ share: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { share } = await params;
  const map = await getMapByShareId(share);
  if (!map) return { title: "관계 지도" };

  const people = await listMapPeople(map.id);
  return {
    title: `${map.center.name}님의 관계 지도`,
    description: `${people.length}명이 있는 관계 지도예요.`,
    // 링크를 아는 사람만 보는 것이 전제다. 검색에 잡히면 그 전제가 깨진다.
    robots: { index: false, follow: false },
  };
}

export default async function MapPage({ params }: Params) {
  const { share } = await params;

  const map = await getMapByShareId(share);
  if (!map) notFound();

  const center = centerOf(map.center.name, map.center);
  const centerDay = dayPillarOf(map.center);
  // 중심을 못 세우면 지도가 성립하지 않는다. 만세력이 못 세우는 값이 지도로
  // 들어올 길은 없지만(퍼널이 이미 걸렀다), 없는 지도와 같이 다룬다.
  if (!center || !centerDay) notFound();

  const rows = await listMapPeople(map.id);
  // 계산되지 않는 사람은 조용히 뺀다 — 한 명 때문에 지도 전체가 500 이 되면 안 된다.
  const people = rows
    .map((row) => toMapPerson(centerDay, row))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const session = await getSession();

  return (
    <MapShell
      people={people}
      center={center}
      isOwner={session?.userId === map.ownerUserId}
      shareId={map.shareId}
    />
  );
}
```

- [ ] **Step 3: 확인한다**

```bash
npx tsc --noEmit
npm test
npm run build
```

기대: 빌드 결과에 `ƒ /map` 과 `ƒ /map/[share]` 가 있다.

- [ ] **Step 4: 브라우저로 확인한다**

`.claude/launch.json` 의 `saju-dev`(포트 3021)로 프리뷰를 띄우고 `/map` 을 연다.

- 비로그인이면 `/login?next=/map` 으로 간다
- 로그인 + self 프로필 없음이면 `/funnel?step=name` 으로 간다
- 로그인 + 프로필 있음이면 `/map/<uuid>` 로 가고 중심 노드에 내 이름이 뜬다(사람은 0명)
- 새로고침해도 URL 의 uuid 가 그대로다(멱등)

**주의: 프리뷰 창은 `requestAnimationFrame` 을 돌리지 않아 `useFrame` 이 실행되지 않는다.** 3D 안의 위치·오프셋은 프리뷰로 검증할 수 없다 — 이 단계에서 볼 것은 리다이렉트와 중심 이름뿐이다.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(map): 내 지도로 보내는 /map 과 공개 /map/[share]

/map 은 렌더하지 않고 보내기만 한다 — 로그인 없으면 로그인으로, 사주가
없으면 퍼널로, 있으면 내 지도로. 공개 페이지는 링크를 아는 누구나 열고,
검색에는 잡히지 않는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 생년월일 추가 UI

**Files:**
- Create: `src/app/map/_lib/add-draft.ts`
- Test: `src/app/map/_lib/add-draft.test.ts`
- Create: `src/app/map/_components/AddPersonSheet.tsx`
- Modify: `src/app/map/_components/MapShell.tsx`

**Interfaces:**
- Consumes: Task 5 의 `POST /api/maps/[share]/people`
- Produces: `type AddDraft`, `emptyAddDraft`, `addDraftIssues(draft, currentYear?)`, `toAddBody(draft, currentYear?)`

- [ ] **Step 1: 검증의 실패 테스트를 쓴다**

`src/app/map/_lib/add-draft.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { addDraftIssues, emptyAddDraft, toAddBody, type AddDraft } from "./add-draft";

const filled: AddDraft = {
  name: "민수", calendar: "solar", isLeapMonth: false, y: "1991", m: "3", d: "2",
};

describe("addDraftIssues", () => {
  it("다 채우면 문제가 없다", () => {
    expect(addDraftIssues(filled, 2026)).toEqual([]);
  });

  it("이름이 비면 name", () => {
    expect(addDraftIssues({ ...filled, name: "  " }, 2026)).toContain("name");
  });

  it("연도가 네 자리가 아니면 birth", () => {
    expect(addDraftIssues({ ...filled, y: "91" }, 2026)).toContain("birth");
  });

  it("없는 날짜면 birth", () => {
    expect(addDraftIssues({ ...filled, m: "2", d: "31" }, 2026)).toContain("birth");
  });

  it("미래 연도면 birth", () => {
    expect(addDraftIssues({ ...filled, y: "2027" }, 2026)).toContain("birth");
  });
});

describe("toAddBody", () => {
  it("완성된 초안을 API 본문으로 바꾼다", () => {
    expect(toAddBody(filled, 2026)).toEqual({
      name: "민수",
      calendar: "solar",
      isLeapMonth: false,
      birth: { year: 1991, month: 3, day: 2 },
    });
  });

  it("이름 앞뒤 공백을 자른다", () => {
    expect(toAddBody({ ...filled, name: " 민수 " }, 2026)!.name).toBe("민수");
  });

  it("덜 찼으면 null", () => {
    expect(toAddBody({ ...filled, d: "" }, 2026)).toBeNull();
  });

  it("양력이면 윤달을 끈다", () => {
    expect(toAddBody({ ...filled, isLeapMonth: true }, 2026)!.isLeapMonth).toBe(false);
  });
});

describe("emptyAddDraft", () => {
  it("빈 초안은 아무 안내도 띄우지 않을 수 있게 전부 비어 있다", () => {
    expect(emptyAddDraft.name).toBe("");
    expect(emptyAddDraft.y).toBe("");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

```bash
npx vitest run src/app/map/_lib/add-draft.test.ts
```

기대: FAIL.

- [ ] **Step 3: 구현한다**

`src/app/map/_lib/add-draft.ts`:

```ts
/**
 * 추가 폼이 타이핑 중에 들고 있는 상태. match/_lib/to-counterpart.ts 와 같은
 * 모양이되 성별·시각이 없다 — 지도는 일주만 쓰고 일주는 그 둘과 무관하다.
 *
 * 판정 규칙을 화면과 두 벌로 두지 않는다. 두 벌이 되면 "폼은 다 됐다고 하는데
 * 제출은 막힌 상태" 가 반드시 생긴다(to-counterpart.ts 의 draftIssues 주석).
 */
import type { AddPersonBody } from "@/lib/maps/input";

export interface AddDraft {
  name: string;
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
  y: string;
  m: string;
  d: string;
}

export const emptyAddDraft: AddDraft = {
  name: "", calendar: "solar", isLeapMonth: false, y: "", m: "", d: "",
};

/**
 * 숫자 입력칸 공용 필터. match/_lib/to-counterpart.ts 에 같은 함수가 있지만
 * import 하지 않는다 — 그쪽은 궁합 전용 파일이라 라우트를 가로지른다.
 * home/page.tsx 가 report/_lib/access.ts 의 헬퍼를 두고 같은 판단을 적어뒀다:
 * "레이어를 가로지른다 — 짧으니 그대로 복제한다". 아래 daysInMonth·parseBirth 도
 * 같은 이유로 복제다(그쪽은 성별·시각까지 보므로 규칙 자체도 다르다).
 */
export function digitsOnly(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, "").slice(0, maxLen);
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

function parseBirth(
  draft: AddDraft,
  currentYear: number,
): { year: number; month: number; day: number } | null {
  if (draft.y.length < 4 || !draft.m || !draft.d) return null;
  const yy = parseInt(draft.y, 10);
  const mm = parseInt(draft.m, 10);
  const dd = parseInt(draft.d, 10);
  if (Number.isNaN(yy) || Number.isNaN(mm) || Number.isNaN(dd)) return null;
  if (yy < 1900 || yy > currentYear) return null;
  // 음력은 달의 길이가 달라 이 검사가 정확하지 않다. 그래도 걸러 두는 편이 낫다 —
  // 최종 판정은 서버의 만세력이 하고, 여기서는 명백한 오타만 잡는다.
  if (mm < 1 || mm > 12 || dd < 1 || dd > daysInMonth(yy, mm)) return null;
  return { year: yy, month: mm, day: dd };
}

export type AddDraftField = "name" | "birth";

export function addDraftIssues(
  draft: AddDraft,
  currentYear: number = new Date().getFullYear(),
): AddDraftField[] {
  const issues: AddDraftField[] = [];
  if (!draft.name.trim()) issues.push("name");
  if (!parseBirth(draft, currentYear)) issues.push("birth");
  return issues;
}

/** 완성되지 않았으면 null — 화면은 null 인 동안 제출 버튼을 끈다. */
export function toAddBody(
  draft: AddDraft,
  currentYear: number = new Date().getFullYear(),
): AddPersonBody | null {
  const name = draft.name.trim();
  const birth = parseBirth(draft, currentYear);
  if (!name || !birth) return null;

  return {
    name,
    calendar: draft.calendar,
    // 양력에 윤달이 켜진 채로 남는 경우를 막는다 — 세그먼트를 음력으로 옮겼다가
    // 되돌아오면 토글 값만 남는다.
    isLeapMonth: draft.calendar === "lunar" && draft.isLeapMonth,
    birth,
  };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
npx vitest run src/app/map/_lib/add-draft.test.ts
```

기대: PASS.

- [ ] **Step 5: 시트를 만든다**

`src/app/map/_components/AddPersonSheet.tsx`. 레이아웃은 `PersonSheet.tsx` 의 것을 그대로 따르되(아래에서 올라오는 판, `inert={!open}`, 닫히는 동안 내용 유지) 색은 다크다. 폼 구조는 `src/app/match/_components/NewPersonForm.tsx` 를 참고하되 성별·시각·출생지 칸은 없다.

```tsx
"use client";

import { useState } from "react";
import { hasLeapMonth } from "@/lib/saju-core";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Toggle } from "@/components/Toggle";
import {
  addDraftIssues, digitsOnly, emptyAddDraft, toAddBody,
  type AddDraft, type AddDraftField,
} from "../_lib/add-draft";

const FIELD =
  "rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-[15px] font-bold text-slate-100 text-center outline-none focus:border-sky-400 placeholder:text-slate-600";

const HINT_TEXT: Record<AddDraftField, string> = {
  name: "이름을 적어 주세요",
  birth: "생년월일을 네 자리 연도까지 정확히 적어 주세요",
};

export function AddPersonSheet({
  open,
  shareId,
  onClose,
  onAdded,
}: {
  open: boolean;
  shareId: string;
  onClose: () => void;
  /** 추가된 사람의 id. 부모가 그 사람을 선택해 카메라를 보낸다. */
  onAdded: (id: string) => void;
}) {
  const [draft, setDraft] = useState<AddDraft>(emptyAddDraft);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // 아직 아무것도 안 친 폼에는 안내를 띄우지 않는다 — 빈 폼에서 버튼이 꺼져 있는
  // 것은 사용자도 이미 안다(NewPersonForm 과 같은 판단).
  const touched = draft.name !== "" || draft.y !== "" || draft.m !== "" || draft.d !== "";
  const issues = touched ? addDraftIssues(draft) : [];
  const body = toAddBody(draft);

  const leapAvailable = (() => {
    const yy = parseInt(draft.y, 10);
    const mm = parseInt(draft.m, 10);
    return draft.calendar === "lunar" && !Number.isNaN(yy) && !Number.isNaN(mm) && hasLeapMonth(yy, mm);
  })();

  async function submit() {
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/maps/${shareId}/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { person?: { id: string }; error?: string };
      if (!res.ok || !json.person) {
        setError(json.error ?? "잠시 후 다시 시도해 주세요");
        return;
      }
      setDraft(emptyAddDraft);
      onAdded(json.person.id);
    } catch {
      setError("네트워크가 불안정해요. 다시 시도해 주세요");
    } finally {
      setSending(false);
    }
  }

  const hint = (field: AddDraftField) =>
    issues.includes(field) ? <p className="mt-1 text-[12px] text-slate-500">{HINT_TEXT[field]}</p> : null;

  return (
    <div
      aria-hidden={!open}
      // 닫히는 동안에도 마운트된 채 남으므로, inert 로 포커스·클릭 대상에서 뺀다
      // (PersonSheet.tsx 가 같은 이유로 같은 일을 한다).
      inert={!open}
      className={`absolute inset-x-0 bottom-0 z-20 rounded-t-3xl border-t border-white/10 bg-slate-900/95 backdrop-blur-[14px] transition-transform duration-300 motion-reduce:transition-none ${
        open ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="max-h-[80vh] space-y-3 overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-slate-100">지도에 추가하기</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[13px] text-slate-400 hover:bg-white/10"
          >
            닫기
          </button>
        </div>

        <p className="text-[13px] text-slate-400">이름과 생년월일만 있으면 돼요.</p>

        <div>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="이름"
            aria-label="이름"
            aria-invalid={issues.includes("name")}
            maxLength={20}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-[15px] font-semibold text-slate-100 outline-none focus:border-sky-400 placeholder:text-slate-600"
          />
          {hint("name")}
        </div>

        <SegmentedControl<"solar" | "lunar">
          options={[
            { value: "solar", label: "양력" },
            { value: "lunar", label: "음력" },
          ]}
          value={draft.calendar}
          onChange={(calendar) =>
            setDraft({ ...draft, calendar, ...(calendar === "solar" ? { isLeapMonth: false } : {}) })
          }
        />

        <div>
          <div className="flex items-center gap-2">
            <input
              value={draft.y}
              onChange={(e) => setDraft({ ...draft, y: digitsOnly(e.target.value, 4) })}
              inputMode="numeric"
              placeholder="1990"
              aria-label="생년"
              aria-invalid={issues.includes("birth")}
              className={`w-[84px] ${FIELD}`}
            />
            <span className="text-sm text-slate-500">년</span>
            <input
              value={draft.m}
              onChange={(e) => setDraft({ ...draft, m: digitsOnly(e.target.value, 2) })}
              inputMode="numeric"
              placeholder="1"
              aria-label="생월"
              aria-invalid={issues.includes("birth")}
              className={`w-[56px] ${FIELD}`}
            />
            <span className="text-sm text-slate-500">월</span>
            <input
              value={draft.d}
              onChange={(e) => setDraft({ ...draft, d: digitsOnly(e.target.value, 2) })}
              inputMode="numeric"
              placeholder="1"
              aria-label="생일"
              aria-invalid={issues.includes("birth")}
              className={`w-[56px] ${FIELD}`}
            />
            <span className="text-sm text-slate-500">일</span>
          </div>
          {hint("birth")}
        </div>

        {leapAvailable && (
          <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
            <span className="text-[13px] text-slate-400">윤달</span>
            <Toggle
              checked={draft.isLeapMonth}
              onChange={(v) => setDraft({ ...draft, isLeapMonth: v })}
              label="윤달"
            />
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-xl bg-rose-500/10 px-3.5 py-2.5 text-[13px] text-rose-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!body || sending}
          className="w-full rounded-xl bg-sky-500 py-3.5 text-[15px] font-bold text-white disabled:bg-white/10 disabled:text-slate-500"
        >
          {sending ? "더하는 중" : "지도에 추가"}
        </button>
      </div>
    </div>
  );
}
```

> 구현자에게: 시트 껍데기(위치·전환·`inert`)는 `src/app/map/_components/PersonSheet.tsx` 의 것과 같은 형태다. 그쪽이 이미 다른 값을 쓰고 있으면 **그쪽에 맞춰라** — 두 판이 화면 같은 자리에서 다른 속도로 움직이면 눈에 띈다.

- [ ] **Step 6: `MapShell` 에 붙인다**

세 판(목록·상세·추가)이 서로 배타적이어야 한다. `MapShell` 은 이미 목록과 상세에 대해 그 일을 하고 있으니 추가를 같은 규칙에 넣는다.

```tsx
const [adding, setAdding] = useState(false);

// 추가 버튼. 소유자가 아니어도 보인다 — 링크를 받은 사람이 자기를 넣는 것이
// 이 기능의 전부다.
<button
  type="button"
  onClick={() => {
    setSelectedId(null);
    setListOpen(false);
    setAdding(true);
  }}
  className="..."
>
  + 나도 추가하기
</button>

<AddPersonSheet
  open={adding}
  shareId={shareId}
  onClose={() => setAdding(false)}
  onAdded={(id) => {
    setAdding(false);
    // 서버가 목록의 진실이다. refresh 로 새 사람을 받아오고, 도착하면
    // selectedId 가 그를 가리켜 카메라가 날아가고 상세가 열린다.
    setSelectedId(id);
    router.refresh();
  }}
/>
```

- [ ] **Step 7: 확인한다**

```bash
npx tsc --noEmit
npm test
npm run build
```

프리뷰(`saju-dev`, 3021)에서 `/map` → 자기 지도로 간 뒤 "나도 추가하기" 로 한 명을 넣는다. 목록에 그 사람이 나타나고, 새로고침해도 남아 있는지 본다. **3D 안의 위치는 프리뷰로 검증할 수 없다**(`useFrame` 이 안 돈다) — 목록과 시트로 확인한다.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(map): 이름과 생년월일로 지도에 사람을 추가한다

받는 것은 셋뿐이다 — 이름, 생년월일, 양/음력. 성별·시각·출생지는 일주에
영향이 없어 묻지 않는다. 로그인도 묻지 않는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: 접히는 헤더바와 공유

**Files:**
- Create: `src/app/map/_components/MapHeader.tsx`
- Modify: `src/app/map/_components/MapShell.tsx`
- Modify: `src/app/map/[share]/page.tsx` (`loggedIn` prop 을 더한다)
- Modify: `src/app/map/_components/CameraModeToggle.tsx` 를 쓰는 자리 (헤더 아래로 내린다)

**Interfaces:**
- Consumes: Task 6 의 `MapShell` 상태, Task 7 의 `shareId`
- Produces: 없음 (마지막 태스크)

- [ ] **Step 1: 헤더를 만든다**

`src/app/map/_components/MapHeader.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * 지도 위의 헤더바. 지도를 만지면 사라지고 빈 곳을 탭하면 돌아온다.
 *
 * 판(시트·목록·추가 폼)이 열려 있는 동안은 hidden 을 무시하고 항상 보인다.
 * 그 위에서 나가는 길이 사라지면 사용자가 갇힌다.
 *
 * 숨겨진 상태에서도 위쪽 4px 손잡이를 남긴다 — 숨겨졌다는 사실 자체를 모르면
 * 되돌릴 방법도 알 수 없다.
 */
export function MapHeader({
  hidden,
  onReveal,
  isOwner,
  shareId,
  loggedIn,
}: {
  hidden: boolean;
  onReveal: () => void;
  isOwner: boolean;
  shareId: string;
  loggedIn: boolean;
}) {
  const [toast, setToast] = useState<string | null>(null);

  async function share() {
    const url = `${window.location.origin}/map/${shareId}`;
    // OS 공유 시트가 있으면 그쪽이 낫다 — 사용자가 이미 아는 UI 다.
    if (navigator.share) {
      try {
        await navigator.share({ title: "관계 지도", url });
        return;
      } catch {
        // 사용자가 취소한 경우도 여기로 온다. 복사로 물러선다.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast("링크를 복사했어요");
      setTimeout(() => setToast(null), 1800);
    } catch {
      setToast("링크를 복사하지 못했어요");
      setTimeout(() => setToast(null), 1800);
    }
  }

  return (
    <>
      {/* 손잡이. 헤더가 숨어 있을 때만 눌린다. */}
      {hidden && (
        <button
          type="button"
          aria-label="헤더 보이기"
          onClick={onReveal}
          className="fixed inset-x-0 top-0 z-30 h-1 bg-white/15"
        />
      )}

      <header
        className={`fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-slate-900/80 backdrop-blur-[14px] transition-transform duration-[180ms] motion-reduce:transition-none ${
          hidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        <div className="flex h-14 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)]">
          <Link href={loggedIn ? "/home" : "/"} className="shrink-0">
            <BrandLogo size="xs" />
          </Link>

          {isOwner && (
            <button
              type="button"
              onClick={share}
              className="rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-slate-100 hover:bg-white/20"
            >
              공유하기
            </button>
          )}
        </div>
      </header>

      {toast && (
        <p
          role="status"
          className="fixed left-1/2 top-[72px] z-40 -translate-x-1/2 rounded-full bg-slate-800/95 px-4 py-2 text-[13px] text-slate-100"
        >
          {toast}
        </p>
      )}
    </>
  );
}
```

- [ ] **Step 2: `MapShell` 에 붙이고 숨김 규칙을 건다**

```tsx
const [headerHidden, setHeaderHidden] = useState(false);

// 판이 하나라도 열려 있으면 헤더를 강제로 보인다 — 나가는 길을 없애지 않는다.
const anyPanelOpen = selectedId !== null || listOpen || adding;
const hideHeader = headerHidden && !anyPanelOpen;
```

지도를 감싼 div 에 `onPointerDown` 을 걸어 숨긴다. 기존 `isolate` div 가 그 자리다:

```tsx
<div
  className="absolute inset-0 isolate"
  // 지도에 손이 닿는 순간 헤더를 치운다. 카메라를 돌리는 동안 화면이 가장 넓어야 한다.
  onPointerDown={() => setHeaderHidden(true)}
>
  <World ... />
</div>
```

복귀는 이미 있는 빈 곳 탭 경로에 얹는다. `World` 의 `onSelect(null)` 이 그 자리다:

```tsx
<World
  ...
  onSelect={(id) => {
    setSelectedId(id);
    // 빈 곳을 탭하면(id === null) 선택이 풀리면서 헤더가 돌아온다.
    if (id === null) setHeaderHidden(false);
  }}
/>
```

`MapHeader` 를 렌더한다:

```tsx
<MapHeader
  hidden={hideHeader}
  onReveal={() => setHeaderHidden(false)}
  isOwner={isOwner}
  shareId={shareId}
  loggedIn={loggedIn}
/>
```

`loggedIn` 은 `MapShell` 의 새 prop 이다. `/map/[share]/page.tsx` 에서 `loggedIn={session !== null}` 로 넘긴다.

- [ ] **Step 3: 헤더가 다른 UI 를 가리지 않는지 본다**

헤더는 `z-30` 이고 `fixed` 다. 기존 `CameraModeToggle` 이 `top-[max(12px,...)]` 에 `z-10` 으로 있다 — 헤더 아래로 들어가 겹친다. 토글을 헤더 높이(56px) 아래로 내린다:

```tsx
<div className="absolute top-[calc(56px+max(12px,env(safe-area-inset-top)))] left-1/2 -translate-x-1/2 z-10">
  <CameraModeToggle ... />
</div>
```

- [ ] **Step 4: 확인한다**

```bash
npx tsc --noEmit
npm test
npm run build
```

프리뷰(3021)에서:

- 지도를 드래그하면 헤더가 위로 사라지고 4px 손잡이가 남는다
- 손잡이를 탭하면 헤더가 돌아온다
- 빈 곳을 탭해도 헤더가 돌아온다
- 목록·상세·추가 시트를 열면 헤더가 숨어 있었어도 다시 보인다
- 소유자에게만 "공유하기" 가 보이고, 누르면 링크가 복사된다

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(map): 접히는 헤더바와 공유 버튼

지도를 만지면 헤더가 사라지고 빈 곳을 탭하면 돌아온다. 판이 열려 있는
동안은 항상 보인다 — 그 위에서 나가는 길이 사라지면 갇힌다. 공유는
소유자에게만 보이고 share_id 링크 하나만 복사한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## 마무리 확인

모든 태스크가 끝난 뒤:

```bash
npx tsc --noEmit
npm test
npm run build
grep -rn "app/lab" src/   # 아무것도 안 나와야 한다
```

기대: 타입 통과, 전체 테스트 통과(베이스라인 1267 + 이 계획이 더한 것), 빌드 성공, 빌드 결과에 `/map`·`/map/[share]`·`/api/maps/[share]/people` 이 있고 `/lab/relationship-world` 는 없다.
