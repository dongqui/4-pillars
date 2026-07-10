// 신강/신약 — 억부(抑扶) 가중 점수
//
// 일간을 제외한 각 자리에 가중치를 주고, 십성을 5세력으로 묶어
// 우호(비겁+인성, 일간을 돕는 힘) vs 비우호(식상+재성+관성, 일간을 빼는 힘)를 비교한다.
// 가중치·임계값은 튜닝 가능한 상수로 노출한다.

import type { Chart, Pillar } from "./chart";
import { STEMS, type Stem } from "./data/stems";
import { BRANCHES, type Branch } from "./data/branches";
import {
  tenGod,
  tenGodGroup,
  type ElementYinYang,
  type TenGodGroup,
} from "./data/relations";

/** 자리별 가중치 (월령=월지 최대) */
export const POSITION_WEIGHTS = {
  yearStem: 1,
  monthStem: 1,
  hourStem: 1,
  yearBranch: 1.5,
  monthBranch: 3,
  dayBranch: 2,
  hourBranch: 1.5,
} as const;

/** 신강/신약 판정 임계값 (우호 비율) */
export const STRENGTH_THRESHOLDS = { strong: 0.55, weak: 0.45 } as const;

export type StrengthLevel = "신강" | "중화" | "신약";

export interface StrengthScore {
  /** 5세력 가중 점수 */
  groupScores: Record<TenGodGroup, number>;
  /** 우호 세력 합 (비겁 + 인성) */
  supportive: number;
  /** 비우호 세력 합 (식상 + 재성 + 관성) */
  draining: number;
  /** 우호 비율 supportive / (supportive + draining) */
  ratio: number;
  level: StrengthLevel;
}

export function levelFromRatio(ratio: number): StrengthLevel {
  if (ratio >= STRENGTH_THRESHOLDS.strong) return "신강";
  if (ratio <= STRENGTH_THRESHOLDS.weak) return "신약";
  return "중화";
}

function stemEY(s: Stem): ElementYinYang {
  return { element: STEMS[s].element, yinYang: STEMS[s].yinYang };
}

function branchEY(b: Branch): ElementYinYang {
  return stemEY(BRANCHES[b].mainStem);
}

export function scoreStrength(chart: Chart): StrengthScore {
  const day = stemEY(chart.dayMaster);
  const groupScores: Record<TenGodGroup, number> = {
    비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0,
  };

  const add = (target: ElementYinYang, weight: number) => {
    groupScores[tenGodGroup(tenGod(day, target))] += weight;
  };

  const addPillar = (
    p: Pillar | null,
    stemWeight: number,
    branchWeight: number,
    isDayPillar: boolean,
  ) => {
    if (!p) return;
    if (!isDayPillar) add(stemEY(p.stem), stemWeight); // 일간 자신은 제외
    add(branchEY(p.branch), branchWeight);
  };

  const w = POSITION_WEIGHTS;
  addPillar(chart.year, w.yearStem, w.yearBranch, false);
  addPillar(chart.month, w.monthStem, w.monthBranch, false);
  addPillar(chart.day, 0, w.dayBranch, true);
  addPillar(chart.hour, w.hourStem, w.hourBranch, false);

  const supportive = groupScores.비겁 + groupScores.인성;
  const draining = groupScores.식상 + groupScores.재성 + groupScores.관성;
  const denom = supportive + draining;
  const ratio = denom === 0 ? 0 : supportive / denom;

  return { groupScores, supportive, draining, ratio, level: levelFromRatio(ratio) };
}
