// 대운 전환이 이 명리 연도 안에 드는가.
//
// 대운은 구간 경계가 아니다 — 경계는 입춘 단독이고 상품 단위는 연 1회다.
// 대운 전환은 "전환 후보" 이고, 전후 변화가 임계를 넘을 때만 구간이 갈린다.
// (판정은 api/flows/_lib/segments.ts)

import type { SajuAnalysis } from "../analyze";
import type { DaeunPeriod } from "../luck";
import type { FlowYearPeriod } from "./year";

export interface DaeunSwitch {
  /** 전환 순간 */
  at: Date;
  before: DaeunPeriod;
  after: DaeunPeriod;
}

/** 율리우스력 1년의 평균 길이(ms). 나이를 시각으로 옮길 때 쓴다. */
const YEAR_MS = 365.25 * 24 * 3600_000;

/** 출생 순간(KST 민간시)을 절대 시각으로. */
function birthInstant(analysis: SajuAnalysis): Date {
  const s = analysis.chart.solar;
  return new Date(
    Date.UTC(s.year, s.month - 1, s.day, s.hour ?? 0, s.minute, 0) - 9 * 3600_000,
  );
}

/**
 * 이 구간 안에 드는 대운 전환. 없으면 null.
 *
 * 회차 i 의 전환 시각 = 출생 + (startAgePrecise + i×10) 년.
 * 반올림된 periods[i].startAge 를 쓰지 않는 이유: 대운수는 정수로 반올림되므로
 * 최대 반년이 어긋난다. 구간 경계를 여기서 정하지는 않지만, 07 섹션이 "11월
 * 무렵부터" 를 이 값에서 뽑으므로 반년 오차는 그대로 사용자에게 보인다.
 */
export function daeunSwitchIn(
  analysis: SajuAnalysis,
  period: FlowYearPeriod,
): DaeunSwitch | null {
  const { startAgePrecise, periods } = analysis.daeun;
  const birth = birthInstant(analysis).getTime();

  for (let i = 1; i < periods.length; i += 1) {
    const at = birth + (startAgePrecise + i * 10) * YEAR_MS;
    if (at >= period.start.getTime() && at < period.end.getTime()) {
      return { at: new Date(at), before: periods[i - 1], after: periods[i] };
    }
  }

  return null;
}
