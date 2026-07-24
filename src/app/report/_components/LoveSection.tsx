import { SectionHeading } from "./SectionHeading";
import { CardGrid } from "./CardGrid";
import { InfoCard } from "./InfoCard";
import type { LabeledText } from "../_lib/report-content";

export function LoveSection({ items }: { items: LabeledText[] }) {
  return (
    <section className="mt-[72px]">
      <SectionHeading no="08" category="연애와 관계" title="연애할 때 반복되는 관계 패턴" />
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
