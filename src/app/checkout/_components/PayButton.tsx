"use client";

/**
 * 결제 시작 버튼. 인라인(데스크톱)과 하단 고정 바(모바일) 두 곳에서 쓴다.
 * onClick 이 붙는 자리가 여기 하나뿐이도록 두 곳이 이 컴포넌트를 공유한다.
 */
export function PayButton({
  agreed,
  pending,
  label,
  onPay,
  className = "",
}: {
  agreed: boolean;
  /** 결제 진행 중. 두 번 눌러 주문이 두 개 생기는 것을 막는다. */
  pending: boolean;
  label: string;
  onPay: () => void;
  className?: string;
}) {
  const enabled = agreed && !pending;
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onPay}
      className={`rounded-[14px] py-4 text-base font-bold tracking-[-0.01em] transition-opacity ${
        enabled
          ? "cursor-pointer bg-accent text-white hover:opacity-[.92]"
          : "cursor-not-allowed bg-slate-100 text-slate-400"
      } ${className}`}
    >
      {pending ? "결제 중…" : label}
    </button>
  );
}
