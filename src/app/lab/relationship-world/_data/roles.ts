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
