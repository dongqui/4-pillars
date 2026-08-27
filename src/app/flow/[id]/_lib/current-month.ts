// 읽는 시점이 속한 달. **화면 강조에만 쓴다.**
//
// 앞선 설계는 읽는 시점으로 저장된 서술을 골랐다. 이제 고르지 않는다 — 본문은
// 12개월 전부이고 시제 중립이라, 언제 열어도 같은 글이 같은 뜻으로 읽힌다.
// 여기서 내는 것은 "지금" 배지를 어디에 붙일지뿐이다.

import type { FlowMonth } from "@/app/api/flows/_lib/pivots";

/**
 * 지금이 속한 달의 index(1‥12). 기간 밖이면 **null**.
 *
 * 앞선 currentSegmentIndex 는 못 찾으면 마지막 칸으로 물러섰다. 여기서 그렇게
 * 하면 2021년 리포트에서 12월이 "현재" 로 표시된다 — 사용자가 지난 해와 다가올
 * 해를 고르는 이상 기간 밖이 정상이다.
 */
export function currentMonthIndex(months: FlowMonth[], now: Date): number | null {
  const t = now.getTime();
  const hit = months.find((m) => t >= Date.parse(m.start) && t < Date.parse(m.end));
  return hit ? hit.index : null;
}

/** 절대 시각을 KST 민간 날짜로 읽는다. */
function kst(iso: string): Date {
  return new Date(Date.parse(iso) + 9 * 3600_000);
}

/** "3월" — 그 달의 대부분을 차지하는 달력 월이다. */
export function monthLabel(m: FlowMonth): string {
  return `${kst(m.start).getUTCMonth() + 1}월`;
}

/**
 * "3월 초 ~ 4월 초" — 보조 표기.
 *
 * 명리 월운은 달력 1일~말일과 일치하지 않는다(§18). 이름만 두면 사용자가 같다고
 * 오해하므로 실제 절기 기준 기간을 함께 보여준다.
 */
export function monthRange(m: FlowMonth): string {
  const phase = (d: Date) => {
    const day = d.getUTCDate();
    return day <= 10 ? "초" : day <= 20 ? "중순" : "말";
  };
  const s = kst(m.start);
  const e = kst(m.end);
  return `${s.getUTCMonth() + 1}월 ${phase(s)} ~ ${e.getUTCMonth() + 1}월 ${phase(e)}`;
}
