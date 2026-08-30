# 관계 지도 궁합 설명(별명 15칸 × 내 오행) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관계 지도 상세 시트의 궁합 설명을 "오행 다리 문장(내 일간 오행 × 구역, 25칸) + 별명 단락(구역 × 소구역, 15칸)" 조합의 3~4문장 한 단락으로 바꾼다.

**Architecture:** 새 순수 데이터 모듈 `relation-notes.ts` 가 두 표와 `relationNote()` 를 제공한다. 중심의 일간 오행을 `MapCenter.element` 로 실어 `[share]/page.tsx → MapShell → PersonSheet` 로 내려보내고, PersonSheet 의 기존 `ROLE_NOTE`+`FEATURE_NOTE` 자리를 `relationNote()` 한 단락으로 교체한다.

**Tech Stack:** Next.js(App Router), TypeScript, vitest. three/DB 는 건드리지 않는다.

**스펙:** `docs/superpowers/specs/2026-08-30-map-relation-notes-design.md`

## Global Constraints

- 카피는 전부 "~입니다" 체. 좋은 관계/나쁜 관계 판단 금지. 결혼·재물·성공 예측 금지.
- 六合/沖 은 같은 무게 — 각 구역에서 yukhap/chung 단락 중 짧은 쪽이 긴 쪽의 70% 이상.
- 오행은 문장 안에서 자연어로 부른다: 목=나무, 화=불, 토=흙, 금=쇠, 수=물.
- 두 표 모두 `as const satisfies` 로 잠근다 — 칸이 비면 컴파일 실패.
- 테스트: `npm test` (vitest run), 타입: `npm run typecheck` (tsc --noEmit).
- 커밋 메시지 끝에 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` 줄.

---

### Task 1: relation-notes 데이터 모듈

**Files:**
- Create: `src/app/map/_data/relation-notes.ts`
- Test: `src/app/map/_data/relation-notes.test.ts`

**Interfaces:**
- Consumes: `Element`, `elementGenerates`, `elementControls`, `generatedBy`, `controlledBy`, `ELEMENTS` (`@/lib/saju-core`) · `RelationRole`, `Feature`, `ROLE_ORDER` (`./roles`)
- Produces:
  - `NATURE_WORDS: Record<Element, string>` — 오행 → 자연어 (목→"나무" …)
  - `ELEMENT_BRIDGE: Record<Element, Record<RelationRole, string>>` — 25칸
  - `NICKNAME_NOTE: Record<RelationRole, Record<Feature, string>>` — 15칸
  - `relationNote(myElement: Element, role: RelationRole, feature: Feature): string` — 두 층을 공백 하나로 이은 단락

- [ ] **Step 1: 실패하는 테스트 작성**

`src/app/map/_data/relation-notes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ELEMENTS,
  controlledBy,
  elementControls,
  elementGenerates,
  generatedBy,
  type Element,
} from "@/lib/saju-core";
import { ROLE_ORDER, type Feature, type RelationRole } from "./roles";
import { ELEMENT_BRIDGE, NATURE_WORDS, NICKNAME_NOTE, relationNote } from "./relation-notes";

const FEATURES: Feature[] = ["none", "yukhap", "chung"];

/**
 * 내 일간 오행 × 구역 → 상대 구역의 일간 오행. 관계 엔진(relationship.ts 의
 * relationKind)과 같은 생극 규칙을 saju-core 헬퍼로 다시 세운다 — 25칸의
 * 문장이 엔진과 어긋난 채 배포될 수 없게 하는 것이 이 테스트의 존재 이유다.
 */
function otherElement(my: Element, role: RelationRole): Element {
  switch (role) {
    case "fill": return generatedBy(my);      // 생아: 상대가 나를 생
    case "beside": return my;                  // 비아: 같은 오행
    case "express": return elementGenerates(my); // 아생: 내가 상대를 생
    case "move": return elementControls(my);   // 아극: 내가 상대를 극
    case "refine": return controlledBy(my);    // 극아: 상대가 나를 극
  }
}

describe("ELEMENT_BRIDGE", () => {
  it("25칸이 전부 채워져 있다", () => {
    for (const el of ELEMENTS) {
      for (const role of ROLE_ORDER) {
        expect(ELEMENT_BRIDGE[el][role], `${el}/${role}`).toBeTruthy();
      }
    }
  });

  it("각 칸이 내 오행과 상대 오행을 자연어로 직접 부른다", () => {
    for (const el of ELEMENTS) {
      for (const role of ROLE_ORDER) {
        const sentence = ELEMENT_BRIDGE[el][role];
        expect(sentence, `${el}/${role} 에 내 오행(${NATURE_WORDS[el]})이 없다`)
          .toContain(NATURE_WORDS[el]);
        expect(sentence, `${el}/${role} 에 상대 오행(${NATURE_WORDS[otherElement(el, role)]})이 없다`)
          .toContain(NATURE_WORDS[otherElement(el, role)]);
      }
    }
  });
});

describe("NICKNAME_NOTE", () => {
  it("15칸이 전부 채워져 있다", () => {
    for (const role of ROLE_ORDER) {
      for (const feature of FEATURES) {
        expect(NICKNAME_NOTE[role][feature], `${role}/${feature}`).toBeTruthy();
      }
    }
  });

  // 기존 FEATURE_NOTE 의 ±3자 규칙(roles.test.ts)의 단락판. 한쪽 계열만 길거나
  // 짧으면 그 순간 좋은 관계 / 나쁜 관계가 된다.
  it("六合 과 沖 의 무게 — 각 구역에서 짧은 쪽이 긴 쪽의 70% 이상이다", () => {
    for (const role of ROLE_ORDER) {
      const a = NICKNAME_NOTE[role].yukhap.length;
      const b = NICKNAME_NOTE[role].chung.length;
      expect(Math.min(a, b) / Math.max(a, b), `${role}: yukhap ${a}자 vs chung ${b}자`)
        .toBeGreaterThanOrEqual(0.7);
    }
  });

  it("15개가 서로 다르다", () => {
    const all = ROLE_ORDER.flatMap((r) => FEATURES.map((f) => NICKNAME_NOTE[r][f]));
    expect(new Set(all).size).toBe(15);
  });
});

describe("relationNote", () => {
  it("다리 문장과 별명 단락을 공백 하나로 잇는다", () => {
    expect(relationNote("목", "fill", "chung")).toBe(
      `${ELEMENT_BRIDGE.목.fill} ${NICKNAME_NOTE.fill.chung}`,
    );
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/map/_data/relation-notes.test.ts`
Expected: FAIL — `relation-notes` 모듈이 없다 (import 에러).

- [ ] **Step 3: 모듈 구현 (카피 전문 포함)**

`src/app/map/_data/relation-notes.ts` 를 아래 내용 그대로 만든다. 카피는 스펙의 원칙(판단 금지 · 六合/沖 같은 무게 · 별명을 본문이 받는다 · "~입니다" 체)으로 이미 다듬어진 최종본이다 — 임의로 고치지 말 것.

```ts
// 상세 시트의 궁합 설명 — 오행 다리 문장(25칸) + 별명 단락(15칸)의 두 층.
//
// 왜 두 층인가: 구분의 축이 둘이다. "내 지도에서 이 구역은 어떤 오행의
// 사람들인가"(내 일간 오행 × 구역)와 "이 별명은 어떤 장면인가"(구역 × 소구역).
// 75칸 풀 테이블로 합치면 오행 문장만 다른 단락 세 개가 복붙으로 늘어서고,
// 치환 템플릿으로 줄이면 조사 처리가 기계적이 된다. 25+15문장을 전부 손으로
// 쓰되 어느 축을 고칠 때 다른 축을 안 건드리는 것이 이 구조의 목적이다.
//
// 카피 원칙 (스펙 §2):
//  - 판단하지 않는다. 좋은 관계/나쁜 관계/피해야 할 사람을 말하지 않는다 —
//    connections.ts 가 선의 색·알파로 관계의 등급을 말하지 않는 것의 카피판.
//  - 六合/沖 은 같은 무게. 沖 별명(쓴약·라이벌·버튼·불쏘시개·회초리)은
//    "나쁨"이 아니라 "쓸모 있는 마찰"로 쓴다. 테스트가 길이 비 70% 를 잠근다.
//  - 별명 단어(또는 그 심상)가 단락 안에 자연스럽게 등장한다.
//
// 근거 문서: docs/superpowers/specs/2026-08-30-map-relation-notes-design.md

import type { Element } from "@/lib/saju-core";
import type { Feature, RelationRole } from "./roles";

/** 오행의 자연어 이름. 문장 안에서 목·화·토 대신 이 이름으로 부른다. */
export const NATURE_WORDS = {
  목: "나무",
  화: "불",
  토: "흙",
  금: "쇠",
  수: "물",
} as const satisfies Record<Element, string>;

/**
 * 내 일간 오행 × 구역 → 다리 문장 한 개.
 *
 * 한 지도 안에서 같은 구역 사람들은 전부 같은 일간 오행이다(관계 분류가 일간
 * 오행의 생극만으로 갈리므로). 그래서 각 칸은 두 오행을 이름으로 직접 부르는
 * 문장을 손으로 쓴다 — 치환이 아니라서 조사와 비유가 자연스럽다.
 *
 * 상대 오행은 relationship.ts 의 relationKind 와 같은 규칙로 정해진다:
 * fill=나를 생, beside=같음, express=내가 생, move=내가 극, refine=나를 극.
 * relation-notes.test.ts 가 25칸 전부에 이 정합을 잠근다.
 */
export const ELEMENT_BRIDGE = {
  목: {
    fill: "물이 뿌리에 스며 나무를 키우듯, 이 사람의 기운은 당신 쪽으로 흘러듭니다.",
    beside: "같은 숲의 나무 두 그루처럼, 두 사람은 같은 결의 기운을 지녔습니다.",
    express: "나무가 불을 피워 올리듯, 당신의 기운은 이 사람 앞에서 환하게 살아납니다.",
    move: "나무가 흙을 파고들며 자라듯, 이 사람 곁에서 당신의 기운은 뻗어 나갈 곳을 찾습니다.",
    refine: "쇠가 나무를 깎아 모양을 내듯, 이 사람의 기운은 당신을 다듬습니다.",
  },
  화: {
    fill: "나무가 불을 살리듯, 이 사람의 기운은 당신 쪽으로 흘러듭니다.",
    beside: "나란히 타오르는 두 불꽃처럼, 두 사람은 같은 결의 기운을 지녔습니다.",
    express: "불이 흙을 데워 단단하게 하듯, 당신의 기운은 이 사람에게 닿아 자리를 잡습니다.",
    move: "불이 쇠를 달구듯, 이 사람 곁에서 당신의 기운은 할 일을 찾아 깨어납니다.",
    refine: "물이 불길을 고르게 잡듯, 이 사람의 기운은 당신의 기세를 고르게 잡아 줍니다.",
  },
  토: {
    fill: "불이 타고 남은 자리가 흙을 기름지게 하듯, 이 사람의 기운은 당신에게 쌓입니다.",
    beside: "같은 들판의 흙처럼, 두 사람은 같은 결의 기운을 지녔습니다.",
    express: "흙이 쇠를 길러 내듯, 당신의 기운은 이 사람에게서 형태를 얻습니다.",
    move: "흙이 물길을 잡듯, 이 사람 곁에서 당신의 기운은 방향을 잡고 움직입니다.",
    refine: "나무가 뿌리로 흙을 붙잡듯, 이 사람의 기운은 당신이 흩어지지 않게 잡아 줍니다.",
  },
  금: {
    fill: "흙 속에서 쇠가 여물듯, 이 사람의 기운은 당신을 받쳐 단단하게 합니다.",
    beside: "같은 광맥에서 나온 두 쇠처럼, 두 사람은 같은 결의 기운을 지녔습니다.",
    express: "쇠끝에 물이 맺히듯, 당신의 기운은 이 사람에게서 흐르기 시작합니다.",
    move: "쇠가 나무를 만나야 연장이 되듯, 이 사람 곁에서 당신의 기운은 쓰임을 찾아 움직입니다.",
    refine: "불이 쇠를 벼리듯, 이 사람의 기운은 당신을 단련합니다.",
  },
  수: {
    fill: "쇠가 있는 곳에서 맑은 물이 나듯, 이 사람의 기운은 당신 쪽으로 흘러듭니다.",
    beside: "만나 한 줄기로 흐르는 두 물처럼, 두 사람은 같은 결의 기운을 지녔습니다.",
    express: "물이 나무를 적셔 키우듯, 당신의 기운은 이 사람에게서 자라납니다.",
    move: "물이 불의 온도를 다루듯, 이 사람 곁에서 당신의 기운은 움직일 이유를 찾습니다.",
    refine: "흙이 둑이 되어 물길을 내듯, 이 사람의 기운은 당신의 흐름을 잡아 줍니다.",
  },
} as const satisfies Record<Element, Record<RelationRole, string>>;

/**
 * 구역 × 소구역 → 별명을 푸는 단락(2~3문장).
 *
 * DISPLAY_TITLES(roles.ts)의 열다섯 별명과 짝이다 — 별명이 바뀌면 그 심상을
 * 받는 이 칸도 같이 봐야 한다. 기존 ROLE_NOTE(PersonSheet 지역 상수)와
 * FEATURE_NOTE(roles.ts)를 이 표가 대체한다.
 */
export const NICKNAME_NOTE = {
  fill: {
    none: "곁에 있으면 비어 가던 자리가 조용히 채워지는 사람입니다. 눈에 띄게 무언가를 해 주지 않아도, 함께 있고 나면 어쩐지 힘이 남아 있습니다.",
    yukhap: "챙긴 날과 거른 날이 다르게 느껴지는, 꾸준히 스며드는 채움입니다. 흐름이 끊기지 않고 이어져서, 함께 보낸 시간이 그대로 기운이 됩니다.",
    chung: "당장은 쓰게 느껴져도 지나고 보면 필요했던 채움이 남는 사이입니다. 편하지만은 않은 방식으로, 이 사람은 당신의 빈 곳을 짚어 채워 줍니다.",
  },
  beside: {
    none: "같은 방향을 보고 나란히 걷는 사람입니다. 설명하지 않아도 통하는 데가 많아, 힘을 합치면 혼자일 때보다 멀리 갑니다.",
    yukhap: "결이 닮은 데다 흐름까지 맞물려, 오래 같이 있어도 힘이 들지 않는 사이입니다. 곁에 있는 것만으로 든든해지는 내 편입니다.",
    chung: "결이 닮아서 오히려 자주 부딪히는 사이입니다. 지기 싫은 마음이 서로를 자라게 해서, 이 사람 앞에서는 당신도 한 뼘 더 애쓰게 됩니다.",
  },
  express: {
    none: "이 사람 앞에서는 말과 생각이 쉽게 밖으로 나옵니다. 무엇이든 해 보고 싶어지는, 마음이 풀리는 자리입니다.",
    yukhap: "표현이 잘 나오는 데다 흐름까지 이어져서, 이 사람을 떠올리는 것만으로 하고 싶은 일이 생깁니다. 당신의 가장 생생한 모습을 꺼내 주는 사람입니다.",
    chung: "이 사람은 당신의 버튼을 누릅니다 — 눌린 순간, 평소에 안 꺼내던 반응과 속마음이 튀어나옵니다. 표현이 격해지기 쉬운 만큼, 꺼내 놓고 나면 후련한 사이이기도 합니다.",
  },
  move: {
    none: "이 사람을 보면 미뤄 두었던 일이 떠오릅니다. 가만히 있던 마음을 일으켜, 해야 할 일 앞에 당신을 데려다 놓는 사람입니다.",
    yukhap: "움직이게 하는 힘에 맞물리는 흐름까지 더해져, 같이 무언가를 도모하면 손발이 잘 맞습니다. 함께 있으면 일이 알아서 굴러가는 사이입니다.",
    chung: "이 사람 곁에서는 가만히 있기가 어렵습니다. 부딪히는 기운이 불씨가 되어, 미적지근하던 마음에 시동이 걸립니다. 과열되지 않게 속도만 살피면 됩니다.",
  },
  refine: {
    none: "당신이 선 밖으로 벗어나려 할 때 가장자리를 잡아 주는 사람입니다. 평소에는 있는 줄도 모르다가, 필요한 순간에 그 덕을 봅니다.",
    yukhap: "멈출 때와 갈 때를 알려 주는, 그 기준이 몸에 편하게 맞는 사이입니다. 이 사람의 박자를 따라가면 길이 덜 어지럽습니다.",
    chung: "따끔한 방식으로 당신을 다듬는 사람입니다. 듣는 순간은 아파도, 지나고 보면 그 말이 모양을 잡아 준 경우가 많습니다.",
  },
} as const satisfies Record<RelationRole, Record<Feature, string>>;

/** 시트가 렌더하는 최종 단락. 다리 문장 + 별명 단락을 공백 하나로 잇는다. */
export function relationNote(
  myElement: Element,
  role: RelationRole,
  feature: Feature,
): string {
  return `${ELEMENT_BRIDGE[myElement][role]} ${NICKNAME_NOTE[role][feature]}`;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/app/map/_data/relation-notes.test.ts`
Expected: PASS (전 테스트). 길이 비 70% 테스트가 지면 **짧은 쪽을 늘려서** 맞춘다 — 긴 쪽을 깎아 무게를 잃지 말 것.

- [ ] **Step 5: 커밋**

```bash
git add src/app/map/_data/relation-notes.ts src/app/map/_data/relation-notes.test.ts
git commit -m "feat(map): 궁합 설명 데이터 — 오행 다리 25칸 + 별명 단락 15칸

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: MapCenter 에 일간 오행 싣기

**Files:**
- Modify: `src/app/map/_data/person.ts` (MapCenter 타입)
- Modify: `src/app/map/_lib/to-map-people.ts` (centerOf)
- Test: `src/app/map/_lib/to-map-people.test.ts` (기존 centerOf 테스트 갱신)

**Interfaces:**
- Consumes: `STEMS`, `type Element` (`@/lib/saju-core`) — to-map-people.ts 는 이미 saju-core 를 import 한다.
- Produces: `MapCenter.element: Element` — Task 3 의 page/MapShell/PersonSheet 가 쓴다.

- [ ] **Step 1: 기존 테스트를 먼저 갱신 (실패 확인용)**

`src/app/map/_lib/to-map-people.test.ts` 의 `describe("centerOf")` 첫 테스트를 다음으로 교체한다 (1990-05-15 는 경진일주, 일간 경은 금 — 파일 상단 주석에 이미 실측 기록이 있다):

```ts
  it("이름과 일주 캐릭터, 일간 오행을 담는다", () => {
    const center = centerOf("김동진", solar(BASE.year, BASE.month, BASE.day));
    expect(center).toEqual({
      name: "김동진",
      pillarKey: "경진",
      sceneName: expect.any(String),
      element: "금",
    });
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/app/map/_lib/to-map-people.test.ts`
Expected: FAIL — centerOf 반환에 `element` 가 없다.

- [ ] **Step 3: 타입과 구현**

`src/app/map/_data/person.ts` 의 MapCenter 를 수정한다:

```ts
import type { Element } from "@/lib/saju-core";
import type { Feature, RelationRole } from "./roles";
```

```ts
/** 지도의 중심. 관계가 없으므로 role·feature 가 없다. */
export type MapCenter = {
  readonly name: string;
  readonly pillarKey: string;
  readonly sceneName: string;
  /**
   * 일간 오행. 상세 시트의 오행 다리 문장(relation-notes.ts)이 "내가 무슨
   * 오행인가"를 알아야 해서 싣는다. 오행은 5분류라, 이미 노출 중인 각 사람의
   * 일주(60분류)보다 훨씬 거친 정보다.
   */
  readonly element: Element;
};
```

`src/app/map/_lib/to-map-people.ts` 의 saju-core import 에 `STEMS` 를 추가하고 `centerOf` 를 수정한다:

```ts
import {
  buildPillars,
  characterOf,
  getRelation,
  STEMS,
  type DayPillarInput,
  type RelationBadge,
  type RelationKind,
} from "@/lib/saju-core";
```

```ts
/** 지도의 중심. 관계가 없으므로 일주 캐릭터와 일간 오행만 담는다. */
export function centerOf(name: string, birth: BirthLite): MapCenter | null {
  const day = dayPillarOf(birth);
  if (!day) return null;
  const character = characterOf(day.stem, day.branch);
  return {
    name,
    pillarKey: character.key,
    sceneName: character.scene.name,
    element: STEMS[day.stem].element,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/app/map/_lib/to-map-people.test.ts` 그리고 `npm run typecheck`
Expected: 둘 다 PASS. (centerOf 의 반환 타입 주석이 `MapCenter | null` 인지 확인 — 이미 그렇다.)

- [ ] **Step 5: 커밋**

```bash
git add src/app/map/_data/person.ts src/app/map/_lib/to-map-people.ts src/app/map/_lib/to-map-people.test.ts
git commit -m "feat(map): MapCenter 에 일간 오행을 싣는다

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 배선과 시트 교체, 옛 문구 정리

**Files:**
- Modify: `src/app/map/[share]/page.tsx` (centerElement 전달, 주석 갱신)
- Modify: `src/app/map/_components/MapShell.tsx` (prop 추가·전달)
- Modify: `src/app/map/_components/PersonSheet.tsx` (ROLE_NOTE·FEATURE_NOTE → relationNote)
- Modify: `src/app/map/_data/roles.ts` (FEATURE_NOTE 삭제)
- Modify: `src/app/map/_data/roles.test.ts` (FEATURE_NOTE 테스트 삭제)

**Interfaces:**
- Consumes: `MapCenter.element` (Task 2), `relationNote` (Task 1)
- Produces: 화면 변경뿐 — 이후 태스크가 기대는 인터페이스 없음.

- [ ] **Step 1: page.tsx — center 를 관문에서 재료로**

`src/app/map/[share]/page.tsx` 의 loadMap 에서 주석과 반환을 고친다. 기존:

```ts
  // center 는 돌려주지 않고 관문으로만 쓴다. 화면의 중심 노드는 이름 대신
  // "나" 를 그리므로(SelfCore) MapShell 이 이 값을 받을 일이 없다 — 그래도
  // 세워는 봐야 한다. 아래 판정이 그것 때문에 있다.
  const center = centerOf(map.center.name, map.center);
```

를 다음으로:

```ts
  // center 는 두 가지로 쓰인다: (1) 관문 — 중심을 못 세우면 지도가 성립하지
  // 않는다. (2) 상세 시트의 오행 다리 문장이 "내가 무슨 오행인가"를 알아야
  // 해서 element 만 화면으로 내려보낸다. 이름·일주는 여전히 안 내려간다 —
  // 중심 노드는 "나" 를 그린다(SelfCore).
  const center = centerOf(map.center.name, map.center);
```

반환문 `return { map, people };` 을 다음으로:

```ts
  return { map, people, centerElement: center.element };
```

페이지 컴포넌트에서 구조 분해와 전달을 고친다:

```ts
  const { map, people, centerElement } = loaded;
```

```tsx
    <MapShell
      people={people}
      centerElement={centerElement}
      isOwner={session?.userId === map.ownerUserId}
      shareId={map.shareId}
      loggedIn={session !== null}
    />
```

(generateMetadata 쪽 구조 분해 `const { map, people } = loaded;` 는 그대로 둔다 — centerElement 를 안 쓰므로 고칠 필요 없다.)

- [ ] **Step 2: MapShell — prop 을 받아 그대로 내린다**

`src/app/map/_components/MapShell.tsx`:

import 에 추가:

```ts
import type { Element } from "@/lib/saju-core";
```

props 에 추가 (people 다음 줄):

```ts
export function MapShell({
  people,
  centerElement,
  isOwner,
  shareId,
  loggedIn,
}: {
  people: readonly MapPerson[];
  /** 중심(나)의 일간 오행. PersonSheet 의 궁합 단락이 쓴다. */
  centerElement: Element;
  isOwner: boolean;
  shareId: string;
  loggedIn: boolean;
}) {
```

PersonSheet 호출에 전달:

```tsx
      <PersonSheet
        person={selected}
        centerElement={centerElement}
        onClose={() => setSelectedId(null)}
      />
```

- [ ] **Step 3: PersonSheet — 설명 단락 교체**

`src/app/map/_components/PersonSheet.tsx`:

1. import 를 고친다 — `FEATURE_NOTE` 를 빼고, `RelationRole` 타입도 더는 안 쓰므로 뺀다. relationNote 와 Element 를 추가한다:

```ts
import type { Element } from "@/lib/saju-core";
import { DISPLAY_TITLES, FEATURE_LABELS, ROLE_LABELS } from "../_data/roles";
import { relationNote } from "../_data/relation-notes";
```

2. 파일 상단의 지역 상수 `ROLE_NOTE`(10~16행)를 통째로 삭제한다.

3. props 에 `centerElement` 를 추가한다:

```ts
export function PersonSheet({
  person,
  centerElement,
  onClose,
}: {
  person: MapPerson | null;
  /** 중심(나)의 일간 오행 — 궁합 단락의 오행 다리 문장이 쓴다. */
  centerElement: Element;
  onClose: () => void;
}) {
```

4. 본문 렌더를 교체한다. 기존:

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

를 다음으로:

```tsx
          {/*
            궁합 단락 — 오행 다리 문장(내 오행 × 구역) + 별명 단락(구역 × 소구역).
            별명(위 DISPLAY_TITLES 라벨)이 다르면 본문이 다르고, 지도 주인의
            일간 오행이 다르면 첫 문장이 다르다. 시트가 40vh 라 3~4문장이
            한도다 — 더 길어지면 overflow 가 아니라 카피를 줄인다.
          */}
          <p className="text-[15px] leading-relaxed text-slate-700 mt-4 m-0">
            {relationNote(centerElement, shown.role, shown.feature)}
          </p>
```

("일주가 통째로 같아요" `sameDayPillar` 블록은 그대로 둔다.)

- [ ] **Step 4: roles.ts / roles.test.ts 정리**

`src/app/map/_data/roles.ts` 에서 `FEATURE_NOTE` 상수(그 위의 독스트링 주석 포함, 49~58행)를 삭제한다. `DISPLAY_TITLES`·`FEATURE_LABELS`·`ROLE_LABELS`·`ROLE_ICON`·`ROLE_REGION_NAME` 은 그대로.

`src/app/map/_data/roles.test.ts` 에서:
- import 목록의 `FEATURE_NOTE` 를 지운다.
- `describe("六合 과 沖 의 무게")` 안의 두 테스트를 지운다: `"설명 문구 길이 차가 3자 이내다"` 와 `"기본 상태에는 설명 문구가 없다 — 배지도 문구도 붙지 않는다"`. (표시명 길이 총합 테스트는 DISPLAY_TITLES 것이므로 남긴다. 무게 원칙 자체는 relation-notes.test.ts 의 70% 테스트로 옮겨 갔다.)

- [ ] **Step 5: 전체 확인**

Run: `npm test` 그리고 `npm run typecheck`
Expected: 둘 다 PASS. 특히 typecheck — FEATURE_NOTE 를 import 하는 곳이 남아 있으면 여기서 걸린다.

- [ ] **Step 6: 커밋**

```bash
git add src/app/map/[share]/page.tsx src/app/map/_components/MapShell.tsx src/app/map/_components/PersonSheet.tsx src/app/map/_data/roles.ts src/app/map/_data/roles.test.ts
git commit -m "feat(map): 상세 시트 궁합 설명을 별명 15칸 × 내 오행 단락으로

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 브라우저 검증

**Files:** 없음 (코드 변경 없이 확인만; 넘침이 발견되면 PersonSheet 만 수정)

- [ ] **Step 1: dev 서버로 지도 열기**

preview_start(launch.json의 dev 설정)로 서버를 띄우고 `/map` 으로 들어간다(로그인 세션 필요 — 로그인된 계정으로). ⚠️ preview_start 는 워크트리에서 뜬다 — 이 브랜치가 체크아웃된 트리에서 서버가 돌고 있는지 확인할 것 (메모리: worktree-vs-running-dev-server). 이번 변경에는 마이그레이션이 없으므로 공유 dev DB 문제는 없다.

- [ ] **Step 2: 데스크톱 확인**

사람 노드를 하나 탭해 시트를 연다. 확인:
- 설명이 3~4문장 한 단락으로 나온다.
- 첫 문장에 지도 주인의 오행과 그 구역 오행이 자연어(나무·불·흙·쇠·물)로 등장한다.
- 별명(비타민/쓴약 등)이 다른 두 사람을 골라 본문이 실제로 다른지 본다.
- read_console_messages 로 에러 없음 확인.

- [ ] **Step 3: 모바일 40vh 확인**

resize_window(mobile 프리셋) 후 시트를 다시 연다. 3~4문장 + sameDayPillar 줄이 40vh 안에 들어가는지 확인. **넘치면**: 시트 내용 컨테이너(`h-full flex flex-col …` div)에 `overflow-y-auto` 를 추가하는 것이 안전판이지만, 기본 대응은 넘친 칸의 카피를 줄이는 것이다 (relation-notes.test.ts 의 70% 균형을 다시 통과해야 한다).

- [ ] **Step 4: 스크린샷 공유**

computer(screenshot) 로 시트가 열린 화면을 찍어 사용자에게 공유한다. desktop 프리셋으로 복원한다.

- [ ] **Step 5: 수정이 있었다면 커밋**

수정이 있었을 때만:

```bash
git add -A src/app/map
git commit -m "fix(map): 모바일 40vh 에서 궁합 단락이 넘치지 않게

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
