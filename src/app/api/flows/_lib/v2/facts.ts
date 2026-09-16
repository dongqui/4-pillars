// 계산값 → 모델이 읽는 evidence. 값은 v1 facts 의 라벨 함수를 재사용한다(복사하지 않는다).
import { STEMS, branchElementOf, sewunPillars, type SajuAnalysis } from "@/lib/saju-core";
import type { FlowMonth } from "../pivots";
import { groupOf } from "../month-scores";
import { parsePillar2 } from "../score";
import { buildFlowContext, distributionLabel } from "../prompt/facts";

/** 절기·PIVOT_THRESHOLD·라벨 경계가 바뀌면 올린다. request_hash 재료다. */
export const FLOW_CALC_VERSION = 1;

export type EvidenceKind = "natal" | "annual" | "cycle" | "aggregate" | "month" | "change";
export interface EvidenceFact { id: string; kind: EvidenceKind; value: unknown; monthIndex: number | null }
export interface Evidence {
  facts: EvidenceFact[];
  availableFactIds: string[];
  months: { monthIndex: number; pivot: boolean; factIds: string[] }[];
  pivotMonths: number[];
}

const nn = (i: number) => String(i).padStart(2, "0");

export function buildFlowEvidence(analysis: SajuAnalysis, flowYear: number, months: FlowMonth[]): Evidence {
  // v1 이 이미 라벨(받쳐줌·흔들림·초반…)로 접어 둔 값을 그대로 쓴다.
  const ctx = buildFlowContext(analysis, flowYear, months);
  const dm = STEMS[analysis.chart.dayMaster];
  const el = analysis.elements;
  const total = Object.values(el.counts).reduce((s, n) => s + n, 0) || 1;
  const annual = parsePillar2(sewunPillars(flowYear, 1)[0].korean)!;

  const facts: EvidenceFact[] = [];
  const push = (kind: EvidenceKind, id: string, value: unknown, monthIndex: number | null = null) =>
    facts.push({ id, kind, value, monthIndex });

  push("natal", "natal.dayMaster", `${analysis.chart.dayMaster} (${dm.element}·${dm.yinYang})`);
  push("natal", "natal.strength", analysis.strength.level);
  push("natal", "natal.elements", Object.fromEntries(
    Object.entries(el.counts).map(([k, v]) => [k, distributionLabel(Number(v), total)]),
  ));
  push("natal", "natal.yongsin", { yongsin: analysis.yongsin.yongsin, huisin: analysis.yongsin.huisin });

  push("annual", "annual.pillar", ctx.year.sewunKorean);
  push("annual", "annual.stemGroup", groupOf(dm.element, STEMS[annual.stem].element));
  push("annual", "annual.branchGroup", groupOf(dm.element, branchElementOf(annual.branch)));
  push("annual", "annual.support", ctx.year.support);
  push("annual", "annual.friction", ctx.year.friction);

  push("cycle", "cycle.daeun", ctx.year.daeunKorean);
  push("cycle", "cycle.daeunPhase", ctx.year.daeunPhase);
  if (ctx.year.daeunSwitch) push("cycle", "cycle.daeunSwitch", ctx.year.daeunSwitch);

  push("aggregate", "aggregate.monthlyObservedGroups", ctx.year.tenGods);
  push("change", "change.pivotMonths", ctx.pivotMonths);

  const monthsOut = ctx.months.map((m) => {
    const p = nn(m.index);
    const before = facts.length;
    push("month", `month.${p}.support`, m.support, m.index);
    push("month", `month.${p}.friction`, m.friction, m.index);
    push("month", `month.${p}.groups`, m.tenGods, m.index);
    if (m.tenGodsChanged) push("month", `month.${p}.groupsChanged`, m.tenGodsChanged, m.index);
    if (m.interactions.length > 0) push("month", `month.${p}.interactions`, m.interactions, m.index);
    if (m.samhap) push("month", `month.${p}.samhap`, true, m.index);
    if (m.vsPrev) push("month", `month.${p}.vsPrev`, m.vsPrev, m.index);
    return { monthIndex: m.index, pivot: m.pivot, factIds: facts.slice(before).map((f) => f.id) };
  });

  return { facts, availableFactIds: facts.map((f) => f.id), months: monthsOut, pivotMonths: ctx.pivotMonths };
}
