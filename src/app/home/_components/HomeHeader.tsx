import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";

export function HomeHeader({
  displayName,
  balance,
}: {
  displayName: string | null;
  /** 비로그인이면 null — 잔액이 0 인 것과 다르다. */
  balance: number | null;
}) {
  return (
    // 홈 본문은 max-w-[780px] px-5/md:px-8 이다 — 헤더도 같은 값을 써야 로고가
    // 본문 왼쪽 끝에 선다.
    <AppHeader displayName={displayName} inner="max-w-[780px] px-5 md:px-8">
      {balance !== null && (
        // 0장일 때도 보여준다 — 없다는 사실이 곧 충전 유인이다.
        <Link
          href="/checkout?next=/home"
          className="rounded-full bg-slate-100 px-3 py-1.5 text-[12.5px] font-bold text-slate-600 hover:bg-slate-200"
        >
          이용권 {balance}장
        </Link>
      )}
    </AppHeader>
  );
}
