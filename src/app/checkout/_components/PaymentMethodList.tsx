"use client";
import type { PaymentMethod, PaymentMethodId } from "../_lib/methods";

export function PaymentMethodList({
  methods,
  selected,
  onSelect,
}: {
  /** 서버가 채널키를 확인해 거른 목록. 여기서 다시 거르지 않는다. */
  methods: PaymentMethod[];
  selected: PaymentMethodId;
  onSelect: (id: PaymentMethodId) => void;
}) {
  const note = methods.find((m) => m.id === selected)?.note ?? "";

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white px-4 py-5 shadow-[0_1px_3px_rgba(17,24,39,.04)] sm:p-6">
      <div className="mb-[18px] flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-[17px] font-bold tracking-[-0.02em]">결제 수단</h2>
        <span className="text-[12.5px] text-slate-300">KRW 결제</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {methods.map((m) => {
          const on = m.id === selected;
          return (
            // 디자인은 div + onClick 이지만 실제 radio 를 쓴다 — 키보드 화살표 이동과
            // 스크린 리더의 "3개 중 1번째" 안내가 공짜로 따라온다.
            <label
              key={m.id}
              className={`flex min-h-[56px] cursor-pointer items-center gap-[13px] rounded-[14px] border-[1.5px] px-4 py-[17px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40 ${
                on ? "border-accent bg-accent/[.04]" : "border-slate-200 bg-white"
              }`}
            >
              <input
                type="radio"
                name="payment-method"
                value={m.id}
                checked={on}
                onChange={() => onSelect(m.id)}
                className="sr-only"
              />
              <span
                className={`flex h-[19px] w-[19px] flex-none items-center justify-center rounded-full border-[1.5px] ${
                  on ? "border-accent bg-accent" : "border-slate-300 bg-white"
                }`}
              >
                {on && <span className="block h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <span
                className={`flex h-7 w-[42px] flex-none items-center justify-center rounded-[7px] text-[12.5px] font-bold tracking-[-0.01em] ${m.logoClass}`}
              >
                {m.logo}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold tracking-[-0.01em]">{m.name}</span>
                <span className="mt-0.5 block text-[13px] text-slate-400">{m.desc}</span>
              </span>
              {m.badge && (
                <span className="flex-none rounded-full bg-accent/10 px-[9px] py-1 text-[11.5px] font-bold whitespace-nowrap text-accent">
                  {m.badge}
                </span>
              )}
            </label>
          );
        })}
      </div>

      {/* 결제창이 새로 열린다는 사실을 누르기 전에 알린다. 선택을 바꾸면 이 문장도 바뀐다. */}
      <p
        aria-live="polite"
        className="mt-4 rounded-[14px] border border-slate-100 bg-slate-50 px-[17px] py-[15px] text-[13.5px] leading-[1.6] text-slate-500 [text-wrap:pretty]"
      >
        {note}
      </p>
    </section>
  );
}
