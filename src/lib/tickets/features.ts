/**
 * 이용권을 쓰는 서비스와 단가. 새 서비스는 여기 두 줄로 추가된다 —
 * FEATURE_IDS 에 id 하나, FEATURE_COST 에 단가 하나.
 *
 * Feature 를 배열에서 파생시키는 것이 요점이다. 차감 API 가 문자열을 그대로 받으면
 * 오타가 조용한 무료 열람이 된다 — 타입으로 막으면 그 오타는 컴파일에서 걸린다.
 *
 * 값은 entitlements.feature 컬럼에 그대로 들어간다. 한 번 나간 값은 사용자의
 * 열람 권한이므로 이름을 바꾸려면 마이그레이션이 필요하다.
 */
export const FEATURE_IDS = ["full_report", "compatibility", "consultation"] as const;

export type Feature = (typeof FEATURE_IDS)[number];

/** Record 라 서비스를 추가하면 단가를 빠뜨릴 수 없다 — 여기서 컴파일이 깨진다. */
export const FEATURE_COST: Record<Feature, number> = {
  full_report: 1,
  compatibility: 1,
  consultation: 1,
};
