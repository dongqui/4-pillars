# 관계 지도 라이트 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관계 지도(/map/[share])를 라이트 테마·시안 팔레트·우측(모바일 하단) 사이드 패널 구조로 개편하고, PersonSheet 를 목록 인라인 설명으로 흡수하고, 추가 폼을 모달로 바꾼다.

**Architecture:** 색 시스템(`role-colors.ts`)에 시안 5색과 텍스트용 어두운 변형(`roleTextColor`)·배경 상수(`MAP_BACKGROUND`)를 세우고, 연결선은 검정 곱 → 배경 lerp, 노드 글로우는 Additive → Normal 블렌딩으로 라이트화한다. MapShell 을 flex 레이아웃(지도 + 사이드 패널)으로 재구성하고 PeopleList 를 그룹 목록+인라인 궁합 단락으로 다시 쓴다.

**Tech Stack:** Next.js(App Router), TypeScript, Tailwind, react-three-fiber/drei, vitest.

**스펙:** `docs/superpowers/specs/2026-08-30-map-light-redesign-design.md`

## Global Constraints

- 시안 그래픽 5색: fill `#10B981` · beside `#F59E0B` · express `#8B5CF6` · move `#DB2760` · refine `#0EA5E9`. 그래픽(노드·선·점·아바타)은 이 hex(±1/255), 색 텍스트는 `roleTextColor`(배경 `#F8FAFC` 대비 4.5:1 이상).
- 배경 상수는 `MAP_BACKGROUND = "#F8FAFC"` 한 곳(`_data/role-colors.ts`)만 — World·connections 가 import 한다.
- 배치(layout)·카메라·선 강조 상수(0.14/0.55/0.07)·광량 불변식(node-visual)은 변경하지 않는다.
- relationNote 카피·데이터 모듈 변경 없음. API·DB 변경 없음.
- 시안의 3D 영역은 placeholder — 색만 옮기고 글로우 이미지·도트 그리드·회색 점선은 구현하지 않는다.
- 테스트 `npm test`, 타입 `npm run typecheck`. 커밋 메시지 끝에 빈 줄 + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- 계획의 코드 블록은 최종본이다 — 한국어 주석 포함 그대로 옮긴다.

---

### Task 1: 색 시스템 — 시안 팔레트 + roleTextColor

**Files:**
- Modify: `src/app/map/_data/role-colors.ts`
- Test: `src/app/map/_data/role-colors.test.ts` (개정)

**Interfaces:**
- Consumes: `hslToHex`, `Hsl` (`./hsl`) — 기존.
- Produces: `MAP_BACKGROUND: "#F8FAFC"` · `roleTextColor(role: RelationRole): string` · 갱신된 `ROLE_HUE`. 기존 `roleColor`/`nodeColor`/`roleHsl`/`STATE_SHIFT` 시그니처 유지.

- [ ] **Step 1: 테스트를 먼저 개정**

`src/app/map/_data/role-colors.test.ts` 전체를 다음으로 교체:

```ts
import { describe, expect, it } from "vitest";
import { ROLE_ORDER, type Feature } from "./roles";
import {
  MAP_BACKGROUND,
  ROLE_HUE,
  nodeColor,
  roleColor,
  roleHsl,
  roleTextColor,
} from "./role-colors";

const FEATURES: Feature[] = ["none", "yukhap", "chung"];

function toRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
// WCAG 상대 휘도·대비. role-colors.ts 의 구현을 import 하지 않고 독립적으로
// 다시 적는다 — 같은 구현끼리 비교하면 변환이 틀려도 통과한다.
function relativeLuminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// 시안(Saju Relationship Map.dc.html) 확정 팔레트. ROLE_HUE 는 이 hex 의 HSL
// 변환값이라, 표가 바뀌면 여기서 잡힌다.
const DESIGN_HEX: Record<(typeof ROLE_ORDER)[number], string> = {
  fill: "#10b981",
  beside: "#f59e0b",
  express: "#8b5cf6",
  move: "#db2760",
  refine: "#0ea5e9",
};

describe("Role hue", () => {
  it("5개 역할 전부에 색이 있다", () => {
    for (const role of ROLE_ORDER) expect(ROLE_HUE[role]).toBeDefined();
  });

  it("그래픽 색이 시안 hex 를 채널당 ±2/255 안에서 복원한다", () => {
    for (const role of ROLE_ORDER) {
      const got = toRgb(roleColor(role));
      const want = toRgb(DESIGN_HEX[role]);
      got.forEach((v, i) => {
        expect(Math.abs(v - want[i]), `${role} 채널 ${i}`).toBeLessThanOrEqual(2);
      });
    }
  });

  it("hue 간격이 38° 이상이다 — 두 역할이 같은 색으로 읽히면 실패다", () => {
    // 예전 하한은 40° 였다. 시안 팔레트의 초록(160.1°)·하늘(198.6°)이 38.5° 라
    // 시안 hex 유지를 우선해 38 로 내렸다 — 이 두 색은 명도(39 vs 48)로도 갈린다.
    const hues = ROLE_ORDER.map((r) => ROLE_HUE[r].h).sort((a, b) => a - b);
    for (let i = 0; i < hues.length; i++) {
      const gap = i === hues.length - 1 ? 360 - hues[i] + hues[0] : hues[i + 1] - hues[i];
      expect(gap, `${hues[i]}° 다음 간격`).toBeGreaterThanOrEqual(38);
    }
  });

  it("5색이 서로 다르다", () => {
    const seen = new Set(ROLE_ORDER.map(roleColor));
    expect(seen.size).toBe(ROLE_ORDER.length);
  });
});

describe("roleTextColor", () => {
  it("라이트 배경 대비 4.5 이상이다 — 색 텍스트의 가독 하한", () => {
    // 그래픽 색에는 대비 하한이 없다(시안 확정 팔레트). 텍스트가 그 색 그대로면
    // #F59E0B 은 1.9:1 이라 읽을 수 없어, 텍스트만 어두운 변형을 쓴다.
    for (const role of ROLE_ORDER) {
      expect(contrast(roleTextColor(role), MAP_BACKGROUND), role).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("5개 텍스트 색이 서로 다르다", () => {
    const seen = new Set(ROLE_ORDER.map(roleTextColor));
    expect(seen.size).toBe(ROLE_ORDER.length);
  });
});

describe("상태 변조", () => {
  it("상태가 hue 를 바꾸지 않는다 — 같은 역할은 같은 색상 가족이다", () => {
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        expect(roleHsl(role, feature).h, `${role}/${feature}`).toBe(ROLE_HUE[role].h);
      }
    }
  });

  it("세 상태가 서로 다른 색을 낸다 — 구분되지 않으면 상태가 없는 것과 같다", () => {
    for (const role of ROLE_ORDER) {
      const seen = new Set(FEATURES.map((f) => nodeColor(role, f)));
      expect(seen.size, role).toBe(3);
    }
  });

  it("채도·명도가 0..100 안에 머문다", () => {
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        const { s, l } = roleHsl(role, feature);
        expect(s, `${role}/${feature} s`).toBeGreaterThanOrEqual(0);
        expect(s, `${role}/${feature} s`).toBeLessThanOrEqual(100);
        expect(l, `${role}/${feature} l`).toBeGreaterThanOrEqual(0);
        expect(l, `${role}/${feature} l`).toBeLessThanOrEqual(100);
      }
    }
  });

  it("六合 은 밝아지고 沖 은 채도가 오르거나 명도가 오른다", () => {
    // 沖 의 s+12 는 beside(92.1)·refine(88.7) 에서 100 클램프에 걸린다 — 그
    // 경우에도 l+4 가 있어 세 상태는 구분된다(위 테스트). 여기서는 방향만 잡는다.
    for (const role of ROLE_ORDER) {
      expect(roleHsl(role, "yukhap").l, role).toBeGreaterThan(ROLE_HUE[role].l);
      const chung = roleHsl(role, "chung");
      expect(
        chung.s > ROLE_HUE[role].s || chung.l > ROLE_HUE[role].l,
        `${role} 沖 이 기본보다 어느 축으로도 오르지 않았다`,
      ).toBe(true);
    }
  });

  it("기본은 Role 색 그대로다", () => {
    for (const role of ROLE_ORDER) {
      expect(nodeColor(role, "none")).toBe(roleColor(role));
    }
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/map/_data/role-colors.test.ts`
Expected: FAIL — `MAP_BACKGROUND`·`roleTextColor` 가 없고, 그래픽 hex 검사도 옛 팔레트라 진다.

- [ ] **Step 3: role-colors.ts 개정**

`ROLE_HUE` 표와 그 위 독스트링을 다음으로 교체하고, `MAP_BACKGROUND`·`roleTextColor` 를 추가한다. `STATE_SHIFT`·`clamp`·`roleHsl`·`roleColor`·`nodeColor` 는 그대로 두되 `STATE_SHIFT` 위 주석에서 "채도 상한은 沖 이 정한다" 문단을 아래 새 문단으로 바꾼다.

```ts
/**
 * 지도의 배경색. World 의 <color>·<fog>, connections.ts 의 배경 lerp,
 * roleTextColor 의 대비 계산이 전부 이 값을 본다 — 여기서 갈라지면 "배경
 * 쪽으로 물러난다"는 연산들이 서로 다른 배경을 향해 물러난다.
 */
export const MAP_BACKGROUND = "#F8FAFC";

/**
 * 노드 색은 그 사람의 사주가 아니라 **나와의 관계 Role** 이다.
 *
 * 이 방향은 직전 구현(색=사주)의 반대다. 그때는 색이 그룹에 대해 아무 정보도
 * 주지 못했고, 그룹을 알려주던 5개 Field 오브젝트는 그 앞 라운드에 삭제된
 * 뒤였다 — 사용자 입장에서 위치의 정보량이 0 이었다. 색을 Role 에 주는 것이
 * 그 공백을 메운다.
 *
 * 값은 라이트 리디자인 시안(Saju Relationship Map.dc.html)의 확정 팔레트를
 * HSL 로 옮긴 것이다. 소수점은 시안 hex 를 채널당 ±2/255 안에서 복원하기 위한
 * 값이라 임의로 반올림하지 말 것 — role-colors.test.ts 가 hex 복원을 잠근다.
 *
 * 다크 시절의 "배경 대비 4.5" 규칙은 이 표가 아니라 roleTextColor 가 진다:
 * 그래픽(노드·선·점·아바타)은 시안 hex 그대로, 색 텍스트만 어둡게 내린다.
 * hue 최소 간격은 38.5°(초록↔하늘)다 — 예전 하한 40° 를 38 로 내렸다. 시안
 * hex 유지가 우선이고, 이 두 색은 명도(39 vs 48)로도 갈린다.
 */
export const ROLE_HUE: Record<RelationRole, Hsl> = {
  fill: { h: 160.1, s: 84.1, l: 39.4 }, //    인성 · #10B981
  beside: { h: 37.7, s: 92.1, l: 50.2 }, //   비겁 · #F59E0B
  express: { h: 258.3, s: 89.6, l: 66.3 }, // 식상 · #8B5CF6
  move: { h: 341.0, s: 71.4, l: 50.6 }, //    재성 · #DB2760
  refine: { h: 198.6, s: 88.7, l: 48.4 }, //  관성 · #0EA5E9
};
```

`STATE_SHIFT` 주석의 교체 문단:

```ts
/**
 * 기본 / 六合 / 沖 의 채도·명도 변조. **hue 는 건드리지 않는다.**
 *
 * 六合 은 맑아지고(채도↓ 명도↑), 沖 은 또렷해진다(채도↑ 명도 살짝↑).
 * 어느 쪽도 "더 세다"가 되면 안 된다 — 밝기의 균형은 색이 아니라
 * node-visual.ts 의 광량 불변식이 잡는다.
 *
 * 시안 팔레트에서 沖 의 s+12 는 beside(92.1)·refine(88.7)에서 100 클램프에
 * 걸린다 — 다크 시절처럼 세 상태의 채도 간격이 대칭으로 남지는 않지만,
 * l+4 가 함께 걸려 세 상태의 구분 자체는 유지된다(role-colors.test.ts 의
 * "세 상태가 서로 다른 색").
 */
```

파일 끝에 추가:

```ts
/** WCAG 상대 휘도. roleTextColor 의 대비 탐색에 쓴다. */
function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrastOnBackground(hex: string): number {
  const a = relativeLuminance(hex);
  const b = relativeLuminance(MAP_BACKGROUND);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * 색 텍스트(목록의 구역명·별명 태그, 3D 구역 라벨)용 어두운 변형.
 *
 * hue·채도는 그대로 두고 명도만 1씩 내려, MAP_BACKGROUND 대비 4.5:1 을 처음
 * 넘는 값을 쓴다. 그래픽 색과 갈라 두는 이유: #F59E0B 같은 시안 색은 흰 배경
 * 텍스트로는 1.9:1 이라 읽을 수 없는데, 노드·점까지 어둡게 내리면 시안
 * 팔레트가 아니게 된다. 5개뿐이라 모듈 로드 때 전부 만들어 둔다.
 */
const TEXT_COLOR = Object.fromEntries(
  (Object.keys(ROLE_HUE) as RelationRole[]).map((role) => {
    const base = ROLE_HUE[role];
    let l = base.l;
    let hex = hslToHex({ h: base.h, s: base.s, l });
    while (l > 1 && contrastOnBackground(hex) < 4.5) {
      l -= 1;
      hex = hslToHex({ h: base.h, s: base.s, l });
    }
    return [role, hex];
  }),
) as Record<RelationRole, string>;

export function roleTextColor(role: RelationRole): string {
  return TEXT_COLOR[role];
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/app/map/_data/role-colors.test.ts` 그리고 `npm run typecheck`
Expected: 색 테스트 PASS. ⚠️ 이 시점에 `connections.test.ts` 등 다른 테스트가 옛 색 전제로 질 수 있다 — Task 2 가 고치므로 여기서는 이 파일과 typecheck 만 본다.

- [ ] **Step 5: 커밋**

```bash
git add src/app/map/_data/role-colors.ts src/app/map/_data/role-colors.test.ts
git commit -m "feat(map): 시안 라이트 팔레트 — 그래픽/텍스트 색 분리와 roleTextColor

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 연결선 라이트 — 검정 곱을 배경 lerp 로

**Files:**
- Modify: `src/app/map/_lib/connections.ts`
- Test: `src/app/map/_lib/connections.test.ts` (해당 테스트 교체)

**Interfaces:**
- Consumes: `MAP_BACKGROUND`, `roleColor` (Task 1).
- Produces: `connectionColors` 동일 시그니처, 나 쪽 끝 = linear 공간에서 배경으로 lerp 한 값. `CONNECTION_SELF_DIM` 의미 변경: "나 쪽 끝에 남는 그 사람 색의 비율(나머지는 배경)".

- [ ] **Step 1: 테스트 교체**

`connections.test.ts` 의 `describe("connectionColors")` 안 `"나 쪽 끝은 linear 값을 같은 비율로 죽인다 — 중심에서 20개가 뭉치지 않게"` 테스트를 다음으로 교체하고, 파일 상단 import 에 `MAP_BACKGROUND` 를 추가한다 (`import { MAP_BACKGROUND, ROLE_HUE, roleColor } from "../_data/role-colors";`):

```ts
  it("나 쪽 끝은 linear 공간에서 배경 쪽으로 물러난다 — 중심에서 20개가 뭉치지 않게", () => {
    // 다크 시절에는 검정 곱이었다. 라이트 배경에서 검정 곱은 중심을 오히려
    // 진하게 만들므로(어두울수록 대비↑), 같은 의도 — 중심이 탁해지지 않게 —
    // 를 배경으로의 lerp 로 옮겼다. lerp 는 광량 연산이라 linear 공간에서
    // 해야 한다. sRGB 에서 먼저 섞으면 감마 곡선 때문에 훨씬 밝게 나온다.
    const bg = hexToLinear(MAP_BACKGROUND);
    const data = connectionColors(roles);
    roles.forEach((role, i) => {
      const [r, g, b] = hexToLinear(roleColor(role));
      expect(data[i * 6]).toBeCloseTo(bg[0] + (r - bg[0]) * CONNECTION_SELF_DIM, 5);
      expect(data[i * 6 + 1]).toBeCloseTo(bg[1] + (g - bg[1]) * CONNECTION_SELF_DIM, 5);
      expect(data[i * 6 + 2]).toBeCloseTo(bg[2] + (b - bg[2]) * CONNECTION_SELF_DIM, 5);
    });
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/map/_lib/connections.test.ts`
Expected: FAIL — 구현은 아직 검정 곱이다.

- [ ] **Step 3: connections.ts 수정**

1. import 추가: `import { MAP_BACKGROUND, roleColor } from "../_data/role-colors";` (roleColor 는 기존 import — MAP_BACKGROUND 만 추가).
2. `CONNECTION_SELF_DIM` 독스트링을 다음으로 교체 (값 0.25 유지):

```ts
/**
 * 나 쪽 끝에 남는 **그 사람 색의 비율**. 나머지(0.75)는 배경색이다.
 *
 * 20개 선이 원점 한 점으로 모이므로, 양 끝을 같은 채도로 칠하면 중심이
 * 스무 가지 색으로 탁해진다. 사람 쪽에서 자기 Role 색이 살고 나 쪽으로
 * 갈수록 배경에 잠기면 다섯 갈래가 뻗어 나가는 구조가 그대로 읽힌다.
 *
 * 다크 시절에는 검정 곱(× 0.25)이었다. 라이트 배경에서 검정 곱은 중심을
 * 오히려 진하게 만들므로, 같은 의도를 **배경으로의 lerp** 로 옮겼다.
 *
 * **모든 역할에 같은 비율로 건다.** 역할마다 다르면 그 순간 어떤 관계가
 * 더 진하게 이어져 있다는 뜻이 된다.
 *
 * 이 lerp 는 sRGB→linear 변환 **이후의** linear 값끼리 섞는다 — 섞기는 빛의
 * 물리량 연산이라 linear 공간에서 해야 한다. sRGB 값끼리 먼저 섞으면 실제
 * 표시 밝기가 의도보다 밝아진다(감마 곡선). 순서를 바꾸지 말 것.
 */
export const CONNECTION_SELF_DIM = 0.25;
```

3. `connectionColors` 를 다음으로 교체 (독스트링의 마지막 문단 유지, 셋째 문단만 lerp 언급으로 갱신):

```ts
export function connectionColors(roles: readonly RelationRole[]): Float32Array {
  const out = new Float32Array(roles.length * 6);

  // 배경의 linear 값. 모든 선의 나 쪽 끝이 이쪽으로 물러난다.
  const bg = [1, 3, 5].map((i) =>
    srgbToLinear(parseInt(MAP_BACKGROUND.slice(i, i + 2), 16) / 255),
  ) as [number, number, number];

  roles.forEach((role, i) => {
    const hex = roleColor(role);
    const r = srgbToLinear(parseInt(hex.slice(1, 3), 16) / 255);
    const g = srgbToLinear(parseInt(hex.slice(3, 5), 16) / 255);
    const b = srgbToLinear(parseInt(hex.slice(5, 7), 16) / 255);

    out[i * 6] = bg[0] + (r - bg[0]) * CONNECTION_SELF_DIM;
    out[i * 6 + 1] = bg[1] + (g - bg[1]) * CONNECTION_SELF_DIM;
    out[i * 6 + 2] = bg[2] + (b - bg[2]) * CONNECTION_SELF_DIM;
    out[i * 6 + 3] = r;
    out[i * 6 + 4] = g;
    out[i * 6 + 5] = b;
  });

  return out;
}
```

4. 파일 머리 주석(1~33행)에서 "sRGB→linear 변환을 지우지 말 것" 문단은 유지하고, RelationThread 역사 문단도 유지한다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/app/map/_lib/connections.test.ts` 그리고 `npm test`
Expected: 둘 다 PASS (Task 1 에서 옛 색 전제로 지던 테스트가 있었다면 여기서 함께 검산).

- [ ] **Step 5: 커밋**

```bash
git add src/app/map/_lib/connections.ts src/app/map/_lib/connections.test.ts
git commit -m "feat(map): 연결선 나 쪽 끝을 검정 곱에서 배경 lerp 로 — 라이트 배경 대응

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 3D 컴포넌트 라이트 — 배경·블렌딩·오브·명패·라벨

**Files:**
- Modify: `src/app/map/_components/World.tsx`
- Modify: `src/app/map/_components/PersonNode.tsx`
- Modify: `src/app/map/_components/SelfCore.tsx`
- Modify: `src/app/map/_components/PersonMarker.tsx`
- Modify: `src/app/map/_components/RegionLabels.tsx`

**Interfaces:**
- Consumes: `MAP_BACKGROUND`, `roleTextColor` (Task 1).
- Produces: `PersonNode` 에 optional prop `colorOverride?: string` 추가 (SelfCore 가 쓴다). 그 외 컴포넌트 시그니처 불변.

컴포넌트라 자동 테스트가 없다 — typecheck 와 기존 스위트로 잠그고, 시각 확인은 Task 6.

- [ ] **Step 1: World.tsx — 배경·안개**

import 추가: `import { MAP_BACKGROUND } from "../_data/role-colors";`

```tsx
      <color attach="background" args={[MAP_BACKGROUND]} />
```

fog 도 색만 교체 (거리 값·주석 유지):

```tsx
      <fog attach="fog" args={[MAP_BACKGROUND, 35.8, 104]} />
```

- [ ] **Step 2: PersonNode.tsx — 블렌딩 전환과 colorOverride**

1. props 에 `colorOverride?: string` 추가하고 색 계산을 교체:

```tsx
  /** 지정하면 Role/상태 색 대신 이 색을 쓴다. SelfCore(나 = 프라이머리 블루) 전용. */
  colorOverride?: string;
```

```tsx
  const color = useMemo(
    () => new THREE.Color(colorOverride ?? nodeColor(role, feature)),
    [colorOverride, role, feature],
  );
```

2. 두 `<spriteMaterial>` 의 `blending={THREE.AdditiveBlending}` 을 `blending={THREE.NormalBlending}` 으로 바꾸고, 첫 번째 spriteMaterial 위에 주석을 단다:

```tsx
        {/*
          NormalBlending 이다. Additive 는 다크 배경 전제다 — 밝은 배경 위에
          빛을 더하면 이미 흰 쪽으로 포화된 배경에서 halo 가 통째로 사라진다.
          알파 블렌딩이면 halo 가 배경 위에 색으로 얹혀 라이트에서도 보인다.
          광량 불변식(node-visual.ts)은 α×r² 계산이라 블렌딩 모드와 무관하다.
        */}
```

- [ ] **Step 3: SelfCore.tsx — 프라이머리 블루 오브**

독스트링의 "색은 비겁(beside)이다 …" 문단을 다음으로 교체하고, PersonNode 에 `colorOverride` 를 준다. "나" 라벨 색도 라이트로.

```tsx
 * 색은 프라이머리 블루(#2563EB)다. 예전에는 비겁 색이었다 — 나란히 서는
 * 관계의 원점이 나라는 논리였는데, 라이트 팔레트에서 비겁이 주황(#F59E0B)이
 * 되면서 나까지 주황이면 다섯 구역 중 하나의 사람으로 읽힌다. 시안은 나를
 * 구역 밖의 존재로 두고 프라이머리로 칠한다.
```

```tsx
      <PersonNode
        position={SELF_POSITION}
        role="beside"
        feature="none"
        selected={false}
        dimmed={false}
        nodeScale={SELF_NODE_SCALE}
        colorOverride="#2563EB"
      />
```

라벨 span 클래스: `text-slate-200/85` → `text-slate-500`:

```tsx
        <span className="block translate-y-[-48px] text-[13px] font-semibold tracking-[0.14em] text-slate-500 select-none">
          나
        </span>
```

- [ ] **Step 4: PersonMarker.tsx — 라이트 칩**

이름 칩 버튼의 상태별 클래스만 교체 (구조·티어 로직 불변):

```tsx
                ${
                  selected
                    ? "border-blue-600/60 bg-blue-50 text-blue-700 font-semibold"
                    : "border-slate-200 bg-white/90 text-slate-800 font-medium shadow-sm"
                }
```

- [ ] **Step 5: RegionLabels.tsx — 라이트 배지**

import 에 `roleTextColor` 추가 (`import { roleColor, roleTextColor } from "../_data/role-colors";`) 후 Badge 의 style 교체:

```tsx
        style={{
          borderColor: `${roleColor(role)}4d`,
          backgroundColor: "#ffffffe6",
          // 배지 글자는 그 구역의 텍스트 변형이다 — 그래픽 hex 그대로는 흰
          // 배경에서 읽히지 않는 색(주황 1.9:1)이 있다.
          color: roleTextColor(role),
        }}
```

- [ ] **Step 6: 확인과 커밋**

Run: `npm test` 그리고 `npm run typecheck`
Expected: PASS.

```bash
git add src/app/map/_components/World.tsx src/app/map/_components/PersonNode.tsx src/app/map/_components/SelfCore.tsx src/app/map/_components/PersonMarker.tsx src/app/map/_components/RegionLabels.tsx
git commit -m "feat(map): 3D 를 라이트로 — 배경·안개, halo 노멀 블렌딩, 블루 오브, 라이트 칩

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 레이아웃 대개편 — 사이드 패널·헤더·시트 삭제

**Files:**
- Modify: `src/app/map/_components/PeopleList.tsx` (전면 개정)
- Modify: `src/app/map/_components/MapShell.tsx` (레이아웃 재구성)
- Modify: `src/app/map/_components/MapHeader.tsx` (라이트·공유 항상 표시)
- Delete: `src/app/map/_components/PersonSheet.tsx`

**Interfaces:**
- Consumes: `relationNote` (`../_data/relation-notes`), `roleColor`/`roleTextColor`, `Element` (`@/lib/saju-core`).
- Produces: `PeopleList` 새 시그니처 — 기존 props + `centerElement: Element`. `MapHeader` 는 `isOwner` prop 삭제. MapShell 은 `[share]/page.tsx` 와의 시그니처 불변.

- [ ] **Step 1: PeopleList.tsx 전면 개정**

파일 전체를 다음으로 교체:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { Element } from "@/lib/saju-core";
import type { MapPerson } from "../_data/person";
import { relationNote } from "../_data/relation-notes";
import { roleColor, roleTextColor } from "../_data/role-colors";
import { DISPLAY_TITLES, ROLE_ORDER, ROLE_REGION_NAME } from "../_data/roles";

/**
 * 사이드 패널의 사람 목록. 데스크톱은 우측 400px, 모바일은 하단 판이다 —
 * 그 배치는 MapShell 이 잡고, 이 컴포넌트는 패널 안쪽(헤더 행 + 그룹 목록)만
 * 그린다.
 *
 * 예전에는 상세 시트(PersonSheet)가 따로 있어 목록은 이름만 보여줬다. 시안이
 * 설명을 행 안으로 넣으면서 시트는 사라졌다 — 궁합 단락(relationNote)이 이제
 * 여기서 렌더된다. 그래서 centerElement(지도 주인의 일간 오행)를 받는다.
 *
 * 정렬은 구역 순서(ROLE_ORDER)다. 케미 점수 같은 순위는 두지 않는다 —
 * 순위를 매기는 순간 목록이 관계의 좋고 나쁨을 말하기 시작하고, 그건 이
 * 설계가 3D 쪽에서 내내 피해온 것이다. 빈 구역도 헤더는 그린다(시안) —
 * 다섯 구역이라는 구조 자체가 정보다.
 */
export function PeopleList({
  people,
  centerElement,
  open,
  onToggle,
  selectedId,
  onSelect,
  isOwner,
  onDelete,
}: {
  people: readonly MapPerson[];
  /** 지도 주인의 일간 오행 — 궁합 단락의 오행 다리 문장이 쓴다. */
  centerElement: Element;
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

  // 3D 에서 고른 사람이 목록 밖에 있으면 찾을 수 없다 — 그 행으로 스크롤한다.
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  useEffect(() => {
    if (selectedId === null) return;
    rowRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="relative shrink-0 flex items-center justify-between gap-3 px-5 pt-[17px] pb-[13px] cursor-pointer bg-white border-0 border-b border-slate-100 text-left"
      >
        {/* 모바일 손잡이 */}
        <span className="md:hidden absolute left-1/2 top-1.5 -translate-x-1/2 w-9 h-1 rounded-full bg-slate-200" />
        <span className="text-[14.5px] font-bold tracking-[-0.02em] text-slate-900">
          전체 <span className="text-blue-600">{people.length}</span>명
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-[12.5px] font-semibold text-slate-400">
            {open ? "접기" : "펼치기"}
          </span>
          <span
            aria-hidden
            className={`grid place-items-center w-[22px] h-[22px] rounded-full bg-slate-100 text-slate-500 text-[11px] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            ▼
          </span>
        </span>
      </button>

      {open && (
        <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-[max(18px,env(safe-area-inset-bottom))] m-0 list-none">
          {byRole.map(({ role, people }) => (
            <li key={role} className="pt-2.5">
              <p className="flex items-center gap-[7px] px-2 pb-0.5 m-0">
                <span
                  aria-hidden
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: roleColor(role) }}
                />
                <span
                  className="text-[13px] font-bold tracking-[-0.01em]"
                  style={{ color: roleTextColor(role) }}
                >
                  {ROLE_REGION_NAME[role]}
                </span>
                <span className="text-[12.5px] font-semibold text-slate-300 tabular-nums">
                  {people.length}
                </span>
              </p>
              <ul className="m-0 p-0 list-none">
                {people.map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    centerElement={centerElement}
                    selected={person.id === selectedId}
                    onSelect={onSelect}
                    isOwner={isOwner}
                    onDelete={onDelete}
                    rowRef={(el) => {
                      if (el) rowRefs.current.set(person.id, el);
                      else rowRefs.current.delete(person.id);
                    }}
                  />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PersonRow({
  person,
  centerElement,
  selected,
  onSelect,
  isOwner,
  onDelete,
  rowRef,
}: {
  person: MapPerson;
  centerElement: Element;
  selected: boolean;
  onSelect: (id: string) => void;
  isOwner: boolean;
  onDelete: (id: string) => void;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  const graphic = roleColor(person.role);
  const text = roleTextColor(person.role);

  return (
    <li>
      {/*
        행이 <button> 이 아니라 role="button" 인 div 인 이유: 소유자에게는 안에
        지우기 버튼이 들어간다. HTML5 는 button 안의 button 을 금지하고, 파서가
        고쳐 놓은 결과가 브라우저마다 달라 안쪽 컨트롤이 보조기기에 어떻게
        노출되는지가 정의되지 않는다. 그래서 바깥을 div 로 내리고 키보드 동작을
        직접 단다 — 지우기는 그 안의 진짜 형제 button 으로 남는다.
      */}
      <div
        ref={rowRef}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(person.id)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          onSelect(person.id);
        }}
        className={`
          w-full flex items-start gap-[11px] text-left px-2 py-[11px] pl-[21px] rounded-xl cursor-pointer border-0
          ${selected ? "bg-blue-50/70" : "bg-transparent"}
        `}
      >
        {/* 아바타는 그 사람의 구역 색이다 — 목록과 월드가 같은 색으로 이어진다. */}
        <span
          aria-hidden
          className="shrink-0 grid place-items-center w-[34px] h-[34px] rounded-full text-[13.5px] font-bold mt-0.5"
          style={{ backgroundColor: `${graphic}1f`, color: text }}
        >
          {person.name.slice(0, 1)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-[7px]">
            <span className="text-[14.5px] font-bold tracking-[-0.02em] text-slate-900">
              {person.name}
            </span>
            {/* 별명 15개가 소구역(기본·六合·沖)까지 이미 구분한다 — 六合/沖 라벨은 따로 안 단다. */}
            <span className="text-[11.5px] font-bold" style={{ color: text }}>
              {DISPLAY_TITLES[person.role][person.feature]}
            </span>
          </span>
          <span className="block text-[13.5px] font-semibold text-slate-700 mt-0.5 tracking-[-0.01em]">
            {person.sceneName}
          </span>
          <span className="block text-[13px] leading-relaxed text-slate-500 mt-0.5 [text-wrap:pretty]">
            {relationNote(centerElement, person.role, person.feature)}
          </span>
          {person.sameDayPillar && (
            // 六合 도 沖 도 아니라 배치로는 말할 수 없는 사실이다. 여기서만 말한다.
            <span className="block text-[12px] text-slate-400 mt-1">일주가 통째로 같아요.</span>
          )}
        </span>

        {isOwner && (
          <button
            type="button"
            aria-label={`${person.name} 지우기`}
            onClick={(e) => {
              // 행 전체가 선택 버튼이다 — 삭제가 선택으로 새면 지우자마자 카메라가 날아간다.
              e.stopPropagation();
              onDelete(person.id);
            }}
            className="shrink-0 px-1 py-0.5 text-[12.5px] font-semibold text-slate-300 bg-transparent border-0 cursor-pointer hover:text-rose-500"
          >
            지우기
          </button>
        )}
      </div>
    </li>
  );
}
```

- [ ] **Step 2: MapHeader.tsx — 라이트·공유 항상**

props 에서 `isOwner` 를 지우고(구조 분해·타입 모두), 공유 버튼의 `{isOwner && (...)}` 래핑을 벗겨 항상 렌더한다. 헤더를 in-flow 로 바꾼다:

```tsx
    <header className="shrink-0 z-30 border-b border-slate-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-[14px]">
```

(기존 독스트링의 상시 표시 근거·세이프 에어리어 주석은 유지. `fixed inset-x-0 top-0` 만 `shrink-0` 으로 바뀐 것이다 — flex 컬럼의 첫 행이 되므로 고정이 더는 필요 없다는 주석 한 줄을 덧붙인다.)

로고 링크: `text-slate-100` → `text-slate-900`, `BrandLogo` 의 `tone` 은 라이트 배경용 값으로 (컴포넌트를 열어 tone 옵션을 확인하고 다크 글자가 나오는 값을 쓴다 — "light" 가 밝은 글자라면 제거하거나 반대 값).

공유 버튼:

```tsx
          <button
            type="button"
            onClick={share}
            className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            공유하기
          </button>
```

- [ ] **Step 3: MapShell.tsx — flex 레이아웃 재구성, 시트 제거**

1. import 에서 `PersonSheet` 를 지우고 `import type { Element } from "@/lib/saju-core";` 는 유지.
2. `selectPerson` 을 다음으로 교체 (시트·목록 배타 규칙 → 선택 시 패널 열기):

```tsx
  // 3D 노드를 탭하면 목록의 그 행이 답이다 — 패널이 접혀 있으면 펼친다.
  // (목록 행을 탭한 경우에도 같은 경로로 오지만, 이미 열려 있으니 no-op 다.)
  function selectPerson(id: string | null) {
    setSelectedId(id);
    if (id !== null) setListOpen(true);
  }
```

3. `listOpen` 초기값을 `useState(true)` 로 (시안 기본 펼침). `adding` 은 유지.
4. `anyPanelOpen` 을 지우고, 렌더를 다음 구조로 교체한다 (토스트·handleDelete·showToast 는 그대로):

```tsx
  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-slate-900">
      <MapHeader shareId={shareId} loggedIn={loggedIn} onToast={showToast} />

      {/* 추가 모달이 떠 있는 동안 뒤 콘텐츠를 포커스·클릭에서 뺀다 — 오버레이가
          시각적으로 덮어도 Tab 은 뚫고 들어간다. */}
      <div inert={adding} className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-0 flex-1">
          {/*
            isolate 가 필수다. drei <Html> 은 카메라 거리로 z-index 를 계산해
            zIndexRange 안의 값을 마커마다 찍는데, R3F 가 만드는 Html 컨테이너는
            position:relative + z-index auto 라 쌓임 맥락을 만들지 않는다. 여기서
            맥락을 끊으면 마커의 z 는 이 div 안에서만 유효해지고, div 자체는
            z-auto 라 패널·모달이 항상 위다.
          */}
          <div className="absolute inset-0 isolate">
            <World people={people} selectedId={selectedId} onSelect={selectPerson} />
          </div>

          {/* 소유자가 아니어도 보인다 — 링크를 받은 사람이 자기를 넣는 것이 이 기능의 전부다. */}
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="absolute right-4 bottom-4 z-10 rounded-full bg-blue-600 px-[18px] py-3 text-[14px] font-bold text-white shadow-elevated hover:bg-blue-700"
          >
            + 나도 추가하기
          </button>
        </div>

        {/*
          사이드 패널. 데스크톱은 우측 400px 고정 컬럼, 모바일은 하단 판이다.
          모바일에서 접으면 헤더 행만 남고, 펼치면 최대 58vh 까지 (시안).
        */}
        <div
          className={`
            flex flex-col shrink-0 bg-white
            border-t border-slate-100 md:border-t-0 md:border-l
            md:w-[400px] md:max-h-none
            ${listOpen ? "max-h-[58vh]" : ""}
          `}
        >
          <PeopleList
            people={people}
            centerElement={centerElement}
            open={listOpen}
            onToggle={() => setListOpen((v) => !v)}
            selectedId={selectedId}
            onSelect={selectPerson}
            isOwner={isOwner}
            onDelete={handleDelete}
          />
        </div>
      </div>

      <AddPersonSheet
        open={adding}
        shareId={shareId}
        onClose={() => setAdding(false)}
        onAdded={(id) => {
          setAdding(false);
          // 서버가 목록의 진실이다. refresh 로 새 사람을 받아오고, 도착하면
          // selectedId 가 그를 가리켜 카메라가 날아가고 행이 하이라이트된다.
          setSelectedId(id);
          router.refresh();
        }}
      />

      {/* z-40 — 패널(z-10)보다 위다. 목록에서 지운 결과를 목록이 가리면 안 된다. */}
      {toast && (
        <p
          role="status"
          className="fixed left-1/2 top-[72px] z-40 -translate-x-1/2 rounded-full bg-slate-800/95 px-4 py-2 text-[13px] text-slate-100"
        >
          {toast}
        </p>
      )}
    </div>
  );
```

(AddPersonSheet 는 이 태스크에서는 그대로 다크 시트로 남는다 — Task 5 가 모달로 바꾼다. `handleDelete` 안의 `if (selectedId === id) setSelectedId(null);` 로직과 나머지 함수는 그대로.)

5. `PersonSheet.tsx` 파일을 삭제한다.

- [ ] **Step 4: 확인과 커밋**

Run: `npm test` 그리고 `npm run typecheck`
Expected: PASS — PersonSheet 를 import 하는 곳이 남아 있으면 typecheck 가 잡는다.

```bash
git add -A src/app/map/_components
git commit -m "feat(map): 라이트 레이아웃 — 사이드 패널에 궁합 단락 인라인, 시트 삭제

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 추가 폼을 모달로

**Files:**
- Create: `src/app/map/_components/AddPersonModal.tsx`
- Delete: `src/app/map/_components/AddPersonSheet.tsx`
- Modify: `src/app/map/_components/MapShell.tsx` (import·JSX 교체)

**Interfaces:**
- Consumes: `addDraftIssues`/`digitsOnly`/`emptyAddDraft`/`toAddBody` (`../_lib/add-draft`, 기존) · `hasLeapMonth` (`@/lib/saju-core`) · `Toggle` (`@/components/Toggle`).
- Produces: `AddPersonModal({ open, shareId, onClose, onAdded })` — AddPersonSheet 와 같은 props.

- [ ] **Step 1: AddPersonModal.tsx 생성**

```tsx
"use client";

import { useRef, useState } from "react";
import { hasLeapMonth } from "@/lib/saju-core";
import { Toggle } from "@/components/Toggle";
import {
  addDraftIssues, digitsOnly, emptyAddDraft, toAddBody,
  type AddDraft,
} from "../_lib/add-draft";

type BirthField = "y" | "m" | "d";

/**
 * 링크를 받은 사람이 자기를 지도에 넣는 모달. 로그인을 묻지 않는다 — 이
 * 공개성이 기능의 전부다(브리프). 받는 것은 이름·생년월일·양음력뿐이다:
 * 지도는 일주만 쓰고 일주는 성별·시각·출생지와 무관하다.
 *
 * 시트가 아니라 모달인 것은 시안이다 — 데스크톱은 중앙 420px, 모바일은 하단.
 * 닫으면 언마운트라 입력이 지워진다. 시트 시절에는 마운트를 유지해 입력이
 * 남았지만, 폼이 세 칸뿐이라 다시 치는 비용이 상태 유지 코드보다 싸다.
 */
export function AddPersonModal({
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
  const [focusField, setFocusField] = useState<BirthField | null>(null);
  const mRef = useRef<HTMLInputElement>(null);
  const dRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const body = toAddBody(draft);
  const name = draft.name.trim();

  // 세 칸이 다 찼는데도 유효하지 않을 때만 에러로 말한다 — 치는 중에 빨개지면
  // 오타가 아니라 미완성까지 혼나는 셈이다.
  const birthComplete = draft.y.length === 4 && draft.m !== "" && draft.d !== "";
  const birthInvalid = birthComplete && addDraftIssues(draft).includes("birth");

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
        // 중복은 여기서 갈리지 않는다 — 서버가 이미 있는 사람도 201 로
        // 돌려준다(생년월일을 짐작해 상태 코드로 확인하지 못하게). 남은 에러는
        // 검증 실패와 인원 50명 초과(409)뿐이라, 서버 메시지를 그대로 보여준다.
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

  const boxClass = (field: BirthField) =>
    `flex items-baseline gap-1 rounded-[13px] border-[1.5px] bg-white px-3 py-3 cursor-text transition-colors ${
      birthInvalid ? "border-rose-500" : focusField === field ? "border-blue-600" : "border-slate-200"
    }`;
  const numClass =
    "w-full border-0 bg-transparent p-0 text-center text-[19px] font-bold tracking-[0.04em] text-slate-900 outline-none tabular-nums placeholder:text-slate-300";
  const segClass = (on: boolean) =>
    `rounded-[7px] px-3 py-[5px] text-[12.5px] font-bold border-0 cursor-pointer transition-colors ${
      on ? "bg-white text-slate-900 shadow-sm" : "bg-transparent text-slate-400"
    }`;

  return (
    // 오버레이 클릭 = 닫기. 카드 자체의 클릭은 stopPropagation 으로 삼킨다.
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/45 backdrop-blur-[2px] md:items-center"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="지도에 추가하기"
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-white px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3.5 rounded-t-[22px] shadow-elevated md:max-w-[420px] md:rounded-[22px] md:px-6 md:pb-6 md:pt-4"
      >
        {/* 모바일 손잡이 */}
        <div className="md:hidden mx-auto mb-[18px] h-1 w-[38px] rounded-full bg-slate-200" />

        <p className="m-0 text-[11.5px] font-bold tracking-[0.08em] text-slate-400">관계 지도</p>
        <h2 className="m-0 mt-1 text-[21px] font-bold leading-tight tracking-[-0.04em] text-slate-900">
          지도에 추가하기
        </h2>
        <p className="m-0 mt-[5px] text-[13.5px] text-slate-500">이름과 생년월일만 있으면 돼요.</p>

        <div className="mt-[22px] flex flex-col gap-4">
          <label className="block">
            <span className="mb-[7px] block text-[12.5px] font-bold text-slate-500">이름</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="예: 백상현"
              maxLength={20}
              className="w-full rounded-[13px] border-[1.5px] border-slate-200 px-[15px] py-[13px] text-[15.5px] text-slate-900 outline-none transition-colors focus:border-blue-600 placeholder:text-slate-300"
            />
          </label>

          <div>
            <div className="mb-[7px] flex items-center justify-between gap-2.5">
              <span className="text-[12.5px] font-bold text-slate-500">생년월일</span>
              <div className="flex gap-[3px] rounded-[9px] bg-slate-100 p-[3px]">
                <button
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, calendar: "solar", isLeapMonth: false })
                  }
                  className={segClass(draft.calendar === "solar")}
                >
                  양력
                </button>
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, calendar: "lunar" })}
                  className={segClass(draft.calendar === "lunar")}
                >
                  음력
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[1.5fr_1fr_1fr] gap-2">
              <label className={boxClass("y")}>
                <input
                  value={draft.y}
                  onChange={(e) => {
                    const v = digitsOnly(e.target.value, 4);
                    setDraft({ ...draft, y: v });
                    // 연도 네 자리를 다 치면 월로 손을 옮겨 준다 — 시안의 입력 흐름.
                    if (v.length === 4) mRef.current?.focus();
                  }}
                  onFocus={() => setFocusField("y")}
                  onBlur={() => setFocusField(null)}
                  inputMode="numeric"
                  placeholder="1993"
                  aria-label="생년"
                  aria-invalid={birthInvalid}
                  className={numClass}
                />
                <span className="shrink-0 text-[13px] font-semibold text-slate-300">년</span>
              </label>
              <label className={boxClass("m")}>
                <input
                  ref={mRef}
                  value={draft.m}
                  onChange={(e) => {
                    const v = digitsOnly(e.target.value, 2);
                    setDraft({ ...draft, m: v });
                    if (v.length === 2) dRef.current?.focus();
                  }}
                  onFocus={() => setFocusField("m")}
                  onBlur={() => setFocusField(null)}
                  inputMode="numeric"
                  placeholder="04"
                  aria-label="생월"
                  aria-invalid={birthInvalid}
                  className={numClass}
                />
                <span className="shrink-0 text-[13px] font-semibold text-slate-300">월</span>
              </label>
              <label className={boxClass("d")}>
                <input
                  ref={dRef}
                  value={draft.d}
                  onChange={(e) => setDraft({ ...draft, d: digitsOnly(e.target.value, 2) })}
                  onFocus={() => setFocusField("d")}
                  onBlur={() => setFocusField(null)}
                  inputMode="numeric"
                  placeholder="12"
                  aria-label="생일"
                  aria-invalid={birthInvalid}
                  className={numClass}
                />
                <span className="shrink-0 text-[13px] font-semibold text-slate-300">일</span>
              </label>
            </div>

            <p className={`m-0 mt-[7px] text-[12px] ${birthInvalid ? "text-rose-500" : "text-slate-300"}`}>
              {birthInvalid ? "날짜를 다시 확인해 주세요" : "시간은 몰라도 괜찮아요."}
            </p>
          </div>

          {leapAvailable && (
            <label className="flex items-center justify-between rounded-[13px] border-[1.5px] border-slate-200 px-[15px] py-3">
              <span className="text-[13px] text-slate-500">윤달</span>
              <Toggle
                checked={draft.isLeapMonth}
                onChange={(v) => setDraft({ ...draft, isLeapMonth: v })}
                label="윤달"
              />
            </label>
          )}

          {error && (
            <p role="alert" className="m-0 rounded-[13px] bg-rose-50 px-[15px] py-2.5 text-[13px] text-rose-600">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!body || sending}
            className={`mt-0.5 rounded-[13px] border-0 py-3.5 text-[15px] font-bold text-white transition-colors ${
              body && !sending ? "bg-blue-600 hover:bg-blue-700 cursor-pointer" : "bg-slate-300"
            }`}
          >
            {sending ? "올리는 중" : body ? `${name} 님을 지도에 올리기` : "지도에 올리기"}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full border-0 bg-transparent pt-3.5 text-[14px] font-semibold text-slate-400 cursor-pointer hover:text-slate-500"
        >
          다음에 할게요
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: MapShell 교체, 옛 시트 삭제**

MapShell 의 import 와 JSX 에서 `AddPersonSheet` → `AddPersonModal` (`props` 는 동일). `AddPersonSheet.tsx` 삭제.

- [ ] **Step 3: 확인과 커밋**

Run: `npm test` 그리고 `npm run typecheck`
Expected: PASS.

```bash
git add -A src/app/map/_components
git commit -m "feat(map): 추가 폼을 시안 모달로 — 분리 입력·자동 이동·이름 반영 버튼

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 브라우저 검증과 시각 튜닝

**Files:** 확인이 기본. 발견된 문제만 해당 파일 수정 (선 불투명도 상수, halo 알파, 클래스 조정 등 — 광량 불변식·강조 배율 관계 테스트가 계속 통과해야 한다).

- [ ] **Step 1: 워크트리 dev 서버**

⚠️ 메모리(worktree-vs-running-dev-server): preview_start 가 어느 체크아웃에서 뜨는지는 세션마다 다르다. 확실한 방법: 워크트리 cwd 에서 Bash `run_in_background` 로 `npx next dev --port 3022` 를 직접 띄우고 브라우저 탭으로 `localhost:3022` 를 연다. `.env.local` 을 메인에서 복사해 두고(끝나면 삭제), 접속 후 콘솔 청크 경로나 `.next` 생성 위치로 **워크트리 코드가 서빙되는지 반드시 판별**한다. `/map/[share]` 공유 페이지는 로그인 없이 열린다 — share_id 는 dev DB `maps` 테이블에서 조회.

- [ ] **Step 2: 데스크톱 확인 (스크린샷)**

- 라이트 배경 위 3D: 노드·halo 가 보이는가(노멀 블렌딩), 연결선이 읽히는가(너무 옅으면 `CONNECTION_OPACITY` 계열을 같은 비율로 올리되 관계 테스트 3종이 통과해야 한다), 나 오브가 파란가.
- 우측 400px 패널: 그룹 헤더·행·궁합 단락·색 텍스트 가독성.
- 3D 노드 클릭 → 행 하이라이트·스크롤 / 행 클릭 → 카메라 플라이.
- 추가 모달: 중앙 420px, 자동 포커스 이동, 검증 힌트, 이름 반영 버튼, 실제 추가 성공(맵에 새 노드).
- read_console_messages 에러 없음.

- [ ] **Step 3: 모바일 확인 (스크린샷)**

resize_window mobile 후: 하단 패널 58vh·접기, 모달이 바텀시트로, 지도 조작 가능. 확인 후 desktop 프리셋 복원.

- [ ] **Step 4: 수정이 있었다면 테스트 재실행 후 커밋**

```bash
git add -A src/app/map
git commit -m "fix(map): 라이트 배경 실측 튜닝

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
