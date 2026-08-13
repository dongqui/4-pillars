import { BrandLogo } from "@/components/BrandLogo";
import { LockGlyph } from "./LockGlyph";

export function CheckoutHeader() {
  return (
    <header className="border-b border-slate-100 bg-white/[.86] backdrop-blur-[14px]">
      <div className="mx-auto flex h-16 max-w-[1040px] items-center justify-between gap-4 px-6">
        <BrandLogo size="sm" />
        <div className="flex items-center gap-[7px] text-[13px] font-semibold text-slate-500">
          <LockGlyph className="h-[15px] w-[13px] border-slate-400" />
          안전 결제
        </div>
      </div>
    </header>
  );
}
