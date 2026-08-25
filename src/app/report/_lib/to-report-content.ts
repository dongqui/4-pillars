// 계산값(SajuAnalysis) + LLM 섹션(Interpretation) → 화면 뷰모델(ReportContent).
// 두 출처를 합치는 유일한 자리. 어느 필드가 어디서 왔는지 여기서만 보면 된다.

import type { SajuAnalysis } from "@/lib/saju-core";
import type { Interpretation } from "@/app/api/saju/_lib/sections";
import { toChartEvidence } from "./evidence";
import type { ReportContent } from "./report-content";

export function toReportContent(
  analysis: SajuAnalysis,
  interpretation: Partial<Interpretation>,
  meta: { name: string; birthLine: string },
  /** 근거 패널의 "지금 이 대운" 표시에 쓴다. */
  year: number,
): ReportContent {
  const { overview, cautions, wealth } = interpretation;

  return {
    meta,
    headline: overview?.headline ?? "",
    summary: overview?.summary ?? "",
    // 칩과 카드가 같은 배열에서 나온다 — 두 값이 갈라질 수 없다.
    personality: overview?.traits ?? [],
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
  };
}
