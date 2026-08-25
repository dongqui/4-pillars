import { SectionHeading } from "./SectionHeading";
import { CardGrid } from "./CardGrid";
import type { TitledText } from "../_lib/report-content";

/**
 * 리포트를 닫는 실천 카드. 03 강점의 번호 배지와 08 환경의 accent 카드에서
 * 이미 쓰는 어휘를 합쳤다 — 새 스타일이 아니라 한 단계 강조다.
 */
export function PlaybookSection({ items }: { items: TitledText[] }) {
  return (
    <section className="mt-[72px]">
      <SectionHeading section="playbook" />
      <CardGrid>
        {items.map((item, i) => (
          <div
            key={item.title}
            className="border border-accent-200 bg-accent-50 rounded-2xl px-[22px] py-5"
          >
            <div className="flex gap-2.5 items-start mb-2">
              <span className="flex-none w-6 h-6 mt-px rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-[15px] font-bold text-slate-900 leading-[1.4]">{item.title}</span>
            </div>
            <p className="text-sm text-slate-700 leading-[1.65] m-0 break-keep [text-wrap:pretty]">
              {item.body}
            </p>
          </div>
        ))}
      </CardGrid>
    </section>
  );
}
