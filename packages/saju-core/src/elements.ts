// 오행(五行) 분포 — 원국 8자(천간4 + 지지 본기4)의 오행 집계

import type { Chart, Pillar } from "./chart.js";
import { STEMS, type Element } from "./data/stems.js";
import { BRANCHES } from "./data/branches.js";
import { ELEMENTS } from "./data/relations.js";

export interface ElementDistribution {
  /** 오행별 개수 */
  counts: Record<Element, number>;
  /** 오행별 백분율 (합 ≈ 100, 소수 1자리) */
  percentages: Record<Element, number>;
  /** 집계에 포함된 글자 수 (시주 유무에 따라 6 또는 8) */
  total: number;
}

function emptyTally(): Record<Element, number> {
  return { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
}

export function distributeElements(chart: Chart): ElementDistribution {
  const counts = emptyTally();
  const pillars: Pillar[] = [chart.year, chart.month, chart.day, chart.hour].filter(
    (p): p is Pillar => p !== null,
  );

  for (const p of pillars) {
    counts[STEMS[p.stem].element] += 1;
    counts[BRANCHES[p.branch].element] += 1; // 지지는 본기 오행
  }

  const total = pillars.length * 2;
  const percentages = emptyTally();
  for (const el of ELEMENTS) {
    percentages[el] = total === 0 ? 0 : Math.round((counts[el] / total) * 1000) / 10;
  }

  return { counts, percentages, total };
}
