/**
 * v2 결과 화면의 대표 문장. FlowHero.tsx 와 같은 마크업이지만 키워드가 없다 —
 * v2 스키마(overview)에는 keywords 필드가 없다.
 */
export function FlowHeroV2({ headline, flowYear }: { headline: string; flowYear: number }) {
  return (
    <section className="mt-8 text-center">
      <h1 className="mx-auto max-w-[560px] break-keep text-[clamp(24px,5vw,32px)] font-bold leading-[1.35] tracking-[-0.03em] [text-wrap:balance]">
        {headline}
      </h1>
      <div className="mt-6 text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
        {flowYear}년의 흐름
      </div>
    </section>
  );
}
