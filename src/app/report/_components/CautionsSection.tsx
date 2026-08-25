import { SectionHeading } from "./SectionHeading";
import { NoteCard } from "./NoteCard";

export function CautionsSection({ cautions, tip }: { cautions: string[]; tip: string }) {
  return (
    <section className="mt-[72px]">
      <SectionHeading section="cautions" />
      <div className="flex flex-col gap-3">
        {cautions.map((caution, i) => (
          <div key={i} className="border border-slate-200 rounded-[14px] px-5 py-[18px]">
            <p className="text-[15px] text-slate-700 leading-[1.7] m-0 break-keep [text-wrap:pretty]">{caution}</p>
          </div>
        ))}
      </div>
      <NoteCard tip>{tip}</NoteCard>
    </section>
  );
}
