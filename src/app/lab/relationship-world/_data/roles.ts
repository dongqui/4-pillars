export type RelationRole =
  | "fill"      // 나를 채워주는 사람
  | "beside"    // 나란히 서는 사람
  | "express"   // 나를 표현하게 하는 사람
  | "move"      // 나를 움직이게 하는 사람
  | "refine";   // 나를 다듬는 사람

export type Feature = "none" | "yukhap" | "chung";

export const ROLE_ORDER: readonly RelationRole[] = [
  "fill",
  "beside",
  "express",
  "move",
  "refine",
] as const;

export const ROLE_LABELS: Record<RelationRole, string> = {
  fill: "나를 채워주는 사람",
  beside: "나란히 서는 사람",
  express: "나를 표현하게 하는 사람",
  move: "나를 움직이게 하는 사람",
  refine: "나를 다듬는 사람",
};

// 六合 / 沖 은 배지 문구까지 같은 무게여야 한다. 한쪽만 길거나
// 한쪽만 형용사가 붙으면 그 순간 좋고 나쁨으로 읽힌다.
export const FEATURE_LABELS: Record<Exclude<Feature, "none">, string> = {
  yukhap: "六合",
  chung: "沖",
};

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
