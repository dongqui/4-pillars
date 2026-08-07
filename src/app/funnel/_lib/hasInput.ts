import type { FunnelData } from "../_context/FunnelContext";

/**
 * 사용자가 실제로 채운 값이 하나라도 있는지. 퍼널 입력은 메모리에만 있어서 페이지를
 * 떠나면 사라지므로, 나가려 할 때 확인을 물을지 판단하는 데 쓴다.
 *
 * calendar / timeKnown / trueSolar / isLeapMonth 는 기본값이 있어 손대지 않아도 값이
 * 있는 것처럼 보인다 — 세어 봐야 "아무것도 안 했는데 왜 묻지?" 가 되니 제외한다.
 */
export function hasInput(d: FunnelData): boolean {
  return (
    d.name.trim().length > 0 ||
    d.gender !== null ||
    d.birth !== null ||
    d.time !== null ||
    d.birthPlace !== null
  );
}
