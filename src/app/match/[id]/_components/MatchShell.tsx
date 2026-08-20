import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { HomeLink } from "@/components/HomeLink";

/**
 * 헤더까지의 껍데기 — ReportShell 과 같은 이유로 존재한다: 본문(children)이
 * <Suspense> 안에서 늦게 도착해도 헤더는 즉시 그려져야 한다.
 */
export function MatchShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white min-h-screen text-slate-900 leading-normal break-keep [overflow-wrap:break-word]">
      <header className="sticky top-0 z-20 bg-white/[0.92] backdrop-blur-[8px] border-b border-slate-100">
        <div className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] py-[14px] flex items-center justify-between gap-3">
          <BrandLogo size="xs" />
          <HomeLink />
        </div>
      </header>
      <main className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] pt-[clamp(36px,7vw,64px)] pb-24">
        {children}
      </main>
    </div>
  );
}
