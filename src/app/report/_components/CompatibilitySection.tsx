import { SectionHeading } from "./SectionHeading";
import { CardGrid } from "./CardGrid";
import { CtaCard } from "./CtaCard";
import { ctaHref } from "../_lib/cta";

export function CompatibilitySection({
  good,
  clash,
  isLoggedIn,
}: {
  good: string[];
  clash: string[];
  isLoggedIn: boolean;
}) {
  return (
    <section className="mt-[72px]">
      <SectionHeading section="compatibility" />
      <CardGrid>
        <div className="border border-accent-200 bg-accent-50 rounded-2xl px-[22px] py-5">
          <div className="text-[13px] font-bold text-accent mb-2.5">잘 맞는 유형</div>
          <ul className="m-0 pl-[18px] text-sm text-slate-700 leading-[1.7] flex flex-col gap-1.5">
            {good.map((item, i) => (
              <li key={`${item}-${i}`}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="border border-slate-200 rounded-2xl px-[22px] py-5">
          <div className="text-[13px] font-bold text-slate-400 mb-2.5">부딪히기 쉬운 유형</div>
          <ul className="m-0 pl-[18px] text-sm text-slate-700 leading-[1.7] flex flex-col gap-1.5">
            {clash.map((item, i) => (
              <li key={`${item}-${i}`}>{item}</li>
            ))}
          </ul>
        </div>
      </CardGrid>
      {/* 위 두 카드가 이미 "어떤 유형인가" 의 답이라, 같은 질문을 다시 묻지 않는다. */}
      <CtaCard
        title="실제 상대와의 궁합이 궁금하다면"
        desc="상대방의 생년월일을 입력하면 두 사람 사이의 흐름을 볼 수 있어요."
        label="궁합 보기 →"
        href={ctaHref("/match", isLoggedIn)}
      />
    </section>
  );
}
