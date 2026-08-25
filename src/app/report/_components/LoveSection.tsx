import { SectionHeading } from "./SectionHeading";
import { CardGrid } from "./CardGrid";
import { InfoCard } from "./InfoCard";
import type { LabeledText } from "../_lib/report-content";

export function LoveSection({ items }: { items: LabeledText[] }) {
  return (
    <section className="mt-[72px]">
      <SectionHeading section="love" />
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
