import Link from "next/link";
import { AppBrand } from "@/components/AppBrand";
import { HomeMenu } from "./HomeMenu";

export function HomeHeader({
  displayName,
  balance,
}: {
  displayName: string | null;
  /** 비로그인이면 null — 잔액이 0 인 것과 다르다. */
  balance: number | null;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-[14px]">
      <div className="mx-auto flex h-14 max-w-[780px] items-center justify-between gap-3 px-5 md:px-8">
        <AppBrand href="/home" size="xs" />
        <div className="flex items-center gap-2.5">
          {balance !== null && (
            // 0장일 때도 보여준다 — 없다는 사실이 곧 충전 유인이다.
            <Link
              href="/checkout?next=/home"
              className="rounded-full bg-slate-100 px-3 py-1.5 text-[12.5px] font-bold text-slate-600 hover:bg-slate-200"
            >
              이용권 {balance}장
            </Link>
          )}
          <HomeMenu displayName={displayName} />
        </div>
      </div>
    </header>
  );
}
