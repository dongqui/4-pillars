import type { OverviewContent } from "@/app/api/flows/_lib/sections";
import type { FlowSectionView } from "../_lib/to-flow-view";

/**
 * 01(overview) 의 대표 문장과 키워드(§34). LLM 서술이 필요해 <Suspense> 안,
 * FlowBody 와 함께 도착한다.
 *
 * overview 생성이 실패했으면(부분 생성) 대표 문장을 만들 재료가 없다 — 조용히
 * 건너뛴다. 아래 FlowBody 가 확보된 섹션만으로 이어간다.
 */
export function FlowHero({
  sections,
  flowYear,
}: {
  sections: FlowSectionView[];
  flowYear: number;
}) {
  const view = sections.find((s) => s.key === "overview");
  if (!view) return null;
  const overview = view.content as OverviewContent;

  return (
    <section className="mt-8 text-center">
      <h1 className="mx-auto max-w-[560px] break-keep text-[clamp(24px,5vw,32px)] font-bold leading-[1.35] tracking-[-0.03em] [text-wrap:balance]">
        {overview.title}
      </h1>
      {overview.keywords.length > 0 && (
        <>
          <div className="mt-6 text-[11.5px] font-bold tracking-[0.08em] text-slate-400">
            {flowYear}년의 키워드
          </div>
          <div className="mt-2 text-[15px] font-semibold tracking-[-0.02em] text-slate-700">
            {overview.keywords.join(" · ")}
          </div>
        </>
      )}
    </section>
  );
}
