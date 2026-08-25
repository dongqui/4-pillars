import { SectionHeading } from "./SectionHeading";
import { CtaCard } from "./CtaCard";
import { ctaHref } from "../_lib/cta";
import type { KeyValue } from "../_lib/report-content";

export function RelatingSection({
  rows,
  isLoggedIn,
}: {
  rows: KeyValue[];
  isLoggedIn: boolean;
}) {
  return (
    <section className="mt-[72px]">
      <SectionHeading section="relating" />
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex flex-wrap gap-x-4 gap-y-1 px-5 py-[17px] items-baseline ${
              i < rows.length - 1 ? "border-b border-slate-100" : ""
            }`}
          >
            <span className="flex-none w-32 text-[13px] font-semibold text-slate-400">{row.label}</span>
            <span className="flex-1 min-w-[200px] text-sm text-slate-700 leading-[1.6]">{row.value}</span>
          </div>
        ))}
      </div>
      {/* 관계 맺는 방식을 읽은 직후, 그 관계들이 실제로 어떻게 놓여 있는지로 잇는다.
          지도는 이용권을 쓰지 않아 무료로 적는다 (app/_lib/catalog.ts 와 같은 결). */}
      <CtaCard
        title="내 주변 사람들은 나에게 어떤 자리일까요?"
        desc="한 사람씩 추가하면 그 사람이 나에게 어떤 역할인지 보여요. 몇 명이든 무료예요."
        label="관계 지도 열기 →"
        href={ctaHref("/map", isLoggedIn)}
      />
    </section>
  );
}
