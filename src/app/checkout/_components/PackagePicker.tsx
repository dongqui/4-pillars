"use client";
import { creditedTickets, formatKrw, formatPerTicket, type TicketPackage, type TicketPackageId } from "../_lib/pricing";

/**
 * 충전 패키지 선택. PaymentMethodList 와 같은 라디오 그룹 모양이라 키보드 동작이 같다.
 *
 * 보너스를 별도 배지로 빼는 이유: "6장"만 보이면 5,000원에 6장이라는 이득이 안 읽힌다.
 */
export function PackagePicker({
  packages,
  selected,
  onSelect,
}: {
  packages: TicketPackage[];
  selected: TicketPackageId;
  onSelect: (id: TicketPackageId) => void;
}) {
  return (
    <section className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(17,24,39,.04)] sm:p-6">
      <h2 className="m-0 mb-4 text-[15px] font-bold tracking-[-0.01em]">충전할 이용권</h2>
      <div role="radiogroup" aria-label="충전 패키지" className="flex flex-col gap-2.5">
        {packages.map((p) => {
          const total = creditedTickets(p);
          const active = p.id === selected;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(p.id)}
              className={`flex items-center justify-between gap-3 rounded-[14px] border-[1.5px] px-4 py-3.5 text-left transition-colors ${
                active ? "border-accent bg-accent/5" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[15.5px] font-bold tracking-[-0.01em]">이용권 {total}장</span>
                  {p.bonus > 0 && (
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11.5px] font-bold text-accent">
                      +{p.bonus}장 더
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-[13px] text-slate-400">
                  {formatPerTicket(p.amount, total)}
                </span>
              </span>
              <span className="flex-none text-[15px] font-bold">{formatKrw(p.amount)}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3.5 mb-0 text-[12.5px] leading-[1.6] text-slate-400 [text-wrap:pretty]">
        이용권 1장으로 리포트 한 편을 열 수 있어요. 한 번 연 리포트는 계속 볼 수 있어요.
      </p>
    </section>
  );
}
