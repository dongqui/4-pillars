"use client";

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative w-12 h-[27px] rounded-full flex-none transition-colors cursor-pointer"
      style={{ background: checked ? "#2563EB" : "#CBD5E1" }}
    >
      <span
        className="absolute top-[2px] w-[23px] h-[23px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,.25)] transition-[left]"
        style={{ left: checked ? "23px" : "2px" }}
      />
    </button>
  );
}
