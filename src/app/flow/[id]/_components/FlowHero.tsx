import type { FlowSectionView } from "../_lib/to-flow-view";

/**
 * 01(now) 의 현재 구간 title 을 대표 문장으로 세운다. LLM 서술이 필요해
 * <Suspense> 안, FlowBody 와 함께 도착한다 — MatchHero 와 달리 계산값만으로는
 * 만들 수 없는 문장이라 FlowShell 의 위치 요약과 자리를 나눈다.
 *
 * now 섹션 생성이 실패했으면(부분 생성) 대표 문장을 만들 재료가 없다 — 조용히
 * 건너뛴다. 아래 FlowBody 가 확보된 섹션만으로 이어간다.
 */
export function FlowHero({ sections }: { sections: FlowSectionView[] }) {
  const now = sections.find((s) => s.key === "now");
  if (!now?.current) return null;

  return (
    <section className="text-center mt-8">
      <h1 className="text-[clamp(24px,5vw,32px)] font-bold tracking-[-0.03em] leading-[1.35] mx-auto max-w-[560px] [text-wrap:balance] break-keep">
        {now.current.title}
      </h1>
    </section>
  );
}
