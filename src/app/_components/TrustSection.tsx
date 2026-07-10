const badges = [
  { title: "전통 명리학 기반", desc: "수백 년 이어온 해석의 틀 위에서." },
  { title: "정확한 만세력 계산", desc: "출생 정보를 정밀하게 환산합니다." },
  { title: "AI 심층 해석", desc: "복잡한 내용을 읽기 쉬운 언어로." },
];

export function TrustSection() {
  return (
    <section id="trust" className="max-w-[1120px] mx-auto px-8 py-[104px] text-center">
      <h2 className="text-[clamp(28px,3.6vw,42px)] font-bold tracking-tight mb-4">
        믿을 수 있는 분석
      </h2>
      <p className="text-lg text-slate-400 mb-[52px]">전통과 기술이 함께 만드는, 신중한 리포트.</p>
      <div className="flex items-stretch justify-center gap-5 flex-wrap">
        {badges.map((b) => (
          <div
            key={b.title}
            className="flex-1 min-w-[240px] max-w-[300px] bg-white border border-slate-100 rounded-[20px] px-7 py-[30px] shadow-[0_1px_3px_rgba(17,24,39,.04)]"
          >
            <div className="w-[42px] h-[42px] rounded-full bg-accent-50 text-accent flex items-center justify-center mx-auto mb-[18px] text-[17px]">
              ✓
            </div>
            <div className="text-[17px] font-bold tracking-tight">{b.title}</div>
            <p className="text-sm leading-relaxed text-slate-400 mt-2">{b.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
