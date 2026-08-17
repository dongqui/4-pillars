// 천간(天干) 데이터 — 오행과 음양

export type Element = "목" | "화" | "토" | "금" | "수";
export type YinYang = "양" | "음";

export type Stem =
  | "갑" | "을" | "병" | "정" | "무"
  | "기" | "경" | "신" | "임" | "계";

export interface StemInfo {
  element: Element;
  yinYang: YinYang;
  /** 한자 (예: "甲") */
  hanja: string;
}

/** 10천간: 갑을(목) 병정(화) 무기(토) 경신(금) 임계(수), 양음 교대 */
export const STEMS: Record<Stem, StemInfo> = {
  갑: { element: "목", yinYang: "양", hanja: "甲" },
  을: { element: "목", yinYang: "음", hanja: "乙" },
  병: { element: "화", yinYang: "양", hanja: "丙" },
  정: { element: "화", yinYang: "음", hanja: "丁" },
  무: { element: "토", yinYang: "양", hanja: "戊" },
  기: { element: "토", yinYang: "음", hanja: "己" },
  경: { element: "금", yinYang: "양", hanja: "庚" },
  신: { element: "금", yinYang: "음", hanja: "辛" },
  임: { element: "수", yinYang: "양", hanja: "壬" },
  계: { element: "수", yinYang: "음", hanja: "癸" },
};

export const STEM_ORDER: readonly Stem[] = [
  "갑", "을", "병", "정", "무", "기", "경", "신", "임", "계",
];

export function isStem(ch: string): ch is Stem {
  return ch in STEMS;
}
