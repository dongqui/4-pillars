import { SectionHeading } from "./SectionHeading";
import { ChartEvidence } from "./ChartEvidence";
import type { TitledText, ChartEvidence as ChartEvidenceData } from "../_lib/report-content";

export function PersonalitySection({
  items,
  evidence,
}: {
  items: TitledText[];
  evidence: ChartEvidenceData;
}) {
  return (
    <section className="mt-[72px]">
      <SectionHeading no="01" category="핵심 성향" title="이렇게 보이는 데는 이유가 있어요" />
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div key={item.title} className="border border-slate-200 rounded-[14px] px-5 py-[18px]">
            <div className="text-[15px] font-bold mb-1">{item.title}</div>
            <p className="text-sm text-slate-600 leading-[1.65] m-0 break-keep [text-wrap:pretty]">{item.body}</p>
          </div>
        ))}
      </div>
      <ChartEvidence evidence={evidence} />
    </section>
  );
}
