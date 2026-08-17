# 관계지도 15구역 시각 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관계지도의 노드 색을 사람의 사주에서 **나와의 관계 Role** 로 옮기고, 공간을 5개 구면 앵커 × 3개 정삼각형 소구역으로 재배치한다.

**Architecture:** 순수 모듈(색·배치·시각상수)이 먼저 서고 컴포넌트가 그것을 소비한다. 모든 규칙은 `environment: "node"` vitest 로 잠긴다 — three 도 DOM 도 import 하지 않는 파일에 규칙을 두는 것이 이 코드베이스의 확립된 패턴이다.

**Tech Stack:** Next.js 16.2.10 App Router · React 19.2.4 · TypeScript strict · three 0.185.1 · @react-three/fiber 9.7.0 · @react-three/drei 10.7.8 · vitest 4 (`environment: "node"`, jsdom 없음, testing-library 없음)

**설계 문서:** `docs/superpowers/specs/2026-08-17-relationship-15-regions-design.md`
**브랜치:** `claude/relationship-15-regions`

## Global Constraints

- **`Math.random()` 금지.** 배치는 전부 기존 `hash01` 시드 해시로 결정론적이어야 한다.
- **테스트 환경은 node 다.** `vitest.config` 가 `environment: "node"` 이고 jsdom 이 없다. 테스트 파일은 React·three·DOM 을 import 할 수 없다. 컴포넌트는 테스트하지 않는다 — 규칙을 순수 모듈로 밀어내고 그것을 테스트한다.
- **`_lib/*.ts` 와 `_data/*.ts` 는 three 를 import 하지 않는다.** 숫자와 문자열만 둔다.
- **Role hue 5색은 이 값이다:** `fill 158 62% 62%` · `beside 212 68% 64%` · `express 280 58% 68%` · `move 35 72% 62%` · `refine 340 62% 65%`.
- **세 상태(기본/六合/沖)는 hue 를 바꾸지 않는다.** 채도·명도·글로우·움직임만 바꾼다.
- **세 상태의 적분 광량은 서로 2% 이내여야 한다.** `T = (α_near·r_near² + α_diffuse·1.6²) × (1 + d²/2)`.
- **확산 halo 반지름은 세 상태 모두 `1.6` 이다.** 상태마다 바꾸면 승인된 빛 번짐 폭을 넘는다.
- **소구역은 회전으로만 만든다.** 스케일·평행이동 금지 — 궁합이 나와의 거리를 바꾸면 안 된다.
- **六合 과 沖 은 언제나 같은 무게로 쓴다.** 색·알파·문구 길이·배지 어느 것도 한쪽이 무거우면 안 된다.
- 커밋 메시지는 한국어 한 줄 요약 + 필요시 본문. 끝에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `_data/hsl.ts` | **신규.** HSL→hex 변환 한 함수. `saju-colors.ts` 와 `role-colors.ts` 가 공유 |
| `_data/role-colors.ts` | **신규.** Role hue 5색과 상태별 채도·명도 변조. 색만 다룬다 |
| `_data/roles.ts` | `DISPLAY_TITLES` 15칸 추가 |
| `_data/saju-colors.ts` | `hslToHex` 를 `hsl.ts` 에서 import 하도록만 수정 |
| `_lib/node-visual.ts` | halo 기하(반지름)·알파·움직임 상수와 광량 불변식 |
| `_lib/layout.ts` | 구면 앵커, 소구역 회전, 사람 배치 |
| `_lib/connections.ts` | 연결선 좌표 + 정점 색 |
| `_components/PersonNode.tsx` | role+feature 로 3층 노드를 그린다. 호흡·진동 |
| `_components/PersonMarker.tsx` | 명패 티어와 dot 색 |
| `_components/SelfCore.tsx` | 나 — 비겁 색 |
| `_components/ConnectionLines.tsx` | 정점 색 LineSegments |
| `_components/PersonSheet.tsx` | 15개 표시명 3층 + 사주색 칩 |

---

## Task 1: 색 모듈 — hsl.ts 와 role-colors.ts

**Files:**
- Create: `src/app/lab/relationship-world/_data/hsl.ts`
- Create: `src/app/lab/relationship-world/_data/role-colors.ts`
- Test: `src/app/lab/relationship-world/_data/role-colors.test.ts`
- Modify: `src/app/lab/relationship-world/_data/saju-colors.ts` (지역 `hslToHex` 를 import 로 교체)

**Interfaces:**
- Consumes: `RelationRole`, `Feature` (`_data/roles.ts`, 이미 존재)
- Produces:
  - `type Hsl = { readonly h: number; readonly s: number; readonly l: number }`
  - `hslToHex(hsl: Hsl): string`
  - `ROLE_HUE: Record<RelationRole, Hsl>`
  - `roleColor(role: RelationRole): string` — 상태 변조 없는 Role 기본색
  - `nodeColor(role: RelationRole, feature: Feature): string` — 상태 변조 적용
  - `roleHsl(role: RelationRole, feature: Feature): Hsl` — 테스트가 hue 를 확인할 때 쓴다

- [ ] **Step 1: `hsl.ts` 를 만든다**

`saju-colors.ts:64-76` 의 `hslToHex` 를 그대로 옮긴다. 값이 바뀌면 안 된다 — 기존 24개 테스트가 이 함수의 출력에 걸려 있다.

```ts
// src/app/lab/relationship-world/_data/hsl.ts
/**
 * HSL → hex. saju-colors 와 role-colors 가 공유한다.
 *
 * 두 곳에 같은 변환을 베껴 두면 한쪽만 고쳤을 때 같은 색이 다른 hex 로 나온다.
 * 색 공간 변환은 도메인 지식이 없는 순수 산수라 여기 따로 둘 이유가 충분하다.
 */
export type Hsl = { readonly h: number; readonly s: number; readonly l: number };

export function hslToHex({ h, s, l }: Hsl): string {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = light - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
```

- [ ] **Step 2: `saju-colors.ts` 가 그것을 쓰게 한다**

`saju-colors.ts` 에서 지역 `hslToHex` 함수 정의(64-76행)와 지역 `type Hsl` 정의를 지우고, 맨 위에 import 를 추가한다:

```ts
import { hslToHex, type Hsl } from "./hsl";
```

`Hsl` 이 `saju-colors.ts` 안에서 export 되고 있었다면 `export type { Hsl } from "./hsl";` 로 재수출한다. export 가 아니었다면 그냥 지운다.

- [ ] **Step 3: 기존 사주색 테스트가 그대로 통과하는지 확인**

Run: `npx vitest run src/app/lab/relationship-world/_data/saju-colors.test.ts`
Expected: PASS, 24 tests. 하나라도 깨지면 `hslToHex` 를 잘못 옮긴 것이다 — 되돌리고 다시 옮긴다.

- [ ] **Step 4: 실패하는 테스트를 쓴다**

```ts
// src/app/lab/relationship-world/_data/role-colors.test.ts
import { describe, expect, it } from "vitest";
import { ROLE_ORDER, type Feature } from "./roles";
import { ROLE_HUE, nodeColor, roleColor, roleHsl } from "./role-colors";

const FEATURES: Feature[] = ["none", "yukhap", "chung"];

function toRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}
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

const BACKGROUND = "#0f172a"; // World.tsx 의 <color attach="background">

describe("Role hue", () => {
  it("5개 역할 전부에 색이 있다", () => {
    for (const role of ROLE_ORDER) expect(ROLE_HUE[role]).toBeDefined();
  });

  it("hue 간격이 40° 이상이다 — 두 역할이 같은 색으로 읽히면 실패다", () => {
    const hues = ROLE_ORDER.map((r) => ROLE_HUE[r].h).sort((a, b) => a - b);
    for (let i = 0; i < hues.length; i++) {
      const gap = i === hues.length - 1 ? 360 - hues[i] + hues[0] : hues[i + 1] - hues[i];
      expect(gap, `${hues[i]}° 다음 간격`).toBeGreaterThanOrEqual(40);
    }
  });

  it("배경 대비가 4.5 이상이다", () => {
    for (const role of ROLE_ORDER) {
      expect(contrast(roleColor(role), BACKGROUND), role).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("5색이 서로 다르다", () => {
    const seen = new Set(ROLE_ORDER.map(roleColor));
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

  it("六合 은 밝아지고 沖 은 채도가 오른다 — 방향이 반대로 붙으면 잡는다", () => {
    for (const role of ROLE_ORDER) {
      expect(roleHsl(role, "yukhap").l, role).toBeGreaterThan(ROLE_HUE[role].l);
      expect(roleHsl(role, "chung").s, role).toBeGreaterThan(ROLE_HUE[role].s);
    }
  });

  it("기본은 Role 색 그대로다", () => {
    for (const role of ROLE_ORDER) {
      expect(nodeColor(role, "none")).toBe(roleColor(role));
    }
  });
});
```

- [ ] **Step 5: 실패를 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_data/role-colors.test.ts`
Expected: FAIL — `Cannot find module './role-colors'`

- [ ] **Step 6: `role-colors.ts` 를 쓴다**

```ts
// src/app/lab/relationship-world/_data/role-colors.ts
import { hslToHex, type Hsl } from "./hsl";
import type { Feature, RelationRole } from "./roles";

/**
 * 노드 색은 그 사람의 사주가 아니라 **나와의 관계 Role** 이다.
 *
 * 이 방향은 직전 구현(색=사주)의 반대다. 그때는 색이 그룹에 대해 아무 정보도
 * 주지 못했고, 그룹을 알려주던 5개 Field 오브젝트는 그 앞 라운드에 삭제된
 * 뒤였다 — 사용자 입장에서 위치의 정보량이 0 이었다. 색을 Role 에 주는 것이
 * 그 공백을 메운다.
 *
 * 값은 배경 #0F172A 위에서 검산했다. 대비 5.72~10.34, hue 최소 간격 54°.
 * hue 를 옮길 때는 role-colors.test.ts 의 40° 하한을 반드시 통과시켜야 한다 —
 * 두 역할이 같은 색으로 읽히는 순간 이 설계의 전제가 무너진다.
 */
export const ROLE_HUE: Record<RelationRole, Hsl> = {
  fill: { h: 158, s: 62, l: 62 }, //    인성 · #62daae · 대비 10.34
  beside: { h: 212, s: 68, l: 64 }, //  비겁 · #659fe2 · 대비  6.47
  express: { h: 280, s: 58, l: 68 }, // 식상 · #bd7edd · 대비  6.11
  move: { h: 35, s: 72, l: 62 }, //     재성 · #e4aa58 · 대비  8.66
  refine: { h: 340, s: 62, l: 65 }, //  관성 · #dd6e93 · 대비  5.72
};

/**
 * 기본 / 六合 / 沖 의 채도·명도 변조. **hue 는 건드리지 않는다.**
 *
 * 六合 은 맑아지고(채도↓ 명도↑), 沖 은 또렷해진다(채도↑ 명도 살짝↑).
 * 어느 쪽도 "더 세다"가 되면 안 된다 — 밝기의 균형은 색이 아니라
 * node-visual.ts 의 광량 불변식이 잡는다.
 */
const STATE_SHIFT: Record<Feature, { readonly s: number; readonly l: number }> = {
  none: { s: 0, l: 0 },
  yukhap: { s: -10, l: 12 },
  chung: { s: 12, l: 4 },
};

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** 상태 변조를 적용한 HSL. hue 는 언제나 ROLE_HUE[role].h 다. */
export function roleHsl(role: RelationRole, feature: Feature): Hsl {
  const base = ROLE_HUE[role];
  const shift = STATE_SHIFT[feature];
  return { h: base.h, s: clamp(base.s + shift.s), l: clamp(base.l + shift.l) };
}

/** 상태 변조 없는 Role 기본색. 연결선과 dot 명패가 쓴다. */
export function roleColor(role: RelationRole): string {
  return hslToHex(ROLE_HUE[role]);
}

/** 노드 코어 색. 상태까지 반영한다. */
export function nodeColor(role: RelationRole, feature: Feature): string {
  return hslToHex(roleHsl(role, feature));
}
```

- [ ] **Step 7: 통과를 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_data/`
Expected: PASS. role-colors 9개 + saju-colors 24개.

- [ ] **Step 8: 커밋**

```bash
git add src/app/lab/relationship-world/_data/hsl.ts src/app/lab/relationship-world/_data/role-colors.ts src/app/lab/relationship-world/_data/role-colors.test.ts src/app/lab/relationship-world/_data/saju-colors.ts
git commit -m "feat(lab): 노드 색을 사주에서 관계 Role 로 옮기는 색 모듈을 만든다"
```

---

## Task 2: 15개 표시명

**Files:**
- Modify: `src/app/lab/relationship-world/_data/roles.ts`
- Test: `src/app/lab/relationship-world/_data/roles.test.ts` (신규)

**Interfaces:**
- Consumes: `RelationRole`, `Feature`, `ROLE_ORDER`, `FEATURE_LABELS` (모두 이미 존재)
- Produces: `DISPLAY_TITLES: Record<RelationRole, Record<Feature, string>>`, `FEATURE_NOTE: Record<Feature, string>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// src/app/lab/relationship-world/_data/roles.test.ts
import { describe, expect, it } from "vitest";
import {
  DISPLAY_TITLES,
  FEATURE_NOTE,
  ROLE_LABELS,
  ROLE_ORDER,
  type Feature,
} from "./roles";

const FEATURES: Feature[] = ["none", "yukhap", "chung"];

describe("DISPLAY_TITLES", () => {
  it("15칸이 전부 채워져 있다", () => {
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        expect(DISPLAY_TITLES[role][feature], `${role}/${feature}`).toBeTruthy();
      }
    }
  });

  it("15개가 서로 다르다 — 겹치면 어느 칸인지 알 수 없다", () => {
    const all = ROLE_ORDER.flatMap((r) => FEATURES.map((f) => DISPLAY_TITLES[r][f]));
    expect(new Set(all).size).toBe(15);
  });

  it("전부 짧은 명사다 — 캡처해서 공유할 이름이다", () => {
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        const title = DISPLAY_TITLES[role][feature];
        expect(title.length, `${role}/${feature} "${title}"`).toBeLessThanOrEqual(6);
        expect(title, `${role}/${feature}`).not.toMatch(/\s/);
      }
    }
  });
});

describe("六合 과 沖 의 무게", () => {
  // 한쪽 설명만 길거나 따뜻하면 그 순간 좋은 관계 / 나쁜 관계가 된다.
  it("표시명 길이 총합이 六合 과 沖 사이에 기울지 않는다", () => {
    // 역할마다 정확히 같기를 요구할 수는 없다 — 찰떡(2)/불쏘시개(4) 처럼
    // 자연스러운 이름의 길이는 제각각이다. 한쪽 계열이 **전체적으로** 더 길거나
    // 짧아지는 것만 막는다. 현재 값: 六合 12자, 沖 14자, 차 2.
    const sum = (f: "yukhap" | "chung") =>
      ROLE_ORDER.reduce((n, r) => n + DISPLAY_TITLES[r][f].length, 0);
    expect(Math.abs(sum("yukhap") - sum("chung"))).toBeLessThanOrEqual(3);
  });

  it("설명 문구 길이 차가 3자 이내다", () => {
    expect(Math.abs(FEATURE_NOTE.yukhap.length - FEATURE_NOTE.chung.length)).toBeLessThanOrEqual(3);
  });

  it("기본 상태에는 설명 문구가 없다 — 배지도 문구도 붙지 않는다", () => {
    expect(FEATURE_NOTE.none).toBe("");
  });
});

describe("ROLE_LABELS", () => {
  it("5개 역할 전부에 있다", () => {
    for (const role of ROLE_ORDER) expect(ROLE_LABELS[role]).toBeTruthy();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_data/roles.test.ts`
Expected: FAIL — `DISPLAY_TITLES` 와 `FEATURE_NOTE` 가 `roles.ts` 에 없다.

- [ ] **Step 3: `roles.ts` 에 추가한다**

기존 내용은 그대로 두고 아래를 덧붙인다. `FEATURE_NOTE` 는 `PersonSheet.tsx:10-13` 에 있던 것을 옮겨 온다 — 문구는 한 글자도 바꾸지 않는다. 두 문구의 길이 균형은 이미 맞춰져 있다(23자 / 21자).

```ts
/**
 * Role × Feature 15칸의 사용자-facing 별명. 엔진의 고정 타입이 아니라
 * 지금 화면의 display layer 다 — 나중에 刑/破/害 가 붙으면 이 표가 아니라
 * 조합 규칙이 바뀐다.
 *
 * Record<RelationRole, Record<Feature, string>> 라서 15칸을 하나라도 빠뜨리면
 * 컴파일되지 않는다.
 */
export const DISPLAY_TITLES: Record<RelationRole, Record<Feature, string>> = {
  fill: { none: "보조배터리", yukhap: "비타민", chung: "쓴약" },
  beside: { none: "동지", yukhap: "단짝", chung: "라이벌" },
  express: { none: "놀이터", yukhap: "뮤즈", chung: "버튼" },
  move: { none: "알람", yukhap: "찰떡", chung: "불쏘시개" },
  refine: { none: "가드레일", yukhap: "신호등", chung: "회초리" },
};

/**
 * 六合 과 沖 의 설명. 길이와 무게를 맞춘다(23자 / 21자) — 한쪽만 따뜻하게 쓰면
 * 그 순간 좋은 관계 / 나쁜 관계가 된다. 기본 상태는 빈 문자열이라 아무것도
 * 렌더링되지 않는다.
 */
export const FEATURE_NOTE: Record<Feature, string> = {
  none: "",
  yukhap: "둘 사이의 흐름이 끊기지 않고 이어집니다.",
  chung: "둘 사이의 흐름이 팽팽하게 맞물립니다.",
};
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_data/roles.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world/_data/roles.ts src/app/lab/relationship-world/_data/roles.test.ts
git commit -m "feat(lab): Role × Feature 15칸의 표시명을 타입으로 강제한다"
```

---

## Task 3: 상태별 시각 상수와 광량 불변식

**Files:**
- Modify: `src/app/lab/relationship-world/_lib/node-visual.ts` (전면 재작성)
- Modify: `src/app/lab/relationship-world/_lib/node-visual.test.ts`

**Interfaces:**
- Consumes: `Feature` (`_data/roles.ts`)
- Produces:
  - `CORE_RADIUS = 0.075`, `SELF_NODE_SCALE = 4`, `DIFFUSE_HALO_RADIUS = 1.6`
  - `HALO_TEXTURE_SIZE = 64`, `radialFalloff(size: number): Uint8Array` (기존 그대로)
  - `STATE_VISUAL: Record<Feature, StateVisual>`
  - `stateLight(feature: Feature): number`
  - `type StateVisual = { nearRadius, nearAlpha, diffuseAlpha, breatheAmplitude, breathePeriod, tremorAmplitude, tremorHz }` (전부 `number`)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`node-visual.test.ts` 의 `radialFalloff` describe 블록 5개는 **그대로 둔다.** `시각 상수` describe 를 아래로 통째로 교체한다.

```ts
// describe("시각 상수", ...) 를 이걸로 바꾼다. 파일 상단 import 도 함께 고친다:
// import { CORE_RADIUS, DIFFUSE_HALO_RADIUS, HALO_TEXTURE_SIZE, STATE_VISUAL,
//          SELF_NODE_SCALE, radialFalloff, stateLight } from "./node-visual";
// import type { Feature } from "../_data/roles";

const FEATURES: Feature[] = ["none", "yukhap", "chung"];

describe("시각 상수", () => {
  it("코어 < 근접 halo < 확산 halo 순으로 커진다", () => {
    for (const f of FEATURES) {
      expect(CORE_RADIUS, f).toBeLessThan(STATE_VISUAL[f].nearRadius);
      expect(STATE_VISUAL[f].nearRadius, f).toBeLessThan(DIFFUSE_HALO_RADIUS);
    }
  });

  it("나는 다른 사람보다 2배 이상 크다", () => {
    expect(SELF_NODE_SCALE).toBeGreaterThanOrEqual(2);
  });

  it("확산 halo 는 최근접 거리 중앙값의 절반을 넘어 이웃과 실제로 겹친다", () => {
    // 겹치지 않으면 "사람들이 Field 를 만든다"가 성립하지 않는다.
    // 새 배치의 실측: 겹치는 이웃 중앙값 4명, 고립 1/21.
    expect(DIFFUSE_HALO_RADIUS * 2).toBeGreaterThan(1.93);
  });
});

describe("광량 불변식", () => {
  // 설계 문서 4.3. 브리프 §3.2 가 "沖이 가장 강하고 六合이 가장 약한 등급처럼
  // 읽힐 수 있다"고 직접 경고한 것을, 부탁이 아니라 숫자로 막는다.
  it("세 상태의 적분 광량이 서로 2% 이내다", () => {
    const lights = FEATURES.map(stateLight);
    const spread = (Math.max(...lights) - Math.min(...lights)) / Math.min(...lights);
    expect(spread, `T = ${lights.map((v) => v.toFixed(6)).join(" / ")}`).toBeLessThan(0.02);
  });

  it("호흡의 시간 평균이 광량에 반영된다", () => {
    // scale(t) = 1 + d·sin(ωt) → <scale²> = 1 + d²/2.
    // 이걸 빼먹으면 六合 이 평균적으로 더 밝아진다. 진폭이 있는 상태가
    // 정확히 그만큼 보정돼 있는지 직접 확인한다.
    const v = STATE_VISUAL.yukhap;
    expect(v.breatheAmplitude).toBeGreaterThan(0);
    const raw = v.nearAlpha * v.nearRadius ** 2 + v.diffuseAlpha * DIFFUSE_HALO_RADIUS ** 2;
    expect(stateLight("yukhap")).toBeCloseTo(raw * (1 + v.breatheAmplitude ** 2 / 2), 10);
  });

  it("확산 halo 반지름은 세 상태가 같다 — 상태마다 바꾸면 빛 번짐이 승인폭을 넘는다", () => {
    expect(DIFFUSE_HALO_RADIUS).toBe(1.6);
  });

  it("모든 알파가 0 초과 1 이하다", () => {
    for (const f of FEATURES) {
      const v = STATE_VISUAL[f];
      expect(v.nearAlpha, `${f} near`).toBeGreaterThan(0);
      expect(v.nearAlpha, `${f} near`).toBeLessThanOrEqual(1);
      expect(v.diffuseAlpha, `${f} diffuse`).toBeGreaterThan(0);
      expect(v.diffuseAlpha, `${f} diffuse`).toBeLessThanOrEqual(1);
    }
  });

  it("확산 halo 가 6겹 쌓여도 화면을 덮지 않는다", () => {
    // 이 상한을 넘으면 직전 스파이크의 '흰 덩어리'가 색만 바뀐 채 돌아온다.
    for (const f of FEATURES) {
      expect(STATE_VISUAL[f].diffuseAlpha * 6, f).toBeLessThan(0.5);
    }
  });

  it("六合 은 넓고 옅게, 沖 은 좁고 진하게 퍼진다", () => {
    // 광량이 같아도 성격은 달라야 한다. 방향이 뒤집히면 잡는다.
    expect(STATE_VISUAL.yukhap.nearRadius).toBeGreaterThan(STATE_VISUAL.none.nearRadius);
    expect(STATE_VISUAL.yukhap.nearAlpha).toBeLessThan(STATE_VISUAL.none.nearAlpha);
    expect(STATE_VISUAL.chung.nearRadius).toBeLessThan(STATE_VISUAL.none.nearRadius);
    expect(STATE_VISUAL.chung.nearAlpha).toBeGreaterThan(STATE_VISUAL.none.nearAlpha);
  });

  it("움직임은 한 상태에 하나씩만 붙는다", () => {
    expect(STATE_VISUAL.none.breatheAmplitude).toBe(0);
    expect(STATE_VISUAL.none.tremorAmplitude).toBe(0);
    expect(STATE_VISUAL.yukhap.tremorAmplitude).toBe(0);
    expect(STATE_VISUAL.chung.breatheAmplitude).toBe(0);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_lib/node-visual.test.ts`
Expected: FAIL — `STATE_VISUAL`, `stateLight`, `SELF_NODE_SCALE` 이 없다(`HALO_ALPHA`, `NEAR_HALO_RADIUS` 는 이번에 사라진다).

- [ ] **Step 3: `node-visual.ts` 를 다시 쓴다**

`radialFalloff`, `CORE_RADIUS`, `HALO_TEXTURE_SIZE`, `DIFFUSE_HALO_RADIUS` 는 값을 유지하고, `NEAR_HALO_RADIUS`/`HALO_ALPHA` 를 `STATE_VISUAL` 로 대체한다. `SELF_CORE_SCALE` 은 이미 `SELF_NODE_SCALE = 4` 로 개명돼 있다.

```ts
import type { Feature } from "../_data/roles";

/** 코어. 사람의 위치 그 자체. opaque 로 그려서 깊이 버퍼에 참여한다. */
export const CORE_RADIUS = 0.075;

/**
 * 나만 노드가 크다. 코어와 근접 halo 에 함께 걸린다.
 * 진입 화면(375px, 1 월드 단위 ≈ 32.5px)에서 코어 지름 19.5px, 근접 halo 72.8px.
 */
export const SELF_NODE_SCALE = 4;

/**
 * 확산 halo 반지름. **세 상태가 같은 값을 쓴다.**
 *
 * 상태마다 바꾸면 六合 의 빛 번짐이 승인된 폭을 넘는다 — 초안의 2.1 은 진입
 * 화면 지름 166px 로, 승인된 104px 의 160% 였다. 상태 차이는 반지름이 아니라
 * 알파와 근접 halo 로 만든다.
 *
 * 1.6 인 근거는 겹침이다. 새 배치의 실측: 겹치는 이웃 중앙값 4명, 최대 5명,
 * 고립 1/21. 이 겹침이 곧 "사람들이 Field 를 만든다"의 전부다.
 */
export const DIFFUSE_HALO_RADIUS = 1.6;

export type StateVisual = {
  readonly nearRadius: number;
  readonly nearAlpha: number;
  readonly diffuseAlpha: number;
  /** 六合 전용. scale 진폭. 0 이면 호흡하지 않는다. */
  readonly breatheAmplitude: number;
  /** 초. breatheAmplitude 가 0 이면 의미 없다. */
  readonly breathePeriod: number;
  /** 沖 전용. 월드 단위 위치 흔들림. 0 이면 떨지 않는다. */
  readonly tremorAmplitude: number;
  /** Hz. tremorAmplitude 가 0 이면 의미 없다. */
  readonly tremorHz: number;
};

/**
 * 기본 / 六合 / 沖 의 시각 상수.
 *
 * nearAlpha 의 소수점 넷째 자리는 임의의 값이 아니다 — stateLight 가 세
 * 상태에서 같아지도록 역산한 값이다(설계 문서 4.3). **반지름이나 확산 알파를
 * 만지면 이 값도 다시 풀어야 한다.** 광량 불변식 테스트가 그것을 강제한다.
 */
export const STATE_VISUAL: Record<Feature, StateVisual> = {
  none: {
    nearRadius: 0.28,
    nearAlpha: 0.55,
    diffuseAlpha: 0.07,
    breatheAmplitude: 0,
    breathePeriod: 0,
    tremorAmplitude: 0,
    tremorHz: 0,
  },
  yukhap: {
    nearRadius: 0.42, // 넓고
    nearAlpha: 0.4462, // 옅게
    diffuseAlpha: 0.055,
    breatheAmplitude: 0.16,
    breathePeriod: 4.6,
    tremorAmplitude: 0,
    tremorHz: 0,
  },
  chung: {
    nearRadius: 0.2, // 좁고
    nearAlpha: 0.758, // 진하게
    diffuseAlpha: 0.075,
    breatheAmplitude: 0,
    breathePeriod: 0,
    tremorAmplitude: 0.02, // 진입 화면에서 0.5~0.8px
    tremorHz: 6,
  },
};

/**
 * 한 상태가 내보내는 적분 광량.
 *
 * 스프라이트의 적분 밝기는 α × 반지름² 에 비례한다. 호흡은 크기가 시간에 따라
 * 변하므로 scale(t) = 1 + d·sin(ωt) 의 시간 평균 <scale²> = 1 + d²/2 로 보정한다.
 * 이 보정을 빼먹으면 호흡하는 상태가 평균적으로 더 밝아진다.
 *
 * 이 값이 세 상태에서 같아야 "沖이 제일 세다"가 생기지 않는다. 다만 적분
 * 광량이 같다고 지각 밝기가 같지는 않다 — 沖 은 피크 알파가 높고 六合 은
 * 낮으며, 그건 설계 의도다. 불변식이 막는 것은 한 상태가 전체적으로
 * 밝아지는 것뿐이다.
 */
export function stateLight(feature: Feature): number {
  const v = STATE_VISUAL[feature];
  const timeAverage = 1 + v.breatheAmplitude ** 2 / 2;
  return (
    (v.nearAlpha * v.nearRadius ** 2 + v.diffuseAlpha * DIFFUSE_HALO_RADIUS ** 2) *
    timeAverage
  );
}

export const HALO_TEXTURE_SIZE = 64;

// radialFalloff 는 기존 구현을 그대로 둔다.
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_lib/node-visual.test.ts`
Expected: PASS. `radialFalloff` 5개 + 시각 상수 3개 + 광량 불변식 7개.

이 시점에서 `PersonNode.tsx` 는 사라진 `HALO_ALPHA`/`NEAR_HALO_RADIUS` 를 import 하고 있어 **타입 체크가 깨진다.** Task 5 에서 고친다. 지금은 정상이다.

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world/_lib/node-visual.ts src/app/lab/relationship-world/_lib/node-visual.test.ts
git commit -m "feat(lab): 기본·六合·沖 의 시각 상수를 광량 불변식으로 묶는다"
```

---

## Task 4: 배치 재작성 — 구면 앵커와 정삼각형 소구역

이 계획에서 가장 큰 작업이다. `layout.ts` 의 역할별 배치 로직을 전부 걷어내고 새 구조로 바꾼다.

**Files:**
- Modify: `src/app/lab/relationship-world/_lib/layout.ts` (대부분 삭제 후 재작성)
- Modify: `src/app/lab/relationship-world/_lib/layout.test.ts` (Field 형태 테스트 삭제, 새 테스트 추가)

**Interfaces:**
- Consumes: `RelationRole`, `Feature`, `ROLE_ORDER` (`_data/roles.ts`), `CAMERA_FOV`/`DEFAULT_CAMERA_POSITION`/`DEFAULT_TARGET`/`CAMERA_LIMITS` (`./camera`)
- Produces:
  - `type Vec3 = readonly [number, number, number]` (기존)
  - `SELF_POSITION: Vec3 = [0, 0, 0]` (기존)
  - `ANCHOR_RADIUS = 7`
  - `ROLE_ANCHORS: Record<RelationRole, { anchor: Vec3; phase: number }>`
  - `SPREAD: Record<Feature, number>`
  - `subAnchor(role: RelationRole, feature: Feature): Vec3`
  - `positionFor(role: RelationRole, feature: Feature, indexInSubRegion: number): Vec3`
  - `type Placeable = { readonly id: string; readonly role: RelationRole; readonly feature: Feature }`
  - `placePeople(people: readonly Placeable[]): Map<string, Vec3>`
- **삭제:** `FIELD_CENTERS`, `FIELD_EXTENT`, `BESIDE_LAYERS`, `BESIDE_TILT`, `REFINE_GRID_STEP`, `REFINE_Y_COMPRESSION`, `REFINE_SHARDS`, `REFINE_MAX_SHARD_RADIUS`, `EXPRESS_RAYS`, `EXPRESS_RAY_WIDTH`, `MOVE_RIBBONS`, `MOVE_TUBE_RADIUS`, `Shard`, `Ray`, `perpendicularTo`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`layout.test.ts` 를 아래로 **전면 교체**한다. 살아남는 것은 파일 하단의 투영 헬퍼(`projectToNdc` 등)와 카메라 도달성·모드 제한 describe 세 개다 — 그 부분은 `FIELD_CENTERS` 를 `ROLE_ANCHORS[...].anchor` 로 바꾸는 것 외에 손대지 않는다.

```ts
import { describe, it, expect } from "vitest";
import { FRIENDS } from "../_data/mock-people";
import { ROLE_ORDER, type Feature, type RelationRole } from "../_data/roles";
import {
  CAMERA_FOV,
  CAMERA_LIMITS,
  DEFAULT_CAMERA_POSITION,
  DEFAULT_TARGET,
  type CameraMode,
} from "./camera";
import {
  ANCHOR_RADIUS,
  ROLE_ANCHORS,
  SELF_POSITION,
  SPREAD,
  placePeople,
  positionFor,
  subAnchor,
} from "./layout";

const FEATURES: Feature[] = ["none", "yukhap", "chung"];

function dist(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
const len = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);

describe("Role 앵커", () => {
  it("5개 역할 전부에 앵커가 있다", () => {
    for (const role of ROLE_ORDER) expect(ROLE_ANCHORS[role]).toBeDefined();
  });

  it("모든 앵커가 나로부터 등거리다 — 어떤 역할도 '더 가깝다'가 되면 안 된다", () => {
    for (const role of ROLE_ORDER) {
      expect(len(ROLE_ANCHORS[role].anchor), role).toBeCloseTo(ANCHOR_RADIUS, 9);
    }
  });

  it("앵커끼리 충분히 떨어져 있다", () => {
    // 실측 최소 5.858. 하한 4 는 앵커를 옮길 여지를 남기면서 붕괴는 잡는 값이다.
    for (let i = 0; i < ROLE_ORDER.length; i++) {
      for (let j = i + 1; j < ROLE_ORDER.length; j++) {
        const d = dist(ROLE_ANCHORS[ROLE_ORDER[i]].anchor, ROLE_ANCHORS[ROLE_ORDER[j]].anchor);
        expect(d, `${ROLE_ORDER[i]}↔${ROLE_ORDER[j]}`).toBeGreaterThan(4);
      }
    }
  });

  it("기울임 축이 잘 정의된다 — 앵커가 y 축에 너무 가까우면 외적이 무너진다", () => {
    // subAnchor 는 dir × [0,1,0] 을 기울임 축으로 쓴다(|dir_y| > 0.9 면 [1,0,0]).
    // move 앵커의 dir_y 는 0.8996 으로 그 문턱 바로 아래다. 앵커를 조금만
    // 움직여도 분기가 뒤집히므로, 어느 분기를 타든 외적이 충분히 크다는 것을
    // 직접 잠근다.
    for (const role of ROLE_ORDER) {
      const a = ROLE_ANCHORS[role].anchor;
      const dir = [a[0] / ANCHOR_RADIUS, a[1] / ANCHOR_RADIUS, a[2] / ANCHOR_RADIUS];
      const ref = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const c = [
        dir[1] * ref[2] - dir[2] * ref[1],
        dir[2] * ref[0] - dir[0] * ref[2],
        dir[0] * ref[1] - dir[1] * ref[0],
      ];
      expect(len(c), role).toBeGreaterThan(0.3);
    }
  });
});

describe("소구역", () => {
  it("모든 소구역이 나로부터 앵커와 같은 거리다 — 궁합이 거리를 바꿀 수 없다", () => {
    // 브리프 §2.2: 기본/六合/沖 을 나와의 거리로 구분하지 않는다.
    // 회전은 길이를 보존하므로 이것이 기하학적으로 성립한다. 예전에는
    // Placeable 타입이 배치가 feature 를 읽는 것 자체를 막았지만, 소구역이
    // feature 로 갈리는 지금은 그 방어가 불가능하다 — 이 테스트가 그 자리를 지킨다.
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        expect(len(subAnchor(role, feature)), `${role}/${feature}`).toBeCloseTo(
          ANCHOR_RADIUS,
          9,
        );
      }
    }
  });

  it("한 역할의 세 소구역이 서로 등거리다 — 정삼각형이다", () => {
    for (const role of ROLE_ORDER) {
      const [a, b, c] = FEATURES.map((f) => subAnchor(role, f));
      const sides = [dist(a, b), dist(a, c), dist(b, c)];
      expect(Math.max(...sides) - Math.min(...sides), role).toBeLessThan(1e-9);
    }
  });

  it("세 소구역이 실제로 떨어져 있다 — 겹치면 소구역이 없는 것과 같다", () => {
    for (const role of ROLE_ORDER) {
      const [a, b, c] = FEATURES.map((f) => subAnchor(role, f));
      for (const d of [dist(a, b), dist(a, c), dist(b, c)]) {
        expect(d, role).toBeGreaterThan(2);
      }
    }
  });

  it("역할마다 소구역 방향이 다르다 — 다섯 삼각형이 같은 방향이면 기계적으로 보인다", () => {
    const phases = new Set(ROLE_ORDER.map((r) => ROLE_ANCHORS[r].phase));
    expect(phases.size).toBe(ROLE_ORDER.length);
  });
});

describe("positionFor", () => {
  it("같은 입력이면 항상 같은 좌표를 준다", () => {
    expect(positionFor("fill", "none", 3)).toEqual(positionFor("fill", "none", 3));
  });

  it("같은 소구역 안에서 인덱스가 다르면 좌표가 다르다", () => {
    expect(positionFor("fill", "none", 0)).not.toEqual(positionFor("fill", "none", 1));
  });

  it("사람이 자기 소구역의 퍼짐 반경 안에 있다", () => {
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        for (let i = 0; i < 6; i++) {
          const d = dist(positionFor(role, feature, i), subAnchor(role, feature));
          expect(d, `${role}/${feature}/${i}`).toBeLessThanOrEqual(SPREAD[feature] + 1e-9);
        }
      }
    }
  });

  it("기본 소구역이 六合·沖 보다 넓게 퍼진다 — 비대칭이 문법이다", () => {
    // 기본은 느슨한 무리, 六合·沖 은 또렷한 자리다. 한 명뿐인 六合 자리가
    // 흩어진 무리의 낙오자로 보이면 안 된다.
    expect(SPREAD.none).toBeGreaterThan(SPREAD.yukhap);
    expect(SPREAD.yukhap).toBe(SPREAD.chung); // 六合 과 沖 은 언제나 같은 무게
  });
});

describe("placePeople", () => {
  it("20명 전원에게 좌표를 준다", () => {
    expect(placePeople(FRIENDS).size).toBe(20);
  });

  it("두 사람이 같은 자리에 겹치지 않는다", () => {
    // 나까지 포함한 21명의 실측 최소 간격은 0.2579 (가온 ↔ 예린) 다.
    // 하한 0.2 는 그보다 낮되 진짜 충돌은 잡는 값이다.
    const placed = [...placePeople(FRIENDS).values(), SELF_POSITION];
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(dist(placed[i], placed[j])).toBeGreaterThan(0.2);
      }
    }
  });

  it("사람이 없는 소구역은 좌표를 만들지 않는다", () => {
    // 관성 沖 은 목 데이터에서 비어 있다. 15구역 중 유일한 0명 칸이고,
    // 이게 있어야 "빈 소구역은 아무것도 그리지 않는다"가 실제로 확인된다.
    expect(FRIENDS.filter((p) => p.role === "refine" && p.feature === "chung")).toHaveLength(0);
  });

  it("한 사람을 빼도 같은 소구역의 나머지 좌표가 움직이지 않는다", () => {
    // indexInSubRegion 은 (role, feature) 쌍 안에서 센다. Role 안 전체 순번으로
    // 세면 한 명이 빠졌을 때 같은 소구역 사람들이 전부 자리를 옮긴다.
    const before = placePeople(FRIENDS);
    const dropped = FRIENDS.find((p) => p.role === "fill" && p.feature === "yukhap")!;
    const after = placePeople(FRIENDS.filter((p) => p.id !== dropped.id));
    for (const p of FRIENDS) {
      if (p.id === dropped.id) continue;
      if (p.role !== "fill") continue;
      expect(after.get(p.id), p.id).toEqual(before.get(p.id));
    }
  });
});
```

이어서 파일 하단의 **투영 잠금 블록**을 고친다. 기존 `type V3` / `sub` / `dot3` / `norm3` / `cross3` / `projectToNdc` / `PHONE_ASPECT` 는 그대로 두고, 세 describe 를 이렇게 바꾼다:

```ts
describe("진입 프레이밍 — 다섯 구역이 전부 보인다", () => {
  const eye = DEFAULT_CAMERA_POSITION as V3;
  const target = DEFAULT_TARGET as V3;
  const onScreen = (p: V3) => {
    const n = projectToNdc(p, eye, target, CAMERA_FOV, PHONE_ASPECT);
    return n.depth > 0 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1;
  };

  it("나(원점)는 화면 안에 있다", () => {
    expect(onScreen(SELF_POSITION as V3)).toBe(true);
  });

  it("5개 앵커가 전부 화면 안에 있다", () => {
    // 직전 구현은 2~4개만 보였고, 비겁 5명이 통째로 화면 밖이었다. 그것이
    // "위치가 아무 정보도 주지 않는다"에 크게 기여했다.
    for (const role of ROLE_ORDER) {
      expect(onScreen(ROLE_ANCHORS[role].anchor as V3), role).toBe(true);
    }
  });

  it("20명 전원이 화면 안에 투영된다", () => {
    for (const [id, p] of placePeople(FRIENDS)) {
      expect(onScreen(p as V3), id).toBe(true);
    }
  });

  it("앵커들의 깊이가 서로 다르다 — 같은 깊이면 평면 배치로 읽힌다", () => {
    const depths = ROLE_ORDER.map(
      (r) => projectToNdc(ROLE_ANCHORS[r].anchor as V3, eye, target, CAMERA_FOV, PHONE_ASPECT).depth,
    );
    expect(Math.max(...depths) - Math.min(...depths)).toBeGreaterThan(8);
  });

  // 3D 상 떨어져 있어도 화면에서 겹치면 사용자에게는 겹친 것이다. 무작위
  // 탐색이 앵커끼리 19px 까지 붙는 해를 냈던 것이 바로 이 함정이다 —
  // 3D 거리만 재는 테스트는 그걸 통과시킨다.
  const screen = (p: V3) => {
    const n = projectToNdc(p, eye, target, CAMERA_FOV, PHONE_ASPECT);
    return { x: (n.x * 0.5 + 0.5) * 375, y: (0.5 - n.y * 0.5) * 812 };
  };
  const screenDist = (a: V3, b: V3) => {
    const [p, q] = [screen(a), screen(b)];
    return Math.hypot(p.x - q.x, p.y - q.y);
  };

  it("앵커 간 화면 거리가 100px 이상이다", () => {
    // 실측 최소 123px.
    for (let i = 0; i < ROLE_ORDER.length; i++) {
      for (let j = i + 1; j < ROLE_ORDER.length; j++) {
        const d = screenDist(
          ROLE_ANCHORS[ROLE_ORDER[i]].anchor as V3,
          ROLE_ANCHORS[ROLE_ORDER[j]].anchor as V3,
        );
        expect(d, `${ROLE_ORDER[i]}↔${ROLE_ORDER[j]}`).toBeGreaterThan(100);
      }
    }
  });

  it("한 역할의 소구역 셋이 화면에서 40px 이상 벌어진다", () => {
    // 실측 최소 48px(재성). 근접 halo 지름보다 커야 세 자리로 읽힌다.
    // phase 는 이 값이 최대가 되도록 역할마다 고른 것이라, 앵커를 옮기면
    // 여기가 먼저 깨진다.
    for (const role of ROLE_ORDER) {
      const [a, b, c] = FEATURES.map((f) => subAnchor(role, f) as V3);
      for (const d of [screenDist(a, b), screenDist(a, c), screenDist(b, c)]) {
        expect(d, role).toBeGreaterThan(40);
      }
    }
  });
});
```

`모든 Field 는 각 모드의 제한 안에서 도달 가능하다` describe 와 `기본 진입 뷰는 A·B·C 세 모드의 제한 안에 있다` describe 는 **로직을 바꾸지 않는다.** 앞의 것만 `FIELD_CENTERS[role]` → `ROLE_ANCHORS[role].anchor` 로 바꾸고 describe 이름을 `모든 Role 구역은 각 모드의 제한 안에서 도달 가능하다` 로 고친다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_lib/layout.test.ts`
Expected: FAIL — `ROLE_ANCHORS`, `subAnchor`, `ANCHOR_RADIUS`, `SPREAD` 가 없고 `positionFor` 시그니처가 다르다.

- [ ] **Step 3: `layout.ts` 를 다시 쓴다**

파일 전체를 아래로 교체한다. 46행~199행의 Field 지오메트리 블록은 통째로 사라진다.

```ts
import type { Feature, RelationRole } from "../_data/roles";

export type Vec3 = readonly [number, number, number];

export const SELF_POSITION: Vec3 = [0, 0, 0];

/** 시드 기반 0..1. Math.random 을 쓰면 렌더마다 월드가 흔들린다. */
function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 11.7) * 43758.5453;
  return x - Math.floor(x);
}

/** 5개 Role 구역이 나로부터 떨어진 거리. 다섯 다 같다. */
export const ANCHOR_RADIUS = 7;

/**
 * 소구역을 앵커 방향에서 기울이는 각도(rad).
 *
 * 12° 인 근거는 실측한 교환비다 — 8° 는 소구역이 화면에서 32px 로 뭉치고,
 * 15° 이상이면 역할 그룹이 서로 섞여 최근접 이웃이 같은 역할인 사람이
 * 18/20 에서 14/20 으로 떨어진다. 12° 가 소구역 48px 과 응집 18/20 을
 * 동시에 지키는 지점이다.
 */
const SUB_TILT = (12 * Math.PI) / 180;

/**
 * Role 앵커와 소구역 삼각형의 방향.
 *
 * 좌표는 **화면 배치에서 역산했다.** 375×812 진입 화면에서 원점 깊이의 가시
 * 범위는 가로 ±5.77 / 세로 ±12.49 월드 단위라 가로 여유가 세로의 절반도 안
 * 된다. 이 제약 아래 무작위 탐색은 앵커끼리 19px 까지 붙는 해를 냈다. 그래서
 * 목표 화면 좌표를 지정하고, 그 화면점을 지나는 시선과 구면 |p| = 7 의 교점을
 * 풀었다(근/원 교점 선택으로 깊이를 벌린다).
 *
 * 결과: 앵커 간 화면 최소거리 123px, 깊이 20.86~33.16, 5개 전부 진입 화면 안.
 * 인원이 많은 Role 에 넓은 자리를 줬다(인성 6 · 비겁 5 · 식상 4 · 재성 3 · 관성 2).
 *
 * phase 는 소구역 셋의 화면 간격이 최대가 되도록 역할마다 따로 골랐다.
 * **앵커를 옮기면 phase 도 다시 풀어야 한다** — 그냥 두면 세 소구역이 화면에서
 * 한 점으로 뭉칠 수 있다.
 */
export const ROLE_ANCHORS: Record<
  RelationRole,
  { readonly anchor: Vec3; readonly phase: number }
> = {
  move: { anchor: [-1.7653, 6.2975, -2.495], phase: 0.4451 }, //    화면 (132, 195) 깊이 27.69
  beside: { anchor: [1.2101, 4.8569, 4.8935], phase: 2.6878 }, //   화면 (238, 258) 깊이 20.86
  refine: { anchor: [2.6854, -2.4885, -5.9662], phase: 3.8921 }, // 화면 (258, 432) 깊이 33.16
  fill: { anchor: [0.8922, -4.3054, 5.4468], phase: 1.2479 }, //    화면 (222, 618) 깊이 22.52
  express: { anchor: [-2.5795, -4.6397, -4.5628], phase: 1.946 }, // 화면 (118, 498) 깊이 32.32
};

/** 소구역 삼각형에서 각 상태가 차지하는 꼭짓점. */
const STATE_INDEX: Record<Feature, number> = { none: 0, yukhap: 1, chung: 2 };

/**
 * 소구역 안에서 사람이 흩어지는 반경.
 *
 * 기본은 느슨한 무리, 六合·沖 은 또렷한 자리다. 六合 이 8%, 沖 이 8% 라
 * 그 두 칸은 대개 한 명이거나 비어 있다 — 반경을 크게 주면 한 명이 흩어진
 * 무리의 낙오자로 보인다. 六合 과 沖 은 언제나 같은 값이어야 한다.
 */
export const SPREAD: Record<Feature, number> = { none: 1.15, yukhap: 0.5, chung: 0.5 };

/** seed 를 만들 때 쓰는 역할 순번. 값 자체에 의미는 없지만 바꾸면 배치가 통째로 달라진다. */
const ROLE_INDEX: Record<RelationRole, number> = {
  move: 0,
  beside: 1,
  refine: 2,
  fill: 3,
  express: 4,
};

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** 로드리게스 회전. **길이를 보존한다** — 이 설계 전체가 그 성질 위에 서 있다. */
function rotate(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const k = normalize(axis);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const kv = cross(k, v);
  const kd = dot(k, v);
  return [
    v[0] * c + kv[0] * s + k[0] * kd * (1 - c),
    v[1] * c + kv[1] * s + k[1] * kd * (1 - c),
    v[2] * c + kv[2] * s + k[2] * kd * (1 - c),
  ];
}

/**
 * 소구역 중심. 앵커 방향을 SUB_TILT 만큼 기울인 뒤 앵커 축으로 120° 씩 돌린
 * 정삼각형의 한 꼭짓점이다.
 *
 * **회전만 쓴다.** 그래서 |subAnchor| == ANCHOR_RADIUS 가 부동소수점 오차
 * 범위에서 성립하고, 궁합은 방향에만 영향을 주고 거리에는 영향을 줄 수 없다.
 * 스케일이나 평행이동을 섞으면 그 보증이 즉시 깨진다.
 *
 * ±각도로 두 방향만 벌리지 않는 이유: 그러면 세 점이 한 대원 위에 놓여,
 * 그 평면을 따라 보는 시점에서 셋이 한 줄로 겹친다. 정삼각형이면 어느
 * 시점에서도 최대 둘까지만 겹친다.
 */
export function subAnchor(role: RelationRole, feature: Feature): Vec3 {
  const { anchor, phase } = ROLE_ANCHORS[role];
  const dir = normalize(anchor);
  // dir 과 나란한 축을 고르면 외적이 0 이 된다. move 의 dir[1] 은 0.8996 으로
  // 이 문턱 바로 아래다 — 앵커를 옮길 때 layout.test.ts 의 외적 크기 테스트를
  // 반드시 통과시켜야 한다.
  const ref: Vec3 = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const tilted = rotate(anchor, normalize(cross(dir, ref)), SUB_TILT);
  return rotate(tilted, dir, phase + (STATE_INDEX[feature] * 2 * Math.PI) / 3);
}

/**
 * 사람 한 명의 좌표.
 *
 * indexInSubRegion 은 **(role, feature) 쌍 안에서** 0부터 센다. Role 안 전체
 * 순번으로 세면 한 사람이 빠졌을 때 같은 소구역의 다른 사람들이 전부 자리를 옮긴다.
 */
export function positionFor(
  role: RelationRole,
  feature: Feature,
  indexInSubRegion: number,
): Vec3 {
  const center = subAnchor(role, feature);
  const spread = SPREAD[feature];
  const s = (ROLE_INDEX[role] * 97 + STATE_INDEX[feature] * 31 + indexInSubRegion) * 7;

  // 구 내부 균등 분포. cbrt 없이 반지름을 균등하게 뽑으면 중심에 몰린다.
  const u = hash01(s + 1) * 2 - 1;
  const theta = hash01(s + 2) * Math.PI * 2;
  const r = spread * Math.cbrt(hash01(s + 3));
  const flat = Math.sqrt(1 - u * u);

  return [
    center[0] + r * flat * Math.cos(theta),
    center[1] + r * u,
    center[2] + r * flat * Math.sin(theta),
  ];
}

/**
 * placePeople 이 볼 수 있는 전부.
 *
 * 예전에는 feature 가 여기 없었다 — 배치가 궁합을 읽는 것 자체를 타입이
 * 막았다. 소구역이 feature 로 갈리는 지금은 그 방어가 불가능하다. 대신
 * subAnchor 가 회전만 쓰므로 궁합이 거리를 바꿀 수 없고, layout.test.ts 의
 * 등거리 테스트가 그것을 지킨다. 타입 방어보다 약하다는 것을 알고 하는 교환이다.
 */
export type Placeable = {
  readonly id: string;
  readonly role: RelationRole;
  readonly feature: Feature;
};

export function placePeople(people: readonly Placeable[]): Map<string, Vec3> {
  const seen = new Map<string, number>();
  const out = new Map<string, Vec3>();

  for (const person of people) {
    const key = `${person.role}/${person.feature}`;
    const index = seen.get(key) ?? 0;
    seen.set(key, index + 1);
    out.set(person.id, positionFor(person.role, person.feature, index));
  }

  return out;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_lib/layout.test.ts`
Expected: PASS.

계획을 쓰기 전에 이 배치의 실측값을 이미 재 뒀다 — 3D 최소 간격 0.2579, 앵커 간 3D 5.858 / 화면 123px, 소구역 삼각형 변 2.5208 / 화면 최소 48px. **테스트가 실패하면 구현이 이 값들에서 벗어난 것이다.** 임계값을 조정하기 전에 실제 값을 출력해서 위와 비교하고, 차이가 나는 이유를 찾는다. 임계값을 초록이 될 때까지 맞추지 않는다.

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world/_lib/layout.ts src/app/lab/relationship-world/_lib/layout.test.ts
git commit -m "feat(lab): 배치를 구면 앵커 5개 × 정삼각형 소구역 3개로 다시 세운다"
```

---

## Task 5: 노드 배선 — PersonNode · PersonMarker · SelfCore

**Files:**
- Modify: `src/app/lab/relationship-world/_components/PersonNode.tsx`
- Modify: `src/app/lab/relationship-world/_components/PersonMarker.tsx`
- Modify: `src/app/lab/relationship-world/_components/SelfCore.tsx`
- Modify: `src/app/lab/relationship-world/_components/World.tsx`

**Interfaces:**
- Consumes: `nodeColor`/`roleColor` (Task 1), `STATE_VISUAL`/`stateLight`/`CORE_RADIUS`/`DIFFUSE_HALO_RADIUS`/`SELF_NODE_SCALE` (Task 3), `placePeople`/`Placeable` (Task 4)
- Produces: `PersonNode` props `{ position: Vec3; role: RelationRole; feature: Feature; selected: boolean; dimmed: boolean; nodeScale?: number }`

- [ ] **Step 1: `PersonNode.tsx` 를 다시 쓴다**

`pillarKey` 를 받지 않는다. 색은 `nodeColor(role, feature)`, halo 기하와 알파는 `STATE_VISUAL[feature]` 에서 온다.

```tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { nodeColor } from "../_data/role-colors";
import type { Feature, RelationRole } from "../_data/roles";
import type { Vec3 } from "../_lib/layout";
import {
  CORE_RADIUS,
  DIFFUSE_HALO_RADIUS,
  HALO_TEXTURE_SIZE,
  STATE_VISUAL,
  radialFalloff,
} from "../_lib/node-visual";

/**
 * 21명이 공유하는 halo 텍스처 한 장. 모듈 스코프에서 딱 한 번 만든다.
 * DataTexture 는 렌더러가 업로드하기 전까지 DOM 을 건드리지 않아 SSR 에서 안전하다.
 */
const HALO_TEXTURE = (() => {
  const texture = new THREE.DataTexture(
    radialFalloff(HALO_TEXTURE_SIZE),
    HALO_TEXTURE_SIZE,
    HALO_TEXTURE_SIZE,
  );
  texture.needsUpdate = true;
  // DataTexture 는 일반 Texture 와 달리 min/magFilter 기본값이 둘 다
  // NearestFilter 다. 그대로 두면 가까이서 동심 사각 계단이 보이고,
  // 멀어지면 밉맵 없는 점 샘플링이라 카메라를 돌릴 때마다 밝기가 튄다.
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return texture;
})();

/** 선택·dim 이 알파에 거는 배율. 세 상태 모두에 같은 비율로 걸어 균형을 깨지 않는다. */
const ALPHA_SCALE = { selected: 1.5, base: 1, dimmed: 0.22 } as const;

export function PersonNode({
  position,
  role,
  feature,
  selected,
  dimmed,
  nodeScale = 1,
}: {
  position: Vec3;
  role: RelationRole;
  feature: Feature;
  selected: boolean;
  dimmed: boolean;
  /** 코어와 근접 halo 에 함께 걸린다. 확산 halo 는 모두가 같은 크기다. */
  nodeScale?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const nearSprite = useRef<THREE.Sprite>(null);
  const diffuseSprite = useRef<THREE.Sprite>(null);
  const nearMat = useRef<THREE.SpriteMaterial>(null);
  const diffuseMat = useRef<THREE.SpriteMaterial>(null);

  const visual = STATE_VISUAL[feature];
  const color = useMemo(() => new THREE.Color(nodeColor(role, feature)), [role, feature]);

  const nearDiameter = visual.nearRadius * 2 * nodeScale;
  const diffuseDiameter = DIFFUSE_HALO_RADIUS * 2;

  useFrame((state, delta) => {
    const k = Math.min(1, delta * 6);
    const scale = selected ? ALPHA_SCALE.selected : dimmed ? ALPHA_SCALE.dimmed : ALPHA_SCALE.base;

    if (nearMat.current) {
      const target = Math.min(1, visual.nearAlpha * scale);
      nearMat.current.opacity += (target - nearMat.current.opacity) * k;
    }
    if (diffuseMat.current) {
      const target = Math.min(1, visual.diffuseAlpha * scale);
      diffuseMat.current.opacity += (target - diffuseMat.current.opacity) * k;
    }

    // 六合: 느린 호흡. 두 halo 를 **같은 배율로** 늘린다 — stateLight 의 시간
    // 평균 보정이 전체 T 에 걸린 값이라, 한쪽만 늘리면 광량 불변식이 깨진다.
    if (visual.breatheAmplitude > 0) {
      const s =
        1 +
        visual.breatheAmplitude *
          Math.sin((state.clock.elapsedTime * 2 * Math.PI) / visual.breathePeriod);
      nearSprite.current?.scale.set(nearDiameter * s, nearDiameter * s, 1);
      diffuseSprite.current?.scale.set(diffuseDiameter * s, diffuseDiameter * s, 1);
    }

    // 沖: 미세한 떨림. 진폭은 작게 — 크면 고장으로 보인다.
    if (visual.tremorAmplitude > 0 && group.current) {
      const t = state.clock.elapsedTime * visual.tremorHz * 2 * Math.PI;
      const a = visual.tremorAmplitude;
      group.current.position.set(
        position[0] + Math.sin(t) * a,
        position[1] + Math.sin(t * 1.7) * a * 0.6,
        position[2] + Math.cos(t * 1.3) * a,
      );
    }
  });

  return (
    <group ref={group} position={position as unknown as [number, number, number]}>
      {/*
        코어만 opaque 다. transparent 로 두면 three 의 transparent 큐로 가는데,
        그 큐는 픽셀이 아니라 오브젝트 원점 거리로 정렬된다 — 앞뒤 가림이
        오브젝트 단위로 뭉개진다. opaque 패스에 남겨야 깊이 버퍼를 채우고,
        뒤따르는 모든 halo 가 이 코어를 상대로 진짜 depth test 를 받는다.
      */}
      <mesh>
        <sphereGeometry args={[CORE_RADIUS * nodeScale, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>

      <sprite ref={nearSprite} scale={[nearDiameter, nearDiameter, 1]}>
        <spriteMaterial
          ref={nearMat}
          map={HALO_TEXTURE}
          color={color}
          transparent
          opacity={visual.nearAlpha}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      {/* 이웃과 겹쳐서 구역의 색 기운을 만드는 층. 혼자 있을 땐 거의 안 보인다. */}
      <sprite ref={diffuseSprite} scale={[diffuseDiameter, diffuseDiameter, 1]}>
        <spriteMaterial
          ref={diffuseMat}
          map={HALO_TEXTURE}
          color={color}
          transparent
          opacity={visual.diffuseAlpha}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}
```

- [ ] **Step 2: `PersonMarker.tsx` 를 고친다**

세 곳만 바꾼다.

1. import 를 `paletteFor` → `roleColor` 로:
```tsx
import { roleColor } from "../_data/role-colors";
```
2. `FAR` 상수를 `33` → `36` 으로 바꾸고 주석을 갱신한다:
```tsx
// 새 앵커의 깊이는 20.86~33.16 이고 관성 사람들은 32~34.3 에 놓인다.
// FAR = 33 이면 관성 2명이 진입 화면에서 전부 dot 이 되어 이름이 안 보인다 —
// 명패 티어가 Role 과 상관관계를 갖는 것은 의도가 아니다. dot 은 여전히
// 죽은 코드가 아니다(C 모드 최대 줌아웃 65).
const FAR = 36;
```
3. `dotColor` 와 `<PersonNode>` 호출:
```tsx
// dot 은 이름이 안 보이는 티어라 색이 유일한 단서다. 그 단서는 Role 이어야 한다.
const dotColor = roleColor(person.role);
```
```tsx
<PersonNode
  position={position}
  role={person.role}
  feature={person.feature}
  selected={selected}
  dimmed={dimmed}
/>
```

- [ ] **Step 3: `SelfCore.tsx` 를 고친다**

`PersonNode` 의 새 props 를 쓴다. 나는 **비겁 색 · 기본 상태**다.

```tsx
"use client";

import { Html } from "@react-three/drei";
import { SELF } from "../_data/mock-people";
import { SELF_POSITION } from "../_lib/layout";
import { SELF_NODE_SCALE } from "../_lib/node-visual";
import { PersonNode } from "./PersonNode";

/**
 * 나도 다른 사람과 같은 규칙을 따른다 — 같은 3층 구조, 같은 색 체계.
 * 다른 것은 크기 하나뿐이다(SELF_NODE_SCALE).
 *
 * 색은 비겁(beside)이다. 나와 나란히 서는 관계가 비겁이므로 나 자신이 그
 * 색상 가족의 원점이다. 상태는 기본 — 나는 나 자신과 六合 하지도 沖 하지도 않는다.
 */
export function SelfCore() {
  return (
    <group>
      <PersonNode
        position={SELF_POSITION}
        role="beside"
        feature="none"
        selected={false}
        dimmed={false}
        nodeScale={SELF_NODE_SCALE}
      />

      <Html
        center
        position={SELF_POSITION as unknown as [number, number, number]}
        zIndexRange={[10, 0]}
      >
        <span className="block translate-y-[-34px] text-[12px] font-semibold tracking-[0.14em] text-slate-200/85 select-none">
          {SELF.name}
        </span>
      </Html>
    </group>
  );
}
```

- [ ] **Step 4: `World.tsx` 의 dim 규칙을 확인한다**

`World.tsx` 는 `placed.get(person.id)!` 을 그대로 쓴다. `placePeople(FRIENDS)` 호출은 변경이 없다 — `MockPerson` 이 이미 `feature` 를 갖고 있어 새 `Placeable` 을 만족한다. **코드 수정 없이 타입이 맞는지만 확인한다.** 맞지 않으면 `Placeable` 정의를 다시 본다.

- [ ] **Step 5: 타입 체크와 전체 테스트**

Run: `npx tsc --noEmit`
Expected: 오류 없음.

Run: `npm test -- --run`
Expected: 전부 PASS.

- [ ] **Step 6: 빌드**

Run: `npm run build`
Expected: `✓ Compiled successfully` 와 라우트 표에 `○ /lab/relationship-world`.

- [ ] **Step 7: 커밋**

```bash
git add src/app/lab/relationship-world/_components/
git commit -m "feat(lab): 노드를 Role 색 + 상태 변조로 배선하고 六合 호흡·沖 진동을 넣는다"
```

---

## Task 6: 연결선을 Role 색으로

**Files:**
- Modify: `src/app/lab/relationship-world/_lib/connections.ts`
- Modify: `src/app/lab/relationship-world/_lib/connections.test.ts`
- Modify: `src/app/lab/relationship-world/_components/ConnectionLines.tsx`
- Modify: `src/app/lab/relationship-world/_components/World.tsx`

**Interfaces:**
- Consumes: `roleColor` (Task 1), `SELF_POSITION`/`Vec3` (Task 4)
- Produces:
  - `connectionSegments(targets: readonly Vec3[]): Float32Array` (기존, 시그니처 불변)
  - `connectionColors(roles: readonly RelationRole[]): Float32Array` — 정점당 RGB, 사람당 정점 2개
  - `CONNECTION_SELF_DIM = 0.25`

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`connections.test.ts` 의 기존 describe 는 그대로 두고 아래를 덧붙인다.

```ts
import { ROLE_HUE, roleColor } from "../_data/role-colors";
import { CONNECTION_SELF_DIM, connectionColors } from "./connections";
import type { RelationRole } from "../_data/roles";

function hexToUnit(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
}

describe("connectionColors", () => {
  const roles: RelationRole[] = ["fill", "beside", "refine"];

  it("사람 한 명당 정점 두 개의 RGB 를 만든다", () => {
    expect(connectionColors(roles)).toHaveLength(roles.length * 6);
  });

  it("사람 쪽 끝이 그 사람의 Role 색이다", () => {
    const data = connectionColors(roles);
    roles.forEach((role, i) => {
      const [r, g, b] = hexToUnit(roleColor(role));
      expect(data[i * 6 + 3]).toBeCloseTo(r, 5);
      expect(data[i * 6 + 4]).toBeCloseTo(g, 5);
      expect(data[i * 6 + 5]).toBeCloseTo(b, 5);
    });
  });

  it("나 쪽 끝은 같은 색을 같은 비율로 죽인다 — 중심에서 20개가 뭉치지 않게", () => {
    const data = connectionColors(roles);
    roles.forEach((role, i) => {
      const [r, g, b] = hexToUnit(roleColor(role));
      expect(data[i * 6]).toBeCloseTo(r * CONNECTION_SELF_DIM, 5);
      expect(data[i * 6 + 1]).toBeCloseTo(g * CONNECTION_SELF_DIM, 5);
      expect(data[i * 6 + 2]).toBeCloseTo(b * CONNECTION_SELF_DIM, 5);
    });
  });

  it("모든 역할이 서로 다른 선 색을 받는다", () => {
    const all = (Object.keys(ROLE_HUE) as RelationRole[]).map(roleColor);
    expect(new Set(all).size).toBe(all.length);
  });

  it("사람이 없으면 빈 배열이다", () => {
    expect(connectionColors([])).toHaveLength(0);
  });
});
```

`connectionColors` 는 feature 를 인자로 받지 않는다 — **받을 수 없게 두는 것이 요점이다.** 선이 궁합의 강약을 말하기 시작하면 안 된다. 시그니처가 `RelationRole[]` 뿐이라 그 실수를 할 수 없다.

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_lib/connections.test.ts`
Expected: FAIL — `connectionColors`, `CONNECTION_SELF_DIM` 이 없다.

- [ ] **Step 3: `connections.ts` 에 추가한다**

기존 `connectionSegments`, `CONNECTION_COLOR`, `CONNECTION_OPACITY` 는 그대로 두되 `CONNECTION_COLOR` 는 더 이상 쓰이지 않으므로 삭제한다. 아래를 추가한다.

```ts
import { roleColor } from "../_data/role-colors";
import type { RelationRole } from "../_data/roles";

/**
 * 나 쪽 끝에서 선 색을 죽이는 비율.
 *
 * 20개 선이 원점 한 점으로 모이므로, 양 끝을 같은 채도로 칠하면 중심이
 * 스무 가지 색으로 탁해진다. 사람 쪽에서 자기 Role 색이 살고 나 쪽으로
 * 갈수록 어두워지면 다섯 갈래가 뻗어 나가는 구조가 그대로 읽힌다.
 *
 * **모든 역할에 같은 비율로 건다.** 역할마다 다르면 그 순간 어떤 관계가
 * 더 진하게 이어져 있다는 뜻이 된다.
 */
export const CONNECTION_SELF_DIM = 0.25;

/**
 * LineSegments 의 정점 색. 사람 한 명당 두 정점(나 쪽, 사람 쪽).
 *
 * feature 를 인자로 받지 않는다 — 받을 수 있게 두면 언젠가 六合 선을 밝게
 * 하고 싶어진다. 그러면 선이 관계의 좋고 나쁨을 말하기 시작한다.
 */
export function connectionColors(roles: readonly RelationRole[]): Float32Array {
  const out = new Float32Array(roles.length * 6);

  roles.forEach((role, i) => {
    const hex = roleColor(role);
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    out[i * 6] = r * CONNECTION_SELF_DIM;
    out[i * 6 + 1] = g * CONNECTION_SELF_DIM;
    out[i * 6 + 2] = b * CONNECTION_SELF_DIM;
    out[i * 6 + 3] = r;
    out[i * 6 + 4] = g;
    out[i * 6 + 5] = b;
  });

  return out;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_lib/connections.test.ts`
Expected: PASS.

- [ ] **Step 5: `ConnectionLines.tsx` 가 정점 색을 쓰게 한다**

```tsx
"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  CONNECTION_OPACITY,
  connectionColors,
  connectionSegments,
} from "../_lib/connections";
import type { Vec3 } from "../_lib/layout";
import type { RelationRole } from "../_data/roles";

/**
 * 나와 모든 사람을 잇는 기본 연결선. 규칙과 상수의 근거는 _lib/connections.ts 에.
 *
 * 노드 코어가 진입 화면에서 4.9px 로 작기 때문에, 다섯 갈래로 갈린 선이
 * 구역을 대신 말해준다. 20개를 각각 Line 객체로 만들면 드로우콜이 20개
 * 나지만 하나의 LineSegments 에 정점 색으로 넣으면 하나다.
 */
export function ConnectionLines({
  targets,
  roles,
}: {
  targets: readonly Vec3[];
  roles: readonly RelationRole[];
}) {
  const object = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(connectionSegments(targets), 3),
    );
    geometry.setAttribute("color", new THREE.BufferAttribute(connectionColors(roles), 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: CONNECTION_OPACITY,
      // 선끼리 서로를 가리면 안 된다. 깊이 '테스트'는 켜둔 채라 사람의 opaque
      // 코어 뒤로 지나가는 구간은 제대로 가려진다 — 앞뒤 깊이감이 유지된다.
      depthWrite: false,
    });

    return new THREE.LineSegments(geometry, material);
  }, [targets, roles]);

  useEffect(() => {
    // <primitive> 는 자동 해제되지 않는다. RelationThread 와 같은 이유, 같은 처리.
    return () => {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    };
  }, [object]);

  return <primitive object={object} />;
}
```

- [ ] **Step 6: `World.tsx` 가 roles 를 넘기게 한다**

`targets` 옆에 `roles` 를 메모한다. 둘 다 참조가 고정이어야 `useMemo` 가 매 프레임 지오메트리를 다시 만들지 않는다.

```tsx
const targets = useMemo(() => FRIENDS.map((p) => placed.get(p.id)!), [placed]);
const roles = useMemo(() => FRIENDS.map((p) => p.role), []);
```
```tsx
<ConnectionLines targets={targets} roles={roles} />
```

- [ ] **Step 7: 타입 체크와 전체 테스트**

Run: `npx tsc --noEmit`
Expected: 오류 없음.

Run: `npm test -- --run`
Expected: 전부 PASS.

- [ ] **Step 8: 커밋**

```bash
git add src/app/lab/relationship-world/_lib/connections.ts src/app/lab/relationship-world/_lib/connections.test.ts src/app/lab/relationship-world/_components/ConnectionLines.tsx src/app/lab/relationship-world/_components/World.tsx
git commit -m "feat(lab): 연결선을 Role 색으로 칠해 다섯 갈래가 선에서도 읽히게 한다"
```

---

## Task 7: 상세 시트 — 15개 표시명 3층 구조와 사주색 칩

**Files:**
- Modify: `src/app/lab/relationship-world/_components/PersonSheet.tsx`

**Interfaces:**
- Consumes: `DISPLAY_TITLES`/`FEATURE_NOTE`/`ROLE_LABELS` (Task 2), `roleColor` (Task 1), `paletteFor` (`_data/saju-colors.ts`, 기존)

- [ ] **Step 1: 시트를 고친다**

브리프 §4.2 의 3층 구조를 만든다. `FEATURE_NOTE` 와 `ROLE_NOTE` 의 지역 정의를 지우고 `roles.ts` 에서 가져온다. `ROLE_NOTE` 는 `PersonSheet` 안에 그대로 둔다 — 시트 전용 문구다.

바꾸는 부분만:

```tsx
import { Badge } from "@/components/Badge";
import { DISPLAY_TITLES, FEATURE_LABELS, FEATURE_NOTE, ROLE_LABELS, type RelationRole } from "../_data/roles";
import { roleColor } from "../_data/role-colors";
import { paletteFor } from "../_data/saju-colors";
import type { MockPerson } from "../_data/mock-people";
```

지역 `const FEATURE_NOTE = {...}` 정의를 삭제한다. `ROLE_NOTE` 는 남긴다.

헤더 블록(`<div className="flex items-start justify-between gap-3">` 안)을 이렇게 바꾼다:

```tsx
<div>
  {/*
    브리프 §4.2: 관계 별명을 가장 먼저 보여준다. "민수는 내 라이벌" 처럼
    캡처해서 공유했을 때 문장이 사는 것이 이 줄의 목적이다.
  */}
  <p className="text-[13px] font-semibold tracking-[0.08em] m-0"
     style={{ color: roleColor(shown.role) }}>
    {DISPLAY_TITLES[shown.role][shown.feature]}
  </p>
  <h2 className="text-2xl font-bold tracking-[-0.02em] m-0 mt-0.5">{shown.name}</h2>
  <p className="text-[15px] text-slate-500 mt-1 m-0 flex items-center gap-1.5">
    {/*
      사주색은 노드에서 내려왔지만 사라지지 않았다. 그 사람이 누구인가는
      한 층 아래로 갈 뿐이다 (브리프 §8).
    */}
    <span
      aria-hidden
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ backgroundColor: paletteFor(shown.pillarKey).core }}
    />
    {shown.sceneName}
  </p>
</div>
```

설명 문단 두 개를 이렇게 바꾼다:

```tsx
<p className="text-[15px] leading-relaxed text-slate-700 mt-4 m-0">
  {ROLE_NOTE[shown.role]}
</p>

{/* 기본 상태의 FEATURE_NOTE 는 빈 문자열이라 아무것도 렌더링되지 않는다 */}
{FEATURE_NOTE[shown.feature] && (
  <p className="text-[15px] leading-relaxed text-slate-700 mt-2 m-0">
    {FEATURE_NOTE[shown.feature]}
  </p>
)}
```

배지 블록은 그대로 둔다.

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 오류 없음.

- [ ] **Step 3: 전체 테스트와 빌드**

Run: `npm test -- --run`
Expected: 전부 PASS.

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 4: 죽은 코드가 남았는지 확인한다**

Run: `npx vitest run 2>/dev/null; npx tsc --noEmit`

그리고 아래를 직접 확인한다. 하나라도 남아 있으면 지운다.
- `_lib/layout.ts` 에 `FIELD_CENTERS` / `FIELD_EXTENT` / `REFINE_*` / `EXPRESS_*` / `MOVE_*` / `BESIDE_*` 가 남아 있지 않다
- `_data/saju-colors.ts` 에 지역 `hslToHex` 가 남아 있지 않다
- `_lib/connections.ts` 에 `CONNECTION_COLOR` 가 남아 있지 않다
- `_lib/node-visual.ts` 에 `HALO_ALPHA` / `NEAR_HALO_RADIUS` / `SELF_CORE_SCALE` 이 남아 있지 않다
- 삭제된 파일을 가리키는 주석이 없다

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world/_components/PersonSheet.tsx
git commit -m "feat(lab): 상세 시트에 관계 별명 3층 구조와 사주색 칩을 넣는다"
```

---

## 실행 후 사람이 볼 차례

이 계획의 모든 수치는 계산과 실측이고, **렌더된 프레임은 아무도 보지 않았다.** 이 세션에서만 계산해 둔 값이 두 번 틀렸다. 구현이 끝나면 다음을 사람이 375px 에서 확인해야 한다.

1. **색만 보고 다섯 구역이 묶여 보이는가** — 이 라운드의 존재 이유다(브리프 §7 첫 항목)
2. **같은 Role 안에서 기본 / 六合 / 沖 이 서로 다르게 느껴지는가.** 그러면서 **어느 하나가 더 세 보이지 않는가** — 적분 광량은 같게 맞췄지만 지각 밝기는 다를 수 있다
3. **15칸짜리 차트처럼 보이지 않는가** — 경계선을 안 그렸으니 구역이 뭉개져 하나로 보일 위험도 같이 있다
4. **모바일 375px 에서 명패와 글로우가 겹치지 않는가** — `FAR` 을 36 으로 올렸지만 확산 halo 는 여전히 지름 104px 다
5. **관성 沖 이 비어 있는 것이 결함으로 보이지 않는가** — 실사용에서는 15칸 중 10칸이 대개 빈다

값을 만질 곳은 세 파일이다: `_data/role-colors.ts`(색), `_lib/node-visual.ts`(빛), `_lib/layout.ts`(자리).
