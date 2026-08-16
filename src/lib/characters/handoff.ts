/**
 * 리빌 → 홈 핸드오프 신호를 담는 sessionStorage 키.
 *
 * 쿼리 파라미터가 아닌 이유: `/home?from=reveal` 은 새로고침이나 링크 공유 때마다
 * 연출이 다시 재생된다. 한 번 쓰고 지우는 값이어야 한다.
 */
export const HANDOFF_KEY = "saju:handoff";
