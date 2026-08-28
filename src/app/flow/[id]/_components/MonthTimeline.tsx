import type { FlowMonth } from "@/app/api/flows/_lib/pivots";
import type { MonthsContent } from "@/app/api/flows/_lib/sections";
import { monthLabel, monthRange } from "../_lib/current-month";

/**
 * 12개월 타임라인. 이 서비스에서 가장 중요한 콘텐츠다(§17).
 *
 * 세 가지를 화면이 붙인다 — LLM 은 순번만 알고 시점을 쓰지 않는다:
 *   1. 달 이름과 절기 기준 기간 (§18)
 *   2. 변곡점 강조 (§9) — flows.months 의 박제된 플래그가 근거다
 *   3. "지금" 배지 — 선택한 해가 지금의 명리 연도일 때만 (§23)
 */
export function MonthTimeline({
  content,
  months,
  currentIndex,
}: {
  content: MonthsContent;
  months: FlowMonth[];
  /** 지금이 속한 달. 지난 해·다가올 해면 null */
  currentIndex: number | null;
}) {
  const metaOf = new Map(months.map((m) => [m.index, m]));

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {content.months.map((body) => {
        const meta = metaOf.get(body.monthIndex);
        if (!meta) return null;
        const isNow = body.monthIndex === currentIndex;

        return (
          <article
            key={body.monthIndex}
            className={`rounded-2xl border p-4 ${
              meta.pivot ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[15px] font-bold tracking-[-0.02em]">
                {monthLabel(meta)}
              </span>
              <span className="text-[13.5px] font-semibold text-slate-700">{body.title}</span>
              {meta.pivot && (
                <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10.5px] font-bold text-white">
                  흐름이 바뀌는 달
                </span>
              )}
              {isNow && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-bold text-white">
                  현재
                </span>
              )}
              <span className="ml-auto text-[11.5px] text-slate-400">{monthRange(meta)}</span>
            </div>
            <p className="mt-2 text-[13.5px] leading-[1.65] text-slate-600">{body.body}</p>
          </article>
        );
      })}
    </div>
  );
}
