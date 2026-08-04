/**
 * 해석을 하나도 확보하지 못했을 때. <main> 안에 들어간다 —
 * 헤더는 남아 있어야 사용자가 /home 으로 나갈 수 있다.
 *
 * 다시 시도는 <a> 다. <Link> 로 같은 URL 을 누르면 클라이언트 라우터가
 * 이동으로 보지 않아 아무 일도 일어나지 않는다.
 */
export function ReportError({ retryHref }: { retryHref: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-[clamp(80px,20vw,160px)] text-center">
      <div className="text-[22px] font-bold tracking-tight">리포트를 만들지 못했어요</div>
      <p className="text-[15px] text-slate-500 mt-3 max-w-[380px]">
        해석을 쓰는 중에 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.
      </p>
      <a
        href={retryHref}
        className="mt-7 rounded-xl bg-accent px-5 py-[11px] text-[14.5px] font-semibold text-white hover:opacity-90"
      >
        다시 시도
      </a>
    </div>
  );
}
