import type { MatchHeroView } from "../_lib/to-match-view";

const AVATAR =
  "flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 text-lg font-bold text-slate-700";
const NAME = "text-[13.5px] font-semibold text-slate-600 mt-2";
const BADGE =
  "text-[13px] font-semibold text-slate-700 bg-slate-100 px-[13px] py-1.5 rounded-full";

/**
 * 계산값만 쓴다 — LLM 을 기다리지 않고 즉시 렌더된다(<Suspense> 바깥).
 * 배지는 title 속성으로 hint 를 달아 둔다. 다섯 섹션이 아직 로딩 중이어도
 * "이 둘이 어떤 사이인지" 는 여기서 먼저 보여줄 것이 있어야 스피너만 보고
 * 기다리는 시간이 덜 답답하다.
 */
export function MatchHero({ view }: { view: MatchHeroView }) {
  return (
    <section className="text-center">
      <div className="text-[13px] text-slate-400 font-mono">{view.relationLabel}</div>
      <div className="flex items-center justify-center gap-5 mt-[18px]">
        <div className="flex flex-col items-center">
          <div className={AVATAR}>{view.subject.initial}</div>
          <div className={NAME}>{view.subject.name}</div>
        </div>
        <div className="text-slate-300 text-xl mb-6">×</div>
        <div className="flex flex-col items-center">
          <div className={AVATAR}>{view.counterpart.initial}</div>
          <div className={NAME}>{view.counterpart.name}</div>
        </div>
      </div>
      <h1 className="text-[clamp(24px,5vw,32px)] font-bold tracking-[-0.03em] leading-[1.35] mt-6 mx-auto max-w-[560px] [text-wrap:balance] break-keep">
        {view.label}
      </h1>
      <div className="flex flex-wrap justify-center gap-2 mt-[26px]">
        {view.badges.map((badge, i) => (
          <span key={i} title={badge.hint} className={BADGE}>
            {badge.name}
          </span>
        ))}
      </div>
    </section>
  );
}
