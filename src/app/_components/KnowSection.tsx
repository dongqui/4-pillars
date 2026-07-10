const cards = [
  { title: "성향 분석", desc: "타고난 기질과 사고방식을 차분히 정리합니다." },
  { title: "관계 분석", desc: "사람을 대하고 신뢰를 쌓아가는 방식." },
  { title: "직업 적성", desc: "잘 맞는 일과 타고난 강점의 방향." },
  { title: "인생 흐름", desc: "시기마다 달라지는 삶의 리듬과 결." },
];

export function KnowSection() {
  return (
    <section id="know" className="max-w-[1120px] mx-auto px-8 py-24">
      <div className="text-center mb-14">
        <h2 className="text-[clamp(30px,4vw,46px)] font-bold tracking-tight mb-3.5">
          이런 내용을 알려드립니다
        </h2>
        <p className="text-lg text-slate-400">나를 이루는 네 가지 결을 차분하게 정리합니다.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c) => (
          <div
            key={c.title}
            className="bg-white border border-slate-100 rounded-[20px] px-7 py-8 shadow-[0_1px_3px_rgba(17,24,39,.04)] transition-transform hover:-translate-y-1 hover:shadow-[0_20px_44px_-20px_rgba(17,24,39,.16)]"
          >
            <div className="w-[46px] h-[46px] rounded-[14px] bg-accent-50 flex items-center justify-center mb-[22px]">
              <span className="w-4 h-4 rounded-[5px] bg-accent" />
            </div>
            <div className="text-[19px] font-bold tracking-tight mb-2.5">{c.title}</div>
            <p className="text-[14.5px] leading-relaxed text-slate-500">{c.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
