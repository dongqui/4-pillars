import type { ReportContent } from "../_lib/report-content";
import type { ReportAccess } from "../_lib/access";
import { lockedSections } from "../_lib/report-content.fixture";
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

export function ReportBody({
  content,
  access,
  profileId,
}: {
  content: ReportContent;
  access: ReportAccess;
  /** 잠긴 섹션의 CTA 를 결제로 보내는 데 쓴다. 픽스처 데모에는 없다. */
  profileId?: string;
}) {
  return (
    <>
      <ReportHero meta={content.meta} headline={content.headline} summary={content.summary} keywords={content.keywords} />
      <PersonalitySection items={content.personality} evidence={content.evidence} />
      <OuterInnerSection data={content.outerVsInner} />
      <StrengthsSection items={content.strengths} />
      <CautionsSection cautions={content.cautions} tip={content.cautionTip} />
      {access.isPaid ? (
        <>
          {content.emotion && <EmotionSection items={content.emotion} />}
          {content.relating && <RelatingSection rows={content.relating} />}
          {content.environment && (
            <EnvironmentSection
              energizing={content.environment.energizing}
              draining={content.environment.draining}
              summary={content.environment.summary}
              emphasis={content.environment.emphasis}
            />
          )}
          {content.love && <LoveSection items={content.love} />}
          {content.compatibility && (
            <CompatibilitySection
              good={content.compatibility.good}
              clash={content.compatibility.clash}
            />
          )}
          {content.wealth && (
            <WealthSection
              points={content.wealth.points}
              summary={content.wealth.summary}
              emphasis={content.wealth.emphasis}
            />
          )}
          {content.yearlyLuck && <YearlyLuckSection rows={content.yearlyLuck} />}
          {content.daeunOutlook && (
            <DaeunSection
              rows={content.daeunOutlook.rows}
              summary={content.daeunOutlook.summary}
              emphasis={content.daeunOutlook.emphasis}
            />
          )}
        </>
      ) : (
        <LockedSections sections={lockedSections} isLoggedIn={access.isLoggedIn} profileId={profileId} />
      )}
    </>
  );
}
