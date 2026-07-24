import type { ReportContent } from "../_lib/report-content";
import type { ReportAccess } from "../_lib/access";
import { lockedSections } from "../_lib/report-content.fixture";
import { ReportHeader } from "./ReportHeader";
import { ReportHero } from "./ReportHero";
import { PersonalitySection } from "./PersonalitySection";
import { OuterInnerSection } from "./OuterInnerSection";
import { StrengthsSection } from "./StrengthsSection";
import { CautionsSection } from "./CautionsSection";
import { LockedSections } from "./LockedSections";
import { EmotionSection } from "./EmotionSection";
import { RelatingSection } from "./RelatingSection";
import { EnvironmentSection } from "./EnvironmentSection";
import { LoveSection } from "./LoveSection";
import { CompatibilitySection } from "./CompatibilitySection";
import { WealthSection } from "./WealthSection";
import { YearlyLuckSection } from "./YearlyLuckSection";
import { DaeunSection } from "./DaeunSection";

export function ReportView({ content, access }: { content: ReportContent; access: ReportAccess }) {
  return (
    <div className="bg-white min-h-screen text-slate-900 leading-normal break-keep [overflow-wrap:break-word]">
      <ReportHeader />
      <main className="max-w-[720px] mx-auto px-[clamp(20px,5vw,24px)] pt-[clamp(36px,7vw,64px)] pb-24">
        <ReportHero meta={content.meta} headline={content.headline} summary={content.summary} keywords={content.keywords} />
        <PersonalitySection items={content.personality} evidence={content.evidence} />
        <OuterInnerSection data={content.outerVsInner} />
        <StrengthsSection items={content.strengths} />
        <CautionsSection cautions={content.cautions} tip={content.cautionTip} />
        {access.isPaid ? (
          <>
            <EmotionSection items={content.emotion} />
            <RelatingSection rows={content.relating} />
            <EnvironmentSection axes={content.environment.axes} summary={content.environment.summary} emphasis={content.environment.emphasis} />
            <LoveSection items={content.love} />
            <CompatibilitySection good={content.compatibility.good} clash={content.compatibility.clash} />
            <WealthSection points={content.wealth.points} summary={content.wealth.summary} emphasis={content.wealth.emphasis} />
            <YearlyLuckSection rows={content.yearlyLuck} />
            <DaeunSection rows={content.daeunOutlook.rows} summary={content.daeunOutlook.summary} emphasis={content.daeunOutlook.emphasis} />
          </>
        ) : (
          <LockedSections sections={lockedSections} />
        )}
      </main>
    </div>
  );
}
