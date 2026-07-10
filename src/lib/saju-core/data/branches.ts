// 지지(地支) 데이터 — 대표(본기) 오행, 음양, 본기 천간
//
// 십성·오행 집계는 "본기(正氣)만" 방침이므로 각 지지를 대표 천간 1개로 환원한다.
// 십성 분류에는 지지 자체 음양이 아니라 본기 천간(mainStem)의 음양을 쓴다
// (子午巳亥의 체용 음양 불일치를 피하기 위함).

import type { Element, Stem, YinYang } from "./stems";

export type Branch =
  | "자" | "축" | "인" | "묘" | "진" | "사"
  | "오" | "미" | "신" | "유" | "술" | "해";

export interface BranchInfo {
  /** 대표(본기) 오행 */
  element: Element;
  /** 지지 자체 음양 (자인진오신술=양, 축묘사미유해=음) */
  yinYang: YinYang;
  /** 본기(正氣) 천간 */
  mainStem: Stem;
}

export const BRANCHES: Record<Branch, BranchInfo> = {
  자: { element: "수", yinYang: "양", mainStem: "계" },
  축: { element: "토", yinYang: "음", mainStem: "기" },
  인: { element: "목", yinYang: "양", mainStem: "갑" },
  묘: { element: "목", yinYang: "음", mainStem: "을" },
  진: { element: "토", yinYang: "양", mainStem: "무" },
  사: { element: "화", yinYang: "음", mainStem: "병" },
  오: { element: "화", yinYang: "양", mainStem: "정" },
  미: { element: "토", yinYang: "음", mainStem: "기" },
  신: { element: "금", yinYang: "양", mainStem: "경" },
  유: { element: "금", yinYang: "음", mainStem: "신" },
  술: { element: "토", yinYang: "양", mainStem: "무" },
  해: { element: "수", yinYang: "음", mainStem: "임" },
};

export const BRANCH_ORDER: readonly Branch[] = [
  "자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해",
];

export function isBranch(ch: string): ch is Branch {
  return ch in BRANCHES;
}
