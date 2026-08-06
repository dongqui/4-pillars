import { displayInitial } from "@/lib/auth/display-name";

export function HomeHeader({ displayName }: { displayName: string }) {
  const initial = displayInitial(displayName);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/[0.82] backdrop-blur-[14px]">
      <div className="mx-auto flex h-16 max-w-[880px] items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-slate-900 text-sm font-semibold text-white">
            사
          </div>
          <span className="text-[15.5px] font-semibold tracking-[-0.02em]">사주</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white py-[5px] pl-[5px] pr-[13px] text-sm font-semibold text-slate-900">
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-accent-soft text-[12.5px] font-bold text-accent">
              {initial}
            </span>
            {displayName}님
          </div>
          {/* 로그아웃은 POST 전용 라우트라 링크가 아니라 폼이어야 한다. */}
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="cursor-pointer text-[13px] font-medium text-slate-400 hover:text-slate-600"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
