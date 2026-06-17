// 오행 생극(生剋)과 십성(十星) 분류 규칙

import type { Element, YinYang } from "./stems.js";

export const ELEMENTS: readonly Element[] = ["목", "화", "토", "금", "수"];

/** 생(生): 목생화 화생토 토생금 금생수 수생목 */
const GENERATES: Record<Element, Element> = {
  목: "화", 화: "토", 토: "금", 금: "수", 수: "목",
};

/** 극(剋): 목극토 토극수 수극화 화극금 금극목 */
const CONTROLS: Record<Element, Element> = {
  목: "토", 토: "수", 수: "화", 화: "금", 금: "목",
};

/** a가 생하는 오행 */
export function elementGenerates(a: Element): Element {
  return GENERATES[a];
}

/** a가 극하는 오행 */
export function elementControls(a: Element): Element {
  return CONTROLS[a];
}

/** e를 생하는 오행 (인성 방향) */
export function generatedBy(e: Element): Element {
  return (ELEMENTS.find((k) => GENERATES[k] === e))!;
}

/** e를 극하는 오행 (관성 방향) */
export function controlledBy(e: Element): Element {
  return (ELEMENTS.find((k) => CONTROLS[k] === e))!;
}

export type TenGod =
  | "비견" | "겁재" | "식신" | "상관" | "편재"
  | "정재" | "편관" | "정관" | "편인" | "정인";

export type TenGodGroup = "비겁" | "식상" | "재성" | "관성" | "인성";

export interface ElementYinYang {
  element: Element;
  yinYang: YinYang;
}

/**
 * 일간(day) 기준으로 대상(target)의 십성을 판정한다.
 * 偏(편)=같은 음양, 正(정)=다른 음양. 단 비견/식신/편재/편관/편인=같은 음양.
 */
export function tenGod(day: ElementYinYang, target: ElementYinYang): TenGod {
  const same = day.yinYang === target.yinYang;
  const D = day.element;
  const E = target.element;
  if (E === D) return same ? "비견" : "겁재";
  if (GENERATES[D] === E) return same ? "식신" : "상관"; // D生E 식상
  if (CONTROLS[D] === E) return same ? "편재" : "정재"; // D剋E 재성
  if (CONTROLS[E] === D) return same ? "편관" : "정관"; // E剋D 관성
  if (GENERATES[E] === D) return same ? "편인" : "정인"; // E生D 인성
  throw new Error(`tenGod: unreachable (${D}, ${E})`);
}

export function tenGodGroup(g: TenGod): TenGodGroup {
  switch (g) {
    case "비견":
    case "겁재":
      return "비겁";
    case "식신":
    case "상관":
      return "식상";
    case "편재":
    case "정재":
      return "재성";
    case "편관":
    case "정관":
      return "관성";
    case "편인":
    case "정인":
      return "인성";
  }
}
