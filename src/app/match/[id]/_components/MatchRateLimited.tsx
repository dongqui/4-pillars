/**
 * 시간당 생성 한도에 걸렸을 때. 실패가 아니라 "조금 기다리면 된다" 라서
 * MatchError 와 문구를 나눈다 — ReportRateLimited 와 같은 판단이다.
 * 여기서 MatchError 를 쓰면 사용자는 새로고침을 반복하고, 새로고침은 한도 안에서
 * 아무 일도 하지 않으므로 영원히 같은 화면을 본다.
 *
 * ReportRateLimited 와 달리 CTA 가 없다. 그쪽은 "로그인하면 지금 이어서 볼 수 있어요"
 * 라는 다음 걸음이 있지만, 궁합은 이미 로그인한 사용자의 계정별 한도라
 * 지금 할 수 있는 일이 없다 — MatchShell 헤더의 "내 프로필" 이 유일한 출구다.
 * 만들어 둔 궁합은 사라지지 않으니 이 URL 로 돌아오면 이어서 만들어진다.
 */
export function MatchRateLimited() {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center py-[clamp(80px,20vw,160px)] text-center"
    >
      <div className="text-[22px] font-bold tracking-tight">잠시 후에 다시 열어주세요</div>
      <p className="mt-3 max-w-[400px] text-[15px] leading-[1.6] text-slate-500 [text-wrap:pretty]">
        짧은 시간에 궁합을 너무 많이 만들었어요. 한 시간 뒤에 이 화면을 다시 열면 이어서
        만들어 드려요.
      </p>
    </div>
  );
}
