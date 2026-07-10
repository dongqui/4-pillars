"use client";

interface Props {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export function OptionCard({ selected, onClick, children, className = "" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-semibold rounded-2xl transition-all cursor-pointer border-2 ${
        selected
          ? "border-accent bg-accent-50 text-accent"
          : "border-slate-200 bg-white text-slate-900"
      } ${className}`}
    >
      {children}
    </button>
  );
}
