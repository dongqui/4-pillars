import { SectionHeading } from "./SectionHeading";
import { CardGrid } from "./CardGrid";
import { NoteCard } from "./NoteCard";
import { EmphasizedText } from "./EmphasizedText";
import type { LabeledText } from "../_lib/report-content";

export function WealthSection({
  points,
  summary,
  emphasis,
}: {
  points: LabeledText[];
  summary: string;
  emphasis: string;
}) {
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
        <EmphasizedText text={summary} emphasis={emphasis} />
      </NoteCard>
    </section>
  );
}
