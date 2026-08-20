import Link from "next/link";
import { AppBrand } from "@/components/AppBrand";
import { UserMenu } from "./UserMenu";

interface LandingNavProps {
  /** 로그인하지 않았으면 null. 이름은 page.tsx 에서 폴백까지 끝내고 넘어온다. */
  displayName: string | null;
}

export function LandingNav({ displayName }: LandingNavProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/[.82] backdrop-blur-md">
      <div className="mx-auto flex h-[60px] max-w-[1120px] items-center justify-between gap-3.5 px-5 md:h-[68px] md:px-8">
        {/* 로그인했으면 로고도 /home 으로 — 랜딩에서는 그대로 맨 위로 돌아간다. */}
        <AppBrand href={displayName === null ? "/" : "/home"} />
        <nav className="flex items-center gap-1.5">
          {displayName === null ? (
            <>
              {/* /login 의 기본 행선지가 이미 /home 이라 next 를 붙이지 않는다. */}
              <Link
                href="/login"
                className="rounded-[10px] px-3.5 py-2 text-[14.5px] font-medium text-slate-600 hover:bg-slate-100"
              >
                로그인
              </Link>
              <Link
                href="/funnel?step=name"
                className="whitespace-nowrap rounded-xl bg-accent px-[18px] py-2.5 text-[14.5px] font-semibold text-white hover:bg-accent-700"
              >
                시작하기
              </Link>
            </>
          ) : (
            <>
              {/* 리포트만 있는 곳이 아니다 — 홈에는 캐릭터·상담·관계 지도·궁합이
                  같이 걸려 있다. 그 전부를 덮는 말로 "내 사주" 를 쓴다. */}
              <Link
                href="/home"
                className="ml-2.5 whitespace-nowrap rounded-xl bg-accent px-[18px] py-2.5 text-[14.5px] font-semibold text-white hover:bg-accent-700"
              >
                내 사주 보기
              </Link>
              <UserMenu displayName={displayName} />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
