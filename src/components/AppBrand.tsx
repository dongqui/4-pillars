interface AppBrandProps {
  iconClassName?: string;
  textClassName?: string;
}

export function AppBrand({
  iconClassName = "w-[30px] h-[30px] rounded-[10px] bg-slate-900 text-[15px]",
  textClassName = "font-semibold text-base tracking-tight",
}: AppBrandProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={`flex items-center justify-center text-white font-semibold ${iconClassName}`}
      >
        사
      </div>
      <span className={textClassName}>사주</span>
    </div>
  );
}
