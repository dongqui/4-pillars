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

/**
 * 삼합(三合) — 신자진 수국 · 해묘미 목국 · 인오술 화국 · 사유축 금국.
 *
 * 3자 국이 아니라 "나를 뺀 나머지 둘" 로 둔다. 궁합은 두 사람의 지지를 한 글자씩
 * 짝지어 보므로 세 글자가 한자리에 모이는 일이 없다 — 판정은 언제나 반합(半合)이다.
 */
export const BRANCH_SAMHAP: Record<Branch, readonly [Branch, Branch]> = {
  신: ["자", "진"], 자: ["신", "진"], 진: ["신", "자"],
  해: ["묘", "미"], 묘: ["해", "미"], 미: ["해", "묘"],
  인: ["오", "술"], 오: ["인", "술"], 술: ["인", "오"],
  사: ["유", "축"], 유: ["사", "축"], 축: ["사", "유"],
};

/**
 * 형(刑) — 인사신 · 축술미 삼형, 자묘 상형, 진·오·유·해 자형.
 *
 * 유일하게 배열인 이유: 삼형은 한 지지가 둘을 상대한다. 자형은 자기 자신을 담는데,
 * 두 사람이 같은 지지를 가진 경우가 실제로 자형이라 예외가 아니라 정의다.
 */
export const BRANCH_HYEONG: Record<Branch, readonly Branch[]> = {
  인: ["사", "신"], 사: ["인", "신"], 신: ["인", "사"],
  축: ["술", "미"], 술: ["축", "미"], 미: ["축", "술"],
  자: ["묘"], 묘: ["자"],
  진: ["진"], 오: ["오"], 유: ["유"], 해: ["해"],
};

/** 해(害) — 자미·축오·인사·묘진·신해·유술. */
export const BRANCH_HAE: Record<Branch, Branch> = {
  자: "미", 미: "자",
  축: "오", 오: "축",
  인: "사", 사: "인",
  묘: "진", 진: "묘",
  신: "해", 해: "신",
  유: "술", 술: "유",
};

/** 파(破) — 자유·축진·인해·묘오·사신·미술. */
export const BRANCH_PA: Record<Branch, Branch> = {
  자: "유", 유: "자",
  축: "진", 진: "축",
  인: "해", 해: "인",
  묘: "오", 오: "묘",
  사: "신", 신: "사",
  미: "술", 술: "미",
};

/** 원진(怨嗔) — 자미·축오·인유·묘신·진해·사술. 자미·축오는 해(害)와 겹친다. */
export const BRANCH_WONJIN: Record<Branch, Branch> = {
  자: "미", 미: "자",
  축: "오", 오: "축",
  인: "유", 유: "인",
  묘: "신", 신: "묘",
  진: "해", 해: "진",
  사: "술", 술: "사",
};
