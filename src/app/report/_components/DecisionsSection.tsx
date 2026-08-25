import { SectionHeading } from "./SectionHeading";
import { DECISION_AXES, axisRows } from "@/app/api/saju/_lib/sections";
import type { DecisionsContent } from "../_lib/report-content";

/**
 * 축이 고정된 섹션이라 라벨을 화면이 들고 있지 않는다 — axes.ts 에서 읽는다.
 * 06 은 본문이 2~3문장이라 관계(09)의 두 칸 배치 대신 라벨을 본문 위에 얹는다.
 */
export function DecisionsSection({ content }: { content: DecisionsContent }) {
  const rows = axisRows(DECISION_AXES, content);
  return (
    <section className="mt-[72px]">
      <SectionHeading section="decisions" />
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`px-[22px] py-5 ${i < rows.length - 1 ? "border-b border-slate-100" : ""}`}
          >
            <div className="text-[13px] font-bold text-accent">{row.label}</div>
            <p className="text-sm text-slate-700 leading-[1.65] mt-1.5 mb-0 break-keep [text-wrap:pretty]">
              {row.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
