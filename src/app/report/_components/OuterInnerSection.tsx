import { SectionHeading } from "./SectionHeading";
import { CardGrid } from "./CardGrid";

export function OuterInnerSection({ data }: { data: { outward: string; inner: string } }) {
  return (
    <section className="mt-[72px]">
      <SectionHeading no="02" category="겉과 속" title="남이 보는 나 vs 실제 내면" />
      <CardGrid>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-[22px]">
          <div className="text-xs font-bold text-slate-400 tracking-[0.05em] mb-2.5">남에게 보이는 모습</div>
          <p className="text-[15px] text-slate-700 leading-[1.7] m-0 break-keep [text-wrap:pretty]">{data.outward}</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-[22px]">
          <div className="text-xs font-bold text-slate-400 tracking-[0.05em] mb-2.5">실제 내면</div>
          <p className="text-[15px] text-slate-700 leading-[1.7] m-0 break-keep [text-wrap:pretty]">{data.inner}</p>
        </div>
      </CardGrid>
    </section>
  );
}
