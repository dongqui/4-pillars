import { AppBrand } from "@/components/AppBrand";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <header className="border-b border-slate-100">
        <div className="max-w-[720px] mx-auto px-6 h-14 flex items-center">
          <AppBrand href="/" size="sm" />
        </div>
      </header>
      <main className="max-w-[720px] mx-auto px-6 py-12">{children}</main>
    </div>
  );
}
