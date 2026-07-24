import Link from "next/link";
import type { ReactNode } from "react";
import { AppBrand } from "@/components/AppBrand";

interface LoginShellProps {
  children: ReactNode;
}

export function LoginShell({ children }: LoginShellProps) {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <header className="px-5 sm:px-8 py-5 flex items-center justify-between">
        <AppBrand />
        <Link
          href="/"
          className="text-sm font-medium text-slate-400 hover:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ← 돌아가기
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-5 sm:px-8 pb-20 pt-6">
        <div className="w-full max-w-[380px] text-center">{children}</div>
      </main>
    </div>
  );
}
