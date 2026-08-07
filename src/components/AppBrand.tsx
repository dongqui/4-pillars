import Link from "next/link";

interface AppBrandProps {
  /** 로고를 눌렀을 때 갈 곳. 로그인했으면 /home, 아니면 랜딩(/) 을 넘긴다. */
  href?: string;
  iconClassName?: string;
  textClassName?: string;
}

export function AppBrand({
  href = "/",
  iconClassName = "w-[30px] h-[30px] rounded-[10px] bg-slate-900 text-[15px]",
  textClassName = "font-semibold text-base tracking-tight",
}: AppBrandProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-[10px] transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div
        className={`flex items-center justify-center text-white font-semibold ${iconClassName}`}
      >
        사
      </div>
      <span className={textClassName}>사주</span>
    </Link>
  );
}
