import { LandingNav } from "./_components/LandingNav";
import { Hero } from "./_components/Hero";
import { KnowSection } from "./_components/KnowSection";
import { SampleReport } from "./_components/SampleReport";
import { TrustSection } from "./_components/TrustSection";
import { FooterCta } from "./_components/FooterCta";

export default function Home() {
  return (
    <div className="flex-1">
      <LandingNav />
      <Hero />
      <KnowSection />
      <SampleReport />
      <TrustSection />
      <FooterCta />
    </div>
  );
}
