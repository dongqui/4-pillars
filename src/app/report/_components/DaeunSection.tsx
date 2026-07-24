import { SectionHeading } from "./SectionHeading";
import { NoteCard } from "./NoteCard";
import type { DaeunRow } from "../_lib/report-content";

const EMPHASIS = "기반을 쌓는 구간의 후반부";

export function DaeunSection({ rows, summary }: { rows: DaeunRow[]; summary: string }) {
  const [before, after] = summary.split(EMPHASIS);
  return (
    <section className="mt-[72px]">
      <SectionHeading no="12" category="대운" title="앞으로 10년의 큰 운 흐름" />
      <div className="border border-slate-200 rounded-2xl p-[22px] flex flex-col">
        {rows.map((row, i) => {
          const isNow = i === 0;
          const isLast = i === rows.length - 1;
          return (
            <div key={row.range} className="flex gap-4">
              <div className="flex-none flex flex-col items-center">
                <div
                  className={`w-2.5 h-2.5 rounded-full mt-[5px] ${
                    isNow ? "bg-accent shadow-[0_0_0_4px_var(--color-accent-100)]" : "bg-slate-300"
                  }`}
                />
                <div className={`flex-1 w-0.5 my-1 ${isLast ? "bg-transparent" : "bg-slate-200"}`} />
              </div>
              <div className={isLast ? "pb-0" : "pb-6"}>
                <div className="text-[13px] font-bold text-slate-400">{row.range}</div>
                <div className="text-[15px] font-bold text-slate-900 mt-0.5 mb-1">{row.title}</div>
                <p className="text-sm text-slate-700 leading-[1.65] m-0 break-keep [text-wrap:pretty]">{row.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
      <NoteCard>
        {after !== undefined ? (
          <>
            {before}
            <strong className="text-slate-900">{EMPHASIS}</strong>
            {after}
          </>
        ) : (
          summary
        )}
      </NoteCard>
    </section>
  );
}
