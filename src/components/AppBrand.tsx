import Link from "next/link";
import type { ComponentProps } from "react";
import { BrandLogo, type BrandSize, type BrandTone } from "./BrandLogo";

interface AppBrandProps {
  /** 로고를 눌렀을 때 갈 곳. 로그인했으면 /home, 아니면 랜딩(/) 을 넘긴다. */
  href?: string;
  /**
   * 이동을 가로챌 때 쓴다(e.preventDefault()). onClick 이 아니라 onNavigate 인 이유 —
   * Cmd/Ctrl+클릭(새 탭)에서는 호출되지 않는다. 새 탭은 현재 화면을 잃지 않으니
   * 확인을 물을 이유도 없다.
   */
  onNavigate?: ComponentProps<typeof Link>["onNavigate"];
  size?: BrandSize;
  tone?: BrandTone;
}

export function AppBrand({ href = "/", onNavigate, size = "md", tone = "dark" }: AppBrandProps) {
  return (
    <Link
      href={href}
      onNavigate={onNavigate}
      className="inline-flex rounded-[10px] transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <BrandLogo size={size} tone={tone} />
    </Link>
  );
}
