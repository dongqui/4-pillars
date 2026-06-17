// @4-pillars/report-engine — 콘텐츠 조합 리포트 생성 (스텁)

import type { Locale, SajuChart } from "@4-pillars/types";
import { content } from "@4-pillars/content";

export interface ReportSection {
  title: string;
  body: string;
}

export interface Report {
  locale: Locale;
  sections: ReportSection[];
}

/** 사주 원국 + 룰 기반 콘텐츠를 조합해 리포트를 만든다. (미구현) */
export function buildReport(_chart: SajuChart, locale: Locale): Report {
  // content[locale] 사전을 조합할 예정
  void content[locale];
  throw new Error("buildReport: not implemented");
}
