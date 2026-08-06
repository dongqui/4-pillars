import { getSession } from "@/lib/auth/session";
import { getUser } from "@/lib/auth/users";
import { resolveDisplayName } from "@/lib/auth/display-name";
import { LandingNav } from "./_components/LandingNav";
import { Hero } from "./_components/Hero";
import { KnowSection } from "./_components/KnowSection";
import { SampleReport } from "./_components/SampleReport";
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
  return (
    <div className="flex-1">
      <LandingNav displayName={await navDisplayName()} />
      <Hero />
      <KnowSection />
      <SampleReport />
      <TrustSection />
      <FooterCta />
    </div>
  );
}
