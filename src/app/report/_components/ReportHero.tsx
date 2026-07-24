import type { ReportContent } from "../_lib/report-content";

type Props = Pick<ReportContent, "headline" | "summary" | "keywords"> & { meta: ReportContent["meta"] };

export function ReportHero({ meta, headline, summary, keywords }: Props) {
  return (
    <section className="text-center">
      <div className="text-[13px] text-slate-400 font-mono">{meta.name} · {meta.birthLine}</div>
      <h1 className="text-[clamp(26px,5.5vw,36px)] font-bold tracking-[-0.03em] leading-[1.35] mt-[18px] mx-auto max-w-[560px] [text-wrap:balance] break-keep">{headline}</h1>
      <p className="text-[clamp(15px,2.5vw,16px)] text-slate-500 mt-4 mx-auto max-w-[440px] [text-wrap:pretty] break-keep">{summary}</p>
      <div className="flex flex-wrap justify-center gap-2 mt-[26px]">
        {keywords.map((k) => (
          <span key={k} className="text-[13px] font-semibold text-slate-700 bg-slate-100 px-[13px] py-1.5 rounded-full">{k}</span>
        ))}
      </div>
    </section>
  );
}
