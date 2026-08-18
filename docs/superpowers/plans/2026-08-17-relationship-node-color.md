# 사람 Node 사주색 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/lab/relationship-world` 에서 5개 Field 오브젝트를 걷어내고, 사람마다 자기 사주색을 가진 3층 Node 로 존재하게 해서 그 빛이 겹쳐 공간이 생기게 한다.

**Architecture:** 색 계산은 `_data/saju-colors.ts` 한 곳의 순수 함수(천간 → hue, 지지 → 채도·명도 변조)에 모은다. 시각 상수와 halo falloff 는 `_lib/node-visual.ts` 한 곳에 모은다. 두 모듈 다 React·three·DOM 을 import 하지 않아 node 환경 테스트로 전부 잠긴다. 렌더 쪽(`PersonNode`, `PersonMarker`, `SelfCore`)은 그 값을 받아 쓰기만 한다.

**Tech Stack:** Next.js 16.2.10 App Router · React 19.2.4 · TypeScript strict · three 0.185.1 · @react-three/fiber 9.7.0 · @react-three/drei 10.7.8 · vitest 4 (`environment: "node"`)

**설계 문서:** `docs/superpowers/specs/2026-08-17-relationship-node-color-design.md`

## Global Constraints

- 테스트 환경은 `environment: "node"` 다. jsdom 도 `@testing-library` 도 없다. **테스트 파일이 import 하는 모듈 그래프에 React·three·DOM 이 들어가면 안 된다.**
- `_lib/layout.ts` 와 `layout.test.ts` 는 이 계획에서 **한 글자도 바꾸지 않는다.** 배치는 그대로다.
- 거리·위치는 절대 `feature`(六合/沖)를 참조하지 않는다. `Placeable` 타입에 `feature` 필드가 없어 컴파일 단계에서 막혀 있다 — 이 방벽을 우회하지 않는다.
- 六合 과 沖 은 같은 색·같은 밝기여야 한다. `RelationThread.tsx` 는 건드리지 않는다.
- 배경은 `#0F172A` 다(`World.tsx`). 색 대비 계산은 전부 이 값 기준이다.
- 채도 상한: glow 색 55%. core 는 여기에 +15 되므로 상한 대상이 아니다.
- 주석은 한국어로 쓴다. 기존 파일들의 관행을 따른다 — "무엇을" 이 아니라 "왜" 를 적는다.
- 커밋 메시지는 한국어, `타입(lab): 요약` 형식. 예: `feat(lab): 사람 Node 에 사주색을 준다`
- 모든 작업 디렉터리는 저장소 루트 `C:\Users\kimwi\OneDrive\Desktop\dev\4-pillars` 다. 워크트리가 아니다.

---

### Task 1: Field 오브젝트 제거

**Files:**
- Delete: `src/app/lab/relationship-world/_components/fields/` (디렉터리 전체, 13개 파일)
- Modify: `src/app/lab/relationship-world/_components/World.tsx`

**Interfaces:**
- Consumes: 없음 (첫 작업)
- Produces: `World.tsx` 가 `FieldRegistry` 를 더 이상 렌더하지 않는 상태. 이후 모든 작업은 이 상태 위에서 진행한다.

이 디렉터리는 `World.tsx` 두 줄에서만 참조된다(import 1줄, 렌더 1줄). 다른 진입점은 없다.

- [ ] **Step 1: 현재 테스트 수를 기록한다**

Run: `npx vitest run 2>&1 | tail -5`

Expected: `Test Files 72 passed (72)` / `Tests 527 passed (527)`

이 숫자를 적어둔다. 삭제 후 정확히 11개(tint 4 + materials 7)가 줄어야 한다.

- [ ] **Step 2: 디렉터리를 지운다**

```bash
git rm -r src/app/lab/relationship-world/_components/fields
```

- [ ] **Step 3: World.tsx 에서 두 줄을 지운다**

`src/app/lab/relationship-world/_components/World.tsx` 에서 아래 import 를 삭제한다:

```tsx
import { FieldRegistry } from "./fields/FieldRegistry";
```

그리고 아래 블록을 통째로 삭제한다:

```tsx
      {ROLE_ORDER.map((role) => (
        <FieldRegistry key={role} role={role} dimmed={selected !== null && selected.role !== role} />
      ))}
```

`ROLE_ORDER` 는 이 블록에서만 쓰이므로 5번 줄의 import 도 함께 삭제한다:

```tsx
import { ROLE_ORDER } from "../_data/roles";
```

- [ ] **Step 4: 남은 주석을 고친다**

`World.tsx` 65-69번 줄 근처의 주석이 "dim 은 '다른 성운'에만 건다" 로 시작한다. 성운(Field)이 사라졌으므로 아래로 교체한다:

```tsx
      {/*
        dim 은 '다른 role 그룹'에만 건다. 같은 그룹 사람까지 흐리면 boosted 로 한
        단계 올린 명패가 흐려진 채 커지기만 해서, 선택했을 때 오히려 더 어지럽고
        덜 읽힌다.
      */}
```

- [ ] **Step 5: 타입 검사와 테스트를 돌린다**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | tail -5`

Expected: tsc 통과. `Test Files 70 passed (70)` / `Tests 516 passed (516)`

516 이 아니면 멈추고 무엇이 사라졌는지 보고한다. 527 − 11 = 516 이 정확한 기대값이다.

- [ ] **Step 6: 빌드가 되는지 확인한다**

Run: `npm run build 2>&1 | tail -20`

Expected: 컴파일 성공, 라우트 표에 `○ /lab/relationship-world` 존재

- [ ] **Step 7: 커밋**

```bash
git add -A src/app/lab/relationship-world
git commit -m "refactor(lab): 5개 Field 오브젝트를 제거한다

사람이 Field 안에 들어가는 대신 사람들이 Field 를 만드는 방향으로 간다.
배치(positionFor)는 그대로 두어 role 별 실루엣은 살아 있다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: 사주색 모듈

**Files:**
- Create: `src/app/lab/relationship-world/_data/saju-colors.ts`
- Test: `src/app/lab/relationship-world/_data/saju-colors.test.ts`

**Interfaces:**
- Consumes: `_data/mock-people.ts` 의 `SELF`, `FRIENDS` (테스트에서만)
- Produces:
  ```ts
  export type NodePalette = {
    readonly glow: string;
    readonly core: string;
    readonly coreSelected: string;
    readonly coreDimmed: string;
  };
  export function paletteFor(pillarKey: string): NodePalette;
  export const STEMS: readonly string[];      // 10, 순서 고정
  export const BRANCHES: readonly string[];   // 12, 순서 고정
  ```
  Task 4·5·6 이 `paletteFor` 만 쓴다.

**주의 — 이 작업의 함정:** `신` 은 천간 辛 이면서 지지 申 이다. `"신미"` 의 신은 천간이고 `"무신"` 의 신은 지지다. 반드시 **자리로** 파싱한다(0번째 = 천간, 1번째 = 지지). 글자를 보고 판정하면 두 사람이 같은 색을 받는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/lab/relationship-world/_data/saju-colors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BRANCHES, paletteFor, STEMS } from "./saju-colors";
import { FRIENDS, SELF } from "./mock-people";

const BACKGROUND = "#0f172a";

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
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** hex → HSL. 채도·명도 단언을 위해 테스트가 직접 역산한다(구현을 믿지 않는다). */
function toHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s: s * 100, l: l * 100 };
}

/** 실제 60갑자 — 천간과 지지가 함께 한 칸씩 나아간다. 120개 조합 중 60개만 존재한다. */
const SEXAGENARY = Array.from({ length: 60 }, (_, i) => STEMS[i % 10] + BRANCHES[i % 12]);

describe("paletteFor", () => {
  it("60갑자 전수가 해석되고 core 색이 60개 모두 다르다", () => {
    const cores = SEXAGENARY.map((k) => paletteFor(k).core);
    expect(cores).toHaveLength(60);
    expect(new Set(cores).size).toBe(60);
  });

  it("60갑자가 아닌 조합도 던지지 않는다 — 천간·지지가 각자 유효하면 색이 나온다", () => {
    expect(() => paletteFor("갑축")).not.toThrow();
  });

  it("목록에 없는 글자는 던진다", () => {
    expect(() => paletteFor("한글")).toThrow();
    expect(() => paletteFor("갑")).toThrow();
    expect(() => paletteFor("")).toThrow();
    // '자' 는 지지이지 천간이 아니다 — 0번째 자리에 오면 틀린 것이다.
    expect(() => paletteFor("자갑")).toThrow();
  });

  it("신 을 자리로 구분한다 — 신미의 신은 천간, 무신의 신은 지지다", () => {
    const sinMi = paletteFor("신미");
    const muSin = paletteFor("무신");
    expect(sinMi.glow).not.toBe(muSin.glow);
    // 신미는 금(hue 205), 무신은 토(hue 38)
    expect(Math.round(toHsl(sinMi.glow).h)).toBe(205);
    expect(Math.round(toHsl(muSin.glow).h)).toBe(38);
  });

  it("같은 천간의 12개 일주는 hue 가 같고 (채도, 명도) 쌍이 12개 모두 다르다", () => {
    for (const stem of STEMS) {
      const pairs = BRANCHES.map((b) => {
        const { h, s, l } = toHsl(paletteFor(stem + b).core);
        return { h, key: `${Math.round(s)},${Math.round(l)}` };
      });
      // hex 는 채널당 8비트라 HSL 로 되돌리면 hue 가 조금 흔들린다. 그건 저장
      // 형식의 반올림이지 규칙이 흔들린 게 아니다. 실측 최대는 1.53도(경)이고
      // 여유를 둬 2도로 잡는다. 지지가 hue 를 실제로 건드리면 수십 도가
      // 벌어지므로 이 허용치로도 남김없이 잡힌다.
      const hues = pairs.map((p) => p.h);
      const spread = Math.max(...hues) - Math.min(...hues);
      expect(spread, `${stem}: hue 가 지지에 따라 흔들리면 안 된다`).toBeLessThanOrEqual(2);
      expect(new Set(pairs.map((p) => p.key)).size, `${stem}: 12개 조합`).toBe(12);
    }
  });

  it("core 는 언제나 glow 보다 채도·명도가 높다", () => {
    for (const key of SEXAGENARY) {
      const p = paletteFor(key);
      const glow = toHsl(p.glow);
      const core = toHsl(p.core);
      expect(core.s, `${key} 채도`).toBeGreaterThan(glow.s);
      expect(core.l, `${key} 명도`).toBeGreaterThan(glow.l);
    }
  });

  it("선택은 core 보다 밝고, dim 은 core 보다 어둡고 탁하다", () => {
    for (const key of SEXAGENARY) {
      const p = paletteFor(key);
      const core = toHsl(p.core);
      expect(toHsl(p.coreSelected).l, `${key}`).toBeGreaterThan(core.l);
      expect(toHsl(p.coreDimmed).l, `${key}`).toBeLessThan(core.l);
      expect(toHsl(p.coreDimmed).s, `${key}`).toBeLessThan(core.s);
    }
  });

  it("dim 에서도 hue 는 살아 있다 — 선택 중에 누가 누구인지 사라지면 안 된다", () => {
    for (const key of SEXAGENARY) {
      const p = paletteFor(key);
      // 위와 같은 8비트 반올림이다. 실측 최대는 1.71도(신인, 실제 60갑자 밖의
      // 조합까지 포함한 값)라 여기서도 2도로 잡는다.
      expect(Math.abs(toHsl(p.coreDimmed).h - toHsl(p.core).h), key).toBeLessThanOrEqual(2);
    }
  });

  it("다른 오행끼리는 hue 가 벌어지고, 같은 오행 형제는 hue 가 같다", () => {
    // 갑/을 = 목, 병/정 = 화
    expect(toHsl(paletteFor("갑자").glow).h).toBeCloseTo(toHsl(paletteFor("을축").glow).h, 0);
    expect(
      Math.abs(toHsl(paletteFor("갑자").glow).h - toHsl(paletteFor("병인").glow).h),
    ).toBeGreaterThan(60);
  });

  it("10개 glow 색이 배경 위에서 명도비 4.0 을 넘는다", () => {
    for (const stem of STEMS) {
      const c = contrast(paletteFor(stem + "자").glow, BACKGROUND);
      expect(c, `${stem} 의 명도비 ${c.toFixed(2)}`).toBeGreaterThan(4.0);
    }
  });

  it("glow 채도가 55% 를 넘지 않는다 — 5색 네온으로 보이지 않게 하는 유일한 장치다", () => {
    for (const stem of STEMS) {
      expect(toHsl(paletteFor(stem + "자").glow).s, stem).toBeLessThanOrEqual(55.5);
    }
  });

  it("mock 데이터 21명 전원이 해석된다", () => {
    for (const p of [SELF, ...FRIENDS]) {
      expect(() => paletteFor(p.pillarKey), p.name).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_data/saju-colors.test.ts`

Expected: FAIL — `Failed to resolve import "./saju-colors"`

- [ ] **Step 3: 모듈을 구현한다**

`src/app/lab/relationship-world/_data/saju-colors.ts`:

```ts
/**
 * 사람 Node 의 색. 색은 관계 역할이 아니라 **그 사람의 사주**를 표현한다.
 *
 *   outer glow → 일간(천간 10). 오행이 hue 를, 음양이 채도·명도를 정한다.
 *   inner core → 같은 hue 를 유지하고 지지(12)가 채도·명도를 미세하게 흔든다.
 *
 * 이 표는 Project Saju 의 시각 제안이지 명리에서 정해진 공식 색 체계가 아니다.
 * 그래서 이 파일 하나에 갇혀 있고 통째로 교체할 수 있다.
 *
 * React·three·DOM 을 import 하지 않는다. 테스트가 node 환경에서 돌기 때문이고,
 * 색 규칙 전부가 그 테스트로 잠긴다.
 */

export const STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"] as const;
export const BRANCHES = [
  "자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해",
] as const;

type Stem = (typeof STEMS)[number];
type Hsl = { readonly h: number; readonly s: number; readonly l: number };

/**
 * 오행이 hue, 음양이 밝기다. 같은 오행 형제(갑/을)는 hue 가 완전히 같아서
 * 계열로 읽힌다 — 이게 색상환 균등 분배 대신 이 표를 쓰는 이유다.
 *
 * 수(검정)와 금(흰색)은 전통 오행색 그대로 쓰면 배경 #0F172A 위에서 색으로
 * 기능하지 못한다. 각각 심해 청과 얼음빛 회청으로 옮겼다.
 *
 * 계(癸)만 명도가 56% 인데, 53% 면 배경 대비 명도비가 3.91 로 4.0 바닥을
 * 못 넘긴다(saju-colors.test.ts 가 잠근다).
 */
const STEM_HSL: Record<Stem, Hsl> = {
  갑: { h: 155, s: 33, l: 62 }, // 목 양
  을: { h: 155, s: 24, l: 47 }, // 목 음
  병: { h: 16, s: 55, l: 69 }, //  화 양
  정: { h: 16, s: 36, l: 53 }, //  화 음
  무: { h: 38, s: 42, l: 65 }, //  토 양
  기: { h: 38, s: 26, l: 50 }, //  토 음
  경: { h: 205, s: 27, l: 73 }, // 금 양
  신: { h: 205, s: 20, l: 57 }, // 금 음
  임: { h: 229, s: 45, l: 69 }, // 수 양
  계: { h: 229, s: 27, l: 56 }, // 수 음
};

/** core 를 glow 보다 선명하게 만드는 항. "Inner Core → 조금 더 밀도 있는 색". */
const CORE_SAT_LIFT = 15;
const CORE_LIGHT_LIFT = 10;

/** 선택/dim 파생. 셋 다 hue 는 건드리지 않는다 — hue 가 곧 그 사람이다. */
const SELECTED_LIGHT_LIFT = 12;
const DIMMED_LIGHT_DROP = 28;
const DIMMED_SAT_SCALE = 0.6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 지지가 얹는 미세 변조. 해시가 아니라 지지 인덱스에서 직접 나온다 —
 * 결정적이고 눈으로 검산된다. 4 × 3 = 12 개 조합이라 같은 천간의 12개 일주가
 * 전부 다른 (채도, 명도) 를 받는다.
 */
const satOffset = (i: number) => ((i % 4) - 1.5) * 4; //      -6, -2, +2, +6
const lightOffset = (i: number) => (Math.floor(i / 4) - 1) * 4; // -4, 0, +4

function hslToHex({ h, s, l }: Hsl): string {
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

export type NodePalette = {
  readonly glow: string;
  readonly core: string;
  readonly coreSelected: string;
  readonly coreDimmed: string;
};

/**
 * pillarKey 는 한글 두 글자다("갑자", "신미"). **0번째가 천간, 1번째가 지지다.**
 *
 * 자리로 파싱하는 것이 필수다. `신` 은 천간 辛 이면서 지지 申 이기도 해서,
 * "신미"의 신은 천간이고 "무신"의 신은 지지다. 글자만 보고 판정하면 두 사람이
 * 같은 색을 받는다.
 */
export function paletteFor(pillarKey: string): NodePalette {
  const stem = pillarKey[0] as Stem;
  const branchIndex = BRANCHES.indexOf(pillarKey[1] as (typeof BRANCHES)[number]);
  const base = STEM_HSL[stem];
  if (pillarKey.length !== 2 || base === undefined || branchIndex < 0) {
    throw new Error(`알 수 없는 pillarKey: ${JSON.stringify(pillarKey)}`);
  }

  const coreSat = clamp(base.s + CORE_SAT_LIFT + satOffset(branchIndex), 0, 100);
  const coreLight = clamp(base.l + CORE_LIGHT_LIFT + lightOffset(branchIndex), 0, 100);

  return {
    glow: hslToHex(base),
    core: hslToHex({ h: base.h, s: coreSat, l: coreLight }),
    coreSelected: hslToHex({
      h: base.h,
      s: coreSat,
      l: clamp(coreLight + SELECTED_LIGHT_LIFT, 0, 100),
    }),
    coreDimmed: hslToHex({
      h: base.h,
      s: coreSat * DIMMED_SAT_SCALE,
      l: clamp(coreLight - DIMMED_LIGHT_DROP, 0, 100),
    }),
  };
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_data/saju-colors.test.ts`

Expected: PASS, 12 tests

참고 기대값(구현이 맞으면 아래와 같아야 한다. 다르면 멈추고 보고한다):

| pillarKey | glow | core | coreSelected | coreDimmed |
|---|---|---|---|---|
| 갑자 | `#7ebea3` | `#8bd0b3` | `#b7e1d0` | `#4c806a` |
| 신미 | `#7b95a7` | `#88b1cd` | `#b3cddf` | `#4b687c` |
| 무신 | `#cbb080` | `#e5d1ae` | `#f4ebdc` | `#a88c5c` |
| 계해 | `#717cad` | `#8e9bd7` | `#bbc3e7` | `#4c588a` |

- [ ] **Step 5: 타입 검사**

Run: `npx tsc --noEmit`

Expected: 통과

- [ ] **Step 6: 커밋**

```bash
git add src/app/lab/relationship-world/_data/saju-colors.ts src/app/lab/relationship-world/_data/saju-colors.test.ts
git commit -m "feat(lab): 사주에서 사람 Node 색을 만든다

일간(천간)이 hue 를, 지지가 채도·명도 미세 변조를 정한다. 신(辛)과
신(申)이 같은 글자라 자리로 파싱한다 — 글자로 판정하면 두 사람이
같은 색을 받는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: 시각 상수와 halo falloff

**Files:**
- Create: `src/app/lab/relationship-world/_lib/node-visual.ts`
- Test: `src/app/lab/relationship-world/_lib/node-visual.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  ```ts
  export const CORE_RADIUS: number;            // 0.075
  export const SELF_CORE_SCALE: number;        // 1.4
  export const NEAR_HALO_RADIUS: number;       // 0.28
  export const DIFFUSE_HALO_RADIUS: number;    // 0.95
  export const HALO_ALPHA: {
    readonly near:    { readonly base: number; readonly selected: number; readonly dimmed: number };
    readonly diffuse: { readonly base: number; readonly selected: number; readonly dimmed: number };
  };
  export const HALO_TEXTURE_SIZE: number;      // 64
  export function radialFalloff(size: number): Uint8Array;
  ```
  Task 4 가 전부 쓴다. Task 6 이 상수만 조정한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/lab/relationship-world/_lib/node-visual.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CORE_RADIUS,
  DIFFUSE_HALO_RADIUS,
  HALO_ALPHA,
  HALO_TEXTURE_SIZE,
  NEAR_HALO_RADIUS,
  radialFalloff,
} from "./node-visual";

const SIZE = HALO_TEXTURE_SIZE;
const alphaAt = (data: Uint8Array, x: number, y: number) => data[(y * SIZE + x) * 4 + 3];

describe("radialFalloff", () => {
  const data = radialFalloff(SIZE);

  it("RGBA 한 장 크기다", () => {
    expect(data).toHaveLength(SIZE * SIZE * 4);
  });

  it("RGB 는 전부 흰색이다 — 색은 spriteMaterial.color 가 입힌다", () => {
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(255);
      expect(data[i + 1]).toBe(255);
      expect(data[i + 2]).toBe(255);
    }
  });

  it("중심이 가장 불투명하고 모서리는 완전히 투명하다", () => {
    const c = Math.floor(SIZE / 2);
    expect(alphaAt(data, c, c)).toBeGreaterThan(250);
    expect(alphaAt(data, 0, 0)).toBe(0);
    expect(alphaAt(data, SIZE - 1, SIZE - 1)).toBe(0);
  });

  it("중심에서 바깥으로 알파가 단조 감소한다 — 링이 생기면 halo 가 아니라 도넛이다", () => {
    const c = Math.floor(SIZE / 2);
    for (let x = c; x < SIZE - 1; x++) {
      expect(alphaAt(data, x + 1, c), `x=${x}`).toBeLessThanOrEqual(alphaAt(data, x, c));
    }
  });

  it("네 방향이 대칭이다", () => {
    // 중심은 (SIZE-1)/2 = 31.5 라 인덱스 32 를 기준으로 잡으면 좌우 거리가
    // 16.5 대 15.5 로 어긋난다. 31.5 를 기준으로 정확히 마주보는 인덱스끼리
    // 비교한다 — 그래야 오차 허용치 없이 딱 같아야 한다.
    for (const [x, y] of [
      [10, 32],
      [20, 18],
      [5, 5],
    ]) {
      const base = alphaAt(data, x, y);
      expect(alphaAt(data, SIZE - 1 - x, y), `x 미러 (${x},${y})`).toBe(base);
      expect(alphaAt(data, x, SIZE - 1 - y), `y 미러 (${x},${y})`).toBe(base);
      expect(alphaAt(data, y, x), `전치 (${x},${y})`).toBe(base);
    }
  });

  it("가장자리가 딱 끊기지 않는다 — 스프라이트 사각형이 보이면 안 된다", () => {
    const c = Math.floor(SIZE / 2);
    // 반지름 90% 지점의 알파가 이미 아주 낮아야 한다.
    expect(alphaAt(data, c + Math.floor(SIZE * 0.45), c)).toBeLessThan(12);
  });
});

describe("시각 상수", () => {
  it("코어 < 근접 halo < 확산 halo 순으로 커진다", () => {
    expect(CORE_RADIUS).toBeLessThan(NEAR_HALO_RADIUS);
    expect(NEAR_HALO_RADIUS).toBeLessThan(DIFFUSE_HALO_RADIUS);
  });

  it("확산 halo 는 사람 간 최소 간격(0.4354)보다 커서 이웃과 겹친다", () => {
    // 겹치지 않으면 '사람들이 Field 를 만든다'가 성립하지 않는다.
    expect(DIFFUSE_HALO_RADIUS).toBeGreaterThan(0.4354);
  });

  it("확산 halo 는 근접 halo 보다 훨씬 옅다", () => {
    expect(HALO_ALPHA.diffuse.base).toBeLessThan(HALO_ALPHA.near.base / 4);
  });

  it("두 halo 모두 선택 > 기본 > dim 순으로 진하다", () => {
    for (const layer of [HALO_ALPHA.near, HALO_ALPHA.diffuse]) {
      expect(layer.selected).toBeGreaterThan(layer.base);
      expect(layer.base).toBeGreaterThan(layer.dimmed);
    }
  });

  it("가장 붐비는 fill 그룹 6명이 다 겹쳐도 확산 halo 가 화면을 덮지 않는다", () => {
    // additive 라 합이 그대로 쌓인다. 0.5 를 넘으면 직전 스파이크의 '흰 덩어리'가
    // 색깔만 바뀐 채 돌아온다.
    expect(HALO_ALPHA.diffuse.base * 6).toBeLessThan(0.5);
  });
});
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_lib/node-visual.test.ts`

Expected: FAIL — `Failed to resolve import "./node-visual"`

- [ ] **Step 3: 모듈을 구현한다**

`src/app/lab/relationship-world/_lib/node-visual.ts`:

```ts
/**
 * 사람 Node 의 시각 상수와 halo 텍스처 데이터.
 *
 * three 를 import 하지 않는다. 텍스처 '데이터'만 순수 함수로 만들고, 실제
 * THREE.DataTexture 조립은 PersonNode.tsx 가 한다 — 그래야 이 규칙들이 node
 * 환경 테스트로 잠긴다.
 *
 * 아래 값 중 DIFFUSE_HALO_* 두 개는 계산으로 정했을 뿐 렌더된 화면에서
 * 검증되지 않았다. 실물을 보고 조절할 곳이 여기 하나다.
 */

/** 코어. 사람의 위치 그 자체. opaque 로 그려서 깊이 버퍼에 참여한다. */
export const CORE_RADIUS = 0.075;

/** 나만 코어가 조금 크다. 색은 다른 사람과 같은 규칙(SELF 의 pillarKey)을 따른다. */
export const SELF_CORE_SCALE = 1.4;

/** 노드를 또렷하게 만드는 좁은 halo. */
export const NEAR_HALO_RADIUS = 0.28;

/**
 * 사람이 모인 자리에만 색 기운을 남기는 넓은 halo.
 *
 * 사람 간 최소 간격은 0.4354 다(layout.test.ts 가 잠근다). 이 반지름이 그
 * 2배가 넘으므로 이웃 2~3명과 겹치고, additive 라 겹친 만큼 밝아진다.
 * **이것이 '사람들이 Field 를 만든다'의 전부다** — 별도의 안개나 볼륨
 * 오브젝트를 두면 방금 지운 Field 가 축소판으로 돌아온다.
 */
export const DIFFUSE_HALO_RADIUS = 0.95;

export const HALO_ALPHA = {
  near: { base: 0.55, selected: 0.85, dimmed: 0.12 },
  diffuse: { base: 0.07, selected: 0.12, dimmed: 0.015 },
} as const;

export const HALO_TEXTURE_SIZE = 64;

/**
 * 중심 1 → 가장자리 0 의 smoothstep radial falloff. RGBA, RGB 는 흰색 고정이라
 * spriteMaterial.color 가 그대로 색을 입힌다.
 *
 * canvas 로 만들지 않는 이유: "use client" 모듈도 SSR 프리렌더에서 한 번
 * 평가되는데 거기엔 document 가 없다. 순수 수학이면 어디서든 돈다.
 */
export function radialFalloff(size: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const center = (size - 1) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - center, y - center) / center;
      const t = Math.min(1, Math.max(0, 1 - d));
      const a = t * t * (3 - 2 * t); // smoothstep
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }

  return data;
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `npx vitest run src/app/lab/relationship-world/_lib/node-visual.test.ts`

Expected: PASS, 11 tests

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world/_lib/node-visual.ts src/app/lab/relationship-world/_lib/node-visual.test.ts
git commit -m "feat(lab): Node 시각 상수와 halo falloff 를 한곳에 모은다

halo 텍스처는 셰이더 없이 순수 수학으로 만든다. canvas 를 쓰면 SSR
프리렌더에서 document 가 없어 죽는다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: PersonNode 3층 재작성

**Files:**
- Modify: `src/app/lab/relationship-world/_components/PersonNode.tsx` (전면 교체)

**Interfaces:**
- Consumes: `paletteFor` (Task 2), `CORE_RADIUS` · `NEAR_HALO_RADIUS` · `DIFFUSE_HALO_RADIUS` · `HALO_ALPHA` · `HALO_TEXTURE_SIZE` · `radialFalloff` (Task 3)
- Produces:
  ```tsx
  export function PersonNode(props: {
    position: Vec3;
    pillarKey: string;
    selected: boolean;
    dimmed: boolean;
    coreScale?: number;   // 기본 1. SelfCore 가 SELF_CORE_SCALE 을 넘긴다.
  }): JSX.Element;
  ```
  Task 5 가 `pillarKey` 를 넘기고, Task 6 이 `coreScale` 을 쓴다.

이 작업엔 자동 테스트가 없다. R3F 컴포넌트는 node 환경에서 렌더할 수 없다. 검증은 타입 검사 + 빌드 + 사람 눈이다.

- [ ] **Step 1: 파일을 통째로 교체한다**

`src/app/lab/relationship-world/_components/PersonNode.tsx`:

```tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { paletteFor } from "../_data/saju-colors";
import type { Vec3 } from "../_lib/layout";
import {
  CORE_RADIUS,
  DIFFUSE_HALO_RADIUS,
  HALO_ALPHA,
  HALO_TEXTURE_SIZE,
  NEAR_HALO_RADIUS,
  radialFalloff,
} from "../_lib/node-visual";

/**
 * 21명이 공유하는 halo 텍스처 한 장. 모듈 스코프에서 딱 한 번 만든다.
 *
 * DataTexture 는 데이터 홀더일 뿐이라 렌더러가 업로드하기 전까지 DOM 을
 * 건드리지 않는다 — SSR 프리렌더에서 이 모듈이 평가돼도 안전하다.
 */
const HALO_TEXTURE = (() => {
  const texture = new THREE.DataTexture(
    radialFalloff(HALO_TEXTURE_SIZE),
    HALO_TEXTURE_SIZE,
    HALO_TEXTURE_SIZE,
  );
  texture.needsUpdate = true;
  return texture;
})();

export function PersonNode({
  position,
  pillarKey,
  selected,
  dimmed,
  coreScale = 1,
}: {
  position: Vec3;
  pillarKey: string;
  selected: boolean;
  dimmed: boolean;
  coreScale?: number;
}) {
  const coreMat = useRef<THREE.MeshBasicMaterial>(null);
  const nearMat = useRef<THREE.SpriteMaterial>(null);
  const diffuseMat = useRef<THREE.SpriteMaterial>(null);

  // pillarKey 는 사람마다 고정이라 사실상 한 번만 계산된다. THREE.Color 로 미리
  // 바꿔두는 이유는 useFrame 안에서 lerp 대상이 필요하기 때문이다.
  const palette = useMemo(() => {
    const p = paletteFor(pillarKey);
    return {
      glow: new THREE.Color(p.glow),
      core: new THREE.Color(p.core),
      coreSelected: new THREE.Color(p.coreSelected),
      coreDimmed: new THREE.Color(p.coreDimmed),
    };
  }, [pillarKey]);

  useFrame((_, delta) => {
    const k = Math.min(1, delta * 6);

    // 코어는 opaque 라 opacity 로 상태를 표현할 수 없다. 색을 lerp 한다.
    const target = selected
      ? palette.coreSelected
      : dimmed
        ? palette.coreDimmed
        : palette.core;
    if (coreMat.current) coreMat.current.color.lerp(target, k);

    const state = selected ? "selected" : dimmed ? "dimmed" : "base";
    if (nearMat.current) {
      nearMat.current.opacity +=
        (HALO_ALPHA.near[state] - nearMat.current.opacity) * k;
    }
    if (diffuseMat.current) {
      diffuseMat.current.opacity +=
        (HALO_ALPHA.diffuse[state] - diffuseMat.current.opacity) * k;
    }
  });

  return (
    <group position={position as unknown as [number, number, number]}>
      {/*
        코어만 opaque 다. transparent 로 두면 three 의 transparent 큐로 가는데,
        그 큐는 픽셀이 아니라 오브젝트 원점 거리로 정렬된다 — 앞뒤 가림이
        오브젝트 단위로 뭉개진다. opaque 패스에 남겨야 깊이 버퍼를 채우고,
        뒤따르는 모든 halo 가 이 코어를 상대로 진짜 depth test 를 받는다.
        "카메라를 돌리면 앞뒤가 실제로 느껴져야 한다"는 요구가 여기서만 선다.
      */}
      <mesh>
        <sphereGeometry args={[CORE_RADIUS * coreScale, 12, 12]} />
        <meshBasicMaterial ref={coreMat} color={palette.core} />
      </mesh>

      {/* sprite 는 three 가 알아서 카메라를 향하게 한다. scale 은 지름이다. */}
      <sprite scale={[NEAR_HALO_RADIUS * 2, NEAR_HALO_RADIUS * 2, 1]}>
        <spriteMaterial
          ref={nearMat}
          map={HALO_TEXTURE}
          color={palette.glow}
          transparent
          opacity={HALO_ALPHA.near.base}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      {/* 이웃과 겹쳐서 Field 를 만드는 층. 혼자 있을 땐 거의 안 보인다. */}
      <sprite scale={[DIFFUSE_HALO_RADIUS * 2, DIFFUSE_HALO_RADIUS * 2, 1]}>
        <spriteMaterial
          ref={diffuseMat}
          map={HALO_TEXTURE}
          color={palette.glow}
          transparent
          opacity={HALO_ALPHA.diffuse.base}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
    </group>
  );
}
```

- [ ] **Step 2: 타입 검사를 돌린다**

Run: `npx tsc --noEmit`

Expected: `PersonMarker.tsx` 에서 에러 1개 — `PersonNode` 에 `pillarKey` 가 없다고 한다. **정상이다.** Task 5 가 고친다. 다른 에러가 나면 멈추고 보고한다.

- [ ] **Step 3: 커밋하지 않는다**

이 시점에서 빌드가 깨져 있다. Task 5 와 함께 커밋한다. 다음 작업으로 넘어간다.

---

### Task 5: PersonMarker · World 배선

**Files:**
- Modify: `src/app/lab/relationship-world/_components/PersonMarker.tsx`

**Interfaces:**
- Consumes: `PersonNode` (Task 4), `paletteFor` (Task 2)
- Produces: 빌드가 다시 서는 상태. 20명이 자기 색으로 그려진다.

- [ ] **Step 1: PersonNode 에 pillarKey 를 넘긴다**

`PersonMarker.tsx` 76번 줄 근처:

```tsx
      <PersonNode position={position} selected={selected} dimmed={dimmed} />
```

를 아래로 바꾼다:

```tsx
      <PersonNode
        position={position}
        pillarKey={person.pillarKey}
        selected={selected}
        dimmed={dimmed}
      />
```

- [ ] **Step 2: dot 티어가 그 사람 색을 쓰게 한다**

파일 상단 import 에 추가한다:

```tsx
import { paletteFor } from "../_data/saju-colors";
```

컴포넌트 본문에서 `const shown = boosted ? boost(tier) : tier;` 바로 아래에 추가한다:

```tsx
  // dot 은 이름이 안 보이는 티어라 색이 유일한 단서다. 파란색 고정이면
  // "색 = 그 사람의 사주" 가 가장 필요한 자리에서 깨진다.
  const dotColor = paletteFor(person.pillarKey).core;
```

그리고 dot 블록의 `<span>` 을 아래로 바꾼다:

```tsx
              <span
                className="block w-[7px] h-[7px] rounded-full"
                style={{
                  backgroundColor: dotColor,
                  opacity: selected ? 1 : 0.8,
                }}
              />
```

(기존의 `${selected ? "bg-blue-300" : "bg-slate-300/80"}` 조건부 클래스는 사라진다.)

- [ ] **Step 3: 타입 검사와 테스트**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | tail -5`

Expected: tsc 통과. `Tests 539 passed (539)` (516 + 12 + 11)

- [ ] **Step 4: 빌드**

Run: `npm run build 2>&1 | tail -20`

Expected: 컴파일 성공

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world/_components/PersonNode.tsx src/app/lab/relationship-world/_components/PersonMarker.tsx
git commit -m "feat(lab): 사람 Node 를 사주색 3층 구조로 바꾼다

코어(opaque) + 근접 halo + 확산 halo. 확산 halo 가 이웃과 겹치면서
공간이 생긴다 — 별도의 Field 오브젝트 없이.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: SelfCore 재작성과 조명 제거

**Files:**
- Modify: `src/app/lab/relationship-world/_components/SelfCore.tsx` (전면 교체)
- Modify: `src/app/lab/relationship-world/_components/World.tsx`

**Interfaces:**
- Consumes: `PersonNode` (Task 4), `SELF_CORE_SCALE` (Task 3)
- Produces: 최종 상태. 나도 자기 사주색을 갖고, 죽은 조명이 사라진다.

`SelfCore` 는 지금 파란색(`#93c5fd` / `#2563eb`)이 하드코딩된 발광 구체 + `pointLight` 다. "색 = 사람의 사주" 아래에서 나만 파란색일 이유가 없다. SELF 의 pillarKey 는 `"갑자"` 라 자기 색이 나온다.

- [ ] **Step 1: SelfCore 를 교체한다**

`src/app/lab/relationship-world/_components/SelfCore.tsx`:

```tsx
"use client";

import { Html } from "@react-three/drei";
import { SELF } from "../_data/mock-people";
import { SELF_POSITION } from "../_lib/layout";
import { SELF_CORE_SCALE } from "../_lib/node-visual";
import { PersonNode } from "./PersonNode";

/**
 * 나도 다른 사람과 같은 규칙을 따른다 — 같은 3층 구조, 같은 사주색.
 * 다른 것은 코어 반지름 하나뿐이다(SELF_CORE_SCALE).
 *
 * 예전에는 파란 발광 구체 + pointLight 였는데, "색 = 그 사람의 사주" 아래에서
 * 나만 역할과 무관한 파란색일 이유가 없다. SELF 의 pillarKey 는 "갑자" 다.
 */
export function SelfCore() {
  return (
    <group>
      <PersonNode
        position={SELF_POSITION}
        pillarKey={SELF.pillarKey}
        selected={false}
        dimmed={false}
        coreScale={SELF_CORE_SCALE}
      />

      {/* 어느 것이 나인지 모르면 관계 지도가 아니다. 이름은 DOM 으로. */}
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

이름표를 world-space Y 오프셋(`position={[0, -1.05, 0]}`)이 아니라 화면공간 `translate-y` 로 옮긴 것에 유의한다. `PersonMarker` 가 이미 같은 이유로 그렇게 한다 — C 모드에서 world Y 축이 시선축과 거의 나란해지는 각도가 있고, 그 순간 world 오프셋은 옆으로 새어 이름표가 대각선으로 어긋난다.

- [ ] **Step 2: World.tsx 에서 죽은 조명을 지운다**

`SelfCore` 가 `meshStandardMaterial` 을 쓰던 유일한 곳이었다. 이제 씬 전체에 빛을 받는 재질이 하나도 없으므로 아래 두 줄을 삭제한다:

```tsx
      <ambientLight intensity={0.35} />
      <directionalLight position={[6, 8, 6]} intensity={0.5} />
```

- [ ] **Step 3: 빛을 받는 재질이 정말 하나도 남지 않았는지 확인한다**

Run: `grep -rn "meshStandardMaterial\|meshPhysicalMaterial\|meshLambertMaterial\|meshPhongMaterial" src/app/lab/relationship-world/`

Expected: 출력 없음. 하나라도 나오면 조명을 지우면 그 오브젝트가 검게 된다 — 멈추고 보고한다.

- [ ] **Step 4: 전체 검증**

Run: `npx tsc --noEmit && npx vitest run 2>&1 | tail -5 && npm run build 2>&1 | tail -20`

Expected: tsc 통과, `Tests 539 passed (539)`, 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add src/app/lab/relationship-world/_components/SelfCore.tsx src/app/lab/relationship-world/_components/World.tsx
git commit -m "feat(lab): 나도 자기 사주색을 갖고, 죽은 조명을 지운다

SelfCore 가 다른 사람과 같은 3층 구조를 쓴다. 코어 반지름만 1.4배다.
빛을 받는 재질이 하나도 남지 않아 ambientLight/directionalLight/
pointLight 를 전부 삭제한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: 사람이 볼 차례라고 알린다**

구현자는 여기서 멈추고 아래를 보고한다. **렌더된 프레임을 본 사람은 아직 아무도 없다.**

375px 에서 확인해야 할 것:

1. 사람마다 색이 다르게 보이는가. 같은 오행 형제(갑/을, 병/정 …)가 계열로 읽히는가
2. `DIFFUSE_HALO_RADIUS 0.95` · `DIFFUSE_HALO_ALPHA 0.07` 이 적당한가 — 너무 크면 직전 스파이크의 "흰 덩어리"가 색깔만 바뀌어 돌아오고, 너무 작으면 그냥 흩뿌려진 점이 된다. 두 값은 `_lib/node-visual.ts` 한곳에 있다
3. 카메라를 돌렸을 때 앞뒤 가림이 실제로 느껴지는가
4. 5개 role 그룹이 위치만으로 구분되는가
5. 사람을 선택했을 때 六合/沖 이 좋음/나쁨으로 읽히지 않는가

---

## 검증 요약

| 시점 | 테스트 수 |
|---|---|
| 시작 | 527 |
| Task 1 후 (fields 삭제) | 516 |
| Task 2 후 (saju-colors) | 528 |
| Task 3 후 (node-visual) | 539 |
| 최종 리뷰 수정 후 | 540 |

---

## 실행 후 정정

계획대로 되지 않은 두 곳을 남긴다. 둘 다 이 문서의 계산이 틀렸던 경우다.

**1. Task 2 의 hue 단언 (실행 중 발견).** 위 Task 2 코드블록의 두 단언은 hex 왕복 반올림을 허용하지 않아 **올바른 구현을 상대로 실패했다.** 색을 8비트 hex 로 저장했다가 HSL 로 역산하면 hue 가 흔들린다. 실측 최대는 같은 천간 12지지 spread 1.5319도, coreDimmed↔core 차 1.7143도다. 두 곳 다 허용치 2도로 바꿨다 — 초록이 되는 최소값이 아니라 측정에서 유도한 값이다.

**2. `DIFFUSE_HALO_RADIUS` 0.95 → 1.6 (최종 리뷰에서 발견).** 이 문서와 설계 문서가 "사람 간 최소 간격 0.4354 의 2배가 넘으므로 이웃 2~3명과 겹친다"를 근거로 0.95 를 정당화했는데, 0.4354 는 210개 쌍 중 **가장 가까운 한 쌍**의 값이었다. 최근접 거리의 중앙값은 1.93 이다. R=0.95 에서는 중앙값 사람의 겹치는 이웃이 0명이고 21명 중 12명이 아무와도 겹치지 않아 — **"사람들이 Field 를 만든다"는 이 브랜치의 핵심 메커니즘이 작동하지 않았다.** R=1.6 에서 중앙값 2명, 최대 5명, 고립 2/21 이다. 값은 사용자가 정했다.

두 경우 다 타입도 맞고 빌드도 통과하는 상태였다. 이 스파이크에서 치명적 결함은 계속 그 형태로 나타난다.
