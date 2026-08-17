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

import { hslToHex, type Hsl } from "./hsl";

export const STEMS = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"] as const;
export const BRANCHES = [
  "자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해",
] as const;

type Stem = (typeof STEMS)[number];

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
