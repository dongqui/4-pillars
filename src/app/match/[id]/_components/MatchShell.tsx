import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

const HOME_LINK =
  "text-[13px] font-semibold text-slate-700 bg-white border border-slate-200 px-[14px] py-2 rounded-[10px] hover:bg-slate-50";

/**
 * 헤더까지의 껍데기 — ReportShell 과 같은 이유로 존재한다: 본문(children)이
 * <Suspense> 안에서 늦게 도착해도 헤더는 즉시 그려져야 한다.
 * 이 경로는 항상 로그인을 요구하므로(page.tsx) ReportShell 과 달리
 * showHomeLink 를 받지 않는다 — 여기 도달했다면 항상 세션이 있다.
 */
export function MatchShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white min-h-screen text-slate-900 leading-normal break-keep [overflow-wrap:break-word]">
      <header className="sticky top-0 z-20 bg-white/[0.92] backdrop-blur-[8px] border-b border-slate-100">
        <div className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] py-[14px] flex items-center justify-between gap-3">
          <BrandLogo size="xs" />
          <Link href="/home" className={HOME_LINK}>
            ← 내 프로필
          </Link>
        </div>
      </header>
      <main className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] pt-[clamp(36px,7vw,64px)] pb-24">
        {children}
      </main>
    </div>
  );
}
