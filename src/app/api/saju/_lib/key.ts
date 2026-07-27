import type { Chart, SajuAnalysis } from "@/lib/saju-core";

/**
 * 원국 캐시 키. 4기둥(한글 간지) + 성별을 | 로 연결한다.
 * 시주가 없으면 "none". 예: "경오|신사|정묘|을사|male"
 */
export function chartKey(chart: Chart): string {
  const hour = chart.hour?.korean ?? "none";
  return [chart.year.korean, chart.month.korean, chart.day.korean, hour, chart.gender].join("|");
}

/** DB 저장용 원국 간지(참고/디버깅용) */
export interface PillarsJson {
  year: string;
  month: string;
  day: string;
  hour: string | null;
}

export function pillarsJson(chart: Chart): PillarsJson {
  return {
    year: chart.year.korean,
    month: chart.month.korean,
    day: chart.day.korean,
    hour: chart.hour?.korean ?? null,
  };
}

/**
 * 생시 의존 해석(세운·대운)의 캐시 키.
 * chartKey + 대운 기산값(방향·대운수·기준 절기) + 기준 연도.
 *
 * 연도를 넣는 이유: 세운은 해마다 바뀌고, 대운도 "지금 어디"가 해마다 옮겨간다.
 * chartKey 를 넓히지 않고 따로 두는 이유: 원국 해석 캐시의 적중률을 지키려고.
 */
export function luckKey(analysis: SajuAnalysis, year: number): string {
  const { direction, daeunSu, basisTerm } = analysis.daeun;
  return [chartKey(analysis.chart), direction, daeunSu, basisTerm, year].join("|");
}
