import { AppBrand } from "@/components/AppBrand";
import { HomeMenu } from "./HomeMenu";

export function HomeHeader({ displayName }: { displayName: string | null }) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-[14px]">
      <div className="mx-auto flex h-14 max-w-[780px] items-center justify-between gap-3 px-5 md:px-8">
        <AppBrand href="/home" size="xs" />
        <HomeMenu displayName={displayName} />
      </div>
    </header>
  );
}
