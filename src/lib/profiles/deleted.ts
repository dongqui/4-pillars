/**
 * 지워진 프로필로 새로 생성하려 했다.
 *
 * 프로필 삭제가 소프트 삭제가 된 뒤로(0050) 그 프로필로 만든 흐름·궁합 행은 남는다 —
 * 이미 산 리포트를 URL 로 다시 열 수 있어야 해서다. 그런데 두 페이지는 **렌더하면서**
 * 저장 안 된 섹션을 생성하고 그 자리에서 이용권을 쓴다. 지워진 사람으로 그 길이 열리면
 * 사용자가 지운 사람에게 돈이 나간다. 이 오류는 그 길을 이용권을 쓰기 **전에** 끊는다.
 */
export class ProfileDeletedError extends Error {
  constructor() {
    super("지워진 프로필로는 새로 만들 수 없습니다");
    this.name = "ProfileDeletedError";
  }
}

/**
 * produceFlowSections·produceMatchSections 는 생성기 예외를 *GenerationError 로 감싸며
 * 원인을 cause 에 넣는다. 페이지는 감싼 쪽을 받으므로 cause 까지 본다 —
 * isFlowOutOfTickets·isMatchOutOfTickets 와 같은 모양이다.
 */
export function isProfileDeletedError(e: unknown): boolean {
  if (e instanceof ProfileDeletedError) return true;
  return e instanceof Error && e.cause instanceof ProfileDeletedError;
}
