import Link from "next/link";
import { ReportPreviewCard } from "./ReportPreviewCard";

export function Hero() {
  return (
    <section className="max-w-[1120px] mx-auto px-8 pt-[clamp(64px,9vw,120px)] pb-[72px] text-center">
      <div className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-accent bg-accent-50 px-3.5 py-[7px] rounded-full mb-[30px]">
        나를 이해하는 새로운 방법
      </div>
      <h1 className="text-[clamp(44px,7vw,78px)] leading-[1.04] font-bold tracking-[-0.045em] mb-[26px]">
        당신은
        <br />
        어떤 사람인가요?
      </h1>
      <p className="text-[clamp(19px,2.4vw,23px)] leading-normal text-slate-700 font-medium max-w-[560px] mx-auto mb-3.5">
        사주를 통해 나를 더 깊이 이해해보세요.
      </p>
      <p className="text-[16.5px] leading-relaxed text-slate-400 max-w-[440px] mx-auto mb-[38px]">
        성향, 관계, 직업, 인생의 흐름까지 당신만의 리포트로 정리해드립니다.
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <Link
          href="/funnel?step=name"
          className="text-base font-semibold text-white bg-accent px-7 py-4 rounded-[14px] shadow-[0_12px_28px_-8px_rgba(79,70,229,.4)] hover:opacity-90"
        >
          내 리포트 만들기
        </Link>
      </div>
      <div className="flex items-start justify-center max-w-[880px] mx-auto mt-16">
        <ReportPreviewCard />
      </div>
    </section>
  );
}
