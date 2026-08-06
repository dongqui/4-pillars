import Link from "next/link";
import { AppBrand } from "@/components/AppBrand";
import { UserMenu } from "./UserMenu";

const ANCHORS = [
  { href: "#know", label: "알아보기" },
  { href: "#sample", label: "예시 리포트" },
  { href: "#trust", label: "신뢰" },
];

interface LandingNavProps {
  /** 로그인하지 않았으면 null. 이름은 page.tsx 에서 폴백까지 끝내고 넘어온다. */
  displayName: string | null;
}

export function LandingNav({ displayName }: LandingNavProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/[.78] backdrop-blur-md border-b border-slate-100">
      <div className="max-w-[1120px] mx-auto px-8 h-[68px] flex items-center justify-between">
        <AppBrand />
        <nav className="flex items-center gap-1.5">
          {/* 모바일에서는 섹션 앵커를 접는다 — 로그인 진입점과 CTA 가 먼저다. */}
          <div className="hidden items-center gap-1.5 sm:flex">
            {ANCHORS.map((a) => (
              <a
                key={a.href}
                href={a.href}
                className="text-[14.5px] font-medium text-slate-600 px-3.5 py-2 rounded-[10px] hover:bg-slate-100"
              >
                {a.label}
              </a>
            ))}
          </div>

          {displayName === null ? (
            <>
              {/* /login 의 기본 행선지가 이미 /home 이라 next 를 붙이지 않는다. */}
              <Link
                href="/login"
                className="text-[14.5px] font-medium text-slate-600 px-3.5 py-2 rounded-[10px] hover:bg-slate-100"
              >
                로그인
              </Link>
              <Link
                href="/funnel?step=name"
                className="ml-2.5 text-[14.5px] font-semibold text-white bg-accent px-[18px] py-2.5 rounded-xl hover:opacity-90"
              >
                내 리포트 만들기
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/home"
                className="ml-2.5 text-[14.5px] font-semibold text-white bg-accent px-[18px] py-2.5 rounded-xl hover:opacity-90"
              >
                내 리포트 보기
              </Link>
              <UserMenu displayName={displayName} />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
