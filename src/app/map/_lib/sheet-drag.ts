/**
 * 모바일 하단 시트를 손가락으로 여닫는 규칙. 브라우저 없이 잴 수 있도록 순수
 * 계산만 둔다 — 포인터 이벤트를 듣고 이 값을 화면에 붙이는 일은 MapShell 이
 * 한다.
 *
 * 이 파일이 생긴 이유: 시트에는 손잡이 모양만 있었고 끄는 동작이 아예 없었다.
 * 앱이 제스처를 가져가지 않으니 아래로 끄는 손짓은 그대로 브라우저에게 갔고,
 * 크롬 안드로이드가 그것을 당겨서-새로고침으로 받아 페이지가 통째로 다시
 * 열렸다. 그래서 (1) 손잡이 줄에 touch-action:none 을 걸어 브라우저에게서
 * 제스처를 뺏고 (2) 뺏은 제스처로 실제로 시트를 여닫는다. 둘 중 하나만 하면
 * 새로고침은 막히되 아무 일도 일어나지 않는 죽은 손잡이가 된다.
 *
 * 시트의 상태는 예전부터 열림/접힘 둘뿐이다(PeopleList 의 open). 끌기는 그
 * 둘 사이를 오가는 또 하나의 길일 뿐, 중간 높이를 새로 만들지 않는다 —
 * 중간 높이를 두면 지도가 가려지는 정도가 사용자마다 달라져, 원반이 시트에
 * 가리지 않게 맞춰 둔 42dvh 계산(PeopleList)이 뜻을 잃는다.
 */

/** 이만큼도 안 움직였으면 끌기가 아니라 탭이 흔들린 것이다. */
export const TAP_SLOP = 8;

/** 느리게 끌 때 상태가 바뀌는 거리. 손잡이 줄 높이(약 59px)와 비슷하게 잡았다. */
export const DRAG_DISTANCE = 56;

/** 짧게 끌어도 이 속도(px/ms)로 튕기면 상태가 바뀐다. */
export const FLICK_VELOCITY = 0.4;

/**
 * 끄는 동안 시트를 아래로 얼마나 내릴지.
 *
 * max 는 "접혔을 때의 자리까지" 다(시트 높이 − 손잡이 줄 높이). 거기서 멈추므로
 * 끄는 내내 손잡이가 화면에 남아 있고, 손을 떼면서 접히는 순간 시트가 이미 그
 * 자리에 있어 튀지 않는다. 위로 끄는 것은 따라가지 않는다 — 열린 시트가 더
 * 올라갈 자리가 없고, 접힌 시트는 올라갈 내용이 아직 없다.
 */
export function sheetOffset(dy: number, max: number): number {
  if (dy <= 0) return 0;
  return dy > max ? max : dy;
}

/** 손을 뗐을 때 시트가 갈 곳. "stay" 는 끌기 전 상태로 되돌아간다는 뜻이다. */
export type Settle = "open" | "close" | "stay";

export function settleSheet({
  open,
  dy,
  dt,
}: {
  /** 끌기 시작할 때 시트가 펼쳐져 있었는지. */
  open: boolean;
  /** 세로로 움직인 거리(px). 아래가 양수다. */
  dy: number;
  /** 끄는 데 걸린 시간(ms). */
  dt: number;
}): Settle {
  const distance = Math.abs(dy);
  if (distance < TAP_SLOP) return "stay";

  // dt 가 0 인 경우(같은 타임스탬프의 down/up)는 속도를 물을 수 없다. 0 으로
  // 두면 거리 판정만 남아, 아래의 far 가 답한다.
  const velocity = dt > 0 ? distance / dt : 0;
  if (distance < DRAG_DISTANCE && velocity < FLICK_VELOCITY) return "stay";

  const down = dy > 0;
  if (open) return down ? "close" : "stay";
  return down ? "stay" : "open";
}
