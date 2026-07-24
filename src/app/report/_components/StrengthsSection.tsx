import { SectionHeading } from "./SectionHeading";
import type { TitledText } from "../_lib/report-content";

export function StrengthsSection({ items }: { items: TitledText[] }) {
  return (
    <section className="mt-[72px]">
      <SectionHeading no="03" category="타고난 강점" title="이런 순간에 빛나요" />
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        {items.map((item, i) => (
          <div
            key={item.title}
            className={`flex gap-4 px-[22px] py-5 ${i < items.length - 1 ? "border-b border-slate-100" : ""}`}
          >
            <div className="flex-none w-8 h-8 rounded-[10px] bg-accent-50 text-accent font-bold text-sm flex items-center justify-center">
              {i + 1}
            </div>
            <div>
              <div className="text-[15px] font-bold">{item.title}</div>
              <p className="text-sm text-slate-500 leading-[1.6] mt-1 mb-0 break-keep [text-wrap:pretty]">
                {item.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
