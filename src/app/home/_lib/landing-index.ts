/**
 * 한 줄을 지운 뒤 셀렉터가 착지할 자리 — 살아남은 목록 기준의 index 다.
 * 아무것도 남지 않으면 -1.
 *
 * 이 계산이 따로 나와 있는 이유: 셀렉터는 클라이언트 컴포넌트라 테스트가 렌더하지
 * 못한다. 자리를 잘못 짚으면 화면과 DB 가 다른 사람을 가리키게 되는데, 그 사실이
 * 눈에 띄는 곳은 다음 방문뿐이라 손으로 잡기 어렵다.
 *
 * @param total  지우기 전 목록의 길이
 * @param removed 지운 줄의 자리
 * @param index  보고 있던 줄의 자리
 */
export function landingIndex(total: number, removed: number, index: number): number {
  const shifted = removed < index ? index - 1 : index;
  return Math.min(shifted, total - 2);
}
