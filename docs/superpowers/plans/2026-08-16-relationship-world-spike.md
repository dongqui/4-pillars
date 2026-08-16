# 관계 지도 UI 스파이크 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/lab/relationship-world` 라우트 하나에, 나 1명과 친구 20명이 5개 성운으로 나뉘어 떠 있는 우주형 관계 지도를 만들어 375px에서 판단 가능하게 한다.

**Architecture:** Next App Router 라우트 하나. `page.tsx`(서버)는 noindex metadata만 내보내고, `WorldShell.tsx`(`"use client"`)가 `next/dynamic` + `ssr: false`로 R3F `<Canvas>`를 지연 로드한다. 3D 씬은 순수 시각 요소만 담고, 사람 이름·바텀시트 같은 한글 텍스트는 전부 DOM(`drei <Html>`)이 맡는다. 상태는 `WorldShell`의 `useState` 두 개(`selectedId`, `cameraMode`)가 전부다.

**Tech Stack:** Next 16.2.10 (App Router), React 19.2.4, TypeScript strict, Tailwind 4, three 0.185, @react-three/fiber 9.7, @react-three/drei 10.7, vitest (environment: node)

## Global Constraints

이 절의 규칙은 **모든 태스크의 요구사항에 암묵적으로 포함된다.**

- **차트처럼 보이면 실패다.** 원형/오각형/방사형/동심원 차트, 그리고 "구체 노드가 떠 있는 디버그 화면"은 전부 실패 사례다.
- **거리는 궁합이 아니다.** `六合=가까이 / 沖=멀리`, `가까움=좋은 관계`를 만들지 않는다. 위치는 5개 역할 구분을 위한 시각 배치일 뿐이다.
- **六合과 沖은 같은 색, 같은 밝기다.** 오직 움직임의 질로만 다르다. 좋은 관계 / 나쁜 관계로 읽히면 실패다.
- **feature 없음에 이름을 주지 않는다.** "중립" 같은 별도 배지·라벨·색을 만들지 않는다.
- **5개 공간을 색으로 구분하지 않는다.** `木=초록` 같은 임의 의미색 금지. 명도·밀도·형태·크기로만 구분한다. 채도를 가진 요소는 화면에서 `나` 코어 하나뿐이다.
- **한글은 WebGL 안에 넣지 않는다.** 이름·장면명·설명 전부 DOM.
- **`src/app/globals.css`를 수정하지 않는다.** 다크 배경은 이 라우트 layout 안에서만 스코프한다.
- **`ssr: false`는 Client Component 안에서만 쓴다.** Server Component에서 쓰면 Next가 에러를 던진다 (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md:94`).
- **`Math.random()`을 쓰지 않는다.** 배치·별먼지 전부 시드 해시로 결정론적이어야 렌더마다 월드가 흔들리지 않는다.
- **전역 상태 라이브러리를 추가하지 않는다.**
- 색 토큰: 배경 베이스 `#0F172A`, 나 코어 accent `#2563EB`/`#60A5FA`, 성운·별먼지는 `#94A3B8`~`#BFDBFE` 좁은 한색 계열.
- 모든 UI 텍스트는 한국어.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `src/app/lab/relationship-world/page.tsx` | 서버 컴포넌트. noindex metadata + `<WorldShell/>` |
| `src/app/lab/relationship-world/layout.tsx` | 다크 배경 스코프 |
| `_components/WorldShell.tsx` | `"use client"`. Canvas 지연 로드, 선택/카메라모드 상태 보유 |
| `_components/World.tsx` | Canvas 내용물 조립 |
| `_components/Starfield.tsx` | 별먼지 3레이어 + 황도면 disc |
| `_components/SelfCore.tsx` | 나 |
| `_components/Nebula.tsx` | 관계 공간 하나 |
| `_components/PersonMarker.tsx` | drei `<Html>` 명패 + LOD 3단계 |
| `_components/RelationThread.tsx` | 六合 / 沖 / 기본 연결선 |
| `_components/CameraRig.tsx` | A/B/C 제한 + 선택 시 focus 보간 |
| `_components/CameraModeToggle.tsx` | `SegmentedControl` 재사용 |
| `_components/PersonSheet.tsx` | 모바일 바텀시트 / 데스크톱 사이드패널 |
| `_data/roles.ts` | 5개 역할 정의 |
| `_data/mock-people.ts` | 친구 20명 |
| `_lib/layout.ts` | 역할 → 좌표. **feature를 볼 수 없는 타입** |
| `_lib/layout.test.ts` | 거리 규칙 잠금 |
| `_lib/camera.ts` | A/B/C 제한값 + 기본 뷰 상수 |

---

## Task 1: 의존성과 라우트 뼈대

**Files:**
- Modify: `package.json`
- Create: `src/app/lab/relationship-world/layout.tsx`
- Create: `src/app/lab/relationship-world/page.tsx`
- Create: `src/app/lab/relationship-world/_components/WorldShell.tsx`
- Create: `src/app/lab/relationship-world/_components/World.tsx`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `<WorldShell />` (props 없음), `<World />` (props 없음 — Task 3에서 채운다)

- [ ] **Step 1: 3D 의존성 설치**

```bash
npm install three@^0.185.1 @react-three/fiber@^9.7.0 @react-three/drei@^10.7.8
npm install -D @types/three@^0.185.0
```

`@react-three/fiber` 9.7의 peer는 `react >=19 <19.3`이다. 이 프로젝트는 19.2.4라 맞는다. 설치 후 peer 경고가 나오면 멈추고 보고할 것.

- [ ] **Step 2: 라우트 layout 작성 (다크 스코프)**

`src/app/lab/relationship-world/layout.tsx`:

```tsx
export default function RelationshipWorldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // globals.css 는 light 고정이다. 다크는 이 라우트 안에서만 칠한다 —
  // 스파이크가 프로덕션 화면 색을 바꾸면 안 된다.
  return (
    <div className="fixed inset-0 bg-[#0F172A] text-slate-100 overflow-hidden">
      {children}
    </div>
  );
}
```

- [ ] **Step 3: page.tsx 작성 (서버, noindex)**

`src/app/lab/relationship-world/page.tsx`:

```tsx
import type { Metadata } from "next";
import { WorldShell } from "./_components/WorldShell";

export const metadata: Metadata = {
  title: "관계 지도 스파이크",
  robots: { index: false, follow: false },
};

export default function RelationshipWorldPage() {
  return <WorldShell />;
}
```

- [ ] **Step 4: WorldShell 작성 (클라이언트 경계 + Canvas 지연 로드)**

`_components/WorldShell.tsx`. `ssr: false`가 여기 있어야 한다 — 서버 컴포넌트에 두면 Next가 에러를 던진다.

```tsx
"use client";

import dynamic from "next/dynamic";

const World = dynamic(() => import("./World").then((m) => m.World), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">
      관계 지도를 여는 중
    </div>
  ),
});

export function WorldShell() {
  return (
    <div className="relative w-full h-full">
      <World />
    </div>
  );
}
```

- [ ] **Step 5: World 작성 (일단 상자 하나)**

`_components/World.tsx`. 이번 태스크에서는 3D가 실제로 그려지는지만 확인한다.

```tsx
"use client";

import { Canvas } from "@react-three/fiber";

export function World() {
  return (
    <Canvas camera={{ position: [0, 3.2, 13], fov: 50 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 8]} intensity={1.2} />
      <mesh>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#60a5fa" />
      </mesh>
    </Canvas>
  );
}
```

- [ ] **Step 6: 타입체크와 빌드 확인**

Run: `npm run typecheck`
Expected: 에러 없음

Run: `npm run build`
Expected: 성공. 라우트 목록에 `/lab/relationship-world` 가 보인다.

- [ ] **Step 7: 브라우저 확인**

Run: `npm run dev` 후 `http://localhost:3000/lab/relationship-world`
Expected: 어두운 남색 배경에 파란 다면체 하나. 콘솔 에러 없음.

- [ ] **Step 8: 커밋**

```bash
git add package.json package-lock.json src/app/lab
git commit -m "feat(lab): 관계 지도 스파이크 라우트와 R3F 캔버스를 띄운다"
```

---

## Task 2: 역할·목데이터·배치 로직 (TDD)

이 태스크가 이 계획에서 유일하게 진짜 테스트를 갖는 곳이다. 나머지는 시각 판단이라 자동 테스트가 의미 없다. 여기서는 **어기면 안 되는 규칙 하나**만 잠근다.

**Files:**
- Create: `src/app/lab/relationship-world/_data/roles.ts`
- Create: `src/app/lab/relationship-world/_data/mock-people.ts`
- Create: `src/app/lab/relationship-world/_lib/layout.ts`
- Test: `src/app/lab/relationship-world/_lib/layout.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `type RelationRole = "fill" | "beside" | "express" | "move" | "refine"`
  - `type Feature = "none" | "yukhap" | "chung"`
  - `type Vec3 = readonly [number, number, number]`
  - `type MockPerson = { id, name, pillarKey, sceneName, role, feature }`
  - `ROLE_LABELS: Record<RelationRole, string>`
  - `ROLE_ORDER: readonly RelationRole[]`
  - `FRIENDS: readonly MockPerson[]` (20명)
  - `SELF_POSITION: Vec3`
  - `NEBULA_CENTERS: Record<RelationRole, Vec3>`
  - `NEBULA_SPREAD: Record<RelationRole, number>`
  - `positionFor(role: RelationRole, indexInRole: number): Vec3`
  - `placePeople(people: readonly Placeable[]): Map<string, Vec3>`
  - `hash01(seed: number): number`

- [ ] **Step 1: 역할 정의 작성**

`_data/roles.ts`:

```ts
export type RelationRole =
  | "fill"      // 나를 채워주는 사람
  | "beside"    // 나란히 서는 사람
  | "express"   // 나를 표현하게 하는 사람
  | "move"      // 나를 움직이게 하는 사람
  | "refine";   // 나를 다듬는 사람

export type Feature = "none" | "yukhap" | "chung";

export const ROLE_ORDER: readonly RelationRole[] = [
  "fill",
  "beside",
  "express",
  "move",
  "refine",
] as const;

export const ROLE_LABELS: Record<RelationRole, string> = {
  fill: "나를 채워주는 사람",
  beside: "나란히 서는 사람",
  express: "나를 표현하게 하는 사람",
  move: "나를 움직이게 하는 사람",
  refine: "나를 다듬는 사람",
};

// 六合 / 沖 은 배지 문구까지 같은 무게여야 한다. 한쪽만 길거나
// 한쪽만 형용사가 붙으면 그 순간 좋고 나쁨으로 읽힌다.
export const FEATURE_LABELS: Record<Exclude<Feature, "none">, string> = {
  yukhap: "六合",
  chung: "沖",
};
```

- [ ] **Step 2: 목 데이터 작성 (친구 20명)**

`_data/mock-people.ts`. 일주 키와 장면명은 `src/lib/saju-core/data/characters-60.json`의 실제 값이다. 역할 배분은 6/5/4/3/2로 일부러 기울였고, feature는 없음 11 / 六合 5 / 沖 4다.

```ts
import type { Feature, RelationRole } from "./roles";

export type MockPerson = {
  readonly id: string;
  readonly name: string;
  readonly pillarKey: string;
  readonly sceneName: string;
  readonly role: RelationRole;
  readonly feature: Feature;
};

export const SELF = {
  id: "self",
  name: "나",
  pillarKey: "갑자",
  sceneName: "깊은 물가의 큰나무",
} as const;

export const FRIENDS: readonly MockPerson[] = [
  // 나를 채워주는 사람 · 6
  { id: "f01", name: "민수", pillarKey: "정묘", sceneName: "풀숲에 깃든 등불", role: "fill", feature: "none" },
  { id: "f02", name: "지현", pillarKey: "신미", sceneName: "모래 속의 보석", role: "fill", feature: "yukhap" },
  { id: "f03", name: "태호", pillarKey: "을해", sceneName: "물안개 속 들꽃", role: "fill", feature: "none" },
  { id: "f04", name: "서연", pillarKey: "기묘", sceneName: "풀 돋은 들판", role: "fill", feature: "chung" },
  { id: "f05", name: "준영", pillarKey: "계미", sceneName: "마른 땅을 적시는 이슬", role: "fill", feature: "none" },
  { id: "f06", name: "하람", pillarKey: "정해", sceneName: "물 위에 뜬 등불", role: "fill", feature: "none" },

  // 나란히 서는 사람 · 5
  { id: "f07", name: "은채", pillarKey: "신묘", sceneName: "풀숲에 숨은 보석", role: "beside", feature: "yukhap" },
  { id: "f08", name: "도윤", pillarKey: "을미", sceneName: "마른 땅에 핀 들꽃", role: "beside", feature: "none" },
  { id: "f09", name: "가온", pillarKey: "기해", sceneName: "물길을 낸 들판", role: "beside", feature: "none" },
  { id: "f10", name: "선우", pillarKey: "계묘", sceneName: "풀잎 끝의 이슬", role: "beside", feature: "chung" },
  { id: "f11", name: "예린", pillarKey: "정미", sceneName: "들을 밝히는 등불", role: "beside", feature: "none" },

  // 나를 표현하게 하는 사람 · 4
  { id: "f12", name: "시우", pillarKey: "신해", sceneName: "맑은 물에 씻긴 보석", role: "express", feature: "yukhap" },
  { id: "f13", name: "나윤", pillarKey: "을묘", sceneName: "흐드러지게 핀 들꽃", role: "express", feature: "none" },
  { id: "f14", name: "건우", pillarKey: "기미", sceneName: "황금빛 들판", role: "express", feature: "none" },
  { id: "f15", name: "채원", pillarKey: "계해", sceneName: "바다로 가는 이슬", role: "express", feature: "chung" },

  // 나를 움직이게 하는 사람 · 3
  { id: "f16", name: "지호", pillarKey: "기사", sceneName: "온기가 스민 들판", role: "move", feature: "yukhap" },
  { id: "f17", name: "소율", pillarKey: "정축", sceneName: "새벽을 기다리는 등불", role: "move", feature: "none" },
  { id: "f18", name: "우진", pillarKey: "계사", sceneName: "볕을 머금은 이슬", role: "move", feature: "chung" },

  // 나를 다듬는 사람 · 2
  { id: "f19", name: "다인", pillarKey: "을사", sceneName: "모닥불 곁의 들꽃", role: "refine", feature: "yukhap" },
  { id: "f20", name: "현수", pillarKey: "갑자", sceneName: "깊은 물가의 큰나무", role: "refine", feature: "none" },
];
```

- [ ] **Step 3: 실패하는 테스트 작성**

`_lib/layout.test.ts`. 이 테스트가 잠그는 것은 브리프 9절이다 — 궁합이 위치에 영향을 주면 안 된다.

```ts
import { describe, it, expect } from "vitest";
import { FRIENDS, type MockPerson } from "../_data/mock-people";
import { ROLE_ORDER } from "../_data/roles";
import { NEBULA_CENTERS, placePeople, positionFor } from "./layout";

function dist(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe("positionFor", () => {
  it("같은 역할·인덱스면 항상 같은 좌표를 준다", () => {
    expect(positionFor("fill", 3)).toEqual(positionFor("fill", 3));
  });

  it("같은 역할 안에서 인덱스가 다르면 좌표가 다르다", () => {
    expect(positionFor("fill", 0)).not.toEqual(positionFor("fill", 1));
  });
});

describe("placePeople", () => {
  // 브리프 9절: 六合=가까이 / 沖=멀리 를 만들지 않는다.
  it("feature 를 전부 바꿔도 좌표가 그대로다", () => {
    const before = placePeople(FRIENDS);

    const swapped: MockPerson[] = FRIENDS.map((p) => ({
      ...p,
      feature: p.feature === "yukhap" ? "chung" : "yukhap",
    }));
    const after = placePeople(swapped);

    for (const p of FRIENDS) {
      expect(after.get(p.id)).toEqual(before.get(p.id));
    }
  });

  it("20명 전원에게 좌표를 준다", () => {
    expect(placePeople(FRIENDS).size).toBe(20);
  });

  it("두 사람이 같은 자리에 겹치지 않는다", () => {
    const placed = [...placePeople(FRIENDS).values()];
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(dist(placed[i], placed[j])).toBeGreaterThan(0.35);
      }
    }
  });
});

describe("NEBULA_CENTERS", () => {
  it("5개 역할이 모두 정의돼 있다", () => {
    for (const role of ROLE_ORDER) {
      expect(NEBULA_CENTERS[role]).toBeDefined();
    }
  });

  it("성운 중심들이 서로 충분히 떨어져 있다", () => {
    for (let i = 0; i < ROLE_ORDER.length; i++) {
      for (let j = i + 1; j < ROLE_ORDER.length; j++) {
        const d = dist(NEBULA_CENTERS[ROLE_ORDER[i]], NEBULA_CENTERS[ROLE_ORDER[j]]);
        expect(d).toBeGreaterThan(3.5);
      }
    }
  });

  it("성운 중심이 원점에서 같은 거리에 있지 않다 — 동심원으로 보이면 실패다", () => {
    const radii = ROLE_ORDER.map((r) => dist(NEBULA_CENTERS[r], [0, 0, 0]));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(1.5);
  });
});
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `npx vitest run src/app/lab/relationship-world/_lib/layout.test.ts`
Expected: FAIL — `Failed to resolve import "./layout"`

- [ ] **Step 5: layout.ts 구현**

`_lib/layout.ts`. **`positionFor`도 `Placeable`도 `feature`를 받지 않는다.** 규칙을 주석으로 부탁하는 대신 타입이 못 어기게 막는다 — `Placeable`에 `feature`가 없으므로 `placePeople` 본문에서는 접근 자체가 컴파일되지 않는다.

```ts
import type { RelationRole } from "../_data/roles";

export type Vec3 = readonly [number, number, number];

export const SELF_POSITION: Vec3 = [0, 0, 0];

// 의도적 비대칭이다. 원점에서의 거리·고도·방위각이 전부 다르다.
// fill(뒤)과 refine(앞)은 기본 시점에서 화면상 겹치도록 x,y 를 비슷하게 두고
// z 만 크게 벌렸다 — 겹침이 없으면 3D여도 평면 배치로 읽힌다.
export const NEBULA_CENTERS: Record<RelationRole, Vec3> = {
  fill: [5.1, 1.8, -2.4],
  refine: [4.0, 0.6, 6.6],
  beside: [-6.3, -1.2, 1.8],
  move: [-3.6, 4.0, 3.6],
  express: [0.9, -3.0, 1.5],
};

// 인원이 많은 성운일수록 넓게 퍼진다. 밀도도 함께 달라져 구분에 보탬이 된다.
export const NEBULA_SPREAD: Record<RelationRole, number> = {
  fill: 2.6,
  beside: 2.3,
  express: 2.0,
  move: 1.7,
  refine: 1.4,
};

/** 시드 기반 0..1. Math.random 을 쓰면 렌더마다 월드가 흔들린다. */
export function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 11.7) * 43758.5453;
  return x - Math.floor(x);
}

const ROLE_SEED: Record<RelationRole, number> = {
  fill: 17,
  beside: 53,
  express: 91,
  move: 137,
  refine: 211,
};

/**
 * 사람 한 명의 좌표.
 *
 * feature 인자가 없다 — 궁합이 위치에 영향을 주는 코드는 작성 자체가 불가능하다.
 * (브리프 9절: 六合=가까이 / 沖=멀리 금지)
 */
export function positionFor(role: RelationRole, indexInRole: number): Vec3 {
  const center = NEBULA_CENTERS[role];
  const spread = NEBULA_SPREAD[role];
  const s = ROLE_SEED[role] + indexInRole * 7;

  // 성운 부피 '안쪽'에 3차원으로 흩는다. 같은 깊이에 나란히 세우면 리스트가 된다.
  const u = hash01(s * 3 + 1) * 2 - 1;
  const theta = hash01(s * 3 + 2) * Math.PI * 2;
  const r = spread * (0.35 + hash01(s * 3 + 3) * 0.65);
  const flat = Math.sqrt(1 - u * u);

  return [
    center[0] + r * flat * Math.cos(theta),
    center[1] + r * u * 0.75,
    center[2] + r * flat * Math.sin(theta),
  ];
}

/** placePeople 이 볼 수 있는 전부. feature 는 여기 없다. */
export type Placeable = { readonly id: string; readonly role: RelationRole };

export function placePeople(people: readonly Placeable[]): Map<string, Vec3> {
  const seen = new Map<RelationRole, number>();
  const out = new Map<string, Vec3>();

  for (const person of people) {
    const index = seen.get(person.role) ?? 0;
    seen.set(person.role, index + 1);
    out.set(person.id, positionFor(person.role, index));
  }

  return out;
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run src/app/lab/relationship-world/_lib/layout.test.ts`
Expected: PASS — 7개 전부 통과

겹침 테스트(`> 0.35`)나 중심 간격 테스트(`> 3.5`)가 실패하면, 테스트 기준을 낮추지 말고 `NEBULA_SPREAD` 값을 줄이거나 `NEBULA_CENTERS`를 벌려서 고칠 것. 이 두 테스트는 화면이 뭉개지는 것을 막는 장치다.

- [ ] **Step 7: 전체 테스트 스위트 확인**

Run: `npm test`
Expected: 기존 테스트 전부 통과 + 새 테스트 통과

- [ ] **Step 8: 커밋**

```bash
git add src/app/lab/relationship-world/_data src/app/lab/relationship-world/_lib
git commit -m "feat(lab): 관계 역할·목데이터와 궁합 무관 배치 로직을 추가한다"
```

---

## Task 3: 월드 배경 — 별먼지 3레이어와 나 코어

**Files:**
- Create: `src/app/lab/relationship-world/_components/Starfield.tsx`
- Create: `src/app/lab/relationship-world/_components/SelfCore.tsx`
- Modify: `src/app/lab/relationship-world/_components/World.tsx`

**Interfaces:**
- Consumes: `SELF_POSITION`, `hash01` (Task 2)
- Produces: `<Starfield />` (props 없음), `<SelfCore />` (props 없음)

- [ ] **Step 1: Starfield 작성**

`_components/Starfield.tsx`. 레이어마다 반지름·입자크기·투명도·회전속도가 달라서 패럴랙스가 생긴다. 황도면 disc는 거의 안 보이는 수준으로 깔아 위/아래 감각만 남긴다.

```tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { hash01 } from "../_lib/layout";

function useSpherePositions(count: number, radius: number, seed: number) {
  return useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const s = seed + i * 3;
      const u = hash01(s + 1) * 2 - 1;
      const theta = hash01(s + 2) * Math.PI * 2;
      const r = radius * (0.55 + hash01(s + 3) * 0.45);
      const flat = Math.sqrt(1 - u * u);
      arr[i * 3] = r * flat * Math.cos(theta);
      arr[i * 3 + 1] = r * u;
      arr[i * 3 + 2] = r * flat * Math.sin(theta);
    }
    return arr;
  }, [count, radius, seed]);
}

function DustLayer({
  count,
  radius,
  size,
  opacity,
  drift,
  seed,
}: {
  count: number;
  radius: number;
  size: number;
  opacity: number;
  drift: number;
  seed: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const positions = useSpherePositions(count, radius, seed);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * drift;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        color="#cbd5e1"
        transparent
        opacity={opacity}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function Starfield() {
  return (
    <group>
      {/* 멀수록 작고 흐리고 느리다 */}
      <DustLayer count={900} radius={46} size={0.14} opacity={0.35} drift={0.004} seed={101} />
      <DustLayer count={420} radius={26} size={0.2} opacity={0.5} drift={0.011} seed={523} />
      <DustLayer count={160} radius={15} size={0.28} opacity={0.65} drift={0.022} seed={947} />

      {/* 황도면. 의식되지 않되 위/아래는 느껴지는 수준으로만. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.5, 11, 96]} />
        <meshBasicMaterial
          color="#334155"
          transparent
          opacity={0.07}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
```

- [ ] **Step 2: SelfCore 작성**

`_components/SelfCore.tsx`. 화면에서 채도를 가진 유일한 요소다.

```tsx
"use client";

import { useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SELF } from "../_data/mock-people";
import { SELF_POSITION } from "../_lib/layout";

export function SelfCore() {
  const shell = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!shell.current) return;
    // 아주 느린 맥동. 눈에 띄면 안 되고, 살아 있다는 느낌만 남긴다.
    const t = state.clock.elapsedTime;
    const s = 1 + Math.sin(t * 0.7) * 0.04;
    shell.current.scale.setScalar(s);
  });

  return (
    <group position={SELF_POSITION as unknown as [number, number, number]}>
      <mesh>
        <icosahedronGeometry args={[0.34, 3]} />
        <meshStandardMaterial
          color="#93c5fd"
          emissive="#2563eb"
          emissiveIntensity={2.4}
          roughness={0.35}
        />
      </mesh>

      <mesh ref={shell}>
        <icosahedronGeometry args={[0.62, 2]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.14} depthWrite={false} />
      </mesh>

      <mesh>
        <icosahedronGeometry args={[1.05, 2]} />
        <meshBasicMaterial color="#2563eb" transparent opacity={0.06} depthWrite={false} />
      </mesh>

      <pointLight color="#60a5fa" intensity={9} distance={9} decay={2} />

      {/* 어느 것이 나인지 모르면 관계 지도가 아니다. 이름은 DOM 으로. */}
      <Html center position={[0, -1.05, 0]} zIndexRange={[10, 0]}>
        <span className="text-[12px] font-semibold tracking-[0.14em] text-blue-200/80 select-none">
          {SELF.name}
        </span>
      </Html>
    </group>
  );
}
```

- [ ] **Step 3: World 갱신**

`_components/World.tsx`의 상자를 치우고 배경을 넣는다.

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { Starfield } from "./Starfield";
import { SelfCore } from "./SelfCore";

export function World() {
  return (
    <Canvas
      camera={{ position: [0, 3.2, 13], fov: 50 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#0F172A"]} />
      <fog attach="fog" args={["#0F172A", 18, 52]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 8, 6]} intensity={0.5} />

      <Starfield />
      <SelfCore />
    </Canvas>
  );
}
```

- [ ] **Step 4: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 5: 브라우저 확인**

Run: `npm run dev` 후 `/lab/relationship-world`
Expected: 깊은 남색 우주에 별먼지가 세 겹으로 아주 느리게 흐르고, 중앙에 푸른 코어가 은은하게 빛난다. 황도면은 의식하지 않으면 안 보일 정도.

별먼지가 눈에 띄게 빨리 돌면 `drift` 값을 절반으로 줄일 것. 회전이 인지되는 순간 산만해진다.

- [ ] **Step 6: 커밋**

```bash
git add src/app/lab/relationship-world/_components
git commit -m "feat(lab): 별먼지 3레이어와 나 코어로 우주 배경을 만든다"
```

---

## Task 4: 5개 성운

**Files:**
- Create: `src/app/lab/relationship-world/_components/Nebula.tsx`
- Modify: `src/app/lab/relationship-world/_components/World.tsx`

**Interfaces:**
- Consumes: `NEBULA_CENTERS`, `NEBULA_SPREAD`, `hash01`, `ROLE_ORDER`, `RelationRole` (Task 2)
- Produces: `<Nebula role={RelationRole} dimmed={boolean} />`, `NEBULA_STYLE: Record<RelationRole, {...}>`

- [ ] **Step 1: Nebula 작성**

`_components/Nebula.tsx`. **색으로 구분하지 않는다** — tint는 전부 좁은 한색 계열이고 어떤 의미도 없다. 실제 구분은 입자 수·크기·퍼짐·밝기가 한다.

```tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RelationRole } from "../_data/roles";
import { NEBULA_CENTERS, NEBULA_SPREAD, hash01 } from "../_lib/layout";

// 색은 의미를 갖지 않는다. 오행색을 임의로 만들지 않기 위해 좁은 한색
// 계열 안에서만 미세하게 변주하고, 구분은 밀도·크기·퍼짐이 맡는다.
//
// 다섯 틴트의 채도는 20~35% 대에 함께 묶여 있어야 한다. 하나만 채도가 튀면
// 그 성운이 '파란 것'으로 읽히면서 색이 구분을 맡아버린다.
export const NEBULA_STYLE: Record<
  RelationRole,
  { count: number; size: number; opacity: number; tint: string; drift: number }
> = {
  fill: { count: 1400, size: 0.26, opacity: 0.5, tint: "#c3ccd9", drift: 0.03 },
  beside: { count: 1100, size: 0.3, opacity: 0.42, tint: "#cbd5e1", drift: -0.026 },
  express: { count: 900, size: 0.22, opacity: 0.52, tint: "#a5b4c8", drift: 0.038 },
  move: { count: 700, size: 0.34, opacity: 0.38, tint: "#94a3b8", drift: -0.033 },
  refine: { count: 520, size: 0.19, opacity: 0.58, tint: "#b6c6dc", drift: 0.045 },
};

export function Nebula({ role, dimmed }: { role: RelationRole; dimmed: boolean }) {
  const style = NEBULA_STYLE[role];
  const center = NEBULA_CENTERS[role];
  const spread = NEBULA_SPREAD[role];
  const ref = useRef<THREE.Points>(null);
  const material = useRef<THREE.PointsMaterial>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(style.count * 3);
    for (let i = 0; i < style.count; i++) {
      const s = i * 3 + style.count;
      const u = hash01(s + 1) * 2 - 1;
      const theta = hash01(s + 2) * Math.PI * 2;
      // 세제곱근을 쓰면 부피에 고르게 차고, 가운데가 뭉치지 않는다.
      const r = spread * 1.55 * Math.cbrt(hash01(s + 3));
      const flat = Math.sqrt(1 - u * u);
      arr[i * 3] = r * flat * Math.cos(theta);
      arr[i * 3 + 1] = r * u * 0.8;
      arr[i * 3 + 2] = r * flat * Math.sin(theta);
    }
    return arr;
  }, [style.count, spread]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * style.drift;
    if (material.current) {
      const target = dimmed ? style.opacity * 0.25 : style.opacity;
      material.current.opacity += (target - material.current.opacity) * Math.min(1, delta * 5);
    }
  });

  return (
    <points ref={ref} position={center as unknown as [number, number, number]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        size={style.size}
        color={style.tint}
        transparent
        opacity={style.opacity}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
```

- [ ] **Step 2: World에 5개 성운 배치**

`_components/World.tsx`에 추가한다. 아직 선택 개념이 없으므로 `dimmed`는 전부 `false`다.

```tsx
"use client";

import { Canvas } from "@react-three/fiber";
import { ROLE_ORDER } from "../_data/roles";
import { Starfield } from "./Starfield";
import { SelfCore } from "./SelfCore";
import { Nebula } from "./Nebula";

export function World() {
  return (
    <Canvas
      camera={{ position: [0, 3.2, 13], fov: 50 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#0F172A"]} />
      <fog attach="fog" args={["#0F172A", 18, 52]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 8, 6]} intensity={0.5} />

      <Starfield />
      <SelfCore />

      {ROLE_ORDER.map((role) => (
        <Nebula key={role} role={role} dimmed={false} />
      ))}
    </Canvas>
  );
}
```

- [ ] **Step 3: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 4: 브라우저 확인 — 이 태스크의 진짜 관문**

Run: `npm run dev` 후 `/lab/relationship-world`. **DevTools를 375px로 맞춘다.**

Expected: 5개의 성운 구름이 서로 다른 크기·밀도·깊이로 떠 있다. `fill`과 `refine`이 화면상 앞뒤로 겹쳐 보인다.

여기서 반드시 확인할 것:

- 오각형이나 동심원으로 보이는가 → **보이면 실패다.** `NEBULA_CENTERS`를 더 비대칭으로 흔든다.
- 5개가 구분되는가 → 안 되면 `NEBULA_STYLE`의 `count`/`size` 차이를 더 벌린다. **색을 바꿔서 해결하지 않는다.**
- 겹침이 보이는가 → 안 보이면 `fill`과 `refine`의 x,y를 더 비슷하게, z를 더 벌린다.

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world/_components
git commit -m "feat(lab): 깊이가 다른 5개 성운으로 관계 공간을 나눈다"
```

---

## Task 5: 사람 마커와 LOD

**Files:**
- Create: `src/app/lab/relationship-world/_components/PersonMarker.tsx`
- Modify: `src/app/lab/relationship-world/_components/World.tsx`

**Interfaces:**
- Consumes: `MockPerson`, `FRIENDS`, `placePeople`, `Vec3` (Task 2)
- Produces: `<PersonMarker person selected dimmed boosted onSelect />`
- World가 새로 받는 props: `<World selectedId={string | null} onSelect={(id: string | null) => void} />`

- [ ] **Step 1: PersonMarker 작성**

`_components/PersonMarker.tsx`. 이름은 DOM이다 — WebGL 텍스트를 쓰지 않는다. `distanceFactor`를 주지 않아 이름 크기가 화면상 일정하게 유지된다. 대신 거리는 LOD 단계로 표현한다.

```tsx
"use client";

import { useRef, useState } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { MockPerson } from "../_data/mock-people";
import type { Vec3 } from "../_lib/layout";

type Tier = "full" | "compact" | "dot";

// 경계값은 눈으로 맞춘 값이다. 375px 에서 이름이 겹치기 시작하는 지점이 곧 경계다.
const NEAR = 11;
const FAR = 17;

function tierFor(distance: number): Tier {
  if (distance < NEAR) return "full";
  if (distance < FAR) return "compact";
  return "dot";
}

const ORDER: Tier[] = ["dot", "compact", "full"];

/** 선택된 성운의 사람은 한 단계 올린다. dim 처리와 같은 동작이라 개념이 늘지 않는다. */
function boost(tier: Tier): Tier {
  return ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(tier) + 1)];
}

export function PersonMarker({
  person,
  position,
  selected,
  dimmed,
  boosted,
  onSelect,
}: {
  person: MockPerson;
  position: Vec3;
  selected: boolean;
  dimmed: boolean;
  boosted: boolean;
  onSelect: (id: string) => void;
}) {
  const [tier, setTier] = useState<Tier>("compact");
  const current = useRef<Tier>("compact");
  const world = useRef(new THREE.Vector3(...position));

  useFrame((state) => {
    // 매 프레임 setState 하면 20개가 리렌더를 쏟아낸다. 단계가 바뀔 때만 올린다.
    const next = tierFor(state.camera.position.distanceTo(world.current));
    if (next !== current.current) {
      current.current = next;
      setTier(next);
    }
  });

  const shown = boosted ? boost(tier) : tier;
  const opacity = selected ? 1 : dimmed ? 0.28 : 0.92;

  return (
    <Html
      position={position as unknown as [number, number, number]}
      center
      zIndexRange={[30, 0]}
      style={{ pointerEvents: "auto", transition: "opacity 220ms ease", opacity }}
    >
      {shown === "dot" ? (
        <button
          type="button"
          aria-label={person.name}
          onClick={() => onSelect(person.id)}
          className="grid place-items-center w-11 h-11 -m-[14px] cursor-pointer bg-transparent border-0"
        >
          <span
            className={`block w-[7px] h-[7px] rounded-full ${
              selected ? "bg-blue-300" : "bg-slate-300/80"
            }`}
          />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(person.id)}
          className={`
            flex items-center justify-center whitespace-nowrap cursor-pointer
            rounded-md border backdrop-blur-[2px] transition-all
            ${shown === "full" ? "min-h-11 px-3 text-[13px]" : "min-h-8 px-2 text-[11px]"}
            ${
              selected
                ? "border-blue-400/70 bg-blue-500/25 text-white font-semibold"
                : "border-slate-400/25 bg-slate-900/55 text-slate-200 font-medium"
            }
          `}
        >
          {person.name}
        </button>
      )}
    </Html>
  );
}
```

- [ ] **Step 2: World에 마커 배치와 선택 props 추가**

`_components/World.tsx`를 통째로 교체한다.

```tsx
"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { ROLE_ORDER } from "../_data/roles";
import { FRIENDS } from "../_data/mock-people";
import { placePeople } from "../_lib/layout";
import { Starfield } from "./Starfield";
import { SelfCore } from "./SelfCore";
import { Nebula } from "./Nebula";
import { PersonMarker } from "./PersonMarker";

export function World({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const placed = useMemo(() => placePeople(FRIENDS), []);
  const selected = FRIENDS.find((p) => p.id === selectedId) ?? null;

  return (
    <Canvas
      camera={{ position: [0, 3.2, 13], fov: 50 }}
      gl={{ antialias: true }}
      dpr={[1, 2]}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={["#0F172A"]} />
      <fog attach="fog" args={["#0F172A", 18, 52]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 8, 6]} intensity={0.5} />

      <Starfield />
      <SelfCore />

      {ROLE_ORDER.map((role) => (
        <Nebula key={role} role={role} dimmed={selected !== null && selected.role !== role} />
      ))}

      {FRIENDS.map((person) => (
        <PersonMarker
          key={person.id}
          person={person}
          position={placed.get(person.id)!}
          selected={selected?.id === person.id}
          dimmed={selected !== null && selected.id !== person.id}
          boosted={selected !== null && selected.role === person.role}
          onSelect={onSelect}
        />
      ))}
    </Canvas>
  );
}
```

- [ ] **Step 3: WorldShell에 선택 상태 추가**

`_components/WorldShell.tsx`:

```tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const World = dynamic(() => import("./World").then((m) => m.World), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">
      관계 지도를 여는 중
    </div>
  ),
});

export function WorldShell() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="relative w-full h-full">
      <World selectedId={selectedId} onSelect={setSelectedId} />
    </div>
  );
}
```

- [ ] **Step 4: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 5: 브라우저 확인 — 20명 겹침이 이 태스크의 관문**

Run: `npm run dev`, **DevTools 375px**

Expected: 20개 명패가 성운 안쪽에 3차원으로 흩어져 있다. 먼 것은 점, 중간은 작은 명패, 가까운 것은 이름이 읽히는 명패. 사람을 누르면 나머지가 흐려지고 같은 성운 사람들의 이름이 올라온다.

여기서 반드시 확인할 것:

- 이름이 서로 겹쳐 뭉개지는가 → `NEAR`/`FAR` 경계값을 조정한다. 그래도 안 되면 `NEBULA_SPREAD`를 키운다.
- 터치가 쉬운가 → dot 단계 버튼이 44px 터치 타겟을 유지하는지 확인 (`w-11 h-11`).
- 20명이 버벅이는가 → **여기서 고치지 않는다.** 프레임 저하를 기록만 해두고 넘어간다 (스파이크 비범위).

- [ ] **Step 6: 커밋**

```bash
git add src/app/lab/relationship-world/_components
git commit -m "feat(lab): 사람 명패를 DOM 마커로 띄우고 거리별 LOD를 넣는다"
```

---

## Task 6: 카메라 A/B/C와 토글

**Files:**
- Create: `src/app/lab/relationship-world/_lib/camera.ts`
- Create: `src/app/lab/relationship-world/_components/CameraRig.tsx`
- Create: `src/app/lab/relationship-world/_components/CameraModeToggle.tsx`
- Modify: `src/app/lab/relationship-world/_components/World.tsx`
- Modify: `src/app/lab/relationship-world/_components/WorldShell.tsx`

**Interfaces:**
- Consumes: `<SegmentedControl>` from `@/components/SegmentedControl` (기존, 수정 불필요)
- Produces:
  - `type CameraMode = "a" | "b" | "c"`
  - `CAMERA_LIMITS: Record<CameraMode, {minPolar, maxPolar, minAzimuth, maxAzimuth, minDistance, maxDistance, enablePan}>`
  - `DEFAULT_CAMERA_POSITION: [number, number, number]`
  - `<CameraRig mode={CameraMode} resetSignal={number} />`
  - `<CameraModeToggle mode onChange onReset />`
  - World가 새로 받는 props: `mode`, `resetSignal`

- [ ] **Step 1: 카메라 상수 작성**

`_lib/camera.ts`. 기본 뷰는 세 모드 **모두의 허용 범위 안에** 있어야 한다. 그래야 모드를 바꿔도 시점이 튀지 않고 같은 조건에서 비교된다.

```ts
export type CameraMode = "a" | "b" | "c";

const deg = (d: number) => (d * Math.PI) / 180;

/** 기본 뷰. polar 약 76°, azimuth 0°, 거리 약 13.4 — A/B/C 전부의 범위 안이다. */
export const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 3.2, 13];
export const DEFAULT_TARGET: [number, number, number] = [0, 0, 0];

export const CAMERA_LIMITS: Record<
  CameraMode,
  {
    minPolar: number;
    maxPolar: number;
    minAzimuth: number;
    maxAzimuth: number;
    minDistance: number;
    maxDistance: number;
    enablePan: boolean;
  }
> = {
  // A · 제한적
  a: {
    minPolar: deg(60),
    maxPolar: deg(85),
    minAzimuth: deg(-35),
    maxAzimuth: deg(35),
    minDistance: 10.4,
    maxDistance: 15.6,
    enablePan: false,
  },
  // B · 중간
  b: {
    minPolar: deg(35),
    maxPolar: deg(100),
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minDistance: 7.8,
    maxDistance: 20.8,
    enablePan: false,
  },
  // C · 자유 + Reset
  c: {
    minPolar: deg(15),
    maxPolar: deg(140),
    minAzimuth: -Infinity,
    maxAzimuth: Infinity,
    minDistance: 5.2,
    maxDistance: 32.5,
    enablePan: true,
  },
};

export const CAMERA_MODE_OPTIONS: { value: CameraMode; label: string }[] = [
  { value: "a", label: "A 제한" },
  { value: "b", label: "B 중간" },
  { value: "c", label: "C 자유" },
];
```

- [ ] **Step 2: CameraRig 작성**

`_components/CameraRig.tsx`. 이번 태스크에서는 제한과 리셋만 한다. 선택 focus는 Task 8이다.

```tsx
"use client";

import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  CAMERA_LIMITS,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_TARGET,
  type CameraMode,
} from "../_lib/camera";

export function CameraRig({
  mode,
  resetSignal,
}: {
  mode: CameraMode;
  resetSignal: number;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const limits = CAMERA_LIMITS[mode];

  useEffect(() => {
    // resetSignal 이 바뀔 때마다 기본 뷰로 돌린다. 첫 마운트에도 한 번 돈다.
    camera.position.set(...DEFAULT_CAMERA_POSITION);
    controls.current?.target.set(...DEFAULT_TARGET);
    controls.current?.update();
  }, [resetSignal, camera]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      enablePan={limits.enablePan}
      minPolarAngle={limits.minPolar}
      maxPolarAngle={limits.maxPolar}
      minAzimuthAngle={limits.minAzimuth}
      maxAzimuthAngle={limits.maxAzimuth}
      minDistance={limits.minDistance}
      maxDistance={limits.maxDistance}
    />
  );
}
```

- [ ] **Step 3: CameraModeToggle 작성**

`_components/CameraModeToggle.tsx`. 기존 `SegmentedControl`은 제네릭이라 그대로 쓴다. 밝은 배경 컴포넌트를 어두운 화면에 올리므로 컨테이너로 감싸 대비를 낮춘다.

```tsx
"use client";

import { SegmentedControl } from "@/components/SegmentedControl";
import { CAMERA_MODE_OPTIONS, type CameraMode } from "../_lib/camera";

export function CameraModeToggle({
  mode,
  onChange,
  onReset,
}: {
  mode: CameraMode;
  onChange: (m: CameraMode) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[210px] opacity-85">
        <SegmentedControl options={CAMERA_MODE_OPTIONS} value={mode} onChange={onChange} />
      </div>
      {/* Reset 은 C 에서만. 자유도가 높을 때만 길을 잃는다. */}
      {mode === "c" && (
        <button
          type="button"
          onClick={onReset}
          className="h-9 px-3 text-[13px] font-medium rounded-lg border border-slate-400/30 bg-slate-900/60 text-slate-200 backdrop-blur-sm cursor-pointer"
        >
          처음 위치로
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: World에 CameraRig 연결**

`_components/World.tsx`의 props와 Canvas 내용에 추가한다. 기존 `World` 시그니처에 두 개를 더한다.

```tsx
// props 타입에 추가
mode: CameraMode;
resetSignal: number;
```

`<Canvas>` 안, `<Starfield />` 바로 위에 넣는다:

```tsx
<CameraRig mode={mode} resetSignal={resetSignal} />
```

import 두 줄을 추가한다:

```tsx
import { CameraRig } from "./CameraRig";
import type { CameraMode } from "../_lib/camera";
```

- [ ] **Step 5: WorldShell에 모드 상태와 토글 배치**

`_components/WorldShell.tsx`:

```tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CameraModeToggle } from "./CameraModeToggle";
import type { CameraMode } from "../_lib/camera";

const World = dynamic(() => import("./World").then((m) => m.World), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">
      관계 지도를 여는 중
    </div>
  ),
});

export function WorldShell() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<CameraMode>("b");
  const [resetSignal, setResetSignal] = useState(0);

  return (
    <div className="relative w-full h-full">
      <World
        selectedId={selectedId}
        onSelect={setSelectedId}
        mode={mode}
        resetSignal={resetSignal}
      />

      {/* 스파이크 비교용 UI. 실제 제품 화면에는 없다. */}
      <div className="absolute top-[max(12px,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-10">
        <CameraModeToggle
          mode={mode}
          onChange={setMode}
          onReset={() => setResetSignal((n) => n + 1)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음

`three-stdlib` 타입 import가 실패하면 `@react-three/drei`가 재수출하는 타입을 쓰거나 `useRef<any>` 대신 `ComponentRef<typeof OrbitControls>`로 바꿀 것. drei 10.x는 `three-stdlib`을 의존성으로 갖는다.

- [ ] **Step 7: 브라우저 확인 — 세 모드 비교가 이 태스크의 목적**

Run: `npm run dev`, **DevTools 375px, 터치 에뮬레이션 켜기**

세 모드를 각각 드래그·핀치해본다.

- 지면 아래로 내려가거나 화면이 뒤집히는가 → **하나라도 그러면 실패다.** `minPolar`/`maxPolar`를 조인다.
- 모드를 바꿀 때 시점이 튀는가 → 기본 뷰가 세 범위 안에 있는지 확인한다.
- 어느 모드가 가장 자연스러운가 → **기록해둔다. 이게 스파이크의 산출물 중 하나다.**

- [ ] **Step 8: 커밋**

```bash
git add src/app/lab/relationship-world
git commit -m "feat(lab): 카메라 자유도 A/B/C 를 토글로 비교할 수 있게 한다"
```

---

## Task 7: 선택 인터랙션과 바텀시트

**Files:**
- Create: `src/app/lab/relationship-world/_components/PersonSheet.tsx`
- Modify: `src/app/lab/relationship-world/_components/WorldShell.tsx`

**Interfaces:**
- Consumes: `MockPerson`, `ROLE_LABELS`, `FEATURE_LABELS` (Task 2), `Badge` from `@/components/Badge`
- Produces: `<PersonSheet person={MockPerson | null} onClose={() => void} />`

- [ ] **Step 1: PersonSheet 작성**

`_components/PersonSheet.tsx`. 높이를 `40vh`로 묶어 3D가 위쪽 60%를 유지한다. 데스크톱은 우측 패널.

`feature: "none"`이면 **배지 자리에 아무것도 넣지 않는다.** "중립"이라는 표현을 만들지 않는 것이 브리프 8절의 요구다.

```tsx
"use client";

import { Badge } from "@/components/Badge";
import { FEATURE_LABELS, ROLE_LABELS, type RelationRole } from "../_data/roles";
import type { MockPerson } from "../_data/mock-people";

// 六合 과 沖 의 설명은 길이와 무게를 맞춘다. 한쪽만 따뜻하게 쓰면
// 그 순간 좋은 관계 / 나쁜 관계가 된다.
const FEATURE_NOTE: Record<"yukhap" | "chung", string> = {
  yukhap: "둘 사이의 흐름이 끊기지 않고 이어집니다.",
  chung: "둘 사이의 흐름이 팽팽하게 맞물립니다.",
};

const ROLE_NOTE: Record<RelationRole, string> = {
  fill: "곁에 있으면 비어 있던 자리가 채워지는 사람입니다.",
  beside: "같은 방향을 보고 나란히 걷는 사람입니다.",
  express: "이 사람 앞에서는 말이 쉽게 나옵니다.",
  move: "가만히 있던 마음을 움직이게 하는 사람입니다.",
  refine: "거친 부분을 깎아 모양을 잡아주는 사람입니다.",
};

export function PersonSheet({
  person,
  onClose,
}: {
  person: MockPerson | null;
  onClose: () => void;
}) {
  const open = person !== null;

  return (
    <div
      aria-hidden={!open}
      className={`
        fixed z-20 bg-white text-slate-900 shadow-elevated
        transition-transform duration-300 ease-out
        inset-x-0 bottom-0 h-[40vh] rounded-t-2xl
        md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[380px] md:rounded-t-none md:rounded-l-2xl
        ${open ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"}
      `}
    >
      {person && (
        <div className="h-full flex flex-col px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
          {/* 모바일 손잡이 */}
          <div className="md:hidden mx-auto w-9 h-1 rounded-full bg-slate-200 mb-4" />

          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-[-0.02em] m-0">{person.name}</h2>
              <p className="text-[15px] text-slate-500 mt-1 m-0">{person.sceneName}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="shrink-0 w-9 h-9 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-50 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-4">
            <Badge>{ROLE_LABELS[person.role]}</Badge>
            {/* feature 가 없으면 아무 배지도 붙지 않는다 */}
            {person.feature !== "none" && <Badge>{FEATURE_LABELS[person.feature]}</Badge>}
          </div>

          <p className="text-[15px] leading-relaxed text-slate-700 mt-4 m-0">
            {ROLE_NOTE[person.role]}
          </p>

          {person.feature !== "none" && (
            <p className="text-[15px] leading-relaxed text-slate-700 mt-2 m-0">
              {FEATURE_NOTE[person.feature]}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: WorldShell에 시트 연결**

`_components/WorldShell.tsx`에 import와 렌더를 더한다.

```tsx
import { FRIENDS } from "../_data/mock-people";
import { PersonSheet } from "./PersonSheet";
```

컴포넌트 본문에 파생값을 더한다:

```tsx
const selected = FRIENDS.find((p) => p.id === selectedId) ?? null;
```

`<CameraModeToggle>` 블록 다음에 넣는다:

```tsx
<PersonSheet person={selected} onClose={() => setSelectedId(null)} />
```

- [ ] **Step 3: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 4: 브라우저 확인 — 시트와 3D가 싸우는지가 관문**

Run: `npm run dev`, **DevTools 375px**

Expected: 사람을 누르면 아래에서 흰 시트가 40vh만큼 올라오고, 위쪽 60%에서 3D가 계속 보인다. 배경을 누르면 닫힌다.

여기서 반드시 확인할 것:

- 시트가 선택한 사람을 가리는가 → 가린다. **Task 8의 카메라 focus가 이걸 푼다.** 지금은 기록만 한다.
- 어두운 우주 위 흰 시트의 대비가 너무 센가 → 세면 시트 상단에 그라디언트 페이드를 더한다.
- 데스크톱(`md` 이상)에서 우측 패널로 바뀌는가.

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world/_components
git commit -m "feat(lab): 사람 선택 시 바텀시트와 데스크톱 사이드패널을 연다"
```

---

## Task 8: 선택 시 카메라 focus

**Files:**
- Modify: `src/app/lab/relationship-world/_components/CameraRig.tsx`
- Modify: `src/app/lab/relationship-world/_components/World.tsx`

**Interfaces:**
- Consumes: `placePeople`, `SELF_POSITION` (Task 2), `CameraRig` (Task 6)
- Produces: `<CameraRig mode resetSignal focusOn={Vec3 | null} />`

- [ ] **Step 1: CameraRig에 focus 보간 추가**

`_components/CameraRig.tsx`를 통째로 교체한다. **현재 보는 각도를 유지한 채** 거리와 타깃만 옮긴다 — 각도까지 바꾸면 사용자가 방금 만든 시점을 빼앗겨 귀찮아진다.

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  CAMERA_LIMITS,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_TARGET,
  type CameraMode,
} from "../_lib/camera";
import { SELF_POSITION, type Vec3 } from "../_lib/layout";

const FOCUS_DISTANCE = 8.5;
// 타깃을 아래로 내리면 피사체가 화면 위쪽에 잡힌다 — 40vh 시트에 가리지 않게.
const FRAME_LIFT = 1.15;

export function CameraRig({
  mode,
  resetSignal,
  focusOn,
}: {
  mode: CameraMode;
  resetSignal: number;
  focusOn: Vec3 | null;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const limits = CAMERA_LIMITS[mode];

  const desiredTarget = useMemo(() => {
    if (!focusOn) return new THREE.Vector3(...DEFAULT_TARGET);
    const self = new THREE.Vector3(...SELF_POSITION);
    const mid = self.clone().add(new THREE.Vector3(...focusOn)).multiplyScalar(0.5);
    return mid.setY(mid.y - FRAME_LIFT);
  }, [focusOn]);

  useEffect(() => {
    camera.position.set(...DEFAULT_CAMERA_POSITION);
    controls.current?.target.set(...DEFAULT_TARGET);
    controls.current?.update();
  }, [resetSignal, camera]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;

    const k = Math.min(1, delta * 2.6);

    // 보던 각도는 그대로 두고 타깃과 거리만 옮긴다.
    const dir = camera.position.clone().sub(c.target).normalize();
    const distance = focusOn
      ? THREE.MathUtils.clamp(FOCUS_DISTANCE, limits.minDistance, limits.maxDistance)
      : camera.position.distanceTo(c.target);

    const desiredPos = desiredTarget.clone().add(dir.multiplyScalar(distance));

    if (c.target.distanceTo(desiredTarget) > 0.01) {
      c.target.lerp(desiredTarget, k);
      camera.position.lerp(desiredPos, k);
      c.update();
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      enablePan={limits.enablePan}
      minPolarAngle={limits.minPolar}
      maxPolarAngle={limits.maxPolar}
      minAzimuthAngle={limits.minAzimuth}
      maxAzimuthAngle={limits.maxAzimuth}
      minDistance={limits.minDistance}
      maxDistance={limits.maxDistance}
    />
  );
}
```

- [ ] **Step 2: World에서 focusOn 전달**

`_components/World.tsx`의 `<CameraRig ...>` 호출을 바꾼다. `placed`와 `selected`는 이미 있다.

```tsx
<CameraRig
  mode={mode}
  resetSignal={resetSignal}
  focusOn={selected ? placed.get(selected.id)! : null}
/>
```

- [ ] **Step 3: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 4: 브라우저 확인**

Run: `npm run dev`, **DevTools 375px**

Expected: 사람을 누르면 카메라가 부드럽게 다가가며 그 사람이 화면 위쪽 1/3에 잡히고, 시트에 가리지 않는다. 배경을 누르면 기본 타깃으로 되돌아온다.

- 이동이 멀미 나는가 → 보간 계수 `2.6`을 낮춘다.
- 선택한 사람이 여전히 시트에 가리는가 → `FRAME_LIFT`를 키운다.
- A 모드에서 focus가 제한에 걸려 어색한가 → `FOCUS_DISTANCE` clamp가 동작하는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world/_components
git commit -m "feat(lab): 사람을 선택하면 카메라가 화면 위쪽에 맞춰 다가간다"
```

---

## Task 9: 六合 / 沖 관계 효과

**Files:**
- Create: `src/app/lab/relationship-world/_components/RelationThread.tsx`
- Modify: `src/app/lab/relationship-world/_components/World.tsx`

**Interfaces:**
- Consumes: `SELF_POSITION`, `Vec3` (Task 2), `Feature` (Task 2)
- Produces: `<RelationThread to={Vec3} feature={Feature} />`

- [ ] **Step 1: RelationThread 작성**

`_components/RelationThread.tsx`.

**핵심 제약:** 둘은 `THREAD_COLOR` 하나를 공유하고 투명도도 같다. 다른 것은 오직 움직임이다. 六合은 연속적으로 흐르고, 沖은 엇갈리며 미세하게 떤다. 색이나 밝기를 다르게 만들면 그 순간 좋고 나쁨이 된다.

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Feature } from "../_data/roles";
import { SELF_POSITION, type Vec3 } from "../_lib/layout";

// 六合 과 沖 이 공유하는 단 하나의 색. 절대 분기시키지 않는다.
const THREAD_COLOR = "#94a3b8";
const THREAD_OPACITY = 0.55;
const SEGMENTS = 64;
const PARTICLES = 16;

function buildCurve(to: Vec3, bow: number) {
  const a = new THREE.Vector3(...SELF_POSITION);
  const b = new THREE.Vector3(...to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  // 직선이면 그래프의 엣지로 읽힌다. 살짝 휘어야 흐름이 된다.
  const normal = new THREE.Vector3(0, 1, 0).cross(b.clone().sub(a)).normalize();
  mid.add(normal.multiplyScalar(bow)).add(new THREE.Vector3(0, bow * 0.35, 0));
  return new THREE.QuadraticBezierCurve3(a, mid, b);
}

function Strand({ curve, phase }: { curve: THREE.QuadraticBezierCurve3; phase: number }) {
  const base = useMemo(() => curve.getPoints(SEGMENTS), [curve]);

  // THREE.Line 은 R3F 에서 소문자 <line> 로 매핑되는데 JSX 내장 SVG line 과
  // 이름이 겹친다. 객체를 직접 만들어 <primitive> 로 넣으면 그 충돌이 없다.
  const object = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(base);
    const material = new THREE.LineBasicMaterial({
      color: THREAD_COLOR,
      transparent: true,
      opacity: THREAD_OPACITY,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, [base]);

  useEffect(() => {
    // <primitive> 는 자동 해제되지 않는다. 선택을 바꿀 때마다 새 객체가 생기므로 직접 버린다.
    return () => {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    };
  }, [object]);

  useFrame((state) => {
    if (phase === 0) return;
    // 沖 전용: 가닥이 팽팽하게 떤다. 진폭은 작게 — 크면 고장으로 보인다.
    const t = state.clock.elapsedTime;
    const attr = object.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i <= SEGMENTS; i++) {
      const p = base[i];
      const w = Math.sin((i / SEGMENTS) * Math.PI); // 양 끝은 고정
      const j = Math.sin(t * 9 + i * 0.55 + phase) * 0.045 * w;
      attr.setXYZ(i, p.x + j, p.y + j * 0.6, p.z - j);
    }
    attr.needsUpdate = true;
  });

  return <primitive object={object} />;
}

function FlowParticles({ curve }: { curve: THREE.QuadraticBezierCurve3 }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => new Float32Array(PARTICLES * 3), []);

  useFrame((state) => {
    if (!ref.current) return;
    // 六合 전용: 입자가 곡선을 따라 느리고 끊김 없이 흐른다.
    const t = state.clock.elapsedTime * 0.14;
    const attr = ref.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < PARTICLES; i++) {
      const u = (t + i / PARTICLES) % 1;
      const p = curve.getPoint(u);
      attr.setXYZ(i, p.x, p.y, p.z);
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.14}
        color={THREAD_COLOR}
        transparent
        opacity={THREAD_OPACITY}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function RelationThread({ to, feature }: { to: Vec3; feature: Feature }) {
  const single = useMemo(() => buildCurve(to, 0.9), [to]);
  // 沖 은 두 가닥이 서로 반대로 휘어 교차한다.
  const crossA = useMemo(() => buildCurve(to, 1.15), [to]);
  const crossB = useMemo(() => buildCurve(to, -1.15), [to]);

  if (feature === "chung") {
    return (
      <group>
        <Strand curve={crossA} phase={0.4} />
        <Strand curve={crossB} phase={3.1} />
      </group>
    );
  }

  if (feature === "yukhap") {
    return (
      <group>
        <Strand curve={single} phase={0} />
        <FlowParticles curve={single} />
      </group>
    );
  }

  // feature 없음. 조용한 선 하나. 배지도 라벨도 붙지 않는다.
  return <Strand curve={single} phase={0} />;
}
```

- [ ] **Step 2: World에서 선택된 사람에게만 연결**

`_components/World.tsx`에 import를 더한다:

```tsx
import { RelationThread } from "./RelationThread";
```

`{FRIENDS.map(...)}` 마커 블록 **다음에** 넣는다. 20개를 전부 그리면 실타래가 되므로 선택된 한 명만 그린다.

```tsx
{selected && (
  <RelationThread to={placed.get(selected.id)!} feature={selected.feature} />
)}
```

- [ ] **Step 3: 타입체크**

Run: `npm run typecheck`
Expected: 에러 없음

`<primitive object={...} />`에서 타입 에러가 나면 `object` prop 하나만 넘기고 있는지 확인한다. `<primitive>`에 children이나 다른 prop을 붙이면 R3F가 거부한다.

- [ ] **Step 4: 전체 검증**

Run: `npm run typecheck`
Run: `npm test`
Run: `npm run lint`
Run: `npm run build`
Expected: 전부 통과

- [ ] **Step 5: 브라우저 확인 — 이 스파이크의 최종 관문**

Run: `npm run dev`, **DevTools 375px**

六合인 사람(지현·은채·시우·지호·다인)과 沖인 사람(서연·선우·채원·우진)을 번갈아 눌러본다.

- **둘이 좋은 관계 / 나쁜 관계로 보이는가 → 보이면 실패다.** 색과 투명도가 정말 같은지 코드로 확인한다.
- 六合의 흐름이 보이는가. 沖의 떨림이 고장처럼 보이지 않는가.
- feature 없는 사람(민수 등)에게 "중립" 같은 표현이 어디에도 없는가.

- [ ] **Step 6: 커밋**

```bash
git add src/app/lab/relationship-world/_components
git commit -m "feat(lab): 六合·沖 을 색이 아닌 움직임의 질로만 구분해 표현한다"
```

---

## 마무리: 판단

구현이 끝나면 **실기기 375px**에서 스펙 11절의 항목을 확인하고 결과를 기록한다. 이 스파이크의 산출물은 코드가 아니라 **판단**이다.

- 친구 20명이 구분되는가 / 이름을 읽을 수 있는가 / 터치하기 쉬운가
- 선택했을 때 무엇이 일어났는지 바로 이해되는가
- 바텀시트와 3D가 서로 싸우지 않는가
- 카메라 A / B / C 중 어느 것인가
- 차트의 3D 버전처럼 보이지 않는가

그리고 가장 중요한 하나.

> **"이 화면을 처음 봤을 때 2D 관계 차트보다 확실히 더 매력적이고 기억에 남는가?"**

아니라면 `/lab/relationship-world` 디렉터리와 3D 의존성을 통째로 지우고 2D/SVG로 돌아간다. **그것도 정상적인 결말이다.**
