"use client";

interface Props {
  /** 고른 값. 없으면 placeholder 를 흐리게 보여준다. */
  value: string | null;
  placeholder: string;
  icon: string;
  onClick: () => void;
  /** 비활성처럼 보이지만 누를 수는 있다 — 누르면 부모가 되살린다. */
  muted?: boolean;
  "aria-label": string;
}

/**
 * 눌러서 휠 피커를 여는 큰 값 칸(시안의 날짜·시간 필드). 입력 상자가 아니라
 * 버튼이다 — 키보드가 아니라 시트가 뜬다.
 */
export function PickerField({ value, placeholder, icon, onClick, muted, ...rest }: Props) {
  const empty = value === null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rest["aria-label"]}
      className={`flex w-full cursor-pointer items-center justify-between rounded-[14px] border px-[18px] py-[18px] text-left transition-colors md:rounded-2xl md:px-[22px] md:py-[22px] ${
        muted
          ? "border-slate-200 bg-slate-50 text-slate-300"
          : `border-slate-300 bg-white hover:border-accent ${empty ? "text-slate-300" : "text-slate-900"}`
      }`}
    >
      <span className="text-[22px] font-bold tracking-[-0.01em] tabular-nums md:text-[26px]">
        {value ?? placeholder}
      </span>
      <span aria-hidden className="text-lg md:text-xl">
        {icon}
      </span>
    </button>
  );
}
