"use client";
import { FULL_REPORT_PRICE, formatKrw } from "../_lib/pricing";
import { PayButton } from "./PayButton";

/**
 * 모바일 하단 고정 결제 바. 좁은 화면에서는 주문 요약이 스크롤 아래로 밀려나
 * 결제 버튼이 화면 밖에 있게 된다.
 */
export function StickyPayBar({ agreed }: { agreed: boolean }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-slate-200 bg-white/95 px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[14px] sm:hidden">
      <div className="mx-auto flex max-w-[520px] items-center gap-3.5">
        <div className="flex-none">
          <div className="text-[11.5px] font-semibold text-slate-400">최종 결제 금액</div>
          <div className="text-xl leading-tight font-bold tracking-[-0.03em]">
            {formatKrw(FULL_REPORT_PRICE.total)}
          </div>
        </div>
        <PayButton agreed={agreed} label="결제하기" className="flex-1" />
      </div>
    </div>
  );
}
