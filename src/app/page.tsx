import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { resolveDisplayName } from "@/lib/auth/display-name";
import { LandingNav } from "./_components/LandingNav";
import { Hero } from "./_components/Hero";
import { CharacterSection } from "./_components/CharacterSection";
import { RelationMapSection } from "./_components/RelationMapSection";
import { MenuSection } from "./_components/MenuSection";
import { TrustSection } from "./_components/TrustSection";
import { FooterCta } from "./_components/FooterCta";

/**
 * 로그인 여부는 세션만으로 확정된다. 이름은 DB 조회라서 실패할 수 있는데, 랜딩은
 * 로그인 없이도 보여야 하는 페이지라 DB 장애로 500 을 내면 안 된다 — 삼켜서 폴백한다.
 * (/home 은 로그인 필수 페이지라 같은 조회를 그대로 던지게 둔다.)
 */
async function navDisplayName(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  try {
    return resolveDisplayName(await getUser(session.userId));
  } catch (e) {
    console.error("[landing] getUser", e instanceof Error ? e.message : e);
    return resolveDisplayName(null);
  }
}

export default async function Home() {
  // 한 번만 읽어서 내비 · 히어로 · 마지막 CTA 가 같은 상태를 본다.
  const displayName = await navDisplayName();

  return (
    <div className="flex-1">
      <LandingNav displayName={displayName} />
      <Hero displayName={displayName} />
      <CharacterSection />
      <RelationMapSection />
      <MenuSection />
      <TrustSection />
      <FooterCta displayName={displayName} />
    </div>
  );
}
