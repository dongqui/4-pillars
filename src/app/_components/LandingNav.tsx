import Link from "next/link";
import { AppBrand } from "@/components/AppBrand";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 bg-white/[.78] backdrop-blur-md border-b border-slate-100">
      <div className="max-w-[1120px] mx-auto px-8 h-[68px] flex items-center justify-between">
        <AppBrand />
        <nav className="flex items-center gap-1.5">
          <a href="#know" className="text-[14.5px] font-medium text-slate-600 px-3.5 py-2 rounded-[10px] hover:bg-slate-100">
            알아보기
          </a>
          <a href="#sample" className="text-[14.5px] font-medium text-slate-600 px-3.5 py-2 rounded-[10px] hover:bg-slate-100">
            예시 리포트
          </a>
          <a href="#trust" className="text-[14.5px] font-medium text-slate-600 px-3.5 py-2 rounded-[10px] hover:bg-slate-100">
            신뢰
          </a>
          <Link
            href="/funnel?step=name"
            className="ml-2.5 text-[14.5px] font-semibold text-white bg-accent px-[18px] py-2.5 rounded-xl hover:opacity-90"
          >
            내 리포트 만들기
          </Link>
        </nav>
      </div>
    </header>
  );
}
