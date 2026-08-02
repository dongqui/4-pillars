// 계산값(SajuAnalysis) + LLM 섹션(Interpretation) → 화면 뷰모델(ReportContent).
// 두 출처를 합치는 유일한 자리. 어느 필드가 어디서 왔는지 여기서만 보면 된다.

import type { SajuAnalysis } from "@/lib/saju-core";
import type { Interpretation } from "@/app/api/saju/_lib/sections";
import { toChartEvidence } from "./evidence";
import type { DaeunRow, ReportContent, TimelineRow } from "./report-content";

/**
 * LLM 서술 배열에 계산된 기간을 인덱스로 붙인다.
 * 서술이 더 많으면 자르고, 모자라면 배열 전체를 undefined 로 — 인덱스가 어긋난 채로
 * 붙이면 엉뚱한 연령대에 엉뚱한 설명이 달린다.
 */
function zipTimeline<T>(
  notes: { title: string; desc: string }[] | undefined,
  computed: string[],
  make: (note: { title: string; desc: string }, label: string, index: number) => T,
): T[] | undefined {
  if (!notes || notes.length < computed.length) return undefined;
  return computed.map((label, i) => make(notes[i], label, i));
}

export function toReportContent(
  analysis: SajuAnalysis,
  interpretation: Partial<Interpretation>,
  meta: { name: string; birthLine: string },
  year: number,
): ReportContent {
  const { overview, cautions, daeunOutlook, yearlyLuck, wealth } = interpretation;
  // daeun.periods[].startAge 는 세는 나이 기준(luck.ts 주석 참고: "세는 나이 기준 대운수 …").
  // 만 나이(year - solar.year)로 비교하면 경계에서 대운이 하나씩 밀려 잘못 표시된다.
  // 세는 나이는 "태어난 해를 1살로 센다" → 해당 연도 - 출생 연도 + 1. (evidence.ts 와 동일한 규칙)
  const age = year - analysis.chart.solar.year + 1;

  const daeunLabels = analysis.daeun.periods.map((p) => `${p.startAge}–${p.startAge + 9}세`);
  const daeunRows = zipTimeline<DaeunRow>(
    daeunOutlook?.rows,
    daeunLabels,
    (note, range, i) => {
      const p = analysis.daeun.periods[i];
      const now = age >= p.startAge && age < p.startAge + 10;
      return { range, title: note.title, desc: note.desc, ...(now ? { now: true } : {}) };
    },
  );

  // 세운은 기준 연도부터 서술 개수만큼
  const yearLabels = (yearlyLuck ?? []).map((_, i) => `${year + i}년`);
  const yearlyRows = zipTimeline<TimelineRow>(
    yearlyLuck,
    yearLabels,
    (note, period) => ({ period, title: note.title, desc: note.desc }),
  );

  return {
    meta,
    headline: overview?.headline ?? "",
    summary: overview?.summary ?? "",
    keywords: overview?.keywords ?? [],
    personality: interpretation.personality ?? [],
    evidence: toChartEvidence(analysis, year),
    outerVsInner: interpretation.outerVsInner ?? { outward: "", inner: "" },
    strengths: interpretation.strengths ?? [],
    cautions: cautions?.items ?? [],
    cautionTip: cautions?.tip ?? "",
    emotion: interpretation.emotion,
    relating: interpretation.relating,
    environment: interpretation.environment,
    love: interpretation.love,
    compatibility: interpretation.compatibility,
    wealth,
    yearlyLuck: yearlyRows,
    daeunOutlook: daeunRows && daeunOutlook
      ? { rows: daeunRows, summary: daeunOutlook.summary, emphasis: daeunOutlook.emphasis }
      : undefined,
  };
}
