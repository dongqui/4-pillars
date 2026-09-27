import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LandingNav } from "./_components/LandingNav";
import { Hero } from "./_components/Hero";
import { CharacterSection } from "./_components/CharacterSection";
import { MenuSection } from "./_components/MenuSection";
import { TrustSection } from "./_components/TrustSection";
import { FooterCta } from "./_components/FooterCta";

/**
 * 랜딩은 비로그인 방문자용이다. 로그인한 사람은 세션만 보고 바로 /home 으로 보낸다
 * (DB 조회 없이 판정하니 DB 장애가 랜딩을 500 으로 만들지 않는다).
 */
export default async function Home() {
  if (await getSession()) redirect("/home");

  return (
    <div className="flex-1">
      <LandingNav displayName={null} />
      <Hero displayName={null} />
      <CharacterSection />
      <MenuSection />
      <TrustSection />
      <FooterCta displayName={null} />
    </div>
  );
}
