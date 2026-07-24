import { SectionHeading } from "./SectionHeading";
import type { TimelineRow } from "../_lib/report-content";

export function YearlyLuckSection({ rows }: { rows: TimelineRow[] }) {
  return (
    <section className="mt-[72px]">
      <SectionHeading no="11" category="올해의 운" title="지금부터 1년, 나의 운의 흐름" />
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={row.period}
            className={`flex flex-wrap gap-x-4 gap-y-1 px-5 py-[17px] items-baseline ${
              i < rows.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <span className="flex-none w-32 text-[13px] font-semibold text-slate-400">{row.period}</span>
            <span className="flex-1 min-w-[200px] text-sm text-slate-700 leading-[1.6]">
              <strong className="text-slate-900">{row.title}</strong> — {row.desc}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
