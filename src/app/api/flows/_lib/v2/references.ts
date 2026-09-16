import type { Evidence } from "./facts";
import type { FlowReportV2 } from "./schema";

/** 모든 basisRefs 가 실제 근거 ID 인가. 없는 ID 를 "<경로>: <id>" 로 돌려준다. 빈 배열이면 통과. */
export function validateReferences(report: FlowReportV2, evidence: Evidence): string[] {
  const ok = new Set(evidence.availableFactIds);
  const out: string[] = [];
  const check = (path: string, refs: string[]) => { for (const r of refs) if (!ok.has(r)) out.push(`${path}: ${r}`); };
  const i = report.interpretation, s = report.sections;
  check("/interpretation/annual", i.annual.basisRefs);
  for (const k of ["career", "money", "romance", "relationships"] as const) {
    check(`/interpretation/domains/${k}`, i.domains[k].basisRefs);
    check(`/sections/${k}`, s[k].basisRefs);
  }
  check("/sections/overview", s.overview.basisRefs);
  s.months.items.forEach((m, idx) => check(`/sections/months/items/${idx}`, m.basisRefs));
  return out;
}
