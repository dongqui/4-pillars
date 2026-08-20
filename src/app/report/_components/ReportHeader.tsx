import { BrandLogo } from "@/components/BrandLogo";
import { HomeLink } from "@/components/HomeLink";

export function ReportHeader() {
  return (
    <header className="sticky top-0 z-20 bg-white/[0.92] backdrop-blur-[8px] border-b border-slate-100">
      <div className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] py-[14px] flex items-center justify-between gap-3">
        <BrandLogo size="xs" />
        <div className="flex items-center gap-2">
          {/*
            세션이 있을 때만 보이던 링크다. 이제 항상 보인다 — /home 은 로그인을
            요구하지 않고(쿠키의 익명 드래프트 한 장을 보여준다), 계정도 드래프트도
            없으면 EmptyState 가 퍼널로 안내한다. 어느 쪽이든 막다른 곳이 아니다.
          */}
          <HomeLink />
          <button type="button" className="text-[13px] font-semibold text-slate-700 bg-white border border-slate-200 px-[14px] py-2 rounded-[10px] cursor-pointer hover:bg-slate-50">공유하기</button>
        </div>
      </div>
    </header>
  );
}
