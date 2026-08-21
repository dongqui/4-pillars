"use client";
import {
  creditedTickets,
  formatKrw,
  formatPerTicket,
  type TicketPackage,
  type TicketPackageId,
} from "../_lib/pricing";

/**
 * 충전 패키지 선택. 디자인은 카드형이지만 PaymentMethodList 처럼 실제 radio 를 쓴다 —
 * 키보드 화살표 이동, 탭 정지점 하나, 스크린 리더의 "3개 중 1번째" 안내가 공짜로 따라온다.
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
      <h2 className="m-0 mb-4 text-[15px] font-bold tracking-[-0.01em]">
        충전할 이용권
      </h2>
      <div className="flex flex-col gap-2.5">
        {packages.map((p) => {
          const total = creditedTickets(p);
          const active = p.id === selected;
          return (
            <label
              key={p.id}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border-[1.5px] px-4 py-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40 ${
                active
                  ? "border-accent bg-accent/5"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="ticket-package"
                value={p.id}
                checked={active}
                onChange={() => onSelect(p.id)}
                className="sr-only"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-[15.5px] font-bold tracking-[-0.01em]">
                    이용권 {total}장
                  </span>
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
              <span className="flex-none text-[15px] font-bold">
                {formatKrw(p.amount)}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
