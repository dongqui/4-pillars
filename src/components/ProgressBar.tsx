interface Props {
  value: number;
  max: number;
  /** sm 은 모바일 퍼널 머리글의 3px 실선(시안 "thin progress"). */
  size?: "sm" | "md";
}

export function ProgressBar({ value, max, size = "md" }: Props) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className={`flex-1 bg-slate-100 rounded-full overflow-hidden ${
        size === "sm" ? "h-[3px]" : "h-[5px]"
      }`}
    >
      <div
        className="h-full bg-accent rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
