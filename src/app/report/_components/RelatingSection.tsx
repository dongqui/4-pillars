import { SectionHeading } from "./SectionHeading";
import type { KeyValue } from "../_lib/report-content";

export function RelatingSection({ rows }: { rows: KeyValue[] }) {
  return (
    <section className="mt-[72px]">
      <SectionHeading no="06" category="사람을 대하는 방식" title="관계에서의 나" />
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
      <div className="mt-3.5 bg-slate-900 rounded-2xl p-6 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[220px]">
          <div className="text-base font-bold text-white tracking-[-0.01em]">나와 잘 맞는 사람은 어떤 유형일까요?</div>
          <p className="text-[13.5px] text-slate-400 mt-[5px] mb-0 leading-[1.6] break-keep [text-wrap:pretty]">
            상대방의 생년월일을 입력하고 두 사람의 관계를 확인해 보세요.
          </p>
        </div>
        <button
          type="button"
          className="flex-none font-[inherit] text-sm font-semibold text-slate-900 bg-white border-none px-5 py-3 rounded-xl cursor-pointer hover:bg-slate-100"
        >
          궁합 보기 →
        </button>
      </div>
    </section>
  );
}
