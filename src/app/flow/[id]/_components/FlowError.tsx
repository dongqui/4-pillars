/**
 * 서술을 하나도 확보하지 못했을 때. FlowShell 안(위치 요약 아래)에 들어간다 —
 * 헤더는 남아 있어야 사용자가 /home 으로 나갈 수 있다. MatchError 와 같은 판단으로
 * retryHref 를 받지 않는다 — 흐름도 매 흐름별 URL 하나뿐이라 새로고침이 곧 재시도다.
 */
export function FlowError() {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-[clamp(80px,20vw,160px)] text-center"
    >
      <div className="text-[22px] font-bold tracking-tight">흐름을 만들지 못했어요</div>
      <p className="text-[15px] text-slate-500 mt-3 max-w-[380px]">
        서술을 쓰는 중에 문제가 생겼어요. 새로고침해서 다시 시도해 주세요.
      </p>
    </div>
  );
}
