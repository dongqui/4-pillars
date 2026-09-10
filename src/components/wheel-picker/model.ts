/** 휠 한 칸의 높이(px). 스크롤 스냅과 하이라이트 띠가 모두 이 값에 맞춰져 있다. */
export const WHEEL_ITEM_HEIGHT = 44;

/** 한 번에 보이는 칸 수. 가운데 칸이 선택 칸이라 홀수여야 한다. */
export const WHEEL_VISIBLE_ROWS = 5;

/** 선택 띠까지의 오프셋 — 위로 두 칸 비워 가운데 칸이 선택 칸이 되게 한다. */
export const WHEEL_PAD = WHEEL_ITEM_HEIGHT * Math.floor(WHEEL_VISIBLE_ROWS / 2);

export function range(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i += 1) out.push(i);
  return out;
}

/** 스크롤 위치를 가장 가까운 칸 인덱스로 바꾼다. 양 끝 밖은 끝 칸으로 붙인다. */
export function indexFromScroll(scrollTop: number, length: number): number {
  if (length <= 0) return 0;
  const i = Math.round(scrollTop / WHEEL_ITEM_HEIGHT);
  return Math.min(length - 1, Math.max(0, i));
}

export function scrollForIndex(index: number): number {
  return index * WHEEL_ITEM_HEIGHT;
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
