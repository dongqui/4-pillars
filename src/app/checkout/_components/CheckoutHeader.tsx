import { LockGlyph } from "./LockGlyph";

export function CheckoutHeader() {
  return (
    <header className="border-b border-slate-100 bg-white/[.86] backdrop-blur-[14px]">
      <div className="mx-auto flex h-16 max-w-[1040px] items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-slate-900 text-sm font-semibold text-white">
            사
          </div>
          <span className="text-[15.5px] font-semibold tracking-[-0.02em]">사주</span>
        </div>
        <div className="flex items-center gap-[7px] text-[13px] font-semibold text-slate-500">
          <LockGlyph className="h-[15px] w-[13px] border-slate-400" />
          안전 결제
        </div>
      </div>
    </header>
  );
}
