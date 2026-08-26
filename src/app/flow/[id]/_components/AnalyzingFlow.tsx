/**
 * 흐름 본문(FlowHero + FlowBody) Suspense fallback. AnalyzingMatch 와 같은 구조다.
 */
export function AnalyzingFlow() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-[clamp(80px,20vw,160px)] text-center"
    >
      <div className="w-[60px] h-[60px] rounded-full border-[3px] border-slate-200 border-t-accent animate-spin" />
      <div className="text-[22px] font-bold mt-[30px] tracking-tight">지금의 흐름을 풀어보고 있어요</div>
      <div className="text-[15px] text-slate-500 mt-2">사주와 지금 시점을 겹쳐 보는 중이에요</div>
      <div className="text-[13px] text-slate-400 mt-5">
        처음 한 번만 조금 걸려요. 다음부터는 바로 열려요.
      </div>
    </div>
  );
}
