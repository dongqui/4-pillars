import Link from "next/link";

/**
 * 서비스 화면(리포트·궁합·상담)에서 홈으로 돌아가는 길.
 *
 * 리포트와 궁합이 같은 마크업을 두 벌 갖고 있었고 상담·궁합 입력에는 아예 없었다 —
 * 세 화면이 같은 자리에 같은 버튼을 두려면 모양도 문구도 한 곳에서 나와야 한다.
 *
 * 문구가 "내 프로필" 이 아니라 "홈" 인 이유: /home 은 더 이상 프로필 목록이 아니라
 * 캐릭터·리포트·상담·관계 지도·궁합이 모두 걸린 중심 화면이다.
 */
export function HomeLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/home"
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-[14px] py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      <span aria-hidden>←</span>홈
    </Link>
  );
}
