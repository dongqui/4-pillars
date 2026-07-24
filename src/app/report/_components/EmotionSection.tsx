import { SectionHeading } from "./SectionHeading";
import { CardGrid } from "./CardGrid";
import { InfoCard } from "./InfoCard";
import type { LabeledText } from "../_lib/report-content";

export function EmotionSection({ items }: { items: LabeledText[] }) {
  return (
    <section className="mt-[72px]">
      <SectionHeading no="05" category="감정과 스트레스" title="힘들 때 이런 패턴이 나타나요" />
      <CardGrid>
        {items.map((item) => (
          <InfoCard key={item.label} label={item.label}>
            {item.body}
          </InfoCard>
        ))}
      </CardGrid>
    </section>
  );
}
