import Link from "next/link";

/**
 * 이용권이 없어서 궁합을 못 열었을 때. MatchRateLimited 와 나란하지만 다른 화면이다 —
 * 한도는 기다리면 풀리지만 잔액 부족은 충전이라는 할 일이 있어야 풀린다.
 *
 * 정상 경로에서는 잘 나오지 않는다 — 만들기(POST /api/matches)에서 canCreateMatch 가
 * 이미 잔액을 확인하기 때문이다. 그 사이 다른 탭에서 이용권을 다 썼거나, 이 링크를
 * 직접 열었을 때만 여기 닿는다.
 *
 * 충전은 결제 페이지로 보내되 제자리(이 궁합)로 돌아오게 한다.
 */
export function MatchOutOfTickets({ matchId }: { matchId: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-[clamp(80px,20vw,160px)] text-center"
    >
      <div className="text-[22px] font-bold tracking-tight">이용권이 부족해요</div>
      <p className="mt-3 max-w-[400px] text-[15px] leading-[1.6] text-slate-500 [text-wrap:pretty]">
        궁합을 볼 이용권이 없어요. 충전하면 이 화면으로 돌아와 바로 이어서 볼 수 있어요.
      </p>
      <Link
        href={`/checkout?next=${encodeURIComponent(`/match/${matchId}`)}`}
        className="mt-7 rounded-xl bg-accent px-5 py-[11px] text-[14.5px] font-semibold text-white hover:bg-accent-700"
      >
        충전하고 이어서 보기
      </Link>
    </div>
  );
}
