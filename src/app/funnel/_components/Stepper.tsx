import { STEPS, stepIndex } from "../_lib/steps";

interface Props {
  index: number;
}

const meta: Record<(typeof STEPS)[number], { label: string; sub: string }> = {
  name: { label: "이름", sub: "리포트 표시 이름" },
  gender: { label: "성별", sub: "양·음 기운 해석" },
  birth: { label: "생년월일", sub: "만세력 환산" },
  time: { label: "태어난 시간", sub: "시주 계산" },
  review: { label: "확인", sub: "입력 내용 검토" },
};

export function Stepper({ index }: Props) {
  const last = STEPS.length - 1;
  return (
    <nav className="mt-11 flex flex-col">
      {STEPS.map((key, i) => {
        const active = i === index;
        const done = i < index;
        const m = meta[key];
        return (
          <div key={key} className="flex gap-[15px] items-start">
            <div className="flex flex-col items-center flex-none">
              <div
                className={`w-7 h-7 flex-none rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  done
                    ? "bg-accent text-white"
                    : active
                    ? "bg-white text-accent border-2 border-accent shadow-[0_0_0_4px_#EFF6FF]"
                    : "bg-white text-slate-300 border-2 border-dashed border-slate-200"
                }`}
              >
                {done ? "✓" : i + 1}
              </div>
              {i !== last && (
                <div
                  className="w-[2px] h-[26px] my-1.5 rounded-full transition-colors"
                  style={{ background: done ? "#2563EB" : "#E2E8F0" }}
                />
              )}
            </div>
            <div className={i !== last ? "pb-[22px]" : ""}>
              <div
                className={`text-[15.5px] transition-colors ${
                  active || done
                    ? "font-bold text-slate-900"
                    : "font-semibold text-slate-400"
                }`}
              >
                {m.label}
              </div>
              <div className={`text-[12.5px] text-slate-400 mt-0.5 ${active ? "" : "opacity-70"}`}>
                {m.sub}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// stepIndex re-export 편의 (미사용시 무시)
export { stepIndex };
