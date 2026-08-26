/**
 * 시간당 생성 한도에 걸렸을 때. MatchRateLimited 와 같은 판단으로 CTA 가 없다 —
 * 계정별 시간 한도라 지금 할 수 있는 일이 없고, 이 URL 로 돌아오면 이어서
 * 만들어진다.
 */
export function FlowRateLimited() {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-[clamp(80px,20vw,160px)] text-center"
    >
      <div className="text-[22px] font-bold tracking-tight">잠시 후에 다시 열어주세요</div>
      <p className="mt-3 max-w-[400px] text-[15px] leading-[1.6] text-slate-500 [text-wrap:pretty]">
        짧은 시간에 흐름을 너무 많이 열었어요. 한 시간 뒤에 이 화면을 다시 열면 이어서
        만들어 드려요.
      </p>
    </div>
  );
}
