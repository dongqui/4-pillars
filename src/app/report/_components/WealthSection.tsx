import { SectionHeading } from "./SectionHeading";
import { CardGrid } from "./CardGrid";
import { NoteCard } from "./NoteCard";
import type { LabeledText } from "../_lib/report-content";

const EMPHASIS = "긴 호흡의 적립식";

export function WealthSection({ points, summary }: { points: LabeledText[]; summary: string }) {
  const [before, after] = summary.split(EMPHASIS);
  return (
    <section className="mt-[72px]">
      <SectionHeading no="10" category="재물" title="돈이 모이는 방식과 새어나가는 지점" />
      <CardGrid>
        {points.map((point) => (
          <div key={point.label} className="border border-slate-200 rounded-2xl px-[22px] py-5">
            <div className="text-[13px] font-bold text-slate-400 mb-1.5">{point.label}</div>
            <p className="text-sm text-slate-700 leading-[1.65] m-0 break-keep [text-wrap:pretty]">{point.body}</p>
          </div>
        ))}
      </CardGrid>
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
