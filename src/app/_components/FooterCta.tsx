import Link from "next/link";

export function FooterCta() {
  return (
    <section className="bg-slate-900 text-white">
      <div className="max-w-[1120px] mx-auto px-8 py-[108px] text-center">
        <h2 className="text-[clamp(32px,4.4vw,50px)] font-bold tracking-tight leading-tight mb-[18px]">
          지금, 나를 이해하는
          <br />
          여정을 시작하세요
        </h2>
        <p className="text-lg text-slate-400 mb-[38px]">
          몇 가지 정보만 입력하면, 당신만의 리포트가 완성됩니다.
        </p>
        <Link
          href="/funnel?step=name"
          className="inline-block text-[17px] font-semibold text-white bg-accent px-[34px] py-[17px] rounded-[15px] shadow-[0_16px_40px_-12px_rgba(79,70,229,.5)] hover:opacity-90"
        >
          내 리포트 만들기
        </Link>
      </div>
      <div className="border-t border-slate-800">
        <div className="max-w-[1120px] mx-auto px-8 py-7 flex items-center justify-between flex-wrap gap-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-[26px] h-[26px] rounded-lg bg-white flex items-center justify-center text-slate-900 font-semibold text-[13px]">
              사
            </div>
            <span className="font-semibold text-[14.5px]">사주</span>
          </div>
          <div className="text-[13px] text-slate-500">나를 더 깊이 이해하는 가장 차분한 방법.</div>
        </div>
      </div>
    </section>
  );
}
