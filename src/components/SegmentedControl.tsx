"use client";

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: Props<T>) {
  return (
    <div
      className={`flex gap-[3px] bg-slate-100 rounded-xl p-[3px] ${className}`}
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 text-sm rounded-[9px] py-[11px] transition-all cursor-pointer ${
              on
                ? "bg-white text-slate-900 font-semibold shadow-[0_1px_2px_rgba(15,23,42,.08)]"
                : "bg-transparent text-slate-500 font-medium"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
