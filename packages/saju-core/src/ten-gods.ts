// 십성(十星) 분포 — 일간 기준으로 각 글자를 십성으로 분류
// 지지는 본기(正氣) 천간의 오행·음양으로 판정한다.

import type { Chart, Pillar } from "./chart.js";
import { STEMS, type Stem } from "./data/stems.js";
import { BRANCHES, type Branch } from "./data/branches.js";
import {
  tenGod,
  tenGodGroup,
  type ElementYinYang,
  type TenGod,
  type TenGodGroup,
} from "./data/relations.js";

export type PillarPosition = "year" | "month" | "day" | "hour";

export interface TenGodCell {
  position: PillarPosition;
  kind: "stem" | "branch";
  /** 글자 (천간/지지 한글) */
  char: string;
  /** 십성. 일간(아신)이면 null */
  tenGod: TenGod | null;
  /** 일간 자신인지 */
  isDayMaster: boolean;
}

export interface TenGodResult {
  cells: TenGodCell[];
  /** 십성별 개수 (일간 제외) */
  distribution: Record<TenGod, number>;
  /** 5세력(비겁·식상·재성·관성·인성)별 개수 */
  groupDistribution: Record<TenGodGroup, number>;
}

function stemEY(s: Stem): ElementYinYang {
  return { element: STEMS[s].element, yinYang: STEMS[s].yinYang };
}

/** 지지 → 본기 천간의 오행·음양 */
function branchEY(b: Branch): ElementYinYang {
  return stemEY(BRANCHES[b].mainStem);
}

function emptyTenGods(): Record<TenGod, number> {
  return {
    비견: 0, 겁재: 0, 식신: 0, 상관: 0, 편재: 0,
    정재: 0, 편관: 0, 정관: 0, 편인: 0, 정인: 0,
  };
}

function emptyGroups(): Record<TenGodGroup, number> {
  return { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
}

export function analyzeTenGods(chart: Chart): TenGodResult {
  const day = stemEY(chart.dayMaster);
  const positions: [PillarPosition, Pillar | null][] = [
    ["year", chart.year],
    ["month", chart.month],
    ["day", chart.day],
    ["hour", chart.hour],
  ];

  const cells: TenGodCell[] = [];
  for (const [position, p] of positions) {
    if (!p) continue;
    const isDayMaster = position === "day"; // 일간 = 일주 천간
    cells.push({
      position,
      kind: "stem",
      char: p.stem,
      isDayMaster,
      tenGod: isDayMaster ? null : tenGod(day, stemEY(p.stem)),
    });
    cells.push({
      position,
      kind: "branch",
      char: p.branch,
      isDayMaster: false,
      tenGod: tenGod(day, branchEY(p.branch)),
    });
  }

  const distribution = emptyTenGods();
  const groupDistribution = emptyGroups();
  for (const c of cells) {
    if (!c.tenGod) continue;
    distribution[c.tenGod] += 1;
    groupDistribution[tenGodGroup(c.tenGod)] += 1;
  }

  return { cells, distribution, groupDistribution };
}
