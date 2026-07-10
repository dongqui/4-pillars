import { Badge } from "@/components/Badge";

const rows = [
  { k: "성향 요약", v: "신중하고 분석적인 내향형" },
  { k: "관계 스타일", v: "신뢰를 천천히, 깊게" },
  { k: "직업 적성", v: "전략 · 기획 · 연구" },
  { k: "인생 흐름", v: "30대 중반, 결실의 시기" },
];

export function ReportPreviewCard() {
  return (
    <div className="flex-1 min-w-[300px] max-w-[480px] bg-white border border-slate-100 rounded-3xl shadow-[0_36px_80px_-32px_rgba(17,24,39,.24),0_2px_8px_rgba(17,24,39,.04)] overflow-hidden text-left">
      <div className="px-[26px] py-[22px] border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex-none rounded-full bg-accent-50 text-accent flex items-center justify-center font-bold text-base">
            지
          </div>
          <div>
            <div className="text-[15px] font-bold tracking-tight">지우님의 리포트</div>
            <div className="text-xs text-slate-400">사주로 정리한 나</div>
          </div>
        </div>
        <span className="text-[11.5px] font-semibold text-accent bg-accent-50 px-2.5 py-[5px] rounded-full whitespace-nowrap">
          생년월일
        </span>
      </div>
      <div className="px-[26px] py-6">
        <div className="text-xl font-bold leading-snug tracking-tight text-slate-900">
          깊이 있게 사고하고,
          <br />
          신중하게 판단하는 사람
        </div>
        <div className="flex flex-wrap gap-[7px] mt-4">
          <Badge>분석력</Badge>
          <Badge>책임감</Badge>
          <Badge>적응력</Badge>
        </div>
        <div className="h-px bg-slate-100 my-5" />
        <div className="flex flex-col gap-1">
          {rows.map((r) => (
            <div key={r.k} className="flex items-center justify-between gap-4 px-3.5 py-3 rounded-2xl">
              <span className="text-[13px] text-slate-400 flex-none">{r.k}</span>
              <span className="text-sm font-semibold text-slate-700 text-right">{r.v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
