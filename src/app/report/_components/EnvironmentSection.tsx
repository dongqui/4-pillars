import { SectionHeading } from "./SectionHeading";
import { NoteCard } from "./NoteCard";
import type { AxisRow } from "../_lib/report-content";

const EMPHASIS = "스스로 판단하고 개선할 여지가 있는 환경";

export function EnvironmentSection({ axes, summary }: { axes: AxisRow[]; summary: string }) {
  const [before, after] = summary.split(EMPHASIS);
  return (
    <section className="mt-[72px]">
      <SectionHeading no="07" category="잘 맞는 환경" title="능력이 잘 드러나는 조건" />
      <div className="border border-slate-200 rounded-2xl px-[22px] pt-[22px] pb-2 flex flex-col">
        {axes.map((axis) => (
          <div key={`${axis.left}-${axis.right}`} className="pb-[22px]">
            <div className="flex justify-between gap-3 mb-2">
              <span
                className={`text-[13.5px] ${
                  axis.lean === "left" ? "font-bold text-slate-900" : "font-medium text-slate-400"
                }`}
              >
                {axis.left}
              </span>
              <span
                className={`text-[13.5px] text-right ${
                  axis.lean === "right" ? "font-bold text-slate-900" : "font-medium text-slate-400"
                }`}
              >
                {axis.right}
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full relative">
              <div
                className="absolute top-1/2 w-4 h-4 rounded-full bg-accent -translate-x-1/2 -translate-y-1/2 shadow-[0_0_0_3px_#fff,0_0_0_4px_var(--color-accent-200)]"
                style={{ left: `${axis.pos}%` }}
              />
            </div>
          </div>
        ))}
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
