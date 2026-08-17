/**
 * 서술을 하나도 확보하지 못했을 때. <main> 안에 들어간다 — 헤더(히어로 포함)는
 * 남아 있어야 사용자가 /home 으로 나갈 수 있다.
 *
 * ReportError 와 달리 retryHref 를 받지 않는다: 궁합은 매치별 URL 하나뿐이라
 * 다시 시도할 곳이 지금 이 페이지 자신이다. 새로고침이 그대로 재시도라
 * 별도 링크를 만들 이유가 없다(<a href="."> 는 클라이언트 라우터가 같은 URL을
 * 이동으로 안 보는 문제가 ReportError 주석에도 적혀 있다).
 */
export function MatchError() {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-[clamp(80px,20vw,160px)] text-center"
    >
      <div className="text-[22px] font-bold tracking-tight">궁합을 만들지 못했어요</div>
      <p className="text-[15px] text-slate-500 mt-3 max-w-[380px]">
        서술을 쓰는 중에 문제가 생겼어요. 새로고침해서 다시 시도해 주세요.
      </p>
    </div>
  );
}
