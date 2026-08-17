/**
 * 리포트 본문 Suspense fallback. <main> 안에 들어가므로 min-h-screen 을 쓰지 않는다.
 * 퍼널의 CalculatingScreen 과 문구가 다른 이유: 여기서 오래 걸리는 건 만세력이 아니라
 * LLM 해석 생성이다.
 */
export function AnalyzingReport({ name }: { name: string }) {
  const who = name.trim();
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-[clamp(80px,20vw,160px)] text-center"
    >
      <div className="w-[60px] h-[60px] rounded-full border-[3px] border-slate-200 border-t-accent animate-spin" />
      <div className="text-[22px] font-bold mt-[30px] tracking-tight">리포트를 쓰고 있어요</div>
      <div className="text-[15px] text-slate-500 mt-2">
        {who ? `${who}님의 ` : ""}원국을 읽고 해석을 작성하는 중이에요
      </div>
      <div className="text-[13px] text-slate-400 mt-5">
        처음 한 번만 조금 걸려요. 다음부터는 바로 열려요.
      </div>
    </div>
  );
}
