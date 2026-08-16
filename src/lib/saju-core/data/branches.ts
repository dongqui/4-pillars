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
  /** 한자 (예: "子") */
  hanja: string;
}

export const BRANCHES: Record<Branch, BranchInfo> = {
  자: { element: "수", yinYang: "양", mainStem: "계", hanja: "子" },
  축: { element: "토", yinYang: "음", mainStem: "기", hanja: "丑" },
  인: { element: "목", yinYang: "양", mainStem: "갑", hanja: "寅" },
  묘: { element: "목", yinYang: "음", mainStem: "을", hanja: "卯" },
  진: { element: "토", yinYang: "양", mainStem: "무", hanja: "辰" },
  사: { element: "화", yinYang: "음", mainStem: "병", hanja: "巳" },
  오: { element: "화", yinYang: "양", mainStem: "정", hanja: "午" },
  미: { element: "토", yinYang: "음", mainStem: "기", hanja: "未" },
  신: { element: "금", yinYang: "양", mainStem: "경", hanja: "申" },
  유: { element: "금", yinYang: "음", mainStem: "신", hanja: "酉" },
  술: { element: "토", yinYang: "양", mainStem: "무", hanja: "戌" },
  해: { element: "수", yinYang: "음", mainStem: "임", hanja: "亥" },
};

export const BRANCH_ORDER: readonly Branch[] = [
  "자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해",
];

export function isBranch(ch: string): ch is Branch {
  return ch in BRANCHES;
}

/**
 * 육합(六合) — 자축·인해·묘술·진유·사신·오미.
 * 12지지가 6쌍으로 빠짐없이 짝지어지므로 짝 하나를 가리키는 표로 충분하다.
 */
export const BRANCH_HAP: Record<Branch, Branch> = {
  자: "축", 축: "자",
  인: "해", 해: "인",
  묘: "술", 술: "묘",
  진: "유", 유: "진",
  사: "신", 신: "사",
  오: "미", 미: "오",
};

/** 충(沖) — 자오·축미·인신·묘유·진술·사해. 마주 보는 지지(6칸 차이)끼리 부딪친다. */
export const BRANCH_CHUNG: Record<Branch, Branch> = {
  자: "오", 오: "자",
  축: "미", 미: "축",
  인: "신", 신: "인",
  묘: "유", 유: "묘",
  진: "술", 술: "진",
  사: "해", 해: "사",
};
