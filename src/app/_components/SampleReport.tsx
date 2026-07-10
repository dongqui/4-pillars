export function SampleReport() {
  return (
    <section id="sample" className="bg-slate-50 border-y border-slate-100">
      <div className="max-w-[920px] mx-auto px-8 py-[104px] text-center">
        <div className="text-[13px] font-bold tracking-[0.1em] uppercase text-accent mb-[22px]">
          예시 리포트
        </div>
        <p className="text-[clamp(27px,3.6vw,42px)] font-bold leading-snug tracking-tight text-slate-900 mb-3.5">
          “당신은 깊이 있는 사고와
          <br />
          신중한 판단을 하는 사람입니다.”
        </p>
        <p className="text-base text-slate-400 mb-12">리포트의 한 장면을 미리 보여드릴게요.</p>
        <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_24px_60px_-28px_rgba(17,24,39,.18)] overflow-hidden text-left grid grid-cols-1 md:grid-cols-2">
          <div className="px-[38px] py-9 border-b md:border-b-0 md:border-r border-slate-100">
            <div className="text-[13px] font-bold text-slate-400 tracking-wide uppercase mb-[22px]">
              강점
            </div>
            <div className="flex flex-col gap-4">
              {["분석력", "책임감", "적응력"].map((s) => (
                <div key={s} className="flex items-center gap-3.5">
                  <span className="w-[9px] h-[9px] rounded-full bg-accent flex-none" />
                  <span className="text-lg font-semibold text-slate-900">{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="px-[38px] py-9">
            <div className="text-[13px] font-bold text-slate-400 tracking-wide uppercase mb-[22px]">
              성장 포인트
            </div>
            <div className="flex flex-col gap-4">
              {["과도한 고민", "결정 지연"].map((s) => (
                <div key={s} className="flex items-center gap-3.5">
                  <span className="w-[9px] h-[9px] rounded-full bg-slate-300 flex-none" />
                  <span className="text-lg font-semibold text-slate-500">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
