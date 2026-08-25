import { SectionHeading } from "./SectionHeading";
import { CardGrid } from "./CardGrid";
import { InfoCard } from "./InfoCard";
import { WORK_AXES, axisRows } from "@/app/api/saju/_lib/sections";
import type { WorkStyleContent } from "../_lib/report-content";

/** 축 다섯이라 카드 그리드가 3+2 로 앉는다 — 05·10 과 같은 부품을 쓴다. */
export function WorkStyleSection({ content }: { content: WorkStyleContent }) {
  return (
    <section className="mt-[72px]">
      <SectionHeading section="workStyle" />
      <CardGrid>
        {axisRows(WORK_AXES, content).map((row) => (
          <InfoCard key={row.label} label={row.label}>
            {row.body}
          </InfoCard>
        ))}
      </CardGrid>
    </section>
  );
}
