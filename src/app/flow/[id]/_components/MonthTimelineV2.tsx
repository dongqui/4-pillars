import type { FlowMonth } from "@/app/api/flows/_lib/pivots";
import type { PublicFlowReportV2 } from "@/app/api/flows/_lib/v2/presentation";
import { CONCERN_OPTIONS } from "@/lib/flows/context";
import { monthLabel, monthRange } from "../_lib/current-month";
import { monthAnchor } from "../_lib/v2-sections";

const FOCUS_LABEL = new Map(CONCERN_OPTIONS.map((o) => [o.value, o.label]));

/**
 * v2 12개월 타임라인. MonthTimeline.tsx 를 그대로 베꼈다 — 다른 점은 입력이
 * MonthsContent 대신 PublicFlowReportV2.sections.months.items 이고, 각 달에
 * 앵커(id)와 focusDomain 뱃지가 붙는다는 것뿐이다.
 */
export function MonthTimelineV2({
  items,
  months,
  currentIndex,
}: {
  items: PublicFlowReportV2["sections"]["months"]["items"];
  months: FlowMonth[];
  /** 지금이 속한 달. 지난 해·다가올 해면 null */
  currentIndex: number | null;
}) {
  const metaOf = new Map(months.map((m) => [m.index, m]));

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {items.map((item) => {
        const meta = metaOf.get(item.monthIndex);
        if (!meta) return null;
        const isNow = item.monthIndex === currentIndex;

        return (
          <article
            key={item.monthIndex}
            id={monthAnchor(item.monthIndex)}
            className={`rounded-2xl border p-4 ${
              meta.pivot ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[15px] font-bold tracking-[-0.02em]">{monthLabel(meta)}</span>
              <span className="text-[13.5px] font-semibold text-slate-700">{item.headline}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-500">
                {FOCUS_LABEL.get(item.focusDomain) ?? item.focusDomain}
              </span>
              {meta.pivot && (
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10.5px] font-bold text-white">
                  흐름이 바뀌는 달
                </span>
              )}
              {isNow && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-bold text-white">
                  현재
                </span>
              )}
              <span className="ml-auto text-[11.5px] text-slate-400">{monthRange(meta)}</span>
            </div>
            <p className="mt-2 text-[13.5px] leading-[1.65] text-slate-600">{item.body}</p>
            <p className="mt-1.5 text-[12.5px] leading-[1.6] text-slate-500">{item.action}</p>
          </article>
        );
      })}
    </div>
  );
}
