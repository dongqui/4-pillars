import { SectionHeading } from "./SectionHeading";
import { CardGrid } from "./CardGrid";

export function CompatibilitySection({ good, clash }: { good: string[]; clash: string[] }) {
  return (
    <section className="mt-[72px]">
      <SectionHeading no="09" category="궁합" title="당신과 잘 맞는 사람의 특징" />
      <CardGrid>
        <div className="border border-accent-200 bg-accent-50 rounded-2xl px-[22px] py-5">
          <div className="text-[13px] font-bold text-accent mb-2.5">잘 맞는 유형</div>
          <ul className="m-0 pl-[18px] text-sm text-slate-700 leading-[1.7] flex flex-col gap-1.5">
            {good.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="border border-slate-200 rounded-2xl px-[22px] py-5">
          <div className="text-[13px] font-bold text-slate-400 mb-2.5">부딪히기 쉬운 유형</div>
          <ul className="m-0 pl-[18px] text-sm text-slate-700 leading-[1.7] flex flex-col gap-1.5">
            {clash.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </CardGrid>
    </section>
  );
}
