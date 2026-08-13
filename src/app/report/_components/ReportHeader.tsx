import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";

export function ReportHeader({ showHomeLink }: { showHomeLink: boolean }) {
  return (
    <header className="sticky top-0 z-20 bg-white/[0.92] backdrop-blur-[8px] border-b border-slate-100">
      <div className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] py-[14px] flex items-center justify-between gap-3">
        <BrandLogo size="xs" />
        <div className="flex items-center gap-2">
          {showHomeLink && (
            // 세션이 있을 때만 보인다 — 비로그인 방문자는 프로필 목록이 없다.
            <Link
              href="/home"
              className="text-[13px] font-semibold text-slate-700 bg-white border border-slate-200 px-[14px] py-2 rounded-[10px] hover:bg-slate-50"
            >
              ← 내 프로필
            </Link>
          )}
          <button type="button" className="text-[13px] font-semibold text-slate-700 bg-white border border-slate-200 px-[14px] py-2 rounded-[10px] cursor-pointer hover:bg-slate-50">공유하기</button>
        </div>
      </div>
    </header>
  );
}
