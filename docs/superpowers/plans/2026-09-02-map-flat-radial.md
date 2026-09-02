# 관계 지도 평면 재배치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3D 구면 배치를 평면 15슬롯 원형 배치로 바꿔, 25~50명에서도 점·이름·배지가 겹치지 않는 지도를 만든다.

**Architecture:** 새 순수 모듈 `_lib/radial.ts` 가 좌표를 전부 계산한다(각도 슬롯 → 링 반지름 → 칸 안 격자). three 를 import 하지 않으므로 node 환경 테스트가 겹침을 직접 잰다. 컴포넌트는 그 좌표를 받아 그리기만 하고, 카메라는 직교 고정이라 월드 좌표와 화면 좌표가 상수배다. 옛 3D 배치 모듈들은 마지막 태스크에서 지운다.

**Tech Stack:** Next.js 16 (App Router) · React 19 · three.js + @react-three/fiber + drei · vitest (node 환경) · Tailwind v4

## Global Constraints

- 설계 문서: `docs/superpowers/specs/2026-09-02-map-flat-radial-design.md` — 충돌하면 스펙이 이긴다.
- **라이트 팔레트 유지.** `_data/role-colors.ts` 의 `MAP_BACKGROUND`(`#F8FAFC`), `roleColor`, `nodeColor`, `roleTextColor` 를 그대로 쓴다. 색 값을 새로 만들지 않는다.
- **링 순서 불변:** 六合 < 기본 < 沖 (나로부터의 거리). 이 순서를 바꾸는 변경은 스펙 위반이다.
- **각도 규약:** 12시가 0, 시계방향이 +. 좌표 변환은 `(x, y, z) = (r·sin a, r·cos a, 0)` 하나뿐이고 `radial.ts` 밖에서 다시 정의하지 않는다.
- **구역 순서:** `ROLE_ORDER`(`fill, beside, express, move, refine`) 를 12시부터 시계방향으로. 이 배열을 재정렬하지 않는다.
- **칸 별명 문구는 기존 표를 쓴다:** `DISPLAY_TITLES[role][feature]`. 새 문구를 짓지 않는다.
- **빈 칸에는 배지를 그리지 않는다.** (`RegionLabels` 의 기존 판단)
- 순수 모듈(`radial.ts`)은 `three` 를 import 하지 않는다. 테스트가 node 환경이라 import 하는 순간 검증이 불가능해진다.
- 검증 데이터는 `npm run map:seed` 로 만든다. 지도 URL 은 `/map/39c91384-6df1-44f7-bda8-d5e039862b8b`, dev 서버는 이미 `:3000` 에서 돌고 있다(새로 띄우지 말 것 — `next dev` 는 같은 디렉터리에서 두 번째 인스턴스를 거부한다).
- 각 태스크 끝에서 `npx vitest run src/app/map` 가 통과해야 한다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/app/map/_lib/radial.ts` (신규) | 좌표 계산 전부 — 슬롯 각도, 링 반지름, 칸 안 격자, 배지 자리, 화면 배율 |
| `src/app/map/_lib/radial.test.ts` (신규) | 위 모듈의 불변식 — 상자 안에 있다 / 안 겹친다 / 결정적 |
| `src/app/map/_components/World.tsx` (수정) | 직교 고정 카메라 + 맞춤, `radial.placePeople` 사용 |
| `src/app/map/_components/PersonMarker.tsx` (수정) | 점 + 호버·선택 시에만 이름칩 |
| `src/app/map/_components/RegionLabels.tsx` (수정) | 15슬롯 배지 |
| `src/app/map/_components/SelfCore.tsx` (수정) | 중심 "나" 오브. `PersonNode` 의존을 끊고 DOM 으로 |
| `src/app/map/_lib/layout.ts`, `layout.test.ts` (삭제) | 구면 앵커 배치 |
| `src/app/map/_lib/camera.ts`, `_components/CameraRig.tsx` (삭제) | 카메라 조작·초점 보간 |
| `src/app/map/_lib/badge-offset.ts`, `badge-offset.test.ts` (삭제) | 화면공간 배지 밀기 |
| `src/app/map/_lib/node-visual.ts`, `_components/PersonNode.tsx` (삭제) | 3D 스프라이트 halo 와 그 광량 불변식. 점이 DOM 으로 넘어가면서 전부 죽는다 |
| 손대지 않음 | `connections.ts` · `role-colors.ts` · `PeopleList` · `AddPersonModal` · `MapHeader` · `to-map-people.ts` · API · DB |

---

### Task 1: 슬롯 각도 — 섹터를 셋으로 나눈다

**Files:**
- Create: `src/app/map/_lib/radial.ts`
- Test: `src/app/map/_lib/radial.test.ts`

**Interfaces:**
- Consumes: `RelationRole`, `Feature`, `ROLE_ORDER` from `../_data/roles`
- Produces:
  - `type Slot = { readonly center: number; readonly half: number }` — 라디안
  - `type CellCounts = Record<RelationRole, Record<Feature, number>>`
  - `sectorAngle(role: RelationRole): number`
  - `allocateSlots(counts: Record<Feature, number>): Record<Feature, Slot | null>`
  - 상수 `SECTOR_SPAN`, `SECTOR_USED`, `MIN_SLOT`, `SLOT_MARGIN`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/map/_lib/radial.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ROLE_ORDER, type Feature } from "../_data/roles";
import {
  allocateSlots,
  sectorAngle,
  MIN_SLOT,
  SECTOR_SPAN,
  SECTOR_USED,
} from "./radial";

const FEATURES: Feature[] = ["yukhap", "none", "chung"];

describe("섹터", () => {
  it("다섯 구역이 12시부터 시계방향으로 72°씩 선다", () => {
    ROLE_ORDER.forEach((role, i) => {
      expect(sectorAngle(role)).toBeCloseTo(SECTOR_SPAN * i, 9);
    });
    expect(SECTOR_SPAN).toBeCloseTo((2 * Math.PI) / 5, 9);
  });

  it("한 구역이 쓰는 각도는 72°보다 작다 — 남는 각도가 구역 사이 여백이다", () => {
    expect(SECTOR_USED).toBeLessThan(SECTOR_SPAN);
  });
});

describe("슬롯 배분", () => {
  it("빈 칸에는 슬롯을 주지 않는다", () => {
    const slots = allocateSlots({ yukhap: 0, none: 3, chung: 0 });
    expect(slots.yukhap).toBeNull();
    expect(slots.chung).toBeNull();
    expect(slots.none).not.toBeNull();
  });

  it("사람이 아무도 없으면 셋 다 없다", () => {
    const slots = allocateSlots({ yukhap: 0, none: 0, chung: 0 });
    expect(FEATURES.every((f) => slots[f] === null)).toBe(true);
  });

  it("차 있는 칸은 최소 폭을 보장받는다", () => {
    const slots = allocateSlots({ yukhap: 1, none: 20, chung: 1 });
    for (const f of FEATURES) {
      const slot = slots[f]!;
      expect(slot.half * 2).toBeGreaterThanOrEqual(MIN_SLOT - 2 * 1e-9);
    }
  });

  it("사람이 많은 칸이 더 넓다", () => {
    const slots = allocateSlots({ yukhap: 1, none: 20, chung: 1 });
    expect(slots.none!.half).toBeGreaterThan(slots.yukhap!.half);
  });

  it("각도 순서는 언제나 六合 → 기본 → 沖 이다", () => {
    const slots = allocateSlots({ yukhap: 2, none: 5, chung: 3 });
    expect(slots.yukhap!.center).toBeLessThan(slots.none!.center);
    expect(slots.none!.center).toBeLessThan(slots.chung!.center);
  });

  it("슬롯이 서로 안 겹치고 구역 폭 안에 있다", () => {
    const slots = allocateSlots({ yukhap: 2, none: 5, chung: 3 });
    const live = FEATURES.map((f) => slots[f]!).filter(Boolean);
    for (const s of live) {
      expect(s.center - s.half).toBeGreaterThanOrEqual(-SECTOR_USED / 2 - 1e-9);
      expect(s.center + s.half).toBeLessThanOrEqual(SECTOR_USED / 2 + 1e-9);
    }
    for (let i = 1; i < live.length; i += 1) {
      expect(live[i].center - live[i].half).toBeGreaterThan(
        live[i - 1].center + live[i - 1].half,
      );
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/map/_lib/radial.test.ts`
Expected: FAIL — `Failed to resolve import "./radial"`

- [ ] **Step 3: 최소 구현**

`src/app/map/_lib/radial.ts`:

```ts
/**
 * 관계 지도의 평면 배치.
 *
 * 좌표를 정하는 것은 전부 여기다. three 를 import 하지 않는다 — 이 라우트의
 * 테스트는 node 환경이라, 화면에서 겹치는지를 재려면 계산이 브라우저 밖에
 * 있어야 한다. 직전 설계(구면 앵커 + 재시도 샘플링)가 "3D 로는 떨어져 있어도
 * 화면에서는 겹친다"는 함정을 두 층에서 겪은 것이 이 규칙의 이유다.
 *
 * 각도는 12시가 0, 시계방향이 + 다. 좌표 변환은 아래 at() 하나뿐이고 이 파일
 * 밖에서 다시 정의하지 않는다.
 */
import { ROLE_ORDER, type Feature, type RelationRole } from "../_data/roles";

const deg = (d: number) => (d * Math.PI) / 180;

/** 구역 하나가 차지하는 각도. 다섯이 원을 채운다. */
export const SECTOR_SPAN = (2 * Math.PI) / 5;

/**
 * 그중 실제로 사람을 놓는 각도. 남는 16° 가 구역 사이 여백이다 —
 * 이 여백이 없으면 다섯 색이 경계에서 섞여 "어느 구역인가"가 흐려진다.
 */
export const SECTOR_USED = deg(56);

/** 사람이 있는 칸이 보장받는 최소 각도 폭. 한 명뿐인 칸도 자기 자리를 갖는다. */
export const MIN_SLOT = deg(8);

/** 슬롯 양끝에서 떼는 여백. 이웃 슬롯의 끝 사람과 붙지 않게 한다. */
export const SLOT_MARGIN = deg(1);

/** 한 칸이 소유하는 각도 구간. center 는 12시 기준 절대 각도가 아니라 구역 안 상대각이다. */
export type Slot = { readonly center: number; readonly half: number };

export type CellCounts = Record<RelationRole, Record<Feature, number>>;

/** 각도 순서. 사람이 가장 많은 기본이 구역 한가운데 오고 드문 둘이 양옆에 선다. */
const FEATURE_ORDER: readonly Feature[] = ["yukhap", "none", "chung"];

/** 구역 중심각. ROLE_ORDER 순서 그대로 12시부터 시계방향이다. */
export function sectorAngle(role: RelationRole): number {
  return SECTOR_SPAN * ROLE_ORDER.indexOf(role);
}

/**
 * 한 구역의 56° 를 세 칸에 나눈다.
 *
 * 사람이 있는 칸에 MIN_SLOT 을 먼저 주고, 남은 각도를 인원수 비례로 더한다.
 * 빈 칸은 0 이다 — 아무도 없는 칸이 자리를 차지하면 있는 칸이 그만큼 좁아진다.
 */
export function allocateSlots(
  counts: Record<Feature, number>,
): Record<Feature, Slot | null> {
  const live = FEATURE_ORDER.filter((f) => counts[f] > 0);
  const out = { yukhap: null, none: null, chung: null } as Record<Feature, Slot | null>;
  if (live.length === 0) return out;

  const total = live.reduce((sum, f) => sum + counts[f], 0);
  const extra = SECTOR_USED - MIN_SLOT * live.length;

  let cursor = -SECTOR_USED / 2;
  for (const f of FEATURE_ORDER) {
    if (counts[f] === 0) continue;
    const width = MIN_SLOT + extra * (counts[f] / total);
    out[f] = { center: cursor + width / 2, half: Math.max(0, width / 2 - SLOT_MARGIN) };
    cursor += width;
  }
  return out;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/map/_lib/radial.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/app/map/_lib/radial.ts src/app/map/_lib/radial.test.ts
git commit -m "feat(map): 평면 배치의 슬롯 각도 층을 세운다"
```

---

### Task 2: 링 반지름과 칸 안 격자

**Files:**
- Modify: `src/app/map/_lib/radial.ts`
- Test: `src/app/map/_lib/radial.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `Slot`, `allocateSlots`, `sectorAngle`, `CellCounts`
- Produces:
  - `type Vec3 = readonly [number, number, number]`
  - `const SELF_POSITION: Vec3`
  - `type CellLayout = { slot: Slot; radii: readonly number[]; perRow: readonly number[] }`
  - `type MapLayout = { cells: Record<RelationRole, Record<Feature, CellLayout | null>>; outerRadius: number }`
  - `buildLayout(counts: CellCounts): MapLayout`
  - `type Placeable = { readonly id: string; readonly role: RelationRole; readonly feature: Feature }`
  - `placePeople(people: readonly Placeable[]): Map<string, Vec3>`
  - 상수 `RING_START`, `RING_GAP`, `ROW_PITCH`, `MIN_GAP`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`radial.test.ts` 아래에 덧붙인다:

```ts
import {
  buildLayout,
  placePeople,
  SELF_POSITION,
  type CellCounts,
  type Placeable,
} from "./radial";
import { ROLE_ORDER as ROLES, type RelationRole } from "../_data/roles";

/** 칸별 인원표를 만든다. 안 적은 칸은 0 이다. */
function counts(spec: Partial<Record<string, number>>): CellCounts {
  const out = {} as CellCounts;
  for (const role of ROLES) {
    out[role] = { none: 0, yukhap: 0, chung: 0 };
    for (const f of FEATURES) out[role][f] = spec[`${role}/${f}`] ?? 0;
  }
  return out;
}

/** 인원표를 사람 배열로 편다. id 는 `${role}/${feature}#${i}`. */
function peopleOf(c: CellCounts): Placeable[] {
  const out: Placeable[] = [];
  for (const role of ROLES)
    for (const f of FEATURES)
      for (let i = 0; i < c[role][f]; i += 1)
        out.push({ id: `${role}/${f}#${i}`, role, feature: f });
  return out;
}

/** 시드 스크립트가 넣은 25명과 같은 분포. */
const SEEDED = counts({
  "fill/none": 3, "fill/yukhap": 1, "fill/chung": 1,
  "beside/none": 4, "beside/yukhap": 1, "beside/chung": 1,
  "express/none": 3, "express/yukhap": 1, "express/chung": 1,
  "move/none": 3, "move/yukhap": 1, "move/chung": 1,
  "refine/none": 2, "refine/yukhap": 1, "refine/chung": 1,
});

/** 한도 50명. 六合·沖 은 지지 12개 중 하나씩이라 실제로도 드물다. */
const FULL = counts({
  "fill/none": 9, "fill/yukhap": 1, "fill/chung": 1,
  "beside/none": 9, "beside/yukhap": 1, "beside/chung": 1,
  "express/none": 8, "express/yukhap": 1, "express/chung": 1,
  "move/none": 7, "move/yukhap": 1, "move/chung": 1,
  "refine/none": 7, "refine/yukhap": 1, "refine/chung": 1,
});

/** 한 칸에 몰린 최악. 배치가 무너지는지 보는 것이지 실제 분포는 아니다. */
const LOPSIDED = counts({ "beside/none": 40, "fill/none": 10 });

const CASES: [string, CellCounts][] = [
  ["시드 25명", SEEDED],
  ["한도 50명", FULL],
  ["한쪽에 몰린 50명", LOPSIDED],
];

describe("링과 격자", () => {
  it.each(CASES)("%s — 인원이 그대로 배치된다", (_name, c) => {
    const people = peopleOf(c);
    const placed = placePeople(people);
    expect(placed.size).toBe(people.length);
    expect(new Set(placed.keys())).toEqual(new Set(people.map((p) => p.id)));
  });

  it.each(CASES)("%s — 링 순서가 六合 < 기본 < 沖 이다", (_name, c) => {
    const layout = buildLayout(c);
    for (const role of ROLES) {
      const cell = layout.cells[role];
      const mid = (f: Feature) => {
        const l = cell[f];
        if (!l) return null;
        return l.radii.reduce((a, b) => a + b, 0) / l.radii.length;
      };
      const [y, n, ch] = [mid("yukhap"), mid("none"), mid("chung")];
      if (y !== null && n !== null) expect(y).toBeLessThan(n);
      if (n !== null && ch !== null) expect(n).toBeLessThan(ch);
    }
  });

  it.each(CASES)("%s — 누구도 자기 칸의 상자 밖으로 나가지 않는다", (_name, c) => {
    const layout = buildLayout(c);
    const placed = placePeople(peopleOf(c));
    for (const [id, p] of placed) {
      const [role, rest] = id.split("/") as [RelationRole, string];
      const feature = rest.split("#")[0] as Feature;
      const cell = layout.cells[role][feature]!;
      const r = Math.hypot(p[0], p[1]);
      // 각도: 12시 기준 시계방향
      const a = Math.atan2(p[0], p[1]);
      const rel = normalize(a - sectorAngle(role));
      expect(Math.abs(rel - cell.slot.center)).toBeLessThanOrEqual(cell.slot.half + 1e-9);
      expect(r).toBeGreaterThanOrEqual(Math.min(...cell.radii) - 1e-9);
      expect(r).toBeLessThanOrEqual(Math.max(...cell.radii) + 1e-9);
      expect(p[2]).toBe(0);
    }
  });

  it("같은 명단이면 같은 좌표다", () => {
    const people = peopleOf(SEEDED);
    const a = placePeople(people);
    const b = placePeople(people);
    for (const [id, p] of a) expect(b.get(id)).toEqual(p);
  });

  it("다섯 구역은 원점에서 등거리다 — 어떤 역할도 더 가깝지 않다", () => {
    const layout = buildLayout(counts(
      Object.fromEntries(ROLES.map((r) => [`${r}/none`, 3])),
    ));
    const radii = ROLES.map((r) => layout.cells[r].none!.radii[0]);
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 9);
  });

  it("나는 원점이다", () => {
    expect(SELF_POSITION).toEqual([0, 0, 0]);
  });
});

/** −π..π 로 접는다. */
function normalize(a: number): number {
  let x = a;
  while (x > Math.PI) x -= 2 * Math.PI;
  while (x < -Math.PI) x += 2 * Math.PI;
  return x;
}
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/map/_lib/radial.test.ts`
Expected: FAIL — `buildLayout is not a function`

- [ ] **Step 3: 구현**

`radial.ts` 에 덧붙인다:

```ts
export type Vec3 = readonly [number, number, number];

/** 지도의 중심. 관계가 없으므로 슬롯도 링도 없다. */
export const SELF_POSITION: Vec3 = [0, 0, 0];

/** 각도 → 좌표. 12시가 0, 시계방향이 +. 이 변환은 이 파일에만 있다. */
function at(r: number, a: number): Vec3 {
  return [r * Math.sin(a), r * Math.cos(a), 0];
}

/**
 * 가장 안쪽 링이 시작하는 반지름. 이 안쪽은 중심 "나" 오브의 자리다.
 * 단위는 임의다 — 화면에 맞추는 것은 카메라의 일이고(screenScale), 그래서
 * 사람이 늘어 지도가 커져도 이 파일은 아무것도 몰라도 된다.
 */
export const RING_START = 0.38;

/** 링과 링 사이 빈 구간. 여기가 좁으면 이웃 링의 점끼리 붙는다. */
export const RING_GAP = 0.1;

/** 한 칸 안에서 줄과 줄 사이 간격. */
export const ROW_PITCH = 0.13;

/** 같은 줄에서 사람과 사람 사이 최소 간격. 열 수를 정하는 것이 이 값이다. */
export const MIN_GAP = 0.17;

export type CellLayout = {
  readonly slot: Slot;
  /** 줄별 반지름 (안 → 바깥) */
  readonly radii: readonly number[];
  /** 줄별 인원 */
  readonly perRow: readonly number[];
};

export type MapLayout = {
  readonly cells: Record<RelationRole, Record<Feature, CellLayout | null>>;
  /** 사람이 놓인 가장 바깥 반지름. 카메라와 배지가 쓴다. */
  readonly outerRadius: number;
};

/** 한 줄에 몇 명까지 들어가는가. 호 길이를 최소 간격으로 나눈 값이다. */
function colsAt(radius: number, half: number): number {
  const arc = 2 * half * radius;
  return Math.max(1, Math.floor(arc / MIN_GAP) + 1);
}

/** n 명을 줄로 나눈다. 안쪽 줄부터 채우고, 모자라면 바깥으로 한 줄 더. */
function rowsFor(n: number, startRadius: number, half: number) {
  const radii: number[] = [];
  const perRow: number[] = [];
  let radius = startRadius;
  let left = n;
  while (left > 0) {
    const take = Math.min(colsAt(radius, half), left);
    radii.push(radius);
    perRow.push(take);
    left -= take;
    radius += ROW_PITCH;
  }
  return { radii, perRow };
}

/**
 * 지도 전체의 자리를 정한다.
 *
 * 링은 안에서 바깥으로 한 번에 흐른다: 六合 링이 필요한 줄 수만큼 두께를
 * 차지하고, 그 바깥에 기본 링이, 다시 그 바깥에 沖 링이 선다. 링의 두께는
 * 그 링에서 가장 붐비는 구역이 정한다 — 다섯 구역이 같은 원을 공유해야
 * "안쪽이 六合" 이라는 규칙이 화면에서 읽히기 때문이다.
 *
 * 반복도 수렴도 없다. 각 링의 시작 반지름이 그 링을 계산하기 전에 이미
 * 정해져 있어서, 줄 수를 구하는 데 필요한 호 길이를 그 자리에서 알 수 있다.
 */
export function buildLayout(counts: CellCounts): MapLayout {
  const cells = {} as Record<RelationRole, Record<Feature, CellLayout | null>>;
  const slots = {} as Record<RelationRole, Record<Feature, Slot | null>>;
  for (const role of ROLE_ORDER) slots[role] = allocateSlots(counts[role]);
  for (const role of ROLE_ORDER) cells[role] = { none: null, yukhap: null, chung: null };

  let ringStart = RING_START;
  let outerRadius = RING_START;

  for (const feature of FEATURE_ORDER) {
    let thickest = ringStart;
    for (const role of ROLE_ORDER) {
      const n = counts[role][feature];
      const slot = slots[role][feature];
      if (n === 0 || !slot) continue;
      const { radii, perRow } = rowsFor(n, ringStart, slot.half);
      cells[role][feature] = { slot, radii, perRow };
      thickest = Math.max(thickest, radii[radii.length - 1]);
    }
    outerRadius = Math.max(outerRadius, thickest);
    ringStart = thickest + RING_GAP;
  }

  return { cells, outerRadius };
}

export type Placeable = {
  readonly id: string;
  readonly role: RelationRole;
  readonly feature: Feature;
};

/**
 * 사람 → 좌표.
 *
 * 한 줄 안에서는 그 칸의 열 간격(호 길이 ÷ (열 수 − 1))을 그대로 쓰고,
 * 슬롯 중심을 기준으로 좌우 대칭이 되게 놓는다. 줄마다 인원이 달라도 같은
 * 간격을 쓰므로 격자가 어긋나 보이지 않고, 인원이 열 수보다 적으면 자연히
 * 가운데로 모인다.
 */
export function placePeople(people: readonly Placeable[]): Map<string, Vec3> {
  const counts = {} as CellCounts;
  for (const role of ROLE_ORDER) counts[role] = { none: 0, yukhap: 0, chung: 0 };
  for (const p of people) counts[p.role][p.feature] += 1;

  const layout = buildLayout(counts);
  const queue = new Map<string, string[]>();
  for (const p of people) {
    const key = `${p.role}/${p.feature}`;
    const ids = queue.get(key);
    if (ids) ids.push(p.id);
    else queue.set(key, [p.id]);
  }

  const out = new Map<string, Vec3>();
  for (const [key, ids] of queue) {
    const [role, feature] = key.split("/") as [RelationRole, Feature];
    const cell = layout.cells[role][feature]!;
    const base = sectorAngle(role) + cell.slot.center;

    let cursor = 0;
    cell.radii.forEach((radius, row) => {
      const inRow = cell.perRow[row];
      const cols = colsAt(radius, cell.slot.half);
      // 열 간격은 슬롯 폭을 (열 수 − 1)로 나눈 각도다. 한 열뿐이면 간격이 없다.
      const step = cols > 1 ? (2 * cell.slot.half) / (cols - 1) : 0;
      for (let i = 0; i < inRow; i += 1) {
        const offset = (i - (inRow - 1) / 2) * step;
        out.set(ids[cursor], at(radius, base + offset));
        cursor += 1;
      }
    });
  }

  return out;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/map/_lib/radial.test.ts`
Expected: PASS (전부)

`"한쪽에 몰린 50명"` 이 상자 테스트에서 떨어지면 `ROW_PITCH` 나 `RING_GAP` 이 아니라 **구현이 상자를 넘긴 것**이다. `placePeople` 의 `offset` 이 `slot.half` 를 넘지 않는지 먼저 본다.

- [ ] **Step 5: 커밋**

```bash
git add src/app/map/_lib/radial.ts src/app/map/_lib/radial.test.ts
git commit -m "feat(map): 링 반지름과 칸 안 격자를 계산한다"
```

---

### Task 3: 겹침 불변식 — 화면에서 재고, 배지 자리를 정한다

지금까지의 테스트는 "상자 안에 있다" 까지만 본다. 상자 안에 있어도 화면에서 붙을 수 있으므로 여기서 **화면 거리**를 잰다. 이것이 이 재설계의 이유다.

**Files:**
- Modify: `src/app/map/_lib/radial.ts`
- Test: `src/app/map/_lib/radial.test.ts`

**Interfaces:**
- Produces:
  - `badgeAnchor(layout: MapLayout, role: RelationRole, feature: Feature): Vec3 | null`
  - `layoutExtent(layout: MapLayout): number` — 배지까지 포함한 반지름
  - `screenScale(width: number, height: number, extent: number): number` — 월드 1 단위당 픽셀
  - 상수 `BADGE_MARGIN`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { badgeAnchor, layoutExtent, screenScale, type Vec3 } from "./radial";

/** 실측 화면 두 벌. 데스크톱은 400px 사이드 패널을 뺀 지도 영역이다. */
const VIEWPORTS: [string, number, number][] = [
  ["데스크톱 700×500", 700, 500],
  ["모바일 375×420", 375, 420],
];

/** 점 지름 16px + 여유. 이보다 가까우면 두 점이 한 덩어리로 보인다. */
const MIN_NODE_PX = 22;
/** 배지 높이 20px + 여유. */
const MIN_BADGE_PX = 26;

describe("화면에서 겹치지 않는다", () => {
  for (const [vpName, w, h] of VIEWPORTS) {
    for (const [caseName, c] of CASES) {
      it(`${vpName} · ${caseName} — 점끼리 ${MIN_NODE_PX}px 이상 떨어진다`, () => {
        const layout = buildLayout(c);
        const scale = screenScale(w, h, layoutExtent(layout));
        const pts = [...placePeople(peopleOf(c)).values()];
        let worst = Infinity;
        for (let i = 0; i < pts.length; i += 1)
          for (let j = i + 1; j < pts.length; j += 1)
            worst = Math.min(
              worst,
              Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) * scale,
            );
        expect(worst).toBeGreaterThanOrEqual(MIN_NODE_PX);
      });

      it(`${vpName} · ${caseName} — 배지끼리, 배지와 점이 ${MIN_BADGE_PX}px 이상 떨어진다`, () => {
        const layout = buildLayout(c);
        const scale = screenScale(w, h, layoutExtent(layout));
        const badges: Vec3[] = [];
        for (const role of ROLES)
          for (const f of FEATURES) {
            const b = badgeAnchor(layout, role, f);
            if (b) badges.push(b);
          }
        const px = (a: Vec3, b: Vec3) =>
          Math.hypot(a[0] - b[0], a[1] - b[1]) * scale;

        for (let i = 0; i < badges.length; i += 1)
          for (let j = i + 1; j < badges.length; j += 1)
            expect(px(badges[i], badges[j])).toBeGreaterThanOrEqual(MIN_BADGE_PX);

        for (const b of badges)
          for (const p of placePeople(peopleOf(c)).values())
            expect(px(b, p)).toBeGreaterThanOrEqual(MIN_BADGE_PX);
      });
    }
  }

  it("지도 전체가 화면 안에 들어온다", () => {
    for (const [, w, h] of VIEWPORTS) {
      const layout = buildLayout(FULL);
      const extent = layoutExtent(layout);
      const scale = screenScale(w, h, extent);
      expect(extent * scale * 2).toBeLessThanOrEqual(Math.min(w, h) + 1e-9);
    }
  });

  it("빈 칸에는 배지 자리가 없다", () => {
    const layout = buildLayout(counts({ "fill/none": 2 }));
    expect(badgeAnchor(layout, "fill", "none")).not.toBeNull();
    expect(badgeAnchor(layout, "fill", "chung")).toBeNull();
    expect(badgeAnchor(layout, "beside", "none")).toBeNull();
  });

  it("배지는 자기 칸 사람들보다 바깥이다", () => {
    const layout = buildLayout(SEEDED);
    for (const role of ROLES)
      for (const f of FEATURES) {
        const b = badgeAnchor(layout, role, f);
        const cell = layout.cells[role][f];
        if (!b || !cell) continue;
        expect(Math.hypot(b[0], b[1])).toBeGreaterThan(Math.max(...cell.radii));
      }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/map/_lib/radial.test.ts`
Expected: FAIL — `badgeAnchor is not a function`

- [ ] **Step 3: 구현**

```ts
/** 배지를 그 칸 가장 바깥 줄에서 얼마나 더 밀어낼지. */
export const BADGE_MARGIN = 0.14;

/**
 * 배지가 설 자리. 사람이 없는 칸은 null 이다.
 *
 * 자리는 그 칸 슬롯의 각도 위, 그 칸 사람들보다 바깥이다. 이 배치의 핵심이
 * 여기서 값을 한다: **한 칸은 자기 각도를 통째로 소유하고 그 바깥은 비어
 * 있다.** 그래서 배지를 밀어낼 방향을 찾을 필요가 없다 — 옛 badge-offset.ts
 * 가 화면공간에서 하던 그 일이 통째로 사라진다.
 */
export function badgeAnchor(
  layout: MapLayout,
  role: RelationRole,
  feature: Feature,
): Vec3 | null {
  const cell = layout.cells[role][feature];
  if (!cell) return null;
  const outer = Math.max(...cell.radii);
  return at(outer + BADGE_MARGIN, sectorAngle(role) + cell.slot.center);
}

/** 배지까지 포함한 지도의 반지름. 카메라가 이 값을 화면에 맞춘다. */
export function layoutExtent(layout: MapLayout): number {
  let extent = layout.outerRadius;
  for (const role of ROLE_ORDER)
    for (const feature of FEATURE_ORDER) {
      const b = badgeAnchor(layout, role, feature);
      if (b) extent = Math.max(extent, Math.hypot(b[0], b[1]));
    }
  return extent;
}

/**
 * 월드 1 단위당 화면 픽셀. 직교 카메라의 zoom 이 곧 이 값이다.
 *
 * 짧은 변에 맞춘다 — 지도는 원반이라 긴 변에 맞추면 짧은 변에서 잘린다.
 * 데스크톱의 납작한 캔버스(가로 700 · 세로 500)에서 직전 설계가 깨진 지점이
 * 정확히 여기다.
 */
export function screenScale(width: number, height: number, extent: number): number {
  return Math.min(width, height) / (2 * extent);
}
```

- [ ] **Step 4: 통과할 때까지 상수를 조정한다**

Run: `npx vitest run src/app/map/_lib/radial.test.ts`

떨어지면 **테스트의 문턱(`MIN_NODE_PX`, `MIN_BADGE_PX`)을 낮추지 말고** 아래 순서로 상수를 조정하고, 무엇을 왜 바꿨는지 그 상수의 주석에 실측값과 함께 남긴다:

1. 점끼리 붙으면 → `MIN_GAP` ↑ (칸이 넓어지고 줄이 늘어난다)
2. 줄끼리 붙으면 → `ROW_PITCH` ↑
3. 이웃 링의 점끼리 붙으면 → `RING_GAP` ↑
4. 배지와 점이 붙으면 → `BADGE_MARGIN` ↑
5. 지도가 커져 전체가 작아 보이면 → `RING_START` ↓ (안쪽 구멍을 줄인다. 단 중심 오브가 0.3 정도를 쓴다)

- [ ] **Step 5: 커밋**

```bash
git add src/app/map/_lib/radial.ts src/app/map/_lib/radial.test.ts
git commit -m "test(map): 화면 겹침을 25·50명 × 두 화면 비율로 잠근다"
```

---

### Task 4: World 를 직교 고정 카메라로 바꾼다

**Files:**
- Modify: `src/app/map/_components/World.tsx`
- Create: `src/app/map/_components/FitCamera.tsx`

**Interfaces:**
- Consumes: Task 3 의 `placePeople`, `buildLayout`, `layoutExtent`, `screenScale`, `MapLayout`
- Produces: `<FitCamera extent={number} />` — 캔버스 크기가 바뀔 때마다 직교 카메라의 zoom 을 다시 맞춘다

- [ ] **Step 1: FitCamera 를 만든다**

`src/app/map/_components/FitCamera.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { screenScale } from "../_lib/radial";

/**
 * 직교 카메라를 지도 크기에 맞춘다.
 *
 * 원근 카메라를 쓰지 않는 이유: 배치가 평면이라 원근이 할 일이 없고, 직교면
 * "화면에 꽉 차게" 가 zoom 한 값 계산으로 끝난다. 그 덕에 월드 거리와 화면
 * 픽셀이 상수배로 묶여, radial.test.ts 가 브라우저 없이 화면 겹침을 잴 수 있다.
 *
 * 카메라를 움직이는 코드는 여기 말고 없다. 사람을 선택해도 카메라는 가만히
 * 있는다 — 전부가 늘 보이는데 날아갈 이유가 없다.
 */
export function FitCamera({ extent }: { extent: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useEffect(() => {
    if (!(camera instanceof THREE.OrthographicCamera)) return;
    camera.zoom = screenScale(size.width, size.height, extent);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, extent]);

  return null;
}
```

- [ ] **Step 2: World 를 바꾼다**

`World.tsx` 에서:

1. `import { CameraRig } from "./CameraRig";` 와 `import { CAMERA_FOV, DEFAULT_CAMERA_POSITION } from "../_lib/camera";` 를 지운다.
2. `import { placePeople } from "../_lib/layout";` → `import { buildLayout, layoutExtent, placePeople } from "../_lib/radial";`
3. `import { FitCamera } from "./FitCamera";` 를 더한다.
4. `<Canvas>` 의 camera prop 을 바꾼다:

```tsx
    <Canvas
      orthographic
      camera={{ position: [0, 0, 10], zoom: 1, near: 0.1, far: 100 }}
```

5. `counts` 를 `buildLayout` 에도 넘겨 extent 를 구한다 (`counts` 를 만드는 `useMemo` 는 그대로 두고 그 아래에 더한다):

```tsx
  const layout = useMemo(() => buildLayout(counts), [counts]);
  const extent = useMemo(() => layoutExtent(layout), [layout]);
```

6. `<CameraRig ... />` 줄을 `<FitCamera extent={extent} />` 로 바꾼다.
7. `<fog ... />` 줄을 지운다 — 모든 점이 같은 깊이라 아무 일도 하지 않는다.
8. `<RegionLabels counts={counts} />` 는 **이 태스크에서 그대로 둔다.** Task 6 이 그 컴포넌트의 props 를 바꾸면서 이 줄도 함께 고친다 — 여기서 미리 `layout` 을 넘기면 타입이 맞지 않아 이 태스크가 컴파일되지 않는다.

- [ ] **Step 3: 화면에서 확인한다**

dev 서버는 이미 `:3000` 에서 돌고 있다. 브라우저 도구로 `http://localhost:3000/map/39c91384-6df1-44f7-bda8-d5e039862b8b` 를 열고:

- `read_console_messages` 로 에러가 없는지 본다.
- `computer {action: "screenshot"}` 로 원반이 잘리지 않고 통째로 보이는지 본다.
- `resize_window {preset: "mobile"}` 로 바꾼 뒤 다시 스크린샷 — 모바일에서도 통째로 보여야 한다. 확인 후 `preset: "desktop"` 으로 되돌린다.

이 시점에는 아직 명패가 옛 방식이라 겹쳐 보이고, **구역 배지는 엉뚱한 자리에 뜬다** — `RegionLabels` 가 아직 옛 구면 좌표(`subAnchor`)로 자리를 잡기 때문이고 Task 6 에서 고친다. 여기서는 **점의 배치가 다섯 덩어리 × 세 줄로 정돈됐는지**만 본다.

- [ ] **Step 4: 커밋**

```bash
git add src/app/map/_components/World.tsx src/app/map/_components/FitCamera.tsx
git commit -m "feat(map): 카메라를 직교 고정으로 바꾸고 지도를 화면에 맞춘다"
```

---

### Task 5: 점만 남기고, 이름은 선택·호버한 한 명만

**Files:**
- Modify: `src/app/map/_components/PersonMarker.tsx`
- Modify: `src/app/map/_components/SelfCore.tsx`

**Interfaces:**
- Consumes: `nodeColor(role, feature)`, `roleTextColor(role)` from `../_data/role-colors`; `DISPLAY_TITLES` from `../_data/roles`
- Produces: `PersonMarker` 의 props 는 그대로 (`person`, `position`, `selected`, `dimmed`, `boosted`, `onSelect`)

- [ ] **Step 1: 거리 기반 티어를 걷어낸다**

`PersonMarker.tsx` 에서 `Tier`, `NEAR`, `FAR`, `tierFor`, `ORDER`, `boost`, `useFrame` 블록, `world` ref 를 전부 지운다. 카메라가 고정이라 거리가 변하지 않으므로 티어라는 개념 자체가 죽었다.

- [ ] **Step 2: 점 + 조건부 이름칩으로 다시 쓴다**

`PersonMarker.tsx` 의 컴포넌트 본문을 아래로 바꾼다:

```tsx
export function PersonMarker({
  person,
  position,
  selected,
  dimmed,
  boosted,
  onSelect,
}: {
  person: MapPerson;
  position: Vec3;
  selected: boolean;
  dimmed: boolean;
  boosted: boolean;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  // 이름은 평소에 없다. 25명 전원의 이름표를 항상 띄우던 것이 이 화면이
  // 읽히지 않던 이유였고, 50명에서는 어떤 배치로도 겹친다.
  const showName = selected || hovered;
  const opacity = selected ? 1 : dimmed ? 0.32 : boosted ? 1 : 0.9;

  return (
    <Html
      position={position as unknown as [number, number, number]}
      center
      zIndexRange={[30, 0]}
      style={{ pointerEvents: "auto", transition: "opacity 220ms ease", opacity }}
    >
      <button
        type="button"
        aria-label={person.name}
        onClick={() => onSelect(person.id)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        className="relative grid place-items-center w-6 h-6 -m-3 cursor-pointer border-0 bg-transparent p-0"
      >
        {/* 六合 은 은은한 halo, 沖 은 바깥 링. 색은 구역, 형태는 상태다 —
            색 하나로 15칸을 감당하지 않아도 되게 나눠 진다. */}
        {person.feature === "yukhap" && (
          <span
            aria-hidden
            className="absolute rounded-full"
            style={{
              width: 26,
              height: 26,
              backgroundColor: nodeColor(person.role, person.feature),
              opacity: 0.18,
            }}
          />
        )}
        {person.feature === "chung" && (
          <span
            aria-hidden
            className="absolute rounded-full border"
            style={{
              width: 22,
              height: 22,
              borderColor: nodeColor(person.role, person.feature),
              opacity: 0.6,
            }}
          />
        )}
        <span
          aria-hidden
          className="block rounded-full border-2 border-white"
          style={{
            width: 15,
            height: 15,
            backgroundColor: nodeColor(person.role, person.feature),
            boxShadow: selected
              ? `0 0 0 3px ${nodeColor(person.role, person.feature)}55`
              : undefined,
          }}
        />
      </button>

      {showName && (
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1 text-center shadow-sm"
          style={{ bottom: 18 }}
        >
          <span className="block text-[12px] font-bold leading-tight text-slate-900">
            {person.name}
          </span>
          <span
            className="block text-[10px] leading-tight"
            style={{ color: roleTextColor(person.role) }}
          >
            {DISPLAY_TITLES[person.role][person.feature]}
          </span>
        </div>
      )}
    </Html>
  );
}
```

import 를 맞춘다: `useState` (react), `Html` (drei), `nodeColor`·`roleTextColor` (`../_data/role-colors`), `DISPLAY_TITLES` (`../_data/roles`), `MapPerson`, `Vec3`(`../_lib/radial`). `PersonNode`, `useFrame`, `THREE`, `roleColor`, `useRef` import 는 지운다.

- [ ] **Step 3: 중심 "나" 도 DOM 으로 옮긴다**

`SelfCore` 는 `PersonNode` + `SELF_NODE_SCALE` 로 그려지는 마지막 3D 노드다. 점이 DOM 으로 넘어간 이상 이것만 스프라이트로 남으면 `node-visual.ts` 전체가 그 하나 때문에 살아 있게 된다. `SelfCore.tsx` 를 아래로 바꾼다 (기존 docstring 의 판단 — 왜 프라이머리 블루인지, 왜 이름이 아니라 "나" 인지 — 는 그대로 옮긴다):

```tsx
"use client";

import { Html } from "@react-three/drei";
import { SELF_POSITION } from "../_lib/radial";

/**
 * 지도의 중심. 다섯 구역 어디에도 속하지 않으므로 색은 프라이머리
 * 블루(#2563EB)다 — 예전엔 비겁 색이었는데, 라이트 팔레트에서 비겁이
 * 주황이 되면서 나까지 주황이면 다섯 구역 중 하나의 사람으로 읽힌다.
 *
 * 적히는 것은 이름이 아니라 "나" 다. 지도의 중심은 언제나 보는 사람
 * 자신이고, 거기 이름이 있으면 다른 스무 명과 같은 층위의 한 명으로 읽힌다.
 * 공유 링크를 받은 사람에게도 이 자리는 "이 지도의 주인" 이다 — 주인의
 * 이름은 페이지 제목이 말한다(<이름>님의 관계 지도).
 */
export function SelfCore() {
  return (
    <Html
      center
      position={SELF_POSITION as unknown as [number, number, number]}
      zIndexRange={[10, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div className="relative grid place-items-center">
        <span
          aria-hidden
          className="absolute rounded-full"
          style={{ width: 92, height: 92, backgroundColor: "#2563EB", opacity: 0.08 }}
        />
        <span
          className="grid h-[52px] w-[52px] place-items-center rounded-full text-[15px] font-bold text-white select-none"
          style={{
            background: "radial-gradient(circle at 35% 30%, #7EB3FF, #2563EB)",
          }}
        >
          나
        </span>
      </div>
    </Html>
  );
}
```

`PersonNode` 는 이제 아무도 부르지 않는다 — 파일 삭제는 Task 7 에서 한다.

- [ ] **Step 4: 화면에서 확인한다**

브라우저에서 지도를 새로고침하고:
- 스크린샷 — 이름표가 하나도 안 보이고 색 점만 정돈돼 보여야 한다.
- 점 하나를 `computer {action: "left_click"}` 으로 눌러 이름칩이 뜨고 오른쪽 목록의 해당 행이 강조되는지 본다.
- `read_console_messages` 로 에러가 없는지 본다.

- [ ] **Step 5: 커밋**

```bash
git add src/app/map/_components/PersonMarker.tsx src/app/map/_components/SelfCore.tsx
git commit -m "feat(map): 노드를 점으로 줄이고 이름은 선택·호버에만 띄운다"
```

---

### Task 6: 15슬롯 배지

**Files:**
- Modify: `src/app/map/_components/RegionLabels.tsx`

**Interfaces:**
- Consumes: Task 3 의 `badgeAnchor`, `MapLayout`; World 가 `layout` 과 `counts` 를 내려준다
- Produces: `<RegionLabels layout={MapLayout} counts={CellCounts} />`

- [ ] **Step 1: 다시 쓴다**

`RegionLabels.tsx` 전체를 아래로 바꾼다:

```tsx
"use client";

import { Html } from "@react-three/drei";
import { roleColor, roleTextColor } from "../_data/role-colors";
import {
  DISPLAY_TITLES,
  ROLE_ICON,
  ROLE_ORDER,
  type Feature,
  type RelationRole,
} from "../_data/roles";
import { badgeAnchor, type CellCounts, type MapLayout } from "../_lib/radial";

const FEATURES: Feature[] = ["yukhap", "none", "chung"];

/**
 * 15개 칸마다 "무슨 관계인지 · 몇 명인지" 를 띄우는 배지.
 *
 * 색은 "다섯으로 갈렸다" 까지만 말한다. 라이벌과 동지가 같은 파랑인데 이름이
 * 하나뿐이면 그 구분이 사라지므로 칸마다 하나씩 붙인다.
 *
 * **사람이 없는 칸에는 아무것도 그리지 않는다.** 빈 자리에 이름표만 떠 있으면
 * 없는 관계가 있는 것처럼 읽힌다.
 *
 * 자리는 radial.badgeAnchor 가 계산한다 — 옛 구현은 매 프레임 화면공간에서
 * 배지를 밀어내야 했는데(badge-offset.ts), 이제 각 칸이 자기 각도를 소유하고
 * 그 바깥이 비어 있어 밀어낼 이유가 없다.
 */
export function RegionLabels({
  layout,
  counts,
}: {
  layout: MapLayout;
  counts: CellCounts;
}) {
  return (
    <group>
      {ROLE_ORDER.flatMap((role) =>
        FEATURES.map((feature) => {
          const at = badgeAnchor(layout, role, feature);
          if (!at) return null;
          return (
            <Badge
              key={`${role}/${feature}`}
              role={role}
              feature={feature}
              at={at}
              count={counts[role][feature]}
            />
          );
        }),
      )}
    </group>
  );
}

function Badge({
  role,
  feature,
  at,
  count,
}: {
  role: RelationRole;
  feature: Feature;
  at: readonly [number, number, number];
  count: number;
}) {
  return (
    <Html
      position={at as unknown as [number, number, number]}
      center
      zIndexRange={[20, 0]}
      style={{ pointerEvents: "none" }}
    >
      <div
        className="flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-[3px] select-none"
        style={{
          borderColor: `${roleColor(role)}4d`,
          backgroundColor: "#ffffffe6",
          color: roleTextColor(role),
        }}
      >
        <span className="text-[10px] leading-none" aria-hidden>
          {ROLE_ICON[role]}
        </span>
        <span className="text-[10px] font-semibold leading-none tracking-[0.02em]">
          {DISPLAY_TITLES[role][feature]}
        </span>
        <span className="text-[10px] font-bold leading-none tabular-nums opacity-80">
          {count}
        </span>
      </div>
    </Html>
  );
}
```

- [ ] **Step 2: World 가 layout 을 내려주게 한다**

`World.tsx` 의 `<RegionLabels counts={counts} />` 를 아래로 바꾼다. `layout` 은 Task 4 에서 이미 만들어 뒀다.

```tsx
      <RegionLabels layout={layout} counts={counts} />
```

- [ ] **Step 3: 화면에서 확인한다**

브라우저에서 새로고침하고 스크린샷:
- 사람이 있는 15칸의 배지가 전부 읽히는지 (시드 25명이면 15칸 전부 차 있다)
- 배지가 점이나 다른 배지와 겹치지 않는지
- 모바일 프리셋에서도 같은지 (확인 후 desktop 으로 되돌린다)

겹쳐 보이면 `radial.test.ts` 의 배지 테스트를 통과했는데도 겹친 것이므로 **테스트의 `MIN_BADGE_PX` 가 실제 배지 크기보다 작다는 뜻이다.** 실제 배지의 화면 크기를 재서 그 값을 올리고 Task 3 의 조정 절차를 다시 밟는다.

- [ ] **Step 4: 커밋**

```bash
git add src/app/map/_components/RegionLabels.tsx src/app/map/_components/World.tsx
git commit -m "feat(map): 구역 배지를 15슬롯 위에 계산으로 놓는다"
```

---

### Task 7: 옛 3D 배치 코드를 지운다

**Files:**
- Delete: `src/app/map/_lib/layout.ts`, `layout.test.ts`, `camera.ts`, `badge-offset.ts`, `badge-offset.test.ts`, `node-visual.ts`, `node-visual.test.ts`
- Delete: `src/app/map/_components/CameraRig.tsx`, `PersonNode.tsx`
- Modify: `src/app/map/_lib/connections.ts` (`Vec3` import 경로)
- Modify: `src/app/map/_lib/connections.test.ts`, `src/app/map/_data/saju-colors.test.ts` (옛 배치에 기댄 부분)

- [ ] **Step 1: 남은 참조를 찾는다**

```bash
grep -rn "_lib/layout\|_lib/camera\|badge-offset\|node-visual\|PersonNode\|CameraRig\|mock-people" src/
```

- [ ] **Step 2: 참조를 옮긴다**

- `connections.ts` 의 `import type { Vec3 } from "./layout"` → `from "./radial"`
- `connections.test.ts` 는 `placePeople(FRIENDS)` 로 좌표를 만든다. `radial.placePeople` 과 `_data/mock-people` 의 `FRIENDS` 로 그대로 돌아간다 — import 경로만 바꾼다. `connectionSegments` 가 `targets.length * 6` 개의 좌표를 낸다는 검산은 배치와 무관하므로 유지한다.
- `saju-colors.test.ts` 는 `FRIENDS`/`SELF` 만 쓰고 배치는 안 쓴다 — 그대로 둔다.

- [ ] **Step 3: 지운다**

```bash
git rm src/app/map/_lib/layout.ts src/app/map/_lib/layout.test.ts \
       src/app/map/_lib/camera.ts \
       src/app/map/_lib/badge-offset.ts src/app/map/_lib/badge-offset.test.ts \
       src/app/map/_lib/node-visual.ts src/app/map/_lib/node-visual.test.ts \
       src/app/map/_components/CameraRig.tsx src/app/map/_components/PersonNode.tsx
```

- [ ] **Step 4: 전부 통과하는지 본다**

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

Expected: 셋 다 통과. `layout.test.ts` 가 잠그던 보증(등거리·화면 안·최소 간격)은 Task 2·3 의 테스트가 이어받았다.

- [ ] **Step 5: 마지막으로 화면을 본다**

브라우저에서 25명 지도를 열어 스크린샷. 그리고 한도까지 채워 다시 본다:

```bash
npm run map:seed -- --count 50 --reset
```

새로고침 후 스크린샷 — 50명에서도 점·배지가 겹치지 않아야 한다. 확인이 끝나면 25명으로 되돌린다:

```bash
npm run map:seed -- --count 25 --reset
```

- [ ] **Step 6: 커밋**

```bash
git add -A src/app/map
git commit -m "refactor(map): 구면 배치·카메라 조작 코드를 걷어낸다"
```

---

## 완료 기준 (스펙 §완료 기준과 같다)

1. 데스크톱(≈700×500)·모바일(375×812) 양쪽에서 25명·50명 지도가 잘리지 않고 전부 보인다
2. 점끼리, 배지끼리, 배지와 점이 겹치지 않는다 — `radial.test.ts` 가 네 조합에서 잠근다
3. 사람이 있는 칸의 배지가 전부 읽힌다
4. 선택·호버·목록 연동이 지금과 같이 동작한다
5. `npm run typecheck` · `npm run lint` · `npm test` 통과
