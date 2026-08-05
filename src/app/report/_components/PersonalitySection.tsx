import { SectionHeading } from "./SectionHeading";
import { ChartEvidence } from "./ChartEvidence";
import type { TraitNote, ChartEvidence as ChartEvidenceData } from "../_lib/report-content";

export function PersonalitySection({
  items,
  evidence,
}: {
  items: TraitNote[];
  evidence: ChartEvidenceData;
}) {
  return (
    <section className="mt-[72px]">
      <SectionHeading no="01" category="핵심 성향" title="이렇게 보이는 데는 이유가 있어요" />
      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <div key={i} className="border border-slate-200 rounded-[14px] px-5 py-[18px]">
            <div className="text-[15px] font-bold mb-1">{item.title}</div>
            <p className="text-sm text-slate-600 leading-[1.65] m-0 break-keep [text-wrap:pretty]">{item.body}</p>
            {/* 쉬운 말(body) 다음에 근거 한 줄. 아래 ChartEvidence 패널로 이어지는 다리라
                본문보다 한 단계 옅게 두되, basis 는 사주 근거를 담은 본문이라 AA 대비를
                지키는 slate-500 까지만 낮춘다. */}
            <p className="text-[13px] text-slate-500 leading-[1.6] mt-2 mb-0 break-keep [text-wrap:pretty]">{item.basis}</p>
          </div>
        ))}
      </div>
      <ChartEvidence evidence={evidence} />
    </section>
  );
}
