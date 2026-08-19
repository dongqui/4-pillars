const BADGES = [
  { title: "전통 명리학 기반", desc: "오래 이어진 명리의 구조를 바탕으로 봅니다." },
  { title: "정확한 만세력 계산", desc: "출생 정보를 기준에 맞게 정확히 계산합니다." },
  {
    title: "근거를 따라가는 해석",
    desc: "결론만 던지지 않고, 왜 그렇게 읽는지 함께 보여줍니다.",
  },
];

export function TrustSection() {
  return (
    <section
      id="trust"
      className="mx-auto max-w-[1120px] px-5 py-[clamp(56px,8vw,88px)] text-center md:px-8"
    >
      <h2 className="mb-4 text-[clamp(26px,3.6vw,42px)] font-bold tracking-[-0.03em]">
        해석의 기준
      </h2>
      <p className="mb-[52px] text-[clamp(16px,2vw,18px)] text-slate-400 [text-wrap:pretty]">
        계산은 정확하게, 해석은 쉽게.
      </p>
      <div className="flex flex-wrap items-stretch justify-center gap-5">
        {BADGES.map((badge) => (
          <div
            key={badge.title}
            className="min-w-[240px] max-w-[300px] flex-1 rounded-[20px] border border-slate-100 bg-white px-7 py-[30px] shadow-[0_1px_3px_rgba(15,23,42,.04)]"
          >
            <div
              aria-hidden
              className="mx-auto mb-[18px] flex h-[42px] w-[42px] items-center justify-center rounded-full bg-accent-50 text-[17px] text-accent"
            >
              ✓
            </div>
            <div className="text-[17px] font-bold tracking-[-0.01em]">{badge.title}</div>
            <p className="mt-2 text-sm leading-[1.55] text-slate-400 [text-wrap:pretty]">
              {badge.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
