// 통합 분석 — 원국부터 대운까지 한 번에 계산

import { buildChart, type BirthInput, type Chart } from "./chart.js";
import { distributeElements, type ElementDistribution } from "./elements.js";
import { analyzeTenGods, type TenGodResult } from "./ten-gods.js";
import { scoreStrength, type StrengthScore } from "./strength.js";
import { selectYongsin, type Yongsin } from "./yongsin.js";
import { computeDaeun, type Daeun } from "./luck.js";

export interface SajuAnalysis {
  chart: Chart;
  /** 오행 분포 */
  elements: ElementDistribution;
  /** 십성 분포 */
  tenGods: TenGodResult;
  /** 신강/신약 */
  strength: StrengthScore;
  /** 용신/희신 */
  yongsin: Yongsin;
  /** 대운 */
  daeun: Daeun;
}

export function analyze(
  input: BirthInput,
  options?: { daeunCount?: number },
): SajuAnalysis {
  const chart = buildChart(input);
  const strength = scoreStrength(chart);
  return {
    chart,
    elements: distributeElements(chart),
    tenGods: analyzeTenGods(chart),
    strength,
    yongsin: selectYongsin(chart, strength),
    daeun: computeDaeun(chart, { count: options?.daeunCount }),
  };
}
