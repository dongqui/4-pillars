import type { ContextReference } from "@/lib/flows/context";
import type { FlowReportV2, FocusDomain } from "./schema";

export interface PublicDomain { headline: string; opportunity: string; caution: string; action: string; monthLinks: { monthIndex: number; note: string }[] }
export interface PublicFlowReportV2 {
  careerTitle: string;
  reference: ContextReference;
  sections: {
    overview: { headline: string; body: string };
    career: PublicDomain; money: PublicDomain; romance: PublicDomain; relationships: PublicDomain;
    months: { lead: string; items: { monthIndex: number; headline: string; focusDomain: FocusDomain; body: string; action: string }[] };
    closing: { items: { title: string; body: string }[] };
  };
}

/** 공개 필드만 명시적으로 고른다. spread 뒤 delete 는 쓰지 않는다 — 새 내부 필드가 생기면 그대로 샌다. */
export function toPublicFlowReportV2(
  r: FlowReportV2, meta: { careerTitle: string; reference: ContextReference },
): PublicFlowReportV2 {
  const dom = (d: FlowReportV2["sections"]["career"]): PublicDomain => ({
    headline: d.headline, opportunity: d.opportunity, caution: d.caution, action: d.action,
    monthLinks: d.monthLinks.map((m) => ({ monthIndex: m.monthIndex, note: m.note })),
  });
  const s = r.sections;
  return {
    careerTitle: meta.careerTitle, reference: meta.reference,
    sections: {
      overview: { headline: s.overview.headline, body: s.overview.body },
      career: dom(s.career), money: dom(s.money), romance: dom(s.romance), relationships: dom(s.relationships),
      months: { lead: s.months.lead, items: s.months.items.map((m) => ({ monthIndex: m.monthIndex, headline: m.headline, focusDomain: m.focusDomain, body: m.body, action: m.action })) },
      closing: { items: s.closing.items.map((c) => ({ title: c.title, body: c.body })) },
    },
  };
}
