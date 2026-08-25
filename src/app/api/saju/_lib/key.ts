import type { Chart } from "@/lib/saju-core";

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
