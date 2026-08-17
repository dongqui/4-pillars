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
export const FEATURE_IDS = ["full_report", "compatibility"] as const;

export type Feature = (typeof FEATURE_IDS)[number];

/** Record 라 서비스를 추가하면 단가를 빠뜨릴 수 없다 — 여기서 컴파일이 깨진다. */
export const FEATURE_COST: Record<Feature, number> = {
  full_report: 1,
  compatibility: 1,
};

/**
 * 궁합처럼 두 사람이 대상인 서비스의 subject_key.
 *
 * 정렬하는 이유: (12,34) 와 (34,12) 는 같은 궁합인데 키가 다르면 같은 사용자가
 * 두 번 차감된다. 프로필 id 는 순번 bigint 라 문자열 정렬은 "10" < "9" 로
 * 어긋난다 — BigInt 로 비교한다.
 *
 * 호출자가 형식을 검증해 넘긴다(parseProfileParam). 검증 없이 오면 BigInt() 가 던진다.
 */
export function pairKey(a: string, b: string): string {
  return BigInt(a) <= BigInt(b) ? `${a}:${b}` : `${b}:${a}`;
}
