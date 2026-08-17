"use client";
import { creditedTickets, formatKrw, type TicketPackage } from "../_lib/pricing";
import { LockGlyph } from "./LockGlyph";
import { PayButton } from "./PayButton";

export function OrderSummary({
  pkg,
  balance,
  agreed,
  canPay,
  pending,
  onToggleAgree,
  onPay,
}: {
  pkg: TicketPackage;
  /** 충전 전 잔액. 충전 뒤 얼마가 되는지 보여 주려고 받는다. */
  balance: number;
  /** 체크박스가 그대로 반영하는 값. 결제수단이 0개여도 동의 자체는 눈에 보여야 한다. */
  agreed: boolean;
  /** 결제 버튼 활성화 조건 — agreed && ready. 체크박스에는 쓰지 않는다. */
  canPay: boolean;
  pending: boolean;
  onToggleAgree: () => void;
  onPay: () => void;
}) {
  const credited = creditedTickets(pkg);

  return (
    <div className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_1px_3px_rgba(17,24,39,.04)]">
      <div className="px-[18px] pt-5 pb-[18px] sm:px-6 sm:pt-[22px] sm:pb-5">
        <h2 className="m-0 mb-4 text-[15px] font-bold tracking-[-0.01em]">주문 내역</h2>

        <div className="flex flex-col gap-2.5 border-b border-slate-100 pb-[18px]">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">이용권 {pkg.tickets}장</span>
            <span className="font-semibold">{formatKrw(pkg.amount)}</span>
          </div>
          {pkg.bonus > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">묶음 보너스</span>
              <span className="font-semibold text-accent">+{pkg.bonus}장</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">충전 후 잔액</span>
            <span className="font-semibold">{balance + credited}장</span>
          </div>
        </div>

        <div className="flex items-baseline justify-between pt-[18px]">
          <span className="text-[15px] font-bold">최종 결제 금액</span>
          <span className="text-2xl font-bold tracking-[-0.03em]">{formatKrw(pkg.amount)}</span>
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
            {/* 새 탭으로 연다 — 결제수단 선택·동의 상태가 이 화면에만 있어서 이동하면 날아간다. */}
            결제 진행 및{" "}
            <a
              href="/terms"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-accent-700"
            >
              전자상거래 이용약관
            </a>
            ,{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-accent-700"
            >
              개인정보 처리방침
            </a>
            에 동의합니다.
          </span>
        </label>

        {/* 모바일에서는 하단 고정 바가 같은 역할을 한다 — 버튼이 둘 보이지 않게 여기서 숨긴다. */}
        <PayButton
          agreed={canPay}
          pending={pending}
          onPay={onPay}
          label={`${formatKrw(pkg.amount)} 결제하기`}
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
