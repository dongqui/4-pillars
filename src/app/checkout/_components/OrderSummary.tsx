"use client";
import { FULL_REPORT_PRICE, formatKrw, formatKrwDiscount } from "../_lib/pricing";
import type { OrderTarget } from "../_lib/to-order";
import { LockGlyph } from "./LockGlyph";
import { PayButton } from "./PayButton";

export function OrderSummary({
  target,
  agreed,
  pending,
  onToggleAgree,
  onPay,
}: {
  target: OrderTarget;
  agreed: boolean;
  pending: boolean;
  onToggleAgree: () => void;
  onPay: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_3px_rgba(17,24,39,.04)]">
      <div className="px-[18px] pt-5 pb-[18px] sm:px-6 sm:pt-[22px] sm:pb-5">
        <h2 className="m-0 mb-4 text-[15px] font-bold tracking-[-0.01em]">주문 내역</h2>

        <div className="flex items-center gap-[13px] border-b border-slate-100 pb-[18px]">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-accent/10 text-base font-bold text-accent">
            {target.initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold tracking-[-0.01em]">
              사주 전체 리포트
            </span>
            <span className="mt-0.5 block text-[13px] text-slate-400">{target.label}</span>
          </span>
        </div>

        <div className="flex flex-col gap-2.5 border-b border-slate-100 py-[18px]">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">리포트 12개 섹션</span>
            <span className="font-semibold">{formatKrw(FULL_REPORT_PRICE.list)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">첫 리포트 할인</span>
            <span className="font-semibold text-red-600">
              {formatKrwDiscount(FULL_REPORT_PRICE.discount)}
            </span>
          </div>
        </div>

        <div className="flex items-baseline justify-between pt-[18px]">
          <span className="text-[15px] font-bold">최종 결제 금액</span>
          <span className="text-2xl font-bold tracking-[-0.03em]">
            {formatKrw(FULL_REPORT_PRICE.total)}
          </span>
        </div>
      </div>

      <div className="px-[18px] pb-5 sm:px-6 sm:pb-6">
        <label className="mb-3.5 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={agreed}
            onChange={onToggleAgree}
            className="sr-only"
          />
          <span
            aria-hidden
            className={`mt-px flex h-5 w-5 flex-none items-center justify-center rounded-md border-[1.5px] text-xs font-bold text-white ${
              agreed ? "border-accent bg-accent" : "border-slate-300 bg-white"
            }`}
          >
            {agreed && "✓"}
          </span>
          <span className="text-[13px] leading-[1.55] text-slate-500 [text-wrap:pretty]">
            결제 진행 및 <a href="#" className="text-accent hover:text-accent-700">전자상거래 이용약관</a>,{" "}
            <a href="#" className="text-accent hover:text-accent-700">개인정보 제3자 제공</a>에 동의합니다.
          </span>
        </label>

        {/* 모바일에서는 하단 고정 바가 같은 역할을 한다 — 버튼이 둘 보이지 않게 여기서 숨긴다. */}
        <PayButton
          agreed={agreed}
          pending={pending}
          onPay={onPay}
          label={`${formatKrw(FULL_REPORT_PRICE.total)} 결제하기`}
          className="hidden w-full shadow-[0_12px_24px_-12px_rgba(37,99,235,.7)] disabled:shadow-none sm:block"
        />

        <div className="mt-0.5 flex items-center justify-center gap-[7px] text-xs text-slate-300 sm:mt-3.5">
          <LockGlyph className="h-3 w-[11px] border-slate-300" />
          PortOne 보안 결제 · KG이니시스
        </div>
      </div>
    </div>
  );
}
