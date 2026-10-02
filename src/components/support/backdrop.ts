/**
 * <dialog> 의 click 이 진짜 백드롭에서 왔는가.
 *
 * `e.target === dialog` 만으로는 모자라다: 이 모달은 dialog 요소 자신이 카드라서, 카드 안쪽
 * 여백이나 칸 사이 간격을 눌러도 target 이 dialog 다. 그걸 백드롭으로 읽으면 쓰던 문의가
 * 확인 없이 날아간다. 좌표가 카드 사각형 밖일 때만 바깥이다.
 */
export function isOutsideRect(
  rect: { left: number; top: number; right: number; bottom: number },
  x: number,
  y: number,
): boolean {
  return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
}
